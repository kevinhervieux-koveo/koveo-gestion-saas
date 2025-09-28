/**
 * Standardized Error Handling Utilities for Koveo Gestion
 * 
 * Provides consistent error handling patterns across the application
 * with Quebec Law 25 compliance and bilingual support.
 */

import { toast } from '@/hooks/use-toast';
import { handleDemoRestrictionError, isDemoRestrictionError } from '@/lib/demo-error-handler';

/**
 * Standard error types that can occur in the application
 */
export type ErrorType = 
  | 'network'
  | 'validation' 
  | 'authentication'
  | 'authorization'
  | 'server'
  | 'client'
  | 'timeout'
  | 'unknown';

/**
 * Standardized error interface for consistent error handling
 */
export interface StandardError {
  type: ErrorType;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  userId?: string;
  requestId?: string;
}

/**
 * Configuration for error handling behavior
 */
export interface ErrorHandlerConfig {
  showToast?: boolean;
  logError?: boolean;
  language?: 'en' | 'fr';
  fallbackMessage?: string;
  onError?: (error: StandardError) => void;
}

/**
 * Default error messages in both languages for Quebec Law 25 compliance
 */
const DEFAULT_ERROR_MESSAGES = {
  en: {
    network: 'Network connection error. Please check your internet connection.',
    validation: 'The information provided is invalid. Please check your input.',
    authentication: 'Authentication failed. Please sign in again.',
    authorization: 'You do not have permission to perform this action.',
    server: 'A server error occurred. Please try again later.',
    client: 'An application error occurred. Please refresh the page.',
    timeout: 'The request timed out. Please try again.',
    unknown: 'An unexpected error occurred. Please contact support if this persists.'
  },
  fr: {
    network: 'Erreur de connexion réseau. Veuillez vérifier votre connexion Internet.',
    validation: 'Les informations fournies sont invalides. Veuillez vérifier votre saisie.',
    authentication: 'Échec de l\'authentification. Veuillez vous reconnecter.',
    authorization: 'Vous n\'avez pas la permission d\'effectuer cette action.',
    server: 'Une erreur de serveur s\'est produite. Veuillez réessayer plus tard.',
    client: 'Une erreur d\'application s\'est produite. Veuillez actualiser la page.',
    timeout: 'La demande a expiré. Veuillez réessayer.',
    unknown: 'Une erreur inattendue s\'est produite. Contactez le support si cela persiste.'
  }
} as const;

/**
 * Determines the error type based on error properties
 * 
 * @param error - The error object to classify
 * @returns The classified error type
 */
function classifyError(error: unknown): ErrorType {
  if (!error || typeof error !== 'object') {
    return 'unknown';
  }

  const err = error as Record<string, unknown>;

  // Check for specific error patterns
  if (err.name === 'NetworkError' || err.message?.toString().includes('fetch')) {
    return 'network';
  }
  
  if (err.name === 'ValidationError' || err.status === 400) {
    return 'validation';
  }
  
  if (err.status === 401 || err.name === 'AuthenticationError') {
    return 'authentication';
  }
  
  if (err.status === 403 || err.name === 'AuthorizationError') {
    return 'authorization';
  }
  
  if (typeof err.status === 'number' && err.status >= 500) {
    return 'server';
  }
  
  if (err.name === 'TimeoutError' || err.message?.toString().includes('timeout')) {
    return 'timeout';
  }

  return 'client';
}

/**
 * Converts any error to a standardized error format
 * 
 * @param error - The error to standardize
 * @param context - Additional context about where the error occurred
 * @returns Standardized error object
 */
export function standardizeError(
  error: unknown,
  context?: { userId?: string; requestId?: string; operation?: string }
): StandardError {
  const type = classifyError(error);
  
  let message = 'An error occurred';
  let code = 'UNKNOWN_ERROR';
  let details: Record<string, unknown> = {};

  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    message = err.message?.toString() || message;
    code = err.code?.toString() || err.name?.toString() || code;
    
    // Safely extract additional details
    if (err.details && typeof err.details === 'object') {
      details = err.details as Record<string, unknown>;
    }
    
    // Add context information
    if (context?.operation) {
      details.operation = context.operation;
    }
  }

  return {
    type,
    code,
    message,
    details,
    timestamp: new Date(),
    userId: context?.userId,
    requestId: context?.requestId
  };
}

/**
 * Handles errors with consistent UX patterns and logging
 * 
 * @param error - The error to handle
 * @param config - Configuration for error handling behavior
 * @returns The standardized error object
 * 
 * @example
 * ```typescript
 * try {
 *   await apiCall();
 * } catch (error) {
 *   handleStandardError(error, {
 *     showToast: true,
 *     language: 'fr',
 *     onError: (standardError) => {
 *       analytics.track('error_occurred', standardError);
 *     }
 *   });
 * }
 * ```
 */
export function handleStandardError(
  error: unknown,
  config: ErrorHandlerConfig = {}
): StandardError {
  const {
    showToast = true,
    logError = true,
    language = 'en',
    fallbackMessage,
    onError
  } = config;

  // First, check if this is a demo restriction error
  if (isDemoRestrictionError(error)) {
    handleDemoRestrictionError(error, language);
    return standardizeError(error);
  }

  // Standardize the error
  const standardError = standardizeError(error);

  // Log the error if enabled
  if (logError) {
    console.error('Standardized Error:', standardError);
    
    // In production, you might want to send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Example: errorTrackingService.track(standardError);
    }
  }

  // Show toast notification if enabled
  if (showToast) {
    const errorMessages = DEFAULT_ERROR_MESSAGES[language];
    const displayMessage = fallbackMessage || 
                          errorMessages[standardError.type] || 
                          errorMessages.unknown;

    toast({
      title: language === 'fr' ? 'Erreur' : 'Error',
      description: displayMessage,
      variant: 'destructive',
      duration: standardError.type === 'network' ? 10000 : 5000 // Network errors show longer
    });
  }

  // Call custom error handler if provided
  if (onError) {
    try {
      onError(standardError);
    } catch (handlerError) {
      console.error('Error in custom error handler:', handlerError);
    }
  }

  return standardError;
}

/**
 * Async wrapper that automatically handles errors with standardized patterns
 * 
 * @param asyncFn - The async function to wrap
 * @param config - Error handling configuration
 * @returns Promise that resolves to function result or undefined on error
 * 
 * @example
 * ```typescript
 * const result = await withErrorHandling(
 *   () => apiRequest('GET', '/api/users'),
 *   { 
 *     language: 'fr',
 *     onError: (error) => router.push('/error')
 *   }
 * );
 * 
 * if (result) {
 *   // Handle successful result
 * }
 * ```
 */
export async function withErrorHandling<T>(
  asyncFn: () => Promise<T>,
  config: ErrorHandlerConfig = {}
): Promise<T | undefined> {
  try {
    return await asyncFn();
  } catch (error) {
    handleStandardError(error, config);
    return undefined;
  }
}

/**
 * Creates a standardized error handler for React Query mutations
 * 
 * @param config - Error handling configuration
 * @returns Error handler function for React Query
 * 
 * @example
 * ```typescript
 * const mutation = useMutation({
 *   mutationFn: updateUser,
 *   onError: createQueryErrorHandler({ language: 'fr' })
 * });
 * ```
 */
export function createQueryErrorHandler(
  config: ErrorHandlerConfig = {}
) {
  return (error: unknown) => {
    handleStandardError(error, {
      showToast: true,
      logError: true,
      ...config
    });
  };
}

/**
 * Error boundary component data for standardized error display
 */
export interface ErrorBoundaryData {
  error: StandardError;
  retry?: () => void;
  goHome?: () => void;
}

/**
 * Creates error boundary data from caught errors
 * 
 * @param error - The caught error
 * @param actions - Available actions for recovery
 * @returns Formatted error boundary data
 */
export function createErrorBoundaryData(
  error: unknown,
  actions?: { retry?: () => void; goHome?: () => void }
): ErrorBoundaryData {
  const standardError = standardizeError(error);
  
  return {
    error: standardError,
    retry: actions?.retry,
    goHome: actions?.goHome
  };
}

/**
 * Validation error helper for form handling
 * 
 * @param fieldErrors - Object containing field validation errors
 * @param language - Language for error messages
 * @returns Formatted validation error
 */
export function createValidationError(
  fieldErrors: Record<string, string>,
  language: 'en' | 'fr' = 'en'
): StandardError {
  const errorCount = Object.keys(fieldErrors).length;
  const message = language === 'fr' 
    ? `${errorCount} erreur(s) de validation détectée(s)`
    : `${errorCount} validation error(s) detected`;

  return {
    type: 'validation',
    code: 'FORM_VALIDATION_ERROR',
    message,
    details: { fieldErrors },
    timestamp: new Date()
  };
}