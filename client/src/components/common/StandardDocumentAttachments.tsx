import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentInlineViewer } from '@/components/common/DocumentInlineViewer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Paperclip, Upload, FileText, File, Image, Eye, Trash2, 
  CheckCircle, Sparkles, X, AlertCircle 
} from 'lucide-react';
import { SharedUploader } from '@/components/document-management';
import { GeminiBillExtractor } from '@/components/bill-management/GeminiBillExtractor';
import type { UploadContext } from '@shared/config/upload-config';
import { sanitizeFileName } from '@/utils/sanitize';
import { useLanguage } from '@/hooks/use-language';

export interface AttachedFile {
  id: string;
  file?: File; // Optional for existing documents
  preview?: string;
  uploadProgress?: number;
  aiAnalyzed?: boolean;
  category?: string;
  // For existing documents
  isExisting?: boolean;
  name?: string;
  size?: number;
  type?: string;
  url?: string;
}

interface StandardDocumentAttachmentsProps {
  // Core functionality
  onDocumentChange: (file: File | null, text: string | null) => void;
  attachedFiles: AttachedFile[];
  onRemoveFile: (fileId: string) => void;
  uploadProgress: { [key: string]: number };
  
  // Upload configuration
  uploadContext: UploadContext;
  allowedFileTypes?: string[];
  maxFileSize?: number;
  
  // AI functionality
  aiEnabled?: boolean;
  onAiToggle?: (enabled: boolean) => void;
  onAiExtractionComplete?: (data: any) => void;
  aiExtractionLoading?: boolean;
  aiExtractionData?: any;
  showAiToggle?: boolean;
  
  // UI configuration
  title?: string;
  className?: string;
  showUploadTabs?: boolean;
  defaultUploadTab?: 'file' | 'text';
  
  // State management
  showSection?: boolean;
  onToggleSection?: (show: boolean) => void;
}

/**
 * StandardDocumentAttachments - A unified document attachments section
 * Places document upload and management at the top of forms for consistency
 */
export function StandardDocumentAttachments({
  onDocumentChange,
  attachedFiles,
  onRemoveFile,
  uploadProgress,
  uploadContext,
  allowedFileTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  maxFileSize = 25,
  aiEnabled = true,
  onAiToggle,
  onAiExtractionComplete,
  aiExtractionLoading = false,
  aiExtractionData,
  showAiToggle = true,
  title = "Document Attachments",
  className = "",
  showUploadTabs = true,
  defaultUploadTab = 'file',
  showSection = true,
  onToggleSection,
}: StandardDocumentAttachmentsProps) {
  const { t } = useLanguage();
  
  const [activeUploadTab, setActiveUploadTab] = useState<'file' | 'text'>(defaultUploadTab);
  const [uploadedAiFile, setUploadedAiFile] = useState<File | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<{ url: string; name?: string } | null>(null);

  // Handle AI file upload specifically for analysis
  const handleAiDocumentChange = (file: File | null, text: string | null) => {
    setUploadedAiFile(file);
    onDocumentChange(file, text);
  };

  // Get category from file name
  const getCategoryFromFileName = (fileName: string): string => {
    const lower = fileName.toLowerCase();
    if (lower.includes('invoice') || lower.includes('bill')) return 'invoice';
    if (lower.includes('receipt')) return 'receipt';
    if (lower.includes('contract')) return 'contract';
    if (lower.includes('quote') || lower.includes('estimate')) return 'quote';
    return 'document';
  };

  if (!showSection) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-gray-500" />
              {title}
              {attachedFiles.length > 0 && (
                <Badge variant="secondary" data-testid="badge-attachment-count">
                  {attachedFiles.length} file{attachedFiles.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            {onToggleSection && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onToggleSection(!showSection)}
                data-testid="button-toggle-attachments"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Document Upload Section */}
          <div className="space-y-4">
            {showUploadTabs ? (
              <Tabs value={activeUploadTab} onValueChange={(value: 'file' | 'text') => setActiveUploadTab(value)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="file" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload File
                    {aiEnabled && (
                      <Badge variant="outline" className="ml-1 text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="text" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Text Document
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="file" className="space-y-4">
                  <SharedUploader
                    onDocumentChange={handleAiDocumentChange}
                    formType={uploadContext.type}
                    uploadContext={uploadContext}
                    aiAnalysisEnabled={aiEnabled}
                    onAiToggle={onAiToggle}
                    onAiAnalysisComplete={onAiExtractionComplete}
                    showAiToggle={showAiToggle}
                    allowedFileTypes={allowedFileTypes}
                    maxFileSize={maxFileSize}
                    defaultTab="file"
                    data-testid="shared-uploader-file"
                  />
                  
                  {/* AI Extraction Status */}
                  {aiExtractionLoading && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 animate-spin text-blue-500" />
                        <span className="text-sm text-blue-800 dark:text-blue-200">
                          {t('aiIsAnalyzingYourDocument')}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {aiExtractionData && (
                    <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium text-green-800 dark:text-green-200">
                          AI Analysis Complete
                        </span>
                        <Badge variant="outline" className="ml-2">
                          {Math.round((aiExtractionData.confidence || 0) * 100)}% confidence
                        </Badge>
                      </div>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {t('formFieldsHaveBeenAutomaticallyPopulated')}
                      </p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="text">
                  <SharedUploader
                    onDocumentChange={onDocumentChange}
                    formType={uploadContext.type}
                    uploadContext={uploadContext}
                    aiAnalysisEnabled={false}
                    showAiToggle={false}
                    allowedFileTypes={allowedFileTypes}
                    maxFileSize={maxFileSize}
                    defaultTab="text"
                    data-testid="shared-uploader-text"
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <SharedUploader
                onDocumentChange={handleAiDocumentChange}
                formType={uploadContext.type}
                uploadContext={uploadContext}
                aiAnalysisEnabled={aiEnabled}
                onAiToggle={onAiToggle}
                onAiAnalysisComplete={onAiExtractionComplete}
                showAiToggle={showAiToggle}
                allowedFileTypes={allowedFileTypes}
                maxFileSize={maxFileSize}
                defaultTab={defaultUploadTab}
              />
            )}
          </div>

          {/* Attached Files Display */}
          <div className="space-y-3">
            {attachedFiles.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Attached Files ({attachedFiles.length})
                </h4>
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {attachedFiles.map((attachment) => (
                    <Card key={attachment.id} className="p-3">
                      <div className="flex items-center gap-3">
                        {/* File Icon/Preview */}
                        <div className="flex-shrink-0">
                          {attachment.preview ? (
                            <div className="w-12 h-12 rounded overflow-hidden border">
                              <img 
                                src={attachment.preview} 
                                alt={sanitizeFileName(attachment.file?.name || attachment.name || 'unknown')}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded border flex items-center justify-center">
                              <File className="h-6 w-6 text-gray-500" />
                            </div>
                          )}
                        </div>

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {sanitizeFileName(attachment.file?.name || attachment.name || 'unknown')}
                            </p>
                            {attachment.aiAnalyzed && (
                              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                <Sparkles className="h-3 w-3" />
                                AI Analyzed
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs capitalize">
                              {attachment.category}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>{((attachment.file?.size || attachment.size || 0) / 1024 / 1024).toFixed(2)} MB</span>
                            <span className="capitalize">{(attachment.file?.type || attachment.type || 'unknown').split('/')[1]}</span>
                            
                            {/* Upload Progress */}
                            {uploadProgress[attachment.id] !== undefined && uploadProgress[attachment.id] < 100 && (
                              <div className="flex items-center gap-2 flex-1">
                                <Progress 
                                  value={uploadProgress[attachment.id]} 
                                  className="h-2 flex-1"
                                />
                                <span>{Math.round(uploadProgress[attachment.id])}%</span>
                              </div>
                            )}
                            
                            {uploadProgress[attachment.id] === 100 && (
                              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                <CheckCircle className="h-3 w-3" />
                                <span>Ready</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* File Actions */}
                        <div className="flex items-center gap-1">
                          {/* View/Download button for existing documents or preview for new files */}
                          {(attachment.isExisting && attachment.url) || attachment.preview ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (attachment.isExisting && attachment.url) {
                                  setViewingAttachment({ url: attachment.url, name: attachment.name });
                                } else if (attachment.preview) {
                                  setViewingAttachment({ url: attachment.preview, name: attachment.name });
                                }
                              }}
                              data-testid={`button-view-${attachment.id}`}
                              title={attachment.isExisting ? "View document" : "Preview file"}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveFile(attachment.id)}
                            data-testid={`button-remove-${attachment.id}`}
                            title="Remove file"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div 
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center"
                data-testid="drop-zone-empty"
              >
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  No documents attached yet
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {t('useTheUploadSectionAboveTo')}
                </p>
              </div>
            )}

            {/* Attachment Summary */}
            {attachedFiles.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium">
                      {attachedFiles.length} document{attachedFiles.length !== 1 ? 's' : ''} ready to attach
                    </p>
                    <p className="text-xs mt-1">
                      {aiExtractionData ? 
                        'AI-analyzed documents will help pre-fill form information and be attached to the final submission.' :
                        'These documents will be attached when the form is submitted.'
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Hidden AI Extraction Component */}
          {uploadedAiFile && onAiExtractionComplete && (
            <GeminiBillExtractor
              file={uploadedAiFile}
              onExtractionComplete={onAiExtractionComplete}
            />
          )}
        </CardContent>
      </Card>

      {viewingAttachment && (
        <DocumentInlineViewer
          isOpen={!!viewingAttachment}
          onClose={() => setViewingAttachment(null)}
          fileUrl={viewingAttachment.url}
          fileName={viewingAttachment.name}
        />
      )}
    </div>
  );
}