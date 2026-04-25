import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';
import {
  CalendarIcon,
  DollarSign,
  Plus,
  Trash2,
  Info,
  Calculator,
  CreditCard,
  Repeat,
} from 'lucide-react';

// Payment plan form schema
const paymentPlanSchema = z.object({
  // Payment type - single payment or recurring payments
  paymentType: z.enum(['single', 'recurring']),
  
  // Date range for payments
  dateFirstPayment: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  dateEndRecurring: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  
  // Schedule configuration
  paymentPlanSchedule: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'custom']),
  paymentPlanCustomDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  
  // Initial payment configuration
  hasInitialPayment: z.boolean(),
  initialPaymentAmount: z.number().min(0).optional(),
  
  // Recurring payment configuration
  equalRecurringPayments: z.boolean(),
  recurringPaymentAmount: z.number().min(0).optional(),
  
  // Custom payment amounts (for non-equal payments)
  paymentPlanCosts: z.array(z.number().positive()).optional(),
}).refine((data) => {
  // If single payment, must have at least initial payment amount or payment costs
  if (data.paymentType === 'single') {
    return data.initialPaymentAmount !== undefined || 
           (data.paymentPlanCosts && data.paymentPlanCosts.length > 0);
  }
  
  // If recurring payment with equal amounts, must have recurring amount
  if (data.paymentType === 'recurring' && data.equalRecurringPayments) {
    return data.recurringPaymentAmount !== undefined;
  }
  
  // If recurring payment with custom amounts, must have payment costs
  if (data.paymentType === 'recurring' && !data.equalRecurringPayments) {
    return data.paymentPlanCosts && data.paymentPlanCosts.length > 0;
  }
  
  return true;
}, {
  message: "Please configure payment amounts properly",
  path: ["paymentPlanCosts"]
});

type PaymentPlanFormData = z.infer<typeof paymentPlanSchema>;

export interface PaymentPlanFormProps {
  initialData?: {
    paymentType?: 'single' | 'recurring';
    dateFirstPayment?: string;
    dateEndRecurring?: string;
    paymentPlanSchedule?: string;
    paymentPlanCustomDates?: string[];
    hasInitialPayment?: boolean;
    initialPaymentAmount?: number;
    equalRecurringPayments?: boolean;
    recurringPaymentAmount?: number;
    paymentPlanCosts?: number[];
    // Legacy support
    paymentPlanStartDate?: string;
  };
  totalAmount?: number;
  onSave: (data: PaymentPlanFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * Form component for creating and editing payment plans
 * Supports different payment schedules and custom payment amounts
 */
export function PaymentPlanForm({
  initialData,
  totalAmount = 0,
  onSave,
  onCancel,
  isLoading = false,
}: PaymentPlanFormProps) {
  const { t } = useLanguage();
  const [customDates, setCustomDates] = useState<string[]>(
    initialData?.paymentPlanCustomDates || []
  );

  const form = useForm<PaymentPlanFormData>({
    resolver: zodResolver(paymentPlanSchema),
    defaultValues: {
      paymentType: initialData?.paymentType || 'single',
      dateFirstPayment: initialData?.dateFirstPayment || 
        initialData?.paymentPlanStartDate || // Legacy support
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 week from now
      dateEndRecurring: initialData?.dateEndRecurring,
      paymentPlanSchedule: (initialData?.paymentPlanSchedule as any) || 'monthly',
      paymentPlanCustomDates: initialData?.paymentPlanCustomDates || [],
      hasInitialPayment: initialData?.hasInitialPayment ?? false,
      initialPaymentAmount: initialData?.initialPaymentAmount || 0,
      equalRecurringPayments: initialData?.equalRecurringPayments ?? true,
      recurringPaymentAmount: initialData?.recurringPaymentAmount || (totalAmount || 100),
      paymentPlanCosts: initialData?.paymentPlanCosts || [totalAmount || 100],
    },
  });

  const watchedPaymentType = form.watch('paymentType');
  const watchedSchedule = form.watch('paymentPlanSchedule');
  const watchedCosts = form.watch('paymentPlanCosts') || [];
  const watchedHasInitialPayment = form.watch('hasInitialPayment');
  const watchedInitialPaymentAmount = form.watch('initialPaymentAmount') || 0;
  const watchedEqualRecurringPayments = form.watch('equalRecurringPayments');
  const watchedRecurringPaymentAmount = form.watch('recurringPaymentAmount') || 0;

  // Calculate number of recurring payments based on schedule and date range
  const calculateRecurringPaymentCount = () => {
    if (watchedPaymentType !== 'recurring' || !watchedEqualRecurringPayments) return 0;
    
    const dateFirst = form.watch('dateFirstPayment');
    const dateEnd = form.watch('dateEndRecurring');
    
    if (watchedSchedule === 'custom') {
      return Math.max(customDates.length, 1);
    }
    
    if (!dateEnd || !dateFirst) {
      // Default to a reasonable number if dates not set
      return watchedCosts.length > 0 ? watchedCosts.length : 3;
    }
    
    const start = new Date(dateFirst);
    const end = new Date(dateEnd);
    const daysDiff = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    
    let count = 1; // At least one payment (inclusive)
    
    switch (watchedSchedule) {
      case 'weekly':
        count = Math.max(1, Math.ceil(daysDiff / 7));
        break;
      case 'monthly':
        const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        count = Math.max(1, monthsDiff + 1); // Add 1 for inclusive counting
        break;
      case 'quarterly':
        count = Math.max(1, Math.ceil(daysDiff / (365.25 / 4)));
        break;
      case 'yearly':
        count = Math.max(1, Math.ceil(daysDiff / 365.25));
        break;
      default:
        count = watchedCosts.length > 0 ? watchedCosts.length : 3;
    }
    
    return count;
  };

  // Calculate total from payment costs or from configured amounts
  const calculatedTotal = () => {
    const initialAmount = watchedHasInitialPayment ? watchedInitialPaymentAmount : 0;
    
    if (watchedPaymentType === 'single') {
      return initialAmount + watchedCosts.reduce((sum, cost) => sum + (cost || 0), 0);
    } else if (watchedPaymentType === 'recurring') {
      if (watchedEqualRecurringPayments) {
        // For equal recurring payments, multiply by number of expected payments
        const recurringCount = calculateRecurringPaymentCount();
        return initialAmount + (watchedRecurringPaymentAmount * recurringCount);
      } else {
        return initialAmount + watchedCosts.reduce((sum, cost) => sum + (cost || 0), 0);
      }
    }
    return watchedCosts.reduce((sum, cost) => sum + (cost || 0), 0);
  };

  const total = calculatedTotal();

  // Add a new payment to the costs array
  const addPayment = () => {
    const currentCosts = form.getValues('paymentPlanCosts') || [];
    const remainingAmount = Math.max(0, totalAmount - total);
    const newAmount = remainingAmount > 0 ? remainingAmount : 100;
    
    form.setValue('paymentPlanCosts', [...currentCosts, newAmount]);
  };

  // Remove a payment from the costs array
  const removePayment = (index: number) => {
    const currentCosts = form.getValues('paymentPlanCosts');
    if (currentCosts.length > 1) {
      const newCosts = currentCosts.filter((_, i) => i !== index);
      form.setValue('paymentPlanCosts', newCosts);
    }
  };

  // Update a specific payment amount
  const updatePayment = (index: number, value: number) => {
    const currentCosts = form.getValues('paymentPlanCosts');
    const newCosts = [...currentCosts];
    newCosts[index] = value;
    form.setValue('paymentPlanCosts', newCosts);
  };

  // Add custom date
  const addCustomDate = () => {
    const newDate = new Date().toISOString().split('T')[0];
    const newDates = [...customDates, newDate];
    setCustomDates(newDates);
    form.setValue('paymentPlanCustomDates', newDates);
  };

  // Remove custom date
  const removeCustomDate = (index: number) => {
    const newDates = customDates.filter((_, i) => i !== index);
    setCustomDates(newDates);
    form.setValue('paymentPlanCustomDates', newDates);
  };

  // Update custom date
  const updateCustomDate = (index: number, value: string) => {
    const newDates = [...customDates];
    newDates[index] = value;
    setCustomDates(newDates);
    form.setValue('paymentPlanCustomDates', newDates);
  };

  // Distribute total amount evenly across payments
  const distributeEvenly = () => {
    const currentCosts = form.getValues('paymentPlanCosts') || [];
    const numPayments = currentCosts.length;
    const amountPerPayment = totalAmount / numPayments;
    const evenlyDistributed = Array(numPayments).fill(Math.round(amountPerPayment * 100) / 100);
    
    form.setValue('paymentPlanCosts', evenlyDistributed);
  };

  const onSubmit = (data: PaymentPlanFormData) => {
    // Only include custom dates if using custom schedule
    const submissionData = {
      ...data,
      paymentPlanCustomDates: data.paymentPlanSchedule === 'custom' ? customDates : undefined,
    };
    onSave(submissionData);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Payment Plan Setup
        </CardTitle>
        <CardDescription>
          {t('wfPaymentConfigDescription')}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Payment Type */}
            <FormField
              control={form.control}
              name="paymentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-payment-type">
                        <SelectValue placeholder="Choose payment type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="single">Single Payment</SelectItem>
                      <SelectItem value="recurring">Recurring Payments</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('wfPaymentTypeDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Schedule (only for recurring payments) */}
            {watchedPaymentType === 'recurring' && (
              <FormField
                control={form.control}
                name="paymentPlanSchedule"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Schedule</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-payment-schedule">
                          <SelectValue placeholder="Select payment schedule" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="custom">Custom Dates</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* First Payment Date */}
            <FormField
              control={form.control}
              name="dateFirstPayment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date First Payment</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      data-testid="input-first-payment-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* End Date for Recurring Payments */}
            {watchedPaymentType === 'recurring' && (
              <FormField
                control={form.control}
                name="dateEndRecurring"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('wfPaymentEndRecurringLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-end-recurring-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Custom Dates (only for custom schedule) */}
            {watchedPaymentType === 'recurring' && watchedSchedule === 'custom' && (
              <div className="space-y-3">
                <Label>Custom Payment Dates</Label>
                {customDates.map((date, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => updateCustomDate(index, e.target.value)}
                      data-testid={`input-custom-date-${index}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeCustomDate(index)}
                      disabled={customDates.length <= 1}
                      data-testid={`button-remove-date-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCustomDate}
                  data-testid="button-add-custom-date"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Date
                </Button>
              </div>
            )}

            {/* Initial Payment Configuration - hide when custom schedule is selected */}
            {watchedSchedule !== 'custom' && (
            <FormField
              control={form.control}
              name="hasInitialPayment"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-has-initial-payment"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Has initial payment
                    </FormLabel>
                    <FormDescription>
                      {t('wfPaymentInitialDescription')}
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            )}

            {/* Initial Payment Amount */}
            {watchedHasInitialPayment && (
              <FormField
                control={form.control}
                name="initialPaymentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Payment Amount</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          className="pl-10"
                          data-testid="input-initial-payment-amount"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Recurring Payment Configuration (only for recurring payments, hide when custom schedule is selected) */}
            {watchedPaymentType === 'recurring' && watchedSchedule !== 'custom' && (
              <>
                <FormField
                  control={form.control}
                  name="equalRecurringPayments"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-equal-recurring-payments"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Equal recurring payments
                        </FormLabel>
                        <FormDescription>
                          {t('wfPaymentEqualRecurringDesc')}
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Recurring Payment Amount */}
                {watchedEqualRecurringPayments && (
                  <FormField
                    control={form.control}
                    name="recurringPaymentAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recurring Payment Amount</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              className="pl-10"
                              data-testid="input-recurring-payment-amount"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}

            {/* Payment Amounts - show for single payments or non-equal recurring payments */}
            {(watchedPaymentType === 'single' || (watchedPaymentType === 'recurring' && !watchedEqualRecurringPayments)) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Payment Amounts</Label>
                <div className="flex items-center gap-2">
                  {totalAmount > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={distributeEvenly}
                      data-testid="button-distribute-evenly"
                    >
                      <Calculator className="h-4 w-4 mr-2" />
                      Distribute Evenly
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPayment}
                    data-testid="button-add-payment"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Payment
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {watchedCosts.map((cost, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Label className="min-w-20">Payment {index + 1}</Label>
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={cost || ''}
                        onChange={(e) => updatePayment(index, parseFloat(e.target.value) || 0)}
                        className="pl-10"
                        data-testid={`input-payment-amount-${index}`}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removePayment(index)}
                      disabled={watchedCosts.length <= 1}
                      data-testid={`button-remove-payment-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              </div>
            )}

            {/* Payment Summary - always visible */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="space-y-1">
                <div className="text-sm font-medium">Payment Summary</div>
                <div className="text-xs text-muted-foreground">
                  {watchedPaymentType === 'single' 
                    ? `Single payment${watchedHasInitialPayment ? ' with initial payment' : ''}` 
                    : watchedEqualRecurringPayments 
                    ? `${calculateRecurringPaymentCount()} equal recurring payments${watchedHasInitialPayment ? ' + initial payment' : ''}` 
                    : `${watchedCosts.length} custom payment${watchedCosts.length !== 1 ? 's' : ''}${watchedHasInitialPayment ? ' + initial payment' : ''}`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold">
                  ${total.toFixed(2)}
                </div>
                {totalAmount > 0 && Math.abs(total - totalAmount) > 0.01 && (
                  <Badge variant="outline" className="text-xs">
                    {total > totalAmount ? 'Over' : 'Under'} by ${Math.abs(total - totalAmount).toFixed(2)}
                  </Badge>
                )}
              </div>
            </div>

            {/* Validation alerts */}
            {totalAmount > 0 && Math.abs(total - totalAmount) > 0.01 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {t('wfPaymentMismatchWarning', {
                    planTotal: `$${total.toFixed(2)}`,
                    vendorPrice: `$${totalAmount.toFixed(2)}`,
                  })}
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
                data-testid="button-cancel-payment-plan"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-save-payment-plan"
              >
                {isLoading ? 'Saving...' : 'Save Payment Plan'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}