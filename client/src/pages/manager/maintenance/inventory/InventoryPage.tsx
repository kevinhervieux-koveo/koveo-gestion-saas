import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { BuildingElement } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';

// Import inventory components
import { InventoryHeader } from './InventoryHeader';
import { InventoryOverview } from './InventoryOverview';
import { ElementDetailsPanel } from './ElementDetailsPanel';

// Import existing maintenance components
import { ElementTable } from '@/components/maintenance/inventory/ElementTable';
import { ElementForm } from '@/components/maintenance/inventory/ElementForm';
import { ElementDocumentViewer } from '@/components/maintenance/inventory/ElementDocumentViewer';
import { UniformatBrowser } from '@/components/maintenance/inventory/UniformatBrowser';
import { HistoryTable } from '@/components/maintenance/inventory/HistoryTable';

import { 
  AlertTriangle, 
  Building, 
  Loader2, 
  RefreshCw,
  Package,
  X,
  ChevronDown,
  ChevronRight,
  Database,
} from 'lucide-react';

interface InventoryPageContentProps {
  className?: string;
  organizationId?: string;
  buildingId?: string;
  residenceId?: string;
  buildingName?: string;
  showBackButton?: boolean;
  backButtonLabel?: string;
  onBack?: () => void;
}

/**
 * Main inventory page content component
 * Handles state management and component integration
 */
function InventoryPageContent(props: InventoryPageContentProps) {
  const { 
    className, 
    organizationId, 
    buildingId, 
    residenceId,
    buildingName,
    showBackButton,
    backButtonLabel,
    onBack
  } = props;
  
  // State for Building Elements section collapsible
  const [buildingElementsExpanded, setBuildingElementsExpanded] = useState(false);
  
  console.log('🏠 [INVENTORY PAGE] Initializing with:', { 
    organizationId, 
    buildingId, 
    residenceId,
    showBackButton,
    backButtonLabel
  });
  
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

  // Permissions (simplified for now - you may want to implement proper role-based permissions)
  const canEdit = true; // hasPermission('canEditMaintenance');
  const canCreate = true; // hasPermission('canCreateProjects');
  const canManageDocuments = true; // hasPermission('canManageDocuments');

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

  const handleViewDocuments = useCallback((element: BuildingElement) => {
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

  const handleDeleteElement = useCallback((element: BuildingElement) => {
    // Delete handled by ElementTable component mutation
    // No additional state management needed here
  }, []);

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
  // Loading states handled by HOC

  // No building access state
  // Building availability handled by HOC

  // No building selected state
  if (!buildingId) {
    console.log('🏠 [INVENTORY PAGE] No building selected, showing selection prompt');
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <Package className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Select Building</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Please select an organization and building to view its maintenance inventory.
        </p>
      </div>
    );
  }
  
  console.log('🏠 [INVENTORY PAGE] Building selected, rendering inventory content for building:', buildingId);

  return (
    <div className={cn('flex-1 flex flex-col overflow-hidden', className)}>
      {/* Page Header */}
      <InventoryHeader
        buildingName={props.buildingName}
        showBackButton={showBackButton}
        onBack={onBack}
        onAddElement={canCreate ? handleAddElement : undefined}
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
            <Collapsible 
              open={buildingElementsExpanded} 
              onOpenChange={setBuildingElementsExpanded} 
              className="space-y-4" 
              data-testid="building-elements-section"
            >
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Building Elements</h2>
                  {selectedElements.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedElements.length} selected
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedElements.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedElements([])}
                      data-testid="clear-selection"
                    >
                      Clear Selection
                    </Button>
                  )}
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" data-testid="building-elements-toggle">
                      {buildingElementsExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="sr-only">Toggle building elements table</span>
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>
              
              <CollapsibleContent className="space-y-4">
                <ElementTable
                  buildingId={buildingId}
                  organizationId={organizationId}
                  onViewElement={handleViewElement}
                  onEditElement={canEdit ? handleEditElement : undefined}
                  onAddHistory={canEdit ? handleAddHistory : undefined}
                  onViewDocuments={handleViewDocuments}
                  onDeleteElement={canEdit ? handleDeleteElement : undefined}
                  selectedElements={selectedElements}
                  onSelectionChange={handleSelectionChange}
                  enableBulkActions={canEdit}
                  data-testid="inventory-element-table"
                />
              </CollapsibleContent>
            </Collapsible>
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
        buildingId={buildingId}
        organizationId={organizationId}
      />

      {/* Document Manager Modal */}
      {showDocumentManager && selectedElement && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Element Documents - {selectedElement.name}</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowDocumentManager(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              <ElementDocumentViewer
                elementId={selectedElement.id}
                elementName={selectedElement.name}
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
                buildingId={buildingId}
                organizationId={organizationId}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main Inventory Page component with hierarchical selection
 * Provides comprehensive building element inventory management
 */
function InventoryPageInner(props: InventoryPageContentProps) {
  console.log('🏠 [INVENTORY PAGE INNER] Rendering with props:', {
    organizationId: props.organizationId,
    buildingId: props.buildingId,
    residenceId: props.residenceId
  });
  
  return (
    <div className={cn('flex-1 flex flex-col overflow-hidden bg-background', props.className)} data-testid="inventory-page">
      <Header title="Inventory - Building Elements" subtitle="Manage building elements, track conditions, and schedule maintenance evaluations" />
      <InventoryPageContent {...props} />
    </div>
  );
}

// Wrap with hierarchical selection HOC using 2-level hierarchy (organization → building)
const InventoryPage = withHierarchicalSelection(InventoryPageInner, {
  hierarchy: ['organization', 'building'],
  title: 'Inventory Management'
});

export { InventoryPage };
export default InventoryPage;