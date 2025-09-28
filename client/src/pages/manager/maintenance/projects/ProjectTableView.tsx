import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useBuildingContext } from '@/hooks/use-building-context';
import { apiRequest } from '@/lib/queryClient';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { ProjectTable } from '@/components/maintenance/projects';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Building2,
  Folder,
} from 'lucide-react';

export interface ProjectTableViewProps {
  className?: string;
  onProjectSelect?: (project: MaintenanceProject) => void;
  onEditProject?: (project: MaintenanceProject) => void;
  onManageElements?: (project: MaintenanceProject) => void;
  onManageTimeline?: (project: MaintenanceProject) => void;
  onUpdateStatus?: (project: MaintenanceProject) => void;
  searchTerm?: string;
  statusFilter?: string;
  priorityFilter?: string;
  typeFilter?: string;
  showOverdueOnly?: boolean;
  selectedProjects?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  buildingId?: string;
  organizationId?: string;
  // Filter change handlers
  onSearchChange?: (term: string) => void;
  onStatusFilterChange?: (status: string) => void;
  onPriorityFilterChange?: (priority: string) => void;
  onTypeFilterChange?: (type: string) => void;
  onShowOverdueChange?: (overdue: boolean) => void;
}

/**
 * ProjectTableView component providing the primary table interface for projects
 * Integrates with the existing ProjectTable component with enhanced filtering and controls
 */
export function ProjectTableView({
  className,
  onProjectSelect,
  onEditProject,
  onManageElements,
  onManageTimeline,
  onUpdateStatus,
  searchTerm = '',
  statusFilter = '',
  priorityFilter = '',
  typeFilter = '',
  showOverdueOnly = false,
  selectedProjects = [],
  onSelectionChange,
  buildingId,
  organizationId,
  // Filter change handlers
  onSearchChange,
  onStatusFilterChange,
  onPriorityFilterChange,
  onTypeFilterChange,
  onShowOverdueChange,
}: ProjectTableViewProps) {
  // Use building context to get current building state
  const { building, hasPermission } = useBuildingContext();

  // Permission checks for various actions
  const canCreateProjects = hasPermission ? hasPermission('canCreateProjects') : true;
  const canEditMaintenance = hasPermission ? hasPermission('canEditMaintenance') : true;
  const canViewMaintenance = hasPermission ? hasPermission('canViewMaintenance') : true;

  // Fetch projects for current building
  const {
    data: projectsResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/maintenance/buildings', buildingId, 'projects'],
    queryFn: async () => {
      if (!buildingId) throw new Error('Building ID is required');
      const response = await apiRequest('GET', `/api/maintenance/buildings/${buildingId}/projects`);
      const data = await response.json();
      // Processing projects response from backend
      return data;
    },
    enabled: !!buildingId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fix: Backend returns { success: true, data: projects }, but frontend expects { projects: [...] }
  const projects: MaintenanceProject[] = projectsResponse?.data || [];
  
  // Final projects array processed

  // Apply filters to projects
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          project.title.toLowerCase().includes(searchLower) ||
          project.projectNumber.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter && project.status !== statusFilter) {
        return false;
      }

      // Priority filter
      if (priorityFilter && project.priority !== priorityFilter) {
        return false;
      }


      // Overdue filter
      if (showOverdueOnly) {
        const now = new Date();
        const endDate = project.plannedEndDate ? new Date(project.plannedEndDate) : null;
        const isOverdue = endDate && endDate < now && project.status !== 'completed';
        
        if (!isOverdue) return false;
      }

      return true;
    });
  }, [projects, searchTerm, statusFilter, priorityFilter, showOverdueOnly]);

  // Handle project actions
  const handleViewTimeline = (project: MaintenanceProject) => {
    onManageTimeline?.(project);
  };

  const handleAssignElements = (project: MaintenanceProject) => {
    onManageElements?.(project);
  };

  // Handle loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)} data-testid="project-table-view-loading">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <Alert variant="destructive" className={className} data-testid="project-table-view-error">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load projects. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  // Handle no building selected state - check if buildingId prop is provided
  if (!buildingId) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8', className)} data-testid="no-building-selected">
        <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Building Selected</h3>
        <p className="text-muted-foreground text-center">
          Please select a building to view its maintenance projects.
        </p>
      </div>
    );
  }

  // Handle empty state
  if (filteredProjects.length === 0 && projects.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8', className)} data-testid="no-projects-empty-state">
        <Folder className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Projects Found</h3>
        <p className="text-muted-foreground text-center mb-4">
          No maintenance projects have been created for this building yet.
        </p>
        {canCreateProjects && (
          <p className="text-sm text-muted-foreground text-center">
            Get started by creating your first project or generating projects from evaluation suggestions.
          </p>
        )}
      </div>
    );
  }

  // Handle filtered empty state
  if (filteredProjects.length === 0 && projects.length > 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8', className)} data-testid="no-projects-filtered-state">
        <Folder className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Projects Match Filters</h3>
        <p className="text-muted-foreground text-center">
          No projects match your current search and filter criteria.
        </p>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Try adjusting your filters or search terms.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)} data-testid="project-table-view">
      {/* Results Summary */}
      {(searchTerm || statusFilter || priorityFilter || showOverdueOnly) && (
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
          <div className="text-sm">
            <span className="font-medium">{filteredProjects.length}</span>
            <span className="text-muted-foreground">
              {' '}of {projects.length} project{projects.length !== 1 ? 's' : ''} shown
            </span>
            {searchTerm && (
              <span className="text-muted-foreground">
                {' '}matching "{searchTerm}"
              </span>
            )}
          </div>
          
          {/* Active Filter Indicators */}
          <div className="flex items-center gap-2 text-xs">
            {statusFilter && (
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                Status: {statusFilter}
              </span>
            )}
            {priorityFilter && (
              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                Priority: {priorityFilter}
              </span>
            )}
            {showOverdueOnly && (
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                Overdue Only
              </span>
            )}
          </div>
        </div>
      )}

      {/* Projects Table */}
      <ProjectTable
        onProjectSelect={onProjectSelect}
        onEditProject={onEditProject}
        onViewTimeline={handleViewTimeline}
        onAssignElements={handleAssignElements}
        showActions={true}
        showBulkActions={canEditMaintenance}
        compact={false}
        className="bg-card"
        data-testid="main-projects-table"
        buildingId={buildingId}
        organizationId={organizationId}
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
        showOverdueOnly={showOverdueOnly}
        onSearchChange={onSearchChange}
        onStatusFilterChange={onStatusFilterChange}
        onPriorityFilterChange={onPriorityFilterChange}
        onShowOverdueChange={onShowOverdueChange}
      />

      {/* Additional Information */}
      {canEditMaintenance && filteredProjects.length > 0 && (
        <div className="text-xs text-muted-foreground text-center p-4 border-t">
          <p>
            Project data is updated in real-time. Use bulk actions to manage multiple projects at once.
          </p>
        </div>
      )}
    </div>
  );
}

