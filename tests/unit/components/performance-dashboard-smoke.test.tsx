/**
 * @jest-environment jsdom
 *
 * Smoke test for the /admin/performance PerformanceDashboard page (task #1691).
 *
 * Regression guard: the page previously crashed on every render with
 * "TypeError: Cannot convert object to primitive value" because:
 *   1. The component had no default export, so React.lazy resolved to
 *      undefined when used via createOptimizedLoader.
 *   2. @ts-nocheck hid type mismatches that caused bad property access
 *      patterns (wrong cache shape, untyped useQuery results).
 *
 * This test mounts the component with mock API data and asserts the
 * "Performance Dashboard" heading is visible without throwing.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => key,
    setLanguage: jest.fn(),
  }),
}));

jest.mock('@/utils/web-vitals-monitor', () => ({
  useWebVitals: () => ({
    metrics: {},
    recommendations: [],
    performanceScore: undefined,
    userExperienceRating: undefined,
  }),
  webVitalsMonitor: {
    initialize: jest.fn(),
    onMetricsUpdate: jest.fn(() => jest.fn()),
    getOptimizationRecommendations: jest.fn(() => []),
  },
}));

jest.mock('@/utils/component-complexity-analyzer', () => ({
  complexityAnalyzer: {
    generateOptimizationReport: jest.fn(() => ({
      summary: {
        totalComponents: 0,
        complexComponents: 0,
        averageComplexity: 0,
        topIssues: [],
      },
      recommendations: [],
    })),
  },
}));

jest.mock('recharts', () => new Proxy({}, { get: () => () => null }));

jest.mock('@/components/ui/chart', () => ({
  ChartContainer: ({ children }: any) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

jest.mock('lucide-react', () => new Proxy({}, { get: () => () => <span /> }));

const MOCK_STATS = {
  database: {
    averageQueryTime: '12.34ms',
    maxQueryTime: '45.00ms',
    minQueryTime: '5.00ms',
    totalQueries: 42,
    slowQueries: 1,
    recentSlowQueries: [],
  },
  cache: {
    userScope: {
      size: 10,
      maxSize: 100,
      hits: 80,
      misses: 20,
      hitRate: '80.00%',
      memoryUsage: 1024,
    },
  },
  optimization: {
    enabled: true,
    status: 'optimal',
    currentAverage: '12.34ms',
    target: '50ms',
  },
  timestamp: new Date().toISOString(),
};

const MOCK_TRENDS = {
  current: {
    averageQueryTime: '12.34ms',
    totalQueries: 42,
    slowQueries: 1,
  },
  baseline: {
    averageQueryTime: '132ms',
    target: '50ms',
  },
  improvement: {
    percentage: '90.6%',
    achieved: true,
    targetReached: true,
  },
  status: 'optimal',
};

const MOCK_HEALTH = {
  status: 'ok',
  bulkImportStaging: null,
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }: { queryKey: readonly unknown[] }) => {
          const key = String(queryKey[0]);
          if (key === '/api/performance/stats') return MOCK_STATS;
          if (key === '/api/performance/trends') return MOCK_TRENDS;
          if (key === '/api/health') return MOCK_HEALTH;
          return {};
        },
      },
      mutations: { retry: false },
    },
  });
}

function renderDashboard() {
  const { PerformanceDashboard } = jest.requireActual(
    '../../../client/src/components/dashboard/PerformanceDashboard',
  );
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <PerformanceDashboard />
    </QueryClientProvider>,
  );
}

describe('PerformanceDashboard smoke test (task #1691)', () => {
  it('renders the heading without throwing', async () => {
    renderDashboard();
    expect(screen.getByTestId('performance-dashboard')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /performance dashboard/i }),
    ).toBeInTheDocument();
  });

  it('exports a default export (required by createOptimizedLoader)', () => {
    const mod = jest.requireActual(
      '../../../client/src/components/dashboard/PerformanceDashboard',
    ) as Record<string, unknown>;
    expect(typeof mod.default).toBe('function');
  });
});
