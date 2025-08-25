import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, isSameDay, parseISO, isWithinInterval, parse } from 'date-fns';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Calendar } from '@/components/ui/calendar';
import { 
  Building2, 
  Clock, 
  Users, 
  MapPin, 
  Download,
  Calendar as CalendarIcon,
  Plus,
  X,
  FileText,
  User,
  CalendarDays,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { apiRequest } from '@/lib/queryClient';
import { CalendarView } from '@/components/common-spaces/calendar-view';
import { CommonSpaceCalendar } from '@/components/common-spaces/common-space-calendar';

/**
 * Common Space interface
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
  }>;
  bookingRules?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Booking interface
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
 * Booking form schema
 */
const bookingFormSchema = z.object({
  date: z.date({
    message: "La date est requise",
  }),
  startTime: z.string().min(1, "L'heure de début est requise"),
  endTime: z.string().min(1, "L'heure de fin est requise"),
}).refine((data) => {
  const start = parse(data.startTime, 'HH:mm', new Date());
  const end = parse(data.endTime, 'HH:mm', new Date());
  return end > start;
}, {
  message: "L'heure de fin doit être après l'heure de début",
  path: ["endTime"],
});

type BookingFormData = z.infer<typeof bookingFormSchema>;

/**
 * Utility function to generate .ics calendar content
 */
function generateICS(bookings: Booking[], allSpaces?: boolean): string {
  const now = new Date();
  const icsHeader = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Koveo Gestion//Common Spaces//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ].join('\r\n');

  const icsEvents = bookings.map(booking => {
    const startDate = new Date(booking.startTime);
    const endDate = new Date(booking.endTime);
    
    // Format dates for ICS (YYYYMMDDTHHMMSSZ)
    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const title = allSpaces 
      ? `Réservation d'espace commun`
      : `Espace commun réservé`;

    return [
      'BEGIN:VEVENT',
      `UID:${booking.id}@koveogestion.com`,
      `DTSTAMP:${formatICSDate(now)}`,
      `DTSTART:${formatICSDate(startDate)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:Réservation confirmée pour un espace commun`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    ].join('\r\n');
  });

  const icsFooter = 'END:VCALENDAR';

  return [icsHeader, ...icsEvents, icsFooter].join('\r\n');
}

/**
 * Common Spaces page component for residents
 */
export default function CommonSpacesPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
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
      startTime: "09:00",
      endTime: "10:00",
    },
  });

  // Fetch common spaces in user's buildings
  const { data: commonSpaces = [], isLoading: spacesLoading } = useQuery<CommonSpace[]>({
    queryKey: ['/api/common-spaces'],
    enabled: !!user,
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
      if (!selectedSpace) throw new Error('No space selected');
      
      const startDateTime = new Date(data.date);
      const [startHour, startMinute] = data.startTime.split(':').map(Number);
      startDateTime.setHours(startHour, startMinute, 0, 0);
      
      const endDateTime = new Date(data.date);
      const [endHour, endMinute] = data.endTime.split(':').map(Number);
      endDateTime.setHours(endHour, endMinute, 0, 0);
      
      return apiRequest(`/api/common-spaces/${selectedSpace.id}/bookings`, 'POST', {
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/common-spaces'] });
      toast({
        title: "Réservation confirmée",
        description: "Votre réservation a été créée avec succès.",
      });
      setIsBookingDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de réservation",
        description: error.message || "Une erreur est survenue lors de la création de la réservation.",
        variant: "destructive",
      });
    },
  });

  // Get bookings for selected date
  const bookingsForDate = useMemo(() => {
    if (!bookings || !selectedDate) return [];
    
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

  // Check if time slot is available
  const isTimeSlotAvailable = (time: string, duration: number = 60) => {
    if (!selectedSpace || !selectedDate) return false;
    
    const [hour, minute] = time.split(':').map(Number);
    const slotStart = new Date(selectedDate);
    slotStart.setHours(hour, minute, 0, 0);
    
    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotEnd.getMinutes() + duration);
    
    // Check opening hours
    if (selectedSpace.openingHours) {
      const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const todayHours = selectedSpace.openingHours.find(h => h.day.toLowerCase() === dayName);
      
      if (!todayHours) return false;
      
      const openTime = parse(todayHours.open, 'HH:mm', selectedDate);
      const closeTime = parse(todayHours.close, 'HH:mm', selectedDate);
      
      if (!isWithinInterval(slotStart, { start: openTime, end: closeTime }) ||
          !isWithinInterval(slotEnd, { start: openTime, end: closeTime })) {
        return false;
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
    if (!selectedSpace) return;
    
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
    <div className="min-h-screen bg-gray-50" data-testid="common-spaces-page">
      <Header 
        title={language === 'fr' ? 'Espaces Communs' : 'Common Spaces'} 
        subtitle={language === 'fr' ? 'Réservez vos espaces communs' : 'Book your common spaces'}
      />
      
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900" data-testid="spaces-list-title">
              {language === 'fr' ? 'Espaces Disponibles' : 'Available Spaces'}
            </h2>
            <Button
              onClick={exportMyBookings}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              data-testid="button-export-my-bookings"
            >
              <Download className="w-4 h-4" />
              {language === 'fr' ? 'Exporter mes réservations (.ics)' : 'Export my bookings (.ics)'}
            </Button>
          </div>

          {spacesLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4" data-testid="spaces-list">
              {(commonSpaces as CommonSpace[]).map((space: CommonSpace) => (
                <div key={space.id}>
                  <Card 
                    className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                      expandedSpaceId === space.id ? 'ring-2 ring-koveo-navy bg-koveo-light/10' : ''
                    }`}
                    onClick={() => handleSpaceClick(space)}
                    data-testid={`space-card-${space.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Building2 className="w-5 h-5 text-koveo-navy" />
                          {space.name}
                          {expandedSpaceId === space.id ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {space.isReservable ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              {language === 'fr' ? 'Réservable' : 'Bookable'}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                              {language === 'fr' ? 'Non Réservable' : 'Non Bookable'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-3">
                      {space.description && (
                        <p className="text-gray-600 text-sm" data-testid={`space-description-${space.id}`}>
                          {space.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {space.capacity && (
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span data-testid={`space-capacity-${space.id}`}>
                              {space.capacity} {language === 'fr' ? 'personnes max' : 'people max'}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {space.openingHours && space.openingHours.length > 0 && (
                        <div className="mt-3">
                          <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {language === 'fr' ? 'Heures d\'ouverture' : 'Opening Hours'}
                          </h4>
                          <div className="grid grid-cols-1 gap-1 text-xs text-gray-600" data-testid={`space-hours-${space.id}`}>
                            {space.openingHours.map((hours, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span className="capitalize">{hours.day}</span>
                                <span>{hours.open} - {hours.close}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {space.bookingRules && (
                        <div className="mt-3">
                          <h4 className="font-medium text-sm text-gray-700 mb-1 flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            {language === 'fr' ? 'Règles de réservation' : 'Booking Rules'}
                          </h4>
                          <p className="text-xs text-gray-600" data-testid={`space-rules-${space.id}`}>
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
                        className="mt-4"
                      />
                      
                      {/* Booking Dialog */}
                      {space.isReservable && (
                        <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
                          <DialogContent className="max-w-md" data-testid="booking-dialog">
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
                              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                  control={form.control}
                                  name="date"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        {language === 'fr' ? 'Date de réservation' : 'Booking Date'}
                                      </FormLabel>
                                      <FormControl>
                                        <div className="space-y-3">
                                          {preSelectedDate && (
                                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                              <div className="text-sm font-medium text-blue-900">
                                                {language === 'fr' ? 'Date sélectionnée depuis le calendrier' : 'Date selected from calendar'}
                                              </div>
                                              <div className="text-sm text-blue-700">
                                                {format(preSelectedDate, 'EEEE, d MMMM yyyy', { 
                                                  locale: language === 'fr' ? fr : undefined 
                                                })}
                                              </div>
                                            </div>
                                          )}
                                          <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={(date) => {
                                              field.onChange(date);
                                              setPreSelectedDate(null);
                                            }}
                                            disabled={(date) => date < new Date()}
                                            locale={language === 'fr' ? fr : undefined}
                                            className="rounded-md border"
                                            data-testid="booking-date-picker"
                                          />
                                        </div>
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                
                                <div className="grid grid-cols-2 gap-4">
                                  <FormField
                                    control={form.control}
                                    name="startTime"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>
                                          {language === 'fr' ? 'Heure de début' : 'Start Time'}
                                        </FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                          <FormControl>
                                            <SelectTrigger data-testid="booking-start-time">
                                              <SelectValue placeholder="09:00" />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            {timeSlots.map((time) => (
                                              <SelectItem 
                                                key={time} 
                                                value={time}
                                                disabled={!isTimeSlotAvailable(time)}
                                              >
                                                {time}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  
                                  <FormField
                                    control={form.control}
                                    name="endTime"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>
                                          {language === 'fr' ? 'Heure de fin' : 'End Time'}
                                        </FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                          <FormControl>
                                            <SelectTrigger data-testid="booking-end-time">
                                              <SelectValue placeholder="10:00" />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            {timeSlots.map((time) => (
                                              <SelectItem key={time} value={time}>
                                                {time}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                
                                <DialogFooter>
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={() => setIsBookingDialogOpen(false)}
                                    data-testid="button-cancel-booking"
                                  >
                                    {language === 'fr' ? 'Annuler' : 'Cancel'}
                                  </Button>
                                  <Button 
                                    type="submit" 
                                    disabled={createBookingMutation.isPending}
                                    data-testid="button-confirm-booking"
                                  >
                                    {createBookingMutation.isPending 
                                      ? (language === 'fr' ? 'Réservation...' : 'Booking...') 
                                      : (language === 'fr' ? 'Réserver' : 'Book')
                                    }
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
      </main>
    </div>
  );
}