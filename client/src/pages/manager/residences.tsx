import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { logDebug } from '@/lib/logger';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Home,
  Search,
  Edit,
  Users,
  Building,
  MapPin,
  Car,
  Package,
  Bed,
  Bath,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { ResidenceEditForm } from '@/components/forms/residence-edit-form';
import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';
import { PaginationControls } from '@/components/common/PaginationControls';
import { SearchInput } from '@/components/common/SearchInput';
import { ResidenceCard } from '@/components/residences/ResidenceCard';

/**
 *
 */
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Component initialization logging
  useEffect(() => {
    logDebug('🔍 [RESIDENCES] Component mounted', { organizationId, buildingId });
  }, []);

  // Log context changes
  useEffect(() => {
    logDebug('🔍 [RESIDENCES] Context changed:', { organizationId, buildingId });
  }, [organizationId, buildingId]);

  // Log filter changes
  useEffect(() => {
    logDebug('🔍 [RESIDENCES] Filters updated:', { searchTerm, selectedFloor, currentPage });
  }, [searchTerm, selectedFloor, currentPage]);


  // Fetch residences with search and filters
  const {
    data: residences,
    isLoading: residencesLoading,
    refetch,
  } = useQuery({
    queryKey: ['/api/residences', searchTerm, selectedFloor, buildingId],
    queryFn: async () => {
      logDebug('🔍 [RESIDENCES] Fetching residences with params:', { searchTerm, selectedFloor, buildingId });
      const params = new URLSearchParams(); /**
       * If function.
       * @param searchTerm - SearchTerm parameter.
       */ /**
       * If function.
       * @param searchTerm - SearchTerm parameter.
       */

      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      // Filter by the selected building from hierarchy
      if (buildingId) {
        params.append('buildingId', buildingId);
      }

      if (selectedFloor && selectedFloor !== 'all') {
        params.append('floor', selectedFloor);
      }

      const response = await fetch(`/api/residences?${params}`); /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */
      /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */
      /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */ /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */

      /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */
      /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */

      if (!response.ok) {
        throw new Error('Failed to fetch residences');
      }
      const data = await response.json() as Residence[];
      logDebug('🔍 [RESIDENCES] Received residences data:', { count: data?.length });
      return data;
    },
  });


  // Fetch residences for floor filter (respecting building filter but not floor/search filters)
  const { data: residencesForFloorFilter } = useQuery({
    queryKey: ['/api/residences/for-floor-filter', buildingId],
    queryFn: async () => {
      const params = new URLSearchParams();
      // Only apply building filter to get floors for the selected building
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

  // Get unique floors from residences (respecting building filter only)
  const availableFloors = residencesForFloorFilter
    ? [...new Set(residencesForFloorFilter.map((r) => r.floor).filter((floor) => floor != null))].sort(
        (a, b) => a - b
      )
    : [];

  // Reset page when filters change

  const handleFloorChange = (value: string) => {
    logDebug('🔍 [RESIDENCES] User action: Floor filter changed', { floor: value });
    setSelectedFloor(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    logDebug('🔍 [RESIDENCES] User action: Search term changed', { searchTerm: value });
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Pagination calculations
  const totalItems = residences?.length || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentResidences = residences?.slice(startIndex, endIndex) || [];

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

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Search and Filters */}
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

          {/* Residences Grid */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {residencesLoading ? (
              // Loading skeletons
              Array.from({ length: 6 }).map((_, i) => (
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
              ))
            ) : totalItems === 0 ? (
              <Card className='col-span-full'>
                <CardContent className='p-8 text-center'>
                  <Home className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                  <h3 className='text-lg font-semibold text-gray-600 mb-2'>{t('noResidencesFound')}</h3>
                  <p className='text-gray-500'>{t('adjustSearchCriteria')}</p>
                </CardContent>
              </Card>
            ) : (
              currentResidences.map((residence) => (
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
              ))
            )}
          </div>

          {/* Pagination Controls */}
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            className="mt-6"
            showInfo={true}
          />
        </div>
      </div>
    </div>
  );
}

// Export with hierarchical selection HOC - Manager residences page uses organization → building hierarchy
export default withHierarchicalSelection(ManagerResidences, {
  hierarchy: ['organization', 'building'],
  checkResidenceAccess: true
});
