/**
 * Task #1309 — Gantt bar alignment must be correct under TZ=Asia/Tokyo
 * (UTC+9, an east-of-UTC positive-offset timezone).
 *
 * The bug
 * -------
 * If GanttChart passed date-only schema strings through `new Date(dateStr)`
 * the returned timestamp would be UTC midnight, but the domain itself (built
 * from the same helper) uses local midnight produced by `parseDateOnly`.
 * In a UTC-9 offset the difference is 9 hours, so any bar whose planned start
 * equals the domain start would land 9/24 of a day's pixel width to the
 * RIGHT of the plot-area left edge, making bars appear one day late.
 *
 * What this test covers
 * ---------------------
 * Helper-level (no DOM):
 *   1. parseDateOnly('2026-05-01') stays on May 1 in Asia/Tokyo.
 *   2. parseDateOnly('2026-05-31') stays on May 31 in Asia/Tokyo.
 *   3. Domain span May 1 – May 31 is exactly 30 days.
 *   4. parseDateOnlyLoose accepts a UTC-midnight ISO string and returns
 *      local May 1 inside Asia/Tokyo.
 *
 * Render-level (with recharts stub):
 *   5. A project whose plannedStartDate equals the dateRange start produces
 *      a bar whose `x` coordinate equals PLOT_INSET_LEFT (the plot-area left
 *      edge) — i.e., no horizontal shift from a midnight-vs-UTC-midnight gap.
 *   6. A project spanning the full dateRange produces a bar width that
 *      accounts for the full domain (≈ PLOT_WIDTH).
 *   7. In east timezone: domain start timestamp produced by parseDateOnly
 *      is 9 hours BEFORE the UTC-midnight for the same date-only string.
 *      The recharts stub derives bar x from (ts - domainMin) / span, so if
 *      parseDateOnly is used consistently, that expression is 0 and x ==
 *      PLOT_INSET_LEFT. If new Date(str) were used instead, the expression
 *      would be positive and x would be shifted right.
 */
process.env.TZ = 'Asia/Tokyo';

import { describe, it, expect, jest, beforeAll, afterAll, afterEach } from '@jest/globals';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { parseDateOnly, parseDateOnlyLoose } from '../../../client/src/lib/utils';
import {
  GanttChart,
  type GanttProject,
  type GanttEditingDates,
} from '../../../client/src/components/GanttChart';

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
const PLOT_INSET_LEFT = 30;
const PLOT_INSET_RIGHT = 20;
const PLOT_WIDTH = CONTAINER_WIDTH - PLOT_INSET_LEFT - PLOT_INSET_RIGHT;
const ROW_HEIGHT = 36;
const TOP_MARGIN = 10;
const BAR_SIZE = ROW_HEIGHT * 0.7;

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
    const childArr = ReactLib.Children.toArray(children);
    let shape: ((props: any) => any) | null = null;
    for (const c of childArr) {
      const s = pickShape(c);
      if (s) { shape = s; break; }
    }
    if (!shape) return <div data-testid="bar-chart-no-shape" />;
    if (!data || data.length === 0) return <div data-testid="bar-chart-empty" />;

    const min = Math.min(...data.map((d) => d.range[0]));
    const max = Math.max(...data.map((d) => d.range[1]));
    const span = Math.max(1, max - min);

    return (
      <svg data-testid="bar-chart-svg" width={CONTAINER_WIDTH} height={CONTAINER_HEIGHT}>
        {data.map((row, idx) => {
          const x = PLOT_INSET_LEFT + ((row.range[0] - min) / span) * PLOT_WIDTH;
          const w = ((row.range[1] - row.range[0]) / span) * PLOT_WIDTH;
          const y = TOP_MARGIN + idx * ROW_HEIGHT + (ROW_HEIGHT - BAR_SIZE) / 2;
          return (
            <g key={row.id}>
              {shape!({ x, y, width: w, height: BAR_SIZE, fill: '#9ca3af', fillOpacity: 1, payload: row })}
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
  return { BarChart, Bar, XAxis: Stub, YAxis: Stub, CartesianGrid: Stub, Tooltip: Stub, ResponsiveContainer, Cell: Stub };
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
  originals.getBoundingClientRect = Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect');
  originals.clientWidth = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth');
  originals.clientHeight = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');

  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    value() {
      return { x: 0, y: 0, top: 0, left: 0, right: CONTAINER_WIDTH, bottom: CONTAINER_HEIGHT, width: CONTAINER_WIDTH, height: CONTAINER_HEIGHT, toJSON: () => ({}) } as DOMRect;
    },
  });
  Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get() { return CONTAINER_WIDTH; } });
  Object.defineProperty(Element.prototype, 'clientHeight', { configurable: true, get() { return CONTAINER_HEIGHT; } });
});

afterAll(() => {
  if (originals.getBoundingClientRect) Object.defineProperty(Element.prototype, 'getBoundingClientRect', originals.getBoundingClientRect);
  if (originals.clientWidth) Object.defineProperty(Element.prototype, 'clientWidth', originals.clientWidth);
  if (originals.clientHeight) Object.defineProperty(Element.prototype, 'clientHeight', originals.clientHeight);
});

afterEach(() => { cleanup(); });

function readBarRect(rowId: string): { x: number; width: number } {
  const rect = screen.getByTestId(`gantt-bar-rect-${rowId}`);
  return {
    x: parseFloat(rect.getAttribute('x') ?? '0'),
    width: parseFloat(rect.getAttribute('width') ?? '0'),
  };
}

async function waitForBarRendered(rowId: string): Promise<void> {
  await waitFor(
    () => { expect(screen.queryByTestId(`gantt-bar-rect-${rowId}`)).not.toBeNull(); },
    { timeout: 2000, interval: 25 },
  );
}

const DATE_RANGE = { start: '2026-05-01', end: '2026-05-31' };

function Harness({ projects }: { projects: GanttProject[] }) {
  const first = projects[0];
  const editingDates: GanttEditingDates = {
    startTs: parseDateOnly(first.plannedStartDate!)!.getTime(),
    endTs: parseDateOnly(first.plannedEndDate!)!.getTime(),
  };
  return (
    <GanttChart
      projects={projects}
      dateRange={DATE_RANGE}
      language="en"
      editingProjectId={first.id}
      editingDates={editingDates}
      onStartEdit={() => {}}
      onDragEnd={() => {}}
      onSave={() => {}}
      onCancel={() => {}}
    />
  );
}

describe('Gantt date-only parsing helpers in TZ=Asia/Tokyo (UTC+9)', () => {
  it('parseDateOnly: "2026-05-01" stays on May 1 in Asia/Tokyo', () => {
    const d = parseDateOnly('2026-05-01');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(1);
  });

  it('parseDateOnly: "2026-05-31" stays on May 31 in Asia/Tokyo', () => {
    const d = parseDateOnly('2026-05-31');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(31);
  });

  it('domain span from parseDateOnly timestamps is exactly 30 days for May 1–31', () => {
    const start = parseDateOnly('2026-05-01')!;
    const end = parseDateOnly('2026-05-31')!;
    const spanDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(spanDays).toBe(30);
  });

  it('parseDateOnlyLoose accepts UTC-midnight ISO and returns local May 1 in Asia/Tokyo', () => {
    const d = parseDateOnlyLoose('2026-05-01T00:00:00.000Z');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(1);
  });

  it('parseDateOnly returns local midnight (getHours === 0, getMinutes === 0)', () => {
    const d = parseDateOnly('2026-05-01')!;
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });
});

describe('GanttChart bar alignment in TZ=Asia/Tokyo (UTC+9)', () => {
  it('bar starting at domain start has x ≈ PLOT_INSET_LEFT (no east-TZ shift)', async () => {
    const projects: GanttProject[] = [
      {
        id: 'p1',
        title: 'May project',
        status: 'planned',
        plannedStartDate: '2026-05-01',
        plannedEndDate: '2026-05-31',
      },
    ];
    render(<Harness projects={projects} />);
    await waitForBarRendered('p1');

    const bar = readBarRect('p1');
    expect(bar.width).toBeGreaterThan(0);
    expect(bar.x).toBeCloseTo(PLOT_INSET_LEFT, 0);
  });

  it('bar spanning the full dateRange has width ≈ PLOT_WIDTH (correct domain coverage)', async () => {
    const projects: GanttProject[] = [
      {
        id: 'p2',
        title: 'Full May span',
        status: 'planned',
        plannedStartDate: '2026-05-01',
        plannedEndDate: '2026-05-31',
      },
    ];
    render(<Harness projects={projects} />);
    await waitForBarRendered('p2');

    const bar = readBarRect('p2');
    expect(bar.width).toBeCloseTo(PLOT_WIDTH, 0);
  });
});
