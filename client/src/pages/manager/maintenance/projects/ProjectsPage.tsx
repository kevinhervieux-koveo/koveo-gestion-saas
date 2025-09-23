import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useBuildingContext } from '@/hooks/use-building-context';
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
  ChevronDown,
  ChevronRight,
  Database,
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

  // Use building context to sync with HOC props
  const { 
    buildingId: contextBuildingId, 
    organizationId: contextOrganizationId,
    setBuildingId, 
    setOrganizationId,
    building: contextBuilding
  } = useBuildingContext();

  // Sync HOC props with building context
  useEffect(() => {
    if (organizationId && organizationId !== contextOrganizationId) {
      console.log('📁 [PROJECTS PAGE] Syncing organization ID with context:', organizationId);
      setOrganizationId(organizationId);
    }
  }, [organizationId, contextOrganizationId, setOrganizationId]);

  useEffect(() => {
    if (buildingId && buildingId !== contextBuildingId) {
      console.log('📁 [PROJECTS PAGE] Syncing building ID with context:', buildingId);
      setBuildingId(buildingId);
    }
  }, [buildingId, contextBuildingId, setBuildingId]);

  // State for view mode
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  
  // State for collapsible sections
  const [projectOverviewExpanded, setProjectOverviewExpanded] = useState(false);
  const [projectsTableExpanded, setProjectsTableExpanded] = useState(false);
  
  // Debug log for state changes
  const [lastStateChange, setLastStateChange] = useState<string>('');
  
  // Log state changes
  const logStateChange = useCallback((action: string, details?: any) => {
    const timestamp = new Date().toISOString();
    const message = `📁 [PROJECTS STATE] ${action}`;
    console.log(message, details ? details : '');
    setLastStateChange(`${timestamp}: ${action}`);
  }, []);

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
    console.log('📁 [PROJECTS ACTION] handleViewProject called:', { projectId: project.id, projectTitle: project.title });
    setSelectedProject(project);
    setShowProjectDetails(true);
    console.log('📁 [PROJECTS STATE] Project details panel opened');
  }, []);

  const handleEditProject = useCallback((project: MaintenanceProject) => {
    console.log('📁 [PROJECTS ACTION] handleEditProject called:', { projectId: project.id, projectTitle: project.title });
    setSelectedProject(project);
    setProjectFormMode('edit');
    setShowProjectForm(true);
    console.log('📁 [PROJECTS STATE] Project form opened in edit mode');
  }, []);

  const handleAddProject = useCallback(() => {
    console.log('📁 [PROJECTS ACTION] handleAddProject called');
    setSelectedProject(null);
    setProjectFormMode('create');
    setShowProjectForm(true);
    console.log('📁 [PROJECTS STATE] Project form opened in create mode');
  }, []);

  const handleCreateFromSuggestions = useCallback(() => {
    console.log('📁 [PROJECTS ACTION] handleCreateFromSuggestions called');
    setShowSuggestionsIntegration(true);
    console.log('📁 [PROJECTS STATE] Suggestions integration modal opened');
  }, []);

  const handleManageElements = useCallback((project: MaintenanceProject) => {
    console.log('📁 [PROJECTS ACTION] handleManageElements called:', { projectId: project.id, projectTitle: project.title });
    setSelectedProject(project);
    setShowProjectElements(true);
    console.log('📁 [PROJECTS STATE] Project elements modal opened');
  }, []);

  const handleManageTimeline = useCallback((project: MaintenanceProject) => {
    console.log('📁 [PROJECTS ACTION] handleManageTimeline called:', { projectId: project.id, projectTitle: project.title });
    setSelectedProject(project);
    setShowProjectTimeline(true);
    console.log('📁 [PROJECTS STATE] Project timeline modal opened');
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
    console.log('📁 [PROJECTS ACTION] handleUpdateStatus called:', { projectId: project.id, projectTitle: project.title, currentStatus: project.status });
    setSelectedProject(project);
    setShowStatusStepper(true);
    console.log('📁 [PROJECTS STATE] Status stepper modal opened');
  }, []);


  // View mode handlers
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    console.log('📁 [PROJECTS VIEW] View mode changed:', { from: viewMode, to: mode });
    setViewMode(mode);
    console.log('📁 [PROJECTS STATE] View mode updated');
  }, [viewMode]);

  // Form success handlers
  const handleProjectFormSuccess = useCallback((project: MaintenanceProject) => {
    console.log('📁 [PROJECTS SUCCESS] Project form success:', { projectId: project.id, projectTitle: project.title, mode: projectFormMode });
    setShowProjectForm(false);
    setSelectedProject(null);
    
    // Show success message
    toast({
      title: projectFormMode === 'create' ? 'Project Created' : 'Project Updated',
      description: `${project.title} has been ${projectFormMode === 'create' ? 'created' : 'updated'} successfully.`,
    });
    console.log('📁 [PROJECTS STATE] Project form closed after success');
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
    console.log('📁 [PROJECTS FILTER] Search term changed:', term);
    setSearchTerm(term);
  }, []);

  const handleStatusFilterChange = useCallback((status: string) => {
    console.log('📁 [PROJECTS FILTER] Status filter changed:', status);
    setStatusFilter(status);
  }, []);

  const handlePriorityFilterChange = useCallback((priority: string) => {
    console.log('📁 [PROJECTS FILTER] Priority filter changed:', priority);
    setPriorityFilter(priority);
  }, []);

  const handleTypeFilterChange = useCallback((type: string) => {
    console.log('📁 [PROJECTS FILTER] Type filter changed:', type);
    setTypeFilter(type);
  }, []);

  const handleShowOverdueChange = useCallback((overdue: boolean) => {
    console.log('📁 [PROJECTS FILTER] Show overdue changed:', overdue);
    setShowOverdueOnly(overdue);
  }, []);

  // Selection handlers
  const handleSelectionChange = useCallback((selectedIds: string[]) => {
    console.log('📁 [PROJECTS SELECTION] Selection changed:', { count: selectedIds.length, selectedIds });
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
      {/* Page Title and Navigation */}
      <Header 
        title="Projects - Maintenance Management"
        subtitle="Manage maintenance projects, track progress, and coordinate work schedules"
      />
      
      {/* Project Controls and Filters */}
      <ProjectsHeader
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onAddProject={canCreate ? handleAddProject : undefined}
        onCreateFromSuggestions={canCreate ? handleCreateFromSuggestions : undefined}
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
            {/* Project Overview */}
            <Collapsible 
              open={projectOverviewExpanded} 
              onOpenChange={(expanded) => {
                console.log('📁 [PROJECTS UI] Project overview collapsible toggled:', expanded);
                setProjectOverviewExpanded(expanded);
                logStateChange('Project overview section toggled', { expanded });
              }} 
              className="space-y-4" 
              data-testid="project-overview-section"
            >
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Project Overview</h2>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" data-testid="project-overview-toggle">
                    {projectOverviewExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="sr-only">Toggle project overview</span>
                  </Button>
                </CollapsibleTrigger>
              </div>
              
              <CollapsibleContent className="space-y-4">
                <ProjectsOverview 
                  buildingId={buildingId}
                  organizationId={organizationId}
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Projects Table */}
            <Collapsible 
              open={projectsTableExpanded} 
              onOpenChange={(expanded) => {
                console.log('📁 [PROJECTS UI] Projects table collapsible toggled:', expanded);
                setProjectsTableExpanded(expanded);
                logStateChange('Projects table section toggled', { expanded });
              }} 
              className="space-y-4" 
              data-testid="projects-table-section"
            >
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Projects</h2>
                  {selectedProjects.length > 0 && (
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-sm text-muted-foreground">
                        {selectedProjects.length} project(s) selected
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedProjects.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedProjects([])}
                      data-testid="clear-selection"
                    >
                      Clear Selection
                    </Button>
                  )}
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" data-testid="projects-table-toggle">
                      {projectsTableExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="sr-only">Toggle projects table</span>
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>
              
              <CollapsibleContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-md font-medium">
                      {viewMode === 'table' && 'Projects Table'}
                      {viewMode === 'timeline' && 'Projects Timeline'}
                      {viewMode === 'dashboard' && 'Projects Dashboard'}
                    </h3>
                  </div>

                  {renderMainView}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </div>

      {/* Project Details Panel */}
      <ProjectDetailsPanel
        project={selectedProject}
        isOpen={showProjectDetails}
        onClose={() => {
          console.log('📁 [PROJECTS ACTION] Project details panel closed');
          setShowProjectDetails(false);
          setSelectedProject(null);
          console.log('📁 [PROJECTS STATE] Selected project cleared');
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
        onOpenChange={(open) => {
          console.log('📁 [PROJECTS MODAL] Project form visibility changed:', { open, mode: projectFormMode, hasProject: !!selectedProject });
          setShowProjectForm(open);
          logStateChange('Project form visibility changed', { open, mode: projectFormMode });
        }}
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