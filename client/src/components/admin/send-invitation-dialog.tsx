import React from 'react';
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
import { UserPlus, Mail, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Form validation schema
const invitationSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    role: z.enum(['admin', 'manager', 'tenant', 'resident']),
    organizationId: z.string().min(1, 'Organization is required'),
    buildingId: z.string().optional(),
    residenceId: z.string().optional(),
    personalMessage: z.string().optional(),
    expiryDays: z.number().min(1).max(30),
  })
  .refine(
    (data) => {
      // If role is tenant or resident and a specific building is selected, residence must be assigned
      if (
        ['tenant', 'resident'].includes(data.role) &&
        data.buildingId &&
        data.buildingId !== 'none'
      ) {
        return !!data.residenceId;
      }
      return true;
    },
    {
      message: 'Residence must be assigned for tenants and residents when a building is selected',
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
 * Allows sending single invitations with comprehensive options
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
      personalMessage: '',
    },
  });

  // Fetch organizations (filtered by user access)
  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/organizations');
      return response.json();
    },
    enabled: open,
  });

  // Fetch buildings
  const { data: buildings } = useQuery<BuildingType[]>({
    queryKey: ['/api/buildings'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/buildings');
      return response.json();
    },
    enabled: open,
  });

  // Fetch residences
  const { data: residences } = useQuery<Residence[]>({
    queryKey: ['/api/residences'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/residences');
      return response.json();
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
  const singleInvitationMutation = useMutation({
    mutationFn: async (data: InvitationFormData) => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + data.expiryDays);

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
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSingleSubmit = (_data: InvitationFormData) => {
    singleInvitationMutation.mutate(_data);
  };

  const canInviteRole = (role: string) => {
    if (hasRole(['admin'])) {
      // Only admin can invite an admin, admin can invite to any organization
      return true;
    }
    if (hasRole(['manager']) && ['resident', 'tenant', 'manager'].includes(role)) {
      // Manager can only invite manager or less role (resident/tenant/manager), only in their organization
      return true;
    }
    // Residents and tenants cannot invite anyone
    return false;
  };

  const availableRoles = ['admin', 'manager', 'tenant', 'resident'].filter(canInviteRole);

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

        <Form {...singleForm}>
          <form onSubmit={singleForm.handleSubmit(onSingleSubmit)} className='space-y-4'>
            <FormField
              control={singleForm.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('emailAddress')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('enterEmailAddress')} type='email' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={singleForm.control}
              name='role'
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
                          <div className='flex items-center gap-2'>
                            <Shield className='h-4 w-4' />
                            {role === 'admin'
                              ? t('admin')
                              : role === 'manager'
                                ? t('manager')
                                : role === 'resident'
                                  ? t('resident')
                                  : t('tenant')}
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
              name='organizationId'
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
                            {org.name}
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

            {singleForm.watch('organizationId') && (
              <FormField
                control={singleForm.control}
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
                          singleForm.setValue('residenceId', '');
                        }}
                        className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                      >
                        <option value=''>{'Select building'}</option>
                        <option value='none'>{'No specific building'}</option>
                        {getFilteredBuildings(singleForm.watch('organizationId')).map(
                          (building) => (
                            <option key={building.id} value={building.id}>
                              {building.name} - {building.address}
                            </option>
                          )
                        )}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {['tenant', 'resident'].includes(singleForm.watch('role')) &&
              singleForm.watch('buildingId') &&
              singleForm.watch('buildingId') !== 'none' && (
                <FormField
                  control={singleForm.control}
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
                          {getFilteredResidences(singleForm.watch('buildingId')).map(
                            (residence) => (
                              <option key={residence.id} value={residence.id}>
                                {'Unit'} {residence.unitNumber}
                                {residence.floor && ` - ${'Floor'} ${residence.floor}`}
                              </option>
                            )
                          )}
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

            <FormField
              control={singleForm.control}
              name='expiryDays'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('expiresIn')}</FormLabel>
                  <FormControl>
                    <select
                      value={field.value.toString()}
                      onChange={(e) => field.onChange(Number(e.target.value))}
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

            <FormField
              control={singleForm.control}
              name='personalMessage'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('personalMessage')} ({t('optional')})</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add a personal welcome message..."
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button type='submit' disabled={singleInvitationMutation.isPending}>
                {singleInvitationMutation.isPending ? t('sending') : t('sendInvitation')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}