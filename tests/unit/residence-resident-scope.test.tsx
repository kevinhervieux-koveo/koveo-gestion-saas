/**
 * Resident-scope flow tests for `/residents/residence` (Task #678).
 *
 * Task #625 fixed the residence-first flow on `/resident/common-spaces`.
 * The same picker leak (W13) was still present on `/residents/residence`,
 * which used the full `['organization', 'building', 'residence']`
 * hierarchy without a `residentScope` flag — residents were forced
 * through the org → building → residence picker even though they only
 * ever care about their own units.
 *
 * After Task #678 the residence page wires `residentScope: true`,
 * a localized `title`/`subtitle`, and an `onResidenceSelect` that
 * targets `/residents/residences/<id>/documents`. The HOC's resident
 * bypass flow then:
 *   - auto-forwards a single-residence resident straight to the
 *     residence-documents page (no picker);
 *   - shows a flat "Building · Unit X" chooser when the resident has
 *     multiple residences, with each selection navigating to the
 *     residence-documents page;
 *   - surfaces the residence-page title/subtitle on every intermediate
 *     screen so the generic "Gestion de bâtiments / Sélectionnez
 *     l'organisation" wrapper header never leaks.
 *
 * The tests below mirror the structure of
 * `tests/unit/common-spaces-resident-scope.test.tsx` so the two
 * resident-scope flows stay regression-protected together.
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
  useLocation: () => ['/residents/residence', mockSetLocation],
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
        <span data-testid="wrapped-residence-id">{props.residenceId ?? ''}</span>
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

const RESIDENCE_TITLE = { en: 'My Residence', fr: 'Ma résidence' };
const RESIDENCE_SUBTITLE = {
  en: 'View your residence information and contacts',
  fr: 'Voir les informations de votre résidence et les contacts',
};

describe('withHierarchicalSelection — /residents/residence resident scope (Task #678)', () => {
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

  test('single residence link: auto-forwards to /residents/residences/<id>/documents (no picker, no wrapped page)', async () => {
    setupFetchMock([RES_SINGLE]);

    const captured: { props: CapturedProps | null } = { props: null };
    const Wrapped = withHierarchicalSelection(makeCapturingComponent(captured), {
      hierarchy: ['organization', 'building', 'residence'],
      checkResidenceAccess: true,
      title: RESIDENCE_TITLE,
      subtitle: RESIDENCE_SUBTITLE,
      onResidenceSelect: (residenceId) => `/residents/residences/${residenceId}/documents`,
    });

    renderWithClient(<Wrapped />);

    // The HOC must auto-forward straight to the residence-documents page.
    await waitFor(
      () => {
        expect(mockSetLocation).toHaveBeenCalledWith(
          `/residents/residences/${RES_SINGLE.id}/documents`,
        );
      },
      { timeout: 8000 },
    );

    // No flat picker, no admin org picker, and the wrapped residence-page
    // body never renders (the user is forwarded before it shows).
    expect(screen.queryByTestId('selection-grid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wrapped')).not.toBeInTheDocument();

    // Header on the brief skeleton placeholder uses the residence title
    // — never the generic "buildingManagement / selectOrganization" leak.
    expect(screen.getByTestId('header-title')).toHaveTextContent(RESIDENCE_TITLE.en);
    expect(screen.getByTestId('header-subtitle')).toHaveTextContent(RESIDENCE_SUBTITLE.en);
    expect(screen.getByTestId('header-title')).not.toHaveTextContent('buildingManagement');
    expect(screen.getByTestId('header-subtitle')).not.toHaveTextContent('selectOrganization');
  });

  test('multiple residence links: shows flat "Building · Unit X" picker; selecting navigates to residence-documents', async () => {
    setupFetchMock([RES_BLD_A, RES_BLD_B]);

    const captured: { props: CapturedProps | null } = { props: null };
    const Wrapped = withHierarchicalSelection(makeCapturingComponent(captured), {
      hierarchy: ['organization', 'building', 'residence'],
      checkResidenceAccess: true,
      title: RESIDENCE_TITLE,
      subtitle: RESIDENCE_SUBTITLE,
      onResidenceSelect: (residenceId) => `/residents/residences/${residenceId}/documents`,
    });

    renderWithClient(<Wrapped />);

    // Both residences are listed individually (the picker keys by residence
    // id, not by building) so two units in two different buildings each
    // produce one entry labelled "<buildingName> · unit <unitNumber>".
    await waitFor(() => {
      expect(screen.getByTestId(`grid-item-${RES_BLD_A.id}`)).toBeInTheDocument();
    });
    expect(screen.getByTestId(`grid-item-${RES_BLD_A.id}`)).toHaveTextContent(
      `${RES_BLD_A.buildingName} · unit ${RES_BLD_A.unitNumber}`,
    );
    expect(screen.getByTestId(`grid-item-${RES_BLD_B.id}`)).toHaveTextContent(
      `${RES_BLD_B.buildingName} · unit ${RES_BLD_B.unitNumber}`,
    );

    // Header on the picker uses the configured residence title/subtitle —
    // no leak of the generic admin wrapper header.
    expect(screen.getByTestId('header-title')).toHaveTextContent(RESIDENCE_TITLE.en);
    expect(screen.getByTestId('header-subtitle')).toHaveTextContent(RESIDENCE_SUBTITLE.en);
    expect(screen.getByTestId('header-title')).not.toHaveTextContent('buildingManagement');
    expect(screen.getByTestId('header-subtitle')).not.toHaveTextContent('selectOrganization');

    // No auto-forward happened (user has multiple links, must pick).
    expect(mockSetLocation).not.toHaveBeenCalled();

    // Picking a residence navigates straight to its documents page.
    fireEvent.click(screen.getByTestId(`grid-item-${RES_BLD_B.id}`));
    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith(
        `/residents/residences/${RES_BLD_B.id}/documents`,
      );
    });

    // The wrapped residence-cards page is never rendered — the picker is a
    // direct hand-off to the documents route.
    expect(screen.queryByTestId('wrapped')).not.toBeInTheDocument();
  });

  test('manager flow unchanged: org → building → residence picker still runs (residentScope is ignored for non-residents)', async () => {
    mockUserRole = 'manager';
    setupFetchMock([]);

    const captured: { props: CapturedProps | null } = { props: null };
    const Wrapped = withHierarchicalSelection(makeCapturingComponent(captured), {
      hierarchy: ['organization', 'building', 'residence'],
      checkResidenceAccess: true,
      title: RESIDENCE_TITLE,
      subtitle: RESIDENCE_SUBTITLE,
      onResidenceSelect: (residenceId) => `/residents/residences/${residenceId}/documents`,
    });

    renderWithClient(<Wrapped />);

    // Manager goes through the org/building picker — residentScope is a
    // no-op for non-resident roles. With a single accessible org, the HOC
    // auto-forwards to the building step by writing `organization=<id>`.
    await waitFor(
      () => {
        expect(mockSetLocation).toHaveBeenCalledWith(
          expect.stringContaining(`organization=${ORG.id}`),
        );
      },
      { timeout: 8000 },
    );

    // The residence-documents URL must not be hit for managers.
    expect(mockSetLocation).not.toHaveBeenCalledWith(
      expect.stringContaining('/residents/residences/'),
    );

    // Manager-side header still uses the configured title (the W13 leak
    // protection is shared with the admin path).
    expect(screen.getByTestId('header-title')).toHaveTextContent(RESIDENCE_TITLE.en);
  });
});
