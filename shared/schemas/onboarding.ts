import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  index,
  boolean,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { users } from './core';

export const onboardingStatusEnum = pgEnum('onboarding_status', [
  'not_started',
  'in_progress',
  'completed',
  'skipped',
]);

export const onboardingProgress = pgTable('onboarding_progress', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tourId: text('tour_id').notNull(),
  status: onboardingStatusEnum('status').notNull().default('not_started'),
  currentStep: integer('current_step').notNull().default(0),
  seenVersion: integer('seen_version').notNull().default(0),
  completedAt: timestamp('completed_at'),
  startedAt: timestamp('started_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userTourIdx: index('onboarding_progress_user_tour_idx').on(table.userId, table.tourId),
  userIdx: index('onboarding_progress_user_idx').on(table.userId),
}));

export const onboardingVersions = pgTable('onboarding_versions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tourId: text('tour_id').notNull().unique(),
  version: integer('version').notNull().default(1),
  contentHash: text('content_hash'),
  description: text('description'),
  publishedAt: timestamp('published_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  tourIdIdx: index('onboarding_versions_tour_id_idx').on(table.tourId),
}));

export const onboardingFeatureManifest = pgTable('onboarding_feature_manifest', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  featureId: text('feature_id').notNull().unique(),
  featureName: text('feature_name').notNull(),
  section: text('section'),
  coveredByTour: text('covered_by_tour'),
  coveredByStep: integer('covered_by_step'),
  anchorSelector: text('anchor_selector'),
  isRequired: boolean('is_required').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  featureIdIdx: index('onboarding_feature_manifest_feature_id_idx').on(table.featureId),
}));

export const insertOnboardingProgressSchema = z.object({
  userId: z.string(),
  tourId: z.string(),
  status: z.enum(['not_started', 'in_progress', 'completed', 'skipped']).default('not_started'),
  currentStep: z.number().int().min(0).default(0),
  seenVersion: z.number().int().min(0).default(0),
  completedAt: z.date().nullable().optional(),
  startedAt: z.date().nullable().optional(),
});

export const insertOnboardingVersionSchema = z.object({
  tourId: z.string(),
  version: z.number().int().min(1).default(1),
  contentHash: z.string().optional(),
  description: z.string().optional(),
});

export const insertOnboardingFeatureManifestSchema = z.object({
  featureId: z.string(),
  featureName: z.string(),
  section: z.string().optional(),
  coveredByTour: z.string().optional(),
  coveredByStep: z.number().int().optional(),
  anchorSelector: z.string().optional(),
  isRequired: z.boolean().default(false),
});

export type OnboardingProgress = typeof onboardingProgress.$inferSelect;
export type InsertOnboardingProgress = z.infer<typeof insertOnboardingProgressSchema>;

export type OnboardingVersion = typeof onboardingVersions.$inferSelect;
export type InsertOnboardingVersion = z.infer<typeof insertOnboardingVersionSchema>;

export type OnboardingFeatureManifest = typeof onboardingFeatureManifest.$inferSelect;
export type InsertOnboardingFeatureManifest = z.infer<typeof insertOnboardingFeatureManifestSchema>;
