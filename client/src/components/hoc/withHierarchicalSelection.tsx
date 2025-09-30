import React from 'react';
import { useLocation, useSearch } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { SelectionGrid, SelectionGridItem } from '@/components/common/SelectionGrid';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';

/**
 * Configuration for the hierarchical selection flow
 */
interface HierarchyConfig {
  hierarchy: ('organization' | 'building' | 'residence')[];
  checkResidenceAccess?: boolean;
  title?: string; // Custom title for the page
  subtitle?: string; // Custom subtitle for the page
}

/**
 * Props passed to the wrapped component with selected IDs and back navigation
 */
interface HierarchyProps {
  organizationId?: string;
  buildingId?: string;
  residenceId?: string;
  buildingName?: string; // Add building name
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
    const { user } = useAuth();
    
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
      enabled: Boolean(currentLevel === 'organization'),
      staleTime: 5 * 60 * 1000, // 5 minutes cache
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
      retry: 2,
      retryDelay: 1000
    });

    // Fetch accessible building counts for each organization (bottom up logic)
    const {
      data: buildingCounts = {},
      isLoading: isLoadingBuildingCounts,
      error: buildingCountsError
    } = useQuery<Record<string, number>>({
      queryKey: ['/api/organizations/accessible-building-counts', user?.role, config.checkResidenceAccess || false],
      enabled: Boolean(currentLevel === 'organization' && organizations.length > 0),
      staleTime: 2 * 60 * 1000, // 2 minutes cache (shorter for better consistency)
      gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
      retry: 2,
      retryDelay: 1000,
      queryFn: async () => {
        // Use explicit config flag instead of pathname detection
        const params = new URLSearchParams();
        
        if (config.checkResidenceAccess) {
          params.append('checkResidenceAccess', 'true');
        }
        
        const url = `/api/organizations/accessible-building-counts${params.toString() ? `?${params.toString()}` : ''}`;
        
        const response = await fetch(url, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch building counts: ${response.status}`);
        }
        
        const counts = await response.json();
        return counts;
      }
    });


    // Fetch buildings with proper filtering (bottom up logic)
    const {
      data: buildings = [],
      isLoading: isLoadingBuildings,
      error: buildingsError
    } = useQuery<Building[]>({
      queryKey: organizationId ? ['/api/users/me/buildings', organizationId, config.checkResidenceAccess || false] : ['/api/users/me/buildings', config.checkResidenceAccess || false],
      queryFn: async () => {
        // Always use the user-specific endpoint for residents/tenants to ensure proper access control
        const isResidentOrTenant = ['resident', 'tenant', 'demo_resident', 'demo_tenant'].includes(user?.role || '');
        
        const url = (organizationId && !isResidentOrTenant)
          ? `/api/organizations/${organizationId}/buildings`
          : '/api/users/me/buildings';
        
        // Add filters based on explicit config flags
        const isCommonSpacesPage = window.location.pathname.includes('common-spaces');
        
        const params = new URLSearchParams();
        
        if (isCommonSpacesPage) {
          params.append('has_common_spaces', 'true');
        }
        
        // For user endpoint, add organization filter if needed
        if (organizationId && url.includes('/api/users/me/buildings')) {
          params.append('organization_id', organizationId);
        }
        
        const fullUrl = `${url}${params.toString() ? `?${params.toString()}` : ''}`;
        
        const response = await fetch(fullUrl, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch buildings: ${response.status}`);
        }
        
        let allBuildings = await response.json();
        
        // For residence access mode, filter buildings that have accessible residences
        // This is the key bottom-up filtering logic
        if (config.checkResidenceAccess) {
          const buildingsWithResidences = [];
          
          for (const building of allBuildings) {
            try {
              const residenceUrl = isResidentOrTenant 
                ? `/api/users/me/residences?building_id=${building.id}`
                : `/api/buildings/${building.id}/residences`;
                
              const residenceResponse = await fetch(residenceUrl, {
                credentials: 'include'
              });
              
              if (residenceResponse.ok) {
                const residences = await residenceResponse.json();
                if (residences.length > 0) {
                  buildingsWithResidences.push(building);
                }
              }
            } catch (error) {
              // Continue with next building if error occurs
            }
          }
          
          return buildingsWithResidences;
        }
        
        return allBuildings;
      },
      enabled: Boolean(
        (currentLevel === 'building' || currentLevel === 'complete' || (buildingId && config.hierarchy.includes('building'))) && 
        (!!organizationId || config.hierarchy.length === 1)
      ),
      staleTime: 2 * 60 * 1000, // 2 minutes cache (shorter for better consistency)
      gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
      retry: 2,
      retryDelay: 1000
    });


    // Fetch residences using secure user-specific endpoint for residents
    const {
      data: residences = [],
      isLoading: isLoadingResidences,
      error: residencesError
    } = useQuery<Residence[]>({
      queryKey: ['residences', buildingId, user?.role],
      queryFn: async () => {
        const isResidentOrTenant = ['resident', 'tenant', 'demo_resident', 'demo_tenant'].includes(user?.role || '');
        
        const url = isResidentOrTenant 
          ? `/api/users/me/residences?building_id=${buildingId}`
          : `/api/buildings/${buildingId}/residences`;
          
        const response = await fetch(url, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch residences: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
      },
      enabled: Boolean(currentLevel === 'residence' && !!buildingId),
      staleTime: 2 * 60 * 1000, // 2 minutes cache (shorter for better consistency)
      gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
      retry: 2,
      retryDelay: 1000
    });


    // Auto-forwarding logic
    React.useEffect(() => {
      if (currentLevel === 'organization' && organizations.length === 1 && !organizationId && !isLoadingOrganizations) {
        // Auto-forward if only one organization
        navigate({ organization: organizations[0].id });
        return;
      }
      
      if (currentLevel === 'building' && buildings.length === 1 && !buildingId && !isLoadingBuildings) {
        // Auto-forward if only one building (preserve organization)  
        navigate({ organization: organizationId, building: buildings[0].id });
        return;
      }
      
      if (currentLevel === 'residence' && residences.length === 1 && !residenceId && !isLoadingResidences) {
        // Auto-forward if only one residence (preserve organization and building)
        navigate({ organization: organizationId, building: buildingId, residence: residences[0].id });
        return;
      }
    }, [organizations.length, buildings.length, residences.length, currentLevel, organizationId, buildingId, residenceId, isLoadingOrganizations, isLoadingBuildings, isLoadingResidences]);

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
      // Filter out organizations with no accessible buildings (bottom up logic)
      const accessibleOrganizations = organizations.filter(org => {
        const buildingCount = buildingCounts[org.id] ?? 0;
        const hasAccess = buildingCount > 0;
        return hasAccess;
      });

      const items: SelectionGridItem[] = accessibleOrganizations.map(org => {
        const buildingCount = buildingCounts[org.id] ?? 0;
        const buildingLabel = config.checkResidenceAccess 
          ? (buildingCount === 1 ? 'building with residences' : 'buildings with residences')
          : (buildingCount === 1 ? 'building' : 'buildings');
        
        return {
          id: org.id,
          name: org.name,
          details: `${buildingCount} ${buildingLabel}`,
          type: 'organization' as const,
          disabled: false,
          disabledReason: undefined
        };
      });

      return (
        <div className='flex-1 flex flex-col overflow-hidden'>
          <Header title={config.title || t('buildingManagement' as any)} subtitle={t('selectOrganization' as any)} />
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
      const items: SelectionGridItem[] = buildings.map(building => {
        return {
          id: building.id,
          name: building.name,
          details: building.address,
          type: 'building'
        };
      });

      return (
        <div className='flex-1 flex flex-col overflow-hidden'>
          <Header title={config.title || t('buildingManagement' as any)} subtitle={t('selectBuilding' as any)} />
          
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
      const items: SelectionGridItem[] = residences.map(residence => {
        return {
          id: residence.id,
          name: `${t('unit' as any)} ${residence.unitNumber}`,
          details: residence.buildingName,
          type: 'residence'
        };
      });

      // Determine if we should show back button to building level
      const showBackToBuilding = config.hierarchy.includes('building') && buildings.length > 1;

      return (
        <div className='flex-1 flex flex-col overflow-hidden'>
          <Header title={config.title || t('buildingManagement' as any)} subtitle={t('selectResidence' as any)} />
          
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
                {buildings.find(b => b.id === buildingId)?.name || 'Building'}
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
    // Find building name from buildings data
    const currentBuilding = buildings.find(b => b.id === buildingId);
    const buildingName = currentBuilding?.name;

    // Determine back navigation props
    const getBackNavigationProps = () => {
      // For residents with building hierarchy, always show back button if they have a buildingId
      // This means they selected a building and should be able to go back
      if (config.hierarchy.includes('building') && config.hierarchy.length === 1 && buildingId && buildings.length > 1) {
        return {
          showBackButton: true,
          backButtonLabel: buildingName || 'Building',
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
          backButtonLabel: buildingName || 'Building',
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
        buildingName={buildingName || undefined}
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