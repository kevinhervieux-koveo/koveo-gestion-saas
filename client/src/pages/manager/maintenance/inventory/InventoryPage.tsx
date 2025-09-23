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
// import { ElementDetailsPanel } from './ElementDetailsPanel'; // Replaced with ElementForm

// Import existing maintenance components
import { ElementTable } from '@/components/maintenance/inventory/ElementTable';
import { ElementDocumentViewer } from '@/components/maintenance/inventory/ElementDocumentViewer';
import { UniformatBrowser } from '@/components/maintenance/inventory/UniformatBrowser';
import { ElementForm } from '@/components/maintenance/inventory/ElementForm';

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
  
  // Debug log for state changes
  const [lastStateChange, setLastStateChange] = useState<string>('');
  
  // Log state changes
  const logStateChange = useCallback((action: string, details?: any) => {
    const timestamp = new Date().toISOString();
    const message = `🏠 [INVENTORY STATE] ${action}`;
    console.log(message, details ? details : '');
    setLastStateChange(`${timestamp}: ${action}`);
  }, []);
  
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
  const [showElementForm, setShowElementForm] = useState(false);
  const [elementFormMode, setElementFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [showDocumentManager, setShowDocumentManager] = useState(false);
  const [showUniformatBrowser, setShowUniformatBrowser] = useState(false);

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
    console.log('🏠 [INVENTORY ACTION] handleViewElement called:', { elementId: element.id, elementName: element.name });
    setSelectedElement(element);
    setElementFormMode('view');
    setShowElementForm(true);
    console.log('🏠 [INVENTORY STATE] Element form opened in view mode');
  }, []);

  const handleEditElement = useCallback((element: BuildingElement) => {
    console.log('🏠 [INVENTORY ACTION] handleEditElement called:', { elementId: element.id, elementName: element.name });
    setSelectedElement(element);
    setElementFormMode('edit');
    setShowElementForm(true);
    console.log('🏠 [INVENTORY STATE] Element form opened in edit mode');
  }, []);

  const handleAddElement = useCallback(() => {
    console.log('🏠 [INVENTORY ACTION] handleAddElement called');
    setSelectedElement(null); // null for create mode
    setElementFormMode('create');
    setShowElementForm(true);
    console.log('🏠 [INVENTORY STATE] Element form opened in create mode');
  }, []);


  const handleViewDocuments = useCallback((element: BuildingElement) => {
    console.log('🏠 [INVENTORY ACTION] handleViewDocuments called:', { elementId: element.id, elementName: element.name });
    setSelectedElement(element);
    setShowDocumentManager(true);
    console.log('🏠 [INVENTORY STATE] Document manager opened');
  }, []);

  const handleScheduleEvaluation = useCallback((element: BuildingElement) => {
    // TODO: Implement evaluation scheduling
    toast({
      title: 'Feature Coming Soon',
      description: 'Evaluation scheduling will be available in a future update.',
    });
  }, [toast]);

  const handleDeleteElement = useCallback((element: BuildingElement) => {
    console.log('🏠 [INVENTORY ACTION] handleDeleteElement called:', { elementId: element.id, elementName: element.name });
    // Close the element form first
    setShowElementForm(false);
    setSelectedElement(null);
    
    // Show success message
    toast({
      title: 'Element Deleted',
      description: `${element.name} has been successfully deleted from the inventory.`,
    });
    console.log('🏠 [INVENTORY STATE] Element deleted and form closed');
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



  // Filter handlers
  const handleSearchChange = useCallback((term: string) => {
    console.log('🏠 [INVENTORY FILTER] Search term changed:', term);
    setSearchTerm(term);
  }, []);

  const handleConditionFilterChange = useCallback((condition: string) => {
    console.log('🏠 [INVENTORY FILTER] Condition filter changed:', condition);
    setConditionFilter(condition);
  }, []);

  const handleUniformatFilterChange = useCallback((uniformat: string) => {
    console.log('🏠 [INVENTORY FILTER] UNIFORMAT filter changed:', uniformat);
    setUniformatFilter(uniformat);
  }, []);

  const handleShowOverdueChange = useCallback((overdue: boolean) => {
    console.log('🏠 [INVENTORY FILTER] Show overdue changed:', overdue);
    setShowOverdueOnly(overdue);
  }, []);

  // Selection handlers
  const handleSelectionChange = useCallback((selectedIds: string[]) => {
    console.log('🏠 [INVENTORY SELECTION] Selection changed:', { count: selectedIds.length, selectedIds });
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
              onOpenChange={(expanded) => {
                console.log('🏠 [INVENTORY UI] Building elements collapsible toggled:', expanded);
                setBuildingElementsExpanded(expanded);
                logStateChange('Building elements section toggled', { expanded });
              }} 
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

      {/* Element Form - Create/Edit Mode */}
      <ElementForm
        element={selectedElement}
        isOpen={showElementForm}
        onOpenChange={(open) => {
          console.log('🏠 [INVENTORY MODAL] Element form visibility changed:', { open, hasElement: !!selectedElement });
          setShowElementForm(open);
          if (!open) {
            console.log('🏠 [INVENTORY STATE] Clearing selected element');
            setSelectedElement(null);
          }
          logStateChange('Element form visibility changed', { open });
        }}
        mode={elementFormMode}
        buildingId={buildingId}
        organizationId={organizationId}
        onSuccess={(element) => {
          console.log('🏠 [INVENTORY SUCCESS] Element form success:', { elementId: element.id, elementName: element.name });
          setShowElementForm(false);
          setSelectedElement(null);
          console.log('🏠 [INVENTORY STATE] Element form closed after success');
        }}
      />

      {/* Modals and Dialogs */}

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