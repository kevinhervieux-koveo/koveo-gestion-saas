import type { BulkImportFallbackReason } from '@shared/schemas/bulk-import';

const FALLBACK_REASON_LABEL_EN: Record<BulkImportFallbackReason, string> = {
  oversize: 'File too large to analyze',
  unsupported_mime: 'File type not supported by AI',
  extraction_failed: 'Could not extract document text',
  missing_file: 'Staged file unreadable',
  no_api_key: 'AI unavailable',
  api_error: 'AI service error',
  unreadable_response: 'AI response unreadable',
};

const FALLBACK_REASON_LABEL_FR: Record<BulkImportFallbackReason, string> = {
  oversize: "Fichier trop volumineux pour l\u2019analyse",
  unsupported_mime: 'Type de fichier non pris en charge',
  extraction_failed: 'Extraction du texte impossible',
  missing_file: 'Fichier en attente illisible',
  no_api_key: 'IA indisponible',
  api_error: 'Erreur du service IA',
  unreadable_response: "R\u00e9ponse de l\u2019IA illisible",
};

export const FALLBACK_REASON_LABELS = {
  en: FALLBACK_REASON_LABEL_EN,
  fr: FALLBACK_REASON_LABEL_FR,
} as const;

export function FallbackReasonBadge({
  reason,
  isFr,
}: {
  reason: BulkImportFallbackReason | null | undefined;
  isFr: boolean;
}) {
  if (!reason) return null;
  const labels = isFr ? FALLBACK_REASON_LABEL_FR : FALLBACK_REASON_LABEL_EN;
  return (
    <span
      className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200"
      data-testid={`badge-fallback-${reason}`}
      title={labels[reason]}
    >
      {labels[reason]}
    </span>
  );
}
