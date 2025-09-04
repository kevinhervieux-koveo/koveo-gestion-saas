import { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DialogWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  showDefaultButtons?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  isLoading?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  testId?: string;
}

export function DialogWrapper({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  showDefaultButtons = false,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  isLoading = false,
  maxWidth = 'md',
  testId,
}: DialogWrapperProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className={`${maxWidthClasses[maxWidth]} max-h-[90vh] overflow-y-auto`}
        data-testid={testId}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          {children}
        </div>

        {(footer || showDefaultButtons) && (
          <DialogFooter>
            {footer || (
              showDefaultButtons && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isLoading}
                    data-testid="button-cancel"
                  >
                    {cancelText}
                  </Button>
                  <Button
                    type="submit"
                    onClick={onConfirm}
                    disabled={isLoading}
                    data-testid="button-confirm"
                  >
                    {confirmText}
                  </Button>
                </>
              )
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}