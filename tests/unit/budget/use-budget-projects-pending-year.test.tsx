/**
 * @file Budget page — pending-year overlay survives a project refetch
 * @description Regression tests for Task #246 (originally written against
 * the `useBudgetProjects` hook in isolation). Migrated under Task #534
 * to mount the real `BudgetInner` page (the same trick used by
 * `tests/unit/budget/budget-project-card-shift.test.tsx` and
 * `tests/integration/budget-page-render.test.tsx`) so a regression in
 * the page wiring — `pendingProjectYears` state, the `useBudgetProjects`
 * overlay, the `useEffect` that re-syncs server data into local state —
 * is caught instead of testing scaffolding.
 *
 *  - The displayed financial year on each project card matches the
 *    server-supplied `financialYear` when no shift has been staged.
 *  - Clicking the Next/Prev shift button on one card overlays the
 *    new financial year on that card only.
 *  - Refetching the projects query (with byte-identical server data)
 *    does NOT clobber the staged override — the "Unsaved change" badge
 *    and the shifted year survive the cache replacement.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  cleanup,
  configure,
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
  type QueryFunction,
} from '@tanstack/react-query';
import '@testing-library/jest-dom';

// Mounting BudgetInner end-to-end (queries + render commit) takes ~3-6s
// under parallel load even though the assertions themselves are fast,
// so bump the per-test budget well above Jest's 3s default. Without this
// the suite passes when run alone but flakes inside `npm run test:fast`.
jest.setTimeout(20000);

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

const buildingId = 'bld-pending';
const organizationId = 'org-pending';

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

interface FetchStub {
  fetchMock: jest.Mock;
  projectsRequestCount: () => number;
}

function stubFetch(projects: ProjectFixture[]): FetchStub {
  let projectsRequests = 0;
  // Re-build the projects payload on every request so the cache is
  // replaced with a structurally-equal-but-not-identical object — the
  // same shape the real backend would return on a refetch.
  const impl = async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    if (/\/api\/budgets\/.+\/bank-account/.test(url)) return buildJsonResponse(bankAccountPayload);
    if (/\/api\/buildings\/.+\/residences/.test(url)) return buildJsonResponse(residencesPayload);
    if (/\/api\/budgets\/.+\/investments/.test(url)) return buildJsonResponse(investmentsPayload);
    if (/\/api\/maintenance\/buildings\/.+\/projects/.test(url)) {
      projectsRequests += 1;
      return buildJsonResponse(makeProjectsPayload(projects));
    }
    if (/\/api\/budgets\/.+\/forecast/.test(url)) return buildJsonResponse(forecastPayload);
    return buildJsonResponse({});
  };

  const fetchMock = jest.fn(impl) as unknown as jest.Mock;
  (global as any).fetch = fetchMock;
  return { fetchMock, projectsRequestCount: () => projectsRequests };
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

describe('BudgetInner — pending-year overlay (real page wiring)', () => {
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

  it('displays the server-supplied financial year on every card when no shift is staged', async () => {
    stubFetch([
      { id: 'p1', financialYear: 2026 },
      { id: 'p2', financialYear: 2027 },
    ]);
    const { queryClient } = renderBudget();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0), { timeout: 5000 });
    await waitForCard('p1');
    await waitForCard('p2');

    expect(screen.getByTestId('budget-project-card-p1')).toHaveTextContent('Financial Year: 2026');
    expect(screen.getByTestId('budget-project-card-p2')).toHaveTextContent('Financial Year: 2027');

    // No shift => no pending badge, no Confirm button on either card.
    expect(screen.queryByTestId('badge-pending-year-p1')).toBeNull();
    expect(screen.queryByTestId('badge-pending-year-p2')).toBeNull();
    expect(screen.queryByTestId('button-confirm-year-p1')).toBeNull();
    expect(screen.queryByTestId('button-confirm-year-p2')).toBeNull();
  });

  it('overlays the staged year on the shifted card only and leaves siblings untouched', async () => {
    stubFetch([
      { id: 'p1', financialYear: 2026 },
      { id: 'p2', financialYear: 2027 },
    ]);
    const { queryClient } = renderBudget();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0), { timeout: 5000 });
    await waitForCard('p1');
    await waitForCard('p2');

    fireEvent.click(screen.getByTestId('button-shift-next-year-p1'));

    await waitFor(() =>
      expect(screen.getByTestId('budget-project-card-p1')).toHaveTextContent(
        'Financial Year: 2027'
      )
    );
    // p2's displayed year is unaffected by p1's shift.
    expect(screen.getByTestId('budget-project-card-p2')).toHaveTextContent('Financial Year: 2027');
    expect(screen.queryByTestId('badge-pending-year-p2')).toBeNull();
    expect(screen.queryByTestId('button-confirm-year-p2')).toBeNull();
  });

  it('preserves the staged override after a project-query refetch with unchanged server data', async () => {
    const stub = stubFetch([
      { id: 'p1', financialYear: 2026 },
      { id: 'p2', financialYear: 2027 },
    ]);
    const { queryClient } = renderBudget();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0), { timeout: 5000 });
    await waitForCard('p1');

    // Stage a +1 shift on p1: 2026 -> 2027.
    fireEvent.click(screen.getByTestId('button-shift-next-year-p1'));
    await waitFor(() =>
      expect(screen.getByTestId('budget-project-card-p1')).toHaveTextContent(
        'Financial Year: 2027'
      )
    );
    expect(screen.getByTestId('badge-pending-year-p1')).toBeInTheDocument();
    expect(screen.getByTestId('button-confirm-year-p1')).toBeInTheDocument();

    const requestsBeforeRefetch = stub.projectsRequestCount();

    // Trigger a refetch that returns identical (but freshly-allocated)
    // server data — the same flow as a background revalidation. The
    // overlay must survive the cache replacement.
    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: ['/api/maintenance/buildings', buildingId, 'projects'],
      });
    });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0), { timeout: 5000 });

    // Sanity: the refetch actually hit the network stub.
    expect(stub.projectsRequestCount()).toBeGreaterThan(requestsBeforeRefetch);

    // Override is still applied on p1, p2 still shows its server year.
    expect(screen.getByTestId('budget-project-card-p1')).toHaveTextContent(
      'Financial Year: 2027'
    );
    expect(screen.getByTestId('badge-pending-year-p1')).toBeInTheDocument();
    expect(screen.getByTestId('button-confirm-year-p1')).toBeInTheDocument();
    expect(screen.getByTestId('budget-project-card-p2')).toHaveTextContent(
      'Financial Year: 2027'
    );
    expect(screen.queryByTestId('badge-pending-year-p2')).toBeNull();
  });
});
