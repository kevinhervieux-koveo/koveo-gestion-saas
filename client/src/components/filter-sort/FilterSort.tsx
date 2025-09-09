import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Filter,
  Search,
  X,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from 'lucide-react';
import { FilterSortConfig, FilterValue, SortValue, FilterConfig } from '@/lib/filter-sort/types';
import { getDefaultOperators, getOperatorLabel } from '@/lib/filter-sort/utils';
import { cn } from '@/lib/utils';

/**
 * Props for the FilterSort component.
 * Defines all callbacks and state values needed for advanced filtering and sorting functionality.
 */
interface FilterSortProps {
  config: FilterSortConfig;
  filters: FilterValue[];
  sort: SortValue | null;
  search: string;
  onAddFilter: (_filter: FilterValue) => void;
  onRemoveFilter: (_field: string) => void;
  onFilterUpdate: (_field: string, _filter: FilterValue) => void;
  onClearFilters: () => void;
  onSetSort: (_sort: SortValue | null) => void;
  onToggleSort: (_field: string) => void;
  onSetSearch: (_search: string) => void;
  onApplyPreset?: (_presetId: string) => void;
  activeFilterCount?: number;
  resultCount?: number;
  totalCount?: number;
  className?: string;
}

/**
 * Advanced filtering and sorting component with preset support.
 * Provides a comprehensive interface for data filtering, sorting, and search functionality.
 * @param props - The component props.
 * @param props.config - Filter and sort configuration options.
 * @param props.filters - Current active filters array.
 * @param props.sort - Current sort configuration.
 * @param props.search - Current search query string.
 * @param props.onAddFilter - Callback to add a new filter.
 * @param props.onRemoveFilter - Callback to remove a filter by field.
 * @param props.onFilterUpdate - Callback to update an existing filter.
 * @param props.onClearFilters - Callback to clear all active filters.
 * @param props.onSetSort - Callback to set sort configuration.
 * @param props.onToggleSort - Callback to toggle sort direction for a field.
 * @param props.onSetSearch - Callback to update search query.
 * @param props.onApplyPreset - Optional callback to apply filter presets.
 * @param props.activeFilterCount - Number of currently active filters.
 * @param props.resultCount - Number of filtered results.
 * @param props.totalCount - Total number of items before filtering.
 * @param props.className - Optional CSS class name.
 * @returns JSX element for the filter sort interface.
 */
export function FilterSort({
  config,
  filters,
  sort,
  search,
  onAddFilter,
  onRemoveFilter,
  onFilterUpdate: _onFilterUpdate,
  onClearFilters,
  onSetSort,
  onToggleSort,
  onSetSearch,
  onApplyPreset,
  activeFilterCount = 0,
  resultCount,
  totalCount,
  className,
}: FilterSortProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterConfig | null>(null);
  const [filterOperator, setFilterOperator] = useState<string>('');
  const [filterValue, setFilterValue] = useState<any>('');

  const handleAddFilter = () => {
    if (selectedFilter && filterOperator && filterValue !== '') {
      onAddFilter({
        field: selectedFilter.field,
        operator: filterOperator as any,
        _value: filterValue,
      });
      // Reset form
      setSelectedFilter(null);
      setFilterOperator('');
      setFilterValue('');
      setFilterOpen(false);
    }
  };

  const getSortIcon = (field: string) => {
    if (sort?.field !== field) {
      return <ArrowUpDown className='h-4 w-4' />;
    }
    if (sort.direction === 'asc') {
      return <ArrowUp className='h-4 w-4' />;
    }
    return <ArrowDown className='h-4 w-4' />;
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className='flex flex-wrap items-center gap-2'>
        {/* Search Input */}
        {config.searchable && (
          <div className='relative flex-1 min-w-[200px] max-w-md'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
            <Input
              type='text'
              placeholder={config.searchPlaceholder || 'Search...'}
              value={search}
              onChange={(e) => onSetSearch(e.target.value)}
              className='pl-9 pr-9'
            />
            {search && (
              <button
                onClick={() => onSetSearch('')}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600'
              >
                <X className='h-4 w-4' />
              </button>
            )}
          </div>
        )}

        {/* Filter Button */}
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant='outline' size='default'>
              <Filter className='h-4 w-4 mr-2' />
              Filter
              {activeFilterCount > 0 && (
                <Badge variant='secondary' className='ml-2'>
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-80' align='start'>
            <div className='space-y-3'>
              <h4 className='font-medium text-sm'>Add Filter</h4>

              {/* Filter Field Selection */}
              <SearchableSelect
                value={selectedFilter?.id || ''}
                onValueChange={(_value) => {
                  const filter = config.filters.find((f) => f.id === _value);
                  setSelectedFilter(filter || null);
                  if (filter) {
                    const operators = filter.operators || getDefaultOperators(filter.type);
                    setFilterOperator(filter.defaultOperator || operators[0]);
                  }
                }}
                options={config.filters.map((filter) => ({
                  value: filter.id,
                  label: filter.label,
                }))}
                placeholder="Select field"
                searchPlaceholder="Search fields..."
                width="w-full"
              />

              {/* Operator Selection */}
              {selectedFilter && (
                <SearchableSelect
                  value={filterOperator}
                  onValueChange={setFilterOperator}
                  options={(selectedFilter.operators || getDefaultOperators(selectedFilter.type)).map(
                    (op) => ({
                      value: op,
                      label: getOperatorLabel(op),
                    })
                  )}
                  placeholder="Select operator"
                  searchPlaceholder="Search operators..."
                  width="w-full"
                />
              )}

              {/* Value Input */}
              {selectedFilter &&
                filterOperator &&
                !['is_empty', 'is_not_empty'].includes(filterOperator) && (
                  <div>
                    {selectedFilter.type === 'select' && selectedFilter.options ? (
                      <SearchableSelect
                        value={filterValue}
                        onValueChange={setFilterValue}
                        options={selectedFilter.options.map((option) => ({
                          value: String(option._value),
                          label: option.label,
                        }))}
                        placeholder={selectedFilter.placeholder || 'Select value'}
                        searchPlaceholder="Search values..."
                        width="w-full"
                      />
                    ) : (
                      <Input
                        type={selectedFilter.type === 'number' ? 'number' : 'text'}
                        placeholder={selectedFilter.placeholder || 'Enter value'}
                        value={filterValue}
                        onChange={(e) => setFilterValue(e.target.value)}
                      />
                    )}
                  </div>
                )}

              {/* Apply Button */}
              <Button
                onClick={handleAddFilter}
                disabled={
                  !selectedFilter ||
                  !filterOperator ||
                  (['is_empty', 'is_not_empty'].includes(filterOperator) ? false : !filterValue)
                }
                className='w-full'
                size='sm'
              >
                Apply Filter
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Sort Button */}
        <Popover open={sortOpen} onOpenChange={setSortOpen}>
          <PopoverTrigger asChild>
            <Button variant='outline' size='default'>
              <ArrowUpDown className='h-4 w-4 mr-2' />
              Sort
              {sort && <ChevronDown className='ml-2 h-4 w-4' />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-56' align='start'>
            <div className='space-y-1'>
              <h4 className='font-medium text-sm mb-2'>Sort by</h4>
              {config.sortOptions.map((option) => (
                <button
                  key={option.field}
                  onClick={() => {
                    onToggleSort(option.field);
                    setSortOpen(false);
                  }}
                  className={cn(
                    'flex items-center justify-between w-full px-2 py-1.5 text-sm rounded hover:bg-gray-100',
                    sort?.field === option.field && 'bg-gray-100'
                  )}
                >
                  <div className='flex items-center gap-2'>
                    {option.icon && <option.icon className='h-4 w-4' />}
                    {option.label}
                  </div>
                  {getSortIcon(option.field)}
                </button>
              ))}
              {sort && (
                <>
                  <div className='border-t pt-1 mt-2' />
                  <button
                    onClick={() => {
                      onSetSort(null);
                      setSortOpen(false);
                    }}
                    className='flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-gray-100'
                  >
                    <X className='h-4 w-4' />
                    Clear Sort
                  </button>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Presets */}
        {config.presets && config.presets.length > 0 && (
          <SearchableSelect
            value=''
            onValueChange={(_value) => {
              const preset = config.presets?.find((p) => p.id === _value);
              if (preset && onApplyPreset) {
                onApplyPreset(preset.id);
              }
            }}
            options={config.presets.map((preset) => ({
              value: preset.id,
              label: preset.name,
            }))}
            placeholder="Quick filters"
            searchPlaceholder="Search presets..."
            width="w-[150px]"
          />
        )}

        {/* Clear All */}
        {(activeFilterCount > 0 || search) && (
          <Button
            variant='ghost'
            size='sm'
            onClick={() => {
              onClearFilters();
              onSetSearch('');
            }}
          >
            <X className='h-4 w-4 mr-1' />
            Clear All
          </Button>
        )}

        {/* Result Count */}
        {resultCount !== undefined && totalCount !== undefined && (
          <div className='ml-auto text-sm text-gray-600'>
            Showing {resultCount} of {totalCount} results
          </div>
        )}
      </div>

      {/* Active Filters Display */}
      {filters.length > 0 && (
        <div className='flex flex-wrap gap-2'>
          {filters.map((filter, _index) => {
            const filterConfig = config.filters.find((f) => f.field === filter.field);
            return (
              <Badge key={`${filter.field}-${_index}`} variant='secondary' className='pl-2'>
                <span className='mr-1'>{filterConfig?.label || filter.field}:</span>
                <span className='font-normal'>
                  {getOperatorLabel(filter.operator)} {filter._value}
                </span>
                <button
                  onClick={() => onRemoveFilter(filter.field)}
                  className='ml-2 hover:text-red-600'
                >
                  <X className='h-3 w-3' />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
