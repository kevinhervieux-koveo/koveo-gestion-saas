/**
 * Common React hooks used throughout the application.
 * Consolidates frequently used hook patterns to reduce redundancy.
 */

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

/**
 * Common loading state hook.
 * @param initialState - Initial loading state.
 * @returns Loading state and setter.
 */
/**
 * UseLoadingState custom hook.
 * @returns Hook return value.
 */
/**
 * Use loading state function.
 * @param initialState = false - initialState = false parameter.
 */
export function /**
   * Use loading state function.
   * @param initialState = false - initialState = false parameter.
   */ /**
   * Use loading state function.
   * @param initialState = false - initialState = false parameter.
   */

 useLoadingState(initialState = false) {
  const [isLoading, setIsLoading] = useState(initialState);
  
  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);
  
  const withLoading = useCallback(async <T>(asyncFn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    try {
      const result = await asyncFn();
      return result;
    } finally {
      setLoading(false);
    }
  }, [setLoading]);
  
  return { isLoading, setLoading, withLoading };
}

/**
 * Common delete mutation hook.
 * @param config - Configuration for the delete mutation.
 * @param config.deleteFn
 * @param config.successMessage
 * @param config.errorMessage
 * @param config.queryKeysToInvalidate
 * @returns Delete mutation.
 */
/**
 * UseDeleteMutation component.
 * @param props - Component props.
 * @param props.deleteFn - DeleteFn parameter.
 * @param props.successMessage = 'Item deleted successfully' - successMessage = 'Item deleted successfully' parameter.
 * @param props.errorMessage = 'Failed to delete item' - errorMessage = 'Failed to delete item' parameter.
 * @param props.queryKeysToInvalidate = [] - queryKeysToInvalidate = [] parameter.
 * @returns JSX element.
 */
/**
 * UseDeleteMutation component.
 * @param props - Component props.
 * @param props.deleteFn - DeleteFn parameter.
 * @param props.successMessage = 'Item deleted successfully' - successMessage = 'Item deleted successfully' parameter.
 * @param props.errorMessage = 'Failed to delete item' - errorMessage = 'Failed to delete item' parameter.
 * @param props.queryKeysToInvalidate = [] - queryKeysToInvalidate = [] parameter.
 * @returns JSX element.
 */
export function useDeleteMutation({
  deleteFn,
  successMessage = 'Item deleted successfully',
  errorMessage = 'Failed to delete item',
  queryKeysToInvalidate = [],
}: {
  deleteFn: (id: string) => Promise<unknown>;
  successMessage?: string;
  errorMessage?: string;
  queryKeysToInvalidate?: string[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFn,
    onSuccess: () => {
      toast({
        title: 'Success',
        description: successMessage,
      });
      // Invalidate related queries
      queryKeysToInvalidate.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Common create/update mutation hook.
 * @param config - Configuration for the mutation.
 * @param config.mutationFn
 * @param config.successMessage
 * @param config.errorMessage
 * @param config.queryKeysToInvalidate
 * @param config.onSuccessCallback
 * @returns Create/update mutation.
 */
/**
 * UseCreateUpdateMutation component.
 * @param props - Component props.
 * @param props.mutationFn - MutationFn parameter.
 * @param props.successMessage = 'Item saved successfully' - successMessage = 'Item saved successfully' parameter.
 * @param props.errorMessage = 'Failed to save item' - errorMessage = 'Failed to save item' parameter.
 * @param props.queryKeysToInvalidate = [] - queryKeysToInvalidate = [] parameter.
 * @param props.onSuccessCallback - OnSuccessCallback parameter.
 * @returns JSX element.
 */
/**
 * UseCreateUpdateMutation component.
 * @param props - Component props.
 * @param props.mutationFn - MutationFn parameter.
 * @param props.successMessage = 'Item saved successfully' - successMessage = 'Item saved successfully' parameter.
 * @param props.errorMessage = 'Failed to save item' - errorMessage = 'Failed to save item' parameter.
 * @param props.queryKeysToInvalidate = [] - queryKeysToInvalidate = [] parameter.
 * @param props.onSuccessCallback - OnSuccessCallback parameter.
 * @returns JSX element.
 */
export function useCreateUpdateMutation({
  mutationFn,
  successMessage = 'Item saved successfully',
  errorMessage = 'Failed to save item',
  queryKeysToInvalidate = [],
  onSuccessCallback,
}: {
  mutationFn: (_data: unknown) => Promise<unknown>;
  successMessage?: string;
  errorMessage?: string;
  queryKeysToInvalidate?: string[];
  onSuccessCallback?: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      toast({
        title: 'Success',
        description: successMessage,
      });
      // Invalidate related queries
      queryKeysToInvalidate.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
      onSuccessCallback?.();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Common form state hook.
 * @param initialOpen - Initial dialog/modal open state.
 * @returns Form state management.
 */
/**
 * UseFormState custom hook.
 * @returns Hook return value.
 */
/**
 * Use form state function.
 * @param initialOpen = false - initialOpen = false parameter.
 */
export function /**
   * Use form state function.
   * @param initialOpen = false - initialOpen = false parameter.
   */ /**
   * Use form state function.
   * @param initialOpen = false - initialOpen = false parameter.
   */

 useFormState(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [selectedItem, setSelectedItem] = useState<unknown>(null);

  const openForm = useCallback((item?: unknown) => {
    setSelectedItem(item || null);
    setIsOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setIsOpen(false);
    setSelectedItem(null);
  }, []);

  return {
    isOpen,
    selectedItem,
    openForm,
    closeForm,
    setIsOpen,
    setSelectedItem,
  };
}

/**
 * Common search and filter state hook.
 * @param initialSearch - Initial search term.
 * @param initialFilters - Initial filters.
 * @returns Search and filter state management.
 */
export function useSearchFilter<T = Record<string, unknown>>(
  initialSearch = '',
  initialFilters = {} as T
) {
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [filters, setFilters] = useState<T>(initialFilters);

  const updateFilter = useCallback((_key: keyof T, _value: T[keyof T]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm(initialSearch);
    setFilters(initialFilters);
  }, [initialSearch, initialFilters]);

  const resetSearch = useCallback(() => {
    setSearchTerm(initialSearch);
  }, [initialSearch]);

  return {
    searchTerm,
    filters,
    setSearchTerm,
    setFilters,
    updateFilter,
    clearFilters,
    resetSearch,
  };
}