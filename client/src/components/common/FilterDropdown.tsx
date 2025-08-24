import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface FilterOption {
  value: string;
  label: string;
  disabled?: boolean;
}

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
 * Standardizes the select dropdown pattern used across filtering components
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