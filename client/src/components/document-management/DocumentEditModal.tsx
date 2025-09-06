import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Save, Trash2, X, AlertCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { SharedUploader } from './SharedUploader';

// Document categories for validation
const DOCUMENT_CATEGORIES = [
  'bylaw',
  'financial',
  'maintenance',
  'legal',
  'meeting_minutes',
  'insurance',
  'contracts',
  'permits',
  'inspection',
  'lease',
  'correspondence',
  'utilities',
  'other',
] as const;

// Validation schema for document editing
const documentEditSchema = z.object({
  name: z.string()
    .min(1, 'Document name is required')
    .max(255, 'Document name must be less than 255 characters'),
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
  documentType: z.enum(DOCUMENT_CATEGORIES, {
    required_error: 'Please select a document type',
  }),
  isVisibleToTenants: z.boolean().default(false),
  // Optional entity associations
  buildingId: z.string().uuid().optional(),
  residenceId: z.string().uuid().optional(),
});

type DocumentEditFormData = z.infer<typeof documentEditSchema>;

interface DocumentEditModalProps {
  documentId?: string; // undefined for create mode
  entityType?: 'building' | 'residence' | 'general';
  entityId?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (documentId: string, action: 'created' | 'updated' | 'deleted') => void;
  className?: string;
}

interface DocumentData {
  id: string;
  name: string;
  description?: string;
  documentType: string;
  isVisibleToTenants?: boolean;
  buildingId?: string;
  residenceId?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * DocumentEditModal - Modal for creating, editing, and deleting documents
 * Features React Hook Form, Zod validation, and secure CRUD operations
 */
export function DocumentEditModal({
  documentId,
  entityType = 'general',
  entityId,
  isOpen,
  onOpenChange,
  onSuccess,
  className
}: DocumentEditModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  const isEditMode = !!documentId;
  const isCreateMode = !documentId;

  // Form setup with validation
  const form = useForm<DocumentEditFormData>({
    resolver: zodResolver(documentEditSchema),
    defaultValues: {
      name: '',
      description: '',
      documentType: 'other',
      isVisibleToTenants: false,
      buildingId: entityType === 'building' ? entityId : undefined,
      residenceId: entityType === 'residence' ? entityId : undefined,
    },
  });

  // Fetch existing document data for edit mode
  const { data: document, isLoading: isLoadingDocument } = useQuery<DocumentData>({
    queryKey: ['/api/documents', documentId],
    enabled: isEditMode && isOpen && !!documentId,
    retry: 2,
  });

  // Update form when document data is loaded
  useEffect(() => {
    if (document && isEditMode) {
      form.reset({
        name: document.name,
        description: document.description || '',
        documentType: document.documentType as any,
        isVisibleToTenants: document.isVisibleToTenants || false,
        buildingId: document.buildingId,
        residenceId: document.residenceId,
      });
    }
  }, [document, isEditMode, form]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setUploadedFile(null);
      setTextContent(null);
      setIsDeleting(false);
    }
  }, [isOpen, form]);

  // Create/Update mutation
  const createUpdateMutation = useMutation({
    mutationFn: async (data: DocumentEditFormData) => {
      if (isCreateMode) {
        // Create new document
        if (uploadedFile) {
          // Create with file upload
          const formData = new FormData();
          formData.append('file', uploadedFile);
          formData.append('name', data.name);
          formData.append('description', data.description || '');
          formData.append('documentType', data.documentType);
          formData.append('isVisibleToTenants', data.isVisibleToTenants.toString());
          
          if (data.buildingId) formData.append('buildingId', data.buildingId);
          if (data.residenceId) formData.append('residenceId', data.residenceId);

          const response = await fetch('/api/documents/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include',
          });

          if (!response.ok) {
            throw new Error('Failed to upload document');
          }

          return response.json();
        } else if (textContent) {
          // Create text-only document
          return apiRequest('POST', '/api/documents', {
            ...data,
            textContent,
          });
        } else {
          throw new Error('Please provide either a file or text content');
        }
      } else {
        // Update existing document
        return apiRequest('PUT', `/api/documents/${documentId}`, data);
      }
    },
    onSuccess: (result) => {
      toast({
        title: 'Success',
        description: isCreateMode 
          ? 'Document created successfully'
          : 'Document updated successfully',
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      if (documentId) {
        queryClient.invalidateQueries({ queryKey: ['/api/documents', documentId] });
      }
      
      onSuccess?.(result.id || documentId, isCreateMode ? 'created' : 'updated');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || `Failed to ${isCreateMode ? 'create' : 'update'} document`,
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!documentId) throw new Error('No document ID provided');
      return apiRequest('DELETE', `/api/documents/${documentId}`);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      onSuccess?.(documentId!, 'deleted');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete document',
        variant: 'destructive',
      });
    },
  });

  // Handle form submission
  const handleSubmit = (data: DocumentEditFormData) => {
    createUpdateMutation.mutate(data);
  };

  // Handle delete with confirmation
  const handleDelete = async () => {
    if (!isDeleting) {
      setIsDeleting(true);
      return;
    }
    
    deleteMutation.mutate();
  };

  // Handle file/text changes from SharedUploader
  const handleDocumentChange = (file: File | null, text: string | null) => {
    setUploadedFile(file);
    setTextContent(text);
  };

  // Get document type options with labels
  const getDocumentTypeOptions = () => {
    const labels: Record<string, string> = {
      'bylaw': 'Bylaw',
      'financial': 'Financial Document',
      'maintenance': 'Maintenance Record',
      'legal': 'Legal Document',
      'meeting_minutes': 'Meeting Minutes',
      'insurance': 'Insurance Document',
      'contracts': 'Contract',
      'permits': 'Permit',
      'inspection': 'Inspection Report',
      'lease': 'Lease Document',
      'correspondence': 'Correspondence',
      'utilities': 'Utilities Document',
      'other': 'Other Document'
    };
    
    return DOCUMENT_CATEGORIES.map(category => ({
      value: category,
      label: labels[category] || category
    }));
  };

  const isSubmitting = createUpdateMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-2xl max-h-[95vh] overflow-y-auto", className)}>
        <DialogHeader>
          <DialogTitle>
            {isCreateMode ? 'Create New Document' : 'Edit Document'}
          </DialogTitle>
          <DialogDescription>
            {isCreateMode 
              ? 'Add a new document with file or text content'
              : 'Modify document details and metadata'
            }
          </DialogDescription>
        </DialogHeader>

        {isLoadingDocument && isEditMode && (
          <div className="flex items-center space-x-2 p-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading document details...</span>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter document name..."
                        data-testid="input-document-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Optional description..."
                        rows={3}
                        data-testid="textarea-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="documentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-document-type">
                          <SelectValue placeholder="Select document type..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getDocumentTypeOptions().map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isVisibleToTenants"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Tenant Visibility</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Allow tenants to view this document
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-visible-to-tenants"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* File Upload Section - Only show for create mode */}
            {isCreateMode && (
              <div className="space-y-2">
                <FormLabel>Document Content</FormLabel>
                <SharedUploader
                  onDocumentChange={handleDocumentChange}
                  allowedFileTypes={[
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'image/jpeg',
                    'image/png'
                  ]}
                  maxFileSize={25}
                  disabled={isSubmitting}
                />
                {!uploadedFile && !textContent && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    ⚠️ Please provide either a file upload or text content
                  </p>
                )}
              </div>
            )}

            {/* Error display */}
            {(createUpdateMutation.error || deleteMutation.error) && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {createUpdateMutation.error?.message || deleteMutation.error?.message}
                </AlertDescription>
              </Alert>
            )}

            {/* Action buttons */}
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <div className="flex flex-1 gap-2">
                {isEditMode && (
                  <Button
                    type="button"
                    variant={isDeleting ? "destructive" : "outline"}
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    data-testid="button-delete"
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    {isDeleting ? 'Confirm Delete' : 'Delete'}
                  </Button>
                )}
                
                {isDeleting && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDeleting(false)}
                    disabled={isSubmitting}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                
                <Button
                  type="submit"
                  disabled={isSubmitting || (isCreateMode && !uploadedFile && !textContent)}
                  data-testid="button-save"
                >
                  {createUpdateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {isCreateMode ? 'Create Document' : 'Save Changes'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}