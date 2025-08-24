/**
 * Comprehensive error handling system for Koveo Gestion Quebec Property Management SaaS
 * Provides type-safe, user-friendly error messages with proper HTTP status codes
 */

export interface ApiErrorResponse {
  error: string;
  message: string;
  code: string;
  details?: Record<string, any>;
  timestamp: string;
  path?: string;
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationErrorResponse extends ApiErrorResponse {
  validationErrors: ValidationErrorDetail[];
}

/**
 * Enumeration of specific error codes for Quebec property management operations
 */
export enum ErrorCodes {
  // Authentication & Authorization
  AUTHENTICATION_REQUIRED = 'AUTH_001',
  INVALID_CREDENTIALS = 'AUTH_002',
  ACCESS_FORBIDDEN = 'AUTH_003',
  SESSION_EXPIRED = 'AUTH_004',
  ROLE_INSUFFICIENT = 'AUTH_005',

  // Validation Errors
  VALIDATION_FAILED = 'VAL_001',
  INVALID_INPUT_FORMAT = 'VAL_002',
  REQUIRED_FIELD_MISSING = 'VAL_003',
  INVALID_DATE_RANGE = 'VAL_004',
  INVALID_EMAIL_FORMAT = 'VAL_005',
  INVALID_PHONE_FORMAT = 'VAL_006',

  // Business Logic Errors
  ORGANIZATION_NOT_FOUND = 'ORG_001',
  ORGANIZATION_ACCESS_DENIED = 'ORG_002',
  ORGANIZATION_LIMIT_EXCEEDED = 'ORG_003',
  
  BUILDING_NOT_FOUND = 'BLD_001',
  BUILDING_ACCESS_DENIED = 'BLD_002',
  BUILDING_HAS_ACTIVE_RESIDENCES = 'BLD_003',
  
  RESIDENCE_NOT_FOUND = 'RES_001',
  RESIDENCE_ACCESS_DENIED = 'RES_002',
  RESIDENCE_ALREADY_OCCUPIED = 'RES_003',
  RESIDENCE_HAS_ACTIVE_BILLS = 'RES_004',
  
  USER_NOT_FOUND = 'USR_001',
  USER_ALREADY_EXISTS = 'USR_002',
  USER_DEACTIVATED = 'USR_003',
  USER_INVITATION_INVALID = 'USR_004',
  
  DOCUMENT_NOT_FOUND = 'DOC_001',
  DOCUMENT_ACCESS_DENIED = 'DOC_002',
  DOCUMENT_UPLOAD_FAILED = 'DOC_003',
  DOCUMENT_SIZE_EXCEEDED = 'DOC_004',
  
  BILL_NOT_FOUND = 'BIL_001',
  BILL_ALREADY_PAID = 'BIL_002',
  BILL_PAYMENT_FAILED = 'BIL_003',
  
  MAINTENANCE_REQUEST_NOT_FOUND = 'MNT_001',
  MAINTENANCE_REQUEST_ACCESS_DENIED = 'MNT_002',
  
  // Database & System Errors
  DATABASE_CONNECTION_FAILED = 'DB_001',
  DATABASE_QUERY_FAILED = 'DB_002',
  DATABASE_CONSTRAINT_VIOLATION = 'DB_003',
  
  EXTERNAL_SERVICE_UNAVAILABLE = 'EXT_001',
  EMAIL_SERVICE_FAILED = 'EXT_002',
  FILE_STORAGE_FAILED = 'EXT_003',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_001',
  TOO_MANY_REQUESTS = 'RATE_002',
  
  // Generic Errors
  INTERNAL_SERVER_ERROR = 'SYS_001',
  SERVICE_TEMPORARILY_UNAVAILABLE = 'SYS_002',
  INVALID_REQUEST_FORMAT = 'SYS_003',
}

/**
 * User-friendly error messages in French and English for Quebec context
 */
export const ErrorMessages = {
  [ErrorCodes.AUTHENTICATION_REQUIRED]: {
    en: 'Authentication is required to access this resource',
    fr: 'Une authentification est requise pour accéder à cette ressource'
  },
  [ErrorCodes.INVALID_CREDENTIALS]: {
    en: 'Invalid email or password',
    fr: 'Courriel ou mot de passe invalide'
  },
  [ErrorCodes.ACCESS_FORBIDDEN]: {
    en: 'You do not have permission to access this resource',
    fr: 'Vous n\'avez pas la permission d\'accéder à cette ressource'
  },
  [ErrorCodes.ORGANIZATION_NOT_FOUND]: {
    en: 'Organization not found',
    fr: 'Organisation introuvable'
  },
  [ErrorCodes.BUILDING_NOT_FOUND]: {
    en: 'Building not found',
    fr: 'Bâtiment introuvable'
  },
  [ErrorCodes.RESIDENCE_NOT_FOUND]: {
    en: 'Residence not found',
    fr: 'Résidence introuvable'
  },
  [ErrorCodes.USER_NOT_FOUND]: {
    en: 'User not found',
    fr: 'Utilisateur introuvable'
  },
  [ErrorCodes.VALIDATION_FAILED]: {
    en: 'Input validation failed',
    fr: 'La validation des données a échoué'
  },
  [ErrorCodes.REQUIRED_FIELD_MISSING]: {
    en: 'Required field is missing',
    fr: 'Un champ obligatoire est manquant'
  },
  [ErrorCodes.INVALID_EMAIL_FORMAT]: {
    en: 'Invalid email format',
    fr: 'Format de courriel invalide'
  },
  [ErrorCodes.INVALID_PHONE_FORMAT]: {
    en: 'Invalid phone number format',
    fr: 'Format de numéro de téléphone invalide'
  },
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: {
    en: 'Too many requests. Please try again later',
    fr: 'Trop de requêtes. Veuillez réessayer plus tard'
  },
  [ErrorCodes.DATABASE_CONNECTION_FAILED]: {
    en: 'Database connection failed. Please try again',
    fr: 'Connexion à la base de données échouée. Veuillez réessayer'
  },
  [ErrorCodes.INTERNAL_SERVER_ERROR]: {
    en: 'An internal server error occurred. Please contact support if the problem persists',
    fr: 'Une erreur interne du serveur s\'est produite. Veuillez contacter le support si le problème persiste'
  },
  [ErrorCodes.SERVICE_TEMPORARILY_UNAVAILABLE]: {
    en: 'Service is temporarily unavailable. Please try again later',
    fr: 'Le service est temporairement indisponible. Veuillez réessayer plus tard'
  }
} as const;

/**
 * Custom error class for API errors with proper typing
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCodes;
  public readonly details?: Record<string, any>;
  public readonly timestamp: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCodes = ErrorCodes.INTERNAL_SERVER_ERROR,
    details?: Record<string, any>,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.isOperational = isOperational;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /**
   * Creates an ApiError for authentication failures
   */
  static unauthorized(code: ErrorCodes = ErrorCodes.AUTHENTICATION_REQUIRED, details?: Record<string, any>): ApiError {
    return new ApiError(
      ErrorMessages[code].en,
      401,
      code,
      details
    );
  }

  /**
   * Creates an ApiError for authorization failures
   */
  static forbidden(code: ErrorCodes = ErrorCodes.ACCESS_FORBIDDEN, details?: Record<string, any>): ApiError {
    return new ApiError(
      ErrorMessages[code].en,
      403,
      code,
      details
    );
  }

  /**
   * Creates an ApiError for resource not found
   */
  static notFound(code: ErrorCodes, details?: Record<string, any>): ApiError {
    return new ApiError(
      ErrorMessages[code].en,
      404,
      code,
      details
    );
  }

  /**
   * Creates an ApiError for validation failures
   */
  static badRequest(code: ErrorCodes, details?: Record<string, any>): ApiError {
    return new ApiError(
      ErrorMessages[code].en,
      400,
      code,
      details
    );
  }

  /**
   * Creates an ApiError for internal server errors
   */
  static internal(code: ErrorCodes = ErrorCodes.INTERNAL_SERVER_ERROR, details?: Record<string, any>): ApiError {
    return new ApiError(
      ErrorMessages[code].en,
      500,
      code,
      details
    );
  }

  /**
   * Creates an ApiError for rate limiting
   */
  static tooManyRequests(code: ErrorCodes = ErrorCodes.RATE_LIMIT_EXCEEDED, details?: Record<string, any>): ApiError {
    return new ApiError(
      ErrorMessages[code].en,
      429,
      code,
      details
    );
  }

  /**
   * Converts the error to a JSON response format
   */
  toJSON(): ApiErrorResponse {
    return {
      error: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends ApiError {
  public readonly validationErrors: ValidationErrorDetail[];

  constructor(
    message: string,
    validationErrors: ValidationErrorDetail[],
    details?: Record<string, any>
  ) {
    super(message, 400, ErrorCodes.VALIDATION_FAILED, details);
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
    
    Object.setPrototypeOf(this, ValidationError.prototype);
  }

  /**
   * Creates a ValidationError from Zod validation results
   */
  static fromZodError(zodError: any): ValidationError {
    const validationErrors: ValidationErrorDetail[] = zodError.errors.map((err: any) => ({
      field: err.path.join('.'),
      message: err.message,
      value: err.received
    }));

    return new ValidationError(
      'Input validation failed',
      validationErrors,
      { zodError: zodError.errors }
    );
  }

  /**
   * Converts the validation error to a JSON response format
   */
  toJSON(): ValidationErrorResponse {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors
    };
  }
}