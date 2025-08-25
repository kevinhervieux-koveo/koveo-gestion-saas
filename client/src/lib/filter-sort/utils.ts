import { FilterValue, FilterOperator, SortValue, SortDirection } from './types';

/**
 * Applies a filter condition to a single data item using the specified operator.
 * Supports various filter operators including text matching, numerical comparisons,
 * array membership tests, and empty value checks.
 *
 * @param {any} item - The data item to test against the filter condition.
 * @param {FilterValue} filter - Filter configuration containing field, operator, and value.
 * @returns {boolean} True if the item matches the filter condition, false otherwise.
 *
 * @example
 * ```typescript
 * const user = { name: 'John Doe', age: 30, active: true };
 * const filter = { field: 'age', operator: 'greater_than', value: 25 };
 * const matches = applyFilter(user, filter); // true
 * ```
 */
/**
 * ApplyFilter function.
 * @param item
 * @param filter
 * @returns Function result.
 */
/**
 * Apply filter function.
 * @param item - Item parameter.
 * @param filter - Filter parameter.
 * @returns Boolean result.
 */
export function /**
 * Apply filter function.
 * @param item - Item parameter.
 * @param filter - Filter parameter.
 * @returns Boolean result.
 */ /**
 * Apply filter function.
 * @param item - Item parameter.
 * @param filter - Filter parameter.
 * @returns Boolean result.
 */

applyFilter(item: any, filter: FilterValue): boolean {
  const value = getNestedValue(item, filter.field);
  const filterValue = filter._value;
  const operator = filter.operator; /**
   * Switch function.
   * @param operator - Operator parameter.
   */ /**
   * Switch function.
   * @param operator - Operator parameter.
   */

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
      return Array.isArray(filterValue)
        ? filterValue /**
           * Includes function.
           * @param value - Value to process.
           * @returns String result.
           */ /**
           * Includes function.
           * @param value - Value to process.
           * @returns String result.
           */
            .includes(value)
        : false;

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
 * Applies multiple filter conditions to a dataset, returning only items that match all filters.
 * Uses logical AND operation - all filters must pass for an item to be included.
 *
 * @template T - Type of items in the dataset.
 * @param {T[]} data - Array of data items to filter.
 * @param {FilterValue[]} filters - Array of filter conditions to apply.
 * @returns {T[]} Filtered array containing only items that match all filter conditions.
 *
 * @example
 * ```typescript
 * const users = [{ name: 'John', age: 30 }, { name: 'Jane', age: 25 }];
 * const filters = [
 *   { field: 'age', operator: 'greater_than', value: 20 },
 *   { field: 'name', operator: 'contains', value: 'J' }
 * ];
 * const filtered = applyFilters(users, filters); // Both users match
 * ```
 */
/**
 * ApplyFilters function.
 * @param data
 * @param _data
 * @param filters
 * @returns Function result.
 */
export function applyFilters<T>(_data: T[], filters: FilterValue[]): T[] {
  /**
   * If function.
   * @param !filters || filters.length === 0 - !filters || filters.length === 0 parameter.
   */ /**
   * If function.
   * @param !filters || filters.length === 0 - !filters || filters.length === 0 parameter.
   */

  if (!filters || filters.length === 0) {
    return _data;
  }

  return _data.filter((item) => filters.every((filter) => applyFilter(item, filter)));
}

/**
 * Applies text search across specified fields or all string fields in a dataset.
 * Performs case-insensitive partial matching using the search term.
 *
 * @template T - Type of items in the dataset.
 * @param {T[]} data - Array of data items to search through.
 * @param {string} search - Search term to look for (case-insensitive).
 * @param {string[]} [searchFields] - Optional array of field names to search in. If not provided, searches all string fields.
 * @returns {T[]} Array of items that contain the search term in at least one searchable field.
 *
 * @example
 * ```typescript
 * const products = [{ name: 'iPhone', category: 'Electronics' }, { name: 'Book', category: 'Media' }];
 * const results = applySearch(products, 'phone', ['name']); // [{ name: 'iPhone', ... }]
 * ```
 */
/**
 * ApplySearch function.
 * @param data
 * @param _data
 * @param search
 * @param searchFields
 * @returns Function result.
 */
export function applySearch<T>(_data: T[], search: string, searchFields?: string[]): T[] {
  if (!search || search.trim() === '') {
    return _data;
  }

  const searchLower = search.toLowerCase();

  return _data.filter((item) => {
    /**
     * If function.
     * @param searchFields && searchFields.length > 0 - searchFields && searchFields.length > 0 parameter.
     */ /**
     * If function.
     * @param searchFields && searchFields.length > 0 - searchFields && searchFields.length > 0 parameter.
     */

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
 * Applies sorting to a dataset based on a specified field and direction.
 * Handles various data types including strings, numbers, dates, and null values.
 * Uses locale-aware string comparison and proper null value handling.
 *
 * @template T - Type of items in the dataset.
 * @param {T[]} data - Array of data items to sort.
 * @param {SortValue | null} sort - Sort configuration with field and direction, or null for no sorting.
 * @returns {T[]} New array with items sorted according to the sort configuration.
 *
 * @example
 * ```typescript
 * const users = [{ name: 'John', age: 30 }, { name: 'Jane', age: 25 }];
 * const sorted = applySort(users, { field: 'age', direction: 'desc' });
 * // [{ name: 'John', age: 30 }, { name: 'Jane', age: 25 }]
 * ```
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
 * Applies filters, search, and sorting to a dataset in the correct order.
 * Processing order: 1) Apply filters, 2) Apply search, 3) Apply sorting.
 * This is the main function for comprehensive data processing.
 *
 * @template T - Type of items in the dataset.
 * @param {T[]} data - Array of data items to process.
 * @param {FilterValue[]} filters - Array of filter conditions to apply first.
 * @param {string} search - Search term for text search.
 * @param {SortValue | null} sort - Sort configuration to apply last.
 * @param {string[]} [searchFields] - Optional fields to restrict search to.
 * @returns {T[]} Processed array with filters, search, and sorting applied.
 *
 * @example
 * ```typescript
 * const users = [{ name: 'John Doe', age: 30, active: true }];
 * const result = applyFilterSort(
 *   users,
 *   [{ field: 'active', operator: 'equals', value: true }],
 *   'john',
 *   { field: 'age', direction: 'asc' },
 *   ['name']
 * );
 * ```
 */
/**
 * ApplyFilterSort function.
 * @param data
 * @param _data
 * @param filters
 * @param search
 * @param sort
 * @param searchFields
 * @returns Function result.
 */
export function applyFilterSort<T>(
  _data: T[],
  filters: FilterValue[],
  search: string,
  sort: SortValue | null,
  searchFields?: string[]
): T[] {
  let result = _data;

  // Apply filters first
  result = applyFilters(result, filters);

  // Then apply search
  result = applySearch(result, search, searchFields);

  // Finally apply sort
  result = applySort(result, sort);

  return result;
}

/**
 * Retrieves a nested value from an object using dot notation path traversal.
 * Safely handles undefined intermediate properties without throwing errors.
 *
 * @param {any} obj - The object to retrieve the value from.
 * @param {string} path - Dot-separated path to the desired property (e.g., 'user.profile.name').
 * @returns {any} The value at the specified path, or undefined if path doesn't exist.
 *
 * @example
 * ```typescript
 * const user = { profile: { name: 'John', address: { city: 'Montreal' } } };
 * const name = getNestedValue(user, 'profile.name'); // 'John'
 * const city = getNestedValue(user, 'profile.address.city'); // 'Montreal'
 * const missing = getNestedValue(user, 'profile.phone'); // undefined
 * ```
 */
/**
 * GetNestedValue function.
 * @param obj
 * @param path
 * @returns Function result.
 */
function /**
 * Get nested value.
 * @param obj - Obj parameter.
 * @param path - File or URL path.
 * @returns Any result.
 */ /**
 * Get nested value.
 * @param obj - Obj parameter.
 * @param path - File or URL path.
 * @returns Any result.
 */

getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, _key) => current?.[_key], obj);
}

/**
 * Recursively searches for a string within all values of an object or array.
 * Performs case-insensitive search across strings, numbers, booleans, arrays, and nested objects.
 *
 * @param {any} obj - The object, array, or primitive value to search within.
 * @param {string} search - The search term (case-insensitive).
 * @returns {boolean} True if the search term is found anywhere in the object structure.
 *
 * @example
 * ```typescript
 * const user = { name: 'John Doe', profile: { city: 'Montreal', age: 30 } };
 * const found = searchInObject(user, 'montreal'); // true
 * const notFound = searchInObject(user, 'toronto'); // false
 * ```
 */
/**
 * SearchInObject function.
 * @param obj
 * @param search
 * @returns Function result.
 */
function /**
 * Search in object.
 * @param obj - Obj parameter.
 * @param search - Search parameter.
 * @returns Boolean result.
 */ /**
 * Search in object.
 * @param obj - Obj parameter.
 * @param search - Search parameter.
 * @returns Boolean result.
 */

searchInObject(obj: any, search: string): boolean {
  /**
   * If function.
   * @param obj === null || obj === undefined - obj === null || obj === undefined parameter.
   */ /**
   * If function.
   * @param obj === null || obj === undefined - obj === null || obj === undefined parameter.
   */

  if (obj === null || obj === undefined) {
    return false;
  } /**
   * If function.
   * @param typeof Obj === 'string' - typeof obj === 'string' parameter.
   */ /**
   * If function.
   * @param typeof Obj === 'string' - typeof obj === 'string' parameter.
   */

  if (typeof obj === 'string') {
    return obj.toLowerCase().includes(search);
  } /**
   * If function.
   * @param typeof Obj === 'number' || typeof obj === 'boolean' - typeof obj === 'number' || typeof obj === 'boolean' parameter.
   */ /**
   * If function.
   * @param typeof Obj === 'number' || typeof obj === 'boolean' - typeof obj === 'number' || typeof obj === 'boolean' parameter.
   */

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj).toLowerCase().includes(search);
  }

  if (Array.isArray(obj)) {
    return obj.some((item) => searchInObject(item, search));
  } /**
   * If function.
   * @param typeof Obj === 'object' - typeof obj === 'object' parameter.
   */ /**
   * If function.
   * @param typeof Obj === 'object' - typeof obj === 'object' parameter.
   */

  if (typeof obj === 'object') {
    return Object.values(obj).some((value) => searchInObject(value, search));
  }

  return false;
}

/**
 * Returns the default filter operators available for a specific data type.
 * Each data type has appropriate operators for effective filtering.
 *
 * @param {string} type - The data type ('text', 'number', 'date', 'select', 'multi_select', 'boolean').
 * @returns {FilterOperator[]} Array of available filter operators for the specified type.
 *
 * @example
 * ```typescript
 * const textOps = getDefaultOperators('text'); // ['contains', 'not_contains', 'equals', ...]
 * const numberOps = getDefaultOperators('number'); // ['equals', 'greater_than', 'less_than', ...]
 * const booleanOps = getDefaultOperators('boolean'); // ['equals']
 * ```
 */
/**
 * GetDefaultOperators function.
 * @param type
 * @returns Function result.
 */
/**
 * Get default operators.
 * @param type - Type parameter.
 * @returns Array result.
 */
export function /**
 * Get default operators.
 * @param type - Type parameter.
 * @returns Array result.
 */ /**
 * Get default operators.
 * @param type - Type parameter.
 * @returns Array result.
 */

getDefaultOperators(type: string): FilterOperator[] {
  /**
   * Switch function.
   * @param type - Type parameter.
   */ /**
   * Switch function.
   * @param type - Type parameter.
   */

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
 * Converts a filter operator code to a human-readable display label.
 * Provides user-friendly text for filter operator selection interfaces.
 *
 * @param {FilterOperator} operator - The filter operator code.
 * @returns {string} Human-readable label for the operator.
 *
 * @example
 * ```typescript
 * const label1 = getOperatorLabel('contains'); // 'Contains'
 * const label2 = getOperatorLabel('greater_than_or_equal'); // 'Greater than or equal'
 * const label3 = getOperatorLabel('is_empty'); // 'Is empty'
 * ```
 */
/**
 * GetOperatorLabel function.
 * @param operator
 * @returns Function result.
 */
/**
 * Get operator label.
 * @param operator - Operator parameter.
 * @returns String result.
 */
export function /**
 * Get operator label.
 * @param operator - Operator parameter.
 * @returns String result.
 */ /**
 * Get operator label.
 * @param operator - Operator parameter.
 * @returns String result.
 */

getOperatorLabel(operator: FilterOperator): string {
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
