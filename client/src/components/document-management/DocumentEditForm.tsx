import React, { useState } from 'react';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { StandardCard } from '@/components/ui/standard-card';
import { useStandardForm } from '@/hooks/use-standard-form';
import { StandardFormField } from '@/components/forms/StandardFormField';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Trash2, Save, X } from 'lucide-react';
import type { Document } from '@shared/schema';

// Document categories
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

// Simplified document edit schema using our standard patterns
const documentEditSchema = z.object({
  name: z.string().min(1, 'Document name is required').max(255),
  description: z.string().max(1000).optional(),
  category: z.enum(['bylaw', 'financial', 'maintenance', 'legal', 'meeting_minutes', 'insurance', 'contracts', 'permits', 'inspection', 'other']),
  isVisible: z.boolean().default(true),
  // Removed tags field as it's not supported by backend
});

type DocumentEditFormData = z.infer<typeof documentEditSchema>;

interface DocumentEditFormProps {
  document: Document;
  onSuccess?: (documentId: string, action: 'updated' | 'deleted') => void;
  onCancel?: () => void;
  buildingId?: string;
  residenceId?: string;
}

/**
 * Document Edit Form with delete functionality.
 * Uses custom form structure to support delete operations.
 */
export function DocumentEditForm({ 
  document, 
  onSuccess, 
  onCancel, 
  buildingId,
  residenceId
}: DocumentEditFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  
  const defaultValues: Partial<DocumentEditFormData> = {
    name: document.name || '',
    description: document.description || '',
    category: (document.documentType as any) || 'other',
    isVisible: document.isVisibleToTenants ?? true,
    // Removed tags field as it's not supported by backend
  };

  // Standard form controls for update functionality
  const formControls = useStandardForm({
    schema: documentEditSchema,
    defaultValues,
    apiEndpoint: `/api/documents`,
    queryKey: ['documents'],
    mode: 'edit',
    itemId: document.id,
    onSuccess: () => {
      if (onSuccess) {
        onSuccess(document.id, 'updated');
      }
    },
    successMessages: {
      update: 'Document updated successfully',
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', `/api/documents/${document.id}`);
      return response;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });
      // Comprehensive cache invalidation for all document-related queries
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return (
            queryKey.includes('documents') ||
            queryKey.includes('/api/documents') ||
            (Array.isArray(queryKey) && queryKey[0] === '/api/documents')
          );
        }
      });
      if (onSuccess) {
        onSuccess(document.id, 'deleted');
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete document',
        variant: 'destructive',
      });
    },
  });

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      setIsDeleting(true);
      try {
        await deleteMutation.mutateAsync();
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const onSubmit = (data: DocumentEditFormData) => {
    // Map form fields to server contract
    const formData = {
      name: data.name,
      description: data.description,
      documentType: data.category, // Map category -> documentType
      isVisibleToTenants: data.isVisible, // Map isVisible -> isVisibleToTenants
      buildingId,
      residenceId,
      // Removed tags field as it's not supported by backend
    };
    formControls.submitMutation.mutate(formData);
  };

  return (
    <StandardCard
      title="Edit Document"
      className="max-w-4xl mx-auto"
      data-testid="document-edit-form"
    >
      <div className="space-y-6">
        <Form {...formControls.form}>
          <form onSubmit={formControls.handleSubmit(onSubmit)} className="space-y-6">
            <StandardFormField
              control={formControls.form.control}
              name="name"
              label="Document Name"
              placeholder="Enter document name"
              data-testid="input-name"
            />

            <FormField
              control={formControls.form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-category">
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

            <FormField
              control={formControls.form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter document description (optional)"
                      data-testid="textarea-description"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Removed tags field as it's not supported by backend */}

            <FormField
              control={formControls.form.control}
              name="isVisible"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Document Visibility
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Make this document visible to relevant users
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-visibility"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-3 pt-6 border-t">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  data-testid="button-cancel"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              )}
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting || deleteMutation.isPending}
                data-testid="button-delete"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting || deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
              <Button
                type="submit"
                disabled={formControls.isSubmitting}
                data-testid="button-submit"
              >
                <Save className="w-4 h-4 mr-2" />
                {formControls.isSubmitting ? 'Updating...' : 'Update'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </StandardCard>
  );
}