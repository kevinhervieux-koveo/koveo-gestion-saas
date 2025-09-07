import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NoDataCard } from '@/components/ui/no-data-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import {
  Building,
  Search,
  Plus,
  Edit,
  Trash2,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Users,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Link } from 'wouter';

// Form schema for creating/editing buildings
// Schema will be created inside component with translations

/**
 *
 */
type BuildingFormData = z.infer<typeof buildingFormSchema>;

/**
 *
 */
interface BuildingData {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  buildingType: string;
  totalUnits: number;
  organizationId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 *
 */
interface BuildingCardProps {
  building: BuildingData;
  userRole?: string;
  onEdit: (building: BuildingData) => void;
  onDelete: (building: BuildingData) => void;
  t: (key: string) => string;
}

/**
 *
 * @param root0
 * @param root0.building
 * @param root0.userRole
 * @param root0.onEdit
 * @param root0.onDelete
 */
function BuildingCard({ building, userRole, onEdit, onDelete, t }: BuildingCardProps) {
  const isAdmin = userRole === 'admin';
  const canEdit = ['admin', 'manager'].includes(userRole || '');

  return (
    <Card className='h-full'>
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div className='flex items-center space-x-2'>
            <Building className='h-5 w-5 text-blue-600' />
            <CardTitle className='text-lg line-clamp-2 break-words'>{building.name}</CardTitle>
          </div>
          {canEdit && (
            <div className='flex gap-1'>
              <Button size='sm' variant='ghost' onClick={() => onEdit(building)}>
                <Edit className='h-3 w-3' />
              </Button>
              {isAdmin && (
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => onDelete(building)}
                  className='text-red-600 hover:text-red-700'
                >
                  <Trash2 className='h-3 w-3' />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-2'>
          <div className='flex items-center text-sm text-gray-600'>
            <MapPin className='h-4 w-4 mr-2' />
            <span className='line-clamp-2 break-words flex-1'>{building.address}</span>
          </div>
          <div className='flex items-center text-sm text-gray-600'>
            <span>
              {building.city}, {building.province} {building.postalCode}
            </span>
          </div>
          <div className='flex items-center justify-between pt-2'>
            <Badge variant='outline'>{building.totalUnits} {t('unitsCount')}</Badge>
            <Badge variant='secondary'>{building.buildingType}</Badge>
          </div>
          <div className='pt-2 flex gap-2'>
            <Link href={`/manager/buildings/${building.id}/documents`}>
              <Button size='sm' variant='outline' className='flex-1'>
                Documents
              </Button>
            </Link>
            <Link href={`/manager/residences?buildingId=${building.id}`}>
              <Button size='sm' variant='outline' className='flex-1'>
                Residences
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 *
 */
interface BuildingFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  form: any;
  onSubmit: (data: BuildingFormData) => void;
  organizations: any[];
  isSubmitting: boolean;
  title: string;
  submitLabel: string;
  t: (key: string) => string;
}

/**
 *
 * @param root0
 * @param root0.isOpen
 * @param root0.onOpenChange
 * @param root0.form
 * @param root0.onSubmit
 * @param root0.organizations
 * @param root0.isSubmitting
 * @param root0.title
 * @param root0.submitLabel
 */
function BuildingForm({
  isOpen,
  onOpenChange,
  form,
  onSubmit,
  organizations,
  isSubmitting,
  title,
  submitLabel,
  t,
}: BuildingFormProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {t('fillBuildingInfo')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem className='md:col-span-2'>
                    <FormLabel>{t('buildingName')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('enterBuildingName')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='address'
                render={({ field }) => (
                  <FormItem className='md:col-span-2'>
                    <FormLabel>{t('buildingAddress')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('enterStreetAddress')} {...field} />
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
                    <FormLabel>{t('buildingCity')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('enterCity')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='province'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('buildingProvince')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectProvince')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='QC'>Quebec</SelectItem>
                        <SelectItem value='ON'>Ontario</SelectItem>
                        <SelectItem value='BC'>British Columbia</SelectItem>
                        <SelectItem value='AB'>Alberta</SelectItem>
                        <SelectItem value='MB'>Manitoba</SelectItem>
                        <SelectItem value='SK'>Saskatchewan</SelectItem>
                        <SelectItem value='NS'>Nova Scotia</SelectItem>
                        <SelectItem value='NB'>New Brunswick</SelectItem>
                        <SelectItem value='PE'>Prince Edward Island</SelectItem>
                        <SelectItem value='NL'>Newfoundland and Labrador</SelectItem>
                        <SelectItem value='NT'>Northwest Territories</SelectItem>
                        <SelectItem value='NU'>Nunavut</SelectItem>
                        <SelectItem value='YT'>Yukon</SelectItem>
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
                    <FormLabel>{t('buildingPostalCode')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('enterPostalCode')} {...field} />
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
                    <FormLabel>{t('buildingType')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectBuildingType')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='condo'>{t('condoType')}</SelectItem>
                        <SelectItem value='apartment'>{t('apartmentType')}</SelectItem>
                        <SelectItem value='townhouse'>{t('townhouseType')}</SelectItem>
                        <SelectItem value='commercial'>{t('commercialType')}</SelectItem>
                        <SelectItem value='mixed_use'>{t('mixedUseType')}</SelectItem>
                        <SelectItem value='other'>{t('otherBuildingType')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='totalUnits'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('totalUnits')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        placeholder='Enter total units'
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
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
                    <FormLabel>{t('organizationLabel')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectOrganization')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button type='submit' disabled={isSubmitting}>
                {isSubmitting ? t('saving') : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 *
 */
export default function Buildings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  // Create schema with translations
  const buildingFormSchema = z.object({
    name: z.string().min(1, t('buildingNameRequired')).max(255, t('nameTooLong')),
    address: z.string().min(1, t('addressRequired')).max(500, t('addressTooLong')),
    city: z.string().min(1, t('cityRequired')).max(100, t('cityTooLong')),
    province: z.string().min(1, t('provinceRequired')).max(100, t('provinceTooLong')),
    postalCode: z.string().min(1, t('postalCodeRequired')).max(20, t('postalCodeTooLong')),
    buildingType: z.enum(['condo', 'apartment', 'townhouse', 'commercial', 'mixed_use', 'other']),
    totalUnits: z
      .number()
      .int()
      .min(1, t('mustHaveAtLeastOneUnit'))
      .max(300, t('maximumUnitsAllowed')),
    organizationId: z.string().min(1, t('organizationRequired')),
  });

  // State variables
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<BuildingData | null>(null);
  const [deletingBuilding, setDeletingBuilding] = useState<BuildingData | null>(null);

  // Get current user
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: () => apiRequest('GET', '/api/auth/user') as Promise<any>,
  });

  // Fetch organizations for form
  const { data: organizations = [] } = useQuery({
    queryKey: ['/api/organizations'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/organizations');
      return await response.json();
    },
  });

  // Fetch buildings using the working manager endpoint
  const {
    data: buildingsData,
    isLoading,
    error: _error,
  } = useQuery({
    queryKey: ['/api/manager/buildings'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/manager/buildings');
      return await response.json();
    },
  });

  // Extract buildings array from the wrapped response
  const buildings = (buildingsData as any)?.buildings || [];

  // Filter buildings based on search
  const filteredBuildings = useMemo(() => {
    if (!Array.isArray(buildings)) {
      return [];
    }
    return buildings.filter(
      (building) =>
        building.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        building.address.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [buildings, searchTerm]);

  // Form for creating buildings
  const form = useForm<BuildingFormData>({
    resolver: zodResolver(buildingFormSchema),
    defaultValues: {
      name: '',
      address: '',
      city: '',
      province: 'QC',
      postalCode: '',
      buildingType: 'condo',
      totalUnits: 1,
      organizationId: '',
    },
  });

  // Form for editing buildings
  const editForm = useForm<BuildingFormData>({
    resolver: zodResolver(buildingFormSchema),
  });

  // Mutations
  const createBuildingMutation = useMutation({
    mutationFn: (data: BuildingFormData) => apiRequest('POST', '/api/admin/buildings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/manager/buildings'] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({
        title: 'Success',
        description: 'Building created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create building',
        variant: 'destructive',
      });
    },
  });

  const updateBuildingMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BuildingFormData }) =>
      apiRequest('PUT', `/api/admin/buildings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/manager/buildings'] });
      setIsEditDialogOpen(false);
      setEditingBuilding(null);
      editForm.reset();
      toast({
        title: 'Success',
        description: 'Building updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update building',
        variant: 'destructive',
      });
    },
  });

  const deleteBuildingMutation = useMutation({
    mutationFn: (buildingId: string) => apiRequest('DELETE', `/api/admin/buildings/${buildingId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/manager/buildings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/buildings'] });
      setDeletingBuilding(null);
      toast({
        title: 'Success',
        description: 'Building deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete building',
        variant: 'destructive',
      });
    },
  });

  // Event handlers
  const handleCreateBuilding = async (data: BuildingFormData) => {
    createBuildingMutation.mutate(data);
  };

  const handleEditBuilding = (building: BuildingData) => {
    setEditingBuilding(building);
    editForm.reset({
      name: building.name,
      address: building.address,
      city: building.city,
      province: building.province,
      postalCode: building.postalCode,
      buildingType: building.buildingType as any,
      totalUnits: building.totalUnits,
      organizationId: building.organizationId,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateBuilding = async (data: BuildingFormData) => {
    if (editingBuilding) {
      updateBuildingMutation.mutate({ id: editingBuilding.id, data });
    }
  };

  const handleDeleteBuilding = (building: BuildingData) => {
    setDeletingBuilding(building);
  };

  const confirmDeleteBuilding = () => {
    if (deletingBuilding) {
      deleteBuildingMutation.mutate(deletingBuilding.id);
    }
  };

  if (isLoading) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='Buildings' subtitle='Loading buildings...' />
        <div className='flex-1 overflow-auto p-6'>
          <div className='text-center py-8'>Loading buildings...</div>
        </div>
      </div>
    );
  }

  if (_error) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='Buildings' subtitle='Error loading buildings' />

        <div className='flex-1 overflow-auto p-6'>
          <div className='max-w-4xl mx-auto'>
            <Card>
              <CardContent className='p-8 text-center'>
                <Building className='w-16 h-16 mx-auto text-red-400 mb-4' />
                <h3 className='text-lg font-semibold text-red-600 mb-2'>Error Loading Buildings</h3>
                <p className='text-red-500 mb-4'>
                  Failed to load buildings data. Please try again later.
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
        title={t('buildings')}
        subtitle={t('manageBuildings')}
      />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-6xl mx-auto space-y-6'>
          {/* Search and Add Building Controls */}
          <div className='flex flex-col sm:flex-row gap-4 items-center justify-between'>
            <div className='relative w-full sm:w-96'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4' />
              <Input
                placeholder={t('searchBuildingsAddress')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='pl-10'
              />
            </div>

            {user?.role === 'admin' && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className='w-4 h-4 mr-2' />
                {t('addBuilding')}
              </Button>
            )}
          </div>

          {/* Buildings Grid */}
          {filteredBuildings.length > 0 ? (
            <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6'>
              {filteredBuildings.map((building) => (
                <BuildingCard
                  key={building.id}
                  building={building}
                  userRole={user?.role}
                  onEdit={handleEditBuilding}
                  onDelete={handleDeleteBuilding}
                  t={t}
                />
              ))}
            </div>
          ) : (
            <NoDataCard
              icon={Building}
              titleKey="noBuildingsFound"
              descriptionKey={user?.role === 'admin' ? 'noBuildingsAdminMessage' : 'noBuildingsUserMessage'}
              badgeKey="noData"
              testId="no-buildings-message"
            />
          )}

          {/* Add Building Dialog */}
          <BuildingForm
            isOpen={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
            form={form}
            onSubmit={handleCreateBuilding}
            organizations={organizations}
            isSubmitting={createBuildingMutation.isPending}
            title={t('addBuilding')}
            submitLabel={t('createBuilding')}
            t={t}
          />

          {/* Edit Building Dialog */}
          <BuildingForm
            isOpen={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            form={editForm}
            onSubmit={handleUpdateBuilding}
            organizations={organizations}
            isSubmitting={updateBuildingMutation.isPending}
            title={t('editBuilding')}
            submitLabel={t('save')}
            t={t}
          />

          {/* Delete Confirmation Dialog */}
          <Dialog open={!!deletingBuilding} onOpenChange={() => setDeletingBuilding(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Building</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete "{deletingBuilding?.name}"? This action cannot be
                  undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant='outline' onClick={() => setDeletingBuilding(null)}>
                  Cancel
                </Button>
                <Button
                  variant='destructive'
                  onClick={confirmDeleteBuilding}
                  disabled={deleteBuildingMutation.isPending}
                >
                  {deleteBuildingMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
