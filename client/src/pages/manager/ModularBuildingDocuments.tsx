import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Grid, List, ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import {
  SharedUploader,
  DocumentCard,
  DocumentViewModal,
  DocumentEditModal
} from '@/components/document-management';
import type { DocumentWithMetadata, DocumentPermissions } from '@shared/schemas/documents';

/**
 * ModularBuildingDocuments - Example integration of new modular document components
 * Demonstrates how to use the new reusable components instead of the monolithic DocumentManager
 */
export default function ModularBuildingDocuments() {
  const [, navigate] = useLocation();
  const params = useParams();
  const buildingId = (params as any).buildingId;

  // State for modals and interactions
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Fetch building info
  const { data: building } = useQuery({
    queryKey: ['/api/manager/buildings', buildingId],
    enabled: !!buildingId,
  });

  // Fetch documents for this building
  const { data: documents = [], isLoading } = useQuery<DocumentWithMetadata[]>({
    queryKey: ['/api/documents', 'building', buildingId],
    queryFn: () => apiRequest('GET', `/api/documents?buildingId=${buildingId}`),
    enabled: !!buildingId,
  });

  // Get current user for permissions
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: () => apiRequest('GET', '/api/auth/user'),
  });

  // Determine user permissions based on role
  const userPermissions: DocumentPermissions = {
    canView: true,
    canDownload: true,
    canEdit: user?.role === 'manager' || user?.role === 'admin',
    canDelete: user?.role === 'manager' || user?.role === 'admin',
    canCreate: user?.role === 'manager' || user?.role === 'admin',
  };

  // Filter documents based on search
  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle document interactions
  const handleDocumentView = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setIsViewModalOpen(true);
  };

  const handleDocumentEdit = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setIsEditModalOpen(true);
    setIsViewModalOpen(false);
  };

  const handleCreateDocument = () => {
    setSelectedDocumentId(null);
    setIsCreating(true);
    setIsEditModalOpen(true);
  };

  const handleDocumentSuccess = (documentId: string, action: 'created' | 'updated' | 'deleted') => {
    console.log(`Document ${action}:`, documentId);
    setIsEditModalOpen(false);
    setIsViewModalOpen(false);
    setIsCreating(false);
    setSelectedDocumentId(null);
    // Optionally show a success toast or refresh the data
  };

  const handleBack = () => {
    navigate('/manager/buildings');
  };

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
          
          {userPermissions.canCreate && (
            <Button onClick={handleCreateDocument} data-testid="button-create-document">
              <Plus className="w-4 h-4 mr-2" />
              Add Document
            </Button>
          )}
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
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-documents"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
            data-testid="button-grid-view"
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            data-testid="button-list-view"
          >
            <List className="w-4 h-4" />
          </Button>
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
                  {searchTerm ? 'No documents match your search.' : 'No documents have been uploaded yet.'}
                </p>
                {userPermissions.canCreate && !searchTerm && (
                  <Button onClick={handleCreateDocument}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Document
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            : "space-y-4"
          }>
            {filteredDocuments.map((document) => (
              <DocumentCard
                key={document.id}
                title={document.name}
                documentId={document.id}
                onViewClick={handleDocumentView}
                documentType={document.documentType}
                description={document.description}
                createdAt={document.createdAt}
                fileSize={document.fileSize ? Number(document.fileSize) : undefined}
                mimeType={document.mimeType}
                uploadedBy={document.uploadedBy?.firstName && document.uploadedBy?.lastName 
                  ? `${document.uploadedBy.firstName} ${document.uploadedBy.lastName}`
                  : document.uploadedBy?.email
                }
                isVisibleToTenants={document.isVisibleToTenants}
                compact={viewMode === 'list'}
                showMetadata={true}
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
            Showing {filteredDocuments.length} of {documents.length} documents
          </p>
          <div className="flex gap-2">
            <Badge variant="outline">
              {documents.filter(d => d.isVisibleToTenants).length} visible to tenants
            </Badge>
            <Badge variant="outline">
              {documents.filter(d => d.documentType === 'bylaw').length} bylaws
            </Badge>
          </div>
        </div>
      )}

      {/* Modals */}
      <DocumentViewModal
        documentId={selectedDocumentId || ''}
        userPermissions={userPermissions}
        onEditClick={handleDocumentEdit}
        isOpen={isViewModalOpen}
        onOpenChange={setIsViewModalOpen}
      />

      <DocumentEditModal
        documentId={isCreating ? undefined : selectedDocumentId || undefined}
        entityType="building"
        entityId={buildingId}
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSuccess={handleDocumentSuccess}
      />
    </div>
  );
}