import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Upload, Camera, File, X } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

interface CustomFileUploaderProps {
  onFileSelect: (files: File[]) => void;
  allowedFileTypes?: string[];
  maxFileSize?: number; // in MB
  disabled?: boolean;
  isUploading?: boolean;
  className?: string;
  'data-testid'?: string;
}

interface FilePreview {
  file: File;
  preview?: string;
  type: 'image' | 'document';
}

/**
 * CustomFileUploader - A simple file uploader component for maintenance documents
 * Supports drag-and-drop, click to browse, and mobile camera capture
 */
export function CustomFileUploader({
  onFileSelect,
  allowedFileTypes = ['image/*', 'application/pdf'],
  maxFileSize = 10,
  disabled = false,
  isUploading = false,
  className,
  'data-testid': testId,
}: CustomFileUploaderProps) {
  const { t } = useLanguage();
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FilePreview | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Mobile detection
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  // Validate file
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

    return null;
  }, [allowedFileTypes, maxFileSize]);

  // Process file
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
    onFileSelect([file]);
  }, [validateFile, onFileSelect]);

  // Handle file selection from input
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  }, [processFile]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragOver(true);
    }
  }, [disabled, isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled || isUploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [disabled, isUploading, processFile]);

  // Remove selected file
  const handleRemoveFile = useCallback(() => {
    if (selectedFile?.preview) {
      URL.revokeObjectURL(selectedFile.preview);
    }
    setSelectedFile(null);
    setValidationError(null);
  }, [selectedFile]);

  // Open file dialog
  const openFileDialog = useCallback(() => {
    if (!disabled && !isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled, isUploading]);

  // Open camera (mobile)
  const openCamera = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMobileMenu(false);
    
    setTimeout(() => {
      if (!disabled && !isUploading && cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    }, 100);
  }, [disabled, isUploading]);

  // Open gallery/files (mobile)
  const openGallery = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMobileMenu(false);
    
    setTimeout(() => {
      if (!disabled && !isUploading && fileInputRef.current) {
        fileInputRef.current.click();
      }
    }, 100);
  }, [disabled, isUploading]);

  // Handle upload area click
  const handleUploadAreaClick = useCallback(() => {
    if (disabled || isUploading) return;
    
    if (isMobile) {
      setShowMobileMenu(true);
    } else {
      openFileDialog();
    }
  }, [disabled, isUploading, isMobile, openFileDialog]);

  const formatFileSize = (bytes: number) => {
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={allowedFileTypes.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
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
        disabled={disabled || isUploading}
        data-testid="file-input-camera"
      />

      {/* Upload area with drag-and-drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleUploadAreaClick}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors min-h-[120px] flex flex-col justify-center items-center",
          isDragOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
            : "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500",
          (disabled || isUploading) && "cursor-not-allowed opacity-50"
        )}
        data-testid={testId}
      >
        {isUploading ? (
          // Upload in progress
          <div className="w-full space-y-3">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <Upload className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-sm font-medium text-blue-600">Uploading document...</p>
            <p className="text-xs text-gray-500">{t('pleaseWaitWhileWeProcessYour')}</p>
          </div>
        ) : selectedFile ? (
          // File preview (before upload starts)
          <div className="w-full space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              {selectedFile.type === 'image' && selectedFile.preview ? (
                <img
                  src={selectedFile.preview}
                  alt="Preview"
                  className="w-12 h-12 object-cover rounded"
                />
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
                {t('dropFilesHereOrClickTo')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('onMobileTapToUseCamera')}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Maximum {maxFileSize}MB • {allowedFileTypes.map(type => {
                  if (type.includes('image')) return 'Images';
                  if (type.includes('pdf')) return 'PDF';
                  return type.split('/').pop()?.toUpperCase();
                }).filter(Boolean).join(', ')}
              </p>
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
                {t('selectHowYouDLikeTo')}
              </p>
            </div>
            
            <div className="space-y-3">
              <Button
                onClick={openCamera}
                className="w-full flex items-center justify-center gap-3 py-4"
                variant="outline"
                disabled={disabled || isUploading}
                data-testid="mobile-menu-camera"
              >
                <Camera className="h-5 w-5" />
                Take Photo with Camera
              </Button>
              
              <Button
                onClick={openGallery}
                className="w-full flex items-center justify-center gap-3 py-4"
                variant="outline"
                disabled={disabled || isUploading}
                data-testid="mobile-menu-gallery"
              >
                <File className="h-5 w-5" />
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
        <div className="mt-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">❌ {validationError}</p>
        </div>
      )}
    </div>
  );
}