import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  Search, 
  Filter, 
  SortAsc, 
  SortDesc, 
  X,
  RotateCcw 
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
/**
 *
 */
export interface FilterOption {
  id: string;
  label: string;
  value: string | number | boolean;
}

/**
 *
 */
export interface SortOption {
  id: string;
  label: string;
  field: string;
  direction?: 'asc' | 'desc';
}

/**
 *
 */
export interface FilterConfig {
  id: string;
  label: string;
  type: 'select' | 'multiselect' | 'boolean' | 'range';
  options?: FilterOption[];
}

/**
 *
 */
export interface FilterSortState {
  search: string;
  filters: Record<string, any>;
  sort: {
    field: string;
    direction: 'asc' | 'desc';
  } | null;
}

/**
 *
 */
interface FilterSortProps {
  searchPlaceholder?: string;
  filterConfigs?: FilterConfig[];
  sortOptions?: SortOption[];
  state: FilterSortState;
  onChange: (state: FilterSortState) => void;
  className?: string;
  showSearch?: boolean;
  showFilters?: boolean;
  showSort?: boolean;
}

/**
 * Filter and Sort Component - Refactored using reusable patterns
 * Reduced from 386+ lines to ~200 lines with better maintainability.
 * @param root0
 * @param root0.searchPlaceholder
 * @param root0.filterConfigs
 * @param root0.sortOptions
 * @param root0.state
 * @param root0.onChange
 * @param root0.className
 * @param root0.showSearch
 * @param root0.showFilters
 * @param root0.showSort
 */
export function FilterSort({
  searchPlaceholder = 'Search...',
  filterConfigs = [],
  sortOptions = [],
  state,
  onChange,
  className,
  showSearch = true,
  showFilters = true,
  showSort = true,
}: FilterSortProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Handle search change
  const handleSearchChange = useCallback((search: string) => {
    onChange({ ...state, search });
  }, [state, onChange]);

  // Handle filter change
  const handleFilterChange = useCallback((filterId: string, value: any) => {
    const newFilters = { ...state.filters };
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete newFilters[filterId];
    } else {
      newFilters[filterId] = value;
    }
    onChange({ ...state, filters: newFilters });
  }, [state, onChange]);

  // Handle sort change
  const handleSortChange = useCallback((field: string, direction: 'asc' | 'desc') => {
    onChange({ 
      ...state, 
      sort: { field, direction } 
    });
  }, [state, onChange]);

  // Clear all filters and search
  const handleReset = useCallback(() => {
    onChange({
      search: '',
      filters: {},
      sort: null,
    });
    setIsFilterOpen(false);
  }, [onChange]);

  // Get active filter count
  const activeFilterCount = Object.keys(state.filters).length;
  const hasActiveState = state.search || activeFilterCount > 0 || state.sort;

  return (
    <Card className={cn('mb-4', className)}>
      <CardContent className="py-3">
        <div className="flex items-center gap-3">
          {/* Search */}
          {showSearch && (
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={state.search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
              {state.search && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => handleSearchChange('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}

          {/* Filters */}
          {showFilters && filterConfigs.length > 0 && (
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4" align="start">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Filters</h4>
                    {hasActiveState && (
                      <Button variant="ghost" size="sm" onClick={handleReset}>
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Reset
                      </Button>
                    )}
                  </div>
                  
                  {filterConfigs.map((config) => (
                    <FilterField
                      key={config.id}
                      config={config}
                      value={state.filters[config.id]}
                      onChange={(value) => handleFilterChange(config.id, value)}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Sort */}
          {showSort && sortOptions.length > 0 && (
            <Select
              value={state.sort ? `${state.sort.field}_${state.sort.direction}` : ''}
              onValueChange={(value) => {
                if (value) {
                  const [field, direction] = value.split('_');
                  handleSortChange(field, direction as 'asc' | 'desc');
                } else {
                  onChange({ ...state, sort: null });
                }
              }}
            >
              <SelectTrigger className="w-[180px]">
                <div className="flex items-center gap-2">
                  {state.sort?.direction === 'desc' ? (
                    <SortDesc className="h-4 w-4" />
                  ) : (
                    <SortAsc className="h-4 w-4" />
                  )}
                  <SelectValue placeholder="Sort by..." />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No sorting</SelectItem>
                {sortOptions.map((option) => (
                  <React.Fragment key={option.id}>
                    <SelectItem value={`${option.field}_asc`}>
                      <div className="flex items-center gap-2">
                        <SortAsc className="h-4 w-4" />
                        {option.label} (A-Z)
                      </div>
                    </SelectItem>
                    <SelectItem value={`${option.field}_desc`}>
                      <div className="flex items-center gap-2">
                        <SortDesc className="h-4 w-4" />
                        {option.label} (Z-A)
                      </div>
                    </SelectItem>
                  </React.Fragment>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Reset button (always visible when there are active filters) */}
          {hasActiveState && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          )}
        </div>

        {/* Active filters display */}
        {(state.search || activeFilterCount > 0) && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
            {state.search && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Search: "{state.search}"
                <button
                  onClick={() => handleSearchChange('')}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            {Object.entries(state.filters).map(([filterId, value]) => {
              const config = filterConfigs.find(f => f.id === filterId);
              if (!config) {return null;}
              
              let displayValue = value;
              if (config.type === 'select' && config.options) {
                const option = config.options.find(opt => opt.value === value);
                displayValue = option?.label || value;
              }
              
              return (
                <Badge key={filterId} variant="secondary" className="flex items-center gap-1">
                  {config.label}: {displayValue}
                  <button
                    onClick={() => handleFilterChange(filterId, undefined)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Individual filter field component
/**
 *
 */
interface FilterFieldProps {
  config: FilterConfig;
  value: any;
  onChange: (value: any) => void;
}

/**
 *
 * @param root0
 * @param root0.config
 * @param root0.value
 * @param root0.onChange
 */
function FilterField({ config, value, onChange }: FilterFieldProps) {
  switch (config.type) {
    case 'select':
      return (
        <div className="space-y-2">
          <label className="text-sm font-medium">{config.label}</label>
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${config.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              {config.options?.map((option) => (
                <SelectItem key={option.id} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case 'boolean':
      return (
        <div className="space-y-2">
          <label className="text-sm font-medium">{config.label}</label>
          <Select value={value === undefined ? '' : String(value)} onValueChange={(v) => onChange(v === '' ? undefined : v === 'true')}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );

    default:
      return null;
  }
}