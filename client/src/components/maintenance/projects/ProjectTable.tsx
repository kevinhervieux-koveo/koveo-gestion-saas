import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
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
import { useLanguage } from '@/hooks/use-language';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { cn, parseDateOnly } from '@/lib/utils';
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
  const { t } = useLanguage();
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
        const endDate = parseDateOnly(project.plannedEndDate);
        const isOverdue = endDate && endDate < now && project.status !== 'completed';
        
        if (!isOverdue) return false;
      }

      return true;
    });
  }, [allProjects, searchTerm, statusFilter, priorityFilter, showOverdueOnly]);

  const projectsQueryKey: readonly unknown[] = ['/api/maintenance/buildings', buildingId, 'projects'];

  // Bulk status update mutation
  const updateStatusMutation = useCreateUpdateMutation<unknown, { projectIds: string[]; status: string }>({
    mutationFn: async ({ projectIds, status }) => {
      const response = await apiRequest('PATCH', '/api/maintenance/projects/bulk-status', {
        projectIds,
        status,
      });
      return response.json();
    },
    successTitle: 'Status Updated',
    successMessage: 'Project statuses have been updated successfully.',
    errorTitle: 'Update Failed',
    errorMessage: 'Failed to update project statuses. Please try again.',
    queryKeysToInvalidate: [projectsQueryKey],
    onSuccessCallback: () => {
      setSelectedProjects([]);
    },
    onErrorCallback: (error) => {
      console.error('Bulk status update failed:', error);
    },
  });

  // Archive projects mutation
  const archiveProjectsMutation = useCreateUpdateMutation<unknown, string[]>({
    mutationFn: async (projectIds: string[]) => {
      const response = await apiRequest('POST', '/api/maintenance/projects/archive', {
        projectIds,
      });
      return response.json();
    },
    successTitle: 'Projects Archived',
    successMessage: 'Selected projects have been archived successfully.',
    errorTitle: 'Archive Failed',
    errorMessage: 'Failed to archive projects. Please try again.',
    queryKeysToInvalidate: [projectsQueryKey],
    onSuccessCallback: () => {
      setSelectedProjects([]);
    },
    onErrorCallback: (error) => {
      console.error('Archive projects failed:', error);
    },
  });

  // Export projects mutation
  const exportProjectsMutation = useCreateUpdateMutation<Blob, string[]>({
    mutationFn: async (projectIds: string[]) => {
      const response = await apiRequest('POST', '/api/maintenance/projects/export', {
        projectIds,
        format: 'xlsx',
      });
      return response.blob();
    },
    successTitle: 'Export Complete',
    successMessage: 'Projects have been exported successfully.',
    errorTitle: 'Export Failed',
    errorMessage: 'Failed to export projects. Please try again.',
    onSuccessCallback: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `projects-export-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onErrorCallback: (error) => {
      console.error('Export projects failed:', error);
    },
  });

  // Define table columns
  const columns: ColumnDef<ProjectWithMetrics>[] = useMemo(() => {
    const baseColumns: ColumnDef<ProjectWithMetrics>[] = [
      {
        accessorKey: 'title',
        header: t('projectName'),
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
                  {t('overdue')}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: t('status'),
        cell: ({ row }) => (
          <StatusBadge 
            status={row.getValue('status')} 
            data-testid={`project-status-${row.original.id}`}
          />
        ),
      },
      {
        accessorKey: 'priority',
        header: t('priority'),
        cell: ({ row }) => (
          <PriorityBadge 
            priority={row.getValue('priority')} 
            data-testid={`project-priority-${row.original.id}`}
          />
        ),
      },
      {
        accessorKey: 'plannedStartDate',
        header: t('startDate'),
        cell: ({ row }) => {
          const date = row.getValue('plannedStartDate') as string;
          const parsed = parseDateOnly(date);
          if (!parsed) return <span className="text-muted-foreground text-sm">{t('notSet')}</span>;
          
          return (
            <div className="text-sm" data-testid={`project-start-date-${row.original.id}`}>
              {format(parsed, 'MMM dd, yyyy')}
            </div>
          );
        },
      },
      {
        accessorKey: 'totalBudget',
        header: t('budget'),
        cell: ({ row }) => {
          const project = row.original;
          const budget = project.totalBudget ? parseFloat(project.totalBudget) : 0;
          const actual = project.actualCost ? parseFloat(project.actualCost) : 0;
          
          if (budget === 0) return <span className="text-muted-foreground text-sm">{t('notSet')}</span>;
          
          return (
            <div className="space-y-1" data-testid={`project-budget-${project.id}`}>
              <div className="text-sm font-medium">
                ${budget.toLocaleString()}
              </div>
              <div className={cn(
                "text-xs",
                project.isOverBudget ? "text-red-600" : "text-green-600"
              )}>
                ${actual.toLocaleString()} ({project.budgetUtilization}%)
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
        header: t('actions'),
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
                <span className="text-xs">{t('view')}</span>
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
                  <span className="text-xs">{t('edit')}</span>
                </Button>
              )}
            </div>
          );
        },
      });
    }

    return baseColumns;
  }, [showActions, hasPermission, onProjectSelect, onEditProject, onViewTimeline, onAssignElements, updateStatusMutation, t]);

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
        <h3 className="text-lg font-semibold mb-2">{t('failedToLoadProjects')}</h3>
        <p className="text-muted-foreground">
          {t('errorLoadingProjects')}
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
            <label className="text-sm font-medium">{t('searchProjects')}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={t('searchByNamePlaceholder')}
                value={searchTerm}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="pl-10"
                data-testid="search-projects-input"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('status')}</label>
            <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange?.(value)}>
              <SelectTrigger className="w-[140px]" data-testid="status-filter">
                <SelectValue placeholder={t('allStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatus')}</SelectItem>
                <SelectItem value="planned">{t('planned')}</SelectItem>
                <SelectItem value="submission">Submission</SelectItem>
                <SelectItem value="pre_work">Pre-Work</SelectItem>
                <SelectItem value="in_progress">{t('inProgress')}</SelectItem>
                <SelectItem value="post_work">Post-Work</SelectItem>
                <SelectItem value="completed">{t('completed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('priority')}</label>
            <Select value={priorityFilter} onValueChange={(value) => onPriorityFilterChange?.(value)}>
              <SelectTrigger className="w-[120px]" data-testid="priority-filter">
                <SelectValue placeholder={t('all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                <SelectItem value="critical">{t('critical')}</SelectItem>
                <SelectItem value="high">{t('high')}</SelectItem>
                <SelectItem value="medium">{t('medium')}</SelectItem>
                <SelectItem value="low">{t('low')}</SelectItem>
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
              {t('overdueOnly')}
            </label>
          </div>
        </div>

        {/* Filter Summary */}
        {hasActiveFilters && (
          <div className="mt-4 flex items-center justify-between pt-3 border-t border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>
                {t('showing')} {projects.length} / {allProjects.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {searchTerm && (
                <Badge variant="secondary" className="text-xs">
                  {searchTerm}
                </Badge>
              )}
              {statusFilter && statusFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs">
                  {t('status')}: {statusFilter}
                </Badge>
              )}
              {priorityFilter && priorityFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs">
                  {t('priority')}: {priorityFilter}
                </Badge>
              )}
              {showOverdueOnly && (
                <Badge variant="destructive" className="text-xs">
                  {t('overdueOnly')}
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
        // Virtualize the row list so the DOM only contains the visible rows
        // (plus a small overscan). Without this, large project lists rendered
        // every filtered row on every filter / sort change, making the
        // commit phase O(n) in the row count and noticeably costly past a
        // few hundred rows. Virtualization implies pagination is off — the
        // DataTable handles that internally.
        enableVirtualization={true}
        estimatedRowHeight={84}
        virtualOverscan={8}
        virtualScrollHeight={compact ? '320px' : '640px'}
        onSelectionChange={setSelectedProjects}
        onRowClick={(row) => onProjectSelect?.(row.original)}
        emptyState={{
          title: t('noProjectsFoundTitle'),
          description: t('noProjectsForBuilding'),
          icon: Building2,
        }}
        getRowId={(row) => row.id}
        className="bg-card"
      />
    </div>
  );
}

