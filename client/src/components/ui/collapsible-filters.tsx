import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Filter, ChevronDown, ChevronUp, Settings, X } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

interface FilterConfig {
  id: string;
  label: string;
  type: 'select' | 'multiselect' | 'checkbox' | 'custom';
  options?: { value: string; label: string }[];
  value?: any;
  onChange: (value: unknown) => void;
  customComponent?: React.ReactNode;
}

interface ActiveFilter {
  id: string;
  label: string;
  displayValue: string;
}

interface CollapsibleFiltersProps {
  title?: string;
  filters: FilterConfig[];
  activeFilters?: ActiveFilter[];
  onReset?: () => void;
  resetLabel?: string;
  className?: string;
  defaultExpanded?: boolean;
}

/**

 * CollapsibleFilters function

 * @returns Function result

 */

/**
 * CollapsibleFilters component.
 * @param props - Component props.
 * @param props.title - Title text for the element.
 * @param props.filters - filters parameter.
 * @param props.activeFilters = [] - activeFilters = [] parameter.
 * @param props.onReset - onReset parameter.
 * @param props.resetLabel - resetLabel parameter.
 * @param props.className = '' - className = '' parameter.
 * @param props.defaultExpanded = false - defaultExpanded = false parameter.
 * @returns JSX element.
 */
/**
 * Collapsible filters function.
 * @param {
  title - {
  title parameter.
 * @param filters - filters parameter.
 * @param activeFilters = [] - activeFilters = [] parameter.
 * @param onReset - onReset parameter.
 * @param resetLabel - resetLabel parameter.
 * @param className = '' - className = '' parameter.
 * @param defaultExpanded = false - defaultExpanded = false parameter.
 * @param } - } parameter.
 */
export function  /**
   * Collapsible filters function.
   * @param {
  title - {
  title parameter.
   * @param filters - filters parameter.
   * @param activeFilters = [] - activeFilters = [] parameter.
   * @param onReset - onReset parameter.
   * @param resetLabel - resetLabel parameter.
   * @param className = '' - className = '' parameter.
   * @param defaultExpanded = false - defaultExpanded = false parameter.
   * @param } - } parameter.
   */
 CollapsibleFilters({
  title,
  filters,
  activeFilters = [],
  onReset,
  resetLabel,
  className = '',
  defaultExpanded = false,
}: CollapsibleFiltersProps) {
  const { language } = useLanguage();
  const [filtersExpanded, setFiltersExpanded] = useState(defaultExpanded);

  const translations = {
    filters: language === 'fr' ? 'Filtres' : 'Filters',
    reset: language === 'fr' ? 'Réinitialiser' : 'Reset',
    activeFilters: language === 'fr' ? 'Filtres actifs:' : 'Active filters:',
    clear: language === 'fr' ? 'Effacer' : 'Clear',
    selected: language === 'fr' ? 'sélectionnées' : 'selected',
    noOptions: language === 'fr' ? 'Aucune option disponible' : 'No options available',
  };

  return (
    <Card className={className}>
      {title && (
        <CardHeader className='pb-4'>
          <CardTitle className='flex items-center gap-2'>
            <Settings className='w-5 h-5' />
            {title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        {/* Collapsible Filter Toggle */}
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-4'>
            <Button 
              variant='outline' 
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className='flex items-center gap-2'
            >
              <Filter className='w-4 h-4' />
              {translations.filters}
              {filtersExpanded ? <ChevronUp className='w-4 h-4' /> : <ChevronDown className='w-4 h-4' />}
            </Button>
            
            {/* Reset Button */}
            {onReset && (
              <Button 
                variant='outline' 
                size='sm'
                onClick={onReset}
                className='flex items-center gap-1'
              >
                <Settings className='w-3 h-3' />
                {resetLabel || translations.reset}
              </Button>
            )}
          </div>
          
          {/* Active Filters Count */}
          {activeFilters.length > 0 && (
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <span>{translations.activeFilters}</span>
              <div className='flex gap-1'>
                {activeFilters.map((filter) => (
                  <span key={filter.id} className='px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs'>
                    {filter.displayValue}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Expandable Filter Controls */}
        {filtersExpanded && (
          <div className='space-y-4 border-t pt-4'>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
              {filters.map((filter) => {  /**
   * If function.
   * @param filter.type === 'custom' - filter.type === 'custom' parameter.
   */

                if (filter.type === 'custom') {
                  return (
                    <div key={filter.id} className='space-y-2'>
                      <Label className='text-sm font-medium'>{filter.label}</Label>
                      {filter.customComponent}
                    </div>
                  );
                }  /**
   * If function.
   * @param filter.type === 'select' - filter.type === 'select' parameter.
   */

                
                if (filter.type === 'select') {
                  return (
                    <div key={filter.id} className='space-y-2'>
                      <Label className='text-sm font-medium'>{filter.label}</Label>
                      <select
                        value={filter.value || ''}
                        onChange={(e) => filter.onChange(e.target.value)}
                        className='w-full h-9 px-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                      >
                        {filter.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }  /**
   * If function.
   * @param filter.type === 'multiselect' - filter.type === 'multiselect' parameter.
   */

                
                if (filter.type === 'multiselect') {
                  return (
                    <div key={filter.id} className='space-y-2 col-span-full'>
                      <div className='flex items-center justify-between'>
                        <Label className='text-sm font-medium'>{filter.label}</Label>
                        {Array.isArray(filter.value) && filter.value.length > 0 && (
                          <div className='flex items-center gap-2'>
                            <span className='text-xs text-muted-foreground'>
                              {filter.value.length} {translations.selected}
                            </span>
                            <Button 
                              variant='ghost' 
                              size='sm' 
                              onClick={() => filter.onChange([])}
                              className='h-6 px-2 text-xs'
                            >
                              <X className='w-3 h-3 mr-1' />
                              {translations.clear}
                            </Button>
                          </div>
                        )}
                      </div>
                      
                      <div className='max-h-40 overflow-y-auto border rounded-md p-3'>
                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2'>
                          {filter.options?.map((option) => (
                            <label key={option.value} className='flex items-center space-x-2 text-sm hover:bg-muted/50 p-1 rounded cursor-pointer'>
                              <input
                                type='checkbox'
                                checked={Array.isArray(filter.value) && filter.value.includes(option.value)}
                                onChange={(e) => {
                                  const currentValue = Array.isArray(filter.value) ? filter.value : [];  /**
   * If function.
   * @param e.target.checked - e.target.checked parameter.
   */

                                  if (e.target.checked) {
                                    filter.onChange([...currentValue, option.value]);
                                  } else {
                                    filter.onChange(currentValue.filter((v: unknown) => v !== option.value));
                                  }
                                }}
                                className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2'
                              />
                              <span className='truncate'>{option.label}</span>
                            </label>
                          )) || []}
                        </div>
                        
                        {(!filter.options || filter.options.length === 0) && (
                          <div className='text-center py-4 text-sm text-muted-foreground'>
                            {translations.noOptions}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}