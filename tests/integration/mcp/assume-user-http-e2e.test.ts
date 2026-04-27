/**
 * @jest-environment node
 *
 * Task #642 — End-to-end coverage for the admin-only `assume_user` /
 * `restore_acting_user` MCP tools over the real StreamableHTTP transport.
 *
 * Why this exists
 * ---------------
 * `tests/unit/api/mcp-assume-user.test.ts` exercises the in-process tool
 * callbacks against a mocked `db`, which is enough to lock the role gating
 * and audit-row shape. It cannot, however, prove that:
 *   1. The per-session `assumedUserId` state survives across separate HTTP
 *      requests on the same MCP session (a regression here would make
 *      impersonation appear to work but only for the single tools/call that
 *      invoked `assume_user`).
 *   2. The mapping is plumbed end-to-end through the OAuth bearer-token
 *      auth path, so a follow-up `get_mcp_info` on a NEW request reflects
 *      the impersonation state set by the previous request (and clearing
 *      it via `restore_acting_user` is also visible cross-request).
 *   3. A real row lands in the `mcp_assume_user_log` table.
 *
 * The test boots a real Express app with `registerMcpRoutes` against the
 * integration Postgres, seeds:
 *   - an OAuth client + admin access token (so we skip the consent UI),
 *   - one MCP organization,
 *   - one building inside that org,
 *   - one residence inside that building,
 *   - one tenant user linked to that residence (the impersonation target),
 * and then drives the StreamableHTTP transport with raw fetch + JSON-RPC
 * framing (mirroring `acting-role-http-e2e.test.ts`).
 *
 * Gated on `_INTEGRATION_DB_URL` (auto-populated from `DATABASE_URL` by
 * `jest.polyfills.js`); skips cleanly when no Postgres is available.
 */

jest.mock('../../../server/services/document-service', () => ({
  DocumentService: class {},
}));
jest.mock('../../../server/objectStorage', () => ({
  ObjectStorageService: class {},
}));
jest.mock('../../../server/services/consolidated-ai-service', () => ({
  aiService: {
    analyzeDocument: jest.fn(),
    getAnalysisStatus: jest.fn(),
  },
}));
jest.mock(
  'pkce-challenge',
  () => ({
    __esModule: true,
    default: () => ({ code_verifier: 'v', code_challenge: 'c' }),
    generateChallenge: async (v: string) => v,
  }),
  { virtual: true },
);
jest.mock('../../../server/mcp/seed-mcp-data', () => ({
  seedMcpData: jest.fn(async () => {}),
}));

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'crypto';
import http from 'http';
import { eq, inArray } from 'drizzle-orm';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as schemaImport from '@shared/schema';

type Schema = typeof schemaImport;
type Db = NeonDatabase<Schema>;

const REAL_DB_URL = process.env._INTEGRATION_DB_URL;
const describeIfDb = REAL_DB_URL ? describe : describe.skip;

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: { content?: Array<{ type: string; text?: string }> };
  error?: { code: number; message: string };
}

describeIfDb('MCP assume_user / restore_acting_user over HTTP — E2E (Task #642)', () => {
  let db: Db;
  let schema: Schema;
  let httpServer: http.Server;
  let baseUrl: string;
  let bearerToken: string;
  let clientId: string;
  let adminUserId: string;
  let tenantUserId: string;
  let orgId: string;
  let buildingId: string;
  let residenceId: string;
  let orgWasPreExisting = false;
  let adminOrgLinkId: string | null = null;
  const createdTokenHashes: string[] = [];

  const ORIG_ASSUME_FLAG = process.env.MCP_ASSUME_USER;
  const ORIG_ISSUER = process.env.MCP_OAUTH_ISSUER;
  const ORIG_NODE_ENV = process.env.NODE_ENV;
  const TEST_TAG = `task642-${crypto.randomBytes(4).toString('hex')}`;

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.NODE_ENV = 'development';
    process.env.MCP_OAUTH_ISSUER = 'http://127.0.0.1:0';
    // Flip the impersonation feature flag on for the lifetime of this suite.
    process.env.MCP_ASSUME_USER = '1';

    db = require('../../../server/db').db as Db;
    schema = require('@shared/schema') as Schema;

    const express = (await import('express')).default;
    const { registerMcpRoutes } = await import('../../../server/mcp/index');

    const app = express();
    app.use(express.json());
    await registerMcpRoutes(app);

    httpServer = http.createServer(app);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = httpServer.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}/mcp`;

    // 1. Admin user — the OAuth-bound caller.
    adminUserId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: adminUserId,
      username: `${TEST_TAG}-admin`,
      email: `${TEST_TAG}-admin@example.test`,
      password: 'x'.repeat(60),
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      language: 'en',
    });

    // 2. MCP organization, building, residence, and a tenant user linked
    //    to that residence — this tenant is the impersonation target. The
    //    org name MUST match the hardcoded MCP_ORG_NAMES allowlist in
    //    server/mcp/server.ts ("MCP-1") so `getMcpOrgIds()` resolves it
    //    and downstream tools (e.g. `list_residences`) can see this
    //    building. We reuse a pre-existing "MCP-1" org if one is already
    //    seeded, otherwise we create one and remember to clean it up.
    const existing = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.name, 'MCP-1'));
    if (existing.length > 0) {
      orgId = existing[0].id;
      orgWasPreExisting = true;
    } else {
      orgId = crypto.randomUUID();
      await db.insert(schema.organizations).values({
        id: orgId,
        name: 'MCP-1',
        type: 'condo',
        address: '1 Test St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A 1A1',
        isActive: true,
      });
    }

    // Link the admin user to the MCP-1 org so getAdminOrgIds() returns
    // this org when the admin role path is used (Task #1471).
    adminOrgLinkId = crypto.randomUUID();
    await db.insert(schema.userOrganizations).values({
      id: adminOrgLinkId,
      userId: adminUserId,
      organizationId: orgId,
      organizationRole: 'admin',
      isActive: true,
    });

    buildingId = crypto.randomUUID();
    await db.insert(schema.buildings).values({
      id: buildingId,
      organizationId: orgId,
      name: `${TEST_TAG}-bldg`,
      address: '1 Test St',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1',
      buildingType: 'condo',
      totalUnits: 1,
      isActive: true,
    });

    residenceId = crypto.randomUUID();
    await db.insert(schema.residences).values({
      id: residenceId,
      buildingId,
      unitNumber: `${TEST_TAG}-101`,
      floor: 1,
      isActive: true,
    });

    tenantUserId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: tenantUserId,
      username: `${TEST_TAG}-tenant`,
      email: `${TEST_TAG}-tenant@example.test`,
      password: 'x'.repeat(60),
      firstName: 'Tenant',
      lastName: 'User',
      role: 'tenant',
      language: 'en',
    });
    await db.insert(schema.userResidences).values({
      id: crypto.randomUUID(),
      userId: tenantUserId,
      residenceId,
      relationshipType: 'tenant',
      startDate: '2024-01-01',
      isActive: true,
    });

    // 3. OAuth client + admin access token. Skip the consent UI by
    //    inserting directly into the OAuth tables — `verifyAccessToken`
    //    reads the same surface a real Claude session would present.
    const { hashSecret } = await import('../../../server/mcp/oauth-provider');

    clientId = `task642-client-${crypto.randomBytes(6).toString('hex')}`;
    const nowSec = Math.floor(Date.now() / 1000);
    await db.insert(schema.oauthClients).values({
      clientId,
      clientSecret: null,
      clientIdIssuedAt: nowSec,
      clientSecretExpiresAt: 0,
      clientInfo: {
        client_id: clientId,
        client_name: 'task642-test-client',
        redirect_uris: ['http://localhost/cb'],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      } as Record<string, unknown>,
    });

    bearerToken = `koat_task642_${crypto.randomBytes(12).toString('hex')}`;
    const tokenHash = hashSecret(bearerToken);
    createdTokenHashes.push(tokenHash);
    await db.insert(schema.oauthTokens).values({
      token: tokenHash,
      tokenType: 'access',
      clientId,
      userId: adminUserId,
      role: 'admin',
      scopes: ['mcp'],
      resource: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      refreshTokenFor: null,
    });
  }, 60_000);

  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
    if (db && schema) {
      // Audit rows we wrote.
      try {
        await db
          .delete(schema.mcpAssumeUserLog)
          .where(inArray(schema.mcpAssumeUserLog.performedBy, [adminUserId]));
      } catch {
        /* table may be empty / migration not applied */
      }
      if (createdTokenHashes.length) {
        await db
          .delete(schema.oauthTokens)
          .where(inArray(schema.oauthTokens.token, createdTokenHashes));
      }
      if (clientId) {
        await db.delete(schema.oauthClients).where(eq(schema.oauthClients.clientId, clientId));
      }
      // Clean up the seeded data in dependency order.
      await db
        .delete(schema.userResidences)
        .where(inArray(schema.userResidences.userId, [tenantUserId]));
      await db.delete(schema.residences).where(eq(schema.residences.id, residenceId));
      await db.delete(schema.buildings).where(eq(schema.buildings.id, buildingId));
      if (adminOrgLinkId) {
        await db.delete(schema.userOrganizations).where(eq(schema.userOrganizations.id, adminOrgLinkId));
      }
      // Only drop the MCP-1 org if WE created it; otherwise leave the
      // pre-existing seed/test org alone.
      if (!orgWasPreExisting) {
        await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
      }
      await db.delete(schema.users).where(inArray(schema.users.id, [adminUserId, tenantUserId]));
    }
    if (ORIG_ASSUME_FLAG === undefined) delete process.env.MCP_ASSUME_USER;
    else process.env.MCP_ASSUME_USER = ORIG_ASSUME_FLAG;
    if (ORIG_ISSUER === undefined) delete process.env.MCP_OAUTH_ISSUER;
    else process.env.MCP_OAUTH_ISSUER = ORIG_ISSUER;
    if (ORIG_NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = ORIG_NODE_ENV;
  }, 60_000);

  /** Send a JSON-RPC request and parse the SSE-or-JSON response. */
  async function rpc(
    body: Record<string, unknown>,
    headers: Record<string, string> = {},
  ): Promise<{ status: number; sessionId: string | null; message: JsonRpcResponse | null; raw: string }> {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...headers,
      },
      body: JSON.stringify(body),
    });
    const sessionId = res.headers.get('mcp-session-id');
    const raw = await res.text();
    let message: JsonRpcResponse | null = null;
    if (raw.length === 0) {
      // no body
    } else if (res.headers.get('content-type')?.includes('text/event-stream')) {
      for (const line of raw.split(/\r?\n/)) {
        if (line.startsWith('data:')) {
          const payload = line.slice('data:'.length).trim();
          if (payload) {
            try {
              const parsed = JSON.parse(payload);
              if (parsed && typeof parsed === 'object' && 'jsonrpc' in parsed) {
                message = parsed as JsonRpcResponse;
                break;
              }
            } catch {
              /* keep looking */
            }
          }
        }
      }
    } else {
      try {
        message = JSON.parse(raw) as JsonRpcResponse;
      } catch {
        /* leave null */
      }
    }
    return { status: res.status, sessionId, message, raw };
  }

  async function openSession(authHeader: string): Promise<string> {
    const init = await rpc(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'task642-test', version: '1.0.0' },
        },
      },
      { authorization: authHeader },
    );
    expect(init.status).toBe(200);
    expect(init.message?.result).toBeDefined();
    expect(init.sessionId).toBeTruthy();
    return init.sessionId as string;
  }

  async function callTool(
    sessionId: string,
    authHeader: string,
    name: string,
    args: Record<string, unknown> = {},
    rpcId: number = 2,
  ): Promise<unknown> {
    const out = await rpc(
      {
        jsonrpc: '2.0',
        id: rpcId,
        method: 'tools/call',
        params: { name, arguments: args },
      },
      { authorization: authHeader, 'mcp-session-id': sessionId },
    );
    expect(out.status).toBe(200);
    expect(out.message).toBeTruthy();
    if (out.message?.error) {
      throw new Error(
        `tools/call ${name} returned JSON-RPC error: ${JSON.stringify(out.message.error)} ` +
          `(raw=${out.raw.slice(0, 400)})`,
      );
    }
    const text = out.message?.result?.content?.[0]?.text ?? '';
    expect(typeof text).toBe('string');
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`tool ${name} returned non-JSON text: ${text.slice(0, 600)}`);
    }
  }

  function asObj(v: unknown): Record<string, unknown> {
    expect(v && typeof v === 'object' && !Array.isArray(v)).toBe(true);
    return v as Record<string, unknown>;
  }

  it('admin can assume a tenant, see the tenant\'s residences, and restore back', async () => {
    const auth = `Bearer ${bearerToken}`;
    const sessionId = await openSession(auth);

    // Sanity: before impersonation, we are the admin.
    const before = asObj(await callTool(sessionId, auth, 'get_mcp_info', {}, 2));
    expect(before.oauthBoundRole).toBe('admin');
    expect(before.actingRole).toBe('admin');
    expect(before.assumedUserId).toBeNull();
    expect(before.impersonationActive).toBe(false);

    // Impersonate the seeded tenant.
    const assume = asObj(
      await callTool(sessionId, auth, 'assume_user', { userId: tenantUserId }, 3),
    );
    expect(assume.ok).toBe(true);
    expect(assume.assumedUserId).toBe(tenantUserId);
    expect(assume.assumedUserRole).toBe('tenant');
    expect(assume.actingRole).toBe('tenant');

    // Cross-request assertion #1: get_mcp_info on a NEW request reflects
    // the impersonation state set by the previous request.
    const after = asObj(await callTool(sessionId, auth, 'get_mcp_info', {}, 4));
    expect(after.oauthBoundRole).toBe('admin');
    expect(after.actingRole).toBe('tenant');
    expect(after.currentRole).toBe('tenant');
    expect(after.assumedUserId).toBe(tenantUserId);
    expect(after.impersonationActive).toBe(true);

    // Cross-request assertion #2: a downstream business tool (`list_residences`)
    // returns the assumed tenant's residence — proving the assumed user is
    // plumbed all the way through to the scope-resolution layer used by
    // every read tool, not just into the get_mcp_info display fields. The
    // tenant branch of `list_residences` joins through `userResidences`
    // for the EFFECTIVE user, which is now `tenantUserId` thanks to the
    // session-level override set by `assume_user`.
    const list = await callTool(
      sessionId,
      auth,
      'list_residences',
      { buildingId },
      5,
    );
    expect(Array.isArray(list)).toBe(true);
    const residences = list as Array<{ id: string }>;
    expect(residences.some((r) => r.id === residenceId)).toBe(true);

    // Restore.
    const restore = asObj(await callTool(sessionId, auth, 'restore_acting_user', {}, 6));
    expect(restore.ok).toBe(true);
    expect(restore.assumedUserId).toBeNull();
    expect(restore.actingRole).toBe('admin');
    expect(restore.previousAssumedUserId).toBe(tenantUserId);

    // After restore, get_mcp_info reflects the cleared override.
    const final = asObj(await callTool(sessionId, auth, 'get_mcp_info', {}, 7));
    expect(final.assumedUserId).toBeNull();
    expect(final.impersonationActive).toBe(false);
    expect(final.actingRole).toBe('admin');

    // Audit log: at least one assume row + one restore row for this admin.
    const auditRows = await db
      .select()
      .from(schema.mcpAssumeUserLog)
      .where(eq(schema.mcpAssumeUserLog.performedBy, adminUserId));
    expect(auditRows.length).toBeGreaterThanOrEqual(2);
    expect(auditRows.some((r) => r.action === 'assume' && r.assumedUserId === tenantUserId)).toBe(
      true,
    );
    expect(auditRows.some((r) => r.action === 'restore' && r.assumedUserId === tenantUserId)).toBe(
      true,
    );
  }, 45_000);

  it('a fresh OAuth session starts with no impersonation override (no cross-session leak)', async () => {
    const auth = `Bearer ${bearerToken}`;
    const sessionId = await openSession(auth);
    const info = asObj(await callTool(sessionId, auth, 'get_mcp_info', {}, 2));
    expect(info.assumedUserId).toBeNull();
    expect(info.impersonationActive).toBe(false);
    expect(info.actingRole).toBe('admin');
  }, 30_000);
});
