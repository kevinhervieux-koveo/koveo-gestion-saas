import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, File, Image, FileText, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface SharedUploaderProps {
  onDocumentChange: (file: File | null, text: string | null) => void;
  allowedFileTypes?: string[];
  maxFileSize?: number; // in MB
  disabled?: boolean;
  className?: string;
  defaultTab?: 'file' | 'text';
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
  allowedFileTypes = DEFAULT_ALLOWED_TYPES,
  maxFileSize = 25, // MB
  disabled = false,
  className,
  defaultTab = 'file'
}: SharedUploaderProps) {
  // State management
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FilePreview | null>(null);
  const [textContent, setTextContent] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAreaRef = useRef<HTMLDivElement>(null);

  // File validation function
  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > maxFileSize * 1024 * 1024) {
      return `File size exceeds ${maxFileSize}MB limit`;
    }

    // Check file type
    const isAllowed = allowedFileTypes.some(type => {
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
  }, [allowedFileTypes, maxFileSize]);

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
  }, [validateFile, onDocumentChange]);

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
          const file = new File([blob], `screenshot-${timestamp}.png`, {
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
          {/* Hidden file input with mobile camera integration */}
          <input
            ref={fileInputRef}
            type="file"
            accept={allowedFileTypes.join(',')}
            capture="environment" // Mobile camera integration for rear camera
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
            data-testid="file-input-mobile"
          />

          {/* Upload area with drag-and-drop */}
          <div
            ref={uploadAreaRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFileDialog}
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
                    Maximum {maxFileSize}MB • PDF, DOCX, XLSX, PNG, JPG
                  </p>
                </div>
              </>
            )}
          </div>

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