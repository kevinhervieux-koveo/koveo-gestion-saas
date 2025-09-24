import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { 
  format, 
  addDays, 
  differenceInDays, 
  startOfMonth, 
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isWithinInterval,
  parseISO,
} from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { StatusBadge, PriorityBadge } from '@/components/maintenance/StatusBadges';
import { useBuildingContext } from '@/hooks/use-building-context';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  Calendar as CalendarDays,
  Users,
  Building2,
  Zap,
  Target,
  Filter,
  Download,
  ZoomIn,
  ZoomOut,
  RefreshCw,
} from 'lucide-react';

export interface ProjectTimelineProps {
  projects?: MaintenanceProject[];
  className?: string;
  variant?: 'gantt' | 'calendar' | 'list';
  showConflicts?: boolean;
  enableRescheduling?: boolean;
  onProjectClick?: (project: MaintenanceProject) => void;
  onDateRangeChange?: (project: MaintenanceProject, startDate: Date, endDate: Date) => void;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

interface TimelineProject extends MaintenanceProject {
  duration: number;
  startPosition: number;
  width: number;
  conflicts: string[];
  isOverdue: boolean;
  milestone?: {
    type: string;
    date: Date;
    label: string;
  }[];
}

type ViewPeriod = 'month' | 'quarter' | 'year';

/**
 * ProjectTimeline component for Gantt-style project scheduling and timeline visualization
 * Supports drag-and-drop rescheduling, conflict detection, and milestone tracking
 */
export function ProjectTimeline({
  projects: externalProjects,
  className,
  variant = 'gantt',
  showConflicts = true,
  enableRescheduling = true,
  onProjectClick,
  onDateRangeChange,
  dateRange,
}: ProjectTimelineProps) {
  const { buildingId, hasPermission } = useBuildingContext();
  const { toast } = useToast();
  
  // State management
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>('month');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Fetch projects if not provided externally
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
    enabled: !!buildingId && !externalProjects,
  });

  // Fix: Backend returns { success: true, data: projects }, but frontend expects { projects: [...] }
  const rawProjects: MaintenanceProject[] = externalProjects || projectsResponse?.data || [];

  // Calculate timeline boundaries
  const timelineBounds = useMemo(() => {
    if (dateRange) {
      return { start: dateRange.start, end: dateRange.end };
    }

    const today = new Date();
    let start: Date, end: Date;

    switch (viewPeriod) {
      case 'quarter':
        start = startOfMonth(addDays(today, -90));
        end = endOfMonth(addDays(today, 90));
        break;
      case 'year':
        start = startOfMonth(addDays(today, -180));
        end = endOfMonth(addDays(today, 365));
        break;
      default: // month
        start = startOfMonth(currentDate);
        end = endOfMonth(addDays(currentDate, 60));
    }

    return { start, end };
  }, [currentDate, viewPeriod, dateRange]);

  // Process projects for timeline visualization
  const timelineProjects: TimelineProject[] = useMemo(() => {
    const totalDays = differenceInDays(timelineBounds.end, timelineBounds.start);
    
    return rawProjects
      .filter(project => {
        // Filter by status
        if (filterStatus !== 'all' && project.status !== filterStatus) return false;
        
        // Filter by type
        if (filterType !== 'all' && project.type !== filterType) return false;
        
        // Filter projects that have dates within the visible range
        const hasStartDate = project.plannedStartDate || project.actualStartDate;
        const hasEndDate = project.plannedEndDate || project.actualEndDate;
        
        if (!hasStartDate || !hasEndDate) return false;
        
        const startDate = parseISO(hasStartDate);
        const endDate = parseISO(hasEndDate);
        
        return isWithinInterval(startDate, timelineBounds) || 
               isWithinInterval(endDate, timelineBounds) ||
               (startDate < timelineBounds.start && endDate > timelineBounds.end);
      })
      .map(project => {
        const startDate = parseISO(project.plannedStartDate || project.actualStartDate!);
        const endDate = parseISO(project.plannedEndDate || project.actualEndDate!);
        
        const duration = differenceInDays(endDate, startDate) + 1;
        const startPosition = Math.max(0, differenceInDays(startDate, timelineBounds.start));
        const endPosition = Math.min(totalDays, differenceInDays(endDate, timelineBounds.start) + 1);
        const width = Math.max(1, endPosition - startPosition);
        
        // Check for conflicts (overlapping projects of same type/resource)
        const conflicts = rawProjects
          .filter(other => 
            other.id !== project.id &&
            other.type === project.type &&
            other.plannedStartDate &&
            other.plannedEndDate
          )
          .filter(other => {
            const otherStart = parseISO(other.plannedStartDate!);
            const otherEnd = parseISO(other.plannedEndDate!);
            
            return (startDate <= otherEnd && endDate >= otherStart);
          })
          .map(other => other.id);

        // Check if overdue
        const today = new Date();
        const isOverdue = endDate < today && project.status !== 'completed';

        // Generate milestones based on project status and dates
        const milestones = [];
        
        if (project.actualStartDate && project.status !== 'planned') {
          milestones.push({
            type: 'start',
            date: parseISO(project.actualStartDate),
            label: 'Started',
          });
        }
        
        if (project.status === 'completed' && project.actualEndDate) {
          milestones.push({
            type: 'completion',
            date: parseISO(project.actualEndDate),
            label: 'Completed',
          });
        }

        return {
          ...project,
          duration,
          startPosition: (startPosition / totalDays) * 100,
          width: (width / totalDays) * 100,
          conflicts,
          isOverdue,
          milestone: milestones,
        };
      })
      .sort((a, b) => {
        // Sort by priority, then by start date
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder];
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder];
        
        if (aPriority !== bPriority) return aPriority - bPriority;
        
        const aStart = parseISO(a.plannedStartDate || a.actualStartDate!);
        const bStart = parseISO(b.plannedStartDate || b.actualStartDate!);
        
        return aStart.getTime() - bStart.getTime();
      });
  }, [rawProjects, timelineBounds, filterStatus, filterType]);

  // Date reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: async ({ projectId, startDate, endDate }: { 
      projectId: string; 
      startDate: Date; 
      endDate: Date; 
    }) => {
      const response = await apiRequest('PATCH', `/api/maintenance/projects/${projectId}`, {
        plannedStartDate: startDate.toISOString().split('T')[0],
        plannedEndDate: endDate.toISOString().split('T')[0],
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/buildings', buildingId, 'projects'] 
      });
      toast({
        title: "Schedule Updated",
        description: "Project timeline has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: "Failed to update project schedule. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleProjectReschedule = (project: MaintenanceProject, newStartDate: Date, newEndDate: Date) => {
    if (!enableRescheduling || !hasPermission('canEditMaintenance')) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to reschedule projects.",
        variant: "destructive",
      });
      return;
    }

    if (onDateRangeChange) {
      onDateRangeChange(project, newStartDate, newEndDate);
    } else {
      rescheduleMutation.mutate({ 
        projectId: project.id, 
        startDate: newStartDate, 
        endDate: newEndDate 
      });
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const daysToMove = viewPeriod === 'year' ? 365 : viewPeriod === 'quarter' ? 90 : 30;
    setCurrentDate(prev => addDays(prev, direction === 'next' ? daysToMove : -daysToMove));
  };

  const getProjectTypeColor = (type: string) => {
    const colors = {
      evaluation: 'bg-purple-100 border-purple-300 text-purple-800',
      repair: 'bg-orange-100 border-orange-300 text-orange-800',
      minor_rehab: 'bg-blue-100 border-blue-300 text-blue-800',
      major_rehab: 'bg-indigo-100 border-indigo-300 text-indigo-800',
      replacement: 'bg-green-100 border-green-300 text-green-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 border-gray-300 text-gray-800';
  };

  // Generate timeline grid (days/weeks/months based on view)
  const timelineGrid = useMemo(() => {
    const days = eachDayOfInterval(timelineBounds);
    const totalDays = days.length;
    
    return days.map((day, index) => ({
      date: day,
      position: (index / totalDays) * 100,
      isToday: isSameDay(day, new Date()),
      isWeekend: day.getDay() === 0 || day.getDay() === 6,
    }));
  }, [timelineBounds]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to Load Timeline</h3>
          <p className="text-muted-foreground">
            There was an error loading the project timeline. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full", className)} data-testid="project-timeline">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Project Timeline</CardTitle>
          
          <div className="flex items-center gap-2">
            {/* View Period Selector */}
            <Select value={viewPeriod} onValueChange={(value: ViewPeriod) => setViewPeriod(value)}>
              <SelectTrigger className="w-32" data-testid="select-view-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="quarter">Quarter</SelectItem>
                <SelectItem value="year">Year</SelectItem>
              </SelectContent>
            </Select>

            {/* Navigation */}
            <div className="flex items-center border rounded-md">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigateDate('prev')}
                data-testid="timeline-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="px-3" data-testid="timeline-date-picker">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(currentDate, 'MMM yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={currentDate}
                    onSelect={(date) => date && setCurrentDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigateDate('next')}
                data-testid="timeline-next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32" data-testid="filter-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="evaluation">Evaluation</SelectItem>
                <SelectItem value="work">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-32" data-testid="filter-type">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="evaluation">Evaluation</SelectItem>
              <SelectItem value="repair">Repair</SelectItem>
              <SelectItem value="minor_rehab">Minor Rehab</SelectItem>
              <SelectItem value="major_rehab">Major Rehab</SelectItem>
              <SelectItem value="replacement">Replacement</SelectItem>
            </SelectContent>
          </Select>

          {/* Conflict indicator */}
          {showConflicts && timelineProjects.some(p => p.conflicts.length > 0) && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {timelineProjects.filter(p => p.conflicts.length > 0).length} Conflicts
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Timeline Header with Date Grid */}
          <div className="relative h-8 bg-gray-50 rounded-md overflow-hidden">
            {timelineGrid
              .filter((_, index) => index % Math.max(1, Math.floor(timelineGrid.length / 30)) === 0)
              .map((gridDay) => (
                <div
                  key={gridDay.date.toISOString()}
                  className={cn(
                    "absolute top-0 h-full flex items-center justify-center text-xs",
                    gridDay.isToday && "bg-blue-100 text-blue-800 font-medium",
                    gridDay.isWeekend && "bg-gray-100 text-gray-500"
                  )}
                  style={{ 
                    left: `${gridDay.position}%`,
                    width: `${100 / timelineGrid.length * Math.max(1, Math.floor(timelineGrid.length / 30))}%`
                  }}
                >
                  {format(gridDay.date, viewPeriod === 'year' ? 'MMM' : 'dd')}
                </div>
              ))}
          </div>

          {/* Project Bars */}
          <div className="space-y-2 min-h-[200px]">
            {timelineProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-4" />
                <p>No projects found for the selected time period.</p>
              </div>
            ) : (
              timelineProjects.map((project, index) => (
                <TooltipProvider key={project.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        className="relative h-12 cursor-pointer group"
                        onClick={() => {
                          setSelectedProject(project.id);
                          onProjectClick?.(project);
                        }}
                        data-testid={`timeline-project-${project.id}`}
                      >
                        {/* Project Bar */}
                        <div
                          className={cn(
                            "absolute top-2 h-8 rounded-md border-2 transition-all",
                            "flex items-center px-2 text-xs font-medium",
                            getProjectTypeColor(project.type),
                            project.isOverdue && "border-red-400 bg-red-50",
                            project.conflicts.length > 0 && showConflicts && "border-yellow-400 bg-yellow-50",
                            selectedProject === project.id && "ring-2 ring-blue-400",
                            "group-hover:shadow-md group-hover:scale-105"
                          )}
                          style={{
                            left: `${project.startPosition}%`,
                            width: `${Math.max(project.width, 2)}%`
                          }}
                        >
                          <div className="flex items-center gap-1 truncate">
                            <StatusBadge status={project.status} size="sm" showIcon={false} />
                            <span className="truncate font-medium">{project.title}</span>
                          </div>

                          {/* Priority indicator */}
                          {project.priority === 'critical' && (
                            <Zap className="h-3 w-3 text-red-600 ml-auto" />
                          )}
                        </div>

                        {/* Milestones */}
                        {project.milestone?.map((milestone, mIndex) => {
                          const milestonePosition = (differenceInDays(milestone.date, timelineBounds.start) / 
                            differenceInDays(timelineBounds.end, timelineBounds.start)) * 100;
                          
                          return (
                            <div
                              key={mIndex}
                              className="absolute top-0 h-12 w-0.5 bg-green-600"
                              style={{ left: `${milestonePosition}%` }}
                            >
                              <div className="absolute -top-1 -left-1 w-3 h-3 bg-green-600 rounded-full" />
                            </div>
                          );
                        })}

                        {/* Conflict indicators */}
                        {showConflicts && project.conflicts.length > 0 && (
                          <div className="absolute -top-1 -right-1">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm">
                      <div className="space-y-2">
                        <div className="font-medium">{project.title}</div>
                        <div className="text-xs space-y-1">
                          <div>Status: <StatusBadge status={project.status} size="sm" /></div>
                          <div>Priority: <PriorityBadge priority={project.priority} size="sm" /></div>
                          <div>Duration: {project.duration} days</div>
                          {project.plannedStartDate && (
                            <div>Start: {format(parseISO(project.plannedStartDate), 'MMM dd, yyyy')}</div>
                          )}
                          {project.plannedEndDate && (
                            <div>End: {format(parseISO(project.plannedEndDate), 'MMM dd, yyyy')}</div>
                          )}
                          {project.isOverdue && (
                            <div className="text-red-600 font-medium">
                              <AlertTriangle className="h-3 w-3 inline mr-1" />
                              Overdue
                            </div>
                          )}
                          {project.conflicts.length > 0 && (
                            <div className="text-yellow-600">
                              <AlertTriangle className="h-3 w-3 inline mr-1" />
                              {project.conflicts.length} scheduling conflicts
                            </div>
                          )}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 pt-4 border-t text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-50 border border-red-400 rounded" />
              <span>Overdue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-50 border border-yellow-400 rounded" />
              <span>Conflicts</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-3 bg-green-600 rounded" />
              <span>Milestones</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export type { ProjectTimelineProps };