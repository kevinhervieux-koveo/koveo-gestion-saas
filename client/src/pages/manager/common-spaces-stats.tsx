import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Users, 
  Clock, 
  BarChart3,
  Ban,
  CheckCircle,
  User,
  TrendingUp,
  Calendar,
  Plus,
  Timer,
  CalendarDays,
  Eye,
  Edit
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CalendarView } from '@/components/common-spaces/calendar-view';
import { CommonSpaceCalendar } from '@/components/common-spaces/common-space-calendar';

/**
 * Building interface
 */
interface Building {
  id: string;
  name: string;
  address: string;
  city: string;
  organizationId: string;
}

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
}

/**
 * User stats interface
 */
interface UserStats {
  userId: string;
  userName: string;
  userEmail: string;
  totalHours: number;
  totalBookings: number;
}

/**
 * Summary stats interface
 */
interface SummaryStats {
  totalBookings: number;
  totalHours: number;
  uniqueUsers: number;
}

/**
 * Space stats response interface
 */
interface SpaceStatsResponse {
  spaceName: string;
  period: string;
  summary: SummaryStats;
  userStats: UserStats[];
}

/**
 * User restriction interface
 */
interface UserRestriction {
  userId: string;
  commonSpaceId: string;
  isBlocked: boolean;
  reason?: string;
}

/**
 * Role checking HOC component
 */
function withManagerAccess<P extends object>(Component: React.ComponentType<P>) {
  return function ManagerAccessComponent(props: P) {
    const { user } = useAuth();
    const { language } = useLanguage();

    if (!user || !['manager', 'admin'].includes(user.role)) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Card className="max-w-md w-full">
            <CardContent className="text-center py-12">
              <Ban className="w-16 h-16 mx-auto mb-4 text-red-500" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {language === 'fr' ? 'Accès refusé' : 'Access Denied'}
              </h2>
              <p className="text-gray-600">
                {language === 'fr' 
                  ? 'Vous devez être gestionnaire ou administrateur pour accéder à cette page.'
                  : 'You must be a manager or administrator to access this page.'}
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return <Component {...props} />;
  };
}

/**
 * Manager Common Spaces Statistics Page
 */
function CommonSpacesStatsPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [restrictionDialogOpen, setRestrictionDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
    building_id: '',
    is_reservable: true,
    capacity: '',
    hours_mode: 'same' as 'same' | 'custom',
    opening_hours: {
      start: '08:00',
      end: '22:00'
    },
    weekly_hours: {
      monday: { start: '08:00', end: '22:00' },
      tuesday: { start: '08:00', end: '22:00' },
      wednesday: { start: '08:00', end: '22:00' },
      thursday: { start: '08:00', end: '22:00' },
      friday: { start: '08:00', end: '22:00' },
      saturday: { start: '09:00', end: '21:00' },
      sunday: { start: '09:00', end: '21:00' }
    }
  });
  const [timeLimitDialogOpen, setTimeLimitDialogOpen] = useState(false);
  const [timeLimitFormData, setTimeLimitFormData] = useState({
    limit_type: 'monthly' as 'monthly' | 'yearly',
    limit_hours: '10',
    common_space_id: '',
  });

  // Fetch buildings accessible to the manager
  const { data: buildingsResponse, isLoading: buildingsLoading } = useQuery<{buildings: Building[]}>({
    queryKey: ['/api/manager/buildings'],
    enabled: !!user,
  });

  const buildings = buildingsResponse?.buildings || [];

  // Fetch common spaces for selected building
  const { data: commonSpaces = [], isLoading: spacesLoading } = useQuery<CommonSpace[]>({
    queryKey: ['/api/common-spaces', selectedBuildingId],
    queryFn: () => fetch(`/api/common-spaces?building_id=${selectedBuildingId}`).then(res => res.json()),
    enabled: !!selectedBuildingId,
  });

  // Fetch statistics for selected space
  const { data: spaceStats, isLoading: statsLoading } = useQuery<SpaceStatsResponse>({
    queryKey: ['/api/common-spaces', selectedSpaceId, 'stats'],
    queryFn: () => fetch(`/api/common-spaces/${selectedSpaceId}/stats`).then(res => res.json()),
    enabled: !!selectedSpaceId,
  });

  // Block/Unblock user mutation
  const toggleUserRestrictionMutation = useMutation({
    mutationFn: async ({ userId, isBlocked, reason }: { userId: string; isBlocked: boolean; reason?: string }) => {
      return apiRequest('POST', `/api/common-spaces/users/${userId}/restrictions`, {
        common_space_id: selectedSpaceId,
        is_blocked: isBlocked,
        reason: reason || '',
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/common-spaces', selectedSpaceId, 'stats'] });
      toast({
        title: language === 'fr' ? 'Restriction mise à jour' : 'Restriction Updated',
        description: variables.isBlocked 
          ? (language === 'fr' ? 'Utilisateur bloqué avec succès' : 'User blocked successfully')
          : (language === 'fr' ? 'Utilisateur débloqué avec succès' : 'User unblocked successfully'),
      });
      setRestrictionDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: error.message || 'Une erreur est survenue',
        variant: "destructive",
      });
    },
  });

  // Mutation to create or update a common space
  const createSpaceMutation = useMutation({
    mutationFn: async (spaceData: {
      name: string;
      description?: string;
      building_id: string;
      is_reservable: boolean;
      capacity?: number;
      opening_hours?: { start: string; end: string };
    }) => {
      if (isEditMode && selectedSpaceId) {
        return apiRequest('PUT', `/api/common-spaces/${selectedSpaceId}`, spaceData);
      } else {
        return apiRequest('POST', '/api/common-spaces', spaceData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/common-spaces'] });
      toast({
        title: language === 'fr' ? 'Succès' : 'Success',
        description: isEditMode 
          ? (language === 'fr' ? 'L\'espace commun a été modifié avec succès.' : 'Common space updated successfully.')
          : (language === 'fr' ? 'L\'espace commun a été créé avec succès.' : 'Common space created successfully.')
      });
      setCreateDialogOpen(false);
      setIsEditMode(false);
      setCreateFormData({
        name: '',
        description: '',
        building_id: '',
        is_reservable: true,
        capacity: '',
        hours_mode: 'same',
        opening_hours: {
          start: '08:00',
          end: '22:00'
        },
        weekly_hours: {
          monday: { start: '08:00', end: '22:00' },
          tuesday: { start: '08:00', end: '22:00' },
          wednesday: { start: '08:00', end: '22:00' },
          thursday: { start: '08:00', end: '22:00' },
          friday: { start: '08:00', end: '22:00' },
          saturday: { start: '09:00', end: '21:00' },
          sunday: { start: '09:00', end: '21:00' }
        }
      });
    },
    onError: (error) => {
      console.error('Error creating space:', error);
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: isEditMode
          ? (language === 'fr' ? 'Impossible de modifier l\'espace commun.' : 'Failed to update common space.')
          : (language === 'fr' ? 'Impossible de créer l\'espace commun.' : 'Failed to create common space.'),
        variant: 'destructive'
      });
    }
  });

  const handleCreateSpace = () => {
    if (!createFormData.name.trim() || !createFormData.building_id) {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr'
          ? 'Veuillez remplir tous les champs obligatoires.'
          : 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }

    const spaceData = {
      name: createFormData.name.trim(),
      description: createFormData.description.trim() || undefined,
      building_id: createFormData.building_id,
      is_reservable: createFormData.is_reservable,
      capacity: createFormData.capacity ? parseInt(createFormData.capacity) : undefined,
      opening_hours: createFormData.hours_mode === 'same' 
        ? (createFormData.opening_hours.start && createFormData.opening_hours.end 
           ? createFormData.opening_hours 
           : undefined)
        : createFormData.weekly_hours
    };

    createSpaceMutation.mutate(spaceData);
  };

  // Mutation to set user time limits
  const setTimeLimitMutation = useMutation({
    mutationFn: async (limitData: {
      user_id: string;
      limit_type: 'monthly' | 'yearly';
      limit_hours: number;
      common_space_id?: string;
    }) => {
      return apiRequest('POST', `/api/common-spaces/users/${limitData.user_id}/time-limits`, {
        user_id: limitData.user_id,
        limit_type: limitData.limit_type,
        limit_hours: limitData.limit_hours,
        common_space_id: limitData.common_space_id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/common-spaces', selectedSpaceId, 'stats'] });
      toast({
        title: language === 'fr' ? 'Succès' : 'Success',
        description: language === 'fr' 
          ? 'Limite de temps définie avec succès.' 
          : 'Time limit set successfully.'
      });
      setTimeLimitDialogOpen(false);
    },
    onError: (error) => {
      console.error('Error setting time limit:', error);
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr'
          ? 'Impossible de définir la limite de temps.'
          : 'Failed to set time limit.',
        variant: 'destructive'
      });
    }
  });

  const handleSetTimeLimit = () => {
    if (!selectedUser || !timeLimitFormData.limit_hours) {
      return;
    }

    const limitData = {
      user_id: selectedUser.userId,
      limit_type: timeLimitFormData.limit_type,
      limit_hours: parseInt(timeLimitFormData.limit_hours),
      common_space_id: timeLimitFormData.common_space_id || undefined
    };

    setTimeLimitMutation.mutate(limitData);
  };

  // Reset space selection when building changes
  useEffect(() => {
    setSelectedSpaceId('');
  }, [selectedBuildingId]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!spaceStats?.userStats) return [];
    
    return spaceStats.userStats.slice(0, 10).map(user => ({
      name: user.userName,
      hours: Math.round(user.totalHours * 10) / 10,
      bookings: user.totalBookings,
    }));
  }, [spaceStats]);

  const handleToggleRestriction = (user: UserStats, isBlocked: boolean) => {
    setSelectedUser(user);
    setRestrictionDialogOpen(true);
    
    const reason = isBlocked 
      ? 'Accès restreint par le gestionnaire'
      : '';
    
    toggleUserRestrictionMutation.mutate({
      userId: user.userId,
      isBlocked,
      reason,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="common-spaces-stats-page">
      <Header 
        title={language === 'fr' ? 'Gestion Espaces Communs' : 'Manage Common Spaces'} 
        subtitle={language === 'fr' ? 'Statistiques et gestion des utilisateurs' : 'Statistics and user management'}
      />
      
      <main className="container mx-auto px-4 py-8">
        {/* Filters Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                {language === 'fr' ? 'Sélection' : 'Selection'}
              </div>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="default" size="sm" className="flex items-center gap-2" data-testid="button-create-space">
                    <Plus className="w-4 h-4" />
                    {language === 'fr' ? 'Créer un espace' : 'Create Space'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>
                      {isEditMode 
                        ? (language === 'fr' ? 'Modifier l\'espace commun' : 'Edit Common Space')
                        : (language === 'fr' ? 'Créer un nouvel espace commun' : 'Create New Common Space')
                      }
                    </DialogTitle>
                    <DialogDescription>
                      {isEditMode
                        ? (language === 'fr' 
                          ? 'Modifiez les détails de cet espace partagé.'
                          : 'Edit the details of this shared space.')
                        : (language === 'fr' 
                          ? 'Ajoutez un nouvel espace partagé pour les résidents de ce bâtiment.'
                          : 'Add a new shared space for residents in this building.')
                      }
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="space-name">{language === 'fr' ? 'Nom de l\'espace' : 'Space Name'} *</Label>
                      <Input
                        id="space-name"
                        type="text"
                        placeholder={language === 'fr' ? 'ex: Salle de réunion' : 'e.g. Meeting Room'}
                        value={createFormData.name}
                        onChange={(e) => setCreateFormData({...createFormData, name: e.target.value})}
                        data-testid="input-space-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="space-description">{language === 'fr' ? 'Description' : 'Description'}</Label>
                      <Textarea
                        id="space-description"
                        placeholder={language === 'fr' ? 'Description optionnelle de l\'espace' : 'Optional description of the space'}
                        value={createFormData.description}
                        onChange={(e) => setCreateFormData({...createFormData, description: e.target.value})}
                        data-testid="textarea-space-description"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="space-building">{language === 'fr' ? 'Bâtiment' : 'Building'} *</Label>
                      <Select 
                        value={createFormData.building_id} 
                        onValueChange={(value) => setCreateFormData({...createFormData, building_id: value})}
                      >
                        <SelectTrigger data-testid="select-space-building">
                          <SelectValue placeholder={language === 'fr' ? 'Sélectionnez un bâtiment' : 'Select a building'} />
                        </SelectTrigger>
                        <SelectContent>
                          {buildings.map((building) => (
                            <SelectItem key={building.id} value={building.id}>
                              {building.name} - {building.address}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="space-capacity">{language === 'fr' ? 'Capacité' : 'Capacity'}</Label>
                        <Input
                          id="space-capacity"
                          type="number"
                          placeholder="20"
                          value={createFormData.capacity}
                          onChange={(e) => setCreateFormData({...createFormData, capacity: e.target.value})}
                          data-testid="input-space-capacity"
                        />
                      </div>

                      <div className="space-y-2 flex items-end">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="space-reservable"
                            checked={createFormData.is_reservable}
                            onCheckedChange={(checked) => setCreateFormData({...createFormData, is_reservable: checked === true})}
                            data-testid="checkbox-space-reservable"
                          />
                          <Label htmlFor="space-reservable" className="text-sm">
                            {language === 'fr' ? 'Réservable' : 'Bookable'}
                          </Label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label>{language === 'fr' ? 'Heures d\'ouverture' : 'Opening Hours'}</Label>
                      
                      {/* Hours Mode Selection */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="hours-same"
                              name="hours-mode"
                              value="same"
                              checked={createFormData.hours_mode === 'same'}
                              onChange={(e) => setCreateFormData({...createFormData, hours_mode: 'same'})}
                              className="w-4 h-4 text-blue-600"
                              data-testid="radio-hours-same"
                            />
                            <Label htmlFor="hours-same" className="text-sm">
                              {language === 'fr' ? 'Mêmes heures tous les jours' : 'Same hours every day'}
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="hours-custom"
                              name="hours-mode"
                              value="custom"
                              checked={createFormData.hours_mode === 'custom'}
                              onChange={(e) => setCreateFormData({...createFormData, hours_mode: 'custom'})}
                              className="w-4 h-4 text-blue-600"
                              data-testid="radio-hours-custom"
                            />
                            <Label htmlFor="hours-custom" className="text-sm">
                              {language === 'fr' ? 'Heures personnalisées par jour' : 'Custom hours per day'}
                            </Label>
                          </div>
                        </div>

                        {createFormData.hours_mode === 'same' ? (
                          // Same hours for all days
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label htmlFor="opening-start" className="text-xs text-gray-500">
                                {language === 'fr' ? 'Ouverture' : 'Start'}
                              </Label>
                              <Input
                                id="opening-start"
                                type="time"
                                value={createFormData.opening_hours.start}
                                onChange={(e) => setCreateFormData({
                                  ...createFormData,
                                  opening_hours: {...createFormData.opening_hours, start: e.target.value}
                                })}
                                data-testid="input-opening-start"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="opening-end" className="text-xs text-gray-500">
                                {language === 'fr' ? 'Fermeture' : 'End'}
                              </Label>
                              <Input
                                id="opening-end"
                                type="time"
                                value={createFormData.opening_hours.end}
                                onChange={(e) => setCreateFormData({
                                  ...createFormData,
                                  opening_hours: {...createFormData.opening_hours, end: e.target.value}
                                })}
                                data-testid="input-opening-end"
                              />
                            </div>
                          </div>
                        ) : (
                          // Custom hours per day
                          <div className="space-y-3 max-h-64 overflow-y-auto">
                            {Object.entries(createFormData.weekly_hours).map(([day, hours]) => {
                              const dayLabels = {
                                monday: language === 'fr' ? 'Lundi' : 'Monday',
                                tuesday: language === 'fr' ? 'Mardi' : 'Tuesday', 
                                wednesday: language === 'fr' ? 'Mercredi' : 'Wednesday',
                                thursday: language === 'fr' ? 'Jeudi' : 'Thursday',
                                friday: language === 'fr' ? 'Vendredi' : 'Friday',
                                saturday: language === 'fr' ? 'Samedi' : 'Saturday',
                                sunday: language === 'fr' ? 'Dimanche' : 'Sunday'
                              };
                              
                              return (
                                <div key={day} className="grid grid-cols-3 gap-3 items-center">
                                  <Label className="text-sm font-medium w-20">
                                    {dayLabels[day as keyof typeof dayLabels]}
                                  </Label>
                                  <Input
                                    type="time"
                                    value={hours.start}
                                    onChange={(e) => setCreateFormData({
                                      ...createFormData,
                                      weekly_hours: {
                                        ...createFormData.weekly_hours,
                                        [day]: {...hours, start: e.target.value}
                                      }
                                    })}
                                    data-testid={`input-${day}-start`}
                                  />
                                  <Input
                                    type="time"
                                    value={hours.end}
                                    onChange={(e) => setCreateFormData({
                                      ...createFormData,
                                      weekly_hours: {
                                        ...createFormData.weekly_hours,
                                        [day]: {...hours, end: e.target.value}
                                      }
                                    })}
                                    data-testid={`input-${day}-end`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => setCreateDialogOpen(false)}
                      data-testid="button-cancel-create"
                    >
                      {language === 'fr' ? 'Annuler' : 'Cancel'}
                    </Button>
                    <Button 
                      onClick={handleCreateSpace}
                      disabled={createSpaceMutation.isPending || !createFormData.name.trim() || !createFormData.building_id}
                      data-testid="button-confirm-create"
                    >
                      {createSpaceMutation.isPending 
                        ? (language === 'fr' ? 'Création...' : 'Creating...')
                        : (language === 'fr' ? 'Créer l\'espace' : 'Create Space')
                      }
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" data-testid="building-select-label">
                  {language === 'fr' ? 'Bâtiment' : 'Building'}
                </label>
                <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
                  <SelectTrigger data-testid="building-select">
                    <SelectValue placeholder={language === 'fr' ? 'Sélectionnez un bâtiment' : 'Select a building'} />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map((building) => (
                      <SelectItem key={building.id} value={building.id}>
                        {building.name} - {building.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" data-testid="space-select-label">
                  {language === 'fr' ? 'Espace commun' : 'Common Space'}
                </label>
                <Select 
                  value={selectedSpaceId} 
                  onValueChange={setSelectedSpaceId}
                  disabled={!selectedBuildingId || spacesLoading}
                >
                  <SelectTrigger data-testid="space-select">
                    <SelectValue placeholder={language === 'fr' ? 'Sélectionnez un espace' : 'Select a space'} />
                  </SelectTrigger>
                  <SelectContent>
                    {commonSpaces.map((space) => (
                      <SelectItem key={space.id} value={space.id}>
                        {space.name}
                        {!space.isReservable && (
                          <Badge variant="secondary" className="ml-2">
                            {language === 'fr' ? 'Non réservable' : 'Not bookable'}
                          </Badge>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="stats" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="grid grid-cols-2 max-w-md">
              <TabsTrigger value="stats" className="flex items-center gap-2" data-testid="tab-stats">
                <BarChart3 className="h-4 w-4" />
                {language === 'fr' ? 'Statistiques' : 'Statistics'}
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-2" data-testid="tab-calendar">
                <CalendarDays className="h-4 w-4" />
                {language === 'fr' ? 'Calendrier' : 'Calendar'}
              </TabsTrigger>
            </TabsList>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-2"
              disabled={!selectedSpaceId}
              onClick={() => {
                if (selectedSpaceId) {
                  // Find the selected space details
                  const selectedSpace = commonSpaces.find(s => s.id === selectedSpaceId);
                  if (selectedSpace) {
                    setCreateFormData({
                      name: selectedSpace.name,
                      description: selectedSpace.description || '',
                      building_id: selectedBuildingId,
                      is_reservable: selectedSpace.isReservable,
                      capacity: selectedSpace.capacity?.toString() || '',
                      hours_mode: 'same',
                      opening_hours: {
                        start: '08:00',
                        end: '22:00'
                      },
                      weekly_hours: {
                        monday: { start: '08:00', end: '22:00' },
                        tuesday: { start: '08:00', end: '22:00' },
                        wednesday: { start: '08:00', end: '22:00' },
                        thursday: { start: '08:00', end: '22:00' },
                        friday: { start: '08:00', end: '22:00' },
                        saturday: { start: '09:00', end: '21:00' },
                        sunday: { start: '09:00', end: '21:00' }
                      }
                    });
                    setIsEditMode(true);
                    setCreateDialogOpen(true);
                  }
                }
              }}
              data-testid="button-edit-space"
            >
              <Edit className="h-4 w-4" />
              {language === 'fr' ? 'Modifier' : 'Edit'}
            </Button>
          </div>

          <TabsContent value="stats" className="space-y-6">
            {spaceStats && (
              <>
                {/* Summary Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600" data-testid="total-bookings-label">
                        {language === 'fr' ? 'Réservations totales' : 'Total Bookings'}
                      </p>
                      <p className="text-2xl font-bold text-gray-900" data-testid="total-bookings-value">
                        {spaceStats.summary.totalBookings}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600" data-testid="total-hours-label">
                        {language === 'fr' ? 'Heures totales' : 'Total Hours'}
                      </p>
                      <p className="text-2xl font-bold text-gray-900" data-testid="total-hours-value">
                        {Math.round(spaceStats.summary.totalHours * 10) / 10}h
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600" data-testid="unique-users-label">
                        {language === 'fr' ? 'Utilisateurs uniques' : 'Unique Users'}
                      </p>
                      <p className="text-2xl font-bold text-gray-900" data-testid="unique-users-value">
                        {spaceStats.summary.uniqueUsers}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Usage Chart */}
            {chartData.length > 0 && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    {language === 'fr' ? 'Top 10 utilisateurs par heures' : 'Top 10 Users by Hours'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80" data-testid="usage-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="name" 
                          angle={-45}
                          textAnchor="end"
                          height={100}
                        />
                        <YAxis />
                        <Tooltip 
                          formatter={(value, name) => [
                            value,
                            name === 'hours' 
                              ? (language === 'fr' ? 'Heures' : 'Hours')
                              : (language === 'fr' ? 'Réservations' : 'Bookings')
                          ]}
                        />
                        <Legend 
                          formatter={(value) => 
                            value === 'hours' 
                              ? (language === 'fr' ? 'Heures' : 'Hours')
                              : (language === 'fr' ? 'Réservations' : 'Bookings')
                          }
                        />
                        <Bar dataKey="hours" fill="#3b82f6" name="hours" />
                        <Bar dataKey="bookings" fill="#10b981" name="bookings" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Users Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {language === 'fr' ? 'Statistiques des utilisateurs' : 'User Statistics'}
                </CardTitle>
                <p className="text-sm text-gray-600">
                  {spaceStats.period} - {spaceStats.spaceName}
                </p>
              </CardHeader>
              <CardContent>
                {spaceStats.userStats.length > 0 ? (
                  <Table data-testid="users-stats-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{language === 'fr' ? 'Utilisateur' : 'User'}</TableHead>
                        <TableHead>{language === 'fr' ? 'Email' : 'Email'}</TableHead>
                        <TableHead className="text-right">{language === 'fr' ? 'Heures totales' : 'Total Hours'}</TableHead>
                        <TableHead className="text-right">{language === 'fr' ? 'Réservations' : 'Bookings'}</TableHead>
                        <TableHead className="text-center">{language === 'fr' ? 'Actions' : 'Actions'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {spaceStats.userStats.map((userStat) => (
                        <TableRow key={userStat.userId} data-testid={`user-row-${userStat.userId}`}>
                          <TableCell className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">{userStat.userName}</span>
                          </TableCell>
                          <TableCell className="text-gray-600">{userStat.userEmail}</TableCell>
                          <TableCell className="text-right font-mono">
                            {Math.round(userStat.totalHours * 10) / 10}h
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {userStat.totalBookings}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex gap-2 justify-center">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleToggleRestriction(userStat, true)}
                                disabled={toggleUserRestrictionMutation.isPending}
                                data-testid={`button-block-${userStat.userId}`}
                              >
                                <Ban className="w-4 h-4 mr-1" />
                                {language === 'fr' ? 'Bloquer' : 'Block'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleRestriction(userStat, false)}
                                disabled={toggleUserRestrictionMutation.isPending}
                                data-testid={`button-unblock-${userStat.userId}`}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                {language === 'fr' ? 'Débloquer' : 'Unblock'}
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(userStat);
                                  setTimeLimitFormData({
                                    limit_type: 'monthly',
                                    limit_hours: '10',
                                    common_space_id: selectedSpaceId
                                  });
                                  setTimeLimitDialogOpen(true);
                                }}
                                data-testid={`button-time-limit-${userStat.userId}`}
                              >
                                <Timer className="w-4 h-4 mr-1" />
                                {language === 'fr' ? 'Limite' : 'Limit'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12" data-testid="no-stats-message">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {language === 'fr' ? 'Aucune donnée disponible' : 'No Data Available'}
                    </h3>
                    <p className="text-gray-600">
                      {language === 'fr' 
                        ? 'Aucune réservation trouvée pour cet espace au cours des 12 derniers mois.'
                        : 'No bookings found for this space in the last 12 months.'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {!selectedSpaceId && (
          <Card>
            <CardContent className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {language === 'fr' ? 'Sélectionnez un espace commun' : 'Select a Common Space'}
              </h3>
              <p className="text-gray-600">
                {language === 'fr' 
                  ? 'Choisissez un bâtiment et un espace commun pour voir les statistiques d\'utilisation.'
                  : 'Choose a building and common space to view usage statistics.'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Time Limit Dialog */}
        <Dialog open={timeLimitDialogOpen} onOpenChange={setTimeLimitDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {language === 'fr' ? 'Définir la limite de temps' : 'Set Time Limit'}
              </DialogTitle>
              <DialogDescription>
                {language === 'fr' 
                  ? `Définir une limite de réservation pour ${selectedUser?.userName}`
                  : `Set booking time limit for ${selectedUser?.userName}`}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="limit-type">{language === 'fr' ? 'Type de limite' : 'Limit Type'}</Label>
                <Select 
                  value={timeLimitFormData.limit_type} 
                  onValueChange={(value: 'monthly' | 'yearly') => 
                    setTimeLimitFormData({...timeLimitFormData, limit_type: value})
                  }
                >
                  <SelectTrigger data-testid="select-limit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">
                      {language === 'fr' ? 'Mensuelle' : 'Monthly'}
                    </SelectItem>
                    <SelectItem value="yearly">
                      {language === 'fr' ? 'Annuelle' : 'Yearly'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="limit-hours">
                  {language === 'fr' ? 'Limite en heures' : 'Hour Limit'}
                </Label>
                <Input
                  id="limit-hours"
                  type="number"
                  min="1"
                  max="8760"
                  placeholder="10"
                  value={timeLimitFormData.limit_hours}
                  onChange={(e) => setTimeLimitFormData({
                    ...timeLimitFormData, 
                    limit_hours: e.target.value
                  })}
                  data-testid="input-limit-hours"
                />
                <p className="text-xs text-gray-500">
                  {language === 'fr' 
                    ? `Limite ${timeLimitFormData.limit_type === 'monthly' ? 'mensuelle' : 'annuelle'} en heures`
                    : `${timeLimitFormData.limit_type === 'monthly' ? 'Monthly' : 'Yearly'} limit in hours`}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="limit-scope">{language === 'fr' ? 'Portée' : 'Scope'}</Label>
                <Select 
                  value={timeLimitFormData.common_space_id} 
                  onValueChange={(value) => 
                    setTimeLimitFormData({...timeLimitFormData, common_space_id: value})
                  }
                >
                  <SelectTrigger data-testid="select-limit-scope">
                    <SelectValue placeholder={language === 'fr' ? 'Sélectionnez la portée' : 'Select scope'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">
                      {language === 'fr' ? 'Tous les espaces' : 'All spaces'}
                    </SelectItem>
                    <SelectItem value={selectedSpaceId}>
                      {language === 'fr' ? 'Cet espace uniquement' : 'This space only'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setTimeLimitDialogOpen(false)}
                data-testid="button-cancel-time-limit"
              >
                {language === 'fr' ? 'Annuler' : 'Cancel'}
              </Button>
              <Button 
                onClick={handleSetTimeLimit}
                disabled={setTimeLimitMutation.isPending || !timeLimitFormData.limit_hours}
                data-testid="button-confirm-time-limit"
              >
                {setTimeLimitMutation.isPending 
                  ? (language === 'fr' ? 'Application...' : 'Setting...')
                  : (language === 'fr' ? 'Appliquer la limite' : 'Set Limit')
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  {language === 'fr' ? 'Vue Calendrier Manager' : 'Manager Calendar View'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedSpaceId ? (
                  <div className="p-0">
                    <CommonSpaceCalendar
                      space={{
                        id: selectedSpaceId,
                        name: commonSpaces.find(s => s.id === selectedSpaceId)?.name || 'Espace sélectionné',
                        isReservable: false
                      }}
                      className="border-0 shadow-none bg-transparent p-0"
                    />
                  </div>
                ) : selectedBuildingId ? (
                  <CalendarView
                    mode="building"
                    buildingId={selectedBuildingId}
                    showControls={true}
                    onEventClick={(event) => {
                      console.log('Manager viewing building event:', event);
                    }}
                    data-testid="manager-building-calendar-view"
                  />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarDays className="h-16 w-16 mx-auto mb-4 opacity-20" />
                    <h3 className="text-lg font-medium mb-2">
                      {language === 'fr' ? 'Sélectionnez un espace ou un bâtiment' : 'Select a space or building'}
                    </h3>
                    <p>
                      {language === 'fr' 
                        ? 'Choisissez un bâtiment ou un espace spécifique pour voir son calendrier de réservations avec les détails complets'
                        : 'Choose a building or specific space to view its booking calendar with full details'
                      }
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// Export the component wrapped with access control
export default withManagerAccess(CommonSpacesStatsPage);