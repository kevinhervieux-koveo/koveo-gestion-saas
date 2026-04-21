/**
 * Notification Configurations Components
 * Comprehensive UI for managing automated seasonal reminders and general announcements
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
import { format, parseISO } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { insertNotificationConfigurationSchema } from '@shared/schemas/operations';
import type { NotificationConfiguration, InsertNotificationConfiguration } from '@shared/schemas/operations';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  AlertDialogTrigger,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

// Icons
import {
  Settings,
  Plus,
  Edit,
  Trash2,
  CalendarIcon,
  Clock,
  User,
  Building,
  Bell,
  Repeat,
  Calendar as CalendarBellIcon,
  Megaphone,
  Eye,
  Copy,
  Filter,
  RotateCcw,
} from 'lucide-react';

// Types and interfaces
interface BuildingsResponse {
  buildings: { id: string; name: string; address: string }[];
}

interface OrganizationsResponse {
  organizations: { id: string; name: string }[];
  userRole?: string;
  canAccessAll?: boolean;
}

interface OrganizationContext {
  id: string;
  name: string;
  canSendToAllOrganizations: boolean;
}

interface OrganizationOption {
  id: string;
  name: string;
}

// Enhanced notification configuration with user and building details
interface NotificationConfigurationWithDetails extends NotificationConfiguration {
  createdByName?: string;
  buildingName?: string;
}

// Notification types configuration
const notificationTypes = [
  {
    value: 'seasonal_reminder',
    labelEn: 'Seasonal Reminder',
    labelFr: 'Rappel saisonnier',
    descriptionEn: 'Recurring seasonal maintenance or preparation reminders',
    descriptionFr: 'Rappels récurrents de maintenance ou de préparation saisonnière',
    icon: CalendarBellIcon,
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    defaultFrequency: 'annually' as const,
  },
  {
    value: 'announcement',
    labelEn: 'General Announcement',
    labelFr: 'Annonce générale',
    descriptionEn: 'Important announcements and communications to residents',
    descriptionFr: 'Annonces importantes et communications aux résidents',
    icon: Megaphone,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    defaultFrequency: 'monthly' as const,
  },
] as const;

// Frequency options - matching the schema enum
const frequencyOptions = [
  { value: 'unique', labelEn: 'One-time', labelFr: 'Une fois', descriptionEn: 'Send notification once within a date range', descriptionFr: 'Envoyer une notification une fois dans une plage de dates' },
  { value: 'weekly', labelEn: 'Weekly', labelFr: 'Hebdomadaire' },
  { value: 'bi_weekly', labelEn: 'Bi-weekly', labelFr: 'Bi-hebdomadaire' },
  { value: 'monthly', labelEn: 'Monthly', labelFr: 'Mensuel' },
  { value: 'quarterly', labelEn: 'Quarterly', labelFr: 'Trimestriel' },
  { value: 'bi-annually', labelEn: 'Bi-annually', labelFr: 'Bi-annuel' },
  { value: 'annually', labelEn: 'Annually', labelFr: 'Annuel' },
] as const;

// Create form schema based on shared schema with UI-specific validation
const configurationFormSchema = z.object({
  organizationId: z.string().min(1, 'Organization is required'),
  buildingId: z.string().min(1, 'Building is required'),
  type: z.enum(['seasonal_reminder', 'announcement']),
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  message: z.string().min(1, 'Message is required').max(2000, 'Message must be 2000 characters or less'),
  frequency: z.enum(['unique', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'bi-annually', 'annually']),
  startDate: z.coerce.date(),
  isActive: z.boolean().default(true),
  endsAt: z.coerce.date().optional(),
  timezone: z.string().optional(),
}).refine((data) => {
  if (data.endsAt && data.startDate) {
    return data.endsAt >= data.startDate;
  }
  return true;
}, {
  message: 'End date must be on or after the start date',
  path: ['endsAt'],
});

type ConfigurationFormData = z.infer<typeof configurationFormSchema>;

/**
 * Configuration Card Component - Displays individual notification configuration
 */
function ConfigurationCard({
  config,
  onEdit,
  onDelete,
  onPreview,
  language,
}: {
  config: NotificationConfigurationWithDetails;
  onEdit: (config: NotificationConfiguration) => void;
  onDelete: (config: NotificationConfiguration) => void;
  onPreview: (config: NotificationConfiguration) => void;
  language: 'en' | 'fr';
}) {
  const typeConfig = notificationTypes.find(t => t.value === config.type);
  const frequencyConfig = frequencyOptions.find(f => f.value === config.frequency);
  const IconComponent = typeConfig?.icon || Bell;

  return (
    <Card className="relative group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={`p-2 rounded-lg ${typeConfig?.color || 'bg-gray-100 text-gray-700'}`}>
              <IconComponent className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg truncate" data-testid={`text-config-title-${config.id}`}>
                  {config.title}
                </CardTitle>
                <Badge
                  variant={config.isActive ? 'default' : 'secondary'}
                  data-testid={`badge-status-${config.id}`}
                >
                  {config.isActive 
                    ? (language === 'en' ? 'Active' : 'Actif')
                    : (language === 'en' ? 'Inactive' : 'Inactif')
                  }
                </Badge>
                <Badge variant="outline" data-testid={`badge-type-${config.id}`}>
                  {typeConfig ? (language === 'en' ? typeConfig.labelEn : typeConfig.labelFr) : config.type}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {config.buildingName || config.buildingId}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPreview(config)}
              data-testid={`button-preview-${config.id}`}
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(config)}
              data-testid={`button-edit-${config.id}`}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid={`button-delete-${config.id}`}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent data-testid={`dialog-delete-${config.id}`}>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {language === 'en' ? 'Delete Configuration' : 'Supprimer la configuration'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {language === 'en' 
                      ? `Are you sure you want to delete "${config.title}"? This action cannot be undone.`
                      : `Êtes-vous sûr de vouloir supprimer "${config.title}" ? Cette action ne peut pas être annulée.`
                    }
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid={`button-cancel-delete-${config.id}`}>
                    {language === 'en' ? 'Cancel' : 'Annuler'}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(config)}
                    className="bg-red-600 hover:bg-red-700"
                    data-testid={`button-confirm-delete-${config.id}`}
                  >
                    {language === 'en' ? 'Delete' : 'Supprimer'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2" data-testid={`text-message-${config.id}`}>
            {config.message}
          </p>
          
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Repeat className="w-3 h-3" />
              <span data-testid={`text-frequency-${config.id}`}>
                {frequencyConfig ? (language === 'en' ? frequencyConfig.labelEn : frequencyConfig.labelFr) : config.frequency}
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" />
              <span data-testid={`text-start-date-${config.id}`}>
                {language === 'en' ? 'Starts:' : 'Commence:'} {format(parseISO(config.startDate as any), 'MMM d, yyyy', { locale: language === 'en' ? enUS : fr })}
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span data-testid={`text-created-by-${config.id}`}>
                {config.createdByName || config.createdBy}
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span data-testid={`text-created-at-${config.id}`}>
                {format(parseISO(config.createdAt as any), 'MMM d, yyyy', { locale: language === 'en' ? enUS : fr })}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Configuration Form Component - Handles create and edit operations
 */
function ConfigurationForm({
  config,
  onSuccess,
  onCancel,
  language,
}: {
  config?: NotificationConfiguration;
  onSuccess: () => void;
  onCancel: () => void;
  language: 'en' | 'fr';
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isEditing = !!config;

  // Fetch user's organizations using the same endpoint as the rest of the
  // communication page so both dropdowns are populated consistently and
  // honor the same access rules.
  const { data: organizationsResponse } = useQuery<OrganizationsResponse>({
    queryKey: ['/api/communication/organizations'],
    enabled: !!user,
  });
  const organizations: OrganizationOption[] = organizationsResponse?.organizations ?? [];

  const form = useForm({
    resolver: zodResolver(configurationFormSchema),
    defaultValues: {
      organizationId: config?.organizationId || '',
      buildingId: config?.buildingId || '',
      type: (config?.type || 'seasonal_reminder') as 'seasonal_reminder' | 'announcement',
      title: config?.title || '',
      message: config?.message || '',
      frequency: (config?.frequency || 'unique') as 'unique' | 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly' | 'bi-annually' | 'annually',
      startDate: config?.startDate ? parseISO(config.startDate as any) : new Date(),
      isActive: config?.isActive ?? true,
      endsAt: config?.endsAt ? parseISO(config.endsAt as any) : undefined,
    },
  });

  const selectedOrganizationId = form.watch('organizationId');

  // Fetch buildings for the selected organization. The endpoint requires
  // the organization id as a path segment (`/api/communication/buildings/:organizationId`),
  // so we provide an explicit queryFn rather than relying on the default
  // queryKey-join behavior — this makes the URL deterministic and resilient
  // to any future change in fetcher conventions.
  const { data: buildingsData } = useQuery<BuildingsResponse>({
    queryKey: ['/api/communication/buildings', selectedOrganizationId],
    enabled: !!selectedOrganizationId,
    queryFn: async () => {
      const response = await fetch(
        `/api/communication/buildings/${selectedOrganizationId}`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        throw new Error(`Failed to load buildings (${response.status})`);
      }
      return response.json();
    },
  });

  // Pre-select organization if user has only one
  React.useEffect(() => {
    if (organizations.length === 1 && !isEditing && !form.getValues('organizationId')) {
      form.setValue('organizationId', organizations[0].id);
    }
  }, [organizations, form, isEditing]);

  // Clear building selection when organization changes
  React.useEffect(() => {
    if (!isEditing) {
      form.setValue('buildingId', '');
    }
  }, [selectedOrganizationId, form, isEditing]);


  const selectedType = form.watch('type');
  const selectedTypeConfig = notificationTypes.find(t => t.value === selectedType);
  const selectedFrequency = form.watch('frequency');

  // Create/Update mutation
  const configMutation = useCreateUpdateMutation<unknown, ConfigurationFormData>({
    mutationFn: async (data: ConfigurationFormData) => {
      // Convert Date objects to ISO strings for API compatibility
      const payload = {
        ...data,
        createdBy: isEditing ? config.createdBy : undefined, // Will be set server-side for new configs
        startDate: data.startDate.toISOString(),
        endsAt: data.endsAt ? data.endsAt.toISOString() : undefined,
      };

      if (isEditing) {
        return apiRequest('PATCH', `/api/communication/notification-configs/${config.id}`, payload);
      } else {
        return apiRequest('POST', '/api/communication/notification-configs', payload);
      }
    },
    successTitle: language === 'en' ? 'Success' : 'Succès',
    successMessage: isEditing
      ? (language === 'en' ? 'Configuration updated successfully' : 'Configuration mise à jour avec succès')
      : (language === 'en' ? 'Configuration created successfully' : 'Configuration créée avec succès'),
    errorTitle: language === 'en' ? 'Error' : 'Erreur',
    errorMessage: (error: any) => error?.message || (language === 'en' ? 'An error occurred' : 'Une erreur s\'est produite'),
    invalidateQueries: (_data, qc) => {
      const orgId = form.getValues('organizationId');
      if (orgId) {
        qc.invalidateQueries({
          queryKey: ['/api/communication/notification-configs', orgId],
          exact: false,
        });
      }
    },
    onSuccessCallback: () => {
      onSuccess();
    },
  });

  const onSubmit = (data: ConfigurationFormData) => {
    configMutation.mutate(data);
  };

  // Set default frequency when type changes
  React.useEffect(() => {
    if (selectedTypeConfig && !isEditing) {
      form.setValue('frequency', selectedTypeConfig.defaultFrequency);
    }
  }, [selectedType, selectedTypeConfig, form, isEditing]);

  // Clear end date when switching to 'unique' frequency
  React.useEffect(() => {
    if (selectedFrequency === 'unique' && form.getValues('endsAt')) {
      form.setValue('endsAt', undefined);
    }
  }, [selectedFrequency, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Organization Selection */}
        <FormField
          control={form.control}
          name="organizationId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{language === 'en' ? 'Organization' : 'Organisation'}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                <FormControl>
                  <SelectTrigger data-testid="select-organization">
                    <SelectValue placeholder={language === 'en' ? 'Select organization' : 'Sélectionner une organisation'} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
              {isEditing && (
                <FormDescription className="text-amber-600">
                  {language === 'en' ? 'Organization cannot be changed for existing configurations' : 'L\'organisation ne peut pas être modifiée pour les configurations existantes'}
                </FormDescription>
              )}
            </FormItem>
          )}
        />

        {/* Building Selection */}
        <FormField
          control={form.control}
          name="buildingId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{language === 'en' ? 'Building' : 'Immeuble'}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={isEditing || !selectedOrganizationId}>
                <FormControl>
                  <SelectTrigger data-testid="select-building">
                    <SelectValue placeholder={
                      !selectedOrganizationId 
                        ? (language === 'en' ? 'Select organization first' : 'Sélectionner d\'abord une organisation')
                        : (language === 'en' ? 'Select building' : 'Sélectionner un immeuble')
                    } />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {buildingsData?.buildings?.map((building) => (
                    <SelectItem key={building.id} value={building.id}>
                      {building.name}
                    </SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
              <FormMessage />
              {isEditing && (
                <FormDescription className="text-amber-600">
                  {language === 'en' ? 'Building cannot be changed for existing configurations' : 'L\'immeuble ne peut pas être modifié pour les configurations existantes'}
                </FormDescription>
              )}
              {!selectedOrganizationId && !isEditing && (
                <FormDescription>
                  {language === 'en' ? 'Please select an organization first to see available buildings' : 'Veuillez d\'abord sélectionner une organisation pour voir les immeubles disponibles'}
                </FormDescription>
              )}
            </FormItem>
          )}
        />

        {/* Type Selection */}
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{language === 'en' ? 'Type' : 'Type'}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                <FormControl>
                  <SelectTrigger data-testid="select-type">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {notificationTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="w-4 h-4" />
                        <div>
                          <div className="font-medium">
                            {language === 'en' ? type.labelEn : type.labelFr}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {language === 'en' ? type.descriptionEn : type.descriptionFr}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
              {isEditing && (
                <FormDescription className="text-amber-600">
                  {language === 'en' ? 'Type cannot be changed for existing configurations' : 'Le type ne peut pas être modifié pour les configurations existantes'}
                </FormDescription>
              )}
            </FormItem>
          )}
        />

        {/* Title */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{language === 'en' ? 'Title' : 'Titre'}</FormLabel>
              <FormControl>
                <Input
                  placeholder={language === 'en' ? 'Enter configuration title' : 'Entrer le titre de la configuration'}
                  data-testid="input-title"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Message */}
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{language === 'en' ? 'Message' : 'Message'}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={language === 'en' ? 'Enter the message content...' : 'Entrer le contenu du message...'}
                  className="min-h-[100px]"
                  data-testid="textarea-message"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {language === 'en' 
                  ? 'This message will be sent to residents according to the specified frequency.'
                  : 'Ce message sera envoyé aux résidents selon la fréquence spécifiée.'
                }
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Frequency */}
        <FormField
          control={form.control}
          name="frequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{language === 'en' ? 'Frequency' : 'Fréquence'}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-frequency">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {frequencyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {language === 'en' ? option.labelEn : option.labelFr}
                        </span>
                        {option.descriptionEn && (
                          <span className="text-xs text-muted-foreground">
                            {language === 'en' ? option.descriptionEn : option.descriptionFr}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                {language === 'en' 
                  ? 'Choose how often this notification should be sent.'
                  : 'Choisissez la fréquence d\'envoi de cette notification.'
                }
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Start Date */}
        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>{language === 'en' ? 'Start Date' : 'Date de début'}</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className="w-full pl-3 text-left font-normal"
                      data-testid="button-start-date"
                    >
                      {field.value ? (
                        format(field.value as Date, "PPP", { locale: language === 'en' ? enUS : fr })
                      ) : (
                        <span className="text-muted-foreground">
                          {language === 'en' ? 'Pick a date' : 'Choisir une date'}
                        </span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value as Date | undefined}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormDescription>
                {language === 'en' 
                  ? 'The date when this configuration becomes active.'
                  : 'La date à laquelle cette configuration devient active.'
                }
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* End Date (Optional for recurring frequencies, Hidden for one-time) */}
        {selectedFrequency !== 'unique' && (
          <FormField
            control={form.control}
            name="endsAt"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>
                  {language === 'en' ? 'End Date (Optional)' : 'Date de fin (Optionnel)'}
                </FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className="w-full pl-3 text-left font-normal"
                        data-testid="button-end-date"
                      >
                        {field.value ? (
                          format(field.value as Date, "PPP", { locale: language === 'en' ? enUS : fr })
                        ) : (
                          <span className="text-muted-foreground">
                            {language === 'en' ? 'Pick a date (optional)' : 'Choisir une date (optionnel)'}
                          </span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value as Date | undefined}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormDescription>
                  {language === 'en' 
                    ? 'Optional end date. Leave empty for indefinite notifications.'
                    : 'Date de fin optionnelle. Laisser vide pour des notifications indéfinies.'
                  }
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Active Status */}
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  {language === 'en' ? 'Active Configuration' : 'Configuration active'}
                </FormLabel>
                <FormDescription>
                  {language === 'en' 
                    ? 'When enabled, notifications will be sent according to the schedule.'
                    : 'Quand activé, les notifications seront envoyées selon l\'horaire.'
                  }
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-active"
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            data-testid="button-cancel-form"
          >
            {language === 'en' ? 'Cancel' : 'Annuler'}
          </Button>
          <Button
            type="submit"
            disabled={configMutation.isPending}
            data-testid="button-submit-form"
          >
            {configMutation.isPending ? (
              <>
                <LoadingSpinner />
                {language === 'en' ? 'Saving...' : 'Sauvegarde...'}
              </>
            ) : (
              <>
                {isEditing ? (language === 'en' ? 'Update' : 'Mettre à jour') : (language === 'en' ? 'Create' : 'Créer')}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/**
 * Main Notification Configurations Component
 */
export function NotificationConfigurations({
  organizationContext,
  language,
}: {
  organizationContext: OrganizationContext;
  language: 'en' | 'fr';
}) {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<NotificationConfiguration | null>(null);
  const [selectedOrganization, setSelectedOrganization] = useState<string>('');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all');

  // Fetch available organizations
  const { data: organizationsData } = useQuery<{organizations: Array<{id: string, name: string}>}>(
    {
      queryKey: ['/api/communication/organizations'],
      queryFn: async () => {
        const response = await fetch('/api/communication/organizations');
        if (!response.ok) {
          throw new Error('Failed to fetch organizations');
        }
        return response.json();
      },
    }
  );

  // Set default organization when data loads
  React.useEffect(() => {
    if (organizationsData?.organizations && !selectedOrganization) {
      // Default to organizationContext if available, otherwise first organization
      const defaultOrg = organizationsData.organizations.find(org => org.id === organizationContext.id) ||
                         organizationsData.organizations[0];
      if (defaultOrg) {
        setSelectedOrganization(defaultOrg.id);
      }
    }
  }, [organizationsData, organizationContext.id, selectedOrganization]);

  // Fetch notification configurations
  const { data: configs, isLoading, error } = useQuery<NotificationConfigurationWithDetails[]>({
    queryKey: ['/api/communication/notification-configs', selectedOrganization, selectedBuilding],
    queryFn: async () => {
      if (!selectedOrganization) return [];
      
      // If a specific building is selected, fetch configs for that building only
      if (selectedBuilding !== 'all') {
        const response = await fetch(`/api/communication/notification-configs?organizationId=${selectedOrganization}&buildingId=${selectedBuilding}`);
        if (!response.ok) {
          throw new Error('Failed to fetch notification configurations');
        }
        const data = await response.json();
        return data.configurations || [];
      }
      
      // If 'all' is selected, we need to fetch configs for each building and combine them
      const buildingsResponse = await fetch(`/api/communication/buildings/${selectedOrganization}`);
      if (!buildingsResponse.ok) {
        throw new Error('Failed to fetch buildings');
      }
      const buildingsData = await buildingsResponse.json();
      
      // Fetch configs for each building
      const allConfigs: NotificationConfigurationWithDetails[] = [];
      for (const building of buildingsData.buildings || []) {
        try {
          const response = await fetch(`/api/communication/notification-configs?organizationId=${selectedOrganization}&buildingId=${building.id}`);
          if (response.ok) {
            const data = await response.json();
            const configs = data.configurations || [];
            // Add building name to each config for display
            const configsWithBuilding = configs.map((config: any) => ({
              ...config,
              buildingName: building.name
            }));
            allConfigs.push(...configsWithBuilding);
          }
        } catch (err) {
          console.warn(`Failed to fetch configs for building ${building.id}:`, err);
        }
      }
      
      return allConfigs;
    },
    enabled: !!selectedOrganization,
  });

  // Fetch buildings for filtering
  const { data: buildingsData } = useQuery<BuildingsResponse>({
    queryKey: ['/api/communication/buildings', selectedOrganization],
    enabled: !!selectedOrganization,
  });

  // Reset building selection when organization changes
  React.useEffect(() => {
    setSelectedBuilding('all');
  }, [selectedOrganization]);

  // Filter configurations by selected building
  const filteredConfigs = useMemo(() => {
    if (!configs) return [];
    if (selectedBuilding === 'all') return configs;
    return configs.filter(config => config.buildingId === selectedBuilding);
  }, [configs, selectedBuilding]);

  // Delete configuration mutation
  const deleteMutation = useCreateUpdateMutation<unknown, NotificationConfiguration>({
    mutationFn: async (config: NotificationConfiguration) => {
      return apiRequest('DELETE', `/api/communication/notification-configs/${config.id}`);
    },
    successTitle: language === 'en' ? 'Success' : 'Succès',
    successMessage: language === 'en' ? 'Configuration deleted successfully' : 'Configuration supprimée avec succès',
    errorTitle: language === 'en' ? 'Error' : 'Erreur',
    errorMessage: (error) => error?.message || (language === 'en' ? 'Failed to delete configuration' : 'Échec de la suppression de la configuration'),
    invalidateQueries: (_data, qc) => {
      // Invalidate scoped cache keys for proper cache management
      qc.invalidateQueries({
        queryKey: ['/api/communication/notification-configs'],
        exact: false,
      });
    },
  });

  // Preview mutation
  // Exception (task #229): emits a "preview sent" state-driven flow whose copy
  // varies by language but uses helpers consistent with neighboring action mutations.
  const previewMutation = useMutation({
    mutationFn: async (configId: string) => {
      return apiRequest('POST', `/api/communication/notification-configs/${configId}/preview`);
    },
    onSuccess: () => {
      toast({
        title: language === 'en' ? 'Preview Sent' : 'Aperçu envoyé',
        description: language === 'en' ? 'Preview notification sent to your email' : 'Notification d\'aperçu envoyée à votre email',
      });
    },
    onError: (error: any) => {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to send preview' : 'Échec de l\'envoi de l\'aperçu'),
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (config: NotificationConfiguration) => {
    setEditingConfig(config);
  };

  const handleDelete = (config: NotificationConfiguration) => {
    deleteMutation.mutate(config);
  };

  const handlePreview = (config: NotificationConfiguration) => {
    previewMutation.mutate(config.id);
  };

  const handleFormSuccess = () => {
    setShowCreateDialog(false);
    setEditingConfig(null);
  };

  const handleFormCancel = () => {
    setShowCreateDialog(false);
    setEditingConfig(null);
  };

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-red-600 mb-2">
              {language === 'en' ? 'Error loading configurations' : 'Erreur lors du chargement des configurations'}
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'en' ? 'Please try again later' : 'Veuillez réessayer plus tard'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {language === 'en' ? 'Notification Configurations' : 'Configurations de notifications'}
          </h3>
          <p className="text-muted-foreground text-sm mt-1">
            {language === 'en' 
              ? 'Manage automated seasonal reminders and general announcements for your buildings.'
              : 'Gérez les rappels saisonniers automatisés et les annonces générales pour vos immeubles.'
            }
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Organization Filter */}
          {organizationsData?.organizations && organizationsData.organizations.length > 1 && (
            <Select value={selectedOrganization} onValueChange={setSelectedOrganization}>
              <SelectTrigger className="w-[200px]" data-testid="select-organization-filter">
                <Building className="w-4 h-4 mr-2" />
                <SelectValue placeholder={language === 'en' ? 'Select Organization' : 'Sélectionner l\'organisation'} />
              </SelectTrigger>
              <SelectContent>
                {organizationsData.organizations.map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Building Filter */}
          {buildingsData?.buildings && buildingsData.buildings.length > 0 && (
            <Select value={selectedBuilding} onValueChange={setSelectedBuilding}>
              <SelectTrigger className="w-[200px]" data-testid="select-building-filter">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === 'en' ? 'All Buildings' : 'Tous les immeubles'}
                </SelectItem>
                {buildingsData.buildings.map((building) => (
                  <SelectItem key={building.id} value={building.id}>
                    {building.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Create Button */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-config" disabled={!selectedOrganization}>
                <Plus className="w-4 h-4 mr-2" />
                {language === 'en' ? 'Create Configuration' : 'Créer une configuration'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {language === 'en' ? 'Create Notification Configuration' : 'Créer une configuration de notification'}
                </DialogTitle>
                <DialogDescription>
                  {language === 'en' 
                    ? 'Set up automated notifications for seasonal reminders or general announcements.'
                    : 'Configurez des notifications automatisées pour les rappels saisonniers ou les annonces générales.'
                  }
                </DialogDescription>
              </DialogHeader>
              <ConfigurationForm
                onSuccess={handleFormSuccess}
                onCancel={handleFormCancel}
                language={language}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Configurations List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
          <span className="ml-2 text-muted-foreground">
            {language === 'en' ? 'Loading configurations...' : 'Chargement des configurations...'}
          </span>
        </div>
      ) : filteredConfigs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {selectedBuilding === 'all' 
                  ? (language === 'en' ? 'No configurations found' : 'Aucune configuration trouvée')
                  : (language === 'en' ? 'No configurations for selected building' : 'Aucune configuration pour l\'immeuble sélectionné')
                }
              </h3>
              <p className="text-muted-foreground mb-4">
                {language === 'en' 
                  ? 'Create your first notification configuration to start automating communications.'
                  : 'Créez votre première configuration de notification pour commencer à automatiser les communications.'
                }
              </p>
              <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first-config">
                <Plus className="w-4 h-4 mr-2" />
                {language === 'en' ? 'Create Configuration' : 'Créer une configuration'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredConfigs.map((config) => (
            <ConfigurationCard
              key={config.id}
              config={config}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onPreview={handlePreview}
              language={language}
            />
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingConfig} onOpenChange={(open) => !open && setEditingConfig(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === 'en' ? 'Edit Notification Configuration' : 'Modifier la configuration de notification'}
            </DialogTitle>
            <DialogDescription>
              {language === 'en' 
                ? 'Update the configuration settings. Some fields cannot be modified after creation.'
                : 'Mettez à jour les paramètres de configuration. Certains champs ne peuvent pas être modifiés après la création.'
              }
            </DialogDescription>
          </DialogHeader>
          {editingConfig && (
            <ConfigurationForm
              config={editingConfig}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
              language={language}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}