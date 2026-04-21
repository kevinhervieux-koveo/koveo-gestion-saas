import React, { useState, useCallback, useRef } from 'react';
import { logDebug, logError } from '@/lib/logger';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { UserNotificationPreference, InsertUserNotificationPreference, InsertGeneralCommunication, insertGeneralCommunicationSchema } from '@shared/schemas/operations';
import type { User } from '@shared/schema';
import type { Organization as CoreOrganization } from '@shared/schemas/core';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { parse, format } from 'date-fns';
import {
  Bell,
  Settings,
  Save,
  RefreshCw,
  Volume2,
  VolumeX,
  Mail,
  Smartphone,
  AlertTriangle,
  FileText,
  DollarSign,
  Wrench,
  Building,
  MessageSquare,
  Info,
  RotateCcw,
  Send,
  Users,
  User as UserIcon,
  Clock,
  Shield,
  Zap,
  Check,
  TestTube,
  ChevronDown,
} from 'lucide-react';

// Import notification configurations component
import { NotificationConfigurations } from '@/components/dashboard/notification-configurations';

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
    defaultFrequency: 'monthly',
  },
  {
    key: 'maintenance_update',
    labelEn: 'Maintenance Updates',
    labelFr: 'Mises à jour de maintenance',
    descriptionEn: 'Updates on maintenance requests and work progress',
    descriptionFr: 'Mises à jour sur les demandes de maintenance et l\'avancement des travaux',
    icon: Wrench,
    category: 'maintenance',
    defaultFrequency: 'monthly',
  },
  {
    key: 'announcement',
    labelEn: 'General Announcements',
    labelFr: 'Annonces générales',
    descriptionEn: 'Important announcements from building management',
    descriptionFr: 'Annonces importantes de la gestion de l\'immeuble',
    icon: Volume2,
    category: 'communication',
    defaultFrequency: 'monthly',
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
    key: 'upcoming_payment',
    labelEn: 'Upcoming Payments',
    labelFr: 'Paiements à venir',
    descriptionEn: 'Notifications about payments due in the next few days',
    descriptionFr: 'Notifications concernant les paiements dus dans les prochains jours',
    icon: Clock,
    category: 'financial',
    defaultFrequency: 'monthly',
  },
  {
    key: 'upcoming_bills',
    labelEn: 'New Bills Available',
    labelFr: 'Nouvelles factures disponibles',
    descriptionEn: 'Notifications when new bills are issued and available',
    descriptionFr: 'Notifications lors de l\'émission de nouvelles factures',
    icon: FileText,
    category: 'financial',
    defaultFrequency: 'monthly',
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
    defaultFrequency: 'monthly',
  },
  {
    key: 'payment_overdue',
    labelEn: 'Payment Overdue Alerts',
    labelFr: 'Alertes de paiement en retard',
    descriptionEn: 'Urgent notifications for significantly overdue payments',
    descriptionFr: 'Notifications urgentes pour les paiements significativement en retard',
    icon: AlertTriangle,
    category: 'financial',
    defaultFrequency: 'monthly',
  },
  {
    key: 'new_building_document',
    labelEn: 'New Documents',
    labelFr: 'Nouveaux documents',
    descriptionEn: 'Notifications when new building documents are uploaded',
    descriptionFr: 'Notifications lors du téléchargement de nouveaux documents de l\'immeuble',
    icon: FileText,
    category: 'communication',
    defaultFrequency: 'monthly',
  },
  {
    key: 'meeting_invite',
    labelEn: 'Meeting Invitations',
    labelFr: 'Invitations aux réunions',
    descriptionEn: 'Invitations to building meetings and assemblies',
    descriptionFr: 'Invitations aux réunions et assemblées de l\'immeuble',
    icon: Clock,
    category: 'communication',
    defaultFrequency: 'monthly',
  },
  {
    key: 'maintenance_completed',
    labelEn: 'Maintenance Completed',
    labelFr: 'Maintenance terminée',
    descriptionEn: 'Notifications when maintenance work is completed',
    descriptionFr: 'Notifications lorsque les travaux de maintenance sont terminés',
    icon: Wrench,
    category: 'maintenance',
    defaultFrequency: 'monthly',
  },
  {
    key: 'budget_update',
    labelEn: 'Budget Updates',
    labelFr: 'Mises à jour du budget',
    descriptionEn: 'Updates about building budget and financial reports',
    descriptionFr: 'Mises à jour concernant le budget de l\'immeuble et les rapports financiers',
    icon: DollarSign,
    category: 'financial',
    defaultFrequency: 'monthly',
  },
  {
    key: 'policy_change',
    labelEn: 'Policy Changes',
    labelFr: 'Changements de politique',
    descriptionEn: 'Important notifications about policy and regulation changes',
    descriptionFr: 'Notifications importantes concernant les changements de politique et de réglementation',
    icon: FileText,
    category: 'communication',
    defaultFrequency: 'monthly',
  },
  {
    key: 'seasonal_reminder',
    labelEn: 'Seasonal Reminders',
    labelFr: 'Rappels saisonniers',
    descriptionEn: 'Seasonal maintenance reminders and preparation notices',
    descriptionFr: 'Rappels de maintenance saisonnière et avis de préparation',
    icon: Info,
    category: 'maintenance',
    defaultFrequency: 'monthly',
  },
];

// Frequency options - matching shared schema frequencyEnum
const frequencyOptions = [
  { value: 'immediate', labelEn: 'Immediate', labelFr: 'Immédiat' },
  { value: 'weekly', labelEn: 'Weekly', labelFr: 'Hebdomadaire' },
  { value: 'bi_weekly', labelEn: 'Bi-weekly', labelFr: 'Bi-hebdomadaire' },
  { value: 'monthly', labelEn: 'Monthly', labelFr: 'Mensuel' },
  { value: 'quarterly', labelEn: 'Quarterly', labelFr: 'Trimestriel' },
  { value: 'bi-annually', labelEn: 'Bi-annually', labelFr: 'Bi-annuel' },
  { value: 'annually', labelEn: 'Annually', labelFr: 'Annuel' },
];

// Define the frequency type to match the shared schema
type FrequencyType = 'immediate' | 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly' | 'bi-annually' | 'annually';

// Use shared notification preference type from @shared/schemas
type NotificationPreference = UserNotificationPreference;

// Form schema for notification preferences (without individual starting dates)
const preferencesSchema = z.object({
  preferences: z.array(z.object({
    notificationType: z.string(),
    frequency: z.enum(['immediate', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'bi-annually', 'annually']),
    isEnabled: z.boolean(),
  })),
});

// Form schema for notification settings (global starting date)
const settingsSchema = z.object({
  startingDate: z.date(),
});

// Helper function to ensure frequency is valid - moved outside component to prevent re-renders
const ensureValidFrequency = (frequency: string | undefined, defaultFreq: FrequencyType): FrequencyType => {
  const validFrequencies: FrequencyType[] = ['immediate', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'bi-annually', 'annually'];
  return (frequency && validFrequencies.includes(frequency as FrequencyType)) 
    ? frequency as FrequencyType 
    : defaultFreq;
};

type PreferencesFormData = z.infer<typeof preferencesSchema>;
type SettingsFormData = z.infer<typeof settingsSchema>;

// Urgency level definitions for general communications
interface UrgencyLevel {
  value: 'low' | 'medium' | 'high' | 'urgent';
  labelEn: string;
  labelFr: string;
  descriptionEn: string;
  descriptionFr: string;
  icon: React.ComponentType<any>;
  color: string;
}

const urgencyLevels: UrgencyLevel[] = [
  {
    value: 'low',
    labelEn: 'Low Priority',
    labelFr: 'Priorité faible',
    descriptionEn: 'General information, no immediate action required',
    descriptionFr: 'Information générale, aucune action immédiate requise',
    icon: Info,
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'medium',
    labelEn: 'Medium Priority',
    labelFr: 'Priorité moyenne',
    descriptionEn: 'Important information, residents should read when convenient',
    descriptionFr: 'Information importante, les résidents devraient lire quand c\'est pratique',
    icon: MessageSquare,
    color: 'text-yellow-600 dark:text-yellow-400',
  },
  {
    value: 'high',
    labelEn: 'High Priority',
    labelFr: 'Priorité élevée',
    descriptionEn: 'Requires attention within 24-48 hours',
    descriptionFr: 'Nécessite une attention dans les 24-48 heures',
    icon: AlertTriangle,
    color: 'text-orange-600 dark:text-orange-400',
  },
  {
    value: 'urgent',
    labelEn: 'Urgent',
    labelFr: 'Urgent',
    descriptionEn: 'Message will be sent immediately to all selected users',
    descriptionFr: 'Le message sera envoyé immédiatement à tous les utilisateurs sélectionnés',
    icon: Zap,
    color: 'text-red-600 dark:text-red-400',
  },
];

// Recipient role options
interface RecipientRole {
  value: string;
  labelEn: string;
  labelFr: string;
}

const recipientRoles: RecipientRole[] = [
  { value: 'all', labelEn: 'All Members', labelFr: 'Tous les membres' },
  { value: 'resident', labelEn: 'Residents', labelFr: 'Résidents' },
  { value: 'tenant', labelEn: 'Tenants', labelFr: 'Locataires' },
  { value: 'manager', labelEn: 'Managers', labelFr: 'Gestionnaires' },
  { value: 'admin', labelEn: 'Administrators', labelFr: 'Administrateurs' },
];

// General communication form schema
// Create a new schema based on shared schema but with frontend-specific modifications
const generalCommunicationFormSchema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  urgencyLevel: z.enum(['low', 'medium', 'high', 'urgent']),
  scheduledFor: z.date().optional(),
  recipientRoles: z.array(z.string()).optional(),
  buildingIds: z.array(z.string()).optional(), // Multiple building selection
  isTestMode: z.boolean().optional(),
});

type GeneralCommunicationFormData = z.infer<typeof generalCommunicationFormSchema>;

// Recipient selection interface
interface RecipientInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
}

// Organization context interface  
interface OrganizationContext {
  id: string;
  name: string;
  canSendToAllOrganizations: boolean;
}

// Enhanced organization data interfaces
interface OrganizationData {
  id: string;
  name: string;
}

interface OrganizationsResponse {
  organizations: OrganizationData[];
  userRole: string;
  canAccessAll: boolean;
}

interface Building {
  id: string;
  name: string;
  address: string;
}

interface BuildingsResponse {
  buildings: Building[];
}

/**
 * Recipient Management Component
 * Handles organization filtering and recipient selection for communications
 */
function RecipientManagement({ 
  selectedRoles, 
  onRoleChange, 
  organizationContext,
  userRole,
  language
}: {
  selectedRoles: string[];
  onRoleChange: (roles: string[]) => void;
  organizationContext: OrganizationContext | null;
  userRole: string;
  language: 'en' | 'fr';
}) {
  // Remove the recipients API call since the endpoint doesn't exist
  // Instead, we'll use a static approach for recipient counting based on organization
  const recipients: RecipientInfo[] = [];
  const loadingRecipients = false;
  
  // Fetch real organization member counts
  const { data: memberCounts = {}, isLoading: loadingMembers } = useQuery({
    queryKey: ['organization-member-counts', organizationContext?.id],
    queryFn: () => apiRequest('GET', `/api/communication/organizations/${organizationContext?.id}/member-counts`),
    enabled: !!organizationContext?.id,
  });

  const handleRoleToggle = (roleValue: string) => {
    if (roleValue === 'all') {
      // If "all" is selected, clear other selections and select all
      onRoleChange(['all']);
    } else {
      // Remove "all" if selecting specific roles
      const newRoles = selectedRoles.includes(roleValue)
        ? selectedRoles.filter(r => r !== roleValue && r !== 'all')
        : [...selectedRoles.filter(r => r !== 'all'), roleValue];
      onRoleChange(newRoles);
    }
  };

  // Filter recipient roles based on user permissions
  // Managers cannot send communications to administrators
  const getAvailableRoles = () => {
    if (userRole === 'admin') {
      return recipientRoles; // Admins can send to everyone
    } else if (userRole === 'manager' || userRole === 'demo_manager') {
      return recipientRoles.filter(role => role.value !== 'admin'); // Managers cannot send to admins
    }
    return recipientRoles;
  };

  const availableRoles = getAvailableRoles();

  const getRecipientCount = () => {
    if (selectedRoles.length === 0) return 0;
    
    if (selectedRoles.includes('all')) {
      return (memberCounts as any)?.all || 0;
    }
    
    // Count members based on selected roles
    return selectedRoles.reduce((total, role) => {
      return total + ((memberCounts as any)?.[role] || 0);
    }, 0);
  };

  const getRecipientDisplayText = () => {
    if (loadingMembers) return '...';
    return getRecipientCount().toString();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-medium">
          {language === 'en' ? 'Recipients' : 'Destinataires'}
        </h3>
        {organizationContext && (
          <Badge variant="outline" className="ml-auto">
            {organizationContext.name}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {availableRoles.map((role) => (
          <div key={role.value} className="flex items-center space-x-2">
            <Checkbox
              id={`role-${role.value}`}
              checked={selectedRoles.includes(role.value)}
              onCheckedChange={() => handleRoleToggle(role.value)}
              data-testid={`checkbox-recipient-${role.value}`}
            />
            <label
              htmlFor={`role-${role.value}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              {language === 'en' ? role.labelEn : role.labelFr}
            </label>
          </div>
        ))}
      </div>

      {loadingMembers ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoadingSpinner />
          {language === 'en' ? 'Loading recipients...' : 'Chargement des destinataires...'}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <UserIcon className="h-4 w-4" />
          <span data-testid="text-recipient-count">
            {language === 'en' 
              ? `${getRecipientDisplayText()} recipient${getRecipientCount() !== 1 ? 's' : ''} selected`
              : `${getRecipientDisplayText()} destinataire${getRecipientCount() !== 1 ? 's' : ''} sélectionné${getRecipientCount() !== 1 ? 's' : ''}`
            }
          </span>
        </div>
      )}

      {selectedRoles.length === 0 && (
        <div className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {language === 'en' 
            ? 'Please select at least one recipient group'
            : 'Veuillez sélectionner au moins un groupe de destinataires'
          }
        </div>
      )}
    </div>
  );
}

/**
 * General Communication Form Component
 * Allows managers/admins to send communications to organization members
 */
function GeneralCommunicationForm({ 
  organizationContext,
  language 
}: {
  organizationContext: OrganizationContext | null;
  language: 'en' | 'fr';
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('');

  // Fetch available organizations
  const { data: organizationsData, isLoading: loadingOrganizations } = useQuery<OrganizationsResponse>({
    queryKey: ['/api/communication/organizations'],
    enabled: !!user,
  });

  // Fetch buildings for selected organization (filtered by user access)
  const { data: buildingsData, isLoading: loadingBuildings } = useQuery<{ buildings: Array<{ id: string; name: string; address: string }> }>({
    queryKey: ['/api/users/me/buildings', selectedOrganizationId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedOrganizationId) {
        params.append('organization_id', selectedOrganizationId);
      }
      const response = await fetch(`/api/users/me/buildings?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch buildings');
      const buildings = await response.json();
      return { buildings };
    },
    enabled: !!selectedOrganizationId,
  });

  // Form setup
  const communicationForm = useForm<GeneralCommunicationFormData>({
    resolver: zodResolver(generalCommunicationFormSchema),
    defaultValues: {
      title: '',
      content: '',
      urgencyLevel: 'medium' as const,
      recipientRoles: [],
      scheduledFor: undefined,
      organizationId: '',
      buildingIds: [],
      isTestMode: false,
    },
  });

  // Set default organization when data loads
  React.useEffect(() => {
    if (organizationsData?.organizations.length === 1) {
      const defaultOrg = organizationsData.organizations[0];
      setSelectedOrganizationId(defaultOrg.id);
      communicationForm.setValue('organizationId', defaultOrg.id);
    } else if (organizationsData?.organizations.length > 1 && organizationContext?.id) {
      setSelectedOrganizationId(organizationContext.id);
      communicationForm.setValue('organizationId', organizationContext.id);
    }
  }, [organizationsData, organizationContext]);

  // Communication mutation
  const sendCommunicationMutation = useCreateUpdateMutation<any, GeneralCommunicationFormData>({
    mutationFn: async (data: GeneralCommunicationFormData) => {
      // Map form data to shared schema format
      const payload: InsertGeneralCommunication = {
        organizationId: data.organizationId,
        title: data.title,
        content: data.content,
        isUrgent: data.urgencyLevel === 'urgent',
        scheduledFor: data.urgencyLevel === 'urgent' ? undefined : data.scheduledFor, // Clear scheduling for urgent communications
        recipientRoles: data.recipientRoles,
        // createdBy will be set server-side from authenticated user
      };
      
      // Include building IDs and test mode if specified
      const requestBody = {
        ...payload,
        ...(data.buildingIds?.length ? { buildingIds: data.buildingIds } : {}),
        ...(data.isTestMode ? { isTestMode: true } : {}),
      };
      
      const response = await apiRequest('POST', '/api/communication/general', requestBody);
      return { ...await response.json(), isTestMode: data.isTestMode };
    },
    successTitle: (data: any) => {
      const isTest = data?.isTestMode;
      return isTest 
        ? (language === 'en' ? 'Test Email Sent' : 'Email de test envoyé')
        : (language === 'en' ? 'Communication Sent' : 'Communication envoyée');
    },
    successMessage: (data: any) => {
      const isTest = data?.isTestMode;
      return isTest
        ? (language === 'en' 
            ? 'A test email has been sent to your email address only.'
            : 'Un email de test a été envoyé à votre adresse email uniquement.')
        : (language === 'en' 
            ? 'Your communication has been sent successfully.'
            : 'Votre communication a été envoyée avec succès.');
    },
    errorTitle: language === 'en' ? 'Error' : 'Erreur',
    errorMessage: (error: any) => error?.message || (language === 'en' ? 'Failed to send communication' : 'Échec de l\'envoi de la communication'),
    queryKeysToInvalidate: [['/api/communication/general']],
    onSuccessCallback: () => {
      // Reset form
      communicationForm.reset();
      setShowConfirmDialog(false);
    },
  });

  const handleSubmit = (data: GeneralCommunicationFormData) => {
    // Validate organizationId is set
    if (!data.organizationId) {
      toast({
        variant: 'destructive',
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' 
          ? 'Organization not selected. Please refresh the page and try again.'
          : 'Organisation non sélectionnée. Veuillez actualiser la page et réessayer.',
      });
      return;
    }
    
    // Show confirmation for high/urgent communications
    if (data.urgencyLevel === 'high' || data.urgencyLevel === 'urgent') {
      setShowConfirmDialog(true);
      return;
    }
    
    sendCommunicationMutation.mutate(data);
  };

  const selectedUrgency = urgencyLevels.find(u => u.value === communicationForm.watch('urgencyLevel'));
  const UrgencyIcon = selectedUrgency?.icon || MessageSquare;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-medium">
          {language === 'en' ? 'Send Communication' : 'Envoyer une communication'}
        </h3>
      </div>

      <Form {...communicationForm}>
        <form onSubmit={communicationForm.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Title Field */}
          <FormField
            control={communicationForm.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {language === 'en' ? 'Title' : 'Titre'} *
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={language === 'en' ? 'Enter communication title...' : 'Entrez le titre de la communication...'}
                    {...field}
                    data-testid="input-communication-title"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Content Field */}
          <FormField
            control={communicationForm.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {language === 'en' ? 'Message Content' : 'Contenu du message'} *
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={language === 'en' 
                      ? 'Enter your message content...'
                      : 'Entrez le contenu de votre message...'
                    }
                    className="min-h-[120px]"
                    {...field}
                    data-testid="textarea-communication-content"
                  />
                </FormControl>
                <FormDescription>
                  {language === 'en' 
                    ? 'Maximum 5000 characters. Be clear and concise.'
                    : 'Maximum 5000 caractères. Soyez clair et concis.'
                  }
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Organization Selection */}
          {organizationsData && organizationsData.organizations.length > 1 && (
            <FormField
              control={communicationForm.control}
              name="organizationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {language === 'en' ? 'Organization' : 'Organisation'} *
                  </FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedOrganizationId(value);
                      // Reset building selection when organization changes
                      communicationForm.setValue('buildingIds', []);
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-organization">
                        <SelectValue placeholder={language === 'en' ? 'Select organization' : 'Sélectionner une organisation'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {organizationsData.organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Building Selection */}
          {buildingsData && buildingsData.buildings.length > 1 && (
            <FormField
              control={communicationForm.control}
              name="buildingIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {language === 'en' ? 'Target Buildings (Optional)' : 'Immeubles ciblés (Optionnel)'}
                  </FormLabel>
                  <FormDescription>
                    {language === 'en' 
                      ? 'Leave empty to send to all buildings, or select specific buildings to target.'
                      : 'Laissez vide pour envoyer à tous les immeubles, ou sélectionnez des immeubles spécifiques à cibler.'
                    }
                  </FormDescription>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    {buildingsData.buildings.map((building) => (
                      <div key={building.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`building-${building.id}`}
                          checked={field.value?.includes(building.id) || false}
                          onCheckedChange={(checked) => {
                            const currentValues = field.value || [];
                            if (checked) {
                              field.onChange([...currentValues, building.id]);
                            } else {
                              field.onChange(currentValues.filter(id => id !== building.id));
                            }
                          }}
                          data-testid={`checkbox-building-${building.id}`}
                        />
                        <label
                          htmlFor={`building-${building.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {building.name}
                          {building.address && (
                            <span className="text-xs text-muted-foreground block">
                              {building.address}
                            </span>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Urgency Level */}
          <FormField
            control={communicationForm.control}
            name="urgencyLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {language === 'en' ? 'Urgency Level' : 'Niveau d\'urgence'}
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-urgency-level">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {urgencyLevels.map((urgency) => {
                      const Icon = urgency.icon;
                      return (
                        <SelectItem key={urgency.value} value={urgency.value}>
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${urgency.color}`} />
                            <span>{language === 'en' ? urgency.labelEn : urgency.labelFr}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {selectedUrgency && (
                  <FormDescription>
                    {language === 'en' ? selectedUrgency.descriptionEn : selectedUrgency.descriptionFr}
                  </FormDescription>
                )}
                {selectedUrgency?.value === 'urgent' && (
                  <div className="mt-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md" data-testid="text-urgent-warning">
                    <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                      <Zap className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {language === 'en' 
                          ? 'This type of communication will be sent right now'
                          : 'Ce type de communication sera envoyé immédiatement'
                        }
                      </span>
                    </div>
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Recipients */}
          <FormField
            control={communicationForm.control}
            name="recipientRoles"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {language === 'en' ? 'Recipients' : 'Destinataires'} *
                </FormLabel>
                <FormControl>
                  <RecipientManagement
                    selectedRoles={field.value}
                    onRoleChange={field.onChange}
                    organizationContext={organizationContext}
                    userRole={organizationsData?.userRole || user?.role || ''}
                    language={language}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Test Mode Checkbox */}
          <FormField
            control={communicationForm.control}
            name="isTestMode"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox
                    id="test-mode"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-test-mode"
                  />
                </FormControl>
                <label 
                  htmlFor="test-mode" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1 cursor-pointer"
                >
                  <TestTube className="h-4 w-4" />
                  {language === 'en' ? 'Send as test (to myself only)' : 'Envoyer en test (à moi-même seulement)'}
                </label>
              </FormItem>
            )}
          />

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4">
            <Button
              type="submit"
              disabled={sendCommunicationMutation.isPending}
              className="min-w-[120px]"
              data-testid="button-send-communication"
            >
              {sendCommunicationMutation.isPending ? (
                <>
                  <LoadingSpinner />
                  {language === 'en' ? 'Sending...' : 'Envoi...'}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {language === 'en' ? 'Send Now' : 'Envoyer maintenant'}
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => communicationForm.reset()}
              disabled={sendCommunicationMutation.isPending}
              data-testid="button-reset-communication"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {language === 'en' ? 'Reset' : 'Réinitialiser'}
            </Button>
          </div>
        </form>
      </Form>

      {/* Confirmation Dialog for Urgent Communications */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              {language === 'en' ? 'Confirm Urgent Communication' : 'Confirmer la communication urgente'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'en' 
                ? 'You are about to send an urgent communication. This will notify all selected recipients immediately. Are you sure you want to proceed?'
                : 'Vous êtes sur le point d\'envoyer une communication urgente. Cela notifiera immédiatement tous les destinataires sélectionnés. Êtes-vous sûr de vouloir continuer ?'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              {language === 'en' ? 'Cancel' : 'Annuler'}
            </Button>
            <Button 
              onClick={() => sendCommunicationMutation.mutate(communicationForm.getValues())}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              {language === 'en' ? 'Send Urgent' : 'Envoyer urgent'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Communication Dashboard Page
 * Provides comprehensive notification preferences management with bilingual support
 * and Quebec Law 25 compliance for privacy settings.
 */
export default function CommunicationDashboard() {
  const { user, hasRole } = useAuth();
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkFrequency, setBulkFrequency] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const formInitializedRef = useRef(false);
  
  // State to track which notification categories are collapsed (all collapsed by default)
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({
    financial: true,
    maintenance: true,
    communication: true,
    system: true,
  });

  // Function to toggle category collapsed state
  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Check if user can send communications (managers and admins only)
  const canSendCommunications = hasRole(['admin', 'manager', 'demo_manager']);

  // Fetch user's organization context for communication sending
  const { data: organizationContext, isLoading: loadingOrganization } = useQuery<OrganizationContext>({
    queryKey: ['/api/communication/organization-context'],
    enabled: !!user && canSendCommunications,
  });

  // Fetch current notification preferences
  const { data: preferences = [], isLoading, error } = useQuery<NotificationPreference[]>({
    queryKey: ['/api/communication/preferences'],
    enabled: !!user,
  });

  // Fetch notification settings (global starting date)
  const { data: settings, isLoading: loadingSettings } = useQuery<{ startingDate: string }>({
    queryKey: ['/api/communication/settings'],
    enabled: !!user,
  });

  // No longer needed - moved outside component

  // Form setup for preferences (without starting dates)
  const form = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      preferences: notificationTypes.map(type => {
        const existing = preferences.find(p => p.notificationType === type.key);
        return {
          notificationType: type.key,
          frequency: ensureValidFrequency(existing?.frequency, type.defaultFrequency),
          isEnabled: existing?.isEnabled ?? false,
        };
      }),
    },
  });

  // Helper function to get user's creation date or January 1st of current year as fallback
  const getDefaultStartingDate = () => {
    if (user?.createdAt) {
      return new Date(user.createdAt);
    }
    const currentYear = new Date().getFullYear();
    return new Date(currentYear, 0, 1); // January 1st of current year as fallback
  };

  // Form setup for settings (global starting date)
  const settingsForm = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      startingDate: settings?.startingDate ? parse(settings.startingDate, 'yyyy-MM-dd', new Date()) : getDefaultStartingDate(),
    },
  });

  // Helper functions for category-level controls
  const getCategoryState = useCallback((category: string) => {
    const currentPrefs = form.getValues().preferences;
    const categoryTypes = notificationTypes.filter(t => t.category === category);
    const categoryPrefs = currentPrefs.filter(p => 
      categoryTypes.some(t => t.key === p.notificationType)
    );
    
    if (categoryPrefs.length === 0) return { isEnabled: false, frequency: 'monthly' as FrequencyType };
    
    const allEnabled = categoryPrefs.every(p => p.isEnabled);
    const firstFrequency = categoryPrefs[0]?.frequency || 'monthly';
    
    return { isEnabled: allEnabled, frequency: firstFrequency };
  }, [form]);

  const setCategoryEnabled = useCallback((category: string, enabled: boolean) => {
    const currentPrefs = form.getValues().preferences;
    const categoryTypes = notificationTypes.filter(t => t.category === category);
    
    const updatedPrefs = currentPrefs.map(pref => {
      const isCategoryType = categoryTypes.some(t => t.key === pref.notificationType);
      return isCategoryType ? { ...pref, isEnabled: enabled } : pref;
    });
    
    form.setValue('preferences', updatedPrefs);
    setHasUnsavedChanges(true);
  }, [form]);

  const setCategoryFrequency = useCallback((category: string, frequency: FrequencyType) => {
    const currentPrefs = form.getValues().preferences;
    const categoryTypes = notificationTypes.filter(t => t.category === category);
    
    const updatedPrefs = currentPrefs.map(pref => {
      const isCategoryType = categoryTypes.some(t => t.key === pref.notificationType);
      return isCategoryType ? { ...pref, frequency } : pref;
    });
    
    form.setValue('preferences', updatedPrefs);
    setHasUnsavedChanges(true);
  }, [form]);

  // Update form values when preferences are loaded - fixed to prevent form reset loop
  React.useEffect(() => {
    if (preferences.length > 0 && !formInitializedRef.current) {
      const formValues = notificationTypes.map(type => {
        const existing = preferences.find(p => p.notificationType === type.key);
        return {
          notificationType: type.key,
          frequency: ensureValidFrequency(existing?.frequency, type.defaultFrequency),
          isEnabled: existing?.isEnabled ?? false,
        };
      });
      
      form.reset({ preferences: formValues }, { keepDirty: false });
      setHasUnsavedChanges(false);
      formInitializedRef.current = true;
    }
  }, [preferences, form]);

  // Update settings form when settings are loaded
  React.useEffect(() => {
    if (settings?.startingDate) {
      settingsForm.reset({
        startingDate: parse(settings.startingDate, 'yyyy-MM-dd', new Date()),
      }, { keepDirty: false });
    }
  }, [settings, settingsForm]); // Removed unstable ensureValidFrequency dependency

  // Track form changes
  React.useEffect(() => {
    const subscription = form.watch(() => {
      setHasUnsavedChanges(true);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Save preferences mutation - using apiRequest for proper error handling
  const saveMutation = useCreateUpdateMutation<unknown, PreferencesFormData>({
    mutationFn: async (data: PreferencesFormData) => {
      logDebug('🔍 [FRONTEND] Saving notification preferences with data:', data);
      logDebug('🔍 [FRONTEND] Preferences array:', JSON.stringify(data.preferences, null, 2));
      const response = await apiRequest('PUT', '/api/communication/preferences', data.preferences);
      const result = await response.json();
      logDebug('✅ [FRONTEND] Preferences save response:', result);
      return result;
    },
    successTitle: language === 'fr' ? 'Préférences mises à jour' : 'Preferences updated',
    successMessage: language === 'fr' 
      ? 'Vos préférences de notification ont été enregistrées avec succès.'
      : 'Your notification preferences have been saved successfully.',
    errorTitle: language === 'fr' ? 'Erreur' : 'Error',
    errorMessage: (error: any) => error?.message || (language === 'fr' 
      ? 'Échec de la mise à jour des préférences'
      : 'Failed to update preferences'),
    queryKeysToInvalidate: [['/api/communication/preferences']],
    onSuccessCallback: () => {
      logDebug('✅ [FRONTEND] Preferences mutation succeeded');
      setHasUnsavedChanges(false);
      // Reset form initialization flag in case user wants to reload
      formInitializedRef.current = false;
    },
    onErrorCallback: (error: any) => {
      logError('❌ [FRONTEND] Preferences mutation error:', error);
      logError('❌ [FRONTEND] Error details:', JSON.stringify(error, null, 2));
    },
  });

  // Combined test email mutation
  const combinedTestEmailMutation = useMutation({
    mutationFn: async ({ language: emailLanguage }: { language: 'fr' | 'en' }) => {
      const response = await apiRequest('POST', '/api/communication/preferences/test-combined-email', { 
        language: emailLanguage 
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: language === 'fr' ? 'Email de test combiné envoyé' : 'Combined test email sent',
        description: language === 'fr' 
          ? 'Un aperçu combiné de toutes vos notifications activées a été envoyé à votre adresse email.'
          : 'A combined preview of all your enabled notifications has been sent to your email address.',
      });
    },
    onError: (error: any) => {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: error.message || (language === 'fr' 
          ? 'Échec de l\'envoi de l\'email de test combiné'
          : 'Failed to send combined test email'),
        variant: 'destructive',
      });
    },
  });


  // Settings save mutation
  const saveSettingsMutation = useCreateUpdateMutation<unknown, SettingsFormData>({
    mutationFn: async (data: SettingsFormData) => {
      logDebug('🔍 [FRONTEND] Saving notification settings with data:', data);
      const payload = { 
        startingDate: data.startingDate.toISOString().split('T')[0] // Convert to YYYY-MM-DD format safely
      };
      logDebug('🔍 [FRONTEND] Sending payload to /api/communication/settings:', payload);
      const response = await apiRequest('PUT', '/api/communication/settings', payload);
      const result = await response.json();
      logDebug('✅ [FRONTEND] Settings save response:', result);
      return result;
    },
    successTitle: language === 'fr' ? 'Paramètres mis à jour' : 'Settings updated',
    successMessage: language === 'fr' 
      ? 'Votre date de début pour les notifications a été enregistrée avec succès.'
      : 'Your notification starting date has been saved successfully.',
    errorTitle: language === 'fr' ? 'Erreur' : 'Error',
    errorMessage: (error: any) => error?.message || (language === 'fr' 
      ? 'Échec de la mise à jour des paramètres'
      : 'Failed to update settings'),
    queryKeysToInvalidate: [['/api/communication/settings']],
    onSuccessCallback: () => {
      logDebug('✅ [FRONTEND] Settings mutation succeeded');
    },
    onErrorCallback: (error: any) => {
      logError('❌ [FRONTEND] Settings mutation error:', error);
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
              {/* Global Starting Date Section */}
              <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                <Form {...settingsForm}>
                  <form onSubmit={settingsForm.handleSubmit((data) => saveSettingsMutation.mutate(data))} className="space-y-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex-1">
                        <h4 className="font-medium mb-1">
                          {language === 'fr' ? 'Date de début pour toutes les notifications' : 'Starting Date for All Notifications'}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {language === 'fr' 
                            ? 'Cette date sera utilisée pour calculer la fréquence de toutes vos notifications.'
                            : 'This date will be used to calculate the frequency for all your notifications.'
                          }
                        </p>
                      </div>
                      
                      <FormField
                        control={settingsForm.control}
                        name="startingDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>
                              {language === 'fr' ? 'Date de début' : 'Starting Date'}
                            </FormLabel>
                            <div className="flex gap-2 items-center">
                              <FormControl>
                                <Input
                                  type="date"
                                  value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      const dateValue = parse(e.target.value, 'yyyy-MM-dd', new Date());
                                      field.onChange(dateValue);
                                    } else {
                                      field.onChange(undefined);
                                    }
                                  }}
                                  max={format(new Date(), 'yyyy-MM-dd')}
                                  min="1900-01-01"
                                  data-testid="input-starting-date"
                                />
                              </FormControl>
                              <Button
                                type="submit"
                                disabled={saveSettingsMutation.isPending}
                                data-testid="button-save-settings"
                              >
                                {saveSettingsMutation.isPending ? (
                                  <>
                                    <LoadingSpinner />
                                    {language === 'fr' ? 'Enregistrement...' : 'Saving...'}
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-4 h-4 mr-1" />
                                    {language === 'fr' ? 'Enregistrer' : 'Save'}
                                  </>
                                )}
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </form>
                </Form>
              </div>

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
                const categoryState = getCategoryState(category);
                
                return (
                  <Card key={category}>
                    <Collapsible 
                      open={!collapsedCategories[category]} 
                      onOpenChange={() => toggleCategory(category)}
                    >
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CategoryIcon className="w-5 h-5" />
                              {language === 'fr' ? categoryLabel.fr : categoryLabel.en}
                            </div>
                            <ChevronDown 
                              className={`w-4 h-4 transition-transform ${
                                collapsedCategories[category] ? 'rotate-0' : 'rotate-180'
                              }`}
                            />
                          </CardTitle>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent>
                          {/* Category-level controls */}
                          <div className="mb-6 p-4 bg-muted/30 rounded-lg border-2 border-primary/20">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium mb-1">
                                  {language === 'fr' 
                                    ? 'Paramètres de la catégorie' 
                                    : 'Category Settings'}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {language === 'fr'
                                    ? 'Ces paramètres s\'appliquent à toutes les notifications listées ci-dessous.'
                                    : 'These settings apply to all notifications listed below.'}
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={categoryState.isEnabled}
                                    onCheckedChange={(checked) => setCategoryEnabled(category, checked)}
                                    data-testid={`switch-category-${category}-enabled`}
                                  />
                                  <span className="text-sm font-medium">
                                    {categoryState.isEnabled 
                                      ? (language === 'fr' ? 'Activé' : 'Enabled')
                                      : (language === 'fr' ? 'Désactivé' : 'Disabled')
                                    }
                                  </span>
                                </div>
                                
                                <Select
                                  value={categoryState.frequency}
                                  onValueChange={(value) => setCategoryFrequency(category, value as FrequencyType)}
                                  disabled={!categoryState.isEnabled}
                                >
                                  <SelectTrigger 
                                    className="w-40" 
                                    data-testid={`select-category-${category}-frequency`}
                                  >
                                    <SelectValue />
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
                            </div>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              })}
            </form>
          </Form>

          {/* Communication Form Section - Only for Managers/Admins */}
          {canSendCommunications && (
            <>
              <Separator className="my-8" />
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    {language === 'en' ? 'Send Communication' : 'Envoyer une communication'}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {language === 'en'
                      ? 'Send messages and announcements to members of your organization.'
                      : 'Envoyez des messages et des annonces aux membres de votre organisation.'
                    }
                  </p>
                  
                  {/* RBAC and Organization Context Info */}
                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span className="text-muted-foreground">
                        {language === 'en' 
                          ? `Authorized: ${user?.role === 'admin' ? 'System Administrator' : 'Organization Manager'}`
                          : `Autorisé: ${user?.role === 'admin' ? 'Administrateur système' : 'Gestionnaire d\'organisation'}`
                        }
                      </span>
                    </div>
                    
                    {organizationContext && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building className="h-4 w-4 text-blue-600" />
                        <span className="text-muted-foreground">
                          {language === 'en' ? 'Organization:' : 'Organisation:'} {organizationContext.name}
                        </span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent>
                  {loadingOrganization ? (
                    <div className="flex items-center justify-center py-8">
                      <LoadingSpinner />
                      <span className="text-muted-foreground">
                        {language === 'en' ? 'Loading organization context...' : 'Chargement du contexte organisationnel...'}
                      </span>
                    </div>
                  ) : organizationContext ? (
                    <GeneralCommunicationForm 
                      organizationContext={organizationContext}
                      language={language}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
                      <h3 className="text-lg font-medium mb-2">
                        {language === 'en' ? 'Organization Access Required' : 'Accès à l\'organisation requis'}
                      </h3>
                      <p className="text-muted-foreground">
                        {language === 'en'
                          ? 'You need to be associated with an organization to send communications. Please contact your administrator.'
                          : 'Vous devez être associé à une organisation pour envoyer des communications. Veuillez contacter votre administrateur.'
                        }
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Notification Configurations Section - Only for Managers/Admins */}
          {canSendCommunications && (
            <>
              <Separator className="my-8" />
              
              {loadingOrganization ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-center py-8">
                      <LoadingSpinner />
                      <span className="text-muted-foreground ml-2">
                        {language === 'en' ? 'Loading notification configurations...' : 'Chargement des configurations de notifications...'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ) : organizationContext ? (
                <NotificationConfigurations
                  organizationContext={organizationContext}
                  language={language}
                />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <Settings className="h-8 w-8 text-amber-500 mx-auto mb-3" />
                      <h3 className="text-lg font-medium mb-2">
                        {language === 'en' ? 'Organization Access Required' : 'Accès à l\'organisation requis'}
                      </h3>
                      <p className="text-muted-foreground">
                        {language === 'en'
                          ? 'You need to be associated with an organization to manage notification configurations.'
                          : 'Vous devez être associé à une organisation pour gérer les configurations de notifications.'
                        }
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Combined Test Email Section */}
          <Card className="border-2 border-blue-200 bg-blue-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="w-5 h-5 text-blue-600" />
                {language === 'fr' ? 'Test des notifications' : 'Test Notifications'}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {language === 'fr'
                  ? 'Envoyez un aperçu combiné de toutes vos notifications activées à votre adresse email.'
                  : 'Send a combined preview of all your enabled notifications to your email address.'
                }
              </p>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="outline"
                onClick={() => combinedTestEmailMutation.mutate({ language })}
                disabled={combinedTestEmailMutation.isPending}
                className="w-full sm:w-auto"
                data-testid="button-combined-test-email"
              >
                {combinedTestEmailMutation.isPending ? (
                  <>
                    <LoadingSpinner />
                    {language === 'fr' ? 'Envoi en cours...' : 'Sending...'}
                  </>
                ) : (
                  <>
                    <TestTube className="h-4 w-4 mr-2" />
                    {language === 'fr' ? 'Envoyer un test combiné' : 'Send Combined Test'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

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
            <Select onValueChange={setBulkFrequency}>
              <SelectTrigger data-testid="select-bulk-frequency">
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