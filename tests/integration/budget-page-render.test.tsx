/**
 * @file Budget Page Render Regression Test
 * @description Mounts the real BudgetInner component (not a mock) with
 * realistic forecast, projects, residence and capital-investment payloads and
 * verifies it renders without triggering React's "Maximum update depth
 * exceeded" warning. Also exercises the capital-investment mode toggle and
 * the maintenance projects refetch flow that were implicated in the original
 * infinite re-render crash on /manager/budget (see task #46).
 */

import React from 'react';
import { act, configure, render, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import '@testing-library/jest-dom';

// --- Module mocks --------------------------------------------------------

// IntersectionObserver polyfill for jsdom (used by the sticky refresh button).
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
  root = null;
  rootMargin = '';
  thresholds = [];
}
(global as any).IntersectionObserver = MockIntersectionObserver;

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/lib/demo-error-handler', () => ({
  handleApiError: jest.fn(),
}));

jest.mock('@/lib/pdf-export', () => ({
  loadPdfLibs: jest.fn(async () => ({
    jsPDF: class { addImage() {} save() {} internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } }; },
    html2canvas: jest.fn(async () => ({ toDataURL: () => '', width: 100, height: 100 })),
  })),
}));

jest.mock('@/utils/manager-navigation', () => ({
  preserveManagerContext: (path: string) => path,
}));

jest.mock('@/components/layout/header', () => ({
  Header: ({ title, subtitle }: { title?: string; subtitle?: string }) => (
    <header data-testid='mock-header'>
      <span>{title}</span>
      <span>{subtitle}</span>
    </header>
  ),
}));

// The HOC is exercised elsewhere; pass through so we directly mount BudgetInner.
jest.mock('@/components/hoc/withHierarchicalSelection', () => ({
  withHierarchicalSelection: (Component: React.ComponentType<any>) => {
    const Passthrough = (props: any) => <Component {...props} />;
    return Passthrough;
  },
}));

// Avoid the heavy chart rendering in jsdom.
jest.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid='line-chart'>{children}</div>,
  Line: () => <div />, XAxis: () => <div />, YAxis: () => <div />,
  CartesianGrid: () => <div />, Tooltip: () => <div />, Legend: () => <div />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  ReferenceLine: () => <div />, Area: () => <div />, AreaChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />, BarChart: ({ children }: any) => <div>{children}</div>,
  ComposedChart: ({ children }: any) => <div>{children}</div>,
  Scatter: () => <div />, Cell: () => <div />, PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => <div />,
}));

// The real BudgetChart also pulls in recharts heavily - mock it to a passthrough.
jest.mock('@/pages/manager/budget/BudgetChart', () => ({
  BudgetChart: React.forwardRef<HTMLDivElement, any>((_props, ref) => (
    <div ref={ref} data-testid='budget-chart-mock' />
  )),
}));

jest.mock('@/pages/manager/budget/BudgetProjectDialogs', () => ({
  BudgetProjectDialogs: () => <div data-testid='budget-project-dialogs-mock' />,
}));

// Import BudgetInner via a path that bypasses the budget module mock map in
// jest.config.cjs (`^@/pages/manager/budget$` exact match).
import BudgetInner from '@/pages/manager/budget/index';

// --- API payloads --------------------------------------------------------

const buildingId = 'bld-1';
const organizationId = 'org-1';

const bankAccountPayload = {
  bankAccountStartAmount: '50000',
  bankAccountStartDate: '2026-01-01',
  bankAccountMinimums: '10000',
  generalInflationRate: '2.0',
  financialYearStart: '2026-01-01',
  emergencyFundMinimum: '10000',
  operatingCashMinimum: '5000',
  revenueGrowthRate: '2.5',
  costInflationRate: '2.0',
  utilityInflationRate: '3.0',
  maintenanceInflationRate: '2.5',
  specialInvestmentBudget: '25000',
  investmentHorizonYears: '5',
  capitalProjectReserve: '100000',
  useGlobalBillsInflation: true,
  globalBillsInflationRate: '2.5',
  unplannedBillsAmount: '0',
  unplannedBillsStartDate: '2026-02-01',
};

const residencesPayload = [
  { id: 'res-1', unitNumber: '101', monthlyFees: '450' },
  { id: 'res-2', unitNumber: '102', monthlyFees: '450' },
];

const investmentsPayload = [
  {
    id: 'inv-1',
    title: 'Roof repair',
    description: 'patch leaks',
    amount: 12000,
    targetDate: '2026-06-01',
    urgency: 'urgent',
    type: 'custom',
    ownershipType: 'residences',
  },
  {
    id: 'inv-2',
    title: 'Lobby refresh',
    description: '',
    amount: 8000,
    targetDate: '2027-01-01',
    urgency: 'suggested',
    type: 'custom',
    ownershipType: 'residences',
  },
];

const projectsPayload = {
  data: [
    {
      id: 'proj-1',
      title: 'Elevator service',
      totalBudget: '5000',
      actualCost: '0',
      financialYear: 2026,
      status: 'planned',
      type: 'maintenance',
      origin: 'manual',
      isQuickProject: false,
      plannedStartDate: '2026-03-01',
      plannedEndDate: '2026-03-15',
    },
    {
      id: 'proj-2',
      title: 'Garage paint',
      totalBudget: '3000',
      actualCost: '0',
      financialYear: 2026,
      status: 'in_progress',
      type: 'maintenance',
      origin: 'manual',
      isQuickProject: true,
    },
  ],
};

const forecastPayload = {
  buildingId,
  buildingName: 'Test Building',
  forecastPeriod: '2026',
  startingBalance: 50000,
  minimumFund: 10000,
  generalInflationRate: 2.0,
  revenueInflationRate: 2.5,
  baselineMonthlyIncome: 900,
  baselineMonthlyExpenses: 600,
  recurrentBillsCount: 4,
  uniqueBillsCount: 2,
  forecast: Array.from({ length: 12 }, (_, i) => ({
    year: 2026,
    month: i + 1,
    period: `2026-${String(i + 1).padStart(2, '0')}`,
    revenue: 900,
    spending: 600,
    netCashFlow: 300,
    balance: 50000 + 300 * (i + 1),
    capitalInvestment: i === 5 ? 12000 : 0,
    autoGeneratedInvestment: 0,
    projectCosts: 0,
    startingBalance: 50000,
    status: 'green' as const,
    inflatedIncome: 900,
    inflatedRecurringExpenses: 600,
    inflatedUnplannedBills: 0,
  })),
};

// --- Fetch stub ----------------------------------------------------------

function buildJsonResponse(data: any): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function matches(url: string, pattern: RegExp): boolean {
  return pattern.test(url);
}

function stubFetch(): jest.Mock {
  const impl = async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    if (matches(url, /\/api\/budgets\/.+\/bank-account/)) return buildJsonResponse(bankAccountPayload);
    if (matches(url, /\/api\/buildings\/.+\/residences/)) return buildJsonResponse(residencesPayload);
    if (matches(url, /\/api\/budgets\/.+\/investments/)) return buildJsonResponse(investmentsPayload);
    if (matches(url, /\/api\/maintenance\/buildings\/.+\/projects/)) return buildJsonResponse(projectsPayload);
    if (matches(url, /\/api\/budgets\/.+\/forecast/)) return buildJsonResponse(forecastPayload);
    // Default empty success for any other endpoint the page might poke.
    return buildJsonResponse({});
  };
  const mock = jest.fn(impl) as unknown as jest.Mock;
  (global as any).fetch = mock;
  return mock;
}

// --- Test harness --------------------------------------------------------

function renderBudget() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <BudgetInner buildingId={buildingId} organizationId={organizationId} />
    </QueryClientProvider>
  );
  return { ...utils, queryClient };
}

describe('Budget page render regression (task #55)', () => {
  let errorSpy: jest.SpiedFunction<typeof console.error>;
  let warnSpy: jest.SpiedFunction<typeof console.warn>;

  beforeEach(() => {
    // Longer async timeout - jsdom renders can be slow under parallel workers.
    configure({ asyncUtilTimeout: 10000 });
    stubFetch();
    // Start from a clean localStorage so leakage from other suites in the same
    // jsdom worker can't force the collapsibles closed.
    window.localStorage.clear();
    // Expand the collapsible card groups so interactive controls (like the
    // capital-investment mode radios) are rendered. The component seeds
    // `cardsCollapsed` from localStorage on mount.
    window.localStorage.setItem(
      'budget-cards-collapsed',
      JSON.stringify({
        project: false,
        bankAccount: false,
        minimumRequirement: false,
        revenue: false,
        bills: false,
        capitalInvestment: false,
      })
    );
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    jest.clearAllMocks();
  });

  function assertNoUpdateDepthWarnings() {
    const collect = (spy: jest.SpiedFunction<any>) =>
      spy.mock.calls.map((args) => args.map((a: any) => (a instanceof Error ? a.message : String(a))).join(' '));
    const lines = [...collect(errorSpy), ...collect(warnSpy)];
    const offenders = lines.filter((line) => /Maximum update depth exceeded/i.test(line));
    expect(offenders).toEqual([]);
  }

  it('mounts with realistic forecast/projects/investments data without update-depth warnings', async () => {
    const { container, queryClient } = renderBudget();

    // Wait for queries to settle.
    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    }, { timeout: 5000 });

    // Allow React to flush any post-commit effects, and yield a few times so
    // a runaway setState loop would have time to trip the invariant.
    for (let i = 0; i < 5; i++) {
      await act(async () => { await Promise.resolve(); });
    }

    expect(container.firstChild).not.toBeNull();
    assertNoUpdateDepthWarnings();
  });

  it('stays stable when toggling the capital investment mode between suggested/urgent/custom', async () => {
    const { queryClient, findByTestId } = renderBudget();

    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    }, { timeout: 5000 });

    // The radio inputs for each mode are rendered unconditionally - exercise each.
    for (const mode of ['urgent', 'custom', 'suggested'] as const) {
      const radio = await findByTestId(`radio-${mode}-capital-mode`);
      act(() => {
        fireEvent.click(radio);
      });
      await waitFor(() => {
        expect((radio as HTMLInputElement).checked).toBe(true);
      });
    }

    assertNoUpdateDepthWarnings();
  });

  it('handles a projects-query refetch without entering a render loop', async () => {
    const { queryClient } = renderBudget();

    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    }, { timeout: 5000 });

    // Refetch the projects query - task #46 specifically called out this flow
    // as a trigger for the "Maximum update depth exceeded" crash.
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: ['/api/maintenance/buildings', buildingId, 'projects'],
      });
    });

    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    }, { timeout: 5000 });

    // And again to simulate repeated refetches.
    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: ['/api/maintenance/buildings', buildingId, 'projects'],
      });
    });
    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    }, { timeout: 5000 });

    assertNoUpdateDepthWarnings();
  });
});
