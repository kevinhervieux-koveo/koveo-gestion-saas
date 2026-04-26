import React, { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { TagPicker, type DocumentTag } from '@/components/document-tags/TagPicker';
import { Label } from '@/components/ui/label';
import { suggestTagIds } from '@/lib/tag-suggestions';

// MIME types the server-side AI tag suggestion path can classify. Mirrors the
// allowlist on the server (`ConsolidatedAIService.TAG_SUGGESTION_SUPPORTED_MIME_TYPES`)
// and the create dialog. Office/text formats also work, but the cheap text
// extractor handles them already — keeping this list to PDFs and images limits
// the edit-time AI calls to the cases the text endpoint can't handle on its
// own.
const AI_EDIT_SUGGEST_PDF_AND_IMAGE_MIMES: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

type DocumentEditAiTagResponse = {
  success: boolean;
  tagIds: string[];
  source?: 'ai' | 'unavailable' | 'unsupported_mime' | 'no_file';
  cached?: boolean;
  error?: string;
};

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
  const initialTagIds: string[] = ((document as any).tags || []).map((t: any) => t.id);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initialTagIds);

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
    effectiveDate: (() => {
      const ed: any = document.effectiveDate;
      if (!ed) return '';
      // Use the UTC date portion: timestamps from the API arrive UTC-midnight
      // for date-only values, so toISOString() preserves the intended day.
      if (typeof ed === 'string') return ed.slice(0, 10);
      const d = ed instanceof Date ? ed : new Date(ed);
      return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    })(),
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

  // Fetch all available tags so we can compute suggestions for the existing document.
  const { data: tagsData } = useQuery<{ tags: DocumentTag[] }>({
    queryKey: ['/api/document-tags'],
  });
  const allTags = tagsData?.tags ?? [];

  // Pull the document's extracted text content so suggestions on edit can
  // mirror the higher-quality matches we get on create. The endpoint
  // gracefully returns an empty string for file types it can't extract
  // (PDF, images, etc.), in which case we fall back to filename + category
  // scoring exactly like before.
  const { data: textData } = useQuery<{
    text: string;
    hasText: boolean;
    mimeType: string | null;
    reason?: string;
  }>({
    queryKey: ['/api/documents', document.id, 'text'],
  });
  const extractedText = textData?.text ?? null;

  const watchedCategory = formControls.form.watch('category');
  const tagScope: 'building' | 'residence' | undefined = buildingId
    ? 'building'
    : residenceId
      ? 'residence'
      : undefined;

  // Heuristic suggestion fallback (filename + extracted text + category).
  // Used whenever AI is unavailable, hasn't run yet, or the file type isn't
  // one Gemini can classify.
  const heuristicSuggestions = useMemo(() => {
    if (allTags.length === 0) return [];
    return suggestTagIds({
      tags: allTags,
      fileName: document.name ?? null,
      extractedText,
      category: watchedCategory,
      scope: tagScope,
      max: 3,
    });
  }, [allTags, document.name, extractedText, watchedCategory, tagScope]);

  // For PDFs and images the cheap text endpoint returns nothing, so mirror the
  // create dialog and ask the server-side Gemini path to classify the existing
  // file. Repeat edits hit the shared, database-backed cache so we don't burn
  // quota. Falls back silently to the heuristic scorer when AI is unavailable.
  const documentMime = (document as any).mimeType as string | undefined;
  const isAiSupportedFile =
    !!documentMime && AI_EDIT_SUGGEST_PDF_AND_IMAGE_MIMES.has(documentMime);

  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiResponded, setAiResponded] = useState(false);
  const [isFetchingAiTags, setIsFetchingAiTags] = useState(false);

  useEffect(() => {
    setAiSuggestions([]);
    setAiResponded(false);
    if (!isAiSupportedFile || allTags.length === 0) return;

    const tagsForRequest = allTags
      .filter((t) => (tagScope ? t.scope === tagScope || t.scope === 'any' : true))
      .map((t) => ({ id: t.id, name: t.name, description: t.description ?? null }));
    if (tagsForRequest.length === 0) return;

    const controller = new AbortController();
    setIsFetchingAiTags(true);

    (async () => {
      try {
        // apiRequest throws on non-2xx, so a denied/missing response naturally
        // falls through to the keyword scorer.
        const response = await apiRequest(
          'POST',
          `/api/documents/${document.id}/suggest-tags`,
          {
            tags: tagsForRequest,
            scope: tagScope,
            category: watchedCategory,
            max: 3,
          },
        );
        if (controller.signal.aborted) return;
        const data = (await response.json()) as DocumentEditAiTagResponse;
        if (!data || !Array.isArray(data.tagIds)) return;
        // Only treat AI-sourced answers as authoritative. Other sources
        // (`unsupported_mime`, `unavailable`, `no_file`) leave the heuristic
        // suggestions in place.
        if (data.source !== 'ai') return;
        setAiResponded(true);
        setAiSuggestions(
          data.tagIds.filter((x): x is string => typeof x === 'string'),
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Silent fallback — heuristic suggestions remain in effect.
      } finally {
        if (!controller.signal.aborted) setIsFetchingAiTags(false);
      }
    })();

    return () => controller.abort();
  }, [document.id, isAiSupportedFile, allTags, tagScope, watchedCategory]);

  // Prefer AI-derived suggestions whenever Gemini actually answered (an empty
  // array is a meaningful "no tag applies"). Otherwise fall back to the
  // keyword scorer so legacy text/Office documents — and any case where AI is
  // unavailable — still get useful hints.
  const suggestedTags = aiResponded ? aiSuggestions : heuristicSuggestions;

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

  const syncTags = async () => {
    const before = new Set(initialTagIds);
    const after = new Set(selectedTagIds);
    const toAdd = selectedTagIds.filter((id) => !before.has(id));
    const toRemove = initialTagIds.filter((id) => !after.has(id));
    try {
      await Promise.all([
        ...toAdd.map((tagId) => apiRequest('POST', `/api/documents/${document.id}/tags`, { tagId })),
        ...toRemove.map((tagId) => apiRequest('DELETE', `/api/documents/${document.id}/tags/${tagId}`)),
      ]);
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    } catch (e) {
      // Non-fatal
    }
  };

  const onSubmit = async (data: DocumentEditFormData) => {
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
    };
    await syncTags();
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Étiquettes</Label>
                {isFetchingAiTags && (
                  <span
                    className="text-xs text-muted-foreground flex items-center gap-1"
                    data-testid="text-ai-tag-suggestion-loading"
                  >
                    <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></span>
                    Analyse IA du document...
                  </span>
                )}
              </div>
              <TagPicker
                value={selectedTagIds}
                onChange={setSelectedTagIds}
                scope={tagScope}
                suggestedTagIds={suggestedTags}
              />
            </div>

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