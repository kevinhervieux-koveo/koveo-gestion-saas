/**
 * Task #502 — Frontend coverage for the "show only linked documents"
 * checkbox in `ModularDocumentPageWrapper`.
 *
 * The toggle (`data-testid="checkbox-filter-has-links"`, around line
 * 1057 of `client/src/components/common/ModularDocumentPageWrapper.tsx`)
 * is a sibling of the manager-only filter covered by Task #327. When
 * flipped it must:
 *   - flip the React-Query queryKey object (queryKey at line 467
 *     carries `{ isManagerOnly, hasLinks }`) so React Query refetches
 *     instead of serving the stale cache,
 *   - send `?hasLinks=true` to GET /api/documents while preserving
 *     the building/residence scope param,
 *   - and visibly hide rows whose `hasLinks === false`.
 *
 * Mirrors the structure of
 * `tests/unit/components/modular-document-page-manager-only-filter.test.tsx`.
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

const ENTITY_ID = 'building-fixture-id';

interface DocFixture {
  id: string;
  name: string;
  hasLinks: boolean;
}

// Three linked documents and two unlinked controls. The linked rows
// carry a non-null `links` summary so the wrapper has no reason to
// silently drop them; the unlinked rows have `links: null`.
const ALL_DOCS: DocFixture[] = [
  { id: 'doc-linked-1', name: 'Linked Sequence Part 1', hasLinks: true },
  { id: 'doc-linked-2', name: 'Linked Sequence Part 2', hasLinks: true },
  { id: 'doc-linked-3', name: 'Linked Sequence Part 3', hasLinks: true },
  { id: 'doc-unlinked-1', name: 'Standalone Notice', hasLinks: false },
  { id: 'doc-unlinked-2', name: 'Lone Memo', hasLinks: false },
];

let currentRole: string;

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
        role: currentRole,
      });
    }

    if (pathname === `/api/manager/buildings/${ENTITY_ID}`) {
      return buildJsonResponse({ id: ENTITY_ID, name: 'Test Building' });
    }
    if (pathname === `/api/residences/${ENTITY_ID}`) {
      return buildJsonResponse({ id: ENTITY_ID, name: 'Test Residence' });
    }

    if (pathname === '/api/documents') {
      // Mirror the production route: when `hasLinks=true` is on the
      // wire, the listing endpoint returns only documents whose
      // `hasLinks` is true. Without the param it returns everything.
      const wantsLinkedOnly = params.get('hasLinks') === 'true';
      const filtered = wantsLinkedOnly
        ? ALL_DOCS.filter((d) => d.hasLinks)
        : [...ALL_DOCS];

      return buildJsonResponse({
        documents: filtered.map((d) => ({
          ...d,
          documentType: 'legal',
          category: 'legal',
          uploadedAt: '2024-01-15T00:00:00.000Z',
          createdAt: '2024-01-15T00:00:00.000Z',
          effectiveDate: '2024-01-15T00:00:00.000Z',
          isVisibleToTenants: true,
          isManagerOnly: false,
          tags: [],
          // Match the wire shape of the real endpoint: linked docs
          // get a populated link summary, unlinked ones explicitly
          // get `links: null`.
          links: d.hasLinks
            ? { previous: { id: 'neighbor', name: 'Neighbor' } }
            : null,
        })),
        total: filtered.length,
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

function renderWrapper(role: string, type: 'building' | 'residence' = 'building') {
  currentRole = role;
  wouter.__setLocation('/');
  wouter.__setParams({ id: ENTITY_ID });

  const userRole: 'manager' | 'resident' =
    role === 'admin' || role === 'manager' || role === 'demo_manager'
      ? 'manager'
      : 'resident';

  const qc = makeQueryClient();
  const utils = render(
    <QueryClientProvider client={qc}>
      <ModularDocumentPageWrapper
        type={type}
        userRole={userRole}
        backPath="/back"
        entityIdParam="id"
      />
    </QueryClientProvider>,
  );
  return { qc, ...utils };
}

describe('ModularDocumentPageWrapper — linked-only filter checkbox (Task #502)', () => {
  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockClear();
    mockToast.mockClear();
    wouter.__resetMocks();
  });

  afterEach(() => {
    cleanup();
    if (originalFetch) {
      global.fetch = originalFetch;
    }
  });

  // Unlike the manager-only checkbox the linked-only checkbox is NOT
  // gated on role — it's available to every user that can see the
  // documents page. Verify it renders for each commonly-used role.
  it.each([
    ['admin'],
    ['manager'],
    ['demo_manager'],
    ['resident'],
    ['demo_resident'],
    ['tenant'],
    ['demo_tenant'],
  ])('role=%s → linked-only checkbox is rendered', async (role) => {
    renderWrapper(role);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).startsWith('/api/documents?'),
        ),
      ).toBe(true);
    });

    await waitFor(
      () => {
        expect(
          screen.getByTestId('checkbox-filter-has-links'),
        ).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  }, 10000);

  it('initial fetch omits hasLinks and the list shows every document', async () => {
    renderWrapper('manager');

    await waitFor(() => {
      expect(screen.getByTestId('doc-title-doc-linked-1')).toBeInTheDocument();
      expect(screen.getByTestId('doc-title-doc-linked-2')).toBeInTheDocument();
      expect(screen.getByTestId('doc-title-doc-linked-3')).toBeInTheDocument();
      expect(screen.getByTestId('doc-title-doc-unlinked-1')).toBeInTheDocument();
      expect(screen.getByTestId('doc-title-doc-unlinked-2')).toBeInTheDocument();
    });

    const docCalls = fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((u) => u.startsWith('/api/documents?'));
    expect(docCalls.length).toBeGreaterThan(0);
    // No call may carry the linked-only filter — the checkbox is
    // initially unchecked.
    expect(docCalls.every((u) => !u.includes('hasLinks=true'))).toBe(true);
    // And every initial call must still preserve the building scope.
    expect(docCalls.every((u) => u.includes(`buildingId=${ENTITY_ID}`))).toBe(
      true,
    );
  }, 10000);

  it('toggling the checkbox refetches with hasLinks=true and hides unlinked docs (building scope)', async () => {
    renderWrapper('manager', 'building');

    await waitFor(() => {
      expect(
        screen.getByTestId('checkbox-filter-has-links'),
      ).toBeInTheDocument();
      expect(screen.getByTestId('doc-title-doc-unlinked-1')).toBeInTheDocument();
    });

    fetchMock.mockClear();

    fireEvent.click(screen.getByTestId('checkbox-filter-has-links'));

    await waitFor(() => {
      const filteredCalls = fetchMock.mock.calls
        .map(([url]) => String(url))
        .filter((u) => u.startsWith('/api/documents?'));
      expect(filteredCalls.length).toBeGreaterThan(0);
      // The post-toggle refetch must carry hasLinks=true.
      expect(filteredCalls.some((u) => u.includes('hasLinks=true'))).toBe(true);
      // And every post-toggle call must still preserve the building
      // scope param so the checkbox doesn't accidentally widen the
      // query to the user's full org.
      expect(
        filteredCalls.every((u) => u.includes(`buildingId=${ENTITY_ID}`)),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByTestId('doc-title-doc-linked-1')).toBeInTheDocument();
      expect(screen.getByTestId('doc-title-doc-linked-2')).toBeInTheDocument();
      expect(screen.getByTestId('doc-title-doc-linked-3')).toBeInTheDocument();
      expect(
        screen.queryByTestId('doc-title-doc-unlinked-1'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('doc-title-doc-unlinked-2'),
      ).not.toBeInTheDocument();
    });
  }, 10000);

  it('residence scope: toggling the checkbox preserves residenceId in the refetch', async () => {
    renderWrapper('resident', 'residence');

    await waitFor(() => {
      expect(
        screen.getByTestId('checkbox-filter-has-links'),
      ).toBeInTheDocument();
      expect(screen.getByTestId('doc-title-doc-unlinked-1')).toBeInTheDocument();
    });

    fetchMock.mockClear();

    fireEvent.click(screen.getByTestId('checkbox-filter-has-links'));

    await waitFor(() => {
      const filteredCalls = fetchMock.mock.calls
        .map(([url]) => String(url))
        .filter((u) => u.startsWith('/api/documents?'));
      expect(filteredCalls.length).toBeGreaterThan(0);
      expect(filteredCalls.some((u) => u.includes('hasLinks=true'))).toBe(true);
      // Residence pages must keep residenceId — never silently swap
      // it for buildingId.
      expect(
        filteredCalls.every((u) => u.includes(`residenceId=${ENTITY_ID}`)),
      ).toBe(true);
      expect(filteredCalls.every((u) => !u.includes('buildingId='))).toBe(true);
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId('doc-title-doc-unlinked-1'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('doc-title-doc-unlinked-2'),
      ).not.toBeInTheDocument();
    });
  }, 10000);

  it('untoggling the checkbox refetches without the filter and restores all docs', async () => {
    renderWrapper('manager');

    await waitFor(() => {
      expect(
        screen.getByTestId('checkbox-filter-has-links'),
      ).toBeInTheDocument();
    });

    const checkbox = screen.getByTestId('checkbox-filter-has-links');
    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(
        screen.queryByTestId('doc-title-doc-unlinked-1'),
      ).not.toBeInTheDocument();
    });

    fetchMock.mockClear();

    fireEvent.click(checkbox);

    await waitFor(() => {
      const calls = fetchMock.mock.calls
        .map(([url]) => String(url))
        .filter((u) => u.startsWith('/api/documents?'));
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.every((u) => !u.includes('hasLinks=true'))).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByTestId('doc-title-doc-unlinked-1')).toBeInTheDocument();
      expect(screen.getByTestId('doc-title-doc-unlinked-2')).toBeInTheDocument();
      expect(screen.getByTestId('doc-title-doc-linked-1')).toBeInTheDocument();
    });
  }, 10000);
});
