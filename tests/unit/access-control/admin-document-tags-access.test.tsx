/**
 * @jest-environment jsdom
 *
 * Access-control regression tests for the Document Tags admin page (task #1393,
 * updated task #1537, re-pathed task #1693).
 *
 * The Document Tags page was moved from `/manager/document-tags` to
 * `/admin/document-tags` (task #1392), then elevated to `super_admin`
 * (task #1537), and finally re-prefixed to `/super_admin/document-tags`
 * (task #1693) so the URL prefix matches the role hierarchy. These tests
 * guard against accidental role-guard downgrades or URL regressions in
 * future refactors by verifying:
 *
 *   1. The route registration in `client/src/App.tsx`:
 *        - `/super_admin/document-tags` is wrapped in `<ProtectedRoute requiredRole="super_admin">`.
 *        - `/admin/document-tags` exists only as a redirect shim.
 *        - `/manager/document-tags` is NOT registered as a route.
 *   2. The navigation config (`client/src/config/navigation.ts`):
 *        - "documentTags" is listed under the superAdmin section.
 *        - It is not present anywhere under the manager section.
 *        - `getFilteredNavigation('manager', ...)` does not surface it.
 *        - `getFilteredNavigation('super_admin', ...)` does surface it.
 *   3. The `<ProtectedRoute>` guard at runtime:
 *        - A manager user is redirected to `/dashboard/overview` and the
 *          protected children are not rendered.
 *        - An admin user is denied (redirected) because the route requires
 *          super_admin (level 4) and admin is only level 3.
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
  useLocation: () => ['/super_admin/document-tags', setLocationMock],
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

describe('Document Tags admin page — access control (task #1393 / task #1537 / task #1693)', () => {
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

    it('registers /super_admin/document-tags behind a ProtectedRoute with requiredRole="super_admin"', () => {
      expect(appSource).toMatch(
        /<Route\s+path=['"]\/super_admin\/document-tags['"]>\s*\{?\(?\)?\s*=>\s*<ProtectedRoute\s+requiredRole=["']super_admin["']>\s*<AdminDocumentTags\s*\/>\s*<\/ProtectedRoute>/
      );
    });

    it('registers /admin/document-tags only as a redirect shim (not a ProtectedRoute)', () => {
      expect(appSource).toMatch(/path=['"]\/admin\/document-tags['"]\s+component=\{AdminDocumentTagsRedirect\}/);
      expect(appSource).not.toMatch(
        /<Route\s+path=['"]\/admin\/document-tags['"]>\s*\{?\(?\)?\s*=>\s*<ProtectedRoute/
      );
    });

    it('does NOT register /manager/document-tags as a route anywhere', () => {
      expect(appSource).not.toMatch(/path=['"]\/manager\/document-tags['"]/);
      expect(appSource).not.toMatch(/<Route[^>]*\/manager\/document-tags/);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Navigation config
  // -------------------------------------------------------------------------
  describe('Navigation config (client/src/config/navigation.ts)', () => {
    it('lists "documentTags" only inside the superAdmin section', () => {
      const superAdminSection = findSection('superAdmin');
      expect(superAdminSection).toBeDefined();

      const superAdminItems = collectAllItems(superAdminSection!.items);
      const documentTagsItem = superAdminItems.find(
        (item) => item.nameKey === 'documentTags' || item.href === '/super_admin/document-tags'
      );
      expect(documentTagsItem).toBeDefined();
      expect(documentTagsItem!.href).toBe('/super_admin/document-tags');
    });

    it('does NOT include any "documentTags" entry inside the manager section', () => {
      const managerSection = findSection('manager');
      expect(managerSection).toBeDefined();

      const managerItems = collectAllItems(managerSection!.items);
      const stray = managerItems.find(
        (item) =>
          item.nameKey === 'documentTags' ||
          item.href === '/manager/document-tags' ||
          item.href === '/admin/document-tags' ||
          item.href === '/super_admin/document-tags'
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
          item.href === '/super_admin/document-tags' ||
          item.href === '/manager/document-tags'
      );
      expect(visibleDocumentTags).toBeUndefined();
    });

    it('surfaces "documentTags" to a super_admin via getFilteredNavigation', () => {
      const sections = getFilteredNavigation('super_admin', {
        role: 'super_admin',
        email: null,
      });

      const allVisibleItems = sections.flatMap((section) => collectAllItems(section.items));
      const visibleDocumentTags = allVisibleItems.find(
        (item) => item.href === '/super_admin/document-tags'
      );
      expect(visibleDocumentTags).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 3. ProtectedRoute behavior at runtime
  // -------------------------------------------------------------------------
  describe('<ProtectedRoute requiredRole="super_admin"> behavior on /super_admin/document-tags', () => {
    const ProtectedChild = () => (
      <div data-testid="document-tags-page">document-tags-content</div>
    );

    it('redirects a manager to /dashboard/overview and does not render the page', async () => {
      mockAuthState.user = { id: 'manager-1', role: 'manager' };
      mockAuthState.isLoading = false;

      const { queryByTestId } = render(
        <ProtectedRoute requiredRole='super_admin'>
          <ProtectedChild />
        </ProtectedRoute>
      );

      expect(queryByTestId('document-tags-page')).not.toBeInTheDocument();

      await waitFor(() => {
        expect(setLocationMock).toHaveBeenCalledWith('/dashboard/overview');
      });
    });

    it('redirects a regular admin to /dashboard/overview (route requires super_admin)', async () => {
      mockAuthState.user = { id: 'admin-1', role: 'admin' };
      mockAuthState.isLoading = false;

      const { queryByTestId } = render(
        <ProtectedRoute requiredRole='super_admin'>
          <ProtectedChild />
        </ProtectedRoute>
      );

      expect(queryByTestId('document-tags-page')).not.toBeInTheDocument();

      await waitFor(() => {
        expect(setLocationMock).toHaveBeenCalledWith('/dashboard/overview');
      });
    });

    it('renders the page for a super_admin user', () => {
      mockAuthState.user = { id: 'super-admin-1', role: 'super_admin' };
      mockAuthState.isLoading = false;

      const { getByTestId } = render(
        <ProtectedRoute requiredRole='super_admin'>
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
        <ProtectedRoute requiredRole='super_admin'>
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
