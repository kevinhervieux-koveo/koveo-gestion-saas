import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Building, MapPin, Calendar, Users, Phone, Mail, FileText, ChevronDown } from 'lucide-react';
import { Building as BuildingType, Contact } from '@shared/schema';

/**
 *
 */
interface BuildingWithStats extends BuildingType {
  organizationName: string;
  organizationType: string;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  vacantUnits: number;
}

/**
 *
 */
export default function MyBuilding() {
  const [, navigate] = useLocation();
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  // Fetch buildings accessible to the user
  const { data: buildingsData, isLoading: isLoadingBuildings } = useQuery<{buildings: BuildingWithStats[]}>({
    queryKey: ['/api/manager/buildings'],
  });

  const buildings: BuildingWithStats[] = buildingsData?.buildings || [];
  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId) || buildings[0];

  // Set initial building selection
  useEffect(() => {
    if (buildings.length > 0 && !selectedBuildingId) {
      setSelectedBuildingId(buildings[0].id);
    }
  }, [buildings, selectedBuildingId]);

  // Fetch building contacts
  const { data: contacts, isLoading: isLoadingContacts } = useQuery({
    queryKey: ['/api/contacts/building', selectedBuildingId],
    queryFn: async () => {
      if (!selectedBuildingId) {return [];}
      const response = await fetch(`/api/contacts/building/${selectedBuildingId}`);
      if (!response.ok) {return [];}
      return response.json();
    },
    enabled: !!selectedBuildingId,
  });

  const handleViewDocuments = () => {
    if (selectedBuildingId) {
      navigate(`/residents/building/documents?buildingId=${selectedBuildingId}`);
    }
  };

  if (isLoadingBuildings) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='My Building' subtitle='View building information and contacts' />
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
        <Header title='My Building' subtitle='View building information and contacts' />
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
      <Header title='My Building' subtitle='View building information and contacts' />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-4xl mx-auto space-y-6'>
          {/* Building Selector - only show if user has multiple buildings */}
          {buildings.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className='text-sm font-medium'>Select Building</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedBuildingId || ''}
                  onValueChange={setSelectedBuildingId}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Select a building' />
                    <ChevronDown className='w-4 h-4' />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map((building) => (
                      <SelectItem key={building.id} value={building.id}>
                        {building.name} - {building.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Building Information Card */}
          {selectedBuilding && (
            <Card>
              <CardHeader>
                <div className='flex items-center justify-between'>
                  <CardTitle className='flex items-center gap-2'>
                    <Building className='w-5 h-5' />
                    Building Information
                  </CardTitle>
                  <Button onClick={handleViewDocuments} variant='outline' size='sm'>
                    <FileText className='w-4 h-4 mr-2' />
                    View Documents
                  </Button>
                </div>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div>
                  <h3 className='text-xl font-semibold mb-2'>{selectedBuilding.name}</h3>
                  <div className='flex items-center gap-2 text-muted-foreground mb-4'>
                    <MapPin className='w-4 h-4' />
                    <span>{selectedBuilding.address}, {selectedBuilding.city}, {selectedBuilding.province} {selectedBuilding.postalCode}</span>
                  </div>
                </div>

                <Separator />

                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
                  <div>
                    <p className='text-sm text-muted-foreground'>Building Type</p>
                    <p className='font-medium capitalize'>{selectedBuilding.buildingType}</p>
                  </div>
                  {selectedBuilding.yearBuilt && (
                    <div>
                      <p className='text-sm text-muted-foreground'>Year Built</p>
                      <p className='font-medium'>{selectedBuilding.yearBuilt}</p>
                    </div>
                  )}
                  <div>
                    <p className='text-sm text-muted-foreground'>Total Units</p>
                    <p className='font-medium'>{selectedBuilding.totalUnits}</p>
                  </div>
                  {selectedBuilding.totalFloors && (
                    <div>
                      <p className='text-sm text-muted-foreground'>Total Floors</p>
                      <p className='font-medium'>{selectedBuilding.totalFloors}</p>
                    </div>
                  )}
                  {selectedBuilding.parkingSpaces && (
                    <div>
                      <p className='text-sm text-muted-foreground'>Parking Spaces</p>
                      <p className='font-medium'>{selectedBuilding.parkingSpaces}</p>
                    </div>
                  )}
                  {selectedBuilding.storageSpaces && (
                    <div>
                      <p className='text-sm text-muted-foreground'>Storage Spaces</p>
                      <p className='font-medium'>{selectedBuilding.storageSpaces}</p>
                    </div>
                  )}
                  {selectedBuilding.managementCompany && (
                    <div>
                      <p className='text-sm text-muted-foreground'>Management Company</p>
                      <p className='font-medium'>{selectedBuilding.managementCompany}</p>
                    </div>
                  )}
                  <div>
                    <p className='text-sm text-muted-foreground'>Organization</p>
                    <p className='font-medium'>{selectedBuilding.organizationName}</p>
                  </div>
                </div>

                {selectedBuilding.amenities && (
                  <>
                    <Separator />
                    <div>
                      <p className='text-sm text-muted-foreground mb-2'>Amenities</p>
                      <div className='flex flex-wrap gap-2'>
                        {(() => {
                          try {
                            const amenities = typeof selectedBuilding.amenities === 'string' 
                              ? JSON.parse(selectedBuilding.amenities)
                              : selectedBuilding.amenities;
                            return Array.isArray(amenities) 
                              ? amenities.map((amenity: string, index: number) => (
                                  <span key={index} className='px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-sm'>
                                    {amenity}
                                  </span>
                                ))
                              : null;
                          } catch (_e) {
                            return <span className='text-sm text-muted-foreground'>Unable to display amenities</span>;
                          }
                        })()}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Building Contacts Card */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Users className='w-5 h-5' />
                Building Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingContacts ? (
                <div className='text-center py-4'>
                  <div className='animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mx-auto'></div>
                  <p className='text-muted-foreground mt-2 text-sm'>Loading contacts...</p>
                </div>
              ) : !contacts || contacts.length === 0 ? (
                <div className='text-center py-8 text-muted-foreground'>
                  <Users className='w-12 h-12 mx-auto mb-2 opacity-50' />
                  <p>No contacts available for this building</p>
                </div>
              ) : (
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  {contacts.map((contact: Contact) => (
                    <div key={contact.id} className='border rounded-lg p-4'>
                      <div className='flex items-center justify-between mb-2'>
                        <h4 className='font-medium'>{contact.name}</h4>
                        <span className='px-2 py-1 bg-primary/10 text-primary text-xs rounded-full capitalize'>
                          {contact.contactCategory}
                        </span>
                      </div>
                      <div className='space-y-1'>
                        {contact.email && (
                          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                            <Mail className='w-3 h-3' />
                            <a href={`mailto:${contact.email}`} className='hover:text-primary'>
                              {contact.email}
                            </a>
                          </div>
                        )}
                        {contact.phone && (
                          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                            <Phone className='w-3 h-3' />
                            <a href={`tel:${contact.phone}`} className='hover:text-primary'>
                              {contact.phone}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}