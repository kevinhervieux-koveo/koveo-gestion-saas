/**
 * @file Overview project list — Confirm persists fiscal-year shift
 * @description Regression tests for Task #319 — verifies that the
 * `OverviewProjectCard` exposes a Confirm action that persists a
 * shifted fiscal year via `PATCH /api/maintenance/projects/:id` and
 * clears the local offset on success (mirroring the manager budget
 * page's `confirmProjectYearMutation` behaviour).
 */

import React, { useState } from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';

import {
  OverviewProjectCard,
  type OverviewProjectCardProject,
} from '../../../client/src/pages/dashboard/components/OverviewProjectCard';

type ApiRequestArgs = [method: string, url: string, body?: unknown];
const apiRequestMock = jest.fn(async (..._args: ApiRequestArgs) =>
  new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }),
);

jest.mock('@/lib/queryClient', () => ({
  apiRequest: (...args: ApiRequestArgs) => apiRequestMock(...args),
  queryClient: new (jest.requireActual(
    '@tanstack/react-query',
  ) as typeof import('@tanstack/react-query')).QueryClient(),
  getQueryFn: () => async () => null,
}));

import { apiRequest } from '@/lib/queryClient';

const MIN_YEAR = 2025;
const MAX_YEAR = MIN_YEAR + 25;

const t = (key: string) => key;

interface OverviewListProps {
  projects: Array<OverviewProjectCardProject & { baseYear: number }>;
}

/**
 * Mirrors the offset/onShift/onConfirmYear wiring used in
 * `client/src/pages/dashboard/overview.tsx`.
 */
function OverviewProjectList({ projects }: OverviewListProps) {
  const [projectYearOffsets, setProjectYearOffsets] = useState<
    Map<string, number>
  >(new Map());

  const confirm = useMutation({
    mutationFn: async ({
      id,
      financialYear,
    }: {
      id: string;
      financialYear: number;
    }) => {
      await apiRequest('PATCH', `/api/maintenance/projects/${id}`, {
        financialYear,
      });
      return { id, financialYear };
    },
    onSuccess: ({ id }) => {
      setProjectYearOffsets(prev => {
        if (!prev.has(id)) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    },
  });

  return (
    <div>
      {projects.map(project => {
        const isConfirming =
          confirm.isPending && confirm.variables?.id === project.id;
        return (
          <OverviewProjectCard
            key={project.id}
            project={project}
            baseYearLabel={String(project.baseYear)}
            baseYear={project.baseYear}
            offset={projectYearOffsets.get(project.id) ?? 0}
            minYear={MIN_YEAR}
            maxYear={MAX_YEAR}
            t={t}
            language="en"
            isConfirming={isConfirming}
            onShift={(id, delta) => {
              setProjectYearOffsets(prev => {
                const next = new Map(prev);
                const cur = (next.get(id) ?? 0) + delta;
                if (cur === 0) next.delete(id);
                else next.set(id, cur);
                return next;
              });
            }}
            onConfirmYear={(id, financialYear) =>
              confirm.mutate({ id, financialYear })
            }
            onToggleInclude={() => undefined}
          />
        );
      })}
    </div>
  );
}

function renderList(
  projects: Array<OverviewProjectCardProject & { baseYear: number }>,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <OverviewProjectList projects={projects} />
    </QueryClientProvider>,
  );
}

describe('OverviewProjectCard — Confirm persists fiscal-year shift', () => {
  beforeEach(() => {
    apiRequestMock.mockClear();
  });

  it('hides the Confirm button and "Unsaved change" badge until the year is shifted', () => {
    renderList([
      {
        id: 'p1',
        title: 'Roof repair',
        status: 'planned',
        baseYear: 2026,
        includeInBudget: true,
      },
    ]);

    expect(
      screen.queryByTestId('button-overview-confirm-year-p1'),
    ).toBeNull();
    expect(
      screen.queryByTestId('badge-overview-pending-year-p1'),
    ).toBeNull();
  });

  it('reveals the Confirm button and "Unsaved change" badge once a shift is staged', async () => {
    renderList([
      {
        id: 'p1',
        title: 'Roof repair',
        status: 'planned',
        baseYear: 2026,
        includeInBudget: true,
      },
    ]);

    fireEvent.click(screen.getByTestId('button-overview-shift-next-p1'));

    await waitFor(() =>
      expect(
        screen.getByTestId('badge-overview-pending-year-p1'),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByTestId('button-overview-confirm-year-p1'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('overview-fy-p1')).toHaveTextContent('2027');
  });

  it('PATCHes /api/maintenance/projects/:id with the shifted financialYear and clears the local offset on success', async () => {
    renderList([
      {
        id: 'p1',
        title: 'Roof repair',
        status: 'planned',
        baseYear: 2026,
        includeInBudget: true,
      },
    ]);

    fireEvent.click(screen.getByTestId('button-overview-shift-next-p1'));
    fireEvent.click(screen.getByTestId('button-overview-shift-next-p1'));
    await waitFor(() =>
      expect(screen.getByTestId('overview-fy-p1')).toHaveTextContent('2028'),
    );

    fireEvent.click(screen.getByTestId('button-overview-confirm-year-p1'));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1));
    expect(apiRequestMock).toHaveBeenCalledWith(
      'PATCH',
      '/api/maintenance/projects/p1',
      { financialYear: 2028 },
    );

    // Offset is cleared once the mutation succeeds — the displayed year
    // falls back to the baseYear and the Confirm/badge disappear.
    await waitFor(() =>
      expect(screen.getByTestId('overview-fy-p1')).toHaveTextContent('2026'),
    );
    expect(
      screen.queryByTestId('badge-overview-pending-year-p1'),
    ).toBeNull();
    expect(
      screen.queryByTestId('button-overview-confirm-year-p1'),
    ).toBeNull();
  });
});
