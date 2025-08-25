import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Bug, Plus, Search, Filter, AlertTriangle, Calendar, User, Tag, Edit2, Trash2, MoreHorizontal } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

// Bug form schema
const bugFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must not exceed 200 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000, 'Description must not exceed 2000 characters'),
  category: z.enum(['ui_ux', 'functionality', 'performance', 'data', 'security', 'integration', 'other']),
  page: z.string().min(1, 'Page is required'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  reproductionSteps: z.string().optional(),
  environment: z.string().optional(),
});

type BugFormData = z.infer<typeof bugFormSchema>;

interface Bug {
  id: string;
  title: string;
  description: string;
  category: string;
  page: string;
  priority: string;
  status: string;
  createdBy: string;
  assignedTo: string | null;
  reproductionSteps: string | null;
  environment: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

const categoryLabels = {
  ui_ux: 'UI/UX',
  functionality: 'Functionality',
  performance: 'Performance',
  data: 'Data',
  security: 'Security',
  integration: 'Integration',
  other: 'Other',
};

const priorityColors = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

const statusColors = {
  new: 'bg-blue-100 text-blue-800',
  acknowledged: 'bg-purple-100 text-purple-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

export default function BugReports() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBug, setEditingBug] = useState<Bug | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<BugFormData>({
    resolver: zodResolver(bugFormSchema),
    defaultValues: {
      priority: 'medium',
    },
  });

  const editForm = useForm<BugFormData>({
    resolver: zodResolver(bugFormSchema),
  });

  // Fetch bugs
  const { data: bugs = [], isLoading } = useQuery({
    queryKey: ['/api/bugs'],
    enabled: !!user,
  });

  // Create bug mutation
  const createBugMutation = useMutation({
    mutationFn: (data: BugFormData) => apiRequest('POST', '/api/bugs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bugs'] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: 'Bug reported',
        description: 'Your bug report has been submitted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create bug report',
        variant: 'destructive',
      });
    },
  });

  // Update bug mutation
  const updateBugMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BugFormData> }) => 
      apiRequest('PATCH', `/api/bugs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bugs'] });
      setIsEditDialogOpen(false);
      setEditingBug(null);
      editForm.reset();
      toast({
        title: 'Bug updated',
        description: 'Bug report has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update bug report',
        variant: 'destructive',
      });
    },
  });

  // Delete bug mutation
  const deleteBugMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/bugs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bugs'] });
      toast({
        title: 'Bug deleted',
        description: 'Bug report has been deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete bug report',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: BugFormData) => {
    createBugMutation.mutate(data);
  };

  const onEditSubmit = (data: BugFormData) => {
    if (editingBug) {
      updateBugMutation.mutate({ id: editingBug.id, data });
    }
  };

  const handleEdit = (bug: Bug) => {
    setEditingBug(bug);
    editForm.reset({
      title: bug.title,
      description: bug.description,
      category: bug.category as any,
      page: bug.page,
      priority: bug.priority as any,
      reproductionSteps: bug.reproductionSteps || '',
      environment: bug.environment || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (bugId: string) => {
    deleteBugMutation.mutate(bugId);
  };

  // Check if user can edit/delete a bug
  const canEditBug = (bug: Bug) => {
    return user && (user.role === 'admin' || user.role === 'manager' || bug.createdBy === user.id);
  };

  const canDeleteBug = (bug: Bug) => {
    return user && (user.role === 'admin' || bug.createdBy === user.id);
  };

  // Filter bugs
  const filteredBugs = bugs.filter((bug: Bug) => {
    const matchesSearch = bug.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bug.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bug.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || bug.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='Bug Reports' subtitle='Report issues and track bug status' />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Bug className='w-5 h-5' />
                Bug Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='flex flex-col md:flex-row gap-4 items-start md:items-center justify-between'>
                <div className='flex flex-col sm:flex-row gap-4 flex-1'>
                  <div className='relative flex-1'>
                    <Search className='w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400' />
                    <Input
                      placeholder='Search bugs...'
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className='pl-10'
                      data-testid='input-search-bugs'
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className='w-full sm:w-40' data-testid='select-status-filter'>
                      <SelectValue placeholder='Filter by status' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>All Status</SelectItem>
                      <SelectItem value='new'>New</SelectItem>
                      <SelectItem value='acknowledged'>Acknowledged</SelectItem>
                      <SelectItem value='in_progress'>In Progress</SelectItem>
                      <SelectItem value='resolved'>Resolved</SelectItem>
                      <SelectItem value='closed'>Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className='w-full sm:w-40' data-testid='select-priority-filter'>
                      <SelectValue placeholder='Filter by priority' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>All Priority</SelectItem>
                      <SelectItem value='low'>Low</SelectItem>
                      <SelectItem value='medium'>Medium</SelectItem>
                      <SelectItem value='high'>High</SelectItem>
                      <SelectItem value='critical'>Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className='flex items-center gap-2' data-testid='button-create-bug'>
                      <Plus className='w-4 h-4' />
                      Report Bug
                    </Button>
                  </DialogTrigger>
                  <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
                    <DialogHeader>
                      <DialogTitle>Report a Bug</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
                      <div>
                        <Label htmlFor='title'>Title*</Label>
                        <Input
                          id='title'
                          placeholder='Brief description of the issue'
                          {...form.register('title')}
                          data-testid='input-bug-title'
                        />
                        {form.formState.errors.title && (
                          <p className='text-sm text-red-600 mt-1'>{form.formState.errors.title.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor='description'>Description*</Label>
                        <Textarea
                          id='description'
                          placeholder='Detailed description of the bug, including what you expected to happen'
                          rows={4}
                          {...form.register('description')}
                          data-testid='textarea-bug-description'
                        />
                        {form.formState.errors.description && (
                          <p className='text-sm text-red-600 mt-1'>{form.formState.errors.description.message}</p>
                        )}
                      </div>

                      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                        <div>
                          <Label htmlFor='category'>Category*</Label>
                          <Select 
                            onValueChange={(value) => {
                              form.setValue('category', value as any);
                              form.clearErrors('category');
                            }}
                            value={form.watch('category')}
                          >
                            <SelectTrigger data-testid='select-bug-category'>
                              <SelectValue placeholder='Select category' />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(categoryLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {form.formState.errors.category && (
                            <p className='text-sm text-red-600 mt-1'>{form.formState.errors.category.message}</p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor='priority'>Priority</Label>
                          <Select 
                            onValueChange={(value) => {
                              form.setValue('priority', value as any);
                              form.clearErrors('priority');
                            }}
                            value={form.watch('priority')}
                          >
                            <SelectTrigger data-testid='select-bug-priority'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value='low'>Low</SelectItem>
                              <SelectItem value='medium'>Medium</SelectItem>
                              <SelectItem value='high'>High</SelectItem>
                              <SelectItem value='critical'>Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor='page'>Page/Location*</Label>
                          <Input
                            id='page'
                            placeholder='e.g., Dashboard, Settings, Login'
                            {...form.register('page')}
                            data-testid='input-bug-page'
                          />
                          {form.formState.errors.page && (
                            <p className='text-sm text-red-600 mt-1'>{form.formState.errors.page.message}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor='reproductionSteps'>Steps to Reproduce</Label>
                        <Textarea
                          id='reproductionSteps'
                          placeholder='1. Go to...\n2. Click on...\n3. Notice that...'
                          rows={3}
                          {...form.register('reproductionSteps')}
                          data-testid='textarea-reproduction-steps'
                        />
                      </div>

                      <div>
                        <Label htmlFor='environment'>Environment</Label>
                        <Input
                          id='environment'
                          placeholder='e.g., Chrome 120, Windows 11, Mobile Safari'
                          {...form.register('environment')}
                          data-testid='input-bug-environment'
                        />
                      </div>

                      <div className='flex justify-end gap-2 pt-4'>
                        <Button type='button' variant='outline' onClick={() => setIsCreateDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type='submit' disabled={createBugMutation.isPending} data-testid='button-submit-bug'>
                          {createBugMutation.isPending ? 'Submitting...' : 'Submit Bug Report'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                {/* Edit Bug Dialog */}
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                  <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto' data-testid='edit-bug-dialog'>
                    <DialogHeader>
                      <DialogTitle>Edit Bug Report</DialogTitle>
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
                            <p className='text-red-500 text-xs'>{editForm.formState.errors.title.message}</p>
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
                              <SelectItem value='ui_ux'>UI/UX</SelectItem>
                              <SelectItem value='functionality'>Functionality</SelectItem>
                              <SelectItem value='performance'>Performance</SelectItem>
                              <SelectItem value='data'>Data</SelectItem>
                              <SelectItem value='security'>Security</SelectItem>
                              <SelectItem value='integration'>Integration</SelectItem>
                              <SelectItem value='other'>Other</SelectItem>
                            </SelectContent>
                          </Select>
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
                          <p className='text-red-500 text-xs'>{editForm.formState.errors.description.message}</p>
                        )}
                      </div>

                      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <div className='space-y-2'>
                          <Label htmlFor='edit-priority' className='text-sm font-medium'>
                            Priority <span className='text-red-500'>*</span>
                          </Label>
                          <Select
                            value={editForm.watch('priority')}
                            onValueChange={(value) => editForm.setValue('priority', value as any)}
                          >
                            <SelectTrigger data-testid='select-edit-priority'>
                              <SelectValue placeholder='Select priority' />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value='low'>Low</SelectItem>
                              <SelectItem value='medium'>Medium</SelectItem>
                              <SelectItem value='high'>High</SelectItem>
                              <SelectItem value='critical'>Critical</SelectItem>
                            </SelectContent>
                          </Select>
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
                            <p className='text-red-500 text-xs'>{editForm.formState.errors.page.message}</p>
                          )}
                        </div>
                      </div>

                      <div className='space-y-2'>
                        <Label htmlFor='edit-reproduction-steps' className='text-sm font-medium'>
                          Steps to Reproduce (Optional)
                        </Label>
                        <Textarea
                          id='edit-reproduction-steps'
                          {...editForm.register('reproductionSteps')}
                          rows={3}
                          placeholder='1. Go to...\n2. Click on...\n3. See error'
                          data-testid='textarea-edit-reproduction-steps'
                        />
                      </div>

                      <div className='space-y-2'>
                        <Label htmlFor='edit-environment' className='text-sm font-medium'>
                          Environment (Optional)
                        </Label>
                        <Input
                          id='edit-environment'
                          {...editForm.register('environment')}
                          placeholder='e.g., Chrome 120, Safari iOS 17, etc.'
                          data-testid='input-edit-environment'
                        />
                      </div>

                      <div className='flex justify-end gap-2 pt-4'>
                        <Button type='button' variant='outline' onClick={() => setIsEditDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type='submit' disabled={updateBugMutation.isPending} data-testid='button-update-bug'>
                          {updateBugMutation.isPending ? 'Updating...' : 'Update Bug Report'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Bug List */}
          <Card>
            <CardHeader>
              <CardTitle>Bug Reports ({filteredBugs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className='text-center py-8'>
                  <div className='animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto'></div>
                  <p className='text-gray-600 mt-2'>Loading bugs...</p>
                </div>
              ) : filteredBugs.length === 0 ? (
                <div className='text-center py-8'>
                  <Bug className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                  <h3 className='text-lg font-semibold text-gray-600 mb-2'>No bugs found</h3>
                  <p className='text-gray-500 mb-4'>
                    {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                      ? 'No bugs match your current filters'
                      : 'No bug reports have been submitted yet'}
                  </p>
                </div>
              ) : (
                <div className='space-y-4'>
                  {filteredBugs.map((bug: Bug) => (
                    <div key={bug.id} className='border rounded-lg p-4 hover:bg-gray-50 transition-colors' data-testid={`bug-card-${bug.id}`}>
                      <div className='flex items-start justify-between gap-4'>
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center gap-2 mb-2'>
                            <h3 className='font-semibold text-lg truncate' data-testid={`bug-title-${bug.id}`}>{bug.title}</h3>
                            <Badge className={priorityColors[bug.priority as keyof typeof priorityColors]}>
                              {bug.priority}
                            </Badge>
                            <Badge className={statusColors[bug.status as keyof typeof statusColors]}>
                              {bug.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className='text-gray-600 mb-3 line-clamp-2' data-testid={`bug-description-${bug.id}`}>{bug.description}</p>
                          <div className='flex flex-wrap items-center gap-4 text-sm text-gray-500'>
                            <div className='flex items-center gap-1'>
                              <Tag className='w-4 h-4' />
                              <span>{categoryLabels[bug.category as keyof typeof categoryLabels]}</span>
                            </div>
                            <div className='flex items-center gap-1'>
                              <Calendar className='w-4 h-4' />
                              <span>{new Date(bug.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className='flex items-center gap-1'>
                              <span>Page: {bug.page}</span>
                            </div>
                          </div>
                        </div>
                        {(canEditBug(bug) || canDeleteBug(bug)) && (
                          <div className='flex-shrink-0'>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant='ghost' 
                                  size='sm' 
                                  className='h-8 w-8 p-0'
                                  data-testid={`bug-actions-${bug.id}`}
                                >
                                  <MoreHorizontal className='h-4 w-4' />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align='end'>
                                {canEditBug(bug) && (
                                  <DropdownMenuItem 
                                    onClick={() => handleEdit(bug)}
                                    data-testid={`button-edit-${bug.id}`}
                                  >
                                    <Edit2 className='mr-2 h-4 w-4' />
                                    Edit
                                  </DropdownMenuItem>
                                )}
                                {canDeleteBug(bug) && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem 
                                        onSelect={(e) => e.preventDefault()}
                                        className='text-red-600 hover:text-red-700'
                                        data-testid={`button-delete-${bug.id}`}
                                      >
                                        <Trash2 className='mr-2 h-4 w-4' />
                                        Delete
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Bug Report</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this bug report? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction 
                                          onClick={() => handleDelete(bug.id)}
                                          className='bg-red-600 hover:bg-red-700'
                                          data-testid={`confirm-delete-${bug.id}`}
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}