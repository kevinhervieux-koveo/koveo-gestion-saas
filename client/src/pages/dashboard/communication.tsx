import React, { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { UserNotificationPreference, InsertUserNotificationPreference, InsertGeneralCommunication, insertGeneralCommunicationSchema } from '@shared/schemas/operations';
import type { User, Organization } from '@shared/schema';
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
  Send,
  Users,
  User as UserIcon,
  Clock,
  Shield,
  Zap,
  Check,
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
    descriptionEn: 'Critical communication requiring immediate attention',
    descriptionFr: 'Communication critique nécessitant une attention immédiate',
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
// Extend shared schema to include frontend-specific urgencyLevel field for UI
const generalCommunicationFormSchema = insertGeneralCommunicationSchema.extend({
  urgencyLevel: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
}).omit({
  isUrgent: true, // We'll derive this from urgencyLevel
  createdBy: true, // Will be set server-side
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

/**
 * Recipient Management Component
 * Handles organization filtering and recipient selection for communications
 */
function RecipientManagement({ 
  selectedRoles, 
  onRoleChange, 
  organizationContext,
  language
}: {
  selectedRoles: string[];
  onRoleChange: (roles: string[]) => void;
  organizationContext: OrganizationContext | null;
  language: 'en' | 'fr';
}) {
  const { data: recipients = [], isLoading: loadingRecipients } = useQuery<RecipientInfo[]>({
    queryKey: ['/api/communication/recipients', organizationContext?.id],
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

  const getRecipientCount = () => {
    if (!recipients.length) return 0;
    if (selectedRoles.includes('all')) return recipients.length;
    return recipients.filter(r => selectedRoles.includes(r.role)).length;
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
        {recipientRoles.map((role) => (
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

      {loadingRecipients ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoadingSpinner />
          {language === 'en' ? 'Loading recipients...' : 'Chargement des destinataires...'}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <UserIcon className="h-4 w-4" />
          <span data-testid="text-recipient-count">
            {language === 'en' 
              ? `${getRecipientCount()} recipient${getRecipientCount() !== 1 ? 's' : ''} selected`
              : `${getRecipientCount()} destinataire${getRecipientCount() !== 1 ? 's' : ''} sélectionné${getRecipientCount() !== 1 ? 's' : ''}`
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Form setup
  const communicationForm = useForm<GeneralCommunicationFormData>({
    resolver: zodResolver(generalCommunicationFormSchema),
    defaultValues: {
      title: '',
      content: '',
      urgencyLevel: 'medium' as const,
      recipientRoles: [],
      scheduledFor: undefined,
      organizationId: organizationContext?.id || '',
    },
  });

  // Communication mutation
  const sendCommunicationMutation = useMutation({
    mutationFn: async (data: GeneralCommunicationFormData) => {
      // Map form data to shared schema format
      const payload: InsertGeneralCommunication = {
        organizationId: organizationContext?.id || '',
        title: data.title,
        content: data.content,
        isUrgent: data.urgencyLevel === 'high' || data.urgencyLevel === 'urgent',
        scheduledFor: data.scheduledFor,
        recipientRoles: data.recipientRoles,
        createdBy: '', // Will be set server-side from authenticated user
      };
      
      const response = await apiRequest('POST', '/api/communication/general', payload);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: language === 'en' ? 'Communication Sent' : 'Communication envoyée',
        description: language === 'en' 
          ? 'Your communication has been sent successfully.'
          : 'Votre communication a été envoyée avec succès.',
      });
      
      // Reset form
      communicationForm.reset();
      setShowConfirmDialog(false);
      
      // Invalidate communication cache
      queryClient.invalidateQueries({ queryKey: ['/api/communication/general'] });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to send communication' : 'Échec de l\'envoi de la communication'),
      });
    },
  });

  const handleSubmit = (data: GeneralCommunicationFormData) => {
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
                    language={language}
                  />
                </FormControl>
                <FormMessage />
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

          {/* Communication Form Section - Only for Managers/Admins */}
          {canSendCommunications && (
            <>
              <Separator className="my-8" />
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    {language === 'en' ? 'Send Communication to Organization' : 'Envoyer une communication à l\'organisation'}
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