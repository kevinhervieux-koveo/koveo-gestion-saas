import { FilterValue, FilterOperator, SortValue, SortDirection } from './types';

/**
 * Apply filter to a single item based on the filter value and operator.
 * @param item
 * @param filter
 */
export function applyFilter(item: any, filter: FilterValue): boolean {
  const value = getNestedValue(item, filter.field);
  const filterValue = filter.value;
  const operator = filter.operator;

  switch (operator) {
    case 'equals':
      return value === filterValue;

    case 'not_equals':
      return value !== filterValue;

    case 'contains':
      return String(value).toLowerCase().includes(String(filterValue).toLowerCase());

    case 'not_contains':
      return !String(value).toLowerCase().includes(String(filterValue).toLowerCase());

    case 'starts_with':
      return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());

    case 'ends_with':
      return String(value).toLowerCase().endsWith(String(filterValue).toLowerCase());

    case 'greater_than':
      return Number(value) > Number(filterValue);

    case 'less_than':
      return Number(value) < Number(filterValue);

    case 'greater_than_or_equal':
      return Number(value) >= Number(filterValue);

    case 'less_than_or_equal':
      return Number(value) <= Number(filterValue);

    case 'in':
      return Array.isArray(filterValue) ? filterValue.includes(value) : false;

    case 'not_in':
      return Array.isArray(filterValue) ? !filterValue.includes(value) : true;

    case 'is_empty':
      return (
        !value ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)
      );

    case 'is_not_empty':
      return (
        value &&
        (typeof value !== 'string' || value.trim() !== '') &&
        (!Array.isArray(value) || value.length > 0)
      );

    default:
      return true;
  }
}

/**
 * Apply all filters to a dataset.
 * @param data
 * @param filters
 */
export function applyFilters<T>(data: T[], filters: FilterValue[]): T[] {
  if (!filters || filters.length === 0) {
    return data;
  }

  return data.filter((item) => filters.every((filter) => applyFilter(item, filter)));
}

/**
 * Apply search to a dataset.
 * @param data
 * @param search
 * @param searchFields
 */
export function applySearch<T>(data: T[], search: string, searchFields?: string[]): T[] {
  if (!search || search.trim() === '') {
    return data;
  }

  const searchLower = search.toLowerCase();

  return data.filter((item) => {
    if (searchFields && searchFields.length > 0) {
      // Search only in specified fields
      return searchFields.some((field) => {
        const value = getNestedValue(item, field);
        return String(value).toLowerCase().includes(searchLower);
      });
    } else {
      // Search in all string fields
      return searchInObject(item, searchLower);
    }
  });
}

/**
 * Apply sorting to a dataset.
 * @param data
 * @param sort
 */
export function applySort<T>(data: T[], sort: SortValue | null): T[] {
  if (!sort) {
    return data;
  }

  return [...data].sort((a, b) => {
    const aValue = getNestedValue(a, sort.field);
    const bValue = getNestedValue(b, sort.field);

    // Handle null/undefined values
    if (aValue == null && bValue == null) {
      return 0;
    }
    if (aValue == null) {
      return sort.direction === 'asc' ? 1 : -1;
    }
    if (bValue == null) {
      return sort.direction === 'asc' ? -1 : 1;
    }

    // Compare values
    let comparison = 0;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      comparison = aValue.localeCompare(bValue, undefined, { numeric: true });
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue;
    } else if (aValue instanceof Date && bValue instanceof Date) {
      comparison = aValue.getTime() - bValue.getTime();
    } else {
      comparison = String(aValue).localeCompare(String(bValue));
    }

    return sort.direction === 'asc' ? comparison : -comparison;
  });
}

/**
 * Apply filters, search, and sort to a dataset.
 * @param data
 * @param filters
 * @param search
 * @param sort
 * @param searchFields
 */
export function applyFilterSort<T>(
  data: T[],
  filters: FilterValue[],
  search: string,
  sort: SortValue | null,
  searchFields?: string[]
): T[] {
  let result = data;

  // Apply filters first
  result = applyFilters(result, filters);

  // Then apply search
  result = applySearch(result, search, searchFields);

  // Finally apply sort
  result = applySort(result, sort);

  return result;
}

/**
 * Get nested value from object using dot notation.
 * @param obj
 * @param path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Search for a string in all values of an object.
 * @param obj
 * @param search
 */
function searchInObject(obj: any, search: string): boolean {
  if (obj === null || obj === undefined) {
    return false;
  }

  if (typeof obj === 'string') {
    return obj.toLowerCase().includes(search);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj).toLowerCase().includes(search);
  }

  if (Array.isArray(obj)) {
    return obj.some((item) => searchInObject(item, search));
  }

  if (typeof obj === 'object') {
    return Object.values(obj).some((value) => searchInObject(value, search));
  }

  return false;
}

/**
 * Get default operators for a filter type.
 * @param type
 */
export function getDefaultOperators(type: string): FilterOperator[] {
  switch (type) {
    case 'text':
      return [
        'contains',
        'not_contains',
        'equals',
        'not_equals',
        'starts_with',
        'ends_with',
        'is_empty',
        'is_not_empty',
      ];
    case 'number':
      return [
        'equals',
        'not_equals',
        'greater_than',
        'less_than',
        'greater_than_or_equal',
        'less_than_or_equal',
      ];
    case 'date':
      return [
        'equals',
        'not_equals',
        'greater_than',
        'less_than',
        'greater_than_or_equal',
        'less_than_or_equal',
      ];
    case 'select':
      return ['equals', 'not_equals', 'is_empty', 'is_not_empty'];
    case 'multi_select':
      return ['in', 'not_in', 'is_empty', 'is_not_empty'];
    case 'boolean':
      return ['equals'];
    default:
      return ['equals', 'not_equals'];
  }
}

/**
 * Get operator label for display.
 * @param operator
 */
export function getOperatorLabel(operator: FilterOperator): string {
  const labels: Record<FilterOperator, string> = {
    equals: 'Is',
    not_equals: 'Is not',
    contains: 'Contains',
    not_contains: 'Does not contain',
    starts_with: 'Starts with',
    ends_with: 'Ends with',
    greater_than: 'Greater than',
    less_than: 'Less than',
    greater_than_or_equal: 'Greater than or equal',
    less_than_or_equal: 'Less than or equal',
    in: 'Is any of',
    not_in: 'Is none of',
    is_empty: 'Is empty',
    is_not_empty: 'Is not empty',
  };

  return labels[operator] || operator;
}
