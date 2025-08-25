import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  MapPin
} from 'lucide-react';
import { CalendarView } from '@/components/common-spaces/calendar-view';

interface Building {
  id: string;
  name: string;
  address: string;
  city: string;
}

interface CommonSpace {
  id: string;
  name: string;
  description?: string;
  buildingId: string;
  buildingName?: string;
  isReservable: boolean;
  capacity?: number;
}

export default function DashboardCalendarPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [visibleSpaces, setVisibleSpaces] = useState<Set<string>>(new Set());

  // Fetch buildings accessible to the user
  const { data: buildingsResponse, isLoading: buildingsLoading } = useQuery<{buildings: Building[]}>({
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
      spaces = spaces.filter(space => space.buildingId === selectedBuildingId);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      spaces = spaces.filter(space => 
        space.name.toLowerCase().includes(query) ||
        space.description?.toLowerCase().includes(query) ||
        space.buildingName?.toLowerCase().includes(query)
      );
    }

    return spaces;
  }, [allSpaces, selectedBuildingId, searchQuery]);

  const toggleSpaceVisibility = (spaceId: string) => {
    setVisibleSpaces(prev => {
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
    setVisibleSpaces(new Set(filteredSpaces.map(space => space.id)));
  };

  const hideAllSpaces = () => {
    setVisibleSpaces(new Set());
  };

  const handleLinkCalendar = () => {
    // Get all visible spaces
    const visibleSpaceIds = Array.from(visibleSpaces);
    if (visibleSpaceIds.length === 0) {
      alert(language === 'fr' 
        ? 'Veuillez sélectionner au moins un espace à inclure dans le calendrier.' 
        : 'Please select at least one space to include in the calendar.');
      return;
    }

    // Create calendar link parameters
    const params = new URLSearchParams({
      spaces: visibleSpaceIds.join(','),
      view: viewMode,
      building: selectedBuildingId === 'all' ? '' : selectedBuildingId
    });
    
    const calendarUrl = `${window.location.origin}/dashboard/calendar?${params}`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(calendarUrl).then(() => {
      alert(language === 'fr' 
        ? 'Lien du calendrier copié dans le presse-papiers!' 
        : 'Calendar link copied to clipboard!');
    }).catch(() => {
      // Fallback: show the URL in a prompt
      prompt(language === 'fr' 
        ? 'Copiez ce lien de calendrier:' 
        : 'Copy this calendar link:', calendarUrl);
    });
  };

  const handleExportCalendar = () => {
    const visibleSpaceIds = Array.from(visibleSpaces);
    if (visibleSpaceIds.length === 0) {
      alert(language === 'fr' 
        ? 'Veuillez sélectionner au moins un espace à exporter.' 
        : 'Please select at least one space to export.');
      return;
    }

    // Create export URL
    const params = new URLSearchParams({
      spaces: visibleSpaceIds.join(','),
      format: 'ics'
    });
    
    const exportUrl = `/api/common-spaces/export?${params}`;
    window.open(exportUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="dashboard-calendar-page">
      <Header 
        title={language === 'fr' ? 'Calendrier des Espaces Communs' : 'Common Spaces Calendar'} 
        subtitle={language === 'fr' ? 'Vue d\'ensemble de tous les calendriers' : 'Overview of all calendars'}
      />
      
      <main className="container mx-auto px-4 py-8">
        {/* Filters and Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                {language === 'fr' ? 'Filtres et Options' : 'Filters and Options'}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLinkCalendar}
                  className="flex items-center gap-2"
                  data-testid="button-link-calendar"
                >
                  <ExternalLink className="w-4 h-4" />
                  {language === 'fr' ? 'Lier calendrier' : 'Link calendar'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCalendar}
                  className="flex items-center gap-2"
                  data-testid="button-export-calendar"
                >
                  <Download className="w-4 h-4" />
                  {language === 'fr' ? 'Exporter' : 'Export'}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Building Filter */}
              <div className="space-y-2">
                <Label>{language === 'fr' ? 'Bâtiment' : 'Building'}</Label>
                <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
                  <SelectTrigger data-testid="select-building-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
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
              <div className="space-y-2">
                <Label>{language === 'fr' ? 'Rechercher un espace' : 'Search spaces'}</Label>
                <Input
                  type="text"
                  placeholder={language === 'fr' ? 'Nom de l\'espace...' : 'Space name...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-spaces"
                />
              </div>

              {/* View Mode */}
              <div className="space-y-2">
                <Label>{language === 'fr' ? 'Vue' : 'View'}</Label>
                <Select value={viewMode} onValueChange={(value: 'month' | 'week') => setViewMode(value)}>
                  <SelectTrigger data-testid="select-view-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">
                      {language === 'fr' ? 'Mensuelle' : 'Monthly'}
                    </SelectItem>
                    <SelectItem value="week">
                      {language === 'fr' ? 'Hebdomadaire' : 'Weekly'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Space Visibility Controls */}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={showAllSpaces}
                  className="flex items-center gap-2"
                  data-testid="button-show-all"
                >
                  <Eye className="w-4 h-4" />
                  {language === 'fr' ? 'Tout afficher' : 'Show all'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={hideAllSpaces}
                  className="flex items-center gap-2"
                  data-testid="button-hide-all"
                >
                  <EyeOff className="w-4 h-4" />
                  {language === 'fr' ? 'Tout masquer' : 'Hide all'}
                </Button>
              </div>
              <div className="text-sm text-gray-600">
                {language === 'fr' 
                  ? `${visibleSpaces.size} espace(s) affiché(s) sur ${filteredSpaces.length}`
                  : `${visibleSpaces.size} space(s) shown out of ${filteredSpaces.length}`
                }
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Spaces List */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              {language === 'fr' ? 'Espaces Communs' : 'Common Spaces'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSpaces.map((space) => {
                const isVisible = visibleSpaces.has(space.id);
                const building = buildings.find(b => b.id === space.buildingId);
                
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
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{space.name}</h3>
                        {building && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {building.name}
                          </p>
                        )}
                        {space.description && (
                          <p className="text-xs text-gray-600 mt-1">{space.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!space.isReservable && (
                          <Badge variant="secondary" className="text-xs">
                            {language === 'fr' ? 'Non réservable' : 'Not bookable'}
                          </Badge>
                        )}
                        {isVisible ? (
                          <Eye className="w-4 h-4 text-blue-600" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {filteredSpaces.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {language === 'fr' 
                  ? 'Aucun espace trouvé avec les filtres sélectionnés.'
                  : 'No spaces found with the selected filters.'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendar Views */}
        {visibleSpaces.size > 0 && (
          <div className="space-y-6">
            {Array.from(visibleSpaces).map((spaceId) => {
              const space = filteredSpaces.find(s => s.id === spaceId);
              if (!space) return null;

              const building = buildings.find(b => b.id === space.buildingId);

              return (
                <Card key={spaceId}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5" />
                        <div>
                          <span>{space.name}</span>
                          {building && (
                            <span className="text-sm font-normal text-gray-500 ml-2">
                              • {building.name}
                            </span>
                          )}
                        </div>
                      </div>
                      {!space.isReservable && (
                        <Badge variant="secondary">
                          {language === 'fr' ? 'Non réservable' : 'Not bookable'}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CalendarView
                      mode="space"
                      spaceId={spaceId}
                      buildingId={space.buildingId}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {visibleSpaces.size === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <CalendarIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {language === 'fr' ? 'Aucun calendrier sélectionné' : 'No calendars selected'}
              </h3>
              <p className="text-gray-600 mb-4">
                {language === 'fr' 
                  ? 'Sélectionnez des espaces ci-dessus pour afficher leurs calendriers.'
                  : 'Select spaces above to display their calendars.'}
              </p>
              <Button
                onClick={showAllSpaces}
                disabled={filteredSpaces.length === 0}
                className="flex items-center gap-2"
                data-testid="button-show-all-bottom"
              >
                <Eye className="w-4 h-4" />
                {language === 'fr' ? 'Afficher tous les calendriers' : 'Show all calendars'}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}