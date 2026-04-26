import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider, QueryFunction } from '@tanstack/react-query';
import { Router } from 'wouter';

const wouter = require('wouter');

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', role: 'manager', email: 'manager@test.com' },
    isAuthenticated: true,
  }),
  AuthProvider: ({ children }: any) => children,
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({ language: 'en', t: (k: string) => k, setLanguage: jest.fn() }),
  LanguageProvider: ({ children }: any) => children,
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  }),
  queryClient: { invalidateQueries: jest.fn(), refetchQueries: jest.fn() },
}));

jest.mock('@/components/layout/header', () => ({
  Header: ({ title }: any) => <div data-testid="header">{title}</div>,
}));

jest.mock('@/lib/pdf-export', () => ({
  loadPdfLibs: jest.fn().mockResolvedValue({ jsPDF: jest.fn(), html2canvas: jest.fn() }),
}));

jest.mock('@/components/GanttChart', () => ({
  GanttChart: () => <div data-testid="gantt-chart">GanttChart</div>,
}));

import BudgetPage from '../../../client/src/pages/manager/budget';

const defaultQueryFn: QueryFunction = async ({ queryKey, signal }) => {
  const url = (queryKey as readonly unknown[]).join('/') as string;
  const res = await fetch(url, { credentials: 'include', signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return null;
  return res.json();
};

function makeQueryClient() {
  return new QueryClient({
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
}

function renderPage() {
  const queryClient = makeQueryClient();
  const result = render(
    <Router>
      <QueryClientProvider client={queryClient}>
        <BudgetPage />
      </QueryClientProvider>
    </Router>
  );
  return { ...result, queryClient };
}

describe('BudgetPage HOC regression — withHierarchicalSelection + wouter mount', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => [{ id: 'o1', name: 'Test Org' }],
    });
    // BudgetInner installs an IntersectionObserver in a useEffect to drive
    // its floating refresh button. jsdom doesn't ship this API, so stub it
    // out before the wrapped page body actually mounts.
    (global as any).IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    };
    wouter.__resetMocks();
  });

  it('mounts without throwing an Invalid hook call error', () => {
    wouter.__setLocation('/manager/budget');
    expect(() => renderPage()).not.toThrow();
  });

  it('renders the inner budget page when org and building are in the URL', () => {
    wouter.__setLocation('/manager/budget');
    wouter.__setSearch('organization=o1&building=b1');
    expect(() => renderPage()).not.toThrow();
    // The "back to building" button is only rendered by BudgetInner once
    // buildingId is present, so it proves the wrapped page body (not just
    // the picker) actually mounted.
    expect(screen.getByTestId('button-back-to-building')).toBeInTheDocument();
  });
});
