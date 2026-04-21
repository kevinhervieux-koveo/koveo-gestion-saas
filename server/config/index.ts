/**
 * Centralized configuration management for Koveo Gestion server.
 */

import { z } from 'zod';

// Environment schema validation
const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_URL_KOVEO: z.string().optional(), // Production database
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
    // Use DATABASE_URL_KOVEO only in production, otherwise use DATABASE_URL for development
    url: envConfig.isProduction ? (env.DATABASE_URL_KOVEO || env.DATABASE_URL) : env.DATABASE_URL,
    poolSize: env.DB_POOL_SIZE,
    queryTimeout: env.QUERY_TIMEOUT,
    // Helper function to get database URL at runtime based on request
    getRuntimeDatabaseUrl: (requestDomain?: string) => {
      // Use REPLIT_DEPLOYMENT and domain detection for proper database selection
      const isRuntimeDeployment = process.env.REPLIT_DEPLOYMENT === '1';
      const isRuntimeKoveoProduction = requestDomain?.includes('koveo-gestion.com');
      const isRuntimeProduction = isRuntimeDeployment || isRuntimeKoveoProduction || envConfig.isProduction;
      
      // Use DATABASE_URL_KOVEO for production/deployment, DATABASE_URL for workspace
      return isRuntimeProduction ? (env.DATABASE_URL_KOVEO || env.DATABASE_URL) : env.DATABASE_URL;
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

  // Debug logging configuration - TEMPORARILY ENABLED FOR DEBUGGING
  logging: {
    enabled: true, // TEMPORARILY ENABLED to debug production 500 errors
    level: 'DEBUG', // TEMPORARILY SET to DEBUG for error diagnosis
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
