/**
 * Centralized configuration management for Koveo Gestion server.
 */

import { z } from 'zod';

// Environment schema validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_URL_DEV: z.string().optional(),
  SESSION_SECRET: z.string().optional(),

  // Email configuration
  SENDGRID_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().email().optional(),

  // SSL configuration
  SSL_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default(false),
  SSL_STAGING: z
    .string()
    .transform((v) => v === 'true')
    .default(true),

  // Performance configuration
  CACHE_TTL: z.string().transform(Number).default(300), // 5 minutes
  MAX_CACHE_SIZE: z.string().transform(Number).default(100),

  // Security configuration
  RATE_LIMIT_WINDOW: z.string().transform(Number).default(900000), // 15 minutes
  RATE_LIMIT_MAX: z.string().transform(Number).default(100),

  // Database optimization
  DB_POOL_SIZE: z.string().transform(Number).default(10),
  QUERY_TIMEOUT: z.string().transform(Number).default(30000), // 30 seconds
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

export const config = {
  // Server configuration
  server: {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  },

  // Database configuration
  database: {
    url: env.NODE_ENV === 'development' 
      ? env.DATABASE_URL_DEV || env.DATABASE_URL
      : env.DATABASE_URL,
    poolSize: env.DB_POOL_SIZE,
    queryTimeout: env.QUERY_TIMEOUT,
  },

  // Session configuration
  session: {
    secret: env.SESSION_SECRET || 'koveo-gestion-secret-key',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: env.NODE_ENV === 'production',
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
} as const;

/**
 *
 */
export type Config = typeof config;
export default config;
