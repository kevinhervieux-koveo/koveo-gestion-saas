/**
 * @jest-environment node
 *
 * Task #469: End-to-end coverage for the acting-role downgrade / restore
 * flow over the real MCP HTTP transport.
 *
 * Why this exists
 * ---------------
 * `tests/unit/api/mcp-acting-role.test.ts` exercises the in-process
 * `wrapHandlerWithRoleEnforcement` and the `downgrade_acting_role` /
 * `restore_acting_role` tool callbacks, but it never drives a real MCP
 * client through the StreamableHTTP transport. That means it cannot
 * detect a regression where the per-session `actingRole` state stops
 * being preserved across separate HTTP requests on the same MCP session
 * (for example, if `server/mcp/index.ts` ever started recreating the
 * `McpServer` per request instead of holding it in the session map).
 *
 * This test boots a real Express app with `registerMcpRoutes`, listens
 * on an ephemeral port, then drives the StreamableHTTP transport with
 * raw `fetch` + JSON-RPC framing (so the test owns the exact session-id
 * header and the SSE-vs-JSON content-type sniffing) to:
 *   1. Authenticate as a manager (via a directly-seeded OAuth access token).
 *   2. Call `downgrade_acting_role` with `role: "tenant"`.
 *   3. Call `get_mcp_info` WITHOUT `role` and assert the downgraded role
 *      is reflected (`actingRole === "tenant"`, `currentRole === "tenant"`,
 *      `downgradeActive === true`) — this is the cross-request state we
 *      really care about.
 *   4. Call `restore_acting_role` and assert the session reverts to
 *      `manager`.
 *   5. Open a second MCP session with the same OAuth token and assert it
 *      starts back at the OAuth-bound role (no leak across sessions).
 *
 * Then it exercises the legacy `MCP_API_KEY` path over HTTP and
 * confirms both new tools refuse to act because there is no OAuth-bound
 * role to downgrade from / restore to.
 *
 * Gated on `_INTEGRATION_DB_URL` (auto-populated from `DATABASE_URL` by
 * `jest.polyfills.js`); skips cleanly when no Postgres is available,
 * mirroring the existing MCP integration tests under `tests/integration/`.
 */

// Stub the modules `server/mcp/server.ts` imports at the top so we don't
// pull the ESM-only `uuid` package through the document/object/AI services
// — they are not exercised by acting-role tools.
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
// `pkce-challenge` is ESM-only and the SDK's auth router imports it
// transitively via `mcpAuthRouter`. Stub it the same way the existing
// `server/tests/mcp-oauth-endpoints.test.ts` does so the SDK can load
// under jest's CJS transformer.
jest.mock(
  'pkce-challenge',
  () => ({
    __esModule: true,
    default: () => ({ code_verifier: 'v', code_challenge: 'c' }),
    generateChallenge: async (v: string) => v,
  }),
  { virtual: true },
);
// Do not run the dev seed during the test — it inserts MCP-1/MCP-2 orgs
// and synthetic users that the acting-role assertions don't need, and
// it would slow the test down.
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

describeIfDb('MCP acting-role downgrade/restore over HTTP — E2E (Task #469)', () => {
  let db: Db;
  let schema: Schema;
  let httpServer: http.Server;
  let baseUrl: string;
  let bearerToken: string;
  let clientId: string;
  let createdTokenHashes: string[] = [];

  const ORIG_API_KEY = process.env.MCP_API_KEY;
  const ORIG_ISSUER = process.env.MCP_OAUTH_ISSUER;
  const ORIG_NODE_ENV = process.env.NODE_ENV;
  const LEGACY_API_KEY = `task469-legacy-${crypto.randomBytes(4).toString('hex')}`;

  beforeAll(async () => {
    if (!REAL_DB_URL) return;
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.USE_MOCK_DB = 'false';
    // Production NODE_ENV would otherwise force MCP_OAUTH_ISSUER. We're
    // running in test mode, but pin the issuer explicitly so the OAuth
    // discovery document is deterministic regardless of what the host
    // environment leaked in.
    process.env.NODE_ENV = 'development';
    process.env.MCP_OAUTH_ISSUER = 'http://127.0.0.1:0';
    process.env.MCP_API_KEY = LEGACY_API_KEY;

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

    // Seed an OAuth client + access token row directly so we can skip
    // the consent UI flow entirely. `verifyAccessToken` reads the same
    // table, so this is the same surface a real Claude session would
    // present after consent.
    const { hashSecret } = await import('../../../server/mcp/oauth-provider');

    clientId = `task469-client-${crypto.randomBytes(6).toString('hex')}`;
    const nowSec = Math.floor(Date.now() / 1000);
    await db.insert(schema.oauthClients).values({
      clientId,
      clientSecret: null,
      clientIdIssuedAt: nowSec,
      clientSecretExpiresAt: 0,
      clientInfo: {
        client_id: clientId,
        client_name: 'task469-test-client',
        redirect_uris: ['http://localhost/cb'],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      } as Record<string, unknown>,
    });

    bearerToken = `koat_task469_${crypto.randomBytes(12).toString('hex')}`;
    const tokenHash = hashSecret(bearerToken);
    createdTokenHashes.push(tokenHash);
    await db.insert(schema.oauthTokens).values({
      token: tokenHash,
      tokenType: 'access',
      clientId,
      userId: `task469-user-${crypto.randomBytes(4).toString('hex')}`,
      role: 'manager',
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
      if (createdTokenHashes.length) {
        await db
          .delete(schema.oauthTokens)
          .where(inArray(schema.oauthTokens.token, createdTokenHashes));
      }
      if (clientId) {
        await db.delete(schema.oauthClients).where(eq(schema.oauthClients.clientId, clientId));
      }
    }
    if (ORIG_API_KEY === undefined) delete process.env.MCP_API_KEY;
    else process.env.MCP_API_KEY = ORIG_API_KEY;
    if (ORIG_ISSUER === undefined) delete process.env.MCP_OAUTH_ISSUER;
    else process.env.MCP_OAUTH_ISSUER = ORIG_ISSUER;
    if (ORIG_NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = ORIG_NODE_ENV;
  }, 60_000);

  /**
   * Send a single JSON-RPC request to the MCP HTTP transport and return
   * the parsed response. Handles both the SSE-framed reply (the SDK's
   * default) and a plain JSON-body reply by sniffing the response
   * Content-Type. Going through `fetch` directly (instead of the SDK's
   * Client) keeps this test transport-agnostic and lets us assert on
   * the exact session-id header the server returns.
   */
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
      // 202 Accepted etc. — no body to parse.
    } else if (res.headers.get('content-type')?.includes('text/event-stream')) {
      // Parse the first `data:` line containing a JSON-RPC payload.
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
              // not the message line — keep looking
            }
          }
        }
      }
    } else {
      try {
        message = JSON.parse(raw) as JsonRpcResponse;
      } catch {
        // leave message null
      }
    }
    return { status: res.status, sessionId, message, raw };
  }

  /** Initialize a new MCP session and return its session id. */
  async function openSession(authHeader: string): Promise<string> {
    const init = await rpc(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'task469-test', version: '1.0.0' },
        },
      },
      { authorization: authHeader },
    );
    expect(init.status).toBe(200);
    expect(init.message?.result).toBeDefined();
    expect(init.sessionId).toBeTruthy();
    return init.sessionId as string;
  }

  /**
   * Call a tool on an existing session and return the parsed JSON body
   * of the (assumed JSON-stringified) text content of the tool response.
   * Tools in this codebase always emit a single text item with a JSON
   * payload, so this lets the test assert against typed fields directly.
   */
  async function callTool(
    sessionId: string,
    authHeader: string,
    name: string,
    args: Record<string, unknown> = {},
    rpcId: number = 2,
  ): Promise<Record<string, unknown>> {
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
      return JSON.parse(text) as Record<string, unknown>;
    } catch (e) {
      throw new Error(
        `tool ${name} returned non-JSON text: ${text.slice(0, 600)} (raw=${out.raw.slice(0, 800)})`,
      );
    }
  }

  it('downgrades the acting role and reflects it across requests on the same OAuth session', async () => {
    const auth = `Bearer ${bearerToken}`;
    const sessionId = await openSession(auth);

    // Sanity: before downgrading, get_mcp_info should report the OAuth-
    // bound role as the acting role.
    const before = await callTool(sessionId, auth, 'get_mcp_info', {}, 2);
    expect(before.oauthBoundRole).toBe('manager');
    expect(before.actingRole).toBe('manager');
    expect(before.currentRole).toBe('manager');
    expect(before.downgradeActive).toBe(false);

    // Downgrade.
    const downgrade = await callTool(
      sessionId,
      auth,
      'downgrade_acting_role',
      { role: 'tenant' },
      3,
    );
    expect(downgrade.ok).toBe(true);
    expect(downgrade.oauthBoundRole).toBe('manager');
    expect(downgrade.previousActingRole).toBe('manager');
    expect(downgrade.actingRole).toBe('tenant');
    expect(downgrade.noChange).toBe(false);

    // The crucial cross-request assertion: a fresh tool call WITHOUT a
    // `role` argument on the SAME session must see the downgraded role.
    const after = await callTool(sessionId, auth, 'get_mcp_info', {}, 4);
    expect(after.oauthBoundRole).toBe('manager');
    expect(after.actingRole).toBe('tenant');
    expect(after.currentRole).toBe('tenant');
    expect(after.downgradeActive).toBe(true);

    // Restore.
    const restore = await callTool(sessionId, auth, 'restore_acting_role', {}, 5);
    expect(restore.ok).toBe(true);
    expect(restore.previousActingRole).toBe('tenant');
    expect(restore.actingRole).toBe('manager');

    const final = await callTool(sessionId, auth, 'get_mcp_info', {}, 6);
    expect(final.actingRole).toBe('manager');
    expect(final.currentRole).toBe('manager');
    expect(final.downgradeActive).toBe(false);
  }, 30_000);

  it('a fresh OAuth session starts back at the OAuth-bound role (no cross-session leak)', async () => {
    const auth = `Bearer ${bearerToken}`;
    // Open a brand-new session AFTER the previous test downgraded then
    // restored. Even if the restore had been skipped, the session-level
    // `actingRole` lives on the per-session McpServer instance, so a new
    // session must always start at the OAuth-bound ceiling.
    const sessionId = await openSession(auth);
    const info = await callTool(sessionId, auth, 'get_mcp_info', {}, 2);
    expect(info.oauthBoundRole).toBe('manager');
    expect(info.actingRole).toBe('manager');
    expect(info.currentRole).toBe('manager');
    expect(info.downgradeActive).toBe(false);
  }, 30_000);

  it('rejects an out-of-ceiling downgrade (manager cannot act as admin)', async () => {
    const auth = `Bearer ${bearerToken}`;
    const sessionId = await openSession(auth);
    // The wrapper short-circuits before the handler runs and returns a
    // text response that starts with "Authorization mismatch:". It is
    // NOT JSON, so don't try to parse it.
    const out = await rpc(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'downgrade_acting_role', arguments: { role: 'admin' } },
      },
      { authorization: auth, 'mcp-session-id': sessionId },
    );
    expect(out.status).toBe(200);
    const text = out.message?.result?.content?.[0]?.text ?? '';
    expect(text).toMatch(/Authorization mismatch/);
    // And the session's acting role must NOT have moved.
    const info = await callTool(sessionId, auth, 'get_mcp_info', {}, 3);
    expect(info.actingRole).toBe('manager');
    expect(info.downgradeActive).toBe(false);
  }, 30_000);

  it('legacy MCP_API_KEY sessions reject both downgrade_acting_role and restore_acting_role', async () => {
    const auth = `Bearer ${LEGACY_API_KEY}`;
    const sessionId = await openSession(auth);

    // On the legacy path there is no OAuth-bound role, so the wrapper
    // never runs and the handlers themselves emit a "no OAuth-bound role"
    // message. The text is not JSON.
    const downgrade = await rpc(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'downgrade_acting_role', arguments: { role: 'tenant' } },
      },
      { authorization: auth, 'mcp-session-id': sessionId },
    );
    expect(downgrade.status).toBe(200);
    const downText = downgrade.message?.result?.content?.[0]?.text ?? '';
    expect(downText).toMatch(/No OAuth-bound role to downgrade from/);

    const restore = await rpc(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'restore_acting_role', arguments: {} },
      },
      { authorization: auth, 'mcp-session-id': sessionId },
    );
    expect(restore.status).toBe(200);
    const restText = restore.message?.result?.content?.[0]?.text ?? '';
    expect(restText).toMatch(/No OAuth-bound role to restore/);

    // get_mcp_info on the legacy path reports actingRole=null and
    // downgradeActive=false, matching the unit-level expectations.
    const info = await callTool(sessionId, auth, 'get_mcp_info', {}, 4);
    expect(info.oauthBoundRole).toBeNull();
    expect(info.actingRole).toBeNull();
    expect(info.downgradeActive).toBe(false);
  }, 30_000);
});
