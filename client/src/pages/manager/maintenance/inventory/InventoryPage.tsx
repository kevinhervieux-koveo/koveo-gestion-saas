import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BuildingContextProvider, useBuildingContext } from '@/hooks/use-building-context';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { BuildingElement } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';

// Import inventory components
import { InventoryHeader } from './InventoryHeader';
import { InventoryOverview } from './InventoryOverview';
import { ElementDetailsPanel } from './ElementDetailsPanel';

// Import existing maintenance components
import { ElementTable } from '@/components/maintenance/inventory/ElementTable';
import { ElementForm } from '@/components/maintenance/inventory/ElementForm';
import { DocumentManager } from '@/components/maintenance/inventory/DocumentManager';
import { UniformatBrowser } from '@/components/maintenance/inventory/UniformatBrowser';
import { HistoryTable } from '@/components/maintenance/inventory/HistoryTable';

import { 
  AlertTriangle, 
  Building, 
  Loader2, 
  RefreshCw,
  Package,
  X,
} from 'lucide-react';

interface InventoryPageContentProps {
  className?: string;
}

/**
 * Main inventory page content component
 * Handles state management and component integration
 */
function InventoryPageContent({ className }: InventoryPageContentProps) {
  const { 
    buildingId, 
    building, 
    hasPermission, 
    isLoadingBuildings,
    availableBuildings 
  } = useBuildingContext();
  
  const { toast } = useToast();

  // State for modals and panels
  const [selectedElement, setSelectedElement] = useState<BuildingElement | null>(null);
  const [showElementDetails, setShowElementDetails] = useState(false);
  const [showElementForm, setShowElementForm] = useState(false);
  const [elementFormMode, setElementFormMode] = useState<'create' | 'edit'>('create');
  const [showDocumentManager, setShowDocumentManager] = useState(false);
  const [showUniformatBrowser, setShowUniformatBrowser] = useState(false);
  const [showHistoryTable, setShowHistoryTable] = useState(false);

  // State for filtering and search
  const [searchTerm, setSearchTerm] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [uniformatFilter, setUniformatFilter] = useState('');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  // State for bulk operations
  const [selectedElements, setSelectedElements] = useState<string[]>([]);

  // Permissions
  const canEdit = hasPermission('canEditMaintenance');
  const canCreate = hasPermission('canCreateProjects');
  const canManageDocuments = hasPermission('canManageDocuments');

  // Element handlers
  const handleViewElement = useCallback((element: BuildingElement) => {
    setSelectedElement(element);
    setShowElementDetails(true);
  }, []);

  const handleEditElement = useCallback((element: BuildingElement) => {
    setSelectedElement(element);
    setElementFormMode('edit');
    setShowElementForm(true);
  }, []);

  const handleAddElement = useCallback(() => {
    setSelectedElement(null);
    setElementFormMode('create');
    setShowElementForm(true);
  }, []);

  const handleAddHistory = useCallback((element: BuildingElement) => {
    setSelectedElement(element);
    setShowHistoryTable(true);
  }, []);

  const handleUploadDocuments = useCallback((element: BuildingElement) => {
    setSelectedElement(element);
    setShowDocumentManager(true);
  }, []);

  const handleScheduleEvaluation = useCallback((element: BuildingElement) => {
    // TODO: Implement evaluation scheduling
    toast({
      title: 'Feature Coming Soon',
      description: 'Evaluation scheduling will be available in a future update.',
    });
  }, [toast]);

  // Import/Export handlers
  const handleImportElements = useCallback(() => {
    // TODO: Implement element import
    toast({
      title: 'Feature Coming Soon',
      description: 'Element import functionality will be available in a future update.',
    });
  }, [toast]);

  const handleExportReport = useCallback(() => {
    // TODO: Implement report export
    toast({
      title: 'Feature Coming Soon',
      description: 'Report export functionality will be available in a future update.',
    });
  }, [toast]);

  // Form success handlers
  const handleElementFormSuccess = useCallback((element: BuildingElement) => {
    setShowElementForm(false);
    setSelectedElement(null);
    
    // Show success message
    toast({
      title: elementFormMode === 'create' ? 'Element Created' : 'Element Updated',
      description: `${element.name} has been ${elementFormMode === 'create' ? 'added to' : 'updated in'} the inventory.`,
    });
  }, [elementFormMode, toast]);

  const handleDocumentManagerSuccess = useCallback(() => {
    setShowDocumentManager(false);
    
    toast({
      title: 'Documents Uploaded',
      description: 'Documents have been successfully uploaded and attached to the element.',
    });
  }, [toast]);

  // Filter handlers
  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const handleConditionFilterChange = useCallback((condition: string) => {
    setConditionFilter(condition);
  }, []);

  const handleUniformatFilterChange = useCallback((uniformat: string) => {
    setUniformatFilter(uniformat);
  }, []);

  const handleShowOverdueChange = useCallback((overdue: boolean) => {
    setShowOverdueOnly(overdue);
  }, []);

  // Selection handlers
  const handleSelectionChange = useCallback((selectedIds: string[]) => {
    setSelectedElements(selectedIds);
  }, []);

  // Loading state
  if (isLoadingBuildings) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 border-b">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex-1 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  // No building access state
  if (!building && availableBuildings.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <Building className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Buildings Available</h2>
        <p className="text-muted-foreground text-center max-w-md">
          You don't have access to any buildings or no buildings have been set up yet. 
          Contact your administrator to gain access to building maintenance data.
        </p>
      </div>
    );
  }

  // No building selected state
  if (!building) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <Package className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Select Building</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Please select a building from the header to view its maintenance inventory.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex-1 flex flex-col overflow-hidden', className)}>
      {/* Page Header */}
      <InventoryHeader
        onAddElement={canCreate ? handleAddElement : undefined}
        onImportElements={canEdit ? handleImportElements : undefined}
        onExportReport={handleExportReport}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        conditionFilter={conditionFilter}
        onConditionFilterChange={handleConditionFilterChange}
        uniformatFilter={uniformatFilter}
        onUniformatFilterChange={handleUniformatFilterChange}
        showOverdueOnly={showOverdueOnly}
        onShowOverdueChange={handleShowOverdueChange}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          <div className="p-6 space-y-6">
            {/* Overview Cards */}
            <InventoryOverview />

            {/* Main Inventory Table */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Building Elements</h2>
                {selectedElements.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedElements.length} element(s) selected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedElements([])}
                      data-testid="clear-selection"
                    >
                      Clear Selection
                    </Button>
                  </div>
                )}
              </div>

              <ElementTable
                onViewElement={handleViewElement}
                onEditElement={canEdit ? handleEditElement : undefined}
                onAddHistory={canEdit ? handleAddHistory : undefined}
                onUploadDocuments={canManageDocuments ? handleUploadDocuments : undefined}
                selectedElements={selectedElements}
                onSelectionChange={handleSelectionChange}
                enableBulkActions={canEdit}
                data-testid="inventory-element-table"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Element Details Panel */}
      <ElementDetailsPanel
        element={selectedElement}
        isOpen={showElementDetails}
        onClose={() => {
          setShowElementDetails(false);
          setSelectedElement(null);
        }}
        onEdit={canEdit ? handleEditElement : undefined}
        onAddHistory={canEdit ? handleAddHistory : undefined}
        onUploadDocuments={canManageDocuments ? handleUploadDocuments : undefined}
        onScheduleEvaluation={handleScheduleEvaluation}
      />

      {/* Modals and Dialogs */}
      
      {/* Element Form Modal */}
      <ElementForm
        isOpen={showElementForm}
        onOpenChange={setShowElementForm}
        element={elementFormMode === 'edit' ? selectedElement : null}
        onSuccess={handleElementFormSuccess}
        mode={elementFormMode}
      />

      {/* Document Manager Modal */}
      {showDocumentManager && selectedElement && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Document Manager - {selectedElement.name}</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowDocumentManager(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              <DocumentManager
                element={selectedElement}
                onDocumentUploaded={handleDocumentManagerSuccess}
              />
            </div>
          </div>
        </div>
      )}

      {/* UNIFORMAT Browser Modal */}
      {showUniformatBrowser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">UNIFORMAT Browser</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowUniformatBrowser(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              <UniformatBrowser
                onCodeSelect={(code) => {
                  setUniformatFilter(code.code);
                  setShowUniformatBrowser(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* History Table Modal */}
      {showHistoryTable && selectedElement && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">History - {selectedElement.name}</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowHistoryTable(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              <HistoryTable
                element={selectedElement}
                onEditHistory={(entry) => {
                  console.log('Edit history:', entry);
                  // Handle edit history
                }}
                onViewDocuments={(entry) => {
                  console.log('View documents:', entry);
                  // Handle view documents
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main Inventory Page component with BuildingContext provider
 * Provides comprehensive building element inventory management
 */
function InventoryPageBase({ className }: { className?: string }) {
  return (
    <BuildingContextProvider>
      <div className={cn('flex-1 flex flex-col overflow-hidden bg-background', className)} data-testid="inventory-page">
        <Header title="Inventory Management" subtitle="Manage building elements, track conditions, and schedule maintenance activities according to Quebec standards." />
        <InventoryPageContent />
      </div>
    </BuildingContextProvider>
  );
}

export const InventoryPage = InventoryPageBase;

export default InventoryPage;