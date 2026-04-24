import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import type { Translations } from '@/lib/i18n';

const STATUS_LABEL_KEYS: Record<string, keyof Translations> = {
  planned: 'planned',
  submission: 'statusSubmission',
  pre_work: 'statusPreWork',
  in_progress: 'inProgress',
  post_work: 'statusPostWork',
  completed: 'completed',
};

export interface GanttProject {
  id: string;
  title: string;
  status?: string;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  includeInBudget?: boolean;
}

export interface GanttDateRange {
  start: Date | string;
  end: Date | string;
}

interface GanttChartProps {
  projects: GanttProject[];
  language?: 'en' | 'fr' | string;
  height?: number;
  /**
   * Optional explicit date range used as the X-axis domain. When provided
   * the Gantt is anchored to this window (e.g. the selected financial year)
   * instead of being derived from the project dates themselves.
   */
  dateRange?: GanttDateRange | null;
  /**
   * Optional callback invoked when the user toggles a project's
   * "include in budget" state from inside the Gantt view. When provided,
   * a small eye/eye-off control is rendered next to each row label.
   */
  onToggleInclude?: (projectId: string, includeInBudget: boolean) => void;
}

const STATUS_COLORS: Record<string, string> = {
  planned: '#9ca3af',
  submission: '#60a5fa',
  pre_work: '#3b82f6',
  in_progress: '#f59e0b',
  post_work: '#8b5cf6',
  completed: '#10b981',
};

const PLACEHOLDER_COLOR = '#d1d5db';
const DAY_MS = 24 * 60 * 60 * 1000;

const ROW_HEIGHT = 36;
const TOP_MARGIN = 10;
const BOTTOM_MARGIN = 10;
const X_AXIS_HEIGHT = 30;
const MIN_MONTH_PX = 80;
const HEADER_HEIGHT = 28;

function parseDate(value?: string | null | Date): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatMonth(ts: number, locale: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
}

function formatDate(ts: number, locale: string): string {
  return new Date(ts).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface GanttRow {
  id: string;
  name: string;
  status?: string;
  range: [number, number];
  color: string;
  opacity: number;
  hasDates: boolean;
  startTs: number | null;
  endTs: number | null;
  includeInBudget: boolean;
}

export function GanttChart({
  projects,
  language = 'en',
  height,
  dateRange,
  onToggleInclude,
}: GanttChartProps) {
  const { t } = useLanguage();
  const locale = language === 'fr' ? 'fr-CA' : 'en-CA';
  const noDatesLabel = t('noDatesSet');
  const includeTitle = t('includeInBudget');
  const excludeTitle = t('excludeFromBudget');

  const { rows, domain, ticks, monthSpan } = useMemo(() => {
    const dated: GanttRow[] = [];
    const undated: GanttProject[] = [];

    for (const p of projects) {
      const start =
        parseDate(p.plannedStartDate) ?? parseDate(p.actualStartDate);
      const end = parseDate(p.plannedEndDate) ?? parseDate(p.actualEndDate);
      const include = p.includeInBudget !== false;

      if (start && end && end.getTime() >= start.getTime()) {
        dated.push({
          id: p.id,
          name: p.title,
          status: p.status,
          range: [start.getTime(), end.getTime()],
          color: STATUS_COLORS[p.status ?? ''] ?? STATUS_COLORS.planned,
          opacity: include ? 1 : 0.35,
          hasDates: true,
          startTs: start.getTime(),
          endTs: end.getTime(),
          includeInBudget: include,
        });
      } else if (start && !end) {
        const e = start.getTime() + 30 * DAY_MS;
        dated.push({
          id: p.id,
          name: p.title,
          status: p.status,
          range: [start.getTime(), e],
          color: STATUS_COLORS[p.status ?? ''] ?? STATUS_COLORS.planned,
          opacity: include ? 1 : 0.35,
          hasDates: true,
          startTs: start.getTime(),
          endTs: e,
          includeInBudget: include,
        });
      } else {
        undated.push(p);
      }
    }

    let domainStart: number;
    let domainEnd: number;
    const explicitStart = parseDate(dateRange?.start);
    const explicitEnd = parseDate(dateRange?.end);
    if (explicitStart && explicitEnd && explicitEnd.getTime() > explicitStart.getTime()) {
      domainStart = explicitStart.getTime();
      domainEnd = explicitEnd.getTime();
    } else if (dated.length > 0) {
      domainStart = Math.min(...dated.map(r => r.range[0]));
      domainEnd = Math.max(...dated.map(r => r.range[1]));
    } else {
      const now = new Date();
      domainStart = new Date(now.getFullYear(), 0, 1).getTime();
      domainEnd = new Date(now.getFullYear(), 11, 31).getTime();
    }

    const padStart = new Date(domainStart);
    padStart.setDate(1);
    padStart.setHours(0, 0, 0, 0);
    const padEnd = new Date(domainEnd);
    padEnd.setMonth(padEnd.getMonth() + 1, 1);
    padEnd.setHours(0, 0, 0, 0);
    const domainStartTs = padStart.getTime();
    const domainEndTs = padEnd.getTime();

    const months =
      (padEnd.getFullYear() - padStart.getFullYear()) * 12 +
      (padEnd.getMonth() - padStart.getMonth());
    const stepMonths = months > 24 ? 3 : months > 12 ? 2 : 1;

    const tickArr: number[] = [];
    const cursor = new Date(padStart);
    while (cursor.getTime() <= domainEndTs) {
      tickArr.push(cursor.getTime());
      cursor.setMonth(cursor.getMonth() + stepMonths);
    }

    const placeholderRows: GanttRow[] = undated.map(p => ({
      id: p.id,
      name: p.title,
      status: p.status,
      range: [domainStartTs, domainEndTs],
      color: PLACEHOLDER_COLOR,
      opacity: p.includeInBudget === false ? 0.25 : 0.6,
      hasDates: false,
      startTs: null,
      endTs: null,
      includeInBudget: p.includeInBudget !== false,
    }));

    return {
      rows: [...dated, ...placeholderRows],
      domain: [domainStartTs, domainEndTs] as [number, number],
      ticks: tickArr,
      monthSpan: Math.max(1, months),
    };
  }, [projects, dateRange]);

  const labelWidth = onToggleInclude ? 220 : 180;
  const chartHeight =
    height ??
    Math.max(
      160,
      rows.length * ROW_HEIGHT + TOP_MARGIN + BOTTOM_MARGIN + X_AXIS_HEIGHT,
    );
  const minTimelineWidth = monthSpan * MIN_MONTH_PX;

  if (rows.length === 0) {
    return null;
  }

  const domainSpan = domain[1] - domain[0];

  return (
    <div className="w-full" data-testid="gantt-chart">
      <div
        className="overflow-x-auto"
        style={{ width: '100%' }}
        data-testid="gantt-scroll-container"
      >
        <div
          style={{
            minWidth: labelWidth + minTimelineWidth,
          }}
        >
          {/* Sticky period header row */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 3,
              display: 'grid',
              gridTemplateColumns: `${labelWidth}px minmax(${minTimelineWidth}px, 1fr)`,
              background: 'hsl(var(--background))',
              borderBottom: '1px solid hsl(var(--border))',
            }}
            data-testid="gantt-period-header"
          >
            <div
              style={{
                position: 'sticky',
                left: 0,
                zIndex: 4,
                background: 'hsl(var(--background))',
                borderRight: '1px solid hsl(var(--border))',
                height: HEADER_HEIGHT,
              }}
            />
            <div
              style={{
                position: 'relative',
                height: HEADER_HEIGHT,
              }}
            >
              {ticks.map((t, idx) => {
                const pct = domainSpan > 0 ? ((t - domain[0]) / domainSpan) * 100 : 0;
                return (
                  <div
                    key={t}
                    data-testid={`gantt-period-label-${idx}`}
                    style={{
                      position: 'absolute',
                      left: `${pct}%`,
                      top: 0,
                      transform: 'translateX(-50%)',
                      fontSize: 11,
                      lineHeight: `${HEADER_HEIGHT}px`,
                      color: 'hsl(var(--muted-foreground))',
                      whiteSpace: 'nowrap',
                      paddingLeft: idx === 0 ? 4 : 0,
                    }}
                  >
                    {formatMonth(t, locale)}
                  </div>
                );
              })}
            </div>
          </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${labelWidth}px minmax(${minTimelineWidth}px, 1fr)`,
            minWidth: labelWidth + minTimelineWidth,
            height: chartHeight,
          }}
        >
          {/* Sticky labels column */}
          <div
            style={{
              position: 'sticky',
              left: 0,
              zIndex: 2,
              background: 'hsl(var(--background))',
              borderRight: '1px solid hsl(var(--border))',
              height: chartHeight,
              boxSizing: 'border-box',
              paddingTop: TOP_MARGIN,
            }}
            data-testid="gantt-labels"
          >
            {rows.map(row => (
              <div
                key={row.id}
                style={{
                  height: ROW_HEIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  paddingRight: 8,
                  paddingLeft: 4,
                  boxSizing: 'border-box',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    opacity: row.includeInBudget ? 1 : 0.55,
                  }}
                  title={row.name}
                >
                  {row.name}
                </span>
                {onToggleInclude && (
                  <button
                    type="button"
                    onClick={() => onToggleInclude(row.id, !row.includeInBudget)}
                    title={row.includeInBudget ? excludeTitle : includeTitle}
                    data-testid={`gantt-toggle-include-${row.id}`}
                    style={{
                      cursor: 'pointer',
                      background: 'transparent',
                      border: 'none',
                      padding: 2,
                      color: row.includeInBudget ? '#2563eb' : '#94a3b8',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                  >
                    {row.includeInBudget ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Scrollable timeline (chart) */}
          <div style={{ height: chartHeight, minWidth: minTimelineWidth }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: TOP_MARGIN, right: 20, left: 0, bottom: BOTTOM_MARGIN }}
                barCategoryGap={0}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  domain={domain}
                  ticks={ticks}
                  tickFormatter={ts => formatMonth(ts, locale)}
                  tick={{ fontSize: 11 }}
                  height={X_AXIS_HEIGHT}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  hide
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const row = payload[0].payload as GanttRow;
                    return (
                      <div className="rounded-md border bg-background p-2 text-xs shadow-md">
                        <div className="font-medium">{row.name}</div>
                        {row.status && (
                          <div className="text-muted-foreground capitalize">
                            {row.status.replace(/_/g, ' ')}
                          </div>
                        )}
                        {row.hasDates && row.startTs && row.endTs ? (
                          <div className="text-muted-foreground">
                            {formatDate(row.startTs, locale)} —{' '}
                            {formatDate(row.endTs, locale)}
                          </div>
                        ) : (
                          <div className="text-muted-foreground italic">
                            {noDatesLabel}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="range"
                  minPointSize={4}
                  radius={[3, 3, 3, 3]}
                  barSize={ROW_HEIGHT * 0.7}
                >
                  {rows.map(row => (
                    <Cell key={row.id} fill={row.color} fillOpacity={row.opacity} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
        {Object.entries(STATUS_COLORS).map(([status, color]) => {
          const labelKey = STATUS_LABEL_KEYS[status];
          const label = labelKey ? t(labelKey) : status.replace(/_/g, ' ');
          return (
            <div key={status} className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className="capitalize">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default GanttChart;
