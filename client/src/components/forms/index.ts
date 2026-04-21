/**
 * Centralized forms directory for reusable form components.
 *
 * This directory contains all form-related components to ensure:
 * - Easy reusability across the application
 * - Consistent form patterns and validation
 * - Better maintainability and organization.
 *
 * Export all forms from this index file for clean imports.
 */

// Existing form components
export { FeatureForm } from './feature-form';
export { OrganizationForm } from './organization-form';
export { StandardFormField } from './StandardFormField';
export type { StandardFieldType, FieldOption } from './StandardFormField';

// New extracted form components for reducing code duplication
export { PaymentConfigurationSection, BillPaymentConfigSection } from './PaymentConfigurationSection';
export { CustomPaymentManager, useCustomPayments } from './CustomPaymentManager';
export { DocumentUploadTabs, SimpleDocumentUpload } from './DocumentUploadTabs';

// Component types
export type { CustomPayment } from './CustomPaymentManager';

// Future forms can be added here:
// export { UserForm } from './user-form';
// export { PropertyForm } from './property-form';
// export { BillForm } from './bill-form';
