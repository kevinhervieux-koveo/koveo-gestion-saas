/**
 * Secure logging utilities for Quebec property management system.
 * Prevents exposure of sensitive data while maintaining debugging capabilities.
 */

import { createHash } from "crypto";

/**
 * Masks an email address for routine (info-level) logging while keeping
 * enough signal to debug deduplication / routing issues. Quebec Law 25
 * compliance: never log full plaintext email addresses at info level.
 *
 * Output format: `j***@example.com#abcd1234`
 *   - first character of the local-part (lowercased)
 *   - the domain in plaintext (useful for debugging routing / dedup)
 *   - a short, stable, salt-free SHA-256 prefix of the full lowercased
 *     email so the same address always produces the same suffix and we
 *     can correlate log lines without exposing the address itself.
 *
 * For malformed inputs (no `@`, empty), returns a hash-only token so we
 * never accidentally fall back to the raw value.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== "string") return "[no-email]";
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length === 0) return "[no-email]";

  const hash = createHash("sha256").update(trimmed).digest("hex").slice(0, 8);
  const atIdx = trimmed.lastIndexOf("@");
  if (atIdx <= 0 || atIdx === trimmed.length - 1) {
    return `[masked-email]#${hash}`;
  }
  const local = trimmed.slice(0, atIdx);
  const domain = trimmed.slice(atIdx + 1);
  const firstChar = local.charAt(0);
  return `${firstChar}***@${domain}#${hash}`;
}

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
  errorId?: string;
}

// Sensitive fields that should never be logged
const SENSITIVE_FIELDS = [
  'password', 'passwd', 'pwd', 'secret', 'token', 'key', 'auth', 'credential',
  'ssn', 'sin', 'creditcard', 'cardnumber', 'cvv', 'pin', 'otp',
  'sessionId', 'sessionid', 'session_id', 'cookie', 'authorization',
  'x-api-key', 'api-key', 'apikey', 'bearer', 'refresh_token', 'access_token'
];

// Field names whose values should be treated as email addresses and masked.
// Matched case-insensitively against the lowercased key (suffix match so that
// `userEmail`, `recipient_email`, `ownerEmail`, etc. are all covered).
const EMAIL_FIELD_SUFFIXES = ['email'];
const EMAIL_FIELD_EXACT = new Set(['to', 'from', 'cc', 'bcc', 'recipient', 'sender']);

// Loose RFC-5322-ish detector good enough for log scrubbing. We intentionally
// keep it conservative: anything that looks like `local@domain.tld` will be
// masked, but we don't want to mangle unrelated strings that contain `@`.
const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function looksLikeEmail(value: string): boolean {
  // Single, full-string match (no surrounding text).
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value.trim());
}

function isEmailKey(lowerKey: string): boolean {
  if (EMAIL_FIELD_EXACT.has(lowerKey)) return true;
  return EMAIL_FIELD_SUFFIXES.some(suffix => lowerKey.endsWith(suffix));
}

function maskEmailsInString(value: string): string {
  return value.replace(EMAIL_REGEX, match => maskEmail(match));
}

// Detects values that have already been passed through `maskEmail` so we don't
// re-mask them at the structured-log layer (which would tack on a second hash).
const ALREADY_MASKED_EMAIL = /^([a-z0-9]\*\*\*@[A-Za-z0-9.-]+|\[masked-email\]|\[no-email\])(#[a-f0-9]{8})?$/;

function isAlreadyMasked(value: string): boolean {
  return ALREADY_MASKED_EMAIL.test(value);
}

function safeMaskEmail(value: string): string {
  return isAlreadyMasked(value) ? value : maskEmail(value);
}

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

export interface SanitizeOptions {
  /**
   * When true (default), values that look like email addresses or live under
   * email-shaped keys (`email`, `userEmail`, `to`, `from`, ...) are passed
   * through `maskEmail`. Set to false for `logDebug`, where full details are
   * useful for local development and never reach production at INFO+ level.
   */
  maskEmails?: boolean;
}

/**
 * Sanitizes data to remove sensitive information before logging
 */
function sanitizeLogData(data: any, options: SanitizeOptions = {}, depth = 0): any {
  const maskEmails = options.maskEmails !== false;
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
    if (maskEmails) {
      if (looksLikeEmail(data)) {
        return safeMaskEmail(data);
      }
      if (data.includes('@')) {
        return maskEmailsInString(data);
      }
    }
    return data;
  }

  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item, options, depth + 1));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    // Check if key is sensitive
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (maskEmails && isEmailKey(lowerKey)) {
      if (typeof value === 'string') {
        sanitized[key] = safeMaskEmail(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(v =>
          typeof v === 'string' ? safeMaskEmail(v) : sanitizeLogData(v, options, depth + 1)
        );
      } else if (value && typeof value === 'object') {
        sanitized[key] = sanitizeLogData(value, options, depth + 1);
      } else {
        sanitized[key] = value;
      }
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeLogData(value, options, depth + 1);
    } else if (maskEmails && typeof value === 'string') {
      if (looksLikeEmail(value)) {
        sanitized[key] = safeMaskEmail(value);
      } else if (value.includes('@')) {
        sanitized[key] = maskEmailsInString(value);
      } else {
        sanitized[key] = value;
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Formats log message with timestamp and context
 */
function formatLogMessage(
  level: string,
  message: string,
  context?: LogContext,
  options?: SanitizeOptions
): string {
  const timestamp = new Date().toISOString();
  const env = process.env.NODE_ENV || 'development';

  let formatted = `[${timestamp}] [${env}] [${level}] ${message}`;

  if (context) {
    const sanitizedContext = sanitizeLogData(context, options);
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

  // Debug logs keep full email details for local development.
  const formatted = formatLogMessage('DEBUG', message, context, { maskEmails: false });
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
    // Security events should be sent to a SIEM (Security Information and Event Management) system
    // for real-time threat detection and compliance monitoring. Consider integrating with:
    // - Splunk, DataDog, or CloudWatch for centralized security logging
    // - Automated alerting for critical security events (failed logins, unauthorized access)
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
    // This requires integration with an external audit logging service (e.g., Splunk, DataDog, CloudWatch)
    // to meet Quebec Law 25 compliance requirements. The external service should provide:
    // - Tamper-proof storage
    // - Long-term retention (7+ years)
    // - Audit trail integrity verification
  }
}
