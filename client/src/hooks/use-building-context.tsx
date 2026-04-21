import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { Building } from '@shared/schemas/property';
import { Organization } from '@shared/schemas/core';

// Extended building data with organization details
interface BuildingData extends Building {
  organization?: Organization;
}

// User permissions interface
interface UserPermissions {
  canViewMaintenance: boolean;
  canEditMaintenance: boolean;
  canCreateProjects: boolean;
  canManageDocuments: boolean;
  canViewReports: boolean;
  canManageVendors: boolean;
  role: 'admin' | 'manager' | 'maintenance' | 'resident';
}

// Building context interface
interface BuildingContextType {
  // Current building and organization
  buildingId: string | null;
  organizationId: string | null;
  building: BuildingData | null;
  
  // Building selection
  setBuildingId: (buildingId: string | null) => void;
  setOrganizationId: (organizationId: string | null) => void;
  
  // Available buildings for current user
  availableBuildings: BuildingData[];
  isLoadingBuildings: boolean;
  buildingsError: Error | null;
  
  // User permissions for current building
  permissions: UserPermissions | null;
  isLoadingPermissions: boolean;
  
  // Utility functions
  hasPermission: (permission: keyof UserPermissions) => boolean;
  canAccessBuilding: (buildingId: string) => boolean;
  resetContext: () => void;
}

// Create context
const BuildingContext = createContext<BuildingContextType | undefined>(undefined);

// Default permissions
const defaultPermissions: UserPermissions = {
  canViewMaintenance: false,
  canEditMaintenance: false,
  canCreateProjects: false,
  canManageDocuments: false,
  canViewReports: false,
  canManageVendors: false,
  role: 'resident',
};

// Building context provider props
interface BuildingContextProviderProps {
  children: ReactNode;
  initialBuildingId?: string;
  initialOrganizationId?: string;
}

/**
 * BuildingContext provider for managing building context throughout the maintenance journal
 * Provides current building, organization, and user permissions
 */
export function BuildingContextProvider({
  children,
  initialBuildingId,
  initialOrganizationId,
}: BuildingContextProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const [buildingId, setBuildingId] = useState<string | null>(initialBuildingId || null);
  const [organizationId, setOrganizationId] = useState<string | null>(initialOrganizationId || null);

  // Fetch available buildings for the user
  const {
    data: buildingsResponse,
    isLoading: isLoadingBuildings,
    error: buildingsError,
  } = useQuery({
    queryKey: ['/api/users/me/buildings', user?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users/me/buildings');
      return await response.json();
    },
    enabled: isAuthenticated && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const availableBuildings: BuildingData[] = Array.isArray(buildingsResponse) ? buildingsResponse.map(building => ({
    id: building.id,
    name: building.name,
    address: building.address,
    city: building.city,
    province: building.state || building.province, // Handle both state and province
    postalCode: building.postal_code || building.postalCode, // Handle both formats
    organizationId: building.organization_id || building.organizationId, // Handle both formats
  })) : [];

  // Find current building
  const building = availableBuildings.find(b => b.id === buildingId) || null;

  // Calculate permissions based on user role and building access
  // Note: Permissions are determined locally based on user role since there's no backend endpoint needed
  const isLoadingPermissions = false; // No API call needed, permissions are calculated locally
  const permissions: UserPermissions = (() => {
    if (!user || !building) return defaultPermissions;

    const userRole = user.role as UserPermissions['role'];
    
    // Admin has all permissions
    if (userRole === 'admin') {
      return {
        canViewMaintenance: true,
        canEditMaintenance: true,
        canCreateProjects: true,
        canManageDocuments: true,
        canViewReports: true,
        canManageVendors: true,
        role: userRole,
      };
    }

    // Manager permissions
    if (userRole === 'manager') {
      return {
        canViewMaintenance: true,
        canEditMaintenance: true,
        canCreateProjects: true,
        canManageDocuments: true,
        canViewReports: true,
        canManageVendors: false,
        role: userRole,
      };
    }

    // Maintenance staff permissions
    if (userRole === 'maintenance') {
      return {
        canViewMaintenance: true,
        canEditMaintenance: true,
        canCreateProjects: false,
        canManageDocuments: true,
        canViewReports: false,
        canManageVendors: false,
        role: userRole,
      };
    }

    // Resident permissions (limited)
    return {
      canViewMaintenance: true,
      canEditMaintenance: false,
      canCreateProjects: false,
      canManageDocuments: false,
      canViewReports: false,
      canManageVendors: false,
      role: userRole,
    };
  })();

  // Update organization ID when building changes
  useEffect(() => {
    if (building && building.organizationId !== organizationId) {
      setOrganizationId(building.organizationId);
    }
  }, [building, organizationId]);

  // Auto-select first building if none selected
  useEffect(() => {
    if (!buildingId && availableBuildings.length > 0 && !isLoadingBuildings) {
      setBuildingId(availableBuildings[0].id);
    }
  }, [buildingId, availableBuildings, isLoadingBuildings]);

  // Utility functions
  const hasPermission = (permission: keyof UserPermissions): boolean => {
    return permissions?.[permission] === true;
  };

  const canAccessBuilding = (targetBuildingId: string): boolean => {
    return availableBuildings.some(b => b.id === targetBuildingId);
  };

  const resetContext = () => {
    setBuildingId(null);
    setOrganizationId(null);
  };

  // Handle custom building/organization setting
  const handleSetBuildingId = (newBuildingId: string | null) => {
    if (newBuildingId && !canAccessBuilding(newBuildingId)) {
      console.warn(`User does not have access to building: ${newBuildingId}`);
      return;
    }
    setBuildingId(newBuildingId);
  };

  const handleSetOrganizationId = (newOrganizationId: string | null) => {
    setOrganizationId(newOrganizationId);
    
    // If setting organization ID, clear building ID so user can select appropriate building
    if (newOrganizationId !== organizationId) {
      setBuildingId(null);
    }
  };

  const contextValue: BuildingContextType = {
    // Current building and organization
    buildingId,
    organizationId,
    building,
    
    // Building selection
    setBuildingId: handleSetBuildingId,
    setOrganizationId: handleSetOrganizationId,
    
    // Available buildings
    availableBuildings,
    isLoadingBuildings,
    buildingsError: buildingsError as Error | null,
    
    // User permissions
    permissions,
    isLoadingPermissions,
    
    // Utility functions
    hasPermission,
    canAccessBuilding,
    resetContext,
  };

  return (
    <BuildingContext.Provider value={contextValue}>
      {children}
    </BuildingContext.Provider>
  );
}

/**
 * Hook to access building context
 * Provides current building, organization, and user permissions
 */
export function useBuildingContext(): BuildingContextType {
  const context = useContext(BuildingContext);
  
  if (context === undefined) {
    throw new Error('useBuildingContext must be used within a BuildingContextProvider');
  }
  
  return context;
}

/**
 * Hook to get building selection data
 * Simplified hook for components that only need building selection
 */
export function useBuildingSelection() {
  const { 
    buildingId, 
    organizationId, 
    building, 
    availableBuildings, 
    setBuildingId, 
    setOrganizationId,
    isLoadingBuildings 
  } = useBuildingContext();

  return {
    buildingId,
    organizationId,
    building,
    availableBuildings,
    setBuildingId,
    setOrganizationId,
    isLoadingBuildings,
  };
}

/**
 * Hook to get user permissions for current building
 * Simplified hook for components that only need permission checks
 */
export function useBuildingPermissions() {
  const { permissions, hasPermission, isLoadingPermissions } = useBuildingContext();

  return {
    permissions,
    hasPermission,
    isLoadingPermissions,
    isAdmin: permissions?.role === 'admin',
    isManager: permissions?.role === 'manager',
    isMaintenance: permissions?.role === 'maintenance',
    isResident: permissions?.role === 'resident',
  };
}

// Export types
export type { 
  BuildingData, 
  UserPermissions, 
  BuildingContextType, 
  BuildingContextProviderProps 
};