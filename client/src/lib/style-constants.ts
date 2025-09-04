/**
 * Common CSS utility classes used throughout the application.
 * Consolidates repeated styling patterns for better maintainability.
 */

export const COMMON_STYLES = {
  // Typography
  TITLE_LARGE: 'text-3xl font-bold',
  TITLE_GRAY: 'text-3xl font-bold text-gray-900',
  TITLE_MEDIUM: 'text-2xl font-bold',
  TITLE_SMALL: 'text-lg font-semibold',
  SUBTITLE: 'text-sm text-gray-600',
  
  // Layouts
  FLEX_CENTER: 'flex items-center justify-center',
  FLEX_BETWEEN: 'flex items-center justify-between',
  FLEX_COL_CENTER: 'flex flex-col items-center justify-center',
  GRID_RESPONSIVE: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
  
  // Spacing
  SECTION_PADDING: 'p-6',
  CARD_PADDING: 'p-4',
  CONTENT_SPACING: 'space-y-6',
  FORM_SPACING: 'space-y-4',
  
  // Buttons
  BUTTON_ICON: 'flex items-center gap-2',
  BUTTON_LOADING: 'opacity-50 cursor-not-allowed',
  
  // Cards
  CARD_BASE: 'bg-white rounded-lg border border-gray-200 shadow-sm',
  CARD_HOVER: 'hover:shadow-md transition-shadow',
  CARD_INTERACTIVE: 'cursor-pointer hover:shadow-md transition-shadow',
  
  // Status Colors
  STATUS_SUCCESS: 'bg-green-100 text-green-800',
  STATUS_WARNING: 'bg-yellow-100 text-yellow-800',
  STATUS_ERROR: 'bg-red-100 text-red-800',
  STATUS_INFO: 'bg-blue-100 text-blue-800',
  STATUS_NEUTRAL: 'bg-gray-100 text-gray-800',
  
  // Form Elements
  FORM_CONTAINER: 'max-h-[90vh] overflow-y-auto',
  FORM_GRID: 'grid grid-cols-1 md:grid-cols-2 gap-4',
  INPUT_FOCUS: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  
  // Loading States
  LOADING_OVERLAY: 'absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center',
  SKELETON: 'animate-pulse bg-gray-200 rounded',
  
  // Borders & Shadows
  BORDER_DEFAULT: 'border border-gray-200',
  SHADOW_CARD: 'shadow-sm hover:shadow-md transition-shadow',
  SHADOW_DROPDOWN: 'shadow-lg border border-gray-200',
  
  // Text Colors for roles
  ROLE_ADMIN: 'bg-red-100 text-red-800',
  ROLE_MANAGER: 'bg-blue-100 text-blue-800',
  ROLE_TENANT: 'bg-gray-100 text-gray-800',
  ROLE_RESIDENT: 'bg-green-100 text-green-800',
} as const;

export const ICON_SIZES = {
  XS: 'w-3 h-3',
  SM: 'w-4 h-4',
  MD: 'w-5 h-5',
  LG: 'w-6 h-6',
  XL: 'w-8 h-8',
} as const;