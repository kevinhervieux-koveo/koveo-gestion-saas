import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { type InsertOrganization } from '@shared/schema';

/**
 * Props for the OrganizationForm component.
 */
interface OrganizationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Define the form schema with Quebec-specific validation
const organizationFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(200, 'Name must be 200 characters or less'),
  type: z.string().min(1, 'Organization type is required'),
  address: z
    .string()
    .min(1, 'Address is required')
    .max(300, 'Address must be 300 characters or less'),
  city: z.string().min(1, 'City is required').max(100, 'City must be 100 characters or less'),
  province: z.string().min(1, 'Province is required').default('QC'),
  postalCode: z
    .string()
    .min(1, 'Postal code is required')
    .regex(
      /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$|^[A-Z]\d[A-Z]\d[A-Z]\d$/,
      'Invalid Canadian postal code format'
    ),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  registrationNumber: z.string().optional(),
});

/**
 *
 */
type OrganizationFormData = z.infer<typeof organizationFormSchema>;

/**
 * Form for creating new organizations in the Quebec property management system.
 * Includes all required fields with Quebec-specific defaults and validation.
 * @param root0 - Component props.
 * @param root0.open - Dialog open state.
 * @param root0.onOpenChange - Callback to handle dialog open state changes.
 * @returns Organization form dialog component.
 */
/**
 * OrganizationForm function.
 * @param root0
 * @param root0.open
 * @param root0.onOpenChange
 * @returns Function result.
 */
export function OrganizationForm({ open, onOpenChange }: OrganizationFormProps) {
  const { t: _t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: '',
      type: '',
      address: '',
      city: '',
      province: 'QC', // Default to Quebec
      postalCode: '',
      phone: '',
      email: '',
      website: '',
      registrationNumber: '',
    },
  });

  const createOrganizationMutation = useMutation({
    mutationFn: async (_data: InsertOrganization) => {
      const response = await apiRequest('POST', '/api/organizations', _data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Organization created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/organizations'] });
      form.reset();
      onOpenChange(false);
    },
    onError: (_error: unknown) => {
      console.error('Create organization _error:', _error);
      toast({
        title: 'Error',
        description: (_error as Error)?.message || 'Failed to create organization',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (_data: OrganizationFormData) => {
    // Convert empty strings to undefined for optional fields
    const cleanData: InsertOrganization = {
      ...data,
      phone: data.phone || undefined,
      email: data.email || undefined,
      website: data.website || undefined,
      registrationNumber: data.registrationNumber || undefined,
    };

    createOrganizationMutation.mutate(cleanData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[600px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Create New Organization</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem className='md:col-span-2'>
                    <FormLabel>Organization Name *</FormLabel>
                    <FormControl>
                      <Input placeholder='Enter organization name' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='type'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select organization type' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='management_company'>Management Company</SelectItem>
                        <SelectItem value='syndicate'>Syndicate</SelectItem>
                        <SelectItem value='cooperative'>Cooperative</SelectItem>
                        <SelectItem value='condo_association'>Condo Association</SelectItem>
                        <SelectItem value='Demo'>Demo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='registrationNumber'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quebec Registration Number</FormLabel>
                    <FormControl>
                      <Input placeholder='Business registration number' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='address'
                render={({ field }) => (
                  <FormItem className='md:col-span-2'>
                    <FormLabel>Address *</FormLabel>
                    <FormControl>
                      <Input placeholder='Street address' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='city'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City *</FormLabel>
                    <FormControl>
                      <Input placeholder='City' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='province'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Province</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='QC'>Quebec (QC)</SelectItem>
                        <SelectItem value='ON'>Ontario (ON)</SelectItem>
                        <SelectItem value='BC'>British Columbia (BC)</SelectItem>
                        <SelectItem value='AB'>Alberta (AB)</SelectItem>
                        <SelectItem value='SK'>Saskatchewan (SK)</SelectItem>
                        <SelectItem value='MB'>Manitoba (MB)</SelectItem>
                        <SelectItem value='NB'>New Brunswick (NB)</SelectItem>
                        <SelectItem value='NS'>Nova Scotia (NS)</SelectItem>
                        <SelectItem value='PE'>Prince Edward Island (PE)</SelectItem>
                        <SelectItem value='NL'>Newfoundland and Labrador (NL)</SelectItem>
                        <SelectItem value='NT'>Northwest Territories (NT)</SelectItem>
                        <SelectItem value='NU'>Nunavut (NU)</SelectItem>
                        <SelectItem value='YT'>Yukon (YT)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='postalCode'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Code *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='A1A 1A1'
                        {...field}
                        onChange={(e) => {
                          // Auto-format postal code to uppercase
                          const value = e.target.value.toUpperCase();
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='phone'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder='(514) 123-4567' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder='contact@organization.com' type='email' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='website'
                render={({ field }) => (
                  <FormItem className='md:col-span-2'>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input placeholder='https://www.organization.com' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='flex justify-end space-x-2 pt-4'>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={createOrganizationMutation.isPending}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={createOrganizationMutation.isPending}>
                {createOrganizationMutation.isPending ? 'Creating...' : 'Create Organization'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
