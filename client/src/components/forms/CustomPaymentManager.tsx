/**
 * Reusable custom payment manager component.
 * Extracted from ModularBillForm.tsx to handle complex payment schedule management.
 */
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CustomPayment {
  amount: string;
  date: string;
  description?: string;
}

interface CustomPaymentManagerProps {
  /** Current list of custom payments */
  payments: CustomPayment[];
  /** Callback when payments are updated */
  onPaymentsChange: (payments: CustomPayment[]) => void;
  /** Schedule type for determining which fields to show */
  scheduleType: 'custom' | 'equal' | 'monthly' | 'weekly' | 'quarterly' | 'yearly';
  /** Whether dates should be shown (for custom schedules) */
  showDates?: boolean;
  /** Title for the section */
  title?: string;
  /** Description text */
  description?: string;
  /** Maximum date allowed for date inputs */
  maxDate?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for the component */
  'data-testid'?: string;
}

/**
 * Manages a list of custom payments with amounts, dates, and descriptions.
 * Provides add/remove functionality and validates input fields.
 */
export function CustomPaymentManager({
  payments,
  onPaymentsChange,
  scheduleType,
  showDates = false,
  title,
  description,
  maxDate,
  disabled = false,
  className = '',
  'data-testid': testId = 'custom-payment-manager',
}: CustomPaymentManagerProps) {
  // Auto-determine if dates should be shown based on schedule type
  const shouldShowDates = showDates || scheduleType === 'custom';
  
  // Default title and description based on schedule type
  const defaultTitle = scheduleType === 'custom' 
    ? 'Custom Payment Schedule' 
    : 'Individual Payment Amounts';
  
  const defaultDescription = scheduleType === 'custom'
    ? 'Define your custom payment schedule with specific dates and amounts.'
    : 'Since recurring payments are not equal, specify individual amounts for each payment. Dates will be calculated based on your selected schedule.';

  const displayTitle = title || defaultTitle;
  const displayDescription = description || defaultDescription;
  
  // Calculate max date (1 year from now if not provided)
  const calculatedMaxDate = maxDate || new Date(new Date().getFullYear() + 1, 11, 31).toISOString().split('T')[0];

  const addPayment = useCallback(() => {
    if (disabled) return;
    
    const newPayment: CustomPayment = {
      amount: '',
      date: '',
      description: ''
    };
    onPaymentsChange([...payments, newPayment]);
  }, [payments, onPaymentsChange, disabled]);

  const removePayment = useCallback((index: number) => {
    if (disabled) return;
    
    const updatedPayments = payments.filter((_, i) => i !== index);
    onPaymentsChange(updatedPayments);
  }, [payments, onPaymentsChange, disabled]);

  const updatePayment = useCallback((index: number, field: keyof CustomPayment, value: string) => {
    if (disabled) return;
    
    const updatedPayments = payments.map((payment, i) => 
      i === index ? { ...payment, [field]: value } : payment
    );
    onPaymentsChange(updatedPayments);
  }, [payments, onPaymentsChange, disabled]);

  return (
    <Card className={cn('w-full', className)} data-testid={testId}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{displayTitle}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addPayment}
            disabled={disabled}
            data-testid="button-add-payment"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Payment
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {displayDescription}
        </div>
        
        <div className="max-h-60 overflow-y-auto space-y-3">
          {payments.map((payment, index) => (
            <div 
              key={index} 
              className="flex gap-2 items-end p-3 border rounded bg-white dark:bg-gray-800"
              data-testid={`payment-item-${index}`}
            >
              {/* Amount Field */}
              <div className="flex-1">
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  Amount *
                </label>
                <Input
                  placeholder="0.00"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="999999.99"
                  value={payment.amount}
                  onChange={(e) => updatePayment(index, 'amount', e.target.value)}
                  disabled={disabled}
                  className="mt-1"
                  data-testid={`input-payment-amount-${index}`}
                />
              </div>
              
              {/* Date Field (only for custom schedules) */}
              {shouldShowDates && (
                <div className="flex-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400">
                    Date *
                  </label>
                  <Input
                    type="date"
                    value={payment.date}
                    onChange={(e) => updatePayment(index, 'date', e.target.value)}
                    max={calculatedMaxDate}
                    disabled={disabled}
                    className="mt-1"
                    data-testid={`input-payment-date-${index}`}
                  />
                </div>
              )}
              
              {/* Description Field */}
              <div className="flex-1">
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  Description
                </label>
                <Input
                  placeholder={shouldShowDates ? 'Payment description' : `Payment ${index + 1}`}
                  value={payment.description || ''}
                  onChange={(e) => updatePayment(index, 'description', e.target.value)}
                  disabled={disabled}
                  className="mt-1"
                  data-testid={`input-payment-description-${index}`}
                />
              </div>
              
              {/* Remove Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removePayment(index)}
                disabled={disabled}
                className="flex-shrink-0"
                data-testid={`button-remove-payment-${index}`}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        
        {/* Empty State */}
        {payments.length === 0 && (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No payments added yet</p>
            <p className="text-xs">Click "Add Payment" to get started</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Hook for managing custom payment state.
 * Provides validation and helper functions for payment management.
 */
export function useCustomPayments(initialPayments: CustomPayment[] = []) {
  const [payments, setPayments] = useState<CustomPayment[]>(initialPayments);

  const addPayment = useCallback(() => {
    const newPayment: CustomPayment = {
      amount: '',
      date: '',
      description: ''
    };
    setPayments(prev => [...prev, newPayment]);
  }, []);

  const removePayment = useCallback((index: number) => {
    setPayments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updatePayment = useCallback((index: number, field: keyof CustomPayment, value: string) => {
    setPayments(prev => prev.map((payment, i) => 
      i === index ? { ...payment, [field]: value } : payment
    ));
  }, []);

  const clearPayments = useCallback(() => {
    setPayments([]);
  }, []);

  const getTotalAmount = useCallback(() => {
    return payments.reduce((sum, payment) => {
      const amount = parseFloat(payment.amount || '0');
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
  }, [payments]);

  const isValid = useCallback(() => {
    return payments.every(payment => {
      const amount = parseFloat(payment.amount || '0');
      return !isNaN(amount) && amount > 0;
    });
  }, [payments]);

  return {
    payments,
    setPayments,
    addPayment,
    removePayment,
    updatePayment,
    clearPayments,
    getTotalAmount,
    isValid,
  };
}