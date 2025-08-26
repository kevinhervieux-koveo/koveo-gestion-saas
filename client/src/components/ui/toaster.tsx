import { useToast } from '@/hooks/use-toast';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';

/**

 * Toaster function

 * @returns Function result

 */

/**
 * Toaster function.
 */
export function /**
 * Toaster function.
 */ /**
 * Toaster function.
 */  /**
   * Toaster function.
   */


Toaster() {
  const { toasts } = useToast(); /**
   * Return function.
   * @param <ToastProvider>
      {toasts.map(function ({ id - <ToastProvider>
      {toasts.map(function ({ id parameter.
   * @param title - title parameter.
   * @param description - description parameter.
   * @param action - action parameter.
   * @param ...props } - ...props } parameter.
   */

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className='grid gap-1'>
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
