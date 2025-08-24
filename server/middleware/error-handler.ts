/**
 * Centralized error handling middleware for Koveo Gestion
 * Provides consistent error responses and logging for all API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { ApiError, ValidationError, ErrorCodes, ErrorMessages } from '../types/errors';
import { ZodError } from 'zod';

/**
 * Interface for enhanced request with user information
 */
interface AuthenticatedRequest extends Request {
  user?: any; // Use any for now to avoid conflicts with existing auth types
}

/**
 * Determines user's preferred language from request
 */
function getUserLanguage(req: AuthenticatedRequest): 'en' | 'fr' {
  // Check user preference first
  if (req.user?.preferredLanguage) {
    return req.user.preferredLanguage;
  }
  
  // Check Accept-Language header
  const acceptLanguage = req.headers['accept-language'];
  if (acceptLanguage && acceptLanguage.includes('fr')) {
    return 'fr';
  }
  
  // Default to French for Quebec
  return 'fr';
}

/**
 * Gets localized error message
 */
function getLocalizedMessage(code: ErrorCodes, language: 'en' | 'fr'): string {
  const messages = ErrorMessages[code];
  return messages ? messages[language] : ErrorMessages[ErrorCodes.INTERNAL_SERVER_ERROR][language];
}

/**
 * Logs error with appropriate level based on severity
 */
function logError(error: Error, req: AuthenticatedRequest): void {
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path || req.url,
    userId: req.user?.id,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection?.remoteAddress,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  };

  if (error instanceof ApiError) {
    if (error.statusCode >= 500) {
      console.error('🚨 Server Error:', logData);
    } else if (error.statusCode >= 400) {
      console.warn('⚠️  Client Error:', logData);
    } else {
      console.info('ℹ️  API Info:', logData);
    }
  } else {
    console.error('💥 Unexpected Error:', logData);
  }
}

/**
 * Handles Zod validation errors
 */
function handleZodError(error: ZodError, req: AuthenticatedRequest): ValidationError {
  return ValidationError.fromZodError(error);
}

/**
 * Handles database-related errors
 */
function handleDatabaseError(error: Error): ApiError {
  const message = error.message.toLowerCase();
  
  if (message.includes('connection') || message.includes('connect')) {
    return ApiError.internal(ErrorCodes.DATABASE_CONNECTION_FAILED, {
      originalError: error.message
    });
  }
  
  if (message.includes('unique') || message.includes('duplicate')) {
    return ApiError.badRequest(ErrorCodes.DATABASE_CONSTRAINT_VIOLATION, {
      constraint: 'unique',
      originalError: error.message
    });
  }
  
  if (message.includes('foreign key') || message.includes('constraint')) {
    return ApiError.badRequest(ErrorCodes.DATABASE_CONSTRAINT_VIOLATION, {
      constraint: 'foreign_key',
      originalError: error.message
    });
  }
  
  return ApiError.internal(ErrorCodes.DATABASE_QUERY_FAILED, {
    originalError: error.message
  });
}

/**
 * Handles common Node.js/system errors
 */
function handleSystemError(error: Error): ApiError {
  const message = error.message.toLowerCase();
  
  if (message.includes('enotfound') || message.includes('network')) {
    return ApiError.internal(ErrorCodes.EXTERNAL_SERVICE_UNAVAILABLE, {
      originalError: error.message
    });
  }
  
  if (message.includes('timeout')) {
    return ApiError.internal(ErrorCodes.SERVICE_TEMPORARILY_UNAVAILABLE, {
      originalError: error.message
    });
  }
  
  return ApiError.internal(ErrorCodes.INTERNAL_SERVER_ERROR, {
    originalError: error.message
  });
}

/**
 * Main error handling middleware
 */
export function errorHandler(
  error: Error,
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // Get path for logging
  const requestPath = req.path || req.url;

  let apiError: ApiError;

  if (error instanceof ApiError) {
    // Already a properly formatted API error
    apiError = error;
  } else if (error instanceof ZodError) {
    // Zod validation error
    apiError = handleZodError(error, req);
  } else if (error.name === 'ValidationError') {
    // Generic validation error
    apiError = ApiError.badRequest(ErrorCodes.VALIDATION_FAILED, {
      originalError: error.message
    });
  } else if (error.message.includes('database') || error.message.includes('sql')) {
    // Database-related error
    apiError = handleDatabaseError(error);
  } else {
    // System or unknown error
    apiError = handleSystemError(error);
  }

  // Log the error
  logError(apiError, req);

  // Get user's preferred language
  const language = getUserLanguage(req);
  
  // Create localized response
  const response = apiError.toJSON();
  response.message = getLocalizedMessage(apiError.code, language);
  response.path = requestPath;

  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production' && apiError.statusCode >= 500) {
    delete response.details;
  }

  // Send error response
  res.status(apiError.statusCode).json(response);
}

/**
 * Middleware to handle async route errors
 */
export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Middleware to handle 404 errors for unknown API routes only
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  // Only handle API routes, let other routes pass through for frontend serving
  if (req.path.startsWith('/api')) {
    const error = ApiError.notFound(ErrorCodes.INTERNAL_SERVER_ERROR, {
      path: req.path,
      method: req.method
    });
    
    error.message = `API route ${req.method} ${req.path} not found`;
    next(error);
  } else {
    // Let non-API routes continue to frontend serving
    next();
  }
}

/**
 * Express middleware function that wraps routes with error handling
 */
export function withErrorHandling<T extends Request = Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<void> | void
) {
  return async (req: T, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}