import React, { startTransition, useCallback, useMemo, useRef } from 'react';
import { logDebug, logError } from '@/lib/logger';
import { useLocation, useSearch } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { SelectionGrid, SelectionGridItem } from '@/components/common/SelectionGrid';
import { SearchableSelectionGrid } from '@/components/common/SearchableSelectionGrid';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { NoDataCard } from '@/components/ui/no-data-card';
import { AlertCircle, ArrowLeft, Home, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';

const RESIDENT_TENANT_ROLES = ['resident', 'tenant', 'demo_resident', 'demo_tenant'];

interface UserResidenceSummary {
  id: string;
  unitNumber: string;
  floor?: number | null;
  buildingId: string;
  buildingName: string;
}

/**
 * Localizable header text. Either a static string used as-is, or a
 * { en, fr } object resolved against the active language.
 */
type LocalizedText = string | { en: string; fr: string };

/**
 * Configuration for the hierarchical selection flow
 */
interface HierarchyConfig {
  hierarchy: ('organization' | 'building' | 'residence')[];
  checkResidenceAccess?: boolean;
  title?: LocalizedText; // Custom title for the page (overrides default per-step header). String or { en, fr }.
  titleKey?: string; // Optional i18n key resolved via t() — when set, takes precedence over `title`.
  subtitle?: LocalizedText; // Custom subtitle for the page (overrides default per-step subtitle). String or { en, fr }.
  onResidenceSelect?: (residenceId: string, buildingId?: string, organizationId?: string) => string; // Custom navigation when residence is selected
  /**
   * When true and the authenticated user is a resident/tenant, the HOC
   * switches to a flat residence-first flow: it fetches all residences
   * the user is linked to and either auto-forwards (single link) or
   * shows a flat residence chooser (multiple links). Org/building
   * picker steps are skipped entirely for those users. Other roles
   * (manager/admin) keep the existing org → building hierarchy.
   */
  residentScope?: boolean;
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
  backButtonLabel?: React.ReactNode;
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
    const { user } = useAuth();
    const isResidentOrTenant = RESIDENT_TENANT_ROLES.includes(user?.role || '');

    // Residents and tenants do not own organizations or pick buildings —
    // they belong to one or a few specific units. Skip the admin-style
    // org → building picker entirely and route them through a lightweight
    // resident-aware flow that derives context from /api/users/me/residences.
    if (isResidentOrTenant) {
      return (
        <ResidentBypassFlow
          config={config}
          WrappedComponent={WrappedComponent}
          wrappedProps={props}
        />
      );
    }

    return (
      <AdminManagerHierarchyFlow
        config={config}
        WrappedComponent={WrappedComponent}
        wrappedProps={props}
      />
    );
  };
}

/**
 * Admin/manager hierarchical flow — the original Organization → Building →
 * Residence picker behaviour, unchanged.
 */
function AdminManagerHierarchyFlow<T extends object>({
  config,
  WrappedComponent,
  wrappedProps: props,
}: {
  config: HierarchyConfig;
  WrappedComponent: React.ComponentType<T & HierarchyProps>;
  wrappedProps: T;
}) {
    const [location, setLocation] = useLocation();
    const search = useSearch();
    const { t, language } = useLanguage();
    const { user } = useAuth();

    // Resolve a LocalizedText (string or { en, fr }) against the active language.
    const resolveText = useCallback(
      (text: LocalizedText | undefined, fallback: string): string => {
        if (text === undefined || text === null) return fallback;
        if (typeof text === 'string') return text;
        return text[language] ?? text.en ?? fallback;
      },
      [language]
    );

    // Force re-render when location changes
    React.useEffect(() => {
      // Location effect for debugging
    }, [location, search]);
    
    // Navigation guard to prevent duplicate auto-forwards
    const lastAutoForwardRef = useRef<string | null>(null);
    
    // Parse URL query parameters using wouter's useSearch
    const urlParams = new URLSearchParams(search);
    const organizationId = urlParams.get('organization');
    const buildingId = urlParams.get('building');
    const residenceId = urlParams.get('residence');

    // Determine the current selection step in the org → building → residence hierarchy.
    const currentLevel = getCurrentLevel(config.hierarchy, { organizationId, buildingId, residenceId });
    
    // Navigate to update URL parameters - wrapped in useCallback to prevent stale closures.
    //
    // The `setLocation` call is wrapped in `startTransition` so the URL
    // change (and the resulting cascade of HOC + wrapped-page re-renders)
    // doesn't run synchronously inside the click handler that triggered it.
    // Without this, picking an org / building / residence in the
    // hierarchical picker emits "[Violation] 'click' handler took N ms"
    // warnings on slower devices because the wrapped manager page (e.g. the
    // Inventory table) mounts during the same task.
    const navigate = useCallback((updates: Record<string, string | null>) => {
      // Decode the location first to handle any URL-encoded characters (e.g., %3F for ?)
      const decodedLocation = decodeURIComponent(location);
      
      // Start with current URL params
      const currentSearchParams = decodedLocation.includes('?') ? decodedLocation.split('?')[1] : '';
      const newParams = new URLSearchParams(currentSearchParams);
      
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null) {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      });

      const newSearch = newParams.toString();
      const basePath = decodedLocation.split('?')[0];
      const newUrl = newSearch ? `${basePath}?${newSearch}` : basePath;
      
      startTransition(() => setLocation(newUrl));
    }, [location, setLocation]);

    // Fetch organizations
    const {
      data: organizations = [],
      isLoading: isLoadingOrganizations,
      isFetching: isFetchingOrganizations
    } = useQuery<Organization[]>({
      queryKey: ['/api/users/me/organizations'],
      // Fetch whenever organization is part of the hierarchy so back-button
      // labels can resolve to the actual organization name on deep-links.
      enabled: Boolean(config.hierarchy.includes('organization')),
      staleTime: 5 * 60 * 1000, // 5 minutes cache
      gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: 1000
    });

    // Fetch accessible building counts for each organization (bottom up logic)
    const {
      data: buildingCounts = {},
      isLoading: isLoadingBuildingCounts,
      isFetching: isFetchingBuildingCounts,
      error: buildingCountsError
    } = useQuery<Record<string, number>>({
      queryKey: ['/api/organizations/accessible-building-counts', user?.role, config.checkResidenceAccess || false],
      enabled: Boolean(currentLevel === 'organization' && organizations.length > 0),
      staleTime: 5 * 60 * 1000, // 5 minutes cache
      gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
      refetchOnWindowFocus: false,
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
      isFetching: isFetchingBuildings,
      error: buildingsError
    } = useQuery<Building[]>({
      queryKey: organizationId ? ['/api/users/me/buildings', organizationId, config.checkResidenceAccess || false] : ['/api/users/me/buildings', config.checkResidenceAccess || false],
      queryFn: async () => {
        // When checkResidenceAccess is true, use user-specific endpoint so managers
        // only see buildings they have access to manage.
        const url = (organizationId && !config.checkResidenceAccess)
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
        
        // When using /api/users/me/buildings endpoint (residents, tenants, or managers with checkResidenceAccess),
        // the endpoint already returns only buildings the user has access to, so no additional filtering needed
        return allBuildings;
      },
      enabled: Boolean(
        (currentLevel === 'building' || currentLevel === 'complete' || (buildingId && config.hierarchy.includes('building'))) && 
        (!!organizationId || config.hierarchy.length === 1)
      ),
      staleTime: 5 * 60 * 1000, // 5 minutes cache
      gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: 1000
    });


    // Fetch residences using secure user-specific endpoint for residents
    const {
      data: residences = [],
      isLoading: isLoadingResidences,
      isFetching: isFetchingResidences,
      error: residencesError,
      refetch: refetchResidences,
    } = useQuery<Residence[]>({
      queryKey: ['residences', buildingId, user?.role, config.checkResidenceAccess],
      queryFn: async () => {
        const isManager = ['manager', 'demo_manager'].includes(user?.role || '');
        
        // When checkResidenceAccess is true, managers use the user-specific endpoint
        // so they only see residences they're assigned to.
        const useUserSpecificEndpoint = isManager && config.checkResidenceAccess;
        
        const url = useUserSpecificEndpoint
          ? `/api/users/me/residences?building_id=${buildingId}`
          : `/api/buildings/${buildingId}/residences`;
        
        logDebug(`🏠 [HOC] Fetching residences - Role: ${user?.role}, checkResidenceAccess: ${config.checkResidenceAccess}, URL: ${url}`);
          
        const response = await fetch(url, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          logError(`🏠 [HOC] Failed to fetch residences: ${response.status}`, errorText);
          throw new Error(`Failed to fetch residences: ${response.status}`);
        }
        
        const data = await response.json();
        logDebug(`🏠 [HOC] Received ${data.length} residences:`, data);
        return data;
      },
      enabled: Boolean(currentLevel === 'residence' && !!buildingId),
      staleTime: 5 * 60 * 1000, // 5 minutes cache
      gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: 1000
    });
    
    // Debug logging
    React.useEffect(() => {
      if (currentLevel === 'residence') {
        logDebug(`🏠 [HOC DEBUG] currentLevel: ${currentLevel}, buildingId: ${buildingId}, enabled: ${Boolean(currentLevel === 'residence' && !!buildingId)}, isLoading: ${isLoadingResidences}, residences count: ${residences.length}, error:`, residencesError);
      }
    }, [currentLevel, buildingId, isLoadingResidences, residences.length, residencesError]);

    // Create memoized stable counts to prevent unnecessary re-renders
    const organizationsCount = useMemo(() => organizations.length, [organizations]);
    const buildingsCount = useMemo(() => buildings.length, [buildings]);
    const residencesCount = useMemo(() => residences.length, [residences]);

    // Capture the first item id (or null) into a stable primitive so the
    // auto-forward effect doesn't have to depend on the array references
    // themselves. The destructured queries default to a fresh `[]` on every
    // render when the query is disabled, which would otherwise re-fire this
    // effect on every parent render and contribute to "Maximum update depth
    // exceeded" loops in wrapped pages such as Budget.
    const firstOrganizationId = organizations[0]?.id ?? null;
    const firstBuildingId = buildings[0]?.id ?? null;
    const firstResidenceId = residences[0]?.id ?? null;

    // Auto-forwarding logic with navigation guards
    React.useEffect(() => {
      // Organization level auto-forward
      if (currentLevel === 'organization' && organizationsCount === 1 && !organizationId && !isLoadingOrganizations && !isFetchingOrganizations && firstOrganizationId) {
        const autoForwardKey = `organization-${firstOrganizationId}`;
        if (lastAutoForwardRef.current === autoForwardKey) return;
        
        lastAutoForwardRef.current = autoForwardKey;
        navigate({ organization: firstOrganizationId });
        return;
      }
      
      // Building level auto-forward
      if (currentLevel === 'building' && buildingsCount === 1 && !buildingId && !isLoadingBuildings && !isFetchingBuildings && firstBuildingId) {
        const autoForwardKey = `building-${firstBuildingId}`;
        if (lastAutoForwardRef.current === autoForwardKey) return;
        
        lastAutoForwardRef.current = autoForwardKey;
        navigate({ organization: organizationId, building: firstBuildingId });
        return;
      }
      
      // Residence level auto-forward
      if (currentLevel === 'residence' && residencesCount === 1 && !residenceId && !isLoadingResidences && !isFetchingResidences && firstResidenceId) {
        const autoForwardKey = `residence-${firstResidenceId}`;
        if (lastAutoForwardRef.current === autoForwardKey) return;
        
        lastAutoForwardRef.current = autoForwardKey;
        navigate({ organization: organizationId, building: buildingId, residence: firstResidenceId });
        return;
      }
    }, [
      organizationsCount,
      buildingsCount,
      residencesCount,
      currentLevel,
      organizationId,
      buildingId,
      residenceId,
      isLoadingOrganizations,
      isFetchingOrganizations,
      isLoadingBuildings,
      isFetchingBuildings,
      isLoadingResidences,
      isFetchingResidences,
      navigate,
      // Use stable primitive ids instead of array references. The destructured
      // query results default to a fresh `[]` each render when disabled, which
      // would otherwise re-fire this effect on every parent render and could
      // contribute to "Maximum update depth exceeded" loops downstream.
      firstOrganizationId,
      firstBuildingId,
      firstResidenceId,
    ]);

    // Handle selection. Direct `setLocation` calls (custom residence
    // navigation) are wrapped in `startTransition` for the same reason as
    // the `navigate` helper above — keep the click handler responsive while
    // the wrapped page mounts.
    const handleSelection = (id: string) => {      
      if (currentLevel === 'organization') {
        navigate({ organization: id });
      } else if (currentLevel === 'building') {
        // Preserve organization when selecting building
        navigate({ organization: organizationId, building: id });
      } else if (currentLevel === 'residence') {
        // Check if custom residence navigation is provided
        if (config.onResidenceSelect) {
          const navigationPath = config.onResidenceSelect(id, buildingId || undefined, organizationId || undefined);
          startTransition(() => setLocation(navigationPath));
        } else {
          // Preserve organization and building when selecting residence
          navigate({ organization: organizationId, building: buildingId, residence: id });
        }
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
          ? (buildingCount === 1 ? t('buildingWithResidences' as any) : t('buildingsWithResidences' as any))
          : (buildingCount === 1 ? t('building' as any) : t('buildings' as any));
        
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
          <Header
            title={config.titleKey ? t(config.titleKey as any) : resolveText(config.title, t('buildingManagement' as any))}
            subtitle={resolveText(config.subtitle, t('selectOrganization' as any))}
          />
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
          <Header
            title={config.titleKey ? t(config.titleKey as any) : resolveText(config.title, t('buildingManagement' as any))}
            subtitle={resolveText(config.subtitle, t('selectBuilding' as any))}
          />
          
          {/* Back to Organization Navigation - only show if user has multiple organizations */}
          {config.hierarchy.includes('organization') && organizations.length > 1 && (
            <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="flex items-center px-6 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBack}
                  className="flex items-center gap-2"
                  data-testid="button-back-to-organization"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {(() => {
                    const orgName = organizations.find(o => o.id === organizationId)?.name;
                    if (orgName) return orgName;
                    if (isLoadingOrganizations || isFetchingOrganizations) {
                      return <Skeleton className="h-4 w-24" data-testid="skeleton-back-organization" />;
                    }
                    return t('organization' as any);
                  })()}
                </Button>
              </div>
            </div>
          )}
          
          <div className='flex-1 overflow-auto p-6'>
            <SearchableSelectionGrid
              items={items}
              onSelectItem={handleSelection}
              isLoading={isLoadingBuildings}
              searchTestId='input-search-buildings'
              paginationTestId='building-chooser-pagination'
            />
          </div>
        </div>
      );
    }

    if (currentLevel === 'residence') {
      const header = (
        <Header
          title={config.titleKey ? t(config.titleKey as any) : resolveText(config.title, t('buildingManagement' as any))}
          subtitle={resolveText(config.subtitle, t('selectResidence' as any))}
        />
      );

      // Determine if we should show back button to building level
      const showBackToBuilding = config.hierarchy.includes('building') && buildings.length > 1;

      const backNav = showBackToBuilding ? (
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center px-6 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="flex items-center gap-2"
              data-testid="button-back-to-building"
            >
              <ArrowLeft className="w-4 h-4" />
              {(() => {
                const bName = buildings.find(b => b.id === buildingId)?.name;
                if (bName) return bName;
                if (isLoadingBuildings || isFetchingBuildings) {
                  return <Skeleton className="h-4 w-24" data-testid="skeleton-back-building" />;
                }
                return t('building' as any);
              })()}
            </Button>
          </div>
        </div>
      ) : null;

      if (residencesError) {
        return (
          <div className='flex-1 flex flex-col overflow-hidden'>
            {header}
            {backNav}
            <div className='flex-1 flex items-center justify-center p-6'>
              <div className='text-center space-y-4' data-testid='residence-load-error'>
                <AlertCircle className='w-10 h-10 text-destructive mx-auto' />
                <p className='text-sm text-muted-foreground'>
                  {t('failedToLoadUnits' as any)}
                </p>
                <Button
                  variant='outline'
                  onClick={() => refetchResidences()}
                  data-testid='button-retry-load-residences'
                  className='flex items-center gap-2'
                >
                  <RefreshCw className='w-4 h-4' />
                  {t('retry' as any)}
                </Button>
              </div>
            </div>
          </div>
        );
      }

      const items: SelectionGridItem[] = residences.map(residence => {
        return {
          id: residence.id,
          name: `${t('unit' as any)} ${residence.unitNumber}`,
          details: residence.buildingName,
          type: 'residence'
        };
      });

      return (
        <div className='flex-1 flex flex-col overflow-hidden'>
          {header}
          {backNav}
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

    // All required selections are complete - render the wrapped component.
    const currentBuilding = buildings.find(b => b.id === buildingId);
    const buildingName = currentBuilding?.name;

    // Helper to render a name with a skeleton placeholder while the
    // underlying parent query is loading. Prevents the visible flicker of a
    // generic translated fallback ("Building" / "Organization") on deep-link
    // before the real name resolves.
    const renderLabel = (name: string | undefined, isLoading: boolean, fallback: string, testId: string): React.ReactNode => {
      if (name) return name;
      if (isLoading) return <Skeleton className="h-4 w-24" data-testid={testId} />;
      return fallback;
    };

    // Determine back navigation props.
    //
    // Convention (Task #121): the back-button label names the DESTINATION
    // the user lands on after pressing it — i.e. the parent entity in the
    // hierarchy — not the entity they are currently viewing. This matches
    // the residence-level case (label = building name = the parent the
    // user returns to) and the organization-level case (label = building
    // selection's enclosing organization name when going back to the
    // organization picker).
    //
    // Building-only hierarchies (no organization in the hierarchy) are
    // the one exception: there is no parent entity above the building,
    // so we keep labelling with the current building's name as a hint
    // that pressing back will deselect it.
    const getBackNavigationProps = () => {
      // Building-only hierarchy (e.g. resident with multiple buildings):
      // there is no organization parent, so label with the current
      // building name (which the user is deselecting) and navigate to
      // the URL root.
      if (config.hierarchy.includes('building') && config.hierarchy.length === 1 && buildingId && buildings.length > 1) {
        return {
          showBackButton: true,
          backButtonLabel: renderLabel(buildingName, isLoadingBuildings || isFetchingBuildings, t('building' as any), 'skeleton-back-building'),
          onBack: () => {
            const basePath = location.split('?')[0];
            window.history.pushState(null, '', basePath);
            startTransition(() => setLocation(basePath));
          }
        };
      }

      // Multi-building, multi-level hierarchy. Two sub-cases under
      // destination semantics:
      //
      //   a) Residence-level wrapped page (residenceId set): the parent
      //      is the BUILDING, so label with the current building name.
      //      onBack clears the residence so the user lands on the
      //      residence-selection screen for that building.
      //
      //   b) Building-level wrapped page (residenceId not set): the
      //      parent is the ORGANIZATION (when present in the
      //      hierarchy), so label with the current organization name.
      //      onBack clears the building so the user lands on the
      //      building-selection screen for that organization. When
      //      there is no organization in the hierarchy, fall back to
      //      the current building name.
      if (config.hierarchy.includes('building') && buildings.length > 1 && buildingId) {
        const onResidencePage = config.hierarchy.includes('residence') && !!residenceId;

        if (onResidencePage) {
          return {
            showBackButton: true,
            backButtonLabel: renderLabel(
              buildingName,
              isLoadingBuildings || isFetchingBuildings,
              t('building' as any),
              'skeleton-back-building'
            ),
            onBack: () => {
              navigate({ residence: null });
            }
          };
        }

        const orgInHierarchy = config.hierarchy.includes('organization');
        const currentOrgName = orgInHierarchy
          ? organizations.find(o => o.id === organizationId)?.name
          : undefined;
        const label = orgInHierarchy
          ? renderLabel(currentOrgName, isLoadingOrganizations || isFetchingOrganizations, t('organization' as any), 'skeleton-back-organization')
          : renderLabel(buildingName, isLoadingBuildings || isFetchingBuildings, t('building' as any), 'skeleton-back-building');
        return {
          showBackButton: true,
          backButtonLabel: label,
          onBack: () => {
            navigate({ building: null, residence: null });
          }
        };
      }

      // Single-building, multi-organization hierarchy: pressing back
      // clears the organization selection, so the destination is the
      // organization picker. Label with the current organization's
      // name (the entity the user is leaving and the level the
      // destination picker enumerates).
      if (config.hierarchy.includes('organization') && organizations.length > 1 && organizationId) {
        const currentOrgName = organizations.find(o => o.id === organizationId)?.name;
        return {
          showBackButton: true,
          backButtonLabel: renderLabel(currentOrgName, isLoadingOrganizations || isFetchingOrganizations, t('organization' as any), 'skeleton-back-organization'),
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
}

/**
 * Resident/tenant bypass flow.
 *
 * Skips the admin-style organization → building picker entirely. Derives
 * context from the user's active residence links (/api/users/me/residences):
 *   - 0 active links → empty-state card with localized "contact your
 *     property manager" message.
 *   - For residence-level pages (config.hierarchy includes 'residence'),
 *     render the wrapped page directly. The wrapped page is responsible for
 *     listing 1+ residences (the inner residence page already does this with
 *     a built-in selector).
 *   - For building-level pages (e.g. ['organization','building'] like
 *     /resident/common-spaces): auto-select the user's building when there is
 *     a single distinct building, or show a small building picker when the
 *     user is linked to residences across multiple buildings. The user's
 *     selection is persisted via the `?building=` URL param so deep-links
 *     keep working.
 */
function ResidentBypassFlow<T extends object>({
  config,
  WrappedComponent,
  wrappedProps,
}: {
  config: HierarchyConfig;
  WrappedComponent: React.ComponentType<T & HierarchyProps>;
  wrappedProps: T;
}) {
  const { t, language } = useLanguage();
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const lastAutoForwardRef = useRef<string | null>(null);

  // Resolve a LocalizedText (string or { en, fr }) against the active
  // language. Mirrors the helper in `AdminManagerHierarchyFlow` so the
  // resident bypass picker can honor the same `title`/`subtitle` config
  // and never renders a `{ en, fr }` object directly into the DOM.
  const resolveText = useCallback(
    (text: LocalizedText | undefined, fallback: string): string => {
      if (text === undefined || text === null) return fallback;
      if (typeof text === 'string') return text;
      return text[language] ?? text.en ?? fallback;
    },
    [language],
  );

  const urlParams = new URLSearchParams(search);
  const selectedBuildingId = urlParams.get('building');

  const navigate = useCallback((updates: Record<string, string | null>) => {
    const decodedLocation = decodeURIComponent(location);
    const currentSearchParams = decodedLocation.includes('?')
      ? decodedLocation.split('?')[1]
      : '';
    const newParams = new URLSearchParams(currentSearchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    const newSearch = newParams.toString();
    const basePath = decodedLocation.split('?')[0];
    // Mirror the AdminManagerHierarchyFlow `navigate` helper: defer the URL
    // change so the wrapped page mount doesn't run inside the click handler.
    startTransition(() => {
      setLocation(newSearch ? `${basePath}?${newSearch}` : basePath);
    });
  }, [location, setLocation]);

  const {
    data: userResidences = [],
    isLoading: isLoadingResidences,
  } = useQuery<UserResidenceSummary[]>({
    queryKey: ['/api/users/me/residences'],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const includesResidence = config.hierarchy.includes('residence');
  const includesBuilding = config.hierarchy.includes('building');

  // Resident-scope auto-forward target (Task #678). When a resident has
  // exactly one residence link and the page configured an
  // `onResidenceSelect` (e.g. /residents/residence → residence-documents),
  // resolve the destination once so the effect below can navigate without
  // calling setLocation during render.
  const autoForwardTarget = useMemo(() => {
    if (
      includesResidence &&
      config.onResidenceSelect &&
      !isLoadingResidences &&
      userResidences.length === 1
    ) {
      const only = userResidences[0];
      return config.onResidenceSelect(only.id, only.buildingId);
    }
    return null;
  }, [includesResidence, isLoadingResidences, userResidences, config]);

  React.useEffect(() => {
    if (autoForwardTarget && lastAutoForwardRef.current !== autoForwardTarget) {
      lastAutoForwardRef.current = autoForwardTarget;
      // Defer the navigation so the wrapped page mount happens at lower
      // priority than the resident-residences query settling — keeps the UI
      // from "freezing" for residents with a single residence link.
      startTransition(() => setLocation(autoForwardTarget));
    }
  }, [autoForwardTarget, setLocation]);

  const uniqueBuildings = useMemo(() => {
    const map = new Map<string, string>();
    userResidences.forEach((r) => {
      if (r.buildingId && !map.has(r.buildingId)) {
        map.set(r.buildingId, r.buildingName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [userResidences]);

  // Configured page-level title/subtitle (Task #678). When the wrapped page
  // sets a `title`/`subtitle` (e.g. residence.tsx), surface it on every
  // intermediate screen — loading skeleton, empty state, picker — so the
  // resident never sees the generic "Gestion de bâtiments / Sélectionnez
  // l'organisation" leak from the admin picker.
  const resolvedTitle = resolveText(config.title, t('myResidence' as any));
  const resolvedSubtitle = resolveText(config.subtitle, t('viewResidenceInfo' as any));

  if (isLoadingResidences) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title={resolvedTitle} subtitle={t('loading' as any)} />
        <div className='flex-1 overflow-auto p-6'>
          <div className='max-w-4xl mx-auto space-y-4'>
            <Skeleton className='h-32 w-full' />
            <Skeleton className='h-32 w-full' />
          </div>
        </div>
      </div>
    );
  }

  if (userResidences.length === 0) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title={resolvedTitle} subtitle={resolvedSubtitle} />
        <div className='flex-1 flex items-center justify-center p-6'>
          <NoDataCard
            icon={Home}
            titleKey='noResidenceLinkedTitle'
            descriptionKey='noResidenceLinkedDescription'
            testId='no-residence-linked'
          />
        </div>
      </div>
    );
  }

  // Residence-level pages (e.g. /residents/residence). When the page also
  // configures `onResidenceSelect`, route the resident straight to that
  // destination — single residence link auto-forwards, multiple links show
  // a flat "Building · Unit X" chooser (no org/building picker, no inner
  // residence-cards screen). This was the W13 leak diagnosed in Task #625
  // and fixed for /residents/residence in Task #678.
  if (includesResidence) {
    if (config.onResidenceSelect) {
      // Single residence → auto-forward (handled by the effect above).
      // Render a skeleton placeholder while the navigation flushes so the
      // resident never sees the org/building picker.
      if (userResidences.length === 1) {
        return (
          <div className='flex-1 flex flex-col overflow-hidden'>
            <Header title={resolvedTitle} subtitle={resolvedSubtitle} />
            <div className='flex-1 overflow-auto p-6'>
              <div className='max-w-4xl mx-auto space-y-4'>
                <Skeleton className='h-32 w-full' />
              </div>
            </div>
          </div>
        );
      }

      // Multiple residences → flat "Building · Unit X" picker. Selecting an
      // entry navigates straight to the configured destination.
      const items: SelectionGridItem[] = userResidences.map((r) => ({
        id: r.id,
        name: `${r.buildingName} · ${t('unit' as any)} ${r.unitNumber}`,
        details: '',
        type: 'residence' as const,
      }));

      const handleResidenceSelect = (residenceId: string) => {
        const picked = userResidences.find((r) => r.id === residenceId);
        if (!picked || !config.onResidenceSelect) return;
        const destination = config.onResidenceSelect(picked.id, picked.buildingId);
        startTransition(() => setLocation(destination));
      };

      return (
        <div className='flex-1 flex flex-col overflow-hidden'>
          <Header title={resolvedTitle} subtitle={resolvedSubtitle} />
          <div className='flex-1 overflow-auto p-6'>
            <SelectionGrid
              title=''
              items={items}
              onSelectItem={handleResidenceSelect}
              onBack={null}
              isLoading={false}
            />
          </div>
        </div>
      );
    }

    // No `onResidenceSelect` configured — fall back to the original
    // behaviour: render the wrapped page directly so it can show its own
    // residence list/selector.
    return <WrappedComponent {...(wrappedProps as T)} />;
  }

  // Building-level pages (e.g. /resident/common-spaces): we need a buildingId
  // before the wrapped page can render. Auto-select when there is a single
  // distinct building; otherwise show a small building picker.
  if (includesBuilding) {
    const resolvedBuildingId =
      selectedBuildingId && uniqueBuildings.some((b) => b.id === selectedBuildingId)
        ? selectedBuildingId
        : uniqueBuildings.length === 1
          ? uniqueBuildings[0].id
          : null;

    if (resolvedBuildingId) {
      const resolvedBuildingName = uniqueBuildings.find((b) => b.id === resolvedBuildingId)?.name;
      const showBackButton = uniqueBuildings.length > 1;
      return (
        <WrappedComponent
          {...(wrappedProps as T)}
          buildingId={resolvedBuildingId}
          buildingName={resolvedBuildingName}
          showBackButton={showBackButton}
          backButtonLabel={resolvedBuildingName || t('building' as any)}
          onBack={showBackButton ? () => navigate({ building: null }) : undefined}
        />
      );
    }

    // Multiple buildings, none selected → show a searchable building picker.
    const items: SelectionGridItem[] = uniqueBuildings.map((b) => ({
      id: b.id,
      name: b.name,
      details: '',
      type: 'building',
    }));

    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header
          title={config.titleKey ? t(config.titleKey as any) : resolveText(config.title, t('selectYourBuilding' as any))}
          subtitle={resolveText(config.subtitle, '')}
        />
        <div className='flex-1 overflow-auto p-6'>
          <SearchableSelectionGrid
            items={items}
            onSelectItem={(id) => navigate({ building: id })}
            isLoading={false}
            searchTestId='input-search-resident-buildings'
            paginationTestId='resident-building-chooser-pagination'
          />
        </div>
      </div>
    );
  }

  // No residence or building level in hierarchy — render directly.
  return <WrappedComponent {...(wrappedProps as T)} />;
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
