/**
 * Task #532 — Frontend coverage for combining the manager-only AND
 * linked-only filter checkboxes in `ModularDocumentPageWrapper`.
 *
 * Each checkbox already has its own focused unit suite:
 *   - tests/unit/components/modular-document-page-manager-only-filter.test.tsx
 *   - tests/unit/components/modular-document-page-linked-only-filter.test.tsx
 *
 * What was missing was a guard that flips BOTH at the same time. The
 * wrapper merges them into a single React-Query queryKey at line ~527
 * of `client/src/components/common/ModularDocumentPageWrapper.tsx`:
 *
 *   queryKey: ['/api/documents', type, entityId,
 *              { isManagerOnly: showOnlyManagerOnly, hasLinks: showOnlyLinked }]
 *
 * and translates them into TWO query params on the URL (~lines 530-536).
 * A regression that drops one filter from the queryKey or from the URL
 * would silently let one filter clobber the other. The two checkboxes
 * are rendered ~lines 1097-1130; the manager-only one is gated to
 * privileged roles, while the linked-only one is shown to everyone, so
 * we drive the combined toggle as a manager.
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
  isManagerOnly: boolean;
  hasLinks: boolean;
}

// Four-cell matrix — every combination of (isManagerOnly, hasLinks),
// plus a second mgr-only-AND-linked row to prove the combined filter
// returns ALL members of the intersection rather than just one.
const ALL_DOCS: DocFixture[] = [
  {
    id: 'doc-mgr-linked-1',
    name: 'Manager-only Linked Bylaw',
    isManagerOnly: true,
    hasLinks: true,
  },
  {
    id: 'doc-mgr-linked-2',
    name: 'Manager-only Linked Audit',
    isManagerOnly: true,
    hasLinks: true,
  },
  {
    id: 'doc-mgr-unlinked',
    name: 'Manager-only Standalone',
    isManagerOnly: true,
    hasLinks: false,
  },
  {
    id: 'doc-normal-linked',
    name: 'Public Linked Notice',
    isManagerOnly: false,
    hasLinks: true,
  },
  {
    id: 'doc-normal-unlinked',
    name: 'Public Standalone Notice',
    isManagerOnly: false,
    hasLinks: false,
  },
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
      // Mirror the production route so the test never accidentally
      // certifies a UI bug by serving the wrong fixture: when both
      // filters are on the wire, the listing endpoint returns only
      // documents that are BOTH manager-only AND linked. Each filter
      // also works independently. Non-manager roles cannot leverage
      // the manager-only filter to surface restricted docs.
      const wantsManagerOnly = params.get('isManagerOnly') === 'true';
      const wantsLinkedOnly = params.get('hasLinks') === 'true';
      const isPrivileged =
        currentRole === 'admin' ||
        currentRole === 'manager' ||
        currentRole === 'demo_manager';

      let filtered = [...ALL_DOCS];
      if (!isPrivileged) {
        // Non-manager roles never see manager-only docs at all, and
        // passing isManagerOnly=true gives them the empty set.
        filtered = filtered.filter((d) => !d.isManagerOnly);
        if (wantsManagerOnly) filtered = [];
      } else if (wantsManagerOnly) {
        filtered = filtered.filter((d) => d.isManagerOnly);
      }
      if (wantsLinkedOnly) {
        filtered = filtered.filter((d) => d.hasLinks);
      }

      return buildJsonResponse({
        documents: filtered.map((d) => ({
          ...d,
          documentType: 'legal',
          category: 'legal',
          uploadedAt: '2024-01-15T00:00:00.000Z',
          createdAt: '2024-01-15T00:00:00.000Z',
          effectiveDate: '2024-01-15T00:00:00.000Z',
          isVisibleToTenants: !d.isManagerOnly,
          tags: [],
          // Match the wire shape of the real endpoint: linked docs get
          // a populated link summary, unlinked ones explicitly get
          // `links: null`.
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

function renderWrapper(
  role: string,
  type: 'building' | 'residence' = 'building',
) {
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

describe('ModularDocumentPageWrapper — manager-only + linked-only combined filter (Task #532)', () => {
  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockClear();
    mockToast.mockClear();
    wouter.__resetMocks();
    // Task #326 — the wrapper mirrors filters into the URL, so reset
    // the shared jsdom location between tests to avoid leaking filter
    // state from a previous case into the next render.
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/');
    }
  });

  afterEach(() => {
    cleanup();
    if (originalFetch) {
      global.fetch = originalFetch;
    }
  });

  it('manager: toggling BOTH checkboxes refetches with both query params and renders the intersection (building scope)', async () => {
    renderWrapper('manager', 'building');

    // Wait for both checkboxes to render and the baseline (every doc)
    // to come through, otherwise a stray initial render-cycle could
    // fire the toggle before the wrapper has wired its query.
    await waitFor(() => {
      expect(
        screen.getByTestId('checkbox-filter-manager-only'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('checkbox-filter-has-links'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('doc-title-doc-mgr-linked-1'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('doc-title-doc-mgr-linked-2'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('doc-title-doc-mgr-unlinked'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('doc-title-doc-normal-linked'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('doc-title-doc-normal-unlinked'),
      ).toBeInTheDocument();
    });

    fetchMock.mockClear();

    // Flip both filters. The order matters because each toggle
    // invalidates the queryKey — if the wrapper accidentally dropped
    // one filter from the key the second toggle would still pass an
    // assertion that only inspects the FINAL request.
    fireEvent.click(screen.getByTestId('checkbox-filter-manager-only'));
    fireEvent.click(screen.getByTestId('checkbox-filter-has-links'));

    // Once both are on, every refetch the wrapper triggers MUST send
    // BOTH params on the wire and preserve the building scope.
    await waitFor(() => {
      const docCalls = fetchMock.mock.calls
        .map(([url]) => String(url))
        .filter((u) => u.startsWith('/api/documents?'));
      expect(docCalls.length).toBeGreaterThan(0);
      // At least one call has both filters on simultaneously.
      const combined = docCalls.filter(
        (u) => u.includes('isManagerOnly=true') && u.includes('hasLinks=true'),
      );
      expect(combined.length).toBeGreaterThan(0);
      // None of the combined-filter calls drops the building scope.
      expect(
        combined.every((u) => u.includes(`buildingId=${ENTITY_ID}`)),
      ).toBe(true);
    });

    // The rendered list must collapse to the intersection — both
    // mgr-only-AND-linked rows survive, every other fixture is gone.
    await waitFor(() => {
      expect(
        screen.getByTestId('doc-title-doc-mgr-linked-1'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('doc-title-doc-mgr-linked-2'),
      ).toBeInTheDocument();
      // Manager-only but NOT linked → dropped by the linked filter.
      expect(
        screen.queryByTestId('doc-title-doc-mgr-unlinked'),
      ).not.toBeInTheDocument();
      // Linked but NOT manager-only → dropped by the manager-only filter.
      expect(
        screen.queryByTestId('doc-title-doc-normal-linked'),
      ).not.toBeInTheDocument();
      // Neither → dropped by both filters.
      expect(
        screen.queryByTestId('doc-title-doc-normal-unlinked'),
      ).not.toBeInTheDocument();
    });
  }, 10000);

  it('manager: untoggling only the linked filter keeps isManagerOnly active and brings the unlinked mgr-only doc back', async () => {
    renderWrapper('manager', 'building');

    await waitFor(() => {
      expect(
        screen.getByTestId('checkbox-filter-manager-only'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('checkbox-filter-has-links'),
      ).toBeInTheDocument();
    });

    const mgrCheckbox = screen.getByTestId('checkbox-filter-manager-only');
    const linksCheckbox = screen.getByTestId('checkbox-filter-has-links');

    // Turn both filters on, wait for the intersection to render.
    fireEvent.click(mgrCheckbox);
    fireEvent.click(linksCheckbox);
    await waitFor(() => {
      expect(
        screen.queryByTestId('doc-title-doc-mgr-unlinked'),
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId('doc-title-doc-mgr-linked-1'),
      ).toBeInTheDocument();
    });

    fetchMock.mockClear();

    // Untoggle ONLY the linked-only filter.
    fireEvent.click(linksCheckbox);

    // Every post-untoggle call must keep isManagerOnly=true (regression
    // guard: the queryKey object must not be replaced wholesale and
    // wipe out the manager-only filter) AND must NOT carry hasLinks.
    await waitFor(() => {
      const calls = fetchMock.mock.calls
        .map(([url]) => String(url))
        .filter((u) => u.startsWith('/api/documents?'));
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.every((u) => u.includes('isManagerOnly=true'))).toBe(true);
      expect(calls.every((u) => !u.includes('hasLinks=true'))).toBe(true);
      expect(calls.every((u) => u.includes(`buildingId=${ENTITY_ID}`))).toBe(
        true,
      );
    });

    // The unlinked mgr-only doc reappears, the non-mgr-only docs stay
    // hidden because isManagerOnly is still on.
    await waitFor(() => {
      expect(
        screen.getByTestId('doc-title-doc-mgr-linked-1'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('doc-title-doc-mgr-linked-2'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('doc-title-doc-mgr-unlinked'),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('doc-title-doc-normal-linked'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('doc-title-doc-normal-unlinked'),
      ).not.toBeInTheDocument();
    });
  }, 10000);

  it('manager: combined filter on a residence page sends residenceId (not buildingId)', async () => {
    renderWrapper('manager', 'residence');

    await waitFor(() => {
      expect(
        screen.getByTestId('checkbox-filter-manager-only'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('checkbox-filter-has-links'),
      ).toBeInTheDocument();
    });

    fetchMock.mockClear();

    fireEvent.click(screen.getByTestId('checkbox-filter-manager-only'));
    fireEvent.click(screen.getByTestId('checkbox-filter-has-links'));

    await waitFor(() => {
      const docCalls = fetchMock.mock.calls
        .map(([url]) => String(url))
        .filter((u) => u.startsWith('/api/documents?'));
      expect(docCalls.length).toBeGreaterThan(0);
      const combined = docCalls.filter(
        (u) => u.includes('isManagerOnly=true') && u.includes('hasLinks=true'),
      );
      expect(combined.length).toBeGreaterThan(0);
      // Residence pages must keep residenceId — never silently swap
      // it for buildingId when filters are combined.
      expect(
        combined.every((u) => u.includes(`residenceId=${ENTITY_ID}`)),
      ).toBe(true);
      expect(combined.every((u) => !u.includes('buildingId='))).toBe(true);
    });

    // Same intersection guarantees as the building-scope test.
    await waitFor(() => {
      expect(
        screen.getByTestId('doc-title-doc-mgr-linked-1'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('doc-title-doc-mgr-linked-2'),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('doc-title-doc-mgr-unlinked'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('doc-title-doc-normal-linked'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('doc-title-doc-normal-unlinked'),
      ).not.toBeInTheDocument();
    });
  }, 10000);
});
