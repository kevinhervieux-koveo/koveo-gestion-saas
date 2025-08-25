import { renderHook, act } from '@testing-library/react';
import { useFilterSort } from '../../client/src/lib/filter-sort/useFilterSort';
import { 
  applyFilter, 
  applyFilters, 
  applySearch, 
  applySort, 
  applyFilterSort,
  getDefaultOperators,
  getOperatorLabel 
} from '../../client/src/lib/filter-sort/utils';
import { FilterSortConfig, FilterValue, SortValue } from '../../client/src/lib/filter-sort/types';

// Mock localStorage for persistence tests
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock data for testing - Quebec property management specific
const mockSuggestions = [
  {
    id: '1',
    title: 'Improve Law 25 Compliance Documentation',
    description: 'Add comprehensive privacy documentation for Quebec Law 25',
    priority: 'High',
    status: 'New',
    category: 'Security',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2', 
    title: 'Optimize Property Search Performance',
    description: 'Improve search functionality for Quebec property listings',
    priority: 'Medium',
    status: 'Acknowledged',
    category: 'Performance',
    createdAt: '2024-01-10T14:30:00Z',
  },
  {
    id: '3',
    title: 'Add French Language Support for Legal Documents',
    description: 'Ensure all legal documents support Quebec French language requirements',
    priority: 'Critical',
    status: 'Done',
    category: 'Documentation',
    createdAt: '2024-01-20T09:15:00Z',
  },
];

const mockFilterConfig: FilterSortConfig = {
  filters: [
    {
      id: 'priority',
      field: 'priority',
      label: 'Priority',
      type: 'select',
      options: [
        { label: 'Critical', _value: 'Critical' },
        { label: 'High', _value: 'High' },
        { label: 'Medium', _value: 'Medium' },
        { label: 'Low', _value: 'Low' },
      ],
      defaultOperator: 'equals',
    },
    {
      id: 'status',
      field: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { label: 'New', _value: 'New' },
        { label: 'Acknowledged', _value: 'Acknowledged' },
        { label: 'Done', _value: 'Done' },
      ],
      defaultOperator: 'equals',
    },
    {
      id: 'category',
      field: 'category',
      label: 'Category',
      type: 'select',
      options: [
        { label: 'Security', _value: 'Security' },
        { label: 'Performance', _value: 'Performance' },
        { label: 'Documentation', _value: 'Documentation' },
      ],
      defaultOperator: 'equals',
    },
    {
      id: 'title',
      field: 'title',
      label: 'Title',
      type: 'text',
      placeholder: 'Search titles...',
      defaultOperator: 'contains',
    },
  ],
  sortOptions: [
    { field: 'createdAt', label: 'Date Created', defaultDirection: 'desc' },
    { field: 'priority', label: 'Priority' },
    { field: 'status', label: 'Status' },
    { field: 'title', label: 'Title' },
  ],
  presets: [
    {
      id: 'critical-new',
      name: 'Critical & New',
      description: 'Critical priority items that are new',
      filters: [
        { field: 'priority', operator: 'equals', _value: 'Critical' },
        { field: 'status', operator: 'equals', _value: 'New' },
      ],
    },
    {
      id: 'quebec-compliance',
      name: 'Quebec Compliance',
      description: 'Security and documentation items for Quebec Law 25',
      filters: [
        { field: 'category', operator: 'in', _value: ['Security', 'Documentation'] },
      ],
      sort: { field: 'priority', direction: 'asc' },
    },
  ],
  searchable: true,
  searchPlaceholder: 'Search suggestions...',
  searchFields: ['title', 'description'],
  allowMultipleFilters: true,
  persistState: true,
  storageKey: 'test-filters',
};

describe('Filter and Sort System - Quebec Property Management', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  describe('Filter Utility Functions', () => {
    describe('applyFilter', () => {
      it('should handle equals operator correctly', () => {
        const item = { priority: 'High' };
        const filter: FilterValue = { field: 'priority', operator: 'equals', _value: 'High' };
        
        expect(applyFilter(item, filter)).toBe(true);
        
        const filter2: FilterValue = { field: 'priority', operator: 'equals', _value: 'Low' };
        expect(applyFilter(item, filter2)).toBe(false);
      });

      it('should handle not_equals operator correctly', () => {
        const item = { priority: 'High' };
        const filter: FilterValue = { field: 'priority', operator: 'not_equals', _value: 'Low' };
        
        expect(applyFilter(item, filter)).toBe(true);
        
        const filter2: FilterValue = { field: 'priority', operator: 'not_equals', _value: 'High' };
        expect(applyFilter(item, filter2)).toBe(false);
      });

      it('should handle contains operator for Quebec text search', () => {
        const item = { title: 'Quebec Law 25 Compliance Documentation' };
        const filter: FilterValue = { field: 'title', operator: 'contains', _value: 'quebec' };
        
        expect(applyFilter(item, filter)).toBe(true);
        
        const filter2: FilterValue = { field: 'title', operator: 'contains', _value: 'ontario' };
        expect(applyFilter(item, filter2)).toBe(false);
      });

      it('should handle in operator for multiple values', () => {
        const item = { category: 'Security' };
        const filter: FilterValue = { 
          field: 'category', 
          operator: 'in', 
          _value: ['Security', 'Documentation'] 
        };
        
        expect(applyFilter(item, filter)).toBe(true);
        
        const filter2: FilterValue = { 
          field: 'category', 
          operator: 'in', 
          _value: ['Performance', 'Testing'] 
        };
        expect(applyFilter(item, filter2)).toBe(false);
      });

      it('should handle is_empty operator', () => {
        const item1 = { notes: '' };
        const item2 = { notes: 'Some content' };
        const item3 = { notes: null };
        const item4 = { notes: undefined };
        
        const filter: FilterValue = { field: 'notes', operator: 'is_empty', _value: null };
        
        expect(applyFilter(item1, filter)).toBe(true);
        expect(applyFilter(item2, filter)).toBe(false);
        expect(applyFilter(item3, filter)).toBe(true);
        expect(applyFilter(item4, filter)).toBe(true);
      });

      it('should handle numeric comparison operators', () => {
        const item = { score: 85 };
        
        const gtFilter: FilterValue = { field: 'score', operator: 'greater_than', _value: 80 };
        expect(applyFilter(item, gtFilter)).toBe(true);
        
        const ltFilter: FilterValue = { field: 'score', operator: 'less_than', _value: 90 };
        expect(applyFilter(item, ltFilter)).toBe(true);
        
        const gteFilter: FilterValue = { field: 'score', operator: 'greater_than_or_equal', _value: 85 };
        expect(applyFilter(item, gteFilter)).toBe(true);
        
        const lteFilter: FilterValue = { field: 'score', operator: 'less_than_or_equal', _value: 85 };
        expect(applyFilter(item, lteFilter)).toBe(true);
      });
    });

    describe('applyFilters', () => {
      it('should apply multiple filters correctly', () => {
        const filters: FilterValue[] = [
          { field: 'priority', operator: 'equals', _value: 'High' },
          { field: 'status', operator: 'equals', _value: 'New' },
        ];
        
        const result = applyFilters(mockSuggestions, filters);
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Improve Law 25 Compliance Documentation');
      });

      it('should return all items when no filters applied', () => {
        const _result = applyFilters(mockSuggestions, []);
        expect(_result).toHaveLength(3);
      });

      it('should handle Quebec-specific category filtering', () => {
        const filters: FilterValue[] = [
          { field: 'category', operator: 'in', _value: ['Security', 'Documentation'] },
        ];
        
        const result = applyFilters(mockSuggestions, filters);
        expect(result).toHaveLength(2);
        expect(result.map(r => r.category)).toEqual(['Security', 'Documentation']);
      });
    });

    describe('applySearch', () => {
      it('should search in specified fields', () => {
        const searchFields = ['title', 'description'];
        const result = applySearch(mockSuggestions, 'quebec', searchFields);
        
        expect(result).toHaveLength(3);
        expect(result.map(r => r.id)).toEqual(['1', '2', '3']);
      });

      it('should handle case-insensitive search', () => {
        const searchFields = ['title'];
        const result = applySearch(mockSuggestions, 'PROPERTY', searchFields);
        
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Optimize Property Search Performance');
      });

      it('should return all items for empty search', () => {
        const _result = applySearch(mockSuggestions, '', ['title']);
        expect(_result).toHaveLength(3);
      });

      it('should search across multiple fields when no specific fields provided', () => {
        const result = applySearch(mockSuggestions, 'Legal');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('3');
      });
    });

    describe('applySort', () => {
      it('should sort by date descending', () => {
        const sort: SortValue = { field: 'createdAt', direction: 'desc' };
        const result = applySort(mockSuggestions, sort);
        
        expect(result[0].createdAt).toBe('2024-01-20T09:15:00Z');
        expect(result[1].createdAt).toBe('2024-01-15T10:00:00Z');
        expect(result[2].createdAt).toBe('2024-01-10T14:30:00Z');
      });

      it('should sort by priority with proper string comparison', () => {
        const sort: SortValue = { field: 'priority', direction: 'asc' };
        const result = applySort(mockSuggestions, sort);
        
        // Should sort alphabetically: Critical, High, Medium
        expect(result[0].priority).toBe('Critical');
        expect(result[1].priority).toBe('High');
        expect(result[2].priority).toBe('Medium');
      });

      it('should handle null sort gracefully', () => {
        const result = applySort(mockSuggestions, null);
        expect(result).toEqual(mockSuggestions);
      });

      it('should handle null values in sort field', () => {
        const dataWithNulls = [
          { id: '1', title: 'Item 1', priority: null },
          { id: '2', title: 'Item 2', priority: 'High' },
          { id: '3', title: 'Item 3', priority: 'Low' },
        ];
        
        const sort: SortValue = { field: 'priority', direction: 'asc' };
        const result = applySort(dataWithNulls, sort);
        
        // Null values should come last in ascending order
        expect(result[0].priority).toBe('High');
        expect(result[1].priority).toBe('Low');
        expect(result[2].priority).toBe(null);
      });
    });

    describe('applyFilterSort - Combined Operations', () => {
      it('should apply filters, search, and sort together', () => {
        const filters: FilterValue[] = [
          { field: 'category', operator: 'in', _value: ['Security', 'Documentation'] },
        ];
        const search = 'quebec';
        const sort: SortValue = { field: 'priority', direction: 'asc' };
        const searchFields = ['title', 'description'];
        
        const result = applyFilterSort(mockSuggestions, filters, search, sort, searchFields);
        
        expect(result).toHaveLength(2);
        // Should be sorted by priority: Critical before High
        expect(result[0].priority).toBe('Critical');
        expect(result[1].priority).toBe('High');
      });
    });

    describe('Filter Configuration Utilities', () => {
      it('should return correct default operators for different field types', () => {
        expect(getDefaultOperators('text')).toContain('contains');
        expect(getDefaultOperators('text')).toContain('equals');
        expect(getDefaultOperators('text')).toContain('starts_with');
        
        expect(getDefaultOperators('number')).toContain('greater_than');
        expect(getDefaultOperators('number')).toContain('less_than');
        
        expect(getDefaultOperators('select')).toContain('equals');
        expect(getDefaultOperators('select')).toContain('not_equals');
        
        expect(getDefaultOperators('boolean')).toEqual(['equals']);
      });

      it('should provide human-readable operator labels', () => {
        expect(getOperatorLabel('equals')).toBe('Is');
        expect(getOperatorLabel('not_equals')).toBe('Is not');
        expect(getOperatorLabel('contains')).toBe('Contains');
        expect(getOperatorLabel('greater_than')).toBe('Greater than');
        expect(getOperatorLabel('in')).toBe('Is any of');
      });
    });
  });

  describe('useFilterSort Hook', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() =>
        useFilterSort({
          data: mockSuggestions,
          config: mockFilterConfig,
        })
      );

      expect(result.current.filteredData).toHaveLength(3);
      expect(result.current.filters).toHaveLength(0);
      expect(result.current.sort).toBeNull();
      expect(result.current.search).toBe('');
      expect(result.current.hasActiveFilters).toBe(false);
      expect(result.current.activeFilterCount).toBe(0);
    });

    it('should add and remove filters correctly', () => {
      const { result } = renderHook(() =>
        useFilterSort({
          data: mockSuggestions,
          config: mockFilterConfig,
        })
      );

      act(() => {
        result.current.addFilter({
          field: 'priority',
          operator: 'equals',
          _value: 'High',
        });
      });

      expect(result.current.filters).toHaveLength(1);
      expect(result.current.filteredData).toHaveLength(1);
      expect(result.current.hasActiveFilters).toBe(true);
      expect(result.current.activeFilterCount).toBe(1);

      act(() => {
        result.current.removeFilter('priority');
      });

      expect(result.current.filters).toHaveLength(0);
      expect(result.current.filteredData).toHaveLength(3);
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('should handle sorting operations', () => {
      const { result } = renderHook(() =>
        useFilterSort({
          data: mockSuggestions,
          config: mockFilterConfig,
        })
      );

      act(() => {
        result.current.toggleSort('createdAt');
      });

      expect(result.current.sort).toEqual({
        field: 'createdAt',
        direction: 'desc', // Default from config
      });

      // Toggle again should clear sort (since direction was 'desc', not 'asc')
      act(() => {
        result.current.toggleSort('createdAt');
      });

      expect(result.current.sort).toBeNull();
    });

    it('should handle search functionality', () => {
      const { result } = renderHook(() =>
        useFilterSort({
          data: mockSuggestions,
          config: mockFilterConfig,
        })
      );

      act(() => {
        result.current.setSearch('quebec');
      });

      expect(result.current.search).toBe('quebec');
      expect(result.current.filteredData).toHaveLength(3);
      expect(result.current.hasActiveFilters).toBe(true);

      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.search).toBe('');
      expect(result.current.filteredData).toHaveLength(3);
    });

    it('should apply presets correctly', () => {
      const { result } = renderHook(() =>
        useFilterSort({
          data: mockSuggestions,
          config: mockFilterConfig,
        })
      );

      const preset = mockFilterConfig.presets![0]; // critical-new preset

      act(() => {
        result.current.applyPreset(preset);
      });

      expect(result.current.filters).toHaveLength(2);
      expect(result.current.filteredData).toHaveLength(0); // No critical+new items in mock data
    });

    it('should persist state to localStorage when enabled', () => {
      renderHook(() =>
        useFilterSort({
          data: mockSuggestions,
          config: { ...mockFilterConfig, persistState: true, storageKey: 'test-key' },
        })
      );

      // Should attempt to load from localStorage on initialization
      expect(localStorageMock.getItem).toHaveBeenCalledWith('filter-sort-state-test-key');
    });

    it('should handle multiple filters when allowMultipleFilters is true', () => {
      const { result } = renderHook(() =>
        useFilterSort({
          data: mockSuggestions,
          config: { ...mockFilterConfig, allowMultipleFilters: true },
        })
      );

      act(() => {
        result.current.addFilter({
          field: 'priority',
          operator: 'equals',
          _value: 'High',
        });
      });

      act(() => {
        result.current.addFilter({
          field: 'status',
          operator: 'equals',
          _value: 'New',
        });
      });

      expect(result.current.filters).toHaveLength(2);
      expect(result.current.filteredData).toHaveLength(1); // Only one item matches both filters
    });

    it('should replace filter when allowMultipleFilters is false', () => {
      const { result } = renderHook(() =>
        useFilterSort({
          data: mockSuggestions,
          config: { ...mockFilterConfig, allowMultipleFilters: false },
        })
      );

      act(() => {
        result.current.addFilter({
          field: 'priority',
          operator: 'equals',
          _value: 'High',
        });
      });

      act(() => {
        result.current.addFilter({
          field: 'priority',
          operator: 'equals',
          _value: 'Medium',
        });
      });

      expect(result.current.filters).toHaveLength(1);
      expect(result.current.filters[0]._value).toBe('Medium');
    });

    it('should reset to initial state', () => {
      const initialState = {
        filters: [{ field: 'priority', operator: 'equals' as const, _value: 'High' }],
        sort: { field: 'createdAt', direction: 'desc' as const },
        search: 'test',
      };

      const { result } = renderHook(() =>
        useFilterSort({
          data: mockSuggestions,
          config: mockFilterConfig,
          initialState,
        })
      );

      // Change state
      act(() => {
        result.current.addFilter({
          field: 'status',
          operator: 'equals',
          _value: 'Done',
        });
        result.current.setSearch('different search');
      });

      // Reset should restore initial state
      act(() => {
        result.current.reset();
      });

      expect(result.current.filters).toEqual(initialState.filters);
      expect(result.current.sort).toEqual(initialState.sort);
      expect(result.current.search).toBe(initialState.search);
    });
  });
});