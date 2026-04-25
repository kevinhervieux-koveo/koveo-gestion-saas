/**
 * Reusable document upload tabs component.
 * Extracted from ModularBillForm.tsx to standardize file upload across forms.
 */
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Sparkles } from 'lucide-react';
import { SharedUploader } from '@/components/document-management';
import type { UploadContext } from '@shared/config/upload-config';
import { useLanguage } from '@/hooks/use-language';

interface DocumentUploadTabsProps {
  /** Upload context for file organization */
  uploadContext: UploadContext;
  /** File change callback */
  onDocumentChange: (file: File | null, text: string | null) => void;
  /** Whether AI analysis is enabled */
  aiAnalysisEnabled?: boolean;
  /** AI toggle callback */
  onAiToggle?: (enabled: boolean) => void;
  /** AI analysis completion callback */
  onAiAnalysisComplete?: (data: any) => void;
  /** Allowed file types */
  allowedFileTypes?: string[];
  /** Maximum file size in MB */
  maxFileSize?: number;
  /** Whether AI toggle should be shown */
  showAiToggle?: boolean;
  /** Whether to show AI tab */
  showAiTab?: boolean;
  /** Form type for context */
  formType?: string;
  /** Whether extraction is in progress */
  isExtracting?: boolean;
  /** Custom loading message */
  extractionMessage?: string;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for the component */
  'data-testid'?: string;
}

/**
 * Standardized document upload interface with AI/manual tabs.
 * Provides consistent upload experience across different form types.
 */
export function DocumentUploadTabs({
  uploadContext,
  onDocumentChange,
  aiAnalysisEnabled = true,
  onAiToggle,
  onAiAnalysisComplete,
  allowedFileTypes = ['image/*', 'application/pdf'],
  maxFileSize = 25,
  showAiToggle = false,
  showAiTab = true,
  formType = 'documents',
  isExtracting = false,
  extractionMessage = 'Extracting data from your document...',
  className = '',
  'data-testid': testId = 'document-upload-tabs',
}: DocumentUploadTabsProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState(showAiTab && aiAnalysisEnabled ? 'ai' : 'manual');

  return (
    <div className={className} data-testid={testId}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual" data-testid="tab-manual">
            <FileText className="w-4 h-4 mr-2" />
            Manual Entry
          </TabsTrigger>
          
          {showAiTab && aiAnalysisEnabled && (
            <TabsTrigger value="ai" data-testid="tab-ai">
              <Sparkles className="w-4 h-4 mr-2" />
              AI Extraction
            </TabsTrigger>
          )}
        </TabsList>

        {/* AI Extraction Tab */}
        {showAiTab && aiAnalysisEnabled && (
          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Upload Document
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SharedUploader
                  onDocumentChange={onDocumentChange}
                  formType={formType}
                  uploadContext={uploadContext}
                  aiAnalysisEnabled={aiAnalysisEnabled}
                  onAiToggle={onAiToggle}
                  onAiAnalysisComplete={onAiAnalysisComplete}
                  showAiToggle={showAiToggle}
                  allowedFileTypes={allowedFileTypes}
                  maxFileSize={maxFileSize}
                />
                
                {/* Extraction Progress Indicator */}
                {isExtracting && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-blue-700 dark:text-blue-300 font-medium">
                        {extractionMessage}
                      </span>
                    </div>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                      {t('thisMayTakeAFewSeconds')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Manual Entry Tab */}
        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Upload Document (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SharedUploader
                onDocumentChange={onDocumentChange}
                formType={formType}
                uploadContext={uploadContext}
                aiAnalysisEnabled={false} // Disabled in manual entry
                showAiToggle={false} // Don't show toggle in manual entry
                allowedFileTypes={allowedFileTypes}
                maxFileSize={maxFileSize}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Simplified document upload component for basic file upload needs.
 * Uses the same styling but without AI functionality.
 */
interface SimpleDocumentUploadProps {
  uploadContext: UploadContext;
  onDocumentChange: (file: File | null, text: string | null) => void;
  title?: string;
  description?: string;
  allowedFileTypes?: string[];
  maxFileSize?: number;
  formType?: string;
  className?: string;
  'data-testid'?: string;
}

export function SimpleDocumentUpload({
  uploadContext,
  onDocumentChange,
  title = 'Upload Document',
  description,
  allowedFileTypes = ['image/*', 'application/pdf'],
  maxFileSize = 25,
  formType = 'documents',
  className = '',
  'data-testid': testId = 'simple-document-upload',
}: SimpleDocumentUploadProps) {
  return (
    <Card className={className} data-testid={testId}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {title}
        </CardTitle>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {description}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <SharedUploader
          onDocumentChange={onDocumentChange}
          formType={formType}
          uploadContext={uploadContext}
          aiAnalysisEnabled={false}
          showAiToggle={false}
          allowedFileTypes={allowedFileTypes}
          maxFileSize={maxFileSize}
        />
      </CardContent>
    </Card>
  );
}