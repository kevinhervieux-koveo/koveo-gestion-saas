import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building as BuildingIcon, Search } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';
import { BuildingCard, BuildingData } from '@/components/buildings/BuildingCard';
import { useState, useMemo } from 'react';

interface MyBuildingProps {
  buildingId?: string;
  organizationId?: string;
  showBackButton?: boolean;
  backButtonLabel?: React.ReactNode;
  onBack?: () => void;
}

function MyBuilding({ organizationId, showBackButton, backButtonLabel, onBack }: MyBuildingProps) {
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch user's accessible buildings
  const {
    data: userBuildings = [],
    isLoading: isLoadingBuildings,
    error
  } = useQuery({
    queryKey: ['/api/users/me/buildings', { organizationId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (organizationId) {
        params.append('organization_id', organizationId);
      }
      
      const url = `/api/users/me/buildings${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch buildings');
      }
      return response.json();
    },
  });

  // Transform building data to match BuildingCard interface
  const buildings: BuildingData[] = useMemo(() => {
    if (!Array.isArray(userBuildings)) return [];
    
    return userBuildings.map((building: any) => ({
      id: building.id,
      name: building.name || '',
      address: building.address || '',
      city: building.city || '',
      province: building.province || building.state || '',
      postalCode: building.postalCode || building.postal_code || '',
      buildingType: building.buildingType || building.building_type || '',
      totalUnits: building.totalUnits || building.total_units || 0,
      organizationId: building.organizationId || building.organization_id || '',
      isActive: building.isActive ?? true,
      createdAt: building.createdAt ? new Date(building.createdAt) : new Date(),
      updatedAt: building.updatedAt ? new Date(building.updatedAt) : new Date(),
    }));
  }, [userBuildings]);

  // Filter buildings based on search
  const filteredBuildings = useMemo(() => {
    if (!searchTerm.trim()) return buildings;
    
    return buildings.filter(
      (building) =>
        building.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        building.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${building.city}, ${building.province}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [buildings, searchTerm]);

  if (isLoadingBuildings) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title={t('myBuildings')} subtitle={t('viewAccessibleBuildingsAndDocuments')} />
        <div className='flex-1 overflow-auto p-6'>
          <div className='max-w-6xl mx-auto'>
            <div className='text-center py-8'>
              <div className='animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto'></div>
              <p className='text-muted-foreground mt-2'>{t('loadingBuildings')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title={t('myBuildings')} subtitle={t('viewAccessibleBuildingsAndDocuments')} />
        <div className='flex-1 overflow-auto p-6'>
          <div className='max-w-6xl mx-auto'>
            <Card>
              <CardContent className='p-8 text-center'>
                <BuildingIcon className='w-16 h-16 mx-auto text-red-400 mb-4' />
                <h3 className='text-lg font-semibold text-red-600 mb-2'>
                  {t('errorLoadingBuildings')}
                </h3>
                <p className='text-red-500'>
                  {t('failedToLoadBuildingInformation')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title={t('myBuildings')} subtitle={t('viewAccessibleBuildingsAndDocuments')} />

      {showBackButton && onBack && (
        <div className='border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
          <div className='flex items-center px-6 py-4'>
            <Button
              variant='outline'
              size='sm'
              onClick={onBack}
              className='flex items-center gap-2'
              data-testid='button-back-to-organization'
            >
              <ArrowLeft className='w-4 h-4' />
              {backButtonLabel}
            </Button>
          </div>
        </div>
      )}

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-6xl mx-auto space-y-6'>
          {/* Search Control */}
          <div className='flex flex-col sm:flex-row gap-4 items-center justify-between'>
            <div className='relative w-full sm:w-96'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4' />
              <Input
                placeholder={t('searchBuildingsByNameOrAddress')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='pl-10'
                data-testid='input-search-buildings'
              />
            </div>
          </div>

          {/* Buildings Grid */}
          {filteredBuildings.length > 0 ? (
            <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6'>
              {filteredBuildings.map((building) => (
                <BuildingCard
                  key={`residents-buildings-${building.id}`}
                  building={building}
                  userRole="resident"
                  t={t}
                  showEditButtons={false}
                  showResidencesButton={false}
                  documentsPath={`/residents/building/documents?buildingId=${building.id}`}
                />
              ))}
            </div>
          ) : buildings.length === 0 ? (
            <Card>
              <CardContent className='p-8 text-center'>
                <BuildingIcon className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>
                  {t('noBuildingsFound')}
                </h3>
                <p className='text-gray-500'>
                  {t('noBuildingsAccess')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className='p-8 text-center'>
                <BuildingIcon className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>
                  {t('noMatchingBuildings')}
                </h3>
                <p className='text-gray-500'>
                  {t('noMatchingBuildingsDescription')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// Export the component wrapped with hierarchical selection
export default withHierarchicalSelection(MyBuilding, {
  hierarchy: ['organization'],
});