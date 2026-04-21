import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { UploadDropzone, UploadedFile } from '@/components/maintenance/UploadDropzone';
// import { useBuildingContext } from '@/hooks/use-building-context';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { BuildingElement } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import {
  FileText,
  Image,
  File as FileIcon,
  Download,
  Eye,
  Trash2,
  Upload,
  Camera,
  Shield,
  FileCheck,
  AlertTriangle,
  Plus,
  Grid,
  List,
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

interface DocumentManagerProps {
  element: BuildingElement;
  className?: string;
  onDocumentUploaded?: (document: DocumentFile) => void;
  onDocumentDeleted?: (documentId: string) => void;
  showUpload?: boolean;
  viewMode?: 'grid' | 'list';
  buildingId?: string;
  organizationId?: string;
}

/**
 * DocumentManager component for managing element documents and files
 * Supports categorized uploads, previews, and document organization
 */
export function DocumentManager({
  element,
  className,
  onDocumentUploaded,
  onDocumentDeleted,
  showUpload = true,
  viewMode: initialViewMode = 'grid',
  buildingId,
  organizationId,
}: DocumentManagerProps) {
  // Simplified placeholder - no context for now
  const hasPermission = () => true;
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialViewMode);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  const canManageDocuments = hasPermission('canManageDocuments');

  // Fetch element documents
  const {
    data: documentsResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/maintenance/elements', element.id, 'documents'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/elements/${element.id}/documents`);
      return await response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const documents: DocumentFile[] = documentsResponse?.documents || [];

  // Delete document mutation
  const deleteMutation = useCreateUpdateMutation<unknown, string>({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest('DELETE', `/api/maintenance/elements/${element.id}/documents/${documentId}`);
      return await response.json();
    },
    successTitle: 'Document deleted',
    successMessage: 'The document has been removed successfully',
    errorTitle: 'Delete failed',
    errorMessage: (error: any) => error?.message || 'Failed to delete document',
    queryKeysToInvalidate: [['/api/maintenance/elements', element.id, 'documents']],
  });

  const handleDeleteDocument = useCallback((documentId: string) => {
    deleteMutation.mutate(documentId, {
      onSuccess: () => onDocumentDeleted?.(documentId),
    });
  }, [deleteMutation, onDocumentDeleted]);

  // Categorize documents
  const categorizedDocuments = useMemo(() => {
    const categories = {
      all: documents,
      images: documents.filter(doc => doc.category === 'image' || doc.type.startsWith('image/')),
      pdfs: documents.filter(doc => doc.category === 'pdf' || doc.type === 'application/pdf'),
      warranties: documents.filter(doc => doc.category === 'warranty'),
      specifications: documents.filter(doc => doc.category === 'specification'),
      reports: documents.filter(doc => doc.category === 'report'),
    };
    
    return categories;
  }, [documents]);

  // Handle file upload success
  const handleFilesUploaded = useCallback((uploadedFiles: UploadedFile[]) => {
    // Convert UploadedFile to DocumentFile format
    const newDocuments = uploadedFiles.map(file => {
      let category: DocumentFile['category'];
      
      if (file.type.startsWith('image/')) {
        category = 'image';
      } else if (file.type === 'application/pdf') {
        category = 'pdf';
      } else {
        // Default to 'report' for other document types
        category = 'report';
      }
      
      return {
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        url: file.url,
        category,
        uploadedAt: new Date().toISOString(),
        description: '',
      };
    });

    newDocuments.forEach(doc => onDocumentUploaded?.(doc));
    
    // Refresh documents list
    queryClient.invalidateQueries({ queryKey: ['/api/maintenance/elements', element.id, 'documents'] });
    
    setShowUploadDialog(false);
  }, [element.id, onDocumentUploaded]);

  // Get file icon
  const getFileIcon = useCallback((fileType: string, category?: string) => {
    if (category === 'image' || (fileType && fileType.startsWith('image/'))) return Image;
    if (category === 'pdf' || fileType === 'application/pdf') return FileText;
    if (category === 'warranty') return Shield;
    if (category === 'specification') return FileCheck;
    if (category === 'report') return FileText;
    return FileIcon;
  }, []);

  // Get category badge variant
  const getCategoryBadgeVariant = useCallback((category: string) => {
    switch (category) {
      case 'image': return 'default' as const;
      case 'pdf': return 'secondary' as const;
      case 'warranty': return 'outline' as const;
      case 'specification': return 'destructive' as const;
      case 'report': return 'default' as const;
      default: return 'outline' as const;
    }
  }, []);

  // Format file size
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // Render document card
  const renderDocumentCard = useCallback((doc: DocumentFile) => {
    const Icon = getFileIcon(doc.type, doc.category);
    const isImage = doc.type && doc.type.startsWith('image/');

    return (
      <Card 
        key={doc.id} 
        className="group hover:shadow-md transition-shadow"
        data-testid={`document-card-${doc.id}`}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Document preview/icon */}
            <div className="relative">
              {isImage ? (
                <div className="aspect-video bg-muted rounded-md overflow-hidden">
                  <img
                    src={doc.url}
                    alt={doc.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                  <Icon className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              
              {/* Category badge */}
              <Badge
                variant={getCategoryBadgeVariant(doc.category)}
                className="absolute top-2 left-2 text-xs"
              >
                {doc.category}
              </Badge>
            </div>

            {/* Document info */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm truncate" title={doc.name}>
                {doc.name}
              </h4>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatFileSize(doc.size)}</span>
                <span>{format(new Date(doc.uploadedAt), 'MMM d, yyyy')}</span>
              </div>

              {doc.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {doc.description}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                data-testid={`preview-${doc.id}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = doc.url;
                  a.download = doc.name;
                  a.click();
                }}
                data-testid={`download-${doc.id}`}
              >
                <Download className="h-4 w-4" />
              </Button>
              
              {canManageDocuments && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      data-testid={`delete-${doc.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Document</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{doc.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }, [getFileIcon, getCategoryBadgeVariant, formatFileSize, canManageDocuments, deleteMutation]);

  // Render document list item
  const renderDocumentListItem = useCallback((doc: DocumentFile) => {
    const Icon = getFileIcon(doc.type, doc.category);

    return (
      <div 
        key={doc.id}
        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors group"
        data-testid={`document-list-${doc.id}`}
      >
        <div className="flex-shrink-0">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm truncate">{doc.name}</h4>
            <Badge variant={getCategoryBadgeVariant(doc.category)} className="text-xs">
              {doc.category}
            </Badge>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{formatFileSize(doc.size)}</span>
            <span>{format(new Date(doc.uploadedAt), 'MMM d, yyyy')}</span>
            {doc.uploadedBy && <span>by {doc.uploadedBy}</span>}
          </div>
          
          {doc.description && (
            <p className="text-xs text-muted-foreground truncate">
              {doc.description}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
          >
            <Eye className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const a = document.createElement('a');
              a.href = doc.url;
              a.download = doc.name;
              a.click();
            }}
          >
            <Download className="h-4 w-4" />
          </Button>
          
          {canManageDocuments && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Document</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{doc.name}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDeleteDocument(doc.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    );
  }, [getFileIcon, getCategoryBadgeVariant, formatFileSize, canManageDocuments, deleteMutation]);

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to load documents</h3>
          <p className="text-muted-foreground">
            {error instanceof Error ? error.message : 'An error occurred while loading documents'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)} data-testid="document-manager">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Documents & Files
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                data-testid="grid-view-button"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                data-testid="list-view-button"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            
            {showUpload && canManageDocuments && (
              <Button 
                onClick={() => setShowUploadDialog(true)}
                data-testid="upload-documents-button"
              >
                <Plus className="h-4 w-4 mr-2" />
                Upload
              </Button>
            )}
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          {documents.length} document(s) for {element.name}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Upload dialog */}
        {showUploadDialog && (
          <div className="border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Upload Documents</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUploadDialog(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <UploadDropzone
              onFilesUploaded={handleFilesUploaded}
              elementId={element.id}
              organizationId={organizationId}
              buildingId={buildingId}
              maxFiles={10}
              acceptedFileTypes={{
                'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
                'application/pdf': ['.pdf'],
                'text/plain': ['.txt'],
                'application/msword': ['.doc'],
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                'application/vnd.ms-excel': ['.xls'],
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
              }}
            />
          </div>
        )}

        {/* Category tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="all" className="text-xs">
              All ({categorizedDocuments.all.length})
            </TabsTrigger>
            <TabsTrigger value="images" className="text-xs">
              <Image className="h-3 w-3 mr-1" />
              Images ({categorizedDocuments.images.length})
            </TabsTrigger>
            <TabsTrigger value="pdfs" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              PDFs ({categorizedDocuments.pdfs.length})
            </TabsTrigger>
            <TabsTrigger value="warranties" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              Warranties ({categorizedDocuments.warranties.length})
            </TabsTrigger>
            <TabsTrigger value="specifications" className="text-xs">
              <FileCheck className="h-3 w-3 mr-1" />
              Specs ({categorizedDocuments.specifications.length})
            </TabsTrigger>
            <TabsTrigger value="reports" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              Reports ({categorizedDocuments.reports.length})
            </TabsTrigger>
          </TabsList>

          {Object.entries(categorizedDocuments).map(([category, docs]) => (
            <TabsContent key={category} value={category} className="mt-4">
              {isLoading ? (
                <div className={cn(
                  viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'
                )}>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton 
                      key={index} 
                      className={cn(
                        viewMode === 'grid' ? 'h-48' : 'h-16'
                      )} 
                    />
                  ))}
                </div>
              ) : docs.length > 0 ? (
                <div 
                  className={cn(
                    viewMode === 'grid' 
                      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' 
                      : 'space-y-2'
                  )}
                  data-testid={`documents-${category}`}
                >
                  {docs.map(doc => 
                    viewMode === 'grid' 
                      ? renderDocumentCard(doc) 
                      : renderDocumentListItem(doc)
                  )}
                </div>
              ) : (
                <div className="text-center py-8" data-testid={`no-documents-${category}`}>
                  <FileIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No {category === 'all' ? 'documents' : category === 'images' ? 'images' : category === 'pdfs' ? 'PDFs' : category} found
                  </p>
                  {showUpload && canManageDocuments && (
                    <Button
                      variant="outline"
                      className="mt-2"
                      onClick={() => setShowUploadDialog(true)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload First Document
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

export type { DocumentManagerProps, DocumentFile };