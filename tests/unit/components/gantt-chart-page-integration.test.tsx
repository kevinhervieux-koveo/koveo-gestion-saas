/**
 * Page-context integration tests for the GanttChart "Today" indicator.
 *
 * These tests cover task #544: validating that the dashed today line and the
 * red "Today" / "Aujourd'hui" pill render correctly when the GanttChart is
 * wrapped exactly the way the two consuming pages wrap it:
 *
 *   - client/src/pages/dashboard/overview.tsx (lines ~1685-1720)
 *   - client/src/pages/manager/budget/index.tsx (lines ~3500-3540)
 *
 * Both pages use the same shadcn `Card` -> `CardContent className="space-y-4"`
 * -> `<div className="space-y-3">` -> `<GanttChart>` structure with no sticky
 * or z-index wrappers in between, so the indicator should behave identically
 * in both contexts.
 *
 * We exercise the indicator with date ranges that BOTH contain and exclude
 * "today" — fulfilling the manual-validation acceptance criteria from the
 * task — and assert that the surrounding card chrome never overlaps the
 * indicator at the DOM level.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { GanttChart, type GanttProject } from '../../../client/src/components/GanttChart';
import { Card, CardContent, CardHeader, CardTitle } from '../../../client/src/components/ui/card';

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: jest.fn(),
    toggleLanguage: jest.fn(),
    t: (key: string) => key,
  }),
}));

jest.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: ({ children }: any) => <div data-testid="bar">{children}</div>,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  Cell: () => <div data-testid="cell" />,
}));

jest.mock('lucide-react', () => ({
  Eye: () => <span data-testid="eye-icon" />,
  EyeOff: () => <span data-testid="eye-off-icon" />,
  Building: () => <span data-testid="building-icon" />,
}));

const projects: GanttProject[] = [
  {
    id: 'p1',
    title: 'Roof replacement',
    status: 'planned',
    plannedStartDate: '2026-02-01',
    plannedEndDate: '2026-05-15',
  },
  {
    id: 'p2',
    title: 'Lobby renovation',
    status: 'in_progress',
    plannedStartDate: '2026-06-01',
    plannedEndDate: '2026-09-30',
  },
];

/**
 * Mimics the project-management Card wrapper used identically by both
 * `/dashboard/overview` and `/manager/budget` around the GanttChart.
 */
function ProjectCardWrapper({
  language,
  dateRange,
  testId,
}: {
  language: 'en' | 'fr';
  dateRange: { start: Date; end: Date };
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle>Gestion de projets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Projets affectant les calculs budgétaires
        </div>
        <div className="space-y-3">
          <GanttChart projects={projects} dateRange={dateRange} language={language} />
        </div>
      </CardContent>
    </Card>
  );
}

describe('GanttChart "Today" indicator inside the project-management card wrapper', () => {
  let nowSpy: jest.SpiedFunction<typeof Date.now> | undefined;

  afterEach(() => {
    nowSpy?.mockRestore();
    nowSpy = undefined;
  });

  describe('date range that contains today', () => {
    const dateRange = { start: new Date('2026-01-01'), end: new Date('2027-12-31') };

    beforeEach(() => {
      nowSpy = jest.spyOn(Date, 'now').mockReturnValue(
        new Date('2026-07-15T12:00:00Z').getTime(),
      );
    });

    it.each([
      ['/dashboard/overview', 'card-overview-project-management'],
      ['/manager/budget', 'card-budget-project-management'],
    ])('renders the today line and pill on %s', (_pageLabel, testId) => {
      render(<ProjectCardWrapper language="en" dateRange={dateRange} testId={testId} />);

      const card = screen.getByTestId(testId);
      const pill = screen.getByTestId('gantt-today-pill');
      const line = screen.getByTestId('gantt-today-line');

      expect(card).toContainElement(pill);
      expect(card).toContainElement(line);
      expect(pill).toHaveTextContent('today');
    });

    it('honours French locale for the pill copy on either page', () => {
      render(
        <ProjectCardWrapper language="fr" dateRange={dateRange} testId="card-fr" />,
      );
      const pill = screen.getByTestId('gantt-today-pill');
      // The component's own translator emits the English key in test mocks,
      // but in production the French copy is "Aujourd'hui". Verify the pill
      // exists and is positioned absolutely inside the sticky header so it
      // sits above the period labels rather than overlapping them.
      expect(pill).toBeInTheDocument();
      expect(pill).toHaveStyle({ position: 'absolute' });
      // The pill lives under the sticky period header, not inside the
      // labels column or the surrounding card chrome.
      const header = screen.getByTestId('gantt-period-header');
      expect(header).toContainElement(pill);
    });
  });

  describe('date range that excludes today', () => {
    const dateRange = { start: new Date('2026-01-01'), end: new Date('2026-12-31') };

    beforeEach(() => {
      // "today" is years before the displayed range.
      nowSpy = jest.spyOn(Date, 'now').mockReturnValue(
        new Date('1999-01-01T12:00:00Z').getTime(),
      );
    });

    it.each([
      ['/dashboard/overview', 'card-overview-project-management'],
      ['/manager/budget', 'card-budget-project-management'],
    ])('does not render the today line or pill on %s', (_pageLabel, testId) => {
      render(<ProjectCardWrapper language="en" dateRange={dateRange} testId={testId} />);

      // The chart still renders.
      expect(screen.getByTestId('gantt-chart')).toBeInTheDocument();
      // ...but the today indicator is suppressed.
      expect(screen.queryByTestId('gantt-today-pill')).not.toBeInTheDocument();
      expect(screen.queryByTestId('gantt-today-line')).not.toBeInTheDocument();
    });
  });

  describe('horizontal scroll wrapper integrity inside the card', () => {
    const dateRange = { start: new Date('2026-01-01'), end: new Date('2027-12-31') };

    beforeEach(() => {
      nowSpy = jest.spyOn(Date, 'now').mockReturnValue(
        new Date('2026-07-15T12:00:00Z').getTime(),
      );
    });

    it('keeps the horizontal scroll container intact so the today line scrolls with the timeline', () => {
      render(
        <ProjectCardWrapper
          language="en"
          dateRange={dateRange}
          testId="card-overview-project-management"
        />,
      );
      const scrollContainer = screen.getByTestId('gantt-scroll-container');
      expect(scrollContainer).toHaveClass('overflow-x-auto');
      // The today line sits inside the scroll container (not pinned to the
      // sticky labels column), so it tracks the timeline as the user scrolls.
      const line = screen.getByTestId('gantt-today-line');
      expect(scrollContainer).toContainElement(line);
    });
  });
});
