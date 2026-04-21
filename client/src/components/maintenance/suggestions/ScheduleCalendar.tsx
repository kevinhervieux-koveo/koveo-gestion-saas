import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfDay, endOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { useBuildingContext } from '@/hooks/use-building-context';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  Settings,
  Download,
  Upload,
  Eye,
  Edit,
  Trash2,
  Plus,
  Users,
  Building,
  Wrench,
  AlertCircle,
  FileDown,
  ExternalLink,
} from 'lucide-react';
import { ScheduleCalendarProps, CalendarEvent, SuggestionWithElement } from './types';

// Event type colors for visual coding
const eventTypeColors = {
  evaluation: 'bg-blue-500 text-white border-blue-600',
  project: 'bg-green-500 text-white border-green-600',
  maintenance: 'bg-orange-500 text-white border-orange-600',
  deadline: 'bg-red-500 text-white border-red-600',
  suggestion: 'bg-purple-500 text-white border-purple-600',
};

// Priority colors for suggestions
const priorityColors = {
  low: 'bg-gray-100 text-gray-800 border-gray-300',
  medium: 'bg-blue-100 text-blue-800 border-blue-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  critical: 'bg-red-100 text-red-800 border-red-300',
};

/**
 * ScheduleCalendar component for evaluation and maintenance scheduling
 * Provides calendar view with drag-and-drop scheduling and conflict detection
 */
export function ScheduleCalendar({
  buildingId,
  events: externalEvents,
  suggestions: externalSuggestions,
  projects: externalProjects,
  selectedDate,
  onDateSelect,
  onEventClick,
  onDragDrop,
  onScheduleSuggestion,
  showConflicts = true,
  className,
}: ScheduleCalendarProps) {
  const { hasPermission } = useBuildingContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);

  // Fetch calendar events if not provided externally
  const {
    data: eventsResponse,
    isLoading: isLoadingEvents,
  } = useQuery({
    queryKey: ['/api/maintenance/buildings', buildingId, 'calendar', format(currentDate, 'yyyy-MM')],
    queryFn: async () => {
      const start = startOfMonth(currentDate).toISOString();
      const end = endOfMonth(currentDate).toISOString();
      const response = await apiRequest('GET', `/api/maintenance/buildings/${buildingId}/calendar?start=${start}&end=${end}`);
      return await response.json();
    },
    enabled: !externalEvents && !!buildingId,
    staleTime: 60 * 1000, // 1 minute
  });

  // Fetch suggestions for scheduling
  const {
    data: suggestionsResponse,
    isLoading: isLoadingSuggestions,
  } = useQuery({
    queryKey: ['/api/maintenance/buildings', buildingId, 'suggestions', 'unscheduled'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/buildings/${buildingId}/suggestions?status=pending&unscheduled=true`);
      return await response.json();
    },
    enabled: !externalSuggestions && !!buildingId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const events = externalEvents || eventsResponse?.events || [];
  const suggestions = externalSuggestions || suggestionsResponse?.suggestions || [];
  const projects = externalProjects || [];

  // Schedule suggestion mutation
  const scheduleMutation = useMutation({
    mutationFn: async (data: { suggestionId: string; date: Date; duration?: number }) => {
      const response = await apiRequest('POST', `/api/maintenance/suggestions/${data.suggestionId}/schedule`, {
        scheduledDate: data.date.toISOString(),
        estimatedDuration: data.duration || 2,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'calendar'] });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/suggestions'] });
      toast({
        title: "Event Scheduled",
        description: "The suggestion has been scheduled successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Scheduling Failed",
        description: "Failed to schedule the suggestion. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Move event mutation
  const moveEventMutation = useMutation({
    mutationFn: async (data: { eventId: string; newDate: Date }) => {
      const response = await apiRequest('PATCH', `/api/maintenance/calendar/events/${data.eventId}`, {
        date: data.newDate.toISOString(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'calendar'] });
      toast({
        title: "Event Moved",
        description: "The event has been rescheduled successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Move Failed",
        description: "Failed to move the event. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Get events for a specific date
  const getEventsForDate = useCallback((date: Date) => {
    return events.filter((event: CalendarEvent) => 
      isSameDay(new Date(event.date), date)
    );
  }, [events]);

  // Detect scheduling conflicts
  const detectConflicts = useCallback((targetDate: Date, newEvent?: CalendarEvent) => {
    if (!showConflicts) return [];
    
    const dateEvents = getEventsForDate(targetDate);
    if (newEvent) {
      dateEvents.push(newEvent);
    }
    
    // Simple conflict detection - more than 3 events on same day
    return dateEvents.length > 3 ? dateEvents : [];
  }, [getEventsForDate, showConflicts]);

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Handle date navigation
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' 
      ? subMonths(currentDate, 1)
      : addMonths(currentDate, 1);
    setCurrentDate(newDate);
  };

  // Handle event click
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventDialog(true);
    onEventClick?.(event);
  };

  // Handle suggestion drop on calendar
  const handleSuggestionDrop = (suggestion: SuggestionWithElement, date: Date) => {
    scheduleMutation.mutate({
      suggestionId: suggestion.id,
      date,
      duration: 2,
    });
    onScheduleSuggestion?.(suggestion, date);
  };

  // Handle event drag start
  const handleDragStart = (event: CalendarEvent) => {
    setDraggedEvent(event);
  };

  // Handle event drop
  const handleDrop = (date: Date) => {
    if (draggedEvent) {
      moveEventMutation.mutate({
        eventId: draggedEvent.id,
        newDate: date,
      });
      onDragDrop?.(draggedEvent.id, date);
      setDraggedEvent(null);
    }
  };

  // Export calendar to iCal
  const exportCalendar = () => {
    // Generate iCal content
    const icalEvents = events.map((event: CalendarEvent) => {
      return [
        'BEGIN:VEVENT',
        `UID:${event.id}`,
        `DTSTART:${format(new Date(event.date), 'yyyyMMdd\'T\'HHmmss\'Z\'')}`,
        `SUMMARY:${event.title}`,
        `DESCRIPTION:${event.description || ''}`,
        'END:VEVENT'
      ].join('\n');
    }).join('\n');

    const icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Maintenance Journal//Calendar//EN',
      icalEvents,
      'END:VCALENDAR'
    ].join('\n');

    // Download file
    const blob = new Blob([icalContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maintenance-calendar-${format(currentDate, 'yyyy-MM')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <TooltipProvider>
      <div className={cn("w-full space-y-4", className)} data-testid="schedule-calendar">
        {/* Calendar Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Maintenance Schedule
              </CardTitle>

              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex border rounded-md">
                  {['month', 'week', 'day'].map((mode) => (
                    <Button
                      key={mode}
                      variant={viewMode === mode ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode(mode as any)}
                      className="capitalize"
                      data-testid={`view-${mode}`}
                    >
                      {mode}
                    </Button>
                  ))}
                </div>

                {/* Export */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportCalendar}
                  data-testid="export-calendar"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('prev')}
                data-testid="prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <h3 className="text-xl font-semibold">
                {format(currentDate, 'MMMM yyyy')}
              </h3>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('next')}
                data-testid="next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(eventTypeColors).map(([type, color]) => (
                <Badge key={type} className={cn("capitalize", color)}>
                  {type}
                </Badge>
              ))}
            </div>
          </CardHeader>

          <CardContent>
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Day Headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-b">
                  {day}
                </div>
              ))}

              {/* Calendar Days */}
              {calendarDays.map((day) => {
                const dayEvents = getEventsForDate(day);
                const conflicts = detectConflicts(day);
                const hasConflicts = conflicts.length > 0;
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-[100px] p-1 border border-gray-200 cursor-pointer hover:bg-gray-50",
                      isSelected && "bg-blue-50 border-blue-300",
                      isToday && "bg-green-50 border-green-300",
                      hasConflicts && "bg-red-50 border-red-300"
                    )}
                    onClick={() => {
                      onDateSelect?.(day);
                      setCurrentDate(day);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(day)}
                    data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                  >
                    {/* Day Number */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        "text-sm font-medium",
                        isToday && "text-green-700",
                        isSelected && "text-blue-700"
                      )}>
                        {format(day, 'd')}
                      </span>
                      {hasConflicts && (
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertTriangle className="h-3 w-3 text-red-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Scheduling conflicts detected
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* Events */}
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event: CalendarEvent) => (
                        <Tooltip key={event.id}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "text-xs p-1 rounded border truncate cursor-pointer",
                                eventTypeColors[event.type] || eventTypeColors.evaluation
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEventClick(event);
                              }}
                              draggable={hasPermission('canEditMaintenance')}
                              onDragStart={() => handleDragStart(event)}
                              data-testid={`event-${event.id}`}
                            >
                              {event.title}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div>
                              <div className="font-medium">{event.title}</div>
                              <div className="text-xs">{event.description}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(event.date), 'HH:mm')}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ))}

                      {dayEvents.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Unscheduled Suggestions */}
        {suggestions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Unscheduled Suggestions
                <Badge variant="secondary">{suggestions.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {suggestions.map((suggestion: SuggestionWithElement) => (
                  <div
                    key={suggestion.id}
                    className={cn(
                      "p-2 border rounded cursor-move text-xs",
                      priorityColors[suggestion.priority as keyof typeof priorityColors] || priorityColors.medium
                    )}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify(suggestion));
                    }}
                    data-testid={`unscheduled-suggestion-${suggestion.id}`}
                  >
                    <div className="font-medium truncate">{suggestion.element?.name}</div>
                    <div className="text-muted-foreground capitalize">{suggestion.suggestedType}</div>
                    {suggestion.costEstimate && (
                      <div className="text-green-600">${suggestion.costEstimate.toLocaleString()}</div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Event Details Dialog */}
        <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
          <DialogContent data-testid="event-details-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedEvent?.type === 'evaluation' && <Eye className="h-5 w-5" />}
                {selectedEvent?.type === 'project' && <Building className="h-5 w-5" />}
                {selectedEvent?.type === 'maintenance' && <Wrench className="h-5 w-5" />}
                {selectedEvent?.type === 'deadline' && <AlertCircle className="h-5 w-5" />}
                {selectedEvent?.title}
              </DialogTitle>
              <DialogDescription>
                {selectedEvent?.description}
              </DialogDescription>
            </DialogHeader>

            {selectedEvent && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Date:</span>
                    <div>{format(new Date(selectedEvent.date), 'PPP')}</div>
                  </div>
                  <div>
                    <span className="font-medium">Type:</span>
                    <Badge className={cn("ml-2", eventTypeColors[selectedEvent.type])}>
                      {selectedEvent.type}
                    </Badge>
                  </div>
                  {selectedEvent.priority && (
                    <div>
                      <span className="font-medium">Priority:</span>
                      <Badge className={cn("ml-2", priorityColors[selectedEvent.priority])}>
                        {selectedEvent.priority}
                      </Badge>
                    </div>
                  )}
                  {selectedEvent.duration && (
                    <div>
                      <span className="font-medium">Duration:</span>
                      <div>{selectedEvent.duration} hours</div>
                    </div>
                  )}
                </div>

                {selectedEvent.conflictsWith && selectedEvent.conflictsWith.length > 0 && (
                  <div className="border border-red-200 bg-red-50 rounded p-3">
                    <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      Scheduling Conflicts
                    </div>
                    <div className="text-sm text-red-700">
                      This event conflicts with {selectedEvent.conflictsWith.length} other event(s).
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {hasPermission('canEditMaintenance') && (
                    <>
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button size="sm" variant="outline">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="outline">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View Details
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}