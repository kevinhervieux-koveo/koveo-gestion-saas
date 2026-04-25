/**
 * Centralized configuration management for Koveo Gestion server.
 */

import { z } from 'zod';
import {
  maskDatabaseUrl,
  resolveDatabaseUrl,
  type ResolvedDatabaseUrl,
} from '../../scripts/run-migrations-url';

// Environment schema validation
//
// `DATABASE_URL` is intentionally optional here: in production the operator
// may have only set `DATABASE_URL_KOVEO` *or* `PRODUCTION_DATABASE_URL`
// (the two are aliases — see `scripts/run-migrations-url.ts`). Requiring
// `DATABASE_URL` would make the server refuse to boot in that valid
// production configuration. The actual presence/absence check is
// performed by `resolveDatabaseUrl()` below, which throws fail-fast when
// no usable URL is configured for the current `NODE_ENV`.
const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().optional(),
  DATABASE_URL_KOVEO: z.string().optional(), // Production database (canonical)
  PRODUCTION_DATABASE_URL: z.string().optional(), // Production database (alias)
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters for security'),
  REPL_SLUG: z.string().optional(),
  REPL_OWNER: z.string().optional(),

  // Email configuration
  SENDGRID_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().email().optional(),

  // SSL configuration
  SSL_ENABLED: z.coerce.boolean().default(false),
  SSL_STAGING: z.coerce.boolean().default(true),

  // Performance configuration
  CACHE_TTL: z.coerce.number().default(300), // 5 minutes
  MAX_CACHE_SIZE: z.coerce.number().default(100),

  // Security configuration
  RATE_LIMIT_WINDOW: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  // Database optimization
  DB_POOL_SIZE: z.coerce.number().default(10),
  QUERY_TIMEOUT: z.coerce.number().default(30000), // 30 seconds
});

// Parse and validate environment variables with production checks
let env: z.infer<typeof envSchema>;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  // Enhanced error handling for missing SESSION_SECRET
  if (error instanceof z.ZodError) {
    const sessionSecretError = error.issues.find(e => e.path.includes('SESSION_SECRET'));
    if (sessionSecretError) {
      console.error('🔐 SECURITY ERROR: SESSION_SECRET is required and must be at least 32 characters');
      console.error('💡 Generate a secure session secret: openssl rand -base64 48');
      process.exit(1);
    }
  }
  throw error;
}

// Detect environment based on domain instead of NODE_ENV
const detectEnvironment = () => {
  // Get domain from various sources - check multiple environment variables
  const replDomain = env.REPL_SLUG && env.REPL_OWNER ? `${env.REPL_SLUG}.${env.REPL_OWNER}.repl.co` : null;
  const hostDomain = process.env.REPLIT_DOMAINS || process.env.HOST || process.env.DOMAIN;
  
  // Check if we're on a custom domain (production deployment)
  const requestHost = process.env.REQUEST_HOST || process.env.HTTP_HOST;
  const serverName = process.env.SERVER_NAME;
  
  // Use the most specific domain available
  const domain = requestHost || serverName || hostDomain || replDomain || 'localhost';

  // Production domains (add your production domains here)
  const productionDomains = ['koveo-gestion.com', 'www.koveo-gestion.com', 'app.koveo-gestion.com'];

  // Check for production indicators
  const isExplicitProduction = process.env.NODE_ENV === 'production';
  const isDomainProduction = productionDomains.some((prodDomain) => 
    domain.includes(prodDomain) || domain === prodDomain
  );
  
  // Force production mode if we detect koveo-gestion.com domain
  const isKoveoProduction = domain.includes('koveo-gestion.com');
  
  // CORRECT FIX: Use REPLIT_DEPLOYMENT to detect production deployment vs workspace
  const isReplitDeployment = process.env.REPLIT_DEPLOYMENT === '1';
  
  // Prioritize explicit NODE_ENV setting (deployment environment)
  // Use production mode for: explicit production, koveo domains, or Replit deployments
  const isProduction = isExplicitProduction || isKoveoProduction || isDomainProduction || isReplitDeployment;
  const isDevelopment = !isProduction;

  // Environment detected

  return {
    environment: isDevelopment ? 'development' : 'production',
    isDevelopment,
    isProduction,
    isTest: false,
    domain,
  };
};

const envConfig = detectEnvironment();

/**
 * Resolve the database URL once at boot using the same helper as the
 * deploy-time migration runner (Task #936). This keeps a single source
 * of truth for "which DB does the running server talk to?": prefer
 * `DATABASE_URL_KOVEO`, accept `PRODUCTION_DATABASE_URL` as an alias,
 * and fail fast in `NODE_ENV=production` when neither is set instead
 * of silently falling back to the dev `DATABASE_URL`.
 *
 * `resolveDatabaseUrl()` reads `NODE_ENV` itself; we re-read directly
 * from `process.env` (rather than going through `envConfig`) so that
 * the contract here matches the migration runner exactly. The
 * domain-based detection in `detectEnvironment()` remains for things
 * like cookie/SSL behaviour but does not affect DB selection.
 */
const resolvedDb: ResolvedDatabaseUrl = resolveDatabaseUrl(process.env);

if (resolvedDb.ignoredSource && resolvedDb.ignoredSourceDiffers) {
  console.warn(
    `⚠️  [DB CONFIG] Both DATABASE_URL_KOVEO and ${resolvedDb.ignoredSource} ` +
      `are set but point at DIFFERENT databases. Using ` +
      `${resolvedDb.source} (${maskDatabaseUrl(resolvedDb.url)}) and ` +
      `ignoring ${resolvedDb.ignoredSource}. Set both to the same value ` +
      `or unset one to silence this warning.`,
  );
}

export const config = {
  // Server configuration
  server: {
    port: env.PORT,
    nodeEnv: envConfig.environment,
    isDevelopment: envConfig.isDevelopment,
    isProduction: envConfig.isProduction,
    isTest: envConfig.isTest,
    domain: envConfig.domain,
  },

  // Database configuration
  database: {
    // Single source of truth: resolved by `resolveDatabaseUrl()` above
    // using the same alias rules as the deploy-time migration runner.
    url: resolvedDb.url,
    // Which env var supplied the URL (`DATABASE_URL_KOVEO`,
    // `PRODUCTION_DATABASE_URL`, or `DATABASE_URL`). Used by `db.ts`
    // and `auth.ts` to log the source without echoing the URL itself.
    urlSource: resolvedDb.source,
    // `host[:port]/dbname` — safe to log; credentials are stripped.
    urlMasked: maskDatabaseUrl(resolvedDb.url),
    // True when both prod aliases were set: the alias is recorded so
    // we can mention it in startup logs.
    ignoredUrlSource: resolvedDb.ignoredSource,
    // True when the two prod aliases pointed at different databases.
    ignoredUrlSourceDiffers: !!resolvedDb.ignoredSourceDiffers,
    poolSize: env.DB_POOL_SIZE,
    queryTimeout: env.QUERY_TIMEOUT,
    // Helper function to get database URL at runtime based on request.
    // Kept for backwards compatibility with callers that pass a
    // request domain — both prod and "koveo-gestion.com" requests now
    // resolve to the same URL we picked at boot, so the result is
    // deterministic regardless of `requestDomain`. In a non-prod
    // workspace serving a request whose host is `koveo-gestion.com`
    // we still upgrade to the prod URL when one is configured (the
    // historical behaviour of this helper).
    getRuntimeDatabaseUrl: (requestDomain?: string) => {
      const isRuntimeDeployment = process.env.REPLIT_DEPLOYMENT === '1';
      const isRuntimeKoveoProduction = requestDomain?.includes('koveo-gestion.com');
      const wantsProd =
        isRuntimeDeployment || isRuntimeKoveoProduction || envConfig.isProduction;

      if (wantsProd) {
        // If we already resolved a prod URL at boot, use it; otherwise
        // fall back to whatever boot resolution returned (e.g. dev
        // workspace with no prod var set).
        return (
          env.DATABASE_URL_KOVEO ||
          env.PRODUCTION_DATABASE_URL ||
          resolvedDb.url
        );
      }
      return env.DATABASE_URL || resolvedDb.url;
    },
  },

  // Session configuration
  session: {
    secret: env.SESSION_SECRET,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: envConfig.isProduction,
    httpOnly: true,
    sameSite: 'strict' as const,
  },

  // Email configuration
  email: {
    apiKey: env.SENDGRID_API_KEY,
    fromEmail: env.FROM_EMAIL || 'noreply@koveo.ca',
    enabled: !!env.SENDGRID_API_KEY,
  },

  // SSL configuration
  ssl: {
    enabled: env.SSL_ENABLED,
    staging: env.SSL_STAGING,
  },

  // Cache configuration
  cache: {
    ttl: env.CACHE_TTL,
    maxSize: env.MAX_CACHE_SIZE,
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW,
    max: env.RATE_LIMIT_MAX,
  },

  // Quebec compliance settings
  quebec: {
    defaultLanguage: 'fr' as const,
    supportedLanguages: ['en', 'fr'] as const,
    requireBilingual: true,
    law25Compliance: true,
  },

  // Debug logging configuration
  logging: {
    enabled: envConfig.isDevelopment, // Only log in development (not DATABASE_URL_KOVEO)
    level: envConfig.isDevelopment ? 'DEBUG' : 'ERROR',
    categories: {
      auth: true,
      api: true,
      db: true,
      storage: true,
      document: true,
      security: true, // Always enabled for security auditing
      performance: envConfig.isDevelopment,
      system: true,
    },
    performance: {
      enableTiming: envConfig.isDevelopment,
      slowQueryThreshold: 1000, // Log queries slower than 1s
      enableSqlLogging: envConfig.isDevelopment,
    },
  },
} as const;

/**
 *
 */
export type Config = typeof config;
export default config;
