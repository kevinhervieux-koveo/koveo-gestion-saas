import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Lightbulb,
  Plus,
  Search,
  Filter,
  ThumbsUp,
  Calendar,
  User,
  Tag,
  Edit2,
  Trash2,
  MoreHorizontal,
  TrendingUp,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

// Feature request form schema
const featureRequestFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must not exceed 200 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description must not exceed 2000 characters'),
  need: z
    .string()
    .min(5, 'Need must be at least 5 characters')
    .max(500, 'Need must not exceed 500 characters'),
  category: z.enum([
    'dashboard',
    'property_management',
    'resident_management',
    'financial_management',
    'maintenance',
    'document_management',
    'communication',
    'reports',
    'mobile_app',
    'integrations',
    'security',
    'performance',
    'other',
  ]),
  page: z.string().min(1, 'Page is required'),
});

// Enhanced edit form schema for admins (includes status)
const adminEditFormSchema = featureRequestFormSchema.extend({
  status: z.enum(['submitted', 'under_review', 'planned', 'in_progress', 'completed', 'rejected']),
  assignedTo: z.string().optional(),
  adminNotes: z.string().optional(),
});

/**
 *
 */
type FeatureRequestFormData = z.infer<typeof featureRequestFormSchema>;
/**
 *
 */
type AdminEditFormData = z.infer<typeof adminEditFormSchema>;

/**
 *
 */
interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  need: string;
  category: string;
  page: string;
  status: string;
  upvoteCount: number;
  createdBy: string | null;
  assignedTo: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  adminNotes: string | null;
  mergedIntoId: string | null;
  createdAt: string;
  updatedAt: string;
}

const categoryLabels = {
  dashboard: 'Dashboard',
  property_management: 'Property Management',
  resident_management: 'Resident Management',
  financial_management: 'Financial Management',
  maintenance: 'Maintenance',
  document_management: 'Document Management',
  communication: 'Communication',
  reports: 'Reports',
  mobile_app: 'Mobile App',
  integrations: 'Integrations',
  security: 'Security',
  performance: 'Performance',
  other: 'Other',
};

const statusColors = {
  submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-purple-100 text-purple-800',
  planned: 'bg-orange-100 text-orange-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

/**
 *
 */
export default function IdeaBox() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingFeatureRequest, setEditingFeatureRequest] = useState<FeatureRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<FeatureRequestFormData>({
    resolver: zodResolver(featureRequestFormSchema),
  });

  const editForm = useForm<AdminEditFormData>({
    resolver: zodResolver(adminEditFormSchema),
  });

  // Fetch feature requests
  const { data: featureRequests = [], isLoading } = useQuery({
    queryKey: ['/api/feature-requests'],
    enabled: !!user,
  });

  // Create feature request mutation
  const createFeatureRequestMutation = useMutation({
    mutationFn: (data: FeatureRequestFormData) => apiRequest('POST', '/api/feature-requests', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-requests'] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: 'Feature request submitted',
        description: 'Your feature request has been submitted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create feature request',
        variant: 'destructive',
      });
    },
  });

  // Update feature request mutation (admin only)
  const updateFeatureRequestMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AdminEditFormData> }) =>
      apiRequest('PATCH', `/api/feature-requests/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-requests'] });
      setIsEditDialogOpen(false);
      setEditingFeatureRequest(null);
      editForm.reset();
      toast({
        title: 'Feature request updated',
        description: 'Feature request has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update feature request',
        variant: 'destructive',
      });
    },
  });

  // Delete feature request mutation (admin only)
  const deleteFeatureRequestMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/feature-requests/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-requests'] });
      toast({
        title: 'Feature request deleted',
        description: 'Feature request has been deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete feature request',
        variant: 'destructive',
      });
    },
  });

  // Upvote feature request mutation
  const upvoteFeatureRequestMutation = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/feature-requests/${id}/upvote`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-requests'] });
      toast({
        title: 'Upvoted',
        description: 'Your upvote has been recorded.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upvote feature request',
        variant: 'destructive',
      });
    },
  });

  // Remove upvote mutation
  const removeUpvoteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/feature-requests/${id}/upvote`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-requests'] });
      toast({
        title: 'Upvote removed',
        description: 'Your upvote has been removed.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove upvote',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: FeatureRequestFormData) => {
    createFeatureRequestMutation.mutate(data);
  };

  const onEditSubmit = (data: AdminEditFormData) => {
    if (editingFeatureRequest) {
      updateFeatureRequestMutation.mutate({ id: editingFeatureRequest.id, data });
    }
  };

  const handleEdit = (featureRequest: FeatureRequest) => {
    if (!canEditFeatureRequest()) {
      return;
    }

    setEditingFeatureRequest(featureRequest);
    editForm.reset({
      title: featureRequest.title,
      description: featureRequest.description,
      need: featureRequest.need,
      category: featureRequest.category as any,
      page: featureRequest.page,
      status: featureRequest.status as any,
      assignedTo: featureRequest.assignedTo || '',
      adminNotes: featureRequest.adminNotes || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleFeatureRequestClick = (featureRequest: FeatureRequest) => {
    if (canEditFeatureRequest()) {
      handleEdit(featureRequest);
    }
  };

  const handleDelete = (featureRequestId: string) => {
    deleteFeatureRequestMutation.mutate(featureRequestId);
  };

  const handleUpvote = (featureRequestId: string) => {
    upvoteFeatureRequestMutation.mutate(featureRequestId);
  };

  const handleRemoveUpvote = (featureRequestId: string) => {
    removeUpvoteMutation.mutate(featureRequestId);
  };

  // Check if user can edit/delete feature requests (admin only)
  const canEditFeatureRequest = () => {
    return user && user.role === 'admin';
  };

  const canDeleteFeatureRequest = () => {
    return user && user.role === 'admin';
  };

  // Filter and sort feature requests
  const filteredAndSortedFeatureRequests = featureRequests
    .filter((request: FeatureRequest) => {
      const matchesSearch =
        request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.need.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || request.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    })
    .sort((a: FeatureRequest, b: FeatureRequest) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'most_upvoted':
          return b.upvoteCount - a.upvoteCount;
        case 'least_upvoted':
          return a.upvoteCount - b.upvoteCount;
        default:
          return 0;
      }
    });

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='Idea Box' subtitle='Submit and vote on feature suggestions' />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Lightbulb className='w-5 h-5' />
                Feature Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='flex flex-col md:flex-row gap-4 items-start md:items-center justify-between'>
                <div className='flex flex-col sm:flex-row gap-4 flex-1'>
                  <div className='relative flex-1'>
                    <Search className='w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400' />
                    <Input
                      placeholder='Search feature requests...'
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className='pl-10'
                      data-testid='input-search-features'
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className='w-full sm:w-40' data-testid='select-status-filter'>
                      <SelectValue placeholder='Filter by status' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>All Status</SelectItem>
                      <SelectItem value='submitted'>Submitted</SelectItem>
                      <SelectItem value='under_review'>Under Review</SelectItem>
                      <SelectItem value='planned'>Planned</SelectItem>
                      <SelectItem value='in_progress'>In Progress</SelectItem>
                      <SelectItem value='completed'>Completed</SelectItem>
                      <SelectItem value='rejected'>Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className='w-full sm:w-40' data-testid='select-category-filter'>
                      <SelectValue placeholder='Filter by category' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>All Categories</SelectItem>
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className='w-full sm:w-40' data-testid='select-sort-by'>
                      <SelectValue placeholder='Sort by' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='newest'>Newest First</SelectItem>
                      <SelectItem value='oldest'>Oldest First</SelectItem>
                      <SelectItem value='most_upvoted'>Most Upvoted</SelectItem>
                      <SelectItem value='least_upvoted'>Least Upvoted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      className='flex items-center gap-2'
                      data-testid='button-create-feature-request'
                    >
                      <Plus className='w-4 h-4' />
                      Submit Idea
                    </Button>
                  </DialogTrigger>
                  <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
                    <DialogHeader>
                      <DialogTitle>Submit a Feature Request</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
                      <div>
                        <Label htmlFor='title'>Title*</Label>
                        <Input
                          id='title'
                          placeholder='Brief description of the feature you need'
                          {...form.register('title')}
                          data-testid='input-feature-title'
                        />
                        {form.formState.errors.title && (
                          <p className='text-sm text-red-600 mt-1'>
                            {form.formState.errors.title.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor='description'>Description*</Label>
                        <Textarea
                          id='description'
                          placeholder='Detailed description of the feature and how it should work'
                          rows={4}
                          {...form.register('description')}
                          data-testid='textarea-feature-description'
                        />
                        {form.formState.errors.description && (
                          <p className='text-sm text-red-600 mt-1'>
                            {form.formState.errors.description.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor='need'>What need does this address?*</Label>
                        <Textarea
                          id='need'
                          placeholder='Explain the specific need or problem this feature would solve'
                          rows={3}
                          {...form.register('need')}
                          data-testid='textarea-feature-need'
                        />
                        {form.formState.errors.need && (
                          <p className='text-sm text-red-600 mt-1'>
                            {form.formState.errors.need.message}
                          </p>
                        )}
                      </div>

                      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <div>
                          <Label htmlFor='category'>Category*</Label>
                          <Select
                            onValueChange={(value) => {
                              form.setValue('category', value as any);
                              form.clearErrors('category');
                            }}
                            value={form.watch('category')}
                          >
                            <SelectTrigger data-testid='select-feature-category'>
                              <SelectValue placeholder='Select category' />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(categoryLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {form.formState.errors.category && (
                            <p className='text-sm text-red-600 mt-1'>
                              {form.formState.errors.category.message}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor='page'>Page/Location*</Label>
                          <Input
                            id='page'
                            placeholder='e.g., Dashboard, Settings, Buildings page'
                            {...form.register('page')}
                            data-testid='input-feature-page'
                          />
                          {form.formState.errors.page && (
                            <p className='text-sm text-red-600 mt-1'>
                              {form.formState.errors.page.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className='flex justify-end gap-2 pt-4'>
                        <Button
                          type='button'
                          variant='outline'
                          onClick={() => setIsCreateDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type='submit'
                          disabled={createFeatureRequestMutation.isPending}
                          data-testid='button-submit-feature-request'
                        >
                          {createFeatureRequestMutation.isPending
                            ? 'Submitting...'
                            : 'Submit Feature Request'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Feature Requests List */}
          <div className='space-y-4'>
            {isLoading ? (
              <Card>
                <CardContent className='p-8 text-center'>
                  <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto'></div>
                  <p className='mt-4 text-gray-600'>Loading feature requests...</p>
                </CardContent>
              </Card>
            ) : filteredAndSortedFeatureRequests.length === 0 ? (
              <Card>
                <CardContent className='p-8 text-center'>
                  <Lightbulb className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                  <h3 className='text-lg font-semibold text-gray-600 mb-2'>
                    No feature requests found
                  </h3>
                  <p className='text-gray-500 mb-4'>
                    {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                      ? 'Try adjusting your filters to see more results.'
                      : 'Be the first to submit a feature request!'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredAndSortedFeatureRequests.map((request: FeatureRequest) => (
                <Card
                  key={request.id}
                  className={`hover:shadow-md transition-shadow ${canEditFeatureRequest() ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                  onClick={() => handleFeatureRequestClick(request)}
                  data-testid={`card-feature-request-${request.id}`}
                >
                  <CardContent className='p-6'>
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <div className='flex items-center gap-2 mb-2'>
                          <h3
                            className='text-lg font-semibold'
                            data-testid={`text-feature-title-${request.id}`}
                          >
                            {request.title}
                          </h3>
                          <Badge
                            className={statusColors[request.status as keyof typeof statusColors]}
                            data-testid={`badge-status-${request.id}`}
                          >
                            {request.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>

                        <p
                          className='text-gray-600 mb-3'
                          data-testid={`text-feature-description-${request.id}`}
                        >
                          {request.description}
                        </p>

                        <div className='bg-blue-50 p-3 rounded-lg mb-3'>
                          <p className='text-sm font-medium text-blue-800 mb-1'>Need:</p>
                          <p
                            className='text-sm text-blue-700'
                            data-testid={`text-feature-need-${request.id}`}
                          >
                            {request.need}
                          </p>
                        </div>

                        <div className='flex flex-wrap gap-2 mb-3'>
                          <Badge variant='outline' className='flex items-center gap-1'>
                            <Tag className='w-3 h-3' />
                            {categoryLabels[request.category as keyof typeof categoryLabels]}
                          </Badge>
                          <Badge variant='outline' className='flex items-center gap-1'>
                            📍 {request.page}
                          </Badge>
                          <Badge variant='outline' className='flex items-center gap-1'>
                            <Calendar className='w-3 h-3' />
                            {new Date(request.createdAt).toLocaleDateString()}
                          </Badge>
                          {user?.role === 'admin' && request.createdBy && (
                            <Badge variant='outline' className='flex items-center gap-1'>
                              <User className='w-3 h-3' />
                              Submitted by: {request.createdBy}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className='flex items-center gap-2'>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent card click event
                            handleUpvote(request.id);
                          }}
                          className='flex items-center gap-1'
                          data-testid={`button-upvote-${request.id}`}
                        >
                          <ThumbsUp className='w-4 h-4' />
                          {request.upvoteCount}
                        </Button>

                        {canEditFeatureRequest() && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant='outline'
                                size='sm'
                                onClick={(e) => e.stopPropagation()} // Prevent card click event
                                data-testid={`button-menu-${request.id}`}
                              >
                                <MoreHorizontal className='w-4 h-4' />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                              <DropdownMenuItem onClick={() => handleEdit(request)}>
                                <Edit2 className='w-4 h-4 mr-2' />
                                Edit
                              </DropdownMenuItem>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <Trash2 className='w-4 h-4 mr-2 text-red-600' />
                                    <span className='text-red-600'>Delete</span>
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Feature Request</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this feature request? This
                                      action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(request.id)}
                                      className='bg-red-600 hover:bg-red-700'
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Edit Feature Request Dialog */}
          {canEditFeatureRequest() && (
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent
                className='max-w-3xl max-h-[90vh] overflow-y-auto'
                data-testid='edit-feature-request-dialog'
              >
                <DialogHeader>
                  <DialogTitle>Edit Feature Request</DialogTitle>
                </DialogHeader>
                <form onSubmit={editForm.handleSubmit(onEditSubmit)} className='space-y-4'>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                      <Label htmlFor='edit-title' className='text-sm font-medium'>
                        Title <span className='text-red-500'>*</span>
                      </Label>
                      <Input
                        id='edit-title'
                        {...editForm.register('title')}
                        data-testid='input-edit-title'
                      />
                      {editForm.formState.errors.title && (
                        <p className='text-red-500 text-xs'>
                          {editForm.formState.errors.title.message}
                        </p>
                      )}
                    </div>

                    <div className='space-y-2'>
                      <Label htmlFor='edit-category' className='text-sm font-medium'>
                        Category <span className='text-red-500'>*</span>
                      </Label>
                      <Select
                        value={editForm.watch('category')}
                        onValueChange={(value) => editForm.setValue('category', value as any)}
                      >
                        <SelectTrigger data-testid='select-edit-category'>
                          <SelectValue placeholder='Select category' />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(categoryLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                      <Label htmlFor='edit-status' className='text-sm font-medium'>
                        Status <span className='text-red-500'>*</span>
                      </Label>
                      <Select
                        value={editForm.watch('status')}
                        onValueChange={(value) => editForm.setValue('status', value as any)}
                      >
                        <SelectTrigger data-testid='select-edit-status'>
                          <SelectValue placeholder='Select status' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='submitted'>Submitted</SelectItem>
                          <SelectItem value='under_review'>Under Review</SelectItem>
                          <SelectItem value='planned'>Planned</SelectItem>
                          <SelectItem value='in_progress'>In Progress</SelectItem>
                          <SelectItem value='completed'>Completed</SelectItem>
                          <SelectItem value='rejected'>Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                      {editForm.formState.errors.status && (
                        <p className='text-red-500 text-xs'>
                          {editForm.formState.errors.status.message}
                        </p>
                      )}
                    </div>

                    <div className='space-y-2'>
                      <Label htmlFor='edit-assigned-to' className='text-sm font-medium'>
                        Assigned To
                      </Label>
                      <Input
                        id='edit-assigned-to'
                        {...editForm.register('assignedTo')}
                        placeholder='Assign to team member'
                        data-testid='input-edit-assigned-to'
                      />
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='edit-description' className='text-sm font-medium'>
                      Description <span className='text-red-500'>*</span>
                    </Label>
                    <Textarea
                      id='edit-description'
                      {...editForm.register('description')}
                      rows={4}
                      data-testid='textarea-edit-description'
                    />
                    {editForm.formState.errors.description && (
                      <p className='text-red-500 text-xs'>
                        {editForm.formState.errors.description.message}
                      </p>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='edit-need' className='text-sm font-medium'>
                      Need <span className='text-red-500'>*</span>
                    </Label>
                    <Textarea
                      id='edit-need'
                      {...editForm.register('need')}
                      rows={3}
                      data-testid='textarea-edit-need'
                    />
                    {editForm.formState.errors.need && (
                      <p className='text-red-500 text-xs'>
                        {editForm.formState.errors.need.message}
                      </p>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='edit-page' className='text-sm font-medium'>
                      Page/Location <span className='text-red-500'>*</span>
                    </Label>
                    <Input
                      id='edit-page'
                      {...editForm.register('page')}
                      placeholder='e.g., Dashboard, Settings, etc.'
                      data-testid='input-edit-page'
                    />
                    {editForm.formState.errors.page && (
                      <p className='text-red-500 text-xs'>
                        {editForm.formState.errors.page.message}
                      </p>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='edit-admin-notes' className='text-sm font-medium'>
                      Admin Notes
                    </Label>
                    <Textarea
                      id='edit-admin-notes'
                      {...editForm.register('adminNotes')}
                      rows={3}
                      placeholder='Internal notes for team members'
                      data-testid='textarea-edit-admin-notes'
                    />
                  </div>

                  <div className='flex justify-end gap-2 pt-4'>
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => setIsEditDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type='submit'
                      disabled={updateFeatureRequestMutation.isPending}
                      data-testid='button-update-feature-request'
                    >
                      {updateFeatureRequestMutation.isPending
                        ? 'Updating...'
                        : 'Update Feature Request'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  );
}
