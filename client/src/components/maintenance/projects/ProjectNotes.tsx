import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
import { format, formatDistanceToNow } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Separator } from '@/components/ui/separator';
import { UploadDropzone } from '@/components/maintenance/UploadDropzone';
import { useBuildingContext } from '@/hooks/use-building-context';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import {
  MessageSquare,
  Plus,
  MoreHorizontal,
  Edit2,
  Trash2,
  Paperclip,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Info,
  FileText,
  Image,
  Video,
  File,
  Clock,
  User,
  Pin,
  Filter,
  Search,
} from 'lucide-react';

export interface ProjectNotesProps {
  project: MaintenanceProject;
  className?: string;
  variant?: 'timeline' | 'compact';
  showAttachments?: boolean;
  editable?: boolean;
  onNoteClick?: (note: ProjectNote) => void;
}

interface ProjectNote {
  id: string;
  projectId: string;
  content: string;
  category: 'progress' | 'issue' | 'decision' | 'milestone' | 'general';
  isPinned: boolean;
  attachments: NoteAttachment[];
  createdBy: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface NoteAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
}

const noteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(2000, 'Note content too long'),
  category: z.enum(['progress', 'issue', 'decision', 'milestone', 'general']),
});

type NoteFormData = z.infer<typeof noteSchema>;

const noteCategories = [
  { value: 'general', label: 'General', icon: MessageSquare, color: 'text-gray-600' },
  { value: 'progress', label: 'Progress Update', icon: CheckCircle2, color: 'text-green-600' },
  { value: 'issue', label: 'Issue/Problem', icon: AlertTriangle, color: 'text-red-600' },
  { value: 'decision', label: 'Decision', icon: Info, color: 'text-blue-600' },
  { value: 'milestone', label: 'Milestone', icon: CheckCircle2, color: 'text-purple-600' },
];

/**
 * ProjectNotes component for managing project notes and communication
 * Features timeline view, categorization, attachments, and rich text editing
 */
export function ProjectNotes({
  project,
  className,
  variant = 'timeline',
  showAttachments = true,
  editable = true,
  onNoteClick,
}: ProjectNotesProps) {
  const { t } = useLanguage();
  const { hasPermission } = useBuildingContext();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State management
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  // Form setup
  const form = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      content: '',
      category: 'general',
    },
  });

  // Fetch project notes
  const {
    data: notesResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/maintenance/projects', project.id, 'notes'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/projects/${project.id}/notes`);
      return await response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  const allNotes: ProjectNote[] = notesResponse?.notes || [];

  // Filter and search notes
  const filteredNotes = useMemo(() => {
    return allNotes.filter(note => {
      // Category filter
      if (filterCategory !== 'all' && note.category !== filterCategory) {
        return false;
      }
      
      // Search filter
      if (searchQuery && !note.content.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      return true;
    }).sort((a, b) => {
      // Pinned notes first, then by creation date
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [allNotes, filterCategory, searchQuery]);

  const notesQueryKey: readonly unknown[] = ['/api/maintenance/projects', project.id, 'notes'];

  // Add note mutation
  const addNoteMutation = useCreateUpdateMutation<unknown, NoteFormData>({
    mutationFn: async (noteData: NoteFormData) => {
      const formData = new FormData();
      formData.append('content', noteData.content);
      formData.append('category', noteData.category);
      formData.append('projectId', project.id);
      
      // Add attachments
      attachments.forEach((file, index) => {
        formData.append(`attachments[${index}]`, file);
      });

      const response = await apiRequest('POST', `/api/maintenance/projects/${project.id}/notes`, formData, {
        headers: {
          // Don't set Content-Type header - let browser set it with boundary for FormData
        },
      });
      return response.json();
    },
    successTitle: 'Note Added',
    successMessage: 'Project note has been added successfully.',
    errorTitle: 'Failed to Add Note',
    errorMessage: (error: any) => error?.response?.data?.message || 'Please try again.',
    queryKeysToInvalidate: [notesQueryKey],
    onSuccessCallback: () => {
      form.reset();
      setAttachments([]);
      setIsAddingNote(false);
    },
  });

  // Update note mutation
  const updateNoteMutation = useCreateUpdateMutation<unknown, { noteId: string; data: Partial<NoteFormData> }>({
    mutationFn: async ({ noteId, data }) => {
      const response = await apiRequest('PATCH', `/api/maintenance/project-notes/${noteId}`, data);
      return response.json();
    },
    successTitle: 'Note Updated',
    successMessage: 'Note has been updated successfully.',
    errorTitle: 'Update Failed',
    errorMessage: (error: any) => error?.response?.data?.message || 'Please try again.',
    queryKeysToInvalidate: [notesQueryKey],
    onSuccessCallback: () => {
      setEditingNote(null);
      form.reset();
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useCreateUpdateMutation<unknown, string>({
    mutationFn: async (noteId: string) => {
      const response = await apiRequest('DELETE', `/api/maintenance/project-notes/${noteId}`);
      return response.json();
    },
    successTitle: 'Note Deleted',
    successMessage: 'Note has been deleted successfully.',
    errorTitle: 'Delete Failed',
    errorMessage: (error: any) => error?.response?.data?.message || 'Please try again.',
    queryKeysToInvalidate: [notesQueryKey],
    onSuccessCallback: () => {
      setNoteToDelete(null);
    },
  });

  // Pin/unpin note mutation
  const togglePinMutation = useCreateUpdateMutation<unknown, { noteId: string; isPinned: boolean }>({
    mutationFn: async ({ noteId, isPinned }) => {
      const response = await apiRequest('PATCH', `/api/maintenance/project-notes/${noteId}`, { isPinned });
      return response.json();
    },
    silentSuccess: true,
    errorTitle: 'Update Failed',
    errorMessage: 'Failed to update note pin status.',
    queryKeysToInvalidate: [notesQueryKey],
  });

  const handleSubmitNote = (data: NoteFormData) => {
    if (!hasPermission('canEditMaintenance')) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to add notes to projects.",
        variant: "destructive",
      });
      return;
    }

    if (editingNote) {
      updateNoteMutation.mutate({ noteId: editingNote, data });
    } else {
      addNoteMutation.mutate(data);
    }
  };

  const handleEditNote = (note: ProjectNote) => {
    setEditingNote(note.id);
    form.setValue('content', note.content);
    form.setValue('category', note.category);
    setIsAddingNote(true);
  };

  const handleCancelEdit = () => {
    setEditingNote(null);
    setIsAddingNote(false);
    form.reset();
    setAttachments([]);
  };

  const getCategoryConfig = (category: string) => {
    return noteCategories.find(cat => cat.value === category) || noteCategories[0];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.startsWith('video/')) return Video;
    if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to Load Notes</h3>
          {/* eslint-disable-next-line i18n/no-untranslated-jsx-strings -- pre-existing untranslated string (task #708): translate in a follow-up */}
          <p className="text-muted-foreground">
            {t('thereWasAnErrorLoadingThe2')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)} data-testid={`project-notes-${project.id}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Project Notes</CardTitle>
          
          {editable && hasPermission('canEditMaintenance') && (
            <Button 
              size="sm" 
              onClick={() => setIsAddingNote(true)}
              data-testid="add-note-button"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          )}
        </div>

        {/* Filters and Search */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48"
              data-testid="search-notes"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-40" data-testid="filter-category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {noteCategories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Badge variant="outline">
            {filteredNotes.length} notes
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Add/Edit Note Form */}
        {isAddingNote && (
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmitNote)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-note-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {noteCategories.map((category) => {
                              const IconComponent = category.icon;
                              return (
                                <SelectItem key={category.value} value={category.value}>
                                  <div className="flex items-center gap-2">
                                    <IconComponent className="h-4 w-4" />
                                    {category.label}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Note Content</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter your note..."
                            className="min-h-[120px]"
                            {...field}
                            data-testid="textarea-note-content"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {showAttachments && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Attachments</label>
                      <UploadDropzone
                        onFilesUploaded={setAttachments}
                        maxFiles={5}
                        maxSize={10 * 1024 * 1024} // 10MB
                        allowedTypes={['image/*', 'application/pdf', '.doc', '.docx', '.txt']}
                        data-testid="note-attachments-upload"
                      />
                      {attachments.length > 0 && (
                        <div className="space-y-1">
                          {attachments.map((file, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <File className="h-4 w-4" />
                              <span>{file.name}</span>
                              <span className="text-muted-foreground">
                                ({formatFileSize(file.size)})
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Button 
                      type="submit" 
                      disabled={addNoteMutation.isPending || updateNoteMutation.isPending}
                      data-testid="submit-note"
                    >
                      {editingNote 
                        ? (updateNoteMutation.isPending ? 'Updating...' : 'Update Note')
                        : (addNoteMutation.isPending ? 'Adding...' : 'Add Note')
                      }
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleCancelEdit}
                      data-testid="cancel-note"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Notes Timeline */}
        <div className="space-y-4">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4" />
              <p>{t('noNotesFoundForThisProject')}</p>
              {searchQuery || filterCategory !== 'all' ? (
                <p className="text-sm">{t('tryAdjustingYourFiltersOrSearch')}</p>
              ) : null}
            </div>
          ) : (
            filteredNotes.map((note, index) => {
              const categoryConfig = getCategoryConfig(note.category);
              const CategoryIcon = categoryConfig.icon;
              
              return (
                <div key={note.id} className="relative">
                  {/* Timeline connector */}
                  {variant === 'timeline' && index < filteredNotes.length - 1 && (
                    <div className="absolute left-4 top-12 bottom-0 w-0.5 bg-border" />
                  )}
                  
                  <div 
                    className={cn(
                      "flex gap-4 p-4 rounded-lg border transition-colors",
                      note.isPinned && "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800",
                      "hover:bg-accent cursor-pointer"
                    )}
                    onClick={() => onNoteClick?.(note)}
                    data-testid={`note-${note.id}`}
                  >
                    {/* Avatar and Icon */}
                    <div className="flex-shrink-0">
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={note.createdBy.avatar} />
                          <AvatarFallback>
                            {note.createdBy.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn(
                          "absolute -bottom-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center",
                          "bg-background border-2 border-background"
                        )}>
                          <CategoryIcon className={cn("h-3 w-3", categoryConfig.color)} />
                        </div>
                      </div>
                    </div>

                    {/* Note Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{note.createdBy.name}</span>
                          <Badge variant="outline" size="sm">
                            {categoryConfig.label}
                          </Badge>
                          {note.isPinned && (
                            <Pin className="h-3 w-3 text-yellow-600" />
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground" title={format(new Date(note.createdAt), 'PPpp')}>
                            {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                          </span>
                          
                          {editable && hasPermission('canEditMaintenance') && (user?.id === note.createdBy.id) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0"
                                  data-testid={`note-actions-${note.id}`}
                                >
                                  <MoreHorizontal className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePinMutation.mutate({ noteId: note.id, isPinned: !note.isPinned });
                                  }}
                                  data-testid={`action-pin-note-${note.id}`}
                                >
                                  <Pin className="mr-2 h-4 w-4" />
                                  {note.isPinned ? 'Unpin' : 'Pin'} Note
                                </DropdownMenuItem>
                                
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditNote(note);
                                  }}
                                  data-testid={`action-edit-note-${note.id}`}
                                >
                                  <Edit2 className="mr-2 h-4 w-4" />
                                  Edit Note
                                </DropdownMenuItem>
                                
                                <DropdownMenuSeparator />
                                
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNoteToDelete(note.id);
                                  }}
                                  className="text-red-600"
                                  data-testid={`action-delete-note-${note.id}`}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Note
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>

                      <div className="text-sm leading-relaxed whitespace-pre-wrap mb-3">
                        {note.content}
                      </div>

                      {/* Attachments */}
                      {showAttachments && note.attachments.length > 0 && (
                        <div className="space-y-2">
                          <Separator />
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Paperclip className="h-3 w-3" />
                            {note.attachments.length} attachment{note.attachments.length !== 1 ? 's' : ''}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {note.attachments.map((attachment) => {
                              const FileIcon = getFileIcon(attachment.mimeType);
                              return (
                                <div 
                                  key={attachment.id}
                                  className="flex items-center gap-2 p-2 rounded border bg-background hover:bg-accent cursor-pointer transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Download attachment logic
                                    window.open(attachment.filePath, '_blank');
                                  }}
                                  data-testid={`attachment-${attachment.id}`}
                                >
                                  <FileIcon className="h-4 w-4 text-muted-foreground" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium truncate">
                                      {attachment.fileName}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {formatFileSize(attachment.fileSize)}
                                    </div>
                                  </div>
                                  <Download className="h-3 w-3 text-muted-foreground" />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!noteToDelete} onOpenChange={() => setNoteToDelete(null)}>
          <AlertDialogContent data-testid="delete-note-confirmation">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Note</AlertDialogTitle>
              {/* eslint-disable-next-line i18n/no-untranslated-jsx-strings -- pre-existing untranslated string (task #708): translate in a follow-up */}
              <AlertDialogDescription>
                {t('areYouSureYouWantTo5')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => noteToDelete && deleteNoteMutation.mutate(noteToDelete)}
                disabled={deleteNoteMutation.isPending}
              >
                {deleteNoteMutation.isPending ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

