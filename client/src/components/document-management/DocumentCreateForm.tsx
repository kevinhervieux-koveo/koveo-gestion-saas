import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SharedUploader } from './SharedUploader';
import type { UploadContext } from '@shared/config/upload-config';

// Document categories matching the ones used in ModularDocumentPageWrapper
const DOCUMENT_CATEGORIES = [
  { value: 'bylaw', label: 'Bylaws' },
  { value: 'financial', label: 'Financial' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'legal', label: 'Legal' },
  { value: 'meeting_minutes', label: 'Meeting Minutes' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'contracts', label: 'Contracts' },
  { value: 'permits', label: 'Permits' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
];

// Form schema for document creation
const documentCreateSchema = z.object({
  name: z.string().min(1, 'Document name is required').max(255, 'Name must be less than 255 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  category: z.enum([
    'bylaw',
    'financial', 
    'maintenance',
    'legal',
    'meeting_minutes',
    'insurance',
    'contracts',
    'permits',
    'inspection',
    'other'
  ]),
});

type DocumentCreateData = z.infer<typeof documentCreateSchema>;

interface DocumentCreateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (documentId: string) => void;
  entityType: 'building' | 'residence';
  entityId: string;
  entityName?: string;
}

export function DocumentCreateForm({
  isOpen,
  onClose,
  onSuccess,
  entityType,
  entityId,
  entityName,
}: DocumentCreateFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for file upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  // Upload context for secure storage
  const uploadContext: UploadContext = {
    type: entityType === 'building' ? 'buildings' : 'residences',
    buildingId: entityType === 'building' ? entityId : undefined,
    residenceId: entityType === 'residence' ? entityId : undefined,
    userRole: 'admin', // This would be dynamic based on current user
    userId: 'current-user' // This would be dynamic based on current user
  };

  // Form setup
  const form = useForm<DocumentCreateData>({
    resolver: zodResolver(documentCreateSchema),
    defaultValues: {
      name: '',
      description: '',
      category: 'other',
    }
  });

  // Create document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (data: DocumentCreateData) => {
      const formData = new FormData();
      
      // Add document metadata
      formData.append('name', data.name);
      formData.append('documentType', data.category);
      if (data.description) {
        formData.append('description', data.description);
      }
      
      // Add entity association
      if (entityType === 'building') {
        formData.append('buildingId', entityId);
      } else {
        formData.append('residenceId', entityId);
      }

      // Add file or text content
      if (selectedFile) {
        formData.append('file', selectedFile);
      } else if (textContent) {
        formData.append('textContent', textContent);
      }

      // Make the API request
      const response = await fetch('/api/documents', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData = {};
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          console.error('Failed to parse error response as JSON');
        }
        
        throw new Error(errorData.error || errorData.message || `Failed to create document: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate documents cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      
      toast({
        title: 'Document Created',
        description: `"${data.name}" has been created successfully`,
      });
      
      // Reset form and close dialog
      form.reset();
      setSelectedFile(null);
      setTextContent(null);
      onClose();
      onSuccess?.(data.id);
    },
    onError: (error: any) => {
      toast({
        title: 'Error Creating Document',
        description: error.message || 'Failed to create document',
        variant: 'destructive',
      });
    }
  });

  // Handle file/text changes from SharedUploader
  const handleDocumentChange = (file: File | null, text: string | null) => {
    setSelectedFile(file);
    setTextContent(text);
    
    // Auto-populate name if file was uploaded and name is empty
    if (file && !form.getValues('name')) {
      const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, '');
      form.setValue('name', nameWithoutExtension);
    }
  };

  const onSubmit = (data: DocumentCreateData) => {
    // Validate that we have either a file or text content
    if (!selectedFile && !textContent) {
      toast({
        title: 'Missing Content',
        description: 'Please either upload a file or enter text content for the document.',
        variant: 'destructive',
      });
      return;
    }
    
    createDocumentMutation.mutate(data);
  };

  const handleClose = () => {
    if (!createDocumentMutation.isPending) {
      form.reset();
      setSelectedFile(null);
      setTextContent(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Create New Document
          </DialogTitle>
          <DialogDescription>
            Create a new document for {entityName || `this ${entityType}`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Document Information Section */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Document Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Building Bylaws 2024"
                          {...field}
                          data-testid="input-document-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Category */}
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-document-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DOCUMENT_CATEGORIES.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the document content and purpose..."
                        className="min-h-[80px]"
                        {...field}
                        data-testid="textarea-document-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* File Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Document Content
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SharedUploader
                  onDocumentChange={handleDocumentChange}
                  formType="documents"
                  uploadContext={uploadContext}
                  showAiToggle={false} // Use config-based AI enablement
                  allowedFileTypes={[
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'text/plain',
                    'image/*'
                  ]}
                  maxFileSize={25}
                  defaultTab="file"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Upload a file or create a text document. Maximum file size: 25MB.
                </p>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={createDocumentMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createDocumentMutation.isPending}
                data-testid="button-create-document"
              >
                {createDocumentMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Create Document
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}