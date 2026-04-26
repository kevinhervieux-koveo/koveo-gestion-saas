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

jest.mock('@/components/common-spaces/calendar-view', () => ({
  CalendarView: () => <div data-testid="calendar-view">CalendarView</div>,
}));

jest.mock('@/components/common-spaces/common-space-calendar', () => ({
  CommonSpaceCalendar: () => <div data-testid="common-space-calendar">CommonSpaceCalendar</div>,
}));

import CommonSpacesStatsPage from '../../../client/src/pages/manager/common-spaces-stats';

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
        <CommonSpacesStatsPage />
      </QueryClientProvider>
    </Router>
  );
  return { ...result, queryClient };
}

describe('CommonSpacesStatsPage HOC regression — withHierarchicalSelection + wouter mount', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => [{ id: 'o1', name: 'Test Org' }],
    });
    wouter.__resetMocks();
  });

  it('mounts without throwing an Invalid hook call error', () => {
    wouter.__setLocation('/manager/common-spaces-stats');
    expect(() => renderPage()).not.toThrow();
  });

  it('renders the inner common spaces stats page when org and building are in the URL', () => {
    wouter.__setLocation('/manager/common-spaces-stats');
    wouter.__setSearch('organization=o1&building=b1');
    expect(() => renderPage()).not.toThrow();
    // The inner page renders a root container with this testid; the
    // picker step does not, so it proves the wrapped page body (not just
    // the picker) actually mounted.
    expect(screen.getByTestId('common-spaces-stats-page')).toBeInTheDocument();
  });
});
