import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ScrollableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  testId?: string;
}

/**
 * A reusable scrollable dialog component that ensures forms fit in the screen
 * and are scrollable when content exceeds viewport height.
 *
 * Features:
 * - Responsive height constraint (90% of viewport)
 * - Fixed header and footer
 * - Scrollable content area
 * - Consistent styling across all forms
 */
export function ScrollableDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
  maxWidth = 'lg',
  testId = 'scrollable-dialog',
}: ScrollableDialogProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-full',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Base layout and constraints
          maxWidthClasses[maxWidth],
          'max-h-[90vh]',
          'overflow-hidden',
          'flex',
          'flex-col',
          // Responsive padding
          'p-0',
          className
        )}
        data-testid={testId}
      >
        {/* Fixed Header */}
        <DialogHeader className={cn('flex-shrink-0', 'px-6 pt-6 pb-4', 'border-b border-gray-100')}>
          <DialogTitle data-testid={`${testId}-title`}>{title}</DialogTitle>
          {description && (
            <DialogDescription data-testid={`${testId}-description`}>
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Scrollable Content Area */}
        <div
          className={cn(
            'flex-1',
            'overflow-y-auto',
            'px-6',
            'py-4',
            // Custom scrollbar styling
            'scrollbar-thin',
            'scrollbar-thumb-gray-300',
            'scrollbar-track-gray-100',
            contentClassName
          )}
          data-testid={`${testId}-content`}
        >
          {children}
        </div>

        {/* Fixed Footer */}
        {footer && (
          <DialogFooter
            className={cn('flex-shrink-0', 'px-6 pb-6 pt-4', 'border-t border-gray-100', 'gap-2')}
            data-testid={`${testId}-footer`}
          >
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to provide consistent form dialog state management
 */
export function useFormDialog(initialOpen = false) {
  const [isOpen, setIsOpen] = React.useState(initialOpen);
  const [isLoading, setIsLoading] = React.useState(false);

  const openDialog = React.useCallback(() => setIsOpen(true), []);
  const closeDialog = React.useCallback(() => {
    if (!isLoading) {
      setIsOpen(false);
    }
  }, [isLoading]);

  const handleSubmit = React.useCallback(async (submitFn: () => Promise<void>) => {
    try {
      setIsLoading(true);
      await submitFn();
      setIsOpen(false);
      // Error handling is done by the calling component
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isOpen,
    isLoading,
    openDialog,
    closeDialog,
    handleSubmit,
    setIsLoading,
  };
}

/**
 * Utility component for form sections within scrollable dialogs
 */
export function DialogSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4', className)}>
      {title && (
        <h3 className='text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2'>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
