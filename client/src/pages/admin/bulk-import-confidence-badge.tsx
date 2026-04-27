import { Ban, Sparkles } from 'lucide-react';
import {
  bandForConfidence,
  type BulkImportFallbackReason,
  type ConfidenceBand,
} from '@shared/schemas/bulk-import';
import { translations } from '@/lib/i18n';

export interface ConfidenceBadgeProps {
  value: number | undefined | null;
  fallbackReason?: BulkImportFallbackReason | null;
  isFr: boolean;
}

export function ConfidenceBadge({
  value,
  fallbackReason,
  isFr,
}: ConfidenceBadgeProps) {
  const lang = isFr ? 'fr' : 'en';
  const tr = translations[lang];

  if (fallbackReason) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"
        data-testid="badge-confidence-not-run"
        title={tr.confidenceAiNotRunTooltip}
      >
        <Ban className="h-3 w-3" />
        {tr.confidenceAiNotRun}
      </span>
    );
  }

  const band: ConfidenceBand = bandForConfidence(value);
  const variant: Record<ConfidenceBand, string> = {
    low: 'bg-red-100 text-red-800',
    medium: 'bg-amber-100 text-amber-800',
    high: 'bg-emerald-100 text-emerald-800',
  };
  const pct = value == null ? '—' : `${Math.round(value * 100)}%`;
  const tooltipTemplate =
    band === 'low'
      ? tr.confidenceLowTooltip
      : tr.confidenceDefaultTooltip;
  const tooltip = tooltipTemplate.replace('{pct}', pct);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${variant[band]}`}
      data-testid={`badge-confidence-${band}`}
      title={tooltip}
    >
      <Sparkles className="h-3 w-3" /> {pct}
    </span>
  );
}
