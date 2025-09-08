import React from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { SelectionGrid, SelectionGridItem } from '@/components/common/SelectionGrid';
import { useLanguage } from '@/hooks/use-language';

/**
 * Configuration for the hierarchical selection flow
 */
interface HierarchyConfig {
  hierarchy: ('organization' | 'building' | 'residence')[];
}

/**
 * Props passed to the wrapped component with selected IDs
 */
interface HierarchyProps {
  organizationId?: string;
  buildingId?: string;
  residenceId?: string;
}

/**
 * API data structures
 */
interface Organization {
  id: string;
  name: string;
  description: string;
}

interface Building {
  id: string;
  name: string;
  address: string;
}

interface Residence {
  id: string;
  unitNumber: string;
  buildingName: string;
}

/**
 * Higher-Order Component for hierarchical selection flow
 * Handles Organization → Building → Residence selection logic
 */
export function withHierarchicalSelection<T extends object>(
  WrappedComponent: React.ComponentType<T & HierarchyProps>,
  config: HierarchyConfig
) {
  return function HierarchicalSelectionWrapper(props: T) {
    const [location, setLocation] = useLocation();
    const { t } = useLanguage();
    
    // Parse URL query parameters
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const organizationId = urlParams.get('organizationId');
    const buildingId = urlParams.get('buildingId');
    const residenceId = urlParams.get('residenceId');

    // Determine current selection level
    const currentLevel = getCurrentLevel(config.hierarchy, { organizationId, buildingId, residenceId });
    
    // Navigate to update URL parameters
    const navigate = (updates: Record<string, string | null>) => {
      const newParams = new URLSearchParams(urlParams);
      
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null) {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      });

      const newSearch = newParams.toString();
      const basePath = location.split('?')[0];
      setLocation(newSearch ? `${basePath}?${newSearch}` : basePath);
    };

    // Fetch organizations
    const {
      data: organizations = [],
      isLoading: isLoadingOrganizations
    } = useQuery<Organization[]>({
      queryKey: ['/api/users/me/organizations'],
      enabled: currentLevel === 'organization'
    });

    // Fetch buildings
    const {
      data: buildings = [],
      isLoading: isLoadingBuildings
    } = useQuery<Building[]>({
      queryKey: ['/api/organizations', organizationId, 'buildings'],
      enabled: currentLevel === 'building' && !!organizationId
    });

    // Fetch residences
    const {
      data: residences = [],
      isLoading: isLoadingResidences
    } = useQuery<Residence[]>({
      queryKey: ['/api/buildings', buildingId, 'residences'],
      enabled: currentLevel === 'residence' && !!buildingId
    });

    // Auto-forwarding logic
    React.useEffect(() => {
      if (currentLevel === 'organization' && organizations.length === 1 && !organizationId) {
        // Auto-forward if only one organization
        navigate({ organizationId: organizations[0].id });
        return;
      }
      
      if (currentLevel === 'building' && buildings.length === 1 && !buildingId) {
        // Auto-forward if only one building
        navigate({ buildingId: buildings[0].id });
        return;
      }
      
      if (currentLevel === 'residence' && residences.length === 1 && !residenceId) {
        // Auto-forward if only one residence
        navigate({ residenceId: residences[0].id });
        return;
      }
    }, [organizations, buildings, residences, currentLevel, organizationId, buildingId, residenceId]);

    // Handle selection
    const handleSelection = (id: string) => {
      if (currentLevel === 'organization') {
        navigate({ organizationId: id });
      } else if (currentLevel === 'building') {
        navigate({ buildingId: id });
      } else if (currentLevel === 'residence') {
        navigate({ residenceId: id });
      }
    };

    // Handle back navigation
    const handleBack = () => {
      if (currentLevel === 'building') {
        navigate({ organizationId: null, buildingId: null, residenceId: null });
      } else if (currentLevel === 'residence') {
        navigate({ buildingId: null, residenceId: null });
      }
    };

    // Render selection screens
    if (currentLevel === 'organization') {
      const items: SelectionGridItem[] = organizations.map(org => ({
        id: org.id,
        name: org.name,
        details: org.description || t('organizationDescription' as any),
        type: 'organization'
      }));

      return (
        <SelectionGrid
          title={t('selectOrganization' as any)}
          items={items}
          onSelectItem={handleSelection}
          onBack={null}
          isLoading={isLoadingOrganizations}
        />
      );
    }

    if (currentLevel === 'building') {
      const items: SelectionGridItem[] = buildings.map(building => ({
        id: building.id,
        name: building.name,
        details: building.address,
        type: 'building'
      }));

      return (
        <SelectionGrid
          title={t('selectBuilding' as any)}
          items={items}
          onSelectItem={handleSelection}
          onBack={config.hierarchy.includes('organization') ? handleBack : null}
          isLoading={isLoadingBuildings}
        />
      );
    }

    if (currentLevel === 'residence') {
      const items: SelectionGridItem[] = residences.map(residence => ({
        id: residence.id,
        name: `${t('unit' as any)} ${residence.unitNumber}`,
        details: residence.buildingName,
        type: 'residence'
      }));

      return (
        <SelectionGrid
          title={t('selectResidence' as any)}
          items={items}
          onSelectItem={handleSelection}
          onBack={handleBack}
          isLoading={isLoadingResidences}
        />
      );
    }

    // All required selections are complete - render the wrapped component
    return (
      <WrappedComponent
        {...props}
        organizationId={organizationId || undefined}
        buildingId={buildingId || undefined}
        residenceId={residenceId || undefined}
      />
    );
  };
}

/**
 * Determine the current selection level based on hierarchy and available IDs
 */
function getCurrentLevel(
  hierarchy: ('organization' | 'building' | 'residence')[],
  ids: { organizationId: string | null; buildingId: string | null; residenceId: string | null }
): 'organization' | 'building' | 'residence' | 'complete' {
  const { organizationId, buildingId, residenceId } = ids;

  // Check each level in the hierarchy
  for (let i = 0; i < hierarchy.length; i++) {
    const level = hierarchy[i];
    
    if (level === 'organization' && !organizationId) {
      return 'organization';
    }
    
    if (level === 'building' && !buildingId) {
      return 'building';
    }
    
    if (level === 'residence' && !residenceId) {
      return 'residence';
    }
  }

  return 'complete';
}