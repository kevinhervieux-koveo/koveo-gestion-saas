import React, { ReactNode, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form } from '@/components/ui/form';
import { StandardCard } from '@/components/ui/standard-card';
import { useStandardForm } from '@/hooks/use-standard-form';
import { SharedUploader } from '@/components/document-management';
import { FileText, Sparkles, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import type { UploadContext } from '@shared/config/upload-config';

interface DocumentFormBaseProps<T extends z.ZodType<any, any, any>> {
  title: string;
  schema: T;
  defaultValues: Partial<z.infer<T>>;
  apiEndpoint: string;
  queryKey: string[];
  mode?: 'create' | 'edit';
  itemId?: string;
  buildingId?: string;
  residenceId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  successMessages?: {
    create?: string;
    update?: string;
  };
  children: (formControls: ReturnType<typeof useStandardForm<T>>) => ReactNode;
  aiExtractorComponent?: ReactNode;
  uploadContext?: UploadContext;
  showTabs?: boolean;
  'data-testid'?: string;
}

/**
 * Base component for document-based forms (Bills, Invoices, etc.).
 * Provides common structure including AI extraction, file upload, and form submission.
 * Consolidates patterns from ModularBillForm and InvoiceForm.
 * 
 * @param props - Configuration and render props for the document form
 * @returns Standardized document form with consistent UX patterns
 */
export function DocumentFormBase<T extends z.ZodType<any, any, any>>({
  title,
  schema,
  defaultValues,
  apiEndpoint,
  queryKey,
  mode = 'create',
  itemId,
  buildingId,
  residenceId,
  onSuccess,
  onCancel,
  successMessages,
  children,
  aiExtractorComponent,
  uploadContext,
  showTabs = true,
  'data-testid': testId,
}: DocumentFormBaseProps<T>) {
  const { t } = useLanguage();
  const [uploadedDocument, setUploadedDocument] = useState<string | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Initialize form with standard patterns
  const formControls = useStandardForm({
    schema,
    defaultValues,
    apiEndpoint,
    queryKey,
    mode,
    itemId,
    onSuccess,
    successMessages,
  });

  const handleDocumentUpload = (documentId: string, file: File) => {
    setUploadedDocument(documentId);
    
    // Trigger AI processing if available
    if (file.type === 'application/pdf' && aiExtractorComponent) {
      setIsAiProcessing(true);
    }
  };

  const handleDocumentRemove = () => {
    setUploadedDocument(null);
    setIsAiProcessing(false);
  };

  const onSubmit = (data: z.infer<T>) => {
    const formData = {
      ...data,
      buildingId,
      residenceId,
      documentId: uploadedDocument || undefined,
    };
    formControls.submitMutation.mutate(formData);
  };

  const formContent = (
    <div className="space-y-6">
      <Form {...formControls.form}>
        <form onSubmit={formControls.handleSubmit(onSubmit)} className="space-y-6">
          {children(formControls)}
          
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
              type="submit"
              disabled={formControls.isSubmitting}
              data-testid="button-submit"
            >
              <Save className="w-4 h-4 mr-2" />
              {formControls.isSubmitting 
                ? (mode === 'create' ? 'Creating...' : 'Updating...') 
                : (mode === 'create' ? 'Create' : 'Update')
              }
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );

  if (!showTabs) {
    return (
      <StandardCard
        title={title}
        className="max-w-4xl mx-auto"
        data-testid={testId}
      >
        {formContent}
      </StandardCard>
    );
  }

  return (
    <StandardCard
      title={title}
      className="max-w-4xl mx-auto"
      data-testid={testId}
    >
      <Tabs defaultValue="form" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="form" data-testid="tab-form">
            <FileText className="w-4 h-4 mr-2" />
            Form Entry
          </TabsTrigger>
          <TabsTrigger value="ai" disabled={!aiExtractorComponent} data-testid="tab-ai">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Extract
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="form" className="mt-6">
          {formContent}
        </TabsContent>
        
        <TabsContent value="ai" className="mt-6">
          {aiExtractorComponent && (
            <div className="space-y-6">
              {aiExtractorComponent}
              {isAiProcessing && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Processing document...</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {uploadContext && (
        <div className="mt-6 pt-6 border-t">
          <SharedUploader
            context={uploadContext}
            onUploadComplete={handleDocumentUpload}
            accept={{
              'application/pdf': ['.pdf'],
              'image/*': ['.png', '.jpg', '.jpeg'],
            }}
            maxSizeMB={10}
            className="mt-4"
          />
          
          {uploadedDocument && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Document uploaded</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDocumentRemove}
                  data-testid="button-remove-document"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </StandardCard>
  );
}