import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Building, MapPin, Calendar, Users, Phone, Mail, FileText, Home, Car, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { Building as BuildingType, Contact } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

interface BuildingWithStats extends BuildingType {
  organizationName: string;
  organizationType: string;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  vacantUnits: number;
}

export default function MyBuilding() {
  const [, navigate] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch buildings accessible to the user
  const { data: buildingsData, isLoading: isLoadingBuildings } = useQuery<{buildings: BuildingWithStats[]}>({
    queryKey: ['/api/manager/buildings'],
    queryFn: () => apiRequest("GET", "/api/manager/buildings"),
  });

  const buildings: BuildingWithStats[] = buildingsData?.buildings || [];

  // Pagination calculations
  const totalPages = Math.ceil(buildings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBuildings = buildings.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };

  const handleViewDocuments = (buildingId: string) => {
    navigate(`/residents/building/documents?buildingId=${buildingId}`);
  };

  if (isLoadingBuildings) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='My Buildings' subtitle='View buildings you have access to' />
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

  if (buildings.length === 0) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='My Buildings' subtitle='View buildings you have access to' />
        <div className='flex-1 overflow-auto p-6'>
          <div className='max-w-4xl mx-auto'>
            <Card>
              <CardContent className='p-8 text-center'>
                <Building className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>No Buildings Found</h3>
                <p className='text-gray-500'>You don't have access to any buildings yet.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='My Buildings' subtitle='View buildings you have access to' />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Building Cards */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {currentBuildings.map((building) => (
              <Card key={building.id} className='hover:shadow-lg transition-shadow'>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Building className='w-5 h-5' />
                    {building.name}
                  </CardTitle>
                  <div className='text-sm text-muted-foreground'>
                    {building.organizationName}
                  </div>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='grid grid-cols-1 gap-3'>
                    <div>
                      <Label className='text-xs font-medium text-gray-500'>Address</Label>
                      <div className='flex items-start gap-2'>
                        <MapPin className='w-3 h-3 mt-0.5' />
                        <div>
                          <p className='text-sm text-gray-700'>{building.address}</p>
                          <p className='text-sm text-gray-700'>
                            {building.city}, {building.province} {building.postalCode}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className='grid grid-cols-2 gap-3'>
                      <div>
                        <Label className='text-xs font-medium text-gray-500'>Building Type</Label>
                        <p className='text-sm text-gray-700 capitalize'>{building.buildingType}</p>
                      </div>
                      {building.yearBuilt && (
                        <div>
                          <Label className='text-xs font-medium text-gray-500'>Year Built</Label>
                          <div className='flex items-center gap-1'>
                            <Calendar className='w-3 h-3' />
                            <span className='text-sm text-gray-700'>{building.yearBuilt}</span>
                          </div>
                        </div>
                      )}
                      <div>
                        <Label className='text-xs font-medium text-gray-500'>Total Units</Label>
                        <div className='flex items-center gap-1'>
                          <Home className='w-3 h-3' />
                          <span className='text-sm text-gray-700'>{building.totalUnits}</span>
                        </div>
                      </div>
                      {building.totalFloors && (
                        <div>
                          <Label className='text-xs font-medium text-gray-500'>Floors</Label>
                          <p className='text-sm text-gray-700'>{building.totalFloors}</p>
                        </div>
                      )}
                    </div>
                    
                    {(building.parkingSpaces || building.storageSpaces) && (
                      <div className='grid grid-cols-2 gap-3'>
                        {building.parkingSpaces && (
                          <div>
                            <Label className='text-xs font-medium text-gray-500'>Parking</Label>
                            <div className='flex items-center gap-1'>
                              <Car className='w-3 h-3' />
                              <span className='text-sm text-gray-700'>{building.parkingSpaces}</span>
                            </div>
                          </div>
                        )}
                        {building.storageSpaces && (
                          <div>
                            <Label className='text-xs font-medium text-gray-500'>Storage</Label>
                            <div className='flex items-center gap-1'>
                              <Package className='w-3 h-3' />
                              <span className='text-sm text-gray-700'>{building.storageSpaces}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {building.managementCompany && (
                      <div>
                        <Label className='text-xs font-medium text-gray-500'>Management Company</Label>
                        <p className='text-sm text-gray-700'>{building.managementCompany}</p>
                      </div>
                    )}

                    {/* Occupancy Stats */}
                    <div>
                      <Label className='text-xs font-medium text-gray-500'>Occupancy</Label>
                      <div className='flex items-center gap-2 text-sm'>
                        <Badge variant="outline" className='text-xs'>
                          {building.occupiedUnits}/{building.totalUnits} units
                        </Badge>
                        <Badge variant={building.occupancyRate >= 90 ? "default" : building.occupancyRate >= 70 ? "secondary" : "destructive"} className='text-xs'>
                          {Math.round(building.occupancyRate)}% occupied
                        </Badge>
                      </div>
                    </div>
                    
                    {building.amenities && (
                      <div>
                        <Label className='text-xs font-medium text-gray-500'>Amenities</Label>
                        <div className='flex flex-wrap gap-1 mt-1'>
                          {(() => {
                            try {
                              const amenities = typeof building.amenities === 'string' 
                                ? JSON.parse(building.amenities)
                                : building.amenities;
                              return Array.isArray(amenities) 
                                ? amenities.slice(0, 3).map((amenity: string, index: number) => (
                                    <Badge key={index} variant="outline" className='text-xs'>
                                      {amenity}
                                    </Badge>
                                  ))
                                : null;
                            } catch (_e) {
                              return <span className='text-xs text-muted-foreground'>Unable to display amenities</span>;
                            }
                          })()}
                          {(() => {
                            try {
                              const amenities = typeof building.amenities === 'string' 
                                ? JSON.parse(building.amenities)
                                : building.amenities;
                              if (Array.isArray(amenities) && amenities.length > 3) {
                                return (
                                  <Badge variant="outline" className='text-xs'>
                                    +{amenities.length - 3} more
                                  </Badge>
                                );
                              }
                            } catch (_e) {
                              // Ignore error
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className='pt-4 border-t'>
                    <Button 
                      onClick={() => handleViewDocuments(building.id)} 
                      variant='outline' 
                      size='sm'
                      className='w-full justify-start'
                    >
                      <FileText className='w-4 h-4 mr-2' />
                      View Documents
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex items-center justify-center gap-2 mt-8'>
              <Button
                variant='outline'
                size='sm'
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className='h-4 w-4' />
                Previous
              </Button>
              
              <div className='flex gap-1'>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size='sm'
                      onClick={() => handlePageClick(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant='outline'
                size='sm'
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className='h-4 w-4' />
              </Button>
            </div>
          )}
          
          {/* Page info */}
          <div className='text-center text-sm text-muted-foreground mt-4'>
            Showing {startIndex + 1} to {Math.min(endIndex, buildings.length)} of {buildings.length} buildings
          </div>
        </div>
      </div>
    </div>
  );
}