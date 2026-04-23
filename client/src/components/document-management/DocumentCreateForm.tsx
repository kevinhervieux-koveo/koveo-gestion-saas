import React, { useState } from 'react';
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
  const { t } = useLanguage();

  // State for file upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

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
    onSuccessCallback: (data) => {
      // Reset form and close dialog
      form.reset();
      setSelectedFile(null);
      setTextContent(null);
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