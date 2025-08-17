/**
 * Logging utilities for server-side operations
 */

export interface LogContext {
  userId?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export function logInfo(message: string, context?: LogContext) {
  console.log(`[INFO] ${message}`, context ? JSON.stringify(context) : '');
}

export function logError(message: string, error?: Error, context?: LogContext) {
  console.error(`[ERROR] ${message}`, error?.message || '', context ? JSON.stringify(context) : '');
}

export function logWarn(message: string, context?: LogContext) {
  console.warn(`[WARN] ${message}`, context ? JSON.stringify(context) : '');
}