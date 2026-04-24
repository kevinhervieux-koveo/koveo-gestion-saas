/**
 * Tests for the GanttChart's horizontal scroll layout.
 *
 * These tests guard against the regressions described in the task:
 *   - When the chart spans many months, the inner timeline grid must be
 *     wider than the viewport so the user can scroll horizontally.
 *   - The labels column must use `position: sticky` so the project names
 *     stay visible while the timeline scrolls underneath them.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { GanttChart, type GanttProject } from '../../../client/src/components/GanttChart';

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
}));

function parsePx(value: string | null | undefined): number {
  if (!value) return 0;
  const match = value.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

describe('GanttChart horizontal scrolling layout', () => {
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
    {
      id: 'p3',
      title: 'Elevator modernization',
      status: 'submission',
      plannedStartDate: '2026-10-01',
      plannedEndDate: '2027-08-31',
    },
  ];

  // Two-year window forces many months on the timeline.
  const dateRange = { start: '2026-01-01', end: '2027-12-31' };

  it('makes the inner timeline grid wider than the viewport so it scrolls horizontally', () => {
    render(<GanttChart projects={projects} dateRange={dateRange} language="en" />);

    const scrollContainer = screen.getByTestId('gantt-scroll-container');
    // Tailwind class that enables horizontal scrolling on the wrapper.
    expect(scrollContainer).toHaveClass('overflow-x-auto');

    const innerGrid = scrollContainer.firstElementChild as HTMLElement | null;
    expect(innerGrid).not.toBeNull();

    const innerMinWidth = parsePx(innerGrid!.style.minWidth);
    // 24 months * 80px/month + 180px label column = 2100px, well above any
    // realistic viewport width used in the app.
    expect(innerMinWidth).toBeGreaterThan(window.innerWidth);
    expect(innerMinWidth).toBeGreaterThanOrEqual(180 + 24 * 80);

    // The timeline pane (the second grid cell, sibling of the labels column)
    // should itself reserve enough room for every month so the chart inside
    // it actually overflows horizontally.
    const labelsColumn = screen.getByTestId('gantt-labels');
    const timelinePane = labelsColumn.nextElementSibling as HTMLElement | null;
    expect(timelinePane).not.toBeNull();
    const timelineMinWidth = parsePx(timelinePane!.style.minWidth);
    expect(timelineMinWidth).toBeGreaterThanOrEqual(24 * 80);
    expect(timelineMinWidth).toBeGreaterThan(window.innerWidth - 180);
  });

  it('keeps the labels column pinned with position: sticky while scrolling', () => {
    render(<GanttChart projects={projects} dateRange={dateRange} language="en" />);

    const labels = screen.getByTestId('gantt-labels');
    expect(labels).toHaveStyle({ position: 'sticky', left: '0px' });

    // The labels column should also list each project so it's actually the
    // sticky element users see while scrolling.
    for (const project of projects) {
      expect(labels).toHaveTextContent(project.title);
    }
  });
});
