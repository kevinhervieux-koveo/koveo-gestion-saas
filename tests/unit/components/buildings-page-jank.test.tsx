/**
 * @jest-environment jsdom
 *
 * Jank-regression guard for the manager Buildings page (extends task #1163,
 * #1175, #1182, #1201).
 *
 * The Buildings page (`client/src/pages/manager/buildings.tsx`) drives a
 * search box that filters a list of building cards through a synchronous
 * `useMemo`. Today the work itself is light, but the same shape — a
 * controlled input that pipes straight into a `useState` setter feeding a
 * filtered list — is exactly what tasks #1163 / #1182 caught regressing
 * elsewhere (Inventory, Residences, Demands). A future change that pulls
 * a heavier `BuildingCard` re-render or a date-fns reformat into the
 * keystroke would surface as a Chromium "[Violation] '<event>' handler
 * took N ms" warning, which this guard is designed to catch.
 *
 * The guard mirrors the InventoryPage / Residences / Bills jank tests
 * (100 ms threshold, mocked heavy children, scoped fetch routing) so the
 * full set of high-traffic manager pages stays under coverage.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { installJankDetector, type JankDetector } from '../../utils/jank-detector';

// HOC mock: pass a stable set of hierarchical props to the wrapped page so
// the buildings body renders instead of the org/building picker the real
// HOC shows when those ids are missing.
jest.mock('../../../client/src/components/hoc/withHierarchicalSelection', () => ({
  withHierarchicalSelection: (Component: any) =>
    function HierarchicalWrapper(props: any) {
      return (
        <Component
          {...props}
          organizationId="test-org-id"
          buildingId={undefined}
          buildingName={undefined}
          showBackButton={false}
          backButtonLabel="Back"
          onBack={() => {}}
        />
      );
    },
}));

// Cheap stub for the heavy BuildingCard so the detector measures any
// wall-clock cost a future regression introduces directly into the
// search / filter handlers themselves; the inner card render path has
// its own coverage and is not the subject of this test.
jest.mock('../../../client/src/components/buildings/BuildingCard', () => ({
  BuildingCard: ({ building }: any) => (
    <div data-testid={`building-card-${building?.id ?? 'unknown'}`} />
  ),
}));

jest.mock('../../../client/src/components/layout/header', () => ({
  Header: ({ title }: any) => <div data-testid="header">{title}</div>,
}));

// Lightweight stand-ins for shadcn primitives that wire onChange / onClick
// straight through, so fireEvent reaches the real Buildings handlers
// instead of being absorbed by Radix internals.
jest.mock('../../../client/src/components/ui/button', () => ({
  Button: ({ children, onClick, ...rest }: any) => (
    <button onClick={onClick} {...rest}>{children}</button>
  ),
}));
jest.mock('../../../client/src/components/ui/input', () => ({
  Input: ({ value, onChange, ...rest }: any) => (
    <input
      data-testid={rest['data-testid'] ?? 'search-buildings'}
      value={value ?? ''}
      onChange={onChange}
      {...rest}
    />
  ),
}));
jest.mock('../../../client/src/components/ui/label', () => ({
  Label: ({ children, ...rest }: any) => <label {...rest}>{children}</label>,
}));
jest.mock('../../../client/src/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, ...rest }: any) => (
    <textarea value={value ?? ''} onChange={onChange} {...rest} />
  ),
}));
jest.mock('../../../client/src/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
jest.mock('../../../client/src/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));
jest.mock('../../../client/src/components/ui/no-data-card', () => ({
  NoDataCard: ({ children }: any) => <div data-testid="no-data-card">{children}</div>,
}));
jest.mock('../../../client/src/components/ui/dialog', () => ({
  // Honor the `open` prop so the BuildingForm body (which references
  // `organizations.map`) only mounts when the user explicitly opens the
  // dialog. Without this gate the Add/Edit Building forms would render
  // on every search keystroke and pollute the jank measurement.
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('../../../client/src/components/ui/form', () => {
  const Pass = ({ children }: any) => <div>{children}</div>;
  return {
    Form: Pass,
    FormControl: Pass,
    FormDescription: Pass,
    FormField: ({ render }: any) => render({ field: { value: '', onChange: () => {} } }),
    FormItem: Pass,
    FormLabel: Pass,
    FormMessage: Pass,
  };
});

// shadcn Select wired so onValueChange fires when we click a SelectItem,
// matching the way the real popover works from the user's perspective.
jest.mock('../../../client/src/components/ui/select', () => {
  const ActualReact = jest.requireActual('react') as typeof import('react');
  const SelectCtx = ActualReact.createContext<((v: string) => void) | undefined>(undefined);
  return {
    Select: ({ children, onValueChange }: any) => (
      <SelectCtx.Provider value={onValueChange}>
        <div data-testid="select-root">{children}</div>
      </SelectCtx.Provider>
    ),
    SelectTrigger: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
    SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
    SelectContent: ({ children }: any) => <div>{children}</div>,
    SelectItem: ({ children, value }: any) => {
      const onValueChange = ActualReact.useContext(SelectCtx);
      return (
        <button
          data-testid={`select-item-${value}`}
          onClick={() => onValueChange?.(value)}
        >
          {children}
        </button>
      );
    },
  };
});

jest.mock('lucide-react', () => new Proxy({}, {
  get: () => () => <span />,
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => key,
    setLanguage: jest.fn(),
  }),
  LanguageProvider: ({ children }: any) => children,
}));

jest.mock('@/lib/demo-error-handler', () => ({
  handleApiError: jest.fn(),
}));

const TEST_BUILDINGS = Array.from({ length: 6 }, (_, i) => ({
  id: `bldg-${i}`,
  name: `Building ${i}`,
  address: `${100 + i} Test St`,
  city: 'Montreal',
  province: 'QC',
  postalCode: 'H1A1A1',
  buildingType: 'condo',
  totalUnits: 10 + i,
  organizationId: 'test-org-id',
}));

jest.mock('@/lib/queryClient', () => {
  // Route every page fetch through a stable mock so the page mounts
  // deterministically and we can drive the search box synchronously.
  const apiRequest = jest.fn((_method: string, url: string) => {
    return Promise.resolve({
      ok: true,
      json: async () => {
        if (url.includes('/api/users/me/organizations')) {
          return [{ id: 'test-org-id', name: 'Test Org' }];
        }
        if (url.includes('/api/organizations')) {
          return [{ id: 'test-org-id', name: 'Test Org' }];
        }
        if (url.includes('/api/manager/buildings')) {
          return { buildings: TEST_BUILDINGS };
        }
        return {};
      },
    });
  });
  return {
    apiRequest,
    queryClient: {
      invalidateQueries: jest.fn(),
      refetchQueries: jest.fn(),
    },
  };
});

import Buildings from '../../../client/src/pages/manager/buildings';

// Default queryFn that mirrors the production `getQueryFn({ on401: 'throw' })`
// helper: a key-less `useQuery` resolves through this function, which
// fetches `queryKey.join('/')`. The page's `/api/auth/user` query relies
// on this default fetcher — without it the body never finishes mounting.
const defaultQueryFn = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
  const url = queryKey.map(String).join('/');
  const res = await (global.fetch as any)(url, { credentials: 'include' });
  return res.json();
};

function renderBuildingsPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, queryFn: defaultQueryFn as any },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Buildings />
    </QueryClientProvider>,
  );
}

describe('Manager Buildings page — UI jank guard (extends task #1163)', () => {
  let detector: JankDetector;

  beforeEach(() => {
    // 100 ms convention shared across the jank-guard suites: anything
    // above this prints as "[Violation] '<event>' handler took N ms" in
    // Chromium, which is the user-visible regression we want to catch.
    detector = installJankDetector({ thresholdMs: 100 });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ id: 'test-manager-id', role: 'manager' }),
    }) as any;
  });

  afterEach(() => {
    detector.uninstall();
  });

  it('typing in the buildings search field stays responsive', async () => {
    renderBuildingsPage();

    // Wait for the buildings query to resolve so the search input is
    // wired up and the filtered list has settled.
    await screen.findByTestId('building-card-bldg-0');

    const input = screen.getByTestId('search-buildings') as HTMLInputElement;

    // The search box pipes straight into `setSearchTerm`, which feeds a
    // synchronous `useMemo` that filters the building list. Drive a
    // realistic typing burst so any future regression that pulls
    // heavier work into the keystroke handler trips the detector.
    for (const value of ['B', 'Bu', 'Bui', 'Buil', 'Build', 'Building 1']) {
      detector.runAndMeasure(`type "${value}"`, () => {
        fireEvent.change(input, { target: { value } });
      });
    }
    act(() => {});

    detector.assertNoJank();
  });
});
