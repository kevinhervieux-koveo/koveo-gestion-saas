import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Upload, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { SharedUploader } from './SharedUploader';
import type { Document } from '@shared/schema';
import type { UploadContext } from '@shared/config/upload-config';

// Document categories matching the ones used in DocumentCreateForm
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

// Form schema for document editing
const documentEditSchema = z.object({
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
  isVisibleToTenants: z.boolean().optional(),
});

type DocumentEditData = z.infer<typeof documentEditSchema>;

interface DocumentEditFormProps {
  document: Document;
  onSuccess: () => void;
  onCancel: () => void;
}

export function DocumentEditForm({
  document,
  onSuccess,
  onCancel,
}: DocumentEditFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for file replacement
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isReplaceFile, setIsReplaceFile] = useState(false);

  // Upload context for secure storage
  const uploadContext: UploadContext = {
    type: document.buildingId ? 'buildings' : 'residences',
    buildingId: document.buildingId || undefined,
    residenceId: document.residenceId || undefined,
    userRole: 'admin', // This would be dynamic based on current user
    userId: 'current-user' // This would be dynamic based on current user
  };

  // Form setup with existing document data
  const form = useForm<DocumentEditData>({
    resolver: zodResolver(documentEditSchema),
    defaultValues: {
      name: document.name || '',
      description: document.description || '',
      category: (document.documentType as any) || document.category || 'other',
      isVisibleToTenants: document.isVisibleToTenants || false,
    }
  });

  // Update document mutation
  const updateDocumentMutation = useMutation({
    mutationFn: async (data: DocumentEditData) => {
      const formData = new FormData();
      
      // Add document metadata
      formData.append('name', data.name);
      formData.append('documentType', data.category);
      if (data.description) {
        formData.append('description', data.description);
      }
      formData.append('isVisibleToTenants', data.isVisibleToTenants ? 'true' : 'false');
      
      // Add entity associations
      if (document.buildingId) {
        formData.append('buildingId', document.buildingId);
      }
      if (document.residenceId) {
        formData.append('residenceId', document.residenceId);
      }

      // Add file if replacing
      if (isReplaceFile && selectedFile) {
        formData.append('file', selectedFile);
      } else if (isReplaceFile && textContent) {
        // Handle text content creation
        const textBlob = new Blob([textContent], { type: 'text/plain' });
        const textFile = new File([textBlob], `${data.name}.txt`, { type: 'text/plain' });
        formData.append('file', textFile);
      }
      
      const response = await apiRequest('PUT', `/api/documents/${document.id}`, {
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || 'Failed to update document');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Document updated',
        description: 'The document has been successfully updated.',
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents', document.id] });
      
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update document. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: DocumentEditData) => {
    updateDocumentMutation.mutate(data);
  };

  const handleFileUpload = (file: File | null, textContent: string | null) => {
    setSelectedFile(file);
    setTextContent(textContent);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Edit Document</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          data-testid="button-cancel-edit"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Document Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Document Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Document Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter document name"
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
                          <SelectValue placeholder="Select a category" />
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

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter document description (optional)"
                        className="resize-none"
                        rows={3}
                        {...field}
                        data-testid="input-document-description"
                      />
                    </FormControl>
                    <FormDescription>
                      Provide additional details about this document
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Visibility to Tenants */}
              <FormField
                control={form.control}
                name="isVisibleToTenants"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Visible to Tenants</FormLabel>
                      <FormDescription>
                        Allow tenants to view and download this document
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value || false}
                        onCheckedChange={field.onChange}
                        data-testid="switch-visible-to-tenants"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* File Management Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">File Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current File Info */}
              {document.filePath && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Current File</p>
                      <p className="text-xs text-gray-600">
                        {(document as any).fileName || document.name}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Replace File Option */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="replace-file"
                  checked={isReplaceFile}
                  onChange={(e) => setIsReplaceFile(e.target.checked)}
                  className="rounded"
                  data-testid="checkbox-replace-file"
                />
                <Label htmlFor="replace-file">Replace file</Label>
              </div>

              {/* File Upload (only if replacing) */}
              {isReplaceFile && (
                <div>
                  <SharedUploader
                    context={uploadContext}
                    onFileSelect={handleFileUpload}
                    maxFiles={1}
                    data-testid="uploader-replace-file"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={updateDocumentMutation.isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateDocumentMutation.isPending}
              data-testid="button-save-document"
            >
              {updateDocumentMutation.isPending ? (
                <>
                  <Upload className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}