import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { 
  UserPlus, 
  Users, 
  Mail, 
  Building, 
  X,
  Plus,
  Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Form validation schema
const invitationSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'manager', 'tenant', 'resident']),
  organizationId: z.string().min(1, 'Organization is required'),
  buildingId: z.string().optional(),
  residenceId: z.string().optional(),
  personalMessage: z.string().optional(),
  expiryDays: z.number().min(1).max(30).default(7),
  requires2FA: z.boolean().default(false)
}).refine((data) => {
  // If role is tenant or resident, residence must be assigned
  if (['tenant', 'resident'].includes(data.role)) {
    return !!data.residenceId;
  }
  return true;
}, {
  message: 'Residence must be assigned for tenants and residents',
  path: ['residenceId']
});

const bulkInvitationSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(20),
  role: z.enum(['admin', 'manager', 'tenant', 'resident']),
  organizationId: z.string().min(1, 'Organization is required'),
  buildingId: z.string().optional(),
  residenceId: z.string().optional(),
  personalMessage: z.string().optional(),
  expiryDays: z.number().min(1).max(30).default(7),
  requires2FA: z.boolean().default(false)
}).refine((data) => {
  // If role is tenant or resident, residence must be assigned
  if (['tenant', 'resident'].includes(data.role)) {
    return !!data.residenceId;
  }
  return true;
}, {
  message: 'Residence must be assigned for tenants and residents',
  path: ['residenceId']
});

/**
 * Form data type for single invitation.
 * Inferred from the invitation Zod schema.
 */
type InvitationFormData = z.infer<typeof invitationSchema>;
/**
 * Form data type for bulk invitations.
 * Inferred from the bulk invitation Zod schema.
 */
type BulkInvitationFormData = z.infer<typeof bulkInvitationSchema>;

/**
 * Props for the SendInvitationDialog component.
 * Controls dialog visibility and success handling.
 */
interface SendInvitationDialogProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  onSuccess: () => void;
}

/**
 * Organization interface for organization selection.
 * Contains basic organization information.
 */
interface Organization {
  id: string;
  name: string;
  type: string;
}

/**
 * Building interface from schema.
 */
interface BuildingType {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  buildingType: 'condo' | 'rental';
  yearBuilt: number | null;
  totalUnits: number;
  totalFloors: number | null;
  parkingSpaces: number | null;
  storageSpaces: number | null;
  amenities: unknown;
  managementCompany: string | null;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/**
 * Residence interface for residence selection.
 */
interface Residence {
  id: string;
  buildingId: string;
  unitNumber: string;
  floor: number | null;
  squareFootage: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  residenceType: 'apartment' | 'condo' | 'house' | 'townhouse' | 'other';
  isActive: boolean;
  building: {
    id: string;
    name: string;
    organizationId: string;
    organization: {
      id: string;
      name: string;
    };
  };
}


/**
 * Send Invitation Dialog Component.
 * 
 * Allows sending single or bulk invitations with comprehensive options
 * including role selection, organization/building assignment, and custom messages.
 * @param root0 - Component props
 * @param root0.open - Whether dialog is open
 * @param root0.onOpenChange - Handler for dialog open state changes
 * @param root0.onSuccess - Handler called when invitation is sent successfully
 * @returns JSX element for the invitation dialog
 */
export function SendInvitationDialog({ open, onOpenChange, onSuccess }: SendInvitationDialogProps) {
  const { t } = useLanguage();
  const { user: currentUser, hasRole } = useAuth();
  const { toast } = useToast();
  const [invitationMode, setInvitationMode] = useState<'single' | 'bulk'>('single');
  const [bulkEmails, setBulkEmails] = useState<string[]>(['']);

  // Single invitation form
  const singleForm = useForm<InvitationFormData>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      email: '',
      role: 'tenant',
      organizationId: currentUser?.role === 'admin' ? '' : (currentUser?.organizations?.[0] || ''),
      buildingId: '',
      residenceId: '',
      expiryDays: 7,
      requires2FA: false,
      personalMessage: ''
    }
  });

  // Bulk invitation form
  const bulkForm = useForm<BulkInvitationFormData>({
    resolver: zodResolver(bulkInvitationSchema),
    defaultValues: {
      emails: [],
      role: 'tenant',
      organizationId: currentUser?.role === 'admin' ? '' : (currentUser?.organizations?.[0] || ''),
      buildingId: '',
      residenceId: '',
      expiryDays: 7,
      requires2FA: false,
      personalMessage: ''
    }
  });

  // Fetch organizations (filtered by user access)
  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ['/api/users/me/organizations'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users/me/organizations');
      return response.json();
    },
    enabled: open
  });

  // Fetch buildings
  const { data: buildings } = useQuery<BuildingType[]>({
    queryKey: ['/api/buildings'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/buildings');
      return response.json();
    },
    enabled: open
  });

  // Fetch residences
  const { data: residences } = useQuery<Residence[]>({
    queryKey: ['/api/residences'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/residences');
      return response.json();
    },
    enabled: open
  });

  // Helper functions for filtering data based on selections
  const getFilteredOrganizations = () => {
    if (!organizations) return [];
    
    // Get current user's organization info
    const currentUserOrg = organizations.find(org => 
      currentUser?.organizations?.includes(org.id)
    );
    
    // Koveo organization users can add to any organization (regardless of role)
    if (currentUserOrg?.name?.toLowerCase() === 'koveo') {
      return organizations;
    }
    
    if (currentUser?.role === 'admin') {
      // Admins can add users to any organization they have access to
      return organizations;
    } else if (currentUser?.role === 'manager') {
      // Non-Koveo managers can only add users to their own organization
      return organizations.filter(org => 
        currentUser?.organizations?.includes(org.id)
      );
    }
    
    // Default: only show user's organizations
    return organizations.filter(org => 
      currentUser?.organizations?.includes(org.id)
    );
  };

  // Check if user can access a specific organization for invitations
  const canInviteToOrganization = (orgId: string) => {
    if (!orgId || !organizations) return false;
    
    const targetOrg = organizations.find(org => org.id === orgId);
    const currentUserOrg = organizations.find(org => 
      currentUser?.organizations?.includes(org.id)
    );
    
    // Organization filtering for user access control
    if (targetOrg?.name?.toLowerCase() === 'demo') {
      return currentUser?.role === 'admin';
    }
    
    // Koveo organization users can add to any organization (override all restrictions)
    if (currentUserOrg?.name?.toLowerCase() === 'koveo') {
      return true;
    }
    
    // Users with canAccessAllOrganizations flag can add to any organization
    if (currentUser?.canAccessAllOrganizations) {
      return true;
    }
    
    // Admins can add to organizations they have access to
    if (currentUser?.role === 'admin') {
      return true;
    }
    
    // Others can only add to their own organization
    return currentUser?.organizations?.includes(orgId);
  };

  const getFilteredBuildings = (selectedOrgId: string) => {
    if (!buildings || !selectedOrgId) return [];
    return buildings.filter(building => building.organizationId === selectedOrgId);
  };

  const getFilteredResidences = (selectedBuildingId: string) => {
    if (!residences || !selectedBuildingId) return [];
    return residences.filter(residence => residence.buildingId === selectedBuildingId);
  };

  // Single invitation mutation
  const singleInvitationMutation = useMutation({
    mutationFn: async (data: InvitationFormData) => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + data.expiryDays);
      
      const response = await apiRequest('POST', '/api/invitations', {
        ...data,
        expiresAt: expiresAt.toISOString(),
        invitedByUserId: currentUser?.id
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('invitationSent'),
        description: t('invitationSentSuccessfully'),
      });
      singleForm.reset();
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Bulk invitation mutation
  const bulkInvitationMutation = useMutation({
    mutationFn: async (data: BulkInvitationFormData) => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + data.expiryDays);
      
      const invitations = data.emails.map(email => ({
        email,
        role: data.role,
        organizationId: data.organizationId,
        buildingId: data.buildingId,
        personalMessage: data.personalMessage,
        expiresAt: expiresAt.toISOString(),
        requires2FA: data.requires2FA,
        securityLevel: data.securityLevel,
        invitedByUserId: currentUser?.id
      }));
      
      const response = await apiRequest('POST', '/api/invitations/bulk', {
        invitations
      });
      return response.json();
    },
    onSuccess: (data) => {
      const successCount = data.results?.length || 0;
      const errorCount = data.errors?.length || 0;
      
      toast({
        title: t('bulkInvitationsSent'),
        description: `${successCount} ${t('bulkInvitationsSuccess')}`,
      });
      
      bulkForm.reset();
      setBulkEmails(['']);
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const onSingleSubmit = (data: InvitationFormData) => {
    singleInvitationMutation.mutate(data);
  };

  const onBulkSubmit = (data: BulkInvitationFormData) => {
    const validEmails = bulkEmails.filter(email => email.trim() !== '');
    bulkInvitationMutation.mutate({ ...data, emails: validEmails });
  };

  const addEmailField = () => {
    if (bulkEmails.length < 20) {
      setBulkEmails([...bulkEmails, '']);
    }
  };

  const removeEmailField = (index: number) => {
    setBulkEmails(bulkEmails.filter((_, i) => i !== index));
  };

  const updateEmail = (index: number, email: string) => {
    const newEmails = [...bulkEmails];
    newEmails[index] = email;
    setBulkEmails(newEmails);
  };

  const canInviteRole = (role: string) => {
    if (hasRole(['admin'])) {return true;}
    if (hasRole(['manager']) && ['tenant', 'resident'].includes(role)) {return true;}
    return false;
  };

  const availableRoles = ['admin', 'manager', 'tenant', 'resident'].filter(canInviteRole);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {t('inviteUser')}
          </DialogTitle>
          <DialogDescription>
            {t('inviteUserDescription')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={invitationMode} onValueChange={(value) => setInvitationMode(value as 'single' | 'bulk')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {t('singleInvitation')}
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('bulkInvitations')}
            </TabsTrigger>
          </TabsList>

          {/* Single Invitation Tab */}
          <TabsContent value="single" className="space-y-4">
            <Form {...singleForm}>
              <form onSubmit={singleForm.handleSubmit(onSingleSubmit)} className="space-y-4">
                <FormField
                  control={singleForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('emailAddress')}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={t('enterEmailAddress')} 
                          type="email"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={singleForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('role')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('selectRole')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableRoles.map((role) => (
                            <SelectItem key={role} value={role}>
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                {role === 'admin' ? t('admin') : role === 'manager' ? t('manager') : role === 'resident' ? t('resident') : t('tenant')}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={singleForm.control}
                  name="organizationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('organization')} *</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Reset building and residence when organization changes
                          singleForm.setValue('buildingId', '');
                          singleForm.setValue('residenceId', '');
                        }} 
                        value={field.value}
                        disabled={currentUser?.role === 'manager'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('selectOrganization')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {getFilteredOrganizations().map((org) => {
                            const isDemo = org.name?.toLowerCase() === 'demo';
                            const canInvite = canInviteToOrganization(org.id);
                            return (
                              <SelectItem 
                                key={org.id} 
                                value={org.id}
                                disabled={!canInvite}
                              >
                                <div className="flex items-center gap-2">
                                  <Building className="h-4 w-4" />
                                  {org.name}
                                  {isDemo && (
                                    <Badge variant="outline" className="text-xs">
                                      Admin Only
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {currentUser?.role === 'manager' 
                          ? t('managersCanOnlyInviteToTheirOrganization')
                          : t('selectTargetOrganization')
                        }
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {singleForm.watch('organizationId') && (
                  <FormField
                    control={singleForm.control}
                    name="buildingId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('building')} ({t('optional')})</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            // Reset residence when building changes
                            singleForm.setValue('residenceId', '');
                          }} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('selectBuilding')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                {t('noSpecificBuilding')}
                              </div>
                            </SelectItem>
                            {getFilteredBuildings(singleForm.watch('organizationId')).map((building) => (
                              <SelectItem key={building.id} value={building.id}>
                                <div className="flex items-center gap-2">
                                  <Building className="h-4 w-4" />
                                  {building.name} - {building.address}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {['tenant', 'resident'].includes(singleForm.watch('role')) && singleForm.watch('buildingId') && (
                  <FormField
                    control={singleForm.control}
                    name="residenceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('residence')} *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('selectResidence')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {getFilteredResidences(singleForm.watch('buildingId')).map((residence) => (
                              <SelectItem key={residence.id} value={residence.id}>
                                <div className="flex items-center gap-2">
                                  <Building className="h-4 w-4" />
                                  {t('unit')} {residence.unitNumber}
                                  {residence.floor && ` - ${t('floor')} ${residence.floor}`}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {t('residenceRequiredForTenantsAndResidents')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={singleForm.control}
                  name="expiryDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('expiresIn')}</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(parseInt(value))} 
                        defaultValue={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">1 {t('day')}</SelectItem>
                          <SelectItem value="3">3 {t('days')}</SelectItem>
                          <SelectItem value="7">7 {t('days')}</SelectItem>
                          <SelectItem value="14">14 {t('days')}</SelectItem>
                          <SelectItem value="30">30 {t('days')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={singleForm.control}
                  name="requires2FA"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t('require2FA')}</FormLabel>
                        <FormDescription>
                          {t('require2FADescription')}
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={singleForm.control}
                  name="personalMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('personalMessage')} ({t('optional')})</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('personalMessagePlaceholder')}
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('personalMessageDescription')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    {t('cancel')}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={singleInvitationMutation.isPending}
                  >
                    {singleInvitationMutation.isPending ? t('sending') : t('sendInvitation')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>

          {/* Bulk Invitations Tab */}
          <TabsContent value="bulk" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{t('emailAddresses')}</h4>
                    <Badge variant="secondary">
                      {bulkEmails.filter(e => e.trim()).length} / 20
                    </Badge>
                  </div>
                  
                  {bulkEmails.map((email, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={t('enterEmailAddress')}
                        type="email"
                        value={email}
                        onChange={(e) => updateEmail(index, e.target.value)}
                        className="flex-1"
                      />
                      {bulkEmails.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeEmailField(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  
                  {bulkEmails.length < 20 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addEmailField}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t('addEmailAddress')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Form {...bulkForm}>
              <form onSubmit={bulkForm.handleSubmit(onBulkSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={bulkForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('role')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableRoles.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role === 'admin' ? t('admin') : role === 'manager' ? t('manager') : role === 'resident' ? t('resident') : t('tenant')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={bulkForm.control}
                    name="expiryDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('expiresIn')}</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(parseInt(value))} 
                          defaultValue={field.value.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="7">7 {t('days')}</SelectItem>
                            <SelectItem value="14">14 {t('days')}</SelectItem>
                            <SelectItem value="30">30 {t('days')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={bulkForm.control}
                  name="organizationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('organization')} *</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Reset building and residence when organization changes
                          bulkForm.setValue('buildingId', '');
                          bulkForm.setValue('residenceId', '');
                        }} 
                        value={field.value}
                        disabled={currentUser?.role === 'manager'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('selectOrganization')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {getFilteredOrganizations().map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                {org.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {bulkForm.watch('organizationId') && (
                  <FormField
                    control={bulkForm.control}
                    name="buildingId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('building')} ({t('optional')})</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            // Reset residence when building changes
                            bulkForm.setValue('residenceId', '');
                          }} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('selectBuilding')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                {t('noSpecificBuilding')}
                              </div>
                            </SelectItem>
                            {getFilteredBuildings(bulkForm.watch('organizationId')).map((building) => (
                              <SelectItem key={building.id} value={building.id}>
                                <div className="flex items-center gap-2">
                                  <Building className="h-4 w-4" />
                                  {building.name} - {building.address}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {['tenant', 'resident'].includes(bulkForm.watch('role')) && bulkForm.watch('buildingId') && (
                  <FormField
                    control={bulkForm.control}
                    name="residenceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('residence')} *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('selectResidence')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {getFilteredResidences(bulkForm.watch('buildingId')).map((residence) => (
                              <SelectItem key={residence.id} value={residence.id}>
                                <div className="flex items-center gap-2">
                                  <Building className="h-4 w-4" />
                                  {t('unit')} {residence.unitNumber}
                                  {residence.floor && ` - ${t('floor')} ${residence.floor}`}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {t('residenceRequiredForTenantsAndResidents')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={bulkForm.control}
                  name="personalMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('personalMessage')} ({t('optional')})</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('bulkPersonalMessagePlaceholder')}
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    {t('cancel')}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={bulkInvitationMutation.isPending || bulkEmails.filter(e => e.trim()).length === 0}
                  >
                    {bulkInvitationMutation.isPending ? t('sending') : t('sendInvitations')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}