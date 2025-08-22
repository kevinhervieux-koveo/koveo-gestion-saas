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
// Checkbox component import removed (unused)
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { 
  UserPlus, 
  Users, 
  Mail, 
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
  expiryDays: z.number().min(1).max(30)
}).refine((data) => {
  // If role is tenant or resident and a specific building is selected, residence must be assigned
  if (['tenant', 'resident'].includes(data.role) && data.buildingId && data.buildingId !== 'none') {
    return !!data.residenceId;
  }
  return true;
}, {
  message: 'Residence must be assigned for tenants and residents when a building is selected',
  path: ['residenceId']
});

const bulkInvitationSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(20),
  role: z.enum(['admin', 'manager', 'tenant', 'resident']),
  organizationId: z.string().min(1, 'Organization is required'),
  buildingId: z.string().optional(),
  residenceId: z.string().optional(),
  personalMessage: z.string().optional(),
  expiryDays: z.number().min(1).max(30)
}).refine((data) => {
  // If role is tenant or resident and a specific building is selected, residence must be assigned
  if (['tenant', 'resident'].includes(data.role) && data.buildingId && data.buildingId !== 'none') {
    return !!data.residenceId;
  }
  return true;
}, {
  message: 'Residence must be assigned for tenants and residents when a building is selected',
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
 * @param root0 - Component props.
 * @param root0.open - Whether dialog is open.
 * @param root0.onOpenChange - Handler for dialog open state changes.
 * @param root0.onSuccess - Handler called when invitation is sent successfully.
 * @returns JSX element for the invitation dialog.
 */
/**
 * SendInvitationDialog function.
 * @param root0
 * @param root0.open
 * @param root0.onOpenChange
 * @param root0.onSuccess
 * @returns Function result.
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
      organizationId: '',
      buildingId: '',
      residenceId: '',
      expiryDays: 7,
      personalMessage: ''
    }
  });

  // Bulk invitation form
  const bulkForm = useForm<BulkInvitationFormData>({
    resolver: zodResolver(bulkInvitationSchema),
    defaultValues: {
      emails: [],
      role: 'tenant',
      organizationId: '',
      buildingId: '',
      residenceId: '',
      expiryDays: 7,
      personalMessage: ''
    }
  });

  // Fetch organizations (filtered by user access)
  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ['/api/users/me/organizations'],
    queryFn: async () => {
      console.warn('Fetching organizations...');
      const response = await apiRequest('GET', '/api/users/me/organizations');
      console.warn('Response status:', response.status);
      console.warn('Response headers:', response.headers);
      const text = await response.text();
      console.warn('Raw response text:', text);
      
      try {
        const data = JSON.parse(text);
        console.warn('Organizations parsed successfully:', data);
        return data;
      } catch (_e) {
        console.error('Failed to parse organizations JSON:', _e);
        console.error('Raw text was:', text);
        throw new Error('Invalid JSON response');
      }
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
    if (!organizations || !Array.isArray(organizations)) {
      console.warn('No organizations available');
      return [];
    }
    
    console.warn('Filtering organizations:', organizations, 'for user role:', currentUser?.role);
    
    // Filter out any invalid organizations with detailed logging
    const validOrgs = organizations.filter(org => {
      const isValid = org && 
        typeof org === 'object' && 
        org.id && 
        typeof org.id === 'string' && 
        org.id.trim() !== '' &&
        org.name &&
        typeof org.name === 'string' &&
        org.name.trim() !== '';
      
      if (!isValid) {
        console.warn('Invalid organization filtered out:', org);
      }
      
      return isValid;
    });
    
    
    if (currentUser?.role === 'admin') {
      // Admins can add users to any organization
      return validOrgs;
    } else if (currentUser?.role === 'manager') {
      // Managers can only add users to their own organization
      return validOrgs;
    }
    
    // Default: show all valid organizations for now
    return validOrgs;
  };

  // Check if user can access a specific organization for invitations
  const canInviteToOrganization = (orgId: string) => {
    if (!orgId || !organizations) {return false;}
    
    const targetOrg = organizations.find(org => org.id === orgId);
    const currentUserOrg = organizations[0]; // Use first organization for access control
    
    // Organization filtering for user access control
    if (targetOrg?.name?.toLowerCase() === 'demo') {
      return currentUser?.role === 'admin';
    }
    
    // Koveo organization users can add to any organization (override all restrictions)
    if (currentUserOrg?.name?.toLowerCase() === 'koveo') {
      return true;
    }
    
    // Simplified access control for now
    
    // Admins can add to organizations they have access to
    if (currentUser?.role === 'admin') {
      return true;
    }
    
    // Others can only add to their own organization - simplified for now
    return true;
  };

  const getFilteredBuildings = (selectedOrgId: string) => {
    if (!buildings || !selectedOrgId) {return [];}
    return buildings.filter(building => building.organizationId === selectedOrgId);
  };

  const getFilteredResidences = (selectedBuildingId: string) => {
    if (!residences || !selectedBuildingId) {return [];}
    return residences.filter(residence => residence.buildingId === selectedBuildingId);
  };

  // Single invitation mutation
  const singleInvitationMutation = useMutation({
    mutationFn: async (data: InvitationFormData) => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + data.expiryDays);
      
      const response = await apiRequest('POST', '/api/invitations', {
        ...data,
        expiresAt: expiresAt.toISOString()
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
    onError: (error: Error) => {
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
        expiresAt: expiresAt.toISOString()
      }));
      
      const response = await apiRequest('POST', '/api/invitations/bulk', {
        invitations
      });
      return response.json();
    },
    onSuccess: (data) => {
      const successCount = data.results?.length || 0;
      const _errorCount = data.errors?.length || 0;
      
      toast({
        title: t('bulkInvitationsSent'),
        description: `${successCount} ${t('bulkInvitationsSuccess')}`,
      });
      
      bulkForm.reset();
      setBulkEmails(['']);
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
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
    if (hasRole(['admin'])) {
      // Admins can invite any role (resident, manager, admin, tenant) in any organization
      return true;
    }
    if (hasRole(['manager']) && ['resident', 'manager', 'tenant'].includes(role)) {
      // Managers can invite resident, manager, tenant in their organization only
      return true;
    }
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
                      <FormControl>
                        <select
                          {...field}
                          onChange={(e) => {
                            field.onChange(e.target.value);
                            // Reset building and residence when organization changes
                            singleForm.setValue('buildingId', '');
                            singleForm.setValue('residenceId', '');
                          }}
                          disabled={currentUser?.role === 'manager'}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">{t('selectOrganization')}</option>
                          {getFilteredOrganizations().map((org) => {
                            if (!org?.id || !org?.name) {return null;}
                            
                            const canInvite = canInviteToOrganization(org.id);
                            
                            return (
                              <option 
                                key={org.id}
                                value={org.id}
                                disabled={!canInvite}
                              >
                                {org.name}
                              </option>
                            );
                          })}
                        </select>
                      </FormControl>
                      <FormDescription>
                        {currentUser?.role === 'manager' 
                          ? "Managers can only invite to their organization"
                          : "Select target organization"
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
                        <FormLabel>{"Building"} ({t('optional')})</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                              // Reset residence when building changes
                              singleForm.setValue('residenceId', '');
                            }}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="">{"Select building"}</option>
                            <option value="none">{"No specific building"}</option>
                            {getFilteredBuildings(singleForm.watch('organizationId')).map((building) => (
                              <option key={building.id} value={building.id}>
                                {building.name} - {building.address}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {['tenant', 'resident'].includes(singleForm.watch('role')) && singleForm.watch('buildingId') && singleForm.watch('buildingId') !== 'none' && (
                  <FormField
                    control={singleForm.control}
                    name="residenceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{"Residence"} *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            onChange={field.onChange}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="">{"Select residence"}</option>
                            {getFilteredResidences(singleForm.watch('buildingId')).map((residence) => (
                              <option key={residence.id} value={residence.id}>
                                {"Unit"} {residence.unitNumber}
                                {residence.floor && ` - ${"Floor"} ${residence.floor}`}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormDescription>
                          {"Residence required for tenants and residents"}
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
                      <FormControl>
                        <select
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          value={field.value.toString()}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="1">1 {t('day')}</option>
                          <option value="3">3 {t('days')}</option>
                          <option value="7">7 {t('days')}</option>
                          <option value="14">14 {t('days')}</option>
                          <option value="30">30 {t('days')}</option>
                        </select>
                      </FormControl>
                      <FormMessage />
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
                      <FormControl>
                        <select
                          {...field}
                          onChange={(e) => {
                            field.onChange(e.target.value);
                            // Reset building and residence when organization changes
                            bulkForm.setValue('buildingId', '');
                            bulkForm.setValue('residenceId', '');
                          }}
                          disabled={currentUser?.role === 'manager'}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">{t('selectOrganization')}</option>
                          {getFilteredOrganizations().map((org) => {
                            if (!org?.id || !org?.name) {return null;}
                            
                            return (
                              <option key={org.id} value={org.id}>
                                {org.name}
                              </option>
                            );
                          })}
                        </select>
                      </FormControl>
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
                        <FormLabel>{"Building"} ({t('optional')})</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                              // Reset residence when building changes
                              bulkForm.setValue('residenceId', '');
                            }}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="">{"Select building"}</option>
                            <option value="none">{"No specific building"}</option>
                            {getFilteredBuildings(bulkForm.watch('organizationId')).map((building) => (
                              <option key={building.id} value={building.id}>
                                {building.name} - {building.address}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {['tenant', 'resident'].includes(bulkForm.watch('role')) && bulkForm.watch('buildingId') && bulkForm.watch('buildingId') !== 'none' && (
                  <FormField
                    control={bulkForm.control}
                    name="residenceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{"Residence"} *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            onChange={field.onChange}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="">{"Select residence"}</option>
                            {getFilteredResidences(bulkForm.watch('buildingId')).map((residence) => (
                              <option key={residence.id} value={residence.id}>
                                {"Unit"} {residence.unitNumber}
                                {residence.floor && ` - ${"Floor"} ${residence.floor}`}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormDescription>
                          {"Residence required for tenants and residents"}
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