import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  format,
  addDays,
  isSameDay,
  parseISO,
  isWithinInterval,
  parse,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';
import { useLocation } from 'wouter';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Building2,
  Clock,
  Users,
  MapPin,
  Download,
  Link,
  Calendar as CalendarIcon,
  Plus,
  X,
  FileText,
  User,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { apiRequest } from '@/lib/queryClient';
import { CalendarView } from '@/components/common-spaces/calendar-view';
import { CommonSpaceCalendar } from '@/components/common-spaces/common-space-calendar';

/**
 * Common Space interface.
 */
interface CommonSpace {
  id: string;
  name: string;
  description?: string;
  buildingId: string;
  isReservable: boolean;
  capacity?: number;
  contactPersonId?: string;
  openingHours?: Array<{
    day: string;
    open: string;
    close: string;
    isOpen?: boolean;
    breaks?: Array<{
      start: string;
      end: string;
      reason?: string;
    }>;
  }>;
  unavailablePeriods?: Array<{
    startDate: string;
    endDate: string;
    reason?: string;
    recurrence?: 'none' | 'weekly' | 'monthly' | 'yearly';
  }>;
  bookingRules?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Booking interface.
 */
interface Booking {
  id: string;
  commonSpaceId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  user?: {
    firstName: string;
    lastName: string;
  };
}

/**
 * Booking form schema.
 */
const bookingFormSchema = z
  .object({
    date: z.date({
      message: 'Please select a booking date from the calendar',
    }),
    startTime: z.string().min(1, 'Start time is required (example: 09:00)').regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:MM format (example: 09:00)'),
    endTime: z.string().min(1, 'End time is required (example: 11:00)').regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:MM format (example: 11:00)'),
  })
  .refine(
    (data) => {
      const start = parse(data.startTime, 'HH:mm', new Date());
      const end = parse(data.endTime, 'HH:mm', new Date());
      return end > start;
    },
    {
      message: 'End time must be after start time (example: start at 09:00, end at 11:00)',
      path: ['endTime'],
    }
  );

/**
 *
 */
type BookingFormData = z.infer<typeof bookingFormSchema>;

/**
 * Compact Booking Calendar Component.
 */
interface BookingCalendarProps {
  selected: Date;
  onSelect: (date: Date) => void;
  space: CommonSpace;
  bookings: Booking[];
  language: string;
  'data-testid'?: string;
}

/**
 *
 * @param root0
 * @param root0.selected
 * @param root0.onSelect
 * @param root0.space
 * @param root0.bookings
 * @param root0.language
 * @param root0.'data-testid'
 */
function BookingCalendar({
  selected,
  onSelect,
  space,
  bookings,
  language,
  'data-testid': testId,
}: BookingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(selected || new Date());

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const getBookingsForDay = (day: Date) => {
    return bookings.filter(
      (booking) => isSameDay(parseISO(booking.startTime), day) && booking.status === 'confirmed'
    );
  };

  const isDayAvailable = (day: Date) => {
    // Past dates are not available
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDay = new Date(day);
    checkDay.setHours(0, 0, 0, 0);
    
    if (checkDay < today) {
      return false;
    }

    // Check if day falls within any unavailable periods
    if (space.unavailablePeriods && Array.isArray(space.unavailablePeriods)) {
      for (const period of space.unavailablePeriods) {
        const startDate = new Date(period.startDate);
        const endDate = new Date(period.endDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        
        if (checkDay >= startDate && checkDay <= endDate) {
          return false;
        }
      }
    }

    // Check opening hours if available
    if (space.openingHours && Array.isArray(space.openingHours)) {
      const dayName = day.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const todayHours = space.openingHours.find((h) => h.day.toLowerCase() === dayName);
      
      // If no hours defined for this day, it's unavailable
      if (!todayHours) {
        return false;
      }
      
      // If explicitly marked as closed
      if (todayHours.isOpen === false) {
        return false;
      }
    }

    return true;
  };

  const goToPrevMonth = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  const goToNextMonth = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  return (
    <TooltipProvider>
      <div className='border rounded-md bg-white' data-testid={testId}>
        {/* Calendar Header */}
        <div className='flex items-center justify-between p-3 border-b'>
          <Button variant='outline' size='sm' onClick={goToPrevMonth} className='h-8 w-8 p-0'>
            <ChevronLeft className='h-4 w-4' />
          </Button>

          <h3 className='text-sm font-semibold'>
            {format(currentDate, 'MMMM yyyy', { locale: language === 'fr' ? fr : undefined })}
          </h3>

          <Button variant='outline' size='sm' onClick={goToNextMonth} className='h-8 w-8 p-0'>
            <ChevronRight className='h-4 w-4' />
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className='p-2'>
          <div className='grid grid-cols-7 gap-1 mb-2'>
            {/* Week day headers */}
            {[
              language === 'fr' ? 'L' : 'M',
              language === 'fr' ? 'M' : 'T',
              language === 'fr' ? 'M' : 'W',
              language === 'fr' ? 'J' : 'T',
              language === 'fr' ? 'V' : 'F',
              language === 'fr' ? 'S' : 'S',
              language === 'fr' ? 'D' : 'S',
            ].map((day, index) => (
              <div key={index} className='p-1 text-center text-xs font-medium text-gray-500'>
                {day}
              </div>
            ))}
          </div>

          <div className='grid grid-cols-7 gap-1'>
            {monthDays.map((day, index) => {
              const dayBookings = getBookingsForDay(day);
              const isCurrentDay = isToday(day);
              const isSelected = selected && isSameDay(day, selected);
              const isAvailable = isDayAvailable(day);

              return (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <div
                      className={`
                        h-8 p-1 text-xs rounded cursor-pointer transition-colors flex items-center justify-center
                        ${
                          !isAvailable
                            ? 'bg-red-100 text-red-600 cursor-not-allowed border border-red-200'
                            : isSelected
                              ? 'bg-blue-600 text-white'
                              : isCurrentDay
                                ? 'bg-blue-100 text-blue-900 hover:bg-blue-200'
                                : dayBookings.length > 0
                                  ? 'bg-orange-100 text-orange-900 hover:bg-orange-200'
                                  : 'hover:bg-gray-100'
                        }
                      `}
                      onClick={() => isAvailable && onSelect(day)}
                    >
                      <span className='font-medium'>{format(day, 'd')}</span>
                      {dayBookings.length > 0 && (
                        <div className='absolute -mt-3 -mr-1'>
                          <div className='w-1.5 h-1.5 bg-orange-500 rounded-full'></div>
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className='space-y-1'>
                      <p className='font-medium'>
                        {format(day, 'EEEE, d MMMM yyyy', {
                          locale: language === 'fr' ? fr : undefined,
                        })}
                      </p>
                      {!isAvailable && (
                        <p className='text-xs text-red-500'>
                          {language === 'fr' ? 'Non disponible' : 'Not available'}
                        </p>
                      )}
                      {dayBookings.length > 0 && (
                        <div className='text-xs'>
                          <p className='text-orange-600'>
                            {dayBookings.length}{' '}
                            {language === 'fr' ? 'réservation(s)' : 'booking(s)'}
                          </p>
                          {dayBookings.slice(0, 2).map((booking, idx) => (
                            <p key={idx} className='text-gray-600'>
                              {format(parseISO(booking.startTime), 'HH:mm')} -{' '}
                              {format(parseISO(booking.endTime), 'HH:mm')}
                            </p>
                          ))}
                          {dayBookings.length > 2 && (
                            <p className='text-gray-500'>
                              +{dayBookings.length - 2} {language === 'fr' ? 'autres' : 'more'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Legend */}
          <div className='flex items-center justify-center gap-4 mt-3 pt-2 border-t text-xs'>
            <div className='flex items-center gap-1'>
              <div className='w-2 h-2 bg-blue-600 rounded'></div>
              <span className='text-gray-600'>
                {language === 'fr' ? 'Sélectionné' : 'Selected'}
              </span>
            </div>
            <div className='flex items-center gap-1'>
              <div className='w-2 h-2 bg-orange-500 rounded'></div>
              <span className='text-gray-600'>{language === 'fr' ? 'Réservé' : 'Booked'}</span>
            </div>
            <div className='flex items-center gap-1'>
              <div className='w-2 h-2 bg-red-500 rounded'></div>
              <span className='text-gray-600'>{language === 'fr' ? 'Non disponible' : 'Unavailable'}</span>
            </div>
            <div className='flex items-center gap-1'>
              <div className='w-2 h-2 bg-blue-200 rounded'></div>
              <span className='text-gray-600'>{language === 'fr' ? "Aujourd'hui" : 'Today'}</span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

/**
 * Utility function to generate .ics calendar content.
 * @param bookings
 * @param allSpaces
 */
function generateICS(bookings: Booking[], allSpaces?: boolean): string {
  const now = new Date();
  const icsHeader = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Koveo Gestion//Common Spaces//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ].join('\r\n');

  const icsEvents = bookings.map((booking) => {
    const startDate = new Date(booking.startTime);
    const endDate = new Date(booking.endTime);

    // Format dates for ICS (YYYYMMDDTHHMMSSZ)
    const formatICSDate = (date: Date) => {
      return date
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
    };

    const title = allSpaces ? `Réservation d'espace commun` : `Espace commun réservé`;

    return [
      'BEGIN:VEVENT',
      `UID:${booking.id}@koveogestion.com`,
      `DTSTAMP:${formatICSDate(now)}`,
      `DTSTART:${formatICSDate(startDate)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:Réservation confirmée pour un espace commun`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
    ].join('\r\n');
  });

  const icsFooter = 'END:VCALENDAR';

  return [icsHeader, ...icsEvents, icsFooter].join('\r\n');
}

interface CommonSpacesProps {
  buildingId?: string;
}

/**
 * Common Spaces page component for residents.
 */
function CommonSpacesPageInner({ buildingId }: CommonSpacesProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  console.log('🔍 [COMMON_SPACES_PAGE] Rendered with buildingId:', buildingId, 'user:', user?.username);

  const [selectedSpace, setSelectedSpace] = useState<CommonSpace | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [expandedSpaceId, setExpandedSpaceId] = useState<string | null>(null);
  const [preSelectedDate, setPreSelectedDate] = useState<Date | null>(null);

  // Form for booking creation
  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      date: new Date(),
      startTime: '09:00',
      endTime: '10:00',
    },
  });

  const handleBackToBuilding = () => {
    navigate('/residents/common-spaces');
  };

  // Fetch common spaces in user's buildings (filtered by building if provided)
  const { data: commonSpaces = [], isLoading: spacesLoading } = useQuery<CommonSpace[]>({
    queryKey: ['/api/common-spaces', buildingId],
    queryFn: async () => {
      const url = buildingId ? `/api/common-spaces?building_id=${buildingId}` : '/api/common-spaces';
      console.log('🔍 [COMMON_SPACES] Fetching from:', url, 'with buildingId:', buildingId);
      const response = await fetch(url);
      if (!response.ok) {
        console.error('❌ [COMMON_SPACES] Failed to fetch:', response.status, response.statusText);
        throw new Error('Failed to fetch common spaces');
      }
      const data = await response.json();
      console.log('✅ [COMMON_SPACES] Fetched:', data.length, 'common spaces');
      return data;
    },
    enabled: !!user && !!buildingId,
  });

  // Fetch bookings for selected space
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ['/api/common-spaces', selectedSpace?.id, 'bookings'],
    enabled: !!selectedSpace,
  });

  // Fetch all user's bookings for export
  const { data: userBookings = [] } = useQuery<Booking[]>({
    queryKey: ['/api/common-spaces/my-bookings'],
    enabled: !!user,
  });

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      if (!selectedSpace) {
        throw new Error('No space selected');
      }

      // More robust date handling to avoid timezone issues
      const baseDate = data.date instanceof Date ? data.date : new Date(data.date);

      // Create start time by setting the time on a date object in local timezone
      const startDateTime = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth(),
        baseDate.getDate()
      );
      const [startHour, startMinute] = data.startTime.split(':').map(Number);
      startDateTime.setHours(startHour, startMinute, 0, 0);

      // Create end time similarly
      const endDateTime = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
      const [endHour, endMinute] = data.endTime.split(':').map(Number);
      endDateTime.setHours(endHour, endMinute, 0, 0);

      // Booking creation handling

      return apiRequest('POST', `/api/common-spaces/${selectedSpace.id}/bookings`, {
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/common-spaces'] });
      toast({
        title: 'Réservation confirmée',
        description: 'Votre réservation a été créée avec succès.',
      });
      setIsBookingDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur de réservation',
        description:
          error.message || 'Une erreur est survenue lors de la création de la réservation.',
        variant: 'destructive',
      });
    },
  });

  // Get bookings for selected date
  const bookingsForDate = useMemo(() => {
    if (!bookings || !selectedDate) {
      return [];
    }

    return bookings.filter((booking: Booking) => {
      const bookingDate = parseISO(booking.startTime);
      return isSameDay(bookingDate, selectedDate);
    });
  }, [bookings, selectedDate]);

  // Get time slots availability
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 6; hour <= 22; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  // Helper function to check if a day is available (moved from BookingCalendar)
  const isDayAvailable = (day: Date) => {
    if (!selectedSpace) {
      return false;
    }

    // Past dates are not available
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDay = new Date(day);
    checkDay.setHours(0, 0, 0, 0);
    
    if (checkDay < today) {
      return false;
    }

    // Check if day falls within any unavailable periods
    if (selectedSpace.unavailablePeriods && Array.isArray(selectedSpace.unavailablePeriods)) {
      for (const period of selectedSpace.unavailablePeriods) {
        const startDate = new Date(period.startDate);
        const endDate = new Date(period.endDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        
        if (checkDay >= startDate && checkDay <= endDate) {
          return false;
        }
      }
    }

    // Check opening hours if available
    if (selectedSpace.openingHours && Array.isArray(selectedSpace.openingHours)) {
      const dayName = day.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const todayHours = selectedSpace.openingHours.find((h) => h.day.toLowerCase() === dayName);
      
      // If no hours defined for this day, it's unavailable
      if (!todayHours) {
        return false;
      }
      
      // If explicitly marked as closed
      if (todayHours.isOpen === false) {
        return false;
      }
    }

    return true;
  };

  // Check if time slot is available
  const isTimeSlotAvailable = (time: string, duration: number = 60) => {
    if (!selectedSpace || !selectedDate) {
      return false;
    }

    const [hour, minute] = time.split(':').map(Number);
    const slotStart = new Date(selectedDate);
    slotStart.setHours(hour, minute, 0, 0);

    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotEnd.getMinutes() + duration);

    // Check if day is available first (uses our enhanced availability logic)
    if (!isDayAvailable(selectedDate)) {
      return false;
    }

    // Check opening hours
    if (selectedSpace.openingHours && Array.isArray(selectedSpace.openingHours)) {
      const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const todayHours = selectedSpace.openingHours.find((h) => h.day.toLowerCase() === dayName);

      if (!todayHours || todayHours.isOpen === false) {
        return false;
      }

      const openTime = parse(todayHours.open, 'HH:mm', selectedDate);
      const closeTime = parse(todayHours.close, 'HH:mm', selectedDate);

      // Check if slot is within opening hours
      if (
        !isWithinInterval(slotStart, { start: openTime, end: closeTime }) ||
        !isWithinInterval(slotEnd, { start: openTime, end: closeTime })
      ) {
        return false;
      }

      // Check if slot conflicts with any breaks
      if (todayHours.breaks && Array.isArray(todayHours.breaks)) {
        for (const breakPeriod of todayHours.breaks) {
          const breakStart = parse(breakPeriod.start, 'HH:mm', selectedDate);
          const breakEnd = parse(breakPeriod.end, 'HH:mm', selectedDate);

          // Check if slot overlaps with break period
          if (
            (slotStart >= breakStart && slotStart < breakEnd) ||
            (slotEnd > breakStart && slotEnd <= breakEnd) ||
            (slotStart <= breakStart && slotEnd >= breakEnd)
          ) {
            return false;
          }
        }
      }
    }

    // Check conflicts with existing bookings
    return !bookingsForDate.some((booking: Booking) => {
      const bookingStart = parseISO(booking.startTime);
      const bookingEnd = parseISO(booking.endTime);

      return (
        (slotStart >= bookingStart && slotStart < bookingEnd) ||
        (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
        (slotStart <= bookingStart && slotEnd >= bookingEnd)
      );
    });
  };

  // Export functions
  const exportMyBookings = () => {
    const icsContent = generateICS(userBookings, false);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `mes-reservations-${format(new Date(), 'yyyy-MM-dd')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAllBookings = () => {
    if (!selectedSpace) {
      return;
    }

    const icsContent = generateICS(bookings, true);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `agenda-${selectedSpace.name.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const onSubmit = (data: BookingFormData) => {
    createBookingMutation.mutate(data);
  };

  const handleSpaceClick = (space: CommonSpace) => {
    setSelectedSpace(space);
    setExpandedSpaceId(expandedSpaceId === space.id ? null : space.id);
  };

  const handleDateClick = (date: Date) => {
    setPreSelectedDate(date);
    form.setValue('date', date);
    setIsBookingDialogOpen(true);
  };

  const handleNewBooking = (space: CommonSpace, date?: Date) => {
    setSelectedSpace(space);
    if (date) {
      setPreSelectedDate(date);
      form.setValue('date', date);
    }
    setIsBookingDialogOpen(true);
  };

  return (
    <div className='flex-1 flex flex-col overflow-hidden' data-testid='common-spaces-page'>
      <Header
        title={language === 'fr' ? 'Espaces Communs' : 'Common Spaces'}
        subtitle={language === 'fr' ? 'Réservez vos espaces communs' : 'Book your common spaces'}
      />

      {/* Back Navigation */}
      {buildingId && (
        <div className="p-4 border-b border-gray-200">
          <Button
            variant="outline"
            onClick={handleBackToBuilding}
            className="flex items-center gap-2"
            data-testid="button-back-to-building"
          >
            <ArrowLeft className="w-4 h-4" />
            {language === 'fr' ? 'Bâtiment' : 'Building'}
          </Button>
        </div>
      )}

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
        <div className='space-y-6'>
          <div className='flex items-center justify-between'>
            <h2 className='text-2xl font-bold text-gray-900' data-testid='spaces-list-title'>
              {language === 'fr' ? 'Espaces Disponibles' : 'Available Spaces'}
            </h2>
            <div className='flex items-center gap-2'>
              <Button
                onClick={() =>
                  window.open(
                    'https://calendar.google.com/calendar/u/0/r/settings/addbyurl',
                    '_blank'
                  )
                }
                variant='outline'
                size='sm'
                className='flex items-center gap-2'
                data-testid='button-link-calendar'
              >
                <Link className='w-4 h-4' />
                {language === 'fr' ? 'Lier calendrier' : 'Link calendar'}
              </Button>
              <Button
                onClick={exportMyBookings}
                variant='outline'
                size='sm'
                className='flex items-center gap-2'
                data-testid='button-export-my-bookings'
              >
                <Download className='w-4 h-4' />
                {language === 'fr'
                  ? 'Exporter mes réservations (.ics)'
                  : 'Export my bookings (.ics)'}
              </Button>
            </div>
          </div>

          {spacesLoading ? (
            <div className='space-y-4'>
              {[...Array(3)].map((_, i) => (
                <div key={i} className='h-32 bg-gray-200 rounded-lg animate-pulse' />
              ))}
            </div>
          ) : (
            <div className='space-y-4' data-testid='spaces-list'>
              {(commonSpaces as CommonSpace[]).map((space: CommonSpace) => (
                <div key={space.id}>
                  <Card
                    className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                      expandedSpaceId === space.id ? 'ring-2 ring-koveo-navy bg-koveo-light/10' : ''
                    }`}
                    onClick={() => handleSpaceClick(space)}
                    data-testid={`space-card-${space.id}`}
                  >
                    <CardHeader className='pb-3'>
                      <div className='flex items-start justify-between'>
                        <CardTitle className='flex items-center gap-2 text-lg'>
                          <Building2 className='w-5 h-5 text-koveo-navy' />
                          {space.name}
                          {expandedSpaceId === space.id ? (
                            <ChevronUp className='w-4 h-4 text-gray-500' />
                          ) : (
                            <ChevronDown className='w-4 h-4 text-gray-500' />
                          )}
                        </CardTitle>
                        <div className='flex items-center gap-2'>
                          {space.isReservable ? (
                            <Badge variant='secondary' className='bg-green-100 text-green-800'>
                              {language === 'fr' ? 'Réservable' : 'Bookable'}
                            </Badge>
                          ) : (
                            <Badge variant='secondary' className='bg-gray-100 text-gray-600'>
                              {language === 'fr' ? 'Non Réservable' : 'Non Bookable'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className='space-y-3'>
                      {space.description && (
                        <p
                          className='text-gray-600 text-sm'
                          data-testid={`space-description-${space.id}`}
                        >
                          {space.description}
                        </p>
                      )}

                      <div className='flex items-center gap-4 text-sm text-gray-500'>
                        {space.capacity && (
                          <div className='flex items-center gap-1'>
                            <Users className='w-4 h-4' />
                            <span data-testid={`space-capacity-${space.id}`}>
                              {space.capacity} {language === 'fr' ? 'personnes max' : 'people max'}
                            </span>
                          </div>
                        )}
                      </div>

                      {space.openingHours && space.openingHours.length > 0 && (
                        <div className='mt-3'>
                          <h4 className='font-medium text-sm text-gray-700 mb-2 flex items-center gap-1'>
                            <Clock className='w-4 h-4' />
                            {language === 'fr' ? "Heures d'ouverture" : 'Opening Hours'}
                          </h4>
                          <div
                            className='grid grid-cols-1 gap-1 text-xs text-gray-600'
                            data-testid={`space-hours-${space.id}`}
                          >
                            {space.openingHours.map((hours, idx) => (
                              <div key={idx} className='flex justify-between'>
                                <span className='capitalize'>{hours.day}</span>
                                <span>
                                  {hours.open} - {hours.close}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {space.bookingRules && (
                        <div className='mt-3'>
                          <h4 className='font-medium text-sm text-gray-700 mb-1 flex items-center gap-1'>
                            <FileText className='w-4 h-4' />
                            {language === 'fr' ? 'Règles de réservation' : 'Booking Rules'}
                          </h4>
                          <p
                            className='text-xs text-gray-600'
                            data-testid={`space-rules-${space.id}`}
                          >
                            {space.bookingRules}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Inline Calendar */}
                  {expandedSpaceId === space.id && (
                    <>
                      <CommonSpaceCalendar
                        space={space}
                        onExport={exportAllBookings}
                        onNewBooking={(date) => handleNewBooking(space, date)}
                        className='mt-4'
                      />

                      {/* Booking Dialog */}
                      {space.isReservable && (
                        <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
                          <DialogContent
                            className='max-w-lg max-h-[90vh] overflow-y-auto'
                            data-testid='booking-dialog'
                          >
                            <DialogHeader>
                              <DialogTitle>
                                {language === 'fr' ? 'Nouvelle réservation' : 'New Booking'}
                              </DialogTitle>
                              <DialogDescription>
                                {language === 'fr'
                                  ? `Réserver ${space.name}`
                                  : `Book ${space.name}`}
                              </DialogDescription>
                            </DialogHeader>

                            <Form {...form}>
                              <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
                                {/* Selected Date Display */}
                                <div className='p-4 bg-blue-50 border border-blue-200 rounded-lg'>
                                  <div className='text-sm font-medium text-blue-900 mb-1'>
                                    {language === 'fr' ? 'Date sélectionnée' : 'Selected Date'}
                                  </div>
                                  <div className='text-lg font-semibold text-blue-800'>
                                    {format(form.watch('date'), 'EEEE, d MMMM yyyy', {
                                      locale: language === 'fr' ? fr : undefined,
                                    })}
                                  </div>
                                </div>

                                {/* Opening Hours Display */}
                                {selectedSpace?.openingHours && Array.isArray(selectedSpace.openingHours) && (
                                  <div className='p-3 bg-green-50 border border-green-200 rounded-lg'>
                                    <div className='text-sm font-medium text-green-900 mb-2'>
                                      {language === 'fr' ? 'Heures d\'ouverture' : 'Opening Hours'}
                                    </div>
                                    {selectedSpace.openingHours.map((hours, index) => {
                                      const dayName = form.watch('date').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                                      if (hours.day.toLowerCase() === dayName) {
                                        return (
                                          <div key={index} className='text-sm text-green-800'>
                                            {hours.open} - {hours.close}
                                          </div>
                                        );
                                      }
                                      return null;
                                    })}
                                  </div>
                                )}

                                {/* Time Slots Grid */}
                                <div className='space-y-4'>
                                  <div className='text-sm font-medium text-gray-900'>
                                    {language === 'fr' ? 'Créneaux horaires disponibles' : 'Available Time Slots'}
                                  </div>
                                  
                                  <div className='grid grid-cols-4 gap-2 max-h-60 overflow-y-auto p-2 border rounded-lg bg-gray-50'>
                                    {timeSlots.map((time) => {
                                      const isAvailable = isTimeSlotAvailable(time);
                                      const hasBooking = bookingsForDate.some((booking: Booking) => {
                                        const bookingStart = parseISO(booking.startTime);
                                        const bookingEnd = parseISO(booking.endTime);
                                        const timeSlot = parse(time, 'HH:mm', form.watch('date'));
                                        return timeSlot >= bookingStart && timeSlot < bookingEnd;
                                      });
                                      
                                      const currentStartTime = form.watch('startTime');
                                      const currentEndTime = form.watch('endTime');
                                      const isSelected = time === currentStartTime || time === currentEndTime;
                                      
                                      return (
                                        <button
                                          key={time}
                                          type='button'
                                          disabled={!isAvailable || hasBooking}
                                          onClick={() => {
                                            if (!currentStartTime || (currentStartTime && currentEndTime)) {
                                              // Set start time
                                              form.setValue('startTime', time);
                                              form.setValue('endTime', '');
                                            } else {
                                              // Set end time if start time is already set
                                              if (time > currentStartTime) {
                                                form.setValue('endTime', time);
                                              } else {
                                                // If selected time is before start time, make it the new start time
                                                form.setValue('startTime', time);
                                                form.setValue('endTime', '');
                                              }
                                            }
                                          }}
                                          className={`
                                            p-2 text-xs rounded-md border transition-colors relative
                                            ${
                                              !isAvailable
                                                ? 'bg-red-100 border-red-200 text-red-600 cursor-not-allowed'
                                                : hasBooking
                                                  ? 'bg-orange-100 border-orange-200 text-orange-700 cursor-not-allowed'
                                                  : isSelected
                                                    ? 'bg-blue-500 border-blue-600 text-white font-semibold'
                                                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300'
                                            }
                                          `}
                                        >
                                          <div className='font-medium'>{time}</div>
                                          {hasBooking && (
                                            <div className='text-[10px] mt-1 text-orange-600'>
                                              {language === 'fr' ? 'Réservé' : 'Booked'}
                                            </div>
                                          )}
                                          {!isAvailable && !hasBooking && (
                                            <div className='text-[10px] mt-1 text-red-600'>
                                              {language === 'fr' ? 'Fermé' : 'Closed'}
                                            </div>
                                          )}
                                          {isSelected && (
                                            <div className='text-[10px] mt-1 text-white'>
                                              {time === currentStartTime 
                                                ? (language === 'fr' ? 'Début' : 'Start')
                                                : (language === 'fr' ? 'Fin' : 'End')
                                              }
                                            </div>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {/* Legend */}
                                  <div className='grid grid-cols-2 gap-4 text-xs'>
                                    <div className='space-y-2'>
                                      <div className='flex items-center gap-2'>
                                        <div className='w-3 h-3 bg-white border border-gray-200 rounded'></div>
                                        <span>{language === 'fr' ? 'Disponible' : 'Available'}</span>
                                      </div>
                                      <div className='flex items-center gap-2'>
                                        <div className='w-3 h-3 bg-blue-500 rounded'></div>
                                        <span>{language === 'fr' ? 'Sélectionné' : 'Selected'}</span>
                                      </div>
                                    </div>
                                    <div className='space-y-2'>
                                      <div className='flex items-center gap-2'>
                                        <div className='w-3 h-3 bg-orange-100 border border-orange-200 rounded'></div>
                                        <span>{language === 'fr' ? 'Réservé' : 'Booked'}</span>
                                      </div>
                                      <div className='flex items-center gap-2'>
                                        <div className='w-3 h-3 bg-red-100 border border-red-200 rounded'></div>
                                        <span>{language === 'fr' ? 'Fermé' : 'Closed'}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Selected Time Summary */}
                                {form.watch('startTime') && (
                                  <div className='p-3 bg-gray-50 border border-gray-200 rounded-lg'>
                                    <div className='text-sm font-medium text-gray-900 mb-1'>
                                      {language === 'fr' ? 'Réservation sélectionnée' : 'Selected Booking'}
                                    </div>
                                    <div className='text-sm text-gray-700'>
                                      <span className='font-medium'>
                                        {language === 'fr' ? 'Début:' : 'Start:'}
                                      </span> {form.watch('startTime')}
                                      {form.watch('endTime') && (
                                        <span className='ml-4'>
                                          <span className='font-medium'>
                                            {language === 'fr' ? 'Fin:' : 'End:'}
                                          </span> {form.watch('endTime')}
                                        </span>
                                      )}
                                    </div>
                                    {form.watch('endTime') && (
                                      <div className='text-xs text-gray-500 mt-1'>
                                        {language === 'fr' ? 'Durée:' : 'Duration:'} 
                                        {(() => {
                                          const start = parse(form.watch('startTime'), 'HH:mm', new Date());
                                          const end = parse(form.watch('endTime'), 'HH:mm', new Date());
                                          const duration = (end.getTime() - start.getTime()) / (1000 * 60);
                                          return `${Math.floor(duration / 60)}h ${duration % 60 > 0 ? `${duration % 60}min` : ''}`;
                                        })()} 
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Validation Messages */}
                                {!form.watch('startTime') && (
                                  <div className='text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3'>
                                    {language === 'fr' 
                                      ? 'Veuillez sélectionner une heure de début'
                                      : 'Please select a start time'}
                                  </div>
                                )}
                                {form.watch('startTime') && !form.watch('endTime') && (
                                  <div className='text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3'>
                                    {language === 'fr' 
                                      ? 'Veuillez sélectionner une heure de fin'
                                      : 'Please select an end time'}
                                  </div>
                                )}

                                {/* Hidden form fields to maintain form validation */}
                                <div className='hidden'>
                                  <FormField
                                    control={form.control}
                                    name='date'
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <input {...field} value={field.value?.toISOString() || ''} readOnly />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name='startTime'
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <input {...field} readOnly />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name='endTime'
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <input {...field} readOnly />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>

                                <DialogFooter>
                                  <Button
                                    type='button'
                                    variant='outline'
                                    onClick={() => {
                                      setIsBookingDialogOpen(false);
                                      form.reset();
                                    }}
                                    data-testid='button-cancel-booking'
                                  >
                                    {language === 'fr' ? 'Annuler' : 'Cancel'}
                                  </Button>
                                  <Button
                                    type='submit'
                                    disabled={
                                      createBookingMutation.isPending || 
                                      !form.watch('startTime') || 
                                      !form.watch('endTime')
                                    }
                                    data-testid='button-confirm-booking'
                                  >
                                    {createBookingMutation.isPending
                                      ? language === 'fr'
                                        ? 'Réservation...'
                                        : 'Booking...'
                                      : language === 'fr'
                                        ? 'Confirmer la réservation'
                                        : 'Confirm Booking'}
                                  </Button>
                                </DialogFooter>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

// Wrap with hierarchical selection HOC using building hierarchy (residents only see buildings they have residences in)
const CommonSpacesPage = withHierarchicalSelection(CommonSpacesPageInner, {
  hierarchy: ['building']
});

export default CommonSpacesPage;
