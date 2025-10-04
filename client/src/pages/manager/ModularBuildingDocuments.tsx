import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Grid, List, ArrowLeft, FileText, CheckSquare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  SharedUploader,
  DocumentCard
} from '@/components/document-management';
import { useFilterSort, FilterSortConfig } from '@/lib/filter-sort';
import type { DocumentWithMetadata, DocumentPermissions } from '@shared/schemas/documents';

/**
 * ModularBuildingDocuments - Example integration of new modular document components
 * Demonstrates how to use the new reusable components instead of the monolithic DocumentManager
 */
export default function ModularBuildingDocuments() {
  const [, navigate] = useLocation();
  const params = useParams();
  const buildingId = (params as any).buildingId;
  const queryClient = useQueryClient();

  // State for view mode
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // State for selection mode and bulk operations
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log('🔍 [MODULAR_BUILDING_DOCUMENTS] Component initialized', {
      buildingId,
      timestamp: new Date().toISOString()
    });
  }, [buildingId]);

  // Fetch building info
  const { data: building } = useQuery({
    queryKey: ['/api/manager/buildings', buildingId],
    enabled: !!buildingId,
    queryFn: async () => {
      console.log('🔍 [MODULAR_BUILDING_DOCUMENTS] Fetching building info...', { buildingId });
      const response = await apiRequest('GET', `/api/manager/buildings/${buildingId}`);
      const data = await response.json();
      console.log('🔍 [MODULAR_BUILDING_DOCUMENTS] Building info received:', { buildingName: data?.name });
      return data;
    },
  });

  // Fetch documents for this building
  const { data: documentResponse, isLoading } = useQuery({
    queryKey: ['/api/documents', 'building', buildingId],
    queryFn: async () => {
      console.log('🔍 [MODULAR_BUILDING_DOCUMENTS] Fetching documents...', { buildingId });
      const response = await apiRequest('GET', `/api/documents?buildingId=${buildingId}`);
      const data = await response.json();
      console.log('🔍 [MODULAR_BUILDING_DOCUMENTS] Documents received:', {
        count: data?.documents?.length || 0
      });
      return data;
    },
    enabled: !!buildingId,
  });

  // Extract documents array from API response
  const documents = Array.isArray(documentResponse?.documents) ? documentResponse.documents : [];

  // Get current user for permissions
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      console.log('🔍 [MODULAR_BUILDING_DOCUMENTS] Fetching user info...');
      const response = await apiRequest('GET', '/api/auth/user');
      const data = await response.json();
      console.log('🔍 [MODULAR_BUILDING_DOCUMENTS] User info received:', {
        role: data?.role,
        userId: data?.id
      });
      return data;
    },
  });

  // Determine user permissions based on role
  const userPermissions: DocumentPermissions = {
    canView: true,
    canDownload: true,
    canEdit: user?.role === 'manager' || user?.role === 'admin',
    canDelete: user?.role === 'manager' || user?.role === 'admin',
    canCreate: user?.role === 'manager' || user?.role === 'admin',
  };

  // Configure filter/sort for documents
  const filterSortConfig: FilterSortConfig = useMemo(() => ({
    filters: [
      {
        id: 'documentType',
        field: 'documentType',
        label: 'Category',
        type: 'select',
        icon: FileText,
        options: [
          { label: 'Bylaws', _value: 'bylaw' },
          { label: 'Financial', _value: 'financial' },
          { label: 'Maintenance', _value: 'maintenance' },
          { label: 'Legal', _value: 'legal' },
          { label: 'Meeting Minutes', _value: 'meeting_minutes' },
          { label: 'Insurance', _value: 'insurance' },
          { label: 'Contracts', _value: 'contracts' },
          { label: 'Other', _value: 'other' },
        ],
        defaultOperator: 'equals',
      },
    ],
    sortOptions: [
      { field: 'createdAt', label: 'Date Created', defaultDirection: 'desc' },
      { field: 'updatedAt', label: 'Date Updated', defaultDirection: 'desc' },
      { field: 'name', label: 'Name' },
      { field: 'documentType', label: 'Category' },
    ],
    searchable: true,
    searchPlaceholder: 'Search documents...',
    searchFields: ['name', 'description'],
    allowMultipleFilters: false,
    persistState: true,
    storageKey: `building-${buildingId}-documents-filters`,
  }), [buildingId]);

  // Use filter/sort hook
  const {
    filteredData: filteredDocuments,
    search,
    setSearch,
  } = useFilterSort({
    data: documents,
    config: filterSortConfig,
    initialState: {
      sort: { field: 'createdAt', direction: 'desc' },
    },
  });


  const handleBack = () => {
    console.log('🔍 [MODULAR_BUILDING_DOCUMENTS] Navigating to:', '/manager/buildings');
    navigate('/manager/buildings');
  };

  // Document view handler - opens document in new tab
  const handleDocumentView = (documentId: string) => {
    console.log('🔍 [MODULAR_BUILDING_DOCUMENTS] Opening document:', { documentId });
    window.open(`/api/documents/${documentId}/file`, '_blank');
  };

  // Selection mode handlers
  const handleToggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedDocuments(new Set());
  };

  const handleDocumentSelectionChange = (documentId: string, selected: boolean) => {
    const newSelection = new Set(selectedDocuments);
    if (selected) {
      newSelection.add(documentId);
    } else {
      newSelection.delete(documentId);
    }
    setSelectedDocuments(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedDocuments.size === filteredDocuments.length) {
      setSelectedDocuments(new Set());
    } else {
      const allDocumentIds = new Set(filteredDocuments.map((doc: DocumentWithMetadata) => doc.id));
      setSelectedDocuments(allDocumentIds);
    }
  };

  const handleBulkDelete = async () => {
    const documentIds = Array.from(selectedDocuments);
    const deletePromises = documentIds.map(documentId =>
      apiRequest('DELETE', `/api/documents/${documentId}`)
        .then(() => ({ status: 'fulfilled' as const, documentId }))
        .catch((error) => ({ status: 'rejected' as const, documentId, error }))
    );

    const results = await Promise.allSettled(deletePromises);
    
    const successfulDeletions: string[] = [];
    const failedDeletions: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.status === 'fulfilled') {
        successfulDeletions.push(result.value.documentId);
      } else {
        failedDeletions.push(documentIds[index]);
      }
    });

    if (successfulDeletions.length > 0) {
      toast({
        title: 'Documents deleted',
        description: `Successfully deleted ${successfulDeletions.length} document${successfulDeletions.length > 1 ? 's' : ''}`,
      });
    }

    if (failedDeletions.length > 0) {
      toast({
        title: 'Deletion failed',
        description: `Failed to delete ${failedDeletions.length} document${failedDeletions.length > 1 ? 's' : ''}`,
        variant: 'destructive',
      });
    }

    queryClient.invalidateQueries({
      queryKey: ['/api/documents', 'building', buildingId],
    });
    queryClient.invalidateQueries({
      queryKey: ['/api/documents'],
    });

    setSelectedDocuments(new Set());
    setShowDeleteDialog(false);
    setSelectionMode(false);
  };

  useEffect(() => {
    console.log('🔍 [MODULAR_BUILDING_DOCUMENTS] State updated: View mode', { viewMode });
  }, [viewMode]);

  useEffect(() => {
    console.log('🔍 [MODULAR_BUILDING_DOCUMENTS] State updated: Search', { search });
  }, [search]);

  if (!buildingId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Building ID is required</p>
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Buildings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Buildings
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold">
            {building?.name || 'Building'} Documents
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage documents for {building?.name || 'this building'}
          </p>
        </div>
      </div>

      {/* Search and View Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-documents"
          />
        </div>
        
        <div className="flex gap-2">
          {/* Selection mode controls */}
          {selectionMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                data-testid="button-select-all"
              >
                {selectedDocuments.size === filteredDocuments.length ? 'Deselect All' : 'Select All'}
              </Button>
              {selectedDocuments.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  data-testid="button-bulk-delete"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete ({selectedDocuments.size})
                </Button>
              )}
            </>
          )}
          
          {/* View mode buttons */}
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              console.log('🔍 [MODULAR_BUILDING_DOCUMENTS] User action: Switch to grid view');
              setViewMode('grid');
            }}
            data-testid="button-grid-view"
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              console.log('🔍 [MODULAR_BUILDING_DOCUMENTS] User action: Switch to list view');
              setViewMode('list');
            }}
            data-testid="button-list-view"
          >
            <List className="w-4 h-4" />
          </Button>
          
          {/* Selection mode toggle */}
          {userPermissions.canDelete && (
            <Button
              variant={selectionMode ? 'default' : 'outline'}
              size="sm"
              onClick={handleToggleSelectionMode}
              data-testid="button-toggle-selection-mode"
            >
              <CheckSquare className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Documents Display */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-center">
                <h3 className="text-lg font-medium mb-2">No documents found</h3>
                <p className="text-gray-500 mb-4">
                  {search ? 'No documents match your search.' : 'No documents have been uploaded yet.'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            : "space-y-4"
          }>
            {filteredDocuments.map((document: DocumentWithMetadata) => (
              <DocumentCard
                key={document.id}
                title={document.name}
                documentId={document.id}
                onViewClick={!selectionMode ? handleDocumentView : undefined}
                documentType={document.documentType}
                description={document.description}
                createdAt={document.createdAt ? new Date(document.createdAt).toISOString() : undefined}
                fileSize={document.fileSize ? Number(document.fileSize) : undefined}
                mimeType={document.mimeType}
                uploadedBy={document.uploadedBy?.firstName && document.uploadedBy?.lastName 
                  ? `${document.uploadedBy.firstName} ${document.uploadedBy.lastName}`
                  : document.uploadedBy?.email
                }
                isVisibleToTenants={document.isVisibleToTenants}
                compact={viewMode === 'list'}
                showMetadata={true}
                selectable={selectionMode}
                selected={selectedDocuments.has(document.id)}
                onSelectionChange={handleDocumentSelectionChange}
                data-testid={`document-card-${document.id}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Statistics */}
      {filteredDocuments.length > 0 && (
        <div className="flex justify-between items-center mt-6 pt-4 border-t">
          <p className="text-sm text-gray-500">
            Showing {filteredDocuments.length} of {Array.isArray(documents) ? documents.length : 0} documents
          </p>
          <div className="flex gap-2">
            <Badge variant="outline">
              {Array.isArray(documents) ? documents.filter(d => d.isVisibleToTenants).length : 0} visible to tenants
            </Badge>
            <Badge variant="outline">
              {Array.isArray(documents) ? documents.filter(d => d.documentType === 'bylaw').length : 0} bylaws
            </Badge>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-bulk-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Documents</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedDocuments.size} document{selectedDocuments.size > 1 ? 's' : ''}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete}
              data-testid="button-confirm-bulk-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}