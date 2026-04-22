/**
 * Server-side bill-number generator (Task #255).
 *
 * Implements the unified {ORG_CODE}-{YYYYMM}-{CAT}-{SEQ4} format with a
 * sequence-allocation loop that relies on the existing UNIQUE constraint
 * on `bills.bill_number`. We pick the next free SEQ4 by scanning current
 * numbers for the (org, period, cat) scope, then race-protect with a
 * retry on unique-constraint violations during insert.
 *
 * We deliberately did NOT introduce a `bill_number_sequences` counter
 * table: the existing storage pattern is to rely on bills.bill_number's
 * unique index, and write contention here is low (a few inserts/sec at
 * peak). If that ever changes, a counter table is a drop-in replacement.
 */

import { and, eq, like, sql } from 'drizzle-orm';
import { db } from '../db';
import { bills } from '../../shared/schemas/financial';
import { organizations } from '../../shared/schemas/core';
import { buildings } from '../../shared/schemas/property';
import {
  assembleBillNumber,
  billingPeriodToYyyyMm,
  categoryToCatCode,
  generateChildBillNumber as childFmt,
  type BillSource,
} from '../../shared/schemas/bill-number';

export const MAX_SEQ_PER_SCOPE = 9999;

export interface BillNumberRequest {
  /** Pre-resolved organization code (e.g. "MCP1"). */
  orgCode: string;
  /** Bill billing period — Date or YYYY-MM-DD string. */
  billingPeriod: Date | string;
  /** Bill category enum value, or null/undefined for the GENL fallback. */
  category: string | null | undefined;
}

/**
 * Resolve the organization code for a building. Throws if the org has no
 * code yet (callers should ensure orgs are backfilled before flipping the
 * V2 flag on; the migration handles this at deploy time).
 */
export async function resolveOrgCodeForBuilding(buildingId: string): Promise<string> {
  const rows = await db
    .select({ code: organizations.code })
    .from(buildings)
    .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
    .where(eq(buildings.id, buildingId))
    .limit(1);
  const code = rows[0]?.code;
  if (!code) {
    throw new Error(
      `[bill-number-v2] Building ${buildingId} has no resolvable organization code. ` +
        `Run the organizations.code backfill migration before enabling BILL_NUMBER_V2.`,
    );
  }
  return code;
}

/**
 * Allocate the next sequence number for the given (org, period, cat) scope
 * by inspecting existing bill numbers. Returns 1 when none exist.
 */
async function peekNextSeq(prefix: string): Promise<number> {
  const rows = await db
    .select({ billNumber: bills.billNumber })
    .from(bills)
    .where(like(bills.billNumber, `${prefix}-____%`));

  let max = 0;
  // We accept exactly 4 digits after the final dash (optionally followed by
  // a -P** child suffix, which we ignore for sequence purposes).
  const re = new RegExp(`^${escapeRegExp(prefix)}-(\\d{4})(?:-P\\d{2})?$`);
  for (const r of rows) {
    const m = r.billNumber.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate a unique base bill number for the given scope. Returns the
 * formatted string but does NOT insert a row — the caller is expected to
 * insert the bill with this number, and a UNIQUE-constraint failure will
 * surface as an error there. To absorb a tiny race window we re-peek the
 * sequence on retry.
 */
export async function generateBillNumberV2(req: BillNumberRequest): Promise<string> {
  const yyyymm = billingPeriodToYyyyMm(req.billingPeriod);
  const cat = categoryToCatCode(req.category);
  const prefix = `${req.orgCode}-${yyyymm}-${cat}`;
  const seq = await peekNextSeq(prefix);
  if (seq > MAX_SEQ_PER_SCOPE) {
    throw new Error(
      `[bill-number-v2] Sequence exhausted for scope ${prefix} (>${MAX_SEQ_PER_SCOPE}).`,
    );
  }
  return assembleBillNumber(req.orgCode, yyyymm, cat, seq);
}

/**
 * Wrapper around an insert that retries on UNIQUE-constraint races for
 * `bill_number`. The `mintNumber` thunk MUST re-derive a fresh number on
 * each call so that we get a new SEQ4 on each retry.
 */
export async function withBillNumberRetry<T>(
  mintNumber: () => Promise<string>,
  insert: (billNumber: string) => Promise<T>,
  maxAttempts = 5,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const billNumber = await mintNumber();
    try {
      return await insert(billNumber);
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message ?? e);
      const code = e?.code ?? e?.cause?.code;
      const isUniqueViolation =
        code === '23505' ||
        /duplicate key value violates unique constraint/i.test(msg) ||
        /bill_number/i.test(msg);
      if (!isUniqueViolation) {
        throw e;
      }
      // Tiny backoff to let the colliding writer commit.
      await new Promise((r) => setTimeout(r, 5 * attempt));
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error('[bill-number-v2] Exhausted retries for unique bill number');
}

/**
 * Build a child (installment / fiscal-year-split) bill number from a
 * parent. Re-exported from the shared module for convenience.
 */
export const generateChildBillNumber = childFmt;

/**
 * Convenience: pick a default `source` value when callers haven't set one
 * explicitly (e.g. legacy code paths that we haven't updated yet).
 */
export function defaultSource(fallback: BillSource): BillSource {
  return fallback;
}
