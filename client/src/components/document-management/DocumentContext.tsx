import React, { createContext, useContext, useMemo } from 'react';

interface User {
  id: string;
  role: 'admin' | 'manager' | 'resident' | 'tenant';
}

interface DocumentPermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManage: boolean;
}

interface DocumentContextValue {
  user: User | null;
  permissions: DocumentPermissions;
  
  // Helper functions for common permission patterns
  getEntityPermissions: (entityType: string, entityId: string, userRole?: string) => DocumentPermissions;
  checkAccess: (action: 'view' | 'create' | 'edit' | 'delete' | 'manage', entityType?: string) => boolean;
}

const DocumentContext = createContext<DocumentContextValue | null>(null);

interface DocumentProviderProps {
  children: React.ReactNode;
  user: User | null;
  organizationId?: string;
  buildingId?: string;
  residenceId?: string;
}

/**
 * DocumentProvider - Provides consistent access control for documents across all entity types
 * Centralizes permission logic to ensure consistent behavior
 */
export function DocumentProvider({ 
  children, 
  user, 
  organizationId, 
  buildingId, 
  residenceId 
}: DocumentProviderProps) {
  
  const getEntityPermissions = useMemo(() => 
    (entityType: string, entityId: string, userRole?: string): DocumentPermissions => {
      const role = userRole || user?.role;
      
      if (!role || !user) {
        return {
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
          canManage: false,
        };
      }

      // Admin has full access to everything
      if (role === 'admin') {
        return {
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
          canManage: true,
        };
      }

      // Manager permissions depend on organization scope
      if (role === 'manager') {
        const hasOrgAccess = organizationId ? true : false; // In real app, check if manager belongs to org
        
        switch (entityType) {
          case 'organization':
            return {
              canView: hasOrgAccess,
              canCreate: hasOrgAccess,
              canEdit: hasOrgAccess,
              canDelete: hasOrgAccess,
              canManage: hasOrgAccess,
            };
          case 'building':
          case 'element':
          case 'project':
            return {
              canView: hasOrgAccess,
              canCreate: hasOrgAccess,
              canEdit: hasOrgAccess,
              canDelete: hasOrgAccess,
              canManage: hasOrgAccess,
            };
          case 'residence':
            return {
              canView: hasOrgAccess,
              canCreate: hasOrgAccess,
              canEdit: hasOrgAccess,
              canDelete: false, // Residents manage their own documents
              canManage: hasOrgAccess,
            };
          default:
            return {
              canView: hasOrgAccess,
              canCreate: hasOrgAccess,
              canEdit: hasOrgAccess,
              canDelete: hasOrgAccess,
              canManage: hasOrgAccess,
            };
        }
      }

      // Resident permissions - can manage their own residence documents
      if (role === 'resident') {
        const isOwnResidence = residenceId === entityId;
        const canViewBuilding = buildingId ? true : false; // Can view building docs marked as visible
        
        switch (entityType) {
          case 'residence':
            return {
              canView: isOwnResidence,
              canCreate: isOwnResidence,
              canEdit: isOwnResidence,
              canDelete: isOwnResidence,
              canManage: isOwnResidence,
            };
          case 'building':
            return {
              canView: canViewBuilding, // Only if marked as visible to tenants
              canCreate: false,
              canEdit: false,
              canDelete: false,
              canManage: false,
            };
          default:
            return {
              canView: false,
              canCreate: false,
              canEdit: false,
              canDelete: false,
              canManage: false,
            };
        }
      }

      // Tenant permissions - very limited, view-only for visible documents
      if (role === 'tenant') {
        const canViewBuilding = buildingId ? true : false;
        
        switch (entityType) {
          case 'building':
            return {
              canView: canViewBuilding, // Only if marked as visible to tenants
              canCreate: false,
              canEdit: false,
              canDelete: false,
              canManage: false,
            };
          default:
            return {
              canView: false,
              canCreate: false,
              canEdit: false,
              canDelete: false,
              canManage: false,
            };
        }
      }

      // Default: no permissions
      return {
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canManage: false,
      };
    }, [user, organizationId, buildingId, residenceId]
  );

  const checkAccess = useMemo(() => 
    (action: 'view' | 'create' | 'edit' | 'delete' | 'manage', entityType?: string): boolean => {
      if (!user) return false;
      
      // For general access, use current context
      const permissions = getEntityPermissions(entityType || 'general', '', user.role);
      
      switch (action) {
        case 'view':
          return permissions.canView;
        case 'create':
          return permissions.canCreate;
        case 'edit':
          return permissions.canEdit;
        case 'delete':
          return permissions.canDelete;
        case 'manage':
          return permissions.canManage;
        default:
          return false;
      }
    }, [user, getEntityPermissions]
  );

  const permissions = useMemo((): DocumentPermissions => {
    return getEntityPermissions('general', '');
  }, [getEntityPermissions]);

  const value = useMemo((): DocumentContextValue => ({
    user,
    permissions,
    getEntityPermissions,
    checkAccess,
  }), [user, permissions, getEntityPermissions, checkAccess]);

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}

/**
 * Hook to access document context and permissions
 */
export function useDocumentContext() {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocumentContext must be used within a DocumentProvider');
  }
  return context;
}

/**
 * Hook to get permissions for a specific entity
 */
export function useDocumentPermissions(entityType: string, entityId: string) {
  const { getEntityPermissions } = useDocumentContext();
  return useMemo(() => 
    getEntityPermissions(entityType, entityId), 
    [getEntityPermissions, entityType, entityId]
  );
}