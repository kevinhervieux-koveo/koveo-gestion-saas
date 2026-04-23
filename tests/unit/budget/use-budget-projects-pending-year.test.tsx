/**
 * @file useBudgetProjects pending-year overlay tests
 * @description Regression tests for Task #246 — verifies that an entry in
 * the `pendingYears` Map passed into `useBudgetProjects` overrides the
 * server-supplied `financialYear` and that the override survives a query
 * refetch when the underlying server data is unchanged.
 *
 * The test pre-populates the React Query cache with the server payload
 * so the hook receives data synchronously (avoids React 19 + act-mode
 * flush quirks around async fetch in renderHook).
 */

import React from 'react';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useBudgetProjects } from '../../../client/src/pages/manager/budget/hooks/useBudgetProjects';

const BUILDING_ID = 'building-1';
const FY_START = '2025-01-01';
const QUERY_KEY = ['/api/maintenance/buildings', BUILDING_ID, 'projects'];

const SERVER_PROJECTS = {
  data: [
    {
      id: 'p1',
      title: 'Roof repair',
      totalBudget: '1000',
      actualCost: '0',
      financialYear: 2026,
      status: 'planned',
      type: 'maintenance',
      origin: 'manual',
      isQuickProject: false,
    },
    {
      id: 'p2',
      title: 'HVAC',
      totalBudget: '5000',
      actualCost: '0',
      financialYear: 2027,
      status: 'planned',
      type: 'maintenance',
      origin: 'manual',
      isQuickProject: false,
    },
  ],
};

function makeWrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function makeClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // The hook never actually fetches in this test — we prime the
        // cache below — but React Query still requires a queryFn to be
        // present, so we provide a no-op that returns whatever is
        // already cached for that key.
        queryFn: ({ queryKey }) => client.getQueryData(queryKey) ?? null,
      },
    },
  });
  client.setQueryData(QUERY_KEY, SERVER_PROJECTS);
  return client;
}

describe('useBudgetProjects — pendingYears overlay', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = makeClient();
  });

  it('returns the server financialYear when no pending override is supplied', async () => {
    const { result } = renderHook(
      () => useBudgetProjects(BUILDING_ID, FY_START, new Map()),
      { wrapper: makeWrapper(client) },
    );

    await waitFor(() => expect(result.current.projects).toHaveLength(2));
    const p1 = result.current.projects.find(p => p.id === 'p1');
    expect(p1?.financialYear).toBe(2026);
  });

  it('overrides the server financialYear when a pendingYears entry is present', async () => {
    const pending = new Map<string, number>([['p1', 2030]]);
    const { result } = renderHook(
      () => useBudgetProjects(BUILDING_ID, FY_START, pending),
      { wrapper: makeWrapper(client) },
    );

    await waitFor(() => expect(result.current.projects).toHaveLength(2));
    const p1 = result.current.projects.find(p => p.id === 'p1');
    const p2 = result.current.projects.find(p => p.id === 'p2');
    expect(p1?.financialYear).toBe(2030); // overridden by pendingYears
    expect(p2?.financialYear).toBe(2027); // untouched
  });

  it('preserves the override after a query refetch with unchanged server data', async () => {
    const pending = new Map<string, number>([['p1', 2030]]);
    const { result } = renderHook(
      () => useBudgetProjects(BUILDING_ID, FY_START, pending),
      { wrapper: makeWrapper(client) },
    );

    await waitFor(() => expect(result.current.projects).toHaveLength(2));
    expect(result.current.projects.find(p => p.id === 'p1')?.financialYear).toBe(2030);

    // Simulate a refetch that returns identical server data — the cache
    // is replaced with a structurally equal payload.
    await act(async () => {
      client.setQueryData(QUERY_KEY, {
        data: SERVER_PROJECTS.data.map(p => ({ ...p })),
      });
    });

    expect(result.current.projects.find(p => p.id === 'p1')?.financialYear).toBe(2030);
    expect(result.current.projects.find(p => p.id === 'p2')?.financialYear).toBe(2027);
  });
});
