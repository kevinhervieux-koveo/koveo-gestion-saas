/**
 * Deep-link back-button label tests for the real `withHierarchicalSelection` HOC.
 *
 * Task #112: When a user opens a hierarchical page directly via a URL like
 * `?organization=...&building=...`, the back button must render the resolved
 * parent entity name (the actual organization name when going back from a
 * building, the actual building name when going back from a residence) and
 * NOT the generic translation fallback (`organization` / `building`).
 *
 * These tests render the real HOC (no replacement implementation), drive
 * the deep-link via mocked `wouter` hooks, mock fetch to return the parent
 * entities, and assert the resolved label that the wrapped component
 * receives via its `backButtonLabel` prop.
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
  useLocation: () => ['/manager/buildings', mockSetLocation],
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
      <span>{title}</span>
      <span>{subtitle}</span>
    </header>
  ),
}));

import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';

interface CapturedProps {
  showBackButton?: boolean;
  backButtonLabel?: string;
  buildingId?: string;
  organizationId?: string;
  residenceId?: string;
}

function makeCapturingComponent(captured: { props: CapturedProps | null }) {
  return function Capturing(props: CapturedProps) {
    captured.props = props;
    return (
      <div data-testid="wrapped">
        <span data-testid="back-label">{props.backButtonLabel ?? ''}</span>
      </div>
    );
  };
}

const ORG_A = { id: 'org-a', name: 'Maple Heights Condos', description: '' };
const ORG_B = { id: 'org-b', name: 'Riverside Towers', description: '' };
const BUILDING_1 = { id: 'bld-1', name: 'Building Alpha', address: '1 A St' };
const BUILDING_2 = { id: 'bld-2', name: 'Building Beta', address: '2 B St' };
const RESIDENCE_1 = { id: 'res-1', unitNumber: '101', buildingName: 'Building Alpha' };
const RESIDENCE_2 = { id: 'res-2', unitNumber: '102', buildingName: 'Building Alpha' };

function setupFetchMock() {
  const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    let body: unknown = [];
    if (url.startsWith('/api/users/me/organizations')) {
      body = [ORG_A, ORG_B];
    } else if (url.startsWith('/api/organizations/accessible-building-counts')) {
      body = { [ORG_A.id]: 2, [ORG_B.id]: 1 };
    } else if (
      url.startsWith('/api/users/me/buildings') ||
      url.startsWith(`/api/organizations/${ORG_A.id}/buildings`)
    ) {
      body = [BUILDING_1, BUILDING_2];
    } else if (
      url.startsWith(`/api/buildings/${BUILDING_1.id}/residences`) ||
      url.startsWith('/api/users/me/residences')
    ) {
      body = [RESIDENCE_1, RESIDENCE_2];
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

describe('withHierarchicalSelection — deep-link back-button labels', () => {
  // The HOC fires multiple chained `useQuery` requests behind the scenes, and
  // under heavy parallel jest load the default 5s timeout occasionally races
  // ahead of resolution. Bumping per-test timeout keeps the suite stable.
  jest.setTimeout(15000);

  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    originalFetch = (global as unknown as { fetch?: typeof fetch }).fetch;
    mockSetLocation.mockClear();
  });

  afterEach(() => {
    if (originalFetch) {
      (global as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    }
    jest.clearAllMocks();
  });

  test('building → organization back-button shows actual organization name on deep-link', async () => {
    // Single-building scenario: the HOC's "back to building selection" branch
    // is skipped (buildings.length must be > 1), so the org branch fires and
    // we can assert the resolved organization name.
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      let body: unknown = [];
      if (url.startsWith('/api/users/me/organizations')) body = [ORG_A, ORG_B];
      else if (url.startsWith('/api/organizations/accessible-building-counts'))
        body = { [ORG_A.id]: 1, [ORG_B.id]: 1 };
      else if (
        url.startsWith('/api/users/me/buildings') ||
        url.startsWith(`/api/organizations/${ORG_A.id}/buildings`)
      )
        body = [BUILDING_1];
      return {
        ok: true,
        status: 200,
        json: async () => body,
        text: async () => JSON.stringify(body),
      } as unknown as Response;
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    mockSearch = `?organization=${ORG_A.id}&building=${BUILDING_1.id}`;

    const captured: { props: CapturedProps | null } = { props: null };
    const Wrapped = withHierarchicalSelection(makeCapturingComponent(captured), {
      hierarchy: ['organization', 'building'],
    });

    renderWithClient(<Wrapped />);

    await waitFor(() => {
      expect(screen.getByTestId('wrapped')).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(captured.props?.showBackButton).toBe(true);
        expect(captured.props?.backButtonLabel).toBe(ORG_A.name);
      },
      { timeout: 8000 }
    );

    expect(captured.props?.backButtonLabel).not.toBe('organization');
    expect(screen.getByTestId('back-label')).toHaveTextContent(ORG_A.name);
  });

  test('building → organization back-button shows organization name when org has multiple buildings (Task #121)', async () => {
    // Multi-building scenario: hierarchy = [organization, building], org has
    // multiple buildings. Per Task #121, the back-button on a building-level
    // wrapped page must label with the DESTINATION (the parent organization),
    // not the current building's name. Pressing back clears the building
    // selection and lands the user on the org's building-selection screen.
    setupFetchMock();
    mockSearch = `?organization=${ORG_A.id}&building=${BUILDING_1.id}`;

    const captured: { props: CapturedProps | null } = { props: null };
    const Wrapped = withHierarchicalSelection(makeCapturingComponent(captured), {
      hierarchy: ['organization', 'building'],
    });

    renderWithClient(<Wrapped />);

    await waitFor(() => {
      expect(screen.getByTestId('wrapped')).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(captured.props?.showBackButton).toBe(true);
        expect(captured.props?.backButtonLabel).toBe(ORG_A.name);
      },
      { timeout: 8000 }
    );

    // Must NOT label with the current building's name (the pre-fix behavior).
    expect(captured.props?.backButtonLabel).not.toBe(BUILDING_1.name);
    expect(captured.props?.backButtonLabel).not.toBe(BUILDING_2.name);
    expect(screen.getByTestId('back-label')).toHaveTextContent(ORG_A.name);
  });

  test('residence → building back-button shows actual building name on deep-link', async () => {
    setupFetchMock();
    mockSearch = `?organization=${ORG_A.id}&building=${BUILDING_1.id}&residence=${RESIDENCE_1.id}`;

    const captured: { props: CapturedProps | null } = { props: null };
    const Wrapped = withHierarchicalSelection(makeCapturingComponent(captured), {
      hierarchy: ['organization', 'building', 'residence'],
    });

    renderWithClient(<Wrapped />);

    await waitFor(() => {
      expect(screen.getByTestId('wrapped')).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(captured.props?.showBackButton).toBe(true);
        expect(captured.props?.backButtonLabel).toBe(BUILDING_1.name);
      },
      { timeout: 8000 }
    );

    expect(captured.props?.backButtonLabel).not.toBe('building');
    expect(screen.getByTestId('back-label')).toHaveTextContent(BUILDING_1.name);
  });
});
