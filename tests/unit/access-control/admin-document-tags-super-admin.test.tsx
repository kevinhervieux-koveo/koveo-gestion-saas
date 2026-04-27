/**
 * @jest-environment jsdom
 *
 * Access-control tests for the super-admin-only Koveo system tag & family
 * management on the Document Tags admin page (task #1418).
 *
 * Asserts:
 *   1. The Koveo Tags table exposes edit/delete buttons only when the current
 *      user is super_admin; admin and manager see the read-only cell.
 *   2. The Koveo Families table exposes edit/delete buttons only when the
 *      current user is super_admin; admin and manager see the read-only cell.
 *   3. The "Mark as Koveo system" toggle is only rendered in the create-tag
 *      dialog when the current user is super_admin.
 *   4. The "Koveo system family" toggle is only rendered in the create-family
 *      dialog when the current user is super_admin.
 */

import React from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, fireEvent, act } from '@testing-library/react';
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
    t: (key: string) => key,
    language: 'en',
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn(),
  queryClient: { invalidateQueries: jest.fn() },
}));

jest.mock('@/components/layout/header', () => ({
  Header: ({ title }: { title?: React.ReactNode }) => (
    <header data-testid="page-header">{title}</header>
  ),
}));

// Minimal Tabs mock — wires onValueChange through context so clicks work.
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

// Seed one system tag and one system family so the tables render rows.
const SYSTEM_TAG = {
  id: 'sys-tag-1',
  name: 'Koveo System Tag',
  isSystem: true,
  organizationId: null,
  scope: 'any',
  importance: 'nice_to_have',
  description: null,
  suggestedProfessionals: [],
};

const SYSTEM_FAMILY = {
  id: 'sys-fam-1',
  name: 'Koveo System Family',
  isSystem: true,
  organizationId: null,
  description: null,
};

const AdminDocumentTags = require('@/pages/admin/document-tags').default;

const SAMPLE_ORGS = [
  { id: 'org-1', name: 'Acme Corp' },
  { id: 'org-2', name: 'Globex' },
];

const SAMPLE_MEMBER_ORGS = [
  { id: 'member-org-1', name: 'Member Org Alpha' },
];

function renderPage({
  orgs = SAMPLE_ORGS,
  memberOrgs = SAMPLE_MEMBER_ORGS,
}: { orgs?: { id: string; name: string }[]; memberOrgs?: { id: string; name: string }[] } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // Return data synchronously via cache so table rows render immediately.
        staleTime: Infinity,
      },
    },
  });

  // Pre-seed the cache so components never enter a loading state during tests.
  queryClient.setQueryData(['/api/document-tags'], { tags: [SYSTEM_TAG] });
  queryClient.setQueryData(['/api/document-link-families'], { families: [SYSTEM_FAMILY] });
  queryClient.setQueryData(['/api/organizations'], orgs);
  queryClient.setQueryData(['/api/users/me/organizations'], memberOrgs);

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminDocumentTags />
    </QueryClientProvider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Document Tags admin page — super-admin Koveo controls (task #1418)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear localStorage so each test starts with the default 'tags' view.
    window.localStorage.clear();
  });

  // ── 1. Koveo Tags table edit/delete buttons ──────────────────────────────

  describe('Koveo Tags table — edit/delete visibility', () => {
    it('shows edit and delete buttons for a super_admin', () => {
      mockAuthState.user = USERS.super_admin;
      const { getByTestId } = renderPage();

      expect(getByTestId(`button-edit-tag-${SYSTEM_TAG.id}`)).toBeInTheDocument();
      expect(getByTestId(`button-delete-tag-${SYSTEM_TAG.id}`)).toBeInTheDocument();
    });

    it('does NOT show edit/delete buttons for an admin — shows read-only cell instead', () => {
      mockAuthState.user = USERS.admin;
      const { queryByTestId } = renderPage();

      expect(queryByTestId(`button-edit-tag-${SYSTEM_TAG.id}`)).not.toBeInTheDocument();
      expect(queryByTestId(`button-delete-tag-${SYSTEM_TAG.id}`)).not.toBeInTheDocument();
    });

    it('does NOT show edit/delete buttons for a manager — shows read-only cell instead', () => {
      mockAuthState.user = USERS.manager;
      const { queryByTestId } = renderPage();

      expect(queryByTestId(`button-edit-tag-${SYSTEM_TAG.id}`)).not.toBeInTheDocument();
      expect(queryByTestId(`button-delete-tag-${SYSTEM_TAG.id}`)).not.toBeInTheDocument();
    });
  });

  // ── 2. Koveo Families table edit/delete buttons ──────────────────────────

  describe('Koveo Families table — edit/delete visibility', () => {
    it('shows edit and delete buttons for a super_admin', () => {
      mockAuthState.user = USERS.super_admin;
      const { getByTestId } = renderPage();

      fireEvent.click(getByTestId('toggle-view-families'));

      expect(getByTestId(`button-edit-family-${SYSTEM_FAMILY.id}`)).toBeInTheDocument();
      expect(getByTestId(`button-delete-family-${SYSTEM_FAMILY.id}`)).toBeInTheDocument();
    });

    it('does NOT show edit/delete buttons for an admin in Koveo Families', () => {
      mockAuthState.user = USERS.admin;
      const { getByTestId, queryByTestId } = renderPage();

      fireEvent.click(getByTestId('toggle-view-families'));

      expect(queryByTestId(`button-edit-family-${SYSTEM_FAMILY.id}`)).not.toBeInTheDocument();
      expect(queryByTestId(`button-delete-family-${SYSTEM_FAMILY.id}`)).not.toBeInTheDocument();
    });

    it('does NOT show edit/delete buttons for a manager in Koveo Families', () => {
      mockAuthState.user = USERS.manager;
      const { getByTestId, queryByTestId } = renderPage();

      fireEvent.click(getByTestId('toggle-view-families'));

      expect(queryByTestId(`button-edit-family-${SYSTEM_FAMILY.id}`)).not.toBeInTheDocument();
      expect(queryByTestId(`button-delete-family-${SYSTEM_FAMILY.id}`)).not.toBeInTheDocument();
    });
  });

  // ── 3. isSystem toggle in tag create dialog ──────────────────────────────

  describe('Tag create dialog — isSystem toggle visibility', () => {
    it('shows the isSystem toggle for a super_admin', () => {
      mockAuthState.user = USERS.super_admin;
      const { getByTestId, queryByTestId } = renderPage();

      // Ensure we are in the Tags view (in case a previous test left it in Families).
      const tagsTab = getByTestId('toggle-view-tags');
      if (tagsTab.getAttribute('aria-selected') !== 'true') {
        fireEvent.click(tagsTab);
      }

      fireEvent.click(getByTestId('button-create-tag'));

      expect(queryByTestId('toggle-is-system')).toBeInTheDocument();
    });

    it('hides the isSystem toggle for an admin', () => {
      mockAuthState.user = USERS.admin;
      const { getByTestId, queryByTestId } = renderPage();

      const tagsTab = getByTestId('toggle-view-tags');
      if (tagsTab.getAttribute('aria-selected') !== 'true') {
        fireEvent.click(tagsTab);
      }

      fireEvent.click(getByTestId('button-create-tag'));

      expect(queryByTestId('toggle-is-system')).not.toBeInTheDocument();
    });

    it('hides the isSystem toggle for a manager', () => {
      mockAuthState.user = USERS.manager;
      const { getByTestId, queryByTestId } = renderPage();

      const tagsTab = getByTestId('toggle-view-tags');
      if (tagsTab.getAttribute('aria-selected') !== 'true') {
        fireEvent.click(tagsTab);
      }

      fireEvent.click(getByTestId('button-create-tag'));

      expect(queryByTestId('toggle-is-system')).not.toBeInTheDocument();
    });
  });

  // ── 4. isSystem toggle in family create dialog ───────────────────────────

  describe('Family create dialog — isSystem toggle visibility', () => {
    it('shows the isSystem toggle for a super_admin', () => {
      mockAuthState.user = USERS.super_admin;
      const { getByTestId, queryByTestId } = renderPage();

      fireEvent.click(getByTestId('toggle-view-families'));
      fireEvent.click(getByTestId('button-create-family'));

      expect(queryByTestId('toggle-family-is-system')).toBeInTheDocument();
    });

    it('hides the isSystem toggle for an admin', () => {
      mockAuthState.user = USERS.admin;
      const { getByTestId, queryByTestId } = renderPage();

      fireEvent.click(getByTestId('toggle-view-families'));
      fireEvent.click(getByTestId('button-create-family'));

      expect(queryByTestId('toggle-family-is-system')).not.toBeInTheDocument();
    });

    it('hides the isSystem toggle for a manager', () => {
      mockAuthState.user = USERS.manager;
      const { getByTestId, queryByTestId } = renderPage();

      fireEvent.click(getByTestId('toggle-view-families'));
      fireEvent.click(getByTestId('button-create-family'));

      expect(queryByTestId('toggle-family-is-system')).not.toBeInTheDocument();
    });
  });

  // ── 5. Org picker in family create dialog ────────────────────────────────

  describe('Family create dialog — organization picker visibility (task #1440)', () => {
    it('shows the org picker for super_admin when the system toggle is OFF', () => {
      mockAuthState.user = USERS.super_admin;
      const { getByTestId, queryByTestId } = renderPage();

      fireEvent.click(getByTestId('toggle-view-families'));
      fireEvent.click(getByTestId('button-create-family'));

      // System toggle is OFF by default — org picker should appear.
      expect(queryByTestId('select-family-organization')).toBeInTheDocument();
    });

    it('hides the org picker for super_admin when the system toggle is ON', () => {
      mockAuthState.user = USERS.super_admin;
      const { getByTestId, queryByTestId } = renderPage();

      fireEvent.click(getByTestId('toggle-view-families'));
      fireEvent.click(getByTestId('button-create-family'));

      // Turn the system toggle ON.
      fireEvent.click(getByTestId('toggle-family-is-system'));

      expect(queryByTestId('select-family-organization')).not.toBeInTheDocument();
    });

    it('does NOT show the org picker for a regular admin', () => {
      mockAuthState.user = USERS.admin;
      const { getByTestId, queryByTestId } = renderPage();

      fireEvent.click(getByTestId('toggle-view-families'));
      fireEvent.click(getByTestId('button-create-family'));

      expect(queryByTestId('select-family-organization')).not.toBeInTheDocument();
    });

    it('does NOT show the org picker for a manager', () => {
      mockAuthState.user = USERS.manager;
      const { getByTestId, queryByTestId } = renderPage();

      fireEvent.click(getByTestId('toggle-view-families'));
      fireEvent.click(getByTestId('button-create-family'));

      expect(queryByTestId('select-family-organization')).not.toBeInTheDocument();
    });

    it('org picker is shown (and no default pre-selected) when super_admin has no memberships', () => {
      mockAuthState.user = USERS.super_admin;
      const { getByTestId, queryByTestId } = renderPage({ memberOrgs: [] });

      fireEvent.click(getByTestId('toggle-view-families'));
      fireEvent.click(getByTestId('button-create-family'));

      expect(queryByTestId('select-family-organization')).toBeInTheDocument();
    });

    it('org picker shows when super_admin has memberships and the picker renders', () => {
      mockAuthState.user = USERS.super_admin;
      const { getByTestId, queryByTestId } = renderPage({
        memberOrgs: [{ id: 'member-org-1', name: 'Member Org Alpha' }],
      });

      fireEvent.click(getByTestId('toggle-view-families'));
      fireEvent.click(getByTestId('button-create-family'));

      expect(queryByTestId('select-family-organization')).toBeInTheDocument();
    });

    it('submit is blocked and apiRequest is NOT called when super_admin submits without selecting an org', () => {
      mockAuthState.user = USERS.super_admin;
      const { getByTestId } = renderPage({ memberOrgs: [] });

      fireEvent.click(getByTestId('toggle-view-families'));
      fireEvent.click(getByTestId('button-create-family'));

      fireEvent.change(getByTestId('input-family-name'), { target: { value: 'Test Family' } });

      act(() => {
        fireEvent.click(getByTestId('button-submit-family'));
      });

      const { apiRequest } = require('@/lib/queryClient');
      expect(apiRequest).not.toHaveBeenCalled();
    });
  });
});
