import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CalendarIcon, Download, Plus, Link2, Check } from 'lucide-react';
import { CalendarView } from './calendar-view';
import { useLanguage } from '@/hooks/use-language';

/**
 *
 */
interface CommonSpaceCalendarProps {
  space: {
    id: string;
    name: string;
    isReservable: boolean;
  };
  onExport?: () => void;
  onNewBooking?: (date?: Date) => void;
  className?: string;
}

/**
 * Reusable Common Space Calendar Component
 * Used across all pages that need to display space calendars.
 * @param root0
 * @param root0.space
 * @param root0.onExport
 * @param root0.onNewBooking
 * @param root0.className
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
  const [showProviderStep, setShowProviderStep] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

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
                  {!showProviderStep 
                    ? (language === 'fr' 
                      ? 'Que souhaitez-vous lier ?' 
                      : 'What do you want to link?')
                    : (language === 'fr' 
                      ? 'Choisir le fournisseur de calendrier' 
                      : 'Choose calendar provider')
                  }
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {!showProviderStep && (
                  <>
                    <div className="text-sm text-gray-600">
                      {language === 'fr' 
                        ? 'Sélectionnez quel type de calendrier vous souhaitez synchroniser:'
                        : 'Select which type of calendar you want to sync:'
                      }
                    </div>
                
                {/* Link Everything Option */}
                <div 
                  className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedCalendarType === 'everything' 
                      ? 'border-koveo-navy bg-koveo-navy/5' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedCalendarType('everything')}
                  data-testid="option-everything-calendar"
                >
                  <div>
                    <div className="font-medium">
                      {language === 'fr' ? 'Tout lier' : 'Link everything'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {language === 'fr' 
                        ? 'Synchroniser tous les calendriers disponibles'
                        : 'Sync all available calendars'
                      }
                    </div>
                  </div>
                  {selectedCalendarType === 'everything' && (
                    <Check className="w-5 h-5 text-koveo-navy" />
                  )}
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
                      {language === 'fr' ? 'Espaces communs seulement' : 'Common spaces only'}
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

                {selectedCalendarType === 'everything' && (
                  <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-sm font-medium text-green-900 mb-2">
                      {language === 'fr' 
                        ? 'Configuration complète'
                        : 'Complete configuration'
                      }
                    </div>
                    <div className="text-sm text-green-700">
                      {language === 'fr' 
                        ? 'Cette option synchronisera tous les calendriers disponibles : espaces communs, maintenance, et événements du bâtiment.'
                        : 'This option will sync all available calendars: common spaces, maintenance, and building events.'
                      }
                    </div>
                  </div>
                )}

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
                          setShowProviderStep(false);
                          setSelectedProvider(null);
                        }}
                        data-testid="button-cancel-link"
                      >
                        {language === 'fr' ? 'Annuler' : 'Cancel'}
                      </Button>
                      <Button
                        onClick={() => {
                          if (selectedCalendarType) {
                            setShowProviderStep(true);
                          }
                        }}
                        disabled={!selectedCalendarType}
                        data-testid="button-next-step"
                      >
                        {language === 'fr' ? 'Suivant' : 'Next'}
                      </Button>
                    </div>
                  </>
                )}

                {showProviderStep && (
                  <>
                    <div className="text-sm text-gray-600 mb-4">
                      {language === 'fr' 
                        ? 'Sélectionnez le fournisseur de calendrier où vous souhaitez synchroniser :'
                        : 'Select the calendar provider where you want to sync:'
                      }
                    </div>

                    {/* Google Calendar Option */}
                    <div 
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedProvider === 'google' 
                          ? 'border-koveo-navy bg-koveo-navy/5' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedProvider('google')}
                      data-testid="option-google-calendar"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white font-bold">
                          G
                        </div>
                        <div>
                          <div className="font-medium">Google Calendar</div>
                          <div className="text-sm text-gray-500">
                            {language === 'fr' ? 'Synchroniser avec Google Calendar' : 'Sync with Google Calendar'}
                          </div>
                        </div>
                      </div>
                      {selectedProvider === 'google' && (
                        <Check className="w-5 h-5 text-koveo-navy" />
                      )}
                    </div>

                    {/* Outlook Calendar Option */}
                    <div 
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedProvider === 'outlook' 
                          ? 'border-koveo-navy bg-koveo-navy/5' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedProvider('outlook')}
                      data-testid="option-outlook-calendar"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                          O
                        </div>
                        <div>
                          <div className="font-medium">Outlook Calendar</div>
                          <div className="text-sm text-gray-500">
                            {language === 'fr' ? 'Synchroniser avec Outlook Calendar' : 'Sync with Outlook Calendar'}
                          </div>
                        </div>
                      </div>
                      {selectedProvider === 'outlook' && (
                        <Check className="w-5 h-5 text-koveo-navy" />
                      )}
                    </div>

                    {/* Apple Calendar Option */}
                    <div 
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedProvider === 'apple' 
                          ? 'border-koveo-navy bg-koveo-navy/5' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedProvider('apple')}
                      data-testid="option-apple-calendar"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-white font-bold">
                          
                        </div>
                        <div>
                          <div className="font-medium">Apple Calendar</div>
                          <div className="text-sm text-gray-500">
                            {language === 'fr' ? 'Synchroniser avec Apple Calendar' : 'Sync with Apple Calendar'}
                          </div>
                        </div>
                      </div>
                      {selectedProvider === 'apple' && (
                        <Check className="w-5 h-5 text-koveo-navy" />
                      )}
                    </div>

                    {/* Other Calendar Option */}
                    <div 
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedProvider === 'other' 
                          ? 'border-koveo-navy bg-koveo-navy/5' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedProvider('other')}
                      data-testid="option-other-calendar"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center text-white font-bold">
                          ...
                        </div>
                        <div>
                          <div className="font-medium">
                            {language === 'fr' ? 'Autre calendrier' : 'Other calendar'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {language === 'fr' ? 'Utiliser un fichier ICS ou autre' : 'Use ICS file or other'}
                          </div>
                        </div>
                      </div>
                      {selectedProvider === 'other' && (
                        <Check className="w-5 h-5 text-koveo-navy" />
                      )}
                    </div>

                    {selectedProvider && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-sm font-medium text-blue-900 mb-2">
                          {language === 'fr' ? 'Configuration finale' : 'Final configuration'}
                        </div>
                        <div className="text-sm text-blue-700">
                          {language === 'fr' 
                            ? `Prêt à lier ${selectedCalendarType === 'everything' ? 'tous les calendriers' : 'les espaces communs'} avec ${
                                selectedProvider === 'google' ? 'Google Calendar' :
                                selectedProvider === 'outlook' ? 'Outlook Calendar' :
                                selectedProvider === 'apple' ? 'Apple Calendar' :
                                'votre calendrier'
                              }.`
                            : `Ready to link ${selectedCalendarType === 'everything' ? 'all calendars' : 'common spaces'} with ${
                                selectedProvider === 'google' ? 'Google Calendar' :
                                selectedProvider === 'outlook' ? 'Outlook Calendar' :
                                selectedProvider === 'apple' ? 'Apple Calendar' :
                                'your calendar'
                              }.`
                          }
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between gap-2 mt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowProviderStep(false);
                          setSelectedProvider(null);
                        }}
                        data-testid="button-back-step"
                      >
                        {language === 'fr' ? 'Retour' : 'Back'}
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsLinkDialogOpen(false);
                            setSelectedCalendarType(null);
                            setShowProviderStep(false);
                            setSelectedProvider(null);
                          }}
                          data-testid="button-cancel-provider"
                        >
                          {language === 'fr' ? 'Annuler' : 'Cancel'}
                        </Button>
                        <Button
                          onClick={() => {
                            // Handle final calendar linking here
                            console.log(`Linking ${selectedCalendarType} to ${selectedProvider} for space: ${space.name}`);
                            setIsLinkDialogOpen(false);
                            setSelectedCalendarType(null);
                            setShowProviderStep(false);
                            setSelectedProvider(null);
                          }}
                          disabled={!selectedProvider}
                          data-testid="button-confirm-final-link"
                        >
                          {language === 'fr' ? 'Lier calendrier' : 'Link calendar'}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
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
        onDateClick={(date) => {
          console.log('Clicked date:', date);
          onNewBooking?.(date);
        }}
        data-testid={`inline-calendar-${space.id}`}
      />
    </div>
  );
}