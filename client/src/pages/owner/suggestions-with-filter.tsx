import { useQuery, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  Clock,
  MessageSquare,
  AlertCircle,
  Shield,
  Code,
  FileText,
  Zap,
  Terminal,
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { FilterSort } from '@/components/filter-sort/FilterSort';
import { useFilterSort, FilterSortConfig } from '@/lib/filter-sort';

/**
 *
 */
interface ImprovementSuggestion {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low' | 'Critical';
  status: 'New' | 'Acknowledged' | 'Done';
  category: string;
  createdAt: string;
}

// Filter and sort configuration for suggestions
const filterSortConfig: FilterSortConfig = {
  filters: [
    {
      id: 'priority',
      field: 'priority',
      label: 'Priority',
      type: 'select',
      icon: AlertCircle,
      options: [
        { label: 'Critical', value: 'Critical', color: 'purple' },
        { label: 'High', value: 'High', color: 'red' },
        { label: 'Medium', value: 'Medium', color: 'yellow' },
        { label: 'Low', value: 'Low', color: 'blue' },
      ],
      defaultOperator: 'equals',
    },
    {
      id: 'status',
      field: 'status',
      label: 'Status',
      type: 'select',
      icon: Clock,
      options: [
        { label: 'New', value: 'New' },
        { label: 'Acknowledged', value: 'Acknowledged' },
        { label: 'Done', value: 'Done' },
      ],
      defaultOperator: 'equals',
    },
    {
      id: 'category',
      field: 'category',
      label: 'Category',
      type: 'select',
      icon: MessageSquare,
      options: [
        { label: 'Code Quality', value: 'Code Quality', icon: Code },
        { label: 'Testing', value: 'Testing' },
        { label: 'Documentation', value: 'Documentation', icon: FileText },
        { label: 'Security', value: 'Security', icon: Shield },
        { label: 'Performance', value: 'Performance', icon: Zap },
      ],
      defaultOperator: 'equals',
    },
    {
      id: 'title',
      field: 'title',
      label: 'Title',
      type: 'text',
      placeholder: 'Search in title...',
      defaultOperator: 'contains',
    },
    {
      id: 'description',
      field: 'description',
      label: 'Description',
      type: 'text',
      placeholder: 'Search in description...',
      defaultOperator: 'contains',
    },
  ],
  sortOptions: [
    { field: 'createdAt', label: 'Date Created', defaultDirection: 'desc' },
    { field: 'priority', label: 'Priority' },
    { field: 'status', label: 'Status' },
    { field: 'category', label: 'Category' },
    { field: 'title', label: 'Title' },
  ],
  presets: [
    {
      id: 'critical-new',
      name: 'Critical & New',
      description: 'Show critical priority items that are new',
      icon: AlertCircle,
      filters: [
        { field: 'priority', operator: 'equals', value: 'Critical' },
        { field: 'status', operator: 'equals', value: 'New' },
      ],
    },
    {
      id: 'high-priority',
      name: 'High Priority',
      description: 'Show high and critical priority items',
      filters: [{ field: 'priority', operator: 'in', value: ['Critical', 'High'] }],
      sort: { field: 'createdAt', direction: 'desc' },
    },
    {
      id: 'pending-work',
      name: 'Pending Work',
      description: 'Show items that are not done',
      filters: [{ field: 'status', operator: 'not_equals', value: 'Done' }],
      sort: { field: 'priority', direction: 'asc' },
    },
    {
      id: 'security-issues',
      name: 'Security Issues',
      description: 'Show all security-related suggestions',
      icon: Shield,
      filters: [{ field: 'category', operator: 'equals', value: 'Security' }],
    },
  ],
  searchable: true,
  searchPlaceholder: 'Search suggestions...',
  searchFields: ['title', 'description', 'category'],
  allowMultipleFilters: false,
  persistState: true,
  storageKey: 'suggestions-filters',
};

/**
 *
 */
export default function OwnerSuggestionsWithFilter() {
  const { data: suggestions = [], isLoading } = useQuery<ImprovementSuggestion[]>({
    queryKey: ['/api/pillars/suggestions'],
  });

  // Use the filter and sort hook
  const {
    filteredData,
    filters,
    sort,
    search,
    addFilter,
    removeFilter,
    clearFilters,
    toggleSort,
    setSearch,
    applyPreset,
    hasActiveFilters,
    activeFilterCount,
    resultCount,
  } = useFilterSort({
    data: suggestions,
    config: filterSortConfig,
    initialState: {
      sort: { field: 'createdAt', direction: 'desc' },
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/pillars/suggestions/${id}/acknowledge`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pillars/suggestions'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/pillars/suggestions/${id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pillars/suggestions'] });
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-purple-100 text-purple-800';
      case 'High':
        return 'bg-red-100 text-red-800';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'Low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Done':
        return 'bg-green-100 text-green-800';
      case 'Acknowledged':
        return 'bg-blue-100 text-blue-800';
      case 'New':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAIPrompt = (suggestion: ImprovementSuggestion) => {
    const baseContext =
      'You are working on a Quebec property management SaaS called Koveo Gestion. ';

    switch (suggestion.category) {
      case 'Code Quality':
        return `${baseContext}${suggestion.description} Focus on improving code maintainability while preserving existing functionality. Follow existing TypeScript patterns and ensure all changes maintain type safety.`;

      case 'Testing':
        return `${baseContext}${suggestion.description} Add comprehensive unit tests using Jest and React Testing Library. Focus on critical paths and edge cases. Ensure tests follow the existing test structure in /tests/ directory.`;

      case 'Documentation':
        return `${baseContext}${suggestion.description} Add JSDoc comments to all exported functions and classes. Follow the existing documentation style and include parameter descriptions, return values, and usage examples where appropriate.`;

      case 'Security':
        return `${baseContext}${suggestion.description} Address security vulnerabilities while maintaining Law 25 compliance for Quebec privacy regulations. Update dependencies safely and validate all changes don't break authentication or data protection.`;

      case 'Performance':
        return `${baseContext}${suggestion.description} Optimize performance while maintaining the existing user experience. Consider code splitting, lazy loading, and bundle optimization. Test changes thoroughly to ensure no regressions.`;

      default:
        return `${baseContext}${suggestion.description} Implement this improvement following the existing codebase patterns and Quebec property management requirements. Ensure all changes are well-tested and documented.`;
    }
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = filterSortConfig.presets?.find((p) => p.id === presetId);
    if (preset) {
      applyPreset(preset);
    }
  };

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header
        title='Improvement Suggestions'
        subtitle='Review and manage system improvement recommendations'
      />

      {/* Refresh Command */}
      <div className='border-b bg-gray-50 px-6 py-3'>
        <div className='max-w-7xl mx-auto'>
          <div className='flex items-center gap-2 text-sm text-gray-600'>
            <Terminal className='h-4 w-4' />
            <span className='font-medium'>Refresh Command:</span>
            <code className='bg-gray-100 px-2 py-1 rounded text-xs font-mono'>tsx scripts/run-quality-check.ts</code>
          </div>
        </div>
      </div>

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto'>
          {/* Filter and Sort Component */}
          <FilterSort
            config={filterSortConfig}
            filters={filters}
            sort={sort}
            search={search}
            onAddFilter={addFilter}
            onRemoveFilter={removeFilter}
            onUpdateFilter={() => {}}
            onClearFilters={clearFilters}
            onSetSort={() => {}}
            onToggleSort={toggleSort}
            onSetSearch={setSearch}
            onApplyPreset={handleApplyPreset}
            activeFilterCount={activeFilterCount}
            resultCount={resultCount}
            totalCount={suggestions.length}
            className='mb-6'
          />

          {isLoading ? (
            <div className='flex items-center justify-center h-64'>
              <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-koveo-navy'></div>
            </div>
          ) : (
            <div className='space-y-4'>
              {filteredData && filteredData.length > 0 ? (
                filteredData.map((suggestion) => (
                  <Card key={suggestion.id} className='hover:shadow-md transition-shadow'>
                    <CardHeader>
                      <div className='flex items-start justify-between'>
                        <div className='flex-1'>
                          <CardTitle className='text-lg font-semibold text-koveo-navy'>
                            {suggestion.title}
                          </CardTitle>
                          <CardDescription className='mt-2'>
                            {suggestion.description}
                          </CardDescription>
                        </div>
                        <div className='flex flex-col gap-2 ml-4'>
                          <Badge className={getPriorityColor(suggestion.priority)}>
                            {suggestion.priority} Priority
                          </Badge>
                          <Badge className={getStatusColor(suggestion.status)}>
                            {suggestion.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className='mb-4'>
                        <div className='flex items-center gap-4 text-sm text-gray-600 mb-3'>
                          <span className='flex items-center gap-1'>
                            <MessageSquare size={16} />
                            {suggestion.category}
                          </span>
                          <span>
                            Created: {new Date(suggestion.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {/* AI Agent Prompt */}
                        <div className='bg-blue-50 border border-blue-200 rounded-lg p-3'>
                          <div className='text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wide'>
                            AI Agent Prompt
                          </div>
                          <div className='text-sm text-blue-900 font-mono bg-white border rounded px-3 py-2 select-all cursor-pointer'>
                            {getAIPrompt(suggestion)}
                          </div>
                          <div className='text-xs text-blue-600 mt-1'>
                            Click to select and copy the prompt above
                          </div>
                        </div>
                      </div>

                      <div className='flex items-center justify-between'>
                        <div></div>

                        <div className='flex gap-2'>
                          {suggestion.status === 'New' && (
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() => acknowledgeMutation.mutate(suggestion.id)}
                              disabled={acknowledgeMutation.isPending}
                              className='flex items-center gap-2'
                            >
                              <Clock size={16} />
                              Acknowledge
                            </Button>
                          )}

                          {(suggestion.status === 'New' ||
                            suggestion.status === 'Acknowledged') && (
                            <Button
                              size='sm'
                              onClick={() => completeMutation.mutate(suggestion.id)}
                              disabled={completeMutation.isPending}
                              className='flex items-center gap-2'
                            >
                              <CheckCircle size={16} />
                              Mark Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className='flex flex-col items-center justify-center py-16'>
                    <MessageSquare size={48} className='text-gray-400 mb-4' />
                    <h3 className='text-lg font-semibold text-gray-600 mb-2'>
                      {hasActiveFilters ? 'No Matching Suggestions' : 'No Suggestions Available'}
                    </h3>
                    <p className='text-gray-500 text-center'>
                      {hasActiveFilters
                        ? 'Try adjusting your filters to see more results.'
                        : 'No improvement suggestions have been generated yet. Run the quality check to generate recommendations.'}
                    </p>
                    {hasActiveFilters && (
                      <Button onClick={clearFilters} variant='outline' size='sm' className='mt-4'>
                        Clear Filters
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
