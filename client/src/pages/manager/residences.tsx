import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Home, Search, Edit, Users, Building, MapPin, Car, Package, Bed, Bath } from 'lucide-react';
import { ResidenceEditForm } from '@/components/forms/residence-edit-form';

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

interface Building {
  id: string;
  name: string;
  totalFloors: number;
}

export default function Residences() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all');
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [editingResidence, setEditingResidence] = useState<Residence | null>(null);

  // Fetch residences with search and filters
  const { data: residences, isLoading: residencesLoading, refetch } = useQuery({
    queryKey: ['/api/residences', searchTerm, selectedBuilding, selectedFloor],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedBuilding && selectedBuilding !== 'all') params.append('buildingId', selectedBuilding);
      if (selectedFloor && selectedFloor !== 'all') params.append('floor', selectedFloor);
      
      const response = await fetch(`/api/residences?${params}`);
      if (!response.ok) throw new Error('Failed to fetch residences');
      return response.json() as Promise<Residence[]>;
    }
  });

  // Fetch buildings for filter dropdown
  const { data: buildings } = useQuery({
    queryKey: ['/api/buildings'],
    queryFn: async () => {
      const response = await fetch('/api/buildings');
      if (!response.ok) throw new Error('Failed to fetch buildings');
      return response.json() as Promise<Building[]>;
    }
  });

  // Get unique floors from residences for filter
  const availableFloors = residences 
    ? [...new Set(residences.map(r => r.floor).filter(floor => floor != null))]
        .sort((a, b) => a - b)
    : [];

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
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className='w-full'
                  />
                </div>
                
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Building</label>
                  <Select value={selectedBuilding} onValueChange={setSelectedBuilding}>
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
                  <Select value={selectedFloor} onValueChange={setSelectedFloor}>
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
            ) : residences?.length === 0 ? (
              <Card className='col-span-full'>
                <CardContent className='p-8 text-center'>
                  <Home className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                  <h3 className='text-lg font-semibold text-gray-600 mb-2'>No residences found</h3>
                  <p className='text-gray-500'>Try adjusting your search criteria</p>
                </CardContent>
              </Card>
            ) : (
              residences?.map((residence) => (
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

                    {/* Edit Button */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant='outline' 
                          size='sm' 
                          className='w-full'
                          onClick={() => setEditingResidence(residence)}
                        >
                          <Edit className='w-3 h-3 mr-1' />
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent className='max-w-2xl'>
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
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}