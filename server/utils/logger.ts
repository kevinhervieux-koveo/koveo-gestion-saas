/**
 * Secure logging utilities for Quebec property management system.
 * Prevents exposure of sensitive data while maintaining debugging capabilities.
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogContext {
  userId?: string;
  action?: string;
  metadata?: Record<string, any>;
  requestId?: string;
  ip?: string;
}

// Sensitive fields that should never be logged
const SENSITIVE_FIELDS = [
  'password', 'passwd', 'pwd', 'secret', 'token', 'key', 'auth', 'credential',
  'ssn', 'sin', 'creditcard', 'cardnumber', 'cvv', 'pin', 'otp',
  'sessionId', 'sessionid', 'session_id', 'cookie', 'authorization',
  'x-api-key', 'api-key', 'apikey', 'bearer', 'refresh_token', 'access_token'
];

// Get current log level from environment
const getLogLevel = (): LogLevel => {
  const level = process.env.LOG_LEVEL?.toUpperCase();
  switch (level) {
    case 'ERROR': return LogLevel.ERROR;
    case 'WARN': return LogLevel.WARN;
    case 'INFO': return LogLevel.INFO;
    case 'DEBUG': return LogLevel.DEBUG;
    default: return process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG;
  }
};

const currentLogLevel = getLogLevel();

/**
 * Sanitizes data to remove sensitive information before logging
 */
function sanitizeLogData(data: any, depth = 0): any {
  if (depth > 10) return '[DEPTH_EXCEEDED]'; // Prevent infinite recursion
  
  if (data === null || data === undefined) return data;
  
  if (typeof data === 'string') {
    // Check if string looks like sensitive data
    if (data.length > 50 && /^[A-Za-z0-9+/]+=*$/.test(data)) {
      return '[REDACTED_BASE64]';
    }
    if (data.length > 20 && /^[a-f0-9]{20,}$/i.test(data)) {
      return '[REDACTED_TOKEN]';
    }
    return data;
  }
  
  if (typeof data !== 'object') return data;
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item, depth + 1));
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key is sensitive
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeLogData(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Formats log message with timestamp and context
 */
function formatLogMessage(level: string, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const env = process.env.NODE_ENV || 'development';
  
  let formatted = `[${timestamp}] [${env}] [${level}] ${message}`;
  
  if (context) {
    const sanitizedContext = sanitizeLogData(context);
    formatted += ` ${JSON.stringify(sanitizedContext)}`;
  }
  
  return formatted;
}

/**
 * Secure info logging with data sanitization
 */
export function logInfo(message: string, context?: LogContext): void {
  if (currentLogLevel < LogLevel.INFO) return;
  
  const formatted = formatLogMessage('INFO', message, context);
  console.log(formatted);
}

/**
 * Secure warning logging with data sanitization
 */
export function logWarn(message: string, context?: LogContext): void {
  if (currentLogLevel < LogLevel.WARN) return;
  
  const formatted = formatLogMessage('WARN', message, context);
  console.warn(formatted);
}

/**
 * Secure error logging with data sanitization
 */
export function logError(message: string, error?: Error, context?: LogContext): void {
  if (currentLogLevel < LogLevel.ERROR) return;
  
  const errorContext = {
    ...context,
    error: {
      message: error?.message,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : '[REDACTED]',
      name: error?.name,
    }
  };
  
  const formatted = formatLogMessage('ERROR', message, errorContext);
  console.error(formatted);
}

/**
 * Debug logging (only in development)
 */
export function logDebug(message: string, context?: LogContext): void {
  if (currentLogLevel < LogLevel.DEBUG) return;
  
  const formatted = formatLogMessage('DEBUG', message, context);
  console.debug(formatted);
}

/**
 * Security-focused logging for authentication events
 */
export function logSecurity(event: string, context: LogContext): void {
  const securityContext = {
    ...context,
    timestamp: new Date().toISOString(),
    event,
  };
  
  const formatted = formatLogMessage('SECURITY', `Security Event: ${event}`, securityContext);
  console.warn(formatted);
  
  // In production, you might want to send this to a separate security log
  if (process.env.NODE_ENV === 'production') {
    // TODO: Implement security event logging to external system
  }
}

/**
 * Performance logging for monitoring slow operations
 */
export function logPerformance(operation: string, duration: number, context?: LogContext): void {
  if (currentLogLevel < LogLevel.INFO) return;
  
  const perfContext = {
    ...context,
    operation,
    duration: `${duration}ms`,
  };
  
  if (duration > 1000) { // Log slow operations as warnings
    logWarn(`Slow operation: ${operation}`, perfContext);
  } else {
    logInfo(`Performance: ${operation}`, perfContext);
  }
}

/**
 * Audit logging for compliance requirements (Law 25)
 */
export function logAudit(action: string, context: LogContext): void {
  const auditContext = {
    ...context,
    timestamp: new Date().toISOString(),
    action,
  };
  
  const formatted = formatLogMessage('AUDIT', `Audit: ${action}`, auditContext);
  console.log(formatted);
  
  // In production, this should go to a tamper-proof audit log
  if (process.env.NODE_ENV === 'production') {
    // TODO: Implement audit logging to external compliant system
  }
}
