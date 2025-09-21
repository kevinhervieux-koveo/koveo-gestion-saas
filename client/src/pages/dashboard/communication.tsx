import React, { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { UserNotificationPreference, InsertUserNotificationPreference } from '@shared/schemas/operations';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Bell,
  Settings,
  Save,
  RefreshCw,
  Volume2,
  VolumeX,
  Mail,
  Smartphone,
  Calendar,
  AlertTriangle,
  FileText,
  DollarSign,
  Wrench,
  Building,
  MessageSquare,
  Info,
  RotateCcw,
} from 'lucide-react';

// Notification type definitions with user-friendly labels and descriptions
interface NotificationTypeConfig {
  key: string;
  labelEn: string;
  labelFr: string;
  descriptionEn: string;
  descriptionFr: string;
  icon: React.ComponentType<any>;
  category: 'financial' | 'maintenance' | 'communication' | 'system';
  defaultFrequency: 'immediate' | 'weekly' | 'monthly' | 'quarterly' | 'bi-annually' | 'annually';
}

const notificationTypes: NotificationTypeConfig[] = [
  {
    key: 'bill_reminder',
    labelEn: 'Bill Reminders',
    labelFr: 'Rappels de factures',
    descriptionEn: 'Reminders about upcoming bill payments and deadlines',
    descriptionFr: 'Rappels concernant les paiements de factures à venir et les échéances',
    icon: DollarSign,
    category: 'financial',
    defaultFrequency: 'weekly',
  },
  {
    key: 'maintenance_update',
    labelEn: 'Maintenance Updates',
    labelFr: 'Mises à jour de maintenance',
    descriptionEn: 'Updates on maintenance requests and work progress',
    descriptionFr: 'Mises à jour sur les demandes de maintenance et l\'avancement des travaux',
    icon: Wrench,
    category: 'maintenance',
    defaultFrequency: 'immediate',
  },
  {
    key: 'announcement',
    labelEn: 'General Announcements',
    labelFr: 'Annonces générales',
    descriptionEn: 'Important announcements from building management',
    descriptionFr: 'Annonces importantes de la gestion de l\'immeuble',
    icon: Volume2,
    category: 'communication',
    defaultFrequency: 'immediate',
  },
  {
    key: 'system',
    labelEn: 'System Notifications',
    labelFr: 'Notifications système',
    descriptionEn: 'System updates, maintenance, and platform notifications',
    descriptionFr: 'Mises à jour système, maintenance et notifications de plateforme',
    icon: Settings,
    category: 'system',
    defaultFrequency: 'monthly',
  },
  {
    key: 'emergency',
    labelEn: 'Emergency Alerts',
    labelFr: 'Alertes d\'urgence',
    descriptionEn: 'Critical emergency notifications and safety alerts',
    descriptionFr: 'Notifications d\'urgence critiques et alertes de sécurité',
    icon: AlertTriangle,
    category: 'system',
    defaultFrequency: 'immediate',
  },
  {
    key: 'upcoming_payment',
    labelEn: 'Upcoming Payments',
    labelFr: 'Paiements à venir',
    descriptionEn: 'Notifications about payments due in the next few days',
    descriptionFr: 'Notifications concernant les paiements dus dans les prochains jours',
    icon: Calendar,
    category: 'financial',
    defaultFrequency: 'weekly',
  },
  {
    key: 'upcoming_bills',
    labelEn: 'New Bills Available',
    labelFr: 'Nouvelles factures disponibles',
    descriptionEn: 'Notifications when new bills are issued and available',
    descriptionFr: 'Notifications lors de l\'émission de nouvelles factures',
    icon: FileText,
    category: 'financial',
    defaultFrequency: 'immediate',
  },
  {
    key: 'bill_paid_last_month',
    labelEn: 'Payment Confirmations',
    labelFr: 'Confirmations de paiement',
    descriptionEn: 'Monthly summary of payments processed',
    descriptionFr: 'Résumé mensuel des paiements traités',
    icon: DollarSign,
    category: 'financial',
    defaultFrequency: 'monthly',
  },
  {
    key: 'bills_overdue',
    labelEn: 'Overdue Bills',
    labelFr: 'Factures en retard',
    descriptionEn: 'Notifications about overdue payments that need attention',
    descriptionFr: 'Notifications concernant les paiements en retard nécessitant une attention',
    icon: AlertTriangle,
    category: 'financial',
    defaultFrequency: 'weekly',
  },
  {
    key: 'payment_overdue',
    labelEn: 'Payment Overdue Alerts',
    labelFr: 'Alertes de paiement en retard',
    descriptionEn: 'Urgent notifications for significantly overdue payments',
    descriptionFr: 'Notifications urgentes pour les paiements significativement en retard',
    icon: AlertTriangle,
    category: 'financial',
    defaultFrequency: 'immediate',
  },
  {
    key: 'new_building_document',
    labelEn: 'New Documents',
    labelFr: 'Nouveaux documents',
    descriptionEn: 'Notifications when new building documents are uploaded',
    descriptionFr: 'Notifications lors du téléchargement de nouveaux documents de l\'immeuble',
    icon: FileText,
    category: 'communication',
    defaultFrequency: 'weekly',
  },
  {
    key: 'general_communication',
    labelEn: 'General Communications',
    labelFr: 'Communications générales',
    descriptionEn: 'General messages and updates from management',
    descriptionFr: 'Messages généraux et mises à jour de la gestion',
    icon: MessageSquare,
    category: 'communication',
    defaultFrequency: 'weekly',
  },
  {
    key: 'meeting_invite',
    labelEn: 'Meeting Invitations',
    labelFr: 'Invitations aux réunions',
    descriptionEn: 'Invitations to building meetings and assemblies',
    descriptionFr: 'Invitations aux réunions et assemblées de l\'immeuble',
    icon: Calendar,
    category: 'communication',
    defaultFrequency: 'immediate',
  },
  {
    key: 'maintenance_completed',
    labelEn: 'Maintenance Completed',
    labelFr: 'Maintenance terminée',
    descriptionEn: 'Notifications when maintenance work is completed',
    descriptionFr: 'Notifications lorsque les travaux de maintenance sont terminés',
    icon: Wrench,
    category: 'maintenance',
    defaultFrequency: 'immediate',
  },
  {
    key: 'budget_update',
    labelEn: 'Budget Updates',
    labelFr: 'Mises à jour du budget',
    descriptionEn: 'Updates about building budget and financial reports',
    descriptionFr: 'Mises à jour concernant le budget de l\'immeuble et les rapports financiers',
    icon: DollarSign,
    category: 'financial',
    defaultFrequency: 'quarterly',
  },
  {
    key: 'policy_change',
    labelEn: 'Policy Changes',
    labelFr: 'Changements de politique',
    descriptionEn: 'Important notifications about policy and regulation changes',
    descriptionFr: 'Notifications importantes concernant les changements de politique et de réglementation',
    icon: FileText,
    category: 'communication',
    defaultFrequency: 'immediate',
  },
  {
    key: 'seasonal_reminder',
    labelEn: 'Seasonal Reminders',
    labelFr: 'Rappels saisonniers',
    descriptionEn: 'Seasonal maintenance reminders and preparation notices',
    descriptionFr: 'Rappels de maintenance saisonnière et avis de préparation',
    icon: Info,
    category: 'maintenance',
    defaultFrequency: 'quarterly',
  },
];

// Frequency options - matching shared schema frequencyEnum
const frequencyOptions = [
  { value: 'immediate', labelEn: 'Immediate', labelFr: 'Immédiat' },
  { value: 'weekly', labelEn: 'Weekly', labelFr: 'Hebdomadaire' },
  { value: '2weeks', labelEn: 'Bi-weekly', labelFr: 'Bi-hebdomadaire' },
  { value: 'monthly', labelEn: 'Monthly', labelFr: 'Mensuel' },
  { value: 'quarterly', labelEn: 'Quarterly', labelFr: 'Trimestriel' },
  { value: 'bi-annually', labelEn: 'Bi-annually', labelFr: 'Bi-annuel' },
  { value: 'annually', labelEn: 'Annually', labelFr: 'Annuel' },
];

// Define the frequency type to match the shared schema
type FrequencyType = 'immediate' | 'weekly' | '2weeks' | 'monthly' | 'quarterly' | 'bi-annually' | 'annually';

// Use shared notification preference type from @shared/schemas
type NotificationPreference = UserNotificationPreference;

// Form schema matching shared schema types
const preferencesSchema = z.object({
  preferences: z.array(z.object({
    notificationType: z.string(),
    frequency: z.enum(['immediate', 'weekly', '2weeks', 'monthly', 'quarterly', 'bi-annually', 'annually']),
    isEnabled: z.boolean(),
  })),
});

// Helper function to ensure frequency is valid - moved outside component to prevent re-renders
const ensureValidFrequency = (frequency: string | undefined, defaultFreq: FrequencyType): FrequencyType => {
  const validFrequencies: FrequencyType[] = ['immediate', 'weekly', '2weeks', 'monthly', 'quarterly', 'bi-annually', 'annually'];
  return (frequency && validFrequencies.includes(frequency as FrequencyType)) 
    ? frequency as FrequencyType 
    : defaultFreq;
};

type PreferencesFormData = z.infer<typeof preferencesSchema>;

/**
 * Communication Dashboard Page
 * Provides comprehensive notification preferences management with bilingual support
 * and Quebec Law 25 compliance for privacy settings.
 */
export default function CommunicationDashboard() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkFrequency, setBulkFrequency] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const formInitializedRef = useRef(false);

  // Fetch current notification preferences
  const { data: preferences = [], isLoading, error } = useQuery<NotificationPreference[]>({
    queryKey: ['/api/communication/preferences'],
    enabled: !!user,
  });

  // No longer needed - moved outside component

  // Form setup with default values
  const form = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      preferences: notificationTypes.map(type => {
        const existing = preferences.find(p => p.notificationType === type.key);
        return {
          notificationType: type.key,
          frequency: ensureValidFrequency(existing?.frequency, type.defaultFrequency),
          isEnabled: existing?.isEnabled ?? true,
        };
      }),
    },
  });

  // Update form values when preferences are loaded - fixed to prevent form reset loop
  React.useEffect(() => {
    if (preferences.length > 0 && !formInitializedRef.current) {
      const formValues = notificationTypes.map(type => {
        const existing = preferences.find(p => p.notificationType === type.key);
        return {
          notificationType: type.key,
          frequency: ensureValidFrequency(existing?.frequency, type.defaultFrequency),
          isEnabled: existing?.isEnabled ?? true,
        };
      });
      
      form.reset({ preferences: formValues }, { keepDirty: false });
      setHasUnsavedChanges(false);
      formInitializedRef.current = true;
    }
  }, [preferences, form]); // Removed unstable ensureValidFrequency dependency

  // Track form changes
  React.useEffect(() => {
    const subscription = form.watch(() => {
      setHasUnsavedChanges(true);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Save preferences mutation - using apiRequest for proper error handling
  const saveMutation = useMutation({
    mutationFn: async (data: PreferencesFormData) => {
      const response = await apiRequest('PUT', '/api/communication/preferences', { 
        preferences: data.preferences 
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: language === 'fr' ? 'Préférences mises à jour' : 'Preferences updated',
        description: language === 'fr' 
          ? 'Vos préférences de notification ont été enregistrées avec succès.'
          : 'Your notification preferences have been saved successfully.',
      });
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ['/api/communication/preferences'] });
      // Reset form initialization flag in case user wants to reload
      formInitializedRef.current = false;
    },
    onError: (error: any) => {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: error.message || (language === 'fr' 
          ? 'Échec de la mise à jour des préférences'
          : 'Failed to update preferences'),
        variant: 'destructive',
      });
    },
  });

  // Bulk update function
  const handleBulkUpdate = (frequency: string) => {
    const currentValues = form.getValues();
    const updatedPreferences = currentValues.preferences.map(pref => ({
      ...pref,
      frequency: frequency as FrequencyType,
      isEnabled: true, // Keep all notifications enabled for bulk updates
    }));
    
    form.setValue('preferences', updatedPreferences);
    setHasUnsavedChanges(true);
    setShowBulkDialog(false);
    setBulkFrequency('');
  };

  // Reset form
  const handleReset = () => {
    form.reset(undefined, { keepDirty: false });
    setHasUnsavedChanges(false);
  };

  // Submit form - properly typed handler
  const onSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    form.handleSubmit((data: PreferencesFormData) => {
      saveMutation.mutate(data);
    })(e);
  };

  // Submit handler for direct form data
  const handleFormSubmit = (data: PreferencesFormData) => {
    saveMutation.mutate(data);
  };

  // Group notifications by category
  const groupedNotifications = notificationTypes.reduce((acc, type) => {
    if (!acc[type.category]) {
      acc[type.category] = [];
    }
    acc[type.category].push(type);
    return acc;
  }, {} as Record<string, NotificationTypeConfig[]>);

  const categoryLabels = {
    financial: { en: 'Financial', fr: 'Financier' },
    maintenance: { en: 'Maintenance', fr: 'Maintenance' },
    communication: { en: 'Communication', fr: 'Communication' },
    system: { en: 'System', fr: 'Système' },
  };

  const categoryIcons = {
    financial: DollarSign,
    maintenance: Wrench,
    communication: MessageSquare,
    system: Settings,
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden" data-testid="communication-page">
        <Header
          title={language === 'fr' ? 'Communication' : 'Communication'}
          subtitle={language === 'fr' 
            ? 'Gérez vos préférences de notification'
            : 'Manage your notification preferences'
          }
        />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden" data-testid="communication-page">
        <Header
          title={language === 'fr' ? 'Communication' : 'Communication'}
          subtitle={language === 'fr' 
            ? 'Gérez vos préférences de notification'
            : 'Manage your notification preferences'
          }
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardContent className="text-center py-6">
              <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {language === 'fr' ? 'Erreur de chargement' : 'Loading Error'}
              </h3>
              <p className="text-muted-foreground">
                {language === 'fr' 
                  ? 'Impossible de charger les préférences de notification.'
                  : 'Failed to load notification preferences.'
                }
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="communication-page">
      <Header
        title={language === 'fr' ? 'Communication' : 'Communication'}
        subtitle={language === 'fr' 
          ? 'Gérez vos préférences de notification'
          : 'Manage your notification preferences'
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Overview Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                {language === 'fr' ? 'Préférences de notification' : 'Notification Preferences'}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {language === 'fr'
                  ? 'Contrôlez comment et quand vous recevez des notifications pour différents types d\'événements.'
                  : 'Control how and when you receive notifications for different types of events.'
                }
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowBulkDialog(true)}
                    data-testid="button-bulk-update"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    {language === 'fr' ? 'Mise à jour en bloc' : 'Bulk Update'}
                  </Button>
                  
                  {hasUnsavedChanges && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />
                      {language === 'fr' ? 'Modifications non enregistrées' : 'Unsaved changes'}
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={!hasUnsavedChanges || saveMutation.isPending}
                    data-testid="button-reset-preferences"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {language === 'fr' ? 'Réinitialiser' : 'Reset'}
                  </Button>
                  
                  <Button
                    onClick={form.handleSubmit(handleFormSubmit)}
                    disabled={!hasUnsavedChanges || saveMutation.isPending}
                    data-testid="button-save-preferences"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saveMutation.isPending 
                      ? (language === 'fr' ? 'Enregistrement...' : 'Saving...')
                      : (language === 'fr' ? 'Enregistrer' : 'Save')
                    }
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Preferences Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
              {Object.entries(groupedNotifications).map(([category, types]) => {
                const CategoryIcon = categoryIcons[category as keyof typeof categoryIcons];
                const categoryLabel = categoryLabels[category as keyof typeof categoryLabels];
                
                return (
                  <Card key={category}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CategoryIcon className="w-5 h-5" />
                        {language === 'fr' ? categoryLabel.fr : categoryLabel.en}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {types.map((type, index) => {
                          const formIndex = notificationTypes.findIndex(nt => nt.key === type.key);
                          const IconComponent = type.icon;
                          
                          return (
                            <div key={type.key} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border rounded-lg">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="p-2 bg-muted rounded-lg shrink-0">
                                  <IconComponent className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium">
                                    {language === 'fr' ? type.labelFr : type.labelEn}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {language === 'fr' ? type.descriptionFr : type.descriptionEn}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-4 shrink-0">
                                <FormField
                                  control={form.control}
                                  name={`preferences.${formIndex}.isEnabled`}
                                  render={({ field }) => (
                                    <FormItem className="flex items-center gap-2">
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          data-testid={`switch-${type.key}-enabled`}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-sm">
                                        {language === 'fr' ? 'Activé' : 'Enabled'}
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                                
                                <FormField
                                  control={form.control}
                                  name={`preferences.${formIndex}.frequency`}
                                  render={({ field }) => (
                                    <FormItem className="w-40">
                                      <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        data-testid={`select-${type.key}-frequency`}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {frequencyOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                              {language === 'fr' ? option.labelFr : option.labelEn}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </form>
          </Form>

          {/* Quebec Law 25 Compliance Notice */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-1">
                    {language === 'fr' ? 'Conformité à la Loi 25 du Québec' : 'Quebec Law 25 Compliance'}
                  </p>
                  <p>
                    {language === 'fr'
                      ? 'Vos préférences de notification sont stockées de manière sécurisée et vous pouvez les modifier à tout moment. Ces données ne sont utilisées que pour vous envoyer les notifications demandées.'
                      : 'Your notification preferences are stored securely and you can modify them at any time. This data is only used to send you the requested notifications.'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bulk Update Dialog */}
      <AlertDialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <AlertDialogContent data-testid="dialog-bulk-update">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'fr' ? 'Mise à jour en bloc' : 'Bulk Update'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'fr'
                ? 'Définir la même fréquence pour toutes les notifications. Cela remplacera tous les paramètres actuels.'
                : 'Set the same frequency for all notifications. This will override all current settings.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <Select onValueChange={setBulkFrequency} data-testid="select-bulk-frequency">
              <SelectTrigger>
                <SelectValue placeholder={
                  language === 'fr' ? 'Sélectionner une fréquence' : 'Select frequency'
                } />
              </SelectTrigger>
              <SelectContent>
                {frequencyOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {language === 'fr' ? option.labelFr : option.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowBulkDialog(false);
                setBulkFrequency('');
              }}
              data-testid="button-cancel-bulk"
            >
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button
              onClick={() => handleBulkUpdate(bulkFrequency)}
              disabled={!bulkFrequency}
              data-testid="button-apply-bulk"
            >
              {language === 'fr' ? 'Appliquer' : 'Apply'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}