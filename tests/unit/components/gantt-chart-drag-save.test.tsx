/**
 * Tests for the Gantt drag-to-reschedule save flow.
 *
 * The `<GanttChart>` is rendered inside a small harness that mirrors the wiring
 * used by `client/src/pages/manager/budget/index.tsx` (around lines 3700-3790
 * and the `saveGanttDatesMutation` defined around line 1269). The harness
 * connects the Gantt's `onStartEdit` / `onDragEnd` / `onSave` / `onCancel`
 * callbacks to a real `useMutation` that calls `apiRequest('PATCH',
 * '/api/maintenance/projects/:id', ...)` so we exercise the same flow that
 * runs in production.
 *
 * Coverage:
 *   - Dragging a bar then clicking Save sends YYYY-MM-DD `plannedStartDate` and
 *     `plannedEndDate` for the dragged ts to the maintenance PATCH endpoint
 *     (regression guard for Task #818).
 *   - Clicking Cancel restores the bar to its original position and never
 *     touches the API.
 *   - Clicking Edit on a different row while one row is already being edited
 *     prompts the user to discard their unsaved changes.
 *   - When the PATCH call fails, the mutation's `onError` fires a destructive
 *     toast with the translated "Failed to save dates" message and the row
 *     stays in edit mode so the user can retry (Task #838 regression guard).
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

// jsdom 26 ships without a global `PointerEvent` constructor, so testing-
// library's `fireEvent.pointerDown` etc. fall back to a bare `Event` whose
// `clientX` is `undefined`. The Gantt's drag handlers compute
// `e.clientX - dragStartX.current`, which would otherwise yield `NaN` and
// poison the resulting plannedStartDate / plannedEndDate. Polyfilling
// `PointerEvent` from `MouseEvent` gives us real clientX/pointerId values.
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

/**
 * Fixed plot width (`clientWidth - RECHARTS_RIGHT_MARGIN`) chosen so that the
 * drag math works out to exactly 1 day per pixel for our 365-day domain.
 *
 *   plotWidth = 365 px
 *   domainSpan = (2027-01-01) - (2026-01-01) = 365 days
 *   ⇒ 1 px == 86_400_000 ms == 1 day
 */
const STUB_CLIENT_WIDTH = 385; // RECHARTS_RIGHT_MARGIN is 20

/**
 * Mirror the date-formatting helper used inside `saveGanttDatesMutation` in
 * `client/src/pages/manager/budget/index.tsx` so the test asserts the same
 * format the production code emits.
 */
function toDateStr(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Test harness that mirrors the relevant slice of `BudgetPage` wiring around
 * `<GanttChart>`. It owns `ganttEditingId` / `ganttEditingDates` state, runs a
 * real `useMutation` against the mocked `apiRequest`, and exposes the same
 * discard prompt the page uses when switching rows.
 */
function BudgetGanttHarness({
  projects,
  dateRange,
  language = 'en',
}: {
  projects: GanttProject[];
  dateRange: { start: string; end: string };
  language?: 'en' | 'fr';
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDates, setEditingDates] = useState<GanttEditingDates | null>(null);
  const originalDates = useRef<GanttEditingDates | null>(null);
  const { useToast } = require('@/hooks/use-toast');
  const { toast } = useToast();

  const confirmDiscard = useCallback((): boolean => {
    if (!editingId) return true;
    if (!confirm('ganttDiscardUnsaved')) return false;
    setEditingId(null);
    setEditingDates(null);
    originalDates.current = null;
    return true;
  }, [editingId]);

  const saveMutation = useMutation({
    mutationFn: async ({ id, startTs, endTs }: { id: string; startTs: number; endTs: number }) => {
      const { apiRequest } = require('@/lib/queryClient');
      const response = await apiRequest('PATCH', `/api/maintenance/projects/${id}`, {
        plannedStartDate: toDateStr(startTs),
        plannedEndDate: toDateStr(endTs),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      setEditingId(null);
      setEditingDates(null);
      originalDates.current = null;
    },
    // Mirrors `saveGanttDatesMutation.onError` in
    // `client/src/pages/manager/budget/index.tsx` (around line 1291): a
    // destructive toast with `t('error')` as the title and either the thrown
    // error's message or the translated "Failed to save dates" fallback as
    // the description. We deliberately do NOT clear `editingId` /
    // `editingDates` here so the row stays in edit mode for the user to retry.
    onError: (error: any) => {
      toast({
        title: 'error',
        description:
          error?.message ||
          (language === 'fr' ? 'Échec de la sauvegarde des dates' : 'Failed to save dates'),
        variant: 'destructive',
      });
    },
  });

  return (
    <GanttChart
      projects={projects}
      dateRange={dateRange}
      language="en"
      editingProjectId={editingId}
      editingDates={editingDates}
      onStartEdit={(id) => {
        if (editingId && editingId !== id) {
          if (!confirmDiscard()) return;
        }
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
        const dates = { startTs, endTs };
        originalDates.current = dates;
        setEditingId(id);
        setEditingDates(dates);
      }}
      onDragEnd={(_id, startTs, endTs) => {
        setEditingDates({ startTs, endTs });
      }}
      onSave={(id) => {
        if (!editingDates) return;
        saveMutation.mutate({
          id,
          startTs: editingDates.startTs,
          endTs: editingDates.endTs,
        });
      }}
      onCancel={() => {
        setEditingId(null);
        setEditingDates(null);
        originalDates.current = null;
      }}
      isSaving={saveMutation.isPending}
    />
  );
}

function renderHarness(props: React.ComponentProps<typeof BudgetGanttHarness>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BudgetGanttHarness {...props} />
    </QueryClientProvider>,
  );
}

/**
 * Stub layout-dependent APIs that jsdom does not implement. The drag handlers
 * call `setPointerCapture` (no-op in tests) and read `clientWidth` to convert
 * pixels into milliseconds.
 */
function stubLayoutFor(overlay: HTMLElement, plotWidth: number) {
  // setPointerCapture is not implemented in jsdom.
  if (typeof (overlay as any).setPointerCapture !== 'function') {
    (overlay as any).setPointerCapture = jest.fn();
    (overlay as any).releasePointerCapture = jest.fn();
  }
  const timeline = overlay.parentElement as HTMLElement | null;
  if (!timeline) throw new Error('Drag overlay has no parent timeline element');
  Object.defineProperty(timeline, 'clientWidth', {
    configurable: true,
    value: plotWidth + 20, // RECHARTS_RIGHT_MARGIN
  });
}

describe('GanttChart drag-to-reschedule save flow (Task #818 regression guards)', () => {
  const dateRange = { start: '2026-01-01', end: '2026-12-31' };

  const baseProjects: GanttProject[] = [
    {
      id: 'p1',
      title: 'Roof replacement',
      status: 'planned',
      plannedStartDate: '2026-06-01',
      plannedEndDate: '2026-06-30',
    },
    {
      id: 'p2',
      title: 'Lobby renovation',
      status: 'planned',
      plannedStartDate: '2026-08-01',
      plannedEndDate: '2026-08-31',
    },
  ];

  beforeEach(() => {
    mockApiRequest.mockReset();
    mockToast.mockReset();
  });

  it('sends the dragged plannedStartDate / plannedEndDate to PATCH /api/maintenance/projects/:id', async () => {
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'p1' } }),
    });

    renderHarness({ projects: baseProjects, dateRange });

    // 1. Enter edit mode on the first project.
    fireEvent.click(screen.getByTestId('gantt-edit-p1'));

    const overlay = await screen.findByTestId('gantt-drag-overlay-p1');
    stubLayoutFor(overlay, /* plotWidth */ 365);

    // 2. Drag 30 px to the right. With 1 px == 1 day, this shifts the bar by
    //    exactly 30 days.
    fireEvent.pointerDown(overlay, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 30, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 30, pointerId: 1 });

    // 3. Click Save.
    fireEvent.click(screen.getByTestId('gantt-save-p1'));

    // 4. Verify the PATCH call.
    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    const [method, url, body] = mockApiRequest.mock.calls[0];
    expect(method).toBe('PATCH');
    expect(url).toBe('/api/maintenance/projects/p1');
    // The dates must be sent as bare YYYY-MM-DD strings (no timezone shift)
    // because the maintenance PATCH handler validates them with
    // `z.string().optional()` and stores them as date-only values. Sending an
    // ISO timestamp would either fail validation or roll the date back a day
    // for users west of UTC.
    expect(body).toEqual({
      plannedStartDate: '2026-07-01', // 2026-06-01 + 30 days
      plannedEndDate: '2026-07-30',   // 2026-06-30 + 30 days
    });

    // 5. After a successful save, the row exits edit mode (the Save button is
    //    removed and the Edit button comes back).
    await waitFor(() => {
      expect(screen.queryByTestId('gantt-save-p1')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('gantt-edit-p1')).toBeInTheDocument();
  });

  it('Cancel restores the bar to its original position without calling the API', async () => {
    renderHarness({ projects: baseProjects, dateRange });

    // Capture the original drag-overlay position once edit mode is on.
    fireEvent.click(screen.getByTestId('gantt-edit-p1'));

    const overlay = await screen.findByTestId('gantt-drag-overlay-p1');
    const originalLeft = overlay.style.left;
    const originalWidth = overlay.style.width;
    expect(originalLeft).toBeTruthy();
    expect(originalWidth).toBeTruthy();

    stubLayoutFor(overlay, 365);

    // Drag 60 px right (60 days) to make sure the overlay actually moves.
    fireEvent.pointerDown(overlay, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 60, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 60, pointerId: 1 });

    // Sanity: the overlay's left moved after the drag committed to parent state.
    await waitFor(() => {
      const movedOverlay = screen.getByTestId('gantt-drag-overlay-p1');
      expect(movedOverlay.style.left).not.toBe(originalLeft);
    });

    // Click Cancel.
    fireEvent.click(screen.getByTestId('gantt-cancel-p1'));

    // The row must have left edit mode entirely (no overlay, no Save, no
    // Cancel) and the Edit button must come back.
    await waitFor(() => {
      expect(screen.queryByTestId('gantt-drag-overlay-p1')).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('gantt-save-p1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gantt-cancel-p1')).not.toBeInTheDocument();
    expect(screen.getByTestId('gantt-edit-p1')).toBeInTheDocument();

    // No PATCH should have been issued.
    expect(mockApiRequest).not.toHaveBeenCalled();

    // Re-entering edit mode should restore the original ts (and therefore the
    // overlay's left/width) — proving the parent state was not mutated.
    fireEvent.click(screen.getByTestId('gantt-edit-p1'));
    const restored = await screen.findByTestId('gantt-drag-overlay-p1');
    expect(restored.style.left).toBe(originalLeft);
    expect(restored.style.width).toBe(originalWidth);
  });

  it('clicking Edit on a second row while one row is editing prompts to discard unsaved changes', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    try {
      renderHarness({ projects: baseProjects, dateRange });

      // Begin editing row 1.
      fireEvent.click(screen.getByTestId('gantt-edit-p1'));
      await screen.findByTestId('gantt-drag-overlay-p1');

      // The Edit button on the second row remains visible (it is not disabled
      // for the not-currently-editing rows so the user can switch rows).
      const editP2 = screen.getByTestId('gantt-edit-p2');
      expect(editP2).toBeInTheDocument();

      // Clicking the second row's Edit MUST prompt for discard.
      fireEvent.click(editP2);
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(confirmSpy).toHaveBeenCalledWith('ganttDiscardUnsaved');

      // Because the user said "no" (mocked return false), row 1 must still be
      // the editing row and row 2 must NOT have entered edit mode.
      expect(screen.getByTestId('gantt-drag-overlay-p1')).toBeInTheDocument();
      expect(screen.queryByTestId('gantt-drag-overlay-p2')).not.toBeInTheDocument();
      expect(screen.getByTestId('gantt-save-p1')).toBeInTheDocument();

      // Now say "yes" to discard, click Edit on row 2 again — row 1 should
      // exit edit mode and row 2 should enter it.
      confirmSpy.mockReturnValue(true);
      fireEvent.click(screen.getByTestId('gantt-edit-p2'));
      expect(confirmSpy).toHaveBeenCalledTimes(2);

      await waitFor(() => {
        expect(screen.queryByTestId('gantt-drag-overlay-p1')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId('gantt-drag-overlay-p2')).toBeInTheDocument();
      expect(screen.getByTestId('gantt-save-p2')).toBeInTheDocument();
      expect(screen.getByTestId('gantt-edit-p1')).toBeInTheDocument();

      // Switching rows via Edit must NOT have made any API call — only Save
      // ever calls PATCH.
      expect(mockApiRequest).not.toHaveBeenCalled();
    } finally {
      confirmSpy.mockRestore();
    }
  });

  // Task #838 regression guard: when the maintenance PATCH fails, the
  // mutation's onError must surface a destructive toast AND the row must
  // remain in edit mode so the user can retry. If onError silently breaks
  // (or `ganttEditingId` / `ganttEditingDates` get reset on failure), users
  // would either lose feedback or lose their unsaved drag — both regressions.
  it('shows a destructive "Failed to save dates" toast and stays in edit mode when the PATCH fails', async () => {
    // Resolve with `ok: false` and an empty body so:
    //   - mutationFn throws `new Error('HTTP 500')` if status is set, or
    //   - we control the message via the rejection below.
    // We use a plain rejection here so the fallback "Failed to save dates"
    // copy in `onError` is exercised (error.message is the empty string).
    mockApiRequest.mockRejectedValue(new Error(''));

    renderHarness({ projects: baseProjects, dateRange });

    // 1. Enter edit mode and drag the bar so editingDates is set.
    fireEvent.click(screen.getByTestId('gantt-edit-p1'));
    const overlay = await screen.findByTestId('gantt-drag-overlay-p1');
    stubLayoutFor(overlay, /* plotWidth */ 365);

    fireEvent.pointerDown(overlay, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 30, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 30, pointerId: 1 });

    // 2. Click Save and let the rejected mutation settle.
    fireEvent.click(screen.getByTestId('gantt-save-p1'));

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    // 3. The destructive toast must fire with the translated fallback copy.
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledTimes(1);
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'error',
        description: 'Failed to save dates',
        variant: 'destructive',
      }),
    );

    // 4. The row must STAY in edit mode (Save + Cancel buttons + drag overlay
    //    still visible, Edit button still hidden) so the user can retry the
    //    save without redoing the drag.
    expect(screen.getByTestId('gantt-save-p1')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-cancel-p1')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-drag-overlay-p1')).toBeInTheDocument();
    expect(screen.queryByTestId('gantt-edit-p1')).not.toBeInTheDocument();
  });

  // Companion regression guard: when the server responds with `ok: false` and
  // a structured error body, the mutationFn re-throws using `errorData.error`
  // and the toast surfaces that specific server message instead of the
  // generic fallback. This keeps users informed when the backend rejects
  // their dates (e.g. validation failures).
  it('forwards the server error message to the destructive toast when the PATCH responds with ok:false', async () => {
    mockApiRequest.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'plannedEndDate must be after plannedStartDate' }),
    });

    renderHarness({ projects: baseProjects, dateRange });

    fireEvent.click(screen.getByTestId('gantt-edit-p1'));
    const overlay = await screen.findByTestId('gantt-drag-overlay-p1');
    stubLayoutFor(overlay, 365);

    fireEvent.pointerDown(overlay, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 15, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 15, pointerId: 1 });

    fireEvent.click(screen.getByTestId('gantt-save-p1'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledTimes(1);
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'error',
        description: 'plannedEndDate must be after plannedStartDate',
        variant: 'destructive',
      }),
    );

    // Row stays in edit mode after the server rejection too.
    expect(screen.getByTestId('gantt-save-p1')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-cancel-p1')).toBeInTheDocument();
    expect(screen.queryByTestId('gantt-edit-p1')).not.toBeInTheDocument();
  });
});
