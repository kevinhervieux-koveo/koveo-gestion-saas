import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  varchar,
  decimal,
  date,
  jsonb,
  boolean,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { users } from './core';
import { buildings, residences } from './property';
import { documents } from './documents';

// Invoice-specific enums following exact requirements
export const invoicePaymentTypeEnum = pgEnum('invoice_payment_type', [
  'one-time',
  'recurring'
]);

export const invoiceFrequencyEnum = pgEnum('invoice_frequency', [
  'monthly',
  'quarterly', 
  'annually',
  'custom'
]);

/**
 * Invoices table for AI-powered invoice management.
 * Integrates with document management system and supports recurring payments
 * with standard frequencies (monthly, quarterly, annually) and custom scheduling.
 */
export const invoices = pgTable('invoices', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  // Core invoice fields as specified in requirements
  vendorName: text('vendor_name').notNull(),
  invoiceNumber: text('invoice_number').notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  dueDate: date('due_date').notNull(),
  
  // Payment structure fields
  paymentType: invoicePaymentTypeEnum('payment_type').notNull(),
  
  // Recurring payment fields (conditional based on paymentType)
  frequency: invoiceFrequencyEnum('frequency'), // Only for recurring payments
  startDate: date('start_date'), // For standard frequencies (not custom)
  customPaymentDates: date('custom_payment_dates').array(), // Only for custom frequency
  
  // Document integration - links to uploaded invoice file (optional for testing)
  documentId: varchar('document_id')
    .references(() => documents.id),
  
  // AI extraction tracking
  isAiExtracted: boolean('is_ai_extracted').default(false).notNull(),
  aiExtractionData: jsonb('ai_extraction_data'), // Raw AI response for debugging
  extractionConfidence: decimal('extraction_confidence', { precision: 5, scale: 4 }), // AI confidence score
  
  // Building/residence association
  buildingId: varchar('building_id').references(() => buildings.id),
  residenceId: varchar('residence_id').references(() => residences.id),
  
  // Audit fields
  createdBy: varchar('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  documentIdIdx: index('invoices_document_id_idx').on(table.documentId),
  buildingIdIdx: index('invoices_building_id_idx').on(table.buildingId),
  residenceIdIdx: index('invoices_residence_id_idx').on(table.residenceId),
  createdByIdx: index('invoices_created_by_idx').on(table.createdBy),
  paymentTypeIdx: index('invoices_payment_type_idx').on(table.paymentType),
  frequencyIdx: index('invoices_frequency_idx').on(table.frequency),
  // Date indexes for range queries
  dueDateIdx: index('invoices_due_date_idx').on(table.dueDate),
  startDateIdx: index('invoices_start_date_idx').on(table.startDate),
  createdAtIdx: index('invoices_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('invoices_updated_at_idx').on(table.updatedAt),
}));

// Zod validation schemas with conditional logic for recurring payments
export const insertInvoiceSchema = z.object({
  // Core field validations
  vendorName: z.string().min(1, 'Vendor name is required').max(255, 'Vendor name too long'),
  invoiceNumber: z.string().min(1, 'Invoice number is required').max(100, 'Invoice number too long'),
  totalAmount: z.string().min(1, 'Total amount is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  
  // Payment type validation
  paymentType: z.enum(['one-time', 'recurring']),
  
  // Frequency validation (only for recurring)
  frequency: z.enum(['monthly', 'quarterly', 'annually', 'custom']).optional(),
  
  // Start date validation (for standard frequencies)
  startDate: z.string().optional(),
  
  // Custom dates validation (only for custom frequency)
  customPaymentDates: z.array(z.string()).optional(),
  
  // Document reference (optional for testing)
  documentId: z.string().uuid('Invalid document ID').optional(),
  
  // Optional associations
  buildingId: z.string().uuid().optional(),
  residenceId: z.string().uuid().optional(),
  
  // AI fields
  isAiExtracted: z.boolean().default(false).optional(),
  aiExtractionData: z.any().optional(),
  extractionConfidence: z.number().min(0).max(1).optional(),
  
  // Audit fields
  createdBy: z.string().uuid().min(1, 'Created by user ID is required'),
});

// Base insert schema without refinements
export const baseInvoiceInsertSchema = insertInvoiceSchema;

// Enhanced validation with conditional logic for recurring payments
export const invoiceFormSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required'),
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  totalAmount: z.string().min(1, 'Total amount is required'),
  dueDate: z.coerce.date(),
  paymentType: z.enum(['one-time', 'recurring']),
  frequency: z.enum(['monthly', 'quarterly', 'annually', 'custom']).optional(),
  startDate: z.coerce.date().optional(),
  customPaymentDates: z.array(z.coerce.date()).optional(),
  documentId: z.string().uuid('Invalid document ID').optional(),
  buildingId: z.string().uuid().optional(),
  residenceId: z.string().uuid().optional(),
  isAiExtracted: z.boolean().default(false),
  extractionConfidence: z.coerce.number().min(0).max(1).optional(),
}).superRefine((data, ctx) => {
  // Recurring payment validation
  if (data.paymentType === 'recurring') {
    if (!data.frequency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Frequency is required for recurring payments',
        path: ['frequency'],
      });
    }
    
    // Standard frequency validation (monthly, quarterly, annually)
    if (data.frequency && ['monthly', 'quarterly', 'annually'].includes(data.frequency)) {
      if (!data.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Start date is required for standard recurring frequencies',
          path: ['startDate'],
        });
      }
      
      // Ensure custom dates are not set for standard frequencies
      if (data.customPaymentDates && data.customPaymentDates.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Custom payment dates should not be set for standard frequencies',
          path: ['customPaymentDates'],
        });
      }
    }
    
    // Custom frequency validation
    if (data.frequency === 'custom') {
      if (!data.customPaymentDates || data.customPaymentDates.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one custom payment date is required for custom frequency',
          path: ['customPaymentDates'],
        });
      }
      
      // Ensure start date is not set for custom frequency
      if (data.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Start date should not be set for custom frequency',
          path: ['startDate'],
        });
      }
      
      // Validate custom dates are in the future and sorted
      if (data.customPaymentDates && data.customPaymentDates.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const sortedDates = [...data.customPaymentDates].sort((a, b) => a.getTime() - b.getTime());
        
        // Check if dates are in chronological order
        if (JSON.stringify(data.customPaymentDates) !== JSON.stringify(sortedDates)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Custom payment dates must be in chronological order',
            path: ['customPaymentDates'],
          });
        }
        
        // Check for duplicate dates
        const uniqueDates = new Set(data.customPaymentDates.map(d => d.toISOString()));
        if (uniqueDates.size !== data.customPaymentDates.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Custom payment dates must be unique',
            path: ['customPaymentDates'],
          });
        }
      }
    }
  } else {
    // One-time payment validation - ensure recurring fields are not set
    if (data.frequency || data.startDate || (data.customPaymentDates && data.customPaymentDates.length > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Recurring payment fields should not be set for one-time payments',
        path: ['paymentType'],
      });
    }
  }
});

// AI extraction response schema for Gemini API
export const aiExtractionResponseSchema = z.object({
  vendorName: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  totalAmount: z.number().nullable(),
  dueDate: z.string().nullable(), // Will be converted to Date
  paymentType: z.enum(['one-time', 'recurring']).nullable(),
  frequency: z.enum(['monthly', 'quarterly', 'annually', 'custom']).nullable(),
  startDate: z.string().nullable(), // Will be converted to Date
  customPaymentDates: z.array(z.string()).nullable(), // Will be converted to Date[]
});

// Types
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type InvoiceFormData = z.infer<typeof invoiceFormSchema>;
export type AiExtractionResponse = z.infer<typeof aiExtractionResponseSchema>;

// Helper function to convert AI response to form data
export function convertAiResponseToFormData(aiResponse: AiExtractionResponse): Partial<InvoiceFormData> {
  return {
    vendorName: aiResponse.vendorName || '',
    invoiceNumber: aiResponse.invoiceNumber || '',
    totalAmount: aiResponse.totalAmount ? aiResponse.totalAmount.toString() : '0',
    dueDate: aiResponse.dueDate ? new Date(aiResponse.dueDate) : new Date(),
    paymentType: aiResponse.paymentType || 'one-time',
    frequency: aiResponse.frequency || undefined,
    startDate: aiResponse.startDate ? new Date(aiResponse.startDate) : undefined,
    customPaymentDates: aiResponse.customPaymentDates 
      ? aiResponse.customPaymentDates.map(date => new Date(date))
      : undefined,
  };
}