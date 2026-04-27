/**
 * Skipped-picker behavior tests for the residence and common-spaces flows (Task #1324).
 *
 * "Skipped-picker" means that when the user has exactly one option at a given
 * step (one residence link, one building), the picker UI is never shown — the
 * HOC auto-selects the only option and forwards the user directly.
 *
 * Flows covered:
 *  1. Residence flow (withHierarchicalSelection with residentScope + onResidenceSelect):
 *       single link  → picker skipped, user auto-forwarded to residence-documents.
 *       multi links  → picker shown; selecting navigates to residence-documents.
 *  2. Common-spaces flow (withHierarchicalSelection with residentScope, building-level):
 *       single building → picker skipped, wrapped page rendered with buildingId injected.
 *       multi buildings → picker shown; selecting a building writes ?building=<id>.
 *  3. Residence error state: when the units endpoint fails, an error UI with a
 *     retry button is shown instead of an empty list (manager flow, residence level).
 *
 * These tests use the real HOC wired with mocked fetch so the business logic
 * paths are exercised end-to-end without a running server.
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
    <div data-testid='selection-grid'>
      {isLoading && <div data-testid='loading-spinner'>loading</div>}
      {items.map((i) => (
        <button key={i.id} data-testid={`grid-item-${i.id}`} onClick={() => onSelectItem(i.id)}>
          {i.name}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@/components/common/SearchableSelectionGrid', () => ({
  SearchableSelectionGrid: ({
    items,
    onSelectItem,
    isLoading,
  }: {
    items: Array<{ id: string; name: string; details?: string }>;
    onSelectItem: (id: string) => void;
    isLoading?: boolean;
  }) => (
    <div data-testid='searchable-selection-grid'>
      {isLoading && <div data-testid='loading-spinner'>loading</div>}
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
    <header data-testid='page-header'>
      <span data-testid='header-title'>{title}</span>
      <span data-testid='header-subtitle'>{subtitle}</span>
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
}

function makeCapturingComponent(captured: { props: CapturedProps | null }) {
  return function Capturing(props: CapturedProps) {
    captured.props = props;
    return (
      <div data-testid='wrapped'>
        <span data-testid='wrapped-building-id'>{props.buildingId ?? ''}</span>
        <span data-testid='wrapped-building-name'>{props.buildingName ?? ''}</span>
        <span data-testid='wrapped-residence-id'>{props.residenceId ?? ''}</span>
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

function setupFetchMock(
  residences: Array<typeof RES_SINGLE>,
  opts: { residencesError?: boolean } = {},
) {
  const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    // Note: check /residences routes BEFORE the general /buildings/ check because
    // /api/buildings/<id>/residences contains "/buildings/" and would match early.

    if (url.startsWith('/api/users/me/residences')) {
      return {
        ok: true,
        status: 200,
        json: async () => residences,
        text: async () => JSON.stringify(residences),
      } as unknown as Response;
    }
    if (url.includes('/residences') && opts.residencesError) {
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' }),
        text: async () => 'Internal Server Error',
      } as unknown as Response;
    }
    if (url.includes('/residences')) {
      const res = residences.filter((r) => url.includes(r.buildingId));
      return {
        ok: true,
        status: 200,
        json: async () => res,
        text: async () => JSON.stringify(res),
      } as unknown as Response;
    }
    if (url.startsWith('/api/users/me/organizations')) {
      return {
        ok: true,
        status: 200,
        json: async () => [ORG],
        text: async () => JSON.stringify([ORG]),
      } as unknown as Response;
    }
    if (url.startsWith('/api/organizations/accessible-building-counts')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ [ORG.id]: 1 }),
        text: async () => JSON.stringify({ [ORG.id]: 1 }),
      } as unknown as Response;
    }
    if (url.startsWith('/api/users/me/buildings') || url.includes('/buildings')) {
      return {
        ok: true,
        status: 200,
        json: async () => [MGR_BUILDING],
        text: async () => JSON.stringify([MGR_BUILDING]),
      } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => [],
      text: async () => '[]',
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

const RESIDENCE_CONFIG = {
  hierarchy: ['organization', 'building', 'residence'] as const,
  checkResidenceAccess: true as const,
  residentScope: true as const,
  title: { en: 'My Residence', fr: 'Ma résidence' },
  subtitle: {
    en: 'View your residence information',
    fr: 'Voir les informations de votre résidence',
  },
  onResidenceSelect: (residenceId: string) => `/residents/residences/${residenceId}/documents`,
};

const COMMON_SPACES_CONFIG = {
  hierarchy: ['organization', 'building'] as const,
  residentScope: true as const,
  title: { en: 'Common Spaces', fr: 'Espaces Communs' },
  subtitle: { en: 'Book your common spaces', fr: 'Réservez vos espaces communs' },
};

describe('Skipped-picker — residence flow (resident with single residence link)', () => {
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

  test('single residence → picker skipped, user auto-forwarded to residence-documents', async () => {
    setupFetchMock([RES_SINGLE]);

    const captured: { props: CapturedProps | null } = { props: null };
    const Wrapped = withHierarchicalSelection(makeCapturingComponent(captured), RESIDENCE_CONFIG);

    renderWithClient(<Wrapped />);

    await waitFor(
      () => {
        expect(mockSetLocation).toHaveBeenCalledWith(
          `/residents/residences/${RES_SINGLE.id}/documents`,
        );
      },
      { timeout: 8000 },
    );

    expect(screen.queryByTestId('selection-grid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('searchable-selection-grid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wrapped')).not.toBeInTheDocument();
  });

  test('no picker rendered during auto-forward: header uses configured title (no admin-header leak)', async () => {
    setupFetchMock([RES_SINGLE]);

    const captured: { props: CapturedProps | null } = { props: null };
    const Wrapped = withHierarchicalSelection(makeCapturingComponent(captured), RESIDENCE_CONFIG);

    renderWithClient(<Wrapped />);

    await waitFor(
      () => {
        expect(mockSetLocation).toHaveBeenCalled();
      },
      { timeout: 8000 },
    );

    expect(screen.getByTestId('header-title')).toHaveTextContent('My Residence');
    expect(screen.getByTestId('header-title')).not.toHaveTextContent('buildingManagement');
    expect(screen.getByTestId('header-subtitle')).not.toHaveTextContent('selectOrganization');
  });

  test('multiple residences → flat picker shown, no auto-forward, selecting navigates to documents', async () => {
    setupFetchMock([RES_BLD_A, RES_BLD_B]);

    const captured: { props: CapturedProps | null } = { props: null };
    const Wrapped = withHierarchicalSelection(makeCapturingComponent(captured), RESIDENCE_CONFIG);

    renderWithClient(<Wrapped />);

    await waitFor(() => {
      expect(screen.getByTestId(`grid-item-${RES_BLD_A.id}`)).toBeInTheDocument();
    });

    expect(mockSetLocation).not.toHaveBeenCalled();
    expect(screen.queryByTestId('wrapped')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId(`grid-item-${RES_BLD_B.id}`));

    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith(
        `/residents/residences/${RES_BLD_B.id}/documents`,
      );
    });
  });
});

describe('Skipped-picker — common-spaces flow (resident with single building)', () => {
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

  test('single building → picker skipped, wrapped page renders with buildingId', async () => {
    setupFetchMock([RES_SINGLE]);

    const captured: { props: CapturedProps | null } = { props: null };
    const Wrapped = withHierarchicalSelection(
      makeCapturingComponent(captured),
      COMMON_SPACES_CONFIG,
    );

    renderWithClient(<Wrapped />);

    await waitFor(
      () => {
        expect(screen.getByTestId('wrapped')).toBeInTheDocument();
      },
      { timeout: 8000 },
    );

    expect(screen.getByTestId('wrapped-building-id')).toHaveTextContent(RES_SINGLE.buildingId);
    expect(screen.queryByTestId('selection-grid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('searchable-selection-grid')).not.toBeInTheDocument();
    expect(mockSetLocation).not.toHaveBeenCalled();
  });

  test('multiple buildings → searchable building picker shown; selecting writes ?building=<id>', async () => {
    setupFetchMock([RES_BLD_A, RES_BLD_B]);

    const captured: { props: CapturedProps | null } = { props: null };
    const Wrapped = withHierarchicalSelection(
      makeCapturingComponent(captured),
      COMMON_SPACES_CONFIG,
    );

    renderWithClient(<Wrapped />);

    await waitFor(() => {
      expect(
        screen.getByTestId(`grid-item-${RES_BLD_A.buildingId}`) ||
          screen.getByTestId(`grid-item-${RES_BLD_B.buildingId}`),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId(`grid-item-${RES_BLD_B.buildingId}`));

    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith(
        expect.stringContaining(`building=${RES_BLD_B.buildingId}`),
      );
    });
  });

  test('picker uses the configured Common Spaces title (no admin-header leak)', async () => {
    setupFetchMock([RES_BLD_A, RES_BLD_B]);

    const captured: { props: CapturedProps | null } = { props: null };
    const Wrapped = withHierarchicalSelection(
      makeCapturingComponent(captured),
      COMMON_SPACES_CONFIG,
    );

    renderWithClient(<Wrapped />);

    await waitFor(() => {
      expect(screen.getByTestId('header-title')).toHaveTextContent('Common Spaces');
    });

    expect(screen.getByTestId('header-title')).not.toHaveTextContent('buildingManagement');
  });
});

describe('Residence picker error state (manager flow, units fail to load)', () => {
  jest.setTimeout(15000);

  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    originalFetch = (global as unknown as { fetch?: typeof fetch }).fetch;
    mockSearch = '?organization=org-1&building=bld-mgr';
    mockSetLocation.mockClear();
    mockUserRole = 'manager';
  });

  afterEach(() => {
    if (originalFetch) {
      (global as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    }
    jest.clearAllMocks();
  });

  test('shows error state with retry button when the units endpoint fails', async () => {
    setupFetchMock([], { residencesError: true });

    const captured: { props: CapturedProps | null } = { props: null };
    const Wrapped = withHierarchicalSelection(makeCapturingComponent(captured), {
      hierarchy: ['organization', 'building', 'residence'],
    });

    renderWithClient(<Wrapped />);

    await waitFor(
      () => {
        expect(screen.getByTestId('residence-load-error')).toBeInTheDocument();
      },
      { timeout: 8000 },
    );

    expect(screen.getByTestId('button-retry-load-residences')).toBeInTheDocument();
    expect(screen.queryByTestId('wrapped')).not.toBeInTheDocument();
    expect(screen.queryByTestId('selection-grid')).not.toBeInTheDocument();
  });
});
