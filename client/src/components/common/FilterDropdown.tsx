import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 *
 */
export interface FilterOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 *
 */
interface FilterDropdownProps {
  value: string;
  onValueChange: (value: string) => void;
  options: FilterOption[];
  placeholder?: string;
  width?: string;
  disabled?: boolean;
  'data-testid'?: string;
  className?: string;
}

/**
 * Reusable filter dropdown component
 * Standardizes the select dropdown pattern used across filtering components.
 * @param root0
 * @param root0.value
 * @param root0.onValueChange
 * @param root0.options
 * @param root0.placeholder
 * @param root0.width
 * @param root0.disabled
 * @param root0.'data-testid'
 * @param root0.className
 */
export function FilterDropdown({
  value,
  onValueChange,
  options,
  placeholder = 'Select option',
  width = 'w-40',
  disabled = false,
  'data-testid': testId,
  className = '',
}: FilterDropdownProps) {
  return (
    <Select 
      value={value} 
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger 
        className={`${width} ${className}`}
        data-testid={testId}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem 
            key={option.value} 
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default FilterDropdown;