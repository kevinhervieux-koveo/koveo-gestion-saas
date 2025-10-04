import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Search, AlertCircle, Clock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import DemandDetailsPopup from '@/components/demands/demand-details-popup';
import { Header } from '@/components/layout/header';
import { useFilterSort, FilterSortConfig } from '@/lib/filter-sort';
import type { Demand as DemandType } from '@/../../shared/schema';

// Types - extending the base Demand type with populated relations
interface Demand extends Omit<DemandType, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
  submitter?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  residence?: {
    id: string;
    unitNumber: string;
    buildingId: string;
  };
  building?: {
    id: string;
    name: string;
    address: string;
  };
}

/**
 *
 */
interface Building {
  id: string;
  name: string;
}

/**
 *
 */
interface Residence {
  id: string;
  name: string;
  buildingId: string;
}

// Form schemas
const demandSchema = z.object({
  type: z.enum(['maintenance', 'complaint', 'information', 'other']),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  buildingId: z.string().min(1, 'Building is required'),
  residenceId: z.string().optional(),
  assignationBuildingId: z.string().optional(),
  assignationResidenceId: z.string().optional(),
});

/**
 *
 */
type DemandFormData = z.infer<typeof demandSchema>;

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

// Type labels will use translation function instead of static object

/**
 *
 */
export default function ManagerDemandsPage() {
  const { toast } = useToast();
  const { t } = useLanguage();

  // Component initialization logging
  useEffect(() => {
    console.log('🔍 [DEMANDS] Component mounted');
  }, []);

  // Function to get translated type labels
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'maintenance': return t('maintenanceType');
      case 'complaint': return t('complaintType');
      case 'information': return t('informationType');
      case 'other': return t('otherType');
      default: return type;
    }
  };

  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);
  const [isNewDemandOpen, setIsNewDemandOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Fetch demands
  const {
    data: demands = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/demands'],
    refetchInterval: 30000, // Refresh every 30 seconds
    queryFn: async ({ queryKey }) => {
      console.log('🔍 [DEMANDS] Fetching demands');
      const response = await fetch(queryKey[0] as string);
      const data = await response.json();
      console.log('🔍 [DEMANDS] Received demands:', { count: data?.length });
      return data;
    },
  });

  // Fetch buildings
  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings'],
  });

  // Fetch residences
  const { data: residences = [] } = useQuery<Residence[]>({
    queryKey: ['/api/residences'],
  });

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/user'],
  });

  // Provide default user to prevent type errors
  const defaultUser = currentUser || {
    id: '',
    role: 'tenant' as const,
    email: '',
    firstName: '',
    lastName: '',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };

  // Create demand mutation
  const createDemandMutation = useMutation({
    mutationFn: async (data: DemandFormData) => {
      console.log('🔍 [DEMANDS] User action: Creating demand', { type: data.type, building: data.buildingId });
      const response = await fetch('/api/demands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create demand');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demands'] });
      setIsNewDemandOpen(false);
      newDemandForm.reset();
      toast({
        title: t('success'),
        description: t('demandCreatedSuccess'),
      });
    },
    onError: (error: any) => {
      // Error creating demand
      toast({
        title: t('error'),
        description: t('failedCreateDemand'),
        variant: 'destructive',
      });
    },
  });

  // Forms
  const newDemandForm = useForm<DemandFormData>({
    resolver: zodResolver(demandSchema),
    defaultValues: {
      type: 'maintenance',
      description: '',
      buildingId: '',
      residenceId: '',
      assignationBuildingId: '',
      assignationResidenceId: '',
    },
  });

  // Configure filter/sort for demands
  const filterSortConfig: FilterSortConfig = useMemo(() => ({
    filters: [
      {
        id: 'status',
        field: 'status',
        label: t('status'),
        type: 'select',
        icon: Clock,
        options: [
          { label: t('submitted'), value: 'submitted' },
          { label: t('underReview'), value: 'under_review' },
          { label: t('approved'), value: 'approved' },
          { label: t('inProgress'), value: 'in_progress' },
          { label: t('completed'), value: 'completed' },
          { label: t('rejected'), value: 'rejected' },
          { label: t('cancelled'), value: 'cancelled' },
          { label: t('draft'), value: 'draft' },
        ],
        defaultOperator: 'equals',
      },
      {
        id: 'type',
        field: 'type',
        label: t('type'),
        type: 'select',
        icon: FileText,
        options: [
          { label: t('maintenanceType'), value: 'maintenance' },
          { label: t('complaintType'), value: 'complaint' },
          { label: t('informationType'), value: 'information' },
          { label: t('otherType'), value: 'other' },
        ],
        defaultOperator: 'equals',
      },
    ],
    sortOptions: [
      { field: 'createdAt', label: t('created'), defaultDirection: 'desc' },
      { field: 'updatedAt', label: 'Updated', defaultDirection: 'desc' },
      { field: 'status', label: t('status') },
      { field: 'type', label: t('type') },
    ],
    searchable: true,
    searchPlaceholder: t('searchDemands'),
    searchFields: ['description', 'type', 'submitter.firstName', 'submitter.lastName', 'building.name'],
    allowMultipleFilters: false,
    persistState: true,
    storageKey: 'manager-demands-filters',
  }), [t]);

  // Ensure demands is an array
  const demandsArray = Array.isArray(demands) ? demands : [];

  // Use filter/sort hook
  const {
    filteredData: filteredDemands,
    filters,
    setSearch,
    search,
    addFilter,
    removeFilter,
    clearFilters,
  } = useFilterSort({
    data: demandsArray,
    config: filterSortConfig,
    initialState: {
      sort: { field: 'createdAt', direction: 'desc' },
    },
  });

  // Get current filter values for backward compatibility with existing UI
  const statusFilter = filters.find(f => f.field === 'status')?.value || 'all';
  const typeFilter = filters.find(f => f.field === 'type')?.value || 'all';

  // Group demands by status for manager view
  const pendingDemands = filteredDemands.filter((d: Demand) =>
    ['submitted', 'under_review'].includes(d.status)
  );
  const activeDemands = filteredDemands.filter((d: Demand) =>
    ['approved', 'in_progress'].includes(d.status)
  );
  const completedDemands = filteredDemands.filter((d: Demand) =>
    ['completed', 'rejected', 'cancelled'].includes(d.status)
  );
  const allDemands = filteredDemands;

  const handleCreateDemand = (data: DemandFormData) => {
    createDemandMutation.mutate(data);
  };

  const handleDemandClick = (demand: Demand) => {
    setSelectedDemand(demand);
    setIsDetailsOpen(true);
  };

  const handleDemandUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/demands'] });
  };

  const DemandCard = ({ demand }: { demand: Demand }) => {
    const building = buildings.find((b) => b.id === demand.buildingId);
    const residence = residences.find((r) => r.id === demand.residenceId);

    return (
      <Card
        className='cursor-pointer hover:shadow-md transition-shadow'
        onClick={() => handleDemandClick(demand)}
      >
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Badge variant='outline'>{getTypeLabel(demand.type)}</Badge>
              <Badge className={statusColors[demand.status]}>
                {demand.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          <CardTitle className='text-base line-clamp-2'>
            {demand.description.substring(0, 100)}
            {demand.description.length > 100 && '...'}
          </CardTitle>
        </CardHeader>
        <CardContent className='pt-0'>
          <div className='text-sm text-muted-foreground space-y-1'>
            <p>
              <strong>{t('submittedBy')}:</strong> {demand.submitter?.firstName}{' '}
              {demand.submitter?.lastName}
            </p>
            <p>
              <strong>{t('building')}:</strong> {building?.name || t('unknown')}
            </p>
            {residence && (
              <p>
                <strong>{t('residence')}:</strong> {residence.name}
              </p>
            )}
            <p>
              <strong>{t('created')}:</strong> {new Date(demand.createdAt).toLocaleDateString()}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }; /**
   * If function.
   * @param isLoading - IsLoading parameter.
   */ /**
   * If function.
   * @param isLoading - IsLoading parameter.
   */

  if (isLoading) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title="Demands Management" subtitle="Review and manage resident requests, maintenance demands, and service inquiries." />
        <div className='flex-1 overflow-auto p-6'>
          <div className='flex items-center justify-center h-64'>
            <div className='text-center'>{t('loadingDemands')}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title="Demands Management" subtitle="Review and manage resident requests, maintenance demands, and service inquiries." />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Header Actions */}
          <div className='flex items-center justify-between'>
            <div>
              <h2 className='text-2xl font-bold'>{t('allDemands')}</h2>
              <p className='text-muted-foreground'>{t('reviewManageDemands')}</p>
            </div>
            <Dialog open={isNewDemandOpen} onOpenChange={setIsNewDemandOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className='h-4 w-4 mr-2' />
                  {t('newDemand')}
                </Button>
              </DialogTrigger>
              <DialogContent className='max-w-md max-h-[90vh] overflow-y-auto'>
                <DialogHeader>
                  <DialogTitle>{t('createNewDemand')}</DialogTitle>
                  <DialogDescription>{t('createDemandBehalf')}</DialogDescription>
                </DialogHeader>
                <Form {...newDemandForm}>
                  <form
                    onSubmit={newDemandForm.handleSubmit(handleCreateDemand)}
                    className='space-y-4'
                  >
                    <FormField
                      control={newDemandForm.control}
                      name='type'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('type')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('selectType')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value='maintenance'>{t('maintenanceType')}</SelectItem>
                              <SelectItem value='complaint'>{t('complaintType')}</SelectItem>
                              <SelectItem value='information'>{t('informationType')}</SelectItem>
                              <SelectItem value='other'>{t('otherType')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={newDemandForm.control}
                      name='buildingId'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('building')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('selectBuilding')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {buildings.map((building) => (
                                <SelectItem key={building.id} value={building.id}>
                                  {building.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={newDemandForm.control}
                      name='description'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('description')}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t('describeDemandDetail')}
                              className='min-h-[100px]'
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type='submit' disabled={createDemandMutation.isPending}>
                        {createDemandMutation.isPending ? t('creating') : t('create')}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filters */}
          <div className='flex items-center gap-4'>
            <div className='relative flex-1 max-w-sm'>
              <Search className='absolute left-3 top-3 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder={t('searchDemands')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='pl-10'
                data-testid='input-search-demands'
              />
            </div>
            <Select
              value={String(statusFilter)}
              onValueChange={(value) => {
                if (value === 'all') {
                  removeFilter('status');
                } else {
                  addFilter({ field: 'status', operator: 'equals', value });
                }
              }}
            >
              <SelectTrigger className='w-40'>
                <SelectValue placeholder={t('status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>{t('allStatus')}</SelectItem>
                <SelectItem value='draft'>{t('draft')}</SelectItem>
                <SelectItem value='submitted'>{t('submitted')}</SelectItem>
                <SelectItem value='under_review'>{t('underReview')}</SelectItem>
                <SelectItem value='approved'>{t('approved')}</SelectItem>
                <SelectItem value='in_progress'>{t('inProgress')}</SelectItem>
                <SelectItem value='completed'>{t('completed')}</SelectItem>
                <SelectItem value='rejected'>{t('rejected')}</SelectItem>
                <SelectItem value='cancelled'>{t('cancelled')}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={String(typeFilter)}
              onValueChange={(value) => {
                if (value === 'all') {
                  removeFilter('type');
                } else {
                  addFilter({ field: 'type', operator: 'equals', value });
                }
              }}
            >
              <SelectTrigger className='w-40'>
                <SelectValue placeholder={t('type')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>{t('allTypes')}</SelectItem>
                <SelectItem value='maintenance'>{t('maintenanceType')}</SelectItem>
                <SelectItem value='complaint'>{t('complaintType')}</SelectItem>
                <SelectItem value='information'>{t('informationType')}</SelectItem>
                <SelectItem value='other'>{t('otherType')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Demands List */}
          <Tabs defaultValue='pending' className='w-full'>
            <TabsList>
              <TabsTrigger value='pending'>{t('pendingReview')} ({pendingDemands.length})</TabsTrigger>
              <TabsTrigger value='active'>{t('activeTab')} ({activeDemands.length})</TabsTrigger>
              <TabsTrigger value='completed'>{t('completedTab')} ({completedDemands.length})</TabsTrigger>
              <TabsTrigger value='all'>{t('all')} ({allDemands.length})</TabsTrigger>
            </TabsList>

            <TabsContent value='pending' className='space-y-4'>
              {pendingDemands.length === 0 ? (
                <Card>
                  <CardContent className='p-6 text-center'>
                    <p className='text-muted-foreground'>{t('noDemandsPending')}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                  {pendingDemands.map((demand: Demand) => (
                    <DemandCard key={demand.id} demand={demand} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value='active' className='space-y-4'>
              {activeDemands.length === 0 ? (
                <Card>
                  <CardContent className='p-6 text-center'>
                    <p className='text-muted-foreground'>{t('noActiveDemands')}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                  {activeDemands.map((demand: Demand) => (
                    <DemandCard key={demand.id} demand={demand} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value='completed' className='space-y-4'>
              {completedDemands.length === 0 ? (
                <Card>
                  <CardContent className='p-6 text-center'>
                    <p className='text-muted-foreground'>{t('noCompletedDemands')}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                  {completedDemands.map((demand: Demand) => (
                    <DemandCard key={demand.id} demand={demand} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value='all' className='space-y-4'>
              {isLoading ? (
                <Card>
                  <CardContent className='p-6 text-center'>
                    <p className='text-muted-foreground'>{t('loadingDemands')}</p>
                  </CardContent>
                </Card>
              ) : allDemands.length === 0 ? (
                <Card>
                  <CardContent className='p-6 text-center'>
                    <p className='text-muted-foreground'>{t('noDemandsFound')}</p>
                    {demandsArray.length > 0 && (
                      <p className='text-sm text-gray-400 mt-2'>
                        ({demandsArray.length} {t('totalDemandsLoaded')})
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                  {allDemands.map((demand: Demand) => (
                    <DemandCard key={demand.id} demand={demand} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Demand Details Popup */}
          <DemandDetailsPopup
            demand={selectedDemand as any}
            isOpen={isDetailsOpen}
            onClose={() => setIsDetailsOpen(false)}
            user={currentUser as any}
            onDemandUpdated={handleDemandUpdated}
          />
        </div>
      </div>
    </div>
  );
}
