/**
 * Logging utilities for server-side operations.
 */

/**
 *
 */
export interface LogContext {
  userId?: string;
  action?: string;
  metadata?: Record<string, any>;
}

/**
 *
 * @param message
 * @param context
 */
/**
 * LogInfo function.
 * @param message
 * @param context
 * @returns Function result.
 */
export function logInfo(message: string, context?: LogContext) {
  console.warn(`[INFO] ${message}`, context ? JSON.stringify(context) : '');
}

/**
 *
 * @param message
 * @param error
 * @param context
 */
/**
 * LogError function.
 * @param message
 * @param error
 * @param context
 * @returns Function result.
 */
export function logError(message: string, error?: Error, context?: LogContext) {
  console.error(`[ERROR] ${message}`, error?.message || '', context ? JSON.stringify(context) : '');
}

/**
 *
 * @param message
 * @param context
 */
/**
 * LogWarn function.
 * @param message
 * @param context
 * @returns Function result.
 */
export function logWarn(message: string, context?: LogContext) {
  console.warn(`[WARN] ${message}`, context ? JSON.stringify(context) : '');
}