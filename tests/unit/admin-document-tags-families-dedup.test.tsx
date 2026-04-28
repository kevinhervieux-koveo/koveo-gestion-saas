/**
 * @jest-environment jsdom
 *
 * Task #1643 — Page-level dedup regression for the Link Families list.
 *
 * The admin Link Families settings view (`/admin/document-tags`) must
 * never render two cards for families that differ only by case or
 * whitespace. The page applies `dedupeLinkFamilies` to the API payload
 * before rendering — this test mocks the API to return a payload that
 * still contains duplicates (mirroring the worst case where backend
 * dedup hasn't completed yet) and pins the rendered row count.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks — modelled on admin-document-tags-toggle.test.tsx so behaviour
// stays consistent across page-level tests.
// ---------------------------------------------------------------------------

jest.mock('wouter', () => ({
  useLocation: () => ['/admin/document-tags', jest.fn()],
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({ t: (key: string) => key, language: 'en' }),
}));

jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'admin-1', role: 'admin' } }),
}));

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn(),
  queryClient: { invalidateQueries: jest.fn() },
}));

jest.mock('@/components/layout/header', () => ({
  Header: ({ title }: { title?: React.ReactNode }) => (
    <header data-testid='page-header'>{title}</header>
  ),
}));

jest.mock('@/components/ui/tabs', () => {
  const TabsCtx = React.createContext<{
    value: string;
    onValueChange: (v: string) => void;
  }>({ value: '', onValueChange: () => {} });

  const Tabs = ({
    value,
    onValueChange,
    children,
    ...rest
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
    [key: string]: any;
  }) => (
    <TabsCtx.Provider value={{ value, onValueChange }}>
      <div {...rest}>{children}</div>
    </TabsCtx.Provider>
  );

  const TabsList = ({ children }: { children: React.ReactNode }) => (
    <div role='tablist'>{children}</div>
  );

  const TabsTrigger = ({
    value,
    children,
    ...rest
  }: {
    value: string;
    children: React.ReactNode;
    [key: string]: any;
  }) => {
    const ctx = React.useContext(TabsCtx);
    return (
      <button
        type='button'
        role='tab'
        aria-selected={ctx.value === value}
        onClick={() => ctx.onValueChange(value)}
        {...rest}
      >
        {children}
      </button>
    );
  };

  return { Tabs, TabsList, TabsTrigger };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdminDocumentTags = require('@/pages/admin/document-tags').default;

type LinkFamily = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  organizationId: string | null;
  createdAt?: string;
};

function renderPageWithFamilies(families: LinkFamily[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const key = String(queryKey[0]);
          if (key === '/api/document-tags') return { tags: [] };
          if (key === '/api/document-link-families') return { families };
          if (key === '/api/organizations') return [];
          if (key === '/api/users/me/organizations') return [];
          return {};
        },
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminDocumentTags />
    </QueryClientProvider>
  );
}

describe('Document Tags admin page — Link Families list dedup (task #1643)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders only the canonical row per normalized name when the payload has duplicates', async () => {
    const families: LinkFamily[] = [
      { id: 'org-fin-old', name: 'Financial', description: null, isSystem: false, organizationId: 'org-1', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'org-fin-mid', name: '  financial ', description: null, isSystem: false, organizationId: 'org-1', createdAt: '2024-02-01T00:00:00Z' },
      { id: 'org-fin-new', name: 'FINANCIAL', description: null, isSystem: false, organizationId: 'org-1', createdAt: '2024-03-01T00:00:00Z' },
      { id: 'org-aga', name: 'AGA', description: null, isSystem: false, organizationId: 'org-1', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'sys-aga', name: 'aga', description: null, isSystem: true, organizationId: null, createdAt: '2024-06-01T00:00:00Z' },
    ];

    const { getByTestId, queryByTestId, findByTestId } = renderPageWithFamilies(families);

    // Switch to the Link Families view.
    fireEvent.click(getByTestId('toggle-view-families'));
    await findByTestId('section-link-families');

    // Wait for the React Query data to land and the list to render.
    await findByTestId('row-family-org-fin-old');

    // Canonical winners are present.
    expect(queryByTestId('row-family-org-fin-old')).toBeInTheDocument();
    expect(queryByTestId('row-family-sys-aga')).toBeInTheDocument();

    // Duplicate aliases are NOT rendered.
    expect(queryByTestId('row-family-org-fin-mid')).not.toBeInTheDocument();
    expect(queryByTestId('row-family-org-fin-new')).not.toBeInTheDocument();
    expect(queryByTestId('row-family-org-aga')).not.toBeInTheDocument();
  });

  it('renders every row when there are no normalized-name collisions', async () => {
    const families: LinkFamily[] = [
      { id: 'a', name: 'Alpha', description: null, isSystem: false, organizationId: 'org-1', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'b', name: 'Bravo', description: null, isSystem: false, organizationId: 'org-1', createdAt: '2024-01-02T00:00:00Z' },
      { id: 'c', name: 'Charlie', description: null, isSystem: true, organizationId: null, createdAt: '2024-01-03T00:00:00Z' },
    ];

    const { getByTestId, findByTestId, queryByTestId } = renderPageWithFamilies(families);

    fireEvent.click(getByTestId('toggle-view-families'));
    await findByTestId('section-link-families');
    await findByTestId('row-family-a');

    expect(queryByTestId('row-family-a')).toBeInTheDocument();
    expect(queryByTestId('row-family-b')).toBeInTheDocument();
    expect(queryByTestId('row-family-c')).toBeInTheDocument();
  });
});
