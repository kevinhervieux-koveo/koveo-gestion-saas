import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar as CalendarIcon,
  Building,
  ExternalLink,
  Download,
  Filter,
  Eye,
  EyeOff,
  MapPin,
  Check,
} from 'lucide-react';
import { CalendarView } from '@/components/common-spaces/calendar-view';

/**
 *
 */
interface Building {
  id: string;
  name: string;
  address: string;
  city: string;
}

/**
 *
 */
interface CommonSpace {
  id: string;
  name: string;
  description?: string;
  buildingId: string;
  buildingName?: string;
  isReservable: boolean;
  capacity?: number;
}

/**
 *
 */
export default function DashboardCalendarPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [visibleSpaces, setVisibleSpaces] = useState<Set<string>>(new Set());
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedCalendarType, setSelectedCalendarType] = useState<string | null>(null);
  const [showProviderStep, setShowProviderStep] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  // Fetch buildings accessible to the user
  const { data: buildingsResponse, isLoading: buildingsLoading } = useQuery<{
    buildings: Building[];
  }>({
    queryKey: ['/api/manager/buildings'],
    enabled: !!user,
  });

  const buildings = buildingsResponse?.buildings || [];

  // Fetch all common spaces
  const { data: allSpaces = [], isLoading: spacesLoading } = useQuery<CommonSpace[]>({
    queryKey: ['/api/common-spaces'],
    enabled: !!user,
  });

  // Filter spaces based on building and search
  const filteredSpaces = useMemo(() => {
    let spaces = allSpaces;

    // Filter by building
    if (selectedBuildingId !== 'all') {
      spaces = spaces.filter((space) => space.buildingId === selectedBuildingId);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      spaces = spaces.filter(
        (space) =>
          space.name.toLowerCase().includes(query) ||
          space.description?.toLowerCase().includes(query) ||
          space.buildingName?.toLowerCase().includes(query)
      );
    }

    return spaces;
  }, [allSpaces, selectedBuildingId, searchQuery]);

  const toggleSpaceVisibility = (spaceId: string) => {
    setVisibleSpaces((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(spaceId)) {
        newSet.delete(spaceId);
      } else {
        newSet.add(spaceId);
      }
      return newSet;
    });
  };

  const showAllSpaces = () => {
    setVisibleSpaces(new Set(filteredSpaces.map((space) => space.id)));
  };

  const hideAllSpaces = () => {
    setVisibleSpaces(new Set());
  };

  const handleLinkCalendar = () => {
    // Get all visible spaces
    const visibleSpaceIds = Array.from(visibleSpaces);
    if (visibleSpaceIds.length === 0) {
      alert(
        language === 'fr'
          ? 'Veuillez sélectionner au moins un espace à inclure dans le calendrier.'
          : 'Please select at least one space to include in the calendar.'
      );
      return;
    }

    // Create calendar link parameters
    const params = new URLSearchParams({
      spaces: visibleSpaceIds.join(','),
      view: viewMode,
      building: selectedBuildingId === 'all' ? '' : selectedBuildingId,
    });

    const calendarUrl = `${window.location.origin}/dashboard/calendar?${params}`;

    // Copy to clipboard
    navigator.clipboard
      .writeText(calendarUrl)
      .then(() => {
        alert(
          language === 'fr'
            ? 'Lien du calendrier copié dans le presse-papiers!'
            : 'Calendar link copied to clipboard!'
        );
      })
      .catch(() => {
        // Fallback: show the URL in a prompt
        prompt(
          language === 'fr' ? 'Copiez ce lien de calendrier:' : 'Copy this calendar link:',
          calendarUrl
        );
      });
  };

  const handleExportCalendar = () => {
    const visibleSpaceIds = Array.from(visibleSpaces);
    if (visibleSpaceIds.length === 0) {
      alert(
        language === 'fr'
          ? 'Veuillez sélectionner au moins un espace à exporter.'
          : 'Please select at least one space to export.'
      );
      return;
    }

    // Create export URL
    const params = new URLSearchParams({
      spaces: visibleSpaceIds.join(','),
      format: 'ics',
    });

    const exportUrl = `/api/common-spaces/export?${params}`;
    window.open(exportUrl, '_blank');
  };

  return (
    <div className='flex-1 flex flex-col overflow-hidden' data-testid='dashboard-calendar-page'>
      <Header
        title={language === 'fr' ? 'Calendrier des Espaces Communs' : 'Common Spaces Calendar'}
        subtitle={
          language === 'fr' ? "Vue d'ensemble de tous les calendriers" : 'Overview of all calendars'
        }
      />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
        {/* Filters and Controls */}
        <Card className='mb-6'>
          <CardHeader>
            <CardTitle className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Filter className='w-5 h-5' />
                {language === 'fr' ? 'Filtres et Options' : 'Filters and Options'}
              </div>
              <div className='flex items-center gap-2'>
                <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant='outline'
                      size='sm'
                      className='flex items-center gap-2'
                      data-testid='button-link-calendar'
                    >
                      <ExternalLink className='w-4 h-4' />
                      {language === 'fr' ? 'Lier calendrier' : 'Link calendar'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className='sm:max-w-[500px]'>
                    <DialogHeader>
                      <DialogTitle>
                        {!showProviderStep
                          ? language === 'fr'
                            ? 'Que souhaitez-vous lier ?'
                            : 'What do you want to link?'
                          : language === 'fr'
                            ? 'Choisir le fournisseur de calendrier'
                            : 'Choose calendar provider'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className='grid gap-4 py-4'>
                      {!showProviderStep && (
                        <>
                          <div className='text-sm text-gray-600'>
                            {language === 'fr'
                              ? 'Sélectionnez quel type de calendrier vous souhaitez synchroniser:'
                              : 'Select which type of calendar you want to sync:'}
                          </div>

                          {/* Link Everything Option */}
                          <div
                            className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                              selectedCalendarType === 'everything'
                                ? 'border-koveo-navy bg-koveo-navy/5'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => setSelectedCalendarType('everything')}
                            data-testid='option-everything-calendar'
                          >
                            <div>
                              <div className='font-medium'>
                                {language === 'fr' ? 'Tout lier' : 'Link everything'}
                              </div>
                              <div className='text-sm text-gray-500'>
                                {language === 'fr'
                                  ? `Synchroniser tous les espaces sélectionnés (${visibleSpaces.size} espaces)`
                                  : `Sync all selected spaces (${visibleSpaces.size} spaces)`}
                              </div>
                            </div>
                            {selectedCalendarType === 'everything' && (
                              <Check className='w-5 h-5 text-koveo-navy' />
                            )}
                          </div>

                          {/* Individual Spaces Option */}
                          <div
                            className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                              selectedCalendarType === 'individual'
                                ? 'border-koveo-navy bg-koveo-navy/5'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => setSelectedCalendarType('individual')}
                            data-testid='option-individual-spaces'
                          >
                            <div>
                              <div className='font-medium'>
                                {language === 'fr' ? 'Espaces individuels' : 'Individual spaces'}
                              </div>
                              <div className='text-sm text-gray-500'>
                                {language === 'fr'
                                  ? 'Choisir des espaces spécifiques à synchroniser'
                                  : 'Choose specific spaces to sync'}
                              </div>
                            </div>
                            {selectedCalendarType === 'individual' && (
                              <Check className='w-5 h-5 text-koveo-navy' />
                            )}
                          </div>

                          {selectedCalendarType === 'everything' && (
                            <div className='mt-4 p-4 bg-green-50 rounded-lg border border-green-200'>
                              <div className='text-sm font-medium text-green-900 mb-2'>
                                {language === 'fr'
                                  ? 'Configuration complète'
                                  : 'Complete configuration'}
                              </div>
                              <div className='text-sm text-green-700'>
                                {visibleSpaces.size > 0
                                  ? language === 'fr'
                                    ? `Cette option synchronisera tous les ${visibleSpaces.size} espaces actuellement sélectionnés avec votre calendrier externe.`
                                    : `This option will sync all ${visibleSpaces.size} currently selected spaces with your external calendar.`
                                  : language === 'fr'
                                    ? 'Aucun espace sélectionné. Veuillez en sélectionner au moins un avant de continuer.'
                                    : 'No spaces selected. Please select at least one before continuing.'}
                              </div>
                            </div>
                          )}

                          {selectedCalendarType === 'individual' && (
                            <div className='mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200'>
                              <div className='text-sm font-medium text-blue-900 mb-2'>
                                {language === 'fr'
                                  ? 'Configuration individuelle'
                                  : 'Individual configuration'}
                              </div>
                              <div className='text-sm text-blue-700'>
                                {language === 'fr'
                                  ? "Vous pourrez choisir précisément quels espaces synchroniser à l'étape suivante."
                                  : 'You will be able to choose precisely which spaces to sync in the next step.'}
                              </div>
                            </div>
                          )}

                          <div className='flex justify-end gap-2 mt-4'>
                            <Button
                              variant='outline'
                              onClick={() => {
                                setIsLinkDialogOpen(false);
                                setSelectedCalendarType(null);
                                setShowProviderStep(false);
                                setSelectedProvider(null);
                              }}
                              data-testid='button-cancel-link'
                            >
                              {language === 'fr' ? 'Annuler' : 'Cancel'}
                            </Button>
                            <Button
                              onClick={() => {
                                if (
                                  selectedCalendarType === 'everything' &&
                                  visibleSpaces.size === 0
                                ) {
                                  return; // Don't proceed if no spaces selected
                                }
                                if (selectedCalendarType) {
                                  setShowProviderStep(true);
                                }
                              }}
                              disabled={
                                !selectedCalendarType ||
                                (selectedCalendarType === 'everything' && visibleSpaces.size === 0)
                              }
                              data-testid='button-next-step'
                            >
                              {language === 'fr' ? 'Suivant' : 'Next'}
                            </Button>
                          </div>
                        </>
                      )}

                      {showProviderStep && (
                        <>
                          <div className='text-sm text-gray-600 mb-4'>
                            {language === 'fr'
                              ? 'Sélectionnez le fournisseur de calendrier où vous souhaitez synchroniser :'
                              : 'Select the calendar provider where you want to sync:'}
                          </div>

                          {/* Google Calendar Option */}
                          <div
                            className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                              selectedProvider === 'google'
                                ? 'border-koveo-navy bg-koveo-navy/5'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => setSelectedProvider('google')}
                            data-testid='option-google-calendar'
                          >
                            <div className='flex items-center gap-3'>
                              <div className='w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white font-bold'>
                                G
                              </div>
                              <div>
                                <div className='font-medium'>Google Calendar</div>
                                <div className='text-sm text-gray-500'>
                                  {language === 'fr'
                                    ? 'Synchroniser avec Google Calendar'
                                    : 'Sync with Google Calendar'}
                                </div>
                              </div>
                            </div>
                            {selectedProvider === 'google' && (
                              <Check className='w-5 h-5 text-koveo-navy' />
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
                            data-testid='option-outlook-calendar'
                          >
                            <div className='flex items-center gap-3'>
                              <div className='w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold'>
                                O
                              </div>
                              <div>
                                <div className='font-medium'>Outlook Calendar</div>
                                <div className='text-sm text-gray-500'>
                                  {language === 'fr'
                                    ? 'Synchroniser avec Outlook Calendar'
                                    : 'Sync with Outlook Calendar'}
                                </div>
                              </div>
                            </div>
                            {selectedProvider === 'outlook' && (
                              <Check className='w-5 h-5 text-koveo-navy' />
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
                            data-testid='option-apple-calendar'
                          >
                            <div className='flex items-center gap-3'>
                              <div className='w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-white font-bold'></div>
                              <div>
                                <div className='font-medium'>Apple Calendar</div>
                                <div className='text-sm text-gray-500'>
                                  {language === 'fr'
                                    ? 'Synchroniser avec Apple Calendar'
                                    : 'Sync with Apple Calendar'}
                                </div>
                              </div>
                            </div>
                            {selectedProvider === 'apple' && (
                              <Check className='w-5 h-5 text-koveo-navy' />
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
                            data-testid='option-other-calendar'
                          >
                            <div className='flex items-center gap-3'>
                              <div className='w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center text-white font-bold'>
                                ...
                              </div>
                              <div>
                                <div className='font-medium'>
                                  {language === 'fr' ? 'Autre calendrier' : 'Other calendar'}
                                </div>
                                <div className='text-sm text-gray-500'>
                                  {language === 'fr'
                                    ? 'Utiliser un fichier ICS ou autre'
                                    : 'Use ICS file or other'}
                                </div>
                              </div>
                            </div>
                            {selectedProvider === 'other' && (
                              <Check className='w-5 h-5 text-koveo-navy' />
                            )}
                          </div>

                          {selectedProvider && (
                            <div className='mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200'>
                              <div className='text-sm font-medium text-blue-900 mb-2'>
                                {language === 'fr' ? 'Configuration finale' : 'Final configuration'}
                              </div>
                              <div className='text-sm text-blue-700'>
                                {language === 'fr'
                                  ? `Prêt à lier ${selectedCalendarType === 'everything' ? `tous les ${visibleSpaces.size} espaces sélectionnés` : 'les espaces individuels'} avec ${
                                      selectedProvider === 'google'
                                        ? 'Google Calendar'
                                        : selectedProvider === 'outlook'
                                          ? 'Outlook Calendar'
                                          : selectedProvider === 'apple'
                                            ? 'Apple Calendar'
                                            : 'votre calendrier'
                                    }.`
                                  : `Ready to link ${selectedCalendarType === 'everything' ? `all ${visibleSpaces.size} selected spaces` : 'individual spaces'} with ${
                                      selectedProvider === 'google'
                                        ? 'Google Calendar'
                                        : selectedProvider === 'outlook'
                                          ? 'Outlook Calendar'
                                          : selectedProvider === 'apple'
                                            ? 'Apple Calendar'
                                            : 'your calendar'
                                    }.`}
                              </div>
                            </div>
                          )}

                          <div className='flex justify-between gap-2 mt-4'>
                            <Button
                              variant='outline'
                              onClick={() => {
                                setShowProviderStep(false);
                                setSelectedProvider(null);
                              }}
                              data-testid='button-back-step'
                            >
                              {language === 'fr' ? 'Retour' : 'Back'}
                            </Button>
                            <div className='flex gap-2'>
                              <Button
                                variant='outline'
                                onClick={() => {
                                  setIsLinkDialogOpen(false);
                                  setSelectedCalendarType(null);
                                  setShowProviderStep(false);
                                  setSelectedProvider(null);
                                }}
                                data-testid='button-cancel-provider'
                              >
                                {language === 'fr' ? 'Annuler' : 'Cancel'}
                              </Button>
                              <Button
                                onClick={() => {
                                  // Handle final calendar linking here
                                  console.log(
                                    `Linking ${selectedCalendarType} to ${selectedProvider} for spaces:`,
                                    Array.from(visibleSpaces)
                                  );
                                  handleLinkCalendar();
                                  setIsLinkDialogOpen(false);
                                  setSelectedCalendarType(null);
                                  setShowProviderStep(false);
                                  setSelectedProvider(null);
                                }}
                                disabled={!selectedProvider}
                                data-testid='button-confirm-final-link'
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
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleExportCalendar}
                  className='flex items-center gap-2'
                  data-testid='button-export-calendar'
                >
                  <Download className='w-4 h-4' />
                  {language === 'fr' ? 'Exporter' : 'Export'}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-4'>
              {/* Building Filter */}
              <div className='space-y-2'>
                <Label>{language === 'fr' ? 'Bâtiment' : 'Building'}</Label>
                <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
                  <SelectTrigger data-testid='select-building-filter'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>
                      {language === 'fr' ? 'Tous les bâtiments' : 'All buildings'}
                    </SelectItem>
                    {buildings.map((building) => (
                      <SelectItem key={building.id} value={building.id}>
                        {building.name} - {building.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className='space-y-2'>
                <Label>{language === 'fr' ? 'Rechercher un espace' : 'Search spaces'}</Label>
                <Input
                  type='text'
                  placeholder={language === 'fr' ? "Nom de l'espace..." : 'Space name...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid='input-search-spaces'
                />
              </div>

              {/* View Mode */}
              <div className='space-y-2'>
                <Label>{language === 'fr' ? 'Vue' : 'View'}</Label>
                <Select
                  value={viewMode}
                  onValueChange={(value: 'month' | 'week') => setViewMode(value)}
                >
                  <SelectTrigger data-testid='select-view-mode'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='month'>
                      {language === 'fr' ? 'Mensuelle' : 'Monthly'}
                    </SelectItem>
                    <SelectItem value='week'>
                      {language === 'fr' ? 'Hebdomadaire' : 'Weekly'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Space Visibility Controls */}
            <div className='flex items-center justify-between border-t pt-4'>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={showAllSpaces}
                  className='flex items-center gap-2'
                  data-testid='button-show-all'
                >
                  <Eye className='w-4 h-4' />
                  {language === 'fr' ? 'Tout afficher' : 'Show all'}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={hideAllSpaces}
                  className='flex items-center gap-2'
                  data-testid='button-hide-all'
                >
                  <EyeOff className='w-4 h-4' />
                  {language === 'fr' ? 'Tout masquer' : 'Hide all'}
                </Button>
              </div>
              <div className='text-sm text-gray-600'>
                {language === 'fr'
                  ? `${visibleSpaces.size} espace(s) affiché(s) sur ${filteredSpaces.length}`
                  : `${visibleSpaces.size} space(s) shown out of ${filteredSpaces.length}`}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Spaces List */}
        <Card className='mb-6'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Building className='w-5 h-5' />
              {language === 'fr' ? 'Espaces Communs' : 'Common Spaces'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
              {filteredSpaces.map((space) => {
                const isVisible = visibleSpaces.has(space.id);
                const building = buildings.find((b) => b.id === space.buildingId);

                return (
                  <div
                    key={space.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isVisible
                        ? 'border-blue-200 bg-blue-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleSpaceVisibility(space.id)}
                    data-testid={`space-card-${space.id}`}
                  >
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <h3 className='font-medium text-gray-900'>{space.name}</h3>
                        {building && (
                          <p className='text-xs text-gray-500 flex items-center gap-1 mt-1'>
                            <MapPin className='w-3 h-3' />
                            {building.name}
                          </p>
                        )}
                        {space.description && (
                          <p className='text-xs text-gray-600 mt-1'>{space.description}</p>
                        )}
                      </div>
                      <div className='flex items-center gap-2'>
                        {!space.isReservable && (
                          <Badge variant='secondary' className='text-xs'>
                            {language === 'fr' ? 'Non réservable' : 'Not bookable'}
                          </Badge>
                        )}
                        {isVisible ? (
                          <Eye className='w-4 h-4 text-blue-600' />
                        ) : (
                          <EyeOff className='w-4 h-4 text-gray-400' />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredSpaces.length === 0 && (
              <div className='text-center py-8 text-gray-500'>
                {language === 'fr'
                  ? 'Aucun espace trouvé avec les filtres sélectionnés.'
                  : 'No spaces found with the selected filters.'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendar Views */}
        {visibleSpaces.size > 0 && (
          <div className='space-y-6'>
            {Array.from(visibleSpaces).map((spaceId) => {
              const space = filteredSpaces.find((s) => s.id === spaceId);
              if (!space) {
                return null;
              }

              const building = buildings.find((b) => b.id === space.buildingId);

              return (
                <Card key={spaceId}>
                  <CardHeader>
                    <CardTitle className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <CalendarIcon className='w-5 h-5' />
                        <div>
                          <span>{space.name}</span>
                          {building && (
                            <span className='text-sm font-normal text-gray-500 ml-2'>
                              • {building.name}
                            </span>
                          )}
                        </div>
                      </div>
                      {!space.isReservable && (
                        <Badge variant='secondary'>
                          {language === 'fr' ? 'Non réservable' : 'Not bookable'}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CalendarView mode='space' spaceId={spaceId} buildingId={space.buildingId} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {visibleSpaces.size === 0 && (
          <Card>
            <CardContent className='text-center py-12'>
              <CalendarIcon className='w-16 h-16 mx-auto mb-4 text-gray-300' />
              <h3 className='text-lg font-medium text-gray-900 mb-2'>
                {language === 'fr' ? 'Aucun calendrier sélectionné' : 'No calendars selected'}
              </h3>
              <p className='text-gray-600 mb-4'>
                {language === 'fr'
                  ? 'Sélectionnez des espaces ci-dessus pour afficher leurs calendriers.'
                  : 'Select spaces above to display their calendars.'}
              </p>
              <Button
                onClick={showAllSpaces}
                disabled={filteredSpaces.length === 0}
                className='flex items-center gap-2'
                data-testid='button-show-all-bottom'
              >
                <Eye className='w-4 h-4' />
                {language === 'fr' ? 'Afficher tous les calendriers' : 'Show all calendars'}
              </Button>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}
