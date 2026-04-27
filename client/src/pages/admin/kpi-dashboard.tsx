import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Header } from '@/components/layout/header';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';

type Outcome =
  | 'verbatim'
  | 'edited'
  | 'cleared'
  | 'manual_no_suggestion'
  | 'empty_no_suggestion';

interface AggregateRow {
  language: string | null;
  branch: string | null;
  totals: Record<Outcome, number>;
  total: number;
  acceptRate: number | null;
  acceptRateSampleSize: number;
}

interface AggregateResponse {
  metricKey: string;
  sinceDays: number | null;
  from: string | null;
  to: string | null;
  organizationId: string | null;
  rows: AggregateRow[];
}

interface OrganizationOption {
  id: string;
  name: string;
}

const BRANCH_KEYS: Record<string, 'kpiBranchKeep' | 'kpiBranchMerge' | 'kpiBranchSplit'> = {
  keep: 'kpiBranchKeep',
  merge: 'kpiBranchMerge',
  split: 'kpiBranchSplit',
};

const LANGUAGE_KEYS: Record<string, 'kpiLangEnglish' | 'kpiLangFrench' | 'kpiLangUnknown'> = {
  en: 'kpiLangEnglish',
  fr: 'kpiLangFrench',
};

interface GroupSummary {
  totals: Record<Outcome, number>;
  total: number;
  acceptRate: number | null;
  acceptRateSampleSize: number;
}

function emptyTotals(): Record<Outcome, number> {
  return {
    verbatim: 0,
    edited: 0,
    cleared: 0,
    manual_no_suggestion: 0,
    empty_no_suggestion: 0,
  };
}

function summariseGroup(rows: AggregateRow[]): GroupSummary {
  const totals = emptyTotals();
  let total = 0;
  for (const r of rows) {
    for (const k of Object.keys(totals) as Outcome[]) {
      totals[k] += r.totals[k] ?? 0;
    }
    total += r.total;
  }
  const sample = totals.verbatim + totals.edited + totals.cleared;
  return {
    totals,
    total,
    acceptRateSampleSize: sample,
    acceptRate: sample > 0 ? totals.verbatim / sample : null,
  };
}

function formatRate(rate: number | null, n: number): string {
  if (rate === null) return '—';
  const pct = (rate * 100).toFixed(1);
  return `${pct}% (n=${n})`;
}

const ALL_ORGS_VALUE = 'all';
type RangePreset = '7' | '30' | '90' | 'custom';

interface FilterState {
  preset: RangePreset;
  from: Date | undefined;
  to: Date | undefined;
  organizationId: string;
}

/** Build the query string the backend expects from the current filters. */
function buildQueryString(filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.preset === 'custom') {
    if (filters.from) params.set('from', startOfDayIso(filters.from));
    if (filters.to) params.set('to', endOfDayIso(filters.to));
  } else {
    params.set('sinceDays', filters.preset);
  }
  if (filters.organizationId && filters.organizationId !== ALL_ORGS_VALUE) {
    params.set('organizationId', filters.organizationId);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function startOfDayIso(d: Date): string {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString();
}

function endOfDayIso(d: Date): string {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy.toISOString();
}

export default function KpiDashboardPage() {
  const { t } = useLanguage();

  const [filters, setFilters] = useState<FilterState>({
    preset: '90',
    from: undefined,
    to: undefined,
    organizationId: ALL_ORGS_VALUE,
  });

  const queryString = useMemo(() => buildQueryString(filters), [filters]);

  // Skip the request when "Custom" is selected but no full range is set yet,
  // so we don't fire an unbounded query against the backend.
  const queryEnabled =
    filters.preset !== 'custom' || (Boolean(filters.from) && Boolean(filters.to));

  const { data: organizations = [], isLoading: orgsLoading } = useQuery<OrganizationOption[]>({
    queryKey: ['/api/organizations'],
  });

  const { data, isLoading, isError } = useQuery<AggregateResponse>({
    queryKey: ['/api/admin/kpi/bulk-import-filename-suggestions', queryString],
    enabled: queryEnabled,
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/kpi/bulk-import-filename-suggestions${queryString}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      return (await res.json()) as AggregateResponse;
    },
  });

  const rows = data?.rows ?? [];

  const byLanguage = new Map<string, AggregateRow[]>();
  const byBranch = new Map<string, AggregateRow[]>();
  for (const r of rows) {
    const langKey = r.language ?? '';
    const branchKey = r.branch ?? '';
    if (!byLanguage.has(langKey)) byLanguage.set(langKey, []);
    byLanguage.get(langKey)!.push(r);
    if (!byBranch.has(branchKey)) byBranch.set(branchKey, []);
    byBranch.get(branchKey)!.push(r);
  }

  const overall = summariseGroup(rows);

  const languageRows = Array.from(byLanguage.entries())
    .map(([lang, group]) => ({ lang, summary: summariseGroup(group) }))
    .sort((a, b) => b.summary.total - a.summary.total);
  const branchRows = Array.from(byBranch.entries())
    .map(([branch, group]) => ({ branch, summary: summariseGroup(group) }))
    .sort((a, b) => b.summary.total - a.summary.total);

  const renderLanguageLabel = (lang: string): string => {
    const key = LANGUAGE_KEYS[lang];
    return key ? t(key) : t('kpiLangUnknown');
  };
  const renderBranchLabel = (branch: string): string => {
    const key = BRANCH_KEYS[branch];
    return key ? t(key) : branch || '—';
  };

  return (
    <div className="flex flex-col h-full">
      <Header title={t('kpiDashboardTitle')} subtitle={t('kpiDashboardSubtitle')} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6" data-testid="kpi-dashboard-page">
        <Card data-testid="kpi-filters-card">
          <CardHeader>
            <CardTitle>{t('kpiFiltersTitle')}</CardTitle>
            <CardDescription>{t('kpiFiltersDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="kpi-range-preset">{t('kpiDateRange')}</Label>
                <Select
                  value={filters.preset}
                  onValueChange={(v) =>
                    setFilters((s) => ({ ...s, preset: v as RangePreset }))
                  }
                >
                  <SelectTrigger id="kpi-range-preset" data-testid="kpi-filter-range-preset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">{t('kpiRangeLast7Days')}</SelectItem>
                    <SelectItem value="30">{t('kpiRangeLast30Days')}</SelectItem>
                    <SelectItem value="90">{t('kpiRangeLast90Days')}</SelectItem>
                    <SelectItem value="custom">{t('kpiRangeCustom')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t('kpiFrom')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={filters.preset !== 'custom'}
                      className={cn(
                        'w-full pl-3 text-left font-normal',
                        !filters.from && 'text-muted-foreground',
                      )}
                      data-testid="kpi-filter-from"
                    >
                      {filters.from ? format(filters.from, 'PPP') : <span>{t('kpiPickDate')}</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.from}
                      onSelect={(date) =>
                        setFilters((s) => ({ ...s, from: date ?? undefined }))
                      }
                      disabled={(date) =>
                        (filters.to ? date > filters.to : false) || date > new Date()
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label>{t('kpiTo')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={filters.preset !== 'custom'}
                      className={cn(
                        'w-full pl-3 text-left font-normal',
                        !filters.to && 'text-muted-foreground',
                      )}
                      data-testid="kpi-filter-to"
                    >
                      {filters.to ? format(filters.to, 'PPP') : <span>{t('kpiPickDate')}</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.to}
                      onSelect={(date) =>
                        setFilters((s) => ({ ...s, to: date ?? undefined }))
                      }
                      disabled={(date) =>
                        (filters.from ? date < filters.from : false) || date > new Date()
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="kpi-organization">{t('kpiOrganization')}</Label>
                <Select
                  value={filters.organizationId}
                  onValueChange={(v) => setFilters((s) => ({ ...s, organizationId: v }))}
                  disabled={orgsLoading}
                >
                  <SelectTrigger id="kpi-organization" data-testid="kpi-filter-organization">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_ORGS_VALUE}>{t('kpiAllOrganizations')}</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {filters.preset === 'custom' && !queryEnabled ? (
              <p
                className="text-sm text-muted-foreground mt-3"
                data-testid="kpi-filter-pick-range-hint"
              >
                {t('kpiPickRangeHint')}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card data-testid="kpi-bulk-import-filename-card">
          <CardHeader>
            <CardTitle>{t('kpiBulkImportFilenameTitle')}</CardTitle>
            <CardDescription>{t('kpiBulkImportFilenameDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!queryEnabled ? (
              <p className="text-muted-foreground" data-testid="kpi-pending-range">
                {t('kpiPickRangeHint')}
              </p>
            ) : isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : isError ? (
              <p className="text-destructive" data-testid="kpi-load-error">
                {t('kpiLoadFailed')}
              </p>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground" data-testid="kpi-empty-state">
                {t('kpiNoData')}
              </p>
            ) : (
              <>
                <div
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
                  data-testid="kpi-overall-summary"
                >
                  <SummaryTile
                    label={t('kpiAcceptRate')}
                    value={formatRate(overall.acceptRate, overall.acceptRateSampleSize)}
                    testId="kpi-tile-accept-rate"
                  />
                  <SummaryTile
                    label={t('kpiTotalDecisions')}
                    value={String(overall.total)}
                    testId="kpi-tile-total"
                  />
                  <SummaryTile
                    label={t('kpiVerbatim')}
                    value={String(overall.totals.verbatim)}
                    testId="kpi-tile-verbatim"
                  />
                  <SummaryTile
                    label={t('kpiEdited')}
                    value={String(overall.totals.edited)}
                    testId="kpi-tile-edited"
                  />
                  <SummaryTile
                    label={t('kpiCleared')}
                    value={String(overall.totals.cleared)}
                    testId="kpi-tile-cleared"
                  />
                  <SummaryTile
                    label={t('kpiNoSuggestion')}
                    value={String(
                      overall.totals.manual_no_suggestion +
                        overall.totals.empty_no_suggestion,
                    )}
                    testId="kpi-tile-no-suggestion"
                  />
                </div>

                <BreakdownTable
                  title={t('kpiByLanguage')}
                  groupHeader={t('kpiLanguage')}
                  rows={languageRows.map((r) => ({
                    label: renderLanguageLabel(r.lang),
                    summary: r.summary,
                    testId: `kpi-row-language-${r.lang || 'unknown'}`,
                  }))}
                  t={t}
                  testId="kpi-table-by-language"
                />

                <BreakdownTable
                  title={t('kpiByBranchType')}
                  groupHeader={t('kpiBranchType')}
                  rows={branchRows.map((r) => ({
                    label: renderBranchLabel(r.branch),
                    summary: r.summary,
                    testId: `kpi-row-branch-${r.branch || 'unknown'}`,
                  }))}
                  t={t}
                  testId="kpi-table-by-branch"
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface SummaryTileProps {
  label: string;
  value: string;
  testId: string;
}

function SummaryTile({ label, value, testId }: SummaryTileProps) {
  return (
    <div
      className="rounded-md border bg-card p-3 flex flex-col"
      data-testid={testId}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

interface BreakdownRow {
  label: string;
  summary: GroupSummary;
  testId: string;
}

interface BreakdownTableProps {
  title: string;
  groupHeader: string;
  rows: BreakdownRow[];
  t: ReturnType<typeof useLanguage>['t'];
  testId: string;
}

function BreakdownTable({ title, groupHeader, rows, t, testId }: BreakdownTableProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <Table data-testid={testId}>
        <TableHeader>
          <TableRow>
            <TableHead>{groupHeader}</TableHead>
            <TableHead className="text-right">{t('kpiAcceptRate')}</TableHead>
            <TableHead className="text-right">{t('kpiTotalDecisions')}</TableHead>
            <TableHead className="text-right">{t('kpiVerbatim')}</TableHead>
            <TableHead className="text-right">{t('kpiEdited')}</TableHead>
            <TableHead className="text-right">{t('kpiCleared')}</TableHead>
            <TableHead className="text-right">{t('kpiNoSuggestion')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.testId} data-testid={r.testId}>
              <TableCell>{r.label}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatRate(r.summary.acceptRate, r.summary.acceptRateSampleSize)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.summary.total}</TableCell>
              <TableCell className="text-right tabular-nums">{r.summary.totals.verbatim}</TableCell>
              <TableCell className="text-right tabular-nums">{r.summary.totals.edited}</TableCell>
              <TableCell className="text-right tabular-nums">{r.summary.totals.cleared}</TableCell>
              <TableCell className="text-right tabular-nums">
                {r.summary.totals.manual_no_suggestion +
                  r.summary.totals.empty_no_suggestion}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
