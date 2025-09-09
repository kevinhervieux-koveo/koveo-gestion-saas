import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface StandardFormConfig<T extends z.ZodType<any>> {
  schema: T;
  defaultValues: Partial<z.infer<T>>;
  apiEndpoint: string;
  queryKey: string[];
  mode?: 'create' | 'edit';
  itemId?: string;
  onSuccess?: () => void;
  successMessages?: {
    create?: string;
    update?: string;
  };
}

interface StandardFormReturn<T> extends UseFormReturn<T> {
  handleSubmit: (onValid: (data: T) => void) => (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
  submitMutation: {
    mutate: (data: T) => void;
    isPending: boolean;
  };
}

/**
 * Standard form hook that consolidates common form patterns across the app.
 * Combines useForm + zodResolver + useMutation with standardized error handling and toast notifications.
 * 
 * @param config - Configuration object with schema, defaultValues, API endpoint, etc.
 * @returns Extended form object with standardized submission handling
 */
export function useStandardForm<T extends z.ZodType<any>>({
  schema,
  defaultValues,
  apiEndpoint,
  queryKey,
  mode = 'create',
  itemId,
  onSuccess,
  successMessages = {
    create: 'Item created successfully',
    update: 'Item updated successfully',
  },
}: StandardFormConfig<T>): StandardFormReturn<z.infer<T>> {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<T>) => {
      const response = await apiRequest('POST', apiEndpoint, data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to create item`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: successMessages.create,
      });
      queryClient.invalidateQueries({ queryKey });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<T>) => {
      if (!itemId) throw new Error('Item ID is required for update');
      const response = await apiRequest('PUT', `${apiEndpoint}/${itemId}`, data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to update item`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: successMessages.update,
      });
      queryClient.invalidateQueries({ queryKey });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const submitMutation = mode === 'create' ? createMutation : updateMutation;
  const isSubmitting = submitMutation.isPending;

  const handleSubmit = useCallback(
    (onValid: (data: z.infer<T>) => void) => {
      return form.handleSubmit((data) => {
        // Allow for custom data transformation before submission
        onValid(data);
      });
    },
    [form]
  );

  return {
    ...form,
    handleSubmit,
    isSubmitting,
    submitMutation,
  };
}