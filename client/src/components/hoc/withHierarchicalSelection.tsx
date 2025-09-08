import React from 'react';
import { useLocation, useSearch } from 'wouter';
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
    const search = useSearch();
    const { t } = useLanguage();
    
    // Force re-render when location changes
    React.useEffect(() => {
      console.log('📍 [HIERARCHY DEBUG] Location changed:', location);
      console.log('📍 [HIERARCHY DEBUG] Search changed:', search);
    }, [location, search]);
    
    // Parse URL query parameters using wouter's useSearch
    const urlParams = new URLSearchParams(search);
    const organizationId = urlParams.get('organization');
    const buildingId = urlParams.get('building');
    const residenceId = urlParams.get('residence');

    // DEBUG: Log current URL state  
    console.log('🔍 [HIERARCHY DEBUG] Current location:', location);
    console.log('🔍 [HIERARCHY DEBUG] Search params:', search);
    console.log('🔍 [HIERARCHY DEBUG] URL params:', {
      organizationId,
      buildingId,
      residenceId,
      hierarchy: config.hierarchy
    });

    // Determine current selection level
    const currentLevel = getCurrentLevel(config.hierarchy, { organizationId, buildingId, residenceId });
    console.log('🔍 [HIERARCHY DEBUG] Current level:', currentLevel);
    
    // Navigate to update URL parameters
    const navigate = (updates: Record<string, string | null>) => {
      console.log('🚀 [HIERARCHY DEBUG] Navigate called with updates:', updates);
      
      // Start with current URL params
      const currentSearchParams = location.includes('?') ? location.split('?')[1] : '';
      const newParams = new URLSearchParams(currentSearchParams);
      
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null) {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      });

      const newSearch = newParams.toString();
      const basePath = location.split('?')[0];
      const newUrl = newSearch ? `${basePath}?${newSearch}` : basePath;
      
      console.log('🚀 [HIERARCHY DEBUG] Current searchParams:', currentSearchParams);
      console.log('🚀 [HIERARCHY DEBUG] Navigating from:', location);
      console.log('🚀 [HIERARCHY DEBUG] Navigating to:', newUrl);
      
      setLocation(newUrl);
    };

    // Fetch organizations
    const {
      data: organizations = [],
      isLoading: isLoadingOrganizations
    } = useQuery<Organization[]>({
      queryKey: ['/api/users/me/organizations'],
      enabled: currentLevel === 'organization'
    });

    // Fetch building counts for each organization when at organization level
    const {
      data: buildingCounts = {},
      isLoading: isLoadingBuildingCounts
    } = useQuery<Record<string, number>>({
      queryKey: ['/api/organizations/building-counts'],
      enabled: currentLevel === 'organization' && organizations.length > 0,
      queryFn: async () => {
        const counts: Record<string, number> = {};
        
        // Fetch building count for each organization
        for (const org of organizations) {
          try {
            const response = await fetch(`/api/organizations/${org.id}/buildings`);
            if (response.ok) {
              const buildings = await response.json();
              counts[org.id] = buildings.length;
            } else {
              counts[org.id] = 0;
            }
          } catch (error) {
            console.error(`Failed to fetch building count for org ${org.id}:`, error);
            counts[org.id] = 0;
          }
        }
        
        return counts;
      }
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
      console.log('⚡ [HIERARCHY DEBUG] Auto-forward check:', {
        currentLevel,
        organizationsCount: organizations.length,
        buildingsCount: buildings.length,
        residencesCount: residences.length,
        organizationId,
        buildingId,
        residenceId
      });
      
      if (currentLevel === 'organization' && organizations.length === 1 && !organizationId) {
        // Auto-forward if only one organization
        console.log('⚡ [HIERARCHY DEBUG] Auto-forwarding to organization:', organizations[0].id);
        navigate({ organization: organizations[0].id });
        return;
      }
      
      if (currentLevel === 'building' && buildings.length === 1 && !buildingId) {
        // Auto-forward if only one building (preserve organization)
        console.log('⚡ [HIERARCHY DEBUG] Auto-forwarding to building:', buildings[0].id);
        navigate({ organization: organizationId, building: buildings[0].id });
        return;
      }
      
      if (currentLevel === 'residence' && residences.length === 1 && !residenceId) {
        // Auto-forward if only one residence (preserve organization and building)
        console.log('⚡ [HIERARCHY DEBUG] Auto-forwarding to residence:', residences[0].id);
        navigate({ organization: organizationId, building: buildingId, residence: residences[0].id });
        return;
      }
    }, [organizations, buildings, residences, currentLevel, organizationId, buildingId, residenceId]);

    // Handle selection
    const handleSelection = (id: string) => {
      console.log('✅ [HIERARCHY DEBUG] handleSelection called:', { id, currentLevel });
      
      if (currentLevel === 'organization') {
        console.log('✅ [HIERARCHY DEBUG] Selecting organization:', id);
        navigate({ organization: id });
      } else if (currentLevel === 'building') {
        console.log('✅ [HIERARCHY DEBUG] Selecting building:', id);
        // Preserve organization when selecting building
        navigate({ organization: organizationId, building: id });
      } else if (currentLevel === 'residence') {
        console.log('✅ [HIERARCHY DEBUG] Selecting residence:', id);
        // Preserve organization and building when selecting residence
        navigate({ organization: organizationId, building: buildingId, residence: id });
      }
    };

    // Handle back navigation
    const handleBack = () => {
      if (currentLevel === 'building') {
        navigate({ organization: null, building: null, residence: null });
      } else if (currentLevel === 'residence') {
        navigate({ building: null, residence: null });
      }
    };

    // Render selection screens
    if (currentLevel === 'organization') {
      const items: SelectionGridItem[] = organizations.map(org => {
        const buildingCount = buildingCounts[org.id] ?? 0;
        const hasBuildings = buildingCount > 0;
        
        return {
          id: org.id,
          name: org.name,
          details: hasBuildings 
            ? `${buildingCount} building${buildingCount !== 1 ? 's' : ''}` 
            : 'No buildings available',
          type: 'organization' as const,
          disabled: !hasBuildings,
          disabledReason: hasBuildings ? undefined : 'No Buildings'
        };
      });

      return (
        <SelectionGrid
          title={t('selectOrganization' as any)}
          items={items}
          onSelectItem={handleSelection}
          onBack={null}
          isLoading={isLoadingOrganizations || isLoadingBuildingCounts}
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

  // Check each level in the hierarchy in order
  for (let i = 0; i < hierarchy.length; i++) {
    const level = hierarchy[i];
    
    if (level === 'organization' && !organizationId) {
      return 'organization';
    }
    
    if (level === 'building' && organizationId && !buildingId) {
      return 'building';
    }
    
    if (level === 'residence' && organizationId && buildingId && !residenceId) {
      return 'residence';
    }
  }

  return 'complete';
}