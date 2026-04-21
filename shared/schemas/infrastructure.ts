import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, pgEnum, boolean, integer, varchar, json, index } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { relations } from 'drizzle-orm';
import { users } from './core';

// Infrastructure enums
export const sslStatusEnum = pgEnum('ssl_status', [
  'active',
  'pending',
  'expired',
  'revoked',
  'failed',
]);

// Infrastructure tables
/**
 * SSL certificates table for managing domain SSL certificates.
 * Supports automated certificate management and renewal tracking.
 */
export const sslCertificates = pgTable('ssl_certificates', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  domain: text('domain').notNull().unique(),
  certificateData: text('certificate_data').notNull(),
  privateKey: text('private_key').notNull(),
  issuer: text('issuer').notNull(),
  subject: text('subject').notNull(),
  serialNumber: text('serial_number').notNull(),
  fingerprint: text('fingerprint').notNull(),
  validFrom: timestamp('valid_from').notNull(),
  validTo: timestamp('valid_to').notNull(),
  status: sslStatusEnum('status').notNull().default('pending'),
  autoRenew: boolean('auto_renew').notNull().default(true),
  renewalAttempts: integer('renewal_attempts').notNull().default(0),
  maxRenewalAttempts: integer('max_renewal_attempts').notNull().default(3),
  dnsProvider: text('dns_provider'),
  lastRenewalAttempt: timestamp('last_renewal_attempt'),
  nextRenewalDate: timestamp('next_renewal_date'),
  // Additional SSL management fields
  certificateChain: text('certificate_chain'),
  renewalError: text('renewal_error'),
  dnsCredentials: text('dns_credentials'),
  notificationEmails: text('notification_emails'),
  createdBy: varchar('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  createdByIdx: index('ssl_certificates_created_by_idx').on(table.createdBy),
  statusIdx: index('ssl_certificates_status_idx').on(table.status),
  // Date indexes for range queries
  validFromIdx: index('ssl_certificates_valid_from_idx').on(table.validFrom),
  validToIdx: index('ssl_certificates_valid_to_idx').on(table.validTo),
  lastRenewalAttemptIdx: index('ssl_certificates_last_renewal_attempt_idx').on(table.lastRenewalAttempt),
  nextRenewalDateIdx: index('ssl_certificates_next_renewal_date_idx').on(table.nextRenewalDate),
  createdAtIdx: index('ssl_certificates_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('ssl_certificates_updated_at_idx').on(table.updatedAt),
}));

/**
 * Session table for PostgreSQL session store.
 * This table stores user session data for authentication.
 * CRITICAL: This table must never be deleted as it's required for user sessions.
 */
export const sessions = pgTable('session', {
  sid: varchar('sid').primaryKey().notNull(),
  sess: json('sess').notNull(),
  expire: timestamp('expire', { precision: 6 }).notNull(),
}, (table) => ({
  // Date indexes for range queries
  expireIdx: index('sessions_expire_idx').on(table.expire),
}));

/**
 * OAuth 2.0 dynamically-registered clients (Claude.ai web connector, etc).
 * One row per client registered through RFC 7591 dynamic client registration.
 */
export const oauthClients = pgTable('oauth_clients', {
  clientId: text('client_id').primaryKey(),
  clientSecret: text('client_secret'),
  clientIdIssuedAt: integer('client_id_issued_at').notNull(),
  clientSecretExpiresAt: integer('client_secret_expires_at'),
  clientInfo: json('client_info').notNull(),
});

/**
 * OAuth 2.0 authorization flows + issued authorization codes.
 * A row is inserted as `pending` when authorize() begins, then updated to
 * `issued` (with the user/role chosen at consent) when the consent screen is
 * approved. Codes are short-lived and consumed at the token endpoint.
 */
export const oauthAuthCodes = pgTable('oauth_auth_codes', {
  code: text('code').primaryKey(),
  clientId: text('client_id').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  codeChallenge: text('code_challenge').notNull(),
  codeChallengeMethod: text('code_challenge_method').notNull().default('S256'),
  scopes: text('scopes').array().notNull().default(sql`ARRAY[]::text[]`),
  state: text('state'),
  resource: text('resource'),
  status: text('status').notNull().default('pending'),
  userId: text('user_id'),
  role: text('role'),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').notNull().default(false),
}, (table) => ({
  clientIdx: index('oauth_auth_codes_client_idx').on(table.clientId),
  expiresIdx: index('oauth_auth_codes_expires_idx').on(table.expiresAt),
}));

/**
 * OAuth 2.0 issued access and refresh tokens.
 */
export const oauthTokens = pgTable('oauth_tokens', {
  token: text('token').primaryKey(),
  tokenType: text('token_type').notNull(),
  clientId: text('client_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role').notNull(),
  scopes: text('scopes').array().notNull().default(sql`ARRAY[]::text[]`),
  resource: text('resource'),
  expiresAt: timestamp('expires_at').notNull(),
  refreshTokenFor: text('refresh_token_for'),
}, (table) => ({
  clientIdx: index('oauth_tokens_client_idx').on(table.clientId),
  expiresIdx: index('oauth_tokens_expires_idx').on(table.expiresAt),
  typeIdx: index('oauth_tokens_type_idx').on(table.tokenType),
}));

export type OauthClient = typeof oauthClients.$inferSelect;
export type OauthAuthCode = typeof oauthAuthCodes.$inferSelect;
export type OauthToken = typeof oauthTokens.$inferSelect;

// Insert schemas
export const insertSslCertificateSchema = z.object({
  domain: z.string(),
  certificateData: z.string(),
  privateKey: z.string(),
  issuer: z.string(),
  subject: z.string(),
  serialNumber: z.string(),
  fingerprint: z.string(),
  validFrom: z.date(),
  validTo: z.date(),
  status: z.string().default('pending'),
  autoRenew: z.boolean().default(true),
  renewalAttempts: z.number().int().default(0),
  maxRenewalAttempts: z.number().int().default(3),
  dnsProvider: z.string().optional(),
  lastRenewalAttempt: z.date().optional(),
  nextRenewalDate: z.date().optional(),
  createdBy: z.string().uuid(),
});

// Types
// Session table schema (no insert schema needed - managed by connect-pg-simple)
export const insertSessionSchema = z.object({
  sid: z.string(),
  sess: z.any(), // JSON data
  expire: z.date(),
});

// Types
export type InsertSslCertificate = z.infer<typeof insertSslCertificateSchema>;
export type SslCertificate = typeof sslCertificates.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

// Relations - temporarily commented out due to drizzle-orm version compatibility
// export const sslCertificatesRelations = relations(sslCertificates, ({ one }) => ({
//   createdBy: one(users, {
//     fields: [sslCertificates.createdBy],
//     references: [users.id],
//   }),
// }));
