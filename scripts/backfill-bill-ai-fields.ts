#!/usr/bin/env tsx

/**
 * Backfill AI-extracted bill fields for legacy rows (Task #347).
 *
 * Bills uploaded before Task #338 stored AI-extraction metadata in
 * `bills.ai_analysis_data` (JSONB) but did not populate the new
 * `issue_date` / `vendor_invoice_number` columns or per-installment
 * amounts on `bills.costs`. This one-shot script re-reads
 * `ai_analysis_data` for historical bills and populates those fields
 * when the JSON contains usable values.
 *
 * The script is idempotent: it only updates a column when the column
 * is currently NULL (issue_date / vendor_invoice_number) or when the
 * existing `costs` array looks like a single-total placeholder while
 * the JSON exposes a multi-installment breakdown that sums to the same
 * total. Re-running the script after a successful pass is a no-op.
 *
 * Usage:
 *   npx tsx scripts/backfill-bill-ai-fields.ts            # apply changes
 *   npx tsx scripts/backfill-bill-ai-fields.ts --dry-run  # log only
 *
 * The picker helpers below are exported so they can be unit-tested in
 * tests/unit/backfill-bill-ai-fields.test.ts without touching the DB.
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { and, eq, isNotNull, isNull, or, sql as dsql } from 'drizzle-orm';
import { bills } from '../shared/schemas/financial';
import { buildings } from '../shared/schemas/property';
import { resolveDatabaseUrl } from './run-migrations-url';

const DRY_RUN = process.argv.includes('--dry-run');
const IS_MAIN_MODULE =
  typeof require !== 'undefined' && require.main === module;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const VENDOR_INVOICE_NUMBER_MAX_LENGTH = 100;
export const COSTS_TOTAL_TOLERANCE = 0.01;

export function asString(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length === 0 ? null : t;
  }
  return null;
}

export function pickIssueDate(analysis: Record<string, unknown>): string | null {
  const candidate = asString(analysis.issueDate) ?? asString(analysis.issue_date);
  if (!candidate || !DATE_RE.test(candidate)) return null;
  // Strict calendar validation: reject impossible dates like 2025-02-31
  // that `new Date(...)` would silently roll over (and the DB would reject
  // mid-script, aborting the rest of the backfill).
  const [yStr, mStr, dStr] = candidate.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (
    parsed.getUTCFullYear() !== y ||
    parsed.getUTCMonth() !== m - 1 ||
    parsed.getUTCDate() !== d
  ) {
    return null;
  }
  return candidate;
}

export function pickVendorInvoiceNumber(
  analysis: Record<string, unknown>,
): string | null {
  const candidate =
    asString(analysis.billNumber) ??
    asString(analysis.bill_number) ??
    asString(analysis.invoiceNumber) ??
    asString(analysis.vendorInvoiceNumber);
  if (!candidate) return null;
  return candidate.slice(0, VENDOR_INVOICE_NUMBER_MAX_LENGTH);
}

export function pickInstallmentCosts(
  analysis: Record<string, unknown>,
  currentCosts: string[] | null,
  totalAmount: string,
): string[] | null {
  const raw = analysis.customPayments;
  if (!Array.isArray(raw) || raw.length < 2) return null;

  const amounts: string[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null;
    const amt = (entry as Record<string, unknown>).amount;
    const num = typeof amt === 'number' ? amt : Number(amt);
    if (!Number.isFinite(num) || num < 0) return null;
    amounts.push(num.toFixed(2));
  }

  // Only overwrite a single-entry costs array (legacy placeholder).
  if (!currentCosts || currentCosts.length !== 1) return null;

  const sum = amounts.reduce((acc, n) => acc + Number(n), 0);
  const total = Number(totalAmount);
  if (!Number.isFinite(total)) return null;
  if (Math.abs(sum - total) > COSTS_TOTAL_TOLERANCE) return null;

  return amounts;
}

interface OrgStats {
  scanned: number;
  issueDateUpdated: number;
  vendorInvoiceUpdated: number;
  costsUpdated: number;
  rowsUpdated: number;
}

async function main(): Promise<void> {
  // Route through the same alias-aware helper the runtime uses (Task #940)
  // so the script accepts DATABASE_URL_KOVEO or PRODUCTION_DATABASE_URL in
  // production rather than silently falling back to the dev DATABASE_URL.
  let resolved;
  try {
    resolved = resolveDatabaseUrl();
  } catch (err) {
    console.error(
      `[backfill-bill-ai-fields] ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(2);
  }

  const sql = neon(resolved.url);
  const db = drizzle(sql);

  console.log(
    `[backfill-bill-ai-fields] starting${DRY_RUN ? ' (dry-run)' : ''}`,
  );

  const rows = await db
    .select({
      id: bills.id,
      buildingId: bills.buildingId,
      organizationId: buildings.organizationId,
      issueDate: bills.issueDate,
      vendorInvoiceNumber: bills.vendorInvoiceNumber,
      costs: bills.costs,
      totalAmount: bills.totalAmount,
      aiAnalysisData: bills.aiAnalysisData,
    })
    .from(bills)
    .innerJoin(buildings, eq(bills.buildingId, buildings.id))
    .where(
      and(
        isNotNull(bills.aiAnalysisData),
        or(
          isNull(bills.issueDate),
          isNull(bills.vendorInvoiceNumber),
          dsql`array_length(${bills.costs}, 1) = 1`,
        ),
      ),
    );

  console.log(
    `[backfill-bill-ai-fields] candidate rows: ${rows.length}`,
  );

  const stats = new Map<string, OrgStats>();
  const bumpStat = (orgId: string): OrgStats => {
    let s = stats.get(orgId);
    if (!s) {
      s = {
        scanned: 0,
        issueDateUpdated: 0,
        vendorInvoiceUpdated: 0,
        costsUpdated: 0,
        rowsUpdated: 0,
      };
      stats.set(orgId, s);
    }
    return s;
  };

  let failedRows = 0;
  for (const row of rows) {
    const orgStat = bumpStat(row.organizationId);
    orgStat.scanned += 1;

    try {
      const analysis =
        row.aiAnalysisData && typeof row.aiAnalysisData === 'object'
          ? (row.aiAnalysisData as Record<string, unknown>)
          : null;
      if (!analysis) continue;

      const updates: Record<string, unknown> = {};

      if (!row.issueDate) {
        const v = pickIssueDate(analysis);
        if (v) {
          updates.issueDate = v;
          orgStat.issueDateUpdated += 1;
        }
      }

      if (!row.vendorInvoiceNumber) {
        const v = pickVendorInvoiceNumber(analysis);
        if (v) {
          updates.vendorInvoiceNumber = v;
          orgStat.vendorInvoiceUpdated += 1;
        }
      }

      const v = pickInstallmentCosts(
        analysis,
        row.costs as string[] | null,
        row.totalAmount,
      );
      if (v) {
        updates.costs = v;
        orgStat.costsUpdated += 1;
      }

      if (Object.keys(updates).length === 0) continue;
      orgStat.rowsUpdated += 1;

      if (DRY_RUN) continue;

      await db.update(bills).set(updates).where(eq(bills.id, row.id));
    } catch (err) {
      failedRows += 1;
      console.warn(
        `[backfill-bill-ai-fields] skipping bill ${row.id} (org ${row.organizationId}) due to error: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  const sortedOrgs = Array.from(stats.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  console.log(
    `[backfill-bill-ai-fields] per-organization summary (${sortedOrgs.length} orgs):`,
  );
  for (const [orgId, s] of sortedOrgs) {
    console.log(
      `  org=${orgId} scanned=${s.scanned} rowsUpdated=${s.rowsUpdated} ` +
        `issueDate+=${s.issueDateUpdated} vendorInvoice+=${s.vendorInvoiceUpdated} ` +
        `costs+=${s.costsUpdated}`,
    );
  }

  const totals = sortedOrgs.reduce(
    (acc, [, s]) => {
      acc.scanned += s.scanned;
      acc.rowsUpdated += s.rowsUpdated;
      acc.issueDateUpdated += s.issueDateUpdated;
      acc.vendorInvoiceUpdated += s.vendorInvoiceUpdated;
      acc.costsUpdated += s.costsUpdated;
      return acc;
    },
    {
      scanned: 0,
      rowsUpdated: 0,
      issueDateUpdated: 0,
      vendorInvoiceUpdated: 0,
      costsUpdated: 0,
    },
  );

  console.log(
    `[backfill-bill-ai-fields] totals scanned=${totals.scanned} rowsUpdated=${totals.rowsUpdated} ` +
      `issueDate+=${totals.issueDateUpdated} vendorInvoice+=${totals.vendorInvoiceUpdated} ` +
      `costs+=${totals.costsUpdated} failed=${failedRows}${DRY_RUN ? ' (dry-run, no writes)' : ''}`,
  );
}

if (IS_MAIN_MODULE) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[backfill-bill-ai-fields] failed:', err);
      process.exit(1);
    });
}
