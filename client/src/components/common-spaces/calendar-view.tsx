import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  User,
  Users,
  Eye,
  EyeOff 
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';

interface CalendarEvent {
  id: string;
  startTime: string;
  endTime: string;
  status: 'confirmed' | 'cancelled';
  userId?: string | null;
  userName: string;
  userEmail?: string | null;
  isOwnBooking?: boolean;
  spaceName?: string;
  spaceId?: string;
  buildingName?: string;
  userRole?: string;
}

interface CalendarViewProps {
  spaceId?: string;
  buildingId?: string;
  mode: 'space' | 'user' | 'building';
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  showControls?: boolean;
  className?: string;
}

interface CalendarData {
  space?: {
    id: string;
    name: string;
    isReservable: boolean;
    openingHours?: any;
  };
  user?: {
    id: string;
    name: string;
    role: string;
  };
  building?: {
    id: string;
    name: string;
    address: string;
  };
  calendar: {
    view: string;
    startDate: string;
    endDate: string;
    events?: CalendarEvent[];
    bookings?: CalendarEvent[];
  };
  permissions?: {
    canViewDetails: boolean;
    canCreateBookings: boolean;
  };
  summary?: {
    totalBookings: number;
    totalHours?: number;
    totalSpaces?: number;
    activeSpaces?: number;
    uniqueUsers?: number;
  };
}

export function CalendarView({ 
  spaceId, 
  buildingId, 
  mode, 
  onEventClick,
  onDateClick,
  showControls = true,
  className = '' 
}: CalendarViewProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const queryClient = useQueryClient();

  const startDate = startOfMonth(currentDate).toISOString();
  const endDate = endOfMonth(currentDate).toISOString();

  // Build API URL based on mode
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      view: viewMode,
    });

    if (mode === 'space' && spaceId) {
      return `/api/common-spaces/calendar/${spaceId}?${params}`;
    } else if (mode === 'building' && buildingId) {
      return `/api/common-spaces/calendar/building/${buildingId}?${params}`;
    } else if (mode === 'user') {
      return `/api/common-spaces/user-calendar?${params}`;
    }
    return null;
  }, [mode, spaceId, buildingId, startDate, endDate, viewMode]);

  const { data, isLoading, error } = useQuery<CalendarData>({
    queryKey: ['calendar', mode, spaceId, buildingId, startDate, endDate, viewMode],
    queryFn: async () => {
      if (!apiUrl) return null;
      
      try {
        const response = await apiRequest('GET', apiUrl);
        return await response.json();
      } catch (error: any) {
        // Handle authentication errors specifically - suppress for timing issues
        if (error.message?.includes('401')) {
          throw new Error('Authentication required for calendar access');
        }
        throw error;
      }
    },
    enabled: !!apiUrl && !!user && !!user.id,
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors
      if (error?.message?.includes('Authentication required')) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const getEventsForDay = (day: Date) => {
    if (!data?.calendar) return [];
    
    const events = data.calendar.events || data.calendar.bookings || [];
    return events.filter(event => 
      isSameDay(parseISO(event.startTime), day) && event.status === 'confirmed'
    );
  };

  const formatEventTime = (startTime: string, endTime: string) => {
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    const locale = language === 'fr' ? fr : undefined;
    return `${format(start, 'HH:mm', { locale })} - ${format(end, 'HH:mm', { locale })}`;
  };

  const getEventDisplayName = (event: CalendarEvent) => {
    if (mode === 'user') {
      return event.spaceName || event.userName;
    }
    
    if (data?.permissions?.canViewDetails || event.isOwnBooking) {
      return event.userName;
    }
    
    return event.userName === 'Déjà Réservé' ? 'Déjà Réservé' : 'Réservé';
  };

  const goToPrevMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  if (error) {
    const isAuthError = error.message?.includes('Authentication required') || error.message?.includes('401');
    
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center space-y-3" data-testid="calendar-error">
            <div className="text-red-600">
              {isAuthError 
                ? (language === 'fr' ? 'Authentification requise pour le calendrier' : 'Authentication required for calendar')
                : (language === 'fr' ? 'Erreur lors du chargement du calendrier' : 'Error loading calendar')
              }
            </div>
            {isAuthError && (
              <div className="text-sm text-gray-600">
                {language === 'fr' 
                  ? 'Veuillez vous reconnecter pour accéder au calendrier' 
                  : 'Please sign in again to access the calendar'
                }
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['calendar'] })}
              data-testid="retry-calendar"
            >
              {language === 'fr' ? 'Réessayer' : 'Retry'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className={className} data-testid="calendar-view">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {mode === 'space' && data?.space?.name && (
                <span>{data.space.name}</span>
              )}
              {mode === 'user' && (
                <span>{language === 'fr' ? 'Mon Calendrier' : 'My Calendar'}</span>
              )}
              {mode === 'building' && data?.building?.name && (
                <span>{data.building.name} - {language === 'fr' ? 'Calendrier' : 'Calendar'}</span>
              )}
            </CardTitle>
            
            {showControls && (
              <div className="flex items-center gap-2">
                <Select value={viewMode} onValueChange={(value: 'month' | 'week') => setViewMode(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">{language === 'fr' ? 'Mois' : 'Month'}</SelectItem>
                    <SelectItem value="week">{language === 'fr' ? 'Semaine' : 'Week'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={goToPrevMonth}
                data-testid="prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <h3 className="text-lg font-semibold" data-testid="current-month">
                {format(currentDate, 'MMMM yyyy', { locale: language === 'fr' ? fr : undefined })}
              </h3>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={goToNextMonth}
                data-testid="next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {data?.summary && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{data.summary.totalBookings} {language === 'fr' ? 'réservations' : 'bookings'}</span>
                </div>
                {data.summary.totalHours && (
                  <div className="flex items-center gap-1">
                    <span>{Math.round(data.summary.totalHours * 10) / 10}h</span>
                  </div>
                )}
                {data.summary.uniqueUsers && (
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{data.summary.uniqueUsers} {language === 'fr' ? 'utilisateurs' : 'users'}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12" data-testid="calendar-loading">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Week day headers */}
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => (
                  <div key={index} className="p-2 text-center text-sm font-medium text-muted-foreground border-b">
                    {day}
                  </div>
                ))}
                
                {/* Calendar days */}
                {monthDays.map((day, index) => {
                  const dayEvents = getEventsForDay(day);
                  const isCurrentDay = isToday(day);
                  
                  return (
                    <div
                      key={index}
                      className={`
                        min-h-[80px] p-1 border border-border/50 
                        ${isCurrentDay ? 'bg-primary/10 border-primary/30' : 'bg-card hover:bg-muted/50'}
                        transition-colors cursor-pointer
                      `}
                      onClick={() => onDateClick?.(day)}
                      data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                    >
                      <div className={`text-xs font-medium mb-1 ${isCurrentDay ? 'text-primary' : 'text-foreground'}`}>
                        {format(day, 'd')}
                      </div>
                      
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((event, eventIndex) => (
                          <Tooltip key={eventIndex}>
                            <TooltipTrigger asChild>
                              <div
                                className={`
                                  text-xs p-1 rounded truncate cursor-pointer
                                  ${event.isOwnBooking 
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                                    : data?.permissions?.canViewDetails 
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
                                      : 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'
                                  }
                                `}
                                onClick={() => onEventClick?.(event)}
                                data-testid={`calendar-event-${event.id}`}
                              >
                                <div className="flex items-center gap-1">
                                  {event.isOwnBooking && <User className="h-3 w-3" />}
                                  {data?.permissions?.canViewDetails && !event.isOwnBooking && <Eye className="h-3 w-3" />}
                                  {!data?.permissions?.canViewDetails && !event.isOwnBooking && <EyeOff className="h-3 w-3" />}
                                  <span className="truncate">{getEventDisplayName(event)}</span>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1">
                                <p className="font-medium">{getEventDisplayName(event)}</p>
                                <p className="text-xs">{formatEventTime(event.startTime, event.endTime)}</p>
                                {mode === 'user' && event.spaceName && (
                                  <p className="text-xs opacity-80">{event.spaceName}</p>
                                )}
                                {mode === 'user' && event.buildingName && (
                                  <p className="text-xs opacity-80">{event.buildingName}</p>
                                )}
                                {data?.permissions?.canViewDetails && event.userEmail && (
                                  <p className="text-xs opacity-80">{event.userEmail}</p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                        
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{dayEvents.length - 2} {language === 'fr' ? 'autres' : 'more'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-green-200 border border-green-300"></div>
                  <span className="text-xs text-muted-foreground">
                    {language === 'fr' ? 'Mes réservations' : 'My bookings'}
                  </span>
                </div>
                {data?.permissions?.canViewDetails ? (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-blue-200 border border-blue-300"></div>
                    <span className="text-xs text-muted-foreground">
                      {language === 'fr' ? 'Autres réservations' : 'Other bookings'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-gray-200 border border-gray-300"></div>
                    <span className="text-xs text-muted-foreground">
                      {language === 'fr' ? 'Déjà réservé' : 'Already reserved'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}