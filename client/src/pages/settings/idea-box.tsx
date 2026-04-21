import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
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
import { useLanguage } from '@/hooks/use-language';
import { SharedUploader } from '@/components/document-management';
import { AttachedFileSection } from '@/components/common/AttachedFileSection';
import type { UploadContext } from '@shared/config/upload-config';

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
function IdeaCard({ idea, onView, onEdit, onUpvote, canEdit, canUpvote, t }: {
  idea: FeatureRequest;
  onView: (idea: FeatureRequest) => void;
  onEdit: (idea: FeatureRequest) => void;
  onUpvote: (idea: FeatureRequest) => void;
  canEdit: boolean;
  canUpvote: boolean;
  t: (key: string) => string;
}) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return t('today');
    if (diffDays === 1) return t('yesterday');
    if (diffDays < 7) return `${diffDays} ${t('daysAgo')}`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${t('weeksAgo')}`;
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
              {t(idea.status.replace('_', '') as any)}
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
  
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Category label translation function
  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      dashboard: t('dashboard'),
      property_management: t('propertyManagement'),
      resident_management: t('residentManagement'),
      financial_management: t('financialManagement'),
      maintenance: t('maintenance'),
      document_management: t('documentManagement'),
      communication: t('communication'),
      reports: t('reports'),
      mobile_app: t('mobileApp'),
      integrations: t('integrations'),
      security: t('security'),
      performance: t('performance'),
      other: t('other'),
    };
    return labels[category] || category;
  };

  // Feature request form schema
  const featureRequestFormSchema = z.object({
    title: z.string().min(1, t('featureTitleRequired')).max(200, t('titleMaxLength200')),
    description: z
      .string()
      .min(10, t('descriptionMinLength10'))
      .max(2000, t('descriptionMaxLength2000')),
    need: z
      .string()
      .min(5, t('needMinLength5'))
      .max(500, t('needMaxLength500')),
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
    page: z.string().min(1, t('pageLocationRequired')).max(100, t('pageLocationMaxLength100')),
  });

  // Enhanced edit form schema for role-based editing
  const editFormSchema = featureRequestFormSchema.extend({
    status: z.enum(['submitted', 'under_review', 'planned', 'in_progress', 'completed', 'rejected']).optional(),
    adminNotes: z.string().max(1000, t('adminNotesMaxLength1000')).optional(),
  });

  type FeatureRequestFormData = z.infer<typeof featureRequestFormSchema>;
  type EditFormData = z.infer<typeof editFormSchema>;
  
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
  const createMutation = useCreateUpdateMutation<unknown, FeatureRequestFormData & { file?: File }>({
    mutationFn: async (data) => {
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
    successTitle: t('success'),
    successMessage: t('ideaSubmittedSuccessfully'),
    errorTitle: t('error'),
    errorMessage: (error: any) => error?.message || t('failedToSubmitIdea'),
    queryKeysToInvalidate: [['/api/feature-requests']],
    onSuccessCallback: () => {
      setIsCreateDialogOpen(false);
      form.reset();
      setAttachmentText('');
      setAttachmentMode('file');
      setUploadedFiles([]); // Clear uploaded files
    },
  });

  // Update feature request mutation with file upload support  
  const updateMutation = useCreateUpdateMutation<unknown, { id: string; data: EditFormData & { file?: File } }>({
    mutationFn: async ({ id, data }) => {
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
    successTitle: t('success'),
    successMessage: t('ideaUpdatedSuccessfully'),
    errorTitle: t('error'),
    errorMessage: (error: any) => error?.message || t('failedToUpdateIdea'),
    queryKeysToInvalidate: [['/api/feature-requests']],
    onSuccessCallback: () => {
      setIsEditDialogOpen(false);
      setEditingFeatureRequest(null);
      editForm.reset();
      setEditAttachmentText('');
      setEditAttachmentMode('file');
    },
  });

  // Upvote mutation
  const upvoteMutation = useCreateUpdateMutation<unknown, string>({
    mutationFn: (id: string) => apiRequest('POST', `/api/feature-requests/${id}/upvote`),
    successTitle: t('success'),
    successMessage: t('upvoteRecorded'),
    errorTitle: t('error'),
    errorMessage: (error) => error?.message || t('failedToUpvote'),
    queryKeysToInvalidate: [['/api/feature-requests']],
  });

  // Delete mutation (admin only)
  const deleteMutation = useCreateUpdateMutation<unknown, string>({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/feature-requests/${id}`),
    successTitle: t('success'),
    successMessage: t('ideaDeletedSuccessfully'),
    errorTitle: t('error'),
    errorMessage: (error) => error?.message || t('failedToDeleteIdea'),
    queryKeysToInvalidate: [['/api/feature-requests']],
    onSuccessCallback: () => {
      setIsEditDialogOpen(false);
      setEditingFeatureRequest(null);
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
    if (window.confirm(t('confirmDeleteIdea').replace('{title}', idea.title))) {
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
          <h2 className="text-3xl font-bold tracking-tight">{t('ideaBox')}</h2>
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
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title={t('ideaBox')} subtitle={t('ideaBoxSubtitle')} />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Action and Search Section */}
          <div className="flex items-center justify-between">
            <div></div>
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-idea">
              <Plus className="mr-2 h-4 w-4" />
              {t('submitNewIdea')}
            </Button>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                {t('searchAndFilters')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('search')}</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder={t('searchIdeas')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('status')}</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger data-testid="select-status-filter">
                      <SelectValue placeholder={t('allStatuses')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('allStatuses')}</SelectItem>
                      <SelectItem value="submitted">{t('submitted')}</SelectItem>
                      <SelectItem value="under_review">{t('underReview')}</SelectItem>
                      <SelectItem value="planned">{t('planned')}</SelectItem>
                      <SelectItem value="in_progress">{t('inProgress')}</SelectItem>
                      <SelectItem value="completed">{t('completed')}</SelectItem>
                      <SelectItem value="rejected">{t('rejected')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('categoryAndSort')}</label>
                  <div className="flex gap-2">
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger data-testid="select-category-filter">
                        <SelectValue placeholder={t('allCategories')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('allCategories')}</SelectItem>
                        {['dashboard', 'property_management', 'resident_management', 'financial_management', 'maintenance', 'document_management', 'communication', 'reports', 'mobile_app', 'integrations', 'security', 'performance', 'other'].map((key) => (
                          <SelectItem key={key} value={key}>
                            {getCategoryLabel(key)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-32" data-testid="select-sort">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">{t('newest')}</SelectItem>
                        <SelectItem value="oldest">{t('oldest')}</SelectItem>
                        <SelectItem value="upvotes">{t('mostUpvotes')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category-grouped cards */}
          <div className="space-y-6">
            {['dashboard', 'property_management', 'resident_management', 'financial_management', 'maintenance', 'document_management', 'communication', 'reports', 'mobile_app', 'integrations', 'security', 'performance', 'other'].map((categoryKey) => {
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
                        {getCategoryLabel(categoryKey)}
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
                            t={t}
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
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">{t('noIdeasFound')}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                    ? t('tryAdjustingSearchOrFilters')
                    : t('getStartedBySubmittingFirstIdea')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('submitNewIdea')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t('featureTitle')} *</Label>
              <Input
                id="title"
                {...form.register('title')}
                placeholder={t('featureTitlePlaceholder')}
                data-testid="input-title"
              />
              {form.formState.errors.title && (
                <p className="text-sm text-red-600">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('description')} *</Label>
              <Textarea
                id="description"
                {...form.register('description')}
                placeholder={t('featureDescriptionPlaceholder')}
                rows={4}
                data-testid="textarea-description"
              />
              {form.formState.errors.description && (
                <p className="text-sm text-red-600">{form.formState.errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="need">{t('whyIsThisNeeded')} *</Label>
              <Textarea
                id="need"
                {...form.register('need')}
                placeholder={t('whyIsThisNeededPlaceholder')}
                rows={3}
                data-testid="textarea-need"
              />
              {form.formState.errors.need && (
                <p className="text-sm text-red-600">{form.formState.errors.need.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">{t('category')} *</Label>
                <Select value={form.watch('category')} onValueChange={(value) => form.setValue('category', value as any)}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['dashboard', 'property_management', 'resident_management', 'financial_management', 'maintenance', 'document_management', 'communication', 'reports', 'mobile_app', 'integrations', 'security', 'performance', 'other'].map((key) => (
                      <SelectItem key={key} value={key}>
                        {getCategoryLabel(key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.category && (
                  <p className="text-sm text-red-600">{form.formState.errors.category.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="page">{t('pageLocation')} *</Label>
                <Input
                  id="page"
                  {...form.register('page')}
                  placeholder={t('pageLocationPlaceholder')}
                  data-testid="input-page"
                />
                {form.formState.errors.page && (
                  <p className="text-sm text-red-600">{form.formState.errors.page.message}</p>
                )}
              </div>
            </div>

            {/* Choose Document Type Section */}
            <div className="space-y-4 border-t pt-4">
              <Label className="text-sm font-medium">{t('attachDocumentsOptional')}</Label>
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
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                {createMutation.isPending ? t('submitting') : t('submitIdea')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('editIdea')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">{t('featureTitle')} *</Label>
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
              <Label htmlFor="edit-description">{t('description')} *</Label>
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
              <Label htmlFor="edit-need">{t('whyIsThisNeeded')} *</Label>
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
                <Label htmlFor="edit-category">{t('category')} *</Label>
                <Select value={editForm.watch('category')} onValueChange={(value) => editForm.setValue('category', value as any)}>
                  <SelectTrigger data-testid="select-edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['dashboard', 'property_management', 'resident_management', 'financial_management', 'maintenance', 'document_management', 'communication', 'reports', 'mobile_app', 'integrations', 'security', 'performance', 'other'].map((key) => (
                      <SelectItem key={key} value={key}>
                        {getCategoryLabel(key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editForm.formState.errors.category && (
                  <p className="text-sm text-red-600">{editForm.formState.errors.category.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-page">{t('pageLocation')} *</Label>
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
                  <Label htmlFor="edit-status">{t('status')}</Label>
                  <Select value={editForm.watch('status')} onValueChange={(value) => editForm.setValue('status', value as any)}>
                    <SelectTrigger data-testid="select-edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="submitted">{t('submitted')}</SelectItem>
                      <SelectItem value="under_review">{t('underReview')}</SelectItem>
                      <SelectItem value="planned">{t('planned')}</SelectItem>
                      <SelectItem value="in_progress">{t('inProgress')}</SelectItem>
                      <SelectItem value="completed">{t('completed')}</SelectItem>
                      <SelectItem value="rejected">{t('rejected')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-admin-notes">{t('adminNotes')}</Label>
                  <Textarea
                    id="edit-admin-notes"
                    {...editForm.register('adminNotes')}
                    placeholder={t('internalNotesVisibleAdmins')}
                    rows={2}
                    data-testid="textarea-admin-notes"
                  />
                </div>
              </>
            )}

            {/* Choose Document Type Section for Edit */}
            <div className="space-y-4 border-t pt-4">
              <Label className="text-sm font-medium">{t('chooseDocumentType')}</Label>
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
                  📁 {t('uploadFile')}
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
                  📝 {t('textDocument')}
                </button>
              </div>

              {/* Dynamic Content Based on Selection */}
              {editAttachmentMode === 'file' ? (
                <div>
                  {editingFeatureRequest?.filePath && (
                    <div className="space-y-2 mb-4">
                      <Label>{t('currentAttachment')}</Label>
                      <AttachedFileSection
                        entityType="feature-request"
                        entityId={editingFeatureRequest.id}
                        filePath={editingFeatureRequest.filePath}
                        fileName={editingFeatureRequest.fileName}
                        fileSize={editingFeatureRequest.fileSize}
                      />
                    </div>
                  )}
                  <Label htmlFor="edit-file-upload">{t('selectFileToUpload')}</Label>
                  <Input
                    id="edit-file-upload"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                    data-testid="input-edit-file"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {editingFeatureRequest?.filePath ? t('uploadNewFileToReplace') : t('attachScreenshot')}
                  </p>
                </div>
              ) : (
                <div>
                  <Label htmlFor="edit-text-content">{t('documentContent')}</Label>
                  <Textarea
                    id="edit-text-content"
                    value={editAttachmentText}
                    onChange={(e) => setEditAttachmentText(e.target.value)}
                    rows={5}
                    className="w-full mt-1"
                    placeholder={t('addDetailedNotes')}
                    data-testid="textarea-edit-text-content"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('thisWillShowAsAdditionalNotes')}
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
                    {deleteMutation.isPending ? t('deleting') : t('deleteIdea')}
                  </Button>
                )}
              </div>
              <div className="flex space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update">
                  {updateMutation.isPending ? t('updating') : t('updateIdea')}
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
                        {t(viewingFeatureRequest.status.replace('_', '') as any)}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {t(viewingFeatureRequest.category.replace(/_/g, '') as any)}
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
                        {t('edit')}
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">{t('description')}</h4>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {viewingFeatureRequest.description}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">{t('whyIsThisNeeded')}</h4>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {viewingFeatureRequest.need}
                  </p>
                </div>
                
                {/* Show file attachment if exists */}
                {viewingFeatureRequest.filePath && (
                  <div>
                    <h4 className="font-semibold mb-2">{t('attachment')}</h4>
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
                    <h4 className="font-semibold mb-2">{t('documentContent')}</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-mono">
                        {viewingFeatureRequest.file_content}
                      </pre>
                    </div>
                  </div>
                )}
                
                {user?.role === 'admin' && viewingFeatureRequest.adminNotes && (
                  <div>
                    <h4 className="font-semibold mb-2">{t('adminNotes')}</h4>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      {viewingFeatureRequest.adminNotes}
                    </p>
                  </div>
                )}
                
                <div className="text-sm text-gray-500 pt-2 border-t">
                  <p>{t('submittedOn')} {new Date(viewingFeatureRequest.createdAt).toLocaleDateString()}</p>
                  {viewingFeatureRequest.updatedAt !== viewingFeatureRequest.createdAt && (
                    <p>{t('lastUpdatedOn')} {new Date(viewingFeatureRequest.updatedAt).toLocaleDateString()}</p>
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