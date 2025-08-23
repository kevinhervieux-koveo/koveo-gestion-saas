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
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';
import { users, organizations } from './core';

// Property enums
export const buildingTypeEnum = pgEnum('building_type', [
  'apartment',
  'condo',
  'rental',
]);

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

// Property tables
/**
 * Buildings table storing properties managed by organizations.
 * Each building represents a distinct property managed by an organization.
 */
export const buildings = pgTable('buildings', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id')
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
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  buildingId: uuid('building_id')
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
  ownershipPercentage: decimal('ownership_percentage', { precision: 5, scale: 4 }), // For condos
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

// Insert schemas
export const insertBuildingSchema = createInsertSchema(buildings).pick({
  organizationId: true,
  name: true,
  address: true,
  city: true,
  province: true,
  postalCode: true,
  buildingType: true,
  yearBuilt: true,
  totalUnits: true,
  totalFloors: true,
  parkingSpaces: true,
  storageSpaces: true,
  amenities: true,
  managementCompany: true,
  bankAccountNumber: true,
  bankAccountNotes: true,
  bankAccountStartDate: true,
  bankAccountStartAmount: true,
  bankAccountMinimums: true,
});

export const insertResidenceSchema = createInsertSchema(residences).pick({
  buildingId: true,
  unitNumber: true,
  floor: true,
  squareFootage: true,
  bedrooms: true,
  bathrooms: true,
  balcony: true,
  parkingSpaceNumbers: true,
  storageSpaceNumbers: true,
  ownershipPercentage: true,
  monthlyFees: true,
});

export const insertUserResidenceSchema = createInsertSchema(userResidences).pick({
  userId: true,
  residenceId: true,
  relationshipType: true,
  startDate: true,
  endDate: true,
});

export const insertContactSchema = createInsertSchema(contacts).pick({
  name: true,
  email: true,
  phone: true,
  entity: true,
  entityId: true,
  contactCategory: true,
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

// Relations
export const buildingsRelations = relations(buildings, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [buildings.organizationId],
    references: [organizations.id],
  }),
  residences: many(residences),
}));

export const residencesRelations = relations(residences, ({ one, many }) => ({
  building: one(buildings, {
    fields: [residences.buildingId],
    references: [buildings.id],
  }),
  userResidences: many(userResidences),
}));

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

