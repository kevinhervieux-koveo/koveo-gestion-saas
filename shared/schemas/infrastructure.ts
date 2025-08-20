import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
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
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Insert schemas
export const insertSslCertificateSchema = createInsertSchema(sslCertificates).pick({
  domain: true,
  certificateData: true,
  privateKey: true,
  issuer: true,
  subject: true,
  serialNumber: true,
  fingerprint: true,
  validFrom: true,
  validTo: true,
  status: true,
  autoRenew: true,
  renewalAttempts: true,
  maxRenewalAttempts: true,
  dnsProvider: true,
  lastRenewalAttempt: true,
  nextRenewalDate: true,
  createdBy: true,
});

// Types
export type InsertSslCertificate = z.infer<typeof insertSslCertificateSchema>;
export type SslCertificate = typeof sslCertificates.$inferSelect;

// Relations
export const sslCertificatesRelations = relations(sslCertificates, ({ one }) => ({
  createdBy: one(users, {
    fields: [sslCertificates.createdBy],
    references: [users.id],
  }),
}));