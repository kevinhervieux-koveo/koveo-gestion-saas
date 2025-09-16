import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/searchable-select';
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
interface SearchableFormSelectProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
  description?: string;
  className?: string;
  width?: string;
}

/**
 * Reusable searchable form select component with proper React Hook Form integration
 * Provides search functionality for better UX with large option lists.
 * @param root0
 * @param root0.control
 * @param root0.name
 * @param root0.label
 * @param root0.options
 * @param root0.placeholder
 * @param root0.searchPlaceholder
 * @param root0.required
 * @param root0.disabled
 * @param root0.'data-testid'
 * @param root0.description
 * @param root0.className
 * @param root0.width
 */
export function SearchableFormSelect<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search options...',
  required = false,
  disabled = false,
  'data-testid': testId,
  description,
  className = '',
  width = 'w-full',
}: SearchableFormSelectProps<T>) {
  const searchableOptions: SearchableSelectOption[] = options.map(option => ({
    value: option.value,
    label: option.label,
    disabled: option.disabled,
  }));

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
          <FormControl>
            <SearchableSelect
              value={field.value}
              onValueChange={field.onChange}
              options={searchableOptions}
              placeholder={placeholder}
              searchPlaceholder={searchPlaceholder}
              disabled={disabled}
              data-testid={testId}
              width={width}
            />
          </FormControl>
          {description && <div className='text-sm text-muted-foreground'>{description}</div>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export default SearchableFormSelect;