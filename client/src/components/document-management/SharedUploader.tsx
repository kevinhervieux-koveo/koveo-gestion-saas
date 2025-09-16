import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, File, Image, FileText, Camera, Sparkles, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getUploadConfig, isAiAnalysisEnabled, type UploadContext } from '@shared/config/upload-config';

interface SharedUploaderProps {
  onDocumentChange: (file: File | null, text: string | null) => void;
  allowedFileTypes?: string[];
  maxFileSize?: number; // in MB
  disabled?: boolean;
  className?: string;
  defaultTab?: 'file' | 'text';
  // AI Enhancement Props
  formType?: string;
  uploadContext?: UploadContext;
  aiAnalysisEnabled?: boolean;
  onAiToggle?: (enabled: boolean) => void;
  onAiAnalysisComplete?: (data: any) => void;
  showAiToggle?: boolean;
  contextFields?: Record<string, any>;
}

interface FilePreview {
  file: File;
  preview?: string;
  type: 'image' | 'document';
}

const DEFAULT_ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/jpg',
  'image/png'
];

/**
 * SharedUploader - A reusable component for file uploads and text creation
 * Features mobile camera integration, drag-and-drop, clipboard paste, and text input
 */
export function SharedUploader({
  onDocumentChange,
  allowedFileTypes,
  maxFileSize,
  disabled = false,
  className,
  defaultTab = 'file',
  // AI Enhancement Props
  formType = 'documents',
  uploadContext,
  aiAnalysisEnabled: propAiEnabled,
  onAiToggle,
  onAiAnalysisComplete,
  showAiToggle = true,
  contextFields
}: SharedUploaderProps) {
  // Get configuration from upload config
  const config = getUploadConfig(formType);
  const finalAllowedTypes = allowedFileTypes || config.allowedFileTypes;
  const finalMaxFileSize = maxFileSize || config.maxFileSize;
  const finalAiEnabled = propAiEnabled ?? config.aiAnalysisEnabled;

  // State management
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FilePreview | null>(null);
  const [textContent, setTextContent] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(finalAiEnabled);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadAreaRef = useRef<HTMLDivElement>(null);

  // Mobile detection
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  // Handle AI toggle
  const handleAiToggle = useCallback((enabled: boolean) => {
    setAiEnabled(enabled);
    onAiToggle?.(enabled);
  }, [onAiToggle]);

  // File validation function
  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > finalMaxFileSize * 1024 * 1024) {
      return `File size exceeds ${finalMaxFileSize}MB limit`;
    }

    // Check file type
    const isAllowed = finalAllowedTypes.some(type => {
      if (type.includes('*')) {
        return file.type.startsWith(type.replace('*', ''));
      }
      return file.type === type;
    });

    if (!isAllowed) {
      return `File type "${file.type}" is not supported`;
    }

    // Check filename for security
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      return 'Invalid filename detected';
    }

    return null;
  }, [finalAllowedTypes, finalMaxFileSize]);

  // AI Analysis function
  const performAiAnalysis = useCallback(async (file: File) => {
    if (!aiEnabled || !onAiAnalysisComplete) return;
    
    setIsAnalyzing(true);
    try {
      // Create FormData for AI analysis
      const formData = new FormData();
      formData.append('document', file);
      formData.append('formType', formType);
      
      if (uploadContext) {
        formData.append('uploadContext', JSON.stringify(uploadContext));
      }
      
      // Make AI analysis request
      const response = await fetch('/api/ai/analyze-document', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        onAiAnalysisComplete(result);
      }
    } catch (error) {
      console.error('AI analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [aiEnabled, onAiAnalysisComplete, formType, uploadContext]);

  // Process and validate file
  const processFile = useCallback((file: File): void => {
    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    const isImage = file.type.startsWith('image/');
    
    const filePreview: FilePreview = {
      file,
      type: isImage ? 'image' : 'document'
    };

    if (isImage) {
      filePreview.preview = URL.createObjectURL(file);
    }

    setSelectedFile(filePreview);
    onDocumentChange(file, null);
    
    // Trigger AI analysis if enabled
    if (aiEnabled) {
      performAiAnalysis(file);
    }
  }, [validateFile, onDocumentChange, aiEnabled, performAiAnalysis]);

  // Handle file selection from input
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset input to allow selecting the same file again
    e.target.value = '';
  }, [processFile]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]); // Only handle first file
    }
  }, [disabled, processFile]);

  // Handle clipboard paste for screenshots
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (disabled || activeTab !== 'file') return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        if (blob) {
          e.preventDefault();
          // Create proper File object for pasted images
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const file = new (File as any)([blob], `screenshot-${timestamp}.png`, {
            type: 'image/png'
          });
          processFile(file);
          break;
        }
      }
    }
  }, [disabled, activeTab, processFile]);

  // Set up paste event listener
  useEffect(() => {
    if (activeTab === 'file' && !disabled) {
      document.addEventListener('paste', handlePaste);
      return () => document.removeEventListener('paste', handlePaste);
    }
  }, [activeTab, disabled, handlePaste]);

  // Handle text content changes
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setTextContent(text);
    onDocumentChange(null, text || null);
  }, [onDocumentChange]);

  // Remove selected file
  const handleRemoveFile = useCallback(() => {
    if (selectedFile?.preview) {
      URL.revokeObjectURL(selectedFile.preview);
    }
    setSelectedFile(null);
    setValidationError(null);
    onDocumentChange(null, null);
  }, [selectedFile, onDocumentChange]);

  // Open file dialog
  const openFileDialog = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  // Open camera (mobile)
  const openCamera = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMobileMenu(false);
    
    // Use setTimeout to ensure the modal is closed before triggering the input
    setTimeout(() => {
      if (!disabled && cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    }, 100);
  }, [disabled]);

  // Open gallery/files (mobile)
  const openGallery = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMobileMenu(false);
    
    // Use setTimeout to ensure the modal is closed before triggering the input
    setTimeout(() => {
      if (!disabled && fileInputRef.current) {
        fileInputRef.current.click();
      }
    }, 100);
  }, [disabled]);

  // Handle upload area click
  const handleUploadAreaClick = useCallback(() => {
    if (disabled) return;
    
    if (isMobile) {
      setShowMobileMenu(true);
    } else {
      openFileDialog();
    }
  }, [disabled, isMobile, openFileDialog]);

  // Tab change handler
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as 'file' | 'text');
    
    // Clear current selection when switching tabs
    if (selectedFile) {
      handleRemoveFile();
    }
    if (textContent) {
      setTextContent('');
      onDocumentChange(null, null);
    }
  }, [selectedFile, textContent, handleRemoveFile, onDocumentChange]);

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      if (selectedFile?.preview) {
        URL.revokeObjectURL(selectedFile.preview);
      }
    };
  }, [selectedFile]);

  const formatFileSize = (bytes: number) => {
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className={cn("w-full", className)}>
      {/* AI Analysis Status (only show when analyzing, no toggle) */}
      {isAnalyzing && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg mb-4">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
          <span className="text-sm text-blue-600 dark:text-blue-400">
            AI analyzing document...
          </span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="file" data-testid="tab-upload-file">
            📁 Upload File
          </TabsTrigger>
          <TabsTrigger value="text" data-testid="tab-text-document">
            📝 Text Document
          </TabsTrigger>
        </TabsList>

        {/* File Upload Tab */}
        <TabsContent value="file" className="space-y-4">
          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept={finalAllowedTypes.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
            data-testid="file-input-gallery"
          />
          
          {/* Hidden camera input for mobile */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
            data-testid="file-input-camera"
          />

          {/* Upload area with drag-and-drop */}
          <div
            ref={uploadAreaRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleUploadAreaClick}
            className={cn(
              "relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors min-h-[120px] flex flex-col justify-center items-center",
              isDragOver
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                : "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500",
              disabled && "cursor-not-allowed opacity-50"
            )}
            data-testid="upload-area"
          >
            {selectedFile ? (
              // File preview
              <div className="w-full space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  {selectedFile.type === 'image' && selectedFile.preview ? (
                    <img
                      src={selectedFile.preview}
                      alt="Preview"
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : selectedFile.type === 'image' ? (
                    <Image className="w-12 h-12 text-gray-400" />
                  ) : (
                    <File className="w-12 h-12 text-gray-400" />
                  )}
                  
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {selectedFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(selectedFile.file.size)}
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile();
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    disabled={disabled}
                    data-testid="remove-file-button"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                <p className="text-xs text-green-600 dark:text-green-400">
                  ✓ File ready for upload
                </p>
              </div>
            ) : (
              // Upload prompt
              <>
                <div className="flex items-center justify-center space-x-2 mb-3">
                  <Upload className="h-8 w-8 text-gray-400" />
                  <Camera className="h-6 w-6 text-blue-500" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Drop files here or click to browse
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    📱 On mobile: Tap to use camera or select from gallery
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    💻 On desktop: Drag & drop, click to browse, or paste screenshots (Ctrl+V)
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Maximum {finalMaxFileSize}MB • {finalAllowedTypes.map(type => {
                      if (type.includes('image')) return 'Images';
                      if (type.includes('pdf')) return 'PDF';
                      if (type.includes('word')) return 'DOCX';
                      if (type.includes('excel') || type.includes('sheet')) return 'XLSX';
                      return type.split('/').pop()?.toUpperCase();
                    }).filter(Boolean).join(', ')}
                  </p>
                  {aiEnabled && (
                    <p className="text-xs text-purple-500 dark:text-purple-400 mt-1">
                      ✨ AI analysis will extract key information automatically
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Mobile Menu */}
          {showMobileMenu && isMobile && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50"
              onClick={() => setShowMobileMenu(false)}
            >
              <div 
                className="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-2xl p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Choose File Source
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Select how you'd like to add your file
                  </p>
                </div>
                
                <div className="space-y-3">
                  <Button
                    onClick={openCamera}
                    className="w-full flex items-center justify-center gap-3 py-4"
                    variant="outline"
                    disabled={disabled}
                    data-testid="mobile-menu-camera"
                  >
                    <Camera className="h-5 w-5" />
                    Take Photo with Camera
                  </Button>
                  
                  <Button
                    onClick={openGallery}
                    className="w-full flex items-center justify-center gap-3 py-4"
                    variant="outline"
                    disabled={disabled}
                    data-testid="mobile-menu-gallery"
                  >
                    <Folder className="h-5 w-5" />
                    Choose from Gallery/Files
                  </Button>
                </div>
                
                <Button
                  onClick={() => setShowMobileMenu(false)}
                  variant="ghost"
                  className="w-full mt-4"
                  data-testid="mobile-menu-cancel"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Validation error */}
          {validationError && (
            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">❌ {validationError}</p>
            </div>
          )}
        </TabsContent>

        {/* Text Document Tab */}
        <TabsContent value="text" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="text-content" className="text-sm font-medium">
              Document Content
            </Label>
            <Textarea
              id="text-content"
              placeholder="Enter your document content here..."
              value={textContent}
              onChange={handleTextChange}
              disabled={disabled}
              rows={8}
              className="resize-none"
              data-testid="textarea-document-content"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Create a text-only document entry. You can add formatting and additional details later.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}