/**
 * Centralized type definitions for server-side functionality.
 */

import type { Request, Response, NextFunction } from 'express';
import type { User } from '@shared/schema';

// Express middleware types
/**
 *
 */
export interface AuthenticatedRequest extends Request {
  user?: User;
}

/**
 *
 */
export type ExpressMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

/**
 *
 */
export type ExpressHandler = (
  req: AuthenticatedRequest,
  res: Response
) => void | Promise<void>;

// API Response types
/**
 *
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

/**
 *
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Database context types
/**
 *
 */
export interface UserContext {
  userId: string;
  organizationId?: string;
  role: string;
  permissions: string[];
  accessibleResidenceIds: string[];
  accessibleBuildingIds: string[];
}

// Query filter types
/**
 *
 */
export interface QueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

// Service types
/**
 *
 */
export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

/**
 *
 */
export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
}

// Validation types
/**
 *
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 *
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Performance monitoring types
/**
 *
 */
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 *
 */
export interface QueryPerformance {
  query: string;
  executionTime: number;
  rowCount: number;
  cached: boolean;
  timestamp: Date;
}

// Error handling types
/**
 *
 */
export interface AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  details?: Record<string, any>;
}

// Quebec compliance types
/**
 *
 */
export interface QuebecComplianceSettings {
  language: 'en' | 'fr';
  law25Enabled: boolean;
  accessibilityLevel: 'AA' | 'AAA';
  dataRetentionDays: number;
}

// Export utility type helpers
/**
 *
 */
export type Without<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
/**
 *
 */
export type PartialBy<T, K extends keyof T> = Without<T, K> & Partial<Pick<T, K>>;
/**
 *
 */
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;