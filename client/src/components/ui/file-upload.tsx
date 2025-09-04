import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, File, Image, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void;
  onFilesRemove?: (fileIndex: number) => void;
  maxFiles?: number;
  maxSize?: number; // in MB
  acceptedTypes?: string[];
  className?: string;
  disabled?: boolean;
  allowPaste?: boolean;
  children?: React.ReactNode;
}

interface FilePreview {
  file: File;
  preview?: string;
  type: 'image' | 'document';
}

export function FileUpload({
  onFilesSelect,
  onFilesRemove,
  maxFiles = 5,
  maxSize = 50,
  acceptedTypes = [
    'image/*',
    '.pdf',
    '.doc',
    '.docx',
    '.txt',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx'
  ],
  className,
  disabled = false,
  allowPaste = true,
  children
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [files, setFiles] = useState<FilePreview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAreaRef = useRef<HTMLDivElement>(null);

  // Convert File to FilePreview
  const processFile = useCallback((file: File): FilePreview => {
    const isImage = file.type.startsWith('image/');
    const filePreview: FilePreview = {
      file,
      type: isImage ? 'image' : 'document'
    };

    if (isImage) {
      filePreview.preview = URL.createObjectURL(file);
    }

    return filePreview;
  }, []);

  // Validate file size and type
  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      return `File "${file.name}" is too large. Maximum size is ${maxSize}MB.`;
    }

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type;
    
    const isAccepted = acceptedTypes.some(type => {
      if (type.includes('*')) {
        return mimeType.startsWith(type.replace('*', ''));
      }
      return type === fileExtension || type === mimeType;
    });

    if (!isAccepted) {
      return `File type "${fileExtension}" is not allowed.`;
    }

    return null;
  }, [acceptedTypes, maxSize]);

  // Handle file selection
  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const validFiles: File[] = [];
    const errors: string[] = [];

    // Check if adding these files would exceed maxFiles
    if (files.length + fileArray.length > maxFiles) {
      errors.push(`Cannot add ${fileArray.length} files. Maximum ${maxFiles} files allowed.`);
      return;
    }

    fileArray.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      // In a real app, you'd want to show these errors to the user
      console.error('File validation errors:', errors);
      return;
    }

    if (validFiles.length > 0) {
      const newFilePreviews = validFiles.map(processFile);
      setFiles(prev => [...prev, ...newFilePreviews]);
      onFilesSelect(validFiles);
    }
  }, [files.length, maxFiles, validateFile, processFile, onFilesSelect]);

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

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFiles(droppedFiles);
    }
  }, [disabled, handleFiles]);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      handleFiles(selectedFiles);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  }, [handleFiles]);

  // Handle paste events for screenshots
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!allowPaste || disabled) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        if (blob) {
          // Create a filename for pasted images
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          // Use object spread to create file with proper properties
          const file = Object.assign(blob, {
            name: `screenshot-${timestamp}.png`
          }) as File;
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      handleFiles(imageFiles);
    }
  }, [allowPaste, disabled, handleFiles]);

  // Set up paste event listener
  useEffect(() => {
    if (allowPaste && !disabled) {
      document.addEventListener('paste', handlePaste);
      return () => document.removeEventListener('paste', handlePaste);
    }
  }, [allowPaste, disabled, handlePaste]);

  // Remove file
  const handleRemoveFile = useCallback((index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      // Clean up preview URL if it exists
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
    
    if (onFilesRemove) {
      onFilesRemove(index);
    }
  }, [onFilesRemove]);

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  const openFileDialog = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled}
        data-testid="file-input"
      />

      {/* Upload area */}
      <div
        ref={uploadAreaRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragOver
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
        data-testid="upload-area"
      >
        {children ? (
          children
        ) : (
          <>
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-900">
                Drop files here or click to browse
              </p>
              <p className="text-sm text-gray-500">
                {allowPaste && "You can also paste screenshots (Ctrl+V). "}
                Maximum {maxFiles} files, up to {maxSize}MB each
              </p>
              <p className="text-xs text-gray-400">
                Supported: {acceptedTypes.join(', ')}
              </p>
            </div>
          </>
        )}
      </div>

      {/* File previews */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-900">
            Selected Files ({files.length}/{maxFiles})
          </h4>
          <div className="space-y-2">
            {files.map((filePreview, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                data-testid={`file-preview-${index}`}
              >
                {filePreview.type === 'image' && filePreview.preview ? (
                  <img
                    src={filePreview.preview}
                    alt="Preview"
                    className="w-10 h-10 object-cover rounded"
                  />
                ) : filePreview.type === 'image' ? (
                  <Image className="w-10 h-10 text-gray-400" />
                ) : (
                  <File className="w-10 h-10 text-gray-400" />
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {filePreview.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(filePreview.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(index);
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                  disabled={disabled}
                  data-testid={`remove-file-${index}`}
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Compact version for inline use
export function CompactFileUpload({
  onFilesSelect,
  maxFiles = 3,
  acceptedTypes = ['image/*', '.pdf', '.doc', '.docx'],
  disabled = false,
  className
}: Omit<FileUploadProps, 'children' | 'onFilesRemove'>) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelect(Array.from(files));
    }
    e.target.value = '';
  }, [onFilesSelect]);

  return (
    <div className={cn("inline-block", className)}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes.join(',')}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
        data-testid="compact-file-input"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          disabled && "cursor-not-allowed opacity-50"
        )}
        data-testid="compact-upload-button"
      >
        <Paperclip className="w-4 h-4" />
        Attach Files
      </button>
    </div>
  );
}