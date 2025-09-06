/**
 * Invoice Management Components
 * 
 * This module exports all invoice-related components for the Koveo Gestion
 * property management system. Components include AI-powered data extraction,
 * invoice forms with recurring payment support, and integration with the
 * modular document management system.
 */

// AI-powered data extraction
export { GeminiInvoiceExtractor } from './GeminiInvoiceExtractor';
export type { GeminiInvoiceExtractorProps } from './GeminiInvoiceExtractor';

// Export types for easy import
export type {
  Invoice,
  InsertInvoice,
  InvoiceFormData,
  AiExtractionResponse,
} from '@shared/schema';