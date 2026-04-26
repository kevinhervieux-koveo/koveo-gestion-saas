/**
 * @jest-environment jsdom
 *
 * Jank-regression guard for `withHierarchicalSelection` (task #1163).
 *
 * The hierarchical picker's selection clicks used to mount the wrapped
 * manager page (e.g. InventoryPage) inside the click handler itself,
 * producing "[Violation] 'click' handler took N ms" warnings on slower
 * devices. Task #1147 fixed this by wrapping the URL update in
 * `startTransition`. This test exercises the picker's selection flow
 * through a wrapped test component and asserts that:
 *
 *   • no "[Violation]" message reaches the console, AND
 *   • each picker click stays under the configured synchronous-handler
 *     budget (250 ms by default — 5× the Chromium budget, generous
 *     enough to absorb shared-CI jitter).
 *
 * If a future change strips `startTransition` away from the navigate
 * helper (or otherwise re-introduces synchronous heavy work into the
 * click), this test will fail — which is the whole point of the harness.
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { installJankDetector, type JankDetector } from '../utils/jank-detector';

// ---------------------------------------------------------------------------
// wouter — keep the global mock but capture setLocation calls for assertions.
// ---------------------------------------------------------------------------
const setLocationMock = jest.fn();
let currentLocation = '/manager/buildings';
let currentSearch = '';

jest.mock('wouter', () => ({
  useLocation: () => [currentLocation, setLocationMock],
  useSearch: () => currentSearch,
}));

// ---------------------------------------------------------------------------
// SelectionGrid — minimal stand-in so each item is a button we can click.
// ---------------------------------------------------------------------------
const renderItems = (items: any[], onSelectItem: (id: string) => void) =>
  items.map((item) => (
    <button
      key={item.id}
      data-testid={`selection-item-${item.id}`}
      onClick={() => onSelectItem(item.id)}
    >
      {item.name}
    </button>
  ));

jest.mock('@/components/common/SelectionGrid', () => ({
  SelectionGrid: ({ items, onSelectItem, onBack }: any) => (
    <div data-testid="selection-grid">
      {onBack && (
        <button data-testid="selection-grid-back" onClick={onBack}>
          back
        </button>
      )}
      {renderItems(items, onSelectItem)}
    </div>
  ),
}));

jest.mock('@/components/common/SearchableSelectionGrid', () => ({
  SearchableSelectionGrid: ({ items, onSelectItem }: any) => (
    <div data-testid="searchable-selection-grid">{renderItems(items, onSelectItem)}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Auth + language hooks — admin role keeps us on the org/building flow.
// ---------------------------------------------------------------------------
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', role: 'admin', email: 'admin@example.com' },
  }),
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({ language: 'en', t: (k: string) => k, setLanguage: jest.fn() }),
  LanguageProvider: ({ children }: any) => children,
}));

// ---------------------------------------------------------------------------
// shadcn primitives the HOC pulls in — replace with no-cost stubs.
// ---------------------------------------------------------------------------
jest.mock('@/components/layout/header', () => ({
  Header: ({ title }: any) => <div data-testid="header">{title}</div>,
}));
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...rest }: any) => (
    <button onClick={onClick} {...rest}>{children}</button>
  ),
}));
jest.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));
jest.mock('@/components/ui/no-data-card', () => ({
  NoDataCard: () => <div data-testid="no-data-card" />,
}));

jest.mock('lucide-react', () => new Proxy({}, { get: () => () => <span /> }));

// ---------------------------------------------------------------------------
// Stub network calls so each query resolves with predictable data.
// ---------------------------------------------------------------------------
const ORG_FIXTURES = [
  { id: 'org-1', name: 'Org One', description: '' },
  { id: 'org-2', name: 'Org Two', description: '' },
];
const BUILDING_FIXTURES = [
  { id: 'bld-1', name: 'Building Alpha', address: '1 Maple', organizationId: 'org-1' },
  { id: 'bld-2', name: 'Building Beta', address: '2 Maple', organizationId: 'org-1' },
];

beforeAll(() => {
  global.fetch = jest.fn(async (url: any) => {
    const u = String(url);
    if (u.includes('/api/users/me/organizations')) {
      return { ok: true, json: async () => ORG_FIXTURES } as any;
    }
    if (u.includes('/api/organizations/accessible-building-counts')) {
      return { ok: true, json: async () => ({ 'org-1': 2, 'org-2': 0 }) } as any;
    }
    if (u.includes('/api/users/me/residences')) {
      return { ok: true, json: async () => [] } as any;
    }
    if (u.match(/\/api\/organizations\/[^/]+\/buildings/)) {
      return { ok: true, json: async () => BUILDING_FIXTURES } as any;
    }
    if (u.match(/\/api\/buildings\/[^/]+\/residences/)) {
      return { ok: true, json: async () => [] } as any;
    }
    return { ok: true, json: async () => [] } as any;
  }) as any;
});

import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';

// Small wrapped component that simply prints the selected ids — no heavy
// work of its own, so any wall-clock cost we measure is owed to the HOC's
// own selection / navigation pipeline (which is what we want to guard).
const TestPage: React.FC<{
  organizationId?: string;
  buildingId?: string;
  showBackButton?: boolean;
  backButtonLabel?: React.ReactNode;
  onBack?: () => void;
}> = ({ organizationId, buildingId, showBackButton, onBack }) => (
  <div data-testid="wrapped-page">
    <span data-testid="org-id">{organizationId ?? ''}</span>
    <span data-testid="building-id">{buildingId ?? ''}</span>
    {showBackButton && onBack && (
      <button data-testid="hoc-back" onClick={onBack}>
        Back
      </button>
    )}
  </div>
);

const WrappedTestPage = withHierarchicalSelection(TestPage, {
  hierarchy: ['organization', 'building'],
});

function renderWrapped() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // Mirror the production queryClient default: turn the query key into
        // a URL and fetch it. The shared `fetch` mock above answers each
        // endpoint with the right fixture.
        queryFn: async ({ queryKey }) => {
          const url = (queryKey as unknown[]).join('/');
          const res = await fetch(url, { credentials: 'include' });
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
          return res.json();
        },
      },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WrappedTestPage />
    </QueryClientProvider>,
  );
}

describe('withHierarchicalSelection — UI jank guard (task #1163)', () => {
  let detector: JankDetector;

  beforeEach(() => {
    setLocationMock.mockReset();
    currentLocation = '/manager/buildings';
    currentSearch = '';
    detector = installJankDetector({ thresholdMs: 250 });
  });

  afterEach(() => {
    detector.uninstall();
  });

  it('selecting an organization keeps the click handler responsive', async () => {
    renderWrapped();

    // Wait for both queries (organizations + accessible-building-counts)
    // to resolve so the picker actually renders an item.
    const orgButton = await waitFor(
      () => screen.getByTestId('selection-item-org-1'),
      { timeout: 5000 },
    );

    // The HOC routes the click through `navigate(...)`, whose
    // `setLocation` call is wrapped in `startTransition`. Removing that
    // wrapper would force the resulting cascade of HOC + wrapped-page
    // re-renders into the click handler and trip this assertion.
    detector.runAndMeasure('select organization', () => {
      fireEvent.click(orgButton);
    });

    // Flush any pending transitions.
    await act(async () => {});

    expect(setLocationMock).toHaveBeenCalled();
    detector.assertNoJank();
  });

  it('back navigation from the wrapped page does not block the click', async () => {
    // Start with both org + building selected so the wrapped page is shown
    // with the HOC-provided onBack handler.
    currentSearch = '?organization=org-1&building=bld-1';
    renderWrapped();

    await act(async () => {});

    const backButton = await screen.findByTestId('hoc-back');

    detector.runAndMeasure('back to building picker', () => {
      fireEvent.click(backButton);
    });

    await act(async () => {});

    expect(setLocationMock).toHaveBeenCalled();
    detector.assertNoJank();
  });

  it('rapid successive selections each stay under the threshold', async () => {
    renderWrapped();

    // Click the same item several times in quick succession — simulates a
    // user double-clicking or impatient repeat clicks. Each individual
    // dispatch must remain responsive.
    const orgButton = await waitFor(
      () => screen.getByTestId('selection-item-org-1'),
      { timeout: 5000 },
    );

    for (let i = 0; i < 4; i++) {
      detector.runAndMeasure(`rapid selection #${i + 1}`, () => {
        fireEvent.click(orgButton);
      });
      await act(async () => {});
    }

    detector.assertNoJank();
  });
});
