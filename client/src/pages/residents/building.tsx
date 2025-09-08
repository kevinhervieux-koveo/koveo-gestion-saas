import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Building as BuildingIcon,
  MapPin,
  Calendar,
  FileText,
  Home,
  Car,
  Package,
  ArrowLeft,
} from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';

interface BuildingData {
  id: string;
  name: string;
  address: string;
  city: string;
  state?: string;
  postal_code: string;
  organization_id: string;
  province?: string;
  postalCode?: string;
  buildingType?: string;
  yearBuilt?: number;
  managementCompany?: string;
  totalFloors?: number;
  parkingSpaces?: number;
  storageSpaces?: number;
  amenities?: string | string[];
}

interface MyBuildingProps {
  buildingId?: string;
  showBackButton?: boolean;
  backButtonLabel?: string;
  onBack?: () => void;
}

function MyBuilding({ buildingId, showBackButton, backButtonLabel, onBack }: MyBuildingProps) {
  const [, navigate] = useLocation();
  const { t } = useLanguage();

  // Fetch user's accessible buildings and find the specific one
  const {
    data: userBuildings,
    isLoading: isLoadingBuilding,
  } = useQuery({
    queryKey: ['/api/users/me/buildings'],
    queryFn: async () => {
      const response = await fetch('/api/users/me/buildings');
      if (!response.ok) {
        throw new Error('Failed to fetch buildings');
      }
      return response.json();
    },
    enabled: !!buildingId,
  });

  // Find the specific building from user's accessible buildings
  const buildingData: BuildingData | null = React.useMemo(() => {
    if (!userBuildings || !buildingId) return null;
    const building = userBuildings.find((building: any) => building.id === buildingId);
    if (!building) return null;
    
    // Map API response to our interface
    return {
      ...building,
      province: building.state || building.province,
      postalCode: building.postal_code || building.postalCode,
    };
  }, [userBuildings, buildingId]);

  const handleViewDocuments = (targetBuildingId: string) => {
    navigate(`/residents/building/documents?buildingId=${targetBuildingId}`);
  };

  if (isLoadingBuilding) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='My Building' subtitle='View building information and documents' />
        <div className='flex-1 overflow-auto p-6'>
          <div className='max-w-4xl mx-auto'>
            <div className='text-center py-8'>
              <div className='animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto'></div>
              <p className='text-muted-foreground mt-2'>Loading building information...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!buildingData) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='My Building' subtitle='View building information and documents' />
        <div className='flex-1 overflow-auto p-6'>
          <div className='max-w-4xl mx-auto'>
            <Card>
              <CardContent className='p-8 text-center'>
                <BuildingIcon className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>
                  Building Not Found
                </h3>
                <p className='text-gray-500'>Unable to load building information.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='My Building' subtitle='View building information and documents' />

      {showBackButton && onBack && (
        <div className='border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
          <div className='flex items-center px-6 py-4'>
            <Button
              variant='outline'
              size='sm'
              onClick={onBack}
              className='flex items-center gap-2'
              data-testid='button-back-to-building'
            >
              <ArrowLeft className='w-4 h-4' />
              {backButtonLabel}
            </Button>
          </div>
        </div>
      )}

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-4xl mx-auto space-y-6'>
          {/* Building Details Card */}
          <Card className='hover:shadow-lg transition-shadow'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <BuildingIcon className='w-5 h-5' />
                {buildingData.name}
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-6'>
              {/* Address Section */}
              <div className='space-y-3'>
                <div>
                  <Label className='text-xs font-medium text-gray-500'>{t('address')}</Label>
                  <div className='flex items-start gap-2 mt-1'>
                    <MapPin className='w-4 h-4 mt-0.5 text-muted-foreground' />
                    <div>
                      <p className='text-sm text-gray-700'>{buildingData.address}</p>
                      <p className='text-sm text-gray-700'>
                        {buildingData.city}, {buildingData.province || buildingData.state} {buildingData.postalCode || buildingData.postal_code}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Building Details Grid */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <div className='space-y-3'>
                  {buildingData.buildingType && (
                    <div>
                      <Label className='text-xs font-medium text-gray-500'>
                        {t('buildingType')}
                      </Label>
                      <p className='text-sm text-gray-700 capitalize'>{buildingData.buildingType}</p>
                    </div>
                  )}
                  
                  {buildingData.yearBuilt && (
                    <div>
                      <Label className='text-xs font-medium text-gray-500'>
                        {t('yearBuilt')}
                      </Label>
                      <div className='flex items-center gap-2 mt-1'>
                        <Calendar className='w-4 h-4 text-muted-foreground' />
                        <span className='text-sm text-gray-700'>{buildingData.yearBuilt}</span>
                      </div>
                    </div>
                  )}

                  {buildingData.managementCompany && (
                    <div>
                      <Label className='text-xs font-medium text-gray-500'>
                        {t('managementCompany')}
                      </Label>
                      <p className='text-sm text-gray-700'>{buildingData.managementCompany}</p>
                    </div>
                  )}
                </div>

                <div className='space-y-3'>
                  {buildingData.totalFloors && (
                    <div>
                      <Label className='text-xs font-medium text-gray-500'>
                        {t('totalFloors')}
                      </Label>
                      <div className='flex items-center gap-2 mt-1'>
                        <BuildingIcon className='w-4 h-4 text-muted-foreground' />
                        <span className='text-sm text-gray-700'>{buildingData.totalFloors}</span>
                      </div>
                    </div>
                  )}

                  {/* Parking and Storage */}
                  {(buildingData.parkingSpaces || buildingData.storageSpaces) && (
                    <div className='space-y-2'>
                      {buildingData.parkingSpaces && (
                        <div>
                          <Label className='text-xs font-medium text-gray-500'>{t('parking')}</Label>
                          <div className='flex items-center gap-2 mt-1'>
                            <Car className='w-4 h-4 text-muted-foreground' />
                            <span className='text-sm text-gray-700'>
                              {buildingData.parkingSpaces} {t('spaces')}
                            </span>
                          </div>
                        </div>
                      )}
                      {buildingData.storageSpaces && (
                        <div>
                          <Label className='text-xs font-medium text-gray-500'>{t('storage')}</Label>
                          <div className='flex items-center gap-2 mt-1'>
                            <Package className='w-4 h-4 text-muted-foreground' />
                            <span className='text-sm text-gray-700'>
                              {buildingData.storageSpaces} {t('units')}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>


              {/* Amenities */}
              {buildingData.amenities && (
                <div>
                  <Label className='text-xs font-medium text-gray-500'>{t('amenities')}</Label>
                  <div className='flex flex-wrap gap-2 mt-1'>
                    {(() => {
                      try {
                        const amenities =
                          typeof buildingData.amenities === 'string'
                            ? JSON.parse(buildingData.amenities)
                            : buildingData.amenities;
                        return Array.isArray(amenities)
                          ? amenities.map((amenity: string, index: number) => (
                              <Badge key={index} variant='outline' className='text-xs'>
                                {amenity}
                              </Badge>
                            ))
                          : null;
                      } catch (_e) {
                        return (
                          <span className='text-xs text-muted-foreground'>
                            {t('unableToDisplayAmenities')}
                          </span>
                        );
                      }
                    })()}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className='pt-4 border-t'>
                <Button
                  onClick={() => handleViewDocuments(buildingData.id)}
                  className='w-full justify-start'
                  data-testid='button-view-documents'
                >
                  <FileText className='w-4 h-4 mr-2' />
                  {t('viewDocumentsButton')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Export the component wrapped with hierarchical selection
export default withHierarchicalSelection(MyBuilding, {
  hierarchy: ['organization', 'building'],
});