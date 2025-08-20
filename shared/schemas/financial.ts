import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  boolean,
  integer,
  decimal,
  date,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';
import { users } from './core';
import { residences, buildings } from './property';

// Financial enums
export const billStatusEnum = pgEnum('bill_status', [
  'draft',
  'sent',
  'overdue',
  'paid',
  'cancelled',
]);

export const billTypeEnum = pgEnum('bill_type', [
  'condo_fees',
  'special_assessment',
  'utility',
  'maintenance',
  'other',
]);

// Financial tables
/**
 * Bills table for tracking financial obligations of residences.
 * Supports various bill types including condo fees, utilities, and assessments.
 */
export const bills = pgTable('bills', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  residenceId: uuid('residence_id')
    .notNull()
    .references(() => residences.id),
  billNumber: text('bill_number').notNull().unique(),
  type: billTypeEnum('type').notNull(),
  description: text('description').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  dueDate: date('due_date').notNull(),
  issueDate: date('issue_date').notNull(),
  status: billStatusEnum('status').notNull().default('draft'),
  notes: text('notes'),
  lateFeeAmount: decimal('late_fee_amount', { precision: 10, scale: 2 }),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }),
  finalAmount: decimal('final_amount', { precision: 12, scale: 2 }).notNull(),
  paymentReceivedDate: date('payment_received_date'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Budgets table for tracking financial planning by building and category.
 * Supports operational, reserve, and special project budgets.
 */
export const budgets = pgTable('budgets', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  buildingId: uuid('building_id')
    .notNull()
    .references(() => buildings.id),
  year: integer('year').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull(), // 'operational', 'reserve', 'special_project'
  budgetedAmount: decimal('budgeted_amount', { precision: 12, scale: 2 }).notNull(),
  actualAmount: decimal('actual_amount', { precision: 12, scale: 2 }).default('0'),
  variance: decimal('variance', { precision: 12, scale: 2 }).default('0'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedDate: date('approved_date'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Insert schemas
export const insertBillSchema = createInsertSchema(bills).pick({
  residenceId: true,
  billNumber: true,
  type: true,
  description: true,
  amount: true,
  dueDate: true,
  issueDate: true,
  status: true,
  notes: true,
  lateFeeAmount: true,
  discountAmount: true,
  finalAmount: true,
  paymentReceivedDate: true,
  createdBy: true,
});

export const insertBudgetSchema = createInsertSchema(budgets).pick({
  buildingId: true,
  year: true,
  name: true,
  description: true,
  category: true,
  budgetedAmount: true,
  actualAmount: true,
  createdBy: true,
});

// Types
export type InsertBill = z.infer<typeof insertBillSchema>;
export type Bill = typeof bills.$inferSelect;

export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgets.$inferSelect;

// Relations
export const billsRelations = relations(bills, ({ one }) => ({
  residence: one(residences, {
    fields: [bills.residenceId],
    references: [residences.id],
  }),
  createdBy: one(users, {
    fields: [bills.createdBy],
    references: [users.id],
  }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  building: one(buildings, {
    fields: [budgets.buildingId],
    references: [buildings.id],
  }),
  createdBy: one(users, {
    fields: [budgets.createdBy],
    references: [users.id],
  }),
  approvedBy: one(users, {
    fields: [budgets.approvedBy],
    references: [users.id],
  }),
}));