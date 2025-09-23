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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import {
  CalendarIcon,
  DollarSign,
  Plus,
  Trash2,
  Info,
  Calculator,
} from 'lucide-react';

// Payment plan form schema
const paymentPlanSchema = z.object({
  paymentPlanCosts: z.array(z.number().positive()).min(1, 'At least one payment is required'),
  paymentPlanSchedule: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'custom']),
  paymentPlanStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  paymentPlanCustomDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
});

type PaymentPlanFormData = z.infer<typeof paymentPlanSchema>;

export interface PaymentPlanFormProps {
  initialData?: {
    paymentPlanCosts?: number[];
    paymentPlanSchedule?: string;
    paymentPlanStartDate?: string;
    paymentPlanCustomDates?: string[];
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
  const [customDates, setCustomDates] = useState<string[]>(
    initialData?.paymentPlanCustomDates || []
  );

  const form = useForm<PaymentPlanFormData>({
    resolver: zodResolver(paymentPlanSchema),
    defaultValues: {
      paymentPlanCosts: initialData?.paymentPlanCosts || [totalAmount || 100],
      paymentPlanSchedule: (initialData?.paymentPlanSchedule as any) || 'monthly',
      paymentPlanStartDate: initialData?.paymentPlanStartDate || 
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 week from now
      paymentPlanCustomDates: initialData?.paymentPlanCustomDates || [],
    },
  });

  const watchedSchedule = form.watch('paymentPlanSchedule');
  const watchedCosts = form.watch('paymentPlanCosts');

  // Calculate total from payment costs
  const calculatedTotal = watchedCosts.reduce((sum, cost) => sum + (cost || 0), 0);

  // Add a new payment to the costs array
  const addPayment = () => {
    const currentCosts = form.getValues('paymentPlanCosts');
    const remainingAmount = Math.max(0, totalAmount - calculatedTotal);
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
    const currentCosts = form.getValues('paymentPlanCosts');
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
          Configure payment schedule and amounts for this vendor submission
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Payment Schedule */}
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

            {/* Start Date */}
            <FormField
              control={form.control}
              name="paymentPlanStartDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Start Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      data-testid="input-payment-start-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Custom Dates (only for custom schedule) */}
            {watchedSchedule === 'custom' && (
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

            {/* Payment Amounts */}
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

              {/* Payment Summary */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Payment Summary</div>
                  <div className="text-xs text-muted-foreground">
                    {watchedCosts.length} payment{watchedCosts.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">
                    ${calculatedTotal.toFixed(2)}
                  </div>
                  {totalAmount > 0 && calculatedTotal !== totalAmount && (
                    <Badge variant="outline" className="text-xs">
                      {calculatedTotal > totalAmount ? 'Over' : 'Under'} by ${Math.abs(calculatedTotal - totalAmount).toFixed(2)}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Validation alerts */}
              {totalAmount > 0 && Math.abs(calculatedTotal - totalAmount) > 0.01 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Payment plan total (${calculatedTotal.toFixed(2)}) does not match the vendor price (${totalAmount.toFixed(2)})
                  </AlertDescription>
                </Alert>
              )}
            </div>

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