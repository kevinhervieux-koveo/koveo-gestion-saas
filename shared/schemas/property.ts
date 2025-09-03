import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uuid,
  pgEnum,
  boolean,
  integer,
  decimal,
  numeric,
  date,
  varchar,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';
import { users, organizations } from './core';

// Property enums
export const buildingTypeEnum = pgEnum('building_type', ['apartment', 'condo', 'rental']);

export const contactEntityEnum = pgEnum('contact_entity', [
  'organization',
  'building',
  'residence',
]);

export const contactCategoryEnum = pgEnum('contact_category', [
  'resident',
  'manager',
  'tenant',
  'maintenance',
  'emergency',
  'other',
]);

export const bookingStatusEnum = pgEnum('booking_status', ['confirmed', 'cancelled']);

// Property tables
/**
 * Buildings table storing properties managed by organizations.
 * Each building represents a distinct property managed by an organization.
 */
export const buildings = pgTable('buildings', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: varchar('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address').notNull(),
  city: text('city').notNull(),
  province: text('province').notNull().default('QC'),
  postalCode: text('postal_code').notNull(),
  buildingType: buildingTypeEnum('building_type').notNull(),
  yearBuilt: integer('year_built'),
  totalUnits: integer('total_units').notNull(),
  totalFloors: integer('total_floors'),
  parkingSpaces: integer('parking_spaces'),
  storageSpaces: integer('storage_spaces'),
  amenities: jsonb('amenities'), // Array of amenities
  managementCompany: text('management_company'),
  bankAccountNumber: text('bank_account_number'),
  bankAccountNotes: text('bank_account_notes'), // For reconciliation notes when updating account number
  bankAccountUpdatedAt: timestamp('bank_account_updated_at'),
  bankAccountStartDate: timestamp('bank_account_start_date'), // Date when account started tracking
  bankAccountStartAmount: numeric('bank_account_start_amount', { precision: 10, scale: 2 }), // Starting balance
  bankAccountMinimums: text('bank_account_minimums'), // JSON string of minimum balance settings
  inflationSettings: text('inflation_settings'), // JSON string of inflation configuration by category
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Residences table storing individual housing units within buildings.
 * Represents apartments, condos, or units that can be occupied by tenants.
 */
export const residences = pgTable('residences', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  buildingId: varchar('building_id')
    .notNull()
    .references(() => buildings.id, { onDelete: 'cascade' }),
  unitNumber: text('unit_number').notNull(),
  floor: integer('floor'),
  squareFootage: decimal('square_footage', { precision: 8, scale: 2 }),
  bedrooms: integer('bedrooms'),
  bathrooms: decimal('bathrooms', { precision: 3, scale: 1 }),
  balcony: boolean('balcony').default(false),
  parkingSpaceNumbers: text('parking_space_numbers').array(),
  storageSpaceNumbers: text('storage_space_numbers').array(),
  ownershipPercentage: decimal('ownership_percentage', { precision: 5, scale: 2 }), // For condos, 0-100 scale
  monthlyFees: decimal('monthly_fees', { precision: 10, scale: 2 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * User-Residence relationship table to track user assignments to residences.
 * Supports owner, tenant, and occupant relationships with date ranges.
 */
export const userResidences = pgTable('user_residences', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  residenceId: uuid('residence_id')
    .notNull()
    .references(() => residences.id, { onDelete: 'cascade' }),
  relationshipType: text('relationship_type').notNull(), // 'owner', 'tenant', 'occupant'
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Contacts table storing contact information for organizations, buildings, and residences.
 * Allows tracking various types of contacts like residents, managers, tenants, maintenance, etc.
 */
export const contacts = pgTable('contacts', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  entity: contactEntityEnum('entity').notNull(),
  entityId: uuid('entity_id').notNull(),
  contactCategory: contactCategoryEnum('contact_category').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Common spaces table storing shared facilities within buildings.
 * Represents spaces like gyms, lounges, meeting rooms that can be reserved by residents.
 */
export const commonSpaces = pgTable('common_spaces', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  buildingId: varchar('building_id')
    .notNull()
    .references(() => buildings.id, { onDelete: 'cascade' }),
  isReservable: boolean('is_reservable').notNull().default(false),
  capacity: integer('capacity'),
  contactPersonId: varchar('contact_person_id').references(() => users.id, { onDelete: 'set null' }),
  openingHours: jsonb('opening_hours'),
  bookingRules: text('booking_rules'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Bookings table for common space reservations.
 * Tracks user reservations for common spaces with time slots and status.
 */
export const bookings = pgTable('bookings', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  commonSpaceId: uuid('common_space_id')
    .notNull()
    .references(() => commonSpaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  status: bookingStatusEnum('status').notNull().default('confirmed'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * User booking restrictions table to manage blocked users.
 * Allows administrators to block specific users from booking certain common spaces.
 */
export const userBookingRestrictions = pgTable('user_booking_restrictions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  commonSpaceId: uuid('common_space_id')
    .notNull()
    .references(() => commonSpaces.id, { onDelete: 'cascade' }),
  isBlocked: boolean('is_blocked').notNull().default(true),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * User time limits table to manage booking time quotas.
 * Allows setting monthly/yearly limits on how much time users can reserve.
 */
export const userTimeLimits = pgTable('user_time_limits', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  commonSpaceId: uuid('common_space_id').references(() => commonSpaces.id, { onDelete: 'cascade' }), // null means applies to all spaces
  limitType: varchar('limit_type', { length: 20 }).notNull(), // 'monthly' or 'yearly'
  limitHours: integer('limit_hours').notNull(), // Maximum hours allowed
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Insert schemas
export const insertBuildingSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  address: z.string(),
  city: z.string(),
  province: z.string().default('QC'),
  postalCode: z.string(),
  buildingType: z.string(),
  yearBuilt: z.number().int().optional(),
  totalUnits: z.number().int().optional(),
  totalFloors: z.number().int().optional(),
  parkingSpaces: z.number().int().optional(),
  storageSpaces: z.number().int().optional(),
  amenities: z.array(z.string()).optional(),
  managementCompany: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountNotes: z.string().optional(),
  bankAccountStartDate: z.date().optional(),
  bankAccountStartAmount: z.number().optional(),
  bankAccountMinimums: z.record(z.string(), z.number()).optional(),
});

export const insertResidenceSchema = z.object({
  buildingId: z.string().uuid(),
  unitNumber: z.string(),
  floor: z.number().int().optional(),
  squareFootage: z.number().optional(),
  bedrooms: z.number().int().optional(),
  bathrooms: z.number().optional(),
  balcony: z.boolean().optional(),
  parkingSpaceNumbers: z.array(z.string()).optional(),
  storageSpaceNumbers: z.array(z.string()).optional(),
  ownershipPercentage: z.number().optional(),
  monthlyFees: z.number().optional(),
});

export const insertUserResidenceSchema = z.object({
  userId: z.string().uuid(),
  residenceId: z.string().uuid(),
  relationshipType: z.string(),
  startDate: z.date(),
  endDate: z.date().optional(),
});

export const insertContactSchema = z.object({
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  entity: z.string(),
  entityId: z.string().uuid(),
  contactCategory: z.string(),
});

export const insertCommonSpaceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  buildingId: z.string().uuid(),
  isReservable: z.boolean().default(false),
  capacity: z.number().int().optional(),
  contactPersonId: z.string().uuid().optional(),
  openingHours: z
    .array(
      z.object({
        day: z.string(),
        open: z.string(),
        close: z.string(),
      })
    )
    .optional(),
  bookingRules: z.string().optional(),
});

export const insertBookingSchema = z.object({
  commonSpaceId: z.string().uuid(),
  userId: z.string().uuid(),
  startTime: z.date(),
  endTime: z.date(),
  status: z.enum(['confirmed', 'cancelled']).default('confirmed'),
});

export const insertUserBookingRestrictionSchema = z.object({
  userId: z.string().uuid(),
  commonSpaceId: z.string().uuid(),
  isBlocked: z.boolean().default(true),
  reason: z.string().optional(),
});

// Types
/**
 *
 */
export type InsertBuilding = z.infer<typeof insertBuildingSchema>;
/**
 *
 */
export type Building = typeof buildings.$inferSelect;

/**
 *
 */
export type InsertResidence = z.infer<typeof insertResidenceSchema>;
/**
 *
 */
export type Residence = typeof residences.$inferSelect;

/**
 *
 */
export type InsertUserResidence = z.infer<typeof insertUserResidenceSchema>;
/**
 *
 */
export type UserResidence = typeof userResidences.$inferSelect;

/**
 *
 */
export type InsertContact = z.infer<typeof insertContactSchema>;
/**
 *
 */
export type Contact = typeof contacts.$inferSelect;

/**
 *
 */
export type InsertCommonSpace = z.infer<typeof insertCommonSpaceSchema>;
/**
 *
 */
export type CommonSpace = typeof commonSpaces.$inferSelect;

/**
 *
 */
export type InsertBooking = z.infer<typeof insertBookingSchema>;
/**
 *
 */
export type Booking = typeof bookings.$inferSelect;

export const insertUserTimeLimitSchema = z.object({
  userId: z.string().uuid(),
  commonSpaceId: z.string().uuid().optional(), // null means applies to all spaces
  limitType: z.enum(['monthly', 'yearly']),
  limitHours: z.number().int().min(1).max(8760), // Max 1 year worth of hours
});

/**
 *
 */
export type InsertUserBookingRestriction = z.infer<typeof insertUserBookingRestrictionSchema>;
/**
 *
 */
export type UserBookingRestriction = typeof userBookingRestrictions.$inferSelect;

/**
 *
 */
export type InsertUserTimeLimit = z.infer<typeof insertUserTimeLimitSchema>;
/**
 *
 */
export type UserTimeLimit = typeof userTimeLimits.$inferSelect;

// Relations - Temporarily commented out due to drizzle-orm version compatibility
/*
export const buildingsRelations = relations(buildings, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [buildings.organizationId],
    references: [organizations.id],
  }),
  residences: many(residences),
}));
*/

/*
export const residencesRelations = relations(residences, ({ one, many }) => ({
  building: one(buildings, {
    fields: [residences.buildingId],
    references: [buildings.id],
  }),
  userResidences: many(userResidences),
}));
*/

/*
export const userResidencesRelations = relations(userResidences, ({ one }) => ({
  user: one(users, {
    fields: [userResidences.userId],
    references: [users.id],
  }),
  residence: one(residences, {
    fields: [userResidences.residenceId],
    references: [residences.id],
  }),
}));
*/
