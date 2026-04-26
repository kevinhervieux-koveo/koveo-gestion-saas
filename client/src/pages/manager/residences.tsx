import type { ReactNode } from 'react';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  useDeferredValue,
} from 'react';
import { logDebug } from '@/lib/logger';
import { useTableState } from '@/lib/common-hooks';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Home, Search, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';
import { SearchInput } from '@/components/common/SearchInput';
import { ResidenceCard } from '@/components/residences/ResidenceCard';

interface Residence {
  id: string;
  unitNumber: string;
  floor: number;
  squareFootage: string;
  bedrooms: number;
  bathrooms: string;
  balcony: boolean;
  parkingSpaceNumbers: string[];
  storageSpaceNumbers: string[];
  ownershipPercentage: string;
  monthlyFees: string;
  isActive: boolean;
  building: {
    id: string;
    name: string;
    address: string;
    city: string;
  };
  organization: {
    id: string;
    name: string;
  };
  tenants: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }>;
}

interface ManagerResidencesProps {
  organizationId?: string;
  buildingId?: string;
  buildingName?: string;
  showBackButton?: boolean;
  backButtonLabel?: ReactNode;
  onBack?: () => void;
}

function ManagerResidences({ organizationId, buildingId, showBackButton, backButtonLabel, onBack }: ManagerResidencesProps) {
  const [, navigate] = useLocation();
  const { t } = useLanguage();

  const residencesUrlSync = useMemo(
    () => ({
      fields: {
        floor: { defaultValue: 'all' },
      },
      searchParam: 'search',
    }),
    [],
  );

  const tableState = useTableState<{ floor: string }>({
    initialFilters: { floor: 'all' },
    urlSync: residencesUrlSync,
  });
  const {
    searchTerm,
    setSearchTerm,
    filters,
    updateFilter,
  } = tableState;
  const selectedFloor = filters.floor;

  const deferredSearchTerm = useDeferredValue(searchTerm);

  useEffect(() => {
    logDebug('🔍 [RESIDENCES] Component mounted', { organizationId, buildingId });
  }, []);

  useEffect(() => {
    logDebug('🔍 [RESIDENCES] Context changed:', { organizationId, buildingId });
  }, [organizationId, buildingId]);

  useEffect(() => {
    logDebug('🔍 [RESIDENCES] Filters updated:', { searchTerm, selectedFloor });
  }, [searchTerm, selectedFloor]);

  const {
    data: residences,
    isLoading: residencesLoading,
    refetch,
  } = useQuery({
    queryKey: ['/api/residences', deferredSearchTerm, selectedFloor, buildingId],
    queryFn: async () => {
      logDebug('🔍 [RESIDENCES] Fetching residences with params:', { searchTerm: deferredSearchTerm, selectedFloor, buildingId });
      const params = new URLSearchParams();

      if (deferredSearchTerm) {
        params.append('search', deferredSearchTerm);
      }

      if (buildingId) {
        params.append('buildingId', buildingId);
      }

      if (selectedFloor && selectedFloor !== 'all') {
        params.append('floor', selectedFloor);
      }

      const response = await fetch(`/api/residences?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch residences');
      }
      const data = await response.json() as Residence[];
      logDebug('🔍 [RESIDENCES] Received residences data:', { count: data?.length });
      return data;
    },
  });

  const { data: residencesForFloorFilter } = useQuery({
    queryKey: ['/api/residences/for-floor-filter', buildingId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (buildingId) {
        params.append('buildingId', buildingId);
      }
      const response = await fetch(`/api/residences?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch residences for floor filter');
      }
      return response.json() as Promise<Residence[]>;
    },
  });

  const availableFloors = residencesForFloorFilter
    ? [...new Set(residencesForFloorFilter.map((r) => r.floor).filter((floor) => floor != null))].sort(
        (a, b) => a - b
      )
    : [];

  const handleFloorChange = (value: string) => {
    logDebug('🔍 [RESIDENCES] User action: Floor filter changed', { floor: value });
    startTransition(() => {
      updateFilter('floor', value);
    });
  };

  const handleSearchChange = (value: string) => {
    logDebug('🔍 [RESIDENCES] User action: Search term changed', { searchTerm: value });
    setSearchTerm(value);
  };

  const totalItems = residences?.length || 0;

  // Row virtualization for the residences card grid. Each virtual "row"
  // contains `cols` cards laid out by CSS grid; `cols` tracks the same
  // breakpoints the grid used before (1 / 2 / 3 columns) so the layout
  // stays identical to the pre-virtualization version. Without this the
  // page rendered every filtered residence into the DOM on every search
  // / floor change — fine for a few units, costly past a few hundred.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState<number>(() => {
    if (typeof window === 'undefined') return 3;
    const w = window.innerWidth;
    return w >= 1024 ? 3 : w >= 768 ? 2 : 1;
  });

  useLayoutEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const next = w >= 1024 ? 3 : w >= 768 ? 2 : 1;
      setCols((prev) => (prev === next ? prev : next));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const rowCount = totalItems > 0 ? Math.ceil(totalItems / cols) : 0;

  // Only virtualize once the list grows past a threshold where the DOM
  // cost actually matters. Below it (the common case for most buildings)
  // we render every row directly, which keeps the SSR / jsdom render path
  // identical to the pre-virtualization version and avoids the headache
  // of virtualizer measurement in non-browser environments.
  const VIRTUALIZE_THRESHOLD = 50;
  const shouldVirtualize = totalItems > VIRTUALIZE_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? rowCount : 0,
    getScrollElement: () => scrollContainerRef.current,
    // Approximate ResidenceCard height + the 24px row gap. The
    // virtualizer measures actual heights after mount via
    // `measureElement`, so the estimate only needs to be in the right
    // ballpark to avoid initial layout jumps.
    estimateSize: () => 320,
    overscan: 4,
    getItemKey: (index) => {
      const start = index * cols;
      return residences?.[start]?.id ?? `row-${index}`;
    },
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title={t('residencesManagement')} subtitle={t('residencesManagementSubtitle')} />

      {showBackButton && onBack && (
        <div className='border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
          <div className='flex items-center px-6 py-4'>
            <Button
              variant='outline'
              size='sm'
              onClick={onBack}
              className='flex items-center gap-2'
              data-testid='button-back-to-selection'
            >
              <ArrowLeft className='w-4 h-4' />
              {backButtonLabel || t('backToResidences')}
            </Button>
          </div>
        </div>
      )}

      {/* Search and filter card sits outside the virtualized scroll area
          so it stays put while the cards scroll. This also keeps the
          virtualizer's scroll element simple — no scrollMargin offset
          to maintain. */}
      <div className='shrink-0 px-6 pt-6'>
        <div className='max-w-7xl mx-auto'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Search className='w-5 h-5' />
                {t('searchFilters')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>{t('searchResidences')}</label>
                  <SearchInput
                    value={searchTerm}
                    onChange={handleSearchChange}
                    placeholder={t('searchUnitTenant')}
                    className='w-full'
                    data-testid='search-residences'
                  />
                </div>

                <div className='space-y-2'>
                  <label className='text-sm font-medium'>{t('floorFilter')}</label>
                  <Select value={selectedFloor} onValueChange={handleFloorChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('allFloors')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>{t('allFloors')}</SelectItem>
                      {availableFloors.map((floor) => (
                        <SelectItem key={floor} value={floor.toString()}>
                          {t('floor')} {floor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className='flex-1 overflow-auto px-6 py-6'
        data-testid='residences-scroll-container'
      >
        <div className='max-w-7xl mx-auto'>
          {residencesLoading ? (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className='p-6'>
                    <Skeleton className='h-6 w-24 mb-4' />
                    <Skeleton className='h-4 w-full mb-2' />
                    <Skeleton className='h-4 w-3/4 mb-4' />
                    <div className='grid grid-cols-2 gap-2'>
                      <Skeleton className='h-8 w-full' />
                      <Skeleton className='h-8 w-full' />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : totalItems === 0 ? (
            <Card>
              <CardContent className='p-8 text-center'>
                <Home className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>{t('noResidencesFound')}</h3>
                <p className='text-gray-500'>{t('adjustSearchCriteria')}</p>
              </CardContent>
            </Card>
          ) : shouldVirtualize ? (
            <div
              style={{ height: totalSize, width: '100%', position: 'relative' }}
              data-testid='residences-virtual-list'
            >
              {virtualRows.map((virtualRow) => {
                const start = virtualRow.index * cols;
                const end = Math.min(start + cols, totalItems);
                const rowResidences = (residences ?? []).slice(start, end);
                return (
                  <div
                    key={virtualRow.key}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div
                      className='grid gap-6 pb-6'
                      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                    >
                      {rowResidences.map((residence) => (
                        <ResidenceCard
                          key={residence.id}
                          residence={residence}
                          onRefresh={refetch}
                          onDocumentsClick={(residenceId) =>
                            navigate(`/manager/residences/documents?residenceId=${residenceId}`)
                          }
                          showEditDialog={true}
                          data-testid={`residence-card-${residence.id}`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              data-testid='residences-grid'
            >
              {(residences ?? []).map((residence) => (
                <ResidenceCard
                  key={residence.id}
                  residence={residence}
                  onRefresh={refetch}
                  onDocumentsClick={(residenceId) =>
                    navigate(`/manager/residences/documents?residenceId=${residenceId}`)
                  }
                  showEditDialog={true}
                  data-testid={`residence-card-${residence.id}`}
                />
              ))}
            </div>
          )}

          {!residencesLoading && totalItems > 0 && (
            <div
              className='mt-2 text-xs text-muted-foreground text-right'
              data-testid='residences-result-count'
            >
              {totalItems}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default withHierarchicalSelection(ManagerResidences, {
  hierarchy: ['organization', 'building'],
  checkResidenceAccess: true,
  titleKey: 'residencesManagement'
});
