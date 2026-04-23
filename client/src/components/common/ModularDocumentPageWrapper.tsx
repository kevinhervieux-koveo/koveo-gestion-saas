import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { Grid, List, ArrowLeft, Plus, Search, Filter, Building, Home, ChevronDown, ChevronRight, Eye, CheckSquare, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Header } from '@/components/layout/header';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { handleApiError } from '@/lib/demo-error-handler';
import {
  SharedUploader,
  DocumentCard,
  DocumentEditForm
} from '@/components/document-management';
import { DocumentCreateForm } from '@/components/document-management/DocumentCreateForm';
import { DocumentInlineViewer } from '@/components/common/DocumentInlineViewer';
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

export function DocumentViewDialog({ documentId, isOpen, onClose, onEdit, canEdit }: DocumentViewDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [inlineViewerOpen, setInlineViewerOpen] = useState(false);
  const { data: document, isLoading } = useQuery({
    queryKey: ['/api/documents', documentId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/documents/${documentId}`);
      return response.json();
    },
    enabled: isOpen && !!documentId,
  });

  const handleDownload = async () => {
    try {
      // Use fetch with credentials to ensure authentication
      const response = await fetch(`/api/documents/${documentId}/file?download=true`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        let detail = response.statusText;
        try {
          const body = await response.json();
          if (body?.message || body?.error) {
            detail = body.message || body.error;
          }
        } catch {
          // body wasn't JSON; keep statusText
        }
        throw new Error(`${response.status}: ${detail}`);
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

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = window.document.createElement('a');
      link.href = url;
      link.download = fileName;
      window.document.body.appendChild(link);
      link.click();

      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('[DOWNLOAD] Download failed:', error);
      toast({
        title: t('downloadFailed') || 'Download failed',
        description: error?.message || 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleView = () => {
    if (!documentId) {
      toast({
        title: t('viewFailed') || 'Failed to open document',
        description: 'Document is not available',
        variant: 'destructive',
      });
      return;
    }
    setInlineViewerOpen(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto" aria-describedby="document-details-description">
        <DialogHeader>
          <DialogTitle>{t('documentDetails')}</DialogTitle>
          <DialogDescription id="document-details-description">
            {t('documentDetailsDescription')}
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">{t('loadingDocument')}</p>
          </div>
        ) : document ? (
          <div className="space-y-6">
            {/* Document Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">{t('documentName')}</Label>
                <p className="text-sm text-gray-600">{document.name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">{t('category')}</Label>
                <p className="text-sm text-gray-600">{getCategoryLabel(document.category || document.documentType, t)}</p>
              </div>
              {document.effectiveDate && (
                <div>
                  <Label className="text-sm font-medium">{t('effectiveDate')}</Label>
                  <p className="text-sm text-gray-600">{new Date(document.effectiveDate).toLocaleDateString()}</p>
                </div>
              )}
              <div>
                <Label className="text-sm font-medium">{t('uploadDate')}</Label>
                <p className="text-sm text-gray-600">{new Date(document.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">{t('visibleToTenants')}</Label>
                <p className="text-sm text-gray-600">{document.isVisibleToTenants ? t('yes') : t('no')}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">{t('managerOnly')}</Label>
                <p className="text-sm text-gray-600" data-testid="document-manager-only">
                  {document.isManagerOnly ? t('yes') : t('no')}
                </p>
              </div>
            </div>

            {/* Description */}
            {document.description && (
              <div>
                <Label className="text-sm font-medium">{t('description')}</Label>
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
                      <p className="text-xs text-gray-500">{t('documentAttachment')}</p>
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
                      {t('view')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownload}
                      className="flex items-center gap-1"
                      data-testid="button-download-document-file"
                    >
                      <Download className="w-3 h-3" />
                      {t('download')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end pt-4 border-t">
              {canEdit && (
                <Button variant="outline" onClick={onEdit}>
                  {t('editDocument')}
                </Button>
              )}
              <Button variant="default" onClick={onClose}>
                {t('close')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-gray-500">{t('documentNotFound')}</p>
            <Button variant="outline" onClick={onClose} className="mt-4">
              {t('close')}
            </Button>
          </div>
        )}
      </DialogContent>
      {document?.filePath && (
        <DocumentInlineViewer
          isOpen={inlineViewerOpen}
          onClose={() => setInlineViewerOpen(false)}
          fileUrl={`/api/documents/${documentId}/file`}
          fileName={document.fileName || document.name}
          mimeType={document.mimeType}
        />
      )}
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
  const { t } = useLanguage();
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
      <DialogContent
        className="max-w-4xl max-h-[95vh] overflow-y-auto"
        aria-describedby="document-edit-description"
      >
        <DialogHeader>
          <DialogTitle>{t('editDocument')}</DialogTitle>
          <DialogDescription id="document-edit-description">
            {t('editDocumentDialogDescription')}
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">{t('loadingDocument')}</p>
          </div>
        ) : document ? (
          <div className="p-6">
            <DocumentEditForm
              document={document}
              onSuccess={handleSuccess}
              onCancel={onClose}
            />
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-gray-500">{t('documentNotFound')}</p>
            <Button variant="outline" onClick={onClose} className="mt-4">
              {t('close')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Helper function to translate category slugs to labels
const getCategoryLabel = (category: string | null | undefined, t: (key: string) => string): string => {
  const categoryMap: Record<string, string> = {
    'bylaw': t('categoryBylaws'),
    'financial': t('categoryFinancial'),
    'maintenance': t('categoryMaintenance'),
    'legal': t('categoryLegal'),
    'meeting_minutes': t('categoryMeetingMinutes'),
    'insurance': t('categoryInsurance'),
    'contracts': t('categoryContracts'),
    'permits': t('categoryPermits'),
    'inspection': t('categoryInspection'),
    'other': t('categoryOther'),
  };
  
  return categoryMap[category || 'other'] || t('categoryOther');
};

// Document categories for filtering - function to support translations
const getDocumentCategories = (t: (key: string) => string) => [
  { value: 'all', label: t('allCategories') },
  { value: 'bylaw', label: t('categoryBylaws') },
  { value: 'financial', label: t('categoryFinancial') },
  { value: 'maintenance', label: t('categoryMaintenance') },
  { value: 'legal', label: t('categoryLegal') },
  { value: 'meeting_minutes', label: t('categoryMeetingMinutes') },
  { value: 'insurance', label: t('categoryInsurance') },
  { value: 'contracts', label: t('categoryContracts') },
  { value: 'permits', label: t('categoryPermits') },
  { value: 'inspection', label: t('categoryInspection') },
  { value: 'other', label: t('categoryOther') },
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
  const { t, language } = useLanguage();
  const { toast } = useToast();

  // Get translated document categories
  const DOCUMENT_CATEGORIES = getDocumentCategories(t);

  // State for document interactions
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // State for filtering and search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [showOnlyManagerOnly, setShowOnlyManagerOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // State for bulk delete functionality
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // State for collapsible categories (start with all categories expanded)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    // Initialize with all possible categories expanded
    const categories = getDocumentCategories(t);
    return new Set(categories.map(cat => cat.value).filter(val => val !== 'all'));
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

  // Get current user (use the default queryFn so the cached value stays
  // a parsed user object — never overwrite this cache with a Response).
  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
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
    queryKey: ['/api/documents', type, entityId, { isManagerOnly: showOnlyManagerOnly }],
    queryFn: async () => {
      const param = type === 'building' ? 'buildingId' : 'residenceId';
      const queryParams = new URLSearchParams({ [param]: entityId as string });
      if (showOnlyManagerOnly) {
        queryParams.set('isManagerOnly', 'true');
      }
      const response = await apiRequest('GET', `/api/documents?${queryParams.toString()}`);
      return response.json();
    },
    enabled: !!entityId,
    staleTime: 0, // Always refetch
    gcTime: 0, // Don't cache
  });

  // Extract documents array from API response
  const documents = Array.isArray((documentResponse as any)?.documents) ? (documentResponse as any).documents : [];

  // Determine permissions based on user role and type
  const isUserTenant = user?.role === 'tenant' || user?.role === 'demo_tenant';
  const isManager = user?.role === 'manager' || user?.role === 'demo_manager' || user?.role === 'admin';
  const isResident = user?.role === 'resident' || user?.role === 'demo_resident';
  
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
        canEdit: (isResident || isManager) && type === 'residence', // Residents and managers can edit residence documents
        canDelete: (isResident || isManager) && type === 'residence', // Residents and managers can delete residence documents
        canCreate: (isResident || isManager) && type === 'residence', // Residents and managers can create residence documents
      };

  // Get month names helper function
  const getMonthNames = () => [
    { value: '1', label: t('january') },
    { value: '2', label: t('february') },
    { value: '3', label: t('march') },
    { value: '4', label: t('april') },
    { value: '5', label: t('may') },
    { value: '6', label: t('june') },
    { value: '7', label: t('july') },
    { value: '8', label: t('august') },
    { value: '9', label: t('september') },
    { value: '10', label: t('october') },
    { value: '11', label: t('november') },
    { value: '12', label: t('december') },
  ];

  // Filter and search documents
  const filteredDocuments = Array.isArray(documents) ? documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory || doc.documentType === selectedCategory;

    // Date filtering - use effectiveDate if available, otherwise use uploadedAt
    const dateToFilter = doc.effectiveDate || doc.uploadedAt;
    let matchesYear = true;
    let matchesMonth = true;
    
    if (dateToFilter && selectedYear !== 'all') {
      const docDate = new Date(dateToFilter);
      matchesYear = docDate.getFullYear().toString() === selectedYear;
    }
    
    if (dateToFilter && selectedMonth !== 'all') {
      const docDate = new Date(dateToFilter);
      matchesMonth = (docDate.getMonth() + 1).toString() === selectedMonth;
    }

    const matchesManagerOnly = !showOnlyManagerOnly || doc.isManagerOnly === true;

    return matchesSearch && matchesCategory && matchesYear && matchesMonth && matchesManagerOnly;
  }) : [];

  // Extract available years from documents (sorted descending)
  const availableYears = Array.from(
    new Set(
      documents
        .map(doc => {
          const dateToFilter = doc.effectiveDate || doc.uploadedAt;
          return dateToFilter ? new Date(dateToFilter).getFullYear() : null;
        })
        .filter((year): year is number => year !== null)
    )
  ).sort((a, b) => b - a);

  // Extract available months from documents (based on selected year or all documents)
  const availableMonths = Array.from(
    new Set(
      documents
        .filter(doc => {
          if (selectedYear === 'all') return true;
          const dateToFilter = doc.effectiveDate || doc.uploadedAt;
          return dateToFilter && new Date(dateToFilter).getFullYear().toString() === selectedYear;
        })
        .map(doc => {
          const dateToFilter = doc.effectiveDate || doc.uploadedAt;
          return dateToFilter ? new Date(dateToFilter).getMonth() + 1 : null;
        })
        .filter((month): month is number => month !== null)
    )
  ).sort((a, b) => a - b);

  // Group documents by category
  const groupedDocuments = filteredDocuments.reduce((groups, doc) => {
    const category = doc.category || doc.documentType || 'other';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(doc);
    return groups;
  }, {} as Record<string, typeof filteredDocuments>);

  // Get category display name with translations
  const getCategoryDisplayName = (category: string) => {
    const categoryLabels: Record<string, string> = {
      bylaw: t('bylawsDocuments'),
      bylawsDocuments: t('bylawsDocuments'),
      financial: t('financialDocuments'),
      financialDocuments: t('financialDocuments'),
      maintenance: t('maintenanceRecords'),
      maintenanceRecords: t('maintenanceRecords'),
      legal: t('legalDocuments'),
      legalDocuments: t('legalDocuments'),
      meeting_minutes: t('meetingMinutesDocuments'),
      meetingMinutes: t('meetingMinutesDocuments'),
      meetingMinutesDocuments: t('meetingMinutesDocuments'),
      insurance: t('insuranceDocuments'),
      insuranceDocuments: t('insuranceDocuments'),
      contracts: t('contractsDocuments'),
      contractsDocuments: t('contractsDocuments'),
      permits: t('permitsDocuments'),
      permitsDocuments: t('permitsDocuments'),
      inspection: t('inspectionReports'),
      inspectionReports: t('inspectionReports'),
      attachment: t('attachments'),
      attachments: t('attachments'),
      Attachment: t('attachments'),
      other: t('otherDocuments'),
      otherDocuments: t('otherDocuments'),
    };
    return categoryLabels[category] || category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };


  // Generate entity name based on type
  const entityName = type === 'residence' 
    ? (entity?.unitNumber || entity?.unit_number ? `${t('unit')} ${entity.unitNumber || entity.unit_number}` : t('residence'))
    : entity?.name;

  const defaultBackLabel = backLabel || (
    type === 'building' 
      ? (userRole === 'resident' ? t('backToMyResidence') : t('backToBuildings'))
      : t('backToResidences')
  );

  // Only treat the entity name as "loaded" when the entity itself is loaded.
  // This avoids showing the placeholder t('residence') / undefined name as the
  // back-button label or subtitle while data is still in flight.
  const loadedEntityName = entity ? entityName : undefined;

  // Prefer the entity name on the back button (matches other deep-linked pages),
  // falling back to the generic localized label while the entity is still loading.
  const backButtonLabel = loadedEntityName || defaultBackLabel;

  // Page title/subtitle: title is the page name, subtitle includes the entity
  // name so the header stays consistent with other manager pages. Subtitle is
  // empty during loading to avoid duplicating the title.
  const pageTitle = type === 'building' ? t('buildingDocuments') : t('residenceDocuments');
  const pageSubtitle = loadedEntityName || '';

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
    // Document created successfully
    // Refresh documents list will be handled by the DocumentCreateForm's cache invalidation
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedYear('all');
    setSelectedMonth('all');
    setShowOnlyManagerOnly(false);
  };

  // Bulk delete handlers
  const handleToggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedDocuments(new Set());
    }
  };

  const handleDocumentSelectionChange = (documentId: string, selected: boolean) => {
    const newSelected = new Set(selectedDocuments);
    if (selected) {
      newSelected.add(documentId);
    } else {
      newSelected.delete(documentId);
    }
    setSelectedDocuments(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedDocuments.size === filteredDocuments.length && filteredDocuments.length > 0) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(filteredDocuments.map(doc => doc.id)));
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
    const failedDeletions: Array<{ id: string; error: any }> = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.status === 'fulfilled') {
        successfulDeletions.push(result.value.documentId);
      } else {
        const error = result.status === 'fulfilled' ? result.value.error : result.reason;
        failedDeletions.push({ id: documentIds[index], error });
      }
    });

    if (successfulDeletions.length > 0) {
      toast({ 
        title: t('documentsDeleted'), 
        description: `${t('successfullyDeleted')} ${successfulDeletions.length} ${successfulDeletions.length > 1 ? t('documents') : t('document')}` 
      });
    }
    if (failedDeletions.length > 0) {
      const firstError = failedDeletions[0]?.error;
      handleApiError(
        firstError,
        language,
        language === 'fr'
          ? `Échec de la suppression de ${failedDeletions.length} document(s). Veuillez réessayer.`
          : `Failed to delete ${failedDeletions.length} document(s). Please try again.`
      );
    }

    queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    setSelectedDocuments(new Set());
    setShowDeleteDialog(false);
    setSelectionMode(false);
  };

  if (!entityId) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">{type === 'building' ? t('buildingIdRequired') : t('residenceIdRequired')}</p>
            <Button
              variant="outline"
              onClick={() => navigate(backPath)}
              data-testid="button-back-to-list"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {backButtonLabel}
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
            <h2 className="text-xl font-semibold mb-4">{t('residenceNotFound')}</h2>
            <p className="text-gray-500 mb-4">
              {t('residenceIdDoesNotExist', { entityId })}
            </p>
            <p className="text-sm text-gray-400 mb-6">
              {t('productionDatabaseIdWarning')}
            </p>
            <div className="space-y-2">
              <Button
                variant="default"
                onClick={() => navigate(backPath)}
                data-testid="button-back-to-list"
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {backButtonLabel}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  navigate('/residents/residences/e27ac924-8120-4904-a791-d1e9db544d58/documents')
                }
                data-testid="button-go-to-valid-residence"
                className="w-full"
              >
                {t('goToTestResidence')}
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
        title={pageTitle}
        subtitle={pageSubtitle}
      />

      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center px-6 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(backPath)}
            className="flex items-center gap-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            {backButtonLabel}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Filters and Search Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                {t('searchAndFilters')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('search')}</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder={t('searchDocuments')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-documents"
                    />
                  </div>
                </div>

                {/* Category Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('category')}</label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger data-testid="select-category-filter">
                      <SelectValue placeholder={t('allCategories')} />
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

                {/* Year Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('year')}</label>
                  <Select value={selectedYear} onValueChange={(value) => {
                    setSelectedYear(value);
                    // Reset month if selected month is not available for the new year
                    if (value !== 'all') {
                      const yearDocs = documents.filter(doc => {
                        const dateToFilter = doc.effectiveDate || doc.uploadedAt;
                        return dateToFilter && new Date(dateToFilter).getFullYear().toString() === value;
                      });
                      const yearMonths = Array.from(new Set(yearDocs.map(doc => {
                        const dateToFilter = doc.effectiveDate || doc.uploadedAt;
                        return dateToFilter ? new Date(dateToFilter).getMonth() + 1 : null;
                      }).filter(m => m !== null)));
                      if (selectedMonth !== 'all' && !yearMonths.includes(parseInt(selectedMonth))) {
                        setSelectedMonth('all');
                      }
                    }
                  }}>
                    <SelectTrigger data-testid="select-year-filter">
                      <SelectValue placeholder={t('allYears')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('allYears')}</SelectItem>
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Month Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('month')}</label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger data-testid="select-month-filter">
                      <SelectValue placeholder={t('allMonths')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('allMonths')}</SelectItem>
                      {getMonthNames()
                        .filter(month => availableMonths.includes(parseInt(month.value)))
                        .map((month) => (
                          <SelectItem key={month.value} value={month.value}>
                            {month.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* View Mode & Actions */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('viewAndActions')}</label>
                  <div className="flex gap-2 flex-wrap">
                    {userPermissions.canDelete && (
                      !selectionMode ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleToggleSelectionMode}
                          data-testid="button-select-mode"
                        >
                          <CheckSquare className="w-4 h-4 mr-2" />
                          {t('select')}
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleToggleSelectionMode}
                            data-testid="button-cancel-select-mode"
                          >
                            <X className="w-4 h-4 mr-2" />
                            {t('cancel')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAll}
                            data-testid="button-select-all"
                          >
                            {selectedDocuments.size === filteredDocuments.length && filteredDocuments.length > 0 ? t('deselectAll') : t('selectAll')}
                          </Button>
                          {selectedDocuments.size > 0 && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setShowDeleteDialog(true)}
                              data-testid="button-bulk-delete"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t('delete')} ({selectedDocuments.size})
                            </Button>
                          )}
                        </>
                      )
                    )}
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
                        {t('create')}
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={clearFilters}
                      data-testid="button-clear-filters"
                    >
                      {t('clear')}
                    </Button>
                  </div>
                </div>
              </div>

              {isManager && (
                <div className="mt-4 flex items-center gap-2">
                  <Checkbox
                    id="filter-manager-only"
                    checked={showOnlyManagerOnly}
                    onCheckedChange={(checked) => setShowOnlyManagerOnly(checked === true)}
                    data-testid="checkbox-filter-manager-only"
                  />
                  <Label
                    htmlFor="filter-manager-only"
                    className="text-sm font-medium cursor-pointer"
                  >
                    {t('showManagerOnlyDocuments')}
                  </Label>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents Display */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {filteredDocuments.length} {filteredDocuments.length !== 1 ? t('documentsFound') : t('documentFound')}
              </span>
              {(searchTerm || selectedCategory !== 'all' || selectedYear !== 'all' || selectedMonth !== 'all' || showOnlyManagerOnly) && (
                <Badge variant="secondary">{t('filtered')}</Badge>
              )}
            </div>
          </div>

          {/* Documents Content */}
          {isLoading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-500">{t('loadingDocuments')}</p>
              </CardContent>
            </Card>
          ) : filteredDocuments.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                    <Search className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">{t('noDocumentsFound')}</h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm || selectedCategory !== 'all' || selectedYear !== 'all' || selectedMonth !== 'all' || showOnlyManagerOnly
                      ? t('noDocumentsMatchFilters')
                      : t('noDocumentsUploadedYet')
                    }
                  </p>
                  <div className="flex gap-2 justify-center">
                    {(searchTerm || selectedCategory !== 'all' || selectedYear !== 'all' || selectedMonth !== 'all' || showOnlyManagerOnly) && (
                      <Button variant="outline" onClick={clearFilters}>
                        {t('clearFilters')}
                      </Button>
                    )}
                    {userPermissions.canCreate && (
                      <Button onClick={handleCreateDocument}>
                        <Plus className="w-4 h-4 mr-2" />
                        {t('createDocument')}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedDocuments).map(([category, categoryDocuments]: [string, any[]]) => {
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
                                  effectiveDate={document.effectiveDate}
                                  isVisibleToTenants={document.isVisibleToTenants}
                                  isManagerOnly={document.isManagerOnly}
                                  onViewClick={selectionMode ? undefined : handleDocumentView}
                                  compact={viewMode === 'list'}
                                  selectable={selectionMode}
                                  selected={selectedDocuments.has(document.id)}
                                  onSelectionChange={handleDocumentSelectionChange}
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

          {/* Bulk Delete Confirmation Dialog */}
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('deleteDocuments')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('deleteDocumentsConfirmation', { 
                    count: selectedDocuments.size, 
                    documents: selectedDocuments.size > 1 ? t('documents') : t('document') 
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-bulk-delete">{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBulkDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid="button-confirm-bulk-delete"
                >
                  {t('delete')} {selectedDocuments.size} {selectedDocuments.size > 1 ? t('documents') : t('document')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}