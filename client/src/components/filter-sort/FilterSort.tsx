import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  onUpdateFilter: (_field: string, _filter: FilterValue) => void;
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
 *
 * @param root0
 * @param root0.config
 * @param root0.filters
 * @param root0.sort
 * @param root0.search
 * @param root0.onAddFilter
 * @param root0.onRemoveFilter
 * @param root0.onUpdateFilter
 * @param root0.onClearFilters
 * @param root0.onSetSort
 * @param root0.onToggleSort
 * @param root0.onSetSearch
 * @param root0.onApplyPreset
 * @param root0.activeFilterCount
 * @param root0.resultCount
 * @param root0.totalCount
 * @param root0.className
 */
export function FilterSort({
  config,
  filters,
  sort,
  search,
  onAddFilter,
  onRemoveFilter,
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
        value: filterValue,
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
              <Select
                value={selectedFilter?.id || ''}
                onValueChange={(value) => {
                  const filter = config.filters.find((f) => f.id === value);
                  setSelectedFilter(filter || null);
                  if (filter) {
                    const operators = filter.operators || getDefaultOperators(filter.type);
                    setFilterOperator(filter.defaultOperator || operators[0]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select field' />
                </SelectTrigger>
                <SelectContent>
                  {config.filters.map((filter) => (
                    <SelectItem key={filter.id} value={filter.id}>
                      <div className='flex items-center gap-2'>
                        {filter.icon && <filter.icon className='h-4 w-4' />}
                        {filter.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Operator Selection */}
              {selectedFilter && (
                <Select value={filterOperator} onValueChange={setFilterOperator}>
                  <SelectTrigger>
                    <SelectValue placeholder='Select operator' />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedFilter.operators || getDefaultOperators(selectedFilter.type)).map(
                      (op) => (
                        <SelectItem key={op} value={op}>
                          {getOperatorLabel(op)}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              )}

              {/* Value Input */}
              {selectedFilter &&
                filterOperator &&
                !['is_empty', 'is_not_empty'].includes(filterOperator) && (
                  <div>
                    {selectedFilter.type === 'select' && selectedFilter.options ? (
                      <Select value={filterValue} onValueChange={setFilterValue}>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedFilter.placeholder || 'Select value'} />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedFilter.options.map((option) => (
                            <SelectItem key={String(option.value)} value={String(option.value)}>
                              <div className='flex items-center gap-2'>
                                {option.icon && <option.icon className='h-4 w-4' />}
                                {option.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
          <Select
            value=''
            onValueChange={(value) => {
              const preset = config.presets?.find((p) => p.id === value);
              if (preset && onApplyPreset) {
                onApplyPreset(preset.id);
              }
            }}
          >
            <SelectTrigger className='w-[150px]'>
              <SelectValue placeholder='Quick filters'>
                <div className='flex items-center gap-2'>
                  <Sparkles className='h-4 w-4' />
                  Quick filters
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {config.presets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  <div className='flex items-center gap-2'>
                    {preset.icon && <preset.icon className='h-4 w-4' />}
                    {preset.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          {filters.map((filter, index) => {
            const filterConfig = config.filters.find((f) => f.field === filter.field);
            return (
              <Badge key={`${filter.field}-${index}`} variant='secondary' className='pl-2'>
                <span className='mr-1'>{filterConfig?.label || filter.field}:</span>
                <span className='font-normal'>
                  {getOperatorLabel(filter.operator)} {filter.value}
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
