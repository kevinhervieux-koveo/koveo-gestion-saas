import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { Grid, List, ArrowLeft, Plus, Search, Filter, Building, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/hooks/use-language';
import {
  SharedUploader,
  DocumentCard
} from '@/components/document-management';
import { DocumentCreateForm } from '@/components/document-management/DocumentCreateForm';
import type { DocumentWithMetadata, DocumentPermissions } from '@shared/schemas/documents';

// Document categories for filtering
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
] as const;

interface ModularDocumentPageWrapperProps {
  type: 'building' | 'residence';
  userRole: 'manager' | 'resident';
  backPath: string;
  backLabel?: string;
  entityIdParam: string;
}

export default function ModularDocumentPageWrapper({
  type,
  userRole,
  backPath,
  backLabel,
  entityIdParam,
}: ModularDocumentPageWrapperProps) {
  const [, navigate] = useLocation();
  const params = useParams();
  const { t } = useLanguage();

  // State for document interactions
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // State for filtering and search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Get entityId from URL (both path param and query param)
  const urlParams = new URLSearchParams(window.location.search);
  const entityId = (params as any)[entityIdParam] || urlParams.get(entityIdParam);

  // Get current user
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: () => apiRequest('GET', '/api/auth/user') as Promise<any>,
  });

  // Get entity info based on type
  const entityApiPath = type === 'building' ? '/api/manager/buildings' : '/api/residences';
  const { data: entity, isError: entityError, error } = useQuery({
    queryKey: [entityApiPath, entityId],
    queryFn: async () => {
      if (type === 'residence') {
        const response = await fetch(`/api/residences/${entityId}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('ENTITY_NOT_FOUND');
          }
          throw new Error(`Failed to fetch ${type}`);
        }
        return response.json();
      } else {
        return apiRequest('GET', `${entityApiPath}/${entityId}`) as Promise<any>;
      }
    },
    enabled: !!entityId,
    retry: false, // Don't retry on 404s
  });

  // Fetch documents for this entity
  const { data: documentResponse, isLoading, error: documentsError } = useQuery({
    queryKey: ['/api/documents', type, entityId],
    queryFn: async () => {
      const param = type === 'building' ? 'buildingId' : 'residenceId';
      const response = await apiRequest('GET', `/api/documents?${param}=${entityId}`);
      return response.json();
    },
    enabled: !!entityId,
    staleTime: 0, // Always refetch
    cacheTime: 0, // Don't cache
  });

  // Extract documents array from API response
  console.log('🔍 [API Response Debug] Full response:', documentResponse);
  console.log('🔍 [API Response Debug] Error:', documentsError);
  console.log('🔍 [API Response Debug] Is Loading:', isLoading);
  const documents = Array.isArray(documentResponse?.documents) ? documentResponse.documents : [];

  // Determine permissions based on user role and type
  const isUserTenant = user?.role === 'tenant';
  const isManager = user?.role === 'manager' || user?.role === 'admin';
  
  const userPermissions: DocumentPermissions = userRole === 'manager' 
    ? {
        canView: true,
        canDownload: true,
        canEdit: isManager,
        canDelete: isManager,
        canCreate: isManager,
      }
    : {
        canView: true,
        canDownload: !isUserTenant,
        canEdit: !isUserTenant,
        canDelete: !isUserTenant,
        canCreate: !isUserTenant,
      };

  // Filter and search documents
  const filteredDocuments = Array.isArray(documents) ? documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory || doc.documentType === selectedCategory;

    return matchesSearch && matchesCategory;
  }) : [];

  // Debug logging to understand document structure
  console.log('📄 [ModularDocumentPageWrapper] Debug:', {
    responseReceived: !!documentResponse,
    documentsInResponse: Array.isArray(documentResponse?.documents) ? documentResponse.documents.length : 'none',
    documentsExtracted: documents.length,
    filteredLength: filteredDocuments.length,
    searchTerm,
    selectedCategory
  });

  // Generate entity name based on type
  const entityName = type === 'residence' 
    ? (entity?.unitNumber || entity?.unit_number ? `Unit ${entity.unitNumber || entity.unit_number}` : 'Residence')
    : entity?.name;

  const defaultBackLabel = backLabel || (type === 'building' ? 'Back to Buildings' : t('backToResidences'));

  // Handle document interactions (simplified without modals)
  const handleDocumentView = (documentId: string) => {
    // Simple solution: open document in new tab for viewing
    window.open(`/api/documents/${documentId}/download`, '_blank');
  };

  const handleDocumentEdit = (documentId: string) => {
    // Navigate to a dedicated edit page or show alert for now
    alert('Document editing functionality to be implemented');
  };

  const handleCreateDocument = () => {
    setIsCreateDialogOpen(true);
  };

  const handleDocumentSuccess = (documentId: string) => {
    console.log(`Document created:`, documentId);
    // Refresh documents list will be handled by the DocumentCreateForm's cache invalidation
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
  };

  if (!entityId) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">{type} ID is required</p>
            <Button
              variant="outline"
              onClick={() => navigate(backPath)}
              data-testid="button-back-to-list"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {defaultBackLabel}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Handle entity not found (specific to residence pages that had this logic)
  if (entityError && error?.message === 'ENTITY_NOT_FOUND' && type === 'residence') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-semibold mb-4">Residence Not Found</h2>
            <p className="text-gray-500 mb-4">
              The residence ID "{entityId}" doesn't exist in the development database.
            </p>
            <p className="text-sm text-gray-400 mb-6">
              This might be a production database ID. Please use a valid development residence ID.
            </p>
            <div className="space-y-2">
              <Button
                variant="default"
                onClick={() => navigate(backPath)}
                data-testid="button-back-to-list"
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {backLabel || 'Back to Residences'}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  navigate('/residents/residences/e27ac924-8120-4904-a791-d1e9db544d58/documents')
                }
                data-testid="button-go-to-valid-residence"
                className="w-full"
              >
                Go to Unit 101 (Test Residence)
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with Back Button */}
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            onClick={() => navigate(backPath)}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {defaultBackLabel}
          </Button>
          
          <div className="text-right">
            <h1 className="text-2xl font-semibold">
              {type === 'building' ? <Building className="w-6 h-6 inline mr-2" /> : <Home className="w-6 h-6 inline mr-2" />}
              {entityName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {type === 'building' ? 'Building Documents' : 'Residence Documents'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filters and Search Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Search & Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search documents..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-documents"
                    />
                  </div>
                </div>

                {/* Category Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger data-testid="select-category-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* View Mode Toggle */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">View</label>
                  <div className="flex gap-2">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className="flex-1"
                      data-testid="button-grid-view"
                    >
                      <Grid className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="flex-1"
                      data-testid="button-list-view"
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <label className="text-sm font-medium invisible">Actions</label>
                  <div className="flex gap-2">
                    {userPermissions.canCreate && (
                      <Button 
                        onClick={handleCreateDocument} 
                        className="flex-1"
                        data-testid="button-create-document"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      onClick={clearFilters}
                      data-testid="button-clear-filters"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents Display */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''} found
              </span>
              {(searchTerm || selectedCategory !== 'all') && (
                <Badge variant="secondary">Filtered</Badge>
              )}
            </div>
          </div>

          {/* Documents Content */}
          {isLoading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-500">Loading documents...</p>
              </CardContent>
            </Card>
          ) : filteredDocuments.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                    <Search className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No Documents Found</h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm || selectedCategory !== 'all'
                      ? "No documents match your current filters. Try adjusting your search criteria."
                      : `No documents have been uploaded for this ${type} yet. Create your first document to get started.`
                    }
                  </p>
                  <div className="flex gap-2 justify-center">
                    {(searchTerm || selectedCategory !== 'all') && (
                      <Button variant="outline" onClick={clearFilters}>
                        Clear Filters
                      </Button>
                    )}
                    {userPermissions.canCreate && (
                      <Button onClick={handleCreateDocument}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Document
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className={`grid gap-4 ${
                  viewMode === 'grid' 
                    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                    : 'grid-cols-1'
                }`}>
                  {filteredDocuments.map((document) => (
                    <DocumentCard
                      key={document.id}
                      documentId={document.id}
                      title={document.name}
                      documentType={document.category || document.documentType}
                      createdAt={document.createdAt}
                      onViewClick={handleDocumentView}
                      onEditClick={userPermissions.canEdit ? handleDocumentEdit : undefined}
                      compact={viewMode === 'list'}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Document Creation Dialog */}
          <DocumentCreateForm
            isOpen={isCreateDialogOpen}
            onClose={() => setIsCreateDialogOpen(false)}
            onSuccess={handleDocumentSuccess}
            entityType={type}
            entityId={entityId}
            entityName={entityName}
          />
        </div>
      </div>
    </div>
  );
}