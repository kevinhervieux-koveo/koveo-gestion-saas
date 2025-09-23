import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { MaintenanceProject, EvaluationSuggestion } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';

// Import projects page components
import { ProjectsHeader } from './ProjectsHeader';
import { ProjectsOverview } from './ProjectsOverview';
import { ProjectDetailsPanel } from './ProjectDetailsPanel';
import { SuggestionsIntegration } from './SuggestionsIntegration';
import { ProjectTableView } from './ProjectTableView';
import { ProjectTimelineView } from './ProjectTimelineView';
import { ProjectDashboardView } from './ProjectDashboardView';

// Import existing maintenance components
import {
  ProjectForm,
  StatusStepper,
  ProjectTimeline,
  ProjectElements,
  ProjectNotes,
  ProjectBudget,
} from '@/components/maintenance/projects';

import { 
  AlertTriangle, 
  Building, 
  Loader2, 
  RefreshCw,
  Folder,
  Calendar,
  BarChart3,
  Table,
  X,
} from 'lucide-react';

// View mode types
type ViewMode = 'table' | 'timeline' | 'dashboard';

export interface ProjectsPageProps {
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
 * Main projects page content component
 * Handles state management and component integration
 */
function ProjectsPageContent(props: ProjectsPageProps) {
  const { 
    className, 
    organizationId, 
    buildingId, 
    residenceId,
    showBackButton,
    backButtonLabel,
    onBack,
    buildingName
  } = props;
  
  console.log('📁 [PROJECTS PAGE] Initializing with:', { 
    organizationId, 
    buildingId, 
    residenceId,
    showBackButton,
    backButtonLabel
  });
  
  const { toast } = useToast();

  // State for view mode
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // State for modals and panels
  const [selectedProject, setSelectedProject] = useState<MaintenanceProject | null>(null);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectFormMode, setProjectFormMode] = useState<'create' | 'edit'>('create');
  const [showStatusStepper, setShowStatusStepper] = useState(false);
  const [showProjectTimeline, setShowProjectTimeline] = useState(false);
  const [showProjectElements, setShowProjectElements] = useState(false);
  const [showProjectNotes, setShowProjectNotes] = useState(false);
  const [showProjectBudget, setShowProjectBudget] = useState(false);
  const [showSuggestionsIntegration, setShowSuggestionsIntegration] = useState(false);

  // State for filtering and search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  // State for bulk operations
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  // State for suggestions integration
  const [selectedSuggestions, setSelectedSuggestions] = useState<EvaluationSuggestion[]>([]);

  // Permissions (simplified for now - you may want to implement proper role-based permissions)
  const canEdit = true; // hasPermission('canEditMaintenance');
  const canCreate = true; // hasPermission('canCreateProjects');
  const canManageDocuments = true; // hasPermission('canManageDocuments');
  const canViewReports = true; // hasPermission('canViewReports');

  // Project handlers
  const handleViewProject = useCallback((project: MaintenanceProject) => {
    setSelectedProject(project);
    setShowProjectDetails(true);
  }, []);

  const handleEditProject = useCallback((project: MaintenanceProject) => {
    setSelectedProject(project);
    setProjectFormMode('edit');
    setShowProjectForm(true);
  }, []);

  const handleAddProject = useCallback(() => {
    setSelectedProject(null);
    setProjectFormMode('create');
    setShowProjectForm(true);
  }, []);

  const handleCreateFromSuggestions = useCallback(() => {
    setShowSuggestionsIntegration(true);
  }, []);

  const handleManageElements = useCallback((project: MaintenanceProject) => {
    setSelectedProject(project);
    setShowProjectElements(true);
  }, []);

  const handleManageTimeline = useCallback((project: MaintenanceProject) => {
    setSelectedProject(project);
    setShowProjectTimeline(true);
  }, []);

  const handleManageNotes = useCallback((project: MaintenanceProject) => {
    setSelectedProject(project);
    setShowProjectNotes(true);
  }, []);

  const handleManageBudget = useCallback((project: MaintenanceProject) => {
    setSelectedProject(project);
    setShowProjectBudget(true);
  }, []);

  const handleUpdateStatus = useCallback((project: MaintenanceProject) => {
    setSelectedProject(project);
    setShowStatusStepper(true);
  }, []);

  // Import/Export handlers
  const handleImportProjects = useCallback(() => {
    // TODO: Implement project import
    toast({
      title: 'Feature Coming Soon',
      description: 'Project import functionality will be available in a future update.',
    });
  }, [toast]);

  const handleExportReport = useCallback(() => {
    // TODO: Implement report export
    toast({
      title: 'Feature Coming Soon',
      description: 'Report export functionality will be available in a future update.',
    });
  }, [toast]);

  // View mode handlers
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  // Form success handlers
  const handleProjectFormSuccess = useCallback((project: MaintenanceProject) => {
    setShowProjectForm(false);
    setSelectedProject(null);
    
    // Show success message
    toast({
      title: projectFormMode === 'create' ? 'Project Created' : 'Project Updated',
      description: `${project.title} has been ${projectFormMode === 'create' ? 'created' : 'updated'} successfully.`,
    });
  }, [projectFormMode, toast]);

  const handleSuggestionsIntegrationSuccess = useCallback((projects: MaintenanceProject[]) => {
    setShowSuggestionsIntegration(false);
    setSelectedSuggestions([]);
    
    toast({
      title: 'Projects Created',
      description: `${projects.length} project(s) have been created from evaluation suggestions.`,
    });
  }, [toast]);

  const handleStatusStepperSuccess = useCallback(() => {
    setShowStatusStepper(false);
    
    toast({
      title: 'Status Updated',
      description: 'Project status has been updated successfully.',
    });
  }, [toast]);

  // Filter handlers
  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const handleStatusFilterChange = useCallback((status: string) => {
    setStatusFilter(status);
  }, []);

  const handlePriorityFilterChange = useCallback((priority: string) => {
    setPriorityFilter(priority);
  }, []);

  const handleTypeFilterChange = useCallback((type: string) => {
    setTypeFilter(type);
  }, []);

  const handleShowOverdueChange = useCallback((overdue: boolean) => {
    setShowOverdueOnly(overdue);
  }, []);

  // Selection handlers
  const handleSelectionChange = useCallback((selectedIds: string[]) => {
    setSelectedProjects(selectedIds);
  }, []);

  // Render current view
  const renderMainView = useMemo(() => {
    const commonProps = {
      onProjectSelect: handleViewProject,
      onEditProject: canEdit ? handleEditProject : undefined,
      onManageElements: canEdit ? handleManageElements : undefined,
      onManageTimeline: canEdit ? handleManageTimeline : undefined,
      onUpdateStatus: canEdit ? handleUpdateStatus : undefined,
      searchTerm,
      statusFilter,
      priorityFilter,
      typeFilter,
      showOverdueOnly,
      selectedProjects,
      onSelectionChange: handleSelectionChange,
      buildingId,
      organizationId,
    };

    switch (viewMode) {
      case 'timeline':
        return <ProjectTimelineView {...commonProps} />;
      case 'dashboard':
        return <ProjectDashboardView {...commonProps} />;
      case 'table':
      default:
        return <ProjectTableView {...commonProps} />;
    }
  }, [
    viewMode,
    handleViewProject,
    canEdit,
    handleEditProject,
    handleManageElements,
    handleManageTimeline,
    handleUpdateStatus,
    searchTerm,
    statusFilter,
    priorityFilter,
    typeFilter,
    showOverdueOnly,
    selectedProjects,
    handleSelectionChange,
  ]);

  // Loading states handled by HOC

  // Building availability handled by HOC

  // No building selected state
  if (!buildingId) {
    console.log('📁 [PROJECTS PAGE] No building selected, showing selection prompt');
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <Folder className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Select Building</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Please select an organization and building to view its maintenance projects.
        </p>
      </div>
    );
  }
  
  console.log('📁 [PROJECTS PAGE] Building selected, rendering projects content for building:', buildingId);

  return (
    <div className={cn('flex-1 flex flex-col overflow-hidden', className)}>
      {/* Page Header */}
      <ProjectsHeader
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onAddProject={canCreate ? handleAddProject : undefined}
        onCreateFromSuggestions={canCreate ? handleCreateFromSuggestions : undefined}
        onImportProjects={canEdit ? handleImportProjects : undefined}
        onExportReport={canViewReports ? handleExportReport : undefined}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={handlePriorityFilterChange}
        typeFilter={typeFilter}
        onTypeFilterChange={handleTypeFilterChange}
        showOverdueOnly={showOverdueOnly}
        onShowOverdueChange={handleShowOverdueChange}
        buildingId={buildingId}
        organizationId={organizationId}
        buildingName={buildingName}
        showBackButton={showBackButton}
        onBack={onBack}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          <div className="p-6 space-y-6">
            {/* Overview Cards */}
            <ProjectsOverview 
              buildingId={buildingId}
              organizationId={organizationId}
            />

            {/* Main Projects View */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {viewMode === 'table' && 'Projects Table'}
                  {viewMode === 'timeline' && 'Projects Timeline'}
                  {viewMode === 'dashboard' && 'Projects Dashboard'}
                </h2>
                {selectedProjects.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {selectedProjects.length} project(s) selected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedProjects([])}
                      data-testid="clear-selection"
                    >
                      Clear Selection
                    </Button>
                  </div>
                )}
              </div>

              {renderMainView}
            </div>
          </div>
        </div>
      </div>

      {/* Project Details Panel */}
      <ProjectDetailsPanel
        project={selectedProject}
        isOpen={showProjectDetails}
        onClose={() => {
          setShowProjectDetails(false);
          setSelectedProject(null);
        }}
        onEdit={canEdit ? handleEditProject : undefined}
        onManageElements={canEdit ? handleManageElements : undefined}
        onManageTimeline={canEdit ? handleManageTimeline : undefined}
        onManageNotes={canEdit ? handleManageNotes : undefined}
        onManageBudget={canEdit ? handleManageBudget : undefined}
        onUpdateStatus={canEdit ? handleUpdateStatus : undefined}
        buildingId={buildingId}
        organizationId={organizationId}
      />

      {/* Modals and Dialogs */}
      
      {/* Project Form Modal */}
      <ProjectForm
        isOpen={showProjectForm}
        onOpenChange={setShowProjectForm}
        project={projectFormMode === 'edit' ? selectedProject : null}
        onSuccess={handleProjectFormSuccess}
        mode={projectFormMode}
      />

      {/* Status Stepper Modal */}
      {showStatusStepper && selectedProject && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Project Status - {selectedProject.title}</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowStatusStepper(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              <StatusStepper
                project={selectedProject}
              />
            </div>
          </div>
        </div>
      )}

      {/* Project Timeline Modal */}
      {showProjectTimeline && selectedProject && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Project Timeline - {selectedProject.title}</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowProjectTimeline(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              <ProjectTimeline projects={[selectedProject]} />
            </div>
          </div>
        </div>
      )}

      {/* Project Elements Modal */}
      {showProjectElements && selectedProject && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Project Elements - {selectedProject.title}</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowProjectElements(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              <ProjectElements project={selectedProject} />
            </div>
          </div>
        </div>
      )}

      {/* Project Notes Modal */}
      {showProjectNotes && selectedProject && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Project Notes - {selectedProject.title}</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowProjectNotes(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              <ProjectNotes project={selectedProject} />
            </div>
          </div>
        </div>
      )}

      {/* Project Budget Modal */}
      {showProjectBudget && selectedProject && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Project Budget - {selectedProject.title}</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowProjectBudget(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              <ProjectBudget project={selectedProject} />
            </div>
          </div>
        </div>
      )}

      {/* Suggestions Integration Modal */}
      <SuggestionsIntegration
        isOpen={showSuggestionsIntegration}
        onClose={() => setShowSuggestionsIntegration(false)}
        selectedSuggestions={selectedSuggestions}
        onSelectionChange={setSelectedSuggestions}
        onSuccess={handleSuggestionsIntegrationSuccess}
        buildingId={buildingId}
        organizationId={organizationId}
      />
    </div>
  );
}

/**
 * Main Projects Page component with hierarchical selection
 * Provides comprehensive maintenance project management
 */
function ProjectsPageInner(props: ProjectsPageProps) {
  console.log('📁 [PROJECTS PAGE INNER] Rendering with props:', {
    organizationId: props.organizationId,
    buildingId: props.buildingId,
    residenceId: props.residenceId
  });
  
  return (
    <div className={cn('flex-1 flex flex-col overflow-hidden bg-background', props.className)} data-testid="projects-page">
      <Header title="Projects Management" subtitle="Plan, track, and manage maintenance projects with vendor coordination and budget tracking." />
      <ProjectsPageContent {...props} />
    </div>
  );
}

// Wrap with hierarchical selection HOC using 2-level hierarchy (organization → building)
const ProjectsPage = withHierarchicalSelection(ProjectsPageInner, {
  hierarchy: ['organization', 'building'],
  title: 'Projects Management'
});

export { ProjectsPage };
export default ProjectsPage;