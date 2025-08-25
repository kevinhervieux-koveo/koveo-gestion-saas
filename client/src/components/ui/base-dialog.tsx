import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';

/**
 * Props for the BaseDialog component.
 * Standardizes dialog structure and common functionality.
 */
interface BaseDialogProps {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  confirmDisabled?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showFooter?: boolean;
  footerContent?: React.ReactNode;
  className?: string;
}

/**
 * Base Dialog Component
 *
 * Provides standardized dialog structure with consistent styling,
 * loading states, and action handling across the application.
 *
 * @param props - Dialog configuration and content
 * @returns Standardized dialog component
 */
/**
 * BaseDialog function
 * @returns Function result
 */
export function BaseDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  isLoading = false,
  confirmDisabled = false,
  maxWidth = 'md',
  showFooter = true,
  footerContent,
  className = '',
}: BaseDialogProps) {
  const { t } = useLanguage();

  const maxWidthClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'max-w-2xl',
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${maxWidthClasses[maxWidth]} max-h-[90vh] overflow-y-auto ${className}`}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className='py-4'>{children}</div>

        {showFooter && (
          <DialogFooter className='flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2'>
            {footerContent || (
              <>
                <Button type='button' variant='outline' onClick={handleCancel} disabled={isLoading}>
                  {cancelText || t('cancel')}
                </Button>

                {onConfirm && (
                  <Button type='button' onClick={onConfirm} disabled={confirmDisabled || isLoading}>
                    {isLoading ? (
                      <>
                        <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2' />
                        {t('processing')}
                      </>
                    ) : (
                      confirmText || t('confirm')
                    )}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
