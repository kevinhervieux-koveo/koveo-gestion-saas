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
    json: async () => ({ id: 'b1', name: 'Test Building', organizationId: 'o1' }),
  }),
  queryClient: { invalidateQueries: jest.fn(), refetchQueries: jest.fn() },
}));

jest.mock('@/components/layout/header', () => ({
  Header: ({ title }: any) => <div data-testid="header">{title}</div>,
}));

jest.mock('@/components/maintenance/inventory/ElementTable', () => ({
  ElementTable: () => <div data-testid="element-table">ElementTable</div>,
}));

jest.mock('@/components/maintenance/inventory/ElementDocumentViewer', () => ({
  ElementDocumentViewer: () => <div data-testid="element-document-viewer">Viewer</div>,
}));

jest.mock('@/components/maintenance/inventory/UniformatBrowser', () => ({
  UniformatBrowser: () => <div data-testid="uniformat-browser">Uniformat</div>,
}));

jest.mock('@/components/maintenance/inventory/ElementForm', () => ({
  ElementForm: () => <div data-testid="element-form">ElementForm</div>,
}));

jest.mock('@/pages/manager/maintenance/inventory/InventoryOverview', () => ({
  InventoryOverview: ({ buildingId, organizationId }: any) => (
    <div
      data-testid="inventory-overview"
      data-building-id={buildingId}
      data-organization-id={organizationId}
    >
      InventoryOverview
    </div>
  ),
}));

jest.mock('@/components/ui/loading-spinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

import InventoryPage from '../../../client/src/pages/manager/maintenance/inventory/InventoryPage';

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
        <InventoryPage />
      </QueryClientProvider>
    </Router>
  );
  return { ...result, queryClient };
}

describe('InventoryPage HOC regression — withHierarchicalSelection + wouter mount', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => [{ id: 'o1', name: 'Test Org' }],
    });
    wouter.__resetMocks();
  });

  it('mounts without throwing an Invalid hook call error', () => {
    wouter.__setLocation('/manager/maintenance/inventory');
    expect(() => renderPage()).not.toThrow();
  });

  it('renders the inventory-page container when org and building are in the URL', () => {
    wouter.__setLocation('/manager/maintenance/inventory');
    wouter.__setSearch('organization=o1&building=b1');
    renderPage();
    expect(screen.getByTestId('inventory-page')).toBeInTheDocument();
  });

  it('renders the InventoryOverview when the building is selected', () => {
    wouter.__setLocation('/manager/maintenance/inventory');
    wouter.__setSearch('organization=o1&building=b1');
    renderPage();
    expect(screen.getByTestId('inventory-overview')).toBeInTheDocument();
  });
});
