import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useLanguage } from '@/hooks/use-language';
import { SelectionGrid, SelectionGridItem } from './SelectionGrid';

interface SearchableSelectionGridProps {
  items: SelectionGridItem[];
  onSelectItem: (id: string) => void;
  isLoading: boolean;
  searchPlaceholder?: string;
  noResultsMessage?: string;
  pageSize?: number;
  paginationThreshold?: number;
  getSearchText?: (item: SelectionGridItem) => string;
  searchTestId?: string;
  paginationTestId?: string;
}

const DEFAULT_PAGE_SIZE = 12;

export function SearchableSelectionGrid({
  items,
  onSelectItem,
  isLoading,
  searchPlaceholder,
  noResultsMessage,
  pageSize = DEFAULT_PAGE_SIZE,
  paginationThreshold,
  getSearchText,
  searchTestId = 'input-search-residences',
  paginationTestId = 'residence-chooser-pagination',
}: SearchableSelectionGridProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const threshold = paginationThreshold ?? pageSize;

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    const extract = getSearchText ?? ((item: SelectionGridItem) => `${item.name} ${item.details}`);
    return items.filter((item) => extract(item).toLowerCase().includes(q));
  }, [items, query, getSearchText]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const shouldPaginate = items.length > threshold;

  // Reset to first page whenever the filter changes the page count beneath us.
  useEffect(() => {
    if (page > totalPages) {
      setPage(1);
    }
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    if (!shouldPaginate) return filteredItems;
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize, shouldPaginate]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Only render the search box when the underlying list is large enough that
  // searching/paginating actually helps. Residents with 1 or a few links keep
  // the existing simple grid.
  const showSearch = items.length > threshold;

  const placeholder = searchPlaceholder ?? t('searchPlaceholder' as any);
  const emptyMessage = noResultsMessage ?? t('noItemsFound' as any);

  return (
    <div className='flex flex-col gap-4'>
      {showSearch && (
        <div className='relative max-w-md'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
          <Input
            type='search'
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={placeholder}
            className='pl-9'
            data-testid={searchTestId}
          />
        </div>
      )}

      {filteredItems.length === 0 && query.trim() !== '' ? (
        <div
          className='text-sm text-muted-foreground py-8 text-center'
          data-testid='residence-chooser-no-results'
        >
          {emptyMessage}
        </div>
      ) : (
        <SelectionGrid
          title=''
          items={pageItems}
          onSelectItem={onSelectItem}
          onBack={null}
          isLoading={false}
        />
      )}

      {shouldPaginate && totalPages > 1 && filteredItems.length > 0 && (
        <div
          className='flex items-center justify-center gap-2 pt-2'
          data-testid={paginationTestId}
        >
          <Button
            variant='outline'
            size='sm'
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            data-testid='button-residence-chooser-previous'
          >
            <ChevronLeft className='h-4 w-4 mr-1' />
            {t('previous' as any)}
          </Button>
          <span className='text-sm text-muted-foreground' data-testid='residence-chooser-page-info'>
            {page} / {totalPages}
          </span>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            data-testid='button-residence-chooser-next'
          >
            {t('next' as any)}
            <ChevronRight className='h-4 w-4 ml-1' />
          </Button>
        </div>
      )}
    </div>
  );
}
