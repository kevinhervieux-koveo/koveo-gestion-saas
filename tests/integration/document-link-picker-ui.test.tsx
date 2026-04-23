/**
 * Task #403 — UI integration coverage for the document-linking flow.
 *
 * The unit suite (`tests/unit/components/document-inline-viewer.test.tsx`)
 * pins down the inline-viewer plumbing (iframe rendering, Download
 * button, etc.) but does not exercise the picker → backend → chip
 * refresh round trip. That gap is exactly where a regression in
 * `DocumentLinkPickerDialog` or the viewer's `useQuery` invalidation
 * would silently break the link UX. This test:
 *
 *   1. Mounts the real `DocumentInlineViewer` with the real
 *      `@tanstack/react-query` client used by the app.
 *   2. Stubs the network so `/neighbors`, `/links`,
 *      `/link-suggestions`, and `POST /links` are served by an
 *      in-memory fixture that updates as the user creates two links.
 *   3. Opens the picker for `before` and `after`, picks one suggestion
 *      each, and asserts that the chips visible on the viewer flip
 *      from the empty "Link previous / Link next" CTAs to the linked
 *      neighbor names — proving the mutation invalidates the
 *      neighbors query and the chips re-render with explicit links.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import React from 'react';

// -----------------------------------------------------------------------------
// Module-level mocks (must be declared before importing the SUT)
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// SUT imports — pulled in AFTER the jest.mock() calls above.
// -----------------------------------------------------------------------------

import { DocumentInlineViewer } from '@/components/common/DocumentInlineViewer';
import { queryClient } from '@/lib/queryClient';

// -----------------------------------------------------------------------------
// Mutable fixture — drives every fetch response and is mutated on POST.
// -----------------------------------------------------------------------------

interface LinkRow {
  id: string;
  fromDocumentId: string;
  toDocumentId: string;
  position: 'before' | 'after';
}

interface DocStub {
  id: string;
  name: string;
  documentType: string | null;
  effectiveDate: string | null;
  createdAt: string;
}

interface FixtureState {
  documentId: string;
  candidates: DocStub[];
  links: LinkRow[];
}

let fixture: FixtureState;

function makeDoc(id: string, name: string, dateIso: string): DocStub {
  return {
    id,
    name,
    documentType: 'legal',
    effectiveDate: dateIso,
    createdAt: dateIso,
  };
}

function neighborFromLinks(): {
  currentId: string;
  previous: { id: string; name: string; source: 'explicit'; effectiveDate: string | null; createdAt: string } | null;
  next: { id: string; name: string; source: 'explicit'; effectiveDate: string | null; createdAt: string } | null;
} {
  const prevLink = fixture.links.find(
    (l) => l.fromDocumentId === fixture.documentId && l.position === 'before',
  );
  const nextLink = fixture.links.find(
    (l) => l.fromDocumentId === fixture.documentId && l.position === 'after',
  );
  const docOf = (id: string | undefined) =>
    id ? fixture.candidates.find((c) => c.id === id) : undefined;
  const prevDoc = docOf(prevLink?.toDocumentId);
  const nextDoc = docOf(nextLink?.toDocumentId);
  return {
    currentId: fixture.documentId,
    previous: prevDoc
      ? {
          id: prevDoc.id,
          name: prevDoc.name,
          source: 'explicit' as const,
          effectiveDate: prevDoc.effectiveDate,
          createdAt: prevDoc.createdAt,
        }
      : null,
    next: nextDoc
      ? {
          id: nextDoc.id,
          name: nextDoc.name,
          source: 'explicit' as const,
          effectiveDate: nextDoc.effectiveDate,
          createdAt: nextDoc.createdAt,
        }
      : null,
  };
}

function buildJsonResponse(body: unknown): Response {
  const headers = new Headers({ 'content-type': 'application/json' });
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers,
    json: async () => body,
    text: async () => JSON.stringify(body),
    blob: async () => new Blob([JSON.stringify(body)], { type: 'application/json' }),
    clone() {
      return this as unknown as Response;
    },
  } as unknown as Response;
}

function buildBlobResponse(): Response {
  const blob = new Blob(['%PDF-1.4 ok'], { type: 'application/pdf' });
  const headers = new Headers({ 'content-type': 'application/pdf' });
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers,
    blob: async () => blob,
    json: async () => ({}),
    text: async () => '',
    clone() {
      return this as unknown as Response;
    },
  } as unknown as Response;
}

const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method || 'GET').toUpperCase();
  // Strip query string for matching — but keep it accessible.
  const [pathname] = url.split('?');

  // POST /api/documents/:id/links — record the link.
  const postLinkMatch = pathname.match(/^\/api\/documents\/([^/]+)\/links$/);
  if (method === 'POST' && postLinkMatch) {
    const fromDocumentId = postLinkMatch[1];
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const link: LinkRow = {
      id: `link-${fixture.links.length + 1}`,
      fromDocumentId,
      toDocumentId: body.targetDocumentId,
      position: body.position,
    };
    // Match the production constraint: at most one link per (from,position).
    fixture.links = fixture.links.filter(
      (l) => !(l.fromDocumentId === fromDocumentId && l.position === body.position),
    );
    fixture.links.push(link);
    return buildJsonResponse(link);
  }

  if (method !== 'GET') {
    throw new Error(`Unexpected ${method} ${url} in test`);
  }

  // GET /api/documents/:id/neighbors
  if (pathname.match(/^\/api\/documents\/[^/]+\/neighbors$/)) {
    return buildJsonResponse(neighborFromLinks());
  }

  // GET /api/documents/:id/links — return current outbound links.
  if (pathname.match(/^\/api\/documents\/[^/]+\/links$/)) {
    return buildJsonResponse({
      links: fixture.links.filter((l) => l.fromDocumentId === fixture.documentId),
    });
  }

  // GET /api/documents/:id/link-suggestions — return candidates (minus
  // any that are already explicitly linked).
  if (pathname.match(/^\/api\/documents\/[^/]+\/link-suggestions$/)) {
    const linkedIds = new Set(
      fixture.links
        .filter((l) => l.fromDocumentId === fixture.documentId)
        .map((l) => l.toDocumentId),
    );
    return buildJsonResponse({
      suggestions: fixture.candidates
        .filter((c) => !linkedIds.has(c.id))
        .map((document, idx) => ({
          document,
          score: 50 - idx,
          explain: {
            nameSimilarity: 0.5,
            sharedCategory: true,
            sharedTagCount: 0,
            dateProximityDays: 30,
            sameBuilding: true,
            sameResidence: true,
          },
        })),
    });
  }

  // GET file URL — let the inline viewer's preview fetch resolve so
  // it doesn't error out and tear the dialog down.
  if (pathname.match(/^\/api\/documents\/[^/]+\/file$/)) {
    return buildBlobResponse();
  }

  throw new Error(`Unmocked request: ${method} ${url}`);
}) as unknown as jest.MockedFunction<typeof fetch>;

let originalFetch: typeof fetch | undefined;
let createObjectURLSpy: jest.SpiedFunction<typeof URL.createObjectURL>;
let revokeObjectURLSpy: jest.SpiedFunction<typeof URL.revokeObjectURL>;
let anchorClickSpy: jest.SpiedFunction<HTMLAnchorElement['click']>;

beforeEach(() => {
  fixture = {
    documentId: 'doc-current',
    candidates: [
      makeDoc('doc-prev', 'Bylaw 2024 January', '2024-01-15T00:00:00.000Z'),
      makeDoc('doc-next', 'Bylaw 2024 March', '2024-03-15T00:00:00.000Z'),
    ],
    links: [],
  };

  originalFetch = global.fetch;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockClear();

  if (typeof URL.createObjectURL !== 'function') {
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:mock-url';
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;
  }
  createObjectURLSpy = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
  revokeObjectURLSpy = jest
    .spyOn(URL, 'revokeObjectURL')
    .mockImplementation(() => undefined);
  anchorClickSpy = jest
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined);

  // Reset the singleton query cache so leftover entries from other
  // suites can't pollute the chip render.
  queryClient.clear();
});

afterEach(() => {
  global.fetch = originalFetch as typeof fetch;
  createObjectURLSpy?.mockRestore();
  revokeObjectURLSpy?.mockRestore();
  anchorClickSpy?.mockRestore();
  mockToast.mockReset();
  queryClient.clear();
});

function renderViewer() {
  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentInlineViewer
        isOpen
        onClose={jest.fn()}
        fileUrl={`/api/documents/${fixture.documentId}/file`}
        fileName="current.pdf"
        documentId={fixture.documentId}
      />
    </QueryClientProvider>,
  );
}

async function flushAsyncEffects() {
  await act(async () => {
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }
  });
}

describe('DocumentInlineViewer + DocumentLinkPickerDialog — chip refresh', () => {
  it('opens the picker, links a previous and a next document, and the chips reflect both new links', async () => {
    renderViewer();

    // Initial state — neighbors fetch resolves to {previous: null, next: null}
    // so the empty CTAs render. Use the data-testids defined on the viewer.
    await screen.findByTestId('button-link-prev-document');
    expect(screen.getByTestId('button-link-next-document')).toBeInTheDocument();
    expect(screen.queryByTestId('button-prev-document')).not.toBeInTheDocument();
    expect(screen.queryByTestId('button-next-document')).not.toBeInTheDocument();

    // ---- Link the PREVIOUS document --------------------------------
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-link-prev-document'));
    });
    // The picker queries link-suggestions on open; wait for the
    // first candidate button to appear, then click it.
    const prevSuggestionBtn = await screen.findByTestId('suggestion-doc-prev');
    await act(async () => {
      fireEvent.click(prevSuggestionBtn);
    });

    // The mutation success handler invalidates ['/api/documents', id,
    // 'neighbors'], which triggers a refetch; wait for the linked
    // chip to replace the empty CTA.
    await waitFor(
      () => {
        expect(screen.queryByTestId('button-link-prev-document')).not.toBeInTheDocument();
        expect(screen.getByTestId('button-prev-document')).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
    expect(screen.getByTestId('button-prev-document')).toHaveTextContent('Bylaw 2024 January');

    // The picker is auto-closed by the success handler (onOpenChange(false)).
    await waitFor(() => {
      expect(screen.queryByTestId('input-link-search')).not.toBeInTheDocument();
    });

    // Backend received exactly one POST with the right payload.
    const postCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(postCalls.length).toBe(1);
    const firstPostBody = JSON.parse(String((postCalls[0][1] as RequestInit).body));
    expect(firstPostBody).toEqual({ targetDocumentId: 'doc-prev', position: 'before' });

    // ---- Link the NEXT document ------------------------------------
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-link-next-document'));
    });
    const nextSuggestionBtn = await screen.findByTestId('suggestion-doc-next');
    await act(async () => {
      fireEvent.click(nextSuggestionBtn);
    });
    await waitFor(
      () => {
        expect(screen.queryByTestId('button-link-next-document')).not.toBeInTheDocument();
        expect(screen.getByTestId('button-next-document')).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
    expect(screen.getByTestId('button-next-document')).toHaveTextContent('Bylaw 2024 March');

    // Both chips are now rendered side-by-side (final visual state).
    expect(screen.getByTestId('button-prev-document')).toHaveTextContent('Bylaw 2024 January');
    expect(screen.getByTestId('button-next-document')).toHaveTextContent('Bylaw 2024 March');

    // Backend recorded both links exactly once.
    expect(fixture.links).toEqual([
      { id: 'link-1', fromDocumentId: fixture.documentId, toDocumentId: 'doc-prev', position: 'before' },
      { id: 'link-2', fromDocumentId: fixture.documentId, toDocumentId: 'doc-next', position: 'after' },
    ]);

    // The two link-creation toasts were surfaced (one per mutation).
    await flushAsyncEffects();
    expect(mockToast).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Task #444 — chain-end disabled buttons.
//
// When `resolveDocumentNeighbors` reports `previousIsChainEnd` /
// `nextIsChainEnd`, the viewer must render the disabled
// `button-prev-document-chain-end` / `button-next-document-chain-end`
// instead of the empty "Link previous / Link next" CTA. This guards the
// regression where the unlinked side of a chain wraps around to a
// date-based neighbor rather than surfacing the "First/Last document of
// chain" affordance.
// ---------------------------------------------------------------------------
describe('DocumentInlineViewer — chain-end disabled buttons', () => {
  it('renders disabled chain-end buttons with translated labels when both sides are chain ends', async () => {
    const chainEndFetch = jest.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const [pathname] = url.split('?');
      if (pathname.match(/^\/api\/documents\/[^/]+\/neighbors$/)) {
        // Both sides are chain ends — no neighbor doc on either side, but
        // the chain-end flag is set so the disabled affordance must show.
        return buildJsonResponse({
          currentId: 'doc-chain-only',
          previous: null,
          previousIsChainEnd: true,
          next: null,
          nextIsChainEnd: true,
        });
      }
      if (pathname.match(/^\/api\/documents\/[^/]+\/links$/)) {
        return buildJsonResponse({ links: [] });
      }
      if (pathname.match(/^\/api\/documents\/[^/]+\/file$/)) {
        return buildBlobResponse();
      }
      throw new Error(`Unmocked request: ${url}`);
    }) as unknown as jest.MockedFunction<typeof fetch>;

    global.fetch = chainEndFetch as unknown as typeof fetch;

    render(
      <QueryClientProvider client={queryClient}>
        <DocumentInlineViewer
          isOpen
          onClose={jest.fn()}
          fileUrl={`/api/documents/doc-chain-only/file`}
          fileName="current.pdf"
          documentId="doc-chain-only"
        />
      </QueryClientProvider>,
    );

    // Both disabled chain-end buttons must render once the neighbors
    // query resolves. The "Link previous / Link next" CTAs must NOT show.
    const prevBtn = await screen.findByTestId('button-prev-document-chain-end');
    const nextBtn = await screen.findByTestId('button-next-document-chain-end');

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeDisabled();

    // The mocked `t()` returns the i18n key as-is, so the rendered label,
    // aria-label, and tooltip must all equal the key the viewer requests.
    expect(prevBtn).toHaveAttribute('aria-label', 'firstDocumentOfChain');
    expect(prevBtn).toHaveAttribute('title', 'firstDocumentOfChain');
    expect(prevBtn).toHaveTextContent('firstDocumentOfChain');
    expect(nextBtn).toHaveAttribute('aria-label', 'lastDocumentOfChain');
    expect(nextBtn).toHaveAttribute('title', 'lastDocumentOfChain');
    expect(nextBtn).toHaveTextContent('lastDocumentOfChain');

    // The "Link previous / Link next" CTAs must be replaced by the
    // chain-end buttons — never both.
    expect(screen.queryByTestId('button-link-prev-document')).not.toBeInTheDocument();
    expect(screen.queryByTestId('button-link-next-document')).not.toBeInTheDocument();
    // And there are no actual neighbor chips either, since the resolver
    // intentionally returned no neighbor documents.
    expect(screen.queryByTestId('button-prev-document')).not.toBeInTheDocument();
    expect(screen.queryByTestId('button-next-document')).not.toBeInTheDocument();
  });
});
