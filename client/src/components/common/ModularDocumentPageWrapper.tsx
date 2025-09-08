import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { Grid, List, ArrowLeft, Plus, Search, Filter, Building, Home, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Header } from '@/components/layout/header';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useLanguage } from '@/hooks/use-language';
import {
  SharedUploader,
  DocumentCard,
  DocumentEditForm
} from '@/components/document-management';
import { DocumentCreateForm } from '@/components/document-management/DocumentCreateForm';
import { FileText, Download } from 'lucide-react';
import type { DocumentWithMetadata, DocumentPermissions } from '@shared/schemas/documents';

// Document View Dialog Component
interface DocumentViewDialogProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  canEdit: boolean;
}

function DocumentViewDialog({ documentId, isOpen, onClose, onEdit, canEdit }: DocumentViewDialogProps) {
  const { data: document, isLoading } = useQuery({
    queryKey: ['/api/documents', documentId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/documents/${documentId}`);
      return response.json();
    },
    enabled: isOpen && !!documentId,
  });

  const handleDownload = async () => {
    console.log('[DOWNLOAD] Starting download for document:', documentId);
    try {
      // Use fetch with credentials to ensure authentication
      const response = await fetch(`/api/documents/${documentId}/file?download=true`, {
        method: 'GET',
        credentials: 'include', // Include authentication cookies
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      // Get the filename from Content-Disposition header or use document name
      const contentDisposition = response.headers.get('Content-Disposition');
      let fileName = document?.name || 'document';
      
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (fileNameMatch) {
          fileName = fileNameMatch[1];
        }
      }

      // Convert response to blob and create download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = window.document.createElement('a');
      link.href = url;
      link.download = fileName;
      window.document.body.appendChild(link);
      link.click();
      
      // Clean up
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('[DOWNLOAD] Download completed successfully');
    } catch (error) {
      console.error('[DOWNLOAD] Download failed:', error);
      alert(`Download failed: ${error.message || 'Unknown error'}`);
    }
  };

  const handleView = async () => {
    if (document?.filePath) {
      try {
        console.log('[VIEW] Starting view for document:', documentId);
        
        // Open a new tab immediately to avoid popup blocking
        const newTab = window.open('about:blank', '_blank');
        if (!newTab) {
          throw new Error('Popup blocked - please allow popups for this site');
        }
        
        // Use fetch with credentials to ensure authentication
        const response = await fetch(`/api/documents/${documentId}/file`, {
          method: 'GET',
          credentials: 'include', // Include authentication cookies
        });

        if (!response.ok) {
          newTab.close();
          throw new Error(`View failed: ${response.status} ${response.statusText}`);
        }

        // Convert response to blob and set it as the new tab's location
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        // Set the blob URL to the opened tab
        newTab.location.href = url;
        
        // Clean up the URL after a delay to allow the tab to load
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 3000);
        
        console.log('[VIEW] View completed successfully');
        
      } catch (error) {
        console.error('[VIEW] View failed:', error);
        // Show error notification if available
        alert(`Failed to open document: ${error.message}`);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Document Details</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">Loading document...</p>
          </div>
        ) : document ? (
          <div className="space-y-6">
            {/* Document Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Document Name</Label>
                <p className="text-sm text-gray-600">{document.name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Category</Label>
                <p className="text-sm text-gray-600 capitalize">{document.category || document.documentType || 'Other'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Upload Date</Label>
                <p className="text-sm text-gray-600">{new Date(document.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Visible to Tenants</Label>
                <p className="text-sm text-gray-600">{document.isVisibleToTenants ? 'Yes' : 'No'}</p>
              </div>
            </div>

            {/* Description */}
            {document.description && (
              <div>
                <Label className="text-sm font-medium">Description</Label>
                <p className="text-sm text-gray-600">{document.description}</p>
              </div>
            )}

            {/* Document Actions */}
            {document.filePath && (
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium">{document.fileName || document.name}</p>
                      <p className="text-xs text-gray-500">Document attachment</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleView}
                      className="flex items-center gap-1"
                      data-testid="button-view-document-file"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownload}
                      className="flex items-center gap-1"
                      data-testid="button-download-document-file"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end pt-4 border-t">
              {canEdit && (
                <Button variant="outline" onClick={onEdit}>
                  Edit Document
                </Button>
              )}
              <Button variant="default" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-gray-500">Document not found</p>
            <Button variant="outline" onClick={onClose} className="mt-4">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Document Edit Dialog Component  
interface DocumentEditDialogProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function DocumentEditDialog({ documentId, isOpen, onClose, onSuccess }: DocumentEditDialogProps) {
  const { data: document, isLoading } = useQuery({
    queryKey: ['/api/documents', documentId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/documents/${documentId}`);
      return response.json();
    },
    enabled: isOpen && !!documentId,
  });

  const handleSuccess = () => {
    onSuccess();
    onClose();
  };

  const handleDelete = () => {
    onSuccess(); // Refresh the document list
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Document</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">Loading document...</p>
          </div>
        ) : document ? (
          <div className="p-6">
            <DocumentEditForm
              document={document}
              onSuccess={handleSuccess}
              onCancel={onClose}
              onDelete={handleDelete}
            />
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-gray-500">Document not found</p>
            <Button variant="outline" onClick={onClose} className="mt-4">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

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
  
  // State for collapsible categories (start with all categories expanded)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    // Initialize with all possible categories expanded
    return new Set(DOCUMENT_CATEGORIES.map(cat => cat.value).filter(val => val !== 'all'));
  });

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

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

  // Group documents by category
  const groupedDocuments = filteredDocuments.reduce((groups, doc) => {
    const category = doc.category || doc.documentType || 'other';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(doc);
    return groups;
  }, {} as Record<string, typeof filteredDocuments>);

  // Get category display name
  const getCategoryDisplayName = (category: string) => {
    const categoryLabels: Record<string, string> = {
      bylaw: 'Bylaws',
      financial: 'Financial Documents',
      maintenance: 'Maintenance Records',
      legal: 'Legal Documents',
      meeting_minutes: 'Meeting Minutes',
      insurance: 'Insurance Documents',
      contracts: 'Contracts',
      permits: 'Permits',
      inspection: 'Inspection Reports',
      other: 'Other Documents',
    };
    return categoryLabels[category] || category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };


  // Generate entity name based on type
  const entityName = type === 'residence' 
    ? (entity?.unitNumber || entity?.unit_number ? `Unit ${entity.unitNumber || entity.unit_number}` : 'Residence')
    : entity?.name;

  const defaultBackLabel = backLabel || (type === 'building' ? 'Back to Buildings' : t('backToResidences'));

  // State for document view and edit dialogs
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Handle document interactions
  const handleDocumentView = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setIsViewDialogOpen(true);
  };

  const handleDocumentEdit = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setIsEditDialogOpen(true);
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
      <Header 
        title={entityName}
        subtitle={type === 'building' ? 'Building Documents' : 'Residence Documents'}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Back Button */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => navigate(backPath)}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {defaultBackLabel}
            </Button>
            <div></div>
          </div>

          {/* Filters and Search Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Search & Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      <SelectValue placeholder="All Categories" />
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

                {/* View Mode & Actions */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">View & Actions</label>
                  <div className="flex gap-2">
                    <div className="flex gap-1">
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
                    {userPermissions.canCreate && (
                      <Button 
                        onClick={handleCreateDocument} 
                        size="sm"
                        data-testid="button-create-document"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
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
            <div className="space-y-6">
              {Object.entries(groupedDocuments).map(([category, categoryDocuments]) => {
                const isExpanded = expandedCategories.has(category);
                
                return (
                  <div key={category} className="space-y-3">
                    <Collapsible open={isExpanded} onOpenChange={() => toggleCategory(category)}>
                      <CollapsibleTrigger className="flex items-center gap-2 p-2 w-full text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="text-lg font-semibold">
                          {getCategoryDisplayName(category)}
                        </span>
                        <Badge variant="secondary" className="ml-2">
                          {categoryDocuments.length}
                        </Badge>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent className="space-y-3">
                        <Card>
                          <CardContent className="pt-6">
                            <div className={`grid gap-4 ${
                              viewMode === 'grid' 
                                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                                : 'grid-cols-1'
                            }`}>
                              {categoryDocuments.map((document) => (
                                <DocumentCard
                                  key={document.id}
                                  documentId={document.id}
                                  title={document.name}
                                  documentType={document.category || document.documentType}
                                  createdAt={document.createdAt}
                                  onViewClick={handleDocumentView}
                                  compact={viewMode === 'list'}
                                />
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}
            </div>
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

          {/* Document View Dialog */}
          {selectedDocumentId && (
            <DocumentViewDialog
              documentId={selectedDocumentId}
              isOpen={isViewDialogOpen}
              onClose={() => {
                setIsViewDialogOpen(false);
                setSelectedDocumentId(null);
              }}
              onEdit={() => {
                setIsViewDialogOpen(false);
                setIsEditDialogOpen(true);
              }}
              canEdit={userPermissions.canEdit}
            />
          )}

          {/* Document Edit Dialog */}
          {selectedDocumentId && (
            <DocumentEditDialog
              documentId={selectedDocumentId}
              isOpen={isEditDialogOpen}
              onClose={() => {
                setIsEditDialogOpen(false);
                setSelectedDocumentId(null);
              }}
              onSuccess={() => {
                setIsEditDialogOpen(false);
                setSelectedDocumentId(null);
                // Refresh documents list
                queryClient.invalidateQueries({
                  queryKey: ['/api/documents', type, entityId],
                });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}