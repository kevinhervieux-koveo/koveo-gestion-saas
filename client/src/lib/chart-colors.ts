import type { ChartConfig } from '@/components/ui/chart';

export const chartColors = {
  primary: '#3b82f6',
  secondary: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#6366f1',
  success: '#22c55e',
  purple: '#8b5cf6',
  pink: '#ec4899',
  teal: '#14b8a6',
  orange: '#f97316',
  cyan: '#06b6d4',
  amber: '#d97706',
} as const;

export const budgetColors = {
  balanceStart: chartColors.cyan,
  balanceEnd: chartColors.primary,
  revenue: chartColors.secondary,
  spending: chartColors.danger,
  netCashFlow: chartColors.purple,
  capitalInvestments: chartColors.info,
  urgentInvestments: chartColors.danger,
  suggestedInvestments: chartColors.warning,
  notUrgentInvestments: chartColors.success,
  projects: chartColors.teal,
  minimumRequirement: chartColors.amber,
} as const;

export function buildChartConfig(
  entries: Record<string, { label: string; color: string }>
): ChartConfig {
  const config: ChartConfig = {};
  for (const [key, { label, color }] of Object.entries(entries)) {
    config[key] = { label, color };
  }
  return config;
}

export function currencyFormatter(value: number): string {
  return `$${Math.abs(value).toLocaleString()}${value < 0 ? ' (deficit)' : ''}`;
}
