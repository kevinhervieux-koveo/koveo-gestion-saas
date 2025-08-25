import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Control, FieldPath, FieldValues } from 'react-hook-form';

/**
 *
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 *
 */
interface FormSelectProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
  description?: string;
  className?: string;
}

/**
 * Reusable form select component with proper React Hook Form integration
 * Eliminates repetitive form field patterns across forms.
 * @param root0
 * @param root0.control
 * @param root0.name
 * @param root0.label
 * @param root0.options
 * @param root0.placeholder
 * @param root0.required
 * @param root0.disabled
 * @param root0.'data-testid'
 * @param root0.description
 * @param root0.className
 */
export function FormSelect<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder = 'Select an option',
  required = false,
  disabled = false,
  'data-testid': testId,
  description,
  className = '',
}: FormSelectProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            {required && <span className='text-red-500 ml-1'>*</span>}
          </FormLabel>
          <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
            <FormControl>
              <SelectTrigger data-testid={testId}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <div className='text-sm text-muted-foreground'>{description}</div>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export default FormSelect;
