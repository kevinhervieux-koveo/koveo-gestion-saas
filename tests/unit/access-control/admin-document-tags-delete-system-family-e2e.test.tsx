/**
 * @jest-environment jsdom
 *
 * End-to-end (component-level) test for task #1455 — verifies that when a
 * super_admin clicks the delete icon next to a Koveo system link family in
 * the admin Document Tags page, the DELETE call fires, a success toast is
 * shown, and the row disappears from the rendered list after the query
 * refetches.
 *
 * Also asserts (regression for task #1418/#1445 access-control wiring) that
 * a non-super-admin viewing the same Koveo families card sees the
 * "Read-only" cell instead of any action buttons — so a future refactor
 * that drops `onDelete={isSuperAdmin ? removeFamily : undefined}` on the
 * system families table would fail this test.
 *
 * Why this complements existing coverage:
 *   - `tests/unit/api/super-admin-system-tags-families.test.ts` only
 *     exercises the REST surface.
 *   - `tests/unit/access-control/admin-document-tags-super-admin.test.tsx`
 *     only checks button visibility, not the actual click → DELETE → row
 *     removed flow.
 *   - This test wires a real QueryClient with a default queryFn so the
 *     `invalidateQueries` call inside `deleteFamilyMutation.onSuccess`
 *     triggers a refetch that reflects the deletion.
 *
 * Mirrors the structure of
 * `tests/unit/access-control/admin-document-tags-delete-system-e2e.test.tsx`
 * (the system tags equivalent, task #1450).
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';

// ─── Minimal user records ─────────────────────────────────────────────────────

const USERS = {
  super_admin: { id: 'sa-1', role: 'super_admin', email: 'sa@test.com' },
  admin: { id: 'admin-1', role: 'admin', email: 'admin@test.com' },
  manager: { id: 'mgr-1', role: 'manager', email: 'mgr@test.com' },
};

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockAuthState: { user: (typeof USERS)[keyof typeof USERS] | null; isLoading: boolean } = {
  user: null,
  isLoading: false,
};

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('wouter', () => ({
  useLocation: () => ['/admin/document-tags', jest.fn()],
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    // Mirrors the real `t` just enough to substitute `{name}` placeholders so
    // the in-app delete confirmation dialog can render the item name when the
    // page calls `t('lfDeleteConfirm', { name: family.name })`.
    t: (key: string, values?: Record<string, unknown>) => {
      if (!values) return key;
      // Build a synthetic template that includes any provided placeholder
      // values so the dialog message contains the tag/family name we're
      // asserting on. The real translation file uses
      // `Delete family "{name}"?` but we don't load translations here;
      // suffixing the values is enough for the assertion
      // `toContain(name)` to pass.
      const suffix = Object.entries(values)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      return `${key} ${suffix}`;
    },
    language: 'en',
  }),
}));

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Module-level holders that the manual mock factories close over. Jest will
// hoist `jest.mock(...)` above the `import` statements, so the variables they
// reference must be `var`-prefixed-with-`mock` to satisfy the hoist guard.
const mockApiRequest = jest.fn();

// Holder so `queryClient.invalidateQueries(...)` from `@/lib/queryClient`
// inside the page can be redirected to the test's QueryClient instance.
const mockQueryClientHolder: { current: QueryClient | null } = { current: null };

jest.mock('@/lib/queryClient', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  queryClient: {
    invalidateQueries: (...args: unknown[]) => {
      const c = mockQueryClientHolder.current;
      if (!c) return Promise.resolve();
      // @ts-expect-error - delegate to the test QueryClient at runtime.
      return c.invalidateQueries(...args);
    },
  },
}));

jest.mock('@/components/layout/header', () => ({
  Header: ({ title }: { title?: React.ReactNode }) => (
    <header data-testid="page-header">{title}</header>
  ),
}));

// Minimal Tabs mock (mirrors the tags-delete e2e test).
jest.mock('@/components/ui/tabs', () => {
  const TabsCtx = React.createContext<{
    value: string;
    onValueChange: (v: string) => void;
  }>({ value: '', onValueChange: () => {} });

  const Tabs = ({
    value,
    onValueChange,
    children,
    ...rest
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
    [key: string]: any;
  }) => (
    <TabsCtx.Provider value={{ value, onValueChange }}>
      <div {...rest}>{children}</div>
    </TabsCtx.Provider>
  );

  const TabsList = ({ children }: { children: React.ReactNode }) => (
    <div role="tablist">{children}</div>
  );

  const TabsTrigger = ({
    value,
    children,
    ...rest
  }: {
    value: string;
    children: React.ReactNode;
    [key: string]: any;
  }) => {
    const ctx = React.useContext(TabsCtx);
    return (
      <button
        type="button"
        role="tab"
        aria-selected={ctx.value === value}
        onClick={() => ctx.onValueChange(value)}
        {...rest}
      >
        {children}
      </button>
    );
  };

  return { Tabs, TabsList, TabsTrigger };
});

// ─── Backing store + default queryFn so invalidate → refetch reflects state ──

type TestFamily = {
  id: string;
  name: string;
  isSystem: boolean;
  organizationId: string | null;
  description: string | null;
};

const SYSTEM_FAMILY: TestFamily = {
  id: 'sys-fam-1',
  name: 'Koveo System Family',
  isSystem: true,
  organizationId: null,
  description: null,
};

const tagStore: unknown[] = [];
let familyStore: TestFamily[] = [];

const AdminDocumentTags = require('@/pages/admin/document-tags').default;

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
        // Default fetcher pulls from the in-memory stores keyed by the first
        // segment of the queryKey. Mirrors what the real default fetcher
        // would return after invalidateQueries fires.
        queryFn: async ({ queryKey }) => {
          const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
          if (key === '/api/document-tags') return { tags: [...tagStore] };
          if (key === '/api/document-link-families') return { families: [...familyStore] };
          if (key === '/api/organizations') return [];
          if (key === '/api/users/me/organizations') return [];
          return null;
        },
      },
    },
  });
}

function renderPage() {
  const queryClient = makeQueryClient();
  mockQueryClientHolder.current = queryClient;

  const result = render(
    <QueryClientProvider client={queryClient}>
      <AdminDocumentTags />
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Document Tags admin page — super_admin can delete system link families end-to-end (task #1455)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    familyStore = [{ ...SYSTEM_FAMILY }];
  });

  afterEach(() => {
    mockQueryClientHolder.current = null;
  });

  it('clicking delete on a Koveo system family opens the in-app confirmation dialog, fires DELETE on confirm, removes the row, and shows a success toast', async () => {
    mockAuthState.user = USERS.super_admin;

    // apiRequest mock: when DELETE hits the system family, drop it from the
    // store so the next refetch (triggered by invalidateQueries) returns no
    // rows.
    mockApiRequest.mockImplementation(async (method: string, url: string) => {
      if (method === 'DELETE' && url === `/api/document-link-families/${SYSTEM_FAMILY.id}`) {
        familyStore = familyStore.filter((f) => f.id !== SYSTEM_FAMILY.id);
        return { ok: true };
      }
      throw new Error(`Unexpected apiRequest: ${method} ${url}`);
    });

    // Regression: the page must NOT use window.confirm anymore. Spy on it so
    // we can assert it is never invoked.
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

    const { getByTestId, queryByTestId, findByTestId } = renderPage();

    // Switch to the Families view first — the system families card lives
    // there.
    await act(async () => {
      fireEvent.click(getByTestId('toggle-view-families'));
    });

    // The system family row should be visible to the super_admin.
    await findByTestId(`row-family-${SYSTEM_FAMILY.id}`);
    const deleteBtn = getByTestId(`button-delete-family-${SYSTEM_FAMILY.id}`);
    expect(deleteBtn).toBeInTheDocument();

    // Dialog is closed initially.
    expect(queryByTestId('dialog-confirm-delete')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    // The in-app confirmation dialog opens (rendered via Radix portal).
    const confirmDialog = await findByTestId('dialog-confirm-delete');
    expect(confirmDialog).toBeInTheDocument();
    // The body text references the deleted family's name.
    expect(getByTestId('text-confirm-delete-message').textContent).toContain(
      SYSTEM_FAMILY.name,
    );

    // Native confirm() must NOT have been used.
    expect(confirmSpy).not.toHaveBeenCalled();

    // No DELETE has fired yet — only opening the dialog should not trigger it.
    expect(mockApiRequest).not.toHaveBeenCalled();

    // Click the destructive confirm button inside the dialog.
    await act(async () => {
      fireEvent.click(getByTestId('button-confirm-delete'));
    });

    // The DELETE request must have fired with the correct URL.
    expect(mockApiRequest).toHaveBeenCalledWith(
      'DELETE',
      `/api/document-link-families/${SYSTEM_FAMILY.id}`,
    );

    // Success toast was triggered (page passes `t('lfToastDeletedTitle')`,
    // and the test's `t` mock returns the key itself).
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'lfToastDeletedTitle' }),
      );
    });

    // After the refetch, the row is no longer rendered.
    await waitFor(() => {
      expect(queryByTestId(`row-family-${SYSTEM_FAMILY.id}`)).not.toBeInTheDocument();
    });

    // Dialog has closed.
    await waitFor(() => {
      expect(queryByTestId('dialog-confirm-delete')).not.toBeInTheDocument();
    });

    // Sanity-check: no error toast was emitted.
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' }),
    );

    confirmSpy.mockRestore();
  });

  it('aborts the DELETE if the super_admin cancels the in-app confirmation dialog (regression — confirm guard)', async () => {
    mockAuthState.user = USERS.super_admin;
    mockApiRequest.mockResolvedValue({ ok: true });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    const { findByTestId, getByTestId, queryByTestId } = renderPage();

    await act(async () => {
      fireEvent.click(getByTestId('toggle-view-families'));
    });

    await findByTestId(`row-family-${SYSTEM_FAMILY.id}`);

    await act(async () => {
      fireEvent.click(getByTestId(`button-delete-family-${SYSTEM_FAMILY.id}`));
    });

    // Dialog opened — native confirm was not used.
    await findByTestId('dialog-confirm-delete');
    expect(confirmSpy).not.toHaveBeenCalled();

    // Click the cancel button instead of confirm.
    await act(async () => {
      fireEvent.click(getByTestId('button-cancel-delete'));
    });

    expect(mockApiRequest).not.toHaveBeenCalled();
    // Row is still there.
    expect(getByTestId(`row-family-${SYSTEM_FAMILY.id}`)).toBeInTheDocument();
    // Dialog has closed.
    await waitFor(() => {
      expect(queryByTestId('dialog-confirm-delete')).not.toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it('renders a "Read-only" cell instead of edit/delete buttons for a non-super-admin (regression — guard wiring)', async () => {
    mockAuthState.user = USERS.admin;

    const { findByTestId, queryByTestId, getByTestId } = renderPage();

    await act(async () => {
      fireEvent.click(getByTestId('toggle-view-families'));
    });

    // Wait until the system family row renders.
    const row = await findByTestId(`row-family-${SYSTEM_FAMILY.id}`);

    // Action buttons are absent for the non-super-admin.
    expect(queryByTestId(`button-edit-family-${SYSTEM_FAMILY.id}`)).not.toBeInTheDocument();
    expect(queryByTestId(`button-delete-family-${SYSTEM_FAMILY.id}`)).not.toBeInTheDocument();

    // The read-only label appears in the row's actions cell. The page passes
    // `t('dtReadOnly')` as the label, and the test's `t` mock returns the key
    // itself, so we look for that string inside the row.
    expect(row.textContent).toContain('dtReadOnly');

    // Belt-and-braces: ensure `apiRequest` is never called from the rendered
    // tree for a non-super-admin even if some refactor wired buttons by
    // mistake.
    expect(mockApiRequest).not.toHaveBeenCalledWith(
      'DELETE',
      `/api/document-link-families/${SYSTEM_FAMILY.id}`,
    );
  });
});
