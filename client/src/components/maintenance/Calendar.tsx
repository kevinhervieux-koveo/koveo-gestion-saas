import { useState, useCallback, useMemo } from 'react';
import { Calendar as CalendarPrimitive } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  Grid3X3,
  List,
  Filter
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { StatusBadge, PriorityBadge, type ProjectStatus, type Priority } from './StatusBadges';

// Event types for calendar
interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'evaluation' | 'project' | 'maintenance' | 'deadline';
  status?: ProjectStatus;
  priority?: Priority;
  description?: string;
  elementId?: string;
  projectId?: string;
}

interface ScheduleCalendarProps {
  events: CalendarEvent[];
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  className?: string;
  title?: string;
  showFilters?: boolean;
  allowViewSwitch?: boolean;
}

type CalendarView = 'month' | 'week' | 'list';

/**
 * ScheduleCalendar component for viewing evaluation suggestions and maintenance events by date
 * Supports different view modes and event filtering
 */
export function ScheduleCalendar({
  events = [],
  selectedDate,
  onDateSelect,
  onEventClick,
  className,
  title = "Maintenance Schedule",
  showFilters = true,
  allowViewSwitch = true,
}: ScheduleCalendarProps) {
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filter events based on selected filters
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (typeFilter !== 'all' && event.type !== typeFilter) return false;
      if (statusFilter !== 'all' && event.status !== statusFilter) return false;
      return true;
    });
  }, [events, typeFilter, statusFilter]);

  // Get events for a specific date
  const getEventsForDate = useCallback((date: Date) => {
    return filteredEvents.filter(event => isSameDay(event.date, date));
  }, [filteredEvents]);

  // Get events for current month
  const monthEvents = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return filteredEvents.filter(event => 
      event.date >= start && event.date <= end
    );
  }, [filteredEvents, currentDate]);

  // Navigation handlers
  const goToPreviousMonth = useCallback(() => {
    setCurrentDate(prev => subMonths(prev, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentDate(prev => addMonths(prev, 1));
  }, []);

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    onDateSelect?.(today);
  }, [onDateSelect]);

  // Handle date selection
  const handleDateSelect = useCallback((date: Date | undefined) => {
    if (date) {
      setCurrentDate(date);
      onDateSelect?.(date);
    }
  }, [onDateSelect]);

  // Event type colors
  const getEventTypeColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'evaluation':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'project':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'maintenance':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'deadline':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Calendar day content
  const renderDayContent = useCallback((date: Date) => {
    const dayEvents = getEventsForDate(date);
    
    return (
      <div className="relative w-full h-full">
        <span className={cn(
          "text-sm",
          isSameDay(date, currentDate) && "font-bold"
        )}>
          {format(date, 'd')}
        </span>
        
        {dayEvents.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 flex justify-center">
            <div className="flex space-x-1">
              {dayEvents.slice(0, 3).map((event, index) => (
                <div
                  key={event.id}
                  className={cn(
                    "w-2 h-2 rounded-full cursor-pointer",
                    getEventTypeColor(event.type)
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick?.(event);
                  }}
                  title={event.title}
                />
              ))}
              {dayEvents.length > 3 && (
                <div className="w-2 h-2 rounded-full bg-gray-400 text-[8px] flex items-center justify-center text-white">
                  +
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }, [currentDate, getEventsForDate, onEventClick]);

  // List view component
  const ListView = () => (
    <div className="space-y-2" data-testid="calendar-list-view">
      {monthEvents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No events scheduled for {format(currentDate, 'MMMM yyyy')}
        </div>
      ) : (
        monthEvents
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .map((event) => (
            <Card
              key={event.id}
              className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onEventClick?.(event)}
              data-testid={`event-item-${event.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium">{event.title}</h4>
                    <Badge 
                      variant="outline" 
                      className={getEventTypeColor(event.type)}
                    >
                      {event.type}
                    </Badge>
                    {event.status && <StatusBadge status={event.status} size="sm" />}
                    {event.priority && <PriorityBadge priority={event.priority} size="sm" />}
                  </div>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {format(event.date, 'MMM d, yyyy')}
                </div>
              </div>
            </Card>
          ))
      )}
    </div>
  );

  return (
    <Card className={className} data-testid="schedule-calendar">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <CalendarIcon className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>

          <div className="flex items-center space-x-2">
            {allowViewSwitch && (
              <Select value={view} onValueChange={(value: CalendarView) => setView(value)}>
                <SelectTrigger className="w-32" data-testid="view-selector">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">
                    <div className="flex items-center space-x-2">
                      <Grid3X3 className="h-4 w-4" />
                      <span>Month</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="list">
                    <div className="flex items-center space-x-2">
                      <List className="h-4 w-4" />
                      <span>List</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              data-testid="today-button"
            >
              Today
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32" data-testid="type-filter">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="evaluation">Evaluation</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="deadline">Deadline</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32" data-testid="status-filter">
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
            
            {(typeFilter !== 'all' || statusFilter !== 'all') && (
              <Badge variant="secondary" data-testid="active-filters">
                {filteredEvents.length} filtered
              </Badge>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousMonth}
              data-testid="previous-month-button"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold min-w-40 text-center">
              {format(currentDate, 'MMMM yyyy')}
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextMonth}
              data-testid="next-month-button"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {monthEvents.length} event(s) this month
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {view === 'month' ? (
          <CalendarPrimitive
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            month={currentDate}
            onMonthChange={setCurrentDate}
            className="w-full"
            components={{
              Day: ({ day, ...props }) => (
                <div {...props}>
                  {renderDayContent(day.date)}
                </div>
              ),
            }}
            data-testid="calendar-month-view"
          />
        ) : (
          <ListView />
        )}
      </CardContent>
    </Card>
  );
}

// Simple timeline component for project scheduling
interface TimelineEvent {
  id: string;
  title: string;
  date: Date;
  status: ProjectStatus;
  description?: string;
}

interface SimpleTimelineProps {
  events: TimelineEvent[];
  className?: string;
  title?: string;
}

export function SimpleTimeline({
  events,
  className,
  title = "Project Timeline"
}: SimpleTimelineProps) {
  const sortedEvents = useMemo(() => 
    [...events].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [events]
  );

  return (
    <Card className={className} data-testid="simple-timeline">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {sortedEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No timeline events available
          </div>
        ) : (
          <div className="space-y-4">
            {sortedEvents.map((event, index) => (
              <div
                key={event.id}
                className="flex items-start space-x-4"
                data-testid={`timeline-event-${event.id}`}
              >
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-primary flex-shrink-0" />
                  {index < sortedEvents.length - 1 && (
                    <div className="w-px h-8 bg-border mt-2" />
                  )}
                </div>
                
                <div className="flex-1 pb-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{event.title}</h4>
                    <div className="flex items-center space-x-2">
                      <StatusBadge status={event.status} size="sm" />
                      <span className="text-sm text-muted-foreground">
                        {format(event.date, 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Export types
export type { CalendarEvent, TimelineEvent, ScheduleCalendarProps, SimpleTimelineProps };