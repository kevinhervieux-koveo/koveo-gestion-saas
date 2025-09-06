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
  DialogDescription,
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
  Bug,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Calendar,
  User,
  Tag,
  Edit2,
  Trash2,
  MoreHorizontal,
  Paperclip,
  Eye,
  FileText,
  Download,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { CompactFileUpload } from '@/components/ui/file-upload';

// Bug creation form schema (no status - new bugs are always created with "new" status)
const bugFormSchema = z.object({
  title: z.string().min(1, 'Bug title is required (example: Login button not working on mobile)').max(200, 'Title must be less than 200 characters'),
  description: z
    .string()
    .min(10, 'Bug description must be at least 10 characters long (example: When I click the login button on my phone, nothing happens and no error message appears)')
    .max(2000, 'Description must be less than 2000 characters'),
  category: z.enum([
    'ui_ux',
    'functionality',
    'performance',
    'data',
    'security',
    'integration',
    'other',
  ]),
  page: z.string().min(1, 'Page location is required (example: Login page, Dashboard, Settings)').max(100, 'Page location must be less than 100 characters'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  reproductionSteps: z.string().max(1000, 'Reproduction steps must be less than 1000 characters').optional(),
});

// Bug edit form schema (includes status for admin editing)
const bugEditSchema = bugFormSchema.extend({
  status: z.enum(['new', 'acknowledged', 'in_progress', 'resolved', 'closed']),
});

/**
 *
 */
type BugFormData = z.infer<typeof bugFormSchema>;
type BugEditData = z.infer<typeof bugEditSchema>;

/**
 *
 */
interface Bug {
  id: string;
  title: string;
  description: string;
  category: string;
  page: string;
  priority: string;
  status: string;
  created_by: string;
  assigned_to: string | null;
  reproduction_steps: string | null;
  environment: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  // Single file attachment fields (like documents)
  file_path?: string;
  file_name?: string;
  file_size?: number;
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
    url: string;
    type: string;
  }>;
  attachmentCount?: number;
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

/**
 *
 */
export default function BugReports() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isBugDetailsOpen, setIsBugDetailsOpen] = useState(false);
  const [editingBug, setEditingBug] = useState<Bug | null>(null);
  const [viewingBug, setViewingBug] = useState<Bug | null>(null);
  const [selectedBug, setSelectedBug] = useState<Bug | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [attachmentMode, setAttachmentMode] = useState<'file' | 'text'>('file');
  const [attachmentText, setAttachmentText] = useState('');
  const [editAttachmentMode, setEditAttachmentMode] = useState<'file' | 'text'>('file');
  const [editAttachmentText, setEditAttachmentText] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<BugFormData>({
    resolver: zodResolver(bugFormSchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'functionality' as const,
      page: '',
      priority: 'medium' as const,
      reproductionSteps: '',
    },
  });

  const editForm = useForm<BugEditData>({
    resolver: zodResolver(bugEditSchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'functionality' as const,
      page: '',
      priority: 'medium' as const,
      reproductionSteps: '',
    },
  });

  const bugForm = useForm<BugFormData>({
    resolver: zodResolver(bugFormSchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'functionality' as const,
      page: '',
      priority: 'medium' as const,
      reproductionSteps: '',
    },
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
      setAttachedFiles([]);
      setAttachmentText('');
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
    mutationFn: ({ id, data }: { id: string; data: Partial<BugFormData> }) => {
      const formData = new FormData();
      
      // Add form fields
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value as string);
        }
      });
      
      // Add text content if in text mode
      if (editAttachmentMode === 'text' && editAttachmentText.trim()) {
        formData.append('additionalNotes', editAttachmentText);
      }
      
      // Add new files
      attachedFiles.forEach((file) => {
        formData.append('attachments', file);
      });

      return apiRequest('PATCH', `/api/bugs/${id}`, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bugs'] });
      setIsEditDialogOpen(false);
      setEditingBug(null);
      setAttachedFiles([]);
      setEditAttachmentText('');
      setEditAttachmentMode('file');
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
    if (attachedFiles.length > 0) {
      // Create FormData for multipart upload
      const formData = new FormData();
      
      // Add bug data
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value.toString());
        }
      });

      // Add text notes if provided
      if (attachmentText.trim()) {
        formData.append('additionalNotes', attachmentText);
      }

      // Add attached files
      attachedFiles.forEach(file => {
        formData.append('attachments', file);
      });

      // Make multipart request
      fetch('/api/bugs', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
        .then(response => {
          if (!response.ok) {
            return response.json().then(err => Promise.reject(err));
          }
          return response.json();
        })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/bugs'] });
          setAttachedFiles([]);
          setAttachmentText('');
          form.reset();
          setIsCreateDialogOpen(false);
          toast({
            title: 'Bug created',
            description: 'Bug report has been created successfully.',
          });
        })
        .catch((error) => {
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
        additionalNotes: attachmentText,
      };
      createBugMutation.mutate(payload);
    } else {
      // No files or text notes, use regular API request
      createBugMutation.mutate(data);
    }
  };

  const onEditSubmit = (data: BugEditData) => {
    if (editingBug) {
      updateBugMutation.mutate({ id: editingBug.id, data });
    }
  };

  // Handle file attachments
  const handleFilesSelect = (files: File[]) => {
    setAttachedFiles(prev => [...prev, ...files]);
  };

  // Handle file download
  const handleFileDownload = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const handleEdit = (bug: Bug) => {
    if (!canEditBug(bug)) {
      return;
    }

    setEditingBug(bug);
    editForm.reset({
      title: bug.title,
      description: bug.description,
      category: bug.category as any,
      page: bug.page,
      priority: bug.priority as any,
      status: bug.status as any,
      reproductionSteps: bug.reproduction_steps || '',
    });
    
    // Initialize edit attachment mode and text
    const hasTextNotes = (bug as any).additionalNotes || (bug as any).additional_notes;
    setEditAttachmentText(hasTextNotes || '');
    setEditAttachmentMode(hasTextNotes ? 'text' : 'file');
    
    setIsEditDialogOpen(true);
  };

  const handleDelete = (bugId: string) => {
    // Close any open dialogs before deleting
    setIsEditDialogOpen(false);
    setIsViewDialogOpen(false);
    setEditingBug(null);
    setViewingBug(null);
    
    deleteBugMutation.mutate(bugId);
  };

  // Check if user can edit/delete a bug
  const canEditBug = (bug: Bug) => {
    return user && (user.role === 'admin' || user.role === 'manager' || bug.created_by === user.id);
  };

  const canDeleteBug = (bug: Bug) => {
    return user && (user.role === 'admin' || bug.created_by === user.id);
  };

  // Filter bugs with role-based access control
  const filteredBugs = (bugs as Bug[]).filter((bug: Bug) => {
    // Role-based filtering: users see only their bugs, admins see all
    const hasAccess = user && (user.role === 'admin' || bug.created_by === user.id);
    if (!hasAccess) {
      return false;
    }

    const matchesSearch =
      bug.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bug.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bug.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || bug.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Bug Reports" subtitle="Report issues and track bug status" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="w-5 h-5" />
                Bug Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-4 flex-1">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Search bugs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-bugs"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-40" data-testid="select-status-filter">
                      <SelectValue placeholder="Filter by status" />
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
                    <SelectTrigger className="w-full sm:w-40" data-testid="select-priority-filter">
                      <SelectValue placeholder="Filter by priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2" data-testid="button-create-bug">
                      <Plus className="w-4 h-4" />
                      Report Bug
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Report a Bug</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      {/* TOP SECTION: Manual Input Fields */}
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="title">Title*</Label>
                          <Input
                            id="title"
                            placeholder="Brief description of the issue"
                            {...form.register('title')}
                            data-testid="input-bug-title"
                          />
                          {form.formState.errors.title && (
                            <p className="text-sm text-red-600 mt-1">
                              {form.formState.errors.title.message}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="description">Description*</Label>
                          <Textarea
                            id="description"
                            placeholder="Describe the bug in detail"
                            rows={4}
                            {...form.register('description')}
                            data-testid="input-bug-description"
                          />
                          {form.formState.errors.description && (
                            <p className="text-sm text-red-600 mt-1">
                              {form.formState.errors.description.message}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label htmlFor="category">Category*</Label>
                            <Select
                              onValueChange={(value) => {
                                form.setValue('category', value as any);
                                form.clearErrors('category');
                              }}
                              value={form.watch('category')}
                            >
                              <SelectTrigger data-testid="select-bug-category">
                                <SelectValue placeholder="Select category" />
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
                              <p className="text-sm text-red-600 mt-1">
                                {form.formState.errors.category.message}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="priority">Priority</Label>
                            <Select
                              onValueChange={(value) => {
                                form.setValue('priority', value as any);
                                form.clearErrors('priority');
                              }}
                              value={form.watch('priority')}
                            >
                              <SelectTrigger data-testid="select-bug-priority">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="page">Page/Location*</Label>
                            <Input
                              
                              
                              {...form.register('page')}
                              data-test
                            />
                            {form.formState.errors.page && (
                              <p className="text-sm text-red-600 mt-1">
                                {form.formState.errors.page.message}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="reproductionSteps">Steps to Reproduce</Label>
                          <Textarea
                            
                            
                            rows={3}
                            {...form.register('reproductionSteps')}
                            data-test
                          />
                        </div>
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
                                  Selected: {attachedFiles.map(f => `${f.name} (${Math.round(f.size / 1024)} KB)`).join(', ')}
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
                  <DialogContent
                    className="max-w-2xl max-h-[90vh] overflow-y-auto"
                    data-testid="edit-bug-dialog"
                  >
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
                          onPaste={(e) => {
                            const items = Array.from(e.clipboardData?.items || []);
                            const imageItems = items.filter(item => item.type.indexOf('image') !== -1);
                            
                            if (imageItems.length > 0) {
                              e.preventDefault();
                              imageItems.forEach(item => {
                                const file = item.getAsFile();
                                if (file) {
                                  handleFilesSelect([file]);
                                }
                              });
                            }
                          }}
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
                            {editingBug?.attachments && editingBug.attachments.length > 0 ? (
                              <div className="space-y-2 mt-2">
                                <p className="text-sm text-gray-500">
                                  Current files: {editingBug.attachments.map(f => f.name).join(', ')}
                                </p>
                                <div className="space-y-1">
                                  {editingBug.attachments.map((attachment, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                                      <span>{attachment.name}</span>
                                      <div className="flex gap-1">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => window.open(`/api/documents/${attachment.id}/file`, '_blank')}
                                          className="text-xs"
                                        >
                                          View
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = `/api/documents/${attachment.id}/file?download=true`;
                                            link.download = attachment.name;
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                          }}
                                          className="text-xs"
                                        >
                                          Download
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 mt-1">No files attached</p>
                            )}
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
              </div>
            </CardContent>
          </Card>

          {/* Bugs Display - Grouped by category */}
          {isLoading ? (
            <div className="text-center py-8">Loading bug reports...</div>
          ) : filteredBugs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Bug className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No Bug Reports Found</h3>
                <p className="text-gray-500">
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
                  <Card key={categoryKey} data-testid={`category-${categoryKey}`}>
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
                            data-testid={`bug-card-${bug.id}`}
                            onClick={() => {
                              setSelectedBug(bug);
                              // Set form values for editing
                              bugForm.reset({
                                title: bug.title,
                                description: bug.description,
                                category: bug.category as any,
                                page: bug.page,
                                priority: bug.priority as any,
                                reproductionSteps: bug.reproduction_steps || '',
                              });
                              setIsBugDetailsOpen(true);
                            }}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h4
                                  className="font-medium text-sm text-gray-900 truncate flex-1"
                                  data-testid={`bug-name-${bug.id}`}
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
                                          reproductionSteps: bug.reproduction_steps || '',
                                        });
                                        setIsBugDetailsOpen(true);
                                      }}
                                      data-testid={`button-edit-${bug.id}`}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <p
                                className="text-xs text-gray-500 mb-2"
                                data-testid={`bug-date-${bug.id}`}
                              >
                                {new Date(bug.created_at).toLocaleDateString()}
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
                                  {bug.status.replaceAll('_', ' ')}
                                </Badge>
                              </div>
                              {bug.file_path && (
                                <Badge variant="secondary" className="text-xs">
                                  File attached
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

          {/* Bug Details Dialog */}
          <Dialog
            open={isBugDetailsOpen}
            onOpenChange={(open) => {
              setIsBugDetailsOpen(open);
              if (!open) {
                setSelectedBug(null);
              }
            }}
          >
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Bug Details</DialogTitle>
                <DialogDescription>
                  Update the bug information. File attachments and status can be modified.
                </DialogDescription>
              </DialogHeader>
              {selectedBug && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedBug.title}</h3>
                    {selectedBug.description && (
                      <p className="text-gray-600 mt-2">{selectedBug.description}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Category:</strong> {categoryLabels[selectedBug.category as keyof typeof categoryLabels]}
                    </div>
                    <div>
                      <strong>Date:</strong> {new Date(selectedBug.created_at).toLocaleDateString()}
                    </div>
                    <div>
                      <strong>Priority:</strong> {selectedBug.priority}
                    </div>
                    <div>
                      <strong>Status:</strong> {selectedBug.status.replaceAll('_', ' ')}
                    </div>
                    <div>
                      <strong>Page:</strong> {selectedBug.page}
                    </div>
                    {selectedBug.file_path && (
                      <div>
                        <strong>File:</strong> Attached
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4">
                    {selectedBug.file_path && (
                      <>
                        <Button
                          onClick={() => {
                            window.open(`/api/bugs/${selectedBug.id}/file`, '_blank');
                          }}
                          data-testid="button-view-file"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            const link = window.document.createElement('a');
                            link.href = `/api/bugs/${selectedBug.id}/file?download=true`;
                            link.download = selectedBug.file_name || selectedBug.title;
                            window.document.body.appendChild(link);
                            link.click();
                            window.document.body.removeChild(link);
                          }}
                          data-testid="button-download-file"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      </>
                    )}
                    {canDeleteBug(selectedBug) && (
                      <Button
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
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
