/**
 * Centralized constants for server-side functionality.
 */

// User roles and permissions
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  TENANT: 'tenant', 
  RESIDENT: 'resident',
} as const;

export const ROLE_LEVELS = {
  [ROLES.ADMIN]: 4,
  [ROLES.MANAGER]: 3,
  [ROLES.TENANT]: 2,
  [ROLES.RESIDENT]: 1,
} as const;

// Organization types
export const ORGANIZATION_TYPES = {
  DEMO: 'Demo',
  KOVEO: 'Koveo',
  STANDARD: 'Standard',
} as const;

// Building types
export const BUILDING_TYPES = {
  APARTMENT: 'apartment',
  CONDO: 'condo',
  TOWNHOUSE: 'townhouse',
  COMMERCIAL: 'commercial',
  MIXED_USE: 'mixed_use',
} as const;

// Quebec provinces and territories
export const QUEBEC_REGIONS = {
  MONTREAL: 'Montréal',
  QUEBEC_CITY: 'Québec',
  GATINEAU: 'Gatineau',
  SHERBROOKE: 'Sherbrooke',
  TROIS_RIVIERES: 'Trois-Rivières',
  SAGUENAY: 'Saguenay',
  LEVIS: 'Lévis',
  TERREBONNE: 'Terrebonne',
  LAVAL: 'Laval',
  LONGUEUIL: 'Longueuil',
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Cache keys
export const CACHE_KEYS = {
  USER: (id: string) => `user:${id}`,
  ORGANIZATION: (id: string) => `org:${id}`,
  BUILDING: (id: string) => `building:${id}`,
  RESIDENCE: (id: string) => `residence:${id}`,
  USER_PERMISSIONS: (userId: string) => `permissions:${userId}`,
  ORGANIZATION_BUILDINGS: (orgId: string) => `org:${orgId}:buildings`,
  BUILDING_RESIDENCES: (buildingId: string) => `building:${buildingId}:residences`,
} as const;

// Error codes
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUEBEC_COMPLIANCE_ERROR: 'QUEBEC_COMPLIANCE_ERROR',
} as const;

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  SLOW_QUERY_MS: 1000,
  MEMORY_USAGE_MB: 512,
  RESPONSE_TIME_MS: 200,
  CPU_USAGE_PERCENT: 80,
} as const;

// Quebec Law 25 compliance constants
export const LAW_25_COMPLIANCE = {
  DATA_RETENTION_DAYS: 365 * 7, // 7 years
  CONSENT_REQUIRED_ACTIONS: [
    'data_collection',
    'data_sharing',
    'marketing_communications',
    'analytics_tracking',
  ],
  PERSONAL_DATA_FIELDS: [
    'email',
    'firstName',
    'lastName',
    'phoneNumber',
    'address',
    'dateOfBirth',
    'sin', // Social Insurance Number
  ],
  REQUIRED_PRIVACY_NOTICES: [
    'data_collection_purpose',
    'data_retention_period', 
    'third_party_sharing',
    'user_rights',
    'contact_information',
  ],
} as const;

// API rate limits
export const RATE_LIMITS = {
  AUTH: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 attempts per 15 minutes
  API: { windowMs: 15 * 60 * 1000, max: 100 }, // 100 requests per 15 minutes
  INVITATION: { windowMs: 60 * 60 * 1000, max: 10 }, // 10 invitations per hour
  EMAIL: { windowMs: 60 * 60 * 1000, max: 50 }, // 50 emails per hour
} as const;

// Supported languages
export const LANGUAGES = {
  EN: 'en',
  FR: 'fr',
} as const;

// File upload constraints
export const FILE_UPLOAD = {
  MAX_SIZE_MB: 10,
  ALLOWED_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  STORAGE_PATH: 'uploads',
} as const;

/**
 *
 */
export type Role = typeof ROLES[keyof typeof ROLES];
/**
 *
 */
export type OrganizationType = typeof ORGANIZATION_TYPES[keyof typeof ORGANIZATION_TYPES];
/**
 *
 */
export type BuildingType = typeof BUILDING_TYPES[keyof typeof BUILDING_TYPES];
/**
 *
 */
export type Language = typeof LANGUAGES[keyof typeof LANGUAGES];
/**
 *
 */
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];