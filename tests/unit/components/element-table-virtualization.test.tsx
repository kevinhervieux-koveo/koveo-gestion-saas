/**
 * Regression test for inventory virtualization.
 *
 * The inventory `ElementTable` virtualizes its rows via the underlying
 * `DataTable` component (`enableVirtualization={true}`) so that buildings
 * with thousands of elements stay fast when the user filters / sorts.
 *
 * If a future refactor flips `enableVirtualization` off — or removes the
 * prop entirely — the table would silently fall back to rendering every
 * filtered row on every commit, re-introducing the slowdown that this
 * optimization was designed to eliminate.
 *
 * This test renders the real `ElementTable` against a synthetic dataset of
 * several thousand elements and asserts that only a small windowed subset
 * of rows is actually present in the DOM. If the virtualization is
 * removed, the test will fail because all rows would be in the DOM.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mocks -----------------------------------------------------------------
//
// We deliberately do NOT mock `DataTable` — it's the component under test
// (indirectly). We only stub the surrounding pieces that are not relevant
// to whether rows are virtualized.

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: jest.fn(),
    t: (key: string) => key,
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/hooks/use-building-context', () => ({
  useBuildingContext: () => ({ buildingId: 'test-building', hasPermission: () => true }),
}));

jest.mock('@/components/maintenance/inventory/BulkEditCostDialog', () => ({
  BulkEditCostDialog: () => null,
}));

jest.mock('@/components/maintenance/inventory/BulkEditResidenceDialog', () => ({
  BulkEditResidenceDialog: () => null,
}));

const mockApiRequest = jest.fn();
const mockQueryClientFns = {
  invalidateQueries: jest.fn(),
  refetchQueries: jest.fn(),
};

jest.mock('@/lib/queryClient', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  queryClient: mockQueryClientFns,
}));

// Import AFTER the mocks so the component picks them up.
import { ElementTable } from '@/components/maintenance/inventory/ElementTable';
import { DataTable } from '@/components/maintenance/DataTable';
import type { ColumnDef } from '@tanstack/react-table';

// --- Layout polyfill -------------------------------------------------------
//
// `@tanstack/react-virtual` reads the scroll container's `offsetHeight` to
// decide how many rows fit on screen (see `getRect` in
// `@tanstack/virtual-core`). In jsdom every element reports `offsetHeight`
// 0, which would make the virtualizer produce zero virtual rows and make
// any "rendered rows < total" assertion meaningless (it would pass even if
// virtualization were turned off and the loop simply rendered nothing).
//
// We patch `offsetHeight` / `offsetWidth` on `HTMLElement.prototype` to
// return a fixed viewport size so the virtualizer slices a realistic
// window of rows.
const VIRTUAL_VIEWPORT_HEIGHT = 640;
const VIRTUAL_VIEWPORT_WIDTH = 1024;
const ESTIMATED_ROW_HEIGHT = 84;
let originalOffsetHeightDescriptor: PropertyDescriptor | undefined;
let originalOffsetWidthDescriptor: PropertyDescriptor | undefined;
let originalGetBoundingClientRect: typeof Element.prototype.getBoundingClientRect;

beforeAll(() => {
  originalOffsetHeightDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetHeight',
  );
  originalOffsetWidthDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetWidth',
  );
  originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

  // Scroll-container sizing: `@tanstack/virtual-core`'s `getRect()` reads
  // `offsetWidth` / `offsetHeight` to know how big the viewport is.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return VIRTUAL_VIEWPORT_HEIGHT;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return VIRTUAL_VIEWPORT_WIDTH;
    },
  });

  // Per-row sizing: `DataTable` passes a `measureElement` to
  // `useVirtualizer` that calls `el.getBoundingClientRect().height`. In
  // jsdom that returns 0 by default, which makes the virtualizer think
  // every row collapsed to 0 height and triggers an infinite "remeasure"
  // loop ("Maximum update depth exceeded"). We stub it to return the
  // estimated row height so per-row measurements stay stable.
  Element.prototype.getBoundingClientRect = function patchedGetBoundingClientRect() {
    const isRow = this instanceof HTMLElement && this.tagName === 'TR';
    const height = isRow ? ESTIMATED_ROW_HEIGHT : VIRTUAL_VIEWPORT_HEIGHT;
    const width = VIRTUAL_VIEWPORT_WIDTH;
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON() {
        return this;
      },
    } as DOMRect;
  };
});

afterAll(() => {
  if (originalOffsetHeightDescriptor) {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeightDescriptor);
  }
  if (originalOffsetWidthDescriptor) {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidthDescriptor);
  }
  if (originalGetBoundingClientRect) {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  }
});

// --- Helpers ---------------------------------------------------------------

const TOTAL_ROWS = 3000;

interface SyntheticElement {
  id: string;
  buildingId: string;
  organizationId: string;
  name: string;
  uniformatCode: string;
  description: string | null;
  currentCondition: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  originalConstructionDate: string | null;
  originalLifespan: number | null;
  currentLifespan: number | null;
  lastInspectionDate: string | null;
  nextEvaluationDate: string | null;
}

function buildSyntheticElements(count: number): SyntheticElement[] {
  const conditions: SyntheticElement['currentCondition'][] = [
    'excellent',
    'good',
    'fair',
    'poor',
    'critical',
  ];
  const elements: SyntheticElement[] = [];
  for (let i = 0; i < count; i++) {
    elements.push({
      id: `element-${i}`,
      buildingId: 'building-1',
      organizationId: 'org-1',
      name: `Element ${i}`,
      uniformatCode: `A${(1000 + (i % 999)).toString()}`,
      description: `Synthetic element ${i}`,
      currentCondition: conditions[i % conditions.length],
      originalConstructionDate: '2010-01-01',
      originalLifespan: 25,
      currentLifespan: 25,
      lastInspectionDate: '2024-01-01',
      nextEvaluationDate: '2026-01-01',
    });
  }
  return elements;
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockApiRequest.mockReset();
  mockQueryClientFns.invalidateQueries.mockReset();
  mockQueryClientFns.refetchQueries.mockReset();
});

// --- Tests -----------------------------------------------------------------

describe('Inventory table virtualization', () => {
  it('renders only a small windowed subset of rows when ElementTable receives thousands of elements', async () => {
    const elements = buildSyntheticElements(TOTAL_ROWS);

    mockApiRequest.mockImplementation(async (_method: string, url: string) => {
      if (url.includes('/elements')) {
        return {
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ data: elements }),
        };
      }
      // UNIFORMAT codes endpoint
      return {
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ data: [] }),
      };
    });

    renderWithProviders(
      <ElementTable buildingId="building-1" organizationId="org-1" enableBulkActions={false} />,
    );

    // Wait for the DataTable's virtualized scroll container to mount, which
    // proves ElementTable is still passing `enableVirtualization={true}`.
    const scrollContainer = await screen.findByTestId(
      'virtualized-scroll-container',
      {},
      { timeout: 4000 },
    );
    expect(scrollContainer).toBeInTheDocument();

    // Wait for the result count footer to confirm all rows reached the
    // table model (i.e. the test isn't passing simply because the data
    // never loaded).
    await waitFor(
      () => {
        expect(screen.getByTestId('virtualized-result-count')).toHaveTextContent(
          new RegExp(`${TOTAL_ROWS}`),
        );
      },
      { timeout: 4000 },
    );

    // Now assert the actual DOM only contains a small windowed slice of
    // rows. With a 640px viewport and an estimated row height of 84px, the
    // virtualizer should render roughly 640/84 ≈ 8 visible rows plus the
    // configured overscan (8 each side), so ~16-30 rows in practice. We
    // pick a generous upper bound (200) that is still orders of magnitude
    // smaller than the total dataset, so the test is robust to changes in
    // overscan / viewport while still failing loudly if virtualization is
    // turned off (which would put all 3,000 rows in the DOM).
    const renderedRows = screen.queryAllByTestId(/^table-row-/);
    expect(renderedRows.length).toBeGreaterThan(0);
    expect(renderedRows.length).toBeLessThan(200);
    expect(renderedRows.length).toBeLessThan(TOTAL_ROWS / 10);
  });

  it('DataTable with virtualization disabled renders every row (control case proving the assertion above is meaningful)', async () => {
    // This control test demonstrates that the previous test's assertion
    // would fail if `enableVirtualization` were ever flipped off — i.e.
    // that the assertion is genuinely guarding the optimization rather
    // than coincidentally passing.
    interface Row {
      id: string;
      name: string;
    }
    const rows: Row[] = Array.from({ length: 500 }, (_, i) => ({
      id: `row-${i}`,
      name: `Row ${i}`,
    }));
    const columns: ColumnDef<Row>[] = [
      { accessorKey: 'name', header: 'Name' },
    ];

    renderWithProviders(
      <DataTable
        columns={columns}
        data={rows}
        enableVirtualization={false}
        enablePagination={false}
        enableFiltering={false}
        enableColumnVisibility={false}
        getRowId={(row) => row.id}
      />,
    );

    // Without virtualization there is no virtualized scroll container.
    expect(screen.queryByTestId('virtualized-scroll-container')).not.toBeInTheDocument();

    // Every row is in the DOM. This is the exact pathological behaviour
    // the virtualization optimization was designed to avoid.
    await waitFor(() => {
      const renderedRows = screen.queryAllByTestId(/^table-row-/);
      expect(renderedRows).toHaveLength(rows.length);
    });
  });
});
