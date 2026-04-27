import { Express, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer } from "./server";
import { seedMcpData } from "./seed-mcp-data";
import { koveoMcpOAuthProvider, hashSecret } from "./oauth-provider";
import { registerOAuthConsentRoutes } from "./oauth-consent";

export { registerOAuthConsentRoutes } from "./oauth-consent";
export { koveoMcpOAuthProvider } from "./oauth-provider";

/**
 * Resolve the public origin this server is reachable at — used as the OAuth
 * 2.0 issuer / resource server URL. Must match the host the user-agent will
 * see (Claude.ai requires HTTPS).
 *
 * In production, `MCP_OAUTH_ISSUER` is REQUIRED. We deliberately do not fall
 * back to a hard-coded host or to `http://localhost:5000` — a wrong issuer in
 * the discovery document silently breaks the OAuth flow and (worse) lets
 * Claude.ai send tokens to a server that isn't listed as the resource owner.
 * Failing fast at boot is much louder than a runtime mismatch.
 */
export function resolveIssuerOrigin(): string {
  if (process.env.MCP_OAUTH_ISSUER) return process.env.MCP_OAUTH_ISSUER;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "MCP_OAUTH_ISSUER must be set in production (e.g. https://koveo-gestion.com). " +
        "Refusing to start with an unknown OAuth issuer.",
    );
  }
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  if (process.env.REPLIT_DOMAINS) {
    const first = process.env.REPLIT_DOMAINS.split(",")[0]?.trim();
    if (first) return `https://${first}`;
  }
  return "http://localhost:5000";
}

const RATE_LIMIT_DEFAULTS = {
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
} as const;

/**
 * Per-IP limiter for `/register` (RFC 7591 dynamic client registration).
 * Tighter than the user-agent endpoints because every successful call inserts
 * an `oauth_clients` row — without a limit an attacker could flood the table.
 */
const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  handler: (_req, res) => {
    res.status(429).json({
      error: "rate_limited",
      error_description: "Too many client registrations from this IP",
    });
  },
  ...RATE_LIMIT_DEFAULTS,
});

/** Looser per-IP limiter for `/authorize` and `/token`. */
const oauthEndpointRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 120,
  handler: (_req, res) => {
    res.status(429).json({
      error: "rate_limited",
      error_description: "Too many OAuth requests from this IP",
    });
  },
  ...RATE_LIMIT_DEFAULTS,
});

/**
 * The SDK's `clientAuth` middleware does a string-equality check between the
 * stored `client.client_secret` and the body-supplied `client_secret`. Because
 * we persist the HMAC HASH of the secret (see KoveoOAuthClientsStore), we
 * substitute the request body value with its hash BEFORE the SDK middleware
 * runs. The comparison then becomes hash-vs-hash and remains secure: an
 * attacker reading the DB row cannot forge a request without knowing the
 * pepper used by `hashSecret`.
 */
function hashClientSecretForSdk(req: Request, _res: Response, next: NextFunction) {
  const body = req.body as { client_secret?: unknown } | undefined;
  if (body && typeof body.client_secret === "string" && body.client_secret.length > 0) {
    body.client_secret = hashSecret(body.client_secret);
  }
  next();
}

export async function registerMcpRoutes(app: Express) {
  // Task #980 — hard-lock warning: if MCP_ASSUME_USER is set to a truthy value
  // in a production environment the flag is silently ignored by
  // isMcpAssumeUserEnabled() (see server/utils/feature-flags.ts). Emit one
  // clear startup log so the operator knows exactly why their override had no
  // effect, without throwing or crashing.
  //
  // We use the same truthy-value set as readBoolEnv() (1/true/on/yes) so an
  // empty or falsy value (MCP_ASSUME_USER=0, MCP_ASSUME_USER=false) does not
  // produce a spurious warning.
  const _assumeUserRaw = (process.env.MCP_ASSUME_USER ?? '').trim().toLowerCase();
  const _assumeUserTruthy = _assumeUserRaw === '1' || _assumeUserRaw === 'true' || _assumeUserRaw === 'on' || _assumeUserRaw === 'yes';
  if (process.env.NODE_ENV === 'production' && _assumeUserTruthy) {
    console.warn(
      '[MCP] WARNING: MCP_ASSUME_USER is set but is being IGNORED because NODE_ENV=production. ' +
        'The assume_user / restore_acting_user impersonation tools are hard-locked off in ' +
        'production regardless of this env var. To use impersonation, target the staging ' +
        'deployment instead. See docs/MCP_STAGING_QA_HARNESS.md for details.',
    );
  }

  // In non-production, always run the (idempotent) seed so dev environments
  // get the MCP-1/MCP-2 sandbox automatically.
  if (process.env.NODE_ENV !== "production") {
    await seedMcpData();
  } else if (process.env.MCP_SEED_PRODUCTION === "true") {
    // One-time, opt-in production seed: keep this visible so operators can
    // confirm via deploy logs that the sandbox seed actually ran.
    console.log("[MCP SEED] MCP_SEED_PRODUCTION=true detected — running production sandbox seed (idempotent).");
    try {
      await seedMcpData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      console.error("[MCP SEED] Production sandbox seed failed:", message, stack ?? "");
      throw error;
    }
  }
  // Production-default branch (seeding disabled) intentionally silent — there is
  // no operator action needed and the message just clutters every cold start.

  const issuerOrigin = resolveIssuerOrigin();
  const issuerUrl = new URL(issuerOrigin);
  const resourceServerUrl = new URL("/mcp", issuerOrigin);
  const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(resourceServerUrl);

  // One-shot startup migration: wipe any rows that were persisted under the
  // pre-hashing scheme. Safe because no production clients are issued yet
  // and ephemeral OAuth state is intentionally drop-on-demand.
  try {
    const wipe = await koveoMcpOAuthProvider.wipeStaleSecrets();
    if (wipe.wiped) {
      console.warn(
        `[MCP OAuth] Wiped legacy plaintext OAuth rows on boot (${wipe.reason}). ` +
          `Existing clients must re-register; existing tokens are invalidated.`,
      );
    }
  } catch (e) {
    console.error("[MCP OAuth] wipeStaleSecrets failed (continuing):", e);
  }

  // Per-IP rate limits MUST be mounted before mcpAuthRouter so the SDK never
  // sees the over-limit request. /register is the most sensitive (insert).
  app.use("/register", registerRateLimiter);
  app.use("/authorize", oauthEndpointRateLimiter);
  app.use("/token", oauthEndpointRateLimiter);
  app.use("/revoke", oauthEndpointRateLimiter);

  // Hash incoming client_secret BEFORE the SDK's clientAuth string-compare.
  // Applies to /token and /revoke (the only client-authenticated endpoints).
  app.use("/token", hashClientSecretForSdk);
  app.use("/revoke", hashClientSecretForSdk);

  // Mount the SDK's built-in OAuth 2.0 endpoints:
  //   /.well-known/oauth-authorization-server
  //   /.well-known/oauth-protected-resource
  //   /authorize, /token, /register, /revoke
  app.use(
    mcpAuthRouter({
      provider: koveoMcpOAuthProvider,
      issuerUrl,
      resourceServerUrl,
      scopesSupported: ["mcp"],
      resourceName: "Koveo Gestion MCP",
      // Disable the SDK's bundled rate limiters so our own (mounted above)
      // are the single source of 429 responses with consistent error bodies.
      clientRegistrationOptions: { rateLimit: false },
      authorizationOptions: { rateLimit: false },
      tokenOptions: { rateLimit: false },
      revocationOptions: { rateLimit: false },
    }),
  );

  // NOTE: consent routes are NOT mounted here because they depend on
  // session middleware. Call `registerOAuthConsentRoutes(app, koveoMcpOAuthProvider)`
  // (re-exported from this module) AFTER `app.use(sessionConfig)` in
  // `server/routes.ts`.

  const transports: Map<string, StreamableHTTPServerTransport> = new Map();

  /**
   * Authenticate an `/mcp` request with either:
   *   1. an OAuth 2.0 Bearer access token issued by this server, or
   *   2. the legacy static `MCP_API_KEY` (Bearer header or `?api_key=`).
   *
   * On failure, emit RFC 9728 `WWW-Authenticate` so MCP clients can discover
   * the OAuth flow.
   */
  async function authenticate(req: Request, res: Response): Promise<boolean> {
    const headerAuth = req.headers.authorization;
    const bearer = headerAuth?.startsWith("Bearer ")
      ? headerAuth.slice("Bearer ".length).trim()
      : undefined;
    const queryKey = typeof req.query.api_key === "string" ? req.query.api_key : undefined;
    const candidate = bearer ?? queryKey;

    if (candidate) {
      // Try OAuth first.
      try {
        const info = await koveoMcpOAuthProvider.verifyAccessToken(candidate);
        (req as Request & { auth?: typeof info }).auth = info;
        return true;
      } catch {
        // Fall through to legacy key check.
      }

      const legacyKey = process.env.MCP_API_KEY;
      if (legacyKey && candidate === legacyKey) {
        return true;
      }
    }

    res
      .status(401)
      .set(
        "WWW-Authenticate",
        `Bearer realm="mcp", resource_metadata="${resourceMetadataUrl}"`,
      )
      .json({ error: "invalid_token", error_description: "Valid OAuth token or API key required" });
    return false;
  }

  app.post("/mcp", async (req: Request, res: Response) => {
    if (!(await authenticate(req, res))) return;

    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (!sessionId && isInitializeRequest(req.body)) {
        const auth = (req as Request & { auth?: { extra?: { userId?: string; role?: "super_admin" | "admin" | "manager" | "tenant" } } }).auth;
        // Capture client IP and User-Agent at session-initialize time so the
        // `assume_user` audit log (Task #642) can attribute every
        // impersonation row back to a specific caller. These values live on
        // the per-session McpServer closure, so they reflect the IP/UA that
        // *opened* the session, not necessarily the IP of every later POST
        // — that's good enough for an audit trail and avoids plumbing the
        // request object through every tool handler.
        const userAgent = req.headers["user-agent"];
        const server = createMcpServer({
          userId: auth?.extra?.userId,
          role: auth?.extra?.role,
          ipAddress: req.ip ?? undefined,
          userAgent: typeof userAgent === "string" ? userAgent : undefined,
        });
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
        });
        transport.onclose = () => {
          if (transport.sessionId) {
            transports.delete(transport.sessionId);
          }
        };
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        if (transport.sessionId) {
          transports.set(transport.sessionId, transport);
        }
        return;
      }

      if (sessionId) {
        const transport = transports.get(sessionId);
        if (!transport) {
          res.status(404).json({ error: "Session not found. Send an initialize request first." });
          return;
        }
        await transport.handleRequest(req, res, req.body);
        return;
      }

      res.status(400).json({ error: "Missing session ID or initialize request" });
    } catch (error) {
      console.error("[MCP] Error handling request:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  app.get("/mcp", async (req: Request, res: Response) => {
    if (!(await authenticate(req, res))) return;

    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId) {
        res.status(400).json({ error: "Missing Mcp-Session-Id header" });
        return;
      }
      const transport = transports.get(sessionId);
      if (!transport) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("[MCP] Error handling GET:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  app.delete("/mcp", async (req: Request, res: Response) => {
    if (!(await authenticate(req, res))) return;

    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId) {
        res.status(400).json({ error: "Missing Mcp-Session-Id header" });
        return;
      }
      const transport = transports.get(sessionId);
      if (!transport) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      await transport.handleRequest(req, res);
      transports.delete(sessionId);
    } catch (error) {
      console.error("[MCP] Error handling DELETE:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Best-effort hourly cleanup of expired OAuth state.
  const sweep = setInterval(() => {
    koveoMcpOAuthProvider.sweepExpired().catch((e) => console.error("[MCP OAuth] sweep failed", e));
  }, 60 * 60 * 1000);
  sweep.unref?.();

  if (process.env.NODE_ENV !== "production") {
    console.log(`[MCP] OAuth-protected MCP server registered at /mcp (issuer=${issuerOrigin})`);
  }
}
