/**
 * @jest-environment node
 *
 * Task #1276: Cover the building-existence guard added to BOTH the MCP
 * `resend_invitation` tool and the REST `POST /api/invitations/:id/resend`
 * endpoint.
 *
 * Symmetric to the residence-existence guard added in task #630
 * (`mcp-resend-invitation-residence-guard.test.ts`). Before #1276,
 * resending an invitation whose linked building had been hard-deleted
 * would silently flip the row back to `pending` and email a token that
 * pointed at a building that no longer exists. Both surfaces now refuse
 * such resends with a structured error and HTTP 422 (REST).
 *
 * This file gates on `_INTEGRATION_DB_URL` (auto-populated from
 * `DATABASE_URL` by `jest.polyfills.js`) and skips cleanly when no
 * Postgres is available, mirroring the pattern in the other invitation
 * integration tests.
 *
 * Test approach:
 *   - Seed an MCP-scoped organization and an inviter user.
 *   - Insert an invitation row that points at a `buildingId` that was
 *     never inserted — the cleanest way to simulate a dangling pointer
 *     given that `invitations.building_id` carries no DB-level FK.
 *   - Hit the MCP `resend_invitation` tool and assert:
 *       * the response references "Building not found" + the dangling id,
 *       * the row is left exactly as seeded (status, expiresAt, ids
 *         unchanged), so the guard short-circuits BEFORE the update path.
 *   - Hit the REST endpoint with the same dangling row and assert:
 *       * HTTP 422 with code `INVITATION_BUILDING_MISSING`,
 *       * the row is again left untouched.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import { eq, inArray } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schemaImport from '@shared/schema';

type Schema = typeof schemaImport;
type Db = NeonDatabase<Schema>;

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const TEST_TAG = 'task1276-resend-building-guard';
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

describeIfDb('resend_invitation building-existence guard — real Postgres (Task #1276)', () => {
  let db: Db;
  let schema: Schema;
  let createMcpServer: typeof import('../../server/mcp/server').createMcpServer;
  let registerUserRoutes: typeof import('../../server/api/users').registerUserRoutes;

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
    ({ registerUserRoutes } = require('../../server/api/users'));

    // Resolve (or seed) an MCP-scoped organization. The MCP tool's
    // org-scope guard only allows orgs named "MCP-1" or "MCP-2", so
    // reuse the existing one if present.
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

  async function seedInviterAndDanglingInvitation() {
    const inviterId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: inviterId,
      username: `${TEST_TAG}-${inviterId.slice(0, 8)}`,
      email: `${TEST_TAG}-${inviterId.slice(0, 8)}@example.test`,
      password: 'x'.repeat(60),
      firstName: 'Building',
      lastName: 'Guard',
      role: 'admin',
      language: 'en',
    });
    created.userIds.add(inviterId);

    const invitationId = crypto.randomUUID();
    const danglingBuildingId = crypto.randomUUID();
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(schema.invitations).values({
      id: invitationId,
      organizationId: created.organizationId!,
      buildingId: danglingBuildingId, // No row was ever inserted for this id.
      residenceId: null,
      email: `${TEST_TAG}-${invitationId.slice(0, 8)}@example.test`,
      token: `tok-${invitationId}`,
      tokenHash: `hash-${invitationId}`,
      role: 'tenant',
      status: 'pending',
      invitedByUserId: inviterId,
      expiresAt: future,
    });
    created.invitationIds.add(invitationId);
    return { invitationId, danglingBuildingId, inviterId, future };
  }

  it('MCP tool: returns "Building not found" and does not mutate the invitation when buildingId is dangling', async () => {
    const { invitationId, danglingBuildingId, future } =
      await seedInviterAndDanglingInvitation();

    // Invoke the real MCP `resend_invitation` handler.
    const server = createMcpServer();
    const handler = getToolHandler(server, 'resend_invitation');
    const result = await handler({ role: 'admin', invitationId }, {});
    const text = parseToolText(result);

    // Guard surfaces a clear "Building not found" message referencing
    // the dangling id.
    expect(text).toMatch(/Building not found/i);
    expect(text).toContain(danglingBuildingId);

    // The invitation row is left exactly as seeded: status, buildingId,
    // expiresAt all untouched. The guard short-circuits BEFORE the
    // update path runs.
    const after = await db
      .select({
        id: schema.invitations.id,
        status: schema.invitations.status,
        buildingId: schema.invitations.buildingId,
        expiresAt: schema.invitations.expiresAt,
      })
      .from(schema.invitations)
      .where(eq(schema.invitations.id, invitationId));
    expect(after).toHaveLength(1);
    expect(after[0].status).toBe('pending');
    expect(after[0].buildingId).toBe(danglingBuildingId);
    expect(after[0].expiresAt?.getTime()).toBe(future.getTime());
  }, 60000);

  it('REST endpoint: returns HTTP 422 INVITATION_BUILDING_MISSING and does not mutate the invitation', async () => {
    const { invitationId, danglingBuildingId, inviterId, future } =
      await seedInviterAndDanglingInvitation();

    // Build a minimal Express app mounting only the user routes, with a
    // shim that injects the inviter as the authenticated admin (mirrors
    // the requireAuth middleware contract).
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as { user?: unknown; session?: unknown }).user = {
        id: inviterId,
        role: 'admin',
        email: `${TEST_TAG}-${inviterId.slice(0, 8)}@example.test`,
        firstName: 'Building',
        lastName: 'Guard',
      };
      (req as { session?: { userId?: string } }).session = { userId: inviterId };
      next();
    });
    registerUserRoutes(app);

    const res = await request(app).post(`/api/invitations/${invitationId}/resend`);

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      code: 'INVITATION_BUILDING_MISSING',
    });
    expect(typeof res.body.message).toBe('string');
    expect(res.body.message).toMatch(/Building not found/i);
    expect(res.body.message).toContain(danglingBuildingId);

    // The invitation row is left exactly as seeded.
    const after = await db
      .select({
        id: schema.invitations.id,
        status: schema.invitations.status,
        buildingId: schema.invitations.buildingId,
        expiresAt: schema.invitations.expiresAt,
      })
      .from(schema.invitations)
      .where(eq(schema.invitations.id, invitationId));
    expect(after).toHaveLength(1);
    expect(after[0].status).toBe('pending');
    expect(after[0].buildingId).toBe(danglingBuildingId);
    expect(after[0].expiresAt?.getTime()).toBe(future.getTime());
  }, 60000);
});
