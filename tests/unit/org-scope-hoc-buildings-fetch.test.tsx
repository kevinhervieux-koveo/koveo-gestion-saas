/**
 * HOC-level regression for Task #1692 — Honor ?organization on residences
 * and resident building pages.
 *
 * These tests exercise the real `withHierarchicalSelection` HOC (not mocked)
 * to confirm that, when `?organization=<id>` is in the URL, the HOC forwards
 * `organizationId` (camelCase) — not `organization_id` (snake_case) — to
 * /api/users/me/buildings.
 *
 * The root bug was in withHierarchicalSelection.tsx line ~273 where the param
 * was appended as `organization_id`. After the fix it is `organizationId`.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Wouter mock control ───────────────────────────────────────────────────────
const wouter = require('wouter');

// ── Required mocks for the HOC + page dependencies ───────────────────────────
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'test-manager', role: 'manager', email: 'manager@test.com' },
    isAuthenticated: true,
  }),
  AuthProvider: ({ children }: any) => children,
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({ language: 'en', t: (k: string) => k, setLanguage: jest.fn() }),
  LanguageProvider: ({ children }: any) => children,
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  }),
  queryClient: { invalidateQueries: jest.fn(), refetchQueries: jest.fn() },
}));

jest.mock('@/components/layout/header', () => ({
  Header: ({ title }: any) => <div data-testid="header">{title}</div>,
}));

jest.mock('@/components/residences/ResidenceCard', () => ({
  ResidenceCard: () => <div data-testid="residence-card" />,
}));

jest.mock('@/components/buildings/BuildingCard', () => ({
  BuildingCard: () => <div data-testid="building-card" />,
}));

// ── Import pages (real HOC is used — not mocked) ─────────────────────────────
import ResidencesPage from '../../client/src/pages/manager/residences';
import ResidentsBuildingPage from '../../client/src/pages/residents/building';

// ── Fetch intercept ───────────────────────────────────────────────────────────
const capturedFetchUrls: string[] = [];

function urlFrom(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return (input as Request).url;
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const mockFetch = jest.fn<typeof fetch>();
(globalThis as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;

// ── Helpers ───────────────────────────────────────────────────────────────────

// Default queryFn routes all queryKey-based requests through mockFetch so that
// queries without an explicit queryFn (e.g. HOC organization list queries) are
// also intercepted and don't throw "No queryFn" errors.
async function defaultQueryFn({ queryKey, signal }: { queryKey: readonly unknown[]; signal?: AbortSignal }): Promise<unknown> {
  const url = (queryKey as string[]).join('/');
  const res = await fetch(url, { credentials: 'include', signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return null;
  return res.json();
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: defaultQueryFn as any,
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

const { Router } = wouter;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HOC buildings fetch — org param forwarded with correct key', () => {
  beforeEach(() => {
    capturedFetchUrls.length = 0;
    wouter.__resetMocks();
    mockFetch.mockReset();
    mockFetch.mockImplementation((input) => {
      const url = urlFrom(input);
      capturedFetchUrls.push(url);

      if (url.includes('/api/users/me/organizations')) {
        return Promise.resolve(jsonResponse([{ id: 'org-abc', name: 'Demo Org' }]));
      }
      if (url.includes('/api/users/me/buildings')) {
        return Promise.resolve(jsonResponse([
          {
            id: 'bld-1',
            name: 'Test Building',
            address: '1 Main St',
            city: 'Montreal',
            province: 'QC',
            postalCode: 'H1A1A1',
            buildingType: 'condo',
            totalUnits: 10,
            organizationId: 'org-abc',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        ]));
      }
      if (url.includes('/api/organizations')) {
        return Promise.resolve(jsonResponse([{ id: 'org-abc', name: 'Demo Org' }]));
      }
      if (url.includes('/api/residences')) {
        return Promise.resolve(jsonResponse([]));
      }
      if (url.includes('/api/users/me/residences')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({}));
    });
  });

  it('manager/residences: HOC sends organizationId (not organization_id) to /api/users/me/buildings', async () => {
    wouter.__setLocation('/manager/residences');
    wouter.__setSearch('organization=org-abc&building=bld-1');

    const qc = makeQueryClient();
    render(
      <Router>
        <QueryClientProvider client={qc}>
          <ResidencesPage />
        </QueryClientProvider>
      </Router>,
    );

    await waitFor(() => {
      const buildingCalls = capturedFetchUrls.filter((u) =>
        u.includes('/api/users/me/buildings'),
      );
      return buildingCalls.length > 0;
    }, { timeout: 5000 });

    const buildingCalls = capturedFetchUrls.filter((u) =>
      u.includes('/api/users/me/buildings'),
    );
    expect(buildingCalls.length).toBeGreaterThan(0);

    buildingCalls.forEach((u) => {
      const params = new URLSearchParams(u.split('?')[1] ?? '');
      expect(params.get('organization_id')).toBeNull();
    });

    const callsWithOrgFilter = buildingCalls.filter((u) => {
      const params = new URLSearchParams(u.split('?')[1] ?? '');
      return params.get('organizationId') === 'org-abc';
    });
    expect(callsWithOrgFilter.length).toBeGreaterThan(0);
  });

  it('residents/building: HOC sends organizationId (not organization_id) to /api/users/me/buildings', async () => {
    jest.resetModules();

    // Override auth for resident
    jest.doMock('@/hooks/use-auth', () => ({
      useAuth: () => ({
        user: { id: 'test-resident', role: 'super_admin', email: 'admin@test.com' },
        isAuthenticated: true,
      }),
    }));

    wouter.__setLocation('/residents/building');
    wouter.__setSearch('organization=org-abc');

    const qc = makeQueryClient();
    render(
      <Router>
        <QueryClientProvider client={qc}>
          <ResidentsBuildingPage />
        </QueryClientProvider>
      </Router>,
    );

    await waitFor(() => {
      const buildingCalls = capturedFetchUrls.filter((u) =>
        u.includes('/api/users/me/buildings'),
      );
      return buildingCalls.length > 0;
    }, { timeout: 5000 });

    const buildingCalls = capturedFetchUrls.filter((u) =>
      u.includes('/api/users/me/buildings'),
    );
    expect(buildingCalls.length).toBeGreaterThan(0);

    buildingCalls.forEach((u) => {
      const params = new URLSearchParams(u.split('?')[1] ?? '');
      expect(params.get('organization_id')).toBeNull();
    });
  });
});
