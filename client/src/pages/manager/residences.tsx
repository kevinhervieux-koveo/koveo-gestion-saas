import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Home, Search, Edit, Users, Building, MapPin, Car, Package, Bed, Bath, FileText } from 'lucide-react';
import { ResidenceEditForm } from '@/components/forms/residence-edit-form';

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

/**
 *
 */
interface Building {
  id: string;
  name: string;
  totalFloors: number;
}

/**
 *
 */
export default function /**
   * Residences function.
   */ /**
   * Residences function.
   */

 Residences() {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all');
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [editingResidence, setEditingResidence] = useState<Residence | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch residences with search and filters
  const { _data: residences, isLoading: residencesLoading, refetch } = useQuery({
    queryKey: ['/api/residences', searchTerm, selectedBuilding, selectedFloor],
    queryFn: async () => {
      const params = new URLSearchParams(); /**
   * If function.
   * @param searchTerm - SearchTerm parameter.
   */ /**
   * If function.
   * @param searchTerm - SearchTerm parameter.
   */


      if (searchTerm) {params.append('search', searchTerm);} /**
   * If function.
   * @param selectedBuilding && selectedBuilding !== 'all' - selectedBuilding && selectedBuilding !== 'all' parameter.
   */ /**
   * If function.
   * @param selectedBuilding && selectedBuilding !== 'all' - selectedBuilding && selectedBuilding !== 'all' parameter.
   */


      if (selectedBuilding && selectedBuilding !== 'all') {params.append('buildingId', selectedBuilding);} /**
   * If function.
   * @param selectedFloor && selectedFloor !== 'all' - selectedFloor && selectedFloor !== 'all' parameter.
   */ /**
   * If function.
   * @param selectedFloor && selectedFloor !== 'all' - selectedFloor && selectedFloor !== 'all' parameter.
   */


      if (selectedFloor && selectedFloor !== 'all') {params.append('floor', selectedFloor);}
      
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

      if (!response.ok) {throw new Error('Failed to fetch residences');}
      return response.json() as Promise<Residence[]>;
    }
  });

  // Fetch buildings for filter dropdown - use manager endpoint for proper permissions
  const { _data: buildingsData } = useQuery({
    queryKey: ['/api/manager/buildings'],
    queryFn: async () => {
      const response = await fetch('/api/manager/buildings');
      if (!response.ok) {throw new Error('Failed to fetch buildings');}
      return response.json();
    }
  });

  // Extract buildings array from the response
  const buildings = buildingsData?.buildings || [];

  // Fetch all residences to get complete floor list for filter (without search/filter _params)
  const { _data: allResidences } = useQuery({
    queryKey: ['/api/residences/all'],
    queryFn: async () => {
      const response = await fetch('/api/residences');
      if (!response.ok) {throw new Error('Failed to fetch all residences');}
      return response.json() as Promise<Residence[]>;
    }
  });

  // Get unique floors from all residences for filter dropdown
  const availableFloors = allResidences 
    ? [...new Set(allResidences.map(r => r.floor).filter(floor => floor != null))]
        .sort((a, b) => a - b)
    : [];

  // Reset page when filters change
  const handleBuildingChange = (_value: string) => {
    setSelectedBuilding(_value);
    setCurrentPage(1);
  };

  const handleFloorChange = (_value: string) => {
    setSelectedFloor(_value);
    setCurrentPage(1);
  };

  const handleSearchChange = (_value: string) => {
    setSearchTerm(_value);
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
      <Header title='Residences Management' subtitle='Manage all residences and units' />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          
          {/* Search and Filters */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Search className='w-5 h-5' />
                Search & Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Search</label>
                  <Input
                    placeholder='Search by unit number or tenant name...'
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target._value)}
                    className='w-full'
                  />
                </div>
                
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Building</label>
                  <Select value={selectedBuilding} onValueChange={handleBuildingChange}>
                    <SelectTrigger>
                      <SelectValue placeholder='All Buildings' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>All Buildings</SelectItem>
                      {buildings?.map((building) => (
                        <SelectItem key={building.id} value={building.id}>
                          {building.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Floor</label>
                  <Select value={selectedFloor} onValueChange={handleFloorChange}>
                    <SelectTrigger>
                      <SelectValue placeholder='All Floors' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>All Floors</SelectItem>
                      {availableFloors.map((floor) => (
                        <SelectItem key={floor} value={floor.toString()}>
                          Floor {floor}
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
                  <h3 className='text-lg font-semibold text-gray-600 mb-2'>No residences found</h3>
                  <p className='text-gray-500'>Try adjusting your search criteria</p>
                </CardContent>
              </Card>
            ) : (
              currentResidences.map((residence) => (
                <Card key={residence.id} className='hover:shadow-lg transition-shadow'>
                  <CardContent className='p-6'>
                    <div className='flex justify-between items-start mb-4'>
                      <div>
                        <h3 className='font-semibold text-lg flex items-center gap-2'>
                          <Home className='w-4 h-4' />
                          Unit {residence.unitNumber}
                        </h3>
                        <p className='text-sm text-gray-600 flex items-center gap-1'>
                          <Building className='w-3 h-3' />
                          {residence.building.name}
                        </p>
                        <p className='text-xs text-gray-500 flex items-center gap-1'>
                          <MapPin className='w-3 h-3' />
                          Floor {residence.floor || 'N/A'}
                        </p>
                      </div>
                      <Badge variant={residence.isActive ? 'default' : 'secondary'}>
                        {residence.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    {/* Unit Details */}
                    <div className='space-y-2 mb-4'>
                      <div className='flex items-center gap-4 text-sm'>
                        <span className='flex items-center gap-1'>
                          <Bed className='w-3 h-3' />
                          {residence.bedrooms || 0} bed
                        </span>
                        <span className='flex items-center gap-1'>
                          <Bath className='w-3 h-3' />
                          {residence.bathrooms || 0} bath
                        </span>
                      </div>
                      
                      {residence.squareFootage && (
                        <p className='text-sm text-gray-600'>
                          {residence.squareFootage} sq ft
                        </p>
                      )}
                      
                      {residence.parkingSpaceNumbers?.length > 0 && (
                        <p className='text-sm text-gray-600 flex items-center gap-1'>
                          <Car className='w-3 h-3' />
                          Parking: {residence.parkingSpaceNumbers.join(', ')}
                        </p>
                      )}
                      
                      {residence.storageSpaceNumbers?.length > 0 && (
                        <p className='text-sm text-gray-600 flex items-center gap-1'>
                          <Package className='w-3 h-3' />
                          Storage: {residence.storageSpaceNumbers.join(', ')}
                        </p>
                      )}
                      
                      {residence.monthlyFees && (
                        <p className='text-sm font-medium text-green-600'>
                          ${residence.monthlyFees}/month
                        </p>
                      )}
                    </div>

                    {/* Tenants */}
                    <div className='mb-4'>
                      <h4 className='text-sm font-medium mb-2 flex items-center gap-1'>
                        <Users className='w-3 h-3' />
                        Residents ({residence.tenants.length})
                      </h4>
                      {residence.tenants.length === 0 ? (
                        <p className='text-xs text-gray-500'>No residents assigned</p>
                      ) : (
                        <div className='space-y-1'>
                          {residence.tenants.slice(0, 2).map((tenant) => (
                            <p key={tenant.id} className='text-xs text-gray-600'>
                              {tenant.firstName} {tenant.lastName}
                            </p>
                          ))}
                          {residence.tenants.length > 2 && (
                            <p className='text-xs text-gray-500'>
                              +{residence.tenants.length - 2} more
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className='flex gap-2'>
                      <Button 
                        variant='outline' 
                        size='sm' 
                        className='flex-1'
                        onClick={() => navigate(`/manager/residences/documents?residenceId=${residence.id}`)}
                        title='Manage residence documents'
                      >
                        <FileText className='w-3 h-3 mr-1' />
                        Documents
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant='outline' 
                            size='sm' 
                            className='flex-1'
                            onClick={() => setEditingResidence(residence)}
                          >
                            <Edit className='w-3 h-3 mr-1' />
                            Edit
                          </Button>
                        </DialogTrigger>
                        <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
                        <DialogHeader>
                          <DialogTitle>Edit Unit {residence.unitNumber}</DialogTitle>
                        </DialogHeader>
                        {editingResidence && (
                          <ResidenceEditForm 
                            residence={editingResidence} 
                            onSuccess={() => {
                              refetch();
                              setEditingResidence(null);
                            }}
                          />
                        )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className='flex justify-center items-center gap-4 mt-6'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              
              <div className='flex items-center gap-2'>
                <span className='text-sm text-gray-600'>Page</span>
                <Input
                  type='number'
                  min='1'
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const page = parseInt(e.target._value); /**
   * If function.
   * @param page >= 1 && page <= totalPages - page >= 1 && page <= totalPages parameter.
   */ /**
   * If function.
   * @param page >= 1 && page <= totalPages - page >= 1 && page <= totalPages parameter.
   */


                    if (page >= 1 && page <= totalPages) {
                      setCurrentPage(page);
                    }
                  }}
                  onBlur={(e) => {
                    const page = parseInt(e.target._value);
                    if (isNaN(page) || page < 1) {
                      setCurrentPage(1);
                    } else /**
   * If function.
   * @param page > totalPages - page > totalPages parameter.
   */ /**
   * If function.
   * @param page > totalPages - page > totalPages parameter.
   */

 if (page > totalPages) {
                      setCurrentPage(totalPages);
                    }
                  }}
                  className='w-16 text-center'
                />
                <span className='text-sm text-gray-600'>of {totalPages}</span>
              </div>
              
              <Button
                variant='outline'
                size='sm'
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
              
              <div className='text-sm text-gray-600'>
                Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} residences
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}