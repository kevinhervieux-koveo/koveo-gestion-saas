import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Organization } from '@shared/schema';

// Organization form schema matching the database schema
const organizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  type: z.string().min(1, 'Organization type is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  province: z.string().min(1, 'Province is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  registrationNumber: z.string().optional(),
});

/**
 * Form data type for organization creation and editing.
 */
type OrganizationFormData = z.infer<typeof organizationSchema>;

/**
 * Props for the OrganizationFormDialog component.
 */
interface OrganizationFormDialogProps {
  open?: boolean;
  onOpenChange: (_open: boolean) => void;
  organization?: Organization | null;
  onSuccess?: () => void;
}

/**
 * Dialog component for creating and editing organizations with form validation.
 * 
 * @param props - Component properties.
 * @param props.open - Whether the dialog is open.
 * @param props.onOpenChange - Callback to handle dialog open state changes.
 * @param props.organization - Organization data for editing, null for creating new.
 * @param props.onSuccess - Callback called after successful form submission.
 * @returns JSX element for the organization form dialog.
 */
export function OrganizationFormDialog({
  open,
  onOpenChange,
  organization,
  onSuccess,
}: OrganizationFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!organization;

  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: '',
      type: 'management_company',
      address: '',
      city: '',
      province: 'QC',
      postalCode: '',
      phone: '',
      email: '',
      website: '',
      registrationNumber: '',
    },
  });

  // Reset form when organization data changes
  useEffect(() => {
    if (organization) {
      form.reset({
        name: organization.name || '',
        type: organization.type || 'management_company',
        address: organization.address || '',
        city: organization.city || '',
        province: organization.province || 'QC',
        postalCode: organization.postalCode || '',
        phone: organization.phone || '',
        email: organization.email || '',
        website: organization.website || '',
        registrationNumber: organization.registrationNumber || '',
      });
    } else {
      form.reset({
        name: '',
        type: 'management_company',
        address: '',
        city: '',
        province: 'QC',
        postalCode: '',
        phone: '',
        email: '',
        website: '',
        registrationNumber: '',
      });
    }
  }, [organization, form]);

  const mutation = useMutation({
    mutationFn: async (_data: OrganizationFormData) => {
      const url = isEditing ? `/api/organizations/${organization.id}` : '/api/organizations';
      const method = isEditing ? 'PUT' : 'POST';
      return apiRequest(method, url, _data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations'] });
      toast({
        title: isEditing ? 'Organization Updated' : 'Organization Created',
        description: isEditing 
          ? 'Organization updated successfully' 
          : 'Organization created successfully',
      });
      onOpenChange(false);
      form.reset();
      onSuccess?.();
    },
    onError: (_error: Error) => {
      toast({
        title: 'Error',
        description: _error.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (_data: OrganizationFormData) => {
    mutation.mutate(_data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Organization' : 'Create Organization'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update the organization information below.' 
              : 'Fill in the details to create a new organization.'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter organization name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="management_company">Management Company</SelectItem>
                        <SelectItem value="syndicate">Syndicate</SelectItem>
                        <SelectItem value="cooperative">Cooperative</SelectItem>
                        <SelectItem value="condo_association">Condo Association</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter city" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Province *</FormLabel>
                    <FormControl>
                      <Input placeholder="QC" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="H1H 1H1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 (514) 555-0123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Contact email" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input placeholder="Website URL" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="registrationNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registration Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter registration number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending 
                  ? 'Saving...' 
                  : isEditing 
                    ? 'Update Organization' 
                    : 'Create Organization'
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}