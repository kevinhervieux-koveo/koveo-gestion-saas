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
  index,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { relations } from 'drizzle-orm';
import { users, organizations } from './core';

/**
 * Building type enum.
 * NOTE: 'apartment' and 'appartement' are duplicates (English/French).
 * Both must be kept for backward compatibility with existing database records.
 * New code should use 'apartment' only; 'appartement' is treated as an alias.
 */
export const buildingTypeEnum = pgEnum('building_type', ['apartment', 'appartement', 'condo', 'rental']);

export const contactEntityEnum = pgEnum('contact_entity', [
  'organization',
  'building',
  'residence',
]);

export const contactCategoryEnum = pgEnum('contact_category', [
  'emergency',
  'maintenance',
  'manager',
  'resident',
  'tenant',
  'other',
]);

export const bookingStatusEnum = pgEnum('booking_status', ['confirmed', 'cancelled']);

// Property tables
/**
 * Buildings table storing properties managed by organizations.
 * Each building represents a distinct property managed by an organization.
 */
export const buildings = pgTable('buildings', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  address: text('address').notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  province: varchar('province', { length: 3 }).notNull().default('QC'),
  postalCode: varchar('postal_code', { length: 10 }).notNull(),
  buildingType: buildingTypeEnum('building_type').notNull(),
  constructionDate: date('construction_date'),
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
  unplannedBillsAmount: decimal('unplanned_bills_amount', { precision: 10, scale: 2 }).default('0'), // Monthly unplanned bills budget
  unplannedBillsStartDate: date('unplanned_bills_start_date'), // Date when unplanned bills budgeting should start
  inflationSettings: text('inflation_settings'), // JSON string of inflation configuration by category
  financialYearStart: date('financial_year_start').notNull().default('2026-01-01'), // Financial year start date (when inflation is applied)
  generalInflationRate: decimal('general_inflation_rate', { precision: 5, scale: 2 }).notNull().default('2.0'),
  revenueInflationRate: decimal('revenue_inflation_rate', { precision: 5, scale: 2 }).notNull().default('2.0'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  organizationIdIdx: index('buildings_organization_id_idx').on(table.organizationId),
  buildingTypeIdx: index('buildings_building_type_idx').on(table.buildingType),
  // Date indexes for range queries
  constructionDateIdx: index('buildings_construction_date_idx').on(table.constructionDate),
  bankAccountUpdatedAtIdx: index('buildings_bank_account_updated_at_idx').on(table.bankAccountUpdatedAt),
  bankAccountStartDateIdx: index('buildings_bank_account_start_date_idx').on(table.bankAccountStartDate),
  unplannedBillsStartDateIdx: index('buildings_unplanned_bills_start_date_idx').on(table.unplannedBillsStartDate),
  financialYearStartIdx: index('buildings_financial_year_start_idx').on(table.financialYearStart),
  createdAtIdx: index('buildings_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('buildings_updated_at_idx').on(table.updatedAt),
}));

/**
 * Residences table storing individual housing units within buildings.
 * Represents apartments, condos, or units that can be occupied by tenants.
 *
 * Cross-organisation invariant (residence side)
 * ---------------------------------------------
 * Residences are linked to buildings via `building_id`. Demand rows
 * reference both a residence and a building, and those two columns
 * must agree (see the `demands` table comment in
 * `shared/schemas/operations.ts`). To prevent the residence side from
 * silently breaking that invariant, the BEFORE UPDATE trigger
 * `residences_demand_building_check` (see
 * `migrations/0011_residences_demand_building_check.sql`) rejects any
 * UPDATE that changes `building_id` while at least one demand row
 * still references the residence with a different `building_id`.
 * Drizzle does not model that trigger, so `drizzle-kit push` will not
 * drop or alter it.
 */
export const residences = pgTable('residences', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  buildingId: varchar('building_id')
    .notNull()
    .references(() => buildings.id, { onDelete: 'cascade' }),
  unitNumber: varchar('unit_number', { length: 20 }).notNull(),
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
}, (table) => ({
  buildingIdIdx: index('residences_building_id_idx').on(table.buildingId),
  // Composite index for optimized join conditions
  buildingIdActiveIdx: index('residences_building_id_active_idx').on(table.buildingId, table.isActive),
  // Date indexes for range queries
  createdAtIdx: index('residences_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('residences_updated_at_idx').on(table.updatedAt),
}));

/**
 * User-Residence relationship table to track user assignments to residences.
 * Supports owner, tenant, and occupant relationships with date ranges.
 *
 * ## Field semantics (Task #144 — single source of truth for "is this tenancy current?")
 *
 * - `isActive` is the **canonical** flag for "this user-residence link
 *   represents a currently effective tenancy/ownership/occupancy". All
 *   read paths across the codebase (REST, MCP, scope queries, ACL,
 *   storage) MUST filter on `isActive = true` when they need to limit
 *   results to current residents. There are no exceptions: the MCP
 *   tenant tools (`list_residences`, `get_residence`, `create_demand`,
 *   `create_maintenance_request`, etc.) all apply the strict rule, as
 *   do REST/scope/ACL/storage reads.
 *
 * - `endDate` is **informational only** — it records when a residency
 *   ended (or is scheduled to end) for display, audit, and reporting. It
 *   MUST NOT be used as a filter to determine whether a tenancy is
 *   current. When a write path ends a residency, it SHOULD set BOTH
 *   `isActive = false` AND `endDate = <today>` so the two fields stay
 *   aligned, but only `isActive` is consulted by reads.
 *
 * - `startDate` is similarly informational and recorded for history.
 *
 * ## Write contract for ending a residency
 *
 * Any code path that ends a user-residence link (move-out, deactivation,
 * cascade delete, organization deactivation, orphan cleanup, etc.) MUST
 * either:
 *   1. Hard-delete the row (acceptable — `onDelete: 'cascade'` from
 *      users/residences is wired up), OR
 *   2. Soft-delete by setting `isActive = false` and `endDate = today`
 *      (and bump `updatedAt`).
 * It MUST NOT set only `endDate` without flipping `isActive`, because
 * read paths do not consult `endDate`.
 */
export const userResidences = pgTable('user_residences', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  residenceId: varchar('residence_id')
    .notNull()
    .references(() => residences.id, { onDelete: 'cascade' }),
  relationshipType: text('relationship_type').notNull(), // 'owner', 'tenant', 'occupant'
  startDate: date('start_date').notNull(),
  /**
   * Informational end date (see table-level docstring). Reads MUST NOT
   * use this column to determine whether a tenancy is current — they
   * use `isActive`. Writes that end a residency SHOULD set this to the
   * effective end date alongside `isActive = false`.
   */
  endDate: date('end_date'),
  /**
   * Canonical "is this tenancy currently effective?" flag. Reads MUST
   * filter on this when they need only current residents. Writes that
   * end a residency MUST set this to false (or hard-delete the row).
   */
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('user_residences_user_id_idx').on(table.userId),
  residenceIdIdx: index('user_residences_residence_id_idx').on(table.residenceId),
  // Composite indexes for optimized join conditions
  userIdActiveIdx: index('user_residences_user_id_active_idx').on(table.userId, table.isActive),
  residenceIdActiveIdx: index('user_residences_residence_id_active_idx').on(table.residenceId, table.isActive),
  // Date indexes for range queries
  startDateIdx: index('user_residences_start_date_idx').on(table.startDate),
  endDateIdx: index('user_residences_end_date_idx').on(table.endDate),
  createdAtIdx: index('user_residences_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('user_residences_updated_at_idx').on(table.updatedAt),
}));

/**
 * User-Building relationship table to track direct user assignments to buildings.
 * Stores building-level assignments separately from residence-level assignments.
 * This prevents building assignments from being deleted when residences are assigned.
 */
export const userBuildings = pgTable('user_buildings', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  buildingId: varchar('building_id')
    .notNull()
    .references(() => buildings.id, { onDelete: 'cascade' }),
  relationshipType: text('relationship_type').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('user_buildings_user_id_idx').on(table.userId),
  buildingIdIdx: index('user_buildings_building_id_idx').on(table.buildingId),
  userIdActiveIdx: index('user_buildings_user_id_active_idx').on(table.userId, table.isActive),
  buildingIdActiveIdx: index('user_buildings_building_id_active_idx').on(table.buildingId, table.isActive),
  createdAtIdx: index('user_buildings_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('user_buildings_updated_at_idx').on(table.updatedAt),
}));

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
  entityId: varchar('entity_id').notNull(),
  contactCategory: contactCategoryEnum('contact_category').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  entityIdIdx: index('contacts_entity_id_idx').on(table.entityId),
  entityIdx: index('contacts_entity_idx').on(table.entity),
  contactCategoryIdx: index('contacts_contact_category_idx').on(table.contactCategory),
  // Date indexes for range queries
  createdAtIdx: index('contacts_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('contacts_updated_at_idx').on(table.updatedAt),
}));

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
  openingHours: jsonb('opening_hours'), // Enhanced structure with isOpen, breaks
  availableDays: jsonb('available_days'), // Array of available days: ['monday', 'tuesday', etc.]
  unavailablePeriods: jsonb('unavailable_periods'), // Specific periods when space is unavailable
  bookingRules: text('booking_rules'),
  defaultTimeLimitType: varchar('default_time_limit_type', { length: 20 }), // 'monthly' or 'yearly' - default limit for all users
  defaultTimeLimitHours: integer('default_time_limit_hours'), // Default hours allowed per period
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  buildingIdIdx: index('common_spaces_building_id_idx').on(table.buildingId),
  contactPersonIdIdx: index('common_spaces_contact_person_id_idx').on(table.contactPersonId),
  // Date indexes for range queries
  createdAtIdx: index('common_spaces_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('common_spaces_updated_at_idx').on(table.updatedAt),
}));

/**
 * Bookings table for common space reservations.
 * Tracks user reservations for common spaces with time slots and status.
 */
export const bookings = pgTable('bookings', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  commonSpaceId: varchar('common_space_id')
    .notNull()
    .references(() => commonSpaces.id, { onDelete: 'cascade' }),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  status: bookingStatusEnum('status').notNull().default('confirmed'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  commonSpaceIdIdx: index('bookings_common_space_id_idx').on(table.commonSpaceId),
  userIdIdx: index('bookings_user_id_idx').on(table.userId),
  statusIdx: index('bookings_status_idx').on(table.status),
  // Date indexes for range queries
  startTimeIdx: index('bookings_start_time_idx').on(table.startTime),
  endTimeIdx: index('bookings_end_time_idx').on(table.endTime),
  createdAtIdx: index('bookings_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('bookings_updated_at_idx').on(table.updatedAt),
}));

/**
 * User booking restrictions table to manage blocked users.
 * Allows administrators to block specific users from booking certain common spaces.
 */
export const userBookingRestrictions = pgTable('user_booking_restrictions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  commonSpaceId: varchar('common_space_id')
    .notNull()
    .references(() => commonSpaces.id, { onDelete: 'cascade' }),
  isBlocked: boolean('is_blocked').notNull().default(true),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('user_booking_restrictions_user_id_idx').on(table.userId),
  commonSpaceIdIdx: index('user_booking_restrictions_common_space_id_idx').on(table.commonSpaceId),
  // Date indexes for range queries
  createdAtIdx: index('user_booking_restrictions_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('user_booking_restrictions_updated_at_idx').on(table.updatedAt),
}));

/**
 * User time limits table to manage booking time quotas.
 * Allows setting monthly/yearly limits on how much time users can reserve.
 */
export const userTimeLimits = pgTable('user_time_limits', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  commonSpaceId: varchar('common_space_id').references(() => commonSpaces.id, { onDelete: 'cascade' }), // null means applies to all spaces
  limitType: varchar('limit_type', { length: 20 }).notNull(), // 'monthly' or 'yearly'
  limitHours: integer('limit_hours').notNull(), // Maximum hours allowed
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('user_time_limits_user_id_idx').on(table.userId),
  commonSpaceIdIdx: index('user_time_limits_common_space_id_idx').on(table.commonSpaceId),
  // Date indexes for range queries
  createdAtIdx: index('user_time_limits_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('user_time_limits_updated_at_idx').on(table.updatedAt),
}));

// Insert schemas
//
// Numeric guards (Task #1342): the same `.min(1)` / `.min(0)` / `.positive()`
// constraints that `server/mcp/server.ts` enforces on `create_building` /
// `update_building` / `create_residence` / `update_residence` MUST be mirrored
// here so that REST API and form callers reject impossible values (negative
// unit counts, zero square footage, etc.) before the row reaches the
// database.
export const insertBuildingSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  address: z.string(),
  city: z.string(),
  province: z.string().default('QC'),
  postalCode: z.string(),
  buildingType: z.string(),
  yearBuilt: z.number().int().optional(),
  totalUnits: z.number().int().min(1, 'Total units must be at least 1').optional(),
  totalFloors: z.number().int().min(1, 'Total floors must be at least 1').optional(),
  parkingSpaces: z.number().int().min(0, 'Parking spaces must not be negative').optional(),
  storageSpaces: z.number().int().min(0, 'Storage spaces must not be negative').optional(),
  amenities: z.array(z.string()).optional(),
  managementCompany: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountNotes: z.string().optional(),
  bankAccountStartDate: z.date().optional(),
  bankAccountStartAmount: z.number().optional(),
  bankAccountMinimums: z.record(z.string(), z.number()).optional(),
  unplannedBillsAmount: z.number().optional(),
});

export const insertResidenceSchema = z.object({
  buildingId: z.string().uuid(),
  unitNumber: z.string(),
  floor: z.number().int().optional(),
  squareFootage: z.number().positive('Square footage must be positive').optional(),
  bedrooms: z.number().int().min(0, 'Bedrooms must not be negative').optional(),
  bathrooms: z.number().min(0, 'Bathrooms must not be negative').optional(),
  balcony: z.boolean().optional(),
  parkingSpaceNumbers: z.array(z.string()).optional(),
  storageSpaceNumbers: z.array(z.string()).optional(),
  ownershipPercentage: z.number().min(0).max(100).optional(),
  monthlyFees: z.number().min(0, 'Monthly fees must not be negative').optional(),
});

export const insertUserResidenceSchema = z.object({
  userId: z.string().uuid(),
  residenceId: z.string().uuid(),
  relationshipType: z.string(),
  startDate: z.date(),
  endDate: z.date().optional(),
});

export const insertUserBuildingSchema = z.object({
  userId: z.string().uuid(),
  buildingId: z.string().uuid(),
  relationshipType: z.string(),
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
        day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
        open: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format'),
        close: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format'),
        isOpen: z.boolean().default(true), // Whether the space is open on this day
        breaks: z.array(
          z.object({
            start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format'),
            end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format'),
            reason: z.string().optional(), // e.g., "Cleaning", "Maintenance"
          })
        ).optional(), // Optional breaks within opening hours (like lunch breaks)
      })
    )
    .optional(),
  availableDays: z
    .array(
      z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    )
    .optional(),
  unavailablePeriods: z.array(
    z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      reason: z.string().optional(), // e.g., "Renovation", "Maintenance", "Holiday closure"
      recurrence: z.enum(['none', 'weekly', 'monthly', 'yearly']).default('none'),
    })
  ).optional(), // Specific periods when space is unavailable
  bookingRules: z.string().optional(),
  defaultTimeLimitType: z.enum(['monthly', 'yearly']).optional(),
  defaultTimeLimitHours: z.number().int().positive().optional(),
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
export type InsertUserBuilding = z.infer<typeof insertUserBuildingSchema>;
/**
 *
 */
export type UserBuilding = typeof userBuildings.$inferSelect;

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

/**
 * Response row shape for the GET /api/user/residences endpoint.
 * Used by the ProfileResidences widget on the settings page.
 */
export const userResidenceProfileRowSchema = z.object({
  id: z.string(),
  residenceId: z.string(),
  relationshipType: z.string(),
  startDate: z.string(),
  unitNumber: z.string(),
  buildingName: z.string(),
  organizationName: z.string(),
});

export type UserResidenceProfileRow = z.infer<typeof userResidenceProfileRowSchema>;

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
