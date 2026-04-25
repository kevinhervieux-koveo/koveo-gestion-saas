/**
 * Unit tests for the GanttChart's drag overlay gestures (task #832).
 *
 * The chart's drag overlay supports three pointer gestures:
 *   - move (slide whole bar) on `gantt-drag-overlay-${id}`
 *   - resize-left  on `gantt-resize-left-${id}`
 *   - resize-right on `gantt-resize-right-${id}`
 *
 * These tests exercise the pointerdown / pointermove / pointerup flow for
 * each mode and validate the clamping rules:
 *   - slide preserves duration and clamps to the domain edges
 *   - resize-left only moves the start (clamped to domain start and to
 *     end - 1 day)
 *   - resize-right only moves the end (clamped to domain end and to
 *     start + 1 day)
 */

import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import {
  GanttChart,
  type GanttProject,
  type GanttEditingDates,
} from '../../../client/src/components/GanttChart';
import { parseDateOnly } from '../../../client/src/lib/utils';

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
  Pencil: () => <span data-testid="pencil-icon" />,
  Save: () => <span data-testid="save-icon" />,
  X: () => <span data-testid="x-icon" />,
  Loader2: () => <span data-testid="loader-icon" />,
}));

// PointerEvent + setPointerCapture / releasePointerCapture / hasPointerCapture
// polyfills for jsdom live in `jest.setup.simple.ts` so every test that
// exercises pointer gestures gets the same shim.

const DAY_MS = 24 * 60 * 60 * 1000;
const RECHARTS_RIGHT_MARGIN = 20;

const PROJECT_ID = 'p1';
const projects: GanttProject[] = [
  {
    id: PROJECT_ID,
    title: 'Roof replacement',
    status: 'planned',
    plannedStartDate: '2026-06-01',
    plannedEndDate: '2026-06-30',
  },
];

// Date range that covers all of 2026. After the component pads to month
// boundaries we get Jan 1 2026 → Jan 1 2027, a span of exactly 365 days
// (DST transitions cancel out across the full year in DST-observing zones).
const DATE_RANGE = { start: '2026-01-01', end: '2026-12-31' };

const startMs = parseDateOnly('2026-06-01')!.getTime();
const endMs = parseDateOnly('2026-06-30')!.getTime();
const domainStartMs = parseDateOnly('2026-01-01')!.getTime();
const domainEndMs = parseDateOnly('2027-01-01')!.getTime();
const domainSpanMs = domainEndMs - domainStartMs;

// Choose a plot width such that 1 pixel == 1 day (365 days in span).
// timelineEl.clientWidth - RECHARTS_RIGHT_MARGIN must equal 365.
const PLOT_PX = Math.round(domainSpanMs / DAY_MS); // 365
const TIMELINE_CLIENT_WIDTH = PLOT_PX + RECHARTS_RIGHT_MARGIN; // 385

const initialEditing: GanttEditingDates = { startTs: startMs, endTs: endMs };

interface RenderResult {
  onDragEnd: jest.Mock;
  overlay: HTMLElement;
  resizeLeft: HTMLElement;
  resizeRight: HTMLElement;
}

function renderChart(): RenderResult {
  const onDragEnd = jest.fn();
  render(
    <GanttChart
      projects={projects}
      dateRange={DATE_RANGE}
      language="en"
      editingProjectId={PROJECT_ID}
      editingDates={initialEditing}
      onStartEdit={jest.fn()}
      onSave={jest.fn()}
      onCancel={jest.fn()}
      onDragEnd={onDragEnd}
    />,
  );

  const overlay = screen.getByTestId(`gantt-drag-overlay-${PROJECT_ID}`);
  const resizeLeft = screen.getByTestId(`gantt-resize-left-${PROJECT_ID}`);
  const resizeRight = screen.getByTestId(`gantt-resize-right-${PROJECT_ID}`);

  // The drag overlay's parent is the scrollable timeline div whose
  // clientWidth is read by handlePointerMove. JSDOM defaults clientWidth
  // to 0, so we override it for this specific element.
  const timeline = overlay.parentElement!;
  Object.defineProperty(timeline, 'clientWidth', {
    configurable: true,
    value: TIMELINE_CLIENT_WIDTH,
  });

  return { onDragEnd, overlay, resizeLeft, resizeRight };
}

function performGesture(
  target: HTMLElement,
  fromX: number,
  toX: number,
): void {
  act(() => {
    fireEvent.pointerDown(target, {
      clientX: fromX,
      pointerId: 1,
      button: 0,
    });
  });
  act(() => {
    fireEvent.pointerMove(target, {
      clientX: toX,
      pointerId: 1,
    });
  });
  act(() => {
    fireEvent.pointerUp(target, {
      clientX: toX,
      pointerId: 1,
    });
  });
}

describe('GanttChart drag overlay gestures', () => {
  describe('slide (move) gesture', () => {
    it('shifts both start and end by the same delta when the bar is slid', () => {
      const { onDragEnd, overlay } = renderChart();

      // Move +10 px == +10 days.
      performGesture(overlay, 100, 110);

      expect(onDragEnd).toHaveBeenCalledTimes(1);
      const [projectId, newStart, newEnd] = onDragEnd.mock.calls[0] as [
        string,
        number,
        number,
      ];
      expect(projectId).toBe(PROJECT_ID);

      const startDelta = newStart - startMs;
      const endDelta = newEnd - endMs;
      expect(startDelta).toBe(endDelta);
      expect(startDelta).toBe(10 * DAY_MS);
      // Duration is preserved.
      expect(newEnd - newStart).toBe(endMs - startMs);
    });

    it('clamps the slide at the left domain edge while preserving duration', () => {
      const { onDragEnd, overlay } = renderChart();
      const duration = endMs - startMs;

      // Drag far to the left — well past the domain start.
      performGesture(overlay, 200, -200);

      expect(onDragEnd).toHaveBeenCalledTimes(1);
      const [, newStart, newEnd] = onDragEnd.mock.calls[0] as [
        string,
        number,
        number,
      ];
      expect(newStart).toBe(domainStartMs);
      expect(newEnd).toBe(domainStartMs + duration);
    });

    it('clamps the slide at the right domain edge while preserving duration', () => {
      const { onDragEnd, overlay } = renderChart();
      const duration = endMs - startMs;

      // Drag far to the right — well past the domain end.
      performGesture(overlay, 0, 1000);

      expect(onDragEnd).toHaveBeenCalledTimes(1);
      const [, newStart, newEnd] = onDragEnd.mock.calls[0] as [
        string,
        number,
        number,
      ];
      expect(newEnd).toBe(domainEndMs);
      expect(newStart).toBe(domainEndMs - duration);
    });
  });

  describe('resize-left handle', () => {
    it('moves only the start date when the left edge is dragged', () => {
      const { onDragEnd, resizeLeft } = renderChart();

      // Drag the left edge +5 px == +5 days.
      performGesture(resizeLeft, 50, 55);

      expect(onDragEnd).toHaveBeenCalledTimes(1);
      const [, newStart, newEnd] = onDragEnd.mock.calls[0] as [
        string,
        number,
        number,
      ];
      expect(newStart - startMs).toBe(5 * DAY_MS);
      expect(newEnd).toBe(endMs);
    });

    it('clamps the start at the domain start when dragged past it', () => {
      const { onDragEnd, resizeLeft } = renderChart();

      performGesture(resizeLeft, 200, -300);

      expect(onDragEnd).toHaveBeenCalledTimes(1);
      const [, newStart, newEnd] = onDragEnd.mock.calls[0] as [
        string,
        number,
        number,
      ];
      expect(newStart).toBe(domainStartMs);
      expect(newEnd).toBe(endMs);
    });

    it('keeps a minimum 1-day duration when the start is dragged toward the end', () => {
      const { onDragEnd, resizeLeft } = renderChart();

      // Drag far to the right — would push start past end.
      performGesture(resizeLeft, 0, 500);

      expect(onDragEnd).toHaveBeenCalledTimes(1);
      const [, newStart, newEnd] = onDragEnd.mock.calls[0] as [
        string,
        number,
        number,
      ];
      expect(newEnd).toBe(endMs);
      expect(newEnd - newStart).toBe(DAY_MS);
      expect(newStart).toBe(endMs - DAY_MS);
    });
  });

  describe('resize-right handle', () => {
    it('moves only the end date when the right edge is dragged', () => {
      const { onDragEnd, resizeRight } = renderChart();

      // Drag the right edge +7 px == +7 days.
      performGesture(resizeRight, 50, 57);

      expect(onDragEnd).toHaveBeenCalledTimes(1);
      const [, newStart, newEnd] = onDragEnd.mock.calls[0] as [
        string,
        number,
        number,
      ];
      expect(newStart).toBe(startMs);
      expect(newEnd - endMs).toBe(7 * DAY_MS);
    });

    it('clamps the end at the domain end when dragged past it', () => {
      const { onDragEnd, resizeRight } = renderChart();

      performGesture(resizeRight, 0, 1000);

      expect(onDragEnd).toHaveBeenCalledTimes(1);
      const [, newStart, newEnd] = onDragEnd.mock.calls[0] as [
        string,
        number,
        number,
      ];
      expect(newStart).toBe(startMs);
      expect(newEnd).toBe(domainEndMs);
    });

    it('keeps a minimum 1-day duration when the end is dragged toward the start', () => {
      const { onDragEnd, resizeRight } = renderChart();

      // Drag far to the left — would push end past start.
      performGesture(resizeRight, 500, 0);

      expect(onDragEnd).toHaveBeenCalledTimes(1);
      const [, newStart, newEnd] = onDragEnd.mock.calls[0] as [
        string,
        number,
        number,
      ];
      expect(newStart).toBe(startMs);
      expect(newEnd - newStart).toBe(DAY_MS);
      expect(newEnd).toBe(startMs + DAY_MS);
    });
  });

  describe('resize-handle pointerdown isolation', () => {
    it('does not also trigger the slide/move gesture when a resize handle is used', () => {
      // If stopPropagation were missing, the parent overlay's onPointerDown
      // would also fire and we would end up in 'move' mode on pointerup,
      // shifting BOTH dates. We assert only the start moves.
      const { onDragEnd, resizeLeft } = renderChart();
      performGesture(resizeLeft, 100, 103);

      expect(onDragEnd).toHaveBeenCalledTimes(1);
      const [, newStart, newEnd] = onDragEnd.mock.calls[0] as [
        string,
        number,
        number,
      ];
      expect(newEnd).toBe(endMs);
      expect(newStart - startMs).toBe(3 * DAY_MS);
    });
  });
});
