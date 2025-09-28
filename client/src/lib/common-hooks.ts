/**
 * Common React hooks used throughout the application.
 * Consolidates frequently used hook patterns to reduce redundancy.
 */

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

/**
 * Custom hook for managing loading state with utility functions.
 * Provides a simple interface for tracking async operations.
 * 
 * @param initialState - Initial loading state (default: false)
 * @returns Object containing loading state and control functions
 * @example
 * ```typescript
 * const { isLoading, setLoading, withLoading } = useLoadingState();
 * 
 * // Use withLoading to automatically manage loading state
 * const result = await withLoading(async () => {
 *   return await fetchData();
 * });
 * ```
 */
export function useLoadingState(initialState = false) {
  const [isLoading, setIsLoading] = useState(initialState);

  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  const withLoading = useCallback(
    async <T>(asyncFn: () => Promise<T>): Promise<T> => {
      setLoading(true);
      try {
        const result = await asyncFn();
        return result;
      } finally {
        setLoading(false);
      }
    },
    [setLoading]
  );

  return { isLoading, setLoading, withLoading };
}

/**
 * Custom hook for standardized delete mutations with error handling and cache invalidation.
 * Provides consistent UX patterns for delete operations across the application.
 * 
 * @param config - Configuration object for the delete mutation
 * @param config.deleteFn - Async function that performs the delete operation
 * @param config.successMessage - Success toast message (default: 'Item deleted successfully')
 * @param config.errorMessage - Error toast message (default: 'Failed to delete item')
 * @param config.queryKeysToInvalidate - Array of query keys to invalidate after successful deletion
 * @returns TanStack Query mutation object with enhanced error handling
 * @example
 * ```typescript
 * const deleteMutation = useDeleteMutation({
 *   deleteFn: async () => await apiRequest('DELETE', `/api/items/${itemId}`),
 *   successMessage: 'Item removed successfully',
 *   queryKeysToInvalidate: ['/api/items']
 * });
 * 
 * // Usage in component
 * const handleDelete = () => deleteMutation.mutate();
 * ```
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
      queryKeysToInvalidate.forEach((queryKey) => {
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
      queryKeysToInvalidate.forEach((queryKey) => {
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
    setFilters((prev) => ({ ...prev, [_key]: _value }));
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

/**
 * Enhanced dialog state hook that builds on useFormState.
 * Provides standardized dialog management patterns across the application.
 * @param options - Configuration options for the dialog.
 * @returns Dialog state management with enhanced functionality.
 */
export function useDialogState<T = unknown>(options: {
  initialOpen?: boolean;
  onClose?: () => void;
  onSuccess?: (data?: T) => void;
} = {}) {
  const { initialOpen = false, onClose, onSuccess } = options;
  const formState = useFormState(initialOpen);

  const openDialog = useCallback((item?: T) => {
    formState.openForm(item);
  }, [formState]);

  const closeDialog = useCallback(() => {
    formState.closeForm();
    onClose?.();
  }, [formState, onClose]);

  const handleSuccess = useCallback((data?: T) => {
    onSuccess?.(data);
    closeDialog();
  }, [onSuccess, closeDialog]);

  return {
    isOpen: formState.isOpen,
    selectedItem: formState.selectedItem as T | null,
    openDialog,
    closeDialog,
    handleSuccess,
    // Expose original formState methods for backward compatibility
    ...formState,
  };
}

/**
 * Common table/list state hook with pagination, sorting, and filtering.
 * Consolidates repeated patterns in data table components.
 * @param options - Configuration options for table state.
 * @returns Complete table state management.
 */
export function useTableState<T = Record<string, unknown>>(options: {
  initialPageSize?: number;
  initialSortField?: string;
  initialSortDirection?: 'asc' | 'desc';
  initialFilters?: T;
} = {}) {
  const {
    initialPageSize = 10,
    initialSortField = '',
    initialSortDirection = 'asc',
    initialFilters = {} as T,
  } = options;

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortField, setSortField] = useState(initialSortField);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection);
  
  const searchFilter = useSearchFilter('', initialFilters);

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  }, [sortField]);

  const resetTable = useCallback(() => {
    setCurrentPage(1);
    setPageSize(initialPageSize);
    setSortField(initialSortField);
    setSortDirection(initialSortDirection);
    searchFilter.clearFilters();
  }, [initialPageSize, initialSortField, initialSortDirection, searchFilter]);

  return {
    // Pagination
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    
    // Sorting
    sortField,
    sortDirection,
    handleSort,
    setSortField,
    setSortDirection,
    
    // Search and filters
    searchTerm: searchFilter.searchTerm,
    filters: searchFilter.filters,
    setSearchTerm: searchFilter.setSearchTerm,
    updateFilter: searchFilter.updateFilter,
    clearFilters: searchFilter.clearFilters,
    
    // Utilities
    resetTable,
  };
}
