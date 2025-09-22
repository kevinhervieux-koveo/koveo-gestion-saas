import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { useBuildingContext } from '@/hooks/use-building-context';
import { cn } from '@/lib/utils';
import {
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  ChevronRight,
  Home,
  Building,
  Wrench,
  Folder,
  AlertTriangle,
  Clock,
  CheckCircle,
  MoreHorizontal,
  Table,
  Calendar,
  BarChart3,
  Lightbulb,
  Play,
  Pause,
  Archive,
  DollarSign,
} from 'lucide-react';

// View mode types
type ViewMode = 'table' | 'timeline' | 'dashboard';

export interface ProjectsHeaderProps {
  className?: string;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  onAddProject?: () => void;
  onCreateFromSuggestions?: () => void;
  onImportProjects?: () => void;
  onExportReport?: () => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  priorityFilter?: string;
  onPriorityFilterChange?: (priority: string) => void;
  typeFilter?: string;
  onTypeFilterChange?: (type: string) => void;
  showOverdueOnly?: boolean;
  onShowOverdueChange?: (overdue: boolean) => void;
}

/**
 * ProjectsHeader component for the maintenance projects page
 * Provides page title, breadcrumbs, view controls, actions, and filtering controls
 */
export function ProjectsHeader({
  className,
  viewMode = 'table',
  onViewModeChange,
  onAddProject,
  onCreateFromSuggestions,
  onImportProjects,
  onExportReport,
  searchTerm = '',
  onSearchChange,
  statusFilter = '',
  onStatusFilterChange,
  priorityFilter = '',
  onPriorityFilterChange,
  typeFilter = '',
  onTypeFilterChange,
  showOverdueOnly = false,
  onShowOverdueChange,
}: ProjectsHeaderProps) {
  const { building, availableBuildings, setBuildingId, hasPermission } = useBuildingContext();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const canEdit = hasPermission('canEditMaintenance');
  const canCreate = hasPermission('canCreateProjects');
  const canViewReports = hasPermission('canViewReports');

  // Count active filters
  const activeFiltersCount = [
    statusFilter,
    priorityFilter,
    typeFilter,
    showOverdueOnly && 'Overdue',
  ].filter(Boolean).length;

  return (
    <div className={cn('space-y-4 p-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60', className)}>
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground" data-testid="breadcrumb-nav">
        <Link href="/manager" className="flex items-center hover:text-foreground transition-colors">
          <Home className="h-4 w-4 mr-1" />
          Manager
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/manager/maintenance" className="flex items-center hover:text-foreground transition-colors">
          <Wrench className="h-4 w-4 mr-1" />
          Maintenance
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="flex items-center font-medium text-foreground">
          <Folder className="h-4 w-4 mr-1" />
          Projects
        </span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">
              Projects - Maintenance Management
            </h1>
            {building && (
              <Badge variant="outline" className="text-xs">
                <Building className="h-3 w-3 mr-1" />
                {building.name}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Manage maintenance projects, track progress, and coordinate work schedules
          </p>
        </div>

        {/* View Mode Controls and Primary Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* View Mode Toggle */}
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(value: ViewMode) => value && onViewModeChange?.(value)}
            className="bg-muted rounded-md p-1"
            data-testid="view-mode-toggle"
          >
            <ToggleGroupItem value="table" size="sm" data-testid="table-view-toggle">
              <Table className="h-4 w-4 mr-2" />
              Table
            </ToggleGroupItem>
            <ToggleGroupItem value="timeline" size="sm" data-testid="timeline-view-toggle">
              <Calendar className="h-4 w-4 mr-2" />
              Timeline
            </ToggleGroupItem>
            <ToggleGroupItem value="dashboard" size="sm" data-testid="dashboard-view-toggle">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Building Selector */}
          {availableBuildings.length > 1 && (
            <Select
              value={building?.id || ''}
              onValueChange={setBuildingId}
            >
              <SelectTrigger className="w-48" data-testid="building-selector">
                <SelectValue placeholder="Select building..." />
              </SelectTrigger>
              <SelectContent>
                {availableBuildings.map((bldg) => (
                  <SelectItem key={bldg.id} value={bldg.id}>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      <span>{bldg.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="actions-dropdown">
                <MoreHorizontal className="h-4 w-4 mr-2" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canViewReports && (
                <DropdownMenuItem onClick={onExportReport} data-testid="export-report-action">
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </DropdownMenuItem>
              )}
              {canEdit && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onImportProjects} data-testid="import-projects-action">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Projects
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2">
            {canCreate && (
              <Button 
                variant="outline" 
                onClick={onCreateFromSuggestions}
                data-testid="create-from-suggestions-button"
              >
                <Lightbulb className="h-4 w-4 mr-2" />
                From Suggestions
              </Button>
            )}

            {canCreate && (
              <Button onClick={onAddProject} data-testid="add-project-button">
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Global Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search projects by name, number, or description..."
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-10"
            data-testid="global-search-input"
          />
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2">
          <Button
            variant={filtersOpen ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltersOpen(!filtersOpen)}
            data-testid="filters-toggle"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>

          <Button
            variant={showOverdueOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => onShowOverdueChange?.(!showOverdueOnly)}
            data-testid="overdue-filter-button"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Overdue
          </Button>

          {/* Quick Status Filters */}
          <Button
            variant={statusFilter === 'work' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onStatusFilterChange?.(statusFilter === 'work' ? '' : 'work')}
            data-testid="active-projects-filter"
          >
            <Play className="h-4 w-4 mr-2" />
            Active
          </Button>

          <Button
            variant={statusFilter === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onStatusFilterChange?.(statusFilter === 'completed' ? '' : 'completed')}
            data-testid="completed-projects-filter"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Completed
          </Button>
        </div>
      </div>

      {/* Expanded Filters */}
      {filtersOpen && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg border" data-testid="expanded-filters">
          {/* Status Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger data-testid="status-filter">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="planned">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-500" />
                    Planned
                  </div>
                </SelectItem>
                <SelectItem value="evaluation">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    Evaluation
                  </div>
                </SelectItem>
                <SelectItem value="submission">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    Submission
                  </div>
                </SelectItem>
                <SelectItem value="pre_work">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    Pre-Work
                  </div>
                </SelectItem>
                <SelectItem value="work">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Work
                  </div>
                </SelectItem>
                <SelectItem value="post_work">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    Post-Work
                  </div>
                </SelectItem>
                <SelectItem value="completed">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Completed
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Priority</label>
            <Select value={priorityFilter} onValueChange={onPriorityFilterChange}>
              <SelectTrigger data-testid="priority-filter">
                <SelectValue placeholder="All priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Priorities</SelectItem>
                <SelectItem value="low">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Low
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    Medium
                  </div>
                </SelectItem>
                <SelectItem value="high">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    High
                  </div>
                </SelectItem>
                <SelectItem value="critical">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    Critical
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Type Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Project Type</label>
            <Select value={typeFilter} onValueChange={onTypeFilterChange}>
              <SelectTrigger data-testid="type-filter">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                <SelectItem value="evaluation">Evaluation</SelectItem>
                <SelectItem value="repair">Repair</SelectItem>
                <SelectItem value="minor_rehab">Minor Rehabilitation</SelectItem>
                <SelectItem value="major_rehab">Major Rehabilitation</SelectItem>
                <SelectItem value="replacement">Replacement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Project Status Quick Filters */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Quick Filters</label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={showOverdueOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => onShowOverdueChange?.(!showOverdueOnly)}
                data-testid="overdue-projects-filter"
              >
                <Clock className="h-3 w-3 mr-1" />
                Overdue
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Filter for projects due soon (within 7 days)
                  // This would be implemented in the parent component
                }}
                data-testid="due-soon-filter"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                Due Soon
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Filter for projects over budget
                  // This would be implemented in the parent component
                }}
                data-testid="over-budget-filter"
              >
                <DollarSign className="h-3 w-3 mr-1" />
                Over Budget
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { ProjectsHeaderProps };