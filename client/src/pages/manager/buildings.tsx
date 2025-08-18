import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building, Plus, Search, MapPin, Calendar, Users, Car, Package } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
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

interface Organization {
  id: string;
  name: string;
  type: string;
}

// Building form schema - only name and organization are required
const buildingFormSchema = z.object({
  name: z.string().min(1, 'Building name is required'),
  organizationId: z.string().min(1, 'Organization is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  buildingType: z.enum(['condo', 'rental']).optional(),
  yearBuilt: z.number().optional(),
  totalUnits: z.number().optional(),
  totalFloors: z.number().optional(),
  parkingSpaces: z.number().optional(),
  storageSpaces: z.number().optional(),
  managementCompany: z.string().optional(),
});

type BuildingFormData = z.infer<typeof buildingFormSchema>;

/**
 * Buildings management page for Admin and Manager roles.
 * Shows all buildings in the user's organization with proper access control.
 */
export default function Buildings() {
  const { user, isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch buildings data
  const { 
    data: buildingsResponse, 
    isLoading, 
    error 
  } = useQuery<{buildings: BuildingData[]}>({
    queryKey: ['/api/manager/buildings'],
    enabled: isAuthenticated && hasRoleOrHigher(user?.role, 'manager'),
  });

  // Fetch organizations for admin users
  const { 
    data: organizationsResponse 
  } = useQuery<{organizations: Organization[]}>({
    queryKey: ['/api/admin/organizations'],
    enabled: isAuthenticated && user?.role === 'admin',
  });

  const allBuildings = buildingsResponse?.buildings || [];
  const organizations = organizationsResponse?.organizations || [];

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

  // Form for adding new building
  const form = useForm<BuildingFormData>({
    resolver: zodResolver(buildingFormSchema),
    defaultValues: {
      name: '',
      organizationId: '',
      address: '',
      city: '',
      province: 'QC',
      postalCode: '',
      buildingType: 'condo',
      yearBuilt: undefined,
      totalUnits: undefined,
      totalFloors: undefined,
      parkingSpaces: undefined,
      storageSpaces: undefined,
      managementCompany: '',
    },
  });

  // Mutation for creating new building
  const createBuildingMutation = useMutation({
    mutationFn: async (data: BuildingFormData) => {
      const response = await fetch('/api/admin/buildings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create building');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Building created',
        description: 'The building has been successfully added.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/manager/buildings'] });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create building.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: BuildingFormData) => {
    createBuildingMutation.mutate(data);
  };

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
                {user?.role === 'admin' ? (
                  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className='h-auto p-4 flex flex-col space-y-2'>
                        <Plus className='w-6 h-6' />
                        <span>Add New Building</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
                      <DialogHeader>
                        <DialogTitle>Add New Building</DialogTitle>
                      </DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
                          {/* Required Fields */}
                          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <FormField
                              control={form.control}
                              name='name'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Building Name *</FormLabel>
                                  <FormControl>
                                    <Input placeholder='Enter building name' {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name='organizationId'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Organization *</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder='Select organization' />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {organizations.map((org) => (
                                        <SelectItem key={org.id} value={org.id}>
                                          {org.name} ({org.type})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Optional Address Fields */}
                          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <FormField
                              control={form.control}
                              name='address'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Address</FormLabel>
                                  <FormControl>
                                    <Input placeholder='Street address' {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name='city'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>City</FormLabel>
                                  <FormControl>
                                    <Input placeholder='City' {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                            <FormField
                              control={form.control}
                              name='province'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Province</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value='QC'>Quebec</SelectItem>
                                      <SelectItem value='ON'>Ontario</SelectItem>
                                      <SelectItem value='BC'>British Columbia</SelectItem>
                                      <SelectItem value='AB'>Alberta</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name='postalCode'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Postal Code</FormLabel>
                                  <FormControl>
                                    <Input placeholder='H1A 1B1' {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name='buildingType'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Building Type</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value='condo'>Condo</SelectItem>
                                      <SelectItem value='rental'>Rental</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Optional Building Details */}
                          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                            <FormField
                              control={form.control}
                              name='yearBuilt'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Year Built</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type='number' 
                                      placeholder='2020' 
                                      value={field.value || ''}
                                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name='totalUnits'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Total Units</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type='number' 
                                      placeholder='100' 
                                      value={field.value || ''}
                                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name='totalFloors'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Total Floors</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type='number' 
                                      placeholder='10' 
                                      value={field.value || ''}
                                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <FormField
                              control={form.control}
                              name='parkingSpaces'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Parking Spaces</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type='number' 
                                      placeholder='50' 
                                      value={field.value || ''}
                                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name='storageSpaces'
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Storage Spaces</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type='number' 
                                      placeholder='25' 
                                      value={field.value || ''}
                                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name='managementCompany'
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Management Company</FormLabel>
                                <FormControl>
                                  <Input placeholder='Management company name' {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className='flex justify-end space-x-2 pt-4'>
                            <Button 
                              type='button' 
                              variant='outline' 
                              onClick={() => setIsAddDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button 
                              type='submit' 
                              disabled={createBuildingMutation.isPending}
                            >
                              {createBuildingMutation.isPending ? 'Creating...' : 'Create Building'}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Button className='h-auto p-4 flex flex-col space-y-2' disabled>
                    <Plus className='w-6 h-6' />
                    <span>Add New Building</span>
                    <Badge variant='secondary' className='text-xs'>Admin Only</Badge>
                  </Button>
                )}
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
