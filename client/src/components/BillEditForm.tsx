import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import type { Bill } from '../../../shared/schema';

// Form schema for bill editing
const billFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category: z.enum([
    'insurance',
    'maintenance',
    'salary',
    'utilities',
    'cleaning',
    'security',
    'landscaping',
    'professional_services',
    'administration',
    'repairs',
    'supplies',
    'taxes',
    'technology',
    'reserves',
    'other',
  ]),
  vendor: z.string().optional(),
  paymentType: z.enum(['unique', 'recurrent']),
  schedulePayment: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'custom']).optional(),
  totalAmount: z.string().min(1, 'Amount is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  status: z.enum(['draft', 'sent', 'overdue', 'paid', 'cancelled']),
  notes: z.string().optional(),
});

/**
 * Bill editing form component for modifying existing bills.
 * @param root0 - The component props.
 * @param root0.bill - The bill object to edit.
 * @param root0.onSuccess - Callback function called when bill is successfully updated.
 * @param root0.onCancel - Callback function called when editing is cancelled.
 * @returns JSX element for bill editing form.
 */
/**
 * BillEditForm function.
 * @param root0
 * @param root0.bill
 * @param root0.onSuccess
 * @param root0.onCancel
 * @returns Function result.
 */
/**
 * BillEditForm component.
 * @param props - Component props.
 * @param props.bill - Bill parameter.
 * @param props.onSuccess - Callback function called when operation succeeds.
 * @param props.onCancel - Callback function called when operation is cancelled.
 * @returns JSX element.
 */
/**
 * BillEditForm component.
 * @param props - Component props.
 * @param props.bill - Bill parameter.
 * @param props.onSuccess - Callback function called when operation succeeds.
 * @param props.onCancel - Callback function called when operation is cancelled.
 * @returns JSX element.
 */
/**
 * BillEditForm component.
 * @param props - Component props.
 * @param props.bill - bill parameter.
 * @param props.onSuccess - Callback function called when operation succeeds.
 * @param props.onCancel - Callback function called when operation is cancelled.
 * @returns JSX element.
 */
/**
 * BillEditForm component.
 * @param props - Component props.
 * @param props.bill - bill parameter.
 * @param props.onSuccess - Callback function called when operation succeeds.
 * @param props.onCancel - Callback function called when operation is cancelled.
 * @returns JSX element.
 */
/**
 * BillEditForm component.
 * @param props - Component props.
 * @param props.bill - bill parameter.
 * @param props.onSuccess - Callback function called when operation succeeds.
 * @param props.onCancel - Callback function called when operation is cancelled.
 * @returns JSX element.
 */
export function BillEditForm({
  bill,
  onSuccess,
  onCancel,
}: {
  bill: Bill;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const form = useForm<z.infer<typeof billFormSchema>>({
    resolver: zodResolver(billFormSchema),
    defaultValues: {
      title: bill.title,
      description: bill.description || '',
      category: bill.category,
      vendor: bill.vendor || '',
      paymentType: bill.paymentType,
      schedulePayment: bill.schedulePayment || 'monthly',
      totalAmount: bill.totalAmount.toString(),
      startDate: bill.startDate,
      endDate: bill.endDate || '',
      status: bill.status,
      notes: bill.notes || '',
    },
  });

  const queryClient = useQueryClient();

  const updateBillMutation = useMutation({
    mutationFn: async (updates: z.infer<typeof billFormSchema>) => {
      const response = await fetch(`/api/bills/${bill.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...updates,
          costs: [updates.totalAmount], // Single cost for now
        }),
      }); /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */ /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */ /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */ /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */ /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */

      if (!response.ok) {
        throw new Error('Failed to update bill');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bills'] });
      onSuccess();
    },
  });

  const onSubmit = (values: z.infer<typeof billFormSchema>) => {
    updateBillMutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6 pt-4 border-t'>
        <div className='grid grid-cols-2 gap-4'>
          {/* Title */}
          <FormField
            control={form.control}
            name='title'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder='Bill title' />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Vendor */}
          <FormField
            control={form.control}
            name='vendor'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vendor</FormLabel>
                <FormControl>
                  <Input {...field} placeholder='Company or service provider' />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Category */}
          <FormField
            control={form.control}
            name='category'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select category' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='insurance'>Insurance</SelectItem>
                    <SelectItem value='maintenance'>Maintenance</SelectItem>
                    <SelectItem value='salary'>Salary</SelectItem>
                    <SelectItem value='utilities'>Utilities</SelectItem>
                    <SelectItem value='cleaning'>Cleaning</SelectItem>
                    <SelectItem value='security'>Security</SelectItem>
                    <SelectItem value='landscaping'>Landscaping</SelectItem>
                    <SelectItem value='professional_services'>Professional Services</SelectItem>
                    <SelectItem value='administration'>Administration</SelectItem>
                    <SelectItem value='repairs'>Repairs</SelectItem>
                    <SelectItem value='supplies'>Supplies</SelectItem>
                    <SelectItem value='taxes'>Taxes</SelectItem>
                    <SelectItem value='technology'>Technology</SelectItem>
                    <SelectItem value='reserves'>Reserves</SelectItem>
                    <SelectItem value='other'>Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Total Amount */}
          <FormField
            control={form.control}
            name='totalAmount'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Amount *</FormLabel>
                <FormControl>
                  <Input {...field} type='number' step='0.01' placeholder='0.00' />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Payment Type */}
          <FormField
            control={form.control}
            name='paymentType'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Type *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select payment type' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='unique'>One-time Payment</SelectItem>
                    <SelectItem value='recurrent'>Recurring Payment</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Schedule Payment (only for recurrent) */}
          {form.watch('paymentType') === 'recurrent' && (
            <FormField
              control={form.control}
              name='schedulePayment'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schedule *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select schedule' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='weekly'>Weekly</SelectItem>
                      <SelectItem value='monthly'>Monthly</SelectItem>
                      <SelectItem value='quarterly'>Quarterly</SelectItem>
                      <SelectItem value='yearly'>Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Start Date */}
          <FormField
            control={form.control}
            name='startDate'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date *</FormLabel>
                <FormControl>
                  <Input {...field} type='date' />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* End Date (only for recurrent) */}
          {form.watch('paymentType') === 'recurrent' && (
            <FormField
              control={form.control}
              name='endDate'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} type='date' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Status */}
          <FormField
            control={form.control}
            name='status'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select status' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='draft'>Draft</SelectItem>
                    <SelectItem value='sent'>Sent</SelectItem>
                    <SelectItem value='overdue'>Overdue</SelectItem>
                    <SelectItem value='paid'>Paid</SelectItem>
                    <SelectItem value='cancelled'>Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Description */}
        <FormField
          control={form.control}
          name='description'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder='Bill description...' rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Notes */}
        <FormField
          control={form.control}
          name='notes'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder='Additional notes...' rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Form Actions */}
        <div className='flex justify-end gap-2 pt-4 border-t'>
          <Button type='button' variant='outline' onClick={onCancel}>
            Cancel
          </Button>
          <Button type='submit' disabled={updateBillMutation.isPending}>
            {updateBillMutation.isPending ? 'Updating...' : 'Update Bill'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
