/**
 * @jest-environment jsdom
 *
 * Jank-regression guard for the manager Budget page (extends task #1163).
 *
 * `client/src/pages/manager/budget/index.tsx` exposes a richer set of
 * filter controls than the Financial Overview dashboard — view type,
 * period length, start month / year, capital investment mode, the
 * data-visibility toggle row, and per-project includeInBudget switches.
 * Each of those handlers updates state that feeds back into the heavy
 * `/api/budgets/forecast` query key (and the BudgetChart memoization
 * downstream of it). Without `startTransition` Chromium prints a
 * "[Violation] '<event>' handler took N ms" warning on slow CPUs.
 *
 * Task #1215 added `startTransition` around the equivalent setters on
 * the Financial Overview dashboard; task #1221 ports the same pattern
 * to the Budget page. This guard mirrors the dashboard / common-spaces
 * jank tests so a future refactor that drops the wrapper — or
 * introduces new synchronous heavy work into the filter handlers —
 * fails CI instead of silently regressing the UX on slow laptops.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { installJankDetector, type JankDetector } from '../../utils/jank-detector';

// HOC mock: pass a stable set of hierarchical props to the wrapped page
// so BudgetInner actually renders its body (instead of the
// org/building picker the real HOC shows when those ids are missing).
jest.mock('../../../client/src/components/hoc/withHierarchicalSelection', () => ({
  withHierarchicalSelection: (Component: any) =>
    function HierarchicalWrapper(_props: any) {
      return (
        <Component
          organizationId="test-org-id"
          buildingId="test-building-id"
          buildingName="Test Building"
        />
      );
    },
}));

// Cheap stubs for the heavy chart / dialog bundles. The detector
// captures any wall-clock cost a future regression introduces directly
// into the page handlers themselves; the inner BudgetChart / Gantt /
// dialog surfaces have their own coverage and are not the subject of
// this test.
jest.mock('../../../client/src/pages/manager/budget/BudgetChart', () => ({
  BudgetChart: () => <div data-testid="budget-chart" />,
}));
jest.mock('../../../client/src/pages/manager/budget/BudgetProjectDialogs', () => ({
  BudgetProjectDialogs: () => <div data-testid="budget-project-dialogs" />,
}));
jest.mock('../../../client/src/components/GanttChart', () => ({
  GanttChart: () => <div data-testid="gantt-chart" />,
}));
jest.mock('../../../client/src/components/common/DualLineChart', () => ({
  renderDualLine: () => null,
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

// Lightweight stand-ins for shadcn primitives that wire onChange /
// onClick straight through, so fireEvent reaches the real BudgetInner
// handlers instead of being absorbed by Radix internals.
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
jest.mock('../../../client/src/components/ui/card', () => ({
  Card: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  CardContent: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  CardHeader: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  CardTitle: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
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
  Dialog: ({ children }: any) => <div>{children}</div>,
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
      start: new Date('2026-01-01'),
      end: new Date('2026-12-31'),
      startYear: '2026',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    },
    isLoading: false,
  }),
}));

jest.mock('@/lib/demo-error-handler', () => ({
  handleApiError: jest.fn(),
}));

// The Budget page's useBudgetUICollapse hook persists collapsed state
// in localStorage; the configuration cards (project list, capital
// investment strategy, …) default to collapsed which would hide the
// per-project and capital-mode controls under test. Stub the hook so
// every section is expanded for the duration of the suite.
jest.mock('../../../client/src/pages/manager/budget/hooks/useBudgetUICollapse', () => ({
  useBudgetUICollapse: () => ({
    filtersCollapsed: false,
    setFiltersCollapsed: jest.fn(),
    cardsCollapsed: {
      project: false,
      bankAccount: false,
      minimumRequirement: false,
      revenue: false,
      bills: false,
      capitalInvestment: false,
    },
    setCardsCollapsed: jest.fn(),
    toggleCard: jest.fn(),
  }),
}));

const TEST_PROJECT = {
  id: 'project-roof',
  title: 'Roof refresh',
  totalBudget: '12000',
  actualCost: '0',
  estimatedCost: '12000',
  financialYear: 2026,
  status: 'planned',
  type: 'maintenance',
  origin: 'manual',
  isQuickProject: false,
  plannedStartDate: '2026-06-01',
  plannedEndDate: '2026-06-30',
  buildingId: 'test-building-id',
};

jest.mock('@/lib/queryClient', () => {
  // Route every budget-page fetch through a stable mock so the page
  // mounts deterministically and we can drive its filters synchronously.
  const apiRequest = jest.fn((_method: string, url: string) => {
    return Promise.resolve({
      ok: true,
      json: async () => {
        if (url.includes('/bank-account')) {
          return {
            bankAccountStartAmount: 0,
            bankAccountStartDate: '2026-01-01',
            bankAccountMinimums: 0,
            generalInflationRate: 2.0,
            financialYearStart: '2026-01-01',
            earliestBillDate: null,
            earliestFinancialYear: 2024,
          };
        }
        if (url.includes('/forecast')) {
          return {
            buildingId: 'test-building-id',
            forecast: [],
            effectiveStartYear: 2026,
            effectiveStartMonth: 1,
          };
        }
        if (url.includes('/investments')) {
          return [];
        }
        if (url.includes('/residences')) {
          return [];
        }
        if (url.includes('/maintenance/buildings') && url.includes('/projects')) {
          return { success: true, data: [TEST_PROJECT] };
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

import BudgetPage from '../../../client/src/pages/manager/budget';

// Default queryFn that mirrors the production `getQueryFn({ on401: 'throw' })`
// helper: a key-less `useQuery` resolves through this function, which
// fetches `queryKey.join('/')`. Several budget queries (bank-account,
// residences, investments, maintenance projects) rely on this default
// fetcher rather than supplying their own `queryFn`.
const defaultBudgetQueryFn = async ({ queryKey }: { queryKey: readonly unknown[] }) => {
  const url = queryKey.map(String).join('/');
  const res = await (global.fetch as any)(url, { credentials: 'include' });
  return res.json();
};

function renderBudgetPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, queryFn: defaultBudgetQueryFn as any },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BudgetPage />
    </QueryClientProvider>,
  );
}

// Threshold for the budget jank guard. Mirrors the dashboard guard
// (task #1215): even with `startTransition` wrapping the filter
// setters, the synchronous portion of the click can still measure
// 100–300 ms under `Fast unit tests` / `Full unit tests` load (the
// shadcn / lucide proxy mocks themselves cost real time and the
// re-render cascade is large). A 500 ms ceiling still catches the
// catastrophic regressions this suite is designed for — a future
// refactor that pulls a 1 s+ chart compute back into the click path
// (or drops the `startTransition` wrapper while introducing new
// synchronous heavy work) — without flaking under CI load.
const BUDGET_THRESHOLD_MS = 500;

describe('Budget page — UI jank guard (extends task #1163)', () => {
  let detector: JankDetector;

  beforeEach(() => {
    detector = installJankDetector({ thresholdMs: BUDGET_THRESHOLD_MS });

    // BudgetInner installs an IntersectionObserver in a useEffect to
    // drive its floating refresh button. jsdom doesn't ship this API,
    // so stub it before the wrapped page body actually mounts.
    (global as any).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    };

    // Default `fetch` falls through to deterministic JSON for every
    // query key the budget page resolves through `defaultBudgetQueryFn`.
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      let body: unknown = {};
      if (url.includes('/bank-account')) {
        body = {
          bankAccountStartAmount: 0,
          bankAccountStartDate: '2026-01-01',
          bankAccountMinimums: 0,
          generalInflationRate: 2.0,
          financialYearStart: '2026-01-01',
          earliestBillDate: null,
          earliestFinancialYear: 2024,
        };
      } else if (url.includes('/investments')) {
        body = [];
      } else if (url.includes('/residences')) {
        body = [];
      } else if (url.includes('/maintenance/buildings') && url.includes('/projects')) {
        body = { success: true, data: [TEST_PROJECT] };
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

  it('switching the view type stays responsive', async () => {
    renderBudgetPage();

    // The view-type Select only mounts once BudgetInner renders its
    // filter controls, which requires the buildingId prop the HOC
    // mock injects. Wait for the trigger to appear before driving it.
    await screen.findByTestId('select-view-type');

    // Switching from monthly to yearly view changes the forecast key
    // (viewType + periodLength) and the chart's data window. The
    // handler must stay below the Chromium "[Violation]" budget so a
    // regression that pulls heavy work back into the click path is
    // caught immediately.
    const viewTypeRoot = screen.getByTestId('select-view-type').closest('[data-testid="select-root"]') as HTMLElement;
    const yearItem = viewTypeRoot.querySelector('[data-testid="select-item-year"]') as HTMLElement;
    expect(yearItem).not.toBeNull();
    detector.runAndMeasure('switch view type to yearly', () => {
      fireEvent.click(yearItem);
    });
    act(() => {});

    detector.assertNoJank();
  });

  it('changing the period length stays responsive', async () => {
    renderBudgetPage();

    await screen.findByTestId('select-period-length');

    // The period-length setter retriggers the heavy
    // `/api/budgets/forecast` query (its key embeds periodLength) and
    // (in yearly view) syncs `investmentHorizonYears` into
    // localSettings. The handler itself must stay below the threshold.
    const periodRoot = screen.getByTestId('select-period-length').closest('[data-testid="select-root"]') as HTMLElement;
    const item24 = periodRoot.querySelector('[data-testid="select-item-24"]') as HTMLElement;
    expect(item24).not.toBeNull();
    detector.runAndMeasure('switch period length to 24 months', () => {
      fireEvent.click(item24);
    });
    act(() => {});

    detector.assertNoJank();
  });

  it('changing the start month stays responsive', async () => {
    renderBudgetPage();

    await screen.findByTestId('select-start-month');

    // The start-month picker drives the forecast query (its key
    // embeds startMonth) and re-derives the chart's x-axis labels.
    // Keep the click responsive even though the refetch + chart
    // re-render happen as a downstream consequence.
    const startMonthRoot = screen
      .getByTestId('select-start-month')
      .closest('[data-testid="select-root"]') as HTMLElement;
    const monthItem = startMonthRoot.querySelector('[data-testid="select-item-3"]') as HTMLElement;
    expect(monthItem).not.toBeNull();
    detector.runAndMeasure('switch start month to March', () => {
      fireEvent.click(monthItem);
    });
    act(() => {});

    detector.assertNoJank();
  });

  it('changing the start year stays responsive', async () => {
    renderBudgetPage();

    await screen.findByTestId('select-start-year');

    // The start-year picker also retriggers the forecast query and
    // reshapes the chart. The handler itself must stay snappy.
    const startYearRoot = screen
      .getByTestId('select-start-year')
      .closest('[data-testid="select-root"]') as HTMLElement;
    const yearItem = startYearRoot.querySelector('[data-testid="select-item-2027"]') as HTMLElement;
    expect(yearItem).not.toBeNull();
    detector.runAndMeasure('switch start year to 2027', () => {
      fireEvent.click(yearItem);
    });
    act(() => {});

    detector.assertNoJank();
  });

  it('toggling a data-visibility switch stays responsive', async () => {
    renderBudgetPage();

    // The data-visibility switches each toggle a slice of the chart
    // (revenue, spending, balance, cashflow…). They flip values inside
    // `filters.dataVisibility` which feeds the BudgetChart memoized
    // selectors. Keep the click responsive even when the chart
    // re-render happens downstream.
    const revenueSwitch = await screen.findByTestId('switch-revenue-visibility');
    detector.runAndMeasure('toggle revenue visibility', () => {
      fireEvent.click(revenueSwitch);
    });
    act(() => {});

    detector.assertNoJank();
  });

  it('switching the capital investment mode stays responsive', async () => {
    renderBudgetPage();

    // The capital-investment-mode radios re-key the
    // `/api/budgets/forecast` query (custom vs. urgent vs. suggested)
    // and recompute the investments summary. Keep the click responsive
    // so the mode swap doesn't block the UI thread on slow CPUs.
    const suggestedRadio = await screen.findByTestId('radio-suggested-capital-mode');
    detector.runAndMeasure('switch capital mode to suggested', () => {
      fireEvent.click(suggestedRadio);
    });
    act(() => {});

    detector.assertNoJank();
  });

  it('toggling a per-project includeInBudget switch stays responsive', async () => {
    renderBudgetPage();

    // The per-project switch flips includeInBudget, which mutates the
    // `projects` array AND re-keys the forecast query (the body's
    // selectedBuildingProjectIds list changes). Keep the click
    // responsive even though the refetch + chart re-render run as a
    // downstream consequence.
    const projectSwitch = await screen.findByTestId(
      `switch-project-include-${TEST_PROJECT.id}`,
    );
    detector.runAndMeasure('toggle project includeInBudget', () => {
      fireEvent.click(projectSwitch);
    });
    act(() => {});

    detector.assertNoJank();
  });
});
