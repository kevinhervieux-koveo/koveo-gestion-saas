// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import { useState, useMemo, useEffect } from 'react';
import { logDebug } from '@/lib/logger';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NoDataCard } from '@/components/ui/no-data-card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { handleApiError } from '@/lib/demo-error-handler';
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
  ArrowLeft,
} from 'lucide-react';
import { BuildingCard, BuildingData as SharedBuildingData } from '@/components/buildings/BuildingCard';
import { Header } from '@/components/layout/header';
import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';
import { Link, useLocation } from 'wouter';

// Form schema for creating/editing buildings
// Schema will be created inside component with translations

// Define the building form schema type (will be defined inside component)
type BuildingFormData = {
  name: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  buildingType: 'condo' | 'appartement';
  totalUnits: number;
  organizationId: string;
};

// Use the shared BuildingData type
type BuildingData = SharedBuildingData;

// BuildingCard component is now imported from shared component

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
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
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
                        <SelectItem value='appartement'>{t('appartementType')}</SelectItem>
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
function BuildingsInner({ organizationId }: { organizationId?: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const [, navigate] = useLocation();

  // Component initialization logging
  useEffect(() => {
    logDebug('🔍 [BUILDINGS] Component mounted', { organizationId });
  }, []);

  // Log organization ID changes
  useEffect(() => {
    logDebug('🔍 [BUILDINGS] Organization context changed:', { organizationId });
  }, [organizationId]);

  const handleBackToOrganization = () => {
    logDebug('🔍 [BUILDINGS] Navigating back to organization selection');
    navigate('/manager/buildings');
  };

  // Create schema with translations
  const buildingFormSchema = z.object({
    name: z.string().min(1, t('buildingNameRequired')).max(255, t('nameTooLong')),
    address: z.string().min(1, t('addressRequired')).max(500, t('addressTooLong')),
    city: z.string().min(1, t('cityRequired')).max(100, t('cityTooLong')),
    province: z.string().min(1, t('provinceRequired')).max(100, t('provinceTooLong')),
    postalCode: z.string().min(1, t('postalCodeRequired')).max(20, t('postalCodeTooLong')),
    buildingType: z.enum(['condo', 'appartement']),
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

  // Log search term changes
  useEffect(() => {
    logDebug('🔍 [BUILDINGS] Search term updated:', searchTerm);
  }, [searchTerm]);

  // Get current user (rely on the default queryFn — providing a custom one
  // that returns the raw Response would corrupt the shared auth cache).
  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
  });

  // Fetch user's organizations to check count
  const {
    data: userOrganizations = [],
    isLoading: isLoadingUserOrganizations,
    isFetching: isFetchingUserOrganizations,
  } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['/api/users/me/organizations'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users/me/organizations');
      return (await response.json()) as Array<{ id: string; name: string }>;
    },
  });

  // Fetch all organizations for form (admin only)
  const { data: organizations = [] } = useQuery({
    queryKey: ['/api/organizations'],
    queryFn: () => apiRequest('GET', '/api/organizations') as Promise<any[]>,
  });

  // Fetch buildings for the selected organization
  const {
    data: buildingsData,
    isLoading,
    error: _error,
  } = useQuery({
    queryKey: ['/api/manager/buildings', organizationId],
    queryFn: async () => {
      logDebug('🔍 [BUILDINGS] Fetching buildings with params:', { organizationId });
      const url = organizationId ? `/api/manager/buildings?organizationId=${organizationId}` : '/api/manager/buildings';
      const response = await apiRequest('GET', url);
      const data = await response.json();
      logDebug('🔍 [BUILDINGS] Received buildings data:', { count: data?.buildings?.length, organizationId });
      return data;
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
  // Exception (task #229): mutations in this file route errors through
  // `handleApiError` for demo-mode/locale-aware messaging and special cases,
  // which `useCreateUpdateMutation` cannot model — kept as raw `useMutation`.
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
      handleApiError(
        error,
        language,
        language === 'fr' ? 'Échec de la création du bâtiment' : 'Failed to create building'
      );
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
      handleApiError(
        error,
        language,
        language === 'fr' ? 'Échec de la mise à jour du bâtiment' : 'Failed to update building'
      );
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
      handleApiError(
        error,
        language,
        language === 'fr' ? 'Échec de la suppression du bâtiment' : 'Failed to delete building'
      );
    },
  });

  // Event handlers
  const handleCreateBuilding = async (data: BuildingFormData) => {
    logDebug('🔍 [BUILDINGS] User action: Creating building', { buildingName: data.name, organizationId: data.organizationId });
    createBuildingMutation.mutate(data);
  };

  const handleEditBuilding = (building: BuildingData) => {
    logDebug('🔍 [BUILDINGS] User action: Editing building', { buildingId: building.id, buildingName: building.name });
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
      logDebug('🔍 [BUILDINGS] User action: Updating building', { buildingId: editingBuilding.id, buildingName: data.name });
      updateBuildingMutation.mutate({ id: editingBuilding.id, data });
    }
  };

  const handleDeleteBuilding = (building: BuildingData) => {
    logDebug('🔍 [BUILDINGS] User action: Initiating building deletion', { buildingId: building.id, buildingName: building.name });
    setDeletingBuilding(building);
  };

  const confirmDeleteBuilding = () => {
    if (deletingBuilding) {
      logDebug('🔍 [BUILDINGS] User action: Confirming building deletion', { buildingId: deletingBuilding.id });
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
                <p className='text-red-500 mb-4'>{t('buildingsLoadDataError')}</p>
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
      <Header title={t('buildingsManagement')} subtitle={t('buildingsManagementSubtitle')} />
      
      {/* Back to Organization Navigation - only show if user has multiple organizations */}
      {organizationId && userOrganizations.length > 1 && (
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center px-6 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToOrganization}
              className="flex items-center gap-2"
              data-testid="button-back-to-organization"
            >
              <ArrowLeft className="w-4 h-4" />
              {(() => {
                const orgName = userOrganizations.find((o) => o.id === organizationId)?.name;
                if (orgName) return orgName;
                if (isLoadingUserOrganizations || isFetchingUserOrganizations) {
                  return <Skeleton className="h-4 w-24" data-testid="skeleton-back-organization" />;
                }
                return t('organization');
              })()}
            </Button>
          </div>
        </div>
      )}

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
                  key={`buildings-page-${building.id}`}
                  building={building}
                  userRole={user?.role}
                  onEdit={handleEditBuilding}
                  onDelete={handleDeleteBuilding}
                  t={t}
                  showEditButtons={true}
                  showResidencesButton={true}
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
                <DialogTitle>{t('deleteBuildingDialogTitle')}</DialogTitle>
                <DialogDescription>
                  {t('deleteBuildingDialogConfirmation').replace(
                    '{name}',
                    deletingBuilding?.name ?? '',
                  )}
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

// Wrap with hierarchical selection HOC using 2-level hierarchy (organization → building)
const Buildings = withHierarchicalSelection(BuildingsInner, {
  hierarchy: ['organization'],
  titleKey: 'buildingsManagement'
});

export default Buildings;