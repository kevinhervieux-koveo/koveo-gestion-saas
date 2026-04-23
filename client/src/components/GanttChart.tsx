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
  const locale = language === 'fr' ? 'fr-CA' : 'en-CA';
  const noDatesLabel = language === 'fr' ? 'Aucune date définie' : 'No dates set';
  const includeTitle = language === 'fr' ? 'Inclure au budget' : 'Include in budget';
  const excludeTitle = language === 'fr' ? 'Exclure du budget' : 'Exclude from budget';

  const { rows, domain, ticks } = useMemo(() => {
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

    // Determine the X-axis domain. An explicit dateRange takes precedence
    // (so callers can anchor to the selected financial year). Otherwise
    // derive it from the project dates with a sensible calendar fallback.
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

    // Pad domain to start/end of month
    const padStart = new Date(domainStart);
    padStart.setDate(1);
    padStart.setHours(0, 0, 0, 0);
    const padEnd = new Date(domainEnd);
    padEnd.setMonth(padEnd.getMonth() + 1, 1);
    padEnd.setHours(0, 0, 0, 0);
    const domainStartTs = padStart.getTime();
    const domainEndTs = padEnd.getTime();

    // Generate ticks - month labels, scale to quarters when span is large
    const monthSpan =
      (padEnd.getFullYear() - padStart.getFullYear()) * 12 +
      (padEnd.getMonth() - padStart.getMonth());
    const stepMonths = monthSpan > 24 ? 3 : monthSpan > 12 ? 2 : 1;

    const tickArr: number[] = [];
    const cursor = new Date(padStart);
    while (cursor.getTime() <= domainEndTs) {
      tickArr.push(cursor.getTime());
      cursor.setMonth(cursor.getMonth() + stepMonths);
    }

    // Append placeholder rows for projects with no dates
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
    };
  }, [projects, dateRange]);

  const yAxisWidth = onToggleInclude ? 200 : 160;
  const chartHeight = height ?? Math.max(160, rows.length * 36 + 60);

  if (rows.length === 0) {
    return null;
  }

  // Custom Y-axis tick that renders the row label and (optionally) an
  // include-in-budget toggle button using foreignObject so HTML controls
  // can live inside the SVG axis.
  const renderYTick = (tickProps: any) => {
    const { x, y, index } = tickProps;
    const row = rows[index];
    if (!row) return null;
    const tickHeight = 28;
    return (
      <foreignObject
        x={x - yAxisWidth}
        y={y - tickHeight / 2}
        width={yAxisWidth}
        height={tickHeight}
      >
        <div
          // @ts-expect-error xmlns is required for foreignObject HTML content
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: '100%',
            fontSize: 12,
            paddingRight: 8,
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
              {row.includeInBudget ? (
                <Eye size={14} />
              ) : (
                <EyeOff size={14} />
              )}
            </button>
          )}
        </div>
      </foreignObject>
    );
  };

  return (
    <div style={{ width: '100%', height: chartHeight }} data-testid="gantt-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            domain={domain}
            ticks={ticks}
            tickFormatter={ts => formatMonth(ts, locale)}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={yAxisWidth}
            tick={renderYTick}
            interval={0}
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
          <Bar dataKey="range" minPointSize={4} radius={[3, 3, 3, 3]}>
            {rows.map(row => (
              <Cell key={row.id} fill={row.color} fillOpacity={row.opacity} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span className="capitalize">{status.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GanttChart;
