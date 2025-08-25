import React from 'react';
import { UserCalendar } from '@/components/common-spaces/user-calendar';
import { useLanguage } from '@/hooks/use-language';

/**
 *
 */
export default function MyCalendarPage() {
  const { language } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50" data-testid="my-calendar-page">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-koveo-navy">
            {language === 'fr' ? 'Mon Calendrier' : 'My Calendar'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {language === 'fr' 
              ? 'Consultez et gérez toutes vos réservations d\'espaces communs' 
              : 'View and manage all your common space bookings'
            }
          </p>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <UserCalendar />
      </main>
    </div>
  );
}