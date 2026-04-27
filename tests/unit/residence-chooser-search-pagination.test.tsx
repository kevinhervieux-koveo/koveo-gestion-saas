/**
 * Unit tests for SearchableSelectionGrid — search and pagination (Task #1324).
 *
 * Covers:
 *  - search filtering: items matching the query are shown, others hidden.
 *  - no-results state: when no items match the query, the no-results message is shown.
 *  - page reset: page resets to 1 when the query changes.
 *  - pagination: next/prev buttons navigate pages; page info label reflects state.
 *  - threshold: search box and pagination only appear when item count exceeds threshold.
 *  - all items visible when list is small (below threshold).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, jest } from '@jest/globals';
import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveTextContent(text: string | RegExp): R;
    }
  }
}

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
}));

jest.mock('@/components/common/SelectionGrid', () => ({
  SelectionGrid: ({
    items,
    onSelectItem,
  }: {
    items: Array<{ id: string; name: string; details?: string }>;
    onSelectItem: (id: string) => void;
  }) => (
    <div data-testid='selection-grid'>
      {items.map((item) => (
        <button
          key={item.id}
          data-testid={`grid-item-${item.id}`}
          onClick={() => onSelectItem(item.id)}
        >
          {item.name}
        </button>
      ))}
    </div>
  ),
}));

import { SearchableSelectionGrid } from '@/components/common/SearchableSelectionGrid';

function buildItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i + 1}`,
    name: `Building ${String.fromCharCode(65 + (i % 26))} ${i + 1}`,
    details: `${i + 1} Main Street`,
    type: 'building' as const,
  }));
}

const onSelectItem = jest.fn();

describe('SearchableSelectionGrid — search', () => {
  test('shows all items when query is empty', () => {
    const items = buildItems(5);
    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        paginationThreshold={100}
      />,
    );

    items.forEach((item) => {
      expect(screen.getByTestId(`grid-item-${item.id}`)).toBeInTheDocument();
    });
  });

  test('filters items matching the search query (case-insensitive)', () => {
    const items = [
      { id: 'a', name: 'Maple Heights', details: '10 Maple Ave', type: 'building' as const },
      { id: 'b', name: 'Riverside Towers', details: '5 River Road', type: 'building' as const },
      { id: 'c', name: 'Oakwood Park', details: '20 Oak Lane', type: 'building' as const },
    ];
    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        paginationThreshold={2}
      />,
    );

    const search = screen.getByTestId('input-search-residences');
    fireEvent.change(search, { target: { value: 'maple' } });

    expect(screen.getByTestId('grid-item-a')).toBeInTheDocument();
    expect(screen.queryByTestId('grid-item-b')).not.toBeInTheDocument();
    expect(screen.queryByTestId('grid-item-c')).not.toBeInTheDocument();
  });

  test('shows no-results message when nothing matches', () => {
    const items = [
      { id: 'a', name: 'Maple Heights', details: '10 Maple Ave', type: 'building' as const },
    ];
    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        paginationThreshold={0}
        noResultsMessage='No buildings found'
      />,
    );

    const search = screen.getByTestId('input-search-residences');
    fireEvent.change(search, { target: { value: 'zzz-nomatch' } });

    expect(screen.getByTestId('residence-chooser-no-results')).toBeInTheDocument();
    expect(screen.getByTestId('residence-chooser-no-results')).toHaveTextContent(
      'No buildings found',
    );
    expect(screen.queryByTestId('grid-item-a')).not.toBeInTheDocument();
  });

  test('custom searchTestId overrides the default testid for the input', () => {
    render(
      <SearchableSelectionGrid
        items={buildItems(5)}
        onSelectItem={onSelectItem}
        isLoading={false}
        paginationThreshold={4}
        searchTestId='my-custom-search'
      />,
    );

    expect(screen.getByTestId('my-custom-search')).toBeInTheDocument();
    expect(screen.queryByTestId('input-search-residences')).not.toBeInTheDocument();
  });
});

describe('SearchableSelectionGrid — threshold', () => {
  test('hides search box when item count is at or below threshold', () => {
    const items = buildItems(3);
    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        paginationThreshold={3}
      />,
    );

    expect(screen.queryByTestId('input-search-residences')).not.toBeInTheDocument();
    items.forEach((item) => {
      expect(screen.getByTestId(`grid-item-${item.id}`)).toBeInTheDocument();
    });
  });

  test('shows search box when item count exceeds threshold', () => {
    const items = buildItems(4);
    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        paginationThreshold={3}
      />,
    );

    expect(screen.getByTestId('input-search-residences')).toBeInTheDocument();
  });
});

describe('SearchableSelectionGrid — pagination', () => {
  test('paginates items and shows page navigation controls', () => {
    const items = buildItems(15);
    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        pageSize={5}
        paginationThreshold={5}
      />,
    );

    expect(screen.getByTestId('residence-chooser-pagination')).toBeInTheDocument();
    expect(screen.getByTestId('residence-chooser-page-info')).toHaveTextContent('1 / 3');

    expect(screen.getByTestId('grid-item-item-1')).toBeInTheDocument();
    expect(screen.queryByTestId('grid-item-item-6')).not.toBeInTheDocument();
  });

  test('next button advances to the second page', () => {
    const items = buildItems(15);
    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        pageSize={5}
        paginationThreshold={5}
      />,
    );

    fireEvent.click(screen.getByTestId('button-residence-chooser-next'));
    expect(screen.getByTestId('residence-chooser-page-info')).toHaveTextContent('2 / 3');
    expect(screen.getByTestId('grid-item-item-6')).toBeInTheDocument();
    expect(screen.queryByTestId('grid-item-item-1')).not.toBeInTheDocument();
  });

  test('previous button goes back to the first page', () => {
    const items = buildItems(15);
    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        pageSize={5}
        paginationThreshold={5}
      />,
    );

    fireEvent.click(screen.getByTestId('button-residence-chooser-next'));
    fireEvent.click(screen.getByTestId('button-residence-chooser-previous'));
    expect(screen.getByTestId('residence-chooser-page-info')).toHaveTextContent('1 / 3');
  });

  test('previous button is disabled on first page', () => {
    const items = buildItems(15);
    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        pageSize={5}
        paginationThreshold={5}
      />,
    );

    expect(screen.getByTestId('button-residence-chooser-previous')).toBeDisabled();
  });

  test('next button is disabled on last page', () => {
    const items = buildItems(10);
    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        pageSize={5}
        paginationThreshold={5}
      />,
    );

    fireEvent.click(screen.getByTestId('button-residence-chooser-next'));
    expect(screen.getByTestId('button-residence-chooser-next')).toBeDisabled();
  });

  test('page resets to 1 when a search query narrows items (only first page shown)', () => {
    const items = buildItems(15);
    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        pageSize={5}
        paginationThreshold={5}
      />,
    );

    fireEvent.click(screen.getByTestId('button-residence-chooser-next'));
    expect(screen.getByTestId('residence-chooser-page-info')).toHaveTextContent('2 / 3');

    // Filter to a term that matches only 1 item (exact name of item-1).
    const search = screen.getByTestId('input-search-residences');
    fireEvent.change(search, { target: { value: 'Building A 1' } });

    // Pagination is hidden when there's ≤1 page of results.
    expect(screen.queryByTestId('residence-chooser-pagination')).not.toBeInTheDocument();
    // The matching item is shown on page 1.
    expect(screen.getByTestId('grid-item-item-1')).toBeInTheDocument();
  });

  test('custom paginationTestId overrides the default testid for the pagination container', () => {
    const items = buildItems(15);
    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        pageSize={5}
        paginationThreshold={5}
        paginationTestId='my-custom-pagination'
      />,
    );

    expect(screen.getByTestId('my-custom-pagination')).toBeInTheDocument();
    expect(screen.queryByTestId('residence-chooser-pagination')).not.toBeInTheDocument();
  });
});

describe('SearchableSelectionGrid — loading state', () => {
  test('renders a loading spinner when isLoading is true', () => {
    render(
      <SearchableSelectionGrid items={[]} onSelectItem={onSelectItem} isLoading={true} />,
    );

    expect(screen.queryByTestId('input-search-residences')).not.toBeInTheDocument();
    expect(screen.queryByTestId('selection-grid')).not.toBeInTheDocument();
  });
});
