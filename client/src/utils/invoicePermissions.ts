/**
 * Invoice Permission Utilities
 * 
 * Centralized logic for determining user permissions for invoice operations.
 * Follows the existing permission patterns used throughout the application.
 */

export interface InvoicePermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
  canExtractData: boolean; // AI-powered data extraction
}

export interface User {
  id: string;
  role: 'admin' | 'manager' | 'resident' | 'tenant';
  organizationId?: string;
}

export interface Invoice {
  id: string;
  createdBy: string;
  buildingId?: string;
  residenceId?: string;
}

/**
 * Calculate invoice permissions for a user based on their role and relationship to the invoice
 */
export function getInvoicePermissions(
  user: User | null | undefined,
  invoice?: Invoice
): InvoicePermissions {
  if (!user) {
    return {
      canView: false,
      canEdit: false,
      canDelete: false,
      canCreate: false,
      canExtractData: false,
    };
  }

  const { role, id: userId } = user;
  const isOwner = invoice?.createdBy === userId;

  switch (role) {
    case 'admin':
      return {
        canView: true,
        canEdit: true,
        canDelete: true,
        canCreate: true,
        canExtractData: true,
      };

    case 'manager':
      return {
        canView: true,
        canEdit: true,
        canDelete: true, // Managers can delete invoices in their organization
        canCreate: true,
        canExtractData: true,
      };

    case 'resident':
      return {
        canView: isOwner || !invoice, // Can view own invoices or when no specific invoice context
        canEdit: isOwner,
        canDelete: isOwner,
        canCreate: true, // Residents can create invoices for their units
        canExtractData: true, // Allow residents to use AI extraction
      };

    case 'tenant':
      return {
        canView: isOwner || !invoice, // Can view own invoices
        canEdit: false, // Tenants have read-only access to most features
        canDelete: false,
        canCreate: false, // Tenants cannot create invoices
        canExtractData: false, // Limited AI access for tenants
      };

    default:
      return {
        canView: false,
        canEdit: false,
        canDelete: false,
        canCreate: false,
        canExtractData: false,
      };
  }
}

/**
 * Check if user can access invoices for a specific building/residence
 */
export function canAccessInvoiceContext(
  user: User | null | undefined,
  buildingId?: string,
  residenceId?: string
): boolean {
  if (!user) return false;

  const { role } = user;

  switch (role) {
    case 'admin':
      return true; // Admin can access all contexts

    case 'manager':
      return true; // Managers can access all buildings in their organization

    case 'resident':
    case 'tenant':
      // For residents/tenants, they should only access their own residence
      // This would need to be enhanced with actual user-residence relationships
      return true; // Simplified for now - would need proper context checking

    default:
      return false;
  }
}

/**
 * Get user-friendly permission messages
 */
export function getPermissionMessage(
  user: User | null | undefined,
  action: keyof InvoicePermissions
): string {
  if (!user) {
    return 'You must be logged in to perform this action.';
  }

  const messages: Record<string, Record<string, string>> = {
    canCreate: {
      tenant: 'Only residents and managers can create invoices.',
      default: 'You do not have permission to create invoices.',
    },
    canEdit: {
      tenant: 'Tenants cannot edit invoices.',
      resident: 'You can only edit invoices you created.',
      default: 'You do not have permission to edit this invoice.',
    },
    canDelete: {
      tenant: 'Tenants cannot delete invoices.',
      resident: 'You can only delete invoices you created.',
      default: 'You do not have permission to delete this invoice.',
    },
    canExtractData: {
      tenant: 'AI data extraction is not available for tenant accounts.',
      default: 'You do not have permission to use AI data extraction.',
    },
  };

  const roleMessages = messages[action];
  return roleMessages?.[user.role] || roleMessages?.default || 'Permission denied.';
}