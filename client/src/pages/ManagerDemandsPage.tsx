import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Search,
  Filter,
  Eye,
  Edit2,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  Home,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
import { PageLayout } from '@/components/common/PageLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { useLanguage } from '@/hooks/use-language';
import { LoadingState } from '@/components/common/LoadingState';
import { DemandFilters } from '@/components/common/DemandFilters';
import { DemandCard } from '@/components/common/DemandCard';
import { schemas } from '@/lib/validations';

// Types
/**
 *
 */
interface Demand {
  id: string;
  type: 'maintenance' | 'complaint' | 'information' | 'other';
  description: string;
  status:
    | 'draft'
    | 'submitted'
    | 'under_review'
    | 'approved'
    | 'rejected'
    | 'in_progress'
    | 'completed';
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
const reviewSchema = schemas.demandReview;

/**
 *
 */
type ReviewFormData = z.infer<typeof reviewSchema>;

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-emerald-100 text-emerald-800',
};

// Type labels will use translation keys
const getTypeLabel = (type: string, t: (key: string) => string) => {
  const labels = {
    maintenance: t('maintenance'),
    complaint: t('complaint'),
    information: t('information'),
    other: t('other'),
  };
  return labels[type as keyof typeof labels] || type;
};

// Status labels will use translation keys
const getStatusLabel = (status: string, t: (key: string) => string) => {
  const labels = {
    draft: t('draft'),
    submitted: t('submitted'),
    under_review: t('underReview'),
    approved: t('approved'),
    rejected: t('rejected'),
    in_progress: t('inProgress'),
    completed: t('completed'),
  };
  return labels[status as keyof typeof labels] || status;
};

/**
 * Manager demands page function.
 */
export default function ManagerDemandsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Fetch demands
  const { data: demands = [], isLoading } = useQuery({
    queryKey: ['/api/demands'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch buildings
  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings'],
  });

  // Fetch residences
  const { data: residences = [] } = useQuery<Residence[]>({
    queryKey: ['/api/residences'],
  });

  // Review demand mutation
  const reviewDemandMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ReviewFormData }) => {
      const response = await fetch(`/api/demands/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }); /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */ /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */

      if (!response.ok) {
        throw new Error(t('failedToReviewDemand'));
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/demands'] });
      setIsReviewOpen(false);
      toast({
        title: 'Success',
        description: 'Demand reviewed successfully',
      });
    },
    onError: () => {
      toast({
        title: t('error'),
        description: 'Failed to review demand',
        variant: 'destructive',
      });
    },
  });

  // Form
  const reviewForm = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      status: 'under_review',
      reviewNotes: '',
      assignationBuildingId: '',
      assignationResidenceId: '',
    },
  });

  // Filter demands
  const filteredDemands = (demands as Demand[]).filter((demand: Demand) => {
    const matchesSearch =
      demand.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getTypeLabel(demand.type, t).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (demand.submitter &&
        (demand.submitter.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          demand.submitter.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          demand.submitter.email.toLowerCase().includes(searchTerm.toLowerCase())));
    const matchesStatus = statusFilter === 'all' || demand.status === statusFilter;
    const matchesType = typeFilter === 'all' || demand.type === typeFilter;
    const matchesBuilding = buildingFilter === 'all' || demand.buildingId === buildingFilter;

    return matchesSearch && matchesStatus && matchesType && matchesBuilding;
  });

  // Group demands by status
  const pendingDemands = filteredDemands.filter((d: Demand) => ['submitted'].includes(d.status));
  const reviewDemands = filteredDemands.filter((d: Demand) =>
    ['under_review', 'approved', 'in_progress'].includes(d.status)
  );
  const completedDemands = filteredDemands.filter((d: Demand) =>
    ['completed', 'rejected'].includes(d.status)
  );

  const handleReviewDemand = (_data: ReviewFormData) => {
    /**
     * If function.
     * @param selectedDemand - SelectedDemand parameter.
     */ /**
     * If function.
     * @param selectedDemand - SelectedDemand parameter.
     */

    if (selectedDemand) {
      reviewDemandMutation.mutate({ id: selectedDemand.id, data: _data });
    }
  };

  const handleViewDemand = (demand: Demand) => {
    setSelectedDemand(demand);
    setIsViewOpen(true);
  };

  const handleOpenReview = (demand: Demand) => {
    setSelectedDemand(demand);
    reviewForm.reset({
      status: demand.status === 'submitted' ? 'under_review' : (demand.status as any),
      reviewNotes: demand.reviewNotes || '',
      assignationBuildingId: demand.assignationBuildingId || '',
      assignationResidenceId: demand.assignationResidenceId || '',
    });
    setIsReviewOpen(true);
  };

  const quickApprove = (demand: Demand) => {
    reviewDemandMutation.mutate({
      id: demand.id,
      data: { status: 'approved', reviewNotes: 'Approved by manager' },
    });
  };

  const quickReject = (demand: Demand) => {
    reviewDemandMutation.mutate({
      id: demand.id,
      data: { status: 'rejected', reviewNotes: 'Rejected by manager' },
    });
  };

  const DemandCard = ({ demand }: { demand: Demand }) => {
    const building = buildings.find((b) => b.id === demand.buildingId);
    const residence = residences.find((r) => r.id === demand.residenceId);

    return (
      <Card className='cursor-pointer hover:shadow-md transition-shadow'>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Badge variant='outline'>{getTypeLabel(demand.type, t)}</Badge>
              <Badge className={statusColors[demand.status]}>
                {getStatusLabel(demand.status, t)}
              </Badge>
            </div>
            <div className='flex items-center gap-1'>
              <Button
                variant='ghost'
                size='sm'
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewDemand(demand);
                }}
              >
                <Eye className='h-4 w-4' />
              </Button>
              {demand.status === 'submitted' && (
                <>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={(e) => {
                      e.stopPropagation();
                      quickApprove(demand);
                    }}
                    className='text-green-600 hover:text-green-700'
                  >
                    <CheckCircle className='h-4 w-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={(e) => {
                      e.stopPropagation();
                      quickReject(demand);
                    }}
                    className='text-red-600 hover:text-red-700'
                  >
                    <XCircle className='h-4 w-4' />
                  </Button>
                </>
              )}
              <Button
                variant='ghost'
                size='sm'
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenReview(demand);
                }}
              >
                <Edit2 className='h-4 w-4' />
              </Button>
            </div>
          </div>
          <CardTitle className='text-base line-clamp-2'>
            {demand.description.substring(0, 100)}
            {demand.description.length > 100 && '...'}
          </CardTitle>
        </CardHeader>
        <CardContent className='pt-0'>
          <div className='text-sm text-muted-foreground space-y-1'>
            <div className='flex items-center gap-1'>
              <User className='h-3 w-3' />
              <span>
                {demand.submitter
                  ? `${demand.submitter.firstName} ${demand.submitter.lastName}`
                  : 'Unknown User'}
              </span>
            </div>
            <div className='flex items-center gap-1'>
              <Building2 className='h-3 w-3' />
              <span>{building?.name || 'Unknown Building'}</span>
            </div>
            {residence && (
              <div className='flex items-center gap-1'>
                <Home className='h-3 w-3' />
                <span>{residence.name}</span>
              </div>
            )}
            <div className='flex items-center gap-1'>
              <Clock className='h-3 w-3' />
              <span>{new Date(demand.createdAt).toLocaleDateString()}</span>
            </div>
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
      <div className='container mx-auto py-6'>
        <div className='flex items-center justify-center h-64'>
          <div className='text-center'>{t('loadingDemands')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className='container mx-auto py-6 space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Manage Demands</h1>
          <p className='text-muted-foreground'>Review and manage resident requests</p>
        </div>
        <div className='flex items-center gap-2'>
          <Badge variant='outline' className='bg-blue-50'>
            {pendingDemands.length} Pending Review
          </Badge>
          <Badge variant='outline' className='bg-yellow-50'>
            {reviewDemands.length} In Progress
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <div className='flex items-center gap-4 flex-wrap'>
        <div className='relative flex-1 max-w-sm'>
          <Search className='absolute left-3 top-3 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder={t('searchDemandsUsers')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className='pl-10'
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className='w-40'>
            <SelectValue placeholder={t('formStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('allStatus')}</SelectItem>
            <SelectItem value='submitted'>Submitted</SelectItem>
            <SelectItem value='under_review'>Under Review</SelectItem>
            <SelectItem value='approved'>Approved</SelectItem>
            <SelectItem value='in_progress'>In Progress</SelectItem>
            <SelectItem value='completed'>Completed</SelectItem>
            <SelectItem value='rejected'>Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className='w-40'>
            <SelectValue placeholder={t('typePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Types</SelectItem>
            <SelectItem value='maintenance'>Maintenance</SelectItem>
            <SelectItem value='complaint'>Complaint</SelectItem>
            <SelectItem value='information'>Information</SelectItem>
            <SelectItem value='other'>Other</SelectItem>
          </SelectContent>
        </Select>
        <Select value={buildingFilter} onValueChange={setBuildingFilter}>
          <SelectTrigger className='w-40'>
            <SelectValue placeholder={t('buildingPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Buildings</SelectItem>
            {buildings.map((building) => (
              <SelectItem key={building.id} value={building.id}>
                {building.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Demands List */}
      <Tabs defaultValue='pending' className='w-full'>
        <TabsList>
          <TabsTrigger value='pending'>Pending Review ({pendingDemands.length})</TabsTrigger>
          <TabsTrigger value='active'>In Progress ({reviewDemands.length})</TabsTrigger>
          <TabsTrigger value='completed'>Completed ({completedDemands.length})</TabsTrigger>
        </TabsList>

        <TabsContent value='pending' className='space-y-4'>
          {pendingDemands.length === 0 ? (
            <Card>
              <CardContent className='p-6 text-center'>
                <p className='text-muted-foreground'>No demands pending review</p>
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
          {reviewDemands.length === 0 ? (
            <Card>
              <CardContent className='p-6 text-center'>
                <p className='text-muted-foreground'>No active demands</p>
              </CardContent>
            </Card>
          ) : (
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
              {reviewDemands.map((demand: Demand) => (
                <DemandCard key={demand.id} demand={demand} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value='completed' className='space-y-4'>
          {completedDemands.length === 0 ? (
            <Card>
              <CardContent className='p-6 text-center'>
                <p className='text-muted-foreground'>No completed demands</p>
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
      </Tabs>

      {/* View Demand Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Demand Details</DialogTitle>
          </DialogHeader>
          {selectedDemand && (
            <div className='space-y-4'>
              <div className='flex items-center gap-2'>
                <Badge variant='outline'>{getTypeLabel(selectedDemand.type, t)}</Badge>
                <Badge className={statusColors[selectedDemand.status]}>
                  {getStatusLabel(selectedDemand.status, t)}
                </Badge>
              </div>
              <div>
                <Label>Submitted by</Label>
                <p className='mt-1 text-sm'>
                  {selectedDemand.submitter
                    ? `${selectedDemand.submitter.firstName} ${selectedDemand.submitter.lastName} (${selectedDemand.submitter.email})`
                    : 'Unknown User'}
                </p>
              </div>
              <div>
                <Label>Description</Label>
                <p className='mt-1 text-sm'>{selectedDemand.description}</p>
              </div>
              {selectedDemand.reviewNotes && (
                <div>
                  <Label>Review Notes</Label>
                  <p className='mt-1 text-sm text-muted-foreground'>{selectedDemand.reviewNotes}</p>
                </div>
              )}
              <div className='text-sm text-muted-foreground'>
                <p>
                  <strong>Building:</strong>{' '}
                  {buildings.find((b) => b.id === selectedDemand.buildingId)?.name || 'Unknown'}
                </p>
                {selectedDemand.residenceId && (
                  <p>
                    <strong>Residence:</strong>{' '}
                    {residences.find((r) => r.id === selectedDemand.residenceId)?.name || 'Unknown'}
                  </p>
                )}
                <p>
                  <strong>Created:</strong> {new Date(selectedDemand.createdAt).toLocaleString()}
                </p>
                <p>
                  <strong>Updated:</strong> {new Date(selectedDemand.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Demand Dialog */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Review Demand</DialogTitle>
            <DialogDescription>Update the status and add review notes</DialogDescription>
          </DialogHeader>
          <Form {...reviewForm}>
            <form onSubmit={reviewForm.handleSubmit(handleReviewDemand)} className='space-y-4'>
              <FormField
                control={reviewForm.control}
                name='status'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectStatus')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='under_review'>Under Review</SelectItem>
                        <SelectItem value='approved'>Approved</SelectItem>
                        <SelectItem value='rejected'>Rejected</SelectItem>
                        <SelectItem value='in_progress'>In Progress</SelectItem>
                        <SelectItem value='completed'>Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={reviewForm.control}
                name='reviewNotes'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Review Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('addNotesReviewDecision')}
                        className='min-h-[100px]'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={reviewForm.control}
                name='assignationBuildingId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign to Building (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectBuilding')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='none'>No Assignment</SelectItem>
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
              <DialogFooter>
                <Button type='submit' disabled={reviewDemandMutation.isPending}>
                  {reviewDemandMutation.isPending ? 'Updating...' : 'Update Demand'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
