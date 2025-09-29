import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Grid, List, Plus, Search, Building, Home, Filter, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { Header } from '@/components/layout/header';
import {
  SharedUploader,
  DocumentCard
} from '@/components/document-management';
import { useFilterSort, FilterSortConfig } from '@/lib/filter-sort';
// Note: DocumentViewModal and DocumentEditModal imports removed - may need restoration
import type { DocumentWithMetadata, DocumentPermissions } from '@shared/schemas/documents';
import type { User } from '@shared/schema';

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

interface Building {
  id: string;
  name: string;
}

interface Organization {
  id: string;
  name: string;
}

/**
 * ModularDocuments - Modern replacement for the 922-line Documents.tsx monolith
 * Uses the new modular document management components for a clean, maintainable interface
 */
export default function ModularDocuments() {
  // State for modals and interactions
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Fetch current user for permissions
  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/user'],
  });

  // Fetch all documents
  const { data: documentsResponse, isLoading } = useQuery<{
    documents: DocumentWithMetadata[];
  }>({
    queryKey: ['/api/documents'],
  });

  // Fetch buildings for filtering
  const { data: buildingsResponse } = useQuery<{ buildings: Building[] }>({
    queryKey: ['/api/manager/buildings'],
  });

  // Fetch organizations for filtering (if admin)
  const { data: organizationsResponse } = useQuery<{ organizations: Organization[] }>({
    queryKey: ['/api/admin/organizations'],
    enabled: user?.role === 'admin',
  });

  const documents = documentsResponse?.documents || [];
  const buildings = buildingsResponse?.buildings || [];
  const organizations = organizationsResponse?.organizations || [];

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
        options: DOCUMENT_CATEGORIES.filter(c => c.value !== 'all').map(c => ({
          label: c.label,
          value: c.value,
        })),
        defaultOperator: 'equals',
      },
      {
        id: 'buildingId',
        field: 'buildingId',
        label: 'Building',
        type: 'select',
        icon: Building,
        options: buildings.map(b => ({
          label: b.name,
          value: b.id,
        })),
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
    storageKey: 'modular-documents-filters',
  }), [buildings]);

  // Use filter/sort hook
  const {
    filteredData: filteredDocuments,
    filters,
    search,
    setSearch,
    addFilter,
    removeFilter,
    clearFilters: clearAllFilters,
  } = useFilterSort({
    data: documents,
    config: filterSortConfig,
    initialState: {
      sort: { field: 'createdAt', direction: 'desc' },
    },
  });

  // Get current filter values for UI compatibility
  const selectedCategory = filters.find(f => f.field === 'documentType')?.value || 'all';
  const selectedBuildingId = filters.find(f => f.field === 'buildingId')?.value || 'all';
  const selectedOrganizationId = 'all'; // Not implemented yet

  // Group documents by category for better organization
  const documentsByCategory = filteredDocuments.reduce((acc, doc) => {
    const category = doc.documentType || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(doc);
    return acc;
  }, {} as Record<string, DocumentWithMetadata[]>);

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
    // Document action completed - UI state updated
    setIsEditModalOpen(false);
    setIsViewModalOpen(false);
    setIsCreating(false);
    setSelectedDocumentId(null);
  };

  const clearFilters = () => {
    clearAllFilters();
    setSearch('');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Document Management" subtitle="Centralized document management with advanced filtering and search" />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filters and Search Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filters & Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search documents..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-documents"
                    />
                  </div>
                </div>

                {/* Category Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={String(selectedCategory)}
                    onValueChange={(value) => {
                      if (value === 'all') {
                        removeFilter('documentType');
                      } else {
                        addFilter({ field: 'documentType', operator: 'equals', value });
                      }
                    }}
                  >
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

                {/* Building Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <Building className="w-4 h-4" />
                    Building
                  </label>
                  <Select
                    value={String(selectedBuildingId)}
                    onValueChange={(value) => {
                      if (value === 'all') {
                        removeFilter('buildingId');
                      } else {
                        addFilter({ field: 'buildingId', operator: 'equals', value });
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-building-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Buildings</SelectItem>
                      {buildings.map((building) => (
                        <SelectItem key={building.id} value={building.id}>
                          {building.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Organization Filter (Admin only) - TODO: Implement organization filtering */}
                {user?.role === 'admin' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1">
                      <Home className="w-4 h-4" />
                      Organization
                    </label>
                    <Select value={selectedOrganizationId} onValueChange={() => {}}>
                      <SelectTrigger data-testid="select-organization-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Organizations</SelectItem>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

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

          {/* View Mode Toggle */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''} found
              </span>
              {(search || selectedCategory !== 'all' || selectedBuildingId !== 'all' || selectedOrganizationId !== 'all') && (
                <Badge variant="secondary">Filtered</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
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
                    {search || selectedCategory !== 'all' || selectedBuildingId !== 'all' || selectedOrganizationId !== 'all'
                      ? "No documents match your current filters. Try adjusting your search criteria."
                      : "No documents have been uploaded yet. Create your first document to get started."
                    }
                  </p>
                  <div className="flex gap-2 justify-center">
                    {(search || selectedCategory !== 'all' || selectedBuildingId !== 'all' || selectedOrganizationId !== 'all') && (
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
            <div className="space-y-6">
              {Object.keys(documentsByCategory).length > 1 ? (
                // Group by category when multiple categories are present
                Object.entries(documentsByCategory).map(([category, categoryDocs]: [string, DocumentWithMetadata[]]) => {
                  const categoryInfo = DOCUMENT_CATEGORIES.find(c => c.value === category);
                  return (
                    <Card key={category}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span>{categoryInfo?.label || 'Other'}</span>
                            <Badge variant="secondary">{categoryDocs.length}</Badge>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`grid gap-4 ${
                          viewMode === 'grid' 
                            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                            : 'grid-cols-1'
                        }`}>
                          {categoryDocs.map((document) => (
                            <DocumentCard
                              key={document.id}
                              documentId={document.id}
                              title={document.name}
                              documentType={document.documentType}
                              createdAt={document.createdAt.toISOString()}
                              onViewClick={handleDocumentView}
                              compact={viewMode === 'list'}
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                // Single category or all documents view
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
                          documentType={document.documentType}
                          createdAt={document.createdAt.toISOString()}
                          onViewClick={handleDocumentView}
                          compact={viewMode === 'list'}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Document View Modal - TODO: Implement DocumentViewModal component */}
          {/* <DocumentViewModal
            documentId={selectedDocumentId}
            userPermissions={userPermissions}
            onEditClick={handleDocumentEdit}
            isOpen={isViewModalOpen}
            onOpenChange={setIsViewModalOpen}
          /> */}

          {/* Document Edit/Create Modal - TODO: Implement DocumentEditModal component */}
          {/* <DocumentEditModal
            documentId={isCreating ? undefined : selectedDocumentId}
            entityType="general"
            entityId={undefined}
            isOpen={isEditModalOpen}
            onOpenChange={setIsEditModalOpen}
            onSuccess={handleDocumentSuccess}
          /> */}
        </div>
      </div>
    </div>
  );
}