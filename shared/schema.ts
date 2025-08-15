import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, uuid, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums for improvement suggestions
export const suggestionCategoryEnum = pgEnum('suggestion_category', ['Code Quality', 'Security', 'Testing', 'Documentation', 'Performance']);
export const suggestionPriorityEnum = pgEnum('suggestion_priority', ['Low', 'Medium', 'High', 'Critical']);
export const suggestionStatusEnum = pgEnum('suggestion_status', ['New', 'Acknowledged', 'Done']);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  language: text("language").notNull().default('en'),
  createdAt: timestamp("created_at").defaultNow(),
});

export const developmentPillars = pgTable("development_pillars", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default('pending'), // 'pending', 'in-progress', 'complete'
  order: text("order").notNull(),
  configuration: jsonb("configuration"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const workspaceStatus = pgTable("workspace_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  component: text("component").notNull(),
  status: text("status").notNull().default('pending'), // 'pending', 'in-progress', 'complete'
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const qualityMetrics = pgTable("quality_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metricType: text("metric_type").notNull(),
  value: text("value").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const frameworkConfiguration = pgTable("framework_configuration", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  language: true,
});

export const insertPillarSchema = createInsertSchema(developmentPillars).pick({
  name: true,
  description: true,
  status: true,
  order: true,
  configuration: true,
});

export const insertWorkspaceStatusSchema = createInsertSchema(workspaceStatus).pick({
  component: true,
  status: true,
});

export const insertQualityMetricSchema = createInsertSchema(qualityMetrics).pick({
  metricType: true,
  value: true,
});

export const insertFrameworkConfigSchema = createInsertSchema(frameworkConfiguration).pick({
  key: true,
  value: true,
  description: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertPillar = z.infer<typeof insertPillarSchema>;
export type DevelopmentPillar = typeof developmentPillars.$inferSelect;

export type InsertWorkspaceStatus = z.infer<typeof insertWorkspaceStatusSchema>;
export type WorkspaceStatus = typeof workspaceStatus.$inferSelect;

export type InsertQualityMetric = z.infer<typeof insertQualityMetricSchema>;
export type QualityMetric = typeof qualityMetrics.$inferSelect;

export type InsertFrameworkConfig = z.infer<typeof insertFrameworkConfigSchema>;
export type FrameworkConfiguration = typeof frameworkConfiguration.$inferSelect;

// Improvement Suggestions table
export const improvementSuggestions = pgTable("improvement_suggestions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: suggestionCategoryEnum("category").notNull(),
  priority: suggestionPriorityEnum("priority").notNull(),
  status: suggestionStatusEnum("status").notNull().default('New'),
  filePath: text("file_path"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schema for improvement suggestions
export const insertImprovementSuggestionSchema = createInsertSchema(improvementSuggestions).pick({
  title: true,
  description: true,
  category: true,
  priority: true,
  status: true,
  filePath: true,
});

// Types for improvement suggestions
export type InsertImprovementSuggestion = z.infer<typeof insertImprovementSuggestionSchema>;
export type ImprovementSuggestion = typeof improvementSuggestions.$inferSelect;
