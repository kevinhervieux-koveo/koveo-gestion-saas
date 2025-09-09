import React from 'react';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DocumentFormBase } from '@/components/forms/DocumentFormBase';
import { StandardFormField } from '@/components/forms/StandardFormField';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
// Use a simple interface instead of importing from schema
interface Invoice {
  id?: string;
  title?: string;
  vendorName?: string;
  invoiceNumber?: string;
  totalAmount?: number | string;
  dueDate?: Date | string;
  category?: string;
  paymentType?: 'one-time' | 'recurring';
  frequency?: string;
  description?: string;
}

// Simplified invoice schema using our standard patterns
const invoiceFormSchema = z.object({
  title: z.string().min(1, 'Invoice title is required').max(200),
  vendorName: z.string().min(1, 'Vendor name is required').max(150),
  invoiceNumber: z.string().max(100).optional(),
  totalAmount: z.string().min(1, 'Amount is required').refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 999999.99;
  }, 'Amount must be between $0.01 and $999,999.99'),
  dueDate: z.date(),
  category: z.enum(['utilities', 'maintenance', 'insurance', 'professional-services', 'other']),
  paymentType: z.enum(['one-time', 'recurring']),
  frequency: z.enum(['monthly', 'quarterly', 'annually', 'custom']).optional(),
  description: z.string().max(1000).optional(),
});

type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

const INVOICE_CATEGORIES = [
  { value: 'utilities', label: 'Utilities' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'professional-services', label: 'Professional Services' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_TYPES = [
  { value: 'one-time', label: 'One-time Payment' },
  { value: 'recurring', label: 'Recurring Payment' },
];

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
  { value: 'custom', label: 'Custom' },
];

interface InvoiceFormProps {
  invoice?: Invoice | null;
  onSuccess?: (invoiceId: string, action: 'created' | 'updated') => void;
  onCancel?: () => void;
  buildingId?: string;
  residenceId?: string;
}

/**
 * Invoice Form using the new consolidated DocumentFormBase pattern.
 * Demonstrates Phase 3 migration to standardized components.
 */
export function InvoiceForm({ 
  invoice, 
  onSuccess, 
  onCancel, 
  buildingId,
  residenceId
}: InvoiceFormProps) {
  
  const defaultValues: Partial<InvoiceFormData> = {
    title: invoice?.title || '',
    vendorName: invoice?.vendorName || '',
    invoiceNumber: invoice?.invoiceNumber || '',
    totalAmount: invoice?.totalAmount?.toString() || '',
    dueDate: invoice?.dueDate ? new Date(invoice.dueDate) : new Date(),
    category: (invoice?.category as any) || 'other',
    paymentType: invoice?.paymentType || 'one-time',
    frequency: invoice?.frequency || undefined,
    description: invoice?.description || '',
  };

  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess(invoice?.id || 'new-invoice', invoice ? 'updated' : 'created');
    }
  };

  return (
    <DocumentFormBase
      title={invoice ? 'Edit Invoice' : 'Create New Invoice'}
      schema={invoiceFormSchema}
      defaultValues={defaultValues}
      apiEndpoint="/api/invoices"
      queryKey={['invoices']}
      mode={invoice ? 'edit' : 'create'}
      itemId={invoice?.id}
      buildingId={buildingId}
      residenceId={residenceId}
      onSuccess={handleSuccess}
      onCancel={onCancel}
      successMessages={{
        create: 'Invoice created successfully',
        update: 'Invoice updated successfully',
      }}
      uploadContext="bill"
      data-testid="invoice-form"
    >
      {(formControls) => (
        <>
          <StandardFormField
            control={formControls.form.control}
            name="title"
            label="Invoice Title"
            placeholder="Enter invoice title"
            data-testid="input-title"
          />

          <StandardFormField
            control={formControls.form.control}
            name="vendorName"
            label="Vendor Name"
            placeholder="Enter vendor name"
            data-testid="input-vendor-name"
          />

          <StandardFormField
            control={formControls.form.control}
            name="invoiceNumber"
            label="Invoice Number"
            placeholder="Enter invoice number (optional)"
            data-testid="input-invoice-number"
          />

          <StandardFormField
            control={formControls.form.control}
            name="totalAmount"
            label="Total Amount"
            placeholder="0.00"
            type="number"
            step="0.01"
            data-testid="input-total-amount"
          />

          <FormField
            control={formControls.form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Due Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Input
                        className={cn(
                          'w-full pl-3 text-left font-normal cursor-pointer',
                          !field.value && 'text-muted-foreground'
                        )}
                        value={field.value ? format(field.value, 'PPP') : 'Pick a date'}
                        placeholder="Pick a due date"
                        readOnly
                        data-testid="input-due-date"
                        onClick={(e) => e.preventDefault()}
                      />
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={formControls.form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {INVOICE_CATEGORIES.map((category) => (
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

          <FormField
            control={formControls.form.control}
            name="paymentType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-payment-type">
                      <SelectValue placeholder="Select payment type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PAYMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {formControls.form.watch('paymentType') === 'recurring' && (
            <FormField
              control={formControls.form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Frequency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-frequency">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FREQUENCIES.map((freq) => (
                        <SelectItem key={freq.value} value={freq.value}>
                          {freq.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={formControls.form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Enter invoice description (optional)"
                    data-testid="textarea-description"
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