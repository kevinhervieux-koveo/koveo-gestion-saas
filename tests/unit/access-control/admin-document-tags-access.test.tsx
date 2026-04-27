/**
 * @jest-environment jsdom
 *
 * Access-control regression tests for the Document Tags admin page (task #1393).
 *
 * The Document Tags page was moved from `/manager/document-tags` to
 * `/admin/document-tags` as part of task #1392. These tests guard against
 * accidentally re-exposing the page to managers in a future refactor by
 * verifying:
 *
 *   1. The route registration in `client/src/App.tsx`:
 *        - `/admin/document-tags` is wrapped in `<ProtectedRoute requiredRole="admin">`.
 *        - `/manager/document-tags` is NOT registered as a route.
 *   2. The navigation config (`client/src/config/navigation.ts`):
 *        - "documentTags" is listed under the admin section only.
 *        - It is not present anywhere under the manager section.
 *        - `getFilteredNavigation('manager', ...)` does not surface it.
 *        - `getFilteredNavigation('admin' | 'super_admin', ...)` does surface it.
 *   3. The `<ProtectedRoute>` guard at runtime:
 *        - A manager user is redirected to `/dashboard/overview` and the
 *          protected children are not rendered.
 *        - An admin user can render the protected children.
 *        - A super_admin user can render the protected children.
 */

import React from 'react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  NAVIGATION_CONFIG,
  getFilteredNavigation,
  type NavigationItem,
  type NavigationSection,
} from '@/config/navigation';

// ---------------------------------------------------------------------------
// Mock useAuth so we can control the current user role per test.
// ---------------------------------------------------------------------------
const mockAuthState: { user: { id: string; role: string } | null; isLoading: boolean } = {
  user: null,
  isLoading: false,
};

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => mockAuthState,
}));

// Capture setLocation calls from the wouter mock so we can assert redirects.
const setLocationMock = jest.fn();
jest.mock('wouter', () => ({
  useLocation: () => ['/admin/document-tags', setLocationMock],
}));

// Import AFTER mocks so the component picks them up.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ProtectedRoute } = require('@/components/common/ProtectedRoute');

// Helper: recursively flatten navigation items (sections may have nested groups).
function collectAllItems(items: NavigationItem[]): NavigationItem[] {
  const out: NavigationItem[] = [];
  for (const item of items) {
    out.push(item);
    if (item.items && item.items.length > 0) {
      out.push(...collectAllItems(item.items));
    }
  }
  return out;
}

function findSection(key: string): NavigationSection | undefined {
  return NAVIGATION_CONFIG.find((section) => section._key === key);
}

describe('Document Tags admin page — access control (task #1393)', () => {
  beforeEach(() => {
    setLocationMock.mockClear();
    mockAuthState.user = null;
    mockAuthState.isLoading = false;
  });

  // -------------------------------------------------------------------------
  // 1. Route registration in App.tsx
  // -------------------------------------------------------------------------
  describe('Route registration in client/src/App.tsx', () => {
    const appSource = readFileSync(
      join(process.cwd(), 'client', 'src', 'App.tsx'),
      'utf8'
    );

    it('registers /admin/document-tags behind a ProtectedRoute with requiredRole="admin"', () => {
      // The exact route line as registered in App.tsx — order of attributes
      // and quoting style is intentionally pinned so a refactor that loosens
      // the guard (e.g. drops requiredRole) will trip this test.
      expect(appSource).toMatch(
        /<Route\s+path=['"]\/admin\/document-tags['"]>\s*\{?\(?\)?\s*=>\s*<ProtectedRoute\s+requiredRole=["']admin["']>\s*<AdminDocumentTags\s*\/>\s*<\/ProtectedRoute>/
      );
    });

    it('does NOT register /manager/document-tags as a route anywhere', () => {
      // Any literal occurrence of the old manager URL in a Route path
      // would re-expose the page to managers — block it.
      expect(appSource).not.toMatch(/path=['"]\/manager\/document-tags['"]/);
      // Also catch any stray <Route> registration even with surrounding whitespace.
      expect(appSource).not.toMatch(/<Route[^>]*\/manager\/document-tags/);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Navigation config
  // -------------------------------------------------------------------------
  describe('Navigation config (client/src/config/navigation.ts)', () => {
    it('lists "documentTags" only inside the admin section', () => {
      const adminSection = findSection('admin');
      expect(adminSection).toBeDefined();

      const adminItems = collectAllItems(adminSection!.items);
      const documentTagsItem = adminItems.find(
        (item) => item.nameKey === 'documentTags' || item.href === '/admin/document-tags'
      );
      expect(documentTagsItem).toBeDefined();
      expect(documentTagsItem!.href).toBe('/admin/document-tags');
    });

    it('does NOT include any "documentTags" entry inside the manager section', () => {
      const managerSection = findSection('manager');
      expect(managerSection).toBeDefined();

      const managerItems = collectAllItems(managerSection!.items);
      const stray = managerItems.find(
        (item) =>
          item.nameKey === 'documentTags' ||
          item.href === '/manager/document-tags' ||
          item.href === '/admin/document-tags'
      );
      expect(stray).toBeUndefined();
    });

    it('does NOT surface "documentTags" to a manager via getFilteredNavigation', () => {
      const sections = getFilteredNavigation('manager', { role: 'manager', email: null });

      const allVisibleItems = sections.flatMap((section) => collectAllItems(section.items));
      const visibleDocumentTags = allVisibleItems.find(
        (item) =>
          item.nameKey === 'documentTags' ||
          item.href === '/admin/document-tags' ||
          item.href === '/manager/document-tags'
      );
      expect(visibleDocumentTags).toBeUndefined();
    });

    it('surfaces "documentTags" to an admin via getFilteredNavigation', () => {
      const sections = getFilteredNavigation('admin', { role: 'admin', email: null });

      const allVisibleItems = sections.flatMap((section) => collectAllItems(section.items));
      const visibleDocumentTags = allVisibleItems.find(
        (item) => item.href === '/admin/document-tags'
      );
      expect(visibleDocumentTags).toBeDefined();
    });

    it('surfaces "documentTags" to a super_admin via getFilteredNavigation', () => {
      const sections = getFilteredNavigation('super_admin', {
        role: 'super_admin',
        email: null,
      });

      const allVisibleItems = sections.flatMap((section) => collectAllItems(section.items));
      const visibleDocumentTags = allVisibleItems.find(
        (item) => item.href === '/admin/document-tags'
      );
      expect(visibleDocumentTags).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 3. ProtectedRoute behavior at runtime
  // -------------------------------------------------------------------------
  describe('<ProtectedRoute requiredRole="admin"> behavior on /admin/document-tags', () => {
    const ProtectedChild = () => (
      <div data-testid="document-tags-page">document-tags-content</div>
    );

    it('redirects a manager to /dashboard/overview and does not render the page', async () => {
      mockAuthState.user = { id: 'manager-1', role: 'manager' };
      mockAuthState.isLoading = false;

      const { queryByTestId } = render(
        <ProtectedRoute requiredRole='admin'>
          <ProtectedChild />
        </ProtectedRoute>
      );

      // Manager must not see the protected children.
      expect(queryByTestId('document-tags-page')).not.toBeInTheDocument();

      // ProtectedRoute schedules the redirect inside useEffect.
      await waitFor(() => {
        expect(setLocationMock).toHaveBeenCalledWith('/dashboard/overview');
      });
    });

    it('renders the page for an admin user', () => {
      mockAuthState.user = { id: 'admin-1', role: 'admin' };
      mockAuthState.isLoading = false;

      const { getByTestId } = render(
        <ProtectedRoute requiredRole='admin'>
          <ProtectedChild />
        </ProtectedRoute>
      );

      expect(getByTestId('document-tags-page')).toBeInTheDocument();
      expect(setLocationMock).not.toHaveBeenCalled();
    });

    it('renders the page for a super_admin user', () => {
      mockAuthState.user = { id: 'super-admin-1', role: 'super_admin' };
      mockAuthState.isLoading = false;

      const { getByTestId } = render(
        <ProtectedRoute requiredRole='admin'>
          <ProtectedChild />
        </ProtectedRoute>
      );

      expect(getByTestId('document-tags-page')).toBeInTheDocument();
      expect(setLocationMock).not.toHaveBeenCalled();
    });

    it('redirects a tenant (lowest role) and does not render the page', async () => {
      mockAuthState.user = { id: 'tenant-1', role: 'tenant' };
      mockAuthState.isLoading = false;

      const { queryByTestId } = render(
        <ProtectedRoute requiredRole='admin'>
          <ProtectedChild />
        </ProtectedRoute>
      );

      expect(queryByTestId('document-tags-page')).not.toBeInTheDocument();

      await waitFor(() => {
        expect(setLocationMock).toHaveBeenCalledWith('/dashboard/overview');
      });
    });
  });
});
