import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/hooks/use-language';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { BuildingElement } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';

// Import inventory components
import { InventoryOverview } from './InventoryOverview';
// import { ElementDetailsPanel } from './ElementDetailsPanel'; // Replaced with ElementForm

// Import existing maintenance components
import { ElementTable } from '@/components/maintenance/inventory/ElementTable';
import { ElementDocumentViewer } from '@/components/maintenance/inventory/ElementDocumentViewer';
import { UniformatBrowser } from '@/components/maintenance/inventory/UniformatBrowser';
import { ElementForm } from '@/components/maintenance/inventory/ElementForm';

import { 
  AlertTriangle, 
  ArrowLeft,
  Building, 
  Loader2, 
  RefreshCw,
  Package,
  X,
  ChevronDown,
  ChevronRight,
  Database,
  Search,
  Settings2,
  Filter,
  Plus,
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
  
  const { t } = useLanguage();
  
  // State for Building Elements section collapsible
  const [buildingElementsExpanded, setBuildingElementsExpanded] = useState(false);
  
  
  const { toast } = useToast();

  // Fetch building data for inventory overview
  const { data: buildingData } = useQuery({
    queryKey: ['/api/manager/buildings', buildingId],
    queryFn: async () => {
      if (!buildingId) return null;
      const response = await apiRequest('GET', `/api/manager/buildings/${buildingId}`);
      return await response.json();
    },
    enabled: !!buildingId,
  });


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
  const [filtersOpen, setFiltersOpen] = useState(false);

  // State for bulk operations
  const [selectedElements, setSelectedElements] = useState<string[]>([]);

  // Permissions (simplified for now - you may want to implement proper role-based permissions)
  const canEdit = true; // hasPermission('canEditMaintenance');
  const canCreate = true; // hasPermission('canCreateProjects');
  const canManageDocuments = true; // hasPermission('canManageDocuments');

  // Element handlers
  const handleViewElement = useCallback((element: BuildingElement) => {
    setSelectedElement(element);
    setElementFormMode('view');
    setShowElementForm(true);
  }, []);

  const handleEditElement = useCallback((element: BuildingElement) => {
    setSelectedElement(element);
    setElementFormMode('edit');
    setShowElementForm(true);
  }, []);

  const handleAddElement = useCallback(() => {
    setSelectedElement(null); // null for create mode
    setElementFormMode('create');
    setShowElementForm(true);
  }, []);


  const handleViewDocuments = useCallback((element: BuildingElement) => {
    setSelectedElement(element);
    setShowDocumentManager(true);
  }, []);

  const handleScheduleEvaluation = useCallback((element: BuildingElement) => {
    // NOTE: Evaluation scheduling feature not yet implemented.
    // This feature should:
    // - Open a modal to schedule periodic inspections for building elements
    // - Allow setting inspection frequency based on element condition and criticality
    // - Integrate with calendar/scheduling system for inspector assignments
    // - Send notifications when evaluations are due
    // - Track evaluation history and condition changes over time
    // 
    // Implementation requires:
    // - Backend API for creating/updating evaluation schedules
    // - EvaluationScheduleModal component with date picker and recurrence options
    // - Integration with notification system for reminders
    toast({
      title: t('featureComingSoon'),
      description: t('evaluationSchedulingComingSoon'),
    });
  }, [toast, t]);

  const handleDeleteElement = useCallback((element: BuildingElement) => {
    // Close the element form first
    setShowElementForm(false);
    setSelectedElement(null);
    
    // Show success message
    toast({
      title: t('elementDeleted'),
      description: `${element.name} ${t('elementDeletedSuccessfully')}`,
    });
  }, [toast, t]);

  // Import/Export handlers
  const handleImportElements = useCallback(() => {
    // NOTE: Element import feature not yet implemented.
    // This feature should:
    // - Accept CSV/Excel files with building element data
    // - Parse and validate file format (columns: name, location, uniformat, condition, etc.)
    // - Show preview of elements to be imported with validation warnings
    // - Allow mapping of file columns to database fields
    // - Bulk create elements with proper error handling
    // 
    // Implementation requires:
    // - File upload component with drag-drop support
    // - CSV/Excel parsing library (e.g., papaparse, xlsx)
    // - ImportPreviewModal to review and confirm imports
    // - Backend API endpoint for bulk element creation
    toast({
      title: t('featureComingSoon'),
      description: t('elementImportComingSoon'),
    });
  }, [toast, t]);

  const handleExportReport = useCallback(() => {
    // NOTE: Report export feature not yet implemented.
    // This feature should:
    // - Generate comprehensive inventory reports in PDF/Excel format
    // - Include filtered/selected elements with full details
    // - Support custom report templates (summary, detailed, maintenance plan)
    // - Add charts/graphs for condition distribution and replacement costs
    // - Include building photos and element images if available
    // 
    // Implementation requires:
    // - PDF generation library (e.g., jsPDF, react-pdf)
    // - Excel generation library (e.g., xlsx, exceljs)
    // - Report template designs and formatting logic
    // - Backend API to gather all report data efficiently
    toast({
      title: t('featureComingSoon'),
      description: t('reportExportComingSoon'),
    });
  }, [toast, t]);



  // Filter and search handlers
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
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <Package className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t('selectBuilding')}</h2>
        <p className="text-muted-foreground text-center max-w-md">
          {t('selectBuildingInventoryMessage')}
        </p>
      </div>
    );
  }
  
  return (
    <div className={cn('flex-1 flex flex-col overflow-hidden', className)}>
      {/* Header */}
      <Header 
        title={t('inventoryManagement')} 
        subtitle={t('inventoryManagementSubtitle')} 
      />
      
      {/* Back to Building Navigation */}
      {buildingId && buildingName && showBackButton && onBack && (
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center px-6 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="flex items-center gap-2"
              data-testid="button-back-to-building"
            >
              <ArrowLeft className="w-4 h-4" />
              {backButtonLabel || `${t('backToBuilding')} ${buildingName}`}
            </Button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          <div className="p-6 space-y-6">
            {/* Overview Cards */}
            <InventoryOverview 
              buildingId={buildingId}
              organizationId={organizationId}
              building={buildingData}
            />

            {/* Main Inventory Table */}
            <Collapsible 
              open={buildingElementsExpanded} 
              onOpenChange={(expanded) => {
                setBuildingElementsExpanded(expanded);
              }} 
              className="space-y-4" 
              data-testid="building-elements-section"
            >
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">{t('buildingElements')}</h2>
                  {selectedElements.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedElements.length} {t('selected')}
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
                      {t('clearSelection')}
                    </Button>
                  )}
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" data-testid="building-elements-toggle">
                      {buildingElementsExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="sr-only">{t('toggleBuildingElementsTable')}</span>
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>
              
              <CollapsibleContent className="space-y-4">
                {/* Controls Section */}
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Search Bar */}
                    <div className="relative flex-1 min-w-[280px] max-w-md">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder={t('searchElementsPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-10"
                        data-testid="element-search-input"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant={conditionFilter || uniformatFilter ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFiltersOpen(!filtersOpen)}
                      data-testid="filters-toggle"
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      {t('filters')}
                      {(conditionFilter || uniformatFilter || showOverdueOnly) && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {[conditionFilter, uniformatFilter, showOverdueOnly && t('overdueEvaluations')].filter(Boolean).length}
                        </Badge>
                      )}
                    </Button>

                    <Button
                      variant={showOverdueOnly ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleShowOverdueChange(!showOverdueOnly)}
                      data-testid="overdue-filter-button"
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      {t('overdueEvaluations')}
                    </Button>

                    {canCreate && (
                      <Button onClick={handleAddElement} data-testid="add-element-button">
                        <Plus className="h-4 w-4 mr-2" />
                        {t('addElement')}
                      </Button>
                    )}

                    </div>
                  </div>
                </div>

                {/* Expanded Filters */}
                {filtersOpen && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg border mt-4" data-testid="expanded-filters">
                    {/* Condition Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('condition')}</label>
                      <Select value={conditionFilter} onValueChange={handleConditionFilterChange}>
                        <SelectTrigger data-testid="condition-filter">
                          <SelectValue placeholder={t('allConditions')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('allConditions')}</SelectItem>
                          <SelectItem value="excellent">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              {t('excellent')}
                            </div>
                          </SelectItem>
                          <SelectItem value="good">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              {t('good')}
                            </div>
                          </SelectItem>
                          <SelectItem value="fair">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-yellow-500" />
                              {t('fair')}
                            </div>
                          </SelectItem>
                          <SelectItem value="poor">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              {t('poor')}
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* UNIFORMAT Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('uniformatCategory')}</label>
                      <Select value={uniformatFilter} onValueChange={handleUniformatFilterChange}>
                        <SelectTrigger data-testid="uniformat-filter">
                          <SelectValue placeholder={t('allCategories')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('allCategories')}</SelectItem>
                          <SelectItem value="A">{t('uniformatSubstructure')}</SelectItem>
                          <SelectItem value="B">{t('uniformatShell')}</SelectItem>
                          <SelectItem value="C">{t('uniformatInteriors')}</SelectItem>
                          <SelectItem value="D">{t('uniformatServices')}</SelectItem>
                          <SelectItem value="E">{t('uniformatEquipmentFurnishings')}</SelectItem>
                          <SelectItem value="F">{t('uniformatSpecialConstruction')}</SelectItem>
                          <SelectItem value="G">{t('uniformatBuildingSitework')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

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
                  searchTerm={searchTerm}
                  conditionFilter={conditionFilter}
                  uniformatFilter={uniformatFilter}
                  showOverdueOnly={showOverdueOnly}
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
          setShowElementForm(open);
          if (!open) {
            setSelectedElement(null);
          }
        }}
        mode={elementFormMode}
        buildingId={buildingId}
        organizationId={organizationId}
        onSuccess={(element) => {
          setShowElementForm(false);
          setSelectedElement(null);
        }}
      />

      {/* Modals and Dialogs */}

      {/* Document Manager Modal */}
      {showDocumentManager && selectedElement && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{t('elementDocuments')} - {selectedElement.name}</h2>
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
              <h2 className="text-lg font-semibold">{t('uniformatBrowser')}</h2>
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
  return (
    <div className={cn('flex-1 flex flex-col overflow-hidden bg-background', props.className)} data-testid="inventory-page">
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