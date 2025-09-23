import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, AlertCircle, Loader2 } from 'lucide-react';
import { DocumentCard } from '@/components/document-management/DocumentCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ElementDocument {
  id: string;
  documentType: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy?: string;
  uploadedAt?: string;
}

interface ElementDocumentViewerProps {
  elementId: string;
  elementName?: string;
  className?: string;
}

/**
 * ElementDocumentViewer - Displays documents associated with a building element
 * Uses the same DocumentCard pattern as other parts of the application
 */
export function ElementDocumentViewer({ elementId, elementName, className }: ElementDocumentViewerProps) {
  const { toast } = useToast();
  
  const { data: documentsResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/maintenance/elements', elementId, 'documents'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/elements/${elementId}/documents`);
      return response.json();
    },
    enabled: !!elementId,
  });

  const handleViewDocument = async (documentId: string) => {
    try {
      // Open document in new tab using the file resolver endpoint
      const response = await fetch(`/api/documents/${documentId}/file`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load document: ${response.status}`);
      }
      
      // Create blob URL and open in new tab
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const newTab = window.open(url, '_blank');
      
      if (!newTab) {
        throw new Error('Popup blocked - please allow popups for this site');
      }
      
      // Clean up the blob URL after a short delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('[DOCUMENT VIEW] Failed to view document:', error);
      toast({
        title: 'Error',
        description: `Failed to view document: ${error.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Loading documents...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load documents: {error.message}
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-retry-documents">
          <FileText className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const documents = documentsResponse?.documents || [];
  const totalDocuments = documentsResponse?.total || 0;

  if (documents.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          No documents found for {elementName || 'this element'}
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Documents ({totalDocuments})
        </h3>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc: ElementDocument) => (
          <DocumentCard
            key={doc.id}
            title={doc.fileName}
            documentId={doc.id}
            onViewClick={handleViewDocument}
            documentType={doc.documentType}
            createdAt={doc.uploadedAt}
            fileSize={doc.fileSize}
            mimeType={doc.mimeType}
            uploadedBy={doc.uploadedBy}
            className="h-full"
            compact={false}
            showMetadata={true}
            data-testid={`element-document-card-${doc.id}`}
          />
        ))}
      </div>
      
      {totalDocuments > documents.length && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            Showing {documents.length} of {totalDocuments} documents
          </p>
        </div>
      )}
    </div>
  );
}