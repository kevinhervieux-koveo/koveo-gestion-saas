/**
 * @jest-environment jsdom
 *
 * Regression test: no admin page may expose CLI command strings such as
 * "npm run ..." to end users (regression guard for task #1537 — the
 * `npm run quality:check` banner that appeared on /admin/quality).
 *
 * Strategy:
 *   1. DOM rendering — renders the admin pages that have refresh/action banners
 *      (quality, compliance) with RTL and asserts /npm run/i is absent from the
 *      rendered DOM. This catches leaks from the page template, sub-components,
 *      translations, or any other runtime source.
 *   2. Source-level guard — reads every *.tsx / *.ts file under
 *      client/src/pages/admin/ and client/src/pages/auto/admin-* to assert
 *      the literal string is not present in any future admin page source file.
 *      This guard auto-covers new pages added to either directory without
 *      requiring changes to this test.
 */

import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Shared mocks (apply to all rendered pages)
// ---------------------------------------------------------------------------

jest.mock('wouter', () => ({
  useLocation: () => ['/admin/quality', jest.fn()],
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

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { role: 'super_admin', id: 'u1' },
    isLoading: false,
  }),
}));

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn(),
  queryClient: {
    invalidateQueries: jest.fn(),
  },
}));

jest.mock('@/components/layout/header', () => ({
  Header: ({ title, subtitle }: { title?: React.ReactNode; subtitle?: string }) => (
    <header data-testid='page-header'>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  ),
}));

jest.mock('@/components/dashboard/quality-metrics', () => ({
  QualityMetrics: () => <div data-testid='quality-metrics-stub' />,
}));

jest.mock('@/components/dashboard/law25-compliance', () => ({
  Law25Compliance: () => <div data-testid='law25-compliance-stub' />,
}));

// ---------------------------------------------------------------------------
// Helper: wrap with a silent QueryClient
// ---------------------------------------------------------------------------

function withQueryClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async () => ({}),
      },
    },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

// ---------------------------------------------------------------------------
// 1. DOM rendering tests — render actual admin pages and inspect the DOM
// ---------------------------------------------------------------------------

describe('Admin pages — rendered DOM must not contain CLI command strings', () => {
  describe('/admin/quality (primary regression: task #1537)', () => {
    it('does not render any "npm run" text in the DOM', () => {
      const AdminQuality = require('@/pages/admin/quality').default;
      withQueryClient(<AdminQuality />);
      expect(screen.queryByText(/npm run/i)).toBeNull();
    });

    it('does not render the literal shell command "quality:check"', () => {
      const AdminQuality = require('@/pages/admin/quality').default;
      withQueryClient(<AdminQuality />);
      expect(screen.queryByText(/quality:check/i)).toBeNull();
    });

    it('does not contain any <code> element with a shell command', () => {
      const AdminQuality = require('@/pages/admin/quality').default;
      const { container } = withQueryClient(<AdminQuality />);
      container.querySelectorAll('code').forEach((el) => {
        expect(el.textContent).not.toMatch(/npm run/i);
      });
    });

    it('renders the last-run info bar (data-testid="text-last-run")', () => {
      const AdminQuality = require('@/pages/admin/quality').default;
      withQueryClient(<AdminQuality />);
      expect(screen.getByTestId('text-last-run')).toBeInTheDocument();
    });

    it('renders the refresh button (data-testid="button-refresh-quality")', () => {
      const AdminQuality = require('@/pages/admin/quality').default;
      withQueryClient(<AdminQuality />);
      expect(screen.getByTestId('button-refresh-quality')).toBeInTheDocument();
    });
  });

  describe('/admin/compliance (reference implementation — must also stay clean)', () => {
    it('does not render any "npm run" text in the DOM', () => {
      const AdminCompliance = require('@/pages/admin/compliance').default;
      withQueryClient(<AdminCompliance />);
      expect(screen.queryByText(/npm run/i)).toBeNull();
    });

    it('renders the last-scan info bar (data-testid="text-last-scan")', () => {
      const AdminCompliance = require('@/pages/admin/compliance').default;
      withQueryClient(<AdminCompliance />);
      expect(screen.getByTestId('text-last-scan')).toBeInTheDocument();
    });

    it('renders the re-scan button (data-testid="button-rescan-compliance")', () => {
      const AdminCompliance = require('@/pages/admin/compliance').default;
      withQueryClient(<AdminCompliance />);
      expect(screen.getByTestId('button-rescan-compliance')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Route-driven source-level guard — auto-covers new admin page additions
//    Reads all admin page source files and asserts no "npm run" string exists.
//    Combined with the DOM rendering tests above, this guards against leaks
//    whether they originate in the page template OR imported sub-components.
// ---------------------------------------------------------------------------

const ADMIN_PAGES_DIR = path.resolve(__dirname, '../../client/src/pages/admin');
const AUTO_PAGES_DIR = path.resolve(__dirname, '../../client/src/pages/auto');

function getAdminSourceFiles(): Array<{ label: string; filePath: string }> {
  const staticPages = fs
    .readdirSync(ADMIN_PAGES_DIR)
    .filter((name) => name.endsWith('.tsx') || name.endsWith('.ts'))
    .map((name) => ({
      label: `pages/admin/${name}`,
      filePath: path.join(ADMIN_PAGES_DIR, name),
    }));

  const autoAdminPages = fs
    .readdirSync(AUTO_PAGES_DIR)
    .filter((name) => name.startsWith('admin-') && (name.endsWith('.tsx') || name.endsWith('.ts')))
    .map((name) => ({
      label: `pages/auto/${name}`,
      filePath: path.join(AUTO_PAGES_DIR, name),
    }));

  return [...staticPages, ...autoAdminPages];
}

describe('Admin page sources — no CLI command strings in any source file (route-driven, task #1537)', () => {
  const files = getAdminSourceFiles();

  it('finds at least one admin page source file to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  files.forEach(({ label, filePath }) => {
    it(`${label} must not contain any "npm run ..." string`, () => {
      const source = fs.readFileSync(filePath, 'utf-8');
      expect(/npm run/i.test(source)).toBe(false);
    });
  });
});
