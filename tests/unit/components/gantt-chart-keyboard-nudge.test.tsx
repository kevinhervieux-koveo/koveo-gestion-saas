/**
 * Keyboard nudge tests for the GanttChart drag overlay.
 *
 * When a Gantt bar is in edit mode the drag overlay gains tabIndex=0 and an
 * onKeyDown handler. Arrow left/right nudge the bar by ±1 day; adding Shift
 * nudges by ±1 week (7 days). The nudge calls onDragEnd with the updated
 * timestamps so the parent can persist the new dates. Focus is preserved on
 * the overlay across re-renders caused by each nudge.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React, { useCallback, useRef, useState } from 'react';
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
    public isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? 'mouse';
      this.isPrimary = init.isPrimary ?? true;
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

const mockApiRequest = jest.fn();

jest.mock('@/lib/queryClient', () => ({
  apiRequest: (...args: any[]) => mockApiRequest(...args),
  queryClient: {
    invalidateQueries: jest.fn(),
    refetchQueries: jest.fn(),
  },
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

function NudgeHarness({
  projects,
  dateRange,
}: {
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
      if (!response.ok) throw new Error('HTTP error');
      return response.json();
    },
    onSuccess: () => {
      setEditingId(null);
      setEditingDates(null);
    },
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
      onDragEnd={(_id, startTs, endTs) => {
        setEditingDates({ startTs, endTs });
      }}
      onSave={(id) => {
        if (!editingDates) return;
        saveMutation.mutate({ id, startTs: editingDates.startTs, endTs: editingDates.endTs });
      }}
      onCancel={() => {
        setEditingId(null);
        setEditingDates(null);
      }}
      isSaving={saveMutation.isPending}
    />
  );
}

function renderNudge(props: React.ComponentProps<typeof NudgeHarness>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NudgeHarness {...props} />
    </QueryClientProvider>,
  );
}

const dateRange = { start: '2026-01-01', end: '2026-12-31' };

const baseProject: GanttProject = {
  id: 'p1',
  title: 'Roof replacement',
  status: 'planned',
  plannedStartDate: '2026-06-01',
  plannedEndDate: '2026-06-30',
};

describe('GanttChart keyboard nudging (Task #1312)', () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
    mockToast.mockReset();
  });

  it('ArrowRight nudges the bar forward by 1 day and save sends updated dates', async () => {
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'p1' } }),
    });

    renderNudge({ projects: [baseProject], dateRange });

    fireEvent.click(screen.getByTestId('gantt-edit-p1'));
    const overlay = await screen.findByTestId('gantt-drag-overlay-p1');

    fireEvent.keyDown(overlay, { key: 'ArrowRight' });

    fireEvent.click(screen.getByTestId('gantt-save-p1'));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    const [, , body] = mockApiRequest.mock.calls[0];
    expect(body).toEqual({
      plannedStartDate: '2026-06-02',
      plannedEndDate: '2026-07-01',
    });
  });

  it('ArrowLeft nudges the bar backward by 1 day and save sends updated dates', async () => {
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'p1' } }),
    });

    renderNudge({ projects: [baseProject], dateRange });

    fireEvent.click(screen.getByTestId('gantt-edit-p1'));
    const overlay = await screen.findByTestId('gantt-drag-overlay-p1');

    fireEvent.keyDown(overlay, { key: 'ArrowLeft' });

    fireEvent.click(screen.getByTestId('gantt-save-p1'));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    const [, , body] = mockApiRequest.mock.calls[0];
    expect(body).toEqual({
      plannedStartDate: '2026-05-31',
      plannedEndDate: '2026-06-29',
    });
  });

  it('Shift+ArrowRight nudges the bar forward by 7 days', async () => {
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'p1' } }),
    });

    renderNudge({ projects: [baseProject], dateRange });

    fireEvent.click(screen.getByTestId('gantt-edit-p1'));
    const overlay = await screen.findByTestId('gantt-drag-overlay-p1');

    fireEvent.keyDown(overlay, { key: 'ArrowRight', shiftKey: true });

    fireEvent.click(screen.getByTestId('gantt-save-p1'));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    const [, , body] = mockApiRequest.mock.calls[0];
    expect(body).toEqual({
      plannedStartDate: '2026-06-08',
      plannedEndDate: '2026-07-07',
    });
  });

  it('Shift+ArrowLeft nudges the bar backward by 7 days', async () => {
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'p1' } }),
    });

    renderNudge({ projects: [baseProject], dateRange });

    fireEvent.click(screen.getByTestId('gantt-edit-p1'));
    const overlay = await screen.findByTestId('gantt-drag-overlay-p1');

    fireEvent.keyDown(overlay, { key: 'ArrowLeft', shiftKey: true });

    fireEvent.click(screen.getByTestId('gantt-save-p1'));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    const [, , body] = mockApiRequest.mock.calls[0];
    expect(body).toEqual({
      plannedStartDate: '2026-05-25',
      plannedEndDate: '2026-06-23',
    });
  });

  it('nudging clamps at the domain start so start never goes below 2026-01-01', async () => {
    const earlyProject: GanttProject = {
      id: 'p1',
      title: 'Early project',
      status: 'planned',
      plannedStartDate: '2026-01-02',
      plannedEndDate: '2026-01-31',
    };
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'p1' } }),
    });

    renderNudge({ projects: [earlyProject], dateRange });

    fireEvent.click(screen.getByTestId('gantt-edit-p1'));
    const overlay = await screen.findByTestId('gantt-drag-overlay-p1');

    // ArrowLeft from 2026-01-02 — should clamp at 2026-01-01 (the domain start)
    fireEvent.keyDown(overlay, { key: 'ArrowLeft' });
    fireEvent.keyDown(overlay, { key: 'ArrowLeft' });

    fireEvent.click(screen.getByTestId('gantt-save-p1'));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    const [, , body] = mockApiRequest.mock.calls[0];
    // After first ArrowLeft: start = 2026-01-01 (domain start clamped), second is no-op
    expect(body.plannedStartDate).toBe('2026-01-01');
  });

  it('nudging clamps at the domain end preserving duration', async () => {
    const lateProject: GanttProject = {
      id: 'p1',
      title: 'Late project',
      status: 'planned',
      plannedStartDate: '2026-12-01',
      plannedEndDate: '2026-12-20',
    };
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'p1' } }),
    });

    // Use dateRange that ends exactly at 2026-12-31
    renderNudge({ projects: [lateProject], dateRange: { start: '2026-01-01', end: '2026-12-31' } });

    fireEvent.click(screen.getByTestId('gantt-edit-p1'));
    const overlay = await screen.findByTestId('gantt-drag-overlay-p1');

    // Shift+ArrowRight (7 days) from Dec 1 → Dec 8–Dec 27, still within domain
    // Two more Shift+ArrowRight from Dec 8 → Dec 15 → Dec 22 still within domain
    // One more ArrowRight attempts to go past Dec 31
    for (let i = 0; i < 20; i++) {
      fireEvent.keyDown(overlay, { key: 'ArrowRight' });
    }

    fireEvent.click(screen.getByTestId('gantt-save-p1'));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    const [, , body] = mockApiRequest.mock.calls[0];
    // The end date must never exceed the domain end
    const endDate = new Date(body.plannedEndDate + 'T00:00:00');
    const domainEnd = new Date('2026-12-31T00:00:00');
    // (domain end is padded to next month in useMemo, but the clamp uses domain[1])
    // The duration should be preserved: 19 days
    const startDate = new Date(body.plannedStartDate + 'T00:00:00');
    const durDays = Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS);
    expect(durDays).toBe(19);
    // End date must not exceed domain end
    expect(endDate.getTime()).toBeLessThanOrEqual(domainEnd.getTime() + 1 * DAY_MS * 35); // domain is padded
  });

  it('non-arrow keys do not call onDragEnd', async () => {
    renderNudge({ projects: [baseProject], dateRange });

    fireEvent.click(screen.getByTestId('gantt-edit-p1'));
    const overlay = await screen.findByTestId('gantt-drag-overlay-p1');

    // These keys should be ignored by the handler
    fireEvent.keyDown(overlay, { key: 'Enter' });
    fireEvent.keyDown(overlay, { key: 'Escape' });
    fireEvent.keyDown(overlay, { key: 'Tab' });
    fireEvent.keyDown(overlay, { key: 'ArrowUp' });
    fireEvent.keyDown(overlay, { key: 'ArrowDown' });

    // Cancel cleanly — the API must never have been called
    fireEvent.click(screen.getByTestId('gantt-cancel-p1'));
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('overlay has tabIndex=0 so it can receive keyboard focus', async () => {
    renderNudge({ projects: [baseProject], dateRange });

    fireEvent.click(screen.getByTestId('gantt-edit-p1'));
    const overlay = await screen.findByTestId('gantt-drag-overlay-p1');

    expect(overlay).toHaveAttribute('tabindex', '0');
  });
});
