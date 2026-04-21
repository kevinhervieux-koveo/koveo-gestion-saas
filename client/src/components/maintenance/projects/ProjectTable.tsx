import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ColumnDef, Row } from '@tanstack/react-table';
import { format } from 'date-fns';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge, PriorityBadge } from '@/components/maintenance/StatusBadges';
// import { useBuildingContext } from '@/hooks/use-building-context';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import {
  Eye,
  Edit2,
  Play,
  Archive,
  Download,
  Building2,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  Building,
  Wrench,
} from 'lucide-react';

export interface ProjectTableProps {
  className?: string;
  onProjectSelect?: (project: MaintenanceProject) => void;
  onEditProject?: (project: MaintenanceProject) => void;
  onViewTimeline?: (project: MaintenanceProject) => void;
  onAssignElements?: (project: MaintenanceProject) => void;
  showActions?: boolean;
  showBulkActions?: boolean;
  compact?: boolean;
  buildingId?: string;
  organizationId?: string;
  // Filter props for external filtering
  searchTerm?: string;
  statusFilter?: string;
  priorityFilter?: string;
  typeFilter?: string;
  showOverdueOnly?: boolean;
  // Filter change handlers
  onSearchChange?: (term: string) => void;
  onStatusFilterChange?: (status: string) => void;
  onPriorityFilterChange?: (priority: string) => void;
  onTypeFilterChange?: (type: string) => void;
  onShowOverdueChange?: (overdue: boolean) => void;
}

interface ProjectWithMetrics extends MaintenanceProject {
  progress: number;
  elementCount: number;
  daysRemaining?: number;
  budgetUtilization: number;
  isOverdue: boolean;
  isOverBudget: boolean;
}

/**
 * ProjectTable component for displaying maintenance projects with comprehensive data table features
 * Includes filtering, sorting, bulk actions, and detailed project metrics
 */
export function ProjectTable({
  className,
  onProjectSelect,
  onEditProject,
  onViewTimeline,
  onAssignElements,
  showActions = true,
  showBulkActions = true,
  compact = false,
  buildingId,
  organizationId,
  // Filter props
  searchTerm = '',
  statusFilter = '',
  priorityFilter = '',
  typeFilter = '',
  showOverdueOnly = false,
  // Filter change handlers
  onSearchChange,
  onStatusFilterChange,
  onPriorityFilterChange,
  onTypeFilterChange,
  onShowOverdueChange,
}: ProjectTableProps) {
  // Simplified placeholder - no context for now
  const hasPermission = () => true;
  const { toast } = useToast();
  const [selectedProjects, setSelectedProjects] = useState<Row<ProjectWithMetrics>[]>([]);

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
      return data;
    },
    enabled: !!buildingId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fix: Backend returns { success: true, data: projects }, but frontend expects { projects: [...] }
  const allProjects: ProjectWithMetrics[] = projectsResponse?.data || [];
  

  // Apply external filtering logic
  const projects = useMemo(() => {
    return allProjects.filter(project => {
      // Search filter
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          project.title.toLowerCase().includes(searchLower) ||
          project.projectNumber.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter && statusFilter !== 'all' && project.status !== statusFilter) {
        return false;
      }

      // Priority filter
      if (priorityFilter && priorityFilter !== 'all' && project.priority !== priorityFilter) {
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
  }, [allProjects, searchTerm, statusFilter, priorityFilter, showOverdueOnly]);

  // Bulk status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ projectIds, status }: { projectIds: string[]; status: string }) => {
      const response = await apiRequest('PATCH', '/api/maintenance/projects/bulk-status', {
        projectIds,
        status,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'projects'] });
      setSelectedProjects([]);
      toast({
        title: "Status Updated",
        description: "Project statuses have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to update project statuses. Please try again.",
        variant: "destructive",
      });
      console.error('Bulk status update failed:', error);
    },
  });

  // Archive projects mutation
  const archiveProjectsMutation = useMutation({
    mutationFn: async (projectIds: string[]) => {
      const response = await apiRequest('POST', '/api/maintenance/projects/archive', {
        projectIds,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'projects'] });
      setSelectedProjects([]);
      toast({
        title: "Projects Archived",
        description: "Selected projects have been archived successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Archive Failed",
        description: "Failed to archive projects. Please try again.",
        variant: "destructive",
      });
      console.error('Archive projects failed:', error);
    },
  });

  // Export projects mutation
  const exportProjectsMutation = useMutation({
    mutationFn: async (projectIds: string[]) => {
      const response = await apiRequest('POST', '/api/maintenance/projects/export', {
        projectIds,
        format: 'xlsx',
      });
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `projects-export-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Complete",
        description: "Projects have been exported successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: "Failed to export projects. Please try again.",
        variant: "destructive",
      });
      console.error('Export projects failed:', error);
    },
  });

  // Define table columns
  const columns: ColumnDef<ProjectWithMetrics>[] = useMemo(() => {
    const baseColumns: ColumnDef<ProjectWithMetrics>[] = [
      {
        accessorKey: 'title',
        header: 'Project Name',
        cell: ({ row }) => {
          const project = row.original;
          return (
            <div className="space-y-1 max-w-sm" data-testid={`project-name-${project.id}`}>
              <div className="font-medium text-sm leading-tight">
                {project.title}
              </div>
              <div className="text-xs text-muted-foreground">
                #{project.projectNumber}
              </div>
              {project.isOverdue && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Overdue
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusBadge 
            status={row.getValue('status')} 
            data-testid={`project-status-${row.original.id}`}
          />
        ),
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: ({ row }) => (
          <PriorityBadge 
            priority={row.getValue('priority')} 
            data-testid={`project-priority-${row.original.id}`}
          />
        ),
      },
      {
        accessorKey: 'plannedStartDate',
        header: 'Start Date',
        cell: ({ row }) => {
          const date = row.getValue('plannedStartDate') as string;
          if (!date) return <span className="text-muted-foreground text-sm">Not set</span>;
          
          return (
            <div className="text-sm" data-testid={`project-start-date-${row.original.id}`}>
              {format(new Date(date), 'MMM dd, yyyy')}
            </div>
          );
        },
      },
      {
        accessorKey: 'totalBudget',
        header: 'Budget',
        cell: ({ row }) => {
          const project = row.original;
          const budget = project.totalBudget ? parseFloat(project.totalBudget) : 0;
          const actual = project.actualCost ? parseFloat(project.actualCost) : 0;
          
          if (budget === 0) return <span className="text-muted-foreground text-sm">Not set</span>;
          
          return (
            <div className="space-y-1" data-testid={`project-budget-${project.id}`}>
              <div className="text-sm font-medium">
                ${budget.toLocaleString()}
              </div>
              <div className={cn(
                "text-xs",
                project.isOverBudget ? "text-red-600" : "text-green-600"
              )}>
                ${actual.toLocaleString()} spent ({project.budgetUtilization}%)
              </div>
            </div>
          );
        },
      },
    ];

    // Add actions column if enabled
    if (showActions) {
      baseColumns.push({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const project = row.original;
          
          return (
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 px-2"
                onClick={() => onProjectSelect?.(project)}
                data-testid={`button-view-${project.id}`}
              >
                <Eye className="h-4 w-4 mr-1" />
                <span className="text-xs">View</span>
              </Button>
              
              {hasPermission() && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => onEditProject?.(project)}
                  data-testid={`button-edit-${project.id}`}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  <span className="text-xs">Edit</span>
                </Button>
              )}
            </div>
          );
        },
      });
    }

    return baseColumns;
  }, [showActions, hasPermission, onProjectSelect, onEditProject, onViewTimeline, onAssignElements, updateStatusMutation]);

  // Bulk actions for selected rows
  const bulkActions = useMemo(() => {
    if (!showBulkActions || !hasPermission()) return [];

    return [
      {
        label: 'Update Status',
        icon: Play,
        onClick: (selectedRows: Row<ProjectWithMetrics>[]) => {
          // This would typically open a status selection dialog
          const projectIds = selectedRows.map(row => row.original.id);
          updateStatusMutation.mutate({ projectIds, status: 'in_progress' });
        },
        disabled: (selectedRows: Row<ProjectWithMetrics>[]) => selectedRows.length === 0,
      },
      {
        label: 'Export Projects',
        icon: Download,
        onClick: (selectedRows: Row<ProjectWithMetrics>[]) => {
          const projectIds = selectedRows.map(row => row.original.id);
          exportProjectsMutation.mutate(projectIds);
        },
        disabled: (selectedRows: Row<ProjectWithMetrics>[]) => selectedRows.length === 0,
      },
      {
        label: 'Archive',
        icon: Archive,
        onClick: (selectedRows: Row<ProjectWithMetrics>[]) => {
          const projectIds = selectedRows.map(row => row.original.id);
          archiveProjectsMutation.mutate(projectIds);
        },
        variant: 'destructive' as const,
        disabled: (selectedRows: Row<ProjectWithMetrics>[]) => selectedRows.length === 0,
      },
    ];
  }, [showBulkActions, hasPermission, updateStatusMutation, exportProjectsMutation, archiveProjectsMutation]);

  if (error) {
    return (
      <div className="text-center p-8" data-testid="projects-error">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Failed to Load Projects</h3>
        <p className="text-muted-foreground">
          There was an error loading the projects. Please try again.
        </p>
      </div>
    );
  }

  // Search and filter card component
  const hasActiveFilters = searchTerm || statusFilter || priorityFilter || showOverdueOnly;

  const searchFilterCard = (
    <Card className="border bg-muted/30">
      <CardContent className="p-4">
        <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4 sm:items-end">
          {/* Search Input */}
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Search Projects</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name or number..."
                value={searchTerm}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="pl-10"
                data-testid="search-projects-input"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange?.(value)}>
              <SelectTrigger className="w-[140px]" data-testid="status-filter">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="submission">Submission</SelectItem>
                <SelectItem value="pre_work">Pre-Work</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="post_work">Post-Work</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Priority</label>
            <Select value={priorityFilter} onValueChange={(value) => onPriorityFilterChange?.(value)}>
              <SelectTrigger className="w-[120px]" data-testid="priority-filter">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>


          {/* Overdue Filter */}
          <div className="flex items-center space-x-2 pb-2">
            <Checkbox
              id="overdue-filter"
              checked={showOverdueOnly}
              onCheckedChange={(checked) => onShowOverdueChange?.(!!checked)}
              data-testid="overdue-filter"
            />
            <label
              htmlFor="overdue-filter"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Overdue Only
            </label>
          </div>
        </div>

        {/* Filter Summary */}
        {hasActiveFilters && (
          <div className="mt-4 flex items-center justify-between pt-3 border-t border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>
                Showing {projects.length} of {allProjects.length} projects
              </span>
            </div>
            <div className="flex items-center gap-2">
              {searchTerm && (
                <Badge variant="secondary" className="text-xs">
                  Search: {searchTerm}
                </Badge>
              )}
              {statusFilter && statusFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs">
                  Status: {statusFilter}
                </Badge>
              )}
              {priorityFilter && priorityFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs">
                  Priority: {priorityFilter}
                </Badge>
              )}
              {showOverdueOnly && (
                <Badge variant="destructive" className="text-xs">
                  Overdue Only
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className={cn("space-y-4", className)} data-testid="project-table">
      {/* Search and Filter Controls Card */}
      {searchFilterCard}
      
      <DataTable
        columns={columns}
        data={projects}
        isLoading={isLoading}
        enableRowSelection={showBulkActions}
        enableFiltering={false}
        enableSorting={true}
        enableColumnVisibility={false}
        enablePagination={true}
        pageSize={compact ? 5 : 10}
        onSelectionChange={setSelectedProjects}
        onRowClick={(row) => onProjectSelect?.(row.original)}
        emptyState={{
          title: "No Projects Found",
          description: "No maintenance projects have been created for this building yet.",
          icon: Building2,
        }}
        getRowId={(row) => row.id}
        className="bg-card"
      />
    </div>
  );
}

