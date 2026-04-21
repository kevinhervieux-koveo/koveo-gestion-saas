import type { ReactNode } from 'react';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { logDebug } from '@/lib/logger';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { useBuildingContext, BuildingContextProvider } from '@/hooks/use-building-context';
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

// Import auto-projects components
import { AutoProjectsSection } from '@/components/maintenance/auto-projects';

// Import existing maintenance components (lazy-loaded to reduce initial bundle size)
import {
  ProjectForm,
  StatusStepper,
  ProjectTimeline,
  ProjectElements,
  ProjectNotes,
  ProjectBudget,
} from '@/components/maintenance/projects/lazy-components';

// Import new workflow modal components
import { ProjectWorkflowModal } from '@/components/maintenance/projects/workflow/lazy-components';

import { 
  AlertTriangle, 
  Building, 
  Loader2, 
  RefreshCw,
  Folder,
  X,
  ChevronDown,
  ChevronRight,
  Database,
  Plus,
  BarChart3,
} from 'lucide-react';

// View mode types - simplified to table only
type ViewMode = 'table';

export interface ProjectsPageProps {
  className?: string;
  organizationId?: string;
  buildingId?: string;
  residenceId?: string;
  buildingName?: string;
  showBackButton?: boolean;
  backButtonLabel?: ReactNode;
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
  
  const { t } = useLanguage();
  
  const { toast } = useToast();

  // Use building context to sync with HOC props
  const { 
    buildingId: contextBuildingId, 
    organizationId: contextOrganizationId,
    setBuildingId, 
    setOrganizationId,
    building: contextBuilding
  } = useBuildingContext();

  // Component initialization debug log
  useEffect(() => {
    logDebug('🔍 [PROJECTS] Component initialized', {
      organizationId,
      buildingId,
      residenceId,
      buildingName,
      showBackButton
    });
  }, [organizationId, buildingId, residenceId, buildingName, showBackButton]);

  // Sync HOC props with building context
  useEffect(() => {
    if (organizationId && organizationId !== contextOrganizationId) {
      logDebug('🔍 [PROJECTS] Syncing organization ID with context', { organizationId });
      setOrganizationId(organizationId);
    }
  }, [organizationId, contextOrganizationId, setOrganizationId]);

  useEffect(() => {
    if (buildingId && buildingId !== contextBuildingId) {
      logDebug('🔍 [PROJECTS] Syncing building ID with context', { buildingId });
      setBuildingId(buildingId);
    }
  }, [buildingId, contextBuildingId, setBuildingId]);

  // State for view mode - fixed to table only
  const [viewMode] = useState<ViewMode>('table');
  
  // State for collapsible sections
  const [projectOverviewExpanded, setProjectOverviewExpanded] = useState(false);
  const [projectsTableExpanded, setProjectsTableExpanded] = useState(false);

  // Log collapsible section state changes
  useEffect(() => {
    logDebug('🔍 [PROJECTS] Project overview section toggled:', { expanded: projectOverviewExpanded });
  }, [projectOverviewExpanded]);

  useEffect(() => {
    logDebug('🔍 [PROJECTS] Projects table section toggled:', { expanded: projectsTableExpanded });
  }, [projectsTableExpanded]);
  

  // State for modals and panels
  const [selectedProject, setSelectedProject] = useState<MaintenanceProject | null>(null);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [showProjectWorkflow, setShowProjectWorkflow] = useState(false);
  const [workflowInitialTab, setWorkflowInitialTab] = useState<string | undefined>();
  const [showProjectForm, setShowProjectForm] = useState(false); // Keep for backward compatibility/special cases
  const [projectFormMode, setProjectFormMode] = useState<'create' | 'edit'>('create');
  const [showStatusStepper, setShowStatusStepper] = useState(false);
  const [showProjectTimeline, setShowProjectTimeline] = useState(false);
  const [showProjectElements, setShowProjectElements] = useState(false);
  const [showProjectNotes, setShowProjectNotes] = useState(false);
  const [showProjectBudget, setShowProjectBudget] = useState(false);
  const [showSuggestionsIntegration, setShowSuggestionsIntegration] = useState(false);

  // Log modal state changes
  useEffect(() => {
    if (showProjectForm) {
      logDebug('🔍 [PROJECTS] Modal opened: Project form', { mode: projectFormMode, projectId: selectedProject?.id });
    }
  }, [showProjectForm, projectFormMode, selectedProject?.id]);

  useEffect(() => {
    if (showProjectWorkflow) {
      logDebug('🔍 [PROJECTS] Modal opened: Project workflow', { projectId: selectedProject?.id, initialTab: workflowInitialTab });
    }
  }, [showProjectWorkflow, selectedProject?.id, workflowInitialTab]);

  useEffect(() => {
    if (showProjectDetails) {
      logDebug('🔍 [PROJECTS] Panel opened: Project details', { projectId: selectedProject?.id });
    }
  }, [showProjectDetails, selectedProject?.id]);

  useEffect(() => {
    if (showProjectElements) {
      logDebug('🔍 [PROJECTS] Modal opened: Project elements', { projectId: selectedProject?.id });
    }
  }, [showProjectElements, selectedProject?.id]);

  useEffect(() => {
    if (showProjectTimeline) {
      logDebug('🔍 [PROJECTS] Modal opened: Project timeline', { projectId: selectedProject?.id });
    }
  }, [showProjectTimeline, selectedProject?.id]);

  useEffect(() => {
    if (showProjectNotes) {
      logDebug('🔍 [PROJECTS] Modal opened: Project notes', { projectId: selectedProject?.id });
    }
  }, [showProjectNotes, selectedProject?.id]);

  useEffect(() => {
    if (showProjectBudget) {
      logDebug('🔍 [PROJECTS] Modal opened: Project budget', { projectId: selectedProject?.id });
    }
  }, [showProjectBudget, selectedProject?.id]);

  useEffect(() => {
    if (showSuggestionsIntegration) {
      logDebug('🔍 [PROJECTS] Modal opened: Suggestions integration');
    }
  }, [showSuggestionsIntegration]);

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
    logDebug('🔍 [PROJECTS] User action: View project', { projectId: project.id, projectTitle: project.title });
    setSelectedProject(project);
    setWorkflowInitialTab(undefined); // Let workflow determine the appropriate tab
    setShowProjectWorkflow(true);
  }, []);

  const handleEditProject = useCallback((project: MaintenanceProject) => {
    logDebug('🔍 [PROJECTS] User action: Edit project', { projectId: project.id, projectTitle: project.title });
    setSelectedProject(project);
    setWorkflowInitialTab(undefined); // Let workflow determine the appropriate tab
    setShowProjectWorkflow(true);
  }, []);

  const handleAddProject = useCallback(() => {
    logDebug('🔍 [PROJECTS] User action: Add new project');
    setSelectedProject(null);
    setProjectFormMode('create');
    setShowProjectForm(true); // Still use ProjectForm for creating new projects
  }, []);

  // Handler to open workflow modal at specific tab
  const handleOpenWorkflowTab = useCallback((project: MaintenanceProject, tabId?: string) => {
    logDebug('🔍 [PROJECTS] User action: Open workflow tab', { projectId: project.id, tabId });
    setSelectedProject(project);
    setWorkflowInitialTab(tabId);
    setShowProjectWorkflow(true);
  }, []);


  const handleManageElements = useCallback((project: MaintenanceProject) => {
    logDebug('🔍 [PROJECTS] User action: Manage elements', { projectId: project.id, projectTitle: project.title });
    setSelectedProject(project);
    setShowProjectElements(true);
  }, []);

  const handleManageTimeline = useCallback((project: MaintenanceProject) => {
    logDebug('🔍 [PROJECTS] User action: Manage timeline', { projectId: project.id, projectTitle: project.title });
    setSelectedProject(project);
    setShowProjectTimeline(true);
  }, []);

  const handleManageNotes = useCallback((project: MaintenanceProject) => {
    logDebug('🔍 [PROJECTS] User action: Manage notes', { projectId: project.id, projectTitle: project.title });
    setSelectedProject(project);
    setShowProjectNotes(true);
  }, []);

  const handleManageBudget = useCallback((project: MaintenanceProject) => {
    logDebug('🔍 [PROJECTS] User action: Manage budget', { projectId: project.id, projectTitle: project.title });
    setSelectedProject(project);
    setShowProjectBudget(true);
  }, []);

  const handleUpdateStatus = useCallback((project: MaintenanceProject) => {
    logDebug('🔍 [PROJECTS] User action: Update status', { projectId: project.id, currentStatus: project.status });
    // Open workflow modal at the current status tab for status management
    setSelectedProject(project);
    setWorkflowInitialTab(project.status);
    setShowProjectWorkflow(true);
  }, []);


  // View mode handlers - removed as only table view is available

  // Form success handlers
  const handleProjectFormSuccess = useCallback((project: MaintenanceProject) => {
    logDebug('🔍 [PROJECTS] Project form success', { 
      projectId: project.id, 
      projectTitle: project.title, 
      mode: projectFormMode 
    });
    setShowProjectForm(false);
    setSelectedProject(null);
    
    // Show success message
    toast({
      title: projectFormMode === 'create' ? t('projectCreated') : t('projectUpdated'),
      description: `${project.title} ${projectFormMode === 'create' ? t('projectCreatedSuccessfully') : t('projectUpdatedSuccessfully')}`,
    });
  }, [projectFormMode, toast, t]);

  const handleWorkflowModalUpdate = useCallback((project: MaintenanceProject) => {
    logDebug('🔍 [PROJECTS] Workflow modal updated', { projectId: project.id, projectTitle: project.title });
    // Update selected project with latest data
    setSelectedProject(project);
    
    // Note: We don't close the modal here as user might want to continue working with different tabs
    // The modal will handle its own state and navigation between tabs
  }, []);

  const handleSuggestionsIntegrationSuccess = useCallback((projects: MaintenanceProject[]) => {
    logDebug('🔍 [PROJECTS] Suggestions integration success', { projectCount: projects.length });
    setShowSuggestionsIntegration(false);
    setSelectedSuggestions([]);
    
    toast({
      title: t('projectsCreated'),
      description: `${projects.length} ${t('projectsCreatedFromSuggestions')}`,
    });
  }, [toast, t]);

  // Handle auto-project acceptance success
  const handleAutoProjectAccepted = useCallback((project: MaintenanceProject) => {
    logDebug('🔍 [PROJECTS] Auto-project accepted', { projectId: project.id, projectTitle: project.title });
    toast({
      title: t('projectCreatedSuccessfully2'),
      description: `${project.title} ${t('autoProjectConvertedSuccess')}`,
    });
    // Projects will be automatically refreshed by React Query cache invalidation
  }, [toast, t]);

  const handleStatusStepperSuccess = useCallback(() => {
    logDebug('🔍 [PROJECTS] Status stepper success');
    setShowStatusStepper(false);
    
    toast({
      title: t('statusUpdated'),
      description: t('projectStatusUpdatedSuccessfully'),
    });
  }, [toast, t]);

  // Filter handlers
  const handleSearchChange = useCallback((term: string) => {
    logDebug('🔍 [PROJECTS] Filter changed: Search term', { searchTerm: term });
    setSearchTerm(term);
  }, []);

  const handleStatusFilterChange = useCallback((status: string) => {
    logDebug('🔍 [PROJECTS] Filter changed: Status', { status });
    setStatusFilter(status);
  }, []);

  const handlePriorityFilterChange = useCallback((priority: string) => {
    logDebug('🔍 [PROJECTS] Filter changed: Priority', { priority });
    setPriorityFilter(priority);
  }, []);

  const handleTypeFilterChange = useCallback((type: string) => {
    logDebug('🔍 [PROJECTS] Filter changed: Type', { type });
    setTypeFilter(type);
  }, []);

  const handleShowOverdueChange = useCallback((overdue: boolean) => {
    logDebug('🔍 [PROJECTS] Filter changed: Show overdue only', { showOverdueOnly: overdue });
    setShowOverdueOnly(overdue);
  }, []);

  // Selection handlers
  const handleSelectionChange = useCallback((selectedIds: string[]) => {
    logDebug('🔍 [PROJECTS] Selection changed', { selectedCount: selectedIds.length, selectedIds });
    setSelectedProjects(selectedIds);
  }, []);

  // Render main view - simplified to only show table view
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
      // Filter change handlers
      onSearchChange: handleSearchChange,
      onStatusFilterChange: handleStatusFilterChange,
      onPriorityFilterChange: handlePriorityFilterChange,
      onTypeFilterChange: handleTypeFilterChange,
      onShowOverdueChange: handleShowOverdueChange,
    };

    return <ProjectTableView {...commonProps} />;
  }, [
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
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <Folder className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t('selectBuilding')}</h2>
        <p className="text-muted-foreground text-center max-w-md">
          {t('selectBuildingProjectsMessage')}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex-1 flex flex-col overflow-hidden', className)}>
      {/* Page Title and Navigation */}
      <Header 
        title={t('projectsMaintenanceManagement')}
        subtitle={t('projectsManagementSubtitle')}
      />
      
      {/* Project Controls and Filters */}
      <ProjectsHeader
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
            {/*
              Auto-Generated Projects Section — hidden for now (Task #67).
              Component and backend logic intentionally kept for future use;
              re-enable by restoring the <AutoProjectsSection /> block below.

              <AutoProjectsSection
                buildingId={buildingId}
                onProjectAccepted={handleAutoProjectAccepted}
                defaultExpanded={true}
              />
            */}

            {/* Project Overview */}
            <Collapsible 
              open={projectOverviewExpanded} 
              onOpenChange={(expanded) => {
                setProjectOverviewExpanded(expanded);
              }} 
              className="space-y-4" 
              data-testid="project-overview-section"
            >
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">{t('projectOverview')}</h2>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" data-testid="project-overview-toggle">
                    {projectOverviewExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="sr-only">{t('toggleProjectOverview')}</span>
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
                setProjectsTableExpanded(expanded);
              }} 
              className="space-y-4" 
              data-testid="projects-table-section"
            >
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">{t('projects')}</h2>
                  {selectedProjects.length > 0 && (
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-sm text-muted-foreground">
                        {selectedProjects.length} {t('projectsSelected')}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canCreate && (
                    <Button onClick={handleAddProject} size="sm" data-testid="add-project-button">
                      <Plus className="h-4 w-4 mr-1" />
                      {t('newProject')}
                    </Button>
                  )}
                  {selectedProjects.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedProjects([])}
                      data-testid="clear-selection"
                    >
                      {t('clearSelection')}
                    </Button>
                  )}
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" data-testid="projects-table-toggle">
                      {projectsTableExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="sr-only">{t('toggleProjectsTable')}</span>
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>
              
              <CollapsibleContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-md font-medium">
                      {t('projectTable')}
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
      
      {/* Project Form Modal - Used for creating new projects */}
      <ProjectForm
        isOpen={showProjectForm}
        onOpenChange={(open) => {
          setShowProjectForm(open);
          if (!open) {
            setSelectedProject(null);
          }
        }}
        project={projectFormMode === 'edit' ? selectedProject : null}
        onSuccess={handleProjectFormSuccess}
        mode={projectFormMode}
      />

      {/* Project Workflow Modal - Used for managing existing projects */}
      {selectedProject && (
        <ProjectWorkflowModal
          isOpen={showProjectWorkflow}
          onOpenChange={(open) => {
            setShowProjectWorkflow(open);
            if (!open) {
              setSelectedProject(null);
              setWorkflowInitialTab(undefined);
            }
          }}
          project={selectedProject}
          initialTab={workflowInitialTab}
          onProjectUpdate={handleWorkflowModalUpdate}
        />
      )}

      {/* Status Stepper Modal */}
      {showStatusStepper && selectedProject && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{t('projectStatus')} - {selectedProject.title}</h2>
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
              <h2 className="text-lg font-semibold">{t('projectTimeline')} - {selectedProject.title}</h2>
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
              <h2 className="text-lg font-semibold">{t('projectElements')} - {selectedProject.title}</h2>
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
              <h2 className="text-lg font-semibold">{t('projectNotes')} - {selectedProject.title}</h2>
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
              <h2 className="text-lg font-semibold">{t('projectBudget')} - {selectedProject.title}</h2>
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
  return (
    <BuildingContextProvider 
      initialOrganizationId={props.organizationId}
      initialBuildingId={props.buildingId}
    >
      <div className={cn('flex-1 flex flex-col overflow-hidden bg-background', props.className)} data-testid="projects-page">
        <ProjectsPageContent {...props} />
      </div>
    </BuildingContextProvider>
  );
}

// Wrap with hierarchical selection HOC using 2-level hierarchy (organization → building)
const ProjectsPage = withHierarchicalSelection(ProjectsPageInner, {
  hierarchy: ['organization', 'building'],
  title: 'Projects Management'
});

export { ProjectsPage };
export default ProjectsPage;