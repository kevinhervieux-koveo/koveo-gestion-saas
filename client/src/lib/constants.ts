/**
 * Common constants to eliminate hardcoded values across the application
 */

// Layout constants
export const LAYOUT = {
  CONTAINER_CLASSES: 'container mx-auto py-6 space-y-6',
  LOADING_HEIGHT: 'h-64',
  MAX_WIDTH_7XL: 'max-w-7xl mx-auto',
  PADDING_6: 'p-6',
} as const;

// Typography constants  
export const TYPOGRAPHY = {
  TITLE_LARGE: 'text-3xl font-bold',
  TITLE_GRAY: 'text-3xl font-bold text-gray-900', 
  DESCRIPTION: 'text-muted-foreground',
  DESCRIPTION_GRAY: 'text-gray-600',
} as const;

// Layout patterns
export const FLEX_PATTERNS = {
  BETWEEN_CENTER: 'flex justify-between items-center',
  CENTER: 'flex items-center justify-center',
  GAP_4: 'flex items-center gap-4',
  GAP_2: 'flex items-center gap-2',
} as const;

// Loading messages
export const LOADING_MESSAGES = {
  DEMANDS: 'Loading demands...',
  DOCUMENTS: 'Loading documents...',
  BUILDINGS: 'Loading buildings...',
  RESIDENCES: 'Loading residences...',
  USERS: 'Loading users...',
} as const;

// Common error messages
export const ERROR_MESSAGES = {
  CREATE_FAILED: 'Failed to create',
  UPDATE_FAILED: 'Failed to update', 
  DELETE_FAILED: 'Failed to delete',
  LOAD_FAILED: 'Failed to load',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  CREATED: 'created successfully',
  UPDATED: 'updated successfully',
  DELETED: 'deleted successfully',
} as const;

// Pagination constants
export const PAGINATION = {
  ITEMS_PER_PAGE: 10,
  DEFAULT_PAGE: 1,
} as const;

// Dialog and form constants
export const DIALOG = {
  MAX_HEIGHT: 'max-h-[90vh]',
  OVERFLOW_Y: 'overflow-y-auto',
  MAX_WIDTH_MD: 'max-w-md',
  MAX_WIDTH_2XL: 'max-w-2xl',
} as const;