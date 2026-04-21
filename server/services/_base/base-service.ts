/**
 * Base Service Class
 * 
 * Provides common functionality and patterns used across all services:
 * - Database error handling
 * - Validation utilities
 * - Logging patterns
 * - Transaction management
 */

import { db } from '../../db';
import type { DrizzleTransaction } from '../../types/transaction';

export abstract class BaseService {
  protected serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  /**
   * Common error handling wrapper for service methods
   */
  protected async executeWithErrorHandling<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    try {
      console.log(`🔧 [${this.serviceName}] Starting: ${operation}`);
      const result = await fn();
      console.log(`✅ [${this.serviceName}] Completed: ${operation}`);
      return result;
    } catch (error: any) {
      console.error(`❌ [${this.serviceName}] Error in ${operation}:`, error);
      throw new Error(`${this.serviceName} ${operation} failed: ${error.message}`);
    }
  }

  /**
   * Common validation for required fields
   */
  protected validateRequired(data: Record<string, any>, requiredFields: string[]): void {
    const missing = requiredFields.filter(field => 
      data[field] === undefined || data[field] === null || data[field] === ''
    );
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Common numeric validation and parsing
   */
  protected parseNumericValue(value: string | number, fieldName: string): number {
    const parsed = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(parsed) || parsed < 0) {
      throw new Error(`Invalid ${fieldName}: must be a positive number`);
    }
    
    return parsed;
  }

  /**
   * Common date validation and parsing
   */
  protected parseDate(dateValue: string | Date, fieldName: string): Date {
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid ${fieldName}: must be a valid date`);
    }
    
    return date;
  }

  /**
   * Execute operation within transaction
   */
  protected async executeInTransaction<T>(
    operation: (tx: DrizzleTransaction) => Promise<T>
  ): Promise<T> {
    return await db.transaction(operation);
  }

  /**
   * Generate unique identifiers for records
   */
  protected generateUniqueId(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Calculate date offsets for scheduling
   */
  protected addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Quebec-specific date formatting
   */
  protected formatQuebecDate(date: Date): string {
    return date.toLocaleDateString('fr-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Montreal'
    });
  }
}