/**
 * @file Overview project list — local-only fiscal-year offset
 * @description Regression tests for Task #246 — verifies that the
 * Previous/Next controls on the real `OverviewProjectCard` component
 * shift the displayed fiscal year locally without making any API
 * calls and that the offset is forgotten when the parent component
 * unmounts (i.e. it is purely component-state and never persisted).
 */

import React, { useState } from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';

import {
  OverviewProjectCard,
  type OverviewProjectCardProject,
} from '../../../client/src/pages/dashboard/components/OverviewProjectCard';

const apiCalls: Array<[string, RequestInit | undefined]> = [];

const MIN_YEAR = 2025;
const MAX_YEAR = MIN_YEAR + 25;

const t = (key: string) => key;

interface OverviewListProps {
  projects: Array<OverviewProjectCardProject & { baseYear: number }>;
}

/**
 * Mirrors the offset/onShift wiring used in
 * `client/src/pages/dashboard/overview.tsx` (lines ~1718-1753).
 * The card itself is the real production component.
 */
function OverviewProjectList({ projects }: OverviewListProps) {
  const [projectYearOffsets, setProjectYearOffsets] = useState<
    Map<string, number>
  >(new Map());

  return (
    <div>
      {projects.map(project => (
        <OverviewProjectCard
          key={project.id}
          project={project}
          baseYearLabel={String(project.baseYear)}
          baseYear={project.baseYear}
          offset={projectYearOffsets.get(project.id) ?? 0}
          minYear={MIN_YEAR}
          maxYear={MAX_YEAR}
          t={t}
          onShift={(id, delta) => {
            setProjectYearOffsets(prev => {
              const next = new Map(prev);
              const cur = (next.get(id) ?? 0) + delta;
              if (cur === 0) next.delete(id);
              else next.set(id, cur);
              return next;
            });
          }}
          onToggleInclude={() => undefined}
        />
      ))}
    </div>
  );
}

describe('OverviewProjectCard — fiscal-year offset is local-only', () => {
  beforeEach(() => {
    apiCalls.length = 0;
    globalThis.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        apiCalls.push([String(input), init]);
        return new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    ) as typeof fetch;
  });

  it('shifts the displayed year without making any API call', () => {
    render(
      <OverviewProjectList
        projects={[
          {
            id: 'p1',
            title: 'Roof repair',
            status: 'planned',
            baseYear: 2026,
            includeInBudget: true,
          },
        ]}
      />,
    );

    expect(screen.getByTestId('overview-fy-p1')).toHaveTextContent('2026');

    fireEvent.click(screen.getByTestId('button-overview-shift-next-p1'));
    expect(screen.getByTestId('overview-fy-p1')).toHaveTextContent('2027');

    fireEvent.click(screen.getByTestId('button-overview-shift-prev-p1'));
    fireEvent.click(screen.getByTestId('button-overview-shift-prev-p1'));
    expect(screen.getByTestId('overview-fy-p1')).toHaveTextContent('2025');

    expect(apiCalls).toHaveLength(0);
  });

  it('forgets the offset when the parent component unmounts', () => {
    const project: OverviewProjectCardProject & { baseYear: number } = {
      id: 'p1',
      title: 'Roof repair',
      status: 'planned',
      baseYear: 2026,
      includeInBudget: true,
    };

    const { unmount } = render(<OverviewProjectList projects={[project]} />);

    fireEvent.click(screen.getByTestId('button-overview-shift-next-p1'));
    fireEvent.click(screen.getByTestId('button-overview-shift-next-p1'));
    expect(screen.getByTestId('overview-fy-p1')).toHaveTextContent('2028');

    unmount();

    // Remount in a fresh React root — the parent's offset state is gone,
    // so the display falls back to the base year.
    render(<OverviewProjectList projects={[project]} />);
    expect(screen.getByTestId('overview-fy-p1')).toHaveTextContent('2026');
    expect(apiCalls).toHaveLength(0);
  });
});
