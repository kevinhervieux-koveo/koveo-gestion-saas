/**
 * Regression tests for Task #1692 — Honor ?organization on residences and
 * resident building pages.
 *
 * Both `/manager/residences?organization=<id>` and
 * `/residents/building?organization=<id>` were ignoring the query param,
 * causing super_admins and multi-org managers to see buildings from all
 * organizations clumped under whichever org header they picked.
 *
 * Fix summary:
 *   - manager/residences now forwards organizationId to /api/residences when
 *     no specific buildingId is selected.
 *   - residents/building now sends ?organizationId= (was incorrectly sending
 *     ?organization_id=) to /api/users/me/buildings.
 *
 * These tests assert that an ?organization=X URL causes each page to issue its
 * data-fetch request with the correct organizationId param so only buildings /
 * residences belonging to org X are requested from the backend.
 */

import React, { type ComponentType } from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Shared mock wiring ────────────────────────────────────────────────────────

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: jest.fn(),
    toggleLanguage: jest.fn(),
    t: (key: string) => key,
  }),
}));

jest.mock('@/components/layout/header', () => ({ Header: () => null }));

// Bypass the HOC — inject the organizationId prop directly so the inner
// component is always rendered (no picker interstitial in tests).
interface PageProps {
  organizationId?: string;
  buildingId?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  backButtonLabel?: React.ReactNode;
}

jest.mock('@/components/hoc/withHierarchicalSelection', () => ({
  withHierarchicalSelection: (Component: ComponentType<PageProps>, _opts?: unknown) => {
    const Wrapped = (props: PageProps) => <Component {...props} />;
    Wrapped.displayName = 'MockHOC';
    return Wrapped;
  },
}));

// Residences page extra mocks
jest.mock('@/components/residences/ResidenceCard', () => ({
  ResidenceCard: ({ residence }: { residence: { id: string } }) => (
    <div data-testid={`residence-card-${residence.id}`} />
  ),
}));

// Residents building page extra mocks
jest.mock('@/components/buildings/BuildingCard', () => ({
  BuildingCard: ({ building }: { building: { id: string } }) => (
    <div data-testid={`building-card-${building.id}`} />
  ),
}));

// ── Fetch intercept ───────────────────────────────────────────────────────────

const capturedUrls: string[] = [];
const mockFetch = jest.fn<typeof fetch>();
(globalThis as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;

const jsonResponse = (data: unknown): Response =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

function urlFrom(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return (input as Request).url;
}

// ── Page imports (after mocks) ────────────────────────────────────────────────

import ManagerResidences from '../../client/src/pages/manager/residences';
import ResidentsBuildingPage from '../../client/src/pages/residents/building';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

// ── /manager/residences ───────────────────────────────────────────────────────

describe('/manager/residences — org scope', () => {
  beforeEach(() => {
    capturedUrls.length = 0;
    mockFetch.mockReset();
    mockFetch.mockImplementation((input) => {
      const url = urlFrom(input);
      capturedUrls.push(url);
      if (url.includes('/api/residences')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({}));
    });
  });

  it('includes organizationId in the /api/residences request when org is selected and no building is selected', async () => {
    const qc = makeQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <ManagerResidences organizationId="org-abc-123" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      const residencesCalls = capturedUrls.filter((u) => u.includes('/api/residences'));
      expect(residencesCalls.length).toBeGreaterThan(0);
    });

    const residencesCalls = capturedUrls.filter((u) => u.includes('/api/residences'));
    const allHaveOrgId = residencesCalls.every((u) => {
      const params = new URLSearchParams(u.split('?')[1] ?? '');
      return params.get('organizationId') === 'org-abc-123';
    });
    expect(allHaveOrgId).toBe(true);
  });

  it('does NOT include organizationId when a specific building is already selected (buildingId takes precedence)', async () => {
    const qc = makeQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <ManagerResidences organizationId="org-abc-123" buildingId="bld-xyz-456" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      const residencesCalls = capturedUrls.filter((u) => u.includes('/api/residences'));
      expect(residencesCalls.length).toBeGreaterThan(0);
    });

    const residencesCalls = capturedUrls.filter((u) => u.includes('/api/residences'));
    const noneHaveOrgId = residencesCalls.every((u) => {
      const params = new URLSearchParams(u.split('?')[1] ?? '');
      return params.get('organizationId') === null;
    });
    expect(noneHaveOrgId).toBe(true);

    const allHaveBuildingId = residencesCalls.every((u) => {
      const params = new URLSearchParams(u.split('?')[1] ?? '');
      return params.get('buildingId') === 'bld-xyz-456';
    });
    expect(allHaveBuildingId).toBe(true);
  });
});

// ── /residents/building ───────────────────────────────────────────────────────

describe('/residents/building — org scope', () => {
  beforeEach(() => {
    capturedUrls.length = 0;
    mockFetch.mockReset();
    mockFetch.mockImplementation((input) => {
      const url = urlFrom(input);
      capturedUrls.push(url);
      if (url.includes('/api/users/me/buildings')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({}));
    });
  });

  it('sends ?organizationId= (not organization_id=) to /api/users/me/buildings', async () => {
    const qc = makeQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <ResidentsBuildingPage organizationId="org-abc-123" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      const buildingCalls = capturedUrls.filter((u) => u.includes('/api/users/me/buildings'));
      expect(buildingCalls.length).toBeGreaterThan(0);
    });

    const buildingCalls = capturedUrls.filter((u) => u.includes('/api/users/me/buildings'));
    buildingCalls.forEach((u) => {
      const params = new URLSearchParams(u.split('?')[1] ?? '');
      expect(params.get('organizationId')).toBe('org-abc-123');
      expect(params.get('organization_id')).toBeNull();
    });
  });

  it('omits organizationId from the request when no org is provided', async () => {
    const qc = makeQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <ResidentsBuildingPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      const buildingCalls = capturedUrls.filter((u) => u.includes('/api/users/me/buildings'));
      expect(buildingCalls.length).toBeGreaterThan(0);
    });

    const buildingCalls = capturedUrls.filter((u) => u.includes('/api/users/me/buildings'));
    buildingCalls.forEach((u) => {
      const params = new URLSearchParams(u.split('?')[1] ?? '');
      expect(params.get('organizationId')).toBeNull();
    });
  });
});
