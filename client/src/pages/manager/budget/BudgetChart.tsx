import { RefObject, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Download } from 'lucide-react';
import {
  LineChart as RechartsLineChart,
  Line as RechartsLine,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  CartesianGrid as RechartsCartesianGrid,
  ReferenceLine as RechartsReferenceLine
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { renderDualLine } from '@/components/common/DualLineChart';
import { budgetColors, buildChartConfig, currencyFormatter } from '@/lib/chart-colors';
import type { BudgetFilters, ChartDataPoint } from './types';

interface BudgetChartProps {
  chartData: ChartDataPoint[];
  filters: BudgetFilters;
  minimumFund?: number;
  budgetChartRef: RefObject<HTMLDivElement>;
  onDownloadPDF: () => void;
  t: (key: string) => string;
}

const NAME_MAPPING: Record<string, string> = {
  balanceStart: 'Balance (Start of Period)',
  balanceEnd: 'Balance (End of Period)',
  revenue: 'Revenue',
  spending: 'Spending',
  netCashFlow: 'Net Cash Flow',
  capitalInvestments: 'Capital Investments',
  urgentInvestments: 'Urgent Investments',
  suggestedInvestments: 'Suggested Investments',
  notUrgentInvestments: 'Not Urgent Investments',
  projects: 'Project Costs'
};

const budgetChartConfig = buildChartConfig({
  balanceStart: { label: NAME_MAPPING.balanceStart, color: budgetColors.balanceStart },
  balanceEnd: { label: NAME_MAPPING.balanceEnd, color: budgetColors.balanceEnd },
  revenue: { label: NAME_MAPPING.revenue, color: budgetColors.revenue },
  spending: { label: NAME_MAPPING.spending, color: budgetColors.spending },
  netCashFlow: { label: NAME_MAPPING.netCashFlow, color: budgetColors.netCashFlow },
  capitalInvestments: { label: NAME_MAPPING.capitalInvestments, color: budgetColors.capitalInvestments },
  projects: { label: NAME_MAPPING.projects, color: budgetColors.projects },
});

export function BudgetChart({ chartData, filters, minimumFund, budgetChartRef, onDownloadPDF, t }: BudgetChartProps) {
  // Memoize derived data and dot callbacks so Recharts receives stable
  // references between renders. Without this, the projects <Line> elements
  // get a fresh `data` array and a fresh `dot` function on every parent
  // render, which can trigger Recharts internal effects to re-run and
  // contribute to a "Maximum update depth exceeded" loop in BudgetInner.
  const projectsPastData = useMemo(
    () => chartData.map(d => (d.isFuture ? { ...d, projects: null } : d)),
    [chartData],
  );
  const projectsFutureData = useMemo(
    () => chartData.map(d => (!d.isFuture ? { ...d, projects: null } : d)),
    [chartData],
  );
  const projectsPastDot = useCallback((props: any) => {
    const { cx, cy, index } = props;
    const point = chartData[index];
    if (!point || point.isFuture) return <g key={`project-past-${index}`} />;
    return <circle key={`project-past-${index}`} cx={cx} cy={cy} r={3} fill={budgetColors.projects} />;
  }, [chartData]);
  const projectsFutureDot = useCallback((props: any) => {
    const { cx, cy, index } = props;
    const point = chartData[index];
    if (!point || !point.isFuture) return <g key={`project-future-${index}`} />;
    return <circle key={`project-future-${index}`} cx={cx} cy={cy} r={3} fill={budgetColors.projects} />;
  }, [chartData]);

  const legendItems = [
    { visible: filters.dataVisibility.balanceStart, color: 'bg-cyan-500', label: t('budgetBalanceStartOfPeriod') },
    { visible: filters.dataVisibility.balanceEnd, color: 'bg-blue-500', label: t('budgetBalanceEndOfPeriod') },
    { visible: filters.dataVisibility.revenue, color: 'bg-green-500', label: t('budgetRevenue') },
    { visible: filters.dataVisibility.spending, color: 'bg-red-500', label: 'Spending' },
    { visible: filters.dataVisibility.netCashFlow, color: 'bg-purple-500', label: 'Net Cash Flow' },
    { visible: filters.dataVisibility.capitalInvestments, color: 'bg-indigo-500', label: 'Investments' },
    { visible: filters.dataVisibility.minimumRequirement, color: 'border-2 border-amber-600 border-dashed', label: 'Minimum Requirement' },
    { visible: filters.dataVisibility.project, color: 'bg-teal-500', label: 'Projects' },
  ];

  const tooltipFormatter = (value: any, name: any, item: any, _index: number) => {
    // `renderDualLine` emits two series per data key: a past series named
    // exactly the dataKey, and a future series suffixed with " - Future".
    // Strip the suffix and also fall back to the actual dataKey so we
    // robustly identify the investments series in both past and future.
    const baseName = typeof name === 'string' ? name.replace(/ - Future$/, '') : name;
    const dataKey = item?.dataKey ?? '';
    const displayName = NAME_MAPPING[baseName] || NAME_MAPPING[dataKey] || baseName;
    const formattedValue = currencyFormatter(Number(value));
    // Capital Investments are already baked into Spending on the backend, so
    // present them as a sub-row of Spending (indented, with an "of which"
    // prefix) to make it clear they are not an additional deduction.
    const isInvestments = baseName === 'capitalInvestments' || dataKey === 'capitalInvestments';
    return (
      <div
        className={`flex flex-1 justify-between items-center leading-none ${isInvestments ? 'pl-4' : ''}`}
      >
        <span className="text-muted-foreground">
          {isInvestments ? `↳ ${t('ofWhich')} ${displayName}` : displayName}
        </span>
        <span className="font-mono font-medium tabular-nums text-foreground ml-2">{formattedValue}</span>
      </div>
    );
  };

  return (
    <Card ref={budgetChartRef} data-testid="card-enhanced-trend-chart">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className='flex items-center gap-2'>
            <LineChart className='w-5 h-5' />
            {t('budgetTrendAnalysisCard')} - {filters.viewType === 'month' ? t('budgetMonthlyView') : t('budgetYearlyView')}
          </CardTitle>
          <div className='text-sm text-muted-foreground'>
            {t('budgetShowing')} {filters.periodLength} {filters.viewType === 'month' ? t('budgetMonths') : t('budgetYears')}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onDownloadPDF}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          PDF
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 mb-4 p-3 bg-gray-50 rounded-lg" data-testid="chart-legend">
          {legendItems.filter(item => item.visible).map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
              <span className="text-sm font-medium">{item.label}</span>
            </div>
          ))}
        </div>

        <div className='h-80'>
          {chartData.length > 0 ? (
            <ChartContainer config={budgetChartConfig} className="h-full w-full">
              <RechartsLineChart data={chartData}>
                <RechartsCartesianGrid strokeDasharray="3 3" />
                <RechartsXAxis
                  dataKey="month"
                  type="category"
                  allowDuplicatedCategory={false}
                />
                <RechartsYAxis />
                <ChartTooltip
                  content={(props: any) => {
                    // Reuse the standard tooltip for all real data series, then
                    // append a Minimum Requirement row when the toggle is on so
                    // users can see its exact value alongside the others.
                    const showMinReq =
                      filters.dataVisibility.minimumRequirement &&
                      typeof minimumFund === 'number' &&
                      !Number.isNaN(minimumFund) &&
                      props?.active &&
                      Array.isArray(props?.payload) &&
                      props.payload.length > 0;

                    return (
                      <>
                        <ChartTooltipContent
                          {...props}
                          formatter={tooltipFormatter}
                          className={showMinReq ? 'rounded-b-none' : undefined}
                        />
                        {showMinReq && (
                          <div
                            className="-mt-px rounded-b-lg border border-t-0 border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl"
                            data-testid="tooltip-minimum-requirement"
                          >
                            <div className="flex flex-1 justify-between items-center leading-none">
                              <span className="text-muted-foreground">Minimum Requirement</span>
                              <span className="font-mono font-medium tabular-nums text-foreground ml-2">
                                {currencyFormatter(Number(minimumFund))}
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  }}
                />

                {filters.dataVisibility.balanceStart && renderDualLine({
                  dataKey: 'balanceStart', color: budgetColors.balanceStart, chartData,
                })}
                {filters.dataVisibility.balanceEnd && renderDualLine({
                  dataKey: 'balanceEnd', color: budgetColors.balanceEnd, chartData,
                })}
                {filters.dataVisibility.revenue && renderDualLine({
                  dataKey: 'revenue', color: budgetColors.revenue, chartData,
                })}
                {filters.dataVisibility.spending && renderDualLine({
                  dataKey: 'spending', color: budgetColors.spending, chartData,
                })}
                {filters.dataVisibility.netCashFlow && renderDualLine({
                  dataKey: 'netCashFlow', color: budgetColors.netCashFlow, chartData, includeTransition: false,
                })}
                {filters.dataVisibility.capitalInvestments && renderDualLine({
                  dataKey: 'capitalInvestments', color: budgetColors.capitalInvestments, chartData, includeTransition: false,
                })}

                {filters.dataVisibility.project && (
                  <RechartsLine
                    type="monotone"
                    dataKey="projects"
                    stroke={budgetColors.projects}
                    strokeWidth={2}
                    dot={projectsPastDot}
                    data={projectsPastData}
                    connectNulls={false}
                    name="projects"
                  />
                )}

                {filters.dataVisibility.project && (
                  <RechartsLine
                    type="monotone"
                    dataKey="projects"
                    stroke={budgetColors.projects}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={projectsFutureDot}
                    data={projectsFutureData}
                    connectNulls={false}
                    name="projects"
                  />
                )}

                {filters.dataVisibility.minimumRequirement && minimumFund && (
                  <RechartsReferenceLine
                    y={minimumFund}
                    stroke={budgetColors.minimumRequirement}
                    strokeDasharray="8,4"
                    strokeWidth={2}
                    label={{
                      value: `Min Req: $${minimumFund.toLocaleString()}`,
                      position: 'right',
                      style: { fill: budgetColors.minimumRequirement, fontSize: '12px', fontWeight: 'bold' }
                    }}
                  />
                )}
              </RechartsLineChart>
            </ChartContainer>
          ) : (
            <div className='h-80 flex items-center justify-center text-gray-500'>
              <div className='text-center'>
                <LineChart className='w-12 h-12 mx-auto mb-4 text-gray-300' />
                <p>No data available for selected filters</p>
                <p className='text-sm'>Try adjusting your filter settings</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
