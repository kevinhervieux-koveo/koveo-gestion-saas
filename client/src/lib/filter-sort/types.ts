// Filter and Sort type definitions for reusable component system

export type SortDirection = 'asc' | 'desc';

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

export type FilterType = 
  | 'text' 
  | 'number' 
  | 'date' 
  | 'select' 
  | 'multi_select' 
  | 'boolean';

export interface FilterOption {
  label: string;
  value: string | number | boolean;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
}

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

export interface FilterValue {
  field: string;
  operator: FilterOperator;
  value: any;
}

export interface SortConfig {
  field: string;
  label: string;
  defaultDirection?: SortDirection;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface SortValue {
  field: string;
  direction: SortDirection;
}

export interface FilterSortState {
  filters: FilterValue[];
  sort: SortValue | null;
  search: string;
}

export interface FilterSortPreset {
  id: string;
  name: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  filters: FilterValue[];
  sort?: SortValue;
}

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