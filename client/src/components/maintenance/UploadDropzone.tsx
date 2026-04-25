import { useState, useCallback, useRef } from 'react';
import { useDropzone, FileRejection, DropzoneOptions } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Upload, 
  File as FileIcon, 
  Image, 
  FileText, 
  X, 
  AlertCircle, 
  CheckCircle2,
  Eye,
  Download,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';

// File types and validation
const ACCEPTED_FILE_TYPES = {
  'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadProgress?: number;
  error?: string;
  status: 'uploading' | 'success' | 'error';
}

interface UploadDropzoneProps {
  onFilesUploaded: (files: UploadedFile[]) => void;
  existingFiles?: UploadedFile[];
  uploadEndpoint?: string;
  maxFiles?: number;
  maxFileSize?: number;
  acceptedFileTypes?: Record<string, string[]>;
  disabled?: boolean;
  className?: string;
  elementId?: string;
  organizationId?: string;
  buildingId?: string;
  allowPreview?: boolean;
  allowDownload?: boolean;
  showProgress?: boolean;
}

/**
 * UploadDropzone component for maintenance journal system
 * Provides drag & drop file upload with validation, progress tracking, and preview
 */
export function UploadDropzone({
  onFilesUploaded,
  existingFiles = [],
  uploadEndpoint = '/api/maintenance/documents/upload',
  maxFiles = MAX_FILES,
  maxFileSize = MAX_FILE_SIZE,
  acceptedFileTypes = ACCEPTED_FILE_TYPES,
  disabled = false,
  className,
  elementId,
  organizationId,
  buildingId,
  allowPreview = true,
  allowDownload = true,
  showProgress = true,
}: UploadDropzoneProps) {
  const { t } = useLanguage();
  const [files, setFiles] = useState<UploadedFile[]>(existingFiles);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [retryAttempts, setRetryAttempts] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // File validation
  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File ${file.name} is too large. Maximum size is ${Math.round(maxFileSize / 1024 / 1024)}MB.`;
    }

    const isValidType = Object.keys(acceptedFileTypes).some(mimeType => {
      return file.type.match(mimeType.replace('*', '.*'));
    });

    if (!isValidType) {
      return `File type ${file.type} is not supported.`;
    }

    return null;
  }, [maxFileSize, acceptedFileTypes]);

  // Upload file with progress tracking
  const uploadFile = useCallback(async (file: File): Promise<UploadedFile> => {
    const formData = new FormData();
    formData.append('file', file);
    
    if (elementId) formData.append('elementId', elementId);
    if (organizationId) formData.append('organizationId', organizationId);
    if (buildingId) formData.append('buildingId', buildingId);

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    
    // Add file to state with uploading status
    const uploadingFile: UploadedFile = {
      id: tempId,
      name: file.name,
      size: file.size,
      type: file.type,
      url: '',
      uploadProgress: 0,
      status: 'uploading',
    };

    setFiles(prev => [...prev, uploadingFile]);

    try {
      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            setFiles(prev => prev.map(f => 
              f.id === tempId 
                ? { ...f, uploadProgress: progress }
                : f
            ));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              const successFile: UploadedFile = {
                id: response.id || tempId,
                name: file.name,
                size: file.size,
                type: file.type,
                url: response.url || response.filePath,
                status: 'success',
                uploadProgress: 100,
              };

              setFiles(prev => prev.map(f => 
                f.id === tempId ? successFile : f
              ));

              resolve(successFile);
            } catch (parseError) {
              const errorFile: UploadedFile = {
                ...uploadingFile,
                status: 'error',
                error: 'Invalid server response',
              };
              
              setFiles(prev => prev.map(f => 
                f.id === tempId ? errorFile : f
              ));
              
              reject(new Error('Invalid server response'));
            }
          } else if (xhr.status === 429) {
            // Rate limit error
            const errorFile: UploadedFile = {
              ...uploadingFile,
              status: 'error',
              error: 'Rate limit exceeded. Please try again later.',
            };
            
            setFiles(prev => prev.map(f => 
              f.id === tempId ? errorFile : f
            ));
            
            reject(new Error('Rate limit exceeded'));
          } else {
            let errorMessage = 'Upload failed';
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              errorMessage = errorResponse.message || errorMessage;
            } catch (e) {
              // Use default message
            }

            const errorFile: UploadedFile = {
              ...uploadingFile,
              status: 'error',
              error: errorMessage,
            };
            
            setFiles(prev => prev.map(f => 
              f.id === tempId ? errorFile : f
            ));
            
            reject(new Error(errorMessage));
          }
        });

        xhr.addEventListener('error', () => {
          const errorFile: UploadedFile = {
            ...uploadingFile,
            status: 'error',
            error: 'Network error occurred',
          };
          
          setFiles(prev => prev.map(f => 
            f.id === tempId ? errorFile : f
          ));
          
          reject(new Error('Network error'));
        });

        xhr.open('POST', uploadEndpoint);
        xhr.send(formData);
      });
    } catch (error) {
      // Remove failed upload from state
      setFiles(prev => prev.filter(f => f.id !== tempId));
      throw error;
    }
  }, [uploadEndpoint, elementId, organizationId, buildingId]);

  // Handle file drop
  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    // Clear previous errors
    setErrors([]);

    // Handle rejected files
    const rejectionErrors = rejectedFiles.map(({ file, errors }) => {
      const errorMessages = errors.map(error => {
        switch (error.code) {
          case 'file-too-large':
            return `${file.name} is too large (max ${Math.round(maxFileSize / 1024 / 1024)}MB)`;
          case 'file-invalid-type':
            return `${file.name} has an unsupported file type`;
          case 'too-many-files':
            return 'Too many files selected';
          default:
            return `${file.name}: ${error.message}`;
        }
      });
      return errorMessages;
    }).flat();

    // Validate accepted files
    const validationErrors: string[] = [];
    const validFiles: File[] = [];

    for (const file of acceptedFiles) {
      const error = validateFile(file);
      if (error) {
        validationErrors.push(error);
      } else {
        validFiles.push(file);
      }
    }

    // Check file count limit
    if (files.length + validFiles.length > maxFiles) {
      validationErrors.push(`Cannot upload more than ${maxFiles} files total`);
      return;
    }

    const allErrors = [...rejectionErrors, ...validationErrors];
    if (allErrors.length > 0) {
      setErrors(allErrors);
      return;
    }

    // Upload valid files
    setIsUploading(true);
    
    try {
      const uploadPromises = validFiles.map(uploadFile);
      const uploadedFiles = await Promise.allSettled(uploadPromises);
      
      const successfulUploads = uploadedFiles
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<UploadedFile>).value);

      const failedUploads = uploadedFiles
        .filter(result => result.status === 'rejected')
        .map(result => (result as PromiseRejectedResult).reason.message);

      if (failedUploads.length > 0) {
        setErrors(failedUploads);
      }

      if (successfulUploads.length > 0) {
        onFilesUploaded(successfulUploads);
        toast({
          title: 'Files uploaded',
          description: `Successfully uploaded ${successfulUploads.length} file(s)`,
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'An unexpected error occurred during upload',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }, [files.length, maxFiles, validateFile, uploadFile, onFilesUploaded, toast, maxFileSize]);

  // Retry upload
  const retryUpload = useCallback(async (file: UploadedFile) => {
    const attempts = retryAttempts[file.id] || 0;
    if (attempts >= 3) {
      toast({
        title: 'Upload failed',
        description: 'Maximum retry attempts reached',
        variant: 'destructive',
      });
      return;
    }

    setRetryAttempts(prev => ({ ...prev, [file.id]: attempts + 1 }));
    
    // Create a mock File object for retry
    try {
      const blob = new Blob([''], { type: file.type });
      const mockFile = new File([blob], file.name, { type: file.type });
      await uploadFile(mockFile);
    } catch (error) {
      console.error('Retry upload failed:', error);
    }
  }, [retryAttempts, uploadFile, toast]);

  // Remove file
  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  // Dropzone configuration
  const dropzoneOptions: DropzoneOptions = {
    onDrop,
    accept: acceptedFileTypes,
    maxFiles,
    maxSize: maxFileSize,
    disabled: disabled || isUploading,
    multiple: maxFiles > 1,
  };

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone(dropzoneOptions);

  // File icon component
  const getFileIcon = useCallback((fileType: string) => {
    if (fileType.startsWith('image/')) return Image;
    if (fileType === 'application/pdf') return FileText;
    return FileIcon;
  }, []);

  // Format file size
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  return (
    <div className={cn('space-y-4', className)} data-testid="upload-dropzone">
      {/* Dropzone */}
      <Card
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed transition-colors cursor-pointer',
          isDragActive && 'border-primary bg-primary/5',
          isDragReject && 'border-destructive bg-destructive/5',
          disabled && 'cursor-not-allowed opacity-50',
          !isDragActive && !isDragReject && 'border-muted-foreground/25 hover:border-primary/50'
        )}
        data-testid="dropzone-area"
      >
        <CardContent className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <Upload className={cn(
            'h-10 w-10 mb-4',
            isDragActive ? 'text-primary' : 'text-muted-foreground'
          )} />
          
          <div className="space-y-2">
            <p className="text-lg font-medium">
              {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-sm text-muted-foreground">
              or click to select files
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Maximum {maxFiles} files, up to {Math.round(maxFileSize / 1024 / 1024)}MB each</p>
              <p>{t('supportedImagesPdfDocXlsTxt')}</p>
            </div>
          </div>

          <input {...getInputProps()} ref={fileInputRef} data-testid="file-input" />
        </CardContent>
      </Card>

      {/* Errors */}
      {errors.length > 0 && (
        <Alert variant="destructive" data-testid="upload-errors">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2" data-testid="file-list">
          <h4 className="text-sm font-medium">
            Uploaded Files ({files.length}/{maxFiles})
          </h4>
          
          {files.map((file) => {
            const FileIcon = getFileIcon(file.type);
            const isImage = file.type.startsWith('image/');
            
            return (
              <Card key={file.id} className="p-3" data-testid={`file-item-${file.id}`}>
                <div className="flex items-center space-x-3">
                  <FileIcon className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <div className="flex items-center space-x-2">
                        {file.status === 'success' && (
                          <>
                            {allowPreview && isImage && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(file.url, '_blank')}
                                data-testid={`preview-button-${file.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {allowDownload && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(file.url, '_blank')}
                                data-testid={`download-button-${file.id}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                        
                        {file.status === 'error' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => retryUpload(file)}
                            data-testid={`retry-button-${file.id}`}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(file.id)}
                          data-testid={`remove-button-${file.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatFileSize(file.size)}</span>
                      <div className="flex items-center space-x-2">
                        {file.status === 'uploading' && (
                          <Badge variant="secondary">
                            Uploading {Math.round(file.uploadProgress || 0)}%
                          </Badge>
                        )}
                        {file.status === 'success' && (
                          <Badge variant="success">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Uploaded
                          </Badge>
                        )}
                        {file.status === 'error' && (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {showProgress && file.status === 'uploading' && (
                      <Progress 
                        value={file.uploadProgress || 0} 
                        className="h-2"
                        data-testid={`progress-${file.id}`}
                      />
                    )}
                    
                    {file.error && (
                      <p className="text-xs text-destructive">{file.error}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { UploadedFile, UploadDropzoneProps };