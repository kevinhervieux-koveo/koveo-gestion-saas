import { Ban, Sparkles } from 'lucide-react';
import {
  bandForConfidence,
  type BulkImportFallbackReason,
  type ConfidenceBand,
} from '@shared/schemas/bulk-import';

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
  if (fallbackReason) {
    const tooltip = isFr
      ? "L'IA n'a pas pu analyser ce fichier. Aucun fichier n'est exclu automatiquement selon la confiance — un score faible signifie « à vérifier », pas « à rejeter »."
      : "The AI did not analyze this file. Nothing is auto-discarded based on confidence — a low score means \"needs review\", not \"discard this\".";
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"
        data-testid="badge-confidence-not-run"
        title={tooltip}
      >
        <Ban className="h-3 w-3" />
        {isFr ? 'IA non exécutée' : 'AI not run'}
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
  const tooltipEn =
    band === 'low'
      ? `AI confidence: ${pct}. The AI ran and returned a low score — review this file. Nothing is auto-discarded based on confidence.`
      : `AI confidence: ${pct}. Nothing is auto-discarded based on this score — low confidence means "needs review", not "discard this".`;
  const tooltipFr =
    band === 'low'
      ? `Confiance de l'IA : ${pct}. L'IA a retourné un score faible — vérifiez ce fichier. Aucun fichier n'est exclu automatiquement selon la confiance.`
      : `Confiance de l'IA : ${pct}. Aucun fichier n'est exclu automatiquement — un score faible signifie « à vérifier », pas « à rejeter ».`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${variant[band]}`}
      data-testid={`badge-confidence-${band}`}
      title={isFr ? tooltipFr : tooltipEn}
    >
      <Sparkles className="h-3 w-3" /> {pct}
    </span>
  );
}
