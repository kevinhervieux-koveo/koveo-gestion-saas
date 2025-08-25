import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, addDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar as CalendarIcon, 
  Clock,
  MapPin,
  Download,
  Building2,
  User
} from 'lucide-react';
import { CalendarView } from './calendar-view';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';

interface UserBooking {
  id: string;
  startTime: string;
  endTime: string;
  status: 'confirmed' | 'cancelled';
  spaceName: string;
  spaceId: string;
  buildingName: string;
  buildingId: string;
}

interface UserCalendarData {
  user: {
    id: string;
    name: string;
    role: string;
  };
  calendar: {
    view: string;
    startDate: string;
    endDate: string;
    bookings: UserBooking[];
  };
  summary: {
    totalBookings: number;
    totalHours: number;
  };
}

export function UserCalendar() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [selectedBooking, setSelectedBooking] = useState<UserBooking | null>(null);

  const handleEventClick = (event: any) => {
    // Find the full booking details
    const booking = event as UserBooking;
    setSelectedBooking(booking);
  };

  const generateICSContent = (bookings: UserBooking[]) => {
    const icsEvents = bookings.map(booking => {
      const start = parseISO(booking.startTime);
      const end = parseISO(booking.endTime);
      const formatDate = (date: Date) => format(date, "yyyyMMdd'T'HHmmss'Z'");
      
      return [
        'BEGIN:VEVENT',
        `UID:${booking.id}@koveo-gestion.com`,
        `DTSTART:${formatDate(start)}`,
        `DTEND:${formatDate(end)}`,
        `SUMMARY:${booking.spaceName} - ${booking.buildingName}`,
        `LOCATION:${booking.buildingName}`,
        `DESCRIPTION:Réservation d'espace commun`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      ].join('\n');
    }).join('\n');

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Koveo Gestion//Common Spaces Calendar//FR',
      'CALSCALE:GREGORIAN',
      icsEvents,
      'END:VCALENDAR'
    ].join('\n');
  };

  const downloadCalendar = async () => {
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3);

      const params = new URLSearchParams({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        view: 'month',
      });

      const data = await apiRequest<UserCalendarData>(`/api/common-spaces/user-calendar?${params}`);
      const icsContent = generateICSContent(data.calendar.bookings);
      
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mes-reservations-${format(new Date(), 'yyyy-MM-dd')}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading calendar:', error);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            {language === 'fr' ? 'Connexion requise' : 'Login required'}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="user-calendar-container">
      {/* Header with user info and actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="h-6 w-6" />
            {language === 'fr' ? 'Mon Calendrier' : 'My Calendar'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'fr' 
              ? 'Consultez et gérez vos réservations d\'espaces communs' 
              : 'View and manage your common space bookings'
            }
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={downloadCalendar}
            className="flex items-center gap-2"
            data-testid="download-calendar-btn"
          >
            <Download className="h-4 w-4" />
            {language === 'fr' ? 'Télécharger (.ics)' : 'Download (.ics)'}
          </Button>
        </div>
      </div>

      {/* Main Calendar View */}
      <CalendarView
        mode="user"
        onEventClick={handleEventClick}
        showControls={true}
        className="col-span-2"
      />

      {/* Selected Booking Details */}
      {selectedBooking && (
        <Card data-testid="selected-booking-details">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {language === 'fr' ? 'Détails de la Réservation' : 'Booking Details'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{selectedBooking.spaceName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{selectedBooking.buildingName}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {format(parseISO(selectedBooking.startTime), 'dd/MM/yyyy', { locale: language === 'fr' ? fr : undefined })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {format(parseISO(selectedBooking.startTime), 'HH:mm', { locale: language === 'fr' ? fr : undefined })} - 
                    {format(parseISO(selectedBooking.endTime), 'HH:mm', { locale: language === 'fr' ? fr : undefined })}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Badge 
                variant={selectedBooking.status === 'confirmed' ? 'default' : 'secondary'}
                data-testid="booking-status-badge"
              >
                {selectedBooking.status === 'confirmed' 
                  ? (language === 'fr' ? 'Confirmé' : 'Confirmed')
                  : (language === 'fr' ? 'Annulé' : 'Cancelled')
                }
              </Badge>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedBooking(null)}
                data-testid="close-details-btn"
              >
                {language === 'fr' ? 'Fermer' : 'Close'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}