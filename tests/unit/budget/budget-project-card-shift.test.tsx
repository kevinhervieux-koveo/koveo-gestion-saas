/**
 * @file Budget project card — financial-year shift controls
 * @description Regression tests for Task #246 — exercises the
 * Previous / Next / Confirm flow on the real `BudgetProjectCard`
 * rendered by the real `BudgetInner` page (no custom wrapper). The
 * page-level mock at `__mocks__/client/src/pages/manager/budget.tsx`
 * is bypassed by importing `@/pages/manager/budget/index` directly,
 * which is the same trick used by `tests/integration/budget-page-render.test.tsx`.
 *
 *  - Previous decrements the displayed financial year.
 *  - Next increments the displayed financial year.
 *  - The buttons disable at the min/max boundary defined by the
 *    same expression used in production
 *    (currentFinancialYear .. new Date().getFullYear() + 25).
 *  - The "Unsaved change" badge appears once an offset is set.
 *  - Clicking Confirm fires a PATCH to /api/maintenance/projects/:id
 *    with the new financialYear, going through the page's real
 *    `confirmProjectYearMutation` wired through `apiRequest`.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { cleanup, configure, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider, type QueryFunction } from '@tanstack/react-query';
import '@testing-library/jest-dom';

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
  Header: ({ title }: { title?: string }) => <header data-testid='mock-header'>{title}</header>,
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
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => <div />, XAxis: () => <div />, YAxis: () => <div />,
  CartesianGrid: () => <div />, Tooltip: () => <div />, Legend: () => <div />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  ReferenceLine: () => <div />, Area: () => <div />, AreaChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />, BarChart: ({ children }: any) => <div>{children}</div>,
  ComposedChart: ({ children }: any) => <div>{children}</div>,
  Scatter: () => <div />, Cell: () => <div />, PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => <div />,
}));

jest.mock('@/pages/manager/budget/BudgetChart', () => ({
  BudgetChart: React.forwardRef<HTMLDivElement, any>((_props, ref) => (
    <div ref={ref} data-testid='budget-chart-mock' />
  )),
}));

jest.mock('@/pages/manager/budget/BudgetProjectDialogs', () => ({
  BudgetProjectDialogs: () => <div data-testid='budget-project-dialogs-mock' />,
}));

// Import BudgetInner via a path that bypasses the page-level module mock
// in jest.config.cjs (which targets the bare `^@/pages/manager/budget$`).
import BudgetInner from '@/pages/manager/budget/index';

// Match the production expression used in
// `client/src/pages/manager/budget/index.tsx` for the shift bounds.
// We pin the financial-year start to 2026-01-01 so currentFinancialYear is
// deterministic (the test runner's calendar year is 2026 — see the snapshot
// header in the task brief).
const MIN_YEAR = 2026; // currentFinancialYear (start of FY in tests)
const MAX_YEAR = new Date().getFullYear() + 25;

const buildingId = 'bld-shift';
const organizationId = 'org-shift';

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

const residencesPayload = [{ id: 'res-1', unitNumber: '101', monthlyFees: '450' }];
const investmentsPayload: any[] = [];

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
  recurrentBillsCount: 0,
  uniqueBillsCount: 0,
  forecast: Array.from({ length: 12 }, (_, i) => ({
    year: 2026,
    month: i + 1,
    period: `2026-${String(i + 1).padStart(2, '0')}`,
    revenue: 900,
    spending: 600,
    netCashFlow: 300,
    balance: 50000 + 300 * (i + 1),
    capitalInvestment: 0,
    autoGeneratedInvestment: 0,
    projectCosts: 0,
    startingBalance: 50000,
    status: 'green' as const,
    inflatedIncome: 900,
    inflatedRecurringExpenses: 600,
    inflatedUnplannedBills: 0,
  })),
};

interface ProjectFixture {
  id: string;
  financialYear: number;
}

function makeProjectsPayload(projects: ProjectFixture[]): { data: any[] } {
  return {
    data: projects.map(p => ({
      id: p.id,
      title: `Project ${p.id}`,
      totalBudget: '1000',
      actualCost: '0',
      financialYear: p.financialYear,
      status: 'planned',
      type: 'maintenance',
      origin: 'manual',
      isQuickProject: false,
      includeInBudget: true,
    })),
  };
}

function buildJsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface PatchCall {
  url: string;
  body: any;
}

function stubFetch(projects: ProjectFixture[]): {
  fetchMock: jest.Mock;
  patchCalls: PatchCall[];
} {
  const patchCalls: PatchCall[] = [];
  const projectsPayload = makeProjectsPayload(projects);

  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (method === 'PATCH' && /\/api\/maintenance\/projects\//.test(url)) {
      let body: any = undefined;
      if (typeof init?.body === 'string') {
        try {
          body = JSON.parse(init.body);
        } catch {
          body = init.body;
        }
      }
      patchCalls.push({ url, body });
      return buildJsonResponse({ success: true });
    }

    if (/\/api\/budgets\/.+\/bank-account/.test(url)) return buildJsonResponse(bankAccountPayload);
    if (/\/api\/buildings\/.+\/residences/.test(url)) return buildJsonResponse(residencesPayload);
    if (/\/api\/budgets\/.+\/investments/.test(url)) return buildJsonResponse(investmentsPayload);
    if (/\/api\/maintenance\/buildings\/.+\/projects/.test(url)) return buildJsonResponse(projectsPayload);
    if (/\/api\/budgets\/.+\/forecast/.test(url)) return buildJsonResponse(forecastPayload);
    return buildJsonResponse({});
  };

  const fetchMock = jest.fn(impl) as unknown as jest.Mock;
  (global as any).fetch = fetchMock;
  return { fetchMock, patchCalls };
}

// Default queryFn that fetches `${queryKey.join('/')}` and returns JSON.
// Mirrors `getQueryFn` in `client/src/lib/queryClient.ts` so the budget
// page's `useQuery` calls (which omit their own `queryFn`) resolve via
// the test fetch stub.
const defaultQueryFn: QueryFunction = async ({ queryKey, signal }) => {
  const url = (queryKey as readonly unknown[]).join('/') as string;
  const res = await fetch(url, { credentials: 'include', signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  return res.json();
};

function renderBudget() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: defaultQueryFn,
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
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

async function waitForCard(id: string) {
  await waitFor(
    () => {
      expect(screen.getByTestId(`budget-project-card-${id}`)).toBeInTheDocument();
    },
    { timeout: 5000 }
  );
}

describe('BudgetProjectCard — financial-year shift (real BudgetInner)', () => {
  let errorSpy: jest.SpiedFunction<typeof console.error>;
  let warnSpy: jest.SpiedFunction<typeof console.warn>;

  beforeEach(() => {
    configure({ asyncUtilTimeout: 10000 });
    window.localStorage.clear();
    // Expand the project collapsible so the project list (and its cards) render.
    window.localStorage.setItem(
      'budget-cards-collapsed',
      JSON.stringify({
        project: false,
        bankAccount: true,
        minimumRequirement: true,
        revenue: true,
        bills: true,
        capitalInvestment: true,
      })
    );
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    jest.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('decrements the displayed year on Previous and increments on Next', async () => {
    stubFetch([{ id: 'p1', financialYear: 2027 }]);
    const { queryClient } = renderBudget();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0), { timeout: 5000 });
    await waitForCard('p1');

    expect(screen.getByTestId('budget-project-card-p1')).toHaveTextContent('Financial Year: 2027');

    fireEvent.click(screen.getByTestId('button-shift-prev-year-p1'));
    await waitFor(() =>
      expect(screen.getByTestId('budget-project-card-p1')).toHaveTextContent(
        'Financial Year: 2026'
      )
    );

    fireEvent.click(screen.getByTestId('button-shift-next-year-p1'));
    await waitFor(() =>
      expect(screen.getByTestId('budget-project-card-p1')).toHaveTextContent(
        'Financial Year: 2027'
      )
    );
    fireEvent.click(screen.getByTestId('button-shift-next-year-p1'));
    await waitFor(() =>
      expect(screen.getByTestId('budget-project-card-p1')).toHaveTextContent(
        'Financial Year: 2028'
      )
    );
  });

  it('disables Previous at the minimum year and Next at the maximum year', async () => {
    stubFetch([
      { id: 'p-low', financialYear: MIN_YEAR },
      { id: 'p-high', financialYear: MAX_YEAR },
    ]);
    const { queryClient } = renderBudget();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0), { timeout: 5000 });
    await waitForCard('p-low');
    await waitForCard('p-high');

    expect(screen.getByTestId('button-shift-prev-year-p-low')).toBeDisabled();
    expect(screen.getByTestId('button-shift-next-year-p-low')).not.toBeDisabled();

    expect(screen.getByTestId('button-shift-next-year-p-high')).toBeDisabled();
    expect(screen.getByTestId('button-shift-prev-year-p-high')).not.toBeDisabled();
  });

  it('shows the "Unsaved change" badge once a shift is staged', async () => {
    stubFetch([{ id: 'p1', financialYear: 2027 }]);
    const { queryClient } = renderBudget();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0), { timeout: 5000 });
    await waitForCard('p1');

    expect(screen.queryByTestId('badge-pending-year-p1')).toBeNull();
    expect(screen.queryByTestId('button-confirm-year-p1')).toBeNull();

    fireEvent.click(screen.getByTestId('button-shift-next-year-p1'));

    await waitFor(() =>
      expect(screen.getByTestId('badge-pending-year-p1')).toBeInTheDocument()
    );
    expect(screen.getByTestId('badge-pending-year-p1')).toHaveTextContent('Unsaved change');
    expect(screen.getByTestId('button-confirm-year-p1')).toBeInTheDocument();
  });

  it('PATCHes /api/maintenance/projects/:id with the new financialYear when Confirm is clicked', async () => {
    const { patchCalls } = stubFetch([{ id: 'p1', financialYear: 2027 }]);
    const { queryClient } = renderBudget();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0), { timeout: 5000 });
    await waitForCard('p1');

    fireEvent.click(screen.getByTestId('button-shift-next-year-p1'));
    await waitFor(() =>
      expect(screen.getByTestId('budget-project-card-p1')).toHaveTextContent(
        'Financial Year: 2028'
      )
    );

    fireEvent.click(screen.getByTestId('button-confirm-year-p1'));

    await waitFor(() => expect(patchCalls.length).toBe(1));
    expect(patchCalls[0].url).toMatch(/\/api\/maintenance\/projects\/p1$/);
    expect(patchCalls[0].body).toEqual({ financialYear: 2028 });
  });
});
