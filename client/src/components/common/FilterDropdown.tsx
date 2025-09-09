import { SearchableSelect, SearchableSelectOption } from '@/components/ui/searchable-select';

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
  searchPlaceholder?: string;
  width?: string;
  disabled?: boolean;
  'data-testid'?: string;
  className?: string;
}

/**
 * Reusable filter dropdown component with search functionality
 * Standardizes the searchable select dropdown pattern used across filtering components.
 * @param root0
 * @param root0.value
 * @param root0.onValueChange
 * @param root0.options
 * @param root0.placeholder
 * @param root0.searchPlaceholder
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
  searchPlaceholder = 'Search options...',
  width = 'w-40',
  disabled = false,
  'data-testid': testId,
  className = '',
}: FilterDropdownProps) {
  const searchableOptions: SearchableSelectOption[] = options.map(option => ({
    value: option.value,
    label: option.label,
    disabled: option.disabled,
  }));

  return (
    <SearchableSelect
      value={value}
      onValueChange={onValueChange}
      options={searchableOptions}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      width={width}
      disabled={disabled}
      data-testid={testId}
      className={className}
    />
  );
}

export default FilterDropdown;
