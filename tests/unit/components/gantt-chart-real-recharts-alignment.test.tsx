/**
 * Real-Recharts alignment guard for the Gantt chart drag overlay (task #937).
 *
 * Background
 * ----------
 * Task #934 fixed a long-standing visual bug where the blue selection
 * rectangle that appears on a project bar in edit mode would drift off
 * the grey bar (vertically) when the user clicked Edit. The fix derives
 * the overlay's vertical position from the same {y, height} Recharts
 * uses to render the bar (via the `MeasuredBarShape` callback).
 *
 * The other Gantt unit tests (`gantt-chart-drag-resize.test.tsx`,
 * `gantt-chart-drag-save.test.tsx`) all `jest.mock('recharts', ...)`
 * with simple `<div>` stubs. That means none of the existing coverage
 * exercises the real Recharts code path, so a future change to a
 * Recharts version, chart margins, axis padding, or band-scale settings
 * could silently re-introduce the misalignment without any test
 * failing.
 *
 * What this test does
 * -------------------
 * - Renders the real `<GanttChart>` with the real `recharts` package
 *   (no `jest.mock('recharts', ...)`).
 * - Polyfills the few jsdom gaps Recharts needs to compute layout
 *   (`ResizeObserver` that fires synchronously with a fixed container
 *   size, `getBoundingClientRect` that returns the same fixed size).
 * - For three editing scenarios (first row, middle row, last row) on
 *   both a small (3 row) and a large (12 row) project list, asserts:
 *     * the blue overlay div sits on top of the grey `<rect>` for the
 *       editing row (vertical centers within 1 px),
 *     * the overlay fully wraps the bar's height (top <= bar top and
 *       bottom >= bar bottom).
 * - Simulates a slide drag on the editing row and asserts that the
 *   floating start/end date chips remain anchored to the editing row's
 *   bar throughout the gesture.
 *
 * Notes on jsdom + Recharts
 * -------------------------
 * Recharts' `ResponsiveContainer` reads `getBoundingClientRect()` and
 * uses a `ResizeObserver` to learn its parent's size. jsdom returns
 * zero for both, so without the polyfills below the chart renders an
 * empty SVG (no bars). The polyfills are limited to this test file so
 * they do not affect any other suite.
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

  // jsdom returns 0/0/0/0 for getBoundingClientRect on every element,
  // which makes Recharts' ResponsiveContainer think it has no space to
  // render in. Returning a fixed CONTAINER_WIDTH x CONTAINER_HEIGHT for
  // every element is fine because the only consumer that matters is
  // ResponsiveContainer (and the Gantt chart component itself reads
  // `clientWidth` of its scrollable timeline div, which we override
  // separately below to a value that gives 1 px ≈ 1 day).
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

  // Replace the no-op ResizeObserver polyfill from jest.setup.simple.ts
  // with one that fires its callback synchronously on observe(). Without
  // this, ResponsiveContainer's effect would never receive a non-zero
  // size after mount and BarChart would render with width=0 / height=0.
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
      // Fire on the next microtask so React has time to attach the ref
      // and finish committing before the size update arrives.
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
  // Restore everything we patched.
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

function parsePx(value: string | undefined): number {
  if (!value) return 0;
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(value);
  return m ? parseFloat(m[1]) : 0;
}

function readBarRect(rowId: string): { y: number; height: number } {
  const rect = screen.getByTestId(`gantt-bar-rect-${rowId}`);
  const y = parseFloat(rect.getAttribute('y') ?? '');
  const height = parseFloat(rect.getAttribute('height') ?? '');
  return { y, height };
}

function readOverlayBox(rowId: string): { top: number; height: number } {
  const overlay = screen.getByTestId(`gantt-drag-overlay-${rowId}`);
  return {
    top: parsePx(overlay.style.top),
    height: parsePx(overlay.style.height),
  };
}

function expectOverlayWrapsBar(rowId: string): void {
  const bar = readBarRect(rowId);
  expect(bar.height).toBeGreaterThan(0);
  const overlay = readOverlayBox(rowId);
  expect(overlay.height).toBeGreaterThan(0);

  const barCenter = bar.y + bar.height / 2;
  const overlayCenter = overlay.top + overlay.height / 2;
  expect(Math.abs(overlayCenter - barCenter)).toBeLessThanOrEqual(1);

  // Overlay must fully wrap the bar's height (it is intentionally
  // padded by ~2px each way for the blue border in production code,
  // which is fine — we just require >= bar height with the same
  // center).
  expect(overlay.height).toBeGreaterThanOrEqual(bar.height);
  expect(overlay.top).toBeLessThanOrEqual(bar.y);
  expect(overlay.top + overlay.height).toBeGreaterThanOrEqual(bar.y + bar.height);
}

interface HarnessProps {
  projects: GanttProject[];
  initialEditingId: string;
}

/**
 * Lightweight harness so the test can switch the editing project id at
 * runtime without re-rendering from scratch (mirrors the budget page
 * which holds editingProjectId / editingDates in local state).
 */
function Harness({ projects, initialEditingId }: HarnessProps) {
  const initial = projects.find((p) => p.id === initialEditingId)!;
  const startTs = parseDateOnly(initial.plannedStartDate!)!.getTime();
  const endTs = parseDateOnly(initial.plannedEndDate!)!.getTime();
  const [editingProjectId, setEditingProjectId] = useState<string | null>(
    initialEditingId,
  );
  const [editingDates, setEditingDates] = useState<GanttEditingDates>({
    startTs,
    endTs,
  });

  return (
    <>
      <button
        data-testid="harness-edit-first"
        onClick={() => {
          const p = projects[0];
          setEditingProjectId(p.id);
          setEditingDates({
            startTs: parseDateOnly(p.plannedStartDate!)!.getTime(),
            endTs: parseDateOnly(p.plannedEndDate!)!.getTime(),
          });
        }}
      />
      <button
        data-testid="harness-edit-middle"
        onClick={() => {
          const p = projects[Math.floor(projects.length / 2)];
          setEditingProjectId(p.id);
          setEditingDates({
            startTs: parseDateOnly(p.plannedStartDate!)!.getTime(),
            endTs: parseDateOnly(p.plannedEndDate!)!.getTime(),
          });
        }}
      />
      <button
        data-testid="harness-edit-last"
        onClick={() => {
          const p = projects[projects.length - 1];
          setEditingProjectId(p.id);
          setEditingDates({
            startTs: parseDateOnly(p.plannedStartDate!)!.getTime(),
            endTs: parseDateOnly(p.plannedEndDate!)!.getTime(),
          });
        }}
      />
      <GanttChart
        projects={projects}
        dateRange={DATE_RANGE}
        language="en"
        editingProjectId={editingProjectId}
        editingDates={editingDates}
        onStartEdit={(id) => {
          const p = projects.find((pp) => pp.id === id);
          if (!p) return;
          setEditingProjectId(id);
          setEditingDates({
            startTs: parseDateOnly(p.plannedStartDate!)!.getTime(),
            endTs: parseDateOnly(p.plannedEndDate!)!.getTime(),
          });
        }}
        onDragEnd={(_id, s, e) => setEditingDates({ startTs: s, endTs: e })}
        onSave={() => {}}
        onCancel={() => setEditingProjectId(null)}
      />
    </>
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
  // Also wait for the drag overlay to be measured-and-positioned (the
  // GanttChart component pulls the overlay's top/height from the bar's
  // measured y/height on the next render).
  await waitFor(
    () => {
      const overlay = screen.queryByTestId(`gantt-drag-overlay-${rowId}`);
      expect(overlay).not.toBeNull();
      expect(parsePx(overlay!.style.height)).toBeGreaterThan(0);
    },
    { timeout: 5000, interval: 50 },
  );
}

describe('GanttChart with real Recharts — vertical alignment guard', () => {
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

    it('overlay wraps the grey bar for the FIRST row in edit mode', async () => {
      const firstId = projects[0].id;
      render(<Harness projects={projects} initialEditingId={firstId} />);
      await waitForBars(firstId);
      expectOverlayWrapsBar(firstId);
    });

    it('overlay wraps the grey bar for a MIDDLE row in edit mode', async () => {
      const middleId = projects[Math.floor(projects.length / 2)].id;
      render(<Harness projects={projects} initialEditingId={middleId} />);
      await waitForBars(middleId);
      expectOverlayWrapsBar(middleId);
    });

    it('overlay wraps the grey bar for the LAST row in edit mode', async () => {
      const lastId = projects[projects.length - 1].id;
      render(<Harness projects={projects} initialEditingId={lastId} />);
      await waitForBars(lastId);
      expectOverlayWrapsBar(lastId);
    });

    it('floating start/end chips stay anchored to the editing row throughout a slide drag', async () => {
      // Pick a middle row so we can detect drift in either direction.
      const editId = projects[Math.floor(projects.length / 2)].id;
      render(<Harness projects={projects} initialEditingId={editId} />);
      await waitForBars(editId);

      const bar = readBarRect(editId);
      const overlay = screen.getByTestId(`gantt-drag-overlay-${editId}`);
      // Chips are positioned 20 px above the bar's measured top
      // (see GanttChart.tsx: `chipTop = editingBarTop - 20`).
      const expectedChipTop = bar.y - 20;

      act(() => {
        fireEvent.pointerDown(overlay, {
          clientX: 100,
          pointerId: 1,
          button: 0,
        });
      });
      act(() => {
        fireEvent.pointerMove(overlay, {
          clientX: 110,
          pointerId: 1,
        });
      });

      const startChip = screen.getByTestId(`gantt-drag-chip-start-${editId}`);
      const endChip = screen.getByTestId(`gantt-drag-chip-end-${editId}`);

      expect(parsePx(startChip.style.top)).toBeCloseTo(expectedChipTop, 0);
      expect(parsePx(endChip.style.top)).toBeCloseTo(expectedChipTop, 0);

      // Continue the drag a bit further to make sure the chips stay
      // anchored to the same row (vertical position must not drift as
      // horizontal position changes).
      act(() => {
        fireEvent.pointerMove(overlay, {
          clientX: 130,
          pointerId: 1,
        });
      });
      const startChipMid = screen.getByTestId(`gantt-drag-chip-start-${editId}`);
      const endChipMid = screen.getByTestId(`gantt-drag-chip-end-${editId}`);
      expect(parsePx(startChipMid.style.top)).toBeCloseTo(expectedChipTop, 0);
      expect(parsePx(endChipMid.style.top)).toBeCloseTo(expectedChipTop, 0);

      // The overlay rectangle itself must also still be aligned with
      // the editing row's bar after the drag — this is the regression
      // we are guarding against.
      expectOverlayWrapsBar(editId);

      act(() => {
        fireEvent.pointerUp(overlay, {
          clientX: 130,
          pointerId: 1,
        });
      });
    });
  });

  it('switching the editing row updates the overlay to the new row\'s measured bar', async () => {
    // Specifically catches a regression where the overlay would stick
    // to the previous row's coordinates after the editing target
    // changes — i.e. drift that only manifests after row switches.
    const projects = makeProjects(8);
    render(
      <Harness projects={projects} initialEditingId={projects[0].id} />,
    );
    await waitForBars(projects[0].id);
    expectOverlayWrapsBar(projects[0].id);

    act(() => {
      fireEvent.click(screen.getByTestId('harness-edit-last'));
    });
    const lastId = projects[projects.length - 1].id;
    await waitForBars(lastId);
    expectOverlayWrapsBar(lastId);

    act(() => {
      fireEvent.click(screen.getByTestId('harness-edit-middle'));
    });
    const middleId = projects[Math.floor(projects.length / 2)].id;
    await waitForBars(middleId);
    expectOverlayWrapsBar(middleId);
  });
});
