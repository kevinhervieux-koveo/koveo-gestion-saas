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
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Bug,
  Edit2,
  Trash2,
  Search,
  Filter,
  Plus,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { SharedUploader } from '@/components/document-management';

// Bug creation form schema (no status - new bugs are always created with "new" status)
const bugFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.enum(['ui_ux', 'functionality', 'performance', 'data', 'security', 'integration', 'other']),
  page: z.string().min(1, 'Page/location is required'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  reproductionSteps: z.string().optional(),
});

// Bug edit form schema (includes status for admin editing)
const bugEditSchema = bugFormSchema.extend({
  status: z.enum(['new', 'acknowledged', 'in_progress', 'resolved', 'closed']),
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
  reproductionSteps: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  assignedTo: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  // Single file attachment fields (like documents) - matching database schema
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  file_content?: string;
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
  }>;
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
  low: 'bg-gray-100 text-gray-800',
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
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State management
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBugDetailsOpen, setIsBugDetailsOpen] = useState(false);
  const [selectedBug, setSelectedBug] = useState<Bug | null>(null);
  const [editingBug, setEditingBug] = useState<Bug | null>(null);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Attachment states
  const [attachmentMode, setAttachmentMode] = useState<'file' | 'text'>('file');
  const [attachmentText, setAttachmentText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [editAttachmentMode, setEditAttachmentMode] = useState<'file' | 'text'>('file');
  const [editAttachmentText, setEditAttachmentText] = useState('');

  // Forms
  const createForm = useForm<BugFormData>({
    resolver: zodResolver(bugFormSchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'functionality',
      page: '',
      priority: 'medium',
      reproductionSteps: '',
    },
  });

  const editForm = useForm<z.infer<typeof bugEditSchema>>({
    resolver: zodResolver(bugEditSchema),
  });

  const bugForm = useForm<BugFormData>({
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
      createForm.reset();
      setAttachedFiles([]);
      setAttachmentText('');
      toast({
        title: 'Success',
        description: 'Bug report created successfully',
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
    mutationFn: ({ id, data }: { id: string; data: z.infer<typeof bugEditSchema> }) => {
      const formData = new FormData();
      
      // Add form fields
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });
      
      // Add text content if in text mode
      if (editAttachmentMode === 'text' && editAttachmentText.trim()) {
        formData.append('file_content', editAttachmentText.trim());
      }
      
      // Add new files
      attachedFiles.forEach((file) => {
        formData.append('files', file);
      });

      return apiRequest('PATCH', '/api/bugs/' + id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bugs'] });
      setIsEditDialogOpen(false);
      setEditingBug(null);
      editForm.reset();
      setAttachedFiles([]);
      setEditAttachmentText('');
      toast({
        title: 'Success',
        description: 'Bug report updated successfully',
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
    mutationFn: (id: string) => apiRequest('DELETE', '/api/bugs/' + id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bugs'] });
      toast({
        title: 'Success',
        description: 'Bug report deleted successfully',
      });
    },
  });

  // Handle form submissions
  const onCreateSubmit = async (data: BugFormData) => {
    if (attachedFiles.length > 0) {
      // Create FormData for multipart upload
      const formData = new FormData();
      
      // Add bug data
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });

      // Add text notes if provided
      if (attachmentText.trim()) {
        formData.append('file_content', attachmentText.trim());
      }

      // Add attached file (single file only, backend expects 'attachment' field)
      if (attachedFiles.length > 0) {
        formData.append('attachment', attachedFiles[0]);
      }

      // Make multipart request
      fetch('/api/bugs', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to create bug report');
          }
          return response.json();
        })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/bugs'] });
          setAttachedFiles([]);
          setAttachmentText('');
          createForm.reset();
          setIsCreateDialogOpen(false);
          toast({
            title: 'Success',
            description: 'Bug report created successfully',
          });
        })
        .catch(error => {
          toast({
            title: 'Error',
            description: error.message || 'Failed to create bug report',
            variant: 'destructive',
          });
        });
    } else if (attachmentText.trim()) {
      // No files but has text notes
      const payload = {
        ...data,
        file_content: attachmentText.trim(),
      };
      createBugMutation.mutate(payload);
    } else {
      // No files or text notes, use regular API request
      createBugMutation.mutate(data);
    }
  };

  const onEditSubmit = (data: z.infer<typeof bugEditSchema>) => {
    if (!editingBug) return;
    updateBugMutation.mutate({ id: editingBug.id, data });
  };

  // Handle file attachments
  const handleFilesSelect = (files: File[]) => {
    setAttachedFiles(files);
  };

  // Handle file download
  const handleDelete = (id: string) => {
    deleteBugMutation.mutate(id);
    setIsBugDetailsOpen(false);
    setSelectedBug(null);
  };

  // Handle edit dialog
  const handleEditBug = (bug: Bug) => {
    setEditingBug(bug);
    editForm.reset({
      title: bug.title,
      description: bug.description,
      category: bug.category as any,
      page: bug.page,
      priority: bug.priority as any,
      status: bug.status as any,
      reproductionSteps: bug.reproductionSteps || '',
    });
    
    // Initialize edit attachment mode and text
    setEditAttachmentMode('file');
    setEditAttachmentText(bug.file_content || '');
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (bug: Bug) => {
    setSelectedBug(bug);
    
    // Close any open dialogs before deleting
    setIsBugDetailsOpen(false);
    setIsEditDialogOpen(false);
  };

  // Check if user can edit/delete a bug
  const canEditBug = (bug: Bug) => {
    return user?.role === 'admin' || bug.createdBy === user?.id;
  };

  const canDeleteBug = (bug: Bug) => {
    return user?.role === 'admin' || bug.createdBy === user?.id;
  };

  // Filter bugs with role-based access control
  const filteredBugs = (bugs || []).filter((bug: Bug) => {
    // Role-based filtering: users see only their bugs, admins see all
    const hasAccess = user?.role === 'admin' || bug.createdBy === user?.id;
    if (!hasAccess) return false;

    // Search filter
    const matchesSearch = searchTerm === '' || 
      bug.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bug.description.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
    const matchesStatus = statusFilter === 'all' || bug.status === statusFilter;

    // Priority filter
    const matchesPriority = priorityFilter === 'all' || bug.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Header title="Bug Reports" subtitle="Report and track application issues" />
      
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search bugs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-bugs"
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32" data-testid="select-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-32" data-testid="select-priority-filter">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-bug">
                  <Plus className="w-4 h-4 mr-2" />
                  Report Bug
                </Button>
              </div>
            </div>

            {/* Create Bug Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="create-bug-dialog">
                <DialogHeader>
                  <DialogTitle>Report New Bug</DialogTitle>
                </DialogHeader>
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* TOP SECTION: Manual Input Fields */}
                    <div className="space-y-2">
                      <Label htmlFor="create-title" className="text-sm font-medium">
                        Title <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="create-title"
                        {...createForm.register('title')}
                        data-testid="input-create-title"
                      />
                      {createForm.formState.errors.title && (
                        <p className="text-red-500 text-xs">
                          {createForm.formState.errors.title.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="create-category" className="text-sm font-medium">
                        Category <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={createForm.watch('category')}
                        onValueChange={(value) => createForm.setValue('category', value as any)}
                      >
                        <SelectTrigger data-testid="select-create-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ui_ux">UI/UX</SelectItem>
                          <SelectItem value="functionality">Functionality</SelectItem>
                          <SelectItem value="performance">Performance</SelectItem>
                          <SelectItem value="data">Data</SelectItem>
                          <SelectItem value="security">Security</SelectItem>
                          <SelectItem value="integration">Integration</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-description" className="text-sm font-medium">
                      Description <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="create-description"
                      {...createForm.register('description')}
                      rows={4}
                      data-testid="textarea-create-description"
                    />
                    {createForm.formState.errors.description && (
                      <p className="text-red-500 text-xs">
                        {createForm.formState.errors.description.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="create-priority" className="text-sm font-medium">
                        Priority <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={createForm.watch('priority')}
                        onValueChange={(value) => createForm.setValue('priority', value as any)}
                      >
                        <SelectTrigger data-testid="select-create-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="create-page" className="text-sm font-medium">
                        Page/Location <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="create-page"
                        {...createForm.register('page')}
                        placeholder="e.g. Dashboard, Login page, Settings"
                        data-testid="input-create-page"
                      />
                      {createForm.formState.errors.page && (
                        <p className="text-red-500 text-xs">
                          {createForm.formState.errors.page.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-steps" className="text-sm font-medium">
                      Steps to Reproduce (Optional)
                    </Label>
                    <Textarea
                      id="create-steps"
                      {...createForm.register('reproductionSteps')}
                      rows={3}
                      placeholder="Describe the steps to reproduce this issue..."
                      data-testid="textarea-create-steps"
                    />
                  </div>

                  {/* BOTTOM SECTION: Attachment Type Selection */}
                  <div className="space-y-4 border-t pt-4">
                    <Label className="text-sm font-medium">Choose Document Type</Label>
                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={() => setAttachmentMode('file')}
                        className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                          attachmentMode === 'file'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        data-testid="button-file-mode"
                      >
                        📁 Upload File
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttachmentMode('text')}
                        className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                          attachmentMode === 'text'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        data-testid="button-text-mode"
                      >
                        📝 Text Document
                      </button>
                    </div>

                    {/* Dynamic Content Based on Selection */}
                    {attachmentMode === 'file' ? (
                      <div>
                        <Label htmlFor="file-upload">Select File to Upload</Label>
                        <Input
                          id="file-upload"
                          type="file"
                          multiple
                          accept="image/*,.pdf,.txt,.log,.json,.csv"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length > 0) {
                              handleFilesSelect(files);
                            }
                          }}
                          className="w-full"
                          data-testid="input-file-upload"
                        />
                        {attachedFiles.length > 0 && (
                          <div className="space-y-2 mt-2">
                            <p className="text-sm text-gray-500">
                              Selected: {attachedFiles.map(f => f.name + ' (' + Math.round(f.size / 1024) + ' KB)').join(', ')}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <Label htmlFor="text-content">Document Content</Label>
                        <Textarea
                          id="text-content"
                          value={attachmentText}
                          onChange={(e) => setAttachmentText(e.target.value)}
                          rows={5}
                          className="w-full"
                          data-testid="textarea-text-content"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          This will add text notes that can be viewed with the bug report.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createBugMutation.isPending}
                      data-testid="button-submit-bug"
                    >
                      {createBugMutation.isPending ? 'Submitting...' : 'Submit Bug Report'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Edit Bug Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="edit-bug-dialog">
                <DialogHeader>
                  <DialogTitle>Edit Bug Report</DialogTitle>
                </DialogHeader>
                <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-title" className="text-sm font-medium">
                        Title <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="edit-title"
                        {...editForm.register('title')}
                        data-testid="input-edit-title"
                      />
                      {editForm.formState.errors.title && (
                        <p className="text-red-500 text-xs">
                          {editForm.formState.errors.title.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-category" className="text-sm font-medium">
                        Category <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={editForm.watch('category')}
                        onValueChange={(value) => editForm.setValue('category', value as any)}
                      >
                        <SelectTrigger data-testid="select-edit-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ui_ux">UI/UX</SelectItem>
                          <SelectItem value="functionality">Functionality</SelectItem>
                          <SelectItem value="performance">Performance</SelectItem>
                          <SelectItem value="data">Data</SelectItem>
                          <SelectItem value="security">Security</SelectItem>
                          <SelectItem value="integration">Integration</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-description" className="text-sm font-medium">
                      Description <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="edit-description"
                      {...editForm.register('description')}
                      rows={4}
                      data-testid="textarea-edit-description"
                    />
                    {editForm.formState.errors.description && (
                      <p className="text-red-500 text-xs">
                        {editForm.formState.errors.description.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-priority" className="text-sm font-medium">
                        Priority <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={editForm.watch('priority')}
                        onValueChange={(value) => editForm.setValue('priority', value as any)}
                      >
                        <SelectTrigger data-testid="select-edit-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-status" className="text-sm font-medium">
                        Status
                      </Label>
                      <Select
                        value={editForm.watch('status')}
                        onValueChange={(value) => editForm.setValue('status', value as any)}
                      >
                        <SelectTrigger data-testid="select-edit-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="acknowledged">Acknowledged</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-page" className="text-sm font-medium">
                        Page/Location <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="edit-page"
                        {...editForm.register('page')}
                        placeholder="e.g. Dashboard, Login page, Settings"
                        data-testid="input-edit-page"
                      />
                      {editForm.formState.errors.page && (
                        <p className="text-red-500 text-xs">
                          {editForm.formState.errors.page.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-steps" className="text-sm font-medium">
                      Steps to Reproduce (Optional)
                    </Label>
                    <Textarea
                      id="edit-steps"
                      {...editForm.register('reproductionSteps')}
                      rows={3}
                      placeholder="Describe the steps to reproduce this issue..."
                      data-testid="textarea-edit-steps"
                    />
                  </div>

                  {/* Choose Document Type Section */}
                  <div className="space-y-4 border-t pt-4">
                    <Label className="text-sm font-medium">Choose Document Type</Label>
                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={() => setEditAttachmentMode('file')}
                        className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                          editAttachmentMode === 'file'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        data-testid="button-edit-file-mode"
                      >
                        📁 Upload File
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditAttachmentMode('text')}
                        className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                          editAttachmentMode === 'text'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        data-testid="button-edit-text-mode"
                      >
                        📝 Text Document
                      </button>
                    </div>

                    {/* Dynamic Content Based on Selection */}
                    {editAttachmentMode === 'file' ? (
                      <div>
                        <Label htmlFor="edit-file-upload">Select File to Upload</Label>
                        {editingBug?.filePath && (
                          <div className="space-y-2 mb-4">
                            <Label>Current Attachment</Label>
                            <AttachedFileSection
                              entityType="bug"
                              entityId={editingBug.id}
                              filePath={editingBug.filePath}
                              fileName={editingBug.fileName}
                              fileSize={editingBug.fileSize}
                            />
                          </div>
                        )}
                        <Input
                          id="edit-file-upload"
                          type="file"
                          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                          data-testid="input-edit-file"
                          className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {editingBug?.filePath ? 'Upload a new file to replace the current attachment' : 'Attach a screenshot or document'}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <Label htmlFor="edit-text-content">Document Content</Label>
                        <Textarea
                          id="edit-text-content"
                          value={editAttachmentText}
                          onChange={(e) => setEditAttachmentText(e.target.value)}
                          rows={5}
                          className="w-full"
                          data-testid="textarea-edit-text-content"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          This will show text notes with the bug report.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={updateBugMutation.isPending}
                      data-testid="button-update-bug"
                    >
                      {updateBugMutation.isPending ? 'Updating...' : 'Update Bug Report'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Bugs Display - Grouped by category */}
          {filteredBugs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Bug className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg text-gray-500">
                  {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                    ? 'No bugs match your current filters.'
                    : 'No bug reports have been submitted yet.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Category View - Group bugs by category */}
              {Object.entries(categoryLabels).map(([categoryKey, categoryLabel]) => {
                const categoryBugs = filteredBugs.filter((bug: Bug) => bug.category === categoryKey);
                if (categoryBugs.length === 0) {
                  return null;
                }

                return (
                  <Card key={categoryKey} data-testid={'category-' + categoryKey}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bug className="h-5 w-5" />
                        {categoryLabel}
                        <Badge variant="secondary">{categoryBugs.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categoryBugs.map((bug: Bug) => (
                          <Card
                            key={bug.id}
                            className="cursor-pointer hover:bg-gray-50 transition-colors"
                            data-testid={'bug-card-' + bug.id}
                            onClick={() => {
                              setSelectedBug(bug);
                              // Set form values for editing
                              bugForm.reset({
                                title: bug.title,
                                description: bug.description,
                                category: bug.category as any,
                                page: bug.page,
                                priority: bug.priority as any,
                                reproductionSteps: bug.reproductionSteps || '',
                              });
                              setIsBugDetailsOpen(true);
                            }}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h4
                                  className="font-medium text-sm text-gray-900 line-clamp-2 break-words flex-1"
                                  data-testid={'bug-name-' + bug.id}
                                >
                                  {bug.title}
                                </h4>
                                <div className="flex gap-1">
                                  {canEditBug(bug) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedBug(bug);
                                        // Set form values for editing
                                        bugForm.reset({
                                          title: bug.title,
                                          description: bug.description,
                                          category: bug.category as any,
                                          page: bug.page,
                                          priority: bug.priority as any,
                                          reproductionSteps: bug.reproductionSteps || '',
                                        });
                                        setIsBugDetailsOpen(true);
                                      }}
                                      data-testid={'button-edit-' + bug.id}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <p
                                className="text-xs text-gray-500 mb-2"
                                data-testid={'bug-date-' + bug.id}
                              >
                                {new Date(bug.createdAt).toLocaleDateString()}
                              </p>
                              <div className="flex flex-wrap gap-1 mb-2">
                                <Badge
                                  className={
                                    priorityColors[bug.priority as keyof typeof priorityColors]
                                  }
                                  variant="outline"
                                >
                                  {bug.priority}
                                </Badge>
                                <Badge
                                  className={statusColors[bug.status as keyof typeof statusColors]}
                                  variant="outline"
                                >
                                  {bug.status.replace(/_/g, ' ')}
                                </Badge>
                              </div>
                              {bug.filePath && (
                                <Badge variant="secondary" className="text-xs">
                                  📎 File attached
                                </Badge>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bug Details Dialog - Editable Form */}
      <Dialog open={isBugDetailsOpen} onOpenChange={setIsBugDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bug Report Details</DialogTitle>
          </DialogHeader>
          {selectedBug && (
            <form onSubmit={bugForm.handleSubmit((data) => {
              // Handle form submission for updates
              if (canEditBug(selectedBug)) {
                updateBugMutation.mutate({ 
                  id: selectedBug.id, 
                  data: { ...data, status: selectedBug.status } as any 
                });
                setIsBugDetailsOpen(false);
              }
            })} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="details-title" className="text-sm font-medium">
                    Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="details-title"
                    {...bugForm.register('title')}
                    readOnly={!canEditBug(selectedBug)}
                    className={!canEditBug(selectedBug) ? 'bg-gray-50' : ''}
                    data-testid="input-details-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="details-category" className="text-sm font-medium">
                    Category <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={bugForm.watch('category')}
                    onValueChange={(value) => canEditBug(selectedBug) && bugForm.setValue('category', value as any)}
                    disabled={!canEditBug(selectedBug)}
                  >
                    <SelectTrigger data-testid="select-details-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ui_ux">UI/UX</SelectItem>
                      <SelectItem value="functionality">Functionality</SelectItem>
                      <SelectItem value="performance">Performance</SelectItem>
                      <SelectItem value="data">Data</SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                      <SelectItem value="integration">Integration</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="details-description" className="text-sm font-medium">
                  Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="details-description"
                  {...bugForm.register('description')}
                  rows={4}
                  readOnly={!canEditBug(selectedBug)}
                  className={!canEditBug(selectedBug) ? 'bg-gray-50' : ''}
                  data-testid="textarea-details-description"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="details-priority" className="text-sm font-medium">
                    Priority <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={bugForm.watch('priority')}
                    onValueChange={(value) => canEditBug(selectedBug) && bugForm.setValue('priority', value as any)}
                    disabled={!canEditBug(selectedBug)}
                  >
                    <SelectTrigger data-testid="select-details-priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {user?.role === 'admin' && (
                  <div className="space-y-2">
                    <Label htmlFor="details-status" className="text-sm font-medium">
                      Status
                    </Label>
                    <Select
                      value={selectedBug.status}
                      onValueChange={(value) => {
                        // Update the selected bug status directly since this is admin-only
                        setSelectedBug({ ...selectedBug, status: value });
                      }}
                    >
                      <SelectTrigger data-testid="select-details-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="acknowledged">Acknowledged</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="details-page" className="text-sm font-medium">
                    Page/Location <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="details-page"
                    {...bugForm.register('page')}
                    readOnly={!canEditBug(selectedBug)}
                    className={!canEditBug(selectedBug) ? 'bg-gray-50' : ''}
                    placeholder="e.g. Dashboard, Login page, Settings"
                    data-testid="input-details-page"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="details-steps" className="text-sm font-medium">
                  Steps to Reproduce (Optional)
                </Label>
                <Textarea
                  id="details-steps"
                  {...bugForm.register('reproductionSteps')}
                  rows={3}
                  readOnly={!canEditBug(selectedBug)}
                  className={!canEditBug(selectedBug) ? 'bg-gray-50' : ''}
                  placeholder="Describe the steps to reproduce this issue..."
                  data-testid="textarea-details-steps"
                />
              </div>

              {/* Metadata Section */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <strong>Created:</strong> {new Date(selectedBug.createdAt).toLocaleDateString()}
                  </div>
                  <div>
                    <strong>Status:</strong> 
                    <Badge 
                      className={statusColors[selectedBug.status as keyof typeof statusColors]} 
                      variant="outline"
                    >
                      {selectedBug.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* File Section - Using Shared Component */}
              <AttachedFileSection
                entityType="bug"
                entityId={selectedBug.id}
                filePath={selectedBug.filePath}
                fileName={selectedBug.fileName}
                fileSize={selectedBug.fileSize}
                fallbackName={selectedBug.title}
              />

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div>
                  {canDeleteBug(selectedBug) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this bug report?')) {
                          handleDelete(selectedBug.id);
                        }
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsBugDetailsOpen(false)}
                  >
                    {canEditBug(selectedBug) ? 'Cancel' : 'Close'}
                  </Button>
                  {canEditBug(selectedBug) && (
                    <Button
                      type="submit"
                      disabled={updateBugMutation.isPending}
                      data-testid="button-save-bug"
                    >
                      {updateBugMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}