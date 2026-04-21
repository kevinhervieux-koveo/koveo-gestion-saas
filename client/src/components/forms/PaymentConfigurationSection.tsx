/**
 * Reusable payment configuration section component.
 * Extracted from ModularBillForm.tsx to reduce duplication across financial forms.
 */
import { Control, FieldValues, FieldPath } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface PaymentConfigurationOption<T extends FieldValues> {
  name: FieldPath<T>;
  label: string;
  description: string;
  testId?: string;
}

interface PaymentConfigurationSectionProps<T extends FieldValues> {
  control: Control<T>;
  options: PaymentConfigurationOption<T>[];
  title?: string;
  description?: string;
  className?: string;
  'data-testid'?: string;
}

/**
 * Standardized payment configuration section with checkbox options.
 * Provides consistent styling and behavior for payment-related boolean configurations.
 */
export function PaymentConfigurationSection<T extends FieldValues>({
  control,
  options,
  title = 'Payment Configuration',
  description,
  className = '',
  'data-testid': testId = 'payment-config-section',
}: PaymentConfigurationSectionProps<T>) {
  return (
    <div className={cn('space-y-4', className)} data-testid={testId}>
      <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
        <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-4">
          {title}
        </h4>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {description}
          </p>
        )}
        
        <div className="space-y-4">
          {options.map((option, index) => (
            <FormField
              key={String(option.name)}
              control={control}
              name={option.name}
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-white dark:bg-gray-800">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-medium">
                      {option.label}
                    </FormLabel>
                    <FormDescription className="text-sm text-gray-600 dark:text-gray-400">
                      {option.description}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid={option.testId || `checkbox-${String(option.name).replace(/\./g, '-')}`}
                      className="h-4 w-4"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Pre-configured payment configuration section for bill forms.
 * Common configuration used in bill and invoice forms.
 */
interface BillPaymentConfigProps<T extends FieldValues> {
  control: Control<T>;
  hasInitialPaymentField: FieldPath<T>;
  recurringPaymentsEqualField: FieldPath<T>;
  className?: string;
}

export function BillPaymentConfigSection<T extends FieldValues>({
  control,
  hasInitialPaymentField,
  recurringPaymentsEqualField,
  className = '',
}: BillPaymentConfigProps<T>) {
  const options: PaymentConfigurationOption<T>[] = [
    {
      name: hasInitialPaymentField,
      label: 'Initial Payment',
      description: 'Is there an upfront payment different from recurring amounts?',
      testId: 'checkbox-initial-payment'
    },
    {
      name: recurringPaymentsEqualField,
      label: 'Equal Recurring Payments',
      description: 'Are all recurring payment amounts the same?',
      testId: 'checkbox-equal-payments'
    }
  ];

  return (
    <PaymentConfigurationSection
      control={control}
      options={options}
      title="Payment Configuration"
      className={className}
      data-testid="bill-payment-config"
    />
  );
}