/**
 * Task #327 — Frontend coverage for the manager-only filter checkbox
 * added in Task #322. The toggle is rendered only for manager-class
 * roles and, when flipped, must refetch with `?isManagerOnly=true`.
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
    isManagerOnly,
  }: {
    documentId: string;
    title: string;
    isManagerOnly?: boolean;
  }) => (
    <div data-testid={`mock-document-card-${documentId}`}>
      <span data-testid={`doc-title-${documentId}`}>{title}</span>
      <span data-testid={`doc-mgronly-${documentId}`}>
        {isManagerOnly ? 'mgr-only' : 'normal'}
      </span>
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
}

const ALL_DOCS: DocFixture[] = [
  { id: 'doc-mgr-only-1', name: 'Manager-only Bylaw', isManagerOnly: true },
  { id: 'doc-mgr-only-2', name: 'Confidential Audit', isManagerOnly: true },
  { id: 'doc-normal-1', name: 'Public Notice', isManagerOnly: false },
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

    if (pathname === '/api/documents') {
      // Mirror the production route's role gating so the test never
      // accidentally certifies a UI bug by serving the wrong fixture.
      const wantsManagerOnly = params.get('isManagerOnly') === 'true';
      const isPrivileged =
        currentRole === 'admin' ||
        currentRole === 'manager' ||
        currentRole === 'demo_manager';

      let filtered: DocFixture[];
      if (!isPrivileged) {
        filtered = ALL_DOCS.filter((d) => !d.isManagerOnly);
        if (wantsManagerOnly) filtered = [];
      } else if (wantsManagerOnly) {
        filtered = ALL_DOCS.filter((d) => d.isManagerOnly);
      } else {
        filtered = [...ALL_DOCS];
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
          links: null,
          hasLinks: false,
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

describe('ModularDocumentPageWrapper — manager-only filter checkbox (Task #327)', () => {
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

  it.each([
    ['admin', true],
    ['manager', true],
    ['demo_manager', true],
    ['resident', false],
    ['demo_resident', false],
    ['tenant', false],
    ['demo_tenant', false],
  ])(
    'role=%s → checkbox %s rendered',
    async (role, shouldExist) => {
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
          const checkbox = screen.queryByTestId('checkbox-filter-manager-only');
          if (shouldExist) {
            expect(checkbox).toBeInTheDocument();
          } else {
            expect(checkbox).not.toBeInTheDocument();
          }
        },
        { timeout: 2000 },
      );
    },
    10000,
  );

  it('manager: initial fetch omits isManagerOnly and shows every document', async () => {
    renderWrapper('manager');

    await waitFor(() => {
      expect(screen.getByTestId('doc-title-doc-mgr-only-1')).toBeInTheDocument();
      expect(screen.getByTestId('doc-title-doc-mgr-only-2')).toBeInTheDocument();
      expect(screen.getByTestId('doc-title-doc-normal-1')).toBeInTheDocument();
    });

    const docCalls = fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((u) => u.startsWith('/api/documents?'));
    expect(docCalls.length).toBeGreaterThan(0);
    expect(docCalls.every((u) => !u.includes('isManagerOnly=true'))).toBe(true);
  }, 10000);

  it('manager: toggling the checkbox refetches with isManagerOnly=true and hides normal docs', async () => {
    renderWrapper('manager');

    await waitFor(() => {
      expect(screen.getByTestId('checkbox-filter-manager-only')).toBeInTheDocument();
      expect(screen.getByTestId('doc-title-doc-normal-1')).toBeInTheDocument();
    });

    fetchMock.mockClear();

    fireEvent.click(screen.getByTestId('checkbox-filter-manager-only'));

    await waitFor(() => {
      const filteredCalls = fetchMock.mock.calls
        .map(([url]) => String(url))
        .filter((u) => u.startsWith('/api/documents?'));
      expect(filteredCalls.length).toBeGreaterThan(0);
      expect(
        filteredCalls.some((u) => u.includes('isManagerOnly=true')),
      ).toBe(true);
      expect(filteredCalls.every((u) => u.includes(`buildingId=${ENTITY_ID}`))).toBe(
        true,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('doc-title-doc-mgr-only-1')).toBeInTheDocument();
      expect(screen.getByTestId('doc-title-doc-mgr-only-2')).toBeInTheDocument();
      expect(
        screen.queryByTestId('doc-title-doc-normal-1'),
      ).not.toBeInTheDocument();
    });
  }, 10000);

  it('manager: untoggling the checkbox refetches without the filter and restores all docs', async () => {
    renderWrapper('manager');

    await waitFor(() => {
      expect(screen.getByTestId('checkbox-filter-manager-only')).toBeInTheDocument();
    });

    const checkbox = screen.getByTestId('checkbox-filter-manager-only');
    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(
        screen.queryByTestId('doc-title-doc-normal-1'),
      ).not.toBeInTheDocument();
    });

    fetchMock.mockClear();

    fireEvent.click(checkbox);

    await waitFor(() => {
      const calls = fetchMock.mock.calls
        .map(([url]) => String(url))
        .filter((u) => u.startsWith('/api/documents?'));
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.every((u) => !u.includes('isManagerOnly=true'))).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByTestId('doc-title-doc-normal-1')).toBeInTheDocument();
      expect(screen.getByTestId('doc-title-doc-mgr-only-1')).toBeInTheDocument();
    });
  }, 10000);
});
