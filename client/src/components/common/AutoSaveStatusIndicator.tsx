/**
 * Reusable auto-save status indicator component.
 * Extracted from ModularBillForm.tsx to reduce duplication across forms.
 */
import { cn } from '@/lib/utils';

export interface AutoSaveStatusIndicatorProps {
  /** Whether auto-save is currently in progress */
  isAutoSaving: boolean;
  /** Current auto-save status message */
  autoSaveStatus: string | null;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for the component */
  'data-testid'?: string;
}

/**
 * Status indicator for auto-save functionality with consistent styling.
 * Shows loading state and status messages with appropriate colors.
 */
export function AutoSaveStatusIndicator({
  isAutoSaving,
  autoSaveStatus,
  className = '',
  'data-testid': testId = 'autosave-status',
}: AutoSaveStatusIndicatorProps) {
  // Don't render if no status to show
  if (!isAutoSaving && !autoSaveStatus) {
    return null;
  }

  return (
    <div 
      className={cn(
        'flex items-center justify-center gap-2 p-2 text-sm',
        'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg',
        className
      )}
      data-testid={testId}
    >
      {isAutoSaving && (
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      )}
      <span className={cn(
        'font-medium',
        autoSaveStatus === 'Saved' && 'text-green-600 dark:text-green-400',
        autoSaveStatus === 'Save failed' && 'text-red-600 dark:text-red-400',
        (isAutoSaving || autoSaveStatus === 'Saving...') && 'text-blue-600 dark:text-blue-400',
        autoSaveStatus === 'Draft' && 'text-gray-600 dark:text-gray-400',
        autoSaveStatus === 'No changes' && 'text-gray-600 dark:text-gray-400'
      )}>
        {isAutoSaving ? 'Auto-saving...' : autoSaveStatus}
      </span>
    </div>
  );
}