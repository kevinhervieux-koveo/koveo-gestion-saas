/**
 * Title resolution tests for the `withHierarchicalSelection` HOC.
 *
 * Task #635: Every `/manager/<section>` root used to render the generic
 * `t('buildingManagement')` title during the org/building selection phase.
 * The fix introduces an optional `titleKey` field on the HOC config so each
 * page can provide its own i18n key. These tests lock the resolution
 * precedence:
 *
 *   1. `config.titleKey` (i18n key) — preferred when provided
 *   2. `config.title` (literal string) — used when no `titleKey` is given
 *   3. `t('buildingManagement')` — final fallback
 *
 * The Header renders during the building-selection phase (organization
 * resolved, building not yet picked), which is exactly where the leakage
 * was visible before the fix.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveTextContent(text: string | RegExp): R;
    }
  }
}

let mockSearch = '';
const mockSetLocation = jest.fn();

jest.mock('wouter', () => ({
  useLocation: () => ['/manager/budget', mockSetLocation],
  useSearch: () => mockSearch,
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
}));

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', role: 'manager' },
  }),
}));

jest.mock('@/lib/logger', () => ({
  logDebug: () => {},
  logError: () => {},
  logInfo: () => {},
  logWarn: () => {},
}));

jest.mock('@/components/common/SelectionGrid', () => ({
  SelectionGrid: ({ items }: { items: Array<{ id: string; name: string }> }) => (
    <div data-testid="selection-grid">
      {items.map((i) => (
        <div key={i.id}>{i.name}</div>
      ))}
    </div>
  ),
}));

jest.mock('@/components/layout/header', () => ({
  Header: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <header>
      <h2 data-testid="header-title">{title}</h2>
      <span data-testid="header-subtitle">{subtitle}</span>
    </header>
  ),
}));

import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';

const ORG_A = { id: 'org-a', name: 'Maple Heights Condos', description: '' };
const BUILDING_1 = { id: 'bld-1', name: 'Building Alpha', address: '1 A St' };
const BUILDING_2 = { id: 'bld-2', name: 'Building Beta', address: '2 B St' };

function setupFetchMock() {
  const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    let body: unknown = [];
    if (url.startsWith('/api/users/me/organizations')) {
      body = [ORG_A];
    } else if (url.startsWith('/api/organizations/accessible-building-counts')) {
      body = { [ORG_A.id]: 2 };
    } else if (
      url.startsWith('/api/users/me/buildings') ||
      url.startsWith(`/api/organizations/${ORG_A.id}/buildings`)
    ) {
      body = [BUILDING_1, BUILDING_2];
    }
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  });
  (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function renderWithClient(node: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        queryFn: async ({ queryKey }) => {
          const url = String(queryKey[0]);
          const res = await fetch(url, { credentials: 'include' });
          if (!res.ok) throw new Error(`Request failed: ${res.status}`);
          return res.json();
        },
      },
    },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

function Stub() {
  return <div data-testid="wrapped" />;
}

describe('withHierarchicalSelection — title resolution', () => {
  jest.setTimeout(15000);

  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    originalFetch = (global as unknown as { fetch?: typeof fetch }).fetch;
    setupFetchMock();
    // Pin the URL to the building-selection phase: organization resolved,
    // no building selected. This is the exact phase where the bad fallback
    // ("buildingManagement" / "Gestion de bâtiments") used to leak.
    mockSearch = `?organization=${ORG_A.id}`;
    mockSetLocation.mockClear();
  });

  afterEach(() => {
    if (originalFetch) {
      (global as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    }
    jest.clearAllMocks();
  });

  test('renders t(titleKey) when titleKey is provided', async () => {
    const Wrapped = withHierarchicalSelection(Stub, {
      hierarchy: ['organization', 'building'],
      titleKey: 'budgetManagement',
    });

    renderWithClient(<Wrapped />);

    await waitFor(() => {
      expect(screen.getByTestId('selection-grid')).toBeInTheDocument();
    });

    expect(screen.getByTestId('header-title')).toHaveTextContent('budgetManagement');
    expect(screen.getByTestId('header-title')).not.toHaveTextContent('buildingManagement');
  });

  test('falls back to literal `title` when only `title` is provided', async () => {
    const Wrapped = withHierarchicalSelection(Stub, {
      hierarchy: ['organization', 'building'],
      title: 'Custom Literal Title',
    });

    renderWithClient(<Wrapped />);

    await waitFor(() => {
      expect(screen.getByTestId('selection-grid')).toBeInTheDocument();
    });

    expect(screen.getByTestId('header-title')).toHaveTextContent('Custom Literal Title');
  });

  test('falls back to t("buildingManagement") when neither titleKey nor title is provided', async () => {
    const Wrapped = withHierarchicalSelection(Stub, {
      hierarchy: ['organization', 'building'],
    });

    renderWithClient(<Wrapped />);

    await waitFor(() => {
      expect(screen.getByTestId('selection-grid')).toBeInTheDocument();
    });

    expect(screen.getByTestId('header-title')).toHaveTextContent('buildingManagement');
  });

  test('titleKey wins when both titleKey and title are provided', async () => {
    const Wrapped = withHierarchicalSelection(Stub, {
      hierarchy: ['organization', 'building'],
      titleKey: 'billsManagement',
      title: 'Should Be Ignored',
    });

    renderWithClient(<Wrapped />);

    await waitFor(() => {
      expect(screen.getByTestId('selection-grid')).toBeInTheDocument();
    });

    expect(screen.getByTestId('header-title')).toHaveTextContent('billsManagement');
    expect(screen.getByTestId('header-title')).not.toHaveTextContent('Should Be Ignored');
  });

  test.each([
    ['budget', 'budgetManagement'],
    ['bills', 'billsManagement'],
    ['residences', 'residencesManagement'],
    ['inventory', 'inventoryManagement'],
    ['projects', 'projectsMaintenanceManagement'],
    ['common-spaces-stats', 'manageCommonSpaces'],
    ['buildings', 'buildingsManagement'],
  ])(
    'route %s renders its own section title (%s) during building selection',
    async (_route, titleKey) => {
      const Wrapped = withHierarchicalSelection(Stub, {
        hierarchy: ['organization', 'building'],
        titleKey,
      });

      renderWithClient(<Wrapped />);

      await waitFor(() => {
        expect(screen.getByTestId('selection-grid')).toBeInTheDocument();
      });

      expect(screen.getByTestId('header-title')).toHaveTextContent(titleKey);
      expect(screen.getByTestId('header-title')).not.toHaveTextContent(
        'buildingManagement'
      );
    }
  );
});
