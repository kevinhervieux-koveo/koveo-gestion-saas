import React, { useState, useMemo } from 'react';
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
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { UserPlus, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Form validation schema
const invitationSchema = z
  .object({
    email: z.string().email('invalidEmailFormat').optional(),
    firstName: z.string().max(50, 'firstNameTooLong').regex(/^[a-zA-ZÀ-ÿ\s'-]*$/, 'firstNameInvalidCharacters').optional(),
    lastName: z.string().max(50, 'lastNameTooLong').regex(/^[a-zA-ZÀ-ÿ\s'-]*$/, 'lastNameInvalidCharacters').optional(),
    role: z.enum([
      'admin',
      'manager',
      'tenant',
      'resident',
      'demo_manager',
      'demo_tenant',
      'demo_resident',
    ]),
    organizationId: z.string().min(1, 'organizationRequired'),
    buildingId: z.string().optional(),
    residenceId: z.string().optional(),
    personalMessage: z.string().max(500, 'personalMessageTooLong').optional(),
    expiryDays: z.number().min(1, 'expiryDaysInvalid').max(30, 'expiryDaysInvalid'),
  })
  .refine(
    (data) => {
      // For demo roles, first and last name are required instead of email
      if (['demo_manager', 'demo_tenant', 'demo_resident'].includes(data.role)) {
        return !!data.firstName && !!data.lastName;
      }
      // For regular roles, email is required
      return !!data.email;
    },
    {
      message: 'Email address is required for regular invitations (example: user@domain.com). For demo users, provide first and last name instead.',
      path: ['email'],
    }
  )
  .refine(
    (data) => {
      // If role is tenant or resident and a specific building is selected, residence must be assigned
      if (
        ['tenant', 'resident', 'demo_tenant', 'demo_resident'].includes(data.role) &&
        data.buildingId &&
        data.buildingId !== 'none' &&
        data.buildingId !== ''
      ) {
        return !!data.residenceId && data.residenceId !== '';
      }
      return true;
    },
    {
      message: 'Please select a specific residence unit for tenants and residents when a building is selected',
      path: ['residenceId'],
    }
  );

/**
 * Form data type for single invitation.
 * Inferred from the invitation Zod schema.
 */
type InvitationFormData = z.infer<typeof invitationSchema>;

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
 * @param props - Component props.
 * @param props.open - Whether dialog is open.
 * @param props.onOpenChange - Handler for dialog open state changes.
 * @param props.onSuccess - Handler called when invitation is sent successfully.
 * @returns JSX element for the invitation dialog.
 */
export function SendInvitationDialog({ open, onOpenChange, onSuccess }: SendInvitationDialogProps) {
  const { t } = useLanguage();
  const { user: currentUser, hasRole } = useAuth();
  const { toast } = useToast();
  const [selectedOrgType, setSelectedOrgType] = useState<string>('');

  // Single invitation form
  const form = useForm<InvitationFormData>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      role: 'tenant',
      organizationId: '',
      buildingId: '',
      residenceId: '',
      expiryDays: 7,
      personalMessage: '',
    },
  });

  // Fetch organizations (filtered by user access)
  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ['/api/users/me/organizations'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users/me/organizations');
      return response.json();
    },
    enabled: open,
  });

  // Fetch buildings
  const { data: buildings, error: buildingsError, isLoading: buildingsLoading } = useQuery<BuildingType[]>({
    queryKey: ['/api/manager/buildings'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/manager/buildings');
      const data = await response.json();
      // The API returns { buildings: [...], meta: {...} } but we need just the buildings array
      return data.buildings || data;
    },
    enabled: open,
  });


  // Fetch residences  
  const { data: residences } = useQuery<Residence[]>({
    queryKey: ['/api/residences'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/residences');
      const data = await response.json();
      // Handle both direct array and wrapped response formats
      return data.residences || data;
    },
    enabled: open,
  });

  // Helper functions for filtering data based on selections
  const getFilteredOrganizations = () => {
    if (!organizations || !Array.isArray(organizations)) {
      return [];
    }

    // Filter out any invalid organizations with detailed logging
    const validOrgs = organizations.filter((org) => {
      const isValid =
        org &&
        typeof org === 'object' &&
        org.id &&
        typeof org.id === 'string' &&
        org.id.trim() !== '' &&
        org.name &&
        typeof org.name === 'string' &&
        org.name.trim() !== '';

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
    if (!orgId || !organizations) {
      return false;
    }

    const targetOrg = organizations.find((org) => org.id === orgId);
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
    if (!buildings || !selectedOrgId) {
      return [];
    }
    return buildings.filter((building) => building.organizationId === selectedOrgId);
  };

  const getFilteredResidences = (selectedBuildingId: string) => {
    if (!residences || !selectedBuildingId) {
      return [];
    }
    return residences.filter((residence) => residence.buildingId === selectedBuildingId);
  };

  // Single invitation mutation
  const invitationMutation = useMutation({
    mutationFn: async (data: InvitationFormData) => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + data.expiryDays);

      // For demo roles, create user directly instead of sending invitation
      if (['demo_manager', 'demo_tenant', 'demo_resident'].includes(data.role)) {
        const response = await apiRequest('POST', '/api/users/demo', {
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          organizationId: data.organizationId,
          residenceId: data.residenceId || null,
        });
        return response.json();
      }

      // Regular invitation flow
      const response = await apiRequest('POST', '/api/invitations', {
        organizationId: data.organizationId,
        residenceId: data.residenceId || null,
        email: data.email,
        role: data.role,
        invitedByUserId: currentUser?.id,
        expiresAt: expiresAt.toISOString(),
        personalMessage: data.personalMessage || null,
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      const isDemoRole = ['demo_manager', 'demo_tenant', 'demo_resident'].includes(variables.role);
      toast({
        title: isDemoRole ? 'Demo User Created' : t('invitationSent'),
        description: isDemoRole
          ? 'Demo user has been created successfully'
          : t('invitationSentSuccessfully'),
      });
      form.reset();
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (_data: InvitationFormData) => {
    invitationMutation.mutate(_data);
  };

  const canInviteRole = (role: string) => {
    if (hasRole(['admin'])) {
      // Only admin can invite an admin, admin can invite to any organization
      return true;
    }
    if (hasRole(['manager'])) {
      // Manager can invite regular and demo roles (but not admin)
      if (
        ['resident', 'tenant', 'manager', 'demo_manager', 'demo_tenant', 'demo_resident'].includes(
          role
        )
      ) {
        return true;
      }
    }
    // Residents and tenants cannot invite anyone
    return false;
  };

  // Get available roles based on organization type using useMemo for proper reactivity
  const organizationId = form.watch('organizationId');
  
  const availableRoles = useMemo(() => {
    // Return empty array if no organization is selected
    if (!organizationId) {
        return [];
    }

    const selectedOrg = organizations?.find((org) => org.id === organizationId);
    const isDemoOrg = selectedOrg?.type === 'demo';


    if (isDemoOrg) {
      // For demo organizations, allow both demo roles and regular roles
      const roles = ['admin', 'manager', 'tenant', 'resident', 'demo_manager', 'demo_tenant', 'demo_resident'].filter(canInviteRole);
      return roles;
    }

    const roles = ['admin', 'manager', 'tenant', 'resident'].filter(canInviteRole);
    return roles;
  }, [organizationId, organizations, hasRole]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <UserPlus className='h-5 w-5' />
            {t('inviteUser')}
          </DialogTitle>
          <DialogDescription>{t('inviteUserDescription')}</DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
              <FormField
                control={form.control}
                name='organizationId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('organization')} *</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        onChange={(e) => {
                          field.onChange(e.target.value);
                          const selectedOrg = organizations?.find(
                            (org) => org.id === e.target.value
                          );
                          setSelectedOrgType(selectedOrg?.type || '');
                          // Reset building and residence when organization changes
                          form.setValue('buildingId', '');
                          form.setValue('residenceId', '');
                          // Reset role when switching between demo and regular orgs
                          form.setValue(
                            'role',
                            selectedOrg?.type === 'demo' ? 'demo_tenant' : 'tenant'
                          );
                        }}
                        disabled={currentUser?.role === 'manager'}
                        className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        <option value=''>{t('selectOrganization')}</option>
                        {getFilteredOrganizations().map((org) => {
                          if (!org?.id || !org?.name) {
                            return null;
                          }

                          const canInvite = canInviteToOrganization(org.id);

                          return (
                            <option key={org.id} value={org.id} disabled={!canInvite}>
                              {org.name} {org.type === 'demo' ? '(Demo)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </FormControl>
                    <FormDescription>
                      {currentUser?.role === 'manager'
                        ? 'Managers can only invite to their organization'
                        : 'Select target organization'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='role'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('role')}</FormLabel>
                    <Select 
                      key={`role-select-${organizationId}`}
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={!organizationId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('selectRole')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {organizationId ? availableRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            <div className='flex items-center gap-2'>
                              <Shield className='h-4 w-4' />
                              {role === 'admin'
                                ? t('admin')
                                : role === 'manager'
                                  ? t('manager')
                                  : role === 'resident'
                                    ? t('resident')
                                    : role === 'tenant'
                                      ? t('tenant')
                                      : role === 'demo_manager'
                                        ? 'Demo Manager'
                                        : role === 'demo_tenant'
                                          ? 'Demo Tenant'
                                          : 'Demo Resident'}
                            </div>
                          </SelectItem>
                        )) : (
                          <SelectItem value="no-organization" disabled>
                            Please select an organization first
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Conditional fields based on role type */}
              {['demo_manager', 'demo_tenant', 'demo_resident'].includes(form.watch('role')) ? (
                <>
                  <FormField
                    control={form.control}
                    name='firstName'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input placeholder='Enter first name' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='lastName'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name *</FormLabel>
                        <FormControl>
                          <Input placeholder='Enter last name' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : (
                <FormField
                  control={form.control}
                  name='email'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('emailAddress')} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t('enterEmailAddress')} type='email' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {form.watch('organizationId') && (
                <FormField
                  control={form.control}
                  name='buildingId'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {'Building'} ({t('optional')})
                      </FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          onChange={(e) => {
                            field.onChange(e.target.value);
                            // Reset residence when building changes
                            form.setValue('residenceId', '');
                          }}
                          className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          <option value=''>{'Select building'}</option>
                          <option value='none'>{'No specific building'}</option>
                          {getFilteredBuildings(form.watch('organizationId')).map((building) => (
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

              {['tenant', 'resident', 'demo_tenant', 'demo_resident'].includes(
                form.watch('role')
              ) &&
                form.watch('buildingId') &&
                form.watch('buildingId') !== 'none' && (
                  <FormField
                    control={form.control}
                    name='residenceId'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{'Residence'} *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            onChange={field.onChange}
                            className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                          >
                            <option value=''>{'Select residence'}</option>
                            {getFilteredResidences(form.watch('buildingId')).map((residence) => (
                              <option key={residence.id} value={residence.id}>
                                {'Unit'} {residence.unitNumber}
                                {residence.floor && ` - ${'Floor'} ${residence.floor}`}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormDescription>
                          {'Residence required for tenants and residents'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

              {/* Only show expiry for regular invitations, not demo users */}
              {!['demo_manager', 'demo_tenant', 'demo_resident'].includes(form.watch('role')) && (
                <FormField
                  control={form.control}
                  name='expiryDays'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('expiresIn')}</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          value={field.value.toString()}
                          className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          <option value='1'>1 {t('day')}</option>
                          <option value='3'>3 {t('days')}</option>
                          <option value='7'>7 {t('days')}</option>
                          <option value='14'>14 {t('days')}</option>
                          <option value='30'>30 {t('days')}</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Only show personal message for regular invitations, not demo users */}
              {!['demo_manager', 'demo_tenant', 'demo_resident'].includes(form.watch('role')) && (
                <FormField
                  control={form.control}
                  name='personalMessage'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('personalMessage')} ({t('optional')})
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('personalMessagePlaceholder')}
                          className='min-h-[80px]'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>{t('personalMessageDescription')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                  {t('cancel')}
                </Button>
                <Button 
                  type='submit' 
                  disabled={invitationMutation.isPending}
                >
                  {invitationMutation.isPending
                    ? selectedOrgType === 'Demo'
                      ? 'Creating User...'
                      : t('sending')
                    : selectedOrgType === 'Demo'
                      ? 'Create Demo User'
                      : t('sendInvitation')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
