/**
 * @file Budget project card — financial-year shift controls
 * @description Regression tests for Task #246 — exercises the
 * Previous / Next / Confirm flow on the real `BudgetProjectCard`
 * component used by the manager budget page.
 *
 *  - Previous decrements the displayed financial year.
 *  - Next increments the displayed financial year.
 *  - The buttons disable at the min/max boundary defined by the
 *    same expression used in production
 *    (currentFinancialYear .. new Date().getFullYear() + 25).
 *  - The "Unsaved change" badge appears once an offset is set.
 *  - Clicking Confirm fires a PATCH to /api/maintenance/projects/:id
 *    with the new financialYear.
 */

import React, { useState } from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';

import { BudgetProjectCard } from '../../../client/src/pages/manager/budget/components/BudgetProjectCard';
import type { Project } from '../../../client/src/pages/manager/budget/types';

type ApiRequestArgs = [method: string, url: string, body?: unknown];
const apiRequestMock = jest.fn(async (..._args: ApiRequestArgs) =>
  new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }),
);

jest.mock('@/lib/queryClient', () => ({
  apiRequest: (...args: ApiRequestArgs) => apiRequestMock(...args),
  queryClient: new (jest.requireActual('@tanstack/react-query') as typeof import('@tanstack/react-query')).QueryClient(),
  getQueryFn: () => async () => null,
}));

import { apiRequest } from '@/lib/queryClient';

// Match the production expression used in
// `client/src/pages/manager/budget/index.tsx` for the shift bounds.
const MIN_YEAR = 2025; // currentFinancialYear (start of FY in tests)
const MAX_YEAR = new Date().getFullYear() + 25;

function makeProject(overrides: Partial<Project>): Project {
  return {
    id: 'p1',
    title: 'Roof repair',
    totalBudget: 1000,
    actualCost: 0,
    financialYear: 2026,
    status: 'planned',
    type: 'maintenance',
    origin: 'manual',
    isQuickProject: false,
    includeInBudget: true,
    ...overrides,
  };
}

const t = (key: string) => key;

interface HarnessProps {
  initialProjects: Project[];
}

function Harness({ initialProjects }: HarnessProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [pendingYears, setPendingYears] = useState<Map<string, number>>(new Map());

  const confirm = useMutation({
    mutationFn: async ({ id, financialYear }: { id: string; financialYear: number }) => {
      await apiRequest('PATCH', `/api/maintenance/projects/${id}`, { financialYear });
      return { id, financialYear };
    },
    onSuccess: ({ id }) => {
      setPendingYears(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    },
  });

  const visibleProjects = projects.map(p => {
    const pending = pendingYears.get(p.id);
    return pending !== undefined ? { ...p, financialYear: pending } : p;
  });

  return (
    <div>
      {visibleProjects.map(project => {
        const hasPendingYear = pendingYears.has(project.id);
        const isConfirming =
          confirm.isPending && confirm.variables?.id === project.id;
        return (
          <BudgetProjectCard
            key={project.id}
            project={project}
            hasPendingYear={hasPendingYear}
            isConfirming={isConfirming}
            minShiftableYear={MIN_YEAR}
            maxShiftableYear={MAX_YEAR}
            language="en"
            t={t}
            deleteQuickProjectPending={false}
            onShiftYear={(p, delta) => {
              const nextYear = p.financialYear + delta;
              if (nextYear < MIN_YEAR || nextYear > MAX_YEAR) return;
              setPendingYears(prev => {
                const next = new Map(prev);
                next.set(p.id, nextYear);
                return next;
              });
            }}
            onConfirmYear={p =>
              confirm.mutate({ id: p.id, financialYear: p.financialYear })
            }
            onToggleInclude={() => undefined}
            onEdit={() => undefined}
            onDeleteQuickProject={() => undefined}
          />
        );
      })}
    </div>
  );
}

function renderHarness(initialProjects: Project[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Harness initialProjects={initialProjects} />
    </QueryClientProvider>,
  );
}

describe('BudgetProjectCard — financial-year shift', () => {
  beforeEach(() => {
    apiRequestMock.mockClear();
  });

  it('decrements the displayed year on Previous and increments on Next', async () => {
    renderHarness([makeProject({ id: 'p1', financialYear: 2026 })]);

    const card = screen.getByTestId('budget-project-card-p1');
    expect(card).toHaveTextContent('Financial Year: 2026');

    fireEvent.click(screen.getByTestId('button-shift-prev-year-p1'));
    await waitFor(() =>
      expect(screen.getByTestId('budget-project-card-p1')).toHaveTextContent(
        'Financial Year: 2025',
      ),
    );

    fireEvent.click(screen.getByTestId('button-shift-next-year-p1'));
    fireEvent.click(screen.getByTestId('button-shift-next-year-p1'));
    await waitFor(() =>
      expect(screen.getByTestId('budget-project-card-p1')).toHaveTextContent(
        'Financial Year: 2027',
      ),
    );
  });

  it('disables Previous at the minimum year and Next at the maximum year', () => {
    renderHarness([
      makeProject({ id: 'p-low', financialYear: MIN_YEAR }),
      makeProject({ id: 'p-high', financialYear: MAX_YEAR }),
    ]);

    expect(screen.getByTestId('button-shift-prev-year-p-low')).toBeDisabled();
    expect(screen.getByTestId('button-shift-next-year-p-low')).not.toBeDisabled();

    expect(screen.getByTestId('button-shift-next-year-p-high')).toBeDisabled();
    expect(screen.getByTestId('button-shift-prev-year-p-high')).not.toBeDisabled();
  });

  it('shows the "Unsaved change" badge once a shift is staged', async () => {
    renderHarness([makeProject({ id: 'p1', financialYear: 2026 })]);

    expect(screen.queryByTestId('badge-pending-year-p1')).toBeNull();
    expect(screen.queryByTestId('button-confirm-year-p1')).toBeNull();

    fireEvent.click(screen.getByTestId('button-shift-next-year-p1'));

    await waitFor(() =>
      expect(screen.getByTestId('badge-pending-year-p1')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('badge-pending-year-p1')).toHaveTextContent(
      'Unsaved change',
    );
    expect(screen.getByTestId('button-confirm-year-p1')).toBeInTheDocument();
  });

  it('PATCHes /api/maintenance/projects/:id with the new financialYear when Confirm is clicked', async () => {
    renderHarness([makeProject({ id: 'p1', financialYear: 2026 })]);

    fireEvent.click(screen.getByTestId('button-shift-next-year-p1'));
    await waitFor(() =>
      expect(screen.getByTestId('budget-project-card-p1')).toHaveTextContent(
        'Financial Year: 2027',
      ),
    );

    fireEvent.click(screen.getByTestId('button-confirm-year-p1'));

    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1));
    expect(apiRequestMock).toHaveBeenCalledWith(
      'PATCH',
      '/api/maintenance/projects/p1',
      { financialYear: 2027 },
    );
  });
});
