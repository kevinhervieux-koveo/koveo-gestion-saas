import React from 'react';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { DocumentFormBase } from '@/components/forms/DocumentFormBase';
import { StandardFormField } from '@/components/forms/StandardFormField';
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
  tags: z.string().optional(),
});

type DocumentEditFormData = z.infer<typeof documentEditSchema>;

interface DocumentEditFormProps {
  document: Document;
  onSuccess?: (documentId: string, action: 'updated') => void;
  onCancel?: () => void;
  buildingId?: string;
  residenceId?: string;
}

/**
 * Document Edit Form using the new consolidated DocumentFormBase pattern.
 * Demonstrates Phase 3 migration to standardized components.
 */
export function DocumentEditForm({ 
  document, 
  onSuccess, 
  onCancel, 
  buildingId,
  residenceId
}: DocumentEditFormProps) {
  
  const defaultValues: Partial<DocumentEditFormData> = {
    name: document.name || '',
    description: document.description || '',
    category: (document.documentType as any) || 'other',
    isVisible: document.isVisibleToTenants ?? true,
    tags: '', // documents don't have tags in current schema
  };

  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess(document.id, 'updated');
    }
  };

  return (
    <DocumentFormBase
      title="Edit Document"
      schema={documentEditSchema}
      defaultValues={defaultValues}
      apiEndpoint={`/api/documents/${document.id}`}
      queryKey={['documents']}
      mode="edit"
      itemId={document.id}
      buildingId={buildingId}
      residenceId={residenceId}
      onSuccess={handleSuccess}
      onCancel={onCancel}
      successMessages={{
        update: 'Document updated successfully',
      }}
      uploadContext={{
        type: 'documents',
        buildingId,
        residenceId,
      }}
      showTabs={false}
      data-testid="document-edit-form"
    >
      {(formControls) => (
        <>
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

          <FormField
            control={formControls.form.control}
            name="tags"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tags</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Enter tags separated by commas"
                    data-testid="input-tags"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
        </>
      )}
    </DocumentFormBase>
  );
}