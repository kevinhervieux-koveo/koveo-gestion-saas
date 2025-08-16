// Filter and Sort type definitions for reusable component system

/**
 * Sort direction options for data ordering.
 * Used to specify ascending or descending sort order.
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Filter operation types for data filtering.
 * Defines all available comparison operators for filtering data.
 */
export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'in'
  | 'not_in'
  | 'is_empty'
  | 'is_not_empty';

/**
 * Filter input types for different data types.
 * Determines the UI component and validation for filter inputs.
 */
export type FilterType = 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'boolean';

/**
 * Configuration for filter dropdown options.
 * Defines selectable values for select and multi-select filters.
 */
export interface FilterOption {
  label: string;
  value: string | number | boolean;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
}

/**
 * Configuration for a single filter component.
 * Defines the behavior, appearance, and options for filter controls.
 */
export interface FilterConfig {
  id: string;
  field: string;
  label: string;
  type: FilterType;
  placeholder?: string;
  options?: FilterOption[];
  operators?: FilterOperator[];
  defaultOperator?: FilterOperator;
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  multiple?: boolean;
}

/**
 * Active filter value applied to data.
 * Represents a specific filter condition with field, operator, and value.
 */
export interface FilterValue {
  field: string;
  operator: FilterOperator;
  value: any;
}

/**
 * Configuration for sortable columns.
 * Defines how data can be sorted by specific fields.
 */
export interface SortConfig {
  field: string;
  label: string;
  defaultDirection?: SortDirection;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Active sort configuration.
 * Represents the current sort field and direction applied to data.
 */
export interface SortValue {
  field: string;
  direction: SortDirection;
}

/**
 * Complete filter and sort state.
 * Represents the current state of all filters, sort, and search applied to data.
 */
export interface FilterSortState {
  filters: FilterValue[];
  sort: SortValue | null;
  search: string;
}

/**
 * Predefined filter and sort configuration.
 * Allows users to quickly apply common filter combinations.
 */
export interface FilterSortPreset {
  id: string;
  name: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  filters: FilterValue[];
  sort?: SortValue;
}

/**
 * Complete configuration for filter and sort functionality.
 * Defines all available filters, sort options, presets, and behavior settings.
 */
export interface FilterSortConfig {
  filters: FilterConfig[];
  sortOptions: SortConfig[];
  presets?: FilterSortPreset[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFields?: string[];
  allowMultipleFilters?: boolean;
  persistState?: boolean;
  storageKey?: string;
}
