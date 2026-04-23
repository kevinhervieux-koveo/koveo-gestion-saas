import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StandardFormGrid } from '@/components/common/StandardFormGrid';
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
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FileText, Upload, Info, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
import { SharedUploader } from './SharedUploader';
import type { UploadContext } from '@shared/config/upload-config';
import { TagPicker, type DocumentTag } from '@/components/document-tags/TagPicker';
import { suggestTagIds } from '@/lib/tag-suggestions';
import { apiRequest, queryClient } from '@/lib/queryClient';

// MIME types supported by the AI tag suggestion endpoint. Mirrors the
// server-side allowlist in `consolidated-ai-service.ts` (PDF + images sent
// inline; Office files are converted to text server-side before being sent
// to Gemini).
const AI_TAG_SUGGEST_SUPPORTED_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

type AiTagSuggestionResponse = {
  success: boolean;
  tagIds: string[];
  source?: 'ai' | 'unavailable';
  error?: string;
};

type DocumentCreateData = {
  name: string;
  description?: string;
  category: 'bylaw' | 'financial' | 'maintenance' | 'legal' | 'meeting_minutes' | 'insurance' | 'contracts' | 'permits' | 'inspection' | 'other';
  effectiveDate?: string;
  isManagerOnly: boolean;
};

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
  const { t, language } = useLanguage();

  // State for file upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const userEditedTagsRef = useRef(false);

  // Fetch tags for suggestion scoring (cached and shared with TagPicker).
  const { data: tagsData } = useQuery<{ tags: DocumentTag[] }>({
    queryKey: ['/api/document-tags'],
  });
  const allTags = tagsData?.tags ?? [];

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

  // Form schema for document creation with translated validation messages
  const documentCreateSchema = z.object({
    name: z.string().min(1, t('documentNameRequired')).max(255, t('documentNameTooLong')),
    description: z.string().max(1000, t('documentDescriptionTooLong')).optional(),
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
    effectiveDate: z.string().optional(),
    isManagerOnly: z.boolean(),
  });

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
      effectiveDate: '',
      isManagerOnly: false,
    }
  });

  // Compute heuristic suggestions (file name + typed text + category) as a
  // fallback for when AI isn't available or the file hasn't been analyzed yet.
  const watchedCategory = form.watch('category');
  const heuristicSuggestions = useMemo(() => {
    if (allTags.length === 0) return [];
    return suggestTagIds({
      tags: allTags,
      fileName: selectedFile?.name ?? null,
      extractedText: textContent,
      category: watchedCategory,
      scope: entityType,
      max: 3,
    });
  }, [allTags, selectedFile, textContent, watchedCategory, entityType]);

  // AI-derived tag suggestions for the currently uploaded file. Tracks both the
  // suggested IDs and whether the AI actually answered, so an explicit
  // "AI found nothing" result suppresses the keyword fallback (keyword-scored
  // tags should only appear when AI is unavailable or hasn't run).
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiResponded, setAiResponded] = useState(false);
  const [isFetchingAiTags, setIsFetchingAiTags] = useState(false);

  // When a file is uploaded, ask the server to classify it against the tag list.
  // Falls back silently to the keyword scorer if AI is unavailable.
  useEffect(() => {
    setAiSuggestions([]);
    setAiResponded(false);
    if (!selectedFile || allTags.length === 0) {
      return;
    }
    if (!AI_TAG_SUGGEST_SUPPORTED_MIME_TYPES.has(selectedFile.type)) {
      return;
    }

    const controller = new AbortController();
    const fileSnapshot = selectedFile;
    const tagsForRequest = allTags
      .filter((t) => t.scope === entityType || t.scope === 'any')
      .map((t) => ({ id: t.id, name: t.name, description: t.description }));
    if (tagsForRequest.length === 0) return;

    const formData = new FormData();
    formData.append('document', fileSnapshot);
    formData.append('tags', JSON.stringify(tagsForRequest));
    formData.append('scope', entityType);
    if (watchedCategory) formData.append('category', watchedCategory);
    formData.append('max', '3');

    setIsFetchingAiTags(true);
    fetch('/api/ai/suggest-document-tags', {
      method: 'POST',
      credentials: 'include',
      body: formData,
      signal: controller.signal,
    })
      .then(async (res): Promise<AiTagSuggestionResponse | null> => {
        if (!res.ok) return null;
        return res.json() as Promise<AiTagSuggestionResponse>;
      })
      .then((data) => {
        if (!data || !Array.isArray(data.tagIds)) return;
        if (data.source !== 'ai') return; // 'unavailable' -> keyword fallback
        setAiResponded(true);
        setAiSuggestions(
          data.tagIds.filter((x: unknown): x is string => typeof x === 'string')
        );
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Silent fallback - heuristic suggestions remain in effect
      })
      .finally(() => setIsFetchingAiTags(false));

    return () => controller.abort();
  }, [selectedFile, allTags, entityType, watchedCategory]);

  // Prefer AI-derived suggestions whenever the AI actually answered (even when
  // it returned an empty array - that's an explicit "no tag applies"). Only
  // fall back to the keyword scorer when AI is unavailable, errored out, or
  // hasn't been consulted (no file / unsupported MIME type).
  const suggestedTags = aiResponded ? aiSuggestions : heuristicSuggestions;

  // Auto-pre-select suggestions while the user has not manually edited tags.
  useEffect(() => {
    if (userEditedTagsRef.current) return;
    setSelectedTagIds(suggestedTags);
  }, [suggestedTags]);

  const handleTagsChange = (next: string[]) => {
    userEditedTagsRef.current = true;
    setSelectedTagIds(next);
  };

  // Create document mutation
  const createDocumentMutation = useCreateUpdateMutation<any, DocumentCreateData>({
    mutationFn: async (data: DocumentCreateData) => {
      const formData = new FormData();
      
      // Add document metadata
      formData.append('name', data.name);
      formData.append('documentType', data.category);
      if (data.description) {
        formData.append('description', data.description);
      }
      if (data.effectiveDate && data.effectiveDate.trim() !== '') {
        formData.append('effectiveDate', data.effectiveDate);
      }
      formData.append('isManagerOnly', data.isManagerOnly ? 'true' : 'false');
      
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
        let errorData: { error?: string; message?: string } = {};
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          console.error('Failed to parse error response as JSON');
        }
        
        throw new Error(errorData.error || errorData.message || `Failed to create document: ${response.status}`);
      }

      return response.json();
    },
    successTitle: t('createDocument'),
    successMessage: (data) => `"${data.name}" ${t('documentCreatedSuccessfully')}`,
    errorTitle: t('error'),
    errorMessage: (error: any) => error?.message || t('failedToCreateDocument'),
    queryKeysToInvalidate: [['/api/documents']],
    onSuccessCallback: async (data) => {
      // Persist tag assignments after document creation
      if (selectedTagIds.length > 0 && data?.id) {
        try {
          await Promise.all(
            selectedTagIds.map((tagId) =>
              apiRequest('POST', `/api/documents/${data.id}/tags`, { tagId })
            )
          );
          queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
        } catch (e) {
          // Non-fatal: document was created
        }
      }
      // Reset form and close dialog
      form.reset();
      setSelectedFile(null);
      setTextContent(null);
      setSelectedTagIds([]);
      userEditedTagsRef.current = false;
      onClose();
      onSuccess?.(data.id);
    },
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
        title: t('missingContent'),
        description: t('missingContentDescription'),
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
      setSelectedTagIds([]);
      userEditedTagsRef.current = false;
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {t('createDocument')}
          </DialogTitle>
          <DialogDescription>
            {t('createDocumentDialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Document Information Section */}
            <div className="space-y-4">
              <StandardFormGrid>
                {/* Document Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('documentName')} *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('enterDocumentName')}
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
                      <FormLabel>{t('category')} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-document-category">
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
              </StandardFormGrid>

              {/* Effective Date */}
              <FormField
                control={form.control}
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
                        data-testid="input-document-effective-date"
                      />
                    </FormControl>
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
                    <FormLabel>{t('description')} ({t('optional')})</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('enterDocumentDescription')}
                        className="min-h-[80px]"
                        {...field}
                        data-testid="textarea-document-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Document Tags */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Étiquettes</Label>
                  {isFetchingAiTags && (
                    <span
                      className="text-xs text-muted-foreground flex items-center gap-1"
                      data-testid="text-ai-tag-suggestion-loading"
                    >
                      <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></span>
                      {language === 'fr' ? 'Analyse IA du document...' : 'AI analyzing document...'}
                    </span>
                  )}
                </div>
                <TagPicker
                  value={selectedTagIds}
                  onChange={handleTagsChange}
                  scope={entityType === 'building' ? 'building' : 'residence'}
                  suggestedTagIds={suggestedTags}
                />
              </div>

              {/* Manager-only visibility toggle */}
              <FormField
                control={form.control}
                name="isManagerOnly"
                render={({ field }) => (
                  <FormItem className="flex items-start justify-between gap-4 rounded-lg border p-4">
                    <div className="space-y-1">
                      <FormLabel className="flex items-center gap-2">
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
                      <p className="text-xs text-muted-foreground">
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
            </div>

            {/* File Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  {t('documentContent')}
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
                  {t('uploadFileOrCreateText')}
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
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={createDocumentMutation.isPending}
                data-testid="button-create-document"
              >
                {createDocumentMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t('creatingDocument')}
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    {t('createDocument')}
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