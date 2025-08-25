import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CalendarIcon, Download, Plus, Link2, Check } from 'lucide-react';
import { CalendarView } from './calendar-view';
import { useLanguage } from '@/hooks/use-language';

interface CommonSpaceCalendarProps {
  space: {
    id: string;
    name: string;
    isReservable: boolean;
  };
  onExport?: () => void;
  onNewBooking?: () => void;
  className?: string;
}

/**
 * Reusable Common Space Calendar Component
 * Used across all pages that need to display space calendars
 */
export function CommonSpaceCalendar({
  space,
  onExport,
  onNewBooking,
  className = ""
}: CommonSpaceCalendarProps) {
  const { language } = useLanguage();
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedCalendarType, setSelectedCalendarType] = useState<string | null>(null);

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-koveo-navy" />
          {language === 'fr' ? `Calendrier - ${space.name}` : `Calendar - ${space.name}`}
        </h3>
        <div className="flex gap-2">
          <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                data-testid="button-link-calendar"
              >
                <Link2 className="w-4 h-4" />
                {language === 'fr' ? 'Lier calendrier' : 'Link calendar'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {language === 'fr' 
                    ? 'Lier votre calendrier externe' 
                    : 'Link your external calendar'
                  }
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="text-sm text-gray-600">
                  {language === 'fr' 
                    ? 'Sélectionnez quel type de calendrier vous souhaitez synchroniser:'
                    : 'Select which type of calendar you want to sync:'
                  }
                </div>
                
                {/* Common Space Calendar Option */}
                <div 
                  className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedCalendarType === 'common-space' 
                      ? 'border-koveo-navy bg-koveo-navy/5' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedCalendarType('common-space')}
                  data-testid="option-common-space-calendar"
                >
                  <div>
                    <div className="font-medium">
                      {language === 'fr' ? 'Espaces communs' : 'Common spaces'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {language === 'fr' 
                        ? 'Synchroniser les réservations des espaces communs'
                        : 'Sync common space bookings'
                      }
                    </div>
                  </div>
                  {selectedCalendarType === 'common-space' && (
                    <Check className="w-5 h-5 text-koveo-navy" />
                  )}
                </div>

                {/* Maintenance Calendar Option */}
                <div 
                  className="flex items-center justify-between p-4 border rounded-lg opacity-50 cursor-not-allowed border-gray-200"
                  data-testid="option-maintenance-calendar"
                >
                  <div>
                    <div className="font-medium">
                      {language === 'fr' ? 'Réparations/Maintenance' : 'Repairs/Maintenance'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {language === 'fr' 
                        ? 'Fonctionnalité à venir - pas encore disponible'
                        : 'Feature to come - not yet available'
                      }
                    </div>
                  </div>
                </div>

                {/* Building Events Calendar Option */}
                <div 
                  className="flex items-center justify-between p-4 border rounded-lg opacity-50 cursor-not-allowed border-gray-200"
                  data-testid="option-building-events-calendar"
                >
                  <div>
                    <div className="font-medium">
                      {language === 'fr' ? 'Événements du bâtiment' : 'Building events'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {language === 'fr' 
                        ? 'Fonctionnalité à venir - pas encore disponible'
                        : 'Feature to come - not yet available'
                      }
                    </div>
                  </div>
                </div>

                {selectedCalendarType === 'common-space' && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-sm font-medium text-blue-900 mb-2">
                      {language === 'fr' 
                        ? 'Configuration des espaces communs'
                        : 'Common spaces configuration'
                      }
                    </div>
                    <div className="text-sm text-blue-700">
                      {language === 'fr' 
                        ? `Cette option synchronisera les réservations de "${space.name}" avec votre calendrier externe.`
                        : `This option will sync bookings for "${space.name}" with your external calendar.`
                      }
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsLinkDialogOpen(false);
                      setSelectedCalendarType(null);
                    }}
                    data-testid="button-cancel-link"
                  >
                    {language === 'fr' ? 'Annuler' : 'Cancel'}
                  </Button>
                  <Button
                    onClick={() => {
                      if (selectedCalendarType === 'common-space') {
                        // Handle common space calendar linking here
                        console.log(`Linking calendar for space: ${space.name}`);
                      }
                      setIsLinkDialogOpen(false);
                      setSelectedCalendarType(null);
                    }}
                    disabled={!selectedCalendarType}
                    data-testid="button-confirm-link"
                  >
                    {language === 'fr' ? 'Lier calendrier' : 'Link calendar'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {onExport && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onExport();
              }}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              data-testid="button-export-space-calendar"
            >
              <Download className="w-4 h-4" />
              {language === 'fr' ? 'Exporter (.ics)' : 'Export (.ics)'}
            </Button>
          )}
          {space.isReservable && onNewBooking && (
            <Button 
              onClick={(e) => {
                e.stopPropagation();
                onNewBooking();
              }}
              className="flex items-center gap-2"
              data-testid="button-new-booking-inline"
            >
              <Plus className="w-4 h-4" />
              {language === 'fr' ? 'Réserver' : 'Book'}
            </Button>
          )}
        </div>
      </div>
      
      <CalendarView
        mode="space"
        spaceId={space.id}
        showControls={false}
        onEventClick={(event) => {
          console.log('Clicked event:', event);
        }}
        data-testid={`inline-calendar-${space.id}`}
      />
    </div>
  );
}