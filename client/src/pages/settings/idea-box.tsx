import { useState, useMemo } from 'react';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Plus,
  Search,
  Filter,
  ThumbsUp,
  Calendar,
  User,
  Tag,
  Edit2,
  Eye,
  Trash2,
  MoreHorizontal,
  TrendingUp,
  Paperclip,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { SharedUploader } from '@/components/document-management';
import { AttachedFileSection } from '@/components/common/AttachedFileSection';
import type { UploadContext } from '@shared/config/upload-config';

// Feature request form schema
const featureRequestFormSchema = z.object({
  title: z.string().min(1, 'Feature title is required').max(200, 'Title must be less than 200 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters long')
    .max(2000, 'Description must be less than 2000 characters'),
  need: z
    .string()
    .min(5, 'Need explanation must be at least 5 characters long')
    .max(500, 'Need explanation must be less than 500 characters'),
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
  page: z.string().min(1, 'Page location is required').max(100, 'Page location must be less than 100 characters'),
});

// Enhanced edit form schema for role-based editing
const editFormSchema = featureRequestFormSchema.extend({
  status: z.enum(['submitted', 'under_review', 'planned', 'in_progress', 'completed', 'rejected']).optional(),
  adminNotes: z.string().max(1000, 'Admin notes must be less than 1000 characters').optional(),
});

type FeatureRequestFormData = z.infer<typeof featureRequestFormSchema>;
type EditFormData = z.infer<typeof editFormSchema>;

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
  reviewedBy: string | null;
  reviewedAt: string | null;
  adminNotes: string | null;
  mergedIntoId: string | null;
  createdAt: string;
  updatedAt: string;
  // File attachment fields
  filePath?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  file_content?: string | null; // Text content for text-only documents
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
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  under_review: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  planned: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const categoryIcons = {
  dashboard: '📊',
  property_management: '🏢',
  resident_management: '👥',
  financial_management: '💰',
  maintenance: '🔧',
  document_management: '📁',
  communication: '💬',
  reports: '📈',
  mobile_app: '📱',
  integrations: '🔗',
  security: '🔒',
  performance: '⚡',
  other: '❓',
};

// Idea Card Component
function IdeaCard({ idea, onView, onEdit, onUpvote, canEdit, canUpvote }: {
  idea: FeatureRequest;
  onView: (idea: FeatureRequest) => void;
  onEdit: (idea: FeatureRequest) => void;
  onUpvote: (idea: FeatureRequest) => void;
  canEdit: boolean;
  canUpvote: boolean;
}) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-blue-200 dark:hover:border-blue-700"
      onClick={() => onView(idea)}
      data-testid={`card-idea-${idea.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h3 className="font-semibold text-sm line-clamp-2 flex-1 break-words" data-testid={`text-title-${idea.id}`}>
              {idea.title}
            </h3>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(idea);
                }}
                data-testid={`button-edit-${idea.id}`}
                className="h-7 w-7 p-0 hover:bg-blue-100 dark:hover:bg-blue-900"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
            {idea.filePath && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`/api/feature-requests/${idea.id}/file`, '_blank');
                }}
                data-testid={`button-file-${idea.id}`}
                className="h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Paperclip className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3" data-testid={`text-description-${idea.id}`}>
          {idea.description}
        </p>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={statusColors[idea.status as keyof typeof statusColors]} data-testid={`badge-status-${idea.id}`}>
              {idea.status.replace('_', ' ')}
            </Badge>
            <span className="text-xs text-gray-500 dark:text-gray-400" data-testid={`text-page-${idea.id}`}>
              {idea.page}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (canUpvote) onUpvote(idea);
              }}
              disabled={!canUpvote}
              data-testid={`button-upvote-${idea.id}`}
              className="h-7 px-2 gap-1 hover:bg-green-100 dark:hover:bg-green-900"
            >
              <ThumbsUp className="h-3 w-3" />
              <span className="text-xs font-medium">{idea.upvoteCount}</span>
            </Button>
            <span className="text-xs text-gray-500 dark:text-gray-400" data-testid={`text-date-${idea.id}`}>
              {formatDate(idea.createdAt)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function IdeaBox() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingFeatureRequest, setViewingFeatureRequest] = useState<FeatureRequest | null>(null);
  const [editingFeatureRequest, setEditingFeatureRequest] = useState<FeatureRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['dashboard']));
  
  // Attachment states
  const [attachmentMode, setAttachmentMode] = useState<'file' | 'text'>('file');
  const [attachmentText, setAttachmentText] = useState('');
  const [editAttachmentMode, setEditAttachmentMode] = useState<'file' | 'text'>('file');
  const [editAttachmentText, setEditAttachmentText] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Upload context for secure storage
  const uploadContext: UploadContext = {
    type: 'features',
    organizationId: 'default',
    userRole: user?.role || 'resident',
    userId: user?.id
  };

  const form = useForm<FeatureRequestFormData>({
    resolver: zodResolver(featureRequestFormSchema),
    defaultValues: {
      title: '',
      description: '',
      need: '',
      category: 'dashboard',
      page: '',
    }
  });

  const editForm = useForm<EditFormData>({
    resolver: zodResolver(editFormSchema),
  });

  // Fetch feature requests
  const { data: featureRequests = [], isLoading } = useQuery({
    queryKey: ['/api/feature-requests'],
    enabled: !!user,
  });

  // Helper functions
  const canEditIdea = (idea: FeatureRequest) => {
    if (!user) return false;
    return user.role === 'admin' || 
           (user.role === 'manager' && idea.createdBy === user.id) ||
           idea.createdBy === user.id;
  };

  const canUpvoteIdea = (idea: FeatureRequest) => {
    return !!user && user.id !== idea.createdBy;
  };

  // Filter and sort ideas
  const filteredIdeas = useMemo(() => {
    let filtered = (featureRequests as FeatureRequest[]).filter((idea: FeatureRequest) => {
      const matchesSearch = searchTerm === '' || 
        idea.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        idea.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || idea.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || idea.category === categoryFilter;
      
      return matchesSearch && matchesStatus && matchesCategory;
    });

    // Sort ideas
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'upvotes':
          return b.upvoteCount - a.upvoteCount;
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [featureRequests, searchTerm, statusFilter, categoryFilter, sortBy]);

  // Group ideas by category
  const ideasByCategory = useMemo(() => {
    const grouped: Record<string, FeatureRequest[]> = {};
    filteredIdeas.forEach((idea) => {
      if (!grouped[idea.category]) {
        grouped[idea.category] = [];
      }
      grouped[idea.category].push(idea);
    });
    return grouped;
  }, [filteredIdeas]);

  // Create feature request mutation with file upload support
  const createMutation = useMutation({
    mutationFn: async (data: FeatureRequestFormData & { file?: File }) => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'file' && value !== undefined) {
          formData.append(key, value.toString());
        }
      });
      
      if (data.file) {
        formData.append('file', data.file);
      }
      
      return fetch('/api/feature-requests', {
        method: 'POST',
        body: formData,
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-requests'] });
      setIsCreateDialogOpen(false);
      form.reset();
      setAttachmentText('');
      setAttachmentMode('file');
      setUploadedFiles([]); // Clear uploaded files
      toast({
        title: 'Idea submitted!',
        description: 'Your feature idea has been submitted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit idea',
        variant: 'destructive',
      });
    },
  });

  // Update feature request mutation with file upload support  
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EditFormData & { file?: File } }) => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'file' && value !== undefined && value !== null) {
          formData.append(key, value.toString());
        }
      });
      
      if (data.file) {
        formData.append('file', data.file);
      }
      
      return fetch(`/api/feature-requests/${id}`, {
        method: 'PATCH',
        body: formData,
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-requests'] });
      setIsEditDialogOpen(false);
      setEditingFeatureRequest(null);
      editForm.reset();
      setEditAttachmentText('');
      setEditAttachmentMode('file');
      toast({
        title: 'Idea updated!',
        description: 'Feature idea has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update idea',
        variant: 'destructive',
      });
    },
  });

  // Upvote mutation
  const upvoteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/feature-requests/${id}/upvote`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-requests'] });
      toast({
        title: 'Upvoted!',
        description: 'Your upvote has been recorded.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upvote',
        variant: 'destructive',
      });
    },
  });

  // Delete mutation (admin only)
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/feature-requests/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-requests'] });
      setIsEditDialogOpen(false);
      setEditingFeatureRequest(null);
      toast({
        title: 'Idea deleted!',
        description: 'The feature idea has been deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete idea',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (data: FeatureRequestFormData) => {
    // Use the uploaded file from SharedUploader component
    const file = uploadedFiles[0];
    
    if (file) {
      createMutation.mutate({
        ...data,
        file,
      });
    } else if (attachmentText) {
      // For text mode, store text content separately in file_content field
      const enhancedData = {
        ...data,
        file_content: attachmentText || null,
      };
      
      createMutation.mutate(enhancedData);
    } else {
      // No file or text attachment
      createMutation.mutate(data);
    }
  };

  const handleEditSubmit = (data: EditFormData) => {
    if (!editingFeatureRequest) return;
    
    if (editAttachmentMode === 'file') {
      const fileInput = document.querySelector('#edit-file-upload') as HTMLInputElement;
      const file = fileInput?.files?.[0];
      
      updateMutation.mutate({
        id: editingFeatureRequest.id,
        data: {
          ...data,
          file,
        },
      });
    } else {
      // For text mode, append to description
      const enhancedData = {
        ...data,
        description: editAttachmentText ? `${data.description}\n\n**Additional Notes:**\n${editAttachmentText}` : data.description,
      };
      
      updateMutation.mutate({
        id: editingFeatureRequest.id,
        data: enhancedData,
      });
    }
  };

  const handleViewIdea = (idea: FeatureRequest) => {
    setViewingFeatureRequest(idea);
    setIsViewDialogOpen(true);
  };

  const handleEditIdea = (idea: FeatureRequest) => {
    setEditingFeatureRequest(idea);
    editForm.reset({
      title: idea.title,
      description: idea.description,
      need: idea.need,
      category: idea.category as any,
      page: idea.page,
      status: idea.status as any,
      adminNotes: idea.adminNotes || '',
    });
    setEditAttachmentMode('file');
    setEditAttachmentText('');
    setIsEditDialogOpen(true);
  };

  const handleUpvoteIdea = (idea: FeatureRequest) => {
    upvoteMutation.mutate(idea.id);
  };

  const handleDeleteIdea = (idea: FeatureRequest) => {
    if (window.confirm(`Are you sure you want to delete "${idea.title}"? This action cannot be undone.`)) {
      deleteMutation.mutate(idea.id);
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Idea Box</h2>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <Header title="Idea Box" subtitle="Share your ideas to improve our platform" />
      
      {/* Header with search and create */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Idea Box</h2>
            <p className="text-muted-foreground">
              Share your ideas to improve our platform
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-idea">
            <Plus className="mr-2 h-4 w-4" />
            Submit New Idea
          </Button>
        </div>

        {/* Search and filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search ideas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48" data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48" data-testid="select-category-filter">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(categoryLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-32" data-testid="select-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="upvotes">Most Upvoted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Category-grouped cards */}
      <div className="space-y-6">
        {Object.entries(categoryLabels).map(([categoryKey, categoryLabel]) => {
          const categoryIdeas = ideasByCategory[categoryKey] || [];
          if (categoryIdeas.length === 0) return null;
          
          const isExpanded = expandedCategories.has(categoryKey);
          
          return (
            <div key={categoryKey} className="space-y-3">
              <Collapsible open={isExpanded} onOpenChange={() => toggleCategory(categoryKey)}>
                <CollapsibleTrigger className="flex items-center gap-2 p-2 w-full text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="text-lg font-semibold">
                    {categoryLabel}
                  </span>
                  <Badge variant="secondary" className="ml-2">
                    {categoryIdeas.length}
                  </Badge>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-6">
                    {categoryIdeas.map((idea) => (
                      <IdeaCard
                        key={idea.id}
                        idea={idea}
                        onView={handleViewIdea}
                        onEdit={handleEditIdea}
                        onUpvote={handleUpvoteIdea}
                        canEdit={canEditIdea(idea)}
                        canUpvote={canUpvoteIdea(idea)}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}
        
        {filteredIdeas.length === 0 && (
          <div className="text-center py-12">
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No ideas found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Get started by submitting your first idea.'}
            </p>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit New Idea</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Feature Title *</Label>
              <Input
                id="title"
                {...form.register('title')}
                placeholder="e.g. Add bulk export for documents"
                data-testid="input-title"
              />
              {form.formState.errors.title && (
                <p className="text-sm text-red-600">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                {...form.register('description')}
                placeholder="Describe your feature idea in detail..."
                rows={4}
                data-testid="textarea-description"
              />
              {form.formState.errors.description && (
                <p className="text-sm text-red-600">{form.formState.errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="need">Why is this needed? *</Label>
              <Textarea
                id="need"
                {...form.register('need')}
                placeholder="Explain the specific need this feature addresses..."
                rows={3}
                data-testid="textarea-need"
              />
              {form.formState.errors.need && (
                <p className="text-sm text-red-600">{form.formState.errors.need.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={form.watch('category')} onValueChange={(value) => form.setValue('category', value as any)}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.category && (
                  <p className="text-sm text-red-600">{form.formState.errors.category.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="page">Page/Location *</Label>
                <Input
                  id="page"
                  {...form.register('page')}
                  placeholder="e.g. Document Management"
                  data-testid="input-page"
                />
                {form.formState.errors.page && (
                  <p className="text-sm text-red-600">{form.formState.errors.page.message}</p>
                )}
              </div>
            </div>

            {/* Choose Document Type Section */}
            <div className="space-y-4 border-t pt-4">
              <Label className="text-sm font-medium">Attach Documents (Optional)</Label>
              <SharedUploader
                onDocumentChange={(file, text) => {
                  if (file) {
                    setUploadedFiles([file]);
                  }
                  if (text) {
                    setAttachmentText(text);
                  }
                }}
                formType="features"
                uploadContext={uploadContext}
                showAiToggle={false} // No toggle, use config-based AI enablement
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                {createMutation.isPending ? 'Submitting...' : 'Submit Idea'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Idea</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Feature Title *</Label>
              <Input
                id="edit-title"
                {...editForm.register('title')}
                data-testid="input-edit-title"
              />
              {editForm.formState.errors.title && (
                <p className="text-sm text-red-600">{editForm.formState.errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description *</Label>
              <Textarea
                id="edit-description"
                {...editForm.register('description')}
                rows={4}
                data-testid="textarea-edit-description"
              />
              {editForm.formState.errors.description && (
                <p className="text-sm text-red-600">{editForm.formState.errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-need">Why is this needed? *</Label>
              <Textarea
                id="edit-need"
                {...editForm.register('need')}
                rows={3}
                data-testid="textarea-edit-need"
              />
              {editForm.formState.errors.need && (
                <p className="text-sm text-red-600">{editForm.formState.errors.need.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category *</Label>
                <Select value={editForm.watch('category')} onValueChange={(value) => editForm.setValue('category', value as any)}>
                  <SelectTrigger data-testid="select-edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editForm.formState.errors.category && (
                  <p className="text-sm text-red-600">{editForm.formState.errors.category.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-page">Page/Location *</Label>
                <Input
                  id="edit-page"
                  {...editForm.register('page')}
                  data-testid="input-edit-page"
                />
                {editForm.formState.errors.page && (
                  <p className="text-sm text-red-600">{editForm.formState.errors.page.message}</p>
                )}
              </div>
            </div>

            {user?.role === 'admin' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={editForm.watch('status')} onValueChange={(value) => editForm.setValue('status', value as any)}>
                    <SelectTrigger data-testid="select-edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-admin-notes">Admin Notes</Label>
                  <Textarea
                    id="edit-admin-notes"
                    {...editForm.register('adminNotes')}
                    placeholder="Internal notes (visible to admins only)"
                    rows={2}
                    data-testid="textarea-admin-notes"
                  />
                </div>
              </>
            )}

            {/* Choose Document Type Section for Edit */}
            <div className="space-y-4 border-t pt-4">
              <Label className="text-sm font-medium">Choose Document Type</Label>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setEditAttachmentMode('file')}
                  className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors ${
                    editAttachmentMode === 'file'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
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
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                  }`}
                  data-testid="button-edit-text-mode"
                >
                  📝 Text Document
                </button>
              </div>

              {/* Dynamic Content Based on Selection */}
              {editAttachmentMode === 'file' ? (
                <div>
                  {editingFeatureRequest?.filePath && (
                    <div className="space-y-2 mb-4">
                      <Label>Current Attachment</Label>
                      <AttachedFileSection
                        entityType="feature-request"
                        entityId={editingFeatureRequest.id}
                        filePath={editingFeatureRequest.filePath}
                        fileName={editingFeatureRequest.fileName}
                        fileSize={editingFeatureRequest.fileSize}
                      />
                    </div>
                  )}
                  <Label htmlFor="edit-file-upload">Select File to Upload</Label>
                  <Input
                    id="edit-file-upload"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                    data-testid="input-edit-file"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {editingFeatureRequest?.filePath ? 'Upload a new file to replace the current attachment' : 'Attach a screenshot, mockup, or document'}
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
                    className="w-full mt-1"
                    placeholder="Add detailed notes, specifications, or any additional information..."
                    data-testid="textarea-edit-text-content"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This will show as additional notes with your idea
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4">
              <div>
                {user?.role === 'admin' && editingFeatureRequest && (
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={() => handleDeleteIdea(editingFeatureRequest)}
                    disabled={deleteMutation.isPending}
                    data-testid="button-delete-idea"
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete Idea'}
                  </Button>
                )}
              </div>
              <div className="flex space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update">
                  {updateMutation.isPending ? 'Updating...' : 'Update Idea'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          {viewingFeatureRequest && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <DialogTitle className="text-xl">{viewingFeatureRequest.title}</DialogTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={statusColors[viewingFeatureRequest.status as keyof typeof statusColors]}>
                        {viewingFeatureRequest.status.replace('_', ' ')}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {categoryLabels[viewingFeatureRequest.category as keyof typeof categoryLabels]}
                      </span>
                      <span className="text-sm text-gray-500">•</span>
                      <span className="text-sm text-gray-500">{viewingFeatureRequest.page}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpvoteIdea(viewingFeatureRequest)}
                      disabled={!canUpvoteIdea(viewingFeatureRequest)}
                    >
                      <ThumbsUp className="h-4 w-4 mr-1" />
                      {viewingFeatureRequest.upvoteCount}
                    </Button>
                    {canEditIdea(viewingFeatureRequest) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsViewDialogOpen(false);
                          handleEditIdea(viewingFeatureRequest);
                        }}
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Description</h4>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {viewingFeatureRequest.description}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Why is this needed?</h4>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {viewingFeatureRequest.need}
                  </p>
                </div>
                
                {/* Show file attachment if exists */}
                {viewingFeatureRequest.filePath && (
                  <div>
                    <h4 className="font-semibold mb-2">Attachment</h4>
                    <AttachedFileSection
                      entityType="feature-request"
                      entityId={viewingFeatureRequest.id}
                      filePath={viewingFeatureRequest.filePath}
                      fileName={viewingFeatureRequest.fileName}
                      fileSize={viewingFeatureRequest.fileSize}
                    />
                  </div>
                )}
                
                {/* Show text content if exists */}
                {viewingFeatureRequest.file_content && (
                  <div>
                    <h4 className="font-semibold mb-2">Document Content</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono">
                        {viewingFeatureRequest.file_content}
                      </pre>
                    </div>
                  </div>
                )}
                
                {user?.role === 'admin' && viewingFeatureRequest.adminNotes && (
                  <div>
                    <h4 className="font-semibold mb-2">Admin Notes</h4>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      {viewingFeatureRequest.adminNotes}
                    </p>
                  </div>
                )}
                
                <div className="text-sm text-gray-500 pt-2 border-t">
                  <p>Submitted on {new Date(viewingFeatureRequest.createdAt).toLocaleDateString()}</p>
                  {viewingFeatureRequest.updatedAt !== viewingFeatureRequest.createdAt && (
                    <p>Last updated on {new Date(viewingFeatureRequest.updatedAt).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}