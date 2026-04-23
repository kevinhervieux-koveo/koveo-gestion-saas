/**
 * @file Unit tests for the `urlSync` option on `useSearchFilter` and
 *   `useTableState`. The hooks form the foundation for filter persistence
 *   across all migrated list pages, so these tests pin down the contract:
 *   - state seeds from `window.location.search` on mount,
 *   - changes write back through `history.replaceState`,
 *   - custom encoders/decoders work (comma-separated arrays),
 *   - dynamic defaults are omitted from the URL,
 *   - unrelated query params are preserved.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { useSearchFilter, useTableState } from '@/lib/common-hooks';

interface ListFilters {
  category: string;
  months: string[];
  year: string;
}

function setUrl(search: string) {
  window.history.replaceState({}, '', `/page${search}`);
}

beforeEach(() => {
  setUrl('');
});

describe('useSearchFilter with urlSync', () => {
  it('seeds filter and search state from window.location.search on mount', () => {
    setUrl('?category=utilities&search=acme');
    const { result } = renderHook(() =>
      useSearchFilter<ListFilters>(
        '',
        { category: '', months: [], year: '' },
        {
          fields: { category: {}, months: {}, year: {} },
          searchParam: 'search',
        },
      ),
    );

    expect(result.current.filters.category).toBe('utilities');
    expect(result.current.searchTerm).toBe('acme');
  });

  it('writes filter changes back to the URL via history.replaceState', () => {
    const { result } = renderHook(() =>
      useSearchFilter<ListFilters>(
        '',
        { category: '', months: [], year: '' },
        { fields: { category: {}, months: {}, year: {} } },
      ),
    );

    act(() => result.current.updateFilter('category', 'taxes'));

    const params = new URLSearchParams(window.location.search);
    expect(params.get('category')).toBe('taxes');
  });

  it('uses custom encoders/decoders for comma-separated array fields', () => {
    setUrl('?months=1,3,5');
    const spec = {
      fields: {
        category: {},
        year: {},
        months: {
          encode: (v: string[]) => (v.length > 0 ? v.join(',') : null),
          decode: (raw: string) =>
            raw.split(',').map((s) => s.trim()).filter(Boolean),
        },
      },
    } as const;

    const { result } = renderHook(() =>
      useSearchFilter<ListFilters>(
        '',
        { category: '', months: [], year: '' },
        spec,
      ),
    );

    expect(result.current.filters.months).toEqual(['1', '3', '5']);

    act(() => result.current.updateFilter('months', ['7', '11']));
    expect(new URLSearchParams(window.location.search).get('months')).toBe('7,11');

    act(() => result.current.updateFilter('months', []));
    // Empty array means "omit from URL".
    expect(new URLSearchParams(window.location.search).has('months')).toBe(false);
  });

  it('omits dynamic defaults from the URL', () => {
    let dynamicDefault = '2025-2026';
    const spec = {
      fields: {
        category: {},
        months: {},
        year: { defaultValue: () => dynamicDefault },
      },
    };

    const { result, rerender } = renderHook(() =>
      useSearchFilter<ListFilters>(
        '',
        { category: '', months: [], year: dynamicDefault },
        spec,
      ),
    );

    // Setting the value to the dynamic default should omit it from the URL.
    act(() => result.current.updateFilter('year', '2025-2026'));
    expect(new URLSearchParams(window.location.search).has('year')).toBe(false);

    // Setting it to a different value writes it back.
    act(() => result.current.updateFilter('year', '2024-2025'));
    expect(new URLSearchParams(window.location.search).get('year')).toBe('2024-2025');

    // Updating the dynamic default and re-asserting (after rerender) still
    // honors the latest default callback when the value matches it.
    dynamicDefault = '2026-2027';
    rerender();
    act(() => result.current.updateFilter('year', '2026-2027'));
    expect(new URLSearchParams(window.location.search).has('year')).toBe(false);
  });

  it('preserves unrelated query params when writing its own keys', () => {
    setUrl('?organization=org-1&building=bld-1');
    const { result } = renderHook(() =>
      useSearchFilter<ListFilters>(
        '',
        { category: '', months: [], year: '' },
        { fields: { category: {}, months: {}, year: {} } },
      ),
    );

    act(() => result.current.updateFilter('category', 'repairs'));

    const params = new URLSearchParams(window.location.search);
    expect(params.get('organization')).toBe('org-1');
    expect(params.get('building')).toBe('bld-1');
    expect(params.get('category')).toBe('repairs');
  });

  it('clearFilters resets state and removes its query params', () => {
    setUrl('?category=utilities&unrelated=keep');
    const { result } = renderHook(() =>
      useSearchFilter<ListFilters>(
        '',
        { category: '', months: [], year: '' },
        { fields: { category: {}, months: {}, year: {} } },
      ),
    );
    expect(result.current.filters.category).toBe('utilities');

    act(() => result.current.clearFilters());

    const params = new URLSearchParams(window.location.search);
    expect(params.has('category')).toBe(false);
    // Unrelated keys must remain.
    expect(params.get('unrelated')).toBe('keep');
  });
});

describe('useTableState with urlSync', () => {
  it('seeds sort field/direction from the URL on mount', () => {
    setUrl('?sortField=issueDate&sortDirection=desc&category=utilities');
    const { result } = renderHook(() =>
      useTableState<ListFilters>({
        initialFilters: { category: '', months: [], year: '' },
        urlSync: {
          fields: { category: {}, months: {}, year: {} },
          sortFieldParam: 'sortField',
          sortDirectionParam: 'sortDirection',
        },
      }),
    );

    expect(result.current.sortField).toBe('issueDate');
    expect(result.current.sortDirection).toBe('desc');
    expect(result.current.filters.category).toBe('utilities');
  });

  it('writes sort changes back to the URL without clobbering filters', () => {
    setUrl('?category=taxes');
    const { result } = renderHook(() =>
      useTableState<ListFilters>({
        initialFilters: { category: '', months: [], year: '' },
        urlSync: {
          fields: { category: {}, months: {}, year: {} },
          sortFieldParam: 'sortField',
          sortDirectionParam: 'sortDirection',
        },
      }),
    );

    act(() => result.current.handleSort('amount'));

    const params = new URLSearchParams(window.location.search);
    expect(params.get('sortField')).toBe('amount');
    expect(params.get('sortDirection')).toBe('asc');
    // Filter param survives the sort writer.
    expect(params.get('category')).toBe('taxes');

    // Toggling the same field flips direction in the URL.
    act(() => result.current.handleSort('amount'));
    expect(
      new URLSearchParams(window.location.search).get('sortDirection'),
    ).toBe('desc');
  });

  it('preserves unrelated query params on filter and sort writes', () => {
    setUrl('?organization=org-1&building=bld-1');
    const { result } = renderHook(() =>
      useTableState<ListFilters>({
        initialFilters: { category: '', months: [], year: '' },
        urlSync: {
          fields: { category: {}, months: {}, year: {} },
          sortFieldParam: 'sortField',
          sortDirectionParam: 'sortDirection',
        },
      }),
    );

    act(() => result.current.updateFilter('category', 'repairs'));
    act(() => result.current.handleSort('amount'));

    const params = new URLSearchParams(window.location.search);
    expect(params.get('organization')).toBe('org-1');
    expect(params.get('building')).toBe('bld-1');
    expect(params.get('category')).toBe('repairs');
    expect(params.get('sortField')).toBe('amount');
  });
});
