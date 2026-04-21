import React from 'react';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DocumentFormBase } from '@/components/forms/DocumentFormBase';
import { StandardFormField } from '@/components/forms/StandardFormField';
import type { Bill } from '@shared/schema';

// Simplified bill schema for testing
const billFormSchema = z.object({
  title: z.string().min(1, 'Bill title is required').max(200),
  description: z.string().max(1000).optional(),
  category: z.enum(['utilities', 'maintenance', 'insurance', 'cleaning', 'other']),
  vendor: z.string().max(150).optional(),
  totalAmount: z.string().min(1, 'Amount is required').refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999.99;
  }, 'Amount must be between $0.01 and $999,999.99'),
  status: z.enum(['draft', 'sent', 'overdue', 'paid', 'cancelled']),
  notes: z.string().max(2000).optional(),
});

type BillFormData = z.infer<typeof billFormSchema>;

const BILL_CATEGORIES = [
  { value: 'utilities', label: 'Utilities' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'other', label: 'Other' },
];

interface SimplifiedBillFormProps {
  bill?: Bill | null;
  onSuccess?: (billId: string, action: 'created' | 'updated') => void;
  onCancel?: () => void;
  buildingId?: string;
}

/**
 * Simplified Bill Form using the new consolidated components.
 * This demonstrates the new standardized form patterns.
 */
export function SimplifiedBillForm({ 
  bill, 
  onSuccess, 
  onCancel, 
  buildingId 
}: SimplifiedBillFormProps) {
  
  const defaultValues: Partial<BillFormData> = {
    title: bill?.title || '',
    description: bill?.description || '',
    category: (bill?.category as any) || 'other',
    vendor: bill?.vendor || '',
    totalAmount: bill?.totalAmount?.toString() || '',
    status: (bill?.status as any) || 'draft',
    notes: bill?.notes || '',
  };

  return (
    <DocumentFormBase
      title={bill ? 'Edit Bill' : 'Create New Bill'}
      schema={billFormSchema}
      defaultValues={defaultValues}
      apiEndpoint="/api/bills"
      queryKey={['/api/bills']}
      mode={bill ? 'edit' : 'create'}
      itemId={bill?.id}
      buildingId={buildingId}
      onSuccess={() => onSuccess?.(bill?.id || 'new', bill ? 'updated' : 'created')}
      onCancel={onCancel}
      successMessages={{
        create: 'Bill created successfully',
        update: 'Bill updated successfully',
      }}
      showTabs={false}
      data-testid="bill-form"
    >
      {({ form }) => (
        <>
          <StandardFormField
            control={form.control}
            name="title"
            label="Bill Title"
            placeholder="Enter bill title"
            required
            data-testid="input-title"
          />

          <StandardFormField
            control={form.control}
            name="vendor"
            label="Vendor"
            placeholder="Enter vendor name"
            data-testid="input-vendor"
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {BILL_CATEGORIES.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <StandardFormField
            control={form.control}
            name="totalAmount"
            label="Total Amount"
            type="number"
            placeholder="0.00"
            required
            data-testid="input-amount"
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Enter bill description"
                    data-testid="textarea-description"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Additional notes"
                    data-testid="textarea-notes"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </DocumentFormBase>
  );
}