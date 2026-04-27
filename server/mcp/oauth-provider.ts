import crypto from 'node:crypto';
import { Response } from 'express';
import { and, eq, lt, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { oauthClients, oauthAuthCodes, oauthTokens } from '@shared/schema';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

export const MCP_SUPPORTED_ROLES = ['super_admin', 'admin', 'manager', 'tenant'] as const;
export type McpRole = (typeof MCP_SUPPORTED_ROLES)[number];

const AUTH_CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const CLIENT_SECRET_TTL_SECONDS = 60 * 60 * 24 * 90;

/**
 * Server-side pepper used as the HMAC key when hashing OAuth secrets at rest.
 * In production this MUST be supplied via the `MCP_OAUTH_PEPPER` env var. In
 * dev/test we fall back to a per-process random value so tests get a stable
 * key for the duration of the run but stale dev DB rows from a prior run
 * naturally fail to verify (and are wiped on boot — see `wipeStaleSecrets`).
 */
function resolvePepper(): string {
  const fromEnv = process.env.MCP_OAUTH_PEPPER;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'MCP_OAUTH_PEPPER must be set to a value of at least 16 characters in production',
    );
  }
  // Stable for the life of the process in dev/test.
  if (!devPepperCache) devPepperCache = crypto.randomBytes(32).toString('hex');
  return devPepperCache;
}
let devPepperCache: string | null = null;

/** Deterministic HMAC-SHA256 of a secret using the server pepper. */
export function hashSecret(plaintext: string): string {
  return crypto.createHmac('sha256', resolvePepper()).update(plaintext).digest('hex');
}

function randomToken(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(32).toString('base64url')}`;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Length of an HMAC-SHA256 hex digest. */
const HASH_LEN = 64;
function looksHashed(value: string | null | undefined): boolean {
  return !!value && value.length === HASH_LEN && /^[0-9a-f]+$/.test(value);
}

class KoveoOAuthClientsStore implements OAuthRegisteredClientsStore {
  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    const rows = await db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.clientId, clientId))
      .limit(1);
    if (rows.length === 0) return undefined;
    // Return the persisted client info as-is. `clientInfo.client_secret` (if
    // present) is already the HMAC hash of the secret. The SDK's clientAuth
    // middleware does a string comparison against the value we substitute in
    // the request body via `hashClientSecretForSdk` (see server/mcp/index.ts).
    return rows[0].clientInfo as OAuthClientInformationFull;
  }

  async registerClient(
    client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>,
  ): Promise<OAuthClientInformationFull> {
    const clientId = `koveo-mcp-${crypto.randomBytes(12).toString('base64url')}`;
    const issuedAt = nowSeconds();

    const requiresSecret =
      !client.token_endpoint_auth_method ||
      client.token_endpoint_auth_method !== 'none';
    const clientSecretPlaintext = requiresSecret ? randomToken('cs') : undefined;
    const clientSecretHash = clientSecretPlaintext
      ? hashSecret(clientSecretPlaintext)
      : undefined;
    const expiresAt = clientSecretPlaintext
      ? issuedAt + CLIENT_SECRET_TTL_SECONDS
      : undefined;

    // Persist ONLY the hash. The plaintext is never stored.
    const persistedInfo: OAuthClientInformationFull = {
      ...client,
      client_id: clientId,
      client_id_issued_at: issuedAt,
      ...(clientSecretHash ? { client_secret: clientSecretHash } : {}),
      ...(expiresAt ? { client_secret_expires_at: expiresAt } : {}),
    };

    await db.insert(oauthClients).values({
      clientId,
      clientSecret: clientSecretHash ?? null,
      clientIdIssuedAt: issuedAt,
      clientSecretExpiresAt: expiresAt ?? null,
      clientInfo: persistedInfo,
    });

    // Return the plaintext secret to the caller exactly once (RFC 7591).
    return {
      ...persistedInfo,
      ...(clientSecretPlaintext ? { client_secret: clientSecretPlaintext } : {}),
    };
  }
}

/**
 * Koveo's MCP OAuth 2.0 server provider.
 *
 * Implements the SDK's `OAuthServerProvider` interface backed by Drizzle tables.
 * Authorization codes carry the role chosen at consent so the MCP tools can
 * keep using `getMcpUser(role)` for RBAC enforcement.
 *
 * Secrets at rest:
 *   - Authorization codes, access tokens, and refresh tokens are stored as
 *     HMAC-SHA256(plaintext, MCP_OAUTH_PEPPER). Plaintext is returned to the
 *     client exactly once (in the redirect / token response) and is never
 *     persisted. Lookup paths hash the incoming value before querying.
 *   - Client secrets follow the same pattern (see `KoveoOAuthClientsStore`).
 */
export class KoveoMcpOAuthProvider implements OAuthServerProvider {
  readonly clientsStore = new KoveoOAuthClientsStore();

  /**
   * Begin the authorization flow: persist a `pending` row and redirect the
   * user-agent to the consent screen. The consent screen will, after the user
   * picks a role and approves, finalize the row and redirect back to the
   * client's `redirect_uri`.
   */
  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    const codePlaintext = randomToken('koac');
    const codeHash = hashSecret(codePlaintext);
    const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_MS);

    await db.insert(oauthAuthCodes).values({
      code: codeHash,
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: 'S256',
      scopes: params.scopes ?? [],
      state: params.state ?? null,
      resource: params.resource?.toString() ?? null,
      status: 'pending',
      expiresAt,
    });

    const consentUrl = new URL('/oauth/consent', 'http://placeholder');
    // The consent screen carries the PLAINTEXT flow code in the URL — the
    // user-agent never sees the hash. Consent routes hash again to look up.
    consentUrl.searchParams.set('flow', codePlaintext);
    res.redirect(`${consentUrl.pathname}?${consentUrl.searchParams.toString()}`);
  }

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const row = await this.findCode(authorizationCode, client.client_id);
    if (!row) throw new Error('invalid_grant');
    return row.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    const codeHash = hashSecret(authorizationCode);
    const row = await this.findCode(authorizationCode, client.client_id);
    if (!row) throw new Error('invalid_grant');
    if (row.status !== 'issued' || !row.userId || !row.role) {
      throw new Error('invalid_grant');
    }
    if (row.used) throw new Error('invalid_grant');
    if (row.expiresAt.getTime() < Date.now()) throw new Error('invalid_grant');
    if (redirectUri && redirectUri !== row.redirectUri) {
      throw new Error('invalid_grant');
    }
    if (
      row.resource &&
      resource &&
      row.resource.replace(/\/$/, '') !== resource.toString().replace(/\/$/, '')
    ) {
      throw new Error('invalid_target');
    }

    // Atomically claim the code. If another concurrent request already
    // consumed it (used = true), this returns 0 rows and we reject the grant.
    const claimed = await db
      .update(oauthAuthCodes)
      .set({ used: true })
      .where(and(eq(oauthAuthCodes.code, codeHash), eq(oauthAuthCodes.used, false)))
      .returning({ code: oauthAuthCodes.code });
    if (claimed.length === 0) throw new Error('invalid_grant');

    return this.issueTokens({
      clientId: client.client_id,
      userId: row.userId,
      role: row.role,
      scopes: row.scopes ?? [],
      resource: row.resource ?? resource?.toString() ?? null,
    });
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ): Promise<OAuthTokens> {
    const refreshHash = hashSecret(refreshToken);
    const rows = await db
      .select()
      .from(oauthTokens)
      .where(
        and(
          eq(oauthTokens.token, refreshHash),
          eq(oauthTokens.tokenType, 'refresh'),
          eq(oauthTokens.clientId, client.client_id),
        ),
      )
      .limit(1);
    const refresh = rows[0];
    if (!refresh) throw new Error('invalid_grant');
    if (refresh.expiresAt.getTime() < Date.now()) throw new Error('invalid_grant');

    // Rotate refresh token + revoke old access tokens linked to it.
    // `refreshTokenFor` on access-token rows already stores the HASH of the
    // refresh token (see `issueTokens`), so this comparison is hash-vs-hash.
    await db
      .delete(oauthTokens)
      .where(
        or(
          eq(oauthTokens.token, refreshHash),
          eq(oauthTokens.refreshTokenFor, refreshHash),
        ),
      );

    return this.issueTokens({
      clientId: client.client_id,
      userId: refresh.userId,
      role: refresh.role,
      scopes: scopes ?? refresh.scopes ?? [],
      resource: resource?.toString() ?? refresh.resource ?? null,
    });
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const tokenHash = hashSecret(token);
    const rows = await db
      .select()
      .from(oauthTokens)
      .where(
        and(eq(oauthTokens.token, tokenHash), eq(oauthTokens.tokenType, 'access')),
      )
      .limit(1);
    const access = rows[0];
    if (!access) throw new Error('invalid_token');
    if (access.expiresAt.getTime() < Date.now()) {
      throw new Error('invalid_token');
    }
    return {
      token,
      clientId: access.clientId,
      scopes: access.scopes ?? [],
      expiresAt: Math.floor(access.expiresAt.getTime() / 1000),
      resource: access.resource ? new URL(access.resource) : undefined,
      extra: { userId: access.userId, role: access.role },
    };
  }

  async revokeToken(
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    const tokenHash = hashSecret(request.token);
    await db
      .delete(oauthTokens)
      .where(
        and(
          eq(oauthTokens.clientId, client.client_id),
          or(
            eq(oauthTokens.token, tokenHash),
            eq(oauthTokens.refreshTokenFor, tokenHash),
          ),
        ),
      );
  }

  /**
   * Called by the consent screen handler once the resource-owner approves the
   * request. Marks the pending row as `issued` and stamps it with the chosen
   * Koveo user/role. Accepts the PLAINTEXT flow code (from the URL) and
   * hashes it for the DB lookup. Returns the plaintext code to redirect with.
   */
  async finalizeAuthorization(
    flowCode: string,
    userId: string,
    role: McpRole,
  ): Promise<{ code: string; redirectUri: string; state: string | null }> {
    const flowHash = hashSecret(flowCode);
    const rows = await db
      .select()
      .from(oauthAuthCodes)
      .where(eq(oauthAuthCodes.code, flowHash))
      .limit(1);
    const row = rows[0];
    if (!row) throw new Error('flow_not_found');
    if (row.status !== 'pending') throw new Error('flow_already_finalized');
    if (row.expiresAt.getTime() < Date.now()) throw new Error('flow_expired');

    await db
      .update(oauthAuthCodes)
      .set({ status: 'issued', userId, role })
      .where(eq(oauthAuthCodes.code, flowHash));

    return { code: flowCode, redirectUri: row.redirectUri, state: row.state };
  }

  async getPendingFlow(flowCode: string) {
    const flowHash = hashSecret(flowCode);
    const rows = await db
      .select()
      .from(oauthAuthCodes)
      .where(eq(oauthAuthCodes.code, flowHash))
      .limit(1);
    return rows[0];
  }

  async denyAuthorization(flowCode: string): Promise<{
    redirectUri: string;
    state: string | null;
  } | null> {
    const flowHash = hashSecret(flowCode);
    const rows = await db
      .select()
      .from(oauthAuthCodes)
      .where(eq(oauthAuthCodes.code, flowHash))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    await db.delete(oauthAuthCodes).where(eq(oauthAuthCodes.code, flowHash));
    return { redirectUri: row.redirectUri, state: row.state };
  }

  /**
   * Deletes expired auth codes and tokens; called opportunistically.
   */
  async sweepExpired(): Promise<void> {
    const now = new Date();
    await db.delete(oauthAuthCodes).where(lt(oauthAuthCodes.expiresAt, now));
    await db.delete(oauthTokens).where(lt(oauthTokens.expiresAt, now));
  }

  /**
   * One-shot startup cleanup: if any persisted secret in the OAuth tables is
   * not in HMAC-SHA256 hex form, wipe ALL three OAuth tables.
   *
   * This handles the migration from the previous plaintext-storage scheme.
   * It is acceptable to drop the rows because:
   *  - auth codes are short-lived (10 min)
   *  - tokens are revoked on next use anyway since their hashes won't match
   *  - no production clients are issued yet (per task #102 notes)
   */
  async wipeStaleSecrets(): Promise<{ wiped: boolean; reason?: string }> {
    try {
      // Scan ALL rows in each table — sampling a single row would miss mixed
      // datasets where some rows are already hashed and others remain plaintext.
      const allClients = await db
        .select({ secret: oauthClients.clientSecret })
        .from(oauthClients)
        .where(sql`${oauthClients.clientSecret} IS NOT NULL`);
      const allCodes = await db
        .select({ code: oauthAuthCodes.code })
        .from(oauthAuthCodes);
      const allTokens = await db
        .select({ token: oauthTokens.token })
        .from(oauthTokens);

      const reasons: string[] = [];
      if (allClients.some((r) => r.secret && !looksHashed(r.secret))) {
        reasons.push('plaintext-client-secret');
      }
      if (allCodes.some((r) => r.code && !looksHashed(r.code))) {
        reasons.push('plaintext-auth-code');
      }
      if (allTokens.some((r) => r.token && !looksHashed(r.token))) {
        reasons.push('plaintext-token');
      }

      if (reasons.length === 0) return { wiped: false };

      await db.delete(oauthTokens);
      await db.delete(oauthAuthCodes);
      await db.delete(oauthClients);
      return { wiped: true, reason: reasons.join(',') };
    } catch (e) {
      // Tables may not exist yet (e.g. fresh dev DB). Don't fail startup.
      return { wiped: false, reason: (e as Error).message };
    }
  }

  private async findCode(plaintextCode: string, clientId: string) {
    const codeHash = hashSecret(plaintextCode);
    const rows = await db
      .select()
      .from(oauthAuthCodes)
      .where(
        and(eq(oauthAuthCodes.code, codeHash), eq(oauthAuthCodes.clientId, clientId)),
      )
      .limit(1);
    return rows[0];
  }

  private async issueTokens(params: {
    clientId: string;
    userId: string;
    role: string;
    scopes: string[];
    resource: string | null;
  }): Promise<OAuthTokens> {
    const accessTokenPlaintext = randomToken('koat');
    const refreshTokenPlaintext = randomToken('kort');
    const accessHash = hashSecret(accessTokenPlaintext);
    const refreshHash = hashSecret(refreshTokenPlaintext);
    const accessExpires = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);
    const refreshExpires = new Date(
      Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000,
    );

    await db.insert(oauthTokens).values([
      {
        token: accessHash,
        tokenType: 'access',
        clientId: params.clientId,
        userId: params.userId,
        role: params.role,
        scopes: params.scopes,
        resource: params.resource,
        expiresAt: accessExpires,
        // Store the HASH of the refresh token here so refresh-rotation
        // lookups stay hash-vs-hash.
        refreshTokenFor: refreshHash,
      },
      {
        token: refreshHash,
        tokenType: 'refresh',
        clientId: params.clientId,
        userId: params.userId,
        role: params.role,
        scopes: params.scopes,
        resource: params.resource,
        expiresAt: refreshExpires,
        refreshTokenFor: null,
      },
    ]);

    return {
      access_token: accessTokenPlaintext,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshTokenPlaintext,
      scope: params.scopes.join(' ') || undefined,
    };
  }
}

export const koveoMcpOAuthProvider = new KoveoMcpOAuthProvider();
