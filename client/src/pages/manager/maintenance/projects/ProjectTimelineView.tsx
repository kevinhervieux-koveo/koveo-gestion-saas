// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, startOfMonth, endOfMonth, format, isSameDay, isToday, isBefore } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge, PriorityBadge } from '@/components/maintenance/StatusBadges';
import { useBuildingPermissions } from '@/hooks/use-building-context';
import { useLanguage } from '@/hooks/use-language';
import { apiRequest } from '@/lib/queryClient';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { cn, parseDateOnly } from '@/lib/utils';
import {
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  ExternalLink,
  Target,
  Building2,
  Users,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

export interface ProjectTimelineViewProps {
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
}

type TimelineView = 'month' | 'quarter' | 'year';

interface ProjectEvent {
  project: MaintenanceProject;
  date: Date;
  type: 'start' | 'end' | 'milestone';
  label: string;
  isOverdue?: boolean;
}

/**
 * ProjectTimelineView component providing calendar and timeline interface
 * Displays projects in Gantt-style timeline with scheduling and conflict detection
 */
export function ProjectTimelineView({
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
}: ProjectTimelineViewProps) {
  // Task #1271: route through the real permission hook so the
  // gated UI (status-update bar, etc.) is actually hidden for users
  // without `canEditMaintenance`. The previous placeholder
  // `() => true` left manager pages indistinguishable from admin pages.
  const building = null;
  const { hasPermission } = useBuildingPermissions();
  const { t } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timelineView, setTimelineView] = useState<TimelineView>('month');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

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
    staleTime: 2 * 60 * 1000,
  });

  // Fix: Backend returns { success: true, data: projects }, but frontend expects { projects: [...] }
  const projects: MaintenanceProject[] = projectsResponse?.data || [];

  // Filter projects based on current filters
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          project.title.toLowerCase().includes(searchLower) ||
          project.projectNumber.toLowerCase().includes(searchLower) ||
          (project.type && project.type.toLowerCase().includes(searchLower));
        
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

      // Type filter
      if (typeFilter && project.type !== typeFilter) {
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
  }, [projects, searchTerm, statusFilter, priorityFilter, typeFilter, showOverdueOnly]);

  // Generate timeline events from projects
  const timelineEvents = useMemo(() => {
    const events: ProjectEvent[] = [];
    const now = new Date();

    filteredProjects.forEach(project => {
      // Add start date event
      const startDate = parseDateOnly(project.plannedStartDate);
      if (startDate) {
        events.push({
          project,
          date: startDate,
          type: 'start',
          label: t('pvEventStart'),
          isOverdue: project.actualStartDate ? false : isBefore(startDate, now) && project.status === 'planned',
        });
      }

      // Add end date event
      const endDate = parseDateOnly(project.plannedEndDate);
      if (endDate) {
        events.push({
          project,
          date: endDate,
          type: 'end',
          label: t('pvEventEnd'),
          isOverdue: !project.actualEndDate && isBefore(endDate, now) && project.status !== 'completed',
        });
      }

      // Add milestone events (implementation would depend on project milestones)
      // For now, we'll add mid-point milestones for longer projects
      if (startDate && endDate) {
        const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (duration > 30) { // Add milestone for projects longer than 30 days
          const midDate = new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2);
          events.push({
            project,
            date: midDate,
            type: 'milestone',
            label: t('pvEventMilestone'),
            isOverdue: isBefore(midDate, now) && project.status === 'planned',
          });
        }
      }
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [filteredProjects, t]);

  // Get events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return timelineEvents.filter(event => isSameDay(event.date, selectedDate));
  }, [timelineEvents, selectedDate]);

  // Get events for current month view
  const monthEvents = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return timelineEvents.filter(event => 
      event.date >= start && event.date <= end
    );
  }, [timelineEvents, currentDate]);

  // Calculate timeline statistics
  const timelineStats = useMemo(() => {
    const now = new Date();
    const overdueEvents = timelineEvents.filter(event => event.isOverdue);
    const upcomingEvents = timelineEvents.filter(event => 
      !event.isOverdue && event.date > now && event.date <= addDays(now, 7)
    );
    const activeProjects = filteredProjects.filter(project => 
      project.status === 'work' || project.status === 'pre_work'
    );

    return {
      totalEvents: timelineEvents.length,
      overdueEvents: overdueEvents.length,
      upcomingEvents: upcomingEvents.length,
      activeProjects: activeProjects.length,
    };
  }, [timelineEvents, filteredProjects]);

  // Navigation handlers
  const handlePreviousMonth = useCallback(() => {
    setCurrentDate(prev => addDays(startOfMonth(prev), -1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentDate(prev => addDays(endOfMonth(prev), 1));
  }, []);

  const handleProjectClick = useCallback((project: MaintenanceProject) => {
    onProjectSelect?.(project);
  }, [onProjectSelect]);

  // Handle loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)} data-testid="timeline-view-loading">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-96" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <Alert variant="destructive" className={className} data-testid="timeline-view-error">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {t('pvFailedToLoadTimeline')}
        </AlertDescription>
      </Alert>
    );
  }

  // Handle no building selected state
  if (!building) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8', className)}>
        <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">{t('pvNoBuildingSelected')}</h3>
        <p className="text-muted-foreground text-center">
          {t('pvNoBuildingTimeline')}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)} data-testid="project-timeline-view">
      {/* Timeline Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{t('pvProjectTimelineHeader')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('pvTimelineSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={timelineView} onValueChange={(value: TimelineView) => setTimelineView(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">{t('pvViewMonth')}</SelectItem>
              <SelectItem value="quarter">{t('pvViewQuarter')}</SelectItem>
              <SelectItem value="year">{t('pvViewYear')}</SelectItem>
            </SelectContent>
          </Select>

          {onManageTimeline && (
            <Button variant="outline" size="sm" onClick={() => {
              // Open full timeline management (would pass first project or show global timeline)
              const firstProject = filteredProjects[0];
              if (firstProject) onManageTimeline(firstProject);
            }}>
              <ExternalLink className="h-4 w-4 mr-2" />
              {t('pvFullTimeline')}
            </Button>
          )}
        </div>
      </div>

      {/* Timeline Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('pvTotalEvents')}</p>
                <p className="text-xl font-bold">{timelineStats.totalEvents}</p>
              </div>
              <CalendarIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('pvOverdueLabel')}</p>
                <p className="text-xl font-bold text-red-600">{timelineStats.overdueEvents}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('pvDueThisWeek')}</p>
                <p className="text-xl font-bold text-yellow-600">{timelineStats.upcomingEvents}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('pvActiveProjects')}</p>
                <p className="text-xl font-bold text-blue-600">{timelineStats.activeProjects}</p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Timeline Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar View */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {format(currentDate, 'MMMM yyyy')}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={handlePreviousMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription>
                {t('pvClickDateToView')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                month={currentDate}
                onMonthChange={setCurrentDate}
                className="rounded-md"
                modifiers={{
                  hasEvents: (date) => timelineEvents.some(event => isSameDay(event.date, date)),
                  overdue: (date) => timelineEvents.some(event => 
                    isSameDay(event.date, date) && event.isOverdue
                  ),
                  today: (date) => isToday(date),
                }}
                modifiersStyles={{
                  hasEvents: { backgroundColor: 'hsl(var(--primary) / 0.1)' },
                  overdue: { backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' },
                }}
                data-testid="project-calendar"
              />
            </CardContent>
          </Card>

          {/* Monthly Events Summary */}
          {monthEvents.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t('pvEventsThisMonth').replace('{count}', String(monthEvents.length))}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {monthEvents.map((event, index) => (
                    <div 
                      key={index}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                        event.isOverdue ? "border-red-200 bg-red-50" : "border-border hover:bg-muted/50"
                      )}
                      onClick={() => handleProjectClick(event.project)}
                      data-testid={`timeline-event-${index}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          event.type === 'start' ? "bg-green-500" :
                          event.type === 'end' ? "bg-red-500" : "bg-blue-500"
                        )} />
                        <div>
                          <p className="font-medium text-sm">{event.project.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {event.label} - {format(event.date, 'MMM dd')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={event.project.status} size="sm" />
                        {event.isOverdue && (
                          <Badge variant="destructive" className="text-xs">
                            {t('pvOverdueLabel')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Selected Date Events */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {selectedDate ? format(selectedDate, 'EEEE, MMM dd') : t('pvSelectADate')}
              </CardTitle>
              <CardDescription>
                {t('pvEventsScheduledOnDate').replace('{count}', String(selectedDateEvents.length))}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedDateEvents.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('pvNoEventsScheduled')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateEvents.map((event, index) => (
                    <div 
                      key={index}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-colors",
                        event.isOverdue ? "border-red-200 bg-red-50" : "border-border hover:bg-muted/50"
                      )}
                      onClick={() => handleProjectClick(event.project)}
                      data-testid={`selected-date-event-${index}`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">{event.project.title}</h4>
                          <Badge 
                            variant={event.type === 'start' ? 'default' : 
                                   event.type === 'end' ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {event.label}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <StatusBadge status={event.project.status} size="sm" />
                          <PriorityBadge priority={event.project.priority} size="sm" />
                          {event.isOverdue && (
                            <Badge variant="destructive" className="text-xs">
                              {t('pvOverdueLabel')}
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          {t('pvProjectNumber').replace('{number}', String(event.project.projectNumber))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline Actions */}
          {hasPermission('canEditMaintenance') && filteredProjects.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('pvTimelineActions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => {
                    // Handle bulk status update for selected date
                    // Handle bulk status update for selected date
                  }}
                >
                  <Target className="h-4 w-4 mr-2" />
                  {t('pvBulkStatusUpdate')}
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => {
                    // Handle resource planning
                    // Handle resource planning
                  }}
                >
                  <Users className="h-4 w-4 mr-2" />
                  {t('pvResourcePlanning')}
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => {
                    // Handle timeline export
                    // Handle timeline export
                  }}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  {t('pvExportTimeline')}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Timeline Conflicts Alert */}
      {timelineStats.overdueEvents > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {(timelineStats.overdueEvents !== 1
              ? t('pvOverdueEventPlural')
              : t('pvOverdueEventSingular')
            ).replace('{count}', String(timelineStats.overdueEvents))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}