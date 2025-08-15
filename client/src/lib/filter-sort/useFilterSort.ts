import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FilterSortState,
  FilterValue,
  SortValue,
  FilterSortConfig,
  FilterSortPreset,
} from './types';
import { applyFilterSort } from './utils';

/**
 *
 */
interface UseFilterSortOptions<T> {
  data: T[];
  config: FilterSortConfig;
  initialState?: Partial<FilterSortState>;
}

/**
 *
 */
interface UseFilterSortReturn<T> {
  // Filtered and sorted data
  filteredData: T[];

  // State
  filters: FilterValue[];
  sort: SortValue | null;
  search: string;

  // Actions
  addFilter: (filter: FilterValue) => void;
  removeFilter: (field: string) => void;
  updateFilter: (field: string, filter: FilterValue) => void;
  clearFilters: () => void;

  setSort: (sort: SortValue | null) => void;
  toggleSort: (field: string) => void;

  setSearch: (search: string) => void;
  clearSearch: () => void;

  applyPreset: (preset: FilterSortPreset) => void;
  reset: () => void;

  // Metadata
  hasActiveFilters: boolean;
  activeFilterCount: number;
  resultCount: number;
}

const STORAGE_PREFIX = 'filter-sort-state-';

/**
 *
 * @param options
 */
export function useFilterSort<T>(options: UseFilterSortOptions<T>): UseFilterSortReturn<T> {
  const { data, config, initialState } = options;

  // Load initial state from localStorage if persistence is enabled
  const getInitialState = (): FilterSortState => {
    if (config.persistState && config.storageKey) {
      const stored = localStorage.getItem(STORAGE_PREFIX + config.storageKey);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.warn('Failed to parse stored filter state', e);
        }
      }
    }

    return {
      filters: initialState?.filters || [],
      sort: initialState?.sort || null,
      search: initialState?.search || '',
    };
  };

  const [state, setState] = useState<FilterSortState>(getInitialState);

  // Persist state to localStorage when it changes
  useEffect(() => {
    if (config.persistState && config.storageKey) {
      localStorage.setItem(STORAGE_PREFIX + config.storageKey, JSON.stringify(state));
    }
  }, [state, config.persistState, config.storageKey]);

  // Apply filters, search, and sort to data
  const filteredData = useMemo(() => {
    return applyFilterSort(data, state.filters, state.search, state.sort, config.searchFields);
  }, [data, state.filters, state.search, state.sort, config.searchFields]);

  // Filter management
  const addFilter = useCallback(
    (filter: FilterValue) => {
      setState((prev) => {
        if (!config.allowMultipleFilters) {
          // Replace existing filter for the same field
          const otherFilters = prev.filters.filter((f) => f.field !== filter.field);
          return { ...prev, filters: [...otherFilters, filter] };
        }
        return { ...prev, filters: [...prev.filters, filter] };
      });
    },
    [config.allowMultipleFilters]
  );

  const removeFilter = useCallback((field: string) => {
    setState((prev) => ({
      ...prev,
      filters: prev.filters.filter((f) => f.field !== field),
    }));
  }, []);

  const updateFilter = useCallback((field: string, filter: FilterValue) => {
    setState((prev) => ({
      ...prev,
      filters: prev.filters.map((f) => (f.field === field ? filter : f)),
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setState((prev) => ({ ...prev, filters: [] }));
  }, []);

  // Sort management
  const setSort = useCallback((sort: SortValue | null) => {
    setState((prev) => ({ ...prev, sort }));
  }, []);

  const toggleSort = useCallback(
    (field: string) => {
      setState((prev) => {
        if (prev.sort?.field === field) {
          // Toggle direction or clear
          if (prev.sort.direction === 'asc') {
            return { ...prev, sort: { field, direction: 'desc' } };
          } else {
            return { ...prev, sort: null };
          }
        } else {
          // Set new sort field
          const sortConfig = config.sortOptions.find((s) => s.field === field);
          return {
            ...prev,
            sort: {
              field,
              direction: sortConfig?.defaultDirection || 'asc',
            },
          };
        }
      });
    },
    [config.sortOptions]
  );

  // Search management
  const setSearch = useCallback((search: string) => {
    setState((prev) => ({ ...prev, search }));
  }, []);

  const clearSearch = useCallback(() => {
    setState((prev) => ({ ...prev, search: '' }));
  }, []);

  // Preset management
  const applyPreset = useCallback((preset: FilterSortPreset) => {
    setState({
      filters: preset.filters,
      sort: preset.sort || null,
      search: '',
    });
  }, []);

  // Reset to initial state
  const reset = useCallback(() => {
    setState({
      filters: initialState?.filters || [],
      sort: initialState?.sort || null,
      search: initialState?.search || '',
    });
  }, [initialState]);

  // Computed values
  const hasActiveFilters = state.filters.length > 0 || state.search !== '';
  const activeFilterCount = state.filters.length;
  const resultCount = filteredData.length;

  return {
    // Data
    filteredData,

    // State
    filters: state.filters,
    sort: state.sort,
    search: state.search,

    // Actions
    addFilter,
    removeFilter,
    updateFilter,
    clearFilters,
    setSort,
    toggleSort,
    setSearch,
    clearSearch,
    applyPreset,
    reset,

    // Metadata
    hasActiveFilters,
    activeFilterCount,
    resultCount,
  };
}
