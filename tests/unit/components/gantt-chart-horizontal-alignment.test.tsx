/**
 * Horizontal-alignment guard for the Gantt chart drag overlay (task #949).
 *
 * Background
 * ----------
 * Sister test `gantt-chart-real-recharts-alignment.test.tsx` proves the
 * blue overlay's *vertical* placement matches the grey bar by relying on
 * real Recharts inside jsdom. That test cannot also cover *horizontal*
 * alignment because jsdom + Recharts cannot compute the X-axis scale
 * (every `<rect>` ends up with `width="0"`).
 *
 * What this test does
 * -------------------
 * Mocks `recharts` with a deterministic stub that:
 *   - Renders a fixed-size plot area inset from the timeline div by
 *     a known pixel offset on each side (`PLOT_INSET_LEFT` /
 *     `PLOT_INSET_RIGHT`). This mirrors the real-life condition where
 *     the plot area is narrower than the timeline div because of axis
 *     space and the right margin — exactly the offset that used to
 *     desync the blue overlay from the grey bar.
 *   - Invokes the `Bar`'s `shape` prop (i.e. `MeasuredBarShape`) for
 *     each data row with `x` / `y` / `width` / `height` values computed
 *     from that simulated plot area.
 *
 * The assertions then verify that the editing row's blue overlay
 * shares the *exact* left edge and width of the underlying grey bar
 * (within sub-pixel rounding).
 */

import { describe, it, expect, jest, beforeAll, afterAll, afterEach } from '@jest/globals';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
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

jest.mock('lucide-react', () => ({
  Eye: () => <span data-testid="eye-icon" />,
  EyeOff: () => <span data-testid="eye-off-icon" />,
  Pencil: () => <span data-testid="pencil-icon" />,
  Save: () => <span data-testid="save-icon" />,
  X: () => <span data-testid="x-icon" />,
  Loader2: () => <span data-testid="loader-icon" />,
}));

const CONTAINER_WIDTH = 900;
const CONTAINER_HEIGHT = 600;

// Simulated plot-area inset (matches the real Recharts left axis +
// right margin). The exact pixel values do not matter — what matters
// is that they are non-zero, so a percentage-of-container math would
// disagree with the bar's pixel placement.
const PLOT_INSET_LEFT = 30;
const PLOT_INSET_RIGHT = 20;
const PLOT_WIDTH = CONTAINER_WIDTH - PLOT_INSET_LEFT - PLOT_INSET_RIGHT;

const ROW_HEIGHT = 36;
const TOP_MARGIN = 10;
const BAR_SIZE = ROW_HEIGHT * 0.7;

// Deterministic recharts stub. `BarChart` reads `data` and the shape
// prop from its `Bar` child, then renders a <rect> per row with
// pixel coordinates derived from the simulated plot area. This is the
// minimum surface area needed for `MeasuredBarShape` to fire its
// onMeasure callback with realistic numbers.
jest.mock('recharts', () => {
  const ReactLib = jest.requireActual('react') as typeof import('react');

  function pickShape(child: any): ((props: any) => any) | null {
    if (!child || typeof child !== 'object') return null;
    const props = child.props ?? {};
    return typeof props.shape === 'function' ? props.shape : null;
  }

  function ResponsiveContainer({ children }: { children: any }) {
    return <div data-testid="responsive-container">{children}</div>;
  }

  function BarChart({
    children,
    data,
  }: {
    children: any;
    data: Array<{ id: string; range: [number, number] }>;
  }) {
    // Find the <Bar> child (only one is used by GanttChart) and pull
    // its shape callback so we can render MeasuredBarShape per row.
    const childArr = ReactLib.Children.toArray(children);
    let shape: ((props: any) => any) | null = null;
    for (const c of childArr) {
      const s = pickShape(c);
      if (s) {
        shape = s;
        break;
      }
    }

    if (!shape) return <div data-testid="bar-chart-no-shape" />;

    if (!data || data.length === 0) {
      return <div data-testid="bar-chart-empty" />;
    }

    // Derive a domain spanning from min(range[0]) to max(range[1])
    // across all rows. GanttChart pads the explicit dateRange to month
    // boundaries internally; using the data extents here is sufficient
    // for bars to land at their expected pixel positions because the
    // editing row's range will exactly equal the editing dates.
    const min = Math.min(...data.map((d) => d.range[0]));
    const max = Math.max(...data.map((d) => d.range[1]));
    const span = Math.max(1, max - min);

    return (
      <svg
        data-testid="bar-chart-svg"
        width={CONTAINER_WIDTH}
        height={CONTAINER_HEIGHT}
      >
        {data.map((row, idx) => {
          const x = PLOT_INSET_LEFT + ((row.range[0] - min) / span) * PLOT_WIDTH;
          const w = ((row.range[1] - row.range[0]) / span) * PLOT_WIDTH;
          const y = TOP_MARGIN + idx * ROW_HEIGHT + (ROW_HEIGHT - BAR_SIZE) / 2;
          // Note: this calls the same MeasuredBarShape Recharts would
          // call in production — it just substitutes deterministic
          // pixel coordinates that jsdom can actually observe.
          return (
            <g key={row.id}>
              {shape!({
                x,
                y,
                width: w,
                height: BAR_SIZE,
                fill: '#9ca3af',
                fillOpacity: 1,
                payload: row,
              })}
            </g>
          );
        })}
      </svg>
    );
  }

  function Bar({ children }: { children?: any }) {
    return <>{children}</>;
  }

  const Stub = () => null;

  return {
    BarChart,
    Bar,
    XAxis: Stub,
    YAxis: Stub,
    CartesianGrid: Stub,
    Tooltip: Stub,
    ResponsiveContainer,
    Cell: Stub,
  };
});

interface OriginalDescriptors {
  getBoundingClientRect: PropertyDescriptor | undefined;
  clientWidth: PropertyDescriptor | undefined;
  clientHeight: PropertyDescriptor | undefined;
}

const originals: OriginalDescriptors = {
  getBoundingClientRect: undefined,
  clientWidth: undefined,
  clientHeight: undefined,
};

beforeAll(() => {
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
});

afterEach(() => {
  cleanup();
});

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RANGE = { start: '2026-01-01', end: '2026-12-31' };
const domainStartMs = parseDateOnly('2026-01-01')!.getTime();

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function makeProjects(count: number): GanttProject[] {
  const projects: GanttProject[] = [];
  for (let i = 0; i < count; i++) {
    const startMs = domainStartMs + i * 20 * DAY_MS;
    const endMs = startMs + 30 * DAY_MS;
    projects.push({
      id: `p${i + 1}`,
      title: `Project ${i + 1}`,
      status: 'planned',
      plannedStartDate: toIso(new Date(startMs)),
      plannedEndDate: toIso(new Date(endMs)),
    });
  }
  return projects;
}

function parsePx(value: string | undefined): number {
  if (!value) return 0;
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(value);
  return m ? parseFloat(m[1]) : Number.NaN;
}

function readBarRect(rowId: string): { x: number; y: number; width: number; height: number } {
  const rect = screen.getByTestId(`gantt-bar-rect-${rowId}`);
  return {
    x: parseFloat(rect.getAttribute('x') ?? '0'),
    y: parseFloat(rect.getAttribute('y') ?? '0'),
    width: parseFloat(rect.getAttribute('width') ?? '0'),
    height: parseFloat(rect.getAttribute('height') ?? '0'),
  };
}

function readOverlayBox(rowId: string): { left: number; top: number; width: number; height: number } {
  const overlay = screen.getByTestId(`gantt-drag-overlay-${rowId}`);
  return {
    left: parsePx(overlay.style.left),
    top: parsePx(overlay.style.top),
    width: parsePx(overlay.style.width),
    height: parsePx(overlay.style.height),
  };
}

interface HarnessProps {
  projects: GanttProject[];
  editingId: string;
}

function Harness({ projects, editingId }: HarnessProps) {
  const project = projects.find((p) => p.id === editingId)!;
  const editingDates: GanttEditingDates = {
    startTs: parseDateOnly(project.plannedStartDate!)!.getTime(),
    endTs: parseDateOnly(project.plannedEndDate!)!.getTime(),
  };
  return (
    <GanttChart
      projects={projects}
      dateRange={DATE_RANGE}
      language="en"
      editingProjectId={editingId}
      editingDates={editingDates}
      onStartEdit={() => {}}
      onDragEnd={() => {}}
      onSave={() => {}}
      onCancel={() => {}}
    />
  );
}

async function waitForOverlayMeasured(rowId: string): Promise<void> {
  await waitFor(
    () => {
      const overlay = screen.queryByTestId(`gantt-drag-overlay-${rowId}`);
      expect(overlay).not.toBeNull();
      // The overlay starts with a percentage `left` (fallback) and
      // switches to a pixel `left` once MeasuredBarShape's effect has
      // fired. Wait for the pixel form before asserting alignment.
      const left = overlay!.style.left;
      expect(left.endsWith('px')).toBe(true);
    },
    { timeout: 2000, interval: 25 },
  );
}

describe.each([
  { label: 'first row', getId: (ps: GanttProject[]) => ps[0].id },
  {
    label: 'middle row',
    getId: (ps: GanttProject[]) => ps[Math.floor(ps.length / 2)].id,
  },
  { label: 'last row', getId: (ps: GanttProject[]) => ps[ps.length - 1].id },
])(
  'GanttChart blue editing overlay sits on the grey bar (no drag offset) — $label',
  ({ getId }) => {
    it('overlay left/width exactly match the bar x/width', async () => {
      const projects = makeProjects(5);
      const editingId = getId(projects);
      render(<Harness projects={projects} editingId={editingId} />);

      await waitForOverlayMeasured(editingId);

      const bar = readBarRect(editingId);
      const overlay = readOverlayBox(editingId);

      // Bar must have realistic width — guard against stub regressions
      // that would otherwise let a "0 vs 0" assertion pass.
      expect(bar.width).toBeGreaterThan(0);
      expect(overlay.width).toBeGreaterThan(0);

      // Sub-pixel rounding tolerance is enough; the production code
      // computes both from the same plot-area pixel offset.
      expect(overlay.left).toBeCloseTo(bar.x, 1);
      expect(overlay.left + overlay.width).toBeCloseTo(bar.x + bar.width, 1);
      expect(overlay.width).toBeCloseTo(bar.width, 1);
    });
  },
);

describe('GanttChart period header and today line use the same plot-area coordinates', () => {
  it('first period-header label aligns with the plot-area left edge, not the timeline div left edge', async () => {
    const projects = makeProjects(4);
    render(<Harness projects={projects} editingId={projects[0].id} />);

    await waitForOverlayMeasured(projects[0].id);

    const firstLabel = screen.getByTestId('gantt-period-label-0');
    const left = parsePx(firstLabel.style.left);

    // The first tick is at the domain's start. With our simulated
    // plot inset of PLOT_INSET_LEFT, that tick must land at exactly
    // PLOT_INSET_LEFT pixels (NOT at 0% of the timeline div).
    //
    // GanttChart pads its domain to month boundaries, so the first
    // tick may be slightly before the bars' actual min — but it will
    // still resolve to the same plot-area left offset because it is
    // the domain's start.
    expect(left).toBeCloseTo(PLOT_INSET_LEFT, 0);
  });
});
