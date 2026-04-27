/**
 * Unit tests for SearchableSelectionGrid (Task #1483).
 *
 * Covers:
 *  1. Filtering: typing in the search box shows only matching items and hides
 *     non-matching items; clearing the query restores all items.
 *  2. Pagination math: when the current page exceeds the new totalPages after
 *     a filter is applied, the component resets to page 1 so no empty page
 *     is shown.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveTextContent(text: string | RegExp): R;
      toBeDisabled(): R;
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

import { SearchableSelectionGrid } from '../../../client/src/components/common/SearchableSelectionGrid';
import type { SelectionGridItem } from '../../../client/src/components/common/SelectionGrid';

function makeItems(count: number): SelectionGridItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i + 1}`,
    name: `Building ${String.fromCharCode(65 + i)}`,
    details: `Address ${i + 1}`,
    type: 'building' as const,
  }));
}

describe('SearchableSelectionGrid — filtering', () => {
  const onSelectItem = jest.fn();

  beforeEach(() => {
    onSelectItem.mockClear();
  });

  test('shows all items when query is empty', () => {
    const items = makeItems(3);
    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        paginationThreshold={100}
      />,
    );

    expect(screen.getByTestId('grid-item-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('grid-item-item-2')).toBeInTheDocument();
    expect(screen.getByTestId('grid-item-item-3')).toBeInTheDocument();
  });

  test('filters items by name when a query is entered', async () => {
    const items: SelectionGridItem[] = [
      { id: 'maple', name: 'Maple Heights', details: '1 Maple St', type: 'building' },
      { id: 'riverside', name: 'Riverside Towers', details: '2 River Rd', type: 'building' },
      { id: 'oak', name: 'Oak Park', details: '3 Oak Ave', type: 'building' },
    ];

    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        paginationThreshold={2}
        searchTestId='test-search'
      />,
    );

    const input = screen.getByTestId('test-search');
    fireEvent.change(input, { target: { value: 'maple' } });

    await waitFor(() => {
      expect(screen.getByTestId('grid-item-maple')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('grid-item-riverside')).not.toBeInTheDocument();
    expect(screen.queryByTestId('grid-item-oak')).not.toBeInTheDocument();
  });

  test('shows no-results message when filter matches nothing', async () => {
    const items: SelectionGridItem[] = [
      { id: 'maple', name: 'Maple Heights', details: '1 Maple St', type: 'building' },
      { id: 'riverside', name: 'Riverside Towers', details: '2 River Rd', type: 'building' },
    ];

    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        paginationThreshold={1}
        searchTestId='test-search'
      />,
    );

    const input = screen.getByTestId('test-search');
    fireEvent.change(input, { target: { value: 'zzznomatch' } });

    await waitFor(() => {
      expect(screen.getByTestId('residence-chooser-no-results')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('selection-grid')).not.toBeInTheDocument();
  });

  test('restores all items when query is cleared', async () => {
    const items: SelectionGridItem[] = [
      { id: 'maple', name: 'Maple Heights', details: '1 Maple St', type: 'building' },
      { id: 'riverside', name: 'Riverside Towers', details: '2 River Rd', type: 'building' },
    ];

    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        paginationThreshold={1}
        searchTestId='test-search'
      />,
    );

    const input = screen.getByTestId('test-search');
    fireEvent.change(input, { target: { value: 'maple' } });

    await waitFor(() => {
      expect(screen.queryByTestId('grid-item-riverside')).not.toBeInTheDocument();
    });

    fireEvent.change(input, { target: { value: '' } });

    await waitFor(() => {
      expect(screen.getByTestId('grid-item-maple')).toBeInTheDocument();
      expect(screen.getByTestId('grid-item-riverside')).toBeInTheDocument();
    });
  });

  test('filter matching is case-insensitive', async () => {
    const items: SelectionGridItem[] = [
      { id: 'maple', name: 'Maple Heights', details: '', type: 'building' },
    ];

    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        paginationThreshold={0}
        searchTestId='test-search'
      />,
    );

    const input = screen.getByTestId('test-search');
    fireEvent.change(input, { target: { value: 'MAPLE' } });

    await waitFor(() => {
      expect(screen.getByTestId('grid-item-maple')).toBeInTheDocument();
    });
  });
});

describe('SearchableSelectionGrid — pagination math', () => {
  const onSelectItem = jest.fn();

  beforeEach(() => {
    onSelectItem.mockClear();
  });

  test('shows pagination controls when items exceed threshold', () => {
    const items = makeItems(7);
    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        pageSize={3}
        paginationThreshold={3}
        paginationTestId='test-pagination'
      />,
    );

    expect(screen.getByTestId('test-pagination')).toBeInTheDocument();
    expect(screen.getByTestId('residence-chooser-page-info')).toHaveTextContent('1 / 3');
  });

  test('navigates forward a page and back correctly', async () => {
    const items = makeItems(7);
    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        pageSize={3}
        paginationThreshold={3}
        paginationTestId='test-pagination'
      />,
    );

    fireEvent.click(screen.getByTestId('button-residence-chooser-next'));
    expect(screen.getByTestId('residence-chooser-page-info')).toHaveTextContent('2 / 3');

    expect(screen.getByTestId('grid-item-item-4')).toBeInTheDocument();
    expect(screen.queryByTestId('grid-item-item-1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('button-residence-chooser-previous'));
    expect(screen.getByTestId('residence-chooser-page-info')).toHaveTextContent('1 / 3');
    expect(screen.getByTestId('grid-item-item-1')).toBeInTheDocument();
  });

  test('resets to page 1 when filter reduces totalPages below current page', async () => {
    const items: SelectionGridItem[] = [
      { id: 'alpha', name: 'Alpha Building', details: '', type: 'building' },
      { id: 'beta', name: 'Beta Building', details: '', type: 'building' },
      { id: 'gamma', name: 'Gamma Building', details: '', type: 'building' },
      { id: 'delta', name: 'Delta Building', details: '', type: 'building' },
      { id: 'omega', name: 'Omega Special', details: '', type: 'building' },
    ];

    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        pageSize={2}
        paginationThreshold={2}
        searchTestId='test-search'
        paginationTestId='test-pagination'
      />,
    );

    expect(screen.getByTestId('residence-chooser-page-info')).toHaveTextContent('1 / 3');

    fireEvent.click(screen.getByTestId('button-residence-chooser-next'));
    expect(screen.getByTestId('residence-chooser-page-info')).toHaveTextContent('2 / 3');

    const input = screen.getByTestId('test-search');
    fireEvent.change(input, { target: { value: 'omega' } });

    await waitFor(() => {
      expect(screen.getByTestId('grid-item-omega')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('residence-chooser-page-info')).not.toBeInTheDocument();
    expect(screen.queryByTestId('grid-item-alpha')).not.toBeInTheDocument();
    expect(screen.queryByTestId('grid-item-beta')).not.toBeInTheDocument();
  });

  test('previous button is disabled on first page, next button is disabled on last page', () => {
    const items = makeItems(5);
    render(
      <SearchableSelectionGrid
        items={items}
        onSelectItem={onSelectItem}
        isLoading={false}
        pageSize={3}
        paginationThreshold={3}
        paginationTestId='test-pagination'
      />,
    );

    expect(screen.getByTestId('button-residence-chooser-previous')).toBeDisabled();
    expect(screen.getByTestId('button-residence-chooser-next')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('button-residence-chooser-next'));

    expect(screen.getByTestId('button-residence-chooser-previous')).not.toBeDisabled();
    expect(screen.getByTestId('button-residence-chooser-next')).toBeDisabled();
  });
});
