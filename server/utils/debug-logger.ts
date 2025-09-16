/**
 * Debug Logger Utility
 * Provides consistent logging functionality for the server with debug capabilities
 */

interface LogData {
  [key: string]: any;
}

/**
 * Enhanced debug logger with structured logging support
 */
export const debugLogger = {
  enabled: process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true',
  
  log(level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR', category: string, event: string, data?: LogData) {
    if (!this.enabled && level === 'DEBUG') return;
    
    const timestamp = new Date().toISOString();
    const prefix = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️' : level === 'DEBUG' ? '🔍' : 'ℹ️';
    
    const logMessage = `${prefix} [${timestamp}] ${category}:${event}`;
    
    if (data && Object.keys(data).length > 0) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }
  }
};

/**
 * Log informational messages
 */
export function logInfo(category: string, event: string, data?: LogData): void {
  debugLogger.log('INFO', category, event, data);
}

/**
 * Log debug messages (only in development or when DEBUG=true)
 */
export function logDebug(category: string, event: string, data?: LogData): void {
  debugLogger.log('DEBUG', category, event, data);
}

/**
 * Log warning messages
 */
export function logWarn(category: string, event: string, data?: LogData): void {
  debugLogger.log('WARN', category, event, data);
}

/**
 * Log error messages
 */
export function logError(category: string, event: string, data?: LogData): void {
  debugLogger.log('ERROR', category, event, data);
}