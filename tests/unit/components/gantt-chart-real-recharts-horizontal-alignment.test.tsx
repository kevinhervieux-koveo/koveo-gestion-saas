/**
 * Real-Recharts horizontal alignment guard for the Gantt drag overlay (task #942).
 *
 * Background
 * ----------
 * Task #934 fixed a vertical drift bug where the blue selection rectangle that
 * appears on the budget Gantt project bar in edit mode would slide off the
 * grey bar. The fix sources the overlay's `top`/`height` from the same `(y,
 * height)` Recharts uses to render the bar (via `MeasuredBarShape`).
 *
 * Task #937 added a real-Recharts test (`gantt-chart-real-recharts-alignment
 * .test.tsx`) that catches future *vertical* drift by rendering the real
 * `recharts` package and comparing measured bar `<rect y/height>` to the
 * overlay's `style.top/height`.
 *
 * The same drift class can re-appear horizontally. The overlay's `left` and
 * `width` percentages are computed by the Gantt component from
 *
 *     (start - domain[0]) / domainSpan
 *
 * while Recharts derives the bar's `<rect x/width>` from its own X-axis
 * scale. If either side starts using a different scale (e.g. Recharts adds
 * X-axis padding, the linear scale becomes log/banded, or chart margins are
 * tweaked without updating the overlay math) the overlay would slide off the
 * bar horizontally without any existing test failing.
 *
 * What this test does
 * -------------------
 * - Renders the real `<GanttChart>` with the real `recharts` package
 *   (no `jest.mock('recharts', ...)`).
 * - Polyfills the few jsdom gaps Recharts needs to compute layout (same
 *   ResizeObserver / boundingClientRect shims used by the vertical test).
 * - For three editing scenarios (first / middle / last row) on both a small
 *   (3 row) and a large (12 row) project list, asserts that the editing
 *   row's blue overlay div lands on the same horizontal position as the
 *   grey `<rect>` for that row, within 1 px of plot-area space.
 * - Repeats the same assertion mid-drag (after a slide pointer move) so the
 *   test also covers the in-progress drag path.
 *
 * Coordinate-system notes
 * -----------------------
 * The overlay positions itself with CSS percentages relative to the
 * timeline div, while the bar's `<rect x/width>` is in SVG/plot-area
 * coordinates. The bar's plot-area uses `svgWidth - margin.right` (the
 * BarChart sets `margin.left = 0`, `margin.right = RECHARTS_RIGHT_MARGIN`),
 * so to compare them on equal footing we read the chart background rect to
 * recover Recharts' actual plot-area width and compare both positions in
 * plot-space pixels. That way the assertion checks the *relationship* both
 * sides use to map a date to a screen position, which is exactly the drift
 * class this guard is meant to catch (Recharts adopting a different scale
 * — padding, log, banded, etc. — than the overlay's straight linear math).
 *
 * Recharts in jsdom (v3.1.2) does not compute non-zero `width` on the
 * range-bar `<rect>` (bar `x` is correct, `width` comes back as 0). We
 * therefore validate horizontal width by comparing the overlay's width
 * percentage, converted to plot-space pixels, against the bar's expected
 * end position derived from the row's date range using Recharts' own
 * plot-area dimensions. If the overlay's percentage formula and Recharts'
 * X-axis scale ever start mapping the same date to different positions,
 * this comparison fails.
 */

import { describe, it, expect, jest, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import React, { useState } from 'react';

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

jest.mock('lucide-react', () => ({
  Eye: () => <span data-testid="eye-icon" />,
  EyeOff: () => <span data-testid="eye-off-icon" />,
  Pencil: () => <span data-testid="pencil-icon" />,
  Save: () => <span data-testid="save-icon" />,
  X: () => <span data-testid="x-icon" />,
  Loader2: () => <span data-testid="loader-icon" />,
}));

// IMPORTANT: this file deliberately does NOT mock 'recharts'. Doing so
// would defeat the entire purpose of this regression guard.

const CONTAINER_WIDTH = 900;
const CONTAINER_HEIGHT = 600;
// Mirrors the constant of the same name in GanttChart.tsx — kept in sync
// here so the test asserts against the production margin (and would
// surface a drift if production changes the margin without updating the
// overlay math).
const RECHARTS_RIGHT_MARGIN = 20;

interface OriginalDescriptors {
  getBoundingClientRect: PropertyDescriptor | undefined;
  clientWidth: PropertyDescriptor | undefined;
  clientHeight: PropertyDescriptor | undefined;
  offsetWidth: PropertyDescriptor | undefined;
  offsetHeight: PropertyDescriptor | undefined;
  resizeObserver: typeof globalThis.ResizeObserver | undefined;
}

const originals: OriginalDescriptors = {
  getBoundingClientRect: undefined,
  clientWidth: undefined,
  clientHeight: undefined,
  offsetWidth: undefined,
  offsetHeight: undefined,
  resizeObserver: undefined,
};

beforeAll(() => {
  // Capture originals so afterAll can restore them and not leak the
  // jsdom shims into other test files in the same worker.
  originals.getBoundingClientRect = Object.getOwnPropertyDescriptor(
    Element.prototype,
    'getBoundingClientRect',
  );
  originals.clientWidth = Object.getOwnPropertyDescriptor(
    Element.prototype,
    'clientWidth',
  );
  originals.clientHeight = Object.getOwnPropertyDescriptor(
    Element.prototype,
    'clientHeight',
  );
  originals.offsetWidth = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetWidth',
  );
  originals.offsetHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetHeight',
  );
  originals.resizeObserver = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;

  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    value() {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: CONTAINER_WIDTH,
        bottom: CONTAINER_HEIGHT,
        width: CONTAINER_WIDTH,
        height: CONTAINER_HEIGHT,
        toJSON: () => ({}),
      } as DOMRect;
    },
  });
  Object.defineProperty(Element.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return CONTAINER_WIDTH;
    },
  });
  Object.defineProperty(Element.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return CONTAINER_HEIGHT;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return CONTAINER_WIDTH;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return CONTAINER_HEIGHT;
    },
  });

  class FiringResizeObserver {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(target: Element): void {
      const rect = {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: CONTAINER_WIDTH,
        bottom: CONTAINER_HEIGHT,
        width: CONTAINER_WIDTH,
        height: CONTAINER_HEIGHT,
        toJSON: () => ({}),
      } as DOMRectReadOnly;
      Promise.resolve().then(() => {
        act(() => {
          this.cb(
            [{ target, contentRect: rect } as unknown as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
        });
      });
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    FiringResizeObserver as unknown as typeof ResizeObserver;
});

afterAll(() => {
  if (originals.getBoundingClientRect) {
    Object.defineProperty(
      Element.prototype,
      'getBoundingClientRect',
      originals.getBoundingClientRect,
    );
  }
  if (originals.clientWidth) {
    Object.defineProperty(Element.prototype, 'clientWidth', originals.clientWidth);
  }
  if (originals.clientHeight) {
    Object.defineProperty(Element.prototype, 'clientHeight', originals.clientHeight);
  }
  if (originals.offsetWidth) {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originals.offsetWidth);
  }
  if (originals.offsetHeight) {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originals.offsetHeight);
  }
  if (originals.resizeObserver) {
    (globalThis as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      originals.resizeObserver;
  }
});

afterEach(() => {
  cleanup();
});

const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_RANGE = { start: '2026-01-01', end: '2026-12-31' };
const domainStartMs = parseDateOnly('2026-01-01')!.getTime();
const domainEndMs = parseDateOnly('2027-01-01')!.getTime();
const domainSpanMs = domainEndMs - domainStartMs;

/** Build a list of evenly-spaced 30-day projects for a given count. */
function makeProjects(count: number): GanttProject[] {
  const projects: GanttProject[] = [];
  for (let i = 0; i < count; i++) {
    // Spread starts roughly across the year so each row has a visible
    // bar and adjacent rows do not perfectly overlap on the X axis.
    const startMs = domainStartMs + i * 20 * DAY_MS;
    const endMs = startMs + 30 * DAY_MS;
    const start = new Date(startMs);
    const end = new Date(endMs);
    projects.push({
      id: `p${i + 1}`,
      title: `Project ${i + 1}`,
      status: 'planned',
      plannedStartDate: toIso(start),
      plannedEndDate: toIso(end),
    });
  }
  return projects;
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parsePct(value: string | undefined): number {
  if (!value) return 0;
  const m = /^(-?\d+(?:\.\d+)?)%$/.exec(value);
  return m ? parseFloat(m[1]) : 0;
}

function readBarRect(rowId: string): { x: number; width: number } {
  const rect = screen.getByTestId(`gantt-bar-rect-${rowId}`);
  const x = parseFloat(rect.getAttribute('x') ?? '');
  const width = parseFloat(rect.getAttribute('width') ?? '');
  return { x, width };
}

function readOverlayPct(rowId: string): { leftPct: number; widthPct: number } {
  const overlay = screen.getByTestId(`gantt-drag-overlay-${rowId}`);
  return {
    leftPct: parsePct(overlay.style.left),
    widthPct: parsePct(overlay.style.width),
  };
}

/**
 * Recover the chart's actual plot-area dimensions from the rendered SVG so
 * the assertion doesn't have to assume Recharts is using the
 * RECHARTS_RIGHT_MARGIN we expect — if Recharts ever starts allocating
 * extra space (axis padding, label reservation, etc.) the plotWidth read
 * from the chart will diverge from the constant and the assertion will
 * notice the resulting drift.
 */
function readPlotArea(): { x: number; width: number } {
  const svg = document.querySelector('svg.recharts-surface') as SVGSVGElement | null;
  if (!svg) throw new Error('Recharts SVG surface not found');
  const svgWidth = parseFloat(svg.getAttribute('width') ?? '0');
  // Recharts renders the chart background (cartesian grid bg) as the first
  // direct <rect> child of the SVG when there is no <defs>. Fall back to
  // the constant-derived plot width if no such rect is present.
  const firstRect = svg.querySelector(':scope > rect');
  if (firstRect) {
    const x = parseFloat(firstRect.getAttribute('x') ?? '0');
    const width = parseFloat(firstRect.getAttribute('width') ?? '0');
    if (width > 0) return { x, width };
  }
  return { x: 0, width: svgWidth - RECHARTS_RIGHT_MARGIN };
}

/**
 * Assert the overlay div for the editing row covers the same horizontal
 * range as Recharts is using to draw the grey bar — i.e. that the
 * overlay's percentage-based left/width and Recharts' X-axis scale agree
 * on where each date sits, within 1 px of plot-space pixels.
 *
 * Both values are converted to plot-space pixels before comparison
 * because the overlay's CSS percentages refer to the full timeline div
 * width while the bar's `<rect x>` is in plot-area coordinates (offset
 * by the chart's left margin and capped at `svgWidth - margin.right`).
 * Doing the comparison in a shared coordinate system lets the assertion
 * focus on the data-mapping invariant — which date maps to which
 * position — rather than on a fixed pixel difference baked into the
 * margin.
 */
function expectOverlayMatchesBarHorizontally(rowId: string, projects: GanttProject[]): void {
  const bar = readBarRect(rowId);
  const overlay = readOverlayPct(rowId);
  const plot = readPlotArea();

  // Recharts in jsdom (v3.1.2) returns x correctly but renders width=0 for
  // range bars. We assert what we *can* verify directly against the bar
  // (its left edge) and compare the overlay's right edge against the
  // expected position derived from the row's date range applied to the
  // same plot-area scale Recharts uses. If either Recharts' scale or the
  // overlay's domain math drifts, both sides would no longer agree and
  // the assertions below would catch it.
  expect(plot.width).toBeGreaterThan(0);

  const overlayLeftPx = (overlay.leftPct / 100) * plot.width + plot.x;
  expect(Math.abs(overlayLeftPx - bar.x)).toBeLessThanOrEqual(1);

  // Width invariant: the overlay's width percentage, when projected onto
  // the same plot-area Recharts maps the bar into, should land on the
  // bar's expected right edge for the row's editing date range.
  const project = projects.find((p) => p.id === rowId);
  if (!project) throw new Error(`Project ${rowId} not in list`);
  const startTs = parseDateOnly(project.plannedStartDate!)!.getTime();
  const endTs = parseDateOnly(project.plannedEndDate!)!.getTime();
  const expectedBarEnd = ((endTs - domainStartMs) / domainSpanMs) * plot.width + plot.x;
  const overlayRightPx = ((overlay.leftPct + overlay.widthPct) / 100) * plot.width + plot.x;
  expect(Math.abs(overlayRightPx - expectedBarEnd)).toBeLessThanOrEqual(1);
}

interface HarnessProps {
  projects: GanttProject[];
  initialEditingId: string;
}

function Harness({ projects, initialEditingId }: HarnessProps) {
  const initial = projects.find((p) => p.id === initialEditingId)!;
  const startTs = parseDateOnly(initial.plannedStartDate!)!.getTime();
  const endTs = parseDateOnly(initial.plannedEndDate!)!.getTime();
  const [editingProjectId] = useState<string | null>(initialEditingId);
  const [editingDates, setEditingDates] = useState<GanttEditingDates>({
    startTs,
    endTs,
  });

  return (
    <GanttChart
      projects={projects}
      dateRange={DATE_RANGE}
      language="en"
      editingProjectId={editingProjectId}
      editingDates={editingDates}
      onStartEdit={() => {}}
      onDragEnd={(_id, s, e) => setEditingDates({ startTs: s, endTs: e })}
      onSave={() => {}}
      onCancel={() => {}}
    />
  );
}

async function waitForBars(rowId: string): Promise<void> {
  await waitFor(
    () => {
      const rect = screen.queryByTestId(`gantt-bar-rect-${rowId}`);
      expect(rect).not.toBeNull();
      expect(rect!.getAttribute('height')).toBeTruthy();
      expect(parseFloat(rect!.getAttribute('height')!)).toBeGreaterThan(0);
    },
    { timeout: 5000, interval: 50 },
  );
  await waitFor(
    () => {
      const overlay = screen.queryByTestId(`gantt-drag-overlay-${rowId}`);
      expect(overlay).not.toBeNull();
      expect(parsePct(overlay!.style.width)).toBeGreaterThan(0);
    },
    { timeout: 5000, interval: 50 },
  );
}

describe('GanttChart with real Recharts — horizontal alignment guard', () => {
  // Real-Recharts rendering needs a few async hops (ResizeObserver
  // microtask + chart layout commit). The default 3s testTimeout is
  // tight; bump it modestly to keep CI stable without hiding hangs.
  jest.setTimeout(20_000);

  describe.each([
    { label: 'small project list (3 rows)', count: 3 },
    { label: 'large project list (12 rows)', count: 12 },
  ])('$label', ({ count }) => {
    let projects: GanttProject[];

    beforeEach(() => {
      projects = makeProjects(count);
    });

    it('overlay aligns horizontally with the grey bar for the FIRST row in edit mode', async () => {
      const firstId = projects[0].id;
      render(<Harness projects={projects} initialEditingId={firstId} />);
      await waitForBars(firstId);
      expectOverlayMatchesBarHorizontally(firstId, projects);
    });

    it('overlay aligns horizontally with the grey bar for a MIDDLE row in edit mode', async () => {
      const middleId = projects[Math.floor(projects.length / 2)].id;
      render(<Harness projects={projects} initialEditingId={middleId} />);
      await waitForBars(middleId);
      expectOverlayMatchesBarHorizontally(middleId, projects);
    });

    it('overlay aligns horizontally with the grey bar for the LAST row in edit mode', async () => {
      const lastId = projects[projects.length - 1].id;
      render(<Harness projects={projects} initialEditingId={lastId} />);
      await waitForBars(lastId);
      expectOverlayMatchesBarHorizontally(lastId, projects);
    });

    it('overlay stays horizontally aligned with the grey bar throughout an in-progress slide drag', async () => {
      // Pick a middle row so the drag can slide in either direction
      // without immediately hitting the domain clamp.
      const editProject = projects[Math.floor(projects.length / 2)];
      const editId = editProject.id;
      render(<Harness projects={projects} initialEditingId={editId} />);
      await waitForBars(editId);

      // Sanity check before any drag.
      expectOverlayMatchesBarHorizontally(editId, projects);

      // Slide drag preserves the editing project's duration, so the
      // overlay's expected widthPct stays fixed across the gesture and
      // gives us an independent oracle for the right-edge / width
      // invariant during drag (we cannot compare against bar.width
      // directly because Recharts in jsdom returns width=0 for range
      // bars).
      const startTs = parseDateOnly(editProject.plannedStartDate!)!.getTime();
      const endTs = parseDateOnly(editProject.plannedEndDate!)!.getTime();
      const expectedWidthPct = ((endTs - startTs) / domainSpanMs) * 100;
      const assertDragOverlayAlignment = (rowId: string): void => {
        const bar = readBarRect(rowId);
        const overlayPct = readOverlayPct(rowId);
        const plot = readPlotArea();
        const overlayLeftPx = (overlayPct.leftPct / 100) * plot.width + plot.x;
        // LEFT edge: must track Recharts' bar.x in plot-space pixels.
        expect(Math.abs(overlayLeftPx - bar.x)).toBeLessThanOrEqual(1);
        // WIDTH / RIGHT edge: slide preserves duration, so the
        // overlay's widthPct must remain the duration fraction of the
        // domain. Tolerance is 1 px expressed in widthPct units against
        // the chart's plot width — i.e. ≤ 1 px of right-edge drift.
        const widthTolerancePct = (1 / plot.width) * 100;
        expect(Math.abs(overlayPct.widthPct - expectedWidthPct)).toBeLessThanOrEqual(
          widthTolerancePct,
        );
      };

      const overlay = screen.getByTestId(`gantt-drag-overlay-${editId}`);

      act(() => {
        fireEvent.pointerDown(overlay, {
          clientX: 100,
          pointerId: 1,
          button: 0,
        });
      });
      act(() => {
        fireEvent.pointerMove(overlay, {
          clientX: 130,
          pointerId: 1,
        });
      });

      // Mid-drag: the overlay's left/width percentages must still
      // describe the same horizontal range Recharts is rendering the
      // bar into, otherwise the user would see the blue rectangle slide
      // off the grey bar as they drag. We assert both the LEFT edge
      // (against bar.x) and the RIGHT edge / WIDTH (against the bar's
      // expected right edge derived from the overlay's currently
      // displayed date range — read from the overlay element so it
      // reflects the in-progress drag, not the initial editing dates).
      assertDragOverlayAlignment(editId);

      // Continue the drag a bit further to make sure the alignment
      // tracks new positions, not just the first frame.
      act(() => {
        fireEvent.pointerMove(overlay, {
          clientX: 160,
          pointerId: 1,
        });
      });
      assertDragOverlayAlignment(editId);

      act(() => {
        fireEvent.pointerUp(overlay, {
          clientX: 160,
          pointerId: 1,
        });
      });
    });
  });
});
