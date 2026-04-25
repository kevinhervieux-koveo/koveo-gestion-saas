// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
/**
 * Secure Error Handling Middleware
 * Prevents information leakage through error messages
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logSecurity } from '../utils/logger';

const SQL_LEAK_PATTERN = /Failed query|select "|from "|insert into|update .*set |delete from/i;

/**
 * Scrub SQL fragments from any string values in a response payload.
 * Walks the object recursively and replaces any string value that looks like
 * a raw DB error with the generic "internal_error" sentinel.
 */
function scrubSqlFromPayload(payload: any): any {
  if (typeof payload === 'string') {
    return SQL_LEAK_PATTERN.test(payload) ? 'internal_error' : payload;
  }
  if (Array.isArray(payload)) {
    return payload.map(scrubSqlFromPayload);
  }
  if (payload !== null && typeof payload === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(payload)) {
      result[k] = scrubSqlFromPayload(v);
    }
    return result;
  }
  return payload;
}

/**
 * Sanitize error messages to prevent information disclosure
 */
function sanitizeErrorMessage(error: any, isDevelopment: boolean): any {
  // In development, show more details for debugging
  if (isDevelopment) {
    return {
      message: error.message || 'An error occurred',
      type: error.name || 'Error',
      ...(error.stack && { stack: error.stack.split('\n').slice(0, 10) }) // Limit stack trace
    };
  }

  // In production, provide generic messages
  const genericMessages: { [key: string]: string } = {
    ValidationError: 'The provided data is invalid',
    UnauthorizedError: 'Access denied',
    AuthenticationError: 'Authentication failed',
    NotFoundError: 'Resource not found',
    DatabaseError: 'A data processing error occurred',
    NetworkError: 'A network error occurred',
    FileError: 'A file processing error occurred',
    RateLimitError: 'Too many requests. Please try again later',
  };

  // Map error types to safe messages
  const errorType = error.name || error.constructor?.name || 'Error';
  const safeMessage = genericMessages[errorType] || 'An unexpected error occurred';

  return {
    message: safeMessage,
    code: error.code || 'GENERAL_ERROR',
    timestamp: new Date().toISOString()
  };
}

/**
 * Global error handler that prevents information leakage
 */
export function secureErrorHandler(error: any, req: Request, res: Response, next: NextFunction): void {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // If headers were already sent, defer to the default Express handler so we
  // don't try to write a second response body.
  if (res.headersSent) {
    return next(error);
  }

  // Per-route context attached by `asyncHandler` (when used).
  const routeErrorMessage: string | undefined = res.locals?.errorMessage;
  const routeErrorLogPrefix: string | undefined = res.locals?.errorLogPrefix;
  const routeErrorExtraFields: Record<string, unknown> | undefined = res.locals?.errorExtraFields;

  // Preserve the historical per-route dev log line (`❌ <prefix>: <error>`)
  // for routes that opted in via asyncHandler. This keeps the existing
  // logging shape that those try/catch blocks used inline.
  if (isDevelopment && routeErrorLogPrefix) {
    console.error(`${routeErrorLogPrefix}:`, error);
  }

  // Log the actual error for debugging / SIEM (always — production too).
  const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  logSecurity('application_error', {
    requestId: req.headers['x-request-id'] as string || 'unknown',
    errorId,
    ip: req.ip || 'unknown',
    metadata: {
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
        code: error.code
      }
    }
  });

  // Determine status code. Honor explicit `statusCode`/`status` first
  // (e.g. ApiError), then fall back to well-known error type names.
  let statusCode = 500;
  if (typeof error.statusCode === 'number') {
    statusCode = error.statusCode;
  } else if (typeof error.status === 'number') {
    statusCode = error.status;
  } else if (error instanceof ZodError || error.name === 'ZodError') {
    statusCode = 400;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
  } else if (error.name === 'UnauthorizedError' || error.name === 'AuthenticationError') {
    statusCode = 401;
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
  } else if (error.name === 'RateLimitError') {
    statusCode = 429;
  }

  // Routes wrapped in `asyncHandler` opted into the simple
  // `{ message: '...' }` response shape that the old per-route try/catch
  // blocks used. Honor that contract so frontend behavior is unchanged.
  if (routeErrorMessage) {
    if (error instanceof ZodError || error.name === 'ZodError') {
      return res.status(statusCode).json({
        message: 'Validation failed',
        errors: Array.isArray(error.errors) ? error.errors : undefined,
      });
    }
    if (statusCode !== 500) {
      return res.status(statusCode).json({
        message: error.message || routeErrorMessage,
      });
    }
    // Only merge extra static label fields on the 500 path — they describe
    // unexpected server errors and shouldn't leak onto typed 4xx responses.
    return res.status(500).json(scrubSqlFromPayload({
      ...(routeErrorExtraFields ?? {}),
      message: routeErrorMessage,
    }));
  }

  // Unwrapped routes: keep the existing sanitized response shape so we
  // don't change any response contract callers may already depend on.
  const sanitizedError = sanitizeErrorMessage(error, isDevelopment);

  const responsePayload = {
    error: true,
    ...sanitizedError,
    ...(isDevelopment && { errorId }), // Include error ID in development
    requestId: req.headers['x-request-id'] || undefined
  };

  res.status(statusCode).json(
    statusCode === 500 ? scrubSqlFromPayload(responsePayload) : responsePayload
  );
}

/**
 * 404 handler that doesn't leak information
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  logSecurity('route_not_found', {
    requestId: req.headers['x-request-id'] as string || 'unknown',
    ip: req.ip || 'unknown',
    metadata: {
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer')
    }
  });

  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource could not be found',
    code: 'ROUTE_NOT_FOUND',
    timestamp: new Date().toISOString()
  });
}

/**
 * Async wrapper to catch async errors
 */
export function asyncErrorHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Rate limit error handler
 */
export function rateLimitErrorHandler(req: Request, res: Response): void {
  logSecurity('rate_limit_exceeded', {
    requestId: req.headers['x-request-id'] as string || 'unknown',
    ip: req.ip || 'unknown',
    metadata: {
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent')
    }
  });

  res.status(429).json({
    error: 'Rate Limit Exceeded',
    message: 'Too many requests from this IP. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString(),
    retryAfter: 900 // 15 minutes in seconds
  });
}

export default {
  secureErrorHandler,
  notFoundHandler,
  asyncErrorHandler,
  rateLimitErrorHandler,
  sanitizeErrorMessage
};