import { Control, FieldPath, FieldValues } from 'react-hook-form';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface StandaloneDatePickerProps {
  value: Date | null | undefined;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function StandaloneDatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled = false,
  className = '',
  'data-testid': testId,
}: StandaloneDatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full pl-3 text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
          data-testid={testId}
        >
          {value ? (
            format(value, 'PPP')
          ) : (
            <span>{placeholder}</span>
          )}
          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(date) => {
            if (!disabled) onChange(date ?? null);
          }}
          disabled={disabled}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

interface DatePickerFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: (date: Date) => boolean;
  'data-testid'?: string;
}

export function DatePickerField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = 'Pick a date',
  required = false,
  disabled = false,
  className = '',
  minDate,
  maxDate,
  disabledDates,
  'data-testid': testId,
}: DatePickerFieldProps<T>) {
  const displayLabel = required ? `${label} *` : label;
  const defaultTestId = testId || `button-${String(name).replace(/\./g, '-')}`;

  const isDateDisabled = (date: Date) => {
    if (disabledDates) return disabledDates(date);
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn(className)}>
          {displayLabel && <FormLabel>{displayLabel}</FormLabel>}
          <Popover>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant="outline"
                  disabled={disabled}
                  className={cn(
                    "w-full pl-3 text-left font-normal",
                    !field.value && "text-muted-foreground"
                  )}
                  data-testid={defaultTestId}
                >
                  {field.value ? (
                    format(field.value, "PPP")
                  ) : (
                    <span>{placeholder}</span>
                  )}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={field.value}
                onSelect={field.onChange}
                disabled={isDateDisabled}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
