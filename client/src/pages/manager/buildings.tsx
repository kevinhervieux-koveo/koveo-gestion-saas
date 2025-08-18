import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building, Plus, Search, MapPin, Calendar, Users, Car, Package } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
// Remove LoadingSpinner import as it doesn't exist, use a simple loading state instead
import { hasRoleOrHigher } from '@/config/navigation';

interface BuildingData {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  buildingType: 'condo' | 'rental';
  yearBuilt?: number;
  totalUnits: number;
  totalFloors?: number;
  parkingSpaces?: number;
  storageSpaces?: number;
  amenities?: string[];
  managementCompany?: string;
  organizationId: string;
  organizationName: string;
  organizationType: string;
  accessType: 'organization' | 'residence';
  createdAt: string;
}

/**
 * Buildings management page for Admin and Manager roles.
 * Shows all buildings in the user's organization with proper access control.
 */
export default function Buildings() {
  const { user, isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch buildings data
  const { 
    data: buildingsResponse, 
    isLoading, 
    error 
  } = useQuery<{buildings: BuildingData[]}>({
    queryKey: ['/api/manager/buildings'],
    enabled: isAuthenticated && hasRoleOrHigher(user?.role, 'manager'),
  });

  const allBuildings = buildingsResponse?.buildings || [];

  // Filter buildings based on search term
  const buildings = useMemo(() => {
    if (!searchTerm) return allBuildings;
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allBuildings.filter(building => 
      building.name.toLowerCase().includes(lowerSearchTerm) ||
      building.address.toLowerCase().includes(lowerSearchTerm) ||
      `${building.city}, ${building.province}`.toLowerCase().includes(lowerSearchTerm)
    );
  }, [allBuildings, searchTerm]);

  // Show access denied for residents and tenants
  if (isAuthenticated && !hasRoleOrHigher(user?.role, 'manager')) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='Access Denied' subtitle='Buildings management is restricted to managers and administrators' />
        
        <div className='flex-1 overflow-auto p-6'>
          <div className='max-w-4xl mx-auto'>
            <Card>
              <CardContent className='p-8 text-center'>
                <Building className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>Access Restricted</h3>
                <p className='text-gray-500 mb-4'>
                  Buildings management is only available to managers and administrators.
                </p>
                <Badge variant='secondary'>Manager Access Required</Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='Buildings Management' subtitle='Loading buildings...' />
        
        <div className='flex-1 overflow-auto p-6'>
          <div className='max-w-7xl mx-auto'>
            <Card>
              <CardContent className='p-8 text-center'>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className='text-gray-500 mt-4'>Loading buildings...</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='Buildings Management' subtitle='Error loading buildings' />
        
        <div className='flex-1 overflow-auto p-6'>
          <div className='max-w-4xl mx-auto'>
            <Card>
              <CardContent className='p-8 text-center'>
                <Building className='w-16 h-16 mx-auto text-red-400 mb-4' />
                <h3 className='text-lg font-semibold text-red-600 mb-2'>Error Loading Buildings</h3>
                <p className='text-gray-500 mb-4'>
                  There was an error loading the buildings data. Please try again later.
                </p>
                <Badge variant='destructive'>Error</Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header 
        title='Buildings Management' 
        subtitle={`Manage all buildings in your organization • ${allBuildings?.length || 0} buildings${searchTerm ? ` (${buildings.length} matching)` : ''}`} 
      />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Building className='w-5 h-5' />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <Button className='h-auto p-4 flex flex-col space-y-2' disabled>
                  <Plus className='w-6 h-6' />
                  <span>Add New Building</span>
                  <Badge variant='secondary' className='text-xs'>Future</Badge>
                </Button>
                <div className='relative'>
                  <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400' />
                  <Input
                    placeholder='Search buildings by name or address...'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className='pl-10 h-auto p-4'
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Buildings List */}
          {buildings && buildings.length > 0 ? (
            <div className='grid gap-6'>
              {buildings.map((building) => (
                <Card key={building.id} className='hover:shadow-lg transition-shadow'>
                  <CardHeader>
                    <div className='flex justify-between items-start'>
                      <div>
                        <CardTitle className='flex items-center gap-2'>
                          <Building className='w-5 h-5' />
                          {building.name}
                        </CardTitle>
                        <p className='text-sm text-gray-600 mt-1'>{building.organizationName}</p>
                      </div>
                      <div className='flex gap-2'>
                        <Badge variant={building.buildingType === 'condo' ? 'default' : 'secondary'}>
                          {building.buildingType === 'condo' ? 'Condo' : 'Rental'}
                        </Badge>
                        <Badge variant='outline'>
                          {building.accessType === 'organization' ? 'Organization' : 'Residence'}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className='grid md:grid-cols-2 gap-4'>
                      {/* Address Information */}
                      <div className='space-y-3'>
                        <div className='flex items-center gap-2'>
                          <MapPin className='w-4 h-4 text-gray-500' />
                          <div>
                            <p className='text-sm font-medium'>{building.address}</p>
                            <p className='text-xs text-gray-500'>
                              {building.city}, {building.province} {building.postalCode}
                            </p>
                          </div>
                        </div>
                        
                        {building.yearBuilt && (
                          <div className='flex items-center gap-2'>
                            <Calendar className='w-4 h-4 text-gray-500' />
                            <span className='text-sm'>Built in {building.yearBuilt}</span>
                          </div>
                        )}

                        {building.managementCompany && (
                          <div className='flex items-center gap-2'>
                            <Building className='w-4 h-4 text-gray-500' />
                            <span className='text-sm'>Managed by {building.managementCompany}</span>
                          </div>
                        )}
                      </div>

                      {/* Building Statistics */}
                      <div className='space-y-3'>
                        <div className='flex items-center gap-2'>
                          <Users className='w-4 h-4 text-gray-500' />
                          <span className='text-sm'>{building.totalUnits} units</span>
                          {building.totalFloors && (
                            <span className='text-xs text-gray-500'>• {building.totalFloors} floors</span>
                          )}
                        </div>

                        {building.parkingSpaces !== null && building.parkingSpaces !== undefined && (
                          <div className='flex items-center gap-2'>
                            <Car className='w-4 h-4 text-gray-500' />
                            <span className='text-sm'>{building.parkingSpaces} parking spaces</span>
                          </div>
                        )}

                        {building.storageSpaces !== null && building.storageSpaces !== undefined && (
                          <div className='flex items-center gap-2'>
                            <Package className='w-4 h-4 text-gray-500' />
                            <span className='text-sm'>{building.storageSpaces} storage spaces</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Amenities */}
                    {building.amenities && building.amenities.length > 0 && (
                      <div className='mt-4 pt-4 border-t'>
                        <p className='text-sm font-medium mb-2'>Amenities:</p>
                        <div className='flex flex-wrap gap-1'>
                          {building.amenities.map((amenity, index) => (
                            <Badge key={index} variant='outline' className='text-xs'>
                              {amenity}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className='p-8 text-center'>
                <Building className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>No Buildings Found</h3>
                <p className='text-gray-500 mb-4'>
                  {user?.role === 'admin' 
                    ? 'No buildings are currently registered in your organizations.' 
                    : 'You don\'t have access to any buildings yet.'}
                </p>
                <Badge variant='secondary'>No Data</Badge>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
