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

const FALLBACK_REASON_EXPLANATION_EN: Record<BulkImportFallbackReason, string> = {
  oversize:
    "The AI couldn\u2019t analyze this file because it is too large. You can Accept\u00a0/\u00a0Reject the suggested choice manually.",
  unsupported_mime:
    "The AI couldn\u2019t analyze this file because the file type is not supported. You can Accept\u00a0/\u00a0Reject the suggested choice manually.",
  extraction_failed:
    "The AI couldn\u2019t analyze this file because the document text could not be extracted. You can Accept\u00a0/\u00a0Reject the suggested choice manually.",
  missing_file:
    "The AI couldn\u2019t analyze this file because the staged file could not be read. You can Accept\u00a0/\u00a0Reject the suggested choice manually.",
  no_api_key:
    "The AI couldn\u2019t analyze this file because no AI service key is configured. You can Accept\u00a0/\u00a0Reject the suggested choice manually.",
  api_error:
    "The AI couldn\u2019t analyze this file because the AI service returned an error. You can use Retry to try again, or Accept\u00a0/\u00a0Reject the suggested choice manually.",
  unreadable_response:
    "The AI couldn\u2019t analyze this file because the AI response was unreadable. You can use Retry to try again, or Accept\u00a0/\u00a0Reject the suggested choice manually.",
};

const FALLBACK_REASON_EXPLANATION_FR: Record<BulkImportFallbackReason, string> = {
  oversize:
    "L\u2019IA n\u2019a pas pu analyser ce fichier car il est trop volumineux. Vous pouvez Accepter\u00a0/\u00a0Rejeter le choix sugg\u00e9r\u00e9 manuellement.",
  unsupported_mime:
    "L\u2019IA n\u2019a pas pu analyser ce fichier car ce type de fichier n\u2019est pas pris en charge. Vous pouvez Accepter\u00a0/\u00a0Rejeter le choix sugg\u00e9r\u00e9 manuellement.",
  extraction_failed:
    "L\u2019IA n\u2019a pas pu analyser ce fichier car le texte du document n\u2019a pas pu \u00eatre extrait. Vous pouvez Accepter\u00a0/\u00a0Rejeter le choix sugg\u00e9r\u00e9 manuellement.",
  missing_file:
    "L\u2019IA n\u2019a pas pu analyser ce fichier car le fichier en attente est illisible. Vous pouvez Accepter\u00a0/\u00a0Rejeter le choix sugg\u00e9r\u00e9 manuellement.",
  no_api_key:
    "L\u2019IA n\u2019a pas pu analyser ce fichier car aucune cl\u00e9 de service IA n\u2019est configur\u00e9e. Vous pouvez Accepter\u00a0/\u00a0Rejeter le choix sugg\u00e9r\u00e9 manuellement.",
  api_error:
    "L\u2019IA n\u2019a pas pu analyser ce fichier car le service IA a retourn\u00e9 une erreur. Vous pouvez utiliser R\u00e9essayer pour tenter \u00e0 nouveau, ou Accepter\u00a0/\u00a0Rejeter le choix sugg\u00e9r\u00e9 manuellement.",
  unreadable_response:
    "L\u2019IA n\u2019a pas pu analyser ce fichier car la r\u00e9ponse de l\u2019IA \u00e9tait illisible. Vous pouvez utiliser R\u00e9essayer pour tenter \u00e0 nouveau, ou Accepter\u00a0/\u00a0Rejeter le choix sugg\u00e9r\u00e9 manuellement.",
};

export const FALLBACK_REASON_LABELS = {
  en: FALLBACK_REASON_LABEL_EN,
  fr: FALLBACK_REASON_LABEL_FR,
} as const;

export const FALLBACK_REASON_EXPLANATIONS = {
  en: FALLBACK_REASON_EXPLANATION_EN,
  fr: FALLBACK_REASON_EXPLANATION_FR,
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
