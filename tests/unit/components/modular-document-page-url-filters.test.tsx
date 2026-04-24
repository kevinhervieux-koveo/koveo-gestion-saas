/**
 * Task #326 — Persist document filters in the URL.
 *
 * The wrapper renders the document filter controls (search box, category,
 * year, month, manager-only toggle). On mount it must rehydrate state
 * from the URL search params, and on every change it must push the
 * active filters back into `window.location.search` (without a full
 * navigation) so reloads and shared links land on the same view.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => key,
    setLanguage: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-mobile-menu', () => ({
  useMobileMenu: () => ({ isOpen: false, toggle: jest.fn(), close: jest.fn() }),
}));

jest.mock('@/components/layout/header', () => ({
  Header: ({ title }: { title: string }) => (
    <div data-testid="mock-header">{title}</div>
  ),
}));

jest.mock('@/components/documents/DocumentLinkPickerDialog', () => ({
  DocumentLinkPickerDialog: () => null,
}));
jest.mock('@/components/common/DocumentInlineViewer', () => ({
  DocumentInlineViewer: () => null,
}));
jest.mock('@/components/document-management/DocumentCreateForm', () => ({
  DocumentCreateForm: () => null,
}));

jest.mock('@/components/document-tags/TagPicker', () => ({
  TagPicker: () => <div data-testid="mock-tag-picker" />,
  TagChips: () => null,
}));

jest.mock('@/components/document-management', () => ({
  __esModule: true,
  DocumentCard: ({
    documentId,
    title,
  }: {
    documentId: string;
    title: string;
  }) => (
    <div data-testid={`mock-document-card-${documentId}`}>
      <span data-testid={`doc-title-${documentId}`}>{title}</span>
    </div>
  ),
  SharedUploader: () => null,
  DocumentEditForm: () => null,
}));

jest.mock('@/lib/queryClient', () => {
  const actual = jest.requireActual('@/lib/queryClient') as Record<string, unknown>;
  return {
    ...actual,
    apiRequest: jest.fn(async (method: string, url: string, body?: unknown) => {
      return fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
      });
    }),
  };
});

import ModularDocumentPageWrapper from '@/components/common/ModularDocumentPageWrapper';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const wouter = require('wouter');

const BUILDING_ID = 'building-fixture-id';
const RESIDENCE_ID = 'residence-fixture-id';
// Backwards-compatible alias used by the building-variant tests below.
const ENTITY_ID = BUILDING_ID;

interface DocFixture {
  id: string;
  name: string;
  category: string;
  isManagerOnly: boolean;
  effectiveDate: string;
}

const ALL_DOCS: DocFixture[] = [
  {
    id: 'doc-legal-2025',
    name: 'Legal 2025',
    category: 'legal',
    isManagerOnly: true,
    effectiveDate: '2025-03-12T00:00:00.000Z',
  },
  {
    id: 'doc-legal-2024',
    name: 'Legal 2024',
    category: 'legal',
    isManagerOnly: false,
    effectiveDate: '2024-06-04T00:00:00.000Z',
  },
  {
    id: 'doc-financial-2025',
    name: 'Financial 2025',
    category: 'financial',
    isManagerOnly: false,
    effectiveDate: '2025-08-21T00:00:00.000Z',
  },
];

function buildJsonResponse(body: unknown): Response {
  const headers = new Headers({ 'content-type': 'application/json' });
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers,
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone() {
      return this as unknown as Response;
    },
  } as unknown as Response;
}

const fetchMock = jest.fn(
  async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    const method = (init?.method || 'GET').toUpperCase();
    const [pathname, query = ''] = url.split('?');
    const params = new URLSearchParams(query);

    if (method !== 'GET') {
      throw new Error(`Unexpected ${method} ${url} in test`);
    }

    if (pathname === '/api/auth/user') {
      return buildJsonResponse({
        id: 'user-fixture',
        email: 'fixture@example.com',
        role: 'manager',
      });
    }

    if (pathname === `/api/manager/buildings/${BUILDING_ID}`) {
      return buildJsonResponse({ id: BUILDING_ID, name: 'Test Building' });
    }

    if (pathname === `/api/residences/${RESIDENCE_ID}`) {
      return buildJsonResponse({ id: RESIDENCE_ID, name: 'Test Residence' });
    }

    if (pathname === '/api/documents') {
      const wantsManagerOnly = params.get('isManagerOnly') === 'true';
      const docs = wantsManagerOnly
        ? ALL_DOCS.filter((d) => d.isManagerOnly)
        : ALL_DOCS;
      return buildJsonResponse({
        documents: docs.map((d) => ({
          ...d,
          documentType: d.category,
          uploadedAt: d.effectiveDate,
          createdAt: d.effectiveDate,
          isVisibleToTenants: !d.isManagerOnly,
          tags: [],
          links: null,
          hasLinks: false,
        })),
        total: docs.length,
      });
    }

    throw new Error(`Unmocked request in test: ${method} ${url}`);
  },
) as unknown as jest.MockedFunction<typeof fetch>;

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: async ({ queryKey, signal }) => {
          const url = String(queryKey[0]);
          const res = await fetch(url, { credentials: 'include', signal });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} for ${url}`);
          }
          return res.json();
        },
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
    },
  });
}

function renderWrapper() {
  wouter.__setLocation('/manager/buildings/' + ENTITY_ID + '/documents');
  wouter.__setParams({ id: ENTITY_ID });

  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ModularDocumentPageWrapper
        type="building"
        userRole="manager"
        backPath="/back"
        entityIdParam="id"
      />
    </QueryClientProvider>,
  );
}

function renderResidenceWrapper() {
  wouter.__setLocation('/manager/residences/' + RESIDENCE_ID + '/documents');
  wouter.__setParams({ residenceId: RESIDENCE_ID });

  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ModularDocumentPageWrapper
        type="residence"
        userRole="manager"
        backPath="/back"
        entityIdParam="residenceId"
      />
    </QueryClientProvider>,
  );
}

describe('ModularDocumentPageWrapper — URL filter persistence (Task #326)', () => {
  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockClear();
    mockToast.mockClear();
    wouter.__resetMocks();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    cleanup();
    if (originalFetch) {
      global.fetch = originalFetch;
    }
    window.history.replaceState(null, '', '/');
  });

  it('rehydrates filter state from URL search params on mount', async () => {
    window.history.replaceState(
      null,
      '',
      '/?search=Legal&category=legal&year=2025&month=3&isManagerOnly=true',
    );

    renderWrapper();

    await waitFor(() => {
      expect(screen.getByTestId('input-search-documents')).toHaveValue('Legal');
      // The manager-only checkbox is gated on the user query resolving.
      expect(
        screen.getByTestId('checkbox-filter-manager-only'),
      ).toBeInTheDocument();
    });

    // Radix Checkbox renders a button with aria-checked / data-state.
    expect(
      screen.getByTestId('checkbox-filter-manager-only'),
    ).toHaveAttribute('aria-checked', 'true');

    // Only the matching document survives every active filter.
    await waitFor(() => {
      expect(screen.getByTestId('doc-title-doc-legal-2025')).toBeInTheDocument();
      expect(
        screen.queryByTestId('doc-title-doc-legal-2024'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('doc-title-doc-financial-2025'),
      ).not.toBeInTheDocument();
    });

    // Initial fetch must include the rehydrated `isManagerOnly=true`.
    const docCalls = fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((u) => u.startsWith('/api/documents?'));
    expect(docCalls.length).toBeGreaterThan(0);
    expect(docCalls.some((u) => u.includes('isManagerOnly=true'))).toBe(true);
  }, 10000);

  it('writes filter changes back into the URL with replaceState', async () => {
    renderWrapper();

    await waitFor(() => {
      expect(screen.getByTestId('input-search-documents')).toBeInTheDocument();
    });

    // Type into the search box.
    fireEvent.change(screen.getByTestId('input-search-documents'), {
      target: { value: 'Legal' },
    });

    await waitFor(() => {
      const sp = new URLSearchParams(window.location.search);
      expect(sp.get('search')).toBe('Legal');
    });

    // Toggle the manager-only checkbox.
    fireEvent.click(screen.getByTestId('checkbox-filter-manager-only'));

    await waitFor(() => {
      const sp = new URLSearchParams(window.location.search);
      expect(sp.get('isManagerOnly')).toBe('true');
      expect(sp.get('search')).toBe('Legal');
    });
  }, 10000);

  it('clears URL params when filters return to their defaults', async () => {
    window.history.replaceState(null, '', '/?search=Legal&isManagerOnly=true');
    renderWrapper();

    await waitFor(() => {
      expect(screen.getByTestId('input-search-documents')).toHaveValue('Legal');
    });

    fireEvent.click(screen.getByTestId('button-clear-filters'));

    await waitFor(() => {
      const sp = new URLSearchParams(window.location.search);
      expect(sp.get('search')).toBeNull();
      expect(sp.get('category')).toBeNull();
      expect(sp.get('year')).toBeNull();
      expect(sp.get('month')).toBeNull();
      expect(sp.get('isManagerOnly')).toBeNull();
    });
  }, 10000);

  it('preserves unrelated query params (such as the entity id) when syncing', async () => {
    window.history.replaceState(null, '', `/?buildingId=${ENTITY_ID}`);
    renderWrapper();

    await waitFor(() => {
      expect(screen.getByTestId('input-search-documents')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('input-search-documents'), {
      target: { value: 'invoices' },
    });

    await waitFor(() => {
      const sp = new URLSearchParams(window.location.search);
      expect(sp.get('search')).toBe('invoices');
      expect(sp.get('buildingId')).toBe(ENTITY_ID);
    });
  }, 10000);

  it('does not push browser history entries while filters change', async () => {
    renderWrapper();

    await waitFor(() => {
      expect(screen.getByTestId('input-search-documents')).toBeInTheDocument();
    });

    const startLength = window.history.length;

    fireEvent.change(screen.getByTestId('input-search-documents'), {
      target: { value: 'a' },
    });
    fireEvent.change(screen.getByTestId('input-search-documents'), {
      target: { value: 'ab' },
    });
    fireEvent.change(screen.getByTestId('input-search-documents'), {
      target: { value: 'abc' },
    });

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get('search')).toBe('abc');
    });

    expect(window.history.length).toBe(startLength);
  }, 10000);
});

/**
 * Task #531 — The residence variant of the wrapper hits a different entity
 * API path (`/api/residences/:id`) and a different documents-list parameter
 * (`residenceId` instead of `buildingId`). The URL-filter persistence wiring
 * lives in shared code, but a building-only test would silently miss
 * residence-side regressions, so we exercise the same round-trip on the
 * residence variant.
 */
describe('ModularDocumentPageWrapper — URL filter persistence on the residence variant (Task #531)', () => {
  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockClear();
    mockToast.mockClear();
    wouter.__resetMocks();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    cleanup();
    if (originalFetch) {
      global.fetch = originalFetch;
    }
    window.history.replaceState(null, '', '/');
  });

  it('rehydrates filter state from URL search params on mount', async () => {
    window.history.replaceState(
      null,
      '',
      '/?search=Legal&category=legal&year=2025&month=3&isManagerOnly=true',
    );

    renderResidenceWrapper();

    await waitFor(() => {
      expect(screen.getByTestId('input-search-documents')).toHaveValue('Legal');
      expect(
        screen.getByTestId('checkbox-filter-manager-only'),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByTestId('checkbox-filter-manager-only'),
    ).toHaveAttribute('aria-checked', 'true');

    await waitFor(() => {
      expect(screen.getByTestId('doc-title-doc-legal-2025')).toBeInTheDocument();
      expect(
        screen.queryByTestId('doc-title-doc-legal-2024'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('doc-title-doc-financial-2025'),
      ).not.toBeInTheDocument();
    });

    // The residence variant must request documents scoped by residenceId
    // and forward the rehydrated `isManagerOnly=true` filter.
    const docCalls = fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((u) => u.startsWith('/api/documents?'));
    expect(docCalls.length).toBeGreaterThan(0);
    expect(
      docCalls.some(
        (u) =>
          u.includes(`residenceId=${RESIDENCE_ID}`) &&
          u.includes('isManagerOnly=true'),
      ),
    ).toBe(true);
  }, 10000);

  it('writes filter changes back into the URL with replaceState', async () => {
    renderResidenceWrapper();

    await waitFor(() => {
      expect(screen.getByTestId('input-search-documents')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('input-search-documents'), {
      target: { value: 'Legal' },
    });

    await waitFor(() => {
      const sp = new URLSearchParams(window.location.search);
      expect(sp.get('search')).toBe('Legal');
    });

    // Toggle the manager-only checkbox (gated by `isManager`, which the
    // mocked `/api/auth/user` response satisfies).
    fireEvent.click(screen.getByTestId('checkbox-filter-manager-only'));

    await waitFor(() => {
      const sp = new URLSearchParams(window.location.search);
      expect(sp.get('isManagerOnly')).toBe('true');
      expect(sp.get('search')).toBe('Legal');
    });
  }, 10000);

  it('round-trips category, year and month through the URL', async () => {
    window.history.replaceState(
      null,
      '',
      '/?category=financial&year=2025&month=8',
    );

    renderResidenceWrapper();

    await waitFor(() => {
      // Only the financial-2025 document survives the rehydrated filters.
      expect(
        screen.getByTestId('doc-title-doc-financial-2025'),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('doc-title-doc-legal-2025'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('doc-title-doc-legal-2024'),
      ).not.toBeInTheDocument();
    });

    // Clearing should drop every filter param from the URL.
    fireEvent.click(screen.getByTestId('button-clear-filters'));

    await waitFor(() => {
      const sp = new URLSearchParams(window.location.search);
      expect(sp.get('search')).toBeNull();
      expect(sp.get('category')).toBeNull();
      expect(sp.get('year')).toBeNull();
      expect(sp.get('month')).toBeNull();
      expect(sp.get('isManagerOnly')).toBeNull();
    });
  }, 10000);

  it('preserves the residence-id query parameter when filters change', async () => {
    // Simulate a deep link that carries the residence id in the query
    // string (the wrapper accepts the entity id from either the path
    // params or the URL search params). This guards against a regression
    // where the URL-sync effect would clobber the residence id.
    window.history.replaceState(null, '', `/?residenceId=${RESIDENCE_ID}`);

    renderResidenceWrapper();

    await waitFor(() => {
      expect(screen.getByTestId('input-search-documents')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('input-search-documents'), {
      target: { value: 'invoices' },
    });

    await waitFor(() => {
      const sp = new URLSearchParams(window.location.search);
      expect(sp.get('search')).toBe('invoices');
      expect(sp.get('residenceId')).toBe(RESIDENCE_ID);
    });

    // Toggling the manager-only checkbox must also leave residenceId in place.
    fireEvent.click(screen.getByTestId('checkbox-filter-manager-only'));

    await waitFor(() => {
      const sp = new URLSearchParams(window.location.search);
      expect(sp.get('isManagerOnly')).toBe('true');
      expect(sp.get('residenceId')).toBe(RESIDENCE_ID);
      expect(sp.get('search')).toBe('invoices');
    });
  }, 10000);
});
