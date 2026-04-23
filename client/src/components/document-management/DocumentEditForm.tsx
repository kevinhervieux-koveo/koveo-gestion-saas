import React, { useState } from 'react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
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
import { useLanguage } from '@/hooks/use-language';
import { apiRequest } from '@/lib/queryClient';
import { Trash2, Save, X, Lock, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Document } from '@shared/schema';

type DocumentEditFormData = {
  name: string;
  description?: string;
  category: 'bylaw' | 'financial' | 'maintenance' | 'legal' | 'meeting_minutes' | 'insurance' | 'contracts' | 'permits' | 'inspection' | 'other';
  effectiveDate?: string;
  isVisible: boolean;
  isManagerOnly: boolean;
};

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
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  // Document categories with translations
  const DOCUMENT_CATEGORIES = [
    { value: 'bylaw', label: t('categoryBylaws') },
    { value: 'financial', label: t('categoryFinancial') },
    { value: 'maintenance', label: t('categoryMaintenance') },
    { value: 'legal', label: t('categoryLegal') },
    { value: 'meeting_minutes', label: t('categoryMeetingMinutes') },
    { value: 'insurance', label: t('categoryInsurance') },
    { value: 'contracts', label: t('categoryContracts') },
    { value: 'permits', label: t('categoryPermits') },
    { value: 'inspection', label: t('categoryInspection') },
    { value: 'other', label: t('categoryOther') },
  ];

  // Simplified document edit schema using our standard patterns with translated validation messages
  const documentEditSchema = z.object({
    name: z.string().min(1, t('documentNameRequired')).max(255, t('documentNameTooLong')),
    description: z.string().max(1000, t('documentDescriptionTooLong')).optional(),
    category: z.enum(['bylaw', 'financial', 'maintenance', 'legal', 'meeting_minutes', 'insurance', 'contracts', 'permits', 'inspection', 'other']),
    effectiveDate: z.string().optional(),
    isVisible: z.boolean().default(true),
    isManagerOnly: z.boolean().default(false),
    // Removed tags field as it's not supported by backend
  });
  
  const defaultValues: Partial<DocumentEditFormData> = {
    name: document.name || '',
    description: document.description || '',
    category: (document.documentType as any) || 'other',
    effectiveDate: document.effectiveDate ? new Date(document.effectiveDate).toISOString().split('T')[0] : '',
    isVisible: document.isVisibleToTenants ?? true,
    isManagerOnly: document.isManagerOnly ?? false,
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
      update: t('documentUpdatedSuccessfully'),
    },
  });

  // Delete mutation
  const deleteMutation = useCreateUpdateMutation<unknown, void>({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', `/api/documents/${document.id}`);
      return response;
    },
    successTitle: t('success'),
    successMessage: t('documentDeletedSuccessfully'),
    errorTitle: t('error'),
    errorMessage: (error) => error?.message || t('failedToDeleteDocument'),
    invalidateQueries: (_data, qc) => {
      // Comprehensive cache invalidation for all document-related queries
      qc.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return (
            queryKey.includes('documents') ||
            queryKey.includes('/api/documents') ||
            (Array.isArray(queryKey) && queryKey[0] === '/api/documents')
          );
        }
      });
    },
    onSuccessCallback: () => {
      if (onSuccess) {
        onSuccess(document.id, 'deleted');
      }
    },
  });

  const handleDelete = async () => {
    if (window.confirm(t('confirmDeleteDocument'))) {
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
      effectiveDate: data.effectiveDate && data.effectiveDate.trim() !== '' ? data.effectiveDate : undefined,
      isVisibleToTenants: data.isVisible, // Map isVisible -> isVisibleToTenants
      isManagerOnly: data.isManagerOnly,
      buildingId,
      residenceId,
      // Removed tags field as it's not supported by backend
    };
    formControls.submitMutation.mutate(formData);
  };

  return (
    <StandardCard
      title={t('editDocument')}
      className="max-w-4xl mx-auto"
      data-testid="document-edit-form"
    >
      <div className="space-y-6">
        <Form {...formControls.form}>
          <form onSubmit={formControls.handleSubmit(onSubmit)} className="space-y-6">
            <StandardFormField
              control={formControls.form.control}
              name="name"
              label={t('documentName')}
              placeholder={t('enterDocumentName')}
              data-testid="input-name"
            />

            <FormField
              control={formControls.form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('category')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder={t('selectCategory')} />
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
                  <FormLabel>{t('description')}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={t('enterDocumentDescription')}
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
              name="effectiveDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('effectiveDate')} ({t('optional')})</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value || ''}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                      }}
                      data-testid="input-effective-date"
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
                      {t('documentVisibility')}
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">
                      {t('documentVisibilityDescription')}
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

            <FormField
              control={formControls.form.control}
              name="isManagerOnly"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      {t('managerOnly')}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info
                              className="w-4 h-4 text-muted-foreground cursor-help"
                              data-testid="tooltip-manager-only"
                            />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {t('managerOnlyDescription')}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">
                      {t('managerOnlyDescription')}
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-manager-only"
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
                  {t('cancel')}
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
                {isDeleting || deleteMutation.isPending ? t('deletingDocument') : t('delete')}
              </Button>
              <Button
                type="submit"
                disabled={formControls.isSubmitting}
                data-testid="button-submit"
              >
                <Save className="w-4 h-4 mr-2" />
                {formControls.isSubmitting ? t('updatingDocument') : t('update')}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </StandardCard>
  );
}