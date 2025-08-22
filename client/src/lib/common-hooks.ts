/**
 * Common React hooks used throughout the application.
 * Consolidates frequently used hook patterns to reduce redundancy.
 */

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

/**
 * Common loading state hook.
 * @param initialState - Initial loading state
 * @returns Loading state and setter
 */
export function useLoadingState(initialState = false) {
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
 * @param config - Configuration for the delete mutation
 * @returns Delete mutation
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
 * @param config - Configuration for the mutation
 * @returns Create/update mutation
 */
export function useCreateUpdateMutation({
  mutationFn,
  successMessage = 'Item saved successfully',
  errorMessage = 'Failed to save item',
  queryKeysToInvalidate = [],
  onSuccessCallback,
}: {
  mutationFn: (data: unknown) => Promise<unknown>;
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
 * @param initialOpen - Initial dialog/modal open state
 * @returns Form state management
 */
export function useFormState(initialOpen = false) {
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
 * @param initialSearch - Initial search term
 * @param initialFilters - Initial filters
 * @returns Search and filter state management
 */
export function useSearchFilter<T = Record<string, unknown>>(
  initialSearch = '',
  initialFilters = {} as T
) {
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [filters, setFilters] = useState<T>(initialFilters);

  const updateFilter = useCallback((key: keyof T, value: T[keyof T]) => {
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