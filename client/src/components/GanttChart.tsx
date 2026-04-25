import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
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
import { Eye, EyeOff, Pencil, Save, X, Loader2 } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import type { Translations } from '@/lib/i18n';
import { parseDateOnly, snapToLocalDay } from '@/lib/utils';

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

export interface GanttEditingDates {
  startTs: number;
  endTs: number;
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
  /**
   * When provided, a pencil icon is shown on every project row. Clicking it
   * opens the project edit dialog (quick-project form or full workflow modal).
   * This is separate from the inline date-drag editing triggered by clicking
   * the bar on the timeline.
   */
  onEdit?: (projectId: string) => void;
  /**
   * Inline date-drag edit mode props — when provided, clicking a project's bar
   * in the timeline starts the drag/resize edit mode for that row.
   */
  editingProjectId?: string | null;
  editingDates?: GanttEditingDates | null;
  onStartEdit?: (projectId: string) => void;
  onDragEnd?: (projectId: string, startTs: number, endTs: number) => void;
  onSave?: (projectId: string) => void;
  onCancel?: () => void;
  isSaving?: boolean;
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
const BAR_SIZE = ROW_HEIGHT * 0.7;
const RECHARTS_RIGHT_MARGIN = 20;

function parseDate(value?: string | null | Date): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  // Treat date-only strings (YYYY-MM-DD) as local-time to avoid the UTC
  // shift that causes timezones west of UTC to display the previous day.
  if (typeof value === 'string' && value.length === 10 && !value.includes('T')) {
    const dateOnly = parseDateOnly(value);
    return dateOnly;
  }
  const d = new Date(value);
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
  onEdit,
  editingProjectId,
  editingDates,
  onStartEdit,
  onDragEnd,
  onSave,
  onCancel,
  isSaving = false,
}: GanttChartProps) {
  const { t } = useLanguage();
  const locale = language === 'fr' ? 'fr-CA' : 'en-CA';
  const noDatesLabel = t('noDatesSet');
  const includeTitle = t('includeInBudget');
  const excludeTitle = t('excludeFromBudget');
  const editLabel = t('ganttEditProject');
  const saveLabel = t('ganttSaveChanges');
  const cancelLabel = t('ganttCancel');
  const resizeStartLabel = t('ganttResizeStart');
  const resizeEndLabel = t('ganttResizeEnd');

  const timelineRef = useRef<HTMLDivElement>(null);

  type DragMode = 'move' | 'resize-left' | 'resize-right';

  // Local drag state — offset in ms from the committed editingDates
  const [dragOffsetMs, setDragOffsetMs] = useState(0);
  const [dragMode, setDragMode] = useState<DragMode>('move');
  // Whether a pointer drag gesture is currently in progress. Mirrored as
  // state (in addition to the isDragging ref) so the floating date chips
  // can re-render on gesture start/end.
  const [dragActive, setDragActive] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const isDragging = useRef(false);

  // Reset drag offset when editing project changes
  useEffect(() => {
    setDragOffsetMs(0);
    setDragMode('move');
    setDragActive(false);
    dragStartX.current = null;
    isDragging.current = false;
  }, [editingProjectId]);

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

  // Compute displayed rows — override the editing row's range with dragged dates
  const domainSpan = domain[1] - domain[0];

  const getEffectiveEditingDates = useCallback(() => {
    if (!editingDates) return null;
    const dur = editingDates.endTs - editingDates.startTs;
    let newStart = editingDates.startTs;
    let newEnd = editingDates.endTs;
    if (dragMode === 'move') {
      // Snap the slide by snapping the proposed start to local midnight and
      // shifting the end by the same delta so duration is preserved exactly.
      const tentativeStart = editingDates.startTs + dragOffsetMs;
      const snappedStart = snapToLocalDay(tentativeStart);
      const snapDelta = snappedStart - tentativeStart;
      newStart = snappedStart;
      newEnd = editingDates.endTs + dragOffsetMs + snapDelta;
      // Clamp to domain (preserve duration). Domain edges are already
      // padded to month boundaries (local midnight) in the memo above.
      if (newStart < domain[0]) {
        newStart = domain[0];
        newEnd = domain[0] + dur;
      }
      if (newEnd > domain[1]) {
        newEnd = domain[1];
        newStart = domain[1] - dur;
      }
    } else if (dragMode === 'resize-left') {
      newStart = snapToLocalDay(editingDates.startTs + dragOffsetMs);
      // Clamp: cannot go past domain start, must keep at least 1 day duration
      if (newStart < domain[0]) newStart = domain[0];
      const maxStart = editingDates.endTs - DAY_MS;
      if (newStart > maxStart) newStart = maxStart;
    } else if (dragMode === 'resize-right') {
      newEnd = snapToLocalDay(editingDates.endTs + dragOffsetMs);
      // Clamp: cannot exceed domain end, must keep at least 1 day duration
      if (newEnd > domain[1]) newEnd = domain[1];
      const minEnd = editingDates.startTs + DAY_MS;
      if (newEnd < minEnd) newEnd = minEnd;
    }
    return { startTs: newStart, endTs: newEnd };
  }, [editingDates, dragOffsetMs, domain, dragMode]);

  const effectiveEditingDates = getEffectiveEditingDates();

  const displayRows = useMemo(() => {
    if (!editingProjectId || !effectiveEditingDates) return rows;
    return rows.map(r => {
      if (r.id !== editingProjectId) return r;
      return {
        ...r,
        range: [effectiveEditingDates.startTs, effectiveEditingDates.endTs] as [number, number],
        startTs: effectiveEditingDates.startTs,
        endTs: effectiveEditingDates.endTs,
      };
    });
  }, [rows, editingProjectId, effectiveEditingDates]);

  // Drag pointer handlers — `mode` distinguishes whole-bar slide from edge resize
  const startDrag = useCallback((mode: DragMode) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editingProjectId || !editingDates || isSaving) return;
    // Stop the parent overlay's onPointerDown from also firing for resize handles
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartX.current = e.clientX;
    isDragging.current = true;
    setDragMode(mode);
    setDragOffsetMs(0);
    setDragActive(true);
  }, [editingProjectId, editingDates, isSaving]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || dragStartX.current === null || !editingDates) return;
    const timelineEl = timelineRef.current;
    if (!timelineEl) return;
    const plotWidth = timelineEl.clientWidth - RECHARTS_RIGHT_MARGIN;
    if (plotWidth <= 0) return;
    const deltaX = e.clientX - dragStartX.current;
    const rawDeltaMs = (deltaX / plotWidth) * domainSpan;
    let clampedDelta: number;
    if (dragMode === 'move') {
      const minDelta = domain[0] - editingDates.startTs;
      const maxDelta = domain[1] - editingDates.endTs;
      clampedDelta = Math.max(minDelta, Math.min(maxDelta, rawDeltaMs));
    } else if (dragMode === 'resize-left') {
      // Left edge: cannot go past domain start, must stay >= 1 day before end
      const minDelta = domain[0] - editingDates.startTs;
      const maxDelta = (editingDates.endTs - DAY_MS) - editingDates.startTs;
      clampedDelta = Math.max(minDelta, Math.min(maxDelta, rawDeltaMs));
    } else {
      // resize-right: cannot exceed domain end, must stay >= 1 day after start
      const minDelta = (editingDates.startTs + DAY_MS) - editingDates.endTs;
      const maxDelta = domain[1] - editingDates.endTs;
      clampedDelta = Math.max(minDelta, Math.min(maxDelta, rawDeltaMs));
    }
    setDragOffsetMs(clampedDelta);
  }, [editingDates, domainSpan, domain, dragMode]);

  const handlePointerUp = useCallback((_e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || !editingProjectId || !editingDates) return;
    isDragging.current = false;
    dragStartX.current = null;
    const effective = getEffectiveEditingDates();
    // Reset local drag offset BEFORE calling onDragEnd so the parent's new
    // editingDates value is the sole source of truth and is not double-offset.
    setDragOffsetMs(0);
    setDragMode('move');
    setDragActive(false);
    if (effective && onDragEnd) {
      onDragEnd(editingProjectId, effective.startTs, effective.endTs);
    }
  }, [editingProjectId, editingDates, getEffectiveEditingDates, onDragEnd]);

  const editingRowIndex = useMemo(() => {
    if (!editingProjectId) return -1;
    return displayRows.findIndex(r => r.id === editingProjectId);
  }, [displayRows, editingProjectId]);

  const hasEditSupport = !!(onEdit || onStartEdit || onSave || onCancel);

  const labelWidth = (onToggleInclude || hasEditSupport) ? 220 : 180;
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

  const todayTs = Date.now();
  const todayInRange =
    domainSpan > 0 && todayTs >= domain[0] && todayTs <= domain[1];
  const todayPct = todayInRange ? ((todayTs - domain[0]) / domainSpan) * 100 : 0;
  const todayLabel = t('today');

  // Compute the editing row's drag overlay position (in percentage of timeline div)
  let dragOverlayStyle: React.CSSProperties | null = null;
  if (editingRowIndex >= 0 && effectiveEditingDates && domainSpan > 0) {
    const leftPct = ((effectiveEditingDates.startTs - domain[0]) / domainSpan) * 100;
    const widthPct = ((effectiveEditingDates.endTs - effectiveEditingDates.startTs) / domainSpan) * 100;
    const topPx = TOP_MARGIN + editingRowIndex * ROW_HEIGHT + (ROW_HEIGHT - BAR_SIZE) / 2;
    dragOverlayStyle = {
      position: 'absolute',
      left: `${leftPct}%`,
      width: `${widthPct}%`,
      top: topPx,
      height: BAR_SIZE,
      cursor: isSaving ? 'default' : (isDragging.current ? 'grabbing' : 'grab'),
      borderRadius: 3,
      border: '2px solid #2563eb',
      background: 'rgba(37, 99, 235, 0.15)',
      boxSizing: 'border-box',
      zIndex: 5,
      touchAction: 'none',
      pointerEvents: isSaving ? 'none' : 'auto',
    };
  }

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
              {todayInRange && (
                <div
                  data-testid="gantt-today-pill"
                  title={formatDate(todayTs, locale)}
                  style={{
                    position: 'absolute',
                    left: `${todayPct}%`,
                    top: 4,
                    transform: 'translateX(-50%)',
                    fontSize: 10,
                    lineHeight: '16px',
                    height: 18,
                    padding: '0 6px',
                    borderRadius: 9999,
                    background: '#ef4444',
                    color: 'white',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    zIndex: 1,
                    pointerEvents: 'auto',
                  }}
                >
                  {todayLabel}
                </div>
              )}
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
            {displayRows.map(row => {
              const isEditing = row.id === editingProjectId;
              return (
                <div
                  key={row.id}
                  style={{
                    height: ROW_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    paddingRight: 4,
                    paddingLeft: 4,
                    boxSizing: 'border-box',
                    background: isEditing ? 'hsl(var(--accent) / 0.4)' : undefined,
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
                      disabled={!!editingProjectId}
                      style={{
                        cursor: editingProjectId ? 'default' : 'pointer',
                        background: 'transparent',
                        border: 'none',
                        padding: 2,
                        color: row.includeInBudget ? '#2563eb' : '#94a3b8',
                        display: 'inline-flex',
                        alignItems: 'center',
                        opacity: editingProjectId && !isEditing ? 0.3 : 1,
                      }}
                    >
                      {row.includeInBudget ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  )}
                  {/* Edit button — opens the project edit dialog for all rows
                      (including those without dates). Clicking the bar itself
                      is the entry point for inline date drag-editing. */}
                  {onEdit && !isEditing && (
                    <button
                      type="button"
                      onClick={() => onEdit(row.id)}
                      title={editLabel}
                      data-testid={`gantt-edit-${row.id}`}
                      disabled={isSaving}
                      style={{
                        cursor: isSaving ? 'default' : 'pointer',
                        background: 'transparent',
                        border: 'none',
                        padding: 2,
                        color: '#6b7280',
                        display: 'inline-flex',
                        alignItems: 'center',
                        opacity: isSaving ? 0.3 : 1,
                        flexShrink: 0,
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  {/* Save / Cancel for editing row */}
                  {isEditing && onSave && onCancel && (
                    <div style={{ display: 'inline-flex', gap: 2, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => onSave(row.id)}
                        title={saveLabel}
                        data-testid={`gantt-save-${row.id}`}
                        disabled={isSaving}
                        style={{
                          cursor: isSaving ? 'default' : 'pointer',
                          background: '#2563eb',
                          border: 'none',
                          padding: '2px 5px',
                          borderRadius: 4,
                          color: 'white',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                          fontSize: 10,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          opacity: isSaving ? 0.7 : 1,
                        }}
                      >
                        {isSaving ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Save size={11} />
                        )}
                        {saveLabel}
                      </button>
                      <button
                        type="button"
                        onClick={onCancel}
                        title={cancelLabel}
                        data-testid={`gantt-cancel-${row.id}`}
                        disabled={isSaving}
                        style={{
                          cursor: isSaving ? 'default' : 'pointer',
                          background: 'transparent',
                          border: '1px solid #d1d5db',
                          padding: '2px 4px',
                          borderRadius: 4,
                          color: '#6b7280',
                          display: 'inline-flex',
                          alignItems: 'center',
                          fontSize: 10,
                        }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Scrollable timeline (chart) */}
          <div
            ref={timelineRef}
            style={{
              height: chartHeight,
              minWidth: minTimelineWidth,
              position: 'relative',
            }}
          >
            {todayInRange && (
              <div
                data-testid="gantt-today-line"
                title={`${todayLabel} — ${formatDate(todayTs, locale)}`}
                style={{
                  position: 'absolute',
                  left: `${todayPct}%`,
                  top: TOP_MARGIN,
                  bottom: X_AXIS_HEIGHT + BOTTOM_MARGIN,
                  width: 0,
                  borderLeft: '2px dashed #ef4444',
                  pointerEvents: 'none',
                  zIndex: 1,
                  transform: 'translateX(-1px)',
                }}
              />
            )}

            {/* Per-row clickable overlays — clicking a project's bar starts the
                inline date-drag editing mode for that row. Only rendered for
                rows that have dates and are not currently being edited. */}
            {onStartEdit && displayRows.map((row, idx) => {
              if (!row.hasDates || row.id === editingProjectId || isSaving) return null;
              const topPx = TOP_MARGIN + idx * ROW_HEIGHT;
              return (
                <div
                  key={`bar-click-${row.id}`}
                  data-testid={`gantt-bar-click-${row.id}`}
                  onClick={() => onStartEdit(row.id)}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: topPx,
                    height: ROW_HEIGHT,
                    cursor: 'grab',
                    zIndex: 2,
                    background: 'transparent',
                  }}
                />
              );
            })}

            {/* Floating date chips during a drag/resize gesture.
                - resize-left → start chip anchored to the left edge
                - resize-right → end chip anchored to the right edge
                - move → both chips so the user can see both proposed dates */}
            {dragActive && effectiveEditingDates && editingRowIndex >= 0 && domainSpan > 0 && (() => {
              const leftPct = ((effectiveEditingDates.startTs - domain[0]) / domainSpan) * 100;
              const rightPct = ((effectiveEditingDates.endTs - domain[0]) / domainSpan) * 100;
              const chipTop =
                TOP_MARGIN + editingRowIndex * ROW_HEIGHT + (ROW_HEIGHT - BAR_SIZE) / 2 - 20;
              const chipBaseStyle: React.CSSProperties = {
                position: 'absolute',
                top: chipTop,
                fontSize: 10,
                lineHeight: '16px',
                height: 18,
                padding: '0 6px',
                borderRadius: 9999,
                background: '#2563eb',
                color: 'white',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 6,
                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
              };
              const showStart = dragMode === 'resize-left' || dragMode === 'move';
              const showEnd = dragMode === 'resize-right' || dragMode === 'move';
              return (
                <>
                  {showStart && (
                    <div
                      data-testid={`gantt-drag-chip-start-${editingProjectId}`}
                      style={{
                        ...chipBaseStyle,
                        left: `${leftPct}%`,
                        transform: 'translateX(-50%)',
                      }}
                    >
                      {formatDate(effectiveEditingDates.startTs, locale)}
                    </div>
                  )}
                  {showEnd && (
                    <div
                      data-testid={`gantt-drag-chip-end-${editingProjectId}`}
                      style={{
                        ...chipBaseStyle,
                        left: `${rightPct}%`,
                        transform: 'translateX(-50%)',
                      }}
                    >
                      {formatDate(effectiveEditingDates.endTs, locale)}
                    </div>
                  )}
                </>
              );
            })()}

            {/* Drag overlay for editing row — middle area slides the bar,
                edge handles resize start / end independently. */}
            {dragOverlayStyle && (
              <div
                data-testid={`gantt-drag-overlay-${editingProjectId}`}
                style={dragOverlayStyle}
                onPointerDown={startDrag('move')}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                <div
                  data-testid={`gantt-resize-left-${editingProjectId}`}
                  title={resizeStartLabel}
                  onPointerDown={startDrag('resize-left')}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  style={{
                    position: 'absolute',
                    left: -4,
                    top: 0,
                    bottom: 0,
                    width: 10,
                    cursor: isSaving ? 'default' : 'ew-resize',
                    touchAction: 'none',
                    pointerEvents: isSaving ? 'none' : 'auto',
                    zIndex: 1,
                  }}
                />
                <div
                  data-testid={`gantt-resize-right-${editingProjectId}`}
                  title={resizeEndLabel}
                  onPointerDown={startDrag('resize-right')}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  style={{
                    position: 'absolute',
                    right: -4,
                    top: 0,
                    bottom: 0,
                    width: 10,
                    cursor: isSaving ? 'default' : 'ew-resize',
                    touchAction: 'none',
                    pointerEvents: isSaving ? 'none' : 'auto',
                    zIndex: 1,
                  }}
                />
              </div>
            )}

            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={displayRows}
                layout="vertical"
                margin={{ top: TOP_MARGIN, right: RECHARTS_RIGHT_MARGIN, left: 0, bottom: BOTTOM_MARGIN }}
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
                    const isEditingRow = row.id === editingProjectId;
                    const dispStart = isEditingRow && effectiveEditingDates ? effectiveEditingDates.startTs : row.startTs;
                    const dispEnd = isEditingRow && effectiveEditingDates ? effectiveEditingDates.endTs : row.endTs;
                    return (
                      <div className="rounded-md border bg-background p-2 text-xs shadow-md">
                        <div className="font-medium">{row.name}</div>
                        {row.status && (
                          <div className="text-muted-foreground capitalize">
                            {row.status.replace(/_/g, ' ')}
                          </div>
                        )}
                        {row.hasDates && dispStart && dispEnd ? (
                          <div className="text-muted-foreground">
                            {formatDate(dispStart, locale)} —{' '}
                            {formatDate(dispEnd, locale)}
                          </div>
                        ) : (
                          <div className="text-muted-foreground italic">
                            {noDatesLabel}
                          </div>
                        )}
                        {isEditingRow && (
                          <div style={{ color: '#2563eb', marginTop: 2, fontStyle: 'italic' }}>
                            {saveLabel}
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
                  barSize={BAR_SIZE}
                >
                  {displayRows.map(row => (
                    <Cell
                      key={row.id}
                      fill={row.color}
                      fillOpacity={row.id === editingProjectId ? row.opacity * 0.5 : row.opacity}
                    />
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
