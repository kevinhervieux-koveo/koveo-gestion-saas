import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

interface ClearFiltersProps {
  onClear: () => void;
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'icon';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  disabled?: boolean;
  hasActiveFilters?: boolean;
}

/**
 * Reusable ClearFilters component for resetting filter states across the app.
 * @param props.onClear - Function to call when clear button is clicked
 * @param props.className - Optional CSS classes to apply
 * @param props.size - Button size variant
 * @param props.variant - Button style variant
 * @param props.disabled - Whether the button is disabled
 * @param props.hasActiveFilters - Whether there are active filters (controls visibility)
 */
export function ClearFilters({
  onClear,
  className = '',
  size = 'sm',
  variant = 'outline',
  disabled = false,
  hasActiveFilters = true,
}: ClearFiltersProps) {
  const { t } = useLanguage();

  // Don't render if no active filters (optional behavior)
  if (!hasActiveFilters) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClear}
      disabled={disabled}
      className={`flex items-center gap-1 ${className}`}
      data-testid="button-clear-filters"
    >
      <X className="w-3 h-3" />
      {t('clearFilters')}
    </Button>
  );
}