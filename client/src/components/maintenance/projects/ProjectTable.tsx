import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ColumnDef, Row } from '@tanstack/react-table';
import { format } from 'date-fns';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge, PriorityBadge } from '@/components/maintenance/StatusBadges';
import { useBuildingContext } from '@/hooks/use-building-context';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import {
  MoreHorizontal,
  Eye,
  Edit2,
  Play,
  Calendar,
  Users,
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
}: ProjectTableProps) {
  const { buildingId, hasPermission } = useBuildingContext();
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
      return await response.json();
    },
    enabled: !!buildingId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const projects: ProjectWithMetrics[] = projectsResponse?.projects || [];

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
                <Badge variant="destructive" size="sm" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Overdue
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => {
          const type = row.getValue('type') as string;
          const typeConfig = {
            evaluation: { label: 'Evaluation', icon: Search, color: 'text-purple-600' },
            repair: { label: 'Repair', icon: Wrench, color: 'text-orange-600' },
            minor_rehab: { label: 'Minor Rehab', icon: Building, color: 'text-blue-600' },
            major_rehab: { label: 'Major Rehab', icon: Building2, color: 'text-indigo-600' },
            replacement: { label: 'Replacement', icon: CheckCircle2, color: 'text-green-600' },
          };
          
          const config = typeConfig[type as keyof typeof typeConfig];
          if (!config) return <span className="text-xs">{type}</span>;
          
          const IconComponent = config.icon;
          
          return (
            <div className="flex items-center gap-2" data-testid={`project-type-${row.original.id}`}>
              <IconComponent className={cn("h-4 w-4", config.color)} />
              <span className="text-sm font-medium">{config.label}</span>
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
            size="sm"
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
            size="sm"
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
        accessorKey: 'plannedEndDate',
        header: 'End Date',
        cell: ({ row }) => {
          const date = row.getValue('plannedEndDate') as string;
          const project = row.original;
          
          if (!date) return <span className="text-muted-foreground text-sm">Not set</span>;
          
          return (
            <div className="space-y-1" data-testid={`project-end-date-${project.id}`}>
              <div className="text-sm">
                {format(new Date(date), 'MMM dd, yyyy')}
              </div>
              {project.daysRemaining !== undefined && (
                <div className={cn(
                  "text-xs",
                  project.daysRemaining < 0 ? "text-red-600" : 
                  project.daysRemaining <= 7 ? "text-yellow-600" : "text-green-600"
                )}>
                  {project.daysRemaining < 0 
                    ? `${Math.abs(project.daysRemaining)} days overdue`
                    : `${project.daysRemaining} days left`
                  }
                </div>
              )}
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
      {
        accessorKey: 'progress',
        header: 'Progress',
        cell: ({ row }) => {
          const project = row.original;
          
          return (
            <div className="space-y-2 min-w-[100px]" data-testid={`project-progress-${project.id}`}>
              <Progress value={project.progress} className="h-2" />
              <div className="flex items-center justify-between text-xs">
                <span>{project.progress}%</span>
                <span className="text-muted-foreground">
                  {project.elementCount} elements
                </span>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="h-8 w-8 p-0"
                  data-testid={`project-actions-${project.id}`}
                >
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  onClick={() => onProjectSelect?.(project)}
                  data-testid={`action-view-${project.id}`}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                
                {hasPermission('canEditMaintenance') && (
                  <DropdownMenuItem 
                    onClick={() => onEditProject?.(project)}
                    data-testid={`action-edit-${project.id}`}
                  >
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit Project
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuItem 
                  onClick={() => onViewTimeline?.(project)}
                  data-testid={`action-timeline-${project.id}`}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  View Timeline
                </DropdownMenuItem>
                
                {hasPermission('canEditMaintenance') && (
                  <DropdownMenuItem 
                    onClick={() => onAssignElements?.(project)}
                    data-testid={`action-assign-elements-${project.id}`}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Assign Elements
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuSeparator />
                
                {project.status !== 'work' && hasPermission('canEditMaintenance') && (
                  <DropdownMenuItem 
                    onClick={() => updateStatusMutation.mutate({ 
                      projectIds: [project.id], 
                      status: 'work' 
                    })}
                    data-testid={`action-start-work-${project.id}`}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start Work
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      });
    }

    return baseColumns;
  }, [showActions, hasPermission, onProjectSelect, onEditProject, onViewTimeline, onAssignElements, updateStatusMutation]);

  // Bulk actions for selected rows
  const bulkActions = useMemo(() => {
    if (!showBulkActions || !hasPermission('canEditMaintenance')) return [];

    return [
      {
        label: 'Update Status',
        icon: Play,
        onClick: (selectedRows: Row<ProjectWithMetrics>[]) => {
          // This would typically open a status selection dialog
          const projectIds = selectedRows.map(row => row.original.id);
          updateStatusMutation.mutate({ projectIds, status: 'work' });
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

  return (
    <div className={cn("space-y-4", className)} data-testid="project-table">
      <DataTable
        columns={columns}
        data={projects}
        title="Maintenance Projects"
        description="Manage and track maintenance projects for your building"
        isLoading={isLoading}
        searchPlaceholder="Search projects by name or number..."
        searchableColumn="title"
        enableRowSelection={showBulkActions}
        enableFiltering={true}
        enableSorting={true}
        enableColumnVisibility={true}
        enablePagination={true}
        pageSize={compact ? 5 : 10}
        bulkActions={bulkActions}
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

export type { ProjectTableProps };