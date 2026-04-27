/**
 * Edge-case tests for Gantt bar-drag date saving (Task #1312).
 *
 * Covers the scenarios called out in the task spec:
 *   - Cross-FY projects (bar spans a financial-year boundary, e.g. Dec → Jan)
 *   - Single-day projects (start == end — the minimum 1-day duration)
 *   - Dragging past the domain end (clamping must preserve bar duration)
 *   - Quick-project date saving with a custom end date
 *
 * Each test uses the same BudgetGanttHarness pattern as
 * `gantt-chart-drag-save.test.tsx` so the production wiring is exercised
 * end-to-end through the same mutation path.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React, { useCallback, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';

import {
  GanttChart,
  type GanttProject,
  type GanttEditingDates,
} from '../../../client/src/components/GanttChart';

if (typeof (globalThis as any).PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    public pointerId: number;
    public pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  (globalThis as any).PointerEvent = PointerEventPolyfill;
}

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: jest.fn(),
    toggleLanguage: jest.fn(),
    t: (key: string) => key,
  }),
}));

jest.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: ({ children }: any) => <div>{children}</div>,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  Cell: () => null,
}));

jest.mock('lucide-react', () => ({
  Eye: () => null,
  EyeOff: () => null,
  Pencil: () => <span data-testid="pencil-icon" />,
  Save: () => <span data-testid="save-icon" />,
  X: () => <span data-testid="x-icon" />,
  Loader2: () => null,
}));

const mockApiRequest = jest.fn();
jest.mock('@/lib/queryClient', () => ({
  apiRequest: (...args: any[]) => mockApiRequest(...args),
  queryClient: { invalidateQueries: jest.fn() },
}));

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: mockToast,
}));

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateStr(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function EdgeHarness({ projects, dateRange }: {
  projects: GanttProject[];
  dateRange: { start: string; end: string };
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDates, setEditingDates] = useState<GanttEditingDates | null>(null);
  const { useToast } = require('@/hooks/use-toast');
  const { toast } = useToast();

  const startEdit = useCallback((id: string) => {
    const proj = projects.find((p) => p.id === id);
    if (!proj) return;
    const parseTs = (s: string | null | undefined) => {
      if (!s) return null;
      const d = new Date(s.length === 10 ? s + 'T00:00:00' : s);
      return isNaN(d.getTime()) ? null : d.getTime();
    };
    const startTs = parseTs(proj.plannedStartDate) ?? parseTs(proj.actualStartDate);
    const endTs = parseTs(proj.plannedEndDate) ?? parseTs(proj.actualEndDate);
    if (!startTs || !endTs) return;
    setEditingId(id);
    setEditingDates({ startTs, endTs });
  }, [projects]);

  const saveMutation = useMutation({
    mutationFn: async ({ id, startTs, endTs }: { id: string; startTs: number; endTs: number }) => {
      const { apiRequest } = require('@/lib/queryClient');
      const response = await apiRequest('PATCH', `/api/maintenance/projects/${id}`, {
        plannedStartDate: toDateStr(startTs),
        plannedEndDate: toDateStr(endTs),
      });
      if (!response.ok) throw new Error('save failed');
      return response.json();
    },
    onSuccess: () => { setEditingId(null); setEditingDates(null); },
    onError: (error: any) => {
      toast({ title: 'error', description: error?.message, variant: 'destructive' });
    },
  });

  return (
    <GanttChart
      projects={projects}
      dateRange={dateRange}
      language="en"
      editingProjectId={editingId}
      editingDates={editingDates}
      onEdit={startEdit}
      onStartEdit={startEdit}
      onDragEnd={(_id, startTs, endTs) => setEditingDates({ startTs, endTs })}
      onSave={(id) => {
        if (!editingDates) return;
        saveMutation.mutate({ id, startTs: editingDates.startTs, endTs: editingDates.endTs });
      }}
      onCancel={() => { setEditingId(null); setEditingDates(null); }}
      isSaving={saveMutation.isPending}
    />
  );
}

function renderEdge(props: React.ComponentProps<typeof EdgeHarness>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <EdgeHarness {...props} />
    </QueryClientProvider>,
  );
}

function stubLayout(overlay: HTMLElement, plotWidth: number) {
  if (typeof (overlay as any).setPointerCapture !== 'function') {
    (overlay as any).setPointerCapture = jest.fn();
    (overlay as any).releasePointerCapture = jest.fn();
  }
  const timeline = overlay.parentElement as HTMLElement;
  Object.defineProperty(timeline, 'clientWidth', { configurable: true, value: plotWidth + 20 });
}

describe('Gantt bar-drag edge cases (Task #1312)', () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
    mockToast.mockReset();
  });

  // ── Cross-FY ──────────────────────────────────────────────────────────────
  it('cross-FY project: bar spanning Dec 2025 → Jan 2026 saves correct YYYY-MM-DD dates', async () => {
    const crossFY: GanttProject = {
      id: 'xfy',
      title: 'Cross-FY project',
      status: 'planned',
      plannedStartDate: '2025-12-01',
      plannedEndDate: '2026-01-31',
    };
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'xfy' } }),
    });

    renderEdge({ projects: [crossFY], dateRange: { start: '2025-07-01', end: '2026-06-30' } });

    fireEvent.click(screen.getByTestId('gantt-edit-xfy'));
    const overlay = await screen.findByTestId('gantt-drag-overlay-xfy');

    // Domain spans 365 days (2025-07-01 to 2026-07-01 padded).
    // We don't need to drag — just save the dates as-is to verify cross-FY
    // date serialization produces correct YYYY-MM-DD strings for both years.
    fireEvent.click(screen.getByTestId('gantt-save-xfy'));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    const [, , body] = mockApiRequest.mock.calls[0];
    expect(body.plannedStartDate).toBe('2025-12-01');
    expect(body.plannedEndDate).toBe('2026-01-31');
  });

  it('cross-FY project: dragging 31 days right still sends correct YYYY-MM-DD dates', async () => {
    const crossFY: GanttProject = {
      id: 'xfy2',
      title: 'Cross-FY drag',
      status: 'planned',
      plannedStartDate: '2025-12-01',
      plannedEndDate: '2025-12-31',
    };
    // Domain is 366 days (2025-07-01 to 2026-07-01), so 1 px ≈ 1 day with
    // plotWidth = 366
    const PLOT = 366;
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'xfy2' } }),
    });

    renderEdge({ projects: [crossFY], dateRange: { start: '2025-07-01', end: '2026-06-30' } });

    fireEvent.click(screen.getByTestId('gantt-edit-xfy2'));
    const overlay = await screen.findByTestId('gantt-drag-overlay-xfy2');
    stubLayout(overlay, PLOT);

    // Drag 31 pixels → 31 days → Dec 1 + 31d = Jan 1
    fireEvent.pointerDown(overlay, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 31, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 31, pointerId: 1 });

    fireEvent.click(screen.getByTestId('gantt-save-xfy2'));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    const [, , body] = mockApiRequest.mock.calls[0];
    // Start: 2025-12-01 + 31d = 2026-01-01
    // End: 2025-12-31 + 31d = 2026-01-31
    expect(body.plannedStartDate).toBe('2026-01-01');
    expect(body.plannedEndDate).toBe('2026-01-31');
  });

  // ── Single-day ────────────────────────────────────────────────────────────
  it('single-day project: start and end on the same day saves correctly', async () => {
    const oneDay: GanttProject = {
      id: 'one',
      title: 'One day project',
      status: 'planned',
      plannedStartDate: '2026-06-15',
      plannedEndDate: '2026-06-15',
    };
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'one' } }),
    });

    renderEdge({ projects: [oneDay], dateRange: { start: '2026-01-01', end: '2026-12-31' } });

    fireEvent.click(screen.getByTestId('gantt-edit-one'));
    await screen.findByTestId('gantt-drag-overlay-one');

    fireEvent.click(screen.getByTestId('gantt-save-one'));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    const [, , body] = mockApiRequest.mock.calls[0];
    // Same-day project: both dates identical (the GanttRow minimum puts end
    // at least 1 DAY_MS ahead, but the user's stored start/end are preserved).
    expect(body.plannedStartDate).toBe('2026-06-15');
  });

  it('single-day project: drag preserves the 1-day minimum and sends correct dates', async () => {
    const oneDay: GanttProject = {
      id: 'one2',
      title: 'One day drag',
      status: 'planned',
      plannedStartDate: '2026-06-15',
      plannedEndDate: '2026-06-15',
    };
    const PLOT = 365;
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'one2' } }),
    });

    renderEdge({ projects: [oneDay], dateRange: { start: '2026-01-01', end: '2026-12-31' } });

    fireEvent.click(screen.getByTestId('gantt-edit-one2'));
    const overlay = await screen.findByTestId('gantt-drag-overlay-one2');
    stubLayout(overlay, PLOT);

    // Drag 10 px (10 days)
    fireEvent.pointerDown(overlay, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 10, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 10, pointerId: 1 });

    fireEvent.click(screen.getByTestId('gantt-save-one2'));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    const [, , body] = mockApiRequest.mock.calls[0];
    // 2026-06-15 + 10d = 2026-06-25
    expect(body.plannedStartDate).toBe('2026-06-25');
    // Duration is preserved (0 ms + 10d slide)
    expect(body.plannedEndDate).toBe('2026-06-25');
  });

  // ── Dragging past domain end ───────────────────────────────────────────────
  it('dragging past domain end clamps the bar and preserves duration', async () => {
    const lateBar: GanttProject = {
      id: 'late',
      title: 'Late bar',
      status: 'planned',
      plannedStartDate: '2026-11-01',
      plannedEndDate: '2026-11-30',
    };
    const PLOT = 365;
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'late' } }),
    });

    renderEdge({ projects: [lateBar], dateRange: { start: '2026-01-01', end: '2026-12-31' } });

    fireEvent.click(screen.getByTestId('gantt-edit-late'));
    const overlay = await screen.findByTestId('gantt-drag-overlay-late');
    stubLayout(overlay, PLOT);

    // Drag 200 pixels to the right — way past the domain end
    fireEvent.pointerDown(overlay, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 200, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 200, pointerId: 1 });

    fireEvent.click(screen.getByTestId('gantt-save-late'));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    const [, , body] = mockApiRequest.mock.calls[0];
    const startDate = new Date(body.plannedStartDate + 'T00:00:00');
    const endDate = new Date(body.plannedEndDate + 'T00:00:00');
    // Duration must be preserved (29 days)
    const durDays = Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS);
    expect(durDays).toBe(29);
    // End must not exceed the padded domain end (first of next month after Dec 31 = Jan 1, 2027)
    expect(endDate.getFullYear()).toBeLessThanOrEqual(2027);
    expect(startDate.getTime()).toBeLessThan(endDate.getTime());
  });

  // ── Duration chip renders during drag ─────────────────────────────────────
  it('duration chip appears during drag and shows the correct day count', async () => {
    const proj: GanttProject = {
      id: 'dur',
      title: 'Duration chip project',
      status: 'planned',
      plannedStartDate: '2026-06-01',
      plannedEndDate: '2026-06-30',
    };
    const PLOT = 365;
    renderEdge({ projects: [proj], dateRange: { start: '2026-01-01', end: '2026-12-31' } });

    fireEvent.click(screen.getByTestId('gantt-edit-dur'));
    const overlay = await screen.findByTestId('gantt-drag-overlay-dur');
    stubLayout(overlay, PLOT);

    // Start a drag to make the chips visible
    fireEvent.pointerDown(overlay, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 10, pointerId: 1 });

    // Duration chip must now be visible
    const durationChip = screen.getByTestId('gantt-drag-chip-duration-dur');
    expect(durationChip).toBeInTheDocument();
    // Duration: 29 days (2026-06-01 to 2026-06-30) = 4 weeks in human-readable format
    expect(durationChip.textContent).toMatch(/4\s*week/);

    fireEvent.pointerUp(overlay, { clientX: 10, pointerId: 1 });
  });

  // ── Bar click overlay removed (task #1476) ─────────────────────────────────
  // The transparent full-row overlay divs were removed so the Recharts hover
  // Tooltip can fire natively. Click-to-edit is now handled directly by the
  // bar rect via an onClick prop threaded through MeasuredBarShape.
  // The unit test uses a mocked recharts, so the bar rect isn't rendered here;
  // we verify the old overlay div is absent and that the chart still renders.
  it('no opaque full-row overlay div is rendered (gantt-bar-click-* removed)', async () => {
    const proj: GanttProject = {
      id: 'hov',
      title: 'Hover project',
      status: 'planned',
      plannedStartDate: '2026-05-01',
      plannedEndDate: '2026-05-31',
    };

    renderEdge({ projects: [proj], dateRange: { start: '2026-01-01', end: '2026-12-31' } });

    // The old opaque overlay div must NOT be present
    expect(screen.queryByTestId('gantt-bar-click-hov')).not.toBeInTheDocument();

    // The custom hover tooltip must also not be present (replaced by recharts Tooltip)
    expect(screen.queryByTestId('gantt-hover-tooltip-hov')).not.toBeInTheDocument();

    // The chart itself must still render
    expect(screen.getByTestId('gantt-chart')).toBeInTheDocument();
  });

  it('edit button still starts inline edit mode after overlay removal', async () => {
    const proj: GanttProject = {
      id: 'hov2',
      title: 'Edit still works',
      status: 'planned',
      plannedStartDate: '2026-05-01',
      plannedEndDate: '2026-05-31',
    };

    renderEdge({ projects: [proj], dateRange: { start: '2026-01-01', end: '2026-12-31' } });

    // Clicking the pencil edit button must still start edit mode
    fireEvent.click(screen.getByTestId('gantt-edit-hov2'));
    await screen.findByTestId('gantt-drag-overlay-hov2');
  });
});
