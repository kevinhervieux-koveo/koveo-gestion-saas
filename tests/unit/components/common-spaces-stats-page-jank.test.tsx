/**
 * @jest-environment jsdom
 *
 * Jank-regression guard for the manager Common Spaces stats page
 * (extends task #1163).
 *
 * `client/src/pages/manager/common-spaces-stats.tsx` already dispatches
 * the space-selection update through `startTransition` (see the
 * `<Select onValueChange={(value) => startTransition(() => setSelectedSpaceId(value))}>`
 * wiring around the `space-select` SelectTrigger). Without that wrapper
 * the heavy `/api/common-spaces/<id>/stats` refetch + chart / users-table
 * recompute would run inside the click and Chromium would print a
 * "[Violation] '<event>' handler took N ms" warning that the harness is
 * designed to catch.
 *
 * This file mirrors the InventoryPage / Bills / Demands / Residences
 * jank guards (task #1163, #1175, #1182) so a future refactor that
 * drops the `startTransition` wrapper — or introduces new synchronous
 * heavy work into the space-selection / time-limit-scope handlers —
 * fails CI instead of silently regressing the UX.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { installJankDetector, type JankDetector } from '../../utils/jank-detector';

// HOC mock: pass a stable set of hierarchical props to the wrapped page
// so CommonSpacesStats actually renders its body (instead of the
// org/building picker the real HOC shows when those ids are missing).
jest.mock('../../../client/src/components/hoc/withHierarchicalSelection', () => ({
  withHierarchicalSelection: (Component: any) =>
    function HierarchicalWrapper(props: any) {
      return (
        <Component
          {...props}
          organizationId="test-org-id"
          buildingId="test-building-id"
          buildingName="Test Building"
          showBackButton={false}
          backButtonLabel="Back"
          onBack={() => {}}
        />
      );
    },
}));

// Cheap stubs for the heavy calendar / chart bundles. The detector
// captures any wall-clock cost a future regression introduces directly
// into the page handlers themselves; the inner calendar / recharts
// surfaces have their own coverage and are not the subject of this
// test.
jest.mock('../../../client/src/components/common-spaces/calendar-view', () => ({
  CalendarView: () => <div data-testid="calendar-view" />,
}));
jest.mock('../../../client/src/components/common-spaces/common-space-calendar', () => ({
  CommonSpaceCalendar: () => <div data-testid="common-space-calendar" />,
}));
jest.mock('../../../client/src/components/ui/chart', () => ({
  ChartContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
  ChartLegend: () => null,
  ChartLegendContent: () => null,
}));
jest.mock('recharts', () => new Proxy({}, {
  get: () => () => null,
}));

jest.mock('../../../client/src/components/layout/header', () => ({
  Header: ({ title }: any) => <div data-testid="header">{title}</div>,
}));

// Lightweight stand-ins for shadcn primitives that wire onChange /
// onClick straight through, so fireEvent reaches the real
// CommonSpacesStats handlers instead of being absorbed by Radix
// internals.
jest.mock('../../../client/src/components/ui/button', () => ({
  Button: ({ children, onClick, ...rest }: any) => (
    <button onClick={onClick} {...rest}>{children}</button>
  ),
}));
jest.mock('../../../client/src/components/ui/input', () => ({
  Input: ({ value, onChange, ...rest }: any) => (
    <input value={value ?? ''} onChange={onChange} {...rest} />
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
jest.mock('../../../client/src/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...rest }: any) => (
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...rest}
    />
  ),
}));
jest.mock('../../../client/src/components/ui/no-data-card', () => ({
  NoDataCard: ({ children }: any) => <div data-testid="no-data-card">{children}</div>,
}));
jest.mock('../../../client/src/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));
jest.mock('../../../client/src/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('../../../client/src/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: any) => <div>{children}</div>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: any) => <div>{children}</div>,
  AlertDialogAction: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('../../../client/src/components/ui/tabs', () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsContent: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('../../../client/src/components/ui/table', () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableCell: ({ children }: any) => <td>{children}</td>,
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableRow: ({ children }: any) => <tr>{children}</tr>,
}));

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
    SelectItem: ({ children, value, ...rest }: any) => {
      const onValueChange = ActualReact.useContext(SelectCtx);
      return (
        <button
          {...rest}
          data-testid={rest['data-testid'] ?? `select-item-${value}`}
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

// The page is wrapped in a `withManagerAccess` HOC that branches on the
// user's role. Pin it to manager so the real body (not the access-denied
// card) is mounted and the Select handler under test is wired up.
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'test-manager-id', role: 'manager' },
    isLoading: false,
    isAuthenticating: false,
    isAuthenticated: true,
    isFirstHydrationComplete: true,
    login: jest.fn(),
    logout: jest.fn(),
    hasRole: () => true,
    hasAnyRole: () => true,
  }),
  AuthProvider: ({ children }: any) => children,
}));

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  }),
  queryClient: {
    invalidateQueries: jest.fn(),
    refetchQueries: jest.fn(),
  },
}));

jest.mock('@/lib/demo-error-handler', () => ({
  handleApiError: jest.fn(),
}));

const TEST_BUILDING = {
  id: 'test-building-id',
  name: 'Test Building',
  address: '123 Test St',
  city: 'Montreal',
  organizationId: 'test-org-id',
};

const TEST_SPACES = [
  {
    id: 'space-gym',
    name: 'Gym',
    description: 'Building gym',
    buildingId: TEST_BUILDING.id,
    isReservable: true,
    capacity: 20,
  },
  {
    id: 'space-pool',
    name: 'Pool',
    description: 'Building pool',
    buildingId: TEST_BUILDING.id,
    isReservable: true,
    capacity: 30,
  },
];

import CommonSpacesStatsPage from '../../../client/src/pages/manager/common-spaces-stats';

function renderCommonSpacesStatsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CommonSpacesStatsPage />
    </QueryClientProvider>,
  );
}

describe('CommonSpacesStatsPage — UI jank guard (extends task #1163)', () => {
  let detector: JankDetector;

  beforeEach(() => {
    // 100 ms convention shared across the jank-guard suites: anything
    // above this prints as "[Violation] '<event>' handler took N ms" in
    // Chromium, which is the user-visible regression we want to catch.
    detector = installJankDetector({ thresholdMs: 100 });

    // Route the dashboard's raw `fetch` calls to deterministic
    // payloads so the buildings + common-spaces queries resolve and
    // the space-selection Select gets enabled.
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      let body: unknown = {};
      if (url.includes('/api/manager/buildings')) {
        body = { buildings: [TEST_BUILDING] };
      } else if (url.includes('/api/common-spaces/') && url.includes('/stats')) {
        body = {
          spaceName: 'Gym',
          period: 'all',
          summary: { totalBookings: 0, totalHours: 0, uniqueUsers: 0 },
          userStats: [],
        };
      } else if (url.includes('/api/common-spaces')) {
        body = TEST_SPACES;
      }
      return Promise.resolve({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => body,
      } as any);
    }) as any;
  });

  afterEach(() => {
    detector.uninstall();
  });

  it('selecting a common space does not block the click handler', async () => {
    renderCommonSpacesStatsPage();

    // Wait for the buildings + common-spaces queries to resolve so
    // the SelectItem buttons (one per space) actually mount inside
    // the `space-select` trigger.
    await screen.findByTestId('select-item-space-gym');

    // The space-selection setter is dispatched through
    // `startTransition` inside common-spaces-stats.tsx — without that
    // wrapper the heavy `/api/common-spaces/<id>/stats` refetch +
    // users-table / chart re-render would run inside the click and
    // trip the detector. Click both spaces in sequence so the test
    // also covers the second-click case (a re-selection that
    // re-runs the same downstream chain).
    detector.runAndMeasure('select Gym space', () => {
      fireEvent.click(screen.getByTestId('select-item-space-gym'));
    });
    act(() => {});

    detector.runAndMeasure('select Pool space', () => {
      fireEvent.click(screen.getByTestId('select-item-space-pool'));
    });
    act(() => {});

    detector.assertNoJank();
  });
});
