/**
 * Resident-scope flow & header tests for the `withHierarchicalSelection` HOC.
 *
 * Task #625: `/residents/common-spaces` should never leak the generic
 * "Gestion de bâtiments / Sélectionnez l'organisation" wrapper header, and
 * residents/tenants should bypass the org → building picker in favour of a
 * residence-aware flow fed by `/api/users/me/residences`.
 *
 * After rebasing onto main, the resident bypass is implemented by a sibling
 * `ResidentBypassFlow` component that the HOC selects when the user role is
 * resident/tenant. For building-level pages (e.g. `/residents/common-spaces`):
 *   - if the user's residences resolve to a single distinct building, the
 *     wrapped page is rendered directly with `buildingId` injected (no URL
 *     navigation, no picker);
 *   - if there are multiple distinct buildings, a building picker is shown
 *     and selecting an entry writes `?building=<id>` into the URL.
 *
 * These tests render the real HOC, drive the flow via mocked `wouter` hooks,
 * mock fetch to return the resident's residence links, and assert:
 *   1. Single-building resident lands directly on the wrapped page.
 *   2. Multi-building resident sees the bypass picker; selecting a building
 *      writes `?building=<id>`. The picker honors the configured
 *      LocalizedText `title`/`subtitle`.
 *   3. Manager flow is unchanged but now displays the configured
 *      "Common Spaces / Book your common spaces" header instead of the
 *      generic "buildingManagement / selectOrganization" leak.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
  useLocation: () => ['/residents/common-spaces', mockSetLocation],
  useSearch: () => mockSearch,
}));

let mockUserRole = 'resident';
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', role: mockUserRole },
  }),
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
}));

jest.mock('@/lib/logger', () => ({
  logDebug: () => {},
  logError: () => {},
  logInfo: () => {},
  logWarn: () => {},
}));

jest.mock('@/components/common/SelectionGrid', () => ({
  SelectionGrid: ({
    items,
    onSelectItem,
    isLoading,
  }: {
    items: Array<{ id: string; name: string; details?: string }>;
    onSelectItem: (id: string) => void;
    isLoading?: boolean;
  }) => (
    <div data-testid="selection-grid">
      {isLoading && <div data-testid="loading-spinner">loading</div>}
      {items.map((i) => (
        <button
          key={i.id}
          data-testid={`grid-item-${i.id}`}
          onClick={() => onSelectItem(i.id)}
        >
          {i.name}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@/components/layout/header', () => ({
  Header: ({ title, subtitle }: { title?: React.ReactNode; subtitle?: React.ReactNode }) => (
    <header data-testid="page-header">
      <span data-testid="header-title">{title}</span>
      <span data-testid="header-subtitle">{subtitle}</span>
    </header>
  ),
}));

import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';

interface CapturedProps {
  buildingId?: string;
  organizationId?: string;
  residenceId?: string;
  buildingName?: string;
  showBackButton?: boolean;
  backButtonLabel?: React.ReactNode;
}

function makeCapturingComponent(captured: { props: CapturedProps | null }) {
  return function Capturing(props: CapturedProps) {
    captured.props = props;
    return (
      <div data-testid="wrapped">
        <span data-testid="wrapped-building-id">{props.buildingId ?? ''}</span>
        <span data-testid="wrapped-building-name">{props.buildingName ?? ''}</span>
      </div>
    );
  };
}

const RES_SINGLE = {
  id: 'res-1',
  unitNumber: '101',
  buildingId: 'bld-1',
  buildingName: 'Maple Heights',
};
// Two residences across two distinct buildings (the bypass picker keys by
// building, so two units in the *same* building would auto-resolve, not
// produce a picker).
const RES_BLD_A = {
  id: 'res-a',
  unitNumber: '101',
  buildingId: 'bld-a',
  buildingName: 'Maple Heights',
};
const RES_BLD_B = {
  id: 'res-b',
  unitNumber: '202',
  buildingId: 'bld-b',
  buildingName: 'Riverside Towers',
};

const ORG = { id: 'org-1', name: 'Maple Heights Org', description: '' };
const MGR_BUILDING = { id: 'bld-mgr', name: 'Manager Building', address: '1 Mgr St' };

function setupFetchMock(residences: Array<typeof RES_SINGLE>) {
  const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    let body: unknown = [];
    if (url.startsWith('/api/users/me/residences')) {
      body = residences;
    } else if (url.startsWith('/api/users/me/organizations')) {
      body = [ORG];
    } else if (url.startsWith('/api/organizations/accessible-building-counts')) {
      body = { [ORG.id]: 1 };
    } else if (url.startsWith('/api/users/me/buildings') || url.includes('/buildings')) {
      body = [MGR_BUILDING];
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

describe('withHierarchicalSelection — common-spaces resident scope (Task #625)', () => {
  jest.setTimeout(15000);

  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    originalFetch = (global as unknown as { fetch?: typeof fetch }).fetch;
    mockSearch = '';
    mockSetLocation.mockClear();
    mockUserRole = 'resident';
  });

  afterEach(() => {
    if (originalFetch) {
      (global as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    }
    jest.clearAllMocks();
  });

  test('single-building resident: renders the wrapped page directly with buildingId injected (no picker)', async () => {
    setupFetchMock([RES_SINGLE]);

    const captured: { props: CapturedProps | null } = { props: null };
    const Wrapped = withHierarchicalSelection(makeCapturingComponent(captured), {
      hierarchy: ['organization', 'building'],
      title: { en: 'Common Spaces', fr: 'Espaces Communs' },
      subtitle: { en: 'Book your common spaces', fr: 'Réservez vos espaces communs' },
    });

    renderWithClient(<Wrapped />);

    // The wrapped page renders directly with the resident's only building
    // injected — no picker, no URL navigation.
    await waitFor(
      () => {
        expect(screen.getByTestId('wrapped')).toBeInTheDocument();
      },
      { timeout: 8000 }
    );
    expect(screen.getByTestId('wrapped-building-id')).toHaveTextContent(RES_SINGLE.buildingId);
    expect(screen.getByTestId('wrapped-building-name')).toHaveTextContent(RES_SINGLE.buildingName);

    // No flat picker, no auto-forwarding URL navigation.
    expect(screen.queryByTestId('selection-grid')).not.toBeInTheDocument();
    expect(mockSetLocation).not.toHaveBeenCalled();
  });

  test('multi-building resident: shows bypass picker honoring localized header; selecting a building writes ?building=<id>', async () => {
    setupFetchMock([RES_BLD_A, RES_BLD_B]);

    const captured: { props: CapturedProps | null } = { props: null };
    const Wrapped = withHierarchicalSelection(makeCapturingComponent(captured), {
      hierarchy: ['organization', 'building'],
      title: { en: 'Common Spaces', fr: 'Espaces Communs' },
      subtitle: { en: 'Book your common spaces', fr: 'Réservez vos espaces communs' },
    });

    renderWithClient(<Wrapped />);

    // Both distinct buildings show as picker items.
    await waitFor(() => {
      expect(screen.getByTestId(`grid-item-${RES_BLD_A.buildingId}`)).toBeInTheDocument();
    });
    expect(screen.getByTestId(`grid-item-${RES_BLD_A.buildingId}`)).toHaveTextContent(
      RES_BLD_A.buildingName
    );
    expect(screen.getByTestId(`grid-item-${RES_BLD_B.buildingId}`)).toHaveTextContent(
      RES_BLD_B.buildingName
    );

    // Picker header uses the resident-scope LocalizedText override
    // (Common Spaces / Book your common spaces) — never the generic
    // "buildingManagement / selectOrganization" leak that originally
    // motivated Task #625, and never a `{ en, fr }` object dumped to the DOM.
    expect(screen.getByTestId('header-title')).toHaveTextContent('Common Spaces');
    expect(screen.getByTestId('header-subtitle')).toHaveTextContent('Book your common spaces');
    expect(screen.getByTestId('header-title')).not.toHaveTextContent('selectOrganization');
    expect(screen.getByTestId('header-subtitle')).not.toHaveTextContent('selectOrganization');

    // Selecting a building writes that buildingId into the URL.
    fireEvent.click(screen.getByTestId(`grid-item-${RES_BLD_B.buildingId}`));
    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith(
        expect.stringContaining(`building=${RES_BLD_B.buildingId}`)
      );
    });
  });

  test('manager flow unchanged: org picker still renders, but with the configured Common Spaces header', async () => {
    mockUserRole = 'manager';
    setupFetchMock([]);

    const captured: { props: CapturedProps | null } = { props: null };
    const Wrapped = withHierarchicalSelection(makeCapturingComponent(captured), {
      hierarchy: ['organization', 'building'],
      title: { en: 'Common Spaces', fr: 'Espaces Communs' },
      subtitle: { en: 'Book your common spaces', fr: 'Réservez vos espaces communs' },
    });

    renderWithClient(<Wrapped />);

    // The manager goes through the org → building flow. With a single org, the
    // HOC auto-forwards to the building picker; we wait for that nav call.
    await waitFor(
      () => {
        expect(mockSetLocation).toHaveBeenCalledWith(
          expect.stringContaining(`organization=${ORG.id}`)
        );
      },
      { timeout: 8000 }
    );

    // Header shows the configured Common Spaces title/subtitle on the
    // org-picker step — the regression that prompted Task #625.
    expect(screen.getByTestId('header-title')).toHaveTextContent('Common Spaces');
    expect(screen.getByTestId('header-subtitle')).toHaveTextContent('Book your common spaces');
    expect(screen.getByTestId('header-title')).not.toHaveTextContent('buildingManagement');
  });
});
