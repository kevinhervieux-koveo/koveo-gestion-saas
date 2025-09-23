import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, AlertCircle, Loader2, Plus, Search, Filter } from 'lucide-react';
import { DocumentCard } from '@/components/document-management/DocumentCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useDocumentPermissions } from '@/components/document-management/DocumentContext';

interface Document {
  id: string;
  name: string;
  documentType?: string;
  description?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy?: any;
  createdAt?: string;
  isVisibleToTenants?: boolean;
}

interface DocumentContextConfig {
  entityType: 'building' | 'residence' | 'element' | 'project' | 'organization' | 'bill' | 'bug' | 'feature';
  entityId: string;
  entityName?: string;
  
  // Access control
  canView?: boolean;
  canEdit?: boolean;
  canCreate?: boolean;
  canDelete?: boolean;
  
  // API configuration
  apiEndpoint?: string;
  queryKey?: string[];
  
  // UI configuration
  showSearch?: boolean;
  showFilter?: boolean;
  showCreateButton?: boolean;
  gridView?: boolean;
  compact?: boolean;
}

interface UnifiedDocumentViewerProps {
  config: DocumentContextConfig;
  className?: string;
  onDocumentCreate?: () => void;
  onDocumentEdit?: (documentId: string) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
}

const DOCUMENT_CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'bylaw', label: 'Bylaws' },
  { value: 'financial', label: 'Financial' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'legal', label: 'Legal' },
  { value: 'meeting_minutes', label: 'Meeting Minutes' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'contracts', label: 'Contracts' },
  { value: 'permits', label: 'Permits' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
];

/**
 * UnifiedDocumentViewer - A consistent document viewer for all entity types
 * Provides standardized document display patterns across the application
 */
export function UnifiedDocumentViewer({
  config,
  className,
  onDocumentCreate,
  onDocumentEdit,
  searchTerm = '',
  onSearchChange,
  selectedCategory = 'all',
  onCategoryChange,
}: UnifiedDocumentViewerProps) {
  const { toast } = useToast();
  
  // Get permissions from context (with config overrides)
  const contextPermissions = useDocumentPermissions(config.entityType, config.entityId);
  const permissions = {
    canView: config.canView ?? contextPermissions.canView,
    canCreate: config.canCreate ?? contextPermissions.canCreate,
    canEdit: config.canEdit ?? contextPermissions.canEdit,
    canDelete: config.canDelete ?? contextPermissions.canDelete,
  };

  // Generate API endpoint based on entity type
  const getApiEndpoint = () => {
    if (config.apiEndpoint) return config.apiEndpoint;
    
    switch (config.entityType) {
      case 'building':
        return `/api/documents?buildingId=${config.entityId}`;
      case 'residence':
        return `/api/documents?residenceId=${config.entityId}`;
      case 'element':
        return `/api/maintenance/elements/${config.entityId}/documents`;
      case 'organization':
        return `/api/documents?organizationId=${config.entityId}`;
      default:
        // For other entity types, use the main documents endpoint with attachedToType
        return `/api/documents?attachedToType=${config.entityType}&attachedToId=${config.entityId}`;
    }
  };

  // Generate query key
  const getQueryKey = () => {
    if (config.queryKey) return config.queryKey;
    
    return ['/api/documents', config.entityType, config.entityId];
  };

  const { data: documentsResponse, isLoading, error, refetch } = useQuery({
    queryKey: getQueryKey(),
    queryFn: async () => {
      const response = await fetch(getApiEndpoint(), {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!config.entityId && permissions.canView,
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
    } catch (e: any) {
      console.error('[DOCUMENT VIEW] Failed to view document:', e);
      toast({
        title: 'Error',
        description: `Failed to view document: ${e?.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  };

  // Support both response shapes: { documents, total } and { data, total }
  const documents = documentsResponse?.documents || documentsResponse?.data || [];
  const totalDocuments = documentsResponse?.total || documents.length;

  // Filter documents based on search and category
  const filteredDocuments = Array.isArray(documents) ? documents.filter((doc: Document) => {
    const matchesSearch = !searchTerm || 
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || doc.documentType === selectedCategory;
    
    return matchesSearch && matchesCategory;
  }) : [];

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
            Failed to load documents: {(error as any)?.message || 'Unknown error'}
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-retry-documents">
          <FileText className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with title and actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">
            Documents ({totalDocuments})
          </h3>
          {config.entityName && (
            <p className="text-sm text-muted-foreground">{config.entityName}</p>
          )}
        </div>
        
        {config.showCreateButton && permissions.canCreate && (
          <Button onClick={onDocumentCreate} data-testid="button-create-document">
            <Plus className="w-4 h-4 mr-2" />
            Add Document
          </Button>
        )}
      </div>

      {/* Search and Filter Controls */}
      {(config.showSearch || config.showFilter) && (
        <div className="flex gap-4 items-center">
          {config.showSearch && onSearchChange && (
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
                data-testid="input-search-documents"
              />
            </div>
          )}
          
          {config.showFilter && onCategoryChange && (
            <Select value={selectedCategory} onValueChange={onCategoryChange}>
              <SelectTrigger className="w-48" data-testid="select-document-category">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Documents Grid/List */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {documents.length === 0 
              ? `No documents found for ${config.entityName || 'this item'}`
              : 'No documents match your search criteria'
            }
          </p>
          {config.showCreateButton && permissions.canCreate && (
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={onDocumentCreate}
              data-testid="button-create-first-document"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Document
            </Button>
          )}
        </div>
      ) : (
        <div className={
          config.gridView 
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            : "space-y-2"
        }>
          {filteredDocuments.map((doc: Document) => (
            <DocumentCard
              key={doc.id}
              title={doc.name}
              documentId={doc.id}
              onViewClick={handleViewDocument}
              documentType={doc.documentType}
              description={doc.description}
              createdAt={doc.createdAt}
              fileSize={doc.fileSize}
              mimeType={doc.mimeType}
              uploadedBy={
                doc.uploadedBy?.firstName && doc.uploadedBy?.lastName 
                  ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`
                  : doc.uploadedBy?.email || undefined
              }
              isVisibleToTenants={doc.isVisibleToTenants}
              className="h-full"
              compact={config.compact || !config.gridView}
              showMetadata={true}
              data-testid={`document-card-${doc.id}`}
            />
          ))}
        </div>
      )}
      
      {totalDocuments > filteredDocuments.length && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            Showing {filteredDocuments.length} of {totalDocuments} documents
          </p>
        </div>
      )}
    </div>
  );
}