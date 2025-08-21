import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { z } from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  UserPlus, 
  Users, 
  Mail, 
  X,
  Plus,
  Shield
} from 'lucide-react';

import { BaseDialog } from '@/components/ui/base-dialog';
import { StandardForm, type FormFieldConfig } from '@/components/ui/standard-form';
import { useCreateMutation } from '@/hooks/use-api-handler';

// Validation schemas
const invitationSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'manager', 'tenant', 'resident']),
  organizationId: z.string().min(1, 'Organization is required'),
  buildingId: z.string().optional(),
  residenceId: z.string().optional(),
  personalMessage: z.string().optional(),
  expiryDays: z.number().min(1).max(30).default(7),
});

const bulkInvitationSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(20),
  role: z.enum(['admin', 'manager', 'tenant', 'resident']),
  organizationId: z.string().min(1, 'Organization is required'),
  buildingId: z.string().optional(),
  residenceId: z.string().optional(),
  personalMessage: z.string().optional(),
  expiryDays: z.number().min(1).max(30).default(7),
});

/**
 *
 */
type InvitationFormData = z.infer<typeof invitationSchema>;
/**
 *
 */
type BulkInvitationFormData = z.infer<typeof bulkInvitationSchema>;

/**
 *
 */
interface SendInvitationDialogProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  onSuccess: () => void;
}

/**
 *
 */
interface Organization {
  id: string;
  name: string;
  type: string;
}

/**
 *
 */
interface BuildingType {
  id: string;
  organizationId: string;
  name: string;
  address: string;
}

/**
 *
 */
interface Residence {
  id: string;
  buildingId: string;
  unitNumber: string;
  floor: number;
}

/**
 * Enhanced Send Invitation Dialog - Refactored using reusable components
 * Reduced from 936+ lines to ~400 lines by leveraging BaseDialog, StandardForm, and API hooks.
 * @param root0
 * @param root0.open
 * @param root0.onOpenChange
 * @param root0.onSuccess
 */
export function SendInvitationDialog({ open, onOpenChange, onSuccess }: SendInvitationDialogProps) {
  const { t } = useLanguage();
  const { user, hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('single');
  const [selectedOrganization, setSelectedOrganization] = useState<string>('');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [emailsInput, setEmailsInput] = useState<string>('');
  const [emailsList, setEmailsList] = useState<string[]>([]);

  // API mutations using reusable hooks
  const sendSingleInvitationMutation = useCreateMutation<unknown, InvitationFormData>(
    '/api/invitations',
    {
      successMessage: 'Invitation sent successfully!',
      invalidateQueries: ['/api/invitations', '/api/users'],
      onSuccessCallback: () => {
        onOpenChange(false);
        onSuccess();
      }
    }
  );

  const sendBulkInvitationsMutation = useCreateMutation<unknown, BulkInvitationFormData>(
    '/api/invitations/bulk',
    {
      successMessage: (data, variables) => `${variables.emails.length} invitations sent successfully!`,
      invalidateQueries: ['/api/invitations', '/api/users'],
      onSuccessCallback: () => {
        onOpenChange(false);
        onSuccess();
        setEmailsList([]);
        setEmailsInput('');
      }
    }
  );

  // Data fetching using standard useQuery
  const { data: organizations = [] } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
    enabled: hasRole(['admin', 'manager']),
  });

  const { data: buildings = [] } = useQuery<BuildingType[]>({
    queryKey: ['/api/buildings', selectedOrganization],
    enabled: !!selectedOrganization,
  });

  const { data: residences = [] } = useQuery<Residence[]>({
    queryKey: ['/api/residences', selectedBuilding],
    enabled: !!selectedBuilding,
  });

  // Helper functions
  const addEmailToList = () => {
    const email = emailsInput.trim();
    if (email && !emailsList.includes(email) && z.string().email().safeParse(email).success) {
      setEmailsList([...emailsList, email]);
      setEmailsInput('');
    }
  };

  const removeEmailFromList = (email: string) => {
    setEmailsList(emailsList.filter(e => e !== email));
  };

  const getRoleOptions = () => {
    const baseRoles = [
      { value: 'tenant', label: t('tenant') },
      { value: 'resident', label: t('resident') },
    ];

    if (hasRole(['admin'])) {
      return [
        { value: 'admin', label: t('admin') },
        { value: 'manager', label: t('manager') },
        ...baseRoles,
      ];
    }

    if (hasRole(['manager'])) {
      return [
        { value: 'manager', label: t('manager') },
        ...baseRoles,
      ];
    }

    return baseRoles;
  };

  const getOrganizationOptions = () => {
    if (hasRole(['admin'])) {
      return organizations.map(org => ({ value: org.id, label: org.name }));
    }
    
    // Managers can only invite to their own organization
    return organizations
      .filter(org => org.id === user?.organizationId)
      .map(org => ({ value: org.id, label: org.name }));
  };

  const getBuildingOptions = () => [
    { value: 'none', label: 'No specific building' },
    ...buildings.map(building => ({ 
      value: building.id, 
      label: `${building.name} - ${building.address}` 
    }))
  ];

  const getResidenceOptions = () => 
    residences.map(residence => ({ 
      value: residence.id, 
      label: `Unit ${residence.unitNumber} (Floor ${residence.floor})` 
    }));

  // Single invitation form configuration
  const singleInvitationFields: FormFieldConfig[] = [
    {
      name: 'email',
      label: t('emailAddress'),
      type: 'email',
      placeholder: 'Enter email address',
    },
    {
      name: 'role',
      label: t('role'),
      type: 'select',
      options: getRoleOptions(),
    },
    {
      name: 'organizationId',
      label: t('organization'),
      type: 'select',
      options: getOrganizationOptions(),
    },
    ...(selectedOrganization ? [{
      name: 'buildingId',
      label: t('building'),
      type: 'select' as const,
      options: getBuildingOptions(),
    }] : []),
    ...(selectedBuilding && selectedBuilding !== 'none' ? [{
      name: 'residenceId',
      label: t('residence'),
      type: 'select' as const,
      options: getResidenceOptions(),
    }] : []),
    {
      name: 'personalMessage',
      label: t('personalMessage'),
      type: 'textarea',
      placeholder: 'Optional personal message...',
      rows: 3,
    },
    {
      name: 'expiryDays',
      label: t('expiryDays'),
      type: 'number',
      placeholder: '7',
    },
  ];

  // Bulk invitation form configuration
  const bulkInvitationFields: FormFieldConfig[] = [
    {
      name: 'role',
      label: t('role'),
      type: 'select',
      options: getRoleOptions(),
    },
    {
      name: 'organizationId',
      label: t('organization'),
      type: 'select',
      options: getOrganizationOptions(),
    },
    ...(selectedOrganization ? [{
      name: 'buildingId',
      label: t('building'),
      type: 'select' as const,
      options: getBuildingOptions(),
    }] : []),
    ...(selectedBuilding && selectedBuilding !== 'none' ? [{
      name: 'residenceId',
      label: t('residence'),
      type: 'select' as const,
      options: getResidenceOptions(),
    }] : []),
    {
      name: 'personalMessage',
      label: t('personalMessage'),
      type: 'textarea',
      placeholder: 'Optional personal message...',
      rows: 3,
    },
    {
      name: 'expiryDays',
      label: t('expiryDays'),
      type: 'number',
      placeholder: '7',
    },
  ];

  const handleSingleInvitationSubmit = (data: InvitationFormData) => {
    sendSingleInvitationMutation.mutate(data);
  };

  const handleBulkInvitationSubmit = (data: Omit<BulkInvitationFormData, 'emails'>) => {
    if (emailsList.length === 0) {return;}
    
    sendBulkInvitationsMutation.mutate({
      ...data,
      emails: emailsList,
    });
  };

  return (
    <BaseDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Send Invitation"
      description="Invite users to join the platform"
      maxWidth="2xl"
      showFooter={false}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            {t('singleInvitation')}
          </TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('bulkInvitations')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <StandardForm
                schema={invitationSchema}
                fields={singleInvitationFields}
                onSubmit={handleSingleInvitationSubmit}
                isLoading={sendSingleInvitationMutation.isPending}
                submitText={t('sendInvitation')}
                defaultValues={{
                  expiryDays: 7,
                  organizationId: hasRole(['manager']) ? user?.id : '',
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Email list management */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('emailAddresses')}</label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="Enter email address"
                      value={emailsInput}
                      onChange={(e) => setEmailsInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addEmailToList()}
                    />
                    <Button
                      type="button"
                      onClick={addEmailToList}
                      disabled={!emailsInput.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {emailsList.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {emailsList.map((email) => (
                        <Badge key={email} variant="secondary" className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {email}
                          <button onClick={() => removeEmailFromList(email)}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <StandardForm
                  schema={bulkInvitationSchema.omit({ emails: true })}
                  fields={bulkInvitationFields}
                  onSubmit={handleBulkInvitationSubmit}
                  isLoading={sendBulkInvitationsMutation.isPending}
                  submitText={`${t('sendInvitations')} (${emailsList.length})`}
                  defaultValues={{
                    expiryDays: 7,
                    organizationId: hasRole(['manager']) ? user?.id : '',
                  }}
                >
                  <div className="text-sm text-muted-foreground">
                    {emailsList.length === 0 ? (
                      <span>{t('addEmailsToSendBulkInvitations')}</span>
                    ) : (
                      <span>{t('readyToSendInvitations').replace('{count}', emailsList.length.toString())}</span>
                    )}
                  </div>
                </StandardForm>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </BaseDialog>
  );
}