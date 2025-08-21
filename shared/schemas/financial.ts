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
  jsonb,
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

export const oldBillTypeEnum = pgEnum('old_bill_type', [
  'condo_fees',
  'special_assessment',
  'utility',
  'maintenance',
  'other',
]);

export const billCategoryEnum = pgEnum('bill_category', [
  'insurance',
  'maintenance',
  'salary',
  'utilities',
  'cleaning',
  'security',
  'landscaping',
  'professional_services',
  'administration',
  'repairs',
  'supplies',
  'taxes',
  'other',
]);

export const paymentTypeEnum = pgEnum('payment_type', [
  'unique',
  'recurrent',
]);

export const schedulePaymentEnum = pgEnum('schedule_payment', [
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'custom',
]);

export const moneyFlowTypeEnum = pgEnum('money_flow_type', [
  'income',
  'expense',
]);

export const moneyFlowCategoryEnum = pgEnum('money_flow_category', [
  'monthly_fees',
  'special_assessment',
  'late_fees',
  'parking_fees',
  'utility_reimbursement',
  'insurance_claim',
  'bill_payment',
  'maintenance_expense',
  'administrative_expense',
  'professional_services',
  'other_income',
  'other_expense',
]);

// Financial tables
/**
 * Money flow table for tracking all money movements in and out.
 * Includes monthly fees from residences and other financial transactions.
 */
export const moneyFlow = pgTable('money_flow', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  buildingId: uuid('building_id')
    .notNull()
    .references(() => buildings.id),
  residenceId: uuid('residence_id').references(() => residences.id), // Optional, for residence-specific transactions
  billId: uuid('bill_id').references(() => bills.id), // Optional, for bill-related transactions
  type: moneyFlowTypeEnum('type').notNull(), // income or expense
  category: moneyFlowCategoryEnum('category').notNull(),
  description: text('description').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  transactionDate: date('transaction_date').notNull(),
  referenceNumber: text('reference_number'),
  notes: text('notes'),
  isReconciled: boolean('is_reconciled').default(false),
  reconciledDate: date('reconciled_date'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Enhanced bills table for tracking financial obligations with advanced scheduling.
 * Supports unique and recurrent payments with custom scheduling options.
 */
export const bills = pgTable('bills', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  buildingId: uuid('building_id')
    .notNull()
    .references(() => buildings.id),
  billNumber: text('bill_number').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  category: billCategoryEnum('category').notNull(),
  vendor: text('vendor'), // Company or service provider
  paymentType: paymentTypeEnum('payment_type').notNull(), // unique or recurrent
  schedulePayment: schedulePaymentEnum('schedule_payment'), // Only for recurrent payments
  scheduleCustom: date('schedule_custom').array(), // Custom dates for custom schedules
  costs: decimal('costs', { precision: 12, scale: 2 }).array().notNull(), // Array of costs for payment plan
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  startDate: date('start_date').notNull(), // When the bill series starts
  endDate: date('end_date'), // For recurrent bills, when they end (optional for ongoing)
  status: billStatusEnum('status').notNull().default('draft'),
  documentPath: text('document_path'), // Path to uploaded bill document
  documentName: text('document_name'), // Original filename
  isAiAnalyzed: boolean('is_ai_analyzed').default(false),
  aiAnalysisData: jsonb('ai_analysis_data'), // Store AI-extracted data
  notes: text('notes'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Legacy bills table - keeping for backward compatibility.
 * Will be migrated to new bills table structure.
 */
export const oldBills = pgTable('old_bills', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  residenceId: uuid('residence_id')
    .notNull()
    .references(() => residences.id),
  billNumber: text('bill_number').notNull().unique(),
  type: oldBillTypeEnum('type').notNull(),
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
export const insertMoneyFlowSchema = createInsertSchema(moneyFlow).pick({
  buildingId: true,
  residenceId: true,
  billId: true,
  type: true,
  category: true,
  description: true,
  amount: true,
  transactionDate: true,
  referenceNumber: true,
  notes: true,
  createdBy: true,
});

export const insertBillSchema = createInsertSchema(bills).pick({
  buildingId: true,
  billNumber: true,
  title: true,
  description: true,
  category: true,
  vendor: true,
  paymentType: true,
  schedulePayment: true,
  scheduleCustom: true,
  costs: true,
  totalAmount: true,
  startDate: true,
  endDate: true,
  status: true,
  documentPath: true,
  documentName: true,
  isAiAnalyzed: true,
  aiAnalysisData: true,
  notes: true,
  createdBy: true,
});

export const insertOldBillSchema = createInsertSchema(oldBills).pick({
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
/**
 * Money flow insert and select types.
 */
export type InsertMoneyFlow = z.infer<typeof insertMoneyFlowSchema>;
/**
 *
 */
export type MoneyFlow = typeof moneyFlow.$inferSelect;

/**
 * Bills insert and select types.
 */
export type InsertBill = z.infer<typeof insertBillSchema>;
/**
 *
 */
export type Bill = typeof bills.$inferSelect;

/**
 * Legacy bills types for backward compatibility.
 */
export type InsertOldBill = z.infer<typeof insertOldBillSchema>;
/**
 *
 */
export type OldBill = typeof oldBills.$inferSelect;

/**
 * Budget insert and select types.
 */
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
/**
 *
 */
export type Budget = typeof budgets.$inferSelect;

// Relations
export const moneyFlowRelations = relations(moneyFlow, ({ one }) => ({
  building: one(buildings, {
    fields: [moneyFlow.buildingId],
    references: [buildings.id],
  }),
  residence: one(residences, {
    fields: [moneyFlow.residenceId],
    references: [residences.id],
  }),
  bill: one(bills, {
    fields: [moneyFlow.billId],
    references: [bills.id],
  }),
  createdBy: one(users, {
    fields: [moneyFlow.createdBy],
    references: [users.id],
  }),
}));

export const billsRelations = relations(bills, ({ one, many }) => ({
  building: one(buildings, {
    fields: [bills.buildingId],
    references: [buildings.id],
  }),
  createdBy: one(users, {
    fields: [bills.createdBy],
    references: [users.id],
  }),
  moneyFlows: many(moneyFlow),
}));

export const oldBillsRelations = relations(oldBills, ({ one }) => ({
  residence: one(residences, {
    fields: [oldBills.residenceId],
    references: [residences.id],
  }),
  createdBy: one(users, {
    fields: [oldBills.createdBy],
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