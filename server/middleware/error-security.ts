/**
 * Secure Error Handling Middleware
 * Prevents information leakage through error messages
 */

import { Request, Response, NextFunction } from 'express';
import { logSecurity } from '../utils/logger';

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
  
  // Log the actual error for debugging
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

  // Determine status code
  let statusCode = 500;
  if (error.status) {
    statusCode = error.status;
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

  // Send sanitized error response
  const sanitizedError = sanitizeErrorMessage(error, isDevelopment);
  
  res.status(statusCode).json({
    error: true,
    ...sanitizedError,
    ...(isDevelopment && { errorId }), // Include error ID in development
    requestId: req.headers['x-request-id'] || undefined
  });
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