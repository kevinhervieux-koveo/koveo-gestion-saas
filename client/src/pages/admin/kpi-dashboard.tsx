import { useQuery } from '@tanstack/react-query';
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
import { Header } from '@/components/layout/header';
import { useLanguage } from '@/hooks/use-language';

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
  sinceDays: number;
  rows: AggregateRow[];
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

export default function KpiDashboardPage() {
  const { t } = useLanguage();

  const { data, isLoading, isError } = useQuery<AggregateResponse>({
    queryKey: ['/api/admin/kpi/bulk-import-filename-suggestions'],
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
        <Card data-testid="kpi-bulk-import-filename-card">
          <CardHeader>
            <CardTitle>{t('kpiBulkImportFilenameTitle')}</CardTitle>
            <CardDescription>{t('kpiBulkImportFilenameDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
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
