import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { forwardRef } from 'react';

/**
 *
 */
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  iconColor?: 'gray' | 'muted';
  disabled?: boolean;
  'data-testid'?: string;
}

/**
 * Reusable search input component with search icon
 * Eliminates the repetitive search input pattern across the app.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  iconColor = 'muted',
  disabled = false,
  'data-testid': testId = 'search-input',
  ...props
}, ref) => {
  const iconColorClass = iconColor === 'gray' 
    ? 'text-gray-400' 
    : 'text-muted-foreground';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={`relative ${className}`}>
      <Search className={`absolute left-3 top-3 h-4 w-4 ${iconColorClass}`} />
      <Input
        ref={ref}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className="pl-10"
        data-testid={testId}
        {...props}
      />
    </div>
  );
});

SearchInput.displayName = 'SearchInput';

export default SearchInput;