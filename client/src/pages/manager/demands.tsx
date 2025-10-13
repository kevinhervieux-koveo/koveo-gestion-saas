import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Search, Trash2, Edit2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CollapsibleFilters } from '@/components/ui/collapsible-filters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import DemandDetailsPopup from '@/components/demands/demand-details-popup';
import { Header } from '@/components/layout/header';
import type { Demand as DemandType } from '@/../../shared/schema';

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

interface Building {
  id: string;
  name: string;
}

interface Residence {
  id: string;
  name: string;
  buildingId: string;
}

const statusColors = {
  submitted: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const ITEMS_PER_PAGE = 10;

export default function ManagerDemandsPage() {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedDemands, setSelectedDemands] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [residenceFilter, setResidenceFilter] = useState<string>('all');
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    console.log('🔍 [DEMANDS] Component mounted');
  }, []);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'maintenance': return t('maintenanceType');
      case 'complaint': return t('complaintType');
      case 'information': return t('informationType');
      case 'other': return t('otherType');
      default: return type;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'submitted': return t('submitted');
      case 'in_progress': return t('inProgress');
      case 'completed': return t('completed');
      case 'cancelled': return t('cancelled');
      default: return status.replace('_', ' ');
    }
  };

  const {
    data: demands = [],
    isLoading,
  } = useQuery({
    queryKey: ['/api/demands'],
    refetchInterval: 30000,
    queryFn: async ({ queryKey }) => {
      console.log('🔍 [DEMANDS] Fetching demands');
      const response = await fetch(queryKey[0] as string);
      const data = await response.json();
      console.log('🔍 [DEMANDS] Received demands:', { count: data?.length });
      return data;
    },
  });

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings'],
  });

  const { data: residences = [] } = useQuery<Residence[]>({
    queryKey: ['/api/residences'],
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ demandIds, status }: { demandIds: string[]; status: string }) => {
      const results = await Promise.all(
        demandIds.map(id =>
          apiRequest('PATCH', `/api/demands/${id}`, { status })
        )
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demands'] });
      setSelectedDemands(new Set());
      toast({
        title: t('success'),
        description: `${selectedDemands.size} demands updated successfully`,
      });
    },
    onError: () => {
      toast({
        title: t('error'),
        description: 'Failed to update demands',
        variant: 'destructive',
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (demandIds: string[]) => {
      const results = await Promise.all(
        demandIds.map(id =>
          apiRequest('DELETE', `/api/demands/${id}`)
        )
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demands'] });
      setSelectedDemands(new Set());
      toast({
        title: t('success'),
        description: `${selectedDemands.size} demands deleted successfully`,
      });
    },
    onError: () => {
      toast({
        title: t('error'),
        description: 'Failed to delete demands',
        variant: 'destructive',
      });
    },
  });

  const demandsArray = Array.isArray(demands) ? demands : [];

  // Cascading filter options - each filter only shows values available in the current filtered set
  // Buildings: filtered by search, status, type only
  const uniqueBuildings = useMemo(() => {
    let filtered = demandsArray.filter((d: Demand) =>
      ['submitted', 'in_progress', 'completed', 'cancelled'].includes(d.status)
    );

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((d: Demand) =>
        d.description?.toLowerCase().includes(searchLower) ||
        d.type?.toLowerCase().includes(searchLower) ||
        d.submitter?.firstName?.toLowerCase().includes(searchLower) ||
        d.submitter?.lastName?.toLowerCase().includes(searchLower) ||
        d.building?.name?.toLowerCase().includes(searchLower)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((d: Demand) => d.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((d: Demand) => d.type === typeFilter);
    }

    const buildingsMap = new Map<string, { id: string; name: string }>();
    filtered.forEach((d: Demand) => {
      if (d.building) {
        buildingsMap.set(d.building.id, { id: d.building.id, name: d.building.name });
      }
    });
    return Array.from(buildingsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [demandsArray, search, statusFilter, typeFilter]);

  // Residences: filtered by search, status, type, and building
  const uniqueResidences = useMemo(() => {
    let filtered = demandsArray.filter((d: Demand) =>
      ['submitted', 'in_progress', 'completed', 'cancelled'].includes(d.status)
    );

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((d: Demand) =>
        d.description?.toLowerCase().includes(searchLower) ||
        d.type?.toLowerCase().includes(searchLower) ||
        d.submitter?.firstName?.toLowerCase().includes(searchLower) ||
        d.submitter?.lastName?.toLowerCase().includes(searchLower) ||
        d.building?.name?.toLowerCase().includes(searchLower)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((d: Demand) => d.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((d: Demand) => d.type === typeFilter);
    }

    if (buildingFilter !== 'all') {
      filtered = filtered.filter((d: Demand) => d.buildingId === buildingFilter);
    }

    const residencesMap = new Map<string, { id: string; name: string }>();
    filtered.forEach((d: Demand) => {
      if (d.residence) {
        residencesMap.set(d.residence.id, { id: d.residence.id, name: d.residence.unitNumber });
      }
    });
    return Array.from(residencesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [demandsArray, search, statusFilter, typeFilter, buildingFilter]);

  // Creators: filtered by search, status, type, building, and residence
  const uniqueCreators = useMemo(() => {
    let filtered = demandsArray.filter((d: Demand) =>
      ['submitted', 'in_progress', 'completed', 'cancelled'].includes(d.status)
    );

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((d: Demand) =>
        d.description?.toLowerCase().includes(searchLower) ||
        d.type?.toLowerCase().includes(searchLower) ||
        d.submitter?.firstName?.toLowerCase().includes(searchLower) ||
        d.submitter?.lastName?.toLowerCase().includes(searchLower) ||
        d.building?.name?.toLowerCase().includes(searchLower)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((d: Demand) => d.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((d: Demand) => d.type === typeFilter);
    }

    if (buildingFilter !== 'all') {
      filtered = filtered.filter((d: Demand) => d.buildingId === buildingFilter);
    }

    if (residenceFilter !== 'all') {
      filtered = filtered.filter((d: Demand) => d.residenceId === residenceFilter);
    }

    const creatorsMap = new Map<string, { id: string; name: string }>();
    filtered.forEach((d: Demand) => {
      if (d.submitter) {
        const fullName = `${d.submitter.firstName} ${d.submitter.lastName}`;
        creatorsMap.set(d.submitter.id, { id: d.submitter.id, name: fullName });
      }
    });
    return Array.from(creatorsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [demandsArray, search, statusFilter, typeFilter, buildingFilter, residenceFilter]);

  const filteredDemands = useMemo(() => {
    let filtered = demandsArray.filter((d: Demand) =>
      ['submitted', 'in_progress', 'completed', 'cancelled'].includes(d.status)
    );

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((d: Demand) =>
        d.description?.toLowerCase().includes(searchLower) ||
        d.type?.toLowerCase().includes(searchLower) ||
        d.submitter?.firstName?.toLowerCase().includes(searchLower) ||
        d.submitter?.lastName?.toLowerCase().includes(searchLower) ||
        d.building?.name?.toLowerCase().includes(searchLower)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((d: Demand) => d.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((d: Demand) => d.type === typeFilter);
    }

    if (buildingFilter !== 'all') {
      filtered = filtered.filter((d: Demand) => d.buildingId === buildingFilter);
    }

    if (residenceFilter !== 'all') {
      filtered = filtered.filter((d: Demand) => d.residenceId === residenceFilter);
    }

    if (creatorFilter !== 'all') {
      filtered = filtered.filter((d: Demand) => d.submitterId === creatorFilter);
    }

    return filtered.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [demandsArray, search, statusFilter, typeFilter, buildingFilter, residenceFilter, creatorFilter]);

  const totalPages = Math.ceil(filteredDemands.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredDemands.length);
  const paginatedDemands = filteredDemands.slice(startIndex, endIndex);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, typeFilter, buildingFilter, residenceFilter, creatorFilter]);

  // Auto-reset dependent filters when parent filter changes and selected value is no longer available
  useEffect(() => {
    if (buildingFilter !== 'all' && !uniqueBuildings.find(b => b.id === buildingFilter)) {
      setBuildingFilter('all');
    }
  }, [uniqueBuildings, buildingFilter]);

  useEffect(() => {
    if (residenceFilter !== 'all' && !uniqueResidences.find(r => r.id === residenceFilter)) {
      setResidenceFilter('all');
    }
  }, [uniqueResidences, residenceFilter]);

  useEffect(() => {
    if (creatorFilter !== 'all' && !uniqueCreators.find(c => c.id === creatorFilter)) {
      setCreatorFilter('all');
    }
  }, [uniqueCreators, creatorFilter]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDemands(new Set(paginatedDemands.map(d => d.id)));
    } else {
      setSelectedDemands(new Set());
    }
  };

  const handleSelectDemand = (demandId: string, checked: boolean) => {
    const newSelected = new Set(selectedDemands);
    if (checked) {
      newSelected.add(demandId);
    } else {
      newSelected.delete(demandId);
    }
    setSelectedDemands(newSelected);
  };

  const handleBulkStatusChange = () => {
    if (bulkStatus && selectedDemands.size > 0) {
      bulkUpdateMutation.mutate({
        demandIds: Array.from(selectedDemands),
        status: bulkStatus,
      });
      setShowBulkStatusDialog(false);
      setBulkStatus('');
    }
  };

  const handleBulkDelete = () => {
    if (selectedDemands.size > 0) {
      bulkDeleteMutation.mutate(Array.from(selectedDemands));
      setShowDeleteDialog(false);
    }
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
    const isSelected = selectedDemands.has(demand.id);

    return (
      <Card
        className={`transition-all cursor-pointer ${isSelected ? 'ring-2 ring-primary' : ''}`}
        onClick={() => handleDemandClick(demand)}
        data-testid={`card-demand-${demand.id}`}
      >
        <CardHeader className='pb-3'>
          <div className='flex items-start gap-3'>
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => handleSelectDemand(demand.id, checked as boolean)}
              className='mt-1'
              data-testid={`checkbox-demand-${demand.id}`}
              onClick={(e) => e.stopPropagation()}
            />
            <div className='flex-1'>
              <div className='flex items-center justify-between mb-2'>
                <div className='flex items-center gap-2'>
                  <Badge variant='outline'>{getTypeLabel(demand.type)}</Badge>
                  <Badge className={statusColors[demand.status as keyof typeof statusColors]}>
                    {getStatusLabel(demand.status)}
                  </Badge>
                </div>
              </div>
              <CardTitle className='text-base line-clamp-2'>
                {demand.description.substring(0, 100)}
                {demand.description.length > 100 && '...'}
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className='pt-0 pl-12'>
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
  };

  if (isLoading) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title={t('demandsManagement')} subtitle={t('demandsSubtitle')} />
        <div className='flex-1 overflow-auto p-6'>
          <div className='flex items-center justify-center h-64'>
            <div className='text-center'>{t('loadingDemands')}</div>
          </div>
        </div>
      </div>
    );
  }

  const allSelected = paginatedDemands.length > 0 && paginatedDemands.every(d => selectedDemands.has(d.id));
  const someSelected = paginatedDemands.some(d => selectedDemands.has(d.id)) && !allSelected;

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title={t('demandsManagement')} subtitle={t('demandsSubtitle')} />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {selectedDemands.size > 0 && (
            <Card className='bg-primary/5 border-primary'>
              <CardContent className='py-3'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium' data-testid='text-selected-count'>
                    {selectedDemands.size} demand{selectedDemands.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className='flex gap-2'>
                    <Select value={bulkStatus} onValueChange={setBulkStatus}>
                      <SelectTrigger className='w-40' data-testid='select-bulk-status'>
                        <SelectValue placeholder='Change status...' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='cancelled'>{t('cancelled')}</SelectItem>
                        <SelectItem value='completed'>{t('completed')}</SelectItem>
                        <SelectItem value='in_progress'>{t('inProgress')}</SelectItem>
                        <SelectItem value='submitted'>{t('submitted')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={!bulkStatus}
                      onClick={() => setShowBulkStatusDialog(true)}
                      data-testid='button-apply-bulk-status'
                    >
                      <Edit2 className='h-4 w-4 mr-2' />
                      Apply
                    </Button>
                    <Button
                      variant='destructive'
                      size='sm'
                      onClick={() => setShowDeleteDialog(true)}
                      data-testid='button-bulk-delete'
                    >
                      <Trash2 className='h-4 w-4 mr-2' />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <CollapsibleFilters
            title={t('filters')}
            defaultExpanded={false}
            filters={[
              {
                id: 'search',
                label: t('searchDemands'),
                type: 'custom',
                customComponent: (
                  <Input
                    placeholder={t('searchDemands')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    data-testid='input-search-demands'
                  />
                ),
                value: search,
                onChange: (value) => setSearch(value as string),
              },
              {
                id: 'status',
                label: t('status'),
                type: 'custom',
                customComponent: (
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger data-testid='select-status-filter'>
                      <SelectValue placeholder={t('allStatus')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>{t('allStatus')}</SelectItem>
                      <SelectItem value='cancelled'>{t('cancelled')}</SelectItem>
                      <SelectItem value='completed'>{t('completed')}</SelectItem>
                      <SelectItem value='in_progress'>{t('inProgress')}</SelectItem>
                      <SelectItem value='submitted'>{t('submitted')}</SelectItem>
                    </SelectContent>
                  </Select>
                ),
                value: statusFilter,
                onChange: (value) => setStatusFilter(value as string),
              },
              {
                id: 'type',
                label: t('type'),
                type: 'custom',
                customComponent: (
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger data-testid='select-type-filter'>
                      <SelectValue placeholder={t('allTypes')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>{t('allTypes')}</SelectItem>
                      <SelectItem value='maintenance'>{t('maintenanceType')}</SelectItem>
                      <SelectItem value='complaint'>{t('complaintType')}</SelectItem>
                      <SelectItem value='information'>{t('informationType')}</SelectItem>
                      <SelectItem value='other'>{t('otherType')}</SelectItem>
                    </SelectContent>
                  </Select>
                ),
                value: typeFilter,
                onChange: (value) => setTypeFilter(value as string),
              },
              {
                id: 'building',
                label: 'Building',
                type: 'custom',
                customComponent: (
                  <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                    <SelectTrigger data-testid='select-building-filter'>
                      <SelectValue placeholder='All buildings' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>All buildings</SelectItem>
                      {uniqueBuildings.map((building) => (
                        <SelectItem key={building.id} value={building.id}>
                          {building.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ),
                value: buildingFilter,
                onChange: (value) => setBuildingFilter(value as string),
              },
              {
                id: 'residence',
                label: 'Residence',
                type: 'custom',
                customComponent: (
                  <Select value={residenceFilter} onValueChange={setResidenceFilter}>
                    <SelectTrigger data-testid='select-residence-filter'>
                      <SelectValue placeholder='All residences' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>All residences</SelectItem>
                      {uniqueResidences.map((residence) => (
                        <SelectItem key={residence.id} value={residence.id}>
                          {residence.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ),
                value: residenceFilter,
                onChange: (value) => setResidenceFilter(value as string),
              },
              {
                id: 'creator',
                label: 'Creator',
                type: 'custom',
                customComponent: (
                  <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                    <SelectTrigger data-testid='select-creator-filter'>
                      <SelectValue placeholder='All creators' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>All creators</SelectItem>
                      {uniqueCreators.map((creator) => (
                        <SelectItem key={creator.id} value={creator.id}>
                          {creator.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ),
                value: creatorFilter,
                onChange: (value) => setCreatorFilter(value as string),
              },
            ]}
            activeFilters={[
              ...(search ? [{
                id: 'search',
                label: t('searchDemands'),
                displayValue: `"${search}"`
              }] : []),
              ...(statusFilter !== 'all' ? [{
                id: 'status',
                label: t('status'),
                displayValue: statusFilter === 'in_progress' ? t('inProgress') : 
                             statusFilter === 'cancelled' ? t('cancelled') :
                             statusFilter === 'completed' ? t('completed') :
                             statusFilter === 'submitted' ? t('submitted') : statusFilter
              }] : []),
              ...(typeFilter !== 'all' ? [{
                id: 'type',
                label: t('type'),
                displayValue: typeFilter === 'maintenance' ? t('maintenanceType') :
                             typeFilter === 'complaint' ? t('complaintType') :
                             typeFilter === 'information' ? t('informationType') :
                             typeFilter === 'other' ? t('otherType') : typeFilter
              }] : []),
              ...(buildingFilter !== 'all' ? [{
                id: 'building',
                label: 'Building',
                displayValue: uniqueBuildings.find(b => b.id === buildingFilter)?.name || buildingFilter
              }] : []),
              ...(residenceFilter !== 'all' ? [{
                id: 'residence',
                label: 'Residence',
                displayValue: uniqueResidences.find(r => r.id === residenceFilter)?.name || residenceFilter
              }] : []),
              ...(creatorFilter !== 'all' ? [{
                id: 'creator',
                label: 'Creator',
                displayValue: uniqueCreators.find(c => c.id === creatorFilter)?.name || creatorFilter
              }] : []),
            ]}
            onReset={() => {
              setSearch('');
              setStatusFilter('all');
              setTypeFilter('all');
              setBuildingFilter('all');
              setResidenceFilter('all');
              setCreatorFilter('all');
            }}
            resetLabel={t('clearFilters')}
          />

          <div className='space-y-4'>
            <div className='flex items-center gap-3 px-1'>
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    (el as any).indeterminate = someSelected;
                  }
                }}
                onCheckedChange={handleSelectAll}
                data-testid='checkbox-select-all'
              />
              <span className='text-sm font-medium'>Select all</span>
            </div>

            {paginatedDemands.length === 0 ? (
              <Card>
                <CardContent className='p-6 text-center'>
                  <p className='text-muted-foreground'>{t('noDemandsFound')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                {paginatedDemands.map((demand: Demand) => (
                  <DemandCard key={demand.id} demand={demand} />
                ))}
              </div>
            )}

            {filteredDemands.length > 0 && (
              <div className='space-y-4'>
                <p className='text-sm text-muted-foreground text-center' data-testid='text-pagination-info'>
                  Showing {startIndex + 1} to {endIndex} of {filteredDemands.length} demands
                </p>
                <div className='flex items-center justify-center gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    data-testid='button-previous-page'
                  >
                    <ChevronLeft className='h-4 w-4' />
                    Previous
                  </Button>
                  <span className='text-sm' data-testid='text-page-number'>
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    data-testid='button-next-page'
                  >
                    Next
                    <ChevronRight className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {selectedDemand && (
            <DemandDetailsPopup
              demand={selectedDemand as any}
              isOpen={isDetailsOpen}
              onClose={() => setIsDetailsOpen(false)}
              onDemandUpdated={handleDemandUpdated}
            />
          )}

          <AlertDialog open={showBulkStatusDialog} onOpenChange={setShowBulkStatusDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Update Status</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to update the status of {selectedDemands.size} demand{selectedDemands.size !== 1 ? 's' : ''} to "{getStatusLabel(bulkStatus)}"?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid='button-cancel-bulk-status'>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBulkStatusChange}
                  disabled={bulkUpdateMutation.isPending}
                  data-testid='button-confirm-bulk-status'
                >
                  {bulkUpdateMutation.isPending ? 'Updating...' : 'Update'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Demands</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {selectedDemands.size} demand{selectedDemands.size !== 1 ? 's' : ''}? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid='button-cancel-delete'>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                  className='bg-destructive hover:bg-destructive/90'
                  data-testid='button-confirm-delete'
                >
                  {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
