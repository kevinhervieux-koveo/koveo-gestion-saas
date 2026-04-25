import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CustomFileUploader } from './CustomFileUploader';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { BuildingElement } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import {
  FileText,
  Image,
  File as FileIcon,
  Download,
  Eye,
  Trash2,
  Upload,
  Paperclip,
  Plus,
  Camera,
  X,
} from 'lucide-react';

interface DocumentFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  category: 'image' | 'pdf' | 'specification' | 'warranty' | 'report';
  uploadedAt: string;
  uploadedBy?: string;
  description?: string;
}

interface DocumentAttachmentManagerProps {
  element?: BuildingElement | null;
  mode: 'view' | 'edit' | 'create';
  buildingId: string;
  organizationId: string;
  className?: string;
  onDocumentUploaded?: (document: DocumentFile) => void;
  onDocumentDeleted?: (documentId: string) => void;
}

/**
 * DocumentAttachmentManager - Handles document attachments for inventory elements
 * with different behaviors based on view/edit/create modes
 */
export function DocumentAttachmentManager({
  element,
  mode,
  buildingId,
  organizationId,
  className,
  onDocumentUploaded,
  onDocumentDeleted,
}: DocumentAttachmentManagerProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [showUploader, setShowUploader] = useState(false);

  // Only fetch documents if we have an element (not in CREATE mode)
  const {
    data: documentsResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/maintenance/elements', element?.id, 'documents'],
    queryFn: async () => {
      if (!element?.id) return { documents: [] };
      const response = await apiRequest('GET', `/api/maintenance/elements/${element?.id}/documents`);
      return await response.json();
    },
    enabled: !!element?.id && mode !== 'create',
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Transform API response to DocumentFile format
  const documents: DocumentFile[] = documentsResponse?.data?.map((doc: any) => ({
    id: doc.id,
    name: doc.fileName || 'Unknown',
    type: doc.mimeType || 'application/octet-stream',
    size: doc.fileSize || 0,
    url: `/api/maintenance/documents/${doc.id}`,
    category: doc.documentType || 'document',
    uploadedAt: doc.uploadedAt || new Date().toISOString(),
  })) || [];

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest('DELETE', `/api/maintenance/documents/${documentId}`);
      return await response.json();
    },
    onSuccess: (_, documentId) => {
      if (element?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/maintenance/elements', element?.id, 'documents'] });
      }
      onDocumentDeleted?.(documentId);
      toast({
        title: 'Document deleted',
        description: 'The document has been removed successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete document',
        variant: 'destructive',
      });
    },
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!element?.id) {
        throw new Error('Cannot upload documents before element is saved. Please save the element first.');
      }
      
      const formData = new FormData();
      formData.append('file', file);
      
      // Determine document type based on file type
      let documentType: 'image' | 'pdf' | 'specification' | 'warranty' | 'report' = 'report';
      if (file.type.startsWith('image/')) {
        documentType = 'image';
      } else if (file.type === 'application/pdf') {
        documentType = 'pdf';
      }
      formData.append('documentType', documentType);
      
      const response = await apiRequest('POST', `/api/maintenance/elements/${element?.id}/documents`, formData);
      
      return await response.json();
    },
    onSuccess: (response) => {
      if (element?.id) {
        // Invalidate and refetch documents
        queryClient.invalidateQueries({ queryKey: ['/api/maintenance/elements', element?.id, 'documents'] });
      }
      
      // Handle response data safely
      if (response?.data) {
        onDocumentUploaded?.({
          id: response.data.id || `doc-${Date.now()}`,
          name: response.data.fileName || response.data.name || 'Unknown',
          type: response.data.mimeType || response.data.type || 'application/octet-stream',
          size: response.data.fileSize || response.data.size || 0,
          url: `/api/maintenance/documents/${response.data.id}`,
          category: response.data.documentType || response.data.category || 'document',
          uploadedAt: response.data.uploadedAt || new Date().toISOString(),
        });
      }
      
      setShowUploader(false);
      toast({
        title: 'Document uploaded',
        description: 'The document has been uploaded successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload document',
        variant: 'destructive',
      });
    },
  });

  // Handle file selection
  const handleFileSelect = useCallback((files: File[]) => {
    if (files.length > 0 && !uploadMutation.isPending) {
      if (!element?.id) {
        toast({
          title: 'Cannot upload documents',
          description: 'Please save the element first before uploading documents.',
          variant: 'destructive',
        });
        return;
      }
      uploadMutation.mutate(files[0]);
    }
  }, [uploadMutation, element?.id, toast]);

  // Get file icon based on type
  const getFileIcon = useCallback((fileType: string, category?: string) => {
    if (category === 'image' || (fileType && fileType.startsWith('image/'))) return Image;
    if (category === 'pdf' || fileType === 'application/pdf') return FileText;
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

  // Handle view document
  const handleViewDocument = useCallback((doc: DocumentFile) => {
    window.open(`/api/maintenance/documents/${doc.id}`, '_blank', 'noopener,noreferrer');
  }, []);

  // Handle download document
  const handleDownloadDocument = useCallback(async (doc: DocumentFile) => {
    try {
      const response = await fetch(`/api/maintenance/documents/${doc.id}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[DOWNLOAD] File download failed:', error);
      toast({
        title: 'Download failed',
        description: 'Failed to download document',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Render document item
  const renderDocumentItem = useCallback((doc: DocumentFile) => {
    const Icon = getFileIcon(doc.type, doc.category);
    
    return (
      <div
        key={doc.id}
        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
        data-testid={`document-item-${doc.id}`}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-gray-500" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">{doc.name}</span>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{formatFileSize(doc.size)}</span>
              <Badge variant="outline" className="text-xs">
                {doc.category}
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleViewDocument(doc)}
            data-testid={`button-view-document-${doc.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleDownloadDocument(doc)}
            data-testid={`button-download-document-${doc.id}`}
          >
            <Download className="h-4 w-4" />
          </Button>
          
          {/* Only show remove button in EDIT mode */}
          {mode === 'edit' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid={`button-delete-document-${doc.id}`}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Document</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('areYouSureYouWantTo2')}{doc.name}{t('thisActionCannotBeUndone')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate(doc.id)}
                    disabled={deleteMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    );
  }, [mode, getFileIcon, formatFileSize, handleViewDocument, handleDownloadDocument, deleteMutation]);

  // Determine whether to show upload interface
  const shouldShowUploadInterface = useMemo(() => {
    if (mode === 'create') return false; // Don't show in create mode - element must be saved first
    if (mode === 'view') return false; // Never show in view mode
    if (mode === 'edit') {
      // In edit mode, show if no documents exist or user clicked add
      return documents.length === 0 || showUploader;
    }
    return false;
  }, [mode, documents.length, showUploader]);

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Asset Documentation
          {documents.length > 0 && (
            <Badge variant="secondary" data-testid="badge-document-count">
              {documents.length} file{documents.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </h4>
        
        {/* Add button for edit mode when documents exist and uploader is not shown */}
        {mode === 'edit' && documents.length > 0 && !showUploader && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowUploader(true)}
            data-testid="button-add-document"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Document
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {mode === 'view' 
          ? 'Attached documents for this asset'
          : mode === 'create'
            ? 'Documents can be uploaded after saving the element'
            : 'Upload pictures and documents to help with identification and condition assessment'
        }
      </p>

      {/* Show existing documents (for VIEW and EDIT modes) */}
      {mode !== 'create' && documents.length > 0 && (
        <div className="space-y-2" data-testid="existing-documents">
          {documents.map(renderDocumentItem)}
        </div>
      )}

      {/* Show upload interface based on mode and conditions */}
      {shouldShowUploadInterface && (
        <div className="space-y-2">
          {mode === 'edit' && documents.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Add New Document</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowUploader(false)}
                data-testid="button-cancel-upload"
              >
                Cancel
              </Button>
            </div>
          )}
          
          <CustomFileUploader
            onFileSelect={handleFileSelect}
            allowedFileTypes={[
              'image/jpeg',
              'image/png', 
              'image/gif',
              'image/webp',
              'application/pdf'
            ]}
            maxFileSize={10}
            disabled={uploadMutation.isPending}
            isUploading={uploadMutation.isPending}
            className="min-h-32"
            data-testid="document-uploader"
          />
        </div>
      )}

      {/* No documents message for VIEW mode */}
      {mode === 'view' && documents.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t('noDocumentsAttachedToThisAsset')}</p>
        </div>
      )}

      {/* No documents message for CREATE mode */}
      {mode === 'create' && (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t('saveTheElementToEnableDocument')}</p>
        </div>
      )}

      {/* No documents message for EDIT mode */}
      {mode === 'edit' && documents.length === 0 && !shouldShowUploadInterface && (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No documents attached</p>
        </div>
      )}

      {error && (
        <div className="text-center py-4 text-red-500">
          <p className="text-sm">Failed to load documents</p>
        </div>
      )}
    </div>
  );
}