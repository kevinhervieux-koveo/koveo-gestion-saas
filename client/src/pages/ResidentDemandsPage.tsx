import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchableFormSelect } from '@/components/common/SearchableFormSelect';
import { CollapsibleFilters } from '@/components/ui/collapsible-filters';
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
import { toastUtils } from '@/lib/toastUtils';
import { sanitizeDescription } from '@/utils/sanitize';
import { Header } from '@/components/layout/header';
import DemandDetailsPopup from '@/components/demands/demand-details-popup';
import { SharedUploader } from '@/components/document-management';
import type { UploadContext } from '@shared/config/upload-config';
import { useLanguage } from '@/hooks/use-language';
import { schemas, enumFields } from '@/lib/validations';
import { handleApiError } from '@/lib/demo-error-handler';

// Types
/**
 *
 */
interface Demand {
  id: string;
  type: 'maintenance' | 'complaint' | 'information' | 'other';
  description: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  status:
    | 'submitted'
    | 'under_review'
    | 'approved'
    | 'rejected'
    | 'in_progress'
    | 'completed'
    | 'cancelled';
  submitterId: string;
  buildingId: string;
  residenceId?: string;
  assignationBuildingId?: string;
  assignationResidenceId?: string;
  createdAt: string;
  updatedAt: string;
  reviewNotes?: string;
  submitter?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
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
  name?: string;
  unitNumber: string;
  buildingId: string;
}

// Form schemas
const demandSchema = schemas.demand;

/**
 *
 */
type DemandFormData = z.infer<typeof demandSchema>;

const statusColors = {
  submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

/**
 *
 */
export default function /**
 * Resident demands page function.
 */ /**
 * Resident demands page function.
 */

ResidentDemandsPage() {
  const { t, language } = useLanguage();

  const typeLabels = {
    maintenance: t('maintenanceType'),
    complaint: t('complaintType'),
    information: t('informationType'),
    other: t('otherType'),
  };
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);
  const [isNewDemandOpen, setIsNewDemandOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<string[]>([]);
  const itemsPerPage = 10;

  // Fetch current user first
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/user'],
  });

  // Provide default user to prevent type errors
  const defaultUser: {
    id: string;
    role: string;
    email: string;
    firstName?: string;
    lastName?: string;
  } =
    currentUser &&
    typeof currentUser === 'object' &&
    'id' in currentUser &&
    'role' in currentUser &&
    'email' in currentUser
      ? (currentUser as {
          id: string;
          role: string;
          email: string;
          firstName?: string;
          lastName?: string;
        })
      : { id: '', role: 'tenant', email: '' };

  // Fetch demands - always filter by current user (my demands only)
  const { data: demands = [], isLoading } = useQuery({
    queryKey: ['/api/demands', 'submitter', defaultUser.id],
    queryFn: async () => {
      const res = await fetch(`/api/demands?submitterId=${defaultUser.id}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!defaultUser.id, // Only fetch when we have a user ID
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch buildings based on user role
  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: defaultUser?.role === 'admin' 
      ? ['/api/buildings'] 
      : defaultUser?.role === 'manager' 
        ? ['/api/manager/buildings']
        : ['/api/users/me/buildings'],
    enabled: !!defaultUser?.role,
    select: (data: any) => {
      if (!data) return [];
      // Handle different response formats from different endpoints
      if (Array.isArray(data)) return data;
      return data?.buildings || [];
    },
  });

  // Upload context for secure storage (using useMemo to ensure it updates with defaultUser)
  const uploadContext: UploadContext = useMemo(() => ({
    type: 'maintenance',
    organizationId: 'default',
    userRole: defaultUser?.role || 'resident',
    userId: defaultUser?.id
  }), [defaultUser?.role, defaultUser?.id]);

  // File upload helper function - uses object storage with signed URLs
  const uploadFiles = async (files: File[]): Promise<Array<{ url: string; originalName: string; size: number }>> => {
    if (files.length === 0) return [];
    
    const uploadedFiles: Array<{ url: string; originalName: string; size: number }> = [];
    
    for (const file of files) {
      try {
        // Get signed upload URL from backend
        const urlResponse = await fetch('/api/demands/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name }),
          credentials: 'include',
        });
        
        if (!urlResponse.ok) {
          console.error('Failed to get upload URL');
          throw new Error('Failed to get upload URL');
        }
        
        const { uploadUrl, objectPath } = await urlResponse.json();
        
        // Upload file directly to object storage using signed URL
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 
            'Content-Type': file.type || 'application/octet-stream',
          },
        });
        
        if (!uploadResponse.ok) {
          console.error('Failed to upload file to object storage');
          throw new Error('Failed to upload file');
        }
        
        uploadedFiles.push({
          url: objectPath,
          originalName: file.name,
          size: file.size,
        });
      } catch (error) {
        console.error('Error uploading file:', file.name, error);
        throw error;
      }
    }
    
    return uploadedFiles;
  };

  // Create demand mutation
  // Exception (task #229): uses `toastUtils` create/error helpers for shared
  // success/error messaging conventions — kept as raw `useMutation`.
  const createDemandMutation = useMutation({
    mutationFn: async (data: DemandFormData) => {
      // Upload files first if any are selected
      const attachments = selectedFiles.length > 0 ? await uploadFiles(selectedFiles) : [];
      
      const response = await fetch('/api/demands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          attachments,
          status: 'submitted',
          // Convert empty strings to undefined for optional UUID fields
          buildingId: data.buildingId || undefined,
          assignationBuildingId: data.assignationBuildingId || undefined,
          assignationResidenceId: data.assignationResidenceId || undefined,
          // residenceId will be auto-populated by backend from user's data
        }),
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
      setSelectedFiles([]);
      setUploadedAttachments([]);
      toastUtils.createSuccess('Demand');
    },
    onError: (error: any) => {
      handleApiError(error, language, t('failedToCreateDemand'));
    },
  });

  // Forms
  const newDemandForm = useForm<DemandFormData>({
    resolver: zodResolver(demandSchema),
    defaultValues: {
      type: 'maintenance',
      description: '',
      buildingId: undefined,
      assignationBuildingId: undefined,
      assignationResidenceId: undefined,
    },
  });

  // Fetch residences - filter based on selected building and user role
  const selectedBuildingId = newDemandForm.watch('buildingId');
  const { data: residences = [] } = useQuery<Residence[]>({
    queryKey: ['/api/residences', selectedBuildingId],
    enabled: !!selectedBuildingId && !!defaultUser?.role,
    queryFn: async () => {
      // All users (including residents) can see all residences in their buildings
      // This allows residents to file complaints about other residents
      const response = await fetch(`/api/residences?buildingId=${selectedBuildingId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch residences');
      }
      return response.json();
    },
    select: (data: any) => {
      if (!data) return [];
      const allResidences = Array.isArray(data) ? data : data.residences || [];
      
      // Filter by selected building if needed (API should already handle this)
      return allResidences.filter((r: any) => r.buildingId === selectedBuildingId);
    },
  });

  // Filter demands
  const filteredDemands = (demands as Demand[]).filter((demand: Demand) => {
    const matchesSearch =
      demand.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      typeLabels[demand.type].toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || demand.status === statusFilter;
    const matchesType = typeFilter === 'all' || demand.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Group demands by status (no draft demands since we removed draft logic)
  const activeDemands = filteredDemands.filter((d: Demand) =>
    ['submitted', 'under_review', 'approved', 'in_progress'].includes(d.status)
  );
  const completedDemands = filteredDemands.filter((d: Demand) =>
    ['completed', 'rejected', 'cancelled'].includes(d.status)
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredDemands.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDemands = filteredDemands.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };

  const handleCreateDemand = (data: DemandFormData) => {
    // Create demand directly as submitted (no draft logic)
    createDemandMutation.mutate(data);
  };

  const handleDemandClick = (demand: Demand) => {
    setSelectedDemand(demand);
    setIsDetailsOpen(true);
  };

  const handleDemandUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/demands'] });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
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
              <Badge variant='outline'>{typeLabels[demand.type]}</Badge>
              <Badge className={statusColors[demand.status]}>
                {demand.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          <CardTitle className='text-base line-clamp-2'>
            {sanitizeDescription(demand.description.substring(0, 100))}
            {demand.description.length > 100 && '...'}
          </CardTitle>
        </CardHeader>
        <CardContent className='pt-0'>
          <div className='text-sm text-muted-foreground space-y-1'>
            <p>
              <strong>{t('buildingField')}</strong> {building?.name || t('unknownBuilding')}
            </p>
            {residence && (
              <p>
                <strong>{t('residenceField')}</strong> {residence.name}
              </p>
            )}
            <p>
              <strong>{t('createdField')}</strong> {new Date(demand.createdAt).toLocaleDateString()}
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
        <Header title={t('myDemands')} subtitle={t('submitAndTrackRequests')} />
        <div className='flex-1 overflow-auto p-6'>
          <div className='flex items-center justify-center h-64'>
            <div className='text-center'>{t('loadingDemandsMessage')}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title={t('myDemands')} subtitle={t('submitAndTrackRequests')} />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Header Actions */}
          <div className='flex items-center justify-end'>
            <Dialog open={isNewDemandOpen} onOpenChange={setIsNewDemandOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className='h-4 w-4 mr-2' />
                  {t('newDemand')}
                </Button>
              </DialogTrigger>

              <DialogContent className='max-w-lg max-h-[90vh] overflow-y-auto'>
                <DialogHeader>
                  <DialogTitle>{t('createNewDemand')}</DialogTitle>
                  <DialogDescription>{t('submitRequestComplaint')}</DialogDescription>
                </DialogHeader>
                <Form {...newDemandForm}>
                  <form onSubmit={newDemandForm.handleSubmit(handleCreateDemand)} className='space-y-4'>
                    <SearchableFormSelect
                      control={newDemandForm.control}
                      name='type'
                      label={t('typeLabel')}
                      options={[
                        { value: 'maintenance', label: t('maintenanceType') },
                        { value: 'complaint', label: t('complaintType') },
                        { value: 'information', label: t('informationType') },
                        { value: 'other', label: t('otherType') }
                      ]}
                      placeholder={t('selectType')}
                      searchPlaceholder={t('searchTypePlaceholder')}
                      required={true}
                    />
                    <SearchableFormSelect
                      control={newDemandForm.control}
                      name='buildingId'
                      label={t('buildingLabel')}
                      options={buildings.map((building) => ({
                        value: building.id,
                        label: building.name,
                      }))}
                      placeholder={t('selectBuilding')}
                      searchPlaceholder={t('searchBuildingsPlaceholder')}
                      required={true}
                    />
                    <SearchableFormSelect
                      control={newDemandForm.control}
                      name='assignationResidenceId'
                      label={t('residenceOptional')}
                      options={[
                        { value: '', label: t('noSpecificResidence') },
                        ...residences.map((residence) => ({
                          value: residence.id,
                          label: `${residence.unitNumber} - ${residence.name || `Unit ${residence.unitNumber}`}`,
                        }))
                      ]}
                      placeholder={t('selectResidence')}
                      searchPlaceholder={t('searchResidencesPlaceholder')}
                      required={false}
                    />
                    <FormField
                      control={newDemandForm.control}
                      name='description'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('descriptionLabel')}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t('describeRequestDetail')}
                              className='min-h-[100px]'
                              {...field}
                              value={field.value as string}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className='space-y-2'>
                      <label className='text-sm font-medium'>{t('attachmentsOptional')}</label>
                      <SharedUploader
                        onDocumentChange={(file, extractedText) => {
                          if (file) {
                            setSelectedFiles([file]);
                          }
                        }}
                        formType="maintenance"
                        uploadContext={uploadContext}
                        showAiToggle={false}
                        allowedFileTypes={['image/*', 'application/pdf', '.doc', '.docx', '.txt']}
                        maxFileSize={10}
                      />
                      <p className='text-xs text-muted-foreground'>
                        {t('attachmentUploadInstructions')}
                      </p>
                    </div>
                    <DialogFooter>
                      <Button 
                        type='submit' 
                        disabled={createDemandMutation.isPending}
                        data-testid="button-create-demand"
                      >
                        {createDemandMutation.isPending ? t('creating') : t('createDemand')}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filters */}
          <CollapsibleFilters
            title={t('filters')}
            defaultExpanded={false}
            onReset={handleResetFilters}
            resetLabel={t('clearFilters') || 'Clear filters'}
            filters={[
              {
                id: 'search',
                label: t('searchDemands'),
                type: 'custom',
                customComponent: (
                  <Input
                    placeholder={t('searchDemands')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid='input-search-demands'
                  />
                ),
                value: searchTerm,
                onChange: (value) => setSearchTerm(value as string),
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
                      <SelectItem value='submitted'>{t('submitted')}</SelectItem>
                      <SelectItem value='under_review'>{t('underReview') || 'Under Review'}</SelectItem>
                      <SelectItem value='approved'>{t('approved') || 'Approved'}</SelectItem>
                      <SelectItem value='rejected'>{t('rejected') || 'Rejected'}</SelectItem>
                      <SelectItem value='in_progress'>{t('inProgress')}</SelectItem>
                      <SelectItem value='completed'>{t('completed')}</SelectItem>
                      <SelectItem value='cancelled'>{t('cancelled')}</SelectItem>
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
            ]}
          />

          {/* Demands List */}
          <div className='space-y-6'>
            {/* Page info */}
            {filteredDemands.length > 0 && (
              <div className='text-center text-sm text-muted-foreground'>
                {t('showingDemandsRange')
                  .replace('{start}', String(startIndex + 1))
                  .replace('{end}', String(Math.min(endIndex, filteredDemands.length)))
                  .replace('{total}', String(filteredDemands.length))}
              </div>
            )}

            {/* Current page demands */}
            {currentDemands.length === 0 ? (
              <Card>
                <CardContent className='p-6 text-center'>
                  <p className='text-muted-foreground'>{t('noDemandsFound')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                {currentDemands.map((demand: Demand) => (
                  <DemandCard key={demand.id} demand={demand} />
                ))}
              </div>
            )}

            {/* Pagination - Moved to bottom */}
            {totalPages > 1 && (
              <div className='flex items-center justify-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  data-testid='button-previous-page'
                >
                  <ChevronLeft className='h-4 w-4' />
                  {t('previous')}
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
                        data-testid={`button-page-${pageNum}`}
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
                  data-testid='button-next-page'
                >
                  {t('next')}
                  <ChevronRight className='h-4 w-4' />
                </Button>
              </div>
            )}
          </div>

          {/* Demand Details Popup */}
          <DemandDetailsPopup
            demand={selectedDemand}
            isOpen={isDetailsOpen}
            onClose={() => setIsDetailsOpen(false)}
            user={defaultUser}
            onDemandUpdated={handleDemandUpdated}
          />
        </div>
      </div>
    </div>
  );
}
