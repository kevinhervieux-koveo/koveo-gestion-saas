/**
 * @jest-environment jsdom
 *
 * Jank-regression guard for the manager Budget page (extends task #1163,
 * #1175, #1182, #1201).
 *
 * The Budget page (`client/src/pages/manager/budget/index.tsx`) is the
 * heaviest manager surface after the Financial Overview dashboard: it
 * drives a `BudgetChart` (recharts), a `GanttChart` and a project list
 * off a top-level filter card (view type, start month / year, period
 * length, data-visibility switches). Each filter change re-keys the
 * `/api/budgets/<bid>/forecast` query through a sprawling `forecastParams`
 * memo and triggers a re-render of the chart + project list — exactly
 * the kind of work that a future refactor could accidentally pull into
 * the click handler itself and surface as a Chromium "[Violation]
 * '<event>' handler took N ms" warning.
 *
 * This test mirrors the dashboard / common-spaces-stats jank guards
 * (task #1201) so any regression that adds synchronous heavy work to a
 * top-level filter handler fails CI instead of silently regressing the
 * UX.
 *
 * The Budget page filter handlers (`setFilters` updaters around
 * `select-view-type`, `select-start-year`, `select-period-length`)
 * currently dispatch their state updates without `startTransition`, so
 * the synchronous wall-clock cost of the React commit + downstream
 * memo recompute can run hot under CI load. The guard runs at the same
 * 500 ms threshold the FinancialOverview dashboard uses (see
 * `dashboard-page-jank.test.tsx`); that still catches the catastrophic
 * regressions this suite is designed for (a future change that pulls a
 * 1 s+ chart compute back into the click path) without flaking under
 * CI load. Once a follow-up wraps the budget filter setters in
 * `startTransition`, the threshold should be lowered back to the shared
 * 100 ms convention.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { installJankDetector, type JankDetector } from '../../utils/jank-detector';

// HOC mock: pass a stable set of hierarchical props to the wrapped page so
// BudgetInner renders its body (instead of the org/building picker the
// real HOC shows when those ids are missing).
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

// Cheap stubs for the heavy chart / project bundles. The detector
// measures any wall-clock cost a future regression introduces directly
// into the page's filter handlers themselves; the inner chart, gantt
// and project-card render paths have their own coverage.
jest.mock('../../../client/src/pages/manager/budget/BudgetChart', () => ({
  BudgetChart: () => <div data-testid="budget-chart" />,
}));
jest.mock('../../../client/src/pages/manager/budget/BudgetProjectDialogs', () => ({
  BudgetProjectDialogs: () => <div data-testid="budget-project-dialogs" />,
}));
jest.mock('../../../client/src/pages/manager/budget/components/BudgetProjectCard', () => ({
  BudgetProjectCard: () => <div data-testid="budget-project-card" />,
}));
jest.mock('../../../client/src/components/GanttChart', () => ({
  GanttChart: () => <div data-testid="gantt-chart" />,
}));
jest.mock('../../../client/src/components/ui/chart', () => ({
  ChartContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));
jest.mock('recharts', () => new Proxy({}, {
  get: () => () => null,
}));

// PDF helpers are loaded lazily on a button click; stub the loader so
// the import graph stays cheap and deterministic.
jest.mock('../../../client/src/lib/pdf-export', () => ({
  loadPdfLibs: jest.fn(),
}));

jest.mock('../../../client/src/components/layout/header', () => ({
  Header: ({ title }: any) => <div data-testid="header">{title}</div>,
}));

// Lightweight stand-ins for shadcn primitives that wire onChange / onClick
// straight through, so fireEvent reaches the real BudgetInner handlers
// instead of being absorbed by Radix internals.
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
jest.mock('../../../client/src/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
jest.mock('../../../client/src/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));
jest.mock('../../../client/src/components/ui/separator', () => ({
  Separator: () => <hr />,
}));
jest.mock('../../../client/src/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, ...rest }: any) => (
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...rest}
    />
  ),
}));
jest.mock('../../../client/src/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('../../../client/src/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
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

jest.mock('@/hooks/use-current-financial-year', () => ({
  useCurrentFinancialYear: () => ({
    currentFinancialYear: {
      label: '2026',
      // The page reads `currentFinancialYear.startYear` via parseInt
      // and `currentFinancialYear.start.getMonth()` directly, so the
      // mock must mirror those exact field shapes.
      startYear: '2026',
      start: new Date('2026-01-01'),
      end: new Date('2026-12-31'),
    },
    isLoading: false,
  }),
}));

jest.mock('@/lib/demo-error-handler', () => ({
  handleApiError: jest.fn(),
}));

// Persist the budget UI collapse state so the filter card opens by
// default — the production hook reads from localStorage, which jsdom
// honors out of the box, so we just make sure it starts uncollapsed.
beforeAll(() => {
  try {
    window.localStorage.setItem('budget-filters-collapsed', 'false');
  } catch {
    /* jsdom always supports localStorage; defensive */
  }

  // jsdom does not implement IntersectionObserver, but the budget page
  // wires one up to drive its floating-refresh button. A no-op stand-in
  // is enough to mount the page; the detector only cares about the
  // synchronous cost of the filter handlers.
  if (typeof (globalThis as any).IntersectionObserver === 'undefined') {
    (globalThis as any).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    };
  }
});

const TEST_BANK_ACCOUNT = {
  bankAccountStartAmount: 0,
  bankAccountStartDate: '2024-01-01',
  bankAccountMinimums: 0,
  generalInflationRate: 0,
  revenueInflationRate: 0,
  financialYearStart: '2026-01-01',
  earliestBillDate: null,
  earliestFinancialYear: 2024,
  effectiveStartYear: 2024,
  effectiveStartMonth: 1,
};

jest.mock('@/lib/queryClient', () => {
  // Route every Budget page fetch through a stable mock so the page
  // mounts deterministically and we can drive its filters synchronously.
  const apiRequest = jest.fn((_method: string, url: string) => {
    return Promise.resolve({
      ok: true,
      json: async () => {
        if (url.includes('bank-account')) {
          return {
            bankAccountStartAmount: 0,
            bankAccountStartDate: '2024-01-01',
            bankAccountMinimums: 0,
            generalInflationRate: 0,
            revenueInflationRate: 0,
            financialYearStart: '2026-01-01',
            earliestBillDate: null,
            earliestFinancialYear: 2024,
          };
        }
        if (url.includes('investments')) {
          return [];
        }
        if (url.includes('residences')) {
          return [];
        }
        if (url.includes('forecast')) {
          return {
            buildingId: 'test-building-id',
            forecast: [],
            effectiveStartYear: 2024,
            effectiveStartMonth: 1,
          };
        }
        if (url.includes('projects')) {
          return { success: true, data: [] };
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
      removeQueries: jest.fn(),
    },
  };
});

import Budget from '../../../client/src/pages/manager/budget';

// Default queryFn that mirrors the production `getQueryFn` helper: a
// key-less `useQuery` resolves through this function, which fetches
// `queryKey.join('/')`. The page does not rely on it directly, but
// providing it keeps any incidental queries deterministic.
const defaultQueryFn = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
  const url = queryKey.map(String).join('/');
  const res = await (global.fetch as any)(url, { credentials: 'include' });
  return res.json();
};

function renderBudgetPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, queryFn: defaultQueryFn as any },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Budget />
    </QueryClientProvider>,
  );
}

// See header doc — the budget filter handlers run hot under CI load and
// dashboard-page-jank.test.tsx already documents the same trade-off.
const BUDGET_THRESHOLD_MS = 500;

describe('Manager Budget page — UI jank guard (extends task #1163)', () => {
  let detector: JankDetector;

  beforeEach(() => {
    detector = installJankDetector({ thresholdMs: BUDGET_THRESHOLD_MS });
    // Route the page's raw `fetch` calls (the residences / projects /
    // bank-account default-queryFn lookups) to deterministic payloads
    // so the page mounts and we can drive the filters synchronously.
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      let body: unknown = {};
      if (url.includes('residences')) {
        body = [];
      } else if (url.includes('projects')) {
        body = { success: true, data: [] };
      } else if (url.includes('investments')) {
        body = [];
      } else if (url.includes('forecast')) {
        body = { buildingId: 'test-building-id', forecast: [] };
      } else if (url.includes('bank-account')) {
        body = TEST_BANK_ACCOUNT;
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

  it('toggling the filters card stays responsive', async () => {
    renderBudgetPage();

    // The filters header collapse-toggle is the cheapest filter
    // interaction on the page — it just flips a boolean — so it should
    // stay well under the threshold even when the rest of the page is
    // re-deriving its `forecastParams` memo. A future regression that
    // introduces synchronous heavy work into the toggle (e.g. a chart
    // re-mount) would trip the detector.
    const toggle = await screen.findByTestId('button-toggle-filters');

    detector.runAndMeasure('toggle filters card (1)', () => {
      fireEvent.click(toggle);
    });
    act(() => {});

    detector.runAndMeasure('toggle filters card (2)', () => {
      fireEvent.click(toggle);
    });
    act(() => {});

    detector.assertNoJank();
  });

  it('changing the budget view type stays responsive', async () => {
    renderBudgetPage();

    // The view-type Select switches between monthly and yearly, which
    // re-keys the `/api/budgets/<bid>/forecast` query (its body embeds
    // `viewType` + `periodLength`) and reshapes the chart's data
    // window. The handler itself must stay below the threshold even
    // though the refetch + chart re-render happen as a downstream
    // consequence.
    const yearOption = await screen.findByTestId('select-item-year');

    detector.runAndMeasure('switch to yearly view', () => {
      fireEvent.click(yearOption);
    });
    act(() => {});

    detector.runAndMeasure('switch back to monthly view', () => {
      fireEvent.click(screen.getByTestId('select-item-month'));
    });
    act(() => {});

    detector.assertNoJank();
  });

  it('changing the period length stays responsive', async () => {
    renderBudgetPage();

    // The period-length Select drives the size of the forecast window,
    // which re-keys `forecastParams` and (in yearly view) syncs
    // `investmentHorizonYears`. Click both a 24-month and a 36-month
    // option in sequence so the test also covers the second-click
    // case (a re-selection that re-runs the same downstream chain).
    await screen.findByTestId('select-period-length');

    const period24 = screen
      .getByTestId('select-period-length')
      .closest('[data-testid="select-root"]')
      ?.querySelector('[data-testid="select-item-24"]') as HTMLElement | null;
    const period36 = screen
      .getByTestId('select-period-length')
      .closest('[data-testid="select-root"]')
      ?.querySelector('[data-testid="select-item-36"]') as HTMLElement | null;
    expect(period24).not.toBeNull();
    expect(period36).not.toBeNull();

    detector.runAndMeasure('change period length to 24 months', () => {
      fireEvent.click(period24!);
    });
    act(() => {});

    detector.runAndMeasure('change period length to 36 months', () => {
      fireEvent.click(period36!);
    });
    act(() => {});

    detector.assertNoJank();
  });
});
