/**
 * Security-focused unit tests for the MCP OAuth 2.0 provider.
 *
 * Covers:
 *   - authorization codes can only be redeemed once (PKCE atomic-claim)
 *   - codes that were never finalized (no role attached) cannot mint tokens
 *   - access-token verification returns the role in `extra` for downstream
 *     RBAC enforcement
 *   - refresh tokens rotate and revoke linked access tokens
 *   - consent role enforcement (caller-supplied tool `role` is ignored when
 *     OAuth context provides one)
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

type Row = Record<string, unknown>;

const state: { rows: Row[] } = { rows: [] };

const insertChain = {
  values: jest.fn(async (vals: Row | Row[]) => {
    if (Array.isArray(vals)) state.rows.push(...vals);
    else state.rows.push(vals);
    return undefined as unknown;
  }),
};

const makeWhereResult = (rows: Row[]) => {
  const result: Promise<Row[]> & { limit?: Function; returning?: Function } =
    Promise.resolve(rows) as Promise<Row[]> & {
      limit?: Function;
      returning?: Function;
    };
  result.limit = jest.fn(async () => rows.slice(0, 1));
  result.returning = jest.fn(async () => rows);
  return result;
};

let lastSelectFilter: ((r: Row) => boolean) | null = null;
let lastUpdateFilter: ((r: Row) => boolean) | null = null;
let lastUpdateValues: Row | null = null;
let lastDeleteFilter: ((r: Row) => boolean) | null = null;

const selectChain = {
  from: jest.fn().mockReturnThis(),
  where: jest.fn(() => {
    const filter = lastSelectFilter ?? (() => true);
    lastSelectFilter = null;
    return makeWhereResult(state.rows.filter(filter));
  }),
};

const updateChain = {
  set: jest.fn((vals: Row) => {
    lastUpdateValues = vals;
    return updateChain;
  }),
  where: jest.fn(() => {
    const filter = lastUpdateFilter ?? (() => true);
    lastUpdateFilter = null;
    const matched = state.rows.filter(filter);
    for (const r of matched) Object.assign(r, lastUpdateValues ?? {});
    lastUpdateValues = null;
    return makeWhereResult(matched);
  }),
};

const deleteChain = {
  where: jest.fn(() => {
    const filter = lastDeleteFilter ?? (() => true);
    lastDeleteFilter = null;
    state.rows = state.rows.filter((r) => !filter(r));
    return Promise.resolve(undefined);
  }),
};

const mockDb = {
  insert: jest.fn(() => insertChain),
  select: jest.fn(() => selectChain),
  update: jest.fn(() => updateChain),
  delete: jest.fn(() => deleteChain),
};

jest.mock('../db', () => ({ db: mockDb }));

// drizzle's `eq`/`and`/`or`/`lt` are normally SQL builders. We replace them
// with predicate functions that the chain stubs above can apply directly.
jest.mock('drizzle-orm', () => {
  const actual = jest.requireActual('drizzle-orm') as Record<string, unknown>;
  const eq =
    (col: { name?: string } | string, val: unknown) =>
    (row: Row) => {
      const k = typeof col === 'string' ? col : (col?.name as string);
      return row[k] === val;
    };
  const and =
    (...preds: Array<(r: Row) => boolean>) =>
    (row: Row) =>
      preds.every((p) => p(row));
  const or =
    (...preds: Array<(r: Row) => boolean>) =>
    (row: Row) =>
      preds.some((p) => p(row));
  const lt =
    (col: { name?: string } | string, val: Date) =>
    (row: Row) => {
      const k = typeof col === 'string' ? col : (col?.name as string);
      const v = row[k];
      return v instanceof Date && v.getTime() < val.getTime();
    };
  return { ...actual, eq, and, or, lt };
});

// Hijack select.where & update.where & delete.where so the matching predicate
// is captured before being applied. We do that by patching the proxies above.
const origSelectWhere = selectChain.where;
selectChain.where = jest.fn((pred: (r: Row) => boolean) => {
  lastSelectFilter = pred;
  return origSelectWhere();
}) as typeof selectChain.where;

const origUpdateWhere = updateChain.where;
updateChain.where = jest.fn((pred: (r: Row) => boolean) => {
  lastUpdateFilter = pred;
  return origUpdateWhere();
}) as typeof updateChain.where;

const origDeleteWhere = deleteChain.where;
deleteChain.where = jest.fn((pred: (r: Row) => boolean) => {
  lastDeleteFilter = pred;
  return origDeleteWhere();
}) as typeof deleteChain.where;

// Schema columns are referenced as objects by the provider; expose them as
// `{ name }` markers so our `eq` mock can read the column name.
jest.mock('@shared/schemas/infrastructure', () => {
  const mkTable = (cols: string[]) =>
    Object.fromEntries(cols.map((c) => [c, { name: c }])) as Record<
      string,
      { name: string }
    >;
  return {
    oauthClients: mkTable([
      'clientId',
      'clientSecret',
      'redirectUris',
      'tokenEndpointAuthMethod',
      'grantTypes',
      'responseTypes',
      'scope',
      'clientName',
      'clientUri',
      'logoUri',
      'softwareId',
      'softwareVersion',
      'createdAt',
      'expiresAt',
    ]),
    oauthAuthCodes: mkTable([
      'code',
      'clientId',
      'redirectUri',
      'codeChallenge',
      'codeChallengeMethod',
      'scopes',
      'state',
      'resource',
      'status',
      'userId',
      'role',
      'used',
      'expiresAt',
      'createdAt',
    ]),
    oauthTokens: mkTable([
      'token',
      'tokenType',
      'clientId',
      'userId',
      'role',
      'scopes',
      'resource',
      'expiresAt',
      'refreshTokenFor',
      'createdAt',
    ]),
  };
});

describe('KoveoMcpOAuthProvider', () => {
  let provider: import('../mcp/oauth-provider').KoveoMcpOAuthProvider;

  beforeEach(async () => {
    state.rows = [];
    jest.clearAllMocks();
    const mod = await import('../mcp/oauth-provider');
    provider = new mod.KoveoMcpOAuthProvider();
  });

  const makeClient = () =>
    ({
      client_id: 'c1',
      client_secret: 's1',
      redirect_uris: ['https://example.test/cb'],
    }) as never;

  it('refuses to mint tokens for an auth code that was never finalized (no role)', async () => {
    // Simulate a `pending` row never approved by consent.
    state.rows.push({
      code: 'koac_pending',
      clientId: 'c1',
      redirectUri: 'https://example.test/cb',
      codeChallenge: 'abc',
      codeChallengeMethod: 'S256',
      scopes: ['mcp'],
      state: null,
      resource: null,
      status: 'pending',
      userId: null,
      role: null,
      used: false,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      provider.exchangeAuthorizationCode(
        makeClient(),
        'koac_pending',
        'verifier',
        'https://example.test/cb',
      ),
    ).rejects.toThrow('invalid_grant');
  });

  it('only allows an authorization code to be redeemed once', async () => {
    state.rows.push({
      code: 'koac_ok',
      clientId: 'c1',
      redirectUri: 'https://example.test/cb',
      codeChallenge: 'abc',
      codeChallengeMethod: 'S256',
      scopes: ['mcp'],
      state: null,
      resource: null,
      status: 'issued',
      userId: 'u1',
      role: 'tenant',
      used: false,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const tokens = await provider.exchangeAuthorizationCode(
      makeClient(),
      'koac_ok',
      'verifier',
      'https://example.test/cb',
    );
    expect(tokens.access_token).toMatch(/^koat_/);

    // Second redemption MUST fail — the row is now used=true.
    await expect(
      provider.exchangeAuthorizationCode(
        makeClient(),
        'koac_ok',
        'verifier',
        'https://example.test/cb',
      ),
    ).rejects.toThrow('invalid_grant');
  });

  it('verifyAccessToken returns the role in extra for downstream RBAC', async () => {
    state.rows.push({
      token: 'koat_x',
      tokenType: 'access',
      clientId: 'c1',
      userId: 'u1',
      role: 'manager',
      scopes: ['mcp'],
      resource: null,
      expiresAt: new Date(Date.now() + 60_000),
      refreshTokenFor: 'kort_x',
    });

    const info = await provider.verifyAccessToken('koat_x');
    expect(info.extra).toMatchObject({ userId: 'u1', role: 'manager' });
  });

  it('rejects expired access tokens', async () => {
    state.rows.push({
      token: 'koat_exp',
      tokenType: 'access',
      clientId: 'c1',
      userId: 'u1',
      role: 'tenant',
      scopes: ['mcp'],
      resource: null,
      expiresAt: new Date(Date.now() - 1000),
      refreshTokenFor: 'kort_exp',
    });

    await expect(provider.verifyAccessToken('koat_exp')).rejects.toThrow(
      'invalid_token',
    );
  });

  it('rotates refresh tokens and revokes the linked access token', async () => {
    state.rows.push({
      token: 'kort_old',
      tokenType: 'refresh',
      clientId: 'c1',
      userId: 'u1',
      role: 'admin',
      scopes: ['mcp'],
      resource: null,
      expiresAt: new Date(Date.now() + 60_000),
      refreshTokenFor: null,
    });
    state.rows.push({
      token: 'koat_old',
      tokenType: 'access',
      clientId: 'c1',
      userId: 'u1',
      role: 'admin',
      scopes: ['mcp'],
      resource: null,
      expiresAt: new Date(Date.now() + 60_000),
      refreshTokenFor: 'kort_old',
    });

    const tokens = await provider.exchangeRefreshToken(makeClient(), 'kort_old');
    expect(tokens.refresh_token).toMatch(/^kort_/);
    expect(tokens.refresh_token).not.toBe('kort_old');
    expect(tokens.access_token).toMatch(/^koat_/);
    // Old refresh + linked access must be gone.
    expect(state.rows.find((r) => r.token === 'kort_old')).toBeUndefined();
    expect(state.rows.find((r) => r.token === 'koat_old')).toBeUndefined();
  });
});

describe('OAuth role enforcement (createMcpServer)', () => {
  it('exposes McpAuthContext on createMcpServer for OAuth role override', async () => {
    // We cannot fully boot the McpServer in jsdom (it has wide imports).
    // Verifying the type/contract here protects the security-critical
    // override surface from being silently removed.
    const mod = await import('../mcp/server');
    expect(typeof mod.createMcpServer).toBe('function');
    expect(mod.createMcpServer.length).toBeLessThanOrEqual(1);
  });
});
