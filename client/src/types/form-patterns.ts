/**
 * Shared type definitions for common form and modal patterns.
 * Consolidates repeated interface patterns across the application.
 */

/**
 * Standard props for form modals/dialogs.
 * Used across the application to reduce prop interface duplication.
 */
export interface StandardFormModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to handle modal open/close state */
  onOpenChange: (open: boolean) => void;
  /** Mode for the form - determines behavior and validation */
  mode?: 'create' | 'edit' | 'view';
  /** Optional success callback */
  onSuccess?: (data?: any) => void;
  /** Optional cancel callback */
  onCancel?: () => void;
}

/**
 * Standard props for entity forms that work with specific data types.
 * Generic interface to reduce duplication across entity-specific forms.
 */
export interface StandardEntityFormProps<T = any> extends StandardFormModalProps {
  /** The entity being edited, null/undefined for create mode */
  entity?: T | null;
  /** Organization context */
  organizationId?: string;
  /** Building context */
  buildingId?: string;
  /** Residence context */
  residenceId?: string;
}

/**
 * Standard props for forms with loading states.
 * Consolidates common loading and submission patterns.
 */
export interface StandardFormStateProps {
  /** Whether the form is currently submitting */
  isSubmitting?: boolean;
  /** Loading state for data fetching */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Success message to display */
  success?: string | null;
  /** Submit button text */
  submitText?: string;
  /** Loading state text */
  loadingText?: string;
}

/**
 * Standard search and filter props.
 * Reduces duplication in list/table components with filtering.
 */
export interface StandardSearchFilterProps {
  /** Search term */
  searchTerm?: string;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Filter values */
  filters?: Record<string, any>;
  /** Callback for search term changes */
  onSearchChange?: (term: string) => void;
  /** Callback for filter changes */
  onFilterChange?: (key: string, value: any) => void;
  /** Callback to clear all filters */
  onClearFilters?: () => void;
}

/**
 * Standard table/list item action props.
 * Consolidates common CRUD action patterns.
 */
export interface StandardItemActionsProps<T = any> {
  /** The item to perform actions on */
  item: T;
  /** Edit action callback */
  onEdit?: (item: T) => void;
  /** Delete action callback */
  onDelete?: (item: T) => void;
  /** View details action callback */
  onView?: (item: T) => void;
  /** Additional custom actions */
  customActions?: Array<{
    label: string;
    icon?: React.ComponentType;
    onClick: (item: T) => void;
    variant?: 'default' | 'destructive';
  }>;
}

/**
 * Common validation patterns used across forms.
 * Consolidates repeated validation logic.
 */
export const commonValidationPatterns = {
  /** Standard email validation */
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  /** Phone number validation (flexible) */
  phone: /^[\+]?[1-9][\d]{0,15}$/,
  /** Postal code validation (Canada) */
  postalCode: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
  /** Currency amount validation */
  currency: /^\d+(\.\d{1,2})?$/,
} as const;

/**
 * Common validation messages in both languages.
 * Reduces duplication of validation error messages.
 */
export const commonValidationMessages = {
  required: {
    en: 'This field is required',
    fr: 'Ce champ est requis',
  },
  invalidEmail: {
    en: 'Please enter a valid email address',
    fr: 'Veuillez entrer une adresse e-mail valide',
  },
  invalidPhone: {
    en: 'Please enter a valid phone number',
    fr: 'Veuillez entrer un numéro de téléphone valide',
  },
  invalidPostalCode: {
    en: 'Please enter a valid postal code',
    fr: 'Veuillez entrer un code postal valide',
  },
  invalidAmount: {
    en: 'Please enter a valid amount',
    fr: 'Veuillez entrer un montant valide',
  },
  tooLong: {
    en: 'This field is too long',
    fr: 'Ce champ est trop long',
  },
  tooShort: {
    en: 'This field is too short',
    fr: 'Ce champ est trop court',
  },
} as const;