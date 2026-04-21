/**
 * Common React hooks used throughout the application.
 * Consolidates frequently used hook patterns to reduce redundancy.
 */

import { useState, useCallback } from 'react';
import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

type InvalidationKey = string | readonly unknown[];

function resolveText<TArg, TArg2 = unknown>(
  value: string | ((arg: TArg, arg2: TArg2) => string) | undefined,
  arg: TArg,
  arg2OrFallback: TArg2 | string,
  maybeFallback?: string,
): string {
  const fallback =
    maybeFallback !== undefined ? maybeFallback : (arg2OrFallback as string);
  const arg2 = maybeFallback !== undefined ? (arg2OrFallback as TArg2) : (undefined as unknown as TArg2);
  if (typeof value === 'function') {
    try {
      return value(arg, arg2) || fallback;
    } catch {
      return fallback;
    }
  }
  return value ?? fallback;
}

function normalizeKey(key: InvalidationKey): QueryKey {
  return Array.isArray(key) ? (key as QueryKey) : ([key] as QueryKey);
}

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
 * Shared create/update mutation hook used to centralize toast + cache invalidation
 * patterns across the app. Toast title/description fields accept either a static
 * string or a function for variable-dependent text; pass `silentSuccess`/`silentError`
 * to suppress the corresponding toast while still running invalidations and callbacks.
 *
 * @param config - Mutation configuration.
 * @returns A TanStack `useMutation` instance.
 */
export function useCreateUpdateMutation<TData = unknown, TVariables = unknown>({
  mutationFn,
  successTitle,
  successMessage,
  errorTitle,
  errorMessage,
  queryKeysToInvalidate = [],
  invalidateQueries,
  onSuccessCallback,
  onErrorCallback,
  silentSuccess,
  silentError,
}: {
  mutationFn: (data: TVariables) => Promise<TData>;
  successTitle?: string | ((data: TData, variables: TVariables) => string);
  successMessage?: string | ((data: TData, variables: TVariables) => string);
  errorTitle?: string | ((error: any) => string);
  errorMessage?: string | ((error: any) => string);
  queryKeysToInvalidate?: InvalidationKey[];
  invalidateQueries?: (data: TData, queryClient: QueryClient) => void;
  onSuccessCallback?: (data: TData, variables: TVariables) => void;
  onErrorCallback?: (error: any) => void;
  silentSuccess?: boolean;
  silentError?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation<TData, any, TVariables>({
    mutationFn,
    onSuccess: (data, variables) => {
      if (!silentSuccess) {
        toast({
          title: resolveText(successTitle, data, variables, 'Success'),
          description: resolveText(successMessage, data, variables, 'Item saved successfully'),
        });
      }
      // Invalidate related queries
      queryKeysToInvalidate.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey: normalizeKey(queryKey) });
      });
      invalidateQueries?.(data, queryClient);
      onSuccessCallback?.(data, variables);
    },
    onError: (error) => {
      if (!silentError) {
        const description =
          resolveText(errorMessage, error, '') ||
          (error instanceof Error ? error.message : '') ||
          'Failed to save item';
        toast({
          title: resolveText(errorTitle, error, 'Error'),
          description,
          variant: 'destructive',
        });
      }
      onErrorCallback?.(error);
    },
  });
}

/**
 * Common form/dialog state hook used by simple open/close + selected-item forms.
 *
 * @param initialOpen - Initial dialog/modal open state.
 * @returns Form state management helpers.
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

  // Reset to first page whenever the search term changes so users
  // don't end up viewing an empty page after narrowing results.
  const setSearchTermAndResetPage = useCallback((value: string) => {
    searchFilter.setSearchTerm(value);
    setCurrentPage(1);
  }, [searchFilter]);

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
    setSearchTerm: setSearchTermAndResetPage,
    setFilters: searchFilter.setFilters,
    updateFilter: searchFilter.updateFilter,
    clearFilters: searchFilter.clearFilters,
    
    // Utilities
    resetTable,
  };
}

/**
 * Shared multi-step wizard state hook. Tracks the active step index and
 * exposes consistent next/previous/goTo helpers and a 0-100 progress value
 * so wizards across the app can stop hand-rolling the same logic.
 *
 * @param totalSteps - Total number of steps in the wizard. Must be >= 1.
 * @param options - Optional initial step index and onChange callback.
 */
export function useStepper(
  totalSteps: number,
  options: { initialStep?: number; onStepChange?: (index: number) => void } = {},
) {
  const { initialStep, onStepChange } = options;
  const safeTotal = Math.max(1, totalSteps);
  const initial = Math.min(Math.max(0, initialStep ?? 0), safeTotal - 1);
  const [currentStep, setCurrentStep] = useState(initial);

  const clamp = useCallback(
    (index: number) => Math.min(Math.max(0, index), safeTotal - 1),
    [safeTotal],
  );

  const goTo = useCallback((index: number) => {
    setCurrentStep((prev) => {
      const next = clamp(index);
      if (next !== prev) {
        onStepChange?.(next);
      }
      return next;
    });
  }, [clamp, onStepChange]);

  const next = useCallback(() => {
    setCurrentStep((prev) => {
      const value = clamp(prev + 1);
      if (value !== prev) {
        onStepChange?.(value);
      }
      return value;
    });
  }, [clamp, onStepChange]);

  const previous = useCallback(() => {
    setCurrentStep((prev) => {
      const value = clamp(prev - 1);
      if (value !== prev) {
        onStepChange?.(value);
      }
      return value;
    });
  }, [clamp, onStepChange]);

  const reset = useCallback(() => {
    setCurrentStep(initial);
  }, [initial]);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === safeTotal - 1;
  // Progress reflects the step the user is actively on, so step 2 of 4
  // shows 50% (not 25%).
  const progress = ((currentStep + 1) / safeTotal) * 100;

  return {
    currentStep,
    setCurrentStep: goTo,
    totalSteps: safeTotal,
    next,
    previous,
    goTo,
    reset,
    isFirstStep,
    isLastStep,
    progress,
  };
}
