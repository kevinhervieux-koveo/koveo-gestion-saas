import React from 'react';
import { useLocation, useSearch } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { SelectionGrid, SelectionGridItem } from '@/components/common/SelectionGrid';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

/**
 * Configuration for the hierarchical selection flow
 */
interface HierarchyConfig {
  hierarchy: ('organization' | 'building' | 'residence')[];
}

/**
 * Props passed to the wrapped component with selected IDs and back navigation
 */
interface HierarchyProps {
  organizationId?: string;
  buildingId?: string;
  residenceId?: string;
  // Back navigation props
  showBackButton?: boolean;
  backButtonLabel?: string;
  onBack?: () => void;
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
      // Location effect for debugging
    }, [location, search]);
    
    // Parse URL query parameters using wouter's useSearch
    const urlParams = new URLSearchParams(search);
    const organizationId = urlParams.get('organization');
    const buildingId = urlParams.get('building');
    const residenceId = urlParams.get('residence');

    // Determine current selection level
    const currentLevel = getCurrentLevel(config.hierarchy, { organizationId, buildingId, residenceId });
    
    
    
    // Navigate to update URL parameters
    const navigate = (updates: Record<string, string | null>) => {
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

    // Fetch buildings (with optional common spaces filter for common-spaces page)
    const {
      data: buildings = [],
      isLoading: isLoadingBuildings
    } = useQuery<Building[]>({
      queryKey: organizationId ? ['/api/organizations', organizationId, 'buildings'] : ['/api/users/me/buildings'],
      queryFn: async () => {
        const url = organizationId 
          ? `/api/organizations/${organizationId}/buildings`
          : '/api/users/me/buildings';
        
        // Add common spaces filter for common-spaces page
        const isCommonSpacesPage = window.location.pathname.includes('common-spaces');
        const fullUrl = isCommonSpacesPage ? `${url}?has_common_spaces=true` : url;
        
        const response = await fetch(fullUrl);
        if (!response.ok) {
          throw new Error('Failed to fetch buildings');
        }
        return response.json();
      },
      enabled: (currentLevel === 'building' || currentLevel === 'complete') && (!!organizationId || config.hierarchy.length === 1),
      staleTime: 0
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
        navigate({ organization: organizations[0].id });
        return;
      }
      
      if (currentLevel === 'building' && buildings.length === 1 && !buildingId) {
        // Auto-forward if only one building (preserve organization)  
        navigate({ organization: organizationId, building: buildings[0].id });
        return;
      }
      
      if (currentLevel === 'residence' && residences.length === 1 && !residenceId) {
        // Auto-forward if only one residence (preserve organization and building)
        navigate({ organization: organizationId, building: buildingId, residence: residences[0].id });
        return;
      }
    }, [organizations.length, buildings.length, residences.length, currentLevel, organizationId, buildingId, residenceId]);

    // Handle selection
    const handleSelection = (id: string) => {      
      if (currentLevel === 'organization') {
        navigate({ organization: id });
      } else if (currentLevel === 'building') {
        // Preserve organization when selecting building
        navigate({ organization: organizationId, building: id });
      } else if (currentLevel === 'residence') {
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
        <div className='flex-1 flex flex-col overflow-hidden'>
          <Header title={t('billsManagement' as any)} subtitle={t('selectOrganization' as any)} />
          <div className='flex-1 overflow-auto p-6'>
            <SelectionGrid
              title=""
              items={items}
              onSelectItem={handleSelection}
              onBack={null}
              isLoading={isLoadingOrganizations || isLoadingBuildingCounts}
            />
          </div>
        </div>
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
        <div className='flex-1 flex flex-col overflow-hidden'>
          <Header title={t('billsManagement' as any)} subtitle={t('selectBuilding' as any)} />
          
          {/* Back to Organization Navigation - only show if user has multiple organizations */}
          {config.hierarchy.includes('organization') && organizations.length > 1 && (
            <div className="px-6 pt-6 pb-0">
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex items-center gap-2"
                data-testid="button-back-to-organization"
              >
                <ArrowLeft className="w-4 h-4" />
                Organization
              </Button>
            </div>
          )}
          
          <div className='flex-1 overflow-auto p-6'>
            <SelectionGrid
              title=""
              items={items}
              onSelectItem={handleSelection}
              onBack={null}
              isLoading={isLoadingBuildings}
            />
          </div>
        </div>
      );
    }

    if (currentLevel === 'residence') {
      const items: SelectionGridItem[] = residences.map(residence => ({
        id: residence.id,
        name: `${t('unit' as any)} ${residence.unitNumber}`,
        details: residence.buildingName,
        type: 'residence'
      }));

      // Determine if we should show back button to building level
      const showBackToBuilding = config.hierarchy.includes('building') && buildings.length > 1;

      return (
        <div className='flex-1 flex flex-col overflow-hidden'>
          <Header title={t('billsManagement' as any)} subtitle={t('selectResidence' as any)} />
          
          {/* Back to Building Navigation - only show if user has multiple buildings */}
          {showBackToBuilding && (
            <div className="px-6 pt-6 pb-0">
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex items-center gap-2"
                data-testid="button-back-to-building"
              >
                <ArrowLeft className="w-4 h-4" />
                Building
              </Button>
            </div>
          )}
          
          <div className='flex-1 overflow-auto p-6'>
            <SelectionGrid
              title=""
              items={items}
              onSelectItem={handleSelection}
              onBack={null}
              isLoading={isLoadingResidences}
            />
          </div>
        </div>
      );
    }

    // All required selections are complete - render the wrapped component
    // Determine back navigation props
    const getBackNavigationProps = () => {
      // For residents with building hierarchy, always show back button if they have a buildingId
      // This means they selected a building and should be able to go back
      if (config.hierarchy.includes('building') && config.hierarchy.length === 1 && buildingId && buildings.length > 1) {
        return {
          showBackButton: true,
          backButtonLabel: 'Building',
          onBack: () => {
            const basePath = location.split('?')[0];
            window.history.pushState(null, '', basePath);
            setLocation(basePath);
          }
        };
      }
      
      // Check if we should show back to building for multi-level hierarchies
      if (config.hierarchy.includes('building') && buildings.length > 1 && buildingId) {
        return {
          showBackButton: true,
          backButtonLabel: 'Building',
          onBack: () => {
            navigate({ building: null, residence: null });
          }
        };
      }
      
      // Check if we should show back to organization  
      if (config.hierarchy.includes('organization') && organizations.length > 1 && organizationId) {
        return {
          showBackButton: true,
          backButtonLabel: 'Organization',
          onBack: () => navigate({ organization: null, building: null, residence: null })
        };
      }
      
      return {
        showBackButton: false,
        backButtonLabel: undefined,
        onBack: undefined
      };
    };

    const backNavProps = getBackNavigationProps();

    return (
      <WrappedComponent
        {...props}
        organizationId={organizationId || undefined}
        buildingId={buildingId || undefined}
        residenceId={residenceId || undefined}
        {...backNavProps}
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
    
    // For building level, check if we need organization context
    if (level === 'building' && !buildingId) {
      // If organization is in hierarchy, we need organizationId first
      if (hierarchy.includes('organization') && !organizationId) {
        return 'organization';
      }
      // Otherwise, go directly to building selection
      return 'building';
    }
    
    if (level === 'residence' && !residenceId) {
      // Need both organization and building if they're in hierarchy
      if (hierarchy.includes('organization') && !organizationId) {
        return 'organization';
      }
      if (hierarchy.includes('building') && !buildingId) {
        return 'building';
      }
      return 'residence';
    }
  }

  // All required levels in the hierarchy have been satisfied
  return 'complete';
}