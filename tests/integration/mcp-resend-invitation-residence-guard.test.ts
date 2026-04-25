/**
 * @jest-environment node
 *
 * Task #630: Cover the residence-existence guard added to the MCP
 * `resend_invitation` tool.
 *
 * Before #630, `resend_invitation` would happily flip an invitation
 * with a dangling `residenceId` (one whose target residence row has
 * been deleted) back to `pending` and email the recipient a token
 * that, on acceptance, would crash the acceptance flow because the
 * residence link could not be hydrated. The cascade in
 * `delete_residence` / `delete_building` now sweeps both pending AND
 * expired invitations (also part of #630), and a defensive guard in
 * `resend_invitation` rejects any invitation whose `residenceId` no
 * longer resolves to a real residence — even if the cascade was
 * bypassed (e.g. raw SQL delete, or pre-existing dangling rows from
 * before the cascade existed).
 *
 * This test seeds an invitation pointing at a residenceId that was
 * never inserted (the cleanest way to simulate a dangling pointer
 * given that `invitations.residence_id` has no DB-level FK constraint)
 * and asserts the tool returns the documented "Residence not found"
 * error response WITHOUT mutating the invitation row or sending
 * an email.
 *
 * Gated on `_INTEGRATION_DB_URL` and skips cleanly when no Postgres
 * is available, mirroring the pattern in the other MCP integration
 * tests.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schemaImport from '@shared/schema';

type Schema = typeof schemaImport;
type Db = NeonDatabase<Schema>;

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task630-resend-residence-guard';
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

interface ToolResult {
  content?: Array<{ text?: string }>;
}

function getToolHandler(
  server: unknown,
  toolName: string,
): (args: unknown, extra?: unknown) => Promise<ToolResult> {
  const tools = (server as {
    _registeredTools?: Record<string, { handler?: unknown; callback?: unknown }>;
  })._registeredTools;
  if (!tools || !tools[toolName]) throw new Error(`Tool "${toolName}" not registered`);
  const fn = (tools[toolName].handler ?? tools[toolName].callback) as
    | ((args: unknown, extra?: unknown) => Promise<ToolResult>)
    | undefined;
  if (typeof fn !== 'function') throw new Error(`Tool "${toolName}" handler missing`);
  return fn;
}

function parseToolText(result: ToolResult): string {
  return result?.content?.[0]?.text ?? '';
}

describeIfDb('MCP resend_invitation residence-existence guard — real Postgres (Task #630)', () => {
  let db: Db;
  let schema: Schema;
  let createMcpServer: typeof import('../../server/mcp/server').createMcpServer;

  const created = {
    organizationId: null as string | null,
    organizationCreatedByUs: false,
    userIds: new Set<string>(),
    invitationIds: new Set<string>(),
  };

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    db = require('../../server/db').db as Db;
    schema = require('@shared/schema') as Schema;
    ({ createMcpServer } = require('../../server/mcp/server'));
  }, 60000);

  afterAll(async () => {
    if (!REAL_DB_URL || !db) return;
    if (created.invitationIds.size) {
      await db
        .delete(schema.invitations)
        .where(inArray(schema.invitations.id, [...created.invitationIds]));
    }
    if (created.userIds.size) {
      await db.delete(schema.users).where(inArray(schema.users.id, [...created.userIds]));
    }
    if (created.organizationId && created.organizationCreatedByUs) {
      await db
        .delete(schema.organizations)
        .where(eq(schema.organizations.id, created.organizationId));
    }
  }, 60000);

  it('returns "Residence not found" and does not mutate the invitation when residenceId is dangling', async () => {
    // 1. Resolve (or seed) an MCP-scoped organization. The MCP tool's
    //    org-scope guard only allows orgs named "MCP-1" or "MCP-2",
    //    so reuse the existing one if present.
    const existingMcp = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.name, 'MCP-1'))
      .limit(1);
    if (existingMcp.length > 0) {
      created.organizationId = existingMcp[0].id;
    } else {
      const orgId = crypto.randomUUID();
      await db.insert(schema.organizations).values({
        id: orgId,
        name: 'MCP-1',
        type: 'syndicate',
        address: `${TEST_TAG} 1`,
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A1A1',
      });
      created.organizationId = orgId;
      created.organizationCreatedByUs = true;
    }

    // 2. Inviter user (manager). The tool records who sent the
    //    invitation so the manager-scope check can match.
    const inviterId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: inviterId,
      username: `${TEST_TAG}-${inviterId.slice(0, 8)}`,
      email: `${TEST_TAG}-${inviterId.slice(0, 8)}@example.test`,
      password: 'x'.repeat(60),
      firstName: 'Resend',
      lastName: 'Guard',
      role: 'admin',
      language: 'en',
    });
    created.userIds.add(inviterId);

    // 3. Invitation pointing at a residenceId that was never inserted
    //    — the simplest way to exercise the guard given that
    //    `invitations.residence_id` carries no DB-level FK.
    const invitationId = crypto.randomUUID();
    const danglingResidenceId = crypto.randomUUID();
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(schema.invitations).values({
      id: invitationId,
      organizationId: created.organizationId,
      residenceId: danglingResidenceId,
      email: `${TEST_TAG}-invitee@example.test`,
      token: `tok-${invitationId}`,
      tokenHash: `hash-${invitationId}`,
      role: 'tenant',
      status: 'pending',
      invitedByUserId: inviterId,
      expiresAt: future,
    });
    created.invitationIds.add(invitationId);

    // ---- Invoke the real MCP `resend_invitation` handler ----
    const server = createMcpServer();
    const handler = getToolHandler(server, 'resend_invitation');
    const result = await handler({ role: 'admin', invitationId }, {});
    const text = parseToolText(result);

    // The guard must surface a clear "Residence not found" message
    // referencing the dangling id.
    expect(text).toMatch(/Residence not found/i);
    expect(text).toContain(danglingResidenceId);

    // The invitation row must be left exactly as we seeded it: still
    // pending, still pointing at the same (dangling) residenceId, and
    // its expiry untouched. The guard short-circuits BEFORE the
    // status/expiresAt update path runs.
    const after = await db
      .select({
        id: schema.invitations.id,
        status: schema.invitations.status,
        residenceId: schema.invitations.residenceId,
        expiresAt: schema.invitations.expiresAt,
      })
      .from(schema.invitations)
      .where(eq(schema.invitations.id, invitationId));
    expect(after).toHaveLength(1);
    expect(after[0].status).toBe('pending');
    expect(after[0].residenceId).toBe(danglingResidenceId);
    expect(after[0].expiresAt?.getTime()).toBe(future.getTime());
  }, 60000);
});
