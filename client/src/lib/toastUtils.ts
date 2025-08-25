import { toast } from '@/hooks/use-toast';

/**
 * Common toast utilities for consistent error and success messaging.
 */
export const toastUtils = {
  success: (title: string, description?: string) => {
    toast({
      title,
      description,
    });
  },

  error: (title: string, description?: string) => {
    toast({
      title,
      description,
      variant: 'destructive',
    });
  },

  // Common error patterns
  createError: (entity: string) => {
    toast({
      title: 'Error',
      description: `Failed to create ${entity}`,
      variant: 'destructive',
    });
  },

  updateError: (entity: string) => {
    toast({
      title: 'Error',
      description: `Failed to update ${entity}`,
      variant: 'destructive',
    });
  },

  deleteError: (entity: string) => {
    toast({
      title: 'Error',
      description: `Failed to delete ${entity}`,
      variant: 'destructive',
    });
  },

  createSuccess: (entity: string) => {
    toast({
      title: 'Success',
      description: `${entity} created successfully`,
    });
  },

  updateSuccess: (entity: string) => {
    toast({
      title: 'Success',
      description: `${entity} updated successfully`,
    });
  },

  deleteSuccess: (entity: string) => {
    toast({
      title: 'Success',
      description: `${entity} deleted successfully`,
    });
  },
};

/**
 * Handle API errors with automatic toast display.
 * @param error
 * @param fallbackMessage
 */
export const handleApiError = (error: any, fallbackMessage = 'An error occurred') => {
  const message = error?.response?.data?.message || error?.message || fallbackMessage;
  toastUtils.error('Error', message);
};
