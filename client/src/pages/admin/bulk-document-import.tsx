import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient, ApiError } from '@/lib/queryClient';
import { useLanguage } from '@/hooks/use-language';
import {
  Upload,
  Trash2,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Building2,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  File as FileIcon,
  MapPin,
  History,
  AlertTriangle,
  Play,
  RotateCw,
  ArrowLeft,
  Search,
  EyeOff,
  Eye,
  Check,
  X,
  GitMerge,
  Scissors,
  Copy,
  Pencil,
  ExternalLink,
  CalendarIcon,
  RefreshCw,
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { StandaloneDatePicker } from '@/components/common/DatePickerField';
import {
  type BulkImportFallbackReason,
  type BulkImportItem,
  type BulkImportSession,
  type BulkImportStep,
} from '@shared/schemas/bulk-import';
import { ConfidenceBadge } from './bulk-import-confidence-badge';
import { FallbackReasonBadge, FALLBACK_REASON_LABELS, FALLBACK_REASON_EXPLANATIONS } from './bulk-import-fallback-reason-badge';
import {
  AUTO_STEPS,
  NextStepBlock,
  STEP_ORDER,
  STEP_PRE_STATUS,
  isAutoStep,
  type AutoStep,
} from './bulk-import-next-step-block';
import { DocumentInlineViewer } from '@/components/common/DocumentInlineViewer';
import { TagPicker } from '@/components/document-tags/TagPicker';

interface Building {
  id: string;
  name: string;
  organizationId: string;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  totalUnits?: number | null;
  buildingType?: string | null;
}

interface OrganizationLite {
  id: string;
  name: string;
}

type BranchDestination =
  | 'building_documents'
  | 'residence_documents'
  | 'demand'
  | 'bill'
  | 'maintenance'
  | 'other';

const BRANCH_DESTINATION_ORDER: readonly BranchDestination[] = [
  'building_documents',
  'residence_documents',
  'bill',
  'demand',
  'maintenance',
  'other',
] as const;

const BRANCH_DESTINATION_LABEL_EN: Record<BranchDestination, string> = {
  building_documents: 'Building documents',
  residence_documents: 'Residences',
  bill: 'Bills',
  demand: 'Demands',
  maintenance: 'Maintenance',
  other: 'Other',
};
const BRANCH_DESTINATION_LABEL_FR: Record<BranchDestination, string> = {
  building_documents: "Documents d'immeuble",
  residence_documents: 'Résidences',
  bill: 'Factures',
  demand: 'Demandes',
  maintenance: 'Maintenance',
  other: 'Autre',
};

const BRANCH_SUB_CATEGORIES: Record<BranchDestination, readonly string[]> = {
  building_documents: ['bylaws', 'minutes', 'insurance', 'financial_statement', 'contract', 'correspondence', 'other'],
  residence_documents: ['lease', 'inspection', 'correspondence', 'key_handover', 'other'],
  bill: ['utility', 'insurance', 'tax', 'maintenance_invoice', 'condo_fee', 'other'],
  demand: ['complaint', 'request', 'legal_notice', 'other'],
  maintenance: ['work_order', 'quote', 'inspection_report', 'inventory', 'other'],
  other: ['other'],
};

const SUB_CATEGORY_LABEL_EN: Record<string, string> = {
  bylaws: 'Bylaws',
  minutes: 'Minutes',
  insurance: 'Insurance',
  financial_statement: 'Financial statement',
  contract: 'Contract',
  correspondence: 'Correspondence',
  lease: 'Lease',
  inspection: 'Inspection',
  key_handover: 'Key handover',
  utility: 'Utility',
  tax: 'Tax',
  maintenance_invoice: 'Maintenance invoice',
  condo_fee: 'Condo fee',
  complaint: 'Complaint',
  request: 'Request',
  legal_notice: 'Legal notice',
  work_order: 'Work order',
  quote: 'Quote',
  inspection_report: 'Inspection report',
  inventory: 'Inventory',
  other: 'Other',
};
const SUB_CATEGORY_LABEL_FR: Record<string, string> = {
  bylaws: 'Règlements',
  minutes: 'Procès-verbaux',
  insurance: 'Assurance',
  financial_statement: 'États financiers',
  contract: 'Contrat',
  correspondence: 'Correspondance',
  lease: 'Bail',
  inspection: 'Inspection',
  key_handover: 'Remise de clés',
  utility: 'Services publics',
  tax: 'Taxe',
  maintenance_invoice: "Facture d'entretien",
  condo_fee: 'Charges de copropriété',
  complaint: 'Plainte',
  request: 'Demande',
  legal_notice: 'Avis légal',
  work_order: 'Bon de travail',
  quote: 'Devis',
  inspection_report: "Rapport d'inspection",
  inventory: 'Inventaire',
  other: 'Autre',
};

/**
 * Given all session items and an item ID, return the ordered list of
 * item IDs that will end up in the merged PDF (lead first, then siblings).
 * Uses the stored mergeWithItemIds list when available (Task #856);
 * falls back to the binary mergeWithItemId for legacy sessions.
 */
function computeMergeGroup(
  items: { id: string; sortingMergeWithItemId?: string | null; sortingMergeWithItemIds?: string[] | null }[],
  leadItemId: string,
): string[] {
  const lead = items.find((i) => i.id === leadItemId);
  if (!lead) return [leadItemId];
  if (lead.sortingMergeWithItemIds && lead.sortingMergeWithItemIds.length > 0) {
    return [leadItemId, ...lead.sortingMergeWithItemIds];
  }
  if (lead.sortingMergeWithItemId) {
    return [leadItemId, lead.sortingMergeWithItemId];
  }
  return [leadItemId];
}

/** Lean item shape returned by the /lite polling endpoint (Task #727). */
interface BulkImportItemLite {
  id: string;
  originalName: string;
  mimeType: string | null;
  status: BulkImportItem['status'];
  preExcludeStatus: BulkImportItem['status'] | null;
  /**
   * Non-null only when the item was auto-excluded on upload because its
   * content hash matched a prior manual exclusion for this org (Task #847).
   * The value `'prior_session'` triggers the "Previously excluded" badge.
   * Null means the admin excluded this item manually during the current
   * session.
   */
  excludeSource: string | null;
  screeningConfidence: number | null;
  screeningFallback: BulkImportFallbackReason | null;
  /** quickAnalysis fields from Screening (Task #767). Null for old sessions. */
  screeningTypeGuess: string | null;
  screeningBucketGuess: string | null;
  screeningQaReason: string | null;
  /**
   * AI-detected period label extracted by Screening (Task #960). Examples:
   * "2021-10", "FY2024", "INV-2024-042", "2024-03-15". Null when the
   * Screening AI could not extract a period for this document, or for
   * legacy sessions where this field was not yet captured.
   */
  screeningPeriodHint: string | null;
  /**
   * True when an admin manually overrode the AI-detected period hint via
   * the inline editor on the Sorting row (Task #997). Drives the small
   * "Manual" tag shown next to the period chip so admins can tell their
   * override apart from the AI's guess.
   */
  screeningPeriodHintManualOverride: boolean;
  /**
   * Server-parsed date from screeningPeriodHint (Task #1003). When the
   * periodHint can be converted to a date (e.g. "2022-2023" → "2022-01-01"),
   * this field holds the YYYY-MM-DD string. Null for non-date hints
   * (e.g. invoice numbers) and for items where periodHint is absent.
   * Used to show a "from screening" annotation in the identification step
   * when identification itself did not return an effectiveDate.
   */
  screeningParsedPeriodHintDate: string | null;
  /**
   * Rotation outcome for the Screening step (Task #772).
   * `screeningRotationDegrees` is the clockwise rotation Screening
   * detected (0/90/180/270). `screeningRotationApplied` is true only when
   * the staged file was actually rewritten in place — failed or
   * unsupported rotations leave it false so no badge is shown.
   * Defaults to 0/false for legacy sessions where rotation was not tracked.
   */
  screeningRotationDegrees: 0 | 90 | 180 | 270;
  screeningRotationApplied: boolean;
  sortingConfidence: number | null;
  sortingFallback: BulkImportFallbackReason | null;
  sortingDecision: 'keep' | 'merge' | 'split' | null;
  sortingReason: string | null;
  /** id of the sibling item this one should merge with (Task #767). */
  sortingMergeWithItemId: string | null;
  /** Ordered list of sibling IDs for N-way merge (Task #856). */
  sortingMergeWithItemIds: string[] | null;
  /** Page number at which to split this PDF (1-indexed, from AI or manual). */
  sortingSplitAtPage: number | null;
  /** Decision state for the sorting step: pending/accepted/rejected. Null = legacy (no gate). */
  sortingDecisionState: 'pending' | 'accepted' | 'rejected' | null;
  /** True when the admin manually set the sorting decision instead of accepting AI. */
  sortingManualOverride: boolean;
  /**
   * When a split was auto-saved in draft mode, this holds the two part item IDs.
   * The lead item is marked `rejected` but kept visible in the sorting step UI
   * so the admin can adjust the slice page or revert.
   */
  sortingDecisionSplitIntoItemIds: string[] | null;
  /** True when the current sorting decision is only a draft (auto-saved, not yet confirmed). */
  sortingDecisionDraft: boolean;
  /** Rename stems for the two split parts when a draft split has been saved. */
  sortingDecisionSplitFinalNames: [string, string] | null;
  /** Admin-supplied rename stem for keep/merge items (no extension). */
  finalFileName: string | null;
  branchingConfidence: number | null;
  branchingFallback: BulkImportFallbackReason | null;
  branch: BranchDestination | null;
  subCategory: string | null;
  branchReason: string | null;
  branchManualOverride: boolean;
  /** Residence fields (Task #780). Only relevant when branch === 'residence_documents'. */
  residenceId: string | null;
  residenceConfidence: number | null;
  residenceReason: string | null;
  residenceFallbackReason: string | null;
  residenceManualOverride: boolean;
  /**
   * AI-suggestion bookkeeping for the residence picker (Task #803).
   * - `residenceAiSuggestedId`: the residence the AI originally picked.
   *   Survives admin overrides so the UI can compare current pick vs. AI.
   * - `residenceAiSuggested`: derived flag — true when the current
   *   `residenceId` is still the AI's pick AND the admin hasn't yet
   *   confirmed it (per-row Save with the AI value, or bulk-confirm).
   *   Drives the small "AI suggestion" chip rendered next to the
   *   residence badge so admins can spot AI picks at a glance.
   * - `residenceAiConfirmed`: true once the admin has explicitly
   *   accepted the AI pick (used to dismiss the chip).
   */
  residenceAiSuggestedId: string | null;
  residenceAiSuggested: boolean;
  residenceAiConfirmed: boolean;
  identificationConfidence: number | null;
  identificationFallback: BulkImportFallbackReason | null;
  identificationName: string | null;
  identificationDescription: string | null;
  identificationTags: string[] | null;
  /**
   * Task #1105: real `document_tags` UUIDs the run-all loop matched
   * against the AI's free-form tag-name suggestions at identification
   * time. Used to drive the AI sparkle in the TagPicker even after the
   * admin tweaks the selection. Null on legacy sessions whose
   * identification ran before this field existed (the editor falls
   * back to client-side string matching in that case).
   */
  identificationAiSuggestedTagIds: string[] | null;
  identificationEffectiveDate: string | null;
  /**
   * True when the admin manually typed a date into the identification
   * step (Task #1031). Drives the wizard's decision to hide the
   * "from screening" annotation once an override is in place — even
   * when the override happens to match the parsed periodHint date,
   * the chip should disappear because the value is no longer "from
   * the AI".
   */
  identificationEffectiveDateManualOverride: boolean;
  linkingConfidence: number | null;
  linkingFallback: BulkImportFallbackReason | null;
  linkingReason: string | null;
  linkingBeforeItemId: string | null;
  linkingAfterItemId: string | null;
  /**
   * Task #1002: enriched duplicate info — null for non-duplicate items.
   * When status === 'duplicate', these fields carry info about the
   * already-committed document so the UI can show "Already in Koveo".
   */
  duplicateOfDocumentId: string | null;
  duplicateOfDocumentName: string | null;
  duplicateOfBuildingId: string | null;
  duplicateOfBuildingName: string | null;
  duplicateOfResidenceLabel: string | null;
  duplicateOfDocumentType: string | null;
  /** True when the linked document was deleted after being committed. */
  duplicateOfDocumentRemoved: boolean;
}

interface SessionPayloadLite {
  session: BulkImportSession;
  items: BulkImportItemLite[];
}

/** Paginated sessions response (Task #727). */
interface SessionsPage {
  sessions: BulkImportSession[];
  limit: number;
  offset: number;
  hasMore: boolean;
}

function getItemStepDecision(
  item: BulkImportItemLite,
  step: BulkImportStep,
): {
  confidence: number | null;
  fallbackReason: BulkImportFallbackReason | null;
  decision?: 'keep' | 'merge' | 'split' | null;
  reason?: string | null;
  mergeWithItemId?: string | null;
  splitAtPage?: number | null;
} | null {
  switch (step) {
    case 'screening':
      return { confidence: item.screeningConfidence, fallbackReason: item.screeningFallback };
    case 'sorting':
      return {
        confidence: item.sortingConfidence,
        fallbackReason: item.sortingFallback,
        decision: item.sortingDecision,
        reason: item.sortingReason,
        mergeWithItemId: item.sortingMergeWithItemId,
        splitAtPage: item.sortingSplitAtPage,
      };
    case 'branching':
      return { confidence: item.branchingConfidence, fallbackReason: item.branchingFallback };
    case 'identification':
      return { confidence: item.identificationConfidence, fallbackReason: item.identificationFallback };
    case 'linking':
      return { confidence: item.linkingConfidence, fallbackReason: item.linkingFallback };
    default:
      return null;
  }
}

function iconForMime(mime: string | null | undefined) {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return FileImage;
  if (m === 'application/pdf') return FileText;
  if (m.includes('zip') || m.includes('compressed')) return FileArchive;
  if (m.includes('sheet') || m.includes('excel') || m.includes('csv')) return FileSpreadsheet;
  if (m.includes('word') || m.includes('document') || m.startsWith('text/')) return FileText;
  return FileIcon;
}

function ItemThumbnail({ item }: { item: { id: string; mimeType?: string | null; originalName: string } }) {
  const isImage = (item.mimeType ?? '').toLowerCase().startsWith('image/');
  const [broken, setBroken] = useState(false);
  const Icon = iconForMime(item.mimeType);
  if (isImage && !broken) {
    return (
      <img
        src={`/api/admin/bulk-import/items/${item.id}/file`}
        alt={item.originalName}
        className="h-14 w-14 flex-shrink-0 rounded-md border object-cover bg-muted"
        loading="lazy"
        onError={() => setBroken(true)}
        data-testid={`thumb-image-${item.id}`}
      />
    );
  }
  return (
    <div
      className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground"
      data-testid={`thumb-icon-${item.id}`}
    >
      <Icon className="h-6 w-6" />
    </div>
  );
}

/**
 * History rows enrich the raw drizzle item with the same flat
 * quickAnalysis fields the lite endpoint exposes, so the history
 * expansion can surface the Screening AI's typeGuess + bucketGuess +
 * reason without re-parsing the `screening` JSON blob (Task #782).
 */
type HistoryBulkImportItem = BulkImportItem & {
  screeningFallback: BulkImportFallbackReason | null;
  screeningTypeGuess: string | null;
  screeningBucketGuess: string | null;
  screeningQaReason: string | null;
  /** Period hint surfaced in the history view chip (Task #960/#997). */
  screeningPeriodHint: string | null;
  /** True when an admin overrode the AI-detected period hint (Task #997). */
  screeningPeriodHintManualOverride: boolean;
};

interface SessionPayload {
  session: BulkImportSession;
  items: HistoryBulkImportItem[];
}

const HISTORY_PAGE_SIZE = 20;

interface RunAllProgress {
  total: number;
  processed: number;
  failed: number;
  startedAt: string;
  finishedAt: string | null;
  /** Items currently being analyzed (Task #898). Populated by the worker pool. */
  inFlight?: Array<{ itemId: string; originalName: string }>;
}

function readRunAllProgress(
  session: BulkImportSession | undefined,
  step: AutoStep,
): RunAllProgress | null {
  const progress = session?.progress as Record<string, unknown> | null | undefined;
  const runAll = progress?.runAll as Record<string, RunAllProgress> | undefined;
  return runAll?.[step] ?? null;
}

// NOTE: The internal step keys `sorting` and `branching` are deliberately
// labelled with the *opposite* user-facing names. Today the step keyed
// `sorting` runs the keep/merge/split analyzer (which is conceptually
// "branching" the document stream into split/merge outcomes), and the
// step keyed `branching` runs the destination-bucket router (which is
// conceptually "sorting" each kept document into a bucket). The internal
// keys, status enum, analyzer wiring, and step order are unchanged —
// only the labels swap so the wizard surfaces the correct word for what
// each step actually does.
const STEP_LABEL_EN: Record<BulkImportStep, string> = {
  upload: 'Upload',
  screening: 'Screening',
  sorting: 'Branching',
  branching: 'Sorting',
  identification: 'Identification',
  linking: 'Linking',
  complete: 'Complete',
};
const STEP_LABEL_FR: Record<BulkImportStep, string> = {
  upload: 'Téléversement',
  screening: 'Filtrage',
  sorting: 'Aiguillage',
  branching: 'Tri',
  identification: 'Identification',
  linking: 'Liaison',
  complete: 'Terminé',
};

const STORAGE_KEY = 'bulkImportActiveSessionId';

const TYPE_GUESS_LABEL_EN: Record<string, string> = {
  invoice: 'Invoice',
  contract: 'Contract',
  minutes: 'Minutes',
  statement: 'Statement',
  letter: 'Letter',
  report: 'Report',
  other: 'Other',
  unknown: 'Unknown',
};
const TYPE_GUESS_LABEL_FR: Record<string, string> = {
  invoice: 'Facture',
  contract: 'Contrat',
  minutes: 'Procès-verbal',
  statement: 'Relevé',
  letter: 'Lettre',
  report: 'Rapport',
  other: 'Autre',
  unknown: 'Inconnu',
};
const BUCKET_GUESS_LABEL_EN: Record<string, string> = {
  building_documents: 'Building',
  residence_documents: 'Residence',
  demand: 'Demand',
  bill: 'Bill',
  maintenance: 'Maintenance',
  other: 'Other',
  unknown: 'Unknown',
};
const BUCKET_GUESS_LABEL_FR: Record<string, string> = {
  building_documents: 'Immeuble',
  residence_documents: 'Résidence',
  demand: 'Demande',
  bill: 'Facture reçue',
  maintenance: 'Entretien',
  other: 'Autre',
  unknown: 'Inconnu',
};

/**
 * True when the quickAnalysis (typeGuess + bucketGuess) from Screening
 * carries any signal — i.e. at least one of the two guesses is set and
 * not the literal "unknown" placeholder. Used by the detail panel to
 * decide whether the AI-guess section is worth showing at all.
 */
function hasQuickAnalysisSignal(item: {
  screeningTypeGuess: string | null;
  screeningBucketGuess: string | null;
}): boolean {
  const t = item.screeningTypeGuess;
  const b = item.screeningBucketGuess;
  return Boolean((t && t !== 'unknown') || (b && b !== 'unknown'));
}

const HISTORY_STEP_FIELDS: ReadonlyArray<{
  field: keyof BulkImportItem;
  labelEn: string;
  labelFr: string;
}> = [
  { field: 'screening', labelEn: 'Screening', labelFr: 'Filtrage' },
  // Internal keys keep their old names; user-facing labels swap to match
  // what each step actually does (see STEP_LABEL_* note above).
  { field: 'sortingDecision', labelEn: 'Branching', labelFr: 'Aiguillage' },
  { field: 'branchDecision', labelEn: 'Sorting', labelFr: 'Tri' },
  { field: 'identification', labelEn: 'Identification', labelFr: 'Identification' },
  { field: 'linkDecisions', labelEn: 'Linking', labelFr: 'Liaison' },
];

/**
 * Pull every fallbackReason recorded against an item (one per AI step
 * that ran). The history view surfaces these so admins can see *why*
 * past sessions produced low-confidence results without having to open
 * the item in the active wizard.
 */
function fallbackReasonsForItem(
  item: BulkImportItem,
): Array<{ step: string; reason: BulkImportFallbackReason }> {
  const out: Array<{ step: string; reason: BulkImportFallbackReason }> = [];
  for (const { field, labelEn } of HISTORY_STEP_FIELDS) {
    const decision = item[field] as
      | { fallbackReason?: BulkImportFallbackReason | null }
      | null
      | undefined;
    if (decision?.fallbackReason) {
      out.push({ step: labelEn, reason: decision.fallbackReason });
    }
  }
  return out;
}

interface HistoryRowBuilding {
  id: string;
  name: string;
}

/**
 * Map a backend sorting-decision error code to a user-facing,
 * actionable message in French/English (Task #1036). Returns null
 * when the code is not a known PDF/merge corruption error so the
 * caller can fall back to the generic server message.
 *
 * Covers the corruption-class codes emitted by `server/api/bulk-import.ts`
 * during a merge:
 *   - MERGE_LEAD_PDF_CORRUPT          (lead PDF failed to load even after re-encode)
 *   - PDF_PAGE_TREE_UNRECOVERABLE     (page-tree walk failed twice)
 *   - MERGE_PDF_COPY_FAILED           (copyPages threw, even after sibling re-encode)
 *   - MERGE_PDF_SAVE_FAILED           (serialising the merged PDF threw)
 */
function getSortingDecisionFriendlyMessage(
  code: string,
  isFr: boolean,
): { title: string; description: string } | null {
  switch (code) {
    case 'MERGE_LEAD_PDF_CORRUPT':
    case 'PDF_PAGE_TREE_UNRECOVERABLE':
    case 'MERGE_PDF_COPY_FAILED':
    case 'MERGE_PDF_SAVE_FAILED':
      return {
        title: isFr
          ? 'Fusion impossible : ce PDF semble corrompu'
          : "Merge failed: this PDF appears to be corrupted",
        description: isFr
          ? "Le fichier est endommagé ou utilise un encodage non pris en charge (souvent vu sur les PDF exportés par NoCentris). Essayez de l'ouvrir et de le ré-enregistrer (Aperçu, Adobe Acrobat) puis remplacez-le, ou scindez-le manuellement avant de relancer la fusion."
          : "The file is damaged or uses an unsupported encoding (commonly seen on PDFs exported by NoCentris). Try opening it and re-saving it (Preview, Adobe Acrobat) then replace it, or split it manually before retrying the merge.",
      };
    default:
      return null;
  }
}

/**
 * Live page-count badge rendered next to the manual sorting picker's
 * split-page input (Task #824). Fetches the staged PDF's page count
 * once when mounted (the picker opens) and re-renders client-side as
 * the admin types — no re-fetch per keystroke. The arithmetic mirrors
 * the server's split logic in `set-sorting-decision`: first part
 * receives `splitPage` pages (1..splitPage), second part receives
 * `totalPages - splitPage` pages.
 */
function SplitPagePreview({
  itemId,
  splitPage,
  isFr,
}: {
  itemId: string;
  splitPage: number;
  isFr: boolean;
}) {
  const { data, isLoading, isError } = useQuery<{ totalPages: number }>({
    queryKey: ['/api/admin/bulk-import/items', itemId, 'page-count'],
  });

  if (isLoading) {
    return (
      <span
        className="text-xs text-muted-foreground"
        data-testid={`sorting-picker-split-pagecount-${itemId}`}
      >
        {isFr ? 'Chargement du nombre de pages…' : 'Loading page count…'}
      </span>
    );
  }

  if (isError || !data) {
    return (
      <span
        className="text-xs text-muted-foreground"
        data-testid={`sorting-picker-split-pagecount-${itemId}`}
      >
        {isFr ? 'Nombre de pages indisponible' : 'Page count unavailable'}
      </span>
    );
  }

  const total = data.totalPages;
  // Mirror the server clamp so the badge never advertises a split
  // that would leave one part empty.
  const maxSplit = Math.max(1, total - 1);
  const clamped = Math.max(1, Math.min(splitPage, maxSplit));
  const firstPart = clamped;
  const secondPart = Math.max(0, total - clamped);

  return (
    <span
      className="inline-flex items-center rounded-md border bg-background px-2 py-0.5 text-xs text-muted-foreground"
      data-testid={`sorting-picker-split-pagecount-${itemId}`}
    >
      {isFr
        ? `page ${clamped} sur ${total} — première partie : ${firstPart} page${firstPart > 1 ? 's' : ''}, seconde partie : ${secondPart} page${secondPart > 1 ? 's' : ''}`
        : `page ${clamped} of ${total} — first part: ${firstPart} page${firstPart === 1 ? '' : 's'}, second part: ${secondPart} page${secondPart === 1 ? '' : 's'}`}
    </span>
  );
}

/**
 * Manual split-page input + live preview badge (Task #828). Fetches the
 * staged PDF's page count once when mounted so the underlying number
 * input can advertise `max=totalPages-1`, matching what the preview
 * badge clamps to and what the server enforces. Non-PDF items keep the
 * original `min=1`-only behaviour.
 */
function SplitPageManualInput({
  itemId,
  isPdf,
  splitPage,
  onChange,
  isFr,
}: {
  itemId: string;
  isPdf: boolean;
  splitPage: number;
  onChange: (next: number) => void;
  isFr: boolean;
}) {
  const { data } = useQuery<{ totalPages: number }>({
    queryKey: ['/api/admin/bulk-import/items', itemId, 'page-count'],
    enabled: isPdf,
  });
  const totalPages = data?.totalPages;
  const maxSplit =
    isPdf && typeof totalPages === 'number' && totalPages > 1
      ? totalPages - 1
      : undefined;

  // If the user typed a value before the page count resolved (or the
  // count later shrinks), bring the controlled state back into range
  // so the input value matches what the badge advertises.
  useEffect(() => {
    if (typeof maxSplit === 'number' && splitPage > maxSplit) {
      onChange(maxSplit);
    }
  }, [maxSplit, splitPage, onChange]);

  return (
    <>
      <input
        type="number"
        min={1}
        max={maxSplit}
        className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        value={splitPage}
        onChange={(e) => {
          const raw = parseInt(e.target.value, 10) || 1;
          const lowerBounded = Math.max(1, raw);
          const next =
            typeof maxSplit === 'number'
              ? Math.min(lowerBounded, maxSplit)
              : lowerBounded;
          onChange(next);
        }}
        data-testid={`sorting-picker-split-page-${itemId}`}
      />
      {isPdf && (
        <SplitPagePreview itemId={itemId} splitPage={splitPage} isFr={isFr} />
      )}
    </>
  );
}

function SortingMergeGroupWrapper({
  show,
  testId,
  isFr,
  siblingRows,
  children,
}: {
  show: boolean;
  testId: string;
  isFr: boolean;
  siblingRows: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!show) return <>{children}</>;
  return (
    <div data-testid={testId} className="border-t border-border">
      <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {isFr ? 'Dans cette fusion' : 'In this merge'}
      </p>
      <div className="ml-4 border-l-2 border-border">
        {children}
      </div>
      {siblingRows}
    </div>
  );
}

function HistorySessionRow({
  session,
  buildings,
  expanded,
  onToggle,
  onResume,
  onDelete,
  isDeleting,
  isFr,
  stepLabels,
}: {
  session: BulkImportSession;
  buildings: HistoryRowBuilding[];
  expanded: boolean;
  onToggle: () => void;
  onResume: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isFr: boolean;
  stepLabels: Record<BulkImportStep, string>;
}) {
  const buildingName =
    buildings.find((b) => b.id === session.buildingId)?.name ??
    session.buildingId.slice(0, 8);
  const created = new Date(session.createdAt as unknown as string);
  const dateText = isNaN(created.getTime())
    ? '—'
    : created.toLocaleDateString(isFr ? 'fr-CA' : 'en-CA', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      });
  const statusLabelEn: Record<BulkImportSession['status'], string> = {
    active: 'Active',
    paused: 'Paused',
    completed: 'Completed',
    cleared: 'Cleared',
  };
  const statusLabelFr: Record<BulkImportSession['status'], string> = {
    active: 'Active',
    paused: 'En pause',
    completed: 'Terminée',
    cleared: 'Effacée',
  };
  const statusVariant: Record<BulkImportSession['status'], string> = {
    active: 'bg-emerald-100 text-emerald-900',
    paused: 'bg-amber-100 text-amber-900',
    completed: 'bg-sky-100 text-sky-900',
    cleared: 'bg-gray-100 text-gray-700',
  };
  const resumable = session.status === 'active' || session.status === 'paused';

  // Lazy-fetch the items only when the row is expanded.
  const { data: payload, isLoading } = useQuery<SessionPayload>({
    queryKey: ['/api/admin/bulk-import/sessions', session.id],
    enabled: expanded,
  });
  const items = payload?.items ?? [];
  const itemsWithFallback = items.filter(
    (item) => fallbackReasonsForItem(item).length > 0,
  );

  return (
    <div
      className="rounded-md border bg-card"
      data-testid={`history-row-${session.id}`}
    >
      <div className="flex items-center justify-between gap-3 p-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={expanded}
          data-testid={`history-toggle-${session.id}`}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{buildingName}</span>
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${statusVariant[session.status]}`}
                data-testid={`history-status-${session.id}`}
              >
                {(isFr ? statusLabelFr : statusLabelEn)[session.status]}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{dateText}</span>
              <span>·</span>
              <span>
                {isFr ? 'Étape' : 'Step'}: {stepLabels[session.currentStep]}
              </span>
            </div>
          </div>
        </button>
        {resumable && (
          <Button
            size="sm"
            variant="outline"
            onClick={onResume}
            data-testid={`history-resume-${session.id}`}
          >
            <Play className="mr-1 h-3 w-3" />
            {isFr ? 'Reprendre' : 'Resume'}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label={isFr ? 'Supprimer la session' : 'Delete session'}
          title={isFr ? 'Supprimer la session' : 'Delete session'}
          data-testid={`history-delete-${session.id}`}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 text-destructive" />
          )}
        </Button>
      </div>
      {expanded && (
        <div className="border-t p-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isFr ? 'Chargement…' : 'Loading…'}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid={`history-empty-${session.id}`}>
              {isFr ? 'Aucun fichier dans cette session.' : 'No files in this session.'}
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
                <span className="text-muted-foreground">
                  {items.length}{' '}
                  {isFr ? 'fichier(s)' : 'file(s)'}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium ${
                    itemsWithFallback.length > 0
                      ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                      : 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200'
                  }`}
                  data-testid={`history-fallback-summary-${session.id}`}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {itemsWithFallback.length}{' '}
                  {isFr
                    ? 'fichier(s) avec repli IA'
                    : 'file(s) with AI fallback'}
                </span>
              </div>
              <ul className="space-y-2">
                {items.map((item) => {
                  const reasons = fallbackReasonsForItem(item);
                  const showQa = hasQuickAnalysisSignal(item) || Boolean(item.screeningFallback);
                  return (
                    <li
                      key={item.id}
                      className="rounded-sm border bg-background px-3 py-2"
                      data-testid={`history-item-${item.id}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {item.originalName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.status}
                            {item.mimeType ? ` · ${item.mimeType}` : ''}
                          </div>
                        </div>
                        {reasons.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {isFr ? 'Aucun repli' : 'No fallback'}
                          </span>
                        ) : (
                          <div
                            className="flex flex-wrap items-center gap-1"
                            data-testid={`history-item-fallbacks-${item.id}`}
                          >
                            {reasons.map((r) => (
                              <span
                                key={`${item.id}-${r.step}`}
                                className="inline-flex items-center gap-1 text-xs"
                              >
                                <span className="text-muted-foreground">
                                  {r.step}:
                                </span>
                                <FallbackReasonBadge reason={r.reason} isFr={isFr} />
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {showQa && (
                        <div
                          className="mt-2 border-t pt-2"
                          data-testid={`history-item-quick-analysis-${item.id}`}
                        >
                          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {isFr ? 'Analyse de l’IA' : 'AI analysis'}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.screeningTypeGuess &&
                              item.screeningTypeGuess !== 'unknown' && (
                                <span
                                  className="inline-flex items-center rounded-md border border-purple-300 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-900 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-200"
                                  data-testid={`history-item-type-guess-${item.id}`}
                                >
                                  <span className="mr-1 text-[10px] uppercase tracking-wide opacity-75">
                                    {isFr ? 'Type' : 'Type'}:
                                  </span>
                                  {(isFr ? TYPE_GUESS_LABEL_FR : TYPE_GUESS_LABEL_EN)[
                                    item.screeningTypeGuess
                                  ] ?? item.screeningTypeGuess}
                                </span>
                              )}
                            {item.screeningBucketGuess &&
                              item.screeningBucketGuess !== 'unknown' && (
                                <span
                                  className="inline-flex items-center rounded-md border border-teal-300 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-900 dark:border-teal-700 dark:bg-teal-950 dark:text-teal-200"
                                  data-testid={`history-item-bucket-guess-${item.id}`}
                                >
                                  <span className="mr-1 text-[10px] uppercase tracking-wide opacity-75">
                                    {isFr ? 'Destination' : 'Bucket'}:
                                  </span>
                                  {(isFr ? BUCKET_GUESS_LABEL_FR : BUCKET_GUESS_LABEL_EN)[
                                    item.screeningBucketGuess
                                  ] ?? item.screeningBucketGuess}
                                </span>
                              )}
                            {/* Period hint chip + manual-override tag (Task #997).
                                Read-only in the history view — the editable
                                version lives on the active Sorting row. */}
                            {item.screeningPeriodHint && (
                              <span
                                className="inline-flex items-center rounded-md border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"
                                title={
                                  isFr
                                    ? "Période détectée par l'IA (ou corrigée manuellement)."
                                    : 'Period detected by the AI (or manually overridden).'
                                }
                                data-testid={`history-item-period-hint-${item.id}`}
                              >
                                <span className="mr-1 text-[10px] uppercase tracking-wide opacity-75">
                                  {isFr ? 'Période' : 'Period'}:
                                </span>
                                {item.screeningPeriodHint}
                              </span>
                            )}
                            {item.screeningPeriodHintManualOverride && (
                              <span
                                className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                                title={
                                  isFr
                                    ? "Période corrigée manuellement par un administrateur."
                                    : 'Period manually overridden by an admin.'
                                }
                                data-testid={`history-item-period-hint-manual-${item.id}`}
                              >
                                {isFr ? 'Manuel' : 'Manual'}
                              </span>
                            )}
                          </div>
                          {item.screeningFallback ? (
                            <div
                              className="mt-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                              data-testid={`history-item-fallback-explanation-${item.id}`}
                              title={(isFr ? FALLBACK_REASON_EXPLANATIONS.fr : FALLBACK_REASON_EXPLANATIONS.en)[item.screeningFallback]}
                            >
                              <p className="font-medium">
                                {(isFr ? FALLBACK_REASON_LABELS.fr : FALLBACK_REASON_LABELS.en)[item.screeningFallback]}
                              </p>
                              <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                                {(isFr ? FALLBACK_REASON_EXPLANATIONS.fr : FALLBACK_REASON_EXPLANATIONS.en)[item.screeningFallback]}
                              </p>
                            </div>
                          ) : item.screeningQaReason && (
                            <p
                              className="mt-1.5 whitespace-pre-wrap text-xs text-foreground/80"
                              data-testid={`history-item-qa-reason-${item.id}`}
                            >
                              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {isFr ? 'Raison' : 'Reason'}:
                              </span>
                              {item.screeningQaReason}
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryCard({
  buildings,
  expandedId,
  onToggle,
  onResume,
  isFr,
  stepLabels,
}: {
  buildings: HistoryRowBuilding[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onResume: (id: string) => void;
  isFr: boolean;
  stepLabels: Record<BulkImportStep, string>;
}) {
  const { toast } = useToast();

  const [allSessions, setAllSessions] = useState<BulkImportSession[]>([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [fetchOffset, setFetchOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { isLoading } = useQuery<SessionsPage>({
    queryKey: ['/api/admin/bulk-import/sessions', fetchOffset],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/bulk-import/sessions?limit=${HISTORY_PAGE_SIZE}&offset=${fetchOffset}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const page: SessionsPage = await res.json();
      if (fetchOffset === 0) {
        setAllSessions(page.sessions);
      } else {
        setAllSessions((prev) => [...prev, ...page.sessions]);
      }
      setHasMore(page.hasMore);
      setNextOffset(fetchOffset + HISTORY_PAGE_SIZE);
      setIsLoadingMore(false);
      return page;
    },
    staleTime: 0,
  });

  const sorted = allSessions;

  // Confirmation dialog state for hard-deleting a past session
  // (Task #696). Tracks the candidate session id so the dialog can
  // show its building name in the prompt.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const hardDeleteSession = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(
        'DELETE',
        `/api/admin/bulk-import/sessions/${id}/hard`,
        {},
      );
      return id;
    },
    onSuccess: () => {
      setAllSessions([]);
      setFetchOffset(0);
      setNextOffset(0);
      setHasMore(false);
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions'],
      });
      setPendingDeleteId(null);
      toast({
        title: isFr ? 'Session supprimée' : 'Session deleted',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: isFr
          ? 'Échec de la suppression'
          : 'Failed to delete session',
        description: isFr
          ? 'Veuillez réessayer.'
          : 'Please try again.',
      });
    },
  });

  const pendingSession = pendingDeleteId
    ? sorted.find((s: BulkImportSession) => s.id === pendingDeleteId) ?? null
    : null;
  const pendingBuildingName = pendingSession
    ? buildings.find((b) => b.id === pendingSession.buildingId)?.name ??
      pendingSession.buildingId.slice(0, 8)
    : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          {isFr ? 'Sessions précédentes' : 'Past sessions'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isFr ? 'Chargement…' : 'Loading…'}
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="history-empty">
            {isFr
              ? "Aucune session pour l'instant. Démarrez-en une ci-dessous."
              : 'No sessions yet. Start one below.'}
          </p>
        ) : (
          <div className="space-y-2" data-testid="history-list">
            {sorted.map((s: BulkImportSession) => (
              <HistorySessionRow
                key={s.id}
                session={s}
                buildings={buildings}
                expanded={expandedId === s.id}
                onToggle={() => onToggle(s.id)}
                onResume={() => onResume(s.id)}
                onDelete={() => setPendingDeleteId(s.id)}
                isDeleting={
                  hardDeleteSession.isPending &&
                  hardDeleteSession.variables === s.id
                }
                isFr={isFr}
                stepLabels={stepLabels}
              />
            ))}
            {hasMore && (
              <div className="pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoadingMore}
                  onClick={() => {
                    setIsLoadingMore(true);
                    setFetchOffset(nextOffset);
                  }}
                  data-testid="button-history-load-more"
                >
                  {isLoadingMore ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : null}
                  {isFr ? 'Charger plus' : 'Load more'}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open && !hardDeleteSession.isPending) {
            setPendingDeleteId(null);
          }
        }}
      >
        <AlertDialogContent data-testid="history-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isFr
                ? 'Supprimer cette session ?'
                : 'Delete this session?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isFr
                ? `La session pour « ${pendingBuildingName} » ainsi que tous ses fichiers et décisions IA seront définitivement supprimés. Cette action ne peut pas être annulée.`
                : `The session for "${pendingBuildingName}" along with all its files and AI decisions will be permanently removed. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={hardDeleteSession.isPending}
              data-testid="history-delete-cancel"
            >
              {isFr ? 'Annuler' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={hardDeleteSession.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pendingDeleteId) {
                  hardDeleteSession.mutate(pendingDeleteId);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="history-delete-confirm"
            >
              {hardDeleteSession.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isFr ? 'Suppression…' : 'Deleting…'}
                </>
              ) : isFr ? (
                'Supprimer'
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/**
 * Task #1045: Returns true when an item is "ready for the next step" at
 * the given wizard step. Used by the hide-ready toggle to filter the list.
 *
 * Rules per step (mirrors the next-step-block readiness logic):
 *   screening    — AI classification done AND not excluded (status past pending/screening)
 *   sorting      — sortingDecisionState accepted
 *   branching    — status past sorted AND (not residence_documents OR has residence)
 *   identification — status past branched
 *   linking      — status past identified
 *   complete     — status is committed
 *
 * Task #1069: For every step that has an associated AI decision
 * (`screening`, `branching`, `identification`, `linking`), an item with a
 * non-null fallback recorded for that step's decision is treated as NOT
 * ready, regardless of the status checks above. The backend still promotes
 * AI-failed files to the next status with a default value (e.g. branch =
 * `building_documents` / `other_documents`) and a `*Fallback` reason set,
 * so the row UI keeps telling the admin to "Vérifiez ce fichier ou
 * excluez-le". Treating any recorded fallback on the current step as
 * "needs review" keeps those rows on screen when the hide-ready toggle is
 * ON and gates the Next Step button until they are resolved (retry,
 * accept, or exclude). Sorting already keys off `sortingDecisionState`,
 * which is forced to `pending` on AI failure, so no extra check is needed
 * there. Complete has no AI step.
 */
function isItemReadyForNextStep(item: BulkImportItemLite, step: BulkImportStep): boolean {
  if (
    step === 'screening' ||
    step === 'branching' ||
    step === 'identification' ||
    step === 'linking'
  ) {
    // Task #1082: if the admin has manually overridden the AI decision for
    // this step, skip the fallback gate entirely and fall through to the
    // regular per-step status / residence checks.  For `screening` and
    // `linking` there is no manual-override flag so the fallback gate always
    // applies.  For `sorting`, readiness already keys off
    // `sortingDecisionState === 'accepted'`, which a manual override sets, so
    // no change is needed there.
    const manuallyOverridden =
      (step === 'branching' && item.branchManualOverride) ||
      (step === 'identification' && item.identificationEffectiveDateManualOverride);

    if (!manuallyOverridden) {
      const decision = getItemStepDecision(item, step);
      if (decision?.fallbackReason) return false;
    }
  }
  switch (step) {
    case 'screening':
      return (
        item.status !== 'pending' &&
        item.status !== 'screening' &&
        item.status !== 'rejected'
      );
    case 'sorting':
      return item.sortingDecisionState === 'accepted';
    case 'branching':
      return (
        item.status !== 'pending' &&
        item.status !== 'screening' &&
        item.status !== 'screened' &&
        item.status !== 'sorted' &&
        (item.branch !== 'residence_documents' || item.residenceId !== null)
      );
    case 'identification':
      return (
        item.status !== 'pending' &&
        item.status !== 'screening' &&
        item.status !== 'screened' &&
        item.status !== 'sorted' &&
        item.status !== 'branched'
      );
    case 'linking':
      return (
        item.status !== 'pending' &&
        item.status !== 'screening' &&
        item.status !== 'screened' &&
        item.status !== 'sorted' &&
        item.status !== 'branched' &&
        item.status !== 'identified'
      );
    case 'complete':
      return item.status === 'committed';
    default:
      return false;
  }
}

const TAG_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Inline tag editor rendered on every Identification-step row (Task #1103).
 *
 * Pre-selects the tag UUIDs already stored on `identificationTags` and
 * surfaces the AI's matched suggestions (sparkle icon) via the picker's
 * `suggestedTagIds` prop.
 *
 * Where the suggestions come from (Task #1105):
 *   - On freshly-identified items the server resolves the AI's free-form
 *     tag-name suggestions (e.g. "insurance") to real UUIDs at
 *     identification time and exposes them as
 *     `identificationAiSuggestedTagIds`. We prefer that list so the
 *     sparkle keeps showing even after the admin tweaks the picker
 *     through set-tags (which only mutates `tags`, never the AI-suggest
 *     stash).
 *   - For legacy items whose identification ran before that field
 *     existed (`identificationAiSuggestedTagIds` is null), we fall back
 *     to the original client-side string-matching path: any non-UUID
 *     entries in `identificationTags` are matched against the loaded
 *     tag list by lowercase name.
 *
 * Debounces each toggle 300 ms so rapid add/remove operations are coalesced
 * into a single network request instead of racing.
 */
function IdentificationTagEditor({
  item,
  isFr,
  onSave,
  saveStatus,
}: {
  item: BulkImportItemLite;
  isFr: boolean;
  onSave: (itemId: string, tagIds: string[]) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}) {
  const { data: tagData } = useQuery<{ tags: Array<{ id: string; name: string; scope: string; importance: string; isSystem: boolean }> }>({
    queryKey: ['/api/document-tags'],
  });
  const allTags = tagData?.tags ?? [];

  const rawTags = item.identificationTags ?? [];
  // Defensive UUID filter: post-Task-#1105 sessions only ever store
  // UUIDs in `tags` (the server drops free-form names), but legacy
  // sessions may still carry AI name strings here. Filtering keeps the
  // editor robust either way without surfacing invalid pre-selections.
  const storedTagIds = useMemo(
    () => rawTags.filter((t) => TAG_UUID_RE.test(t)),
    [rawTags],
  );
  const suggestedTagIds = useMemo(() => {
    // Prefer the server-resolved AI suggestions when available so the
    // sparkle persists across admin edits.
    if (item.identificationAiSuggestedTagIds !== null) {
      return item.identificationAiSuggestedTagIds;
    }
    // Legacy path: match any free-form AI strings still stored in
    // `identificationTags` against the tag list client-side. Keeps the
    // sparkle working for sessions whose identification predates the
    // server-side mapping.
    const aiNameSuggestions = rawTags.filter((t) => !TAG_UUID_RE.test(t));
    if (aiNameSuggestions.length === 0) return [];
    const nameMap = new Map(allTags.map((t) => [t.name.toLowerCase(), t.id]));
    return aiNameSuggestions.flatMap((name) => {
      const id = nameMap.get(name.toLowerCase());
      return id ? [id] : [];
    });
  }, [allTags, rawTags, item.identificationAiSuggestedTagIds]);

  const [localTags, setLocalTags] = useState<string[]>(storedTagIds);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevStoredRef = useRef<string[]>(storedTagIds);
  useEffect(() => {
    const prev = prevStoredRef.current;
    if (
      prev.length !== storedTagIds.length ||
      prev.some((id, i) => id !== storedTagIds[i])
    ) {
      setLocalTags(storedTagIds);
      prevStoredRef.current = storedTagIds;
    }
  }, [storedTagIds]);

  const branchForScope = item.branch;
  const tagScope: 'building' | 'residence' | undefined =
    branchForScope === 'residence_documents'
      ? 'residence'
      : branchForScope === 'building_documents'
      ? 'building'
      : undefined;

  const handleChange = (next: string[]) => {
    setLocalTags(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSave(item.id, next);
    }, 300);
  };

  return (
    <div
      className="mt-2 space-y-1"
      data-testid={`identification-tag-editor-${item.id}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-xs text-muted-foreground">
          {isFr ? 'Étiquettes' : 'Tags'}
        </span>
        {saveStatus === 'saving' && (
          <Loader2
            className="h-3 w-3 animate-spin text-muted-foreground"
            data-testid={`identification-tags-saving-${item.id}`}
          />
        )}
        {saveStatus === 'saved' && (
          <Check
            className="h-3 w-3 text-green-600 dark:text-green-400"
            data-testid={`identification-tags-saved-${item.id}`}
          />
        )}
        {saveStatus === 'error' && (
          <X
            className="h-3 w-3 text-destructive"
            data-testid={`identification-tags-error-${item.id}`}
          />
        )}
      </div>
      <TagPicker
        value={localTags}
        onChange={handleChange}
        scope={tagScope}
        suggestedTagIds={suggestedTagIds}
        placeholder={isFr ? 'Ajouter des étiquettes…' : 'Add tags…'}
      />
    </div>
  );
}

export default function BulkDocumentImportPage() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const isFr = language === 'fr';
  const stepLabels = isFr ? STEP_LABEL_FR : STEP_LABEL_EN;

  const [buildingId, setBuildingId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<{ id: string; originalName: string; mimeType: string | null } | null>(null);
  // Per-item expansion state for the detail panel that reveals the
  // full-size quickAnalysis guesses, the labelled confidence and the
  // un-truncated reason text (Task #771). Stored as a Set so multiple
  // rows can be opened simultaneously without forcing the user to
  // collapse one before opening the next.
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  // For the Branching step rows are expanded by default (Task #903).
  // We track which rows the user has explicitly collapsed so that
  // newly arriving rows also appear expanded without any extra state.
  const [collapsedBranchingItemIds, setCollapsedBranchingItemIds] = useState<Set<string>>(new Set());
  const toggleItemExpanded = (id: string) => {
    if (currentStep === 'branching') {
      setCollapsedBranchingItemIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setExpandedItemIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  };
  // Filters for the building picker on the "Start a session" card
  // (Task #600). Local-only state; not persisted across reloads.
  const [buildingSearch, setBuildingSearch] = useState('');
  const [buildingTypeFilter, setBuildingTypeFilter] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  // Per-item hidden file inputs that back the "Replace file" button on
  // the inline PDF-corruption banner (Task #1051). Keyed by item id; a
  // ref callback registers each input when its banner mounts so the
  // button can trigger the native picker without spreading file inputs
  // throughout the page.
  const replaceFileInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());

  // Return to the first page (building picker + history) without
  // touching the session itself, so the user can resume it later from
  // the history list (Task #591).
  const goBackToStart = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSessionId(null);
    setBuildingId('');
    setExpandedHistoryId(null);
  };

  // Resume on reload via localStorage.
  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) setSessionId(cached);
  }, []);

  useEffect(() => {
    if (sessionId) localStorage.setItem(STORAGE_KEY, sessionId);
  }, [sessionId]);

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/admin/bulk-import/buildings-lite'],
  });

  /**
   * Page-level AI health probe (Task #710). When the Anthropic key is
   * missing every analyzer call falls back to a 20%-confidence stub.
   * The page-level banner makes that explicit so admins don't scroll
   * through dozens of fallback badges trying to figure out why nothing
   * looks accurate. Defaulted to `available: true` so the banner stays
   * hidden while the probe is loading or fails — better to be quiet
   * than to flash a misleading warning.
   */
  const { data: aiStatus } = useQuery<{ available: boolean }>({
    queryKey: ['/api/admin/bulk-import/ai-status'],
  });
  const aiAvailable = aiStatus?.available ?? true;
  const [aiBannerDismissed, setAiBannerDismissed] = useState(false);
  const [reassignPickerItemId, setReassignPickerItemId] = useState<string | null>(null);
  const [reassignBranch, setReassignBranch] = useState<BranchDestination>('building_documents');
  const [reassignSubCategory, setReassignSubCategory] = useState<string>('other');
  const [reassignResidenceId, setReassignResidenceId] = useState<string>('');

  // Sorting-step manual decision picker state. Keyed by item ID so every
  // rejected row can show its own picker simultaneously. Entries are
  // pre-populated from the AI suggestion when a row enters 'rejected' state.
  const [sortingPickerStates, setSortingPickerStates] = useState<
    Map<string, { decision: 'keep' | 'merge' | 'split'; mergeTargetId: string; splitPage: number }>
  >(new Map());
  // Inline slice/merge editing state (Task #856). Keyed by item id.
  const [inlineSlicePage, setInlineSlicePage] = useState<Map<string, number>>(new Map());
  const [inlineMergeOrder, setInlineMergeOrder] = useState<Map<string, string[]>>(new Map());
  const [inlineRename, setInlineRename] = useState<Map<string, string>>(new Map());
  const [inlineRenameSplit, setInlineRenameSplit] = useState<Map<string, [string, string]>>(new Map());
  // Inline effective-date editor state (Task #1031). Keyed by item
  // id, the string value mirrors the date input as the admin types.
  // Unlike the period-hint editor this is a "live" field — a date
  // input is always visible on the identification row, pre-filled
  // with `identificationEffectiveDate || screeningParsedPeriodHintDate`,
  // and a Save button commits it to the server. We keep the map so a
  // pending edit isn't lost when the lite payload re-fetches.
  const [editingEffectiveDate, setEditingEffectiveDate] = useState<Map<string, string>>(new Map());
  // Per-item tag save status (Task #1103). Drives the per-row saving/saved/error
  // indicator that is passed as `saveStatus` to each `IdentificationTagEditor`.
  // Local tag selection state lives inside that component (with debounce).
  const [tagSaveStatus, setTagSaveStatus] = useState<Map<string, 'idle' | 'saving' | 'saved' | 'error'>>(new Map());
  const [autoSaveStatus, setAutoSaveStatus] = useState<Map<string, 'idle' | 'saving' | 'saved' | 'error'>>(new Map());
  // Auto-apply tracking refs (Task #1149). Each map records the suggestion
  // signature (date string / sorted tag UUID list) that was last auto-applied
  // for each item so that:
  //   • The same suggestion never fires twice (de-duplication across re-renders).
  //   • A fresh AI suggestion that differs from the previously applied one
  //     does fire once more (handles per-item retries that return new outputs).
  // prevEffectiveDateRef detects the identificationEffectiveDate non-null → null
  // transition that indicates a date reset, so the fresh date hint re-applies.
  // prevIdentificationTagsNonNullRef detects the identificationTags non-null → null
  // transition (step reset sets identification=null → identificationTags=null)
  // so the fresh AI suggestion can re-apply even if the signature is unchanged.
  // This is safe because admin-explicit tag clears set identificationTags=[]
  // (empty array, not null), which does NOT trigger the transition guard.
  const autoAppliedDateRef = useRef<Map<string, string>>(new Map());
  const autoAppliedTagsRef = useRef<Map<string, string>>(new Map());
  const prevEffectiveDateRef = useRef<Map<string, string | null>>(new Map());
  const prevIdentificationTagsNonNullRef = useRef<Map<string, boolean>>(new Map());
  // Per-item sorting-decision error map (Task #1036). Keyed by item id.
  // Populated when set-sorting-decision returns a 400 with a recognised
  // PDF-corruption code so the affected card can show an inline alert
  // explaining which file is problematic and how to fix it. Cleared on
  // success / retry so the alert disappears once the admin recovers.
  const [sortingDecisionErrors, setSortingDecisionErrors] = useState<
    Map<string, { code: string; title: string; description: string }>
  >(new Map());
  // Group-level reassign picker (Task #776). At most one section's
  // picker is open at a time; opening a per-file picker closes it and
  // vice-versa so the wizard never shows two competing pickers.
  const [groupReassignKey, setGroupReassignKey] = useState<string | null>(null);
  const [groupReassignBranch, setGroupReassignBranch] = useState<BranchDestination>('building_documents');
  const [groupReassignSubCategory, setGroupReassignSubCategory] = useState<string>('other');
  // Optional residence to apply to every file in the group when the
  // destination is `residence_documents` (Task #1084). Empty string
  // means "leave each item's residence as-is" so admins can still do
  // a destination-only bulk reassign that lets the per-file residence
  // picker handle the residenceId individually.
  const [groupReassignResidenceId, setGroupReassignResidenceId] = useState<string>('');
  const [residencePickerItemId, setResidencePickerItemId] = useState<string | null>(null);
  const [residencePickerValue, setResidencePickerValue] = useState<string>('');

  // Pull the org list so each building's organizationId can be
  // resolved to a human-readable group header (Task #600). The picker
  // still renders gracefully if this is loading or fails — buildings
  // with no resolvable org just fall under an "Other" group.
  const { data: organizations = [] } = useQuery<OrganizationLite[]>({
    queryKey: ['/api/organizations'],
  });

  const organizationsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of organizations) map.set(o.id, o.name);
    return map;
  }, [organizations]);

  // Distinct building types present in the loaded list, used to
  // populate the type-filter dropdown. Sorted for stable display.
  const buildingTypes = useMemo(() => {
    const set = new Set<string>();
    for (const b of buildings) {
      if (b.buildingType && b.buildingType.trim().length > 0) {
        set.add(b.buildingType);
      }
    }
    return Array.from(set).sort();
  }, [buildings]);

  const filteredBuildings = useMemo(() => {
    const q = buildingSearch.trim().toLowerCase();
    return buildings.filter((b) => {
      if (buildingTypeFilter !== 'all' && b.buildingType !== buildingTypeFilter) {
        return false;
      }
      if (q.length === 0) return true;
      const haystack = [b.name, b.address, b.city, b.province]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [buildings, buildingSearch, buildingTypeFilter]);

  const groupedBuildings = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; items: Building[] }>();
    for (const b of filteredBuildings) {
      const orgId = b.organizationId || '__none__';
      const orgName =
        organizationsById.get(b.organizationId) ??
        (isFr ? 'Autre' : 'Other');
      const existing = groups.get(orgId);
      if (existing) {
        existing.items.push(b);
      } else {
        groups.set(orgId, { id: orgId, name: orgName, items: [b] });
      }
    }
    return Array.from(groups.values()).sort((a, b) =>
      a.name.localeCompare(b.name, isFr ? 'fr-CA' : 'en-CA'),
    );
  }, [filteredBuildings, organizationsById, isFr]);

  const { data: payload, isLoading: loadingSession } = useQuery<SessionPayloadLite>({
    queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
    enabled: !!sessionId,
    // Poll faster while any AI step run-all loop is active so the
    // counter and "Analyzing: name" heartbeat update quickly (Task #898).
    // Once all steps are finished we throttle back to 5s.
    refetchInterval: (query) => {
      const data = query.state.data as SessionPayloadLite | undefined;
      if (!data) return 5000;
      const screeningActive =
        data.session.currentStep === 'screening' &&
        data.items.some((i) => i.status === 'pending' || i.status === 'screening');
      if (screeningActive) return 2000;
      const progress = data.session.progress as Record<string, unknown> | null | undefined;
      const runAll = progress?.runAll as Record<string, RunAllProgress> | undefined;
      const anyRunning =
        runAll &&
        Object.values(runAll).some(
          (p) => p && typeof p === 'object' && !p.finishedAt,
        );
      return anyRunning ? 2000 : 5000;
    },
  });

  // Fetch document tags for the auto-apply legacy name-match path (Task #1149).
  // Uses the same queryKey as IdentificationTagRow so the data is served from
  // the TanStack Query cache — no extra network request.
  const { data: allTagsData } = useQuery<{ tags: Array<{ id: string; name: string; scope: string; importance: string; isSystem: boolean }> }>({
    queryKey: ['/api/document-tags'],
  });
  // Memoize so the reference is stable across re-renders (avoids spurious
  // effect runs since allTagsForAutoApply is a dep of the auto-apply effect).
  const allTagsForAutoApply = useMemo(
    () => allTagsData?.tags ?? [],
    [allTagsData],
  );

  const session = payload?.session;
  const items = payload?.items ?? [];
  const currentStep: BulkImportStep = session?.currentStep ?? 'upload';

  // Hide-ready toggle (Task #1045). Defaults OFF on every step; resets
  // automatically when the wizard advances to a new step so hidden rows
  // from one step never bleed into the next.
  const [hideReady, setHideReady] = useState(false);
  useEffect(() => {
    setHideReady(false);
  }, [currentStep]);

  const createSession = useMutation({
    mutationFn: async (targetBuildingId: string) => {
      const res = await apiRequest('POST', '/api/admin/bulk-import/sessions', {
        buildingId: targetBuildingId,
      });
      return res.json() as Promise<BulkImportSession>;
    },
    onSuccess: (s) => {
      setSessionId(s.id);
      // Invalidate the history list (all paginated variants).
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bulk-import/sessions'] });
      toast({
        title: isFr ? 'Session créée' : 'Session created',
        description: isFr ? 'Vous pouvez téléverser des fichiers.' : 'You can upload files now.',
      });
    },
    onError: (err: unknown) => {
      setBuildingId('');
      const rawDetail = err instanceof Error ? err.message : '';
      // Keep the toast clean: drop HTML-ish noise from proxy/error pages and
      // cap length so a server stack trace can't blow up the toast.
      const safeDetail =
        rawDetail && !/<[^>]+>/.test(rawDetail)
          ? rawDetail.slice(0, 140)
          : '';
      toast({
        variant: 'destructive',
        title: isFr
          ? 'Impossible de démarrer la session'
          : 'Could not start session',
        description: isFr
          ? `Veuillez réessayer ou choisir un autre immeuble.${safeDetail ? ` (${safeDetail})` : ''}`
          : `Please try again or pick another building.${safeDetail ? ` (${safeDetail})` : ''}`,
      });
    },
  });

  const updateStep = useMutation({
    mutationFn: async (next: BulkImportStep) => {
      const res = await apiRequest('PATCH', `/api/admin/bulk-import/sessions/${sessionId}`, {
        currentStep: next,
      });
      return res.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      }),
  });

  const ZIP_MIMES_CLIENT = new Set([
    'application/zip',
    'application/x-zip-compressed',
    'application/x-zip',
    'multipart/x-zip',
  ]);

  function isZipFile(f: File): boolean {
    if (ZIP_MIMES_CLIENT.has(f.type.toLowerCase())) return true;
    if (f.name.toLowerCase().endsWith('.zip')) return true;
    return false;
  }

  const uploadFiles = useMutation({
    mutationFn: async (files: FileList) => {
      const allFiles = Array.from(files);
      const skipped = allFiles.filter(isZipFile);
      const allowed = allFiles.filter((f) => !isZipFile(f));

      if (skipped.length > 0) {
        const names = skipped.map((f) => f.name).join(', ');
        toast({
          variant: 'destructive',
          title: isFr ? 'Fichiers ZIP ignorés' : 'ZIP files skipped',
          description: isFr
            ? `Les archives ZIP ne sont pas acceptées : ${names}`
            : `ZIP archives are not accepted: ${names}`,
        });
      }

      if (allowed.length === 0) return [];

      const fd = new FormData();
      allowed.forEach((f) => fd.append('files', f));
      const res = await fetch(
        `/api/admin/bulk-import/sessions/${sessionId}/items`,
        { method: 'POST', body: fd, credentials: 'include' },
      );
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    },
    onSuccess: (data) => {
      if (!data || data.length === 0) return;
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
      toast({ title: isFr ? 'Téléversement réussi' : 'Files uploaded' });
    },
  });

  /**
   * Per-item "Replace file" action surfaced inside the inline
   * PDF-corruption banner (Task #1051). Lets an admin who hits a
   * MERGE_*_PDF_* / PDF_PAGE_TREE_UNRECOVERABLE error during sorting
   * swap the corrupt staged file for a re-saved copy without leaving
   * the wizard. On success we drop the row's banner entry and
   * invalidate the lite payload so the new originalName / fileSize
   * land in the UI; the admin can then re-click Accept / Confirm and
   * the sorting decision retries against the fresh bytes.
   */
  const replaceFile = useMutation({
    mutationFn: async ({ itemId, file }: { itemId: string; file: File }) => {
      const fd = new FormData();
      fd.append('files', file);
      const res = await fetch(
        `/api/admin/bulk-import/items/${itemId}/replace-file`,
        { method: 'POST', body: fd, credentials: 'include' },
      );
      if (!res.ok) {
        let serverMessage: string | undefined;
        try {
          const body = (await res.json()) as { error?: unknown };
          if (typeof body.error === 'string') serverMessage = body.error;
        } catch {
          /* ignore — fall through to generic message */
        }
        throw new Error(serverMessage ?? 'Replace failed');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      setSortingDecisionErrors((prev) => {
        if (!prev.has(variables.itemId)) return prev;
        const next = new Map(prev);
        next.delete(variables.itemId);
        return next;
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
      toast({ title: isFr ? 'Fichier remplacé' : 'File replaced' });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: isFr ? 'Échec du remplacement' : 'Failed to replace file',
        ...(error instanceof Error && error.message
          ? { description: error.message }
          : {}),
      });
    },
  });

  const runStep = useMutation({
    mutationFn: async ({
      itemId,
      action,
    }: {
      itemId: string;
      action: 'screen' | 'sort' | 'branch' | 'identify' | 'link' | 'commit';
    }) => {
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/items/${itemId}/${action}`,
        {},
      );
      return res.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      }),
  });

  /**
   * Auto-trigger the server-side "run-all" loop for the current AI step
   * (Task #592). The endpoint is idempotent — calling it twice while a
   * loop is in flight is a no-op — so re-renders/remounts are safe. We
   * still keep a per-(session, step) ref so we don't fire on every
   * polling refresh.
   */
  const runAll = useMutation({
    mutationFn: async (step: AutoStep) => {
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/sessions/${sessionId}/run-all`,
        { step },
      );
      return res.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      }),
  });

  const triggeredAutoRunRef = useRef<Set<string>>(new Set());

  /**
   * Task #1068 — "Retry step from scratch" reset for the current AI
   * step. Wipes every eligible item's decision for the step, cancels
   * any in-flight loop, drops the cached `progress.runAll[step]` so
   * the progress banner restarts from "Starting…", and re-fires the
   * server-side run-all loop. Confirmation lives in an AlertDialog
   * gated on `pendingResetStep`.
   */
  const [pendingResetStep, setPendingResetStep] = useState<AutoStep | null>(null);
  const resetStep = useMutation({
    mutationFn: async (step: AutoStep) => {
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/sessions/${sessionId}/reset-step`,
        { step },
      );
      return res.json();
    },
    onSuccess: (_data, step) => {
      // Clear the once-per-(session, step) auto-trigger guard so the
      // useEffect above will re-fire if the wizard remounts on this
      // same step. The server already kicked off a fresh run-all
      // loop, but this keeps the client and server in agreement.
      triggeredAutoRunRef.current.delete(`${sessionId}:${step}`);
      setPendingResetStep(null);
      void queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
      toast({
        title: isFr
          ? 'Étape réinitialisée — analyse relancée'
          : 'Step reset — analysis restarted',
      });
    },
    onError: () => {
      setPendingResetStep(null);
      toast({
        variant: 'destructive',
        title: isFr
          ? "Échec de la réinitialisation de l'étape"
          : 'Failed to reset step',
      });
    },
  });
  useEffect(() => {
    if (!sessionId || !session) return;
    if (!isAutoStep(currentStep)) return;
    const key = `${sessionId}:${currentStep}`;
    if (triggeredAutoRunRef.current.has(key)) return;
    triggeredAutoRunRef.current.add(key);
    runAll.mutate(currentStep);
    // We intentionally only depend on sessionId + currentStep so the
    // mutation fires exactly once per (session, step) per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, currentStep, !!session]);

  /**
   * Stall detection (Task #898): track when progress last moved so we
   * can surface a "Run looks stalled — retry" button if the run
   * appears hung. We compare a fingerprint of (processed + inFlight
   * length) each poll and reset a timestamp whenever it changes.
   */
  const STALL_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes
  const stallRef = useRef<{
    step: string;
    fingerprint: string;
    since: number;
  } | null>(null);

  function computeStallFingerprint(progress: RunAllProgress | null): string {
    if (!progress) return 'none';
    return `${progress.processed}:${(progress.inFlight ?? []).length}`;
  }

  const currentProgress = isAutoStep(currentStep)
    ? readRunAllProgress(session, currentStep)
    : null;
  const currentFingerprint = computeStallFingerprint(currentProgress);

  if (isAutoStep(currentStep) && currentProgress && !currentProgress.finishedAt) {
    if (
      !stallRef.current ||
      stallRef.current.step !== currentStep ||
      stallRef.current.fingerprint !== currentFingerprint
    ) {
      stallRef.current = {
        step: currentStep,
        fingerprint: currentFingerprint,
        since: Date.now(),
      };
    }
  } else {
    stallRef.current = null;
  }

  const isStalled =
    !!stallRef.current &&
    stallRef.current.step === currentStep &&
    Date.now() - stallRef.current.since > STALL_THRESHOLD_MS;

  /**
   * Toggle the exclusion of a single staged item (Task #717).
   * Optimistically flips the status in the cached payload so the row's
   * visual state updates instantly, then invalidates so the real
   * server response (with the restored `preExcludeStatus`) replaces
   * the optimistic guess.
   */
  const toggleExclude = useMutation({
    mutationFn: async ({
      itemId,
      excluded,
    }: {
      itemId: string;
      excluded: boolean;
    }) => {
      const res = await apiRequest(
        'PATCH',
        `/api/admin/bulk-import/items/${itemId}/exclude`,
        { excluded },
      );
      return res.json() as Promise<BulkImportItem>;
    },
    onMutate: async ({ itemId, excluded }) => {
      const queryKey = ['/api/admin/bulk-import/sessions', sessionId, 'lite'];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SessionPayloadLite>(queryKey);
      if (previous) {
        queryClient.setQueryData<SessionPayloadLite>(queryKey, {
          ...previous,
          items: previous.items.map((it) => {
            if (it.id !== itemId) return it;
            if (excluded) {
              return {
                ...it,
                status: 'rejected' as const,
                preExcludeStatus: it.preExcludeStatus ?? it.status,
              };
            }
            return {
              ...it,
              status: (it.preExcludeStatus ?? 'pending') as BulkImportItem['status'],
              preExcludeStatus: null,
            };
          }),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
          context.previous,
        );
      }
      toast({
        variant: 'destructive',
        title: isFr ? "Échec de l'exclusion" : 'Failed to update exclusion',
      });
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      }),
  });

  const reassignItem = useMutation({
    mutationFn: async ({
      itemId,
      branch,
      subCategory,
      residenceId,
    }: {
      itemId: string;
      branch: BranchDestination;
      subCategory: string;
      residenceId?: string | null;
    }) => {
      const body: Record<string, unknown> = { branch, subCategory };
      if (branch === 'residence_documents' && residenceId) {
        body.residenceId = residenceId;
      }
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/items/${itemId}/reassign`,
        body,
      );
      return res.json() as Promise<BulkImportItem>;
    },
    onSuccess: () => {
      setReassignPickerItemId(null);
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
      toast({
        title: isFr ? 'Fichier réaffecté' : 'File reassigned',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: isFr ? 'Échec de la réaffectation' : 'Failed to reassign item',
      });
    },
  });

  /**
   * Bulk reassignment for an entire destination group (Task #776).
   * Hits the dedicated `/sessions/:id/items/reassign-bulk` endpoint
   * once per group action so the lite session cache is invalidated a
   * single time instead of once per file. Excluded / committed items
   * are filtered out client-side before the request goes out (and
   * rejected again server-side as a safety net).
   */
  const reassignGroup = useMutation({
    mutationFn: async ({
      itemIds,
      branch,
      subCategory,
      residenceId,
    }: {
      itemIds: string[];
      branch: BranchDestination;
      subCategory: string;
      residenceId?: string | null;
    }) => {
      const body: Record<string, unknown> = { branch, subCategory, itemIds };
      // Only attach residenceId when the destination is residence_documents
      // and the admin actually picked one — sending it for other branches
      // would be ignored server-side anyway, but keeping the payload tight
      // avoids ambiguity in the audit trail (Task #1084).
      if (branch === 'residence_documents' && residenceId) {
        body.residenceId = residenceId;
      }
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/sessions/${sessionId}/items/reassign-bulk`,
        body,
      );
      return res.json() as Promise<{ updated: number; items: BulkImportItem[] }>;
    },
    onSuccess: (data) => {
      setGroupReassignKey(null);
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
      toast({
        title: isFr
          ? `${data.updated} fichier${data.updated > 1 ? 's' : ''} réaffecté${data.updated > 1 ? 's' : ''}`
          : `Reassigned ${data.updated} file${data.updated === 1 ? '' : 's'}`,
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: isFr
          ? 'Échec de la réaffectation du groupe'
          : 'Failed to reassign group',
      });
    },
  });

  /**
   * Fetch the active building's residences for the residence picker
   * (Task #780). Only fetched when the wizard is on the branching step
   * so we don't burden other steps with an unnecessary query.
   */
  const { data: buildingResidences = [] } = useQuery<Array<{ id: string; unitNumber: string }>>({
    queryKey: ['/api/buildings', session?.buildingId, 'residences'],
    enabled: !!session?.buildingId && currentStep === 'branching',
    queryFn: async () => {
      const res = await fetch(`/api/buildings/${session!.buildingId}/residences`, {
        credentials: 'include',
      });
      if (!res.ok) return [];
      const data = await res.json() as Array<{ id: string; unitNumber: string }>;
      return data.sort((a, b) =>
        a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true }),
      );
    },
  });
  const residencesById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of buildingResidences) m.set(r.id, r.unitNumber);
    return m;
  }, [buildingResidences]);

  const setResidenceMutation = useMutation({
    mutationFn: async ({ itemId, residenceId }: { itemId: string; residenceId: string | null }) => {
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/items/${itemId}/set-residence`,
        { residenceId },
      );
      return res.json() as Promise<BulkImportItem>;
    },
    onSuccess: () => {
      setResidencePickerItemId(null);
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: isFr ? 'Échec de l\'attribution de résidence' : 'Failed to set residence',
      });
    },
  });

  /**
   * Bulk-confirm every AI-suggested residence in the current session
   * (Task #803). The handler dismisses the "AI suggestion" chip on
   * each qualifying row by flipping `residenceAiConfirmed: true`
   * server-side; the underlying residence selection is left
   * unchanged. Useful when an admin has skimmed the picks and wants
   * to clear the chips in one click.
   */
  const confirmAllAiResidences = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/sessions/${sessionId}/items/confirm-ai-residences`,
        {},
      );
      return res.json() as Promise<{ updated: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
      toast({
        title: isFr
          ? `${data.updated} suggestion${data.updated === 1 ? '' : 's'} confirmée${data.updated === 1 ? '' : 's'}`
          : `Confirmed ${data.updated} AI suggestion${data.updated === 1 ? '' : 's'}`,
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: isFr ? 'Échec de la confirmation' : 'Failed to confirm AI suggestions',
      });
    },
  });

  /**
   * Bulk-accept every pending sorting decision in the session (Task #900).
   * Mirrors the per-row Accept button but fires a single request for all
   * eligible items. Rows that the admin is mid-editing (inline split page
   * or inline merge order set) are excluded from the count and the
   * server skips anything not in 'pending' state.
   */
  const acceptAllPendingSorting = useMutation({
    mutationFn: async ({ skipItemIds, skippedCount }: { skipItemIds: string[]; skippedCount: number }) => {
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/sessions/${sessionId}/items/accept-all-pending-sorting`,
        { skipItemIds },
      );
      const data = await res.json() as { accepted: number };
      return { accepted: data.accepted, skippedCount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
      const acceptedMsg = isFr
        ? `${data.accepted} décision${data.accepted === 1 ? '' : 's'} acceptée${data.accepted === 1 ? '' : 's'}`
        : `Accepted ${data.accepted} decision${data.accepted === 1 ? '' : 's'}`;
      const skippedMsg = data.skippedCount > 0
        ? isFr
          ? ` (${data.skippedCount} ignoré${data.skippedCount === 1 ? '' : 's'} — modifications en cours)`
          : ` (${data.skippedCount} skipped — edits in progress)`
        : '';
      toast({ title: acceptedMsg + skippedMsg });
    },
    onError: (error) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
      let serverMessage: string | undefined;
      if (error instanceof ApiError && error.body && typeof error.body === 'object') {
        const body = error.body as Record<string, unknown>;
        serverMessage = typeof body.error === 'string' ? body.error
          : typeof body.message === 'string' ? body.message
          : undefined;
      }
      toast({
        variant: 'destructive',
        title: isFr
          ? 'Échec de l\'acceptation groupée'
          : 'Failed to accept all pending decisions',
        ...(serverMessage ? { description: serverMessage } : {}),
      });
    },
  });

  /**
   * Accept / reject the AI's sorting-step suggestion, or commit a
   * manual keep/merge/split decision.
   */
  const setSortingDecision = useMutation({
    mutationFn: async ({
      itemId,
      action,
      decision,
      mergeWithItemId,
      mergeWithItemIds,
      splitAtPage,
    }: {
      itemId: string;
      action: 'accept' | 'reject' | 'manual';
      decision?: 'keep' | 'merge' | 'split';
      mergeWithItemId?: string;
      mergeWithItemIds?: string[];
      splitAtPage?: number;
    }) => {
      // Optimistically clear any previous inline error for this row so
      // the alert disappears as soon as the admin retries (Task #1036).
      setSortingDecisionErrors((prev) => {
        if (!prev.has(itemId)) return prev;
        const next = new Map(prev);
        next.delete(itemId);
        return next;
      });
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/items/${itemId}/set-sorting-decision`,
        { action, decision, mergeWithItemId, mergeWithItemIds, splitAtPage },
      );
      return res.json();
    },
    onSuccess: (_data, variables) => {
      setSortingPickerStates((prev) => {
        const next = new Map(prev);
        next.delete(variables.itemId);
        return next;
      });
      setInlineSlicePage((prev) => {
        const next = new Map(prev);
        next.delete(variables.itemId);
        return next;
      });
      setInlineMergeOrder((prev) => {
        const next = new Map(prev);
        next.delete(variables.itemId);
        return next;
      });
      setSortingDecisionErrors((prev) => {
        if (!prev.has(variables.itemId)) return prev;
        const next = new Map(prev);
        next.delete(variables.itemId);
        return next;
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
    },
    onError: (error, variables) => {
      let serverMessage: string | undefined;
      let serverCode: string | undefined;
      if (error instanceof ApiError && error.body && typeof error.body === 'object') {
        const body = error.body as Record<string, unknown>;
        serverMessage = typeof body.error === 'string' ? body.error
          : typeof body.message === 'string' ? body.message
          : undefined;
        serverCode = typeof body.code === 'string' ? body.code : undefined;
      }
      // For known PDF-corruption codes, swap the raw server message for an
      // actionable FR/EN explanation and surface the same message inline on
      // the affected card so the admin can see which file is problematic
      // (Task #1036).
      const friendly = serverCode
        ? getSortingDecisionFriendlyMessage(serverCode, isFr)
        : null;
      if (friendly && serverCode) {
        setSortingDecisionErrors((prev) => {
          const next = new Map(prev);
          next.set(variables.itemId, {
            code: serverCode,
            title: friendly.title,
            description: friendly.description,
          });
          return next;
        });
        toast({
          variant: 'destructive',
          title: friendly.title,
          description: friendly.description,
        });
        return;
      }
      toast({
        variant: 'destructive',
        title: isFr ? 'Échec de la décision' : 'Failed to save decision',
        ...(serverMessage ? { description: serverMessage } : {}),
      });
    },
  });

  /**
   * Persist an admin override for `screening.periodHint` on a single
   * Sorting row (Task #997). The server re-runs sorting for the target
   * item AND any same-type+bucket sibling whose decision is still
   * pending so the admin doesn't have to re-upload the file when the
   * Screening AI guessed the wrong fiscal year / invoice number /
   * meeting date.
   */
  const setPeriodHint = useMutation({
    mutationFn: async ({
      itemId,
      periodHint,
    }: {
      itemId: string;
      periodHint: string | null;
    }) => {
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/items/${itemId}/set-period-hint`,
        { periodHint },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
    },
    onError: (error) => {
      let serverMessage: string | undefined;
      if (error instanceof ApiError && error.body && typeof error.body === 'object') {
        const body = error.body as Record<string, unknown>;
        serverMessage = typeof body.error === 'string' ? body.error
          : typeof body.message === 'string' ? body.message
          : undefined;
      }
      toast({
        variant: 'destructive',
        title: isFr ? 'Échec de la mise à jour de la période' : 'Failed to update period',
        ...(serverMessage ? { description: serverMessage } : {}),
      });
    },
  });

  /**
   * Override `identification.effectiveDate` on a single staged item
   * (Task #1031). Sends `null` when the admin clears the field so the
   * commit loop falls back to the parsed periodHint date again.
   * On success we drop the row's pending edit so the input snaps back
   * to whatever the server now reports.
   */
  const setEffectiveDate = useMutation({
    mutationFn: async ({
      itemId,
      effectiveDate,
    }: {
      itemId: string;
      effectiveDate: string | null;
    }) => {
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/items/${itemId}/set-effective-date`,
        { effectiveDate },
      );
      return res.json();
    },
    onSuccess: (_data, variables) => {
      setEditingEffectiveDate((prev) => {
        const next = new Map(prev);
        next.delete(variables.itemId);
        return next;
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
    },
    onError: (error) => {
      let serverMessage: string | undefined;
      if (error instanceof ApiError && error.body && typeof error.body === 'object') {
        const body = error.body as Record<string, unknown>;
        serverMessage = typeof body.error === 'string' ? body.error
          : typeof body.message === 'string' ? body.message
          : undefined;
      }
      toast({
        variant: 'destructive',
        title: isFr ? 'Échec de la mise à jour de la date' : 'Failed to update date',
        ...(serverMessage ? { description: serverMessage } : {}),
      });
    },
  });

  /**
   * Persist an admin-edited tag list on a single staged item (Task #1103).
   * Called immediately on every TagPicker change; the per-item
   * `editingTags` map keeps the picker controlled during the in-flight
   * request so the UI stays responsive.
   */
  const setItemTags = useMutation({
    mutationFn: async ({
      itemId,
      tagIds,
    }: {
      itemId: string;
      tagIds: string[];
    }) => {
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/items/${itemId}/set-tags`,
        { tagIds },
      );
      return res.json();
    },
    onMutate: ({ itemId }) => {
      setTagSaveStatus((prev) => {
        const next = new Map(prev);
        next.set(itemId, 'saving');
        return next;
      });
    },
    onSuccess: (_data, variables) => {
      setTagSaveStatus((prev) => {
        const next = new Map(prev);
        next.set(variables.itemId, 'saved');
        return next;
      });
      setTimeout(() => {
        setTagSaveStatus((prev) => {
          const next = new Map(prev);
          next.set(variables.itemId, 'idle');
          return next;
        });
      }, 1500);
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
    },
    onError: (_error, variables) => {
      setTagSaveStatus((prev) => {
        const next = new Map(prev);
        next.set(variables.itemId, 'error');
        return next;
      });
      toast({
        variant: 'destructive',
        title: isFr ? 'Échec de la mise à jour des étiquettes' : 'Failed to update tags',
      });
    },
  });

  /**
   * Auto-apply AI suggestions for effective date and tags (Task #1149).
   *
   * Runs whenever `items` or `currentStep` changes. For each item visible in
   * the Identification step the effect fires the existing mutations on the
   * admin's behalf — once per suggestion source per item per browser session.
   *
   * Guard rails:
   * - `autoAppliedDateRef` / `autoAppliedTagsRef` ensure each auto-apply
   *   fires at most once per item, preventing duplicate mutations across
   *   re-renders or polling refreshes.
   * - `prevEffectiveDateRef` detects a non-null → null transition (i.e. the
   *   admin used "Reprendre l'étape à zéro"), which removes the item from the
   *   date ref so the fresh AI suggestion is re-applied automatically.
   * - `prevStoredTagsKeyRef` does the same for tags: when the stored tag list
   *   transitions from non-empty to empty the item is removed from the tags
   *   ref so a fresh suggestion is re-applied.
   * - Manual overrides (`identificationEffectiveDateManualOverride`) are
   *   respected: the date auto-apply never fires when the admin has typed a
   *   custom date.
   */
  useEffect(() => {
    if (currentStep !== 'identification') return;

    for (const item of items) {
      // ── Effective-date auto-apply ────────────────────────────────────────
      // Detect "Reprendre à zéro" (non-null → null transition on
      // identificationEffectiveDate) and clear the date tracking entry so the
      // fresh suggestion can re-apply even when the hint value is unchanged.
      const prevDate = prevEffectiveDateRef.current.get(item.id) ?? null;
      if (prevDate !== null && item.identificationEffectiveDate === null) {
        autoAppliedDateRef.current.delete(item.id);
      }
      prevEffectiveDateRef.current.set(item.id, item.identificationEffectiveDate);

      if (
        item.screeningParsedPeriodHintDate !== null &&
        item.identificationEffectiveDate === null &&
        !item.identificationEffectiveDateManualOverride &&
        autoAppliedDateRef.current.get(item.id) !== item.screeningParsedPeriodHintDate
      ) {
        autoAppliedDateRef.current.set(item.id, item.screeningParsedPeriodHintDate);
        setEffectiveDate.mutate({
          itemId: item.id,
          effectiveDate: item.screeningParsedPeriodHintDate,
        });
      }

      // ── Tags auto-apply ──────────────────────────────────────────────────
      // Detect step reset: "Reprendre à zéro" sets identification=null on the
      // DB row, so identificationTags becomes null. Admin-explicit tag clears
      // call set-tags with tagIds=[], which stores identification.tags=[] —
      // an empty array, NOT null — so the null-transition guard is not
      // triggered for admin-originated clears.
      const tagsCurrentlyNonNull = item.identificationTags !== null;
      const tagsPrevWasNonNull = prevIdentificationTagsNonNullRef.current.get(item.id) ?? false;
      if (tagsPrevWasNonNull && !tagsCurrentlyNonNull) {
        // identificationTags transitioned from non-null → null: step was reset.
        // Clear the tag tracking entry so the fresh AI suggestion can re-apply
        // even when the signature is identical to the previously applied one.
        autoAppliedTagsRef.current.delete(item.id);
      }
      prevIdentificationTagsNonNullRef.current.set(item.id, tagsCurrentlyNonNull);

      const rawTags = item.identificationTags ?? [];
      const storedTagIds = rawTags.filter((t) => TAG_UUID_RE.test(t));

      // Compute suggested tag IDs — mirrors IdentificationTagRow logic.
      // Initialize to [] so the variable is always defined even when the
      // item field is undefined (e.g., in test fixtures or legacy sessions).
      let suggestedIds: string[] = [];
      if (Array.isArray(item.identificationAiSuggestedTagIds)) {
        suggestedIds = item.identificationAiSuggestedTagIds;
      } else if (item.identificationAiSuggestedTagIds == null) {
        // Legacy path: name-match free-form strings still stored in tags.
        const aiNames = rawTags.filter((t) => !TAG_UUID_RE.test(t));
        if (aiNames.length > 0 && allTagsForAutoApply.length > 0) {
          const nameMap = new Map(
            allTagsForAutoApply.map((t) => [t.name.toLowerCase(), t.id]),
          );
          suggestedIds = aiNames.flatMap((name) => {
            const id = nameMap.get(name.toLowerCase());
            return id ? [id] : [];
          });
        }
      }

      if (suggestedIds.length > 0) {
        // Track by suggestion signature so a fresh AI output (different tag
        // set after a per-item retry) triggers a new auto-apply while the
        // same suggestion never fires more than once per signature.
        const suggestedSig = suggestedIds.slice().sort().join(',');
        if (autoAppliedTagsRef.current.get(item.id) !== suggestedSig) {
          const alreadyApplied = suggestedIds.every((id) => storedTagIds.includes(id));
          if (!alreadyApplied) {
            // Merge with any already-stored UUID tags to avoid clobbering
            // manually-applied tags that differ from the AI suggestion.
            const merged = Array.from(new Set([...storedTagIds, ...suggestedIds]));
            autoAppliedTagsRef.current.set(item.id, suggestedSig);
            setItemTags.mutate({ itemId: item.id, tagIds: merged });
          } else {
            // Suggestions already present — mark this signature done.
            autoAppliedTagsRef.current.set(item.id, suggestedSig);
          }
        }
      }
    }
    // Intentionally omitting `setEffectiveDate` and `setItemTags` from deps:
    // mutation objects are stable across renders and including them would
    // cause an infinite loop since they are recreated on each render cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, currentStep, allTagsForAutoApply]);

  /**
   * Auto-save (draft) mutation — fires every 500 ms via debounce whenever an
   * inline sorting value changes.  Unlike setSortingDecision, this uses
   * `draft: true` so no file-operation is committed until the admin presses
   * Accept / Confirm.  For split decisions the backend materialises the two
   * part items server-side so they appear as Merge candidates.
   */
  const saveDraftDecision = useMutation({
    mutationFn: async ({
      itemId,
      decision,
      mergeWithItemIds,
      splitAtPage,
      finalFileName: ffn,
      splitFinalNames,
    }: {
      itemId: string;
      decision?: 'keep' | 'merge' | 'split';
      mergeWithItemIds?: string[];
      splitAtPage?: number;
      finalFileName?: string;
      splitFinalNames?: [string, string];
    }) => {
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/items/${itemId}/set-sorting-decision`,
        { action: 'manual', draft: true, decision, mergeWithItemIds, splitAtPage, finalFileName: ffn, splitFinalNames },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
    },
  });

  // ---------------------------------------------------------------
  // Auto-save (draft) debounce machinery.  Triggered from inline-
  // field onChange handlers; fires 500 ms after the last change.
  // ---------------------------------------------------------------
  const autoSaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const inlineSlicePageRef = useRef(inlineSlicePage);
  const inlineMergeOrderRef = useRef(inlineMergeOrder);
  const inlineRenameRef = useRef(inlineRename);
  const inlineRenameSplitRef = useRef(inlineRenameSplit);
  useEffect(() => { inlineSlicePageRef.current = inlineSlicePage; }, [inlineSlicePage]);
  useEffect(() => { inlineMergeOrderRef.current = inlineMergeOrder; }, [inlineMergeOrder]);
  useEffect(() => { inlineRenameRef.current = inlineRename; }, [inlineRename]);
  useEffect(() => { inlineRenameSplitRef.current = inlineRenameSplit; }, [inlineRenameSplit]);

  // When items load (or reload after a re-analysis), initialise picker state
  // for any row that is already in the 'rejected' state so the override picker
  // is visible immediately without requiring an extra click.  We never
  // overwrite an entry that the admin has already interacted with (the Map
  // check keeps existing state intact).
  useEffect(() => {
    if (!items.length) return;
    setSortingPickerStates((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const item of items) {
        if (item.sortingDecisionState === 'rejected' && !next.has(item.id)) {
          const d = (item.sortingDecision ?? 'keep') as 'keep' | 'merge' | 'split';
          next.set(item.id, {
            decision: d,
            mergeTargetId: d === 'merge' ? (item.sortingMergeWithItemId ?? '') : '',
            splitPage: d === 'split' ? (item.sortingSplitAtPage ?? 1) : 1,
          });
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items]);

  function scheduleAutoSave(
    item: BulkImportItemLite,
    decisionOverride?: 'keep' | 'merge' | 'split',
    mergeWithItemIdsOverride?: string[],
    splitAtPageOverride?: number,
  ) {
    if (currentStep !== 'sorting') return;
    const existing = autoSaveTimers.current.get(item.id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      autoSaveTimers.current.delete(item.id);
      setAutoSaveStatus((prev) => new Map(prev).set(item.id, 'saving'));
      const effectiveDecision = decisionOverride ?? ((item.sortingDecision ?? 'keep') as 'keep' | 'merge' | 'split');
      const slicePage = splitAtPageOverride ?? inlineSlicePageRef.current.get(item.id);
      const mergeOrder = mergeWithItemIdsOverride
        ? [item.id, ...mergeWithItemIdsOverride]
        : inlineMergeOrderRef.current.get(item.id);
      const rename = inlineRenameRef.current.get(item.id);
      const renameSplit = inlineRenameSplitRef.current.get(item.id);
      saveDraftDecision.mutate(
        {
          itemId: item.id,
          decision: effectiveDecision,
          ...(effectiveDecision === 'split' && {
            splitAtPage: slicePage ?? item.sortingSplitAtPage ?? 1,
            splitFinalNames: renameSplit ?? (item.sortingDecisionSplitFinalNames ?? undefined),
          }),
          ...(effectiveDecision === 'merge' && {
            mergeWithItemIds: mergeOrder ? mergeOrder.slice(1) : (item.sortingMergeWithItemIds ?? undefined),
          }),
          ...(effectiveDecision !== 'split' && {
            finalFileName: rename ?? undefined,
          }),
        },
        {
          onSuccess: () => setAutoSaveStatus((prev) => new Map(prev).set(item.id, 'saved')),
          onError: () => setAutoSaveStatus((prev) => new Map(prev).set(item.id, 'error')),
        },
      );
    }, 500);
    autoSaveTimers.current.set(item.id, timer);
  }

  function cancelAutoSave(itemId: string) {
    const existing = autoSaveTimers.current.get(itemId);
    if (existing) {
      clearTimeout(existing);
      autoSaveTimers.current.delete(itemId);
    }
  }

  const clearAll = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/admin/bulk-import/sessions/${sessionId}`, {});
    },
    onSuccess: () => {
      localStorage.removeItem(STORAGE_KEY);
      setSessionId(null);
      setShowConfirm(false);
      setConfirmText('');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bulk-import/sessions'] });
      toast({ title: isFr ? 'Session effacée' : 'Session cleared' });
    },
  });

  const stepIndex = useMemo(() => STEP_ORDER.indexOf(currentStep), [currentStep]);

  const helpIntro = isFr
    ? "Importez en lot des dossiers de documents (PDF, Word, Excel, images) pour un immeuble. L'assistant vous guide à travers 7 étapes. Vous pouvez fermer la page à tout moment et reprendre — la session est sauvegardée."
    : 'Bulk-import folders of mixed documents (PDF, Word, Excel, images) for one building. The wizard walks you through 7 steps. You can close the page at any time and resume — the session is saved.';

  const stepDescriptions: Record<BulkImportStep, string> = isFr
    ? {
        upload:
          "Choisissez l'immeuble et déposez les documents (PDF, Word, Excel, images) à traiter.",
        screening:
          "L'IA lit chaque fichier et décide s'il s'agit d'un vrai document à conserver ou à écarter.",
        // Descriptions are keyed by internal step key, so they swap in
        // lockstep with the labels above to remain coherent: step
        // `sorting` (keep/merge/split) gets the "Aiguillage" copy, and
        // step `branching` (destination bucket) gets the "Tri" copy.
        sorting:
          'Les fichiers contenant plusieurs documents sont scindés au besoin en documents distincts.',
        branching:
          'Chaque document conservé est automatiquement classé dans une catégorie (facture, contrat, procès-verbal, etc.).',
        identification:
          "L'IA extrait les informations clés (titre, date, montants, parties) de chaque document.",
        linking:
          'Chaque document est associé à la fiche correspondante dans le système (fournisseur, contrat, résidence, etc.).',
        complete:
          "Vérifiez les résultats finaux, corrigez ce qui doit l'être, puis enregistrez les documents dans l'immeuble.",
      }
    : {
        upload:
          'Choose the building and drop in the documents (PDF, Word, Excel, images) you want to process.',
        screening:
          'The AI reads each file and decides whether it looks like a real document worth keeping or should be discarded.',
        // Descriptions are keyed by internal step key, so they swap in
        // lockstep with the labels above to remain coherent: step
        // `sorting` (keep/merge/split) gets the "Branching" copy, and
        // step `branching` (destination bucket) gets the "Sorting" copy.
        sorting:
          'Files that contain several documents are split into the right number of separate documents when needed.',
        branching:
          'Each kept document is automatically classified into a category (e.g. invoice, contract, minutes).',
        identification:
          'The AI extracts the key fields (title, date, amounts, parties) from each document.',
        linking:
          'Each document is matched to the related record in the system (vendor, contract, residence, etc.).',
        complete:
          'Review the final results, fix anything that needs adjusting, and commit the documents to the building.',
      };

  const stepRetryAction: Record<AutoStep, 'screen' | 'sort' | 'branch' | 'identify' | 'link'> = {
    screening: 'screen',
    sorting: 'sort',
    branching: 'branch',
    identification: 'identify',
    linking: 'link',
  };


  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      <Header
        title={isFr ? 'Importation Documentaire en Lot' : 'Bulk Document Import'}
        subtitle={
          isFr
            ? 'Importez des dossiers de documents avec assistance IA.'
            : 'Bulk-ingest folders of documents with AI assistance.'
        }
      />

      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* AI unavailability banner (Task #710). Surfaced once at the
              top of the page so admins immediately understand that
              every confidence score on this page is a deterministic
              filename-only stub when Anthropic is not configured.
              Dismissible per page visit because admins debugging a
              broken deploy may want to keep working with stub data
              and don't need to be reminded on every interaction. */}
          {!aiAvailable && !aiBannerDismissed && (
            <Alert
              variant="destructive"
              data-testid="alert-ai-unavailable"
              className="border-amber-300 bg-amber-50 text-amber-900 [&>svg]:text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 dark:[&>svg]:text-amber-100"
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {isFr ? 'IA indisponible' : 'AI unavailable'}
              </AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  {isFr
                    ? "L'analyseur IA n'est pas configuré sur ce déploiement. Tous les documents recevront un score de confiance générique de 20 % basé uniquement sur le nom du fichier — aucune analyse réelle n'est effectuée."
                    : 'The AI analyzer is not configured on this deployment. Every document will receive a generic 20% confidence score based on its filename only — no real analysis is performed.'}
                </p>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAiBannerDismissed(true)}
                    data-testid="button-dismiss-ai-banner"
                  >
                    {isFr ? 'Compris' : 'Got it'}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Back-to-start button (Task #591) — only shown while a
              session is active so admins can return to the picker +
              history list without deleting the session. */}
          {sessionId && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={goBackToStart}
                data-testid="button-back-to-bulk-import"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {isFr ? "Retour à l'importation en lot" : 'Back to bulk import'}
              </Button>
            </div>
          )}

          {/* Help banner */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                {isFr ? 'À propos de cette page' : 'About this page'}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHelp((v) => !v)}
                data-testid="button-toggle-help"
              >
                {showHelp ? (isFr ? 'Masquer' : 'Hide') : (isFr ? 'Afficher' : 'Show')}
              </Button>
            </CardHeader>
            {showHelp && (
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{helpIntro}</p>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                  {STEP_ORDER.map((s) => (
                    <li key={s} data-testid={`help-step-${s}`}>
                      <span className="font-medium text-foreground">
                        {stepLabels[s]}
                      </span>
                      {' — '}
                      {stepDescriptions[s]}
                    </li>
                  ))}
                </ol>
              </CardContent>
            )}
          </Card>

          {/* Past sessions history (Task #480) */}
          {!sessionId && (
            <HistoryCard
              buildings={buildings}
              expandedId={expandedHistoryId}
              onToggle={(id) =>
                setExpandedHistoryId((curr) => (curr === id ? null : id))
              }
              onResume={(id) => setSessionId(id)}
              isFr={isFr}
              stepLabels={stepLabels}
            />
          )}

          {/* Session selector */}
          {!sessionId && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {isFr ? 'Démarrer une session' : 'Start a session'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label>{isFr ? 'Immeuble' : 'Building'}</Label>
                  {buildings.length === 0 ? (
                    <p className="text-sm text-muted-foreground" data-testid="text-no-buildings">
                      {isFr ? 'Aucun immeuble disponible.' : 'No buildings available.'}
                    </p>
                  ) : (
                    <>
                      {/* Filters (Task #600) */}
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative flex-1">
                          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={buildingSearch}
                            onChange={(e) => setBuildingSearch(e.target.value)}
                            placeholder={
                              isFr
                                ? 'Rechercher par nom, adresse, ville…'
                                : 'Search by name, address, city…'
                            }
                            className="pl-8"
                            data-testid="input-building-search"
                          />
                        </div>
                        {buildingTypes.length > 0 && (
                          <Select
                            value={buildingTypeFilter}
                            onValueChange={setBuildingTypeFilter}
                          >
                            <SelectTrigger
                              className="sm:w-56"
                              data-testid="select-building-type"
                            >
                              <SelectValue
                                placeholder={isFr ? "Type d'immeuble" : 'Building type'}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all" data-testid="option-building-type-all">
                                {isFr ? 'Tous les types' : 'All types'}
                              </SelectItem>
                              {buildingTypes.map((t) => (
                                <SelectItem
                                  key={t}
                                  value={t}
                                  className="capitalize"
                                  data-testid={`option-building-type-${t}`}
                                >
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {groupedBuildings.length === 0 ? (
                        <p
                          className="text-sm text-muted-foreground"
                          data-testid="text-no-buildings-match"
                        >
                          {isFr
                            ? 'Aucun immeuble ne correspond à votre recherche.'
                            : 'No buildings match your search.'}
                        </p>
                      ) : (
                        <div
                          className="space-y-5"
                          data-testid="grid-building-picker"
                        >
                          {groupedBuildings.map((group) => (
                            <div
                              key={group.id}
                              className="space-y-2"
                              data-testid={`group-org-${group.id}`}
                            >
                              <div
                                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                                data-testid={`group-org-header-${group.id}`}
                              >
                                {group.name}
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                {group.items.map((b) => {
                                  const selected = buildingId === b.id;
                                  const location = [b.city, b.province]
                                    .filter(Boolean)
                                    .join(', ');
                                  const isCreating =
                                    createSession.isPending && selected;
                                  return (
                                    <button
                                      key={b.id}
                                      type="button"
                                      disabled={createSession.isPending}
                                      onClick={() => {
                                        setBuildingId(b.id);
                                        createSession.mutate(b.id);
                                      }}
                                      aria-pressed={selected}
                                      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition hover:border-primary hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60 ${
                                        selected
                                          ? 'border-primary bg-primary/5 ring-2 ring-primary'
                                          : 'border-border'
                                      }`}
                                      data-testid={`card-building-${b.id}`}
                                    >
                                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                                        {isCreating ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Building2 className="h-4 w-4" />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate font-medium">{b.name}</div>
                                        {b.address && (
                                          <div className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                                            <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                            <span className="truncate">
                                              {b.address}
                                              {location ? `, ${location}` : ''}
                                            </span>
                                          </div>
                                        )}
                                        <div className="mt-1 flex flex-wrap items-center gap-1">
                                          {typeof b.totalUnits === 'number' && (
                                            <Badge variant="secondary" className="text-[10px]">
                                              {b.totalUnits}{' '}
                                              {isFr ? 'unités' : 'units'}
                                            </Badge>
                                          )}
                                          {b.buildingType && (
                                            <Badge
                                              variant="outline"
                                              className="text-[10px] capitalize"
                                            >
                                              {b.buildingType}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {sessionId && loadingSession && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {sessionId && session && (
            <>
              {/* Stepper */}
              <Card>
                <CardContent className="flex flex-wrap items-center gap-3 pt-6">
                  {STEP_ORDER.map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                      <button
                        onClick={() => updateStep.mutate(s)}
                        className={`rounded-md px-3 py-1 text-sm transition ${
                          i === stepIndex
                            ? 'bg-primary text-primary-foreground'
                            : i < stepIndex
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-muted text-muted-foreground'
                        }`}
                        data-testid={`step-${s}`}
                      >
                        {i + 1}. {stepLabels[s]}
                      </button>
                      {i < STEP_ORDER.length - 1 && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Upload step */}
              {currentStep === 'upload' && (
                <Card>
                  <CardHeader>
                    <CardTitle>{isFr ? 'Téléverser des fichiers' : 'Upload files'}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          uploadFiles.mutate(e.target.files);
                        }
                      }}
                      data-testid="input-file"
                    />
                    <input
                      ref={folderInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      webkitdirectory=""
                      directory=""
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          uploadFiles.mutate(e.target.files);
                        }
                      }}
                      data-testid="input-folder"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadFiles.isPending}
                        data-testid="button-upload"
                      >
                        {uploadFiles.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        {isFr ? 'Choisir des fichiers' : 'Choose files'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => folderInputRef.current?.click()}
                        disabled={uploadFiles.isPending}
                        data-testid="button-upload-folder"
                      >
                        {uploadFiles.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        {isFr ? 'Choisir un dossier' : 'Choose folder'}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {items.length}{' '}
                      {isFr ? 'fichier(s) en attente' : 'file(s) staged'}
                    </p>
                    {items.length > 0 && (
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            role="button"
                            tabIndex={0}
                            data-testid={`item-preview-trigger-${item.id}`}
                            onClick={() => setPreviewItem({ id: item.id, originalName: item.originalName, mimeType: item.mimeType })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setPreviewItem({ id: item.id, originalName: item.originalName, mimeType: item.mimeType });
                              }
                            }}
                          >
                            <ItemThumbnail item={item} />
                            <div className="min-w-0 flex flex-1 flex-col gap-0.5">
                              <span className="truncate font-medium" data-testid={`item-name-${item.id}`}>
                                {item.originalName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {item.status}
                                {item.mimeType ? ` · ${item.mimeType}` : ''}
                              </span>
                              {item.status === 'duplicate' && (() => {
                                const docLabels = isFr ? BRANCH_DESTINATION_LABEL_FR : BRANCH_DESTINATION_LABEL_EN;
                                const locationParts: string[] = [];
                                if (item.duplicateOfBuildingName) locationParts.push(item.duplicateOfBuildingName);
                                if (item.duplicateOfResidenceLabel) locationParts.push(item.duplicateOfResidenceLabel);
                                if (item.duplicateOfDocumentType) {
                                  const label = docLabels[item.duplicateOfDocumentType as BranchDestination] ?? item.duplicateOfDocumentType;
                                  locationParts.push(label);
                                }
                                const locationStr = locationParts.join(' › ');
                                return (
                                  <div
                                    className="flex flex-wrap items-center gap-1.5 mt-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                    data-testid={`duplicate-info-${item.id}`}
                                  >
                                    <Badge
                                      variant="outline"
                                      className="border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-700 dark:bg-teal-950 dark:text-teal-200 text-xs shrink-0"
                                      data-testid={`badge-already-in-koveo-${item.id}`}
                                    >
                                      {isFr ? 'Déjà dans Koveo' : 'Already in Koveo'}
                                    </Badge>
                                    {item.duplicateOfDocumentRemoved ? (
                                      <span className="text-xs text-muted-foreground italic" data-testid={`duplicate-removed-${item.id}`}>
                                        {isFr ? '(document supprimé)' : '(document removed)'}
                                      </span>
                                    ) : item.duplicateOfDocumentId && item.duplicateOfDocumentName ? (
                                      <a
                                        href={
                                          item.duplicateOfBuildingId
                                            ? `/manager/buildings/${item.duplicateOfBuildingId}/documents`
                                            : `/api/documents/${item.duplicateOfDocumentId}/file`
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-teal-700 hover:text-teal-900 hover:underline dark:text-teal-400 dark:hover:text-teal-200 truncate max-w-[240px]"
                                        data-testid={`duplicate-doc-link-${item.id}`}
                                        title={item.duplicateOfDocumentName}
                                      >
                                        <ExternalLink className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{item.duplicateOfDocumentName}</span>
                                      </a>
                                    ) : null}
                                    {locationStr && (
                                      <span
                                        className="text-xs text-muted-foreground truncate"
                                        data-testid={`duplicate-location-${item.id}`}
                                      >
                                        {locationStr}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => updateStep.mutate('screening')}
                      disabled={items.length === 0}
                      data-testid="button-next-screening"
                    >
                      {isFr ? 'Passer au filtrage' : 'Continue to screening'}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Items table for AI steps */}
              {currentStep !== 'upload' && currentStep !== 'complete' && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle>
                      {isFr ? 'Étape :' : 'Step:'} {stepLabels[currentStep]}
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHideReady((v) => !v)}
                      data-testid="toggle-hide-ready"
                    >
                      {hideReady ? (
                        <Eye className="mr-2 h-4 w-4" />
                      ) : (
                        <EyeOff className="mr-2 h-4 w-4" />
                      )}
                      {hideReady
                        ? (isFr ? 'Afficher tous les fichiers' : 'Show all files')
                        : (isFr ? "Masquer les fichiers prêts pour l'étape suivante" : 'Hide files ready for next step')}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {/* Auto-run progress (Task #592) — replaces the
                        per-file action buttons that used to live below.
                        Generalizes the screening-only progress UI from
                        Task #575 to all five AI steps. */}
                    {isAutoStep(currentStep) &&
                      (() => {
                        const progress = readRunAllProgress(session, currentStep);
                        const total = progress?.total ?? 0;
                        const processed = progress?.processed ?? 0;
                        const failed = progress?.failed ?? 0;
                        const inFlight = progress?.inFlight ?? [];
                        const isRunning =
                          (!!progress && !progress.finishedAt) ||
                          runAll.isPending;
                        const noWork = !progress && !runAll.isPending;
                        return (
                          <div
                            className="mb-3 flex flex-col gap-1.5 rounded-md border bg-muted/40 px-3 py-2 text-sm"
                            data-testid={`auto-run-progress-${currentStep}`}
                          >
                            <div className="flex flex-wrap items-center gap-3">
                              {isRunning ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : (
                                <Sparkles className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="font-medium">
                                {noWork
                                  ? isFr
                                    ? 'Démarrage…'
                                    : 'Starting…'
                                  : isFr
                                  ? `${processed} sur ${total} traité(s)…`
                                  : `${processed} of ${total} processed…`}
                              </span>
                              {failed > 0 && (
                                <span
                                  className="text-xs text-amber-700"
                                  data-testid={`auto-run-failed-${currentStep}`}
                                >
                                  {isFr
                                    ? `${failed} échec(s)`
                                    : `${failed} failed`}
                                </span>
                              )}
                              {progress?.finishedAt && (
                                <span
                                  className="text-xs text-emerald-700"
                                  data-testid={`auto-run-done-${currentStep}`}
                                >
                                  {isFr ? 'Terminé' : 'Done'}
                                </span>
                              )}
                              <div className="ml-auto flex items-center gap-3">
                                {isStalled && (
                                  <button
                                    className="text-xs text-amber-700 underline hover:text-amber-900"
                                    data-testid={`auto-run-stall-retry-${currentStep}`}
                                    onClick={() => {
                                      if (isAutoStep(currentStep)) {
                                        runAll.mutate(currentStep);
                                      }
                                    }}
                                  >
                                    {isFr
                                      ? 'Analyse bloquée — réessayer'
                                      : 'Run looks stalled — retry'}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                  data-testid={`auto-run-reset-step-${currentStep}`}
                                  disabled={resetStep.isPending || runAll.isPending}
                                  onClick={() => {
                                    if (isAutoStep(currentStep)) {
                                      setPendingResetStep(currentStep);
                                    }
                                  }}
                                >
                                  <RefreshCw
                                    className={`h-3 w-3 ${resetStep.isPending ? 'animate-spin' : ''}`}
                                  />
                                  {isFr
                                    ? "Reprendre l'étape à zéro"
                                    : 'Retry step from scratch'}
                                </button>
                              </div>
                            </div>
                            {isRunning && inFlight.length > 0 && (
                              <p
                                className="truncate text-xs text-muted-foreground"
                                data-testid={`auto-run-in-flight-${currentStep}`}
                              >
                                {inFlight.length === 1
                                  ? isFr
                                    ? `Analyse : ${inFlight[0].originalName}`
                                    : `Analyzing: ${inFlight[0].originalName}`
                                  : isFr
                                  ? `Analyse de ${inFlight.length} fichiers…`
                                  : `Analyzing ${inFlight.length} files…`}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    {currentStep === 'branching' ? (() => {
                      // Group items by destination branch. Items without a
                      // branch (old sessions or not-yet-routed) go under
                      // "Unsorted" at the top (Task #768).
                      // Excluded (rejected) files are hidden from step 3+
                      // so they are filtered out before grouping (Task #804).
                      const branchingItems = items.filter((item) => item.status !== 'rejected');
                      // Task #1045: when the hide-ready toggle is ON, filter
                      // out items that are already ready for the next step
                      // before grouping so group counts and empty groups stay
                      // consistent with the rendered rows. Bulk-action banners
                      // (Accept all / Review AI suggestions) still read the
                      // unfiltered branchingItems so they remain accurate.
                      const displayedBranchingItems = hideReady
                        ? branchingItems.filter((item) => !isItemReadyForNextStep(item, 'branching'))
                        : branchingItems;
                      const grouped = new Map<string, BulkImportItemLite[]>();
                      for (const item of displayedBranchingItems) {
                        const key = item.branch ?? 'unsorted';
                        if (!grouped.has(key)) grouped.set(key, []);
                        grouped.get(key)!.push(item);
                      }
                      const sections: Array<{ key: string; label: string; items: BulkImportItemLite[] }> = [];
                      if (grouped.has('unsorted')) {
                        sections.push({ key: 'unsorted', label: isFr ? 'Non triés' : 'Unsorted', items: grouped.get('unsorted')! });
                      }
                      for (const dest of BRANCH_DESTINATION_ORDER) {
                        if (grouped.has(dest)) {
                          sections.push({
                            key: dest,
                            label: (isFr ? BRANCH_DESTINATION_LABEL_FR : BRANCH_DESTINATION_LABEL_EN)[dest],
                            items: grouped.get(dest)!,
                          });
                        }
                      }
                      if (sections.length === 0) {
                        return (
                          <p className="text-sm text-muted-foreground" data-testid="empty-state-branching">
                            {hideReady && displayedBranchingItems.length === 0 && branchingItems.length > 0
                              ? (isFr ? 'Tous les fichiers sont prêts pour l\'étape suivante.' : 'All files are ready for the next step.')
                              : (isFr ? 'Aucun fichier' : 'No items')}
                          </p>
                        );
                      }
                      const destLabelsHeader = isFr ? BRANCH_DESTINATION_LABEL_FR : BRANCH_DESTINATION_LABEL_EN;
                      const subCatLabelsHeader = isFr ? SUB_CATEGORY_LABEL_FR : SUB_CATEGORY_LABEL_EN;
                      // Count residence_documents rows whose current
                      // pick is still the AI's guess and hasn't been
                      // confirmed yet (Task #803). When >0, the step
                      // shows a one-click "Review all AI suggestions"
                      // button so the admin can dismiss every chip at
                      // once after a quick visual scan.
                      const pendingAiResidences = branchingItems.filter(
                        (it) => it.residenceAiSuggested,
                      ).length;
                      // Compute items eligible for the "Accept all" bulk action
                      // (Task #900): pending sorting decision, not a terminal
                      // status (committed/duplicate), and no unsaved inline
                      // split/merge edits in progress. Mirrors the server-side
                      // eligibility guard in accept-all-pending-sorting.
                      const pendingInlineEditItems = branchingItems.filter(
                        (it) =>
                          it.sortingDecisionState === 'pending' &&
                          it.status !== 'committed' &&
                          it.status !== 'duplicate' &&
                          (inlineSlicePage.has(it.id) || inlineMergeOrder.has(it.id)),
                      );
                      const pendingInlineEditIds = pendingInlineEditItems.map((it) => it.id);
                      const pendingInlineEditCount = pendingInlineEditItems.length;
                      const pendingEligibleSortingCount = branchingItems.filter(
                        (it) =>
                          it.sortingDecisionState === 'pending' &&
                          it.status !== 'committed' &&
                          it.status !== 'duplicate' &&
                          !inlineSlicePage.has(it.id) &&
                          !inlineMergeOrder.has(it.id),
                      ).length;
                      return (
                        <div className="space-y-4" data-testid="branching-grouped-sections">
                          {pendingEligibleSortingCount > 0 && (
                            <div
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 dark:border-green-800 dark:bg-green-950"
                              data-testid="accept-all-pending-sorting-summary"
                            >
                              <div className="flex items-center gap-2 text-sm text-green-900 dark:text-green-100">
                                <Check className="h-4 w-4" />
                                <span data-testid="accept-all-pending-sorting-count">
                                  {isFr
                                    ? `${pendingEligibleSortingCount} décision${pendingEligibleSortingCount === 1 ? '' : 's'} de tri en attente d'acceptation`
                                    : `${pendingEligibleSortingCount} pending sorting decision${pendingEligibleSortingCount === 1 ? '' : 's'} awaiting acceptance`}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-300"
                                onClick={() =>
                                  acceptAllPendingSorting.mutate({
                                    skipItemIds: pendingInlineEditIds,
                                    skippedCount: pendingInlineEditCount,
                                  })
                                }
                                disabled={acceptAllPendingSorting.isPending || setSortingDecision.isPending}
                                data-testid="button-accept-all-pending-sorting"
                              >
                                {acceptAllPendingSorting.isPending ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="mr-2 h-4 w-4" />
                                )}
                                {isFr
                                  ? `Tout accepter (${pendingEligibleSortingCount})`
                                  : `Accept all (${pendingEligibleSortingCount})`}
                              </Button>
                            </div>
                          )}
                          {pendingAiResidences > 0 && (
                            <div
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 dark:border-violet-800 dark:bg-violet-950"
                              data-testid="ai-residence-suggestions-summary"
                            >
                              <div className="flex items-center gap-2 text-sm text-violet-900 dark:text-violet-100">
                                <Sparkles className="h-4 w-4" />
                                <span data-testid="ai-residence-suggestions-count">
                                  {isFr
                                    ? `L'IA a suggéré ${pendingAiResidences} résidence${pendingAiResidences === 1 ? '' : 's'} en attente de confirmation`
                                    : `AI suggested ${pendingAiResidences} residence${pendingAiResidences === 1 ? '' : 's'} awaiting confirmation`}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() => confirmAllAiResidences.mutate()}
                                disabled={confirmAllAiResidences.isPending}
                                data-testid="button-confirm-all-ai-residences"
                              >
                                {confirmAllAiResidences.isPending ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Sparkles className="mr-2 h-4 w-4" />
                                )}
                                {isFr ? 'Confirmer toutes les suggestions IA' : 'Review all AI suggestions'}
                              </Button>
                            </div>
                          )}
                          {sections.map((section) => {
                            // The "Reassign all in group" action only
                            // makes sense on real branch groups, not on
                            // the synthetic "Unsorted" pile (those have
                            // no current destination to pre-fill).
                            const groupBranch =
                              section.key !== 'unsorted'
                                ? (section.key as BranchDestination)
                                : null;
                            const eligibleIds = section.items
                              .filter((it) => it.status !== 'rejected' && it.status !== 'committed' && it.status !== 'duplicate')
                              .map((it) => it.id);
                            const isGroupPickerOpen = groupReassignKey === section.key;
                            const groupAllowedSubCats = BRANCH_SUB_CATEGORIES[groupReassignBranch];
                            return (
                            <div key={section.key} data-testid={`branching-section-${section.key}`}>
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">
                                  {section.label}
                                </span>
                                <Badge variant="secondary" className="text-xs" data-testid={`branching-section-count-${section.key}`}>
                                  {section.items.length}
                                </Badge>
                                {groupBranch && eligibleIds.length > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="ml-auto h-7 px-2 text-xs"
                                    onClick={() => {
                                      if (isGroupPickerOpen) {
                                        setGroupReassignKey(null);
                                      } else {
                                        // Opening the group picker
                                        // closes any per-file picker so
                                        // the wizard never shows two
                                        // competing pickers at once.
                                        setReassignPickerItemId(null);
                                        setGroupReassignKey(section.key);
                                        setGroupReassignBranch(groupBranch);
                                        // Pre-fill with the most common
                                        // sub-category in the group so
                                        // "Save" without changes is a
                                        // no-op-friendly default. Falls
                                        // back to 'other' if no sub-cat
                                        // is set on any file.
                                        const counts = new Map<string, number>();
                                        for (const it of section.items) {
                                          const sc = it.subCategory ?? null;
                                          if (sc) counts.set(sc, (counts.get(sc) ?? 0) + 1);
                                        }
                                        let topSc = 'other';
                                        let topN = 0;
                                        for (const [sc, n] of counts) {
                                          if (n > topN) {
                                            topN = n;
                                            topSc = sc;
                                          }
                                        }
                                        const allowed = BRANCH_SUB_CATEGORIES[groupBranch];
                                        setGroupReassignSubCategory(allowed.includes(topSc) ? topSc : 'other');
                                        // If every eligible item in the group already
                                        // shares the same residence, pre-fill the picker
                                        // with it so "Save" is a no-op-friendly default.
                                        // Otherwise leave it blank — the admin must opt
                                        // in to overriding mixed selections (Task #1084).
                                        if (groupBranch === 'residence_documents') {
                                          const residences = new Set<string>();
                                          for (const it of section.items) {
                                            if (it.status === 'rejected' || it.status === 'committed' || it.status === 'duplicate') continue;
                                            if (it.residenceId) residences.add(it.residenceId);
                                          }
                                          setGroupReassignResidenceId(
                                            residences.size === 1 ? residences.values().next().value as string : '',
                                          );
                                        } else {
                                          setGroupReassignResidenceId('');
                                        }
                                      }
                                    }}
                                    aria-expanded={isGroupPickerOpen}
                                    aria-controls={`group-reassign-picker-${section.key}`}
                                    data-testid={`button-reassign-group-${section.key}`}
                                  >
                                    {isFr ? 'Tout réaffecter dans ce groupe' : 'Reassign all in group'}
                                  </Button>
                                )}
                              </div>
                              {isGroupPickerOpen && groupBranch && (
                                <div
                                  id={`group-reassign-picker-${section.key}`}
                                  className="mb-2 rounded-md border bg-muted/30 px-3 py-3 flex flex-wrap items-end gap-3"
                                  data-testid={`group-reassign-picker-${section.key}`}
                                >
                                  <div className="flex flex-col gap-1">
                                    <Label className="text-xs">{isFr ? 'Destination' : 'Destination'}</Label>
                                    <Select
                                      value={groupReassignBranch}
                                      onValueChange={(v) => {
                                        const dest = v as BranchDestination;
                                        setGroupReassignBranch(dest);
                                        const allowed = BRANCH_SUB_CATEGORIES[dest];
                                        setGroupReassignSubCategory(
                                          allowed.includes(groupReassignSubCategory) ? groupReassignSubCategory : 'other',
                                        );
                                        // The residence picker only matters for the
                                        // residence_documents branch; clear any pick
                                        // when the admin switches away so we never
                                        // POST a stale residenceId (Task #1084).
                                        if (dest !== 'residence_documents') {
                                          setGroupReassignResidenceId('');
                                        }
                                      }}
                                    >
                                      <SelectTrigger
                                        className="h-8 w-[200px] text-xs"
                                        data-testid={`group-reassign-branch-select-${section.key}`}
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {BRANCH_DESTINATION_ORDER.map((d) => (
                                          <SelectItem key={d} value={d} className="text-xs">
                                            {destLabelsHeader[d]}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <Label className="text-xs">{isFr ? 'Sous-catégorie' : 'Sub-category'}</Label>
                                    <Select
                                      value={groupReassignSubCategory}
                                      onValueChange={setGroupReassignSubCategory}
                                    >
                                      <SelectTrigger
                                        className="h-8 w-[200px] text-xs"
                                        data-testid={`group-reassign-subcategory-select-${section.key}`}
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {groupAllowedSubCats.map((sc) => (
                                          <SelectItem key={sc} value={sc} className="text-xs">
                                            {subCatLabelsHeader[sc] ?? sc}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {groupReassignBranch === 'residence_documents' && (
                                    <div className="flex flex-col gap-1">
                                      <Label className="text-xs">
                                        {isFr ? 'Résidence' : 'Residence'}
                                      </Label>
                                      <Select
                                        value={groupReassignResidenceId}
                                        onValueChange={setGroupReassignResidenceId}
                                      >
                                        <SelectTrigger
                                          className="h-8 w-[220px] text-xs"
                                          data-testid={`group-reassign-residence-select-${section.key}`}
                                        >
                                          <SelectValue
                                            placeholder={
                                              isFr
                                                ? 'Conserver les résidences actuelles…'
                                                : 'Keep current residences…'
                                            }
                                          />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {buildingResidences.length === 0 ? (
                                            <SelectItem value="__none__" disabled className="text-xs text-muted-foreground">
                                              {isFr ? 'Aucune résidence' : 'No residences'}
                                            </SelectItem>
                                          ) : (
                                            buildingResidences.map((r) => (
                                              <SelectItem key={r.id} value={r.id} className="text-xs">
                                                {r.unitNumber}
                                              </SelectItem>
                                            ))
                                          )}
                                        </SelectContent>
                                      </Select>
                                      <span
                                        className="text-[11px] text-muted-foreground"
                                        data-testid={`group-reassign-residence-hint-${section.key}`}
                                      >
                                        {isFr
                                          ? 'Optionnel — appliqué à tous les fichiers du groupe.'
                                          : 'Optional — applied to every file in the group.'}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      className="h-8 text-xs"
                                      onClick={() =>
                                        reassignGroup.mutate({
                                          itemIds: eligibleIds,
                                          branch: groupReassignBranch,
                                          subCategory: groupReassignSubCategory,
                                          residenceId: groupReassignResidenceId || null,
                                        })
                                      }
                                      disabled={reassignGroup.isPending || eligibleIds.length === 0}
                                      data-testid={`button-reassign-group-save-${section.key}`}
                                    >
                                      {reassignGroup.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        isFr
                                          ? `Appliquer (${eligibleIds.length})`
                                          : `Apply to ${eligibleIds.length}`
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 text-xs"
                                      onClick={() => setGroupReassignKey(null)}
                                      data-testid={`button-reassign-group-cancel-${section.key}`}
                                    >
                                      {isFr ? 'Annuler' : 'Cancel'}
                                    </Button>
                                  </div>
                                </div>
                              )}
                              <div className="space-y-2">
                                {section.items.map((item) => {
                                  const decision = getItemStepDecision(item, currentStep);
                                  const isAuto = isAutoStep(currentStep);
                                  const retryAction = isAuto ? stepRetryAction[currentStep as AutoStep] : null;
                                  const branchProgress = isAuto ? readRunAllProgress(session, currentStep as AutoStep) : null;
                                  const stillEligible = isAuto && item.status === STEP_PRE_STATUS[currentStep as AutoStep];
                                  const isExcluded = item.status === 'rejected';
                                  const showRetry = !isExcluded && !!retryAction && ((!!decision?.fallbackReason) || (stillEligible && !!branchProgress?.finishedAt));
                                  // Task #1047: the per-item retry endpoint is now
                                  // fire-and-forget on the server, so `runStep.isPending`
                                  // drops within milliseconds. The polled session payload
                                  // surfaces an entry in `runAll[step].inFlight` while the
                                  // background AI call is running — check that here so the
                                  // row keeps spinning until the new result lands.
                                  const polledRetryInFlight =
                                    isAuto &&
                                    !!branchProgress?.inFlight?.some((e) => e.itemId === item.id);
                                  const retryPending =
                                    (runStep.isPending && runStep.variables?.itemId === item.id) ||
                                    polledRetryInFlight;
                                  const canToggleExclude = item.status !== 'committed' && item.status !== 'duplicate';
                                  const togglePending = toggleExclude.isPending && toggleExclude.variables?.itemId === item.id;
                                  const isPickerOpen = reassignPickerItemId === item.id;
                                  const isResidencePickerOpen = residencePickerItemId === item.id;
                                  const subCatLabels = isFr ? SUB_CATEGORY_LABEL_FR : SUB_CATEGORY_LABEL_EN;
                                  const destLabels = isFr ? BRANCH_DESTINATION_LABEL_FR : BRANCH_DESTINATION_LABEL_EN;
                                  const needsResidence = item.branch === 'residence_documents' && !item.residenceId && !isExcluded;
                                  return (
                                    <div key={item.id} className="rounded-md border">
                                      <div
                                        className={`flex flex-wrap items-center gap-3 p-3 transition ${isExcluded ? 'bg-muted/40 opacity-60' : ''}`}
                                        data-testid={`item-row-${item.id}`}
                                        data-excluded={isExcluded ? 'true' : 'false'}
                                      >
                                        <div
                                          className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer rounded hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                          role="button"
                                          tabIndex={0}
                                          data-testid={`item-preview-trigger-${item.id}`}
                                          onClick={() => setPreviewItem({ id: item.id, originalName: item.originalName, mimeType: item.mimeType })}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              setPreviewItem({ id: item.id, originalName: item.originalName, mimeType: item.mimeType });
                                            }
                                          }}
                                        >
                                          <ItemThumbnail item={item} />
                                          <div className="min-w-0 flex flex-col">
                                            <span
                                              className={`truncate font-medium ${isExcluded ? 'text-muted-foreground line-through' : ''}`}
                                              data-testid={`item-name-${item.id}`}
                                            >
                                              {item.originalName}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                              {item.status}
                                              {item.mimeType ? ` · ${item.mimeType}` : ''}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs h-7 px-2"
                                            onClick={() => {
                                              if (isPickerOpen) {
                                                setReassignPickerItemId(null);
                                              } else {
                                                setGroupReassignKey(null);
                                                setReassignPickerItemId(item.id);
                                                setReassignBranch((item.branch as BranchDestination) ?? 'building_documents');
                                                setReassignSubCategory(item.subCategory ?? 'other');
                                                setReassignResidenceId(
                                                  item.residenceId
                                                    ?? item.residenceAiSuggestedId
                                                    ?? '',
                                                );
                                              }
                                            }}
                                            data-testid={`button-reassign-${item.id}`}
                                          >
                                            {isFr ? 'Réaffecter' : 'Reassign'}
                                          </Button>
                                          {showRetry && retryAction && !item.branchManualOverride && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => runStep.mutate({ itemId: item.id, action: retryAction })}
                                              disabled={retryPending}
                                              data-testid={`button-retry-${currentStep}-${item.id}`}
                                            >
                                              {retryPending ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                              ) : (
                                                <RotateCw className="mr-2 h-4 w-4" />
                                              )}
                                              {isFr ? 'Réessayer' : 'Retry'}
                                            </Button>
                                          )}
                                          {canToggleExclude && (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => toggleExclude.mutate({ itemId: item.id, excluded: !isExcluded })}
                                              disabled={togglePending}
                                              aria-pressed={isExcluded}
                                              aria-label={isExcluded ? (isFr ? 'Réinclure le fichier' : 'Re-include file') : (isFr ? 'Exclure le fichier' : 'Exclude file')}
                                              title={isExcluded ? (isFr ? 'Réinclure' : 'Re-include') : (isFr ? 'Exclure' : 'Exclude')}
                                              data-testid={`button-toggle-exclude-${item.id}`}
                                            >
                                              {togglePending ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                              ) : isExcluded ? (
                                                <Eye className="h-4 w-4" />
                                              ) : (
                                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                                              )}
                                            </Button>
                                          )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5 w-full pl-10" onClick={(e) => e.stopPropagation()}>
                                          {isExcluded && (
                                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900" data-testid={`badge-excluded-${item.id}`}>
                                              {item.excludeSource === 'prior_session'
                                                ? (isFr ? 'Exclu précédemment' : 'Previously excluded')
                                                : (isFr ? 'Exclu' : 'Excluded')}
                                            </Badge>
                                          )}
                                          {!isExcluded && item.subCategory && (
                                            <Badge
                                              variant="outline"
                                              className="shrink-0 border-purple-300 bg-purple-50 text-purple-900 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-200"
                                              title={item.branchReason ?? undefined}
                                              data-testid={`badge-subcategory-${item.id}`}
                                            >
                                              {subCatLabels[item.subCategory] ?? item.subCategory}
                                            </Badge>
                                          )}
                                          {!isExcluded && item.branchManualOverride && (
                                            <Badge
                                              variant="outline"
                                              className="shrink-0 border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200 text-xs"
                                              data-testid={`badge-manual-override-${item.id}`}
                                            >
                                              {isFr ? 'Manuel' : 'Manual'}
                                            </Badge>
                                          )}
                                          {!isExcluded && item.branch === 'residence_documents' && (
                                            item.residenceId ? (
                                              <>
                                                <Badge
                                                  variant="outline"
                                                  className="shrink-0 border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200 text-xs cursor-pointer"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setResidencePickerItemId(isResidencePickerOpen ? null : item.id);
                                                    setResidencePickerValue(item.residenceId ?? '');
                                                  }}
                                                  data-testid={`badge-residence-${item.id}`}
                                                  title={item.residenceReason ?? undefined}
                                                >
                                                  <MapPin className="mr-1 h-3 w-3" />
                                                  {residencesById.get(item.residenceId) ?? item.residenceId.slice(0, 8)}
                                                  {item.residenceManualOverride && ` (${isFr ? 'manuel' : 'manual'})`}
                                                </Badge>
                                                {item.residenceAiSuggested && (
                                                  <Badge
                                                    variant="outline"
                                                    className="shrink-0 border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200 text-xs"
                                                    title={
                                                      item.residenceReason
                                                      ?? (isFr
                                                        ? 'Choisi par l\'IA — vérifiez puis confirmez'
                                                        : 'Picked by AI — review and confirm')
                                                    }
                                                    data-testid={`badge-residence-ai-${item.id}`}
                                                  >
                                                    <Sparkles className="mr-1 h-3 w-3" />
                                                    {isFr ? 'Suggestion IA' : 'AI'}
                                                  </Badge>
                                                )}
                                              </>
                                            ) : (
                                              <Badge
                                                variant="outline"
                                                className="shrink-0 border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200 text-xs cursor-pointer"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setResidencePickerItemId(isResidencePickerOpen ? null : item.id);
                                                  // If the AI suggested a residence but
                                                  // it was rejected (e.g. invalid id), the
                                                  // current pick is null but we still
                                                  // pre-seed the picker with the AI's
                                                  // suggestion so the admin can confirm or
                                                  // override (Task #803).
                                                  setResidencePickerValue(item.residenceAiSuggestedId ?? '');
                                                }}
                                                data-testid={`badge-residence-needed-${item.id}`}
                                              >
                                                <MapPin className="mr-1 h-3 w-3" />
                                                {isFr ? 'Résidence requise' : 'Residence required'}
                                              </Badge>
                                            )
                                          )}
                                          {!isExcluded && !item.branchManualOverride && (
                                            <>
                                              <FallbackReasonBadge reason={decision?.fallbackReason} isFr={isFr} />
                                              <ConfidenceBadge value={decision?.confidence} fallbackReason={decision?.fallbackReason} isFr={isFr} />
                                              {decision?.fallbackReason && (
                                                <span
                                                  className="text-xs text-muted-foreground italic"
                                                  data-testid={`hint-review-or-exclude-${item.id}`}
                                                >
                                                  {isFr ? 'Vérifiez ce fichier ou excluez-le' : 'Review or exclude this file'}
                                                </span>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      {isPickerOpen && (
                                        <div
                                          className="border-t bg-muted/30 px-3 py-3 flex flex-wrap items-end gap-3"
                                          data-testid={`reassign-picker-${item.id}`}
                                        >
                                          <div className="flex flex-col gap-1">
                                            <Label className="text-xs">{isFr ? 'Destination' : 'Destination'}</Label>
                                            <Select
                                              value={reassignBranch}
                                              onValueChange={(v) => {
                                                const dest = v as BranchDestination;
                                                setReassignBranch(dest);
                                                const allowed = BRANCH_SUB_CATEGORIES[dest];
                                                setReassignSubCategory(allowed.includes(reassignSubCategory) ? reassignSubCategory : 'other');
                                                if (dest !== 'residence_documents') {
                                                  setReassignResidenceId('');
                                                } else {
                                                  setReassignResidenceId(
                                                    item.residenceId
                                                      ?? item.residenceAiSuggestedId
                                                      ?? '',
                                                  );
                                                }
                                              }}
                                            >
                                              <SelectTrigger className="h-8 w-[200px] text-xs" data-testid={`reassign-branch-select-${item.id}`}>
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {BRANCH_DESTINATION_ORDER.map((d) => (
                                                  <SelectItem key={d} value={d} className="text-xs">
                                                    {destLabels[d]}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div className="flex flex-col gap-1">
                                            <Label className="text-xs">{isFr ? 'Sous-catégorie' : 'Sub-category'}</Label>
                                            <Select
                                              value={reassignSubCategory}
                                              onValueChange={setReassignSubCategory}
                                            >
                                              <SelectTrigger className="h-8 w-[200px] text-xs" data-testid={`reassign-subcategory-select-${item.id}`}>
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {BRANCH_SUB_CATEGORIES[reassignBranch].map((sc) => (
                                                  <SelectItem key={sc} value={sc} className="text-xs">
                                                    {subCatLabels[sc] ?? sc}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          {reassignBranch === 'residence_documents' && (
                                            <div className="flex flex-col gap-1">
                                              <Label className="text-xs">
                                                {isFr ? 'Résidence' : 'Residence'}
                                              </Label>
                                              {item.residenceAiSuggestedId
                                                && reassignResidenceId === item.residenceAiSuggestedId
                                                && !item.residenceAiConfirmed && (
                                                <span
                                                  className="flex items-center gap-1 text-[11px] text-violet-700 dark:text-violet-300"
                                                  data-testid={`reassign-residence-ai-hint-${item.id}`}
                                                >
                                                  <Sparkles className="h-3 w-3" />
                                                  {isFr
                                                    ? `Suggestion de l'IA : ${residencesById.get(item.residenceAiSuggestedId) ?? item.residenceAiSuggestedId.slice(0, 8)}`
                                                    : `AI suggestion: ${residencesById.get(item.residenceAiSuggestedId) ?? item.residenceAiSuggestedId.slice(0, 8)}`}
                                                </span>
                                              )}
                                              <Select
                                                value={reassignResidenceId}
                                                onValueChange={setReassignResidenceId}
                                              >
                                                <SelectTrigger
                                                  className="h-8 w-[220px] text-xs"
                                                  data-testid={`reassign-residence-select-${item.id}`}
                                                >
                                                  <SelectValue placeholder={isFr ? 'Choisir une résidence…' : 'Choose a residence…'} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {buildingResidences.length === 0 ? (
                                                    <SelectItem value="__none__" disabled className="text-xs text-muted-foreground">
                                                      {isFr ? 'Aucune résidence' : 'No residences'}
                                                    </SelectItem>
                                                  ) : (
                                                    buildingResidences.map((r) => (
                                                      <SelectItem key={r.id} value={r.id} className="text-xs">
                                                        {r.unitNumber}
                                                      </SelectItem>
                                                    ))
                                                  )}
                                                </SelectContent>
                                              </Select>
                                              {!reassignResidenceId && (
                                                <span
                                                  className="text-[11px] text-amber-700 dark:text-amber-400"
                                                  data-testid={`reassign-residence-required-hint-${item.id}`}
                                                >
                                                  {isFr
                                                    ? 'La résidence est requise pour finaliser ce fichier.'
                                                    : 'A residence is required to finalize this file.'}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                          <div className="flex gap-2">
                                            <Button
                                              size="sm"
                                              className="h-8 text-xs"
                                              onClick={() => reassignItem.mutate({
                                                itemId: item.id,
                                                branch: reassignBranch,
                                                subCategory: reassignSubCategory,
                                                residenceId: reassignResidenceId || null,
                                              })}
                                              disabled={reassignItem.isPending || (reassignBranch === 'residence_documents' && !reassignResidenceId)}
                                              data-testid={`button-reassign-save-${item.id}`}
                                            >
                                              {reassignItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (isFr ? 'Enregistrer' : 'Save')}
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-8 text-xs"
                                              onClick={() => setReassignPickerItemId(null)}
                                              data-testid={`button-reassign-cancel-${item.id}`}
                                            >
                                              {isFr ? 'Annuler' : 'Cancel'}
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                      {isResidencePickerOpen && item.branch === 'residence_documents' && (
                                        <div
                                          className="border-t bg-muted/30 px-3 py-3 flex flex-wrap items-end gap-3"
                                          data-testid={`residence-picker-${item.id}`}
                                        >
                                          <div className="flex flex-col gap-1">
                                            <Label className="text-xs">
                                              {isFr ? 'Résidence' : 'Residence'}
                                            </Label>
                                            {item.residenceAiSuggestedId
                                              && residencePickerValue === item.residenceAiSuggestedId
                                              && !item.residenceAiConfirmed && (
                                              <span
                                                className="flex items-center gap-1 text-[11px] text-violet-700 dark:text-violet-300"
                                                data-testid={`residence-picker-ai-hint-${item.id}`}
                                              >
                                                <Sparkles className="h-3 w-3" />
                                                {isFr
                                                  ? `Suggestion de l'IA : ${residencesById.get(item.residenceAiSuggestedId) ?? item.residenceAiSuggestedId.slice(0, 8)}`
                                                  : `AI suggestion: ${residencesById.get(item.residenceAiSuggestedId) ?? item.residenceAiSuggestedId.slice(0, 8)}`}
                                              </span>
                                            )}
                                            <Select
                                              value={residencePickerValue}
                                              onValueChange={setResidencePickerValue}
                                            >
                                              <SelectTrigger className="h-8 w-[220px] text-xs" data-testid={`residence-picker-select-${item.id}`}>
                                                <SelectValue placeholder={isFr ? 'Choisir une résidence…' : 'Choose a residence…'} />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {buildingResidences.length === 0 ? (
                                                  <SelectItem value="__none__" disabled className="text-xs text-muted-foreground">
                                                    {isFr ? 'Aucune résidence' : 'No residences'}
                                                  </SelectItem>
                                                ) : (
                                                  buildingResidences.map((r) => (
                                                    <SelectItem key={r.id} value={r.id} className="text-xs">
                                                      {r.unitNumber}
                                                    </SelectItem>
                                                  ))
                                                )}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div className="flex gap-2">
                                            <Button
                                              size="sm"
                                              className="h-8 text-xs"
                                              onClick={() =>
                                                setResidenceMutation.mutate({
                                                  itemId: item.id,
                                                  residenceId: residencePickerValue || null,
                                                })
                                              }
                                              disabled={setResidenceMutation.isPending || !residencePickerValue}
                                              data-testid={`button-residence-save-${item.id}`}
                                            >
                                              {setResidenceMutation.isPending ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                              ) : (
                                                isFr ? 'Enregistrer' : 'Save'
                                              )}
                                            </Button>
                                            {item.residenceId && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 text-xs"
                                                onClick={() =>
                                                  setResidenceMutation.mutate({
                                                    itemId: item.id,
                                                    residenceId: null,
                                                  })
                                                }
                                                disabled={setResidenceMutation.isPending}
                                                data-testid={`button-residence-clear-${item.id}`}
                                              >
                                                {isFr ? 'Effacer' : 'Clear'}
                                              </Button>
                                            )}
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-8 text-xs"
                                              onClick={() => setResidencePickerItemId(null)}
                                              data-testid={`button-residence-cancel-${item.id}`}
                                            >
                                              {isFr ? 'Annuler' : 'Cancel'}
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      );
                    })() : (
                    <div className="space-y-2">
                      {/* Excluded (rejected) files are hidden from step 3+.
                          Screening keeps them visible so admins can re-include
                          them; all later steps filter them out (Task #804).
                          Exception: in the sorting step, draft-split leads are
                          kept visible so the admin can still adjust or revert. */}
                      {(() => {
                        const visibleItems = currentStep !== 'screening'
                          ? items.filter((item) =>
                              item.status !== 'rejected' ||
                              // Split-draft leads: keep visible in sorting step so
                              // the admin can adjust or revert. Guard with
                              // preExcludeStatus == null so that an item the admin
                              // explicitly excluded (preExcludeStatus is set) is
                              // always hidden — even if it previously had split
                              // children recorded (Task #804 regression fix).
                              (currentStep === 'sorting' &&
                                !!item.sortingDecisionSplitIntoItemIds?.length &&
                                item.preExcludeStatus == null),
                            )
                          : items;
                        // Sorting step: build the set of sibling item IDs that
                        // belong to a merge group but are not the lead. Siblings
                        // are hidden at the top level and rendered inside their
                        // lead's card instead (Task #927).
                        // Only items that have sortingMergeWithItemIds (the
                        // ordered array from Task #856) are treated as leads;
                        // items with only the legacy sortingMergeWithItemId
                        // back-reference are siblings and never leads. This
                        // prevents mutual-reference loops from hiding both items.
                        const siblingItemIds = new Set<string>();
                        if (currentStep === 'sorting') {
                          for (const it of visibleItems) {
                            if (it.sortingDecision !== 'merge') continue;
                            if (!it.sortingMergeWithItemIds?.length) continue;
                            for (const sid of it.sortingMergeWithItemIds) {
                              const sib = items.find((i) => i.id === sid);
                              if (sib && sib.status !== 'rejected') {
                                siblingItemIds.add(sid);
                              }
                            }
                          }
                        }
                        const topLevelItems = currentStep === 'sorting'
                          ? (() => {
                              const filtered = visibleItems.filter((item) => !siblingItemIds.has(item.id));
                              // Sort: non-accepted (pending/rejected) first, fully-accepted
                              // items (or merge groups) last so admins see unreviewed items
                              // at the top without scrolling (Task #1001).
                              const isGroupFullyAccepted = (it: (typeof filtered)[number]): boolean => {
                                if (it.sortingDecisionState !== 'accepted') return false;
                                if (!it.sortingMergeWithItemIds?.length) return true;
                                return it.sortingMergeWithItemIds.every((sid) => {
                                  const sib = items.find((i) => i.id === sid);
                                  return !sib || sib.status === 'rejected' || sib.sortingDecisionState === 'accepted';
                                });
                              };
                              return [...filtered].sort((a, b) => {
                                const aAcc = isGroupFullyAccepted(a);
                                const bAcc = isGroupFullyAccepted(b);
                                if (aAcc === bAcc) return 0;
                                return aAcc ? 1 : -1;
                              });
                            })()
                          : visibleItems;
                        // Task #1045: when the hide-ready toggle is ON, filter
                        // out items that are already ready for the next step.
                        // Applied after sibling removal so lead–sibling grouping
                        // is unaffected (hidden leads take their siblings with them).
                        const displayedTopLevelItems = hideReady
                          ? topLevelItems.filter((item) => !isItemReadyForNextStep(item, currentStep))
                          : topLevelItems;
                        return (
                          <>
                      {displayedTopLevelItems.length === 0 && (
                        <p className="text-sm text-muted-foreground" data-testid={`empty-state-${currentStep}`}>
                          {hideReady && topLevelItems.length > 0
                            ? (isFr ? "Tous les fichiers sont prêts pour l'étape suivante." : 'All files are ready for the next step.')
                            : (isFr ? 'Aucun fichier' : 'No items')}
                        </p>
                      )}
                      {displayedTopLevelItems.map((item) => {
                        const decision = getItemStepDecision(item, currentStep);
                        const isAuto = isAutoStep(currentStep);
                        const retryAction = isAuto
                          ? stepRetryAction[currentStep as AutoStep]
                          : null;
                        // Retry surfaces when this item is still
                        // sitting in the pre-step status after the
                        // run-all loop has finished, OR when the AI
                        // came back with a fallback reason for the
                        // current step. Generalizes Task #575's
                        // screening-only auto behaviour to all five
                        // AI steps.
                        const progress = isAuto
                          ? readRunAllProgress(session, currentStep as AutoStep)
                          : null;
                        const stillEligible =
                          isAuto &&
                          item.status === STEP_PRE_STATUS[currentStep as AutoStep];
                        // Draft-split leads have status='rejected' but are kept
                        // visible so the admin can adjust or revert the split.
                        const isDraftSplitLead =
                          currentStep === 'sorting' &&
                          item.status === 'rejected' &&
                          !!item.sortingDecisionSplitIntoItemIds?.length &&
                          item.preExcludeStatus == null;
                        const isExcluded = item.status === 'rejected' && !isDraftSplitLead;
                        const showRetry =
                          !isExcluded &&
                          !isDraftSplitLead &&
                          !!retryAction &&
                          ((!!decision?.fallbackReason) ||
                            (stillEligible && !!progress?.finishedAt));
                        // Task #1047: keep the spinner up while the
                        // background per-item retry is in flight on the
                        // server (signal lives in `runAll[step].inFlight`
                        // alongside the run-all loop's entries).
                        const polledRetryInFlight =
                          isAuto &&
                          !!progress?.inFlight?.some((e) => e.itemId === item.id);
                        const retryPending =
                          (runStep.isPending && runStep.variables?.itemId === item.id) ||
                          polledRetryInFlight;
                        // Committed/duplicate items are terminal and
                        // not eligible for the exclude toggle (matches
                        // the server-side guard).
                        const canToggleExclude =
                          item.status !== 'committed' &&
                          item.status !== 'duplicate';
                        const togglePending =
                          toggleExclude.isPending &&
                          toggleExclude.variables?.itemId === item.id;
                        // Offer expansion when there is step-specific
                        // analysis to display.  For the sorting step we
                        // show analysis when a decision exists; for all
                        // other steps we rely on the quickAnalysis signal.
                        const hasAnalysis =
                          currentStep === 'sorting'
                            ? item.sortingDecision != null
                            : hasQuickAnalysisSignal(item);
                        // For the sorting step: is the AI's answer
                        // waiting for human acceptance?
                        const sortingIsPending =
                          currentStep === 'sorting' &&
                          item.sortingDecisionState === 'pending';
                        const sortingIsRejected =
                          currentStep === 'sorting' &&
                          item.sortingDecisionState === 'rejected';
                        const sortingIsAccepted =
                          currentStep === 'sorting' &&
                          item.sortingDecisionState === 'accepted';
                        // Note: this else block only renders for non-branching
                        // steps (branching has its own IIFE above), so the
                        // collapsedBranchingItemIds branch below is a safety
                        // fallback that TypeScript narrows away. Cast to keep
                        // the explicit intent visible.
                        // For merge leads: the group stays expanded if ANY
                        // sibling is non-accepted, so the admin can see all
                        // pending/rejected members without needing to expand
                        // manually (Task #1001 group-level expand semantics).
                        const _mergeGroupAnyNonAccepted =
                          currentStep === 'sorting' &&
                          !!item.sortingMergeWithItemIds?.length &&
                          item.sortingMergeWithItemIds.some((sid) => {
                            const sib = items.find((i) => i.id === sid);
                            return (
                              sib &&
                              sib.status !== 'rejected' &&
                              sib.sortingDecisionState !== 'accepted'
                            );
                          });
                        // Sorting step: non-accepted rows are always expanded
                        // (admins can't collapse them); accepted rows start
                        // collapsed and can be toggled open (Task #1001).
                        const isExpanded =
                          currentStep === 'sorting'
                            ? (sortingIsPending || sortingIsRejected || isDraftSplitLead || _mergeGroupAnyNonAccepted)
                              ? true
                              : expandedItemIds.has(item.id)
                            : (currentStep as string) === 'branching'
                              ? !collapsedBranchingItemIds.has(item.id)
                              : expandedItemIds.has(item.id);
                        const _pickerEntry = sortingPickerStates.get(item.id) ?? {
                          decision: 'keep' as const,
                          mergeTargetId: '',
                          splitPage: 1,
                        };
                        const pickerDecision = _pickerEntry.decision;
                        const pickerMergeTargetId = _pickerEntry.mergeTargetId;
                        const pickerSplitPage = _pickerEntry.splitPage;
                        const sortingMutationPending =
                          acceptAllPendingSorting.isPending ||
                          (setSortingDecision.isPending &&
                          (setSortingDecision.variables as { itemId: string } | undefined)?.itemId === item.id);
                        // When the row is in the 'rejected' state the admin is
                        // choosing manually via the picker, so the effective
                        // decision is whatever the picker currently shows.
                        // For all other states (pending, accepted) we use the
                        // item's saved sortingDecision.  This drives the "In
                        // this merge" sibling list and the merge-count badge:
                        // both should only appear when the effective decision
                        // is actually 'merge' (Task #956).
                        const effectiveSortingDecision: string | null = sortingIsRejected
                          ? pickerDecision
                          : item.sortingDecision;
                        // Non-excluded siblings of this merge-lead, rendered
                        // as a nested list inside the lead's card (Task #927).
                        // Mirrors the siblingItemIds logic: only items with
                        // sortingMergeWithItemIds act as leads.
                        const mergeGroupSiblingItems: BulkImportItemLite[] =
                          currentStep === 'sorting' &&
                          effectiveSortingDecision === 'merge' &&
                          item.sortingMergeWithItemIds?.length
                            ? item.sortingMergeWithItemIds
                                .map((sid) => items.find((i) => i.id === sid))
                                .filter((si): si is BulkImportItemLite => si != null && si.status !== 'rejected')
                            : [];
                        // Total files in this merge group: the lead itself plus
                        // any non-excluded siblings. Used to surface the size
                        // of the merge on the lead's badge so admins don't
                        // have to expand the nested list to know whether it's
                        // a 2-way or 5-way merge (Task #929).
                        const mergeGroupTotalCount =
                          currentStep === 'sorting' &&
                          effectiveSortingDecision === 'merge' &&
                          item.sortingMergeWithItemIds?.length
                            ? mergeGroupSiblingItems.length + 1
                            : 0;
                        const mergeGroupCountSuffix =
                          mergeGroupTotalCount > 1
                            ? isFr
                              ? ` · ${mergeGroupTotalCount} fichiers`
                              : ` · ${mergeGroupTotalCount} files`
                            : '';
                        return (
                          <div
                            key={item.id}
                            className={`rounded-md border transition ${
                              isExcluded ? 'bg-muted/40 opacity-60' : ''
                            }`}
                            data-testid={`item-row-${item.id}`}
                            data-excluded={isExcluded ? 'true' : 'false'}
                          >
                            {currentStep === 'sorting' && mergeGroupSiblingItems.length > 0 && (
                              <div className="flex items-center gap-2 px-3 pt-3 pb-1 border-b border-border" data-testid={`branching-merge-group-header-${item.id}`}>
                                <GitMerge className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {isFr
                                    ? `Fusion · ${mergeGroupTotalCount} fichiers`
                                    : `Merge · ${mergeGroupTotalCount} files`}
                                </span>
                              </div>
                            )}
                            <SortingMergeGroupWrapper
                              show={currentStep === 'sorting' && mergeGroupSiblingItems.length > 0}
                              testId={`branching-merge-group-${item.id}`}
                              isFr={isFr}
                              siblingRows={mergeGroupSiblingItems.map((sibling) => {
                                const SiblingIcon = iconForMime(sibling.mimeType);
                                const sibSortingIsPending =
                                  sibling.sortingDecisionState === 'pending';
                                const sibSortingIsRejected =
                                  sibling.sortingDecisionState === 'rejected';
                                const sibSortingIsAccepted =
                                  sibling.sortingDecisionState === 'accepted';
                                const sibIsDraftSplitLead =
                                  sibling.status === 'rejected' &&
                                  !!sibling.sortingDecisionSplitIntoItemIds?.length &&
                                  sibling.preExcludeStatus == null;
                                const sibIsExcluded = sibling.status === 'rejected' && !sibIsDraftSplitLead;
                                const sibDecision = getItemStepDecision(sibling, currentStep);
                                const sibSortingMutationPending =
                                  setSortingDecision.isPending &&
                                  setSortingDecision.variables?.itemId === sibling.id;
                                const sibTogglePending =
                                  toggleExclude.isPending &&
                                  toggleExclude.variables?.itemId === sibling.id;
                                const sibCanToggleExclude =
                                  sibling.status !== 'committed' &&
                                  sibling.status !== 'duplicate';
                                // Group-level rule: if any member of the merge
                                // group is non-accepted (lead or any sibling),
                                // ALL members stay force-expanded so admins can
                                // see the full group state at once.
                                const sibGroupForceExpand =
                                  sortingIsPending ||
                                  sortingIsRejected ||
                                  isDraftSplitLead ||
                                  _mergeGroupAnyNonAccepted;
                                const sibIsExpanded =
                                  expandedItemIds.has(sibling.id) ||
                                  sibGroupForceExpand;
                                // Whether the sibling's action row (Row 2) has
                                // anything to show. When false the row is
                                // skipped so the card doesn't reserve empty
                                // vertical space below the filename. The lead
                                // and sibling now share the same two-row
                                // layout — filename on Row 1, chips/actions on
                                // Row 2 indented by `pl-10` to align with the
                                // filename text (Task #1033).
                                const sibHasRow2Content =
                                  sibIsExcluded ||
                                  sibCanToggleExclude ||
                                  sibSortingIsPending ||
                                  sibSortingIsRejected;
                                return (
                                  <div
                                    key={sibling.id}
                                    className="ml-4 border-l-2 border-border"
                                    data-testid={`branching-merge-group-sibling-${item.id}-${sibling.id}`}
                                  >
                                    {/* Two-row layout matching the lead: filename on Row 1,
                                        chips/actions on Row 2 indented to align with the
                                        filename (Task #1033). */}
                                    <div className="flex flex-col gap-2 p-3">
                                      {/* Row 1: chevron + file icon + filename */}
                                      <div className="flex items-center gap-3">
                                        {/* Chevron: spacer when group is force-expanded (any
                                            member non-accepted), interactive toggle when the
                                            whole group is accepted */}
                                        {sibGroupForceExpand ? (
                                          <span className="h-7 w-7 flex-shrink-0" aria-hidden="true" />
                                        ) : (
                                          <button
                                            type="button"
                                            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            aria-expanded={sibIsExpanded}
                                            aria-label={
                                              sibIsExpanded
                                                ? isFr ? 'Masquer les détails' : 'Hide details'
                                                : isFr ? 'Afficher les détails' : 'Show details'
                                            }
                                            data-testid={`button-toggle-detail-${sibling.id}`}
                                            onClick={() => toggleItemExpanded(sibling.id)}
                                          >
                                            {sibIsExpanded ? (
                                              <ChevronDown className="h-4 w-4" />
                                            ) : (
                                              <ChevronRight className="h-4 w-4" />
                                            )}
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                                          data-testid={`item-preview-trigger-${sibling.id}`}
                                          onClick={() =>
                                            setPreviewItem({
                                              id: sibling.id,
                                              originalName: sibling.originalName,
                                              mimeType: sibling.mimeType,
                                            })
                                          }
                                        >
                                          <SiblingIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                                          <span className="truncate">{sibling.originalName}</span>
                                        </button>
                                      </div>
                                      {/* Row 2: chips + actions, indented (`pl-10`) so chips
                                          line up under the filename — matches the lead's
                                          two-row layout. Skipped when there are no chips or
                                          buttons to render so the card doesn't add empty
                                          vertical space. */}
                                      {sibHasRow2Content && (
                                        <div
                                          className="flex items-center gap-2 flex-wrap pl-10"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {sibSortingIsPending && !sibIsExcluded && (
                                            <Badge
                                              variant="outline"
                                              className="shrink-0 border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
                                              data-testid={`sorting-pending-badge-${sibling.id}`}
                                            >
                                              {isFr ? 'En attente' : 'Pending review'}
                                            </Badge>
                                          )}
                                          {sibSortingIsRejected && !sibIsExcluded && (
                                            <Badge
                                              variant="outline"
                                              className="shrink-0 border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
                                              data-testid={`sorting-rejected-badge-${sibling.id}`}
                                            >
                                              {isFr ? 'Rejeté – choix requis' : 'Rejected – choose manually'}
                                            </Badge>
                                          )}
                                          {sibSortingIsPending && !sibIsExcluded && (
                                            <>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300"
                                                disabled={sibSortingMutationPending}
                                                data-testid={`button-sorting-accept-${sibling.id}`}
                                                onClick={() => {
                                                  cancelAutoSave(sibling.id);
                                                  setSortingDecision.mutate({
                                                    itemId: sibling.id,
                                                    action: 'accept',
                                                  });
                                                }}
                                              >
                                                {sibSortingMutationPending ? (
                                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                  <Check className="mr-1.5 h-3.5 w-3.5" />
                                                )}
                                                {isFr ? 'Accepter' : 'Accept'}
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300"
                                                disabled={sibSortingMutationPending}
                                                data-testid={`button-sorting-reject-${sibling.id}`}
                                                onClick={() => {
                                                  cancelAutoSave(sibling.id);
                                                  const d = (sibling.sortingDecision ?? 'keep') as 'keep' | 'merge' | 'split';
                                                  setSortingPickerStates((prev) => {
                                                    const next = new Map(prev);
                                                    next.set(sibling.id, {
                                                      decision: d,
                                                      mergeTargetId: d === 'merge' ? (sibling.sortingMergeWithItemId ?? '') : '',
                                                      splitPage: d === 'split' ? (sibling.sortingSplitAtPage ?? 1) : 1,
                                                    });
                                                    return next;
                                                  });
                                                  setSortingDecision.mutate({
                                                    itemId: sibling.id,
                                                    action: 'reject',
                                                  });
                                                }}
                                              >
                                                <X className="mr-1.5 h-3.5 w-3.5" />
                                                {isFr ? 'Rejeter' : 'Reject'}
                                              </Button>
                                            </>
                                          )}
                                          {sibCanToggleExclude && !sibIsExcluded && (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-7 w-7 p-0 flex-shrink-0"
                                              onClick={() =>
                                                toggleExclude.mutate({
                                                  itemId: sibling.id,
                                                  excluded: true,
                                                })
                                              }
                                              disabled={sibTogglePending}
                                              aria-label={isFr ? 'Exclure le fichier' : 'Exclude file'}
                                              title={isFr ? 'Exclure' : 'Exclude'}
                                              data-testid={`button-toggle-exclude-${sibling.id}`}
                                            >
                                              {sibTogglePending ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                              ) : (
                                                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                              )}
                                            </Button>
                                          )}
                                          {sibIsExcluded && (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-7 w-7 p-0 flex-shrink-0"
                                              onClick={() =>
                                                toggleExclude.mutate({
                                                  itemId: sibling.id,
                                                  excluded: false,
                                                })
                                              }
                                              disabled={sibTogglePending}
                                              aria-label={isFr ? 'Réintégrer le fichier' : 'Restore file'}
                                              title={isFr ? 'Réintégrer' : 'Restore'}
                                              data-testid={`button-toggle-exclude-${sibling.id}`}
                                            >
                                              {sibTogglePending ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                              ) : (
                                                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                              )}
                                            </Button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    {/* Detail panel: always visible when pending/rejected (force-expanded),
                                        toggled by chevron when accepted */}
                                    {sibIsExpanded && (
                                      <div
                                        className="border-t bg-muted/30 px-3 py-3"
                                        data-testid={`item-detail-panel-${sibling.id}`}
                                      >
                                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                          {isFr ? 'Analyse de l\'IA' : 'AI analysis'}
                                        </div>
                                        {(() => {
                                          const itemIsPdf = (sibling.mimeType ?? '').toLowerCase() === 'application/pdf';
                                          const currentDecision = sibling.sortingDecision;
                                          const currentSplitAtPage = sibling.sortingSplitAtPage;
                                          const inlineSlice = inlineSlicePage.get(sibling.id);
                                          const showSliceSection = (currentDecision === 'split' || inlineSlice !== undefined) && !sibSortingIsRejected;
                                          const showMergeSection = (currentDecision === 'merge' || inlineMergeOrder.has(sibling.id));
                                          const effectiveSlicePage = inlineSlice ?? currentSplitAtPage ?? 1;
                                          const mergeGroupIds = inlineMergeOrder.get(sibling.id) ?? computeMergeGroup(items, sibling.id);
                                          const mergeLeadId = currentDecision === 'merge' ? (mergeGroupIds[0] ?? sibling.id) : sibling.id;
                                          const leadItem = currentDecision === 'merge'
                                            ? (items.find((i) => i.id === mergeLeadId) ?? sibling)
                                            : sibling;
                                          const renameSourceItem = currentDecision === 'merge' ? leadItem : sibling;
                                          const fileExt = renameSourceItem.originalName.replace(/^[^.]*(\..+)?$/, '$1') || '';
                                          const renameStem = renameSourceItem.originalName.replace(/\.[^.]+$/, '');
                                          const saveStatusVal = autoSaveStatus.get(mergeLeadId);
                                          const renameTestId = currentDecision === 'merge'
                                            ? `branching-rename-merge-${mergeLeadId}`
                                            : `branching-rename-${sibling.id}`;
                                          // Read-only AI suggestion summary for rejected items
                                          // (Task #1034). When the row is rejected, the
                                          // interactive slice/merge sub-sections are
                                          // suppressed (showSliceSection / showMergeSection
                                          // both gate on !sibSortingIsRejected for slice or
                                          // are owned by the manual picker), so admins lose
                                          // sight of what the AI originally proposed. This
                                          // card surfaces that context without duplicating
                                          // any interactive controls.
                                          //
                                          // We gate on !sortingDecisionDraft so the card
                                          // only renders while item.sortingDecision still
                                          // reflects the AI's original suggestion. Once the
                                          // admin has auto-saved a manual override via the
                                          // picker (scheduleAutoSave -> draft=true), the
                                          // saved decision is the admin's draft, not the
                                          // AI's, so the card hides itself rather than
                                          // mislabel the draft as an "AI suggestion".
                                          const aiSuggestedDecision = sibling.sortingDecision;
                                          const showAiSuggestion =
                                            sibSortingIsRejected &&
                                            !sibling.sortingDecisionDraft &&
                                            (aiSuggestedDecision === 'split' || aiSuggestedDecision === 'merge');
                                          const aiSuggestedSplitPage = sibling.sortingSplitAtPage ?? 1;
                                          const aiSuggestedMergePartnerNames =
                                            aiSuggestedDecision === 'merge'
                                              ? computeMergeGroup(items, sibling.id)
                                                  .filter((id) => id !== sibling.id)
                                                  .map((id) => items.find((i) => i.id === id)?.originalName ?? id)
                                              : [];
                                          const aiSuggestedConfidence = sibling.sortingConfidence;
                                          const aiSuggestedConfidencePct =
                                            typeof aiSuggestedConfidence === 'number' && Number.isFinite(aiSuggestedConfidence)
                                              ? Math.round(aiSuggestedConfidence * 100)
                                              : null;
                                          return (
                                            <div className="space-y-4">
                                              {/* --- AI SUGGESTION read-only summary (rejected items only) --- */}
                                              {showAiSuggestion && (
                                                <div
                                                  className="rounded-md border border-border bg-background/60 p-3 space-y-1"
                                                  data-testid={`branching-ai-suggestion-${sibling.id}`}
                                                >
                                                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    <Sparkles className="h-3.5 w-3.5" />
                                                    {isFr ? 'Suggestion de l\'IA' : 'AI suggestion'}
                                                  </div>
                                                  <p className="text-sm text-muted-foreground">
                                                    {aiSuggestedDecision === 'split'
                                                      ? (isFr
                                                          ? `Découpage après la page ${aiSuggestedSplitPage}`
                                                          : `Split after page ${aiSuggestedSplitPage}`)
                                                      : aiSuggestedMergePartnerNames.length > 0
                                                        ? (isFr
                                                            ? `Fusion avec : ${aiSuggestedMergePartnerNames.join(', ')}`
                                                            : `Merge with: ${aiSuggestedMergePartnerNames.join(', ')}`)
                                                        : (isFr ? 'Fusion suggérée' : 'Merge suggested')}
                                                  </p>
                                                  {aiSuggestedConfidencePct != null && (
                                                    <p
                                                      className="text-xs text-muted-foreground"
                                                      data-testid={`branching-ai-suggestion-confidence-${sibling.id}`}
                                                    >
                                                      {isFr
                                                        ? `Confiance de l'IA : ${aiSuggestedConfidencePct} %`
                                                        : `AI confidence: ${aiSuggestedConfidencePct}%`}
                                                    </p>
                                                  )}
                                                </div>
                                              )}
                                              {/* --- SLICE sub-section --- */}
                                              {showSliceSection && (
                                                <div
                                                  className="rounded-md border border-border bg-background/60 p-3 space-y-2"
                                                  data-testid={`branching-slice-section-${sibling.id}`}
                                                >
                                                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    <Scissors className="h-3.5 w-3.5" />
                                                    {isFr ? 'Découpage' : 'Slice'}
                                                  </div>
                                                  {sibSortingIsAccepted ? (
                                                    <div className="flex flex-wrap items-center gap-2">
                                                      <span className="text-xs text-muted-foreground">
                                                        {isFr
                                                          ? `Découpé après la page ${effectiveSlicePage}`
                                                          : `Sliced after page ${effectiveSlicePage}`}
                                                      </span>
                                                      {itemIsPdf && (
                                                        <SplitPagePreview
                                                          itemId={sibling.id}
                                                          splitPage={effectiveSlicePage}
                                                          isFr={isFr}
                                                        />
                                                      )}
                                                    </div>
                                                  ) : (
                                                    <>
                                                      <p className="text-xs text-muted-foreground">
                                                        {isFr
                                                          ? 'La page choisie reste dans la première partie ; la page suivante commence la seconde partie.'
                                                          : 'The chosen page stays in part 1; the next page starts part 2.'}
                                                      </p>
                                                      <div className="flex flex-wrap items-center gap-2">
                                                        <label className="text-sm text-muted-foreground whitespace-nowrap">
                                                          {isFr ? 'Scinder après la page :' : 'Split after page:'}
                                                        </label>
                                                        <SplitPageManualInput
                                                          itemId={sibling.id}
                                                          isPdf={itemIsPdf}
                                                          splitPage={effectiveSlicePage}
                                                          onChange={(next) => {
                                                            setInlineSlicePage((prev) => new Map(prev).set(sibling.id, next));
                                                            scheduleAutoSave(sibling);
                                                          }}
                                                          isFr={isFr}
                                                        />
                                                      </div>
                                                      {(sibSortingIsPending || sibSortingIsRejected) && inlineSlice !== undefined && (
                                                        <div className="mt-2 flex gap-2">
                                                          <Button
                                                            size="sm"
                                                            disabled={sibSortingMutationPending}
                                                            data-testid={`branching-slice-confirm-${sibling.id}`}
                                                            onClick={() => {
                                                              cancelAutoSave(sibling.id);
                                                              setSortingDecision.mutate({
                                                                itemId: sibling.id,
                                                                action: 'manual',
                                                                decision: 'split',
                                                                splitAtPage: inlineSlice,
                                                              });
                                                            }}
                                                          >
                                                            {sibSortingMutationPending ? (
                                                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                            ) : null}
                                                            {isFr ? 'Confirmer' : 'Confirm'}
                                                          </Button>
                                                          <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => {
                                                              setInlineSlicePage((prev) => {
                                                                const next = new Map(prev);
                                                                next.delete(sibling.id);
                                                                return next;
                                                              });
                                                            }}
                                                          >
                                                            {isFr ? 'Annuler' : 'Cancel'}
                                                          </Button>
                                                        </div>
                                                      )}
                                                    </>
                                                  )}
                                                </div>
                                              )}

                                              {/* --- MERGE sub-section --- */}
                                              {showMergeSection && (
                                                <div
                                                  className="rounded-md border border-border bg-background/60 p-3 space-y-2"
                                                  data-testid={`branching-merge-section-${sibling.id}`}
                                                >
                                                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    <GitMerge className="h-3.5 w-3.5" />
                                                    {isFr ? 'Fusion' : 'Merge'}
                                                  </div>
                                                  <p className="text-xs text-muted-foreground">
                                                    {isFr
                                                      ? 'Les fichiers seront combinés dans cet ordre en un seul PDF.'
                                                      : 'Files will be combined in this order into a single PDF.'}
                                                  </p>
                                                  {(() => {
                                                    const displayedMergeGroupIds = mergeGroupIds.filter((fileId) => {
                                                      const fi = items.find((i) => i.id === fileId);
                                                      return !fi || fi.status !== 'rejected';
                                                    });
                                                    return (
                                                      <ol className="space-y-1">
                                                        {displayedMergeGroupIds.map((fileId, idx) => {
                                                          const fileItem = items.find((i) => i.id === fileId);
                                                          const fileName = fileItem?.originalName ?? fileId;
                                                          const FileIconComp = iconForMime(fileItem?.mimeType);
                                                          const canMoveUp = !sibSortingIsAccepted && idx > 0;
                                                          const canMoveDown = !sibSortingIsAccepted && idx < displayedMergeGroupIds.length - 1;
                                                          return (
                                                            <li
                                                              key={fileId}
                                                              className="flex items-center gap-2"
                                                              data-testid={`branching-merge-row-${sibling.id}-${idx}`}
                                                            >
                                                              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                                                                {idx + 1}
                                                              </span>
                                                              <FileIconComp className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                                                              <span className="min-w-0 flex-1 truncate text-sm">
                                                                {fileName}
                                                                {idx === 0 && (
                                                                  <span className="ml-2 text-xs text-muted-foreground">
                                                                    ({isFr ? 'principal' : 'lead'})
                                                                  </span>
                                                                )}
                                                              </span>
                                                              {!sibSortingIsAccepted && (
                                                                <div className="flex gap-0.5">
                                                                  <button
                                                                    type="button"
                                                                    disabled={!canMoveUp}
                                                                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted/60 disabled:opacity-40"
                                                                    aria-label={isFr ? 'Monter' : 'Move up'}
                                                                    title={isFr ? 'Monter' : 'Move up'}
                                                                    data-testid={`branching-merge-move-up-${sibling.id}-${idx}`}
                                                                    onClick={() => {
                                                                      if (!canMoveUp) return;
                                                                      const next = [...displayedMergeGroupIds];
                                                                      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                                                      setInlineMergeOrder((prev) => new Map(prev).set(sibling.id, next));
                                                                      scheduleAutoSave(sibling);
                                                                    }}
                                                                  >
                                                                    <ChevronUp className="h-3.5 w-3.5" />
                                                                  </button>
                                                                  <button
                                                                    type="button"
                                                                    disabled={!canMoveDown}
                                                                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted/60 disabled:opacity-40"
                                                                    aria-label={isFr ? 'Descendre' : 'Move down'}
                                                                    title={isFr ? 'Descendre' : 'Move down'}
                                                                    data-testid={`branching-merge-move-down-${sibling.id}-${idx}`}
                                                                    onClick={() => {
                                                                      if (!canMoveDown) return;
                                                                      const next = [...displayedMergeGroupIds];
                                                                      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                                                      setInlineMergeOrder((prev) => new Map(prev).set(sibling.id, next));
                                                                      scheduleAutoSave(sibling);
                                                                    }}
                                                                  >
                                                                    <ChevronDown className="h-3.5 w-3.5" />
                                                                  </button>
                                                                </div>
                                                              )}
                                                            </li>
                                                          );
                                                        })}
                                                      </ol>
                                                    );
                                                  })()}
                                                  {!sibSortingIsAccepted && itemIsPdf && (() => {
                                                    const candidates = items.filter(
                                                      (i) =>
                                                        !mergeGroupIds.includes(i.id) &&
                                                        i.id !== sibling.id &&
                                                        i.status !== 'rejected' &&
                                                        (i.mimeType ?? '').toLowerCase() === 'application/pdf',
                                                    );
                                                    if (candidates.length === 0) return null;
                                                    return (
                                                      <div className="flex items-center gap-2">
                                                        <label className="whitespace-nowrap text-xs text-muted-foreground">
                                                          {isFr ? 'Ajouter un fichier :' : 'Add file:'}
                                                        </label>
                                                        <select
                                                          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                                          value=""
                                                          data-testid={`branching-merge-add-${sibling.id}`}
                                                          onChange={(e) => {
                                                            const newId = e.target.value;
                                                            if (!newId) return;
                                                            const next = [...mergeGroupIds, newId];
                                                            setInlineMergeOrder((prev) => new Map(prev).set(sibling.id, next));
                                                            scheduleAutoSave(sibling);
                                                          }}
                                                        >
                                                          <option value="">
                                                            {isFr ? '— Sélectionner un fichier —' : '— Select a file —'}
                                                          </option>
                                                          {candidates.map((c) => (
                                                            <option key={c.id} value={c.id}>
                                                              {c.originalName}
                                                            </option>
                                                          ))}
                                                        </select>
                                                      </div>
                                                    );
                                                  })()}
                                                  {(sibSortingIsPending || sibSortingIsRejected) && inlineMergeOrder.has(sibling.id) && (
                                                    <div className="mt-2 flex gap-2">
                                                      <Button
                                                        size="sm"
                                                        disabled={sibSortingMutationPending}
                                                        data-testid={`branching-merge-confirm-${sibling.id}`}
                                                        onClick={() => {
                                                          const order = inlineMergeOrder.get(sibling.id)!;
                                                          cancelAutoSave(sibling.id);
                                                          setSortingDecision.mutate({
                                                            itemId: order[0],
                                                            action: 'manual',
                                                            decision: 'merge',
                                                            mergeWithItemIds: order.slice(1),
                                                          });
                                                        }}
                                                      >
                                                        {sibSortingMutationPending ? (
                                                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                        ) : null}
                                                        {isFr ? 'Confirmer l\'ordre' : 'Confirm order'}
                                                      </Button>
                                                      <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                          setInlineMergeOrder((prev) => {
                                                            const next = new Map(prev);
                                                            next.delete(sibling.id);
                                                            return next;
                                                          });
                                                        }}
                                                      >
                                                        {isFr ? 'Annuler' : 'Cancel'}
                                                      </Button>
                                                    </div>
                                                  )}
                                                </div>
                                              )}

                                              {/* "Add slice" / "Add merge" buttons */}
                                              {!sibIsExcluded && !showSliceSection && !showMergeSection && itemIsPdf && (currentDecision === 'keep' || !currentDecision) && !sibSortingIsAccepted && (
                                                <div className="flex items-center gap-2">
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    data-testid={`branching-slice-add-${sibling.id}`}
                                                    onClick={() => {
                                                      const seed = sibling.sortingSplitAtPage ?? 1;
                                                      setInlineSlicePage((prev) => new Map(prev).set(sibling.id, seed));
                                                    }}
                                                  >
                                                    <Scissors className="mr-1.5 h-3.5 w-3.5" />
                                                    {isFr ? 'Ajouter un découpage' : 'Add slice'}
                                                  </Button>
                                                  {!inlineMergeOrder.has(sibling.id) && (
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      data-testid={`branching-merge-add-trigger-${sibling.id}`}
                                                      onClick={() => {
                                                        setInlineMergeOrder((prev) => new Map(prev).set(sibling.id, [sibling.id]));
                                                      }}
                                                    >
                                                      <GitMerge className="mr-1.5 h-3.5 w-3.5" />
                                                      {isFr ? 'Ajouter une fusion' : 'Add merge'}
                                                    </Button>
                                                  )}
                                                </div>
                                              )}

                                              {/* --- RENAME sub-section --- */}
                                              {!sibIsExcluded && !sibSortingIsAccepted && !!currentDecision && (
                                                <div
                                                  className="rounded-md border border-border bg-background/60 p-3 space-y-2"
                                                  data-testid={`branching-rename-section-${sibling.id}`}
                                                >
                                                  <div className="flex items-center justify-between gap-1.5">
                                                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                      <Pencil className="h-3.5 w-3.5" />
                                                      {isFr ? 'Renommer' : 'Rename'}
                                                    </div>
                                                    {saveStatusVal === 'error' ? (
                                                      <button
                                                        type="button"
                                                        data-testid={`branching-autosave-status-${mergeLeadId}`}
                                                        className="text-xs text-destructive underline cursor-pointer"
                                                        onClick={() => scheduleAutoSave(leadItem)}
                                                      >
                                                        {isFr ? 'Erreur — Réessayer' : 'Failed — Retry'}
                                                      </button>
                                                    ) : (
                                                      <span
                                                        data-testid={`branching-autosave-status-${mergeLeadId}`}
                                                        className="text-xs text-muted-foreground"
                                                      >
                                                        {saveStatusVal === 'saving'
                                                          ? (isFr ? 'Enregistrement…' : 'Saving…')
                                                          : saveStatusVal === 'saved'
                                                            ? (isFr ? 'Enregistré' : 'Saved')
                                                            : null}
                                                      </span>
                                                    )}
                                                  </div>
                                                  {currentDecision === 'split' ? (
                                                    <>
                                                      <div className="flex flex-col gap-1">
                                                        <label className="text-xs text-muted-foreground">
                                                          {isFr ? 'Partie 1 :' : 'Part 1:'}
                                                        </label>
                                                        <div className="flex items-center gap-1">
                                                          <input
                                                            type="text"
                                                            className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                                            data-testid={`branching-rename-split-${sibling.id}-0`}
                                                            value={inlineRenameSplit.get(sibling.id)?.[0] ?? sibling.sortingDecisionSplitFinalNames?.[0] ?? ''}
                                                            placeholder={`${renameStem} (1)`}
                                                            onChange={(e) => {
                                                              const part2 = inlineRenameSplit.get(sibling.id)?.[1] ?? sibling.sortingDecisionSplitFinalNames?.[1] ?? '';
                                                              setInlineRenameSplit((prev) => new Map(prev).set(sibling.id, [e.target.value, part2]));
                                                              scheduleAutoSave(sibling);
                                                            }}
                                                          />
                                                          {fileExt && <span className="text-sm text-muted-foreground shrink-0">{fileExt}</span>}
                                                        </div>
                                                      </div>
                                                      <div className="flex flex-col gap-1">
                                                        <label className="text-xs text-muted-foreground">
                                                          {isFr ? 'Partie 2 :' : 'Part 2:'}
                                                        </label>
                                                        <div className="flex items-center gap-1">
                                                          <input
                                                            type="text"
                                                            className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                                            data-testid={`branching-rename-split-${sibling.id}-1`}
                                                            value={inlineRenameSplit.get(sibling.id)?.[1] ?? sibling.sortingDecisionSplitFinalNames?.[1] ?? ''}
                                                            placeholder={`${renameStem} (2)`}
                                                            onChange={(e) => {
                                                              const part1 = inlineRenameSplit.get(sibling.id)?.[0] ?? sibling.sortingDecisionSplitFinalNames?.[0] ?? '';
                                                              setInlineRenameSplit((prev) => new Map(prev).set(sibling.id, [part1, e.target.value]));
                                                              scheduleAutoSave(sibling);
                                                            }}
                                                          />
                                                          {fileExt && <span className="text-sm text-muted-foreground shrink-0">{fileExt}</span>}
                                                        </div>
                                                      </div>
                                                    </>
                                                  ) : (
                                                    <div className="flex flex-col gap-1">
                                                      <label className="text-xs text-muted-foreground">
                                                        {isFr ? 'Nouveau nom :' : 'New name:'}
                                                      </label>
                                                      <div className="flex items-center gap-1">
                                                        <input
                                                          type="text"
                                                          className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                                          data-testid={renameTestId}
                                                          value={inlineRename.get(mergeLeadId) ?? leadItem.finalFileName ?? ''}
                                                          placeholder={renameStem}
                                                          onChange={(e) => {
                                                            setInlineRename((prev) => new Map(prev).set(mergeLeadId, e.target.value));
                                                            scheduleAutoSave(leadItem, sortingPickerStates.get(sibling.id)?.decision);
                                                          }}
                                                        />
                                                        {fileExt && <span className="text-sm text-muted-foreground shrink-0">{fileExt}</span>}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              )}

                                              {/* --- PERIOD sub-section --- */}
                                              {!sibIsExcluded && (() => {
                                                const rawHint = sibling.screeningPeriodHint ?? null;
                                                // Task #1060: prefer the server-parsed date so that
                                                // non-ISO hints (fiscal-year ranges, quarters,
                                                // calendar years, month-years) pre-fill the picker
                                                // instead of leaving it on "No date selected".
                                                // Fall back to parsing the raw hint as ISO for
                                                // single-date hints, then null when neither yields
                                                // a date (true non-date hints like invoice numbers).
                                                const parsedHintDateRaw =
                                                  sibling.screeningParsedPeriodHintDate ?? null;
                                                const parsedDate = (() => {
                                                  if (parsedHintDateRaw) {
                                                    try {
                                                      const d = parseISO(parsedHintDateRaw);
                                                      if (isValid(d)) return d;
                                                    } catch {
                                                      /* fall through */
                                                    }
                                                  }
                                                  if (rawHint) {
                                                    try {
                                                      const d = parseISO(rawHint);
                                                      if (isValid(d)) return d;
                                                    } catch {
                                                      /* fall through */
                                                    }
                                                  }
                                                  return null;
                                                })();
                                                const isNonDateHint = rawHint !== null && parsedDate === null;
                                                const periodDisabled = sibSortingIsAccepted || setPeriodHint.isPending;
                                                return (
                                                  <div
                                                    className="rounded-md border border-border bg-background/60 p-3 space-y-2"
                                                    data-testid={`sorting-period-section-${sibling.id}`}
                                                  >
                                                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                      <CalendarIcon className="h-3.5 w-3.5" />
                                                      {isFr ? 'Période' : 'Period'}
                                                      {sibling.screeningPeriodHintManualOverride && (
                                                        <Badge
                                                          variant="outline"
                                                          className="ml-1 shrink-0 border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 normal-case"
                                                          title={
                                                            isFr
                                                              ? "Période corrigée manuellement par un administrateur (au lieu de la valeur détectée par l'IA)."
                                                              : 'Period manually overridden by an admin (instead of the AI-detected value).'
                                                          }
                                                          data-testid={`sorting-period-hint-manual-${sibling.id}`}
                                                        >
                                                          {isFr ? 'Manuel' : 'Manual'}
                                                        </Badge>
                                                      )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <StandaloneDatePicker
                                                        value={parsedDate}
                                                        onChange={(date) => {
                                                          const newHint = date ? format(date, 'yyyy-MM-dd') : null;
                                                          setPeriodHint.mutate({
                                                            itemId: sibling.id,
                                                            periodHint: newHint,
                                                          });
                                                        }}
                                                        placeholder={isFr ? 'Aucune date sélectionnée' : 'No date selected'}
                                                        disabled={periodDisabled}
                                                        className="flex-1"
                                                        data-testid={`sorting-period-date-picker-${sibling.id}`}
                                                      />
                                                      {rawHint !== null && (
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          disabled={periodDisabled}
                                                          className="shrink-0 text-xs text-muted-foreground"
                                                          data-testid={`sorting-period-clear-${sibling.id}`}
                                                          onClick={() => {
                                                            if (periodDisabled) return;
                                                            setPeriodHint.mutate({
                                                              itemId: sibling.id,
                                                              periodHint: null,
                                                            });
                                                          }}
                                                        >
                                                          <X className="mr-1 h-3 w-3" />
                                                          {isFr ? 'Effacer' : 'Clear'}
                                                        </Button>
                                                      )}
                                                    </div>
                                                    {isNonDateHint && (
                                                      <p className="text-xs text-muted-foreground">
                                                        <span className="font-medium">
                                                          {isFr ? "Indice de l'IA :" : 'AI hint:'}
                                                        </span>{' '}
                                                        {rawHint}
                                                      </p>
                                                    )}
                                                    {sibSortingIsAccepted && (
                                                      <p className="text-xs text-muted-foreground">
                                                        {isFr
                                                          ? 'La décision de tri est acceptée — réinitialisez-la avant de modifier la période.'
                                                          : 'Sorting decision is accepted — reset it before changing the period.'}
                                                      </p>
                                                    )}
                                                  </div>
                                                );
                                              })()}

                                              {/* Confidence + reason row */}
                                              <div className="space-y-2">
                                                <div className="flex flex-wrap gap-2">
                                                  {sibDecision?.confidence != null && (
                                                    <span
                                                      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1 text-sm font-medium"
                                                      data-testid={`detail-confidence-${sibling.id}`}
                                                    >
                                                      <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                                                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                                        {isFr ? 'Confiance' : 'Confidence'}:
                                                      </span>
                                                      {Math.round(sibDecision.confidence * 100)}%
                                                    </span>
                                                  )}
                                                </div>
                                                {sibDecision?.reason && (
                                                  <p
                                                    className="whitespace-pre-wrap text-sm text-foreground/80"
                                                    data-testid={`detail-reason-${sibling.id}`}
                                                  >
                                                    <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                      {isFr ? 'Raison' : 'Reason'}:
                                                    </span>
                                                    {sibDecision.reason}
                                                  </p>
                                                )}
                                                {sibDecision?.fallbackReason && (
                                                  <div
                                                    className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                                    data-testid={`detail-fallback-explanation-${sibling.id}`}
                                                  >
                                                    <p className="font-medium">
                                                      {(isFr ? FALLBACK_REASON_LABELS.fr : FALLBACK_REASON_LABELS.en)[sibDecision.fallbackReason]}
                                                    </p>
                                                    <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                                                      {(isFr ? FALLBACK_REASON_EXPLANATIONS.fr : FALLBACK_REASON_EXPLANATIONS.en)[sibDecision.fallbackReason]}
                                                    </p>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            >
                            <div className="flex items-center gap-3 p-3 flex-wrap">
                            {hasAnalysis && !(currentStep === 'sorting' && (sortingIsPending || sortingIsRejected || isDraftSplitLead || _mergeGroupAnyNonAccepted)) ? (
                              <button
                                type="button"
                                onClick={() => toggleItemExpanded(item.id)}
                                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-expanded={isExpanded}
                                aria-label={
                                  isExpanded
                                    ? isFr
                                      ? 'Masquer les détails'
                                      : 'Hide details'
                                    : isFr
                                      ? 'Afficher les détails'
                                      : 'Show details'
                                }
                                title={
                                  isExpanded
                                    ? isFr
                                      ? 'Masquer les détails'
                                      : 'Hide details'
                                    : isFr
                                      ? 'Afficher les détails'
                                      : 'Show details'
                                }
                                data-testid={`button-toggle-detail-${item.id}`}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            ) : (
                              <span className="h-7 w-7 flex-shrink-0" aria-hidden="true" />
                            )}
                            <div
                              className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer rounded hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              role="button"
                              tabIndex={0}
                              data-testid={`item-preview-trigger-${item.id}`}
                              onClick={() => setPreviewItem({ id: item.id, originalName: item.originalName, mimeType: item.mimeType })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setPreviewItem({ id: item.id, originalName: item.originalName, mimeType: item.mimeType });
                                }
                              }}
                            >
                              <ItemThumbnail item={item} />
                              <div className="min-w-0 flex flex-col">
                                <span
                                  className={`truncate font-medium ${
                                    isExcluded
                                      ? 'text-muted-foreground line-through'
                                      : ''
                                  }`}
                                  data-testid={`item-name-${item.id}`}
                                >
                                  {item.originalName}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {item.status}
                                  {item.mimeType ? ` · ${item.mimeType}` : ''}
                                </span>
                              </div>
                            </div>
                            {currentStep !== 'sorting' && (
                              <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                {showRetry && retryAction && !(currentStep === 'identification' && item.identificationEffectiveDateManualOverride) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      runStep.mutate({
                                        itemId: item.id,
                                        action: retryAction,
                                      })
                                    }
                                    disabled={retryPending}
                                    data-testid={`button-retry-${currentStep}-${item.id}`}
                                  >
                                    {retryPending ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <RotateCw className="mr-2 h-4 w-4" />
                                    )}
                                    {isFr ? 'Réessayer' : 'Retry'}
                                  </Button>
                                )}
                                {!isExcluded &&
                                  currentStep === 'linking' &&
                                  item.status === 'linked' && (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() =>
                                        runStep.mutate({
                                          itemId: item.id,
                                          action: 'commit',
                                        })
                                      }
                                      data-testid={`button-commit-${item.id}`}
                                    >
                                      {isFr ? 'Sauvegarder' : 'Commit'}
                                    </Button>
                                  )}
                                {canToggleExclude && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      toggleExclude.mutate({
                                        itemId: item.id,
                                        excluded: !isExcluded,
                                      })
                                    }
                                    disabled={togglePending}
                                    aria-pressed={isExcluded}
                                    aria-label={
                                      isExcluded
                                        ? isFr
                                          ? 'Réinclure le fichier'
                                          : 'Re-include file'
                                        : isFr
                                          ? 'Exclure le fichier'
                                          : 'Exclude file'
                                    }
                                    title={
                                      isExcluded
                                        ? isFr
                                          ? 'Réinclure'
                                          : 'Re-include'
                                        : isFr
                                          ? 'Exclure'
                                          : 'Exclude'
                                    }
                                    data-testid={`button-toggle-exclude-${item.id}`}
                                  >
                                    {togglePending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : isExcluded ? (
                                      <Eye className="h-4 w-4" />
                                    ) : (
                                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-3 flex-wrap w-full pl-10" onClick={(e) => e.stopPropagation()}>
                              {isExcluded && (
                                <Badge
                                  variant="outline"
                                  className="border-amber-300 bg-amber-50 text-amber-900"
                                  data-testid={`badge-excluded-${item.id}`}
                                >
                                  {item.excludeSource === 'prior_session'
                                    ? (isFr ? 'Exclu précédemment' : 'Previously excluded')
                                    : (isFr ? 'Exclu' : 'Excluded')}
                                </Badge>
                              )}
                              {!isExcluded &&
                                currentStep === 'screening' &&
                                (item.status === 'pending' ||
                                  item.status === 'screening') && (
                                  <Loader2
                                    className="h-4 w-4 animate-spin text-muted-foreground"
                                    data-testid={`screening-spinner-${item.id}`}
                                  />
                                )}
                              {!isExcluded && (
                                <>
                                  {currentStep === 'sorting' && decision?.decision && !sortingIsPending && !sortingIsRejected && (
                                    <Badge
                                      variant="outline"
                                      className={`shrink-0 ${
                                        sortingIsAccepted
                                          ? 'border-green-300 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-200'
                                          : 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200'
                                      }`}
                                      title={(() => {
                                        const base = decision.reason ?? '';
                                        if (decision.decision === 'merge' && decision.mergeWithItemId) {
                                          const sibling = items.find((i) => i.id === decision.mergeWithItemId);
                                          const siblingName = sibling?.originalName ?? decision.mergeWithItemId;
                                          return isFr
                                            ? `${base}${base ? ' · ' : ''}Fusionner avec : ${siblingName}`
                                            : `${base}${base ? ' · ' : ''}Merge with: ${siblingName}`;
                                        }
                                        if (decision.decision === 'split' && decision.splitAtPage) {
                                          return isFr
                                            ? `${base}${base ? ' · ' : ''}Scinder à la page ${decision.splitAtPage}`
                                            : `${base}${base ? ' · ' : ''}Split at page ${decision.splitAtPage}`;
                                        }
                                        return base || undefined;
                                      })()}
                                      data-testid={`sorting-decision-${item.id}`}
                                    >
                                      {decision.decision === 'keep'
                                        ? isFr ? 'Conserver' : 'Keep'
                                        : decision.decision === 'merge'
                                        ? `${isFr ? 'Fusionner' : 'Merge'}${mergeGroupCountSuffix}`
                                        : isFr ? 'Scinder' : 'Split'}
                                    </Badge>
                                  )}
                                  {currentStep === 'sorting' && item.sortingManualOverride && sortingIsAccepted && (
                                    <Badge
                                      variant="outline"
                                      className="shrink-0 border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                                      data-testid={`sorting-manual-tag-${item.id}`}
                                    >
                                      {isFr ? 'Manuel' : 'Manual'}
                                    </Badge>
                                  )}
                                  {currentStep === 'sorting' && sortingIsPending && (
                                    <Badge
                                      variant="outline"
                                      className="shrink-0 border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
                                      data-testid={`sorting-pending-badge-${item.id}`}
                                    >
                                      {`${isFr ? 'En attente' : 'Pending review'}${mergeGroupCountSuffix}`}
                                    </Badge>
                                  )}
                                  {currentStep === 'sorting' && sortingIsRejected && (
                                    <Badge
                                      variant="outline"
                                      className="shrink-0 border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
                                      data-testid={`sorting-rejected-badge-${item.id}`}
                                    >
                                      {isFr ? 'Rejeté – choix requis' : 'Rejected – choose manually'}
                                    </Badge>
                                  )}
                                  {currentStep === 'screening' && item.screeningTypeGuess && item.screeningTypeGuess !== 'unknown' && (
                                    <Badge
                                      variant="outline"
                                      className="shrink-0 border-purple-300 bg-purple-50 text-purple-900 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-200"
                                      title={item.screeningQaReason ?? undefined}
                                      data-testid={`screening-type-guess-${item.id}`}
                                    >
                                      {(isFr ? TYPE_GUESS_LABEL_FR : TYPE_GUESS_LABEL_EN)[item.screeningTypeGuess] ?? item.screeningTypeGuess}
                                    </Badge>
                                  )}
                                  {currentStep === 'screening' &&
                                    item.screeningRotationApplied &&
                                    item.screeningRotationDegrees !== 0 && (
                                      <Badge
                                        variant="outline"
                                        className="shrink-0 border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200"
                                        title={
                                          isFr
                                            ? `Le fichier était orienté de côté. Il a été corrigé sur place de ${item.screeningRotationDegrees}° dans le sens horaire pour que les étapes suivantes le lisent à l'endroit.`
                                            : `The file was sideways. It was corrected in place by rotating ${item.screeningRotationDegrees}° clockwise so later steps read it upright.`
                                        }
                                        data-testid={`screening-rotation-${item.id}`}
                                      >
                                        <RotateCw className="mr-1 h-3 w-3" />
                                        {isFr
                                          ? `Pivoté ${item.screeningRotationDegrees}°`
                                          : `Rotated ${item.screeningRotationDegrees}°`}
                                      </Badge>
                                    )}
                                  {currentStep === 'screening' && item.screeningBucketGuess && item.screeningBucketGuess !== 'unknown' && (
                                    <Badge
                                      variant="outline"
                                      className="shrink-0 border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-700 dark:bg-teal-950 dark:text-teal-200"
                                      title={item.screeningQaReason ?? undefined}
                                      data-testid={`screening-bucket-guess-${item.id}`}
                                    >
                                      {(isFr ? BUCKET_GUESS_LABEL_FR : BUCKET_GUESS_LABEL_EN)[item.screeningBucketGuess] ?? item.screeningBucketGuess}
                                    </Badge>
                                  )}
                                  {currentStep === 'screening' && item.screeningPeriodHint && (
                                    <Badge
                                      variant="outline"
                                      className="shrink-0 border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"
                                      title={
                                        isFr
                                          ? "Période détectée par l'IA lors du filtrage (année, exercice, n° de facture, date de réunion). Utilisée pour distinguer deux documents du même type."
                                          : 'Period detected by the Screening AI (year, fiscal year, invoice number, meeting date). Used to tell two same-type documents apart.'
                                      }
                                      data-testid={`screening-period-hint-${item.id}`}
                                    >
                                      {item.screeningPeriodHint}
                                    </Badge>
                                  )}
                                  {currentStep !== 'sorting' &&
                                    !(currentStep === 'identification' && item.identificationEffectiveDateManualOverride) && (
                                    <>
                                      <FallbackReasonBadge
                                        reason={decision?.fallbackReason}
                                        isFr={isFr}
                                      />
                                      <ConfidenceBadge
                                        value={decision?.confidence}
                                        fallbackReason={decision?.fallbackReason}
                                        isFr={isFr}
                                      />
                                      {decision?.fallbackReason && (
                                        <span
                                          className="text-xs text-muted-foreground italic"
                                          data-testid={`hint-review-or-exclude-${item.id}`}
                                        >
                                          {isFr ? 'Vérifiez ce fichier ou excluez-le' : 'Review or exclude this file'}
                                        </span>
                                      )}
                                    </>
                                  )}
                                  {currentStep === 'identification' && (() => {
                                    // Inline effective-date editor (Task #1031). The
                                    // input is always visible on the identification row
                                    // so admins can tell at a glance which date is
                                    // queued for commit. It pre-fills with
                                    //   1. the admin's pending edit (if any), then
                                    //   2. identification.effectiveDate (AI or admin), then
                                    //   3. the parsed periodHint date from screening.
                                    // The "from screening" annotation only shows when
                                    // the field is empty AND the parsed periodHint is
                                    // the actual fallback — it's hidden once an admin
                                    // has typed a value of their own (manual override)
                                    // so the chip doesn't lie about the source.
                                    const pending = editingEffectiveDate.get(item.id);
                                    const fallback =
                                      item.identificationEffectiveDate
                                      ?? item.screeningParsedPeriodHintDate
                                      ?? '';
                                    const value = pending !== undefined ? pending : fallback;
                                    const trimmed = value.trim();
                                    // What the server currently has — used to drive
                                    // the Save button's enabled/disabled state.
                                    const serverValue = item.identificationEffectiveDate ?? '';
                                    const dirty = trimmed !== serverValue;
                                    // The "from screening" chip shows whenever the
                                    // current input value comes from the screening
                                    // AI periodHint — whether or not the date has
                                    // already been persisted (e.g. by auto-apply).
                                    // It hides once the admin types a different value
                                    // (trimmed ≠ hint) or sets a manual override.
                                    const showFromScreening =
                                      !item.identificationEffectiveDateManualOverride
                                      && !!item.screeningParsedPeriodHintDate
                                      && trimmed === (item.screeningParsedPeriodHintDate ?? '');
                                    return (
                                      <div
                                        className="flex items-center gap-1"
                                        data-testid={`identification-effective-date-editor-${item.id}`}
                                      >
                                        <Input
                                          type="date"
                                          value={value}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            setEditingEffectiveDate((prev) => {
                                              const next = new Map(prev);
                                              next.set(item.id, v);
                                              return next;
                                            });
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              if (!dirty || setEffectiveDate.isPending) return;
                                              setEffectiveDate.mutate({
                                                itemId: item.id,
                                                effectiveDate: trimmed.length > 0 ? trimmed : null,
                                              });
                                            }
                                          }}
                                          disabled={setEffectiveDate.isPending}
                                          className="h-7 w-40 text-xs"
                                          aria-label={
                                            isFr ? 'Date d’effet' : 'Effective date'
                                          }
                                          data-testid={`identification-effective-date-input-${item.id}`}
                                        />
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2"
                                          onClick={() => {
                                            setEffectiveDate.mutate({
                                              itemId: item.id,
                                              effectiveDate: trimmed.length > 0 ? trimmed : null,
                                            });
                                          }}
                                          disabled={!dirty || setEffectiveDate.isPending}
                                          data-testid={`identification-effective-date-save-${item.id}`}
                                          aria-label={isFr ? 'Enregistrer la date' : 'Save date'}
                                          title={
                                            isFr
                                              ? 'Enregistrer la date d’effet'
                                              : 'Save effective date'
                                          }
                                        >
                                          {setEffectiveDate.isPending
                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                            : <Check className="h-3 w-3" />}
                                        </Button>
                                        {showFromScreening && (
                                          <Badge
                                            variant="outline"
                                            className="shrink-0 border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200"
                                            title={
                                              isFr
                                                ? `Date issue du filtrage IA (${item.screeningPeriodHint}). Modifiez le champ pour la remplacer.`
                                                : `Date from screening AI (${item.screeningPeriodHint}). Edit the field to override it.`
                                            }
                                            data-testid={`identification-period-hint-date-${item.id}`}
                                          >
                                            {isFr ? '(filtrage)' : '(from screening)'}
                                          </Badge>
                                        )}
                                        {item.identificationEffectiveDateManualOverride && (
                                          <Badge
                                            variant="outline"
                                            className="shrink-0 border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                                            title={
                                              isFr
                                                ? "Date saisie manuellement par un administrateur (au lieu de la valeur détectée par l'IA)."
                                                : 'Date manually entered by an admin (instead of the AI-detected value).'
                                            }
                                            data-testid={`identification-effective-date-manual-${item.id}`}
                                          >
                                            {isFr ? 'Manuel' : 'Manual'}
                                          </Badge>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  {currentStep === 'identification' && (
                                    <IdentificationTagEditor
                                      item={item}
                                      isFr={isFr}
                                      saveStatus={tagSaveStatus.get(item.id) ?? 'idle'}
                                      onSave={(itemId, tagIds) => {
                                        setItemTags.mutate({ itemId, tagIds });
                                      }}
                                    />
                                  )}
                                  {currentStep === 'sorting' && !isExcluded && sortingIsPending && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300"
                                        disabled={sortingMutationPending}
                                        data-testid={`button-sorting-accept-${item.id}`}
                                        onClick={() => {
                                          cancelAutoSave(item.id);
                                          const inlineSlice = inlineSlicePage.get(item.id);
                                          const inlineMerge = inlineMergeOrder.get(item.id);
                                          if (inlineSlice !== undefined) {
                                            setSortingDecision.mutate({ itemId: item.id, action: 'manual', decision: 'split', splitAtPage: inlineSlice });
                                          } else if (inlineMerge !== undefined) {
                                            setSortingDecision.mutate({ itemId: item.id, action: 'manual', decision: 'merge', mergeWithItemIds: inlineMerge.slice(1) });
                                          } else {
                                            setSortingDecision.mutate({ itemId: item.id, action: 'accept' });
                                          }
                                        }}
                                      >
                                        {sortingMutationPending ? (
                                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Check className="mr-1.5 h-3.5 w-3.5" />
                                        )}
                                        {isFr ? 'Accepter' : 'Accept'}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300"
                                        disabled={sortingMutationPending}
                                        data-testid={`button-sorting-reject-${item.id}`}
                                        onClick={() => {
                                          // Pre-initialise the picker from the AI suggestion so it
                                          // appears immediately when the row transitions to 'rejected'.
                                          const d = (item.sortingDecision ?? 'keep') as 'keep' | 'merge' | 'split';
                                          setSortingPickerStates((prev) => {
                                            const next = new Map(prev);
                                            next.set(item.id, {
                                              decision: d,
                                              mergeTargetId: d === 'merge' ? (item.sortingMergeWithItemId ?? '') : '',
                                              splitPage: d === 'split' ? (item.sortingSplitAtPage ?? 1) : 1,
                                            });
                                            return next;
                                          });
                                          cancelAutoSave(item.id);
                                          setSortingDecision.mutate({ itemId: item.id, action: 'reject' });
                                        }}
                                      >
                                        <X className="mr-1.5 h-3.5 w-3.5" />
                                        {isFr ? 'Rejeter' : 'Reject'}
                                      </Button>
                                    </>
                                  )}
                                </>
                              )}
                              {currentStep === 'sorting' && showRetry && retryAction && !item.sortingManualOverride && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    runStep.mutate({
                                      itemId: item.id,
                                      action: retryAction,
                                    })
                                  }
                                  disabled={retryPending}
                                  data-testid={`button-retry-${currentStep}-${item.id}`}
                                >
                                  {retryPending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <RotateCw className="mr-2 h-4 w-4" />
                                  )}
                                  {isFr ? 'Réessayer' : 'Retry'}
                                </Button>
                              )}
                              {currentStep === 'sorting' && canToggleExclude && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    toggleExclude.mutate({
                                      itemId: item.id,
                                      excluded: !isExcluded,
                                    })
                                  }
                                  disabled={togglePending}
                                  aria-pressed={isExcluded}
                                  aria-label={
                                    isExcluded
                                      ? isFr
                                        ? 'Réinclure le fichier'
                                        : 'Re-include file'
                                      : isFr
                                        ? 'Exclure le fichier'
                                        : 'Exclude file'
                                  }
                                  title={
                                    isExcluded
                                      ? isFr
                                        ? 'Réinclure'
                                        : 'Re-include'
                                      : isFr
                                        ? 'Exclure'
                                        : 'Exclude'
                                  }
                                  data-testid={`button-toggle-exclude-${item.id}`}
                                >
                                  {togglePending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : isExcluded ? (
                                    <Eye className="h-4 w-4" />
                                  ) : (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </Button>
                              )}
                            </div>
                            </div>
                            {/* Inline PDF-corruption error banner (Task #1036).
                                Surfaces classified set-sorting-decision 400s
                                (MERGE_PDF_COPY_FAILED, MERGE_LEAD_PDF_CORRUPT,
                                PDF_PAGE_TREE_UNRECOVERABLE, MERGE_PDF_SAVE_FAILED)
                                next to the offending file so the admin knows
                                which one to replace or split manually. */}
                            {(() => {
                              const itemError = sortingDecisionErrors.get(item.id);
                              if (!itemError) return null;
                              const isReplacingThisItem =
                                replaceFile.isPending &&
                                replaceFile.variables?.itemId === item.id;
                              return (
                                <div
                                  className="mx-3 mb-3 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
                                  role="alert"
                                  data-testid={`sorting-decision-error-${item.id}`}
                                  data-error-code={itemError.code}
                                >
                                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium leading-tight">
                                      {itemError.title}
                                    </p>
                                    <p className="mt-1 leading-snug">
                                      {itemError.description}
                                    </p>
                                    {/* Task #1051 — One-click recovery: open the
                                        existing replace-file flow scoped to this
                                        item so the admin doesn't have to leave
                                        the wizard, find the source upload, and
                                        delete/re-add it manually. */}
                                    <div className="mt-2">
                                      <input
                                        ref={(el) => {
                                          replaceFileInputRefs.current.set(item.id, el);
                                        }}
                                        type="file"
                                        className="hidden"
                                        data-testid={`sorting-decision-error-replace-input-${item.id}`}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          // Reset the input synchronously so picking the
                                          // same filename again still fires onChange.
                                          e.target.value = '';
                                          if (file) {
                                            replaceFile.mutate({ itemId: item.id, file });
                                          }
                                        }}
                                      />
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="border-red-300 bg-white text-red-800 hover:bg-red-100 hover:text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900"
                                        disabled={isReplacingThisItem}
                                        onClick={() =>
                                          replaceFileInputRefs.current.get(item.id)?.click()
                                        }
                                        data-testid={`sorting-decision-error-replace-${item.id}`}
                                      >
                                        {isReplacingThisItem ? (
                                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Upload className="mr-1.5 h-3.5 w-3.5" />
                                        )}
                                        {isFr ? 'Téléverser à nouveau' : 'Replace file'}
                                      </Button>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSortingDecisionErrors((prev) => {
                                        if (!prev.has(item.id)) return prev;
                                        const next = new Map(prev);
                                        next.delete(item.id);
                                        return next;
                                      })
                                    }
                                    className="shrink-0 rounded p-0.5 text-red-700 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-red-200 dark:hover:bg-red-900"
                                    aria-label={isFr ? 'Fermer' : 'Dismiss'}
                                    title={isFr ? 'Fermer' : 'Dismiss'}
                                    data-testid={`sorting-decision-error-dismiss-${item.id}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              );
                            })()}
                            {/* Manual picker – always visible when the row
                                is in the 'rejected' state so the admin can
                                immediately switch to Keep / Merge / Slice
                                without a separate "Choose manually" click. */}
                            {currentStep === 'sorting' && sortingIsRejected && !isExcluded && (
                              <div
                                className="border-t bg-muted/30 px-3 py-3"
                                data-testid={`sorting-manual-picker-${item.id}`}
                              >
                                <p className="mb-3 text-sm font-medium">
                                  {isFr ? 'Décision manuelle' : 'Manual decision'}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {(['keep', 'merge', 'split'] as const).map((opt) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                        pickerDecision === opt
                                          ? 'border-primary bg-primary text-primary-foreground'
                                          : 'border-border bg-background hover:bg-muted/50'
                                      }`}
                                      onClick={() => {
                                        setSortingPickerStates((prev) => {
                                          const cur = prev.get(item.id) ?? { decision: 'keep' as const, mergeTargetId: '', splitPage: 1 };
                                          return new Map(prev).set(item.id, { ...cur, decision: opt });
                                        });
                                        if (opt === 'keep') {
                                          scheduleAutoSave(item, 'keep');
                                        } else if (opt === 'split') {
                                          scheduleAutoSave(item, 'split', undefined, pickerSplitPage);
                                        } else if (opt === 'merge') {
                                          scheduleAutoSave(item, 'merge', pickerMergeTargetId ? [pickerMergeTargetId] : undefined);
                                        }
                                      }}
                                      data-testid={`sorting-picker-option-${opt}-${item.id}`}
                                    >
                                      {opt === 'keep' && <Copy className="h-3.5 w-3.5" />}
                                      {opt === 'merge' && <GitMerge className="h-3.5 w-3.5" />}
                                      {opt === 'split' && <Scissors className="h-3.5 w-3.5" />}
                                      {opt === 'keep'
                                        ? isFr ? 'Conserver' : 'Keep'
                                        : opt === 'merge'
                                        ? isFr ? 'Fusionner' : 'Merge'
                                        : isFr ? 'Scinder' : 'Split'}
                                    </button>
                                  ))}
                                </div>
                                {pickerDecision === 'merge' && (
                                  <div className="mt-3 flex items-center gap-2">
                                    <label className="text-sm text-muted-foreground whitespace-nowrap">
                                      {isFr ? 'Fusionner avec :' : 'Merge with:'}
                                    </label>
                                    <select
                                      className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                      value={pickerMergeTargetId}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setSortingPickerStates((prev) => {
                                          const cur = prev.get(item.id) ?? { decision: 'merge' as const, mergeTargetId: '', splitPage: 1 };
                                          return new Map(prev).set(item.id, { ...cur, mergeTargetId: val });
                                        });
                                        if (val) {
                                          scheduleAutoSave(item, 'merge', [val]);
                                        }
                                      }}
                                      data-testid={`sorting-picker-merge-target-${item.id}`}
                                    >
                                      <option value="">
                                        {isFr ? '— Sélectionner un fichier —' : '— Select a file —'}
                                      </option>
                                      {items
                                        .filter((i) => i.id !== item.id && i.status !== 'rejected')
                                        .map((i) => (
                                          <option key={i.id} value={i.id}>
                                            {i.originalName}
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                )}
                                {pickerDecision === 'split' && (
                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <label className="text-sm text-muted-foreground whitespace-nowrap">
                                      {isFr ? 'Scinder après la page :' : 'Split after page:'}
                                    </label>
                                    <SplitPageManualInput
                                      itemId={item.id}
                                      isPdf={
                                        (item.mimeType ?? '').toLowerCase() === 'application/pdf'
                                      }
                                      splitPage={pickerSplitPage}
                                      onChange={(page) => {
                                        setSortingPickerStates((prev) => {
                                          const cur = prev.get(item.id) ?? { decision: 'split' as const, mergeTargetId: '', splitPage: 1 };
                                          return new Map(prev).set(item.id, { ...cur, splitPage: page });
                                        });
                                        scheduleAutoSave(item, 'split', undefined, page);
                                      }}
                                      isFr={isFr}
                                    />
                                  </div>
                                )}
                                <div className="mt-4 flex gap-2">
                                  <Button
                                    size="sm"
                                    disabled={
                                      sortingMutationPending ||
                                      (pickerDecision === 'merge' && !pickerMergeTargetId)
                                    }
                                    data-testid={`button-sorting-confirm-${item.id}`}
                                    onClick={() => {
                                      cancelAutoSave(item.id);
                                      setSortingDecision.mutate({
                                        itemId: item.id,
                                        action: 'manual',
                                        decision: pickerDecision,
                                        mergeWithItemId:
                                          pickerDecision === 'merge'
                                            ? pickerMergeTargetId
                                            : undefined,
                                        splitAtPage:
                                          pickerDecision === 'split'
                                            ? pickerSplitPage
                                            : undefined,
                                      });
                                    }}
                                  >
                                    {sortingMutationPending ? (
                                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    ) : null}
                                    {isFr ? 'Confirmer' : 'Confirm'}
                                  </Button>
                                </div>
                              </div>
                            )}
                            {hasAnalysis && isExpanded && (
                              <div
                                className="border-t bg-muted/30 px-3 py-3"
                                data-testid={`item-detail-panel-${item.id}`}
                              >
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {isFr ? 'Analyse de l’IA' : 'AI analysis'}
                                </div>
                                {currentStep === 'sorting' ? (
                                  (() => {
                                    const itemIsPdf = (item.mimeType ?? '').toLowerCase() === 'application/pdf';
                                    const currentDecision = item.sortingDecision;
                                    const currentSplitAtPage = item.sortingSplitAtPage;
                                    const inlineSlice = inlineSlicePage.get(item.id);
                                    const showSliceSection = (currentDecision === 'split' || inlineSlice !== undefined) && !sortingIsRejected;
                                    const showMergeSection = (currentDecision === 'merge' || inlineMergeOrder.has(item.id));
                                    const effectiveSlicePage = inlineSlice ?? currentSplitAtPage ?? 1;
                                    const mergeGroupIds = inlineMergeOrder.get(item.id) ?? computeMergeGroup(items, item.id);
                                    // For merge groups all rename state is keyed to the GROUP LEAD so
                                    // siblings and the lead share a single controlled value.
                                    const mergeLeadId = currentDecision === 'merge' ? (mergeGroupIds[0] ?? item.id) : item.id;
                                    const leadItem = currentDecision === 'merge'
                                      ? (items.find((i) => i.id === mergeLeadId) ?? item)
                                      : item;
                                    // Rename sub-section computed values.
                                    // For merge groups, derive stem/ext from the LEAD item so all
                                    // sibling cards show the same shared filename defaults.
                                    const renameSourceItem = currentDecision === 'merge' ? leadItem : item;
                                    const fileExt = renameSourceItem.originalName.replace(/^[^.]*(\..+)?$/, '$1') || '';
                                    const renameStem = renameSourceItem.originalName.replace(/\.[^.]+$/, '');
                                    const saveStatusVal = autoSaveStatus.get(mergeLeadId);
                                    const renameTestId = currentDecision === 'merge'
                                      ? `branching-rename-merge-${mergeLeadId}`
                                      : `branching-rename-${item.id}`;
                                    // Read-only AI suggestion summary for rejected items
                                    // (Task #1034). Mirrors the merge-group sibling
                                    // version above so solo (non-merge-group) rejected
                                    // rows also show what the AI originally proposed
                                    // even though the interactive slice/merge sections
                                    // are owned by the manual picker.
                                    //
                                    // Gated on !sortingDecisionDraft so the card only
                                    // renders while item.sortingDecision still reflects
                                    // the AI's original guess (auto-saved manual drafts
                                    // overwrite that field, in which case we hide the
                                    // card rather than mislabel the draft as an "AI
                                    // suggestion").
                                    const aiSuggestedDecision = item.sortingDecision;
                                    const showAiSuggestion =
                                      sortingIsRejected &&
                                      !item.sortingDecisionDraft &&
                                      (aiSuggestedDecision === 'split' || aiSuggestedDecision === 'merge');
                                    const aiSuggestedSplitPage = item.sortingSplitAtPage ?? 1;
                                    const aiSuggestedMergePartnerNames =
                                      aiSuggestedDecision === 'merge'
                                        ? computeMergeGroup(items, item.id)
                                            .filter((id) => id !== item.id)
                                            .map((id) => items.find((i) => i.id === id)?.originalName ?? id)
                                        : [];
                                    const aiSuggestedConfidence = item.sortingConfidence;
                                    const aiSuggestedConfidencePct =
                                      typeof aiSuggestedConfidence === 'number' && Number.isFinite(aiSuggestedConfidence)
                                        ? Math.round(aiSuggestedConfidence * 100)
                                        : null;
                                    return (
                                      <div className="space-y-4">
                                        {/* --- AI SUGGESTION read-only summary (rejected items only) --- */}
                                        {showAiSuggestion && (
                                          <div
                                            className="rounded-md border border-border bg-background/60 p-3 space-y-1"
                                            data-testid={`branching-ai-suggestion-${item.id}`}
                                          >
                                            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                              <Sparkles className="h-3.5 w-3.5" />
                                              {isFr ? 'Suggestion de l\'IA' : 'AI suggestion'}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                              {aiSuggestedDecision === 'split'
                                                ? (isFr
                                                    ? `Découpage après la page ${aiSuggestedSplitPage}`
                                                    : `Split after page ${aiSuggestedSplitPage}`)
                                                : aiSuggestedMergePartnerNames.length > 0
                                                  ? (isFr
                                                      ? `Fusion avec : ${aiSuggestedMergePartnerNames.join(', ')}`
                                                      : `Merge with: ${aiSuggestedMergePartnerNames.join(', ')}`)
                                                  : (isFr ? 'Fusion suggérée' : 'Merge suggested')}
                                            </p>
                                            {aiSuggestedConfidencePct != null && (
                                              <p
                                                className="text-xs text-muted-foreground"
                                                data-testid={`branching-ai-suggestion-confidence-${item.id}`}
                                              >
                                                {isFr
                                                  ? `Confiance de l'IA : ${aiSuggestedConfidencePct} %`
                                                  : `AI confidence: ${aiSuggestedConfidencePct}%`}
                                              </p>
                                            )}
                                          </div>
                                        )}
                                        {/* --- SLICE sub-section --- */}
                                        {showSliceSection && (
                                          <div
                                            className="rounded-md border border-border bg-background/60 p-3 space-y-2"
                                            data-testid={`branching-slice-section-${item.id}`}
                                          >
                                            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                              <Scissors className="h-3.5 w-3.5" />
                                              {isFr ? 'Découpage' : 'Slice'}
                                            </div>
                                            {sortingIsAccepted ? (
                                              <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-xs text-muted-foreground">
                                                  {isFr
                                                    ? `Découpé après la page ${effectiveSlicePage}`
                                                    : `Sliced after page ${effectiveSlicePage}`}
                                                </span>
                                                {itemIsPdf && (
                                                  <SplitPagePreview
                                                    itemId={item.id}
                                                    splitPage={effectiveSlicePage}
                                                    isFr={isFr}
                                                  />
                                                )}
                                              </div>
                                            ) : (
                                              <>
                                                <p className="text-xs text-muted-foreground">
                                                  {isFr
                                                    ? 'La page choisie reste dans la première partie ; la page suivante commence la seconde partie.'
                                                    : 'The chosen page stays in part 1; the next page starts part 2.'}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                  <label className="text-sm text-muted-foreground whitespace-nowrap">
                                                    {isFr ? 'Scinder après la page :' : 'Split after page:'}
                                                  </label>
                                                  <SplitPageManualInput
                                                    itemId={item.id}
                                                    isPdf={itemIsPdf}
                                                    splitPage={effectiveSlicePage}
                                                    onChange={(next) => {
                                                      setInlineSlicePage((prev) => new Map(prev).set(item.id, next));
                                                      scheduleAutoSave(item);
                                                    }}
                                                    isFr={isFr}
                                                  />
                                                </div>
                                                {(sortingIsPending || sortingIsRejected) && inlineSlice !== undefined && (
                                                  <div className="mt-2 flex gap-2">
                                                    <Button
                                                      size="sm"
                                                      disabled={sortingMutationPending}
                                                      data-testid={`branching-slice-confirm-${item.id}`}
                                                      onClick={() => {
                                                        cancelAutoSave(item.id);
                                                        setSortingDecision.mutate({
                                                          itemId: item.id,
                                                          action: 'manual',
                                                          decision: 'split',
                                                          splitAtPage: inlineSlice,
                                                        });
                                                      }}
                                                    >
                                                      {sortingMutationPending ? (
                                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                      ) : null}
                                                      {isFr ? 'Confirmer' : 'Confirm'}
                                                    </Button>
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      onClick={() => {
                                                        setInlineSlicePage((prev) => {
                                                          const next = new Map(prev);
                                                          next.delete(item.id);
                                                          return next;
                                                        });
                                                      }}
                                                    >
                                                      {isFr ? 'Annuler' : 'Cancel'}
                                                    </Button>
                                                  </div>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        )}

                                        {/* --- MERGE sub-section --- */}
                                        {showMergeSection && (
                                          <div
                                            className="rounded-md border border-border bg-background/60 p-3 space-y-2"
                                            data-testid={`branching-merge-section-${item.id}`}
                                          >
                                            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                              <GitMerge className="h-3.5 w-3.5" />
                                              {isFr ? 'Fusion' : 'Merge'}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                              {isFr
                                                ? 'Les fichiers seront combinés dans cet ordre en un seul PDF.'
                                                : 'Files will be combined in this order into a single PDF.'}
                                            </p>
                                            {/* Filter out admin-excluded items from the
                                                 merge group display and reorder handlers.
                                                 Handlers must operate on the same filtered
                                                 list the UI shows so indices stay consistent
                                                 (Task #804 regression fix, Task #901). */}
                                            {(() => {
                                              const displayedMergeGroupIds = mergeGroupIds.filter((fileId) => {
                                                const fi = items.find((i) => i.id === fileId);
                                                return !fi || fi.status !== 'rejected';
                                              });
                                              return (
                                            <ol className="space-y-1">
                                              {displayedMergeGroupIds.map((fileId, idx) => {
                                                const fileItem = items.find((i) => i.id === fileId);
                                                const fileName = fileItem?.originalName ?? fileId;
                                                const FileIconComp = iconForMime(fileItem?.mimeType);
                                                const canMoveUp = !sortingIsAccepted && idx > 0;
                                                const canMoveDown = !sortingIsAccepted && idx < displayedMergeGroupIds.length - 1;
                                                return (
                                                  <li
                                                    key={fileId}
                                                    className="flex items-center gap-2"
                                                    data-testid={`branching-merge-row-${item.id}-${idx}`}
                                                  >
                                                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                                                      {idx + 1}
                                                    </span>
                                                    <FileIconComp className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                                                    <span className="min-w-0 flex-1 truncate text-sm">
                                                      {fileName}
                                                      {idx === 0 && (
                                                        <span className="ml-2 text-xs text-muted-foreground">
                                                          ({isFr ? 'principal' : 'lead'})
                                                        </span>
                                                      )}
                                                    </span>
                                                    {!sortingIsAccepted && (
                                                      <div className="flex gap-0.5">
                                                        <button
                                                          type="button"
                                                          disabled={!canMoveUp}
                                                          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted/60 disabled:opacity-40"
                                                          aria-label={isFr ? 'Monter' : 'Move up'}
                                                          title={isFr ? 'Monter' : 'Move up'}
                                                          data-testid={`branching-merge-move-up-${item.id}-${idx}`}
                                                          onClick={() => {
                                                            if (!canMoveUp) return;
                                                            const next = [...displayedMergeGroupIds];
                                                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                                            setInlineMergeOrder((prev) => new Map(prev).set(item.id, next));
                                                            scheduleAutoSave(item);
                                                          }}
                                                        >
                                                          <ChevronUp className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                          type="button"
                                                          disabled={!canMoveDown}
                                                          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted/60 disabled:opacity-40"
                                                          aria-label={isFr ? 'Descendre' : 'Move down'}
                                                          title={isFr ? 'Descendre' : 'Move down'}
                                                          data-testid={`branching-merge-move-down-${item.id}-${idx}`}
                                                          onClick={() => {
                                                            if (!canMoveDown) return;
                                                            const next = [...displayedMergeGroupIds];
                                                            [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                                            setInlineMergeOrder((prev) => new Map(prev).set(item.id, next));
                                                            scheduleAutoSave(item);
                                                          }}
                                                        >
                                                          <ChevronDown className="h-3.5 w-3.5" />
                                                        </button>
                                                      </div>
                                                    )}
                                                  </li>
                                                );
                                              })}
                                            </ol>
                                              );
                                            })()}
                                            {!sortingIsAccepted && itemIsPdf && (() => {
                                              const candidates = items.filter(
                                                (i) =>
                                                  !mergeGroupIds.includes(i.id) &&
                                                  i.id !== item.id &&
                                                  i.status !== 'rejected' &&
                                                  (i.mimeType ?? '').toLowerCase() === 'application/pdf',
                                              );
                                              if (candidates.length === 0) return null;
                                              return (
                                                <div className="flex items-center gap-2">
                                                  <label className="whitespace-nowrap text-xs text-muted-foreground">
                                                    {isFr ? 'Ajouter un fichier :' : 'Add file:'}
                                                  </label>
                                                  <select
                                                    className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                                    value=""
                                                    data-testid={`branching-merge-add-${item.id}`}
                                                    onChange={(e) => {
                                                      const newId = e.target.value;
                                                      if (!newId) return;
                                                      const next = [...mergeGroupIds, newId];
                                                      setInlineMergeOrder((prev) => new Map(prev).set(item.id, next));
                                                      scheduleAutoSave(item);
                                                    }}
                                                  >
                                                    <option value="">
                                                      {isFr ? '— Sélectionner un fichier —' : '— Select a file —'}
                                                    </option>
                                                    {candidates.map((c) => (
                                                      <option key={c.id} value={c.id}>
                                                        {c.originalName}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </div>
                                              );
                                            })()}
                                            {(sortingIsPending || sortingIsRejected) && inlineMergeOrder.has(item.id) && (
                                              <div className="mt-2 flex gap-2">
                                                <Button
                                                  size="sm"
                                                  disabled={sortingMutationPending}
                                                  data-testid={`branching-merge-confirm-${item.id}`}
                                                  onClick={() => {
                                                    const order = inlineMergeOrder.get(item.id)!;
                                                    cancelAutoSave(item.id);
                                                    setSortingDecision.mutate({
                                                      itemId: order[0],
                                                      action: 'manual',
                                                      decision: 'merge',
                                                      mergeWithItemIds: order.slice(1),
                                                    });
                                                  }}
                                                >
                                                  {sortingMutationPending ? (
                                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                  ) : null}
                                                  {isFr ? 'Confirmer l\'ordre' : 'Confirm order'}
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() => {
                                                    setInlineMergeOrder((prev) => {
                                                      const next = new Map(prev);
                                                      next.delete(item.id);
                                                      return next;
                                                    });
                                                  }}
                                                >
                                                  {isFr ? 'Annuler' : 'Cancel'}
                                                </Button>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {/* "Add slice" / "Add merge" buttons for PDF items without a slice/merge decision */}
                                        {!isExcluded && !showSliceSection && !showMergeSection && itemIsPdf && (currentDecision === 'keep' || !currentDecision) && !sortingIsAccepted && (
                                          <div className="flex items-center gap-2">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              data-testid={`branching-slice-add-${item.id}`}
                                              onClick={() => {
                                                const seed = item.sortingSplitAtPage ?? 1;
                                                setInlineSlicePage((prev) => new Map(prev).set(item.id, seed));
                                              }}
                                            >
                                              <Scissors className="mr-1.5 h-3.5 w-3.5" />
                                              {isFr ? 'Ajouter un découpage' : 'Add slice'}
                                            </Button>
                                            {!inlineMergeOrder.has(item.id) && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                data-testid={`branching-merge-add-trigger-${item.id}`}
                                                onClick={() => {
                                                  setInlineMergeOrder((prev) => new Map(prev).set(item.id, [item.id]));
                                                }}
                                              >
                                                <GitMerge className="mr-1.5 h-3.5 w-3.5" />
                                                {isFr ? 'Ajouter une fusion' : 'Add merge'}
                                              </Button>
                                            )}
                                          </div>
                                        )}

                                        {/* --- RENAME sub-section --- */}
                                        {!isExcluded && !sortingIsAccepted && !!currentDecision && (
                                          <div
                                            className="rounded-md border border-border bg-background/60 p-3 space-y-2"
                                            data-testid={`branching-rename-section-${item.id}`}
                                          >
                                            <div className="flex items-center justify-between gap-1.5">
                                              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                <Pencil className="h-3.5 w-3.5" />
                                                {isFr ? 'Renommer' : 'Rename'}
                                              </div>
                                              {saveStatusVal === 'error' ? (
                                                <button
                                                  type="button"
                                                  data-testid={`branching-autosave-status-${mergeLeadId}`}
                                                  className="text-xs text-destructive underline cursor-pointer"
                                                  onClick={() => scheduleAutoSave(leadItem)}
                                                >
                                                  {isFr ? 'Erreur — Réessayer' : 'Failed — Retry'}
                                                </button>
                                              ) : (
                                                <span
                                                  data-testid={`branching-autosave-status-${mergeLeadId}`}
                                                  className="text-xs text-muted-foreground"
                                                >
                                                  {saveStatusVal === 'saving'
                                                    ? (isFr ? 'Enregistrement…' : 'Saving…')
                                                    : saveStatusVal === 'saved'
                                                      ? (isFr ? 'Enregistré' : 'Saved')
                                                      : null}
                                                </span>
                                              )}
                                            </div>
                                            {currentDecision === 'split' ? (
                                              <>
                                                <div className="flex flex-col gap-1">
                                                  <label className="text-xs text-muted-foreground">
                                                    {isFr ? 'Partie 1 :' : 'Part 1:'}
                                                  </label>
                                                  <div className="flex items-center gap-1">
                                                    <input
                                                      type="text"
                                                      className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                                      data-testid={`branching-rename-split-${item.id}-0`}
                                                      value={inlineRenameSplit.get(item.id)?.[0] ?? item.sortingDecisionSplitFinalNames?.[0] ?? ''}
                                                      placeholder={`${renameStem} (1)`}
                                                      onChange={(e) => {
                                                        const part2 = inlineRenameSplit.get(item.id)?.[1] ?? item.sortingDecisionSplitFinalNames?.[1] ?? '';
                                                        setInlineRenameSplit((prev) => new Map(prev).set(item.id, [e.target.value, part2]));
                                                        scheduleAutoSave(item);
                                                      }}
                                                    />
                                                    {fileExt && <span className="text-sm text-muted-foreground shrink-0">{fileExt}</span>}
                                                  </div>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                  <label className="text-xs text-muted-foreground">
                                                    {isFr ? 'Partie 2 :' : 'Part 2:'}
                                                  </label>
                                                  <div className="flex items-center gap-1">
                                                    <input
                                                      type="text"
                                                      className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                                      data-testid={`branching-rename-split-${item.id}-1`}
                                                      value={inlineRenameSplit.get(item.id)?.[1] ?? item.sortingDecisionSplitFinalNames?.[1] ?? ''}
                                                      placeholder={`${renameStem} (2)`}
                                                      onChange={(e) => {
                                                        const part1 = inlineRenameSplit.get(item.id)?.[0] ?? item.sortingDecisionSplitFinalNames?.[0] ?? '';
                                                        setInlineRenameSplit((prev) => new Map(prev).set(item.id, [part1, e.target.value]));
                                                        scheduleAutoSave(item);
                                                      }}
                                                    />
                                                    {fileExt && <span className="text-sm text-muted-foreground shrink-0">{fileExt}</span>}
                                                  </div>
                                                </div>
                                              </>
                                            ) : (
                                              <div className="flex flex-col gap-1">
                                                <label className="text-xs text-muted-foreground">
                                                  {isFr ? 'Nouveau nom :' : 'New name:'}
                                                </label>
                                                <div className="flex items-center gap-1">
                                                  <input
                                                    type="text"
                                                    className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                                    data-testid={renameTestId}
                                                    value={inlineRename.get(mergeLeadId) ?? leadItem.finalFileName ?? ''}
                                                    placeholder={renameStem}
                                                    onChange={(e) => {
                                                      setInlineRename((prev) => new Map(prev).set(mergeLeadId, e.target.value));
                                                      scheduleAutoSave(leadItem, sortingPickerStates.get(item.id)?.decision);
                                                    }}
                                                  />
                                                  {fileExt && <span className="text-sm text-muted-foreground shrink-0">{fileExt}</span>}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {/* --- PERIOD sub-section (sorting step only) --- */}
                                        {!isExcluded && (() => {
                                          const rawHint = item.screeningPeriodHint ?? null;
                                          // Task #1060: prefer the server-parsed date so that
                                          // non-ISO hints (fiscal-year ranges, quarters,
                                          // calendar years, month-years) pre-fill the picker
                                          // instead of leaving it on "No date selected".
                                          // Fall back to parsing the raw hint as ISO for
                                          // single-date hints, then null when neither yields
                                          // a date (true non-date hints like invoice numbers).
                                          const parsedHintDateRaw =
                                            item.screeningParsedPeriodHintDate ?? null;
                                          const parsedDate = (() => {
                                            if (parsedHintDateRaw) {
                                              try {
                                                const d = parseISO(parsedHintDateRaw);
                                                if (isValid(d)) return d;
                                              } catch {
                                                /* fall through */
                                              }
                                            }
                                            if (rawHint) {
                                              try {
                                                const d = parseISO(rawHint);
                                                if (isValid(d)) return d;
                                              } catch {
                                                /* fall through */
                                              }
                                            }
                                            return null;
                                          })();
                                          const isNonDateHint = rawHint !== null && parsedDate === null;
                                          const periodDisabled =
                                            sortingIsAccepted || setPeriodHint.isPending;
                                          return (
                                            <div
                                              className="rounded-md border border-border bg-background/60 p-3 space-y-2"
                                              data-testid={`sorting-period-section-${item.id}`}
                                            >
                                              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                <CalendarIcon className="h-3.5 w-3.5" />
                                                {isFr ? 'Période' : 'Period'}
                                                {item.screeningPeriodHintManualOverride && (
                                                  <Badge
                                                    variant="outline"
                                                    className="ml-1 shrink-0 border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 normal-case"
                                                    title={
                                                      isFr
                                                        ? "Période corrigée manuellement par un administrateur (au lieu de la valeur détectée par l'IA)."
                                                        : 'Period manually overridden by an admin (instead of the AI-detected value).'
                                                    }
                                                    data-testid={`sorting-period-hint-manual-${item.id}`}
                                                  >
                                                    {isFr ? 'Manuel' : 'Manual'}
                                                  </Badge>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <StandaloneDatePicker
                                                  value={parsedDate}
                                                  onChange={(date) => {
                                                    const newHint = date
                                                      ? format(date, 'yyyy-MM-dd')
                                                      : null;
                                                    setPeriodHint.mutate({
                                                      itemId: item.id,
                                                      periodHint: newHint,
                                                    });
                                                  }}
                                                  placeholder={isFr ? 'Aucune date sélectionnée' : 'No date selected'}
                                                  disabled={periodDisabled}
                                                  className="flex-1"
                                                  data-testid={`sorting-period-date-picker-${item.id}`}
                                                />
                                                {rawHint !== null && (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={periodDisabled}
                                                    className="shrink-0 text-xs text-muted-foreground"
                                                    data-testid={`sorting-period-clear-${item.id}`}
                                                    onClick={() => {
                                                      if (periodDisabled) return;
                                                      setPeriodHint.mutate({
                                                        itemId: item.id,
                                                        periodHint: null,
                                                      });
                                                    }}
                                                  >
                                                    <X className="mr-1 h-3 w-3" />
                                                    {isFr ? 'Effacer' : 'Clear'}
                                                  </Button>
                                                )}
                                              </div>
                                              {isNonDateHint && (
                                                <p className="text-xs text-muted-foreground">
                                                  <span className="font-medium">
                                                    {isFr ? "Indice de l'IA :" : 'AI hint:'}
                                                  </span>{' '}
                                                  {rawHint}
                                                </p>
                                              )}
                                              {sortingIsAccepted && (
                                                <p className="text-xs text-muted-foreground">
                                                  {isFr
                                                    ? 'La décision de tri est acceptée — réinitialisez-la avant de modifier la période.'
                                                    : 'Sorting decision is accepted — reset it before changing the period.'}
                                                </p>
                                              )}
                                            </div>
                                          );
                                        })()}

                                        {/* Confidence + reason row */}
                                        <div className="space-y-2">
                                          <div className="flex flex-wrap gap-2">
                                            {decision?.confidence != null && (
                                              <span
                                                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1 text-sm font-medium"
                                                data-testid={`detail-confidence-${item.id}`}
                                              >
                                                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                                  {isFr ? 'Confiance' : 'Confidence'}:
                                                </span>
                                                {Math.round(decision.confidence * 100)}%
                                              </span>
                                            )}
                                          </div>
                                          {decision?.reason && (
                                            <p
                                              className="whitespace-pre-wrap text-sm text-foreground/80"
                                              data-testid={`detail-reason-${item.id}`}
                                            >
                                              <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                {isFr ? 'Raison' : 'Reason'}:
                                              </span>
                                              {decision.reason}
                                            </p>
                                          )}
                                          {decision?.fallbackReason && (
                                            <div
                                              className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                              data-testid={`detail-fallback-explanation-${item.id}`}
                                            >
                                              <p className="font-medium">
                                                {(isFr ? FALLBACK_REASON_LABELS.fr : FALLBACK_REASON_LABELS.en)[decision.fallbackReason]}
                                              </p>
                                              <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                                                {(isFr ? FALLBACK_REASON_EXPLANATIONS.fr : FALLBACK_REASON_EXPLANATIONS.en)[decision.fallbackReason]}
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <>
                                    <div className="flex flex-wrap items-center gap-2">
                                      {item.screeningTypeGuess &&
                                        item.screeningTypeGuess !== 'unknown' && (
                                          <span
                                            className="inline-flex items-center rounded-md border border-purple-300 bg-purple-50 px-3 py-1 text-sm font-medium text-purple-900 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-200"
                                            data-testid={`detail-type-guess-${item.id}`}
                                          >
                                            <span className="mr-1.5 text-xs uppercase tracking-wide opacity-75">
                                              {isFr ? 'Type' : 'Type'}:
                                            </span>
                                            {(isFr ? TYPE_GUESS_LABEL_FR : TYPE_GUESS_LABEL_EN)[
                                              item.screeningTypeGuess
                                            ] ?? item.screeningTypeGuess}
                                          </span>
                                        )}
                                      {item.screeningBucketGuess &&
                                        item.screeningBucketGuess !== 'unknown' && (
                                          <span
                                            className="inline-flex items-center rounded-md border border-teal-300 bg-teal-50 px-3 py-1 text-sm font-medium text-teal-900 dark:border-teal-700 dark:bg-teal-950 dark:text-teal-200"
                                            data-testid={`detail-bucket-guess-${item.id}`}
                                          >
                                            <span className="mr-1.5 text-xs uppercase tracking-wide opacity-75">
                                              {isFr ? 'Destination' : 'Bucket'}:
                                            </span>
                                            {(isFr ? BUCKET_GUESS_LABEL_FR : BUCKET_GUESS_LABEL_EN)[
                                              item.screeningBucketGuess
                                            ] ?? item.screeningBucketGuess}
                                          </span>
                                        )}
                                      {item.screeningConfidence != null && (
                                        <span
                                          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1 text-sm font-medium"
                                          data-testid={`detail-confidence-${item.id}`}
                                        >
                                          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                                          <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                            {isFr ? 'Confiance' : 'Confidence'}:
                                          </span>
                                          <span>
                                            {Math.round(item.screeningConfidence * 100)}%
                                          </span>
                                        </span>
                                      )}
                                    </div>
                                    {decision?.fallbackReason ? (
                                      <div
                                        className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                        data-testid={`detail-fallback-explanation-${item.id}`}
                                      >
                                        <p className="font-medium">
                                          {(isFr ? FALLBACK_REASON_LABELS.fr : FALLBACK_REASON_LABELS.en)[decision.fallbackReason]}
                                        </p>
                                        <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                                          {(isFr ? FALLBACK_REASON_EXPLANATIONS.fr : FALLBACK_REASON_EXPLANATIONS.en)[decision.fallbackReason]}
                                        </p>
                                      </div>
                                    ) : item.screeningQaReason && (
                                      <p
                                        className="mt-3 whitespace-pre-wrap text-sm text-foreground/80"
                                        data-testid={`detail-reason-${item.id}`}
                                      >
                                        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                          {isFr ? 'Raison' : 'Reason'}:
                                        </span>
                                        {item.screeningQaReason}
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                            </SortingMergeGroupWrapper>
                          </div>
                        );
                      })}
                          </>
                        );
                      })()}
                    </div>
                    )}
                    <NextStepBlock
                      items={items}
                      currentStep={currentStep}
                      stepIndex={stepIndex}
                      isFr={isFr}
                      onNext={() => updateStep.mutate(STEP_ORDER[stepIndex + 1])}
                      residenceIncompleteCount={
                        currentStep === 'branching'
                          ? items.filter(
                              (i) =>
                                i.branch === 'residence_documents' &&
                                !i.residenceId &&
                                i.status !== 'rejected',
                            ).length
                          : 0
                      }
                      sortingPendingCount={
                        currentStep === 'sorting'
                          ? items.filter(
                              (i) =>
                                i.status !== 'rejected' &&
                                (i.sortingDecisionState === 'pending' ||
                                  i.sortingDecisionState === 'rejected'),
                            ).length
                          : 0
                      }
                      fallbackPendingCount={
                        // Task #1069: AI-failed files on the current step
                        // (screening / branching / identification / linking)
                        // were auto-promoted with a default value but no
                        // real human assignation. Block Next Step until the
                        // admin retries, accepts, or excludes each one.
                        // Sorting already gates on sortingDecisionState
                        // (forced to 'pending' on AI failure) via
                        // sortingPendingCount above. Complete has no AI
                        // step, so the count is 0 there.
                        currentStep === 'screening' ||
                        currentStep === 'branching' ||
                        currentStep === 'identification' ||
                        currentStep === 'linking'
                          ? items.filter(
                              (i) =>
                                i.status !== 'rejected' &&
                                getItemStepDecision(i, currentStep)?.fallbackReason != null,
                            ).length
                          : 0
                      }
                    />
                  </CardContent>
                </Card>
              )}

              {currentStep === 'complete' && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle>{isFr ? 'Terminé' : 'Complete'}</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHideReady((v) => !v)}
                      data-testid="toggle-hide-ready"
                    >
                      {hideReady ? (
                        <Eye className="mr-2 h-4 w-4" />
                      ) : (
                        <EyeOff className="mr-2 h-4 w-4" />
                      )}
                      {hideReady
                        ? (isFr ? 'Afficher tous les fichiers' : 'Show all files')
                        : (isFr ? "Masquer les fichiers prêts pour l'étape suivante" : 'Hide files ready for next step')}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {isFr
                        ? `${items.filter((i) => i.status === 'committed').length} document(s) sauvegardé(s).`
                        : `${items.filter((i) => i.status === 'committed').length} document(s) committed.`}
                    </p>
                    {/* Excluded (rejected) files are hidden from step 3+ (Task #804).
                        The committed count above is unaffected — it already
                        counts only committed items. */}
                    {(() => {
                      const completeItems = items.filter((i) => i.status !== 'rejected');
                      const displayedCompleteItems = hideReady
                        ? completeItems.filter((i) => !isItemReadyForNextStep(i, 'complete'))
                        : completeItems;
                      if (completeItems.length === 0) return null;
                      return (
                        <div className="space-y-2">
                          {displayedCompleteItems.length === 0 && hideReady && (
                            <p className="text-sm text-muted-foreground" data-testid="empty-state-complete">
                              {isFr ? "Tous les fichiers sont prêts pour l'étape suivante." : 'All files are ready for the next step.'}
                            </p>
                          )}
                        {displayedCompleteItems.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              item.status !== 'committed' ? 'opacity-50' : ''
                            }`}
                            role="button"
                            tabIndex={0}
                            data-testid={`item-preview-trigger-${item.id}`}
                            onClick={() => setPreviewItem({ id: item.id, originalName: item.originalName, mimeType: item.mimeType })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setPreviewItem({ id: item.id, originalName: item.originalName, mimeType: item.mimeType });
                              }
                            }}
                          >
                            <ItemThumbnail item={item} />
                            <div className="min-w-0 flex flex-col">
                              <span className="truncate font-medium" data-testid={`item-name-${item.id}`}>
                                {item.originalName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {item.status}
                                {item.mimeType ? ` · ${item.mimeType}` : ''}
                              </span>
                            </div>
                          </div>
                        ))}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* Clear all (typed-confirm) */}
              <Card>
                <CardContent className="pt-6">
                  <Button
                    variant="destructive"
                    onClick={() => setShowConfirm(true)}
                    data-testid="button-clear-all"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isFr ? 'Tout effacer' : 'Clear all'}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>

      <DocumentInlineViewer
        isOpen={!!previewItem}
        onClose={() => setPreviewItem(null)}
        fileUrl={previewItem ? `/api/admin/bulk-import/items/${previewItem.id}/file` : ''}
        downloadUrl={previewItem ? `/api/admin/bulk-import/items/${previewItem.id}/file` : undefined}
        fileName={previewItem?.originalName}
        mimeType={previewItem?.mimeType}
      />

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isFr ? 'Confirmer la suppression' : 'Confirm deletion'}
            </DialogTitle>
            <DialogDescription>
              {isFr
                ? 'Tapez DELETE pour effacer la session, tous les fichiers en attente et les décisions.'
                : 'Type DELETE to clear the session, all staged files and decisions.'}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            data-testid="input-confirm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              {isFr ? 'Annuler' : 'Cancel'}
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== 'DELETE' || clearAll.isPending}
              onClick={() => clearAll.mutate()}
              data-testid="button-confirm-clear"
            >
              {isFr ? 'Effacer' : 'Clear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task #1068 — confirm "Retry step from scratch" before wiping
          AI decisions and manual overrides for the current step. */}
      <AlertDialog
        open={pendingResetStep !== null}
        onOpenChange={(open) => {
          if (!open && !resetStep.isPending) {
            setPendingResetStep(null);
          }
        }}
      >
        <AlertDialogContent data-testid="reset-step-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isFr
                ? "Reprendre l'étape à zéro ?"
                : 'Retry this step from scratch?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isFr
                ? `Toutes les décisions de l'IA et les corrections manuelles pour l'étape « ${pendingResetStep ? stepLabels[pendingResetStep] : ''} » seront effacées sur chaque fichier non exclu et non finalisé. Les fichiers exclus, finalisés ou marqués comme doublons ne sont pas touchés. Les autres étapes ne sont pas affectées. L'analyse redémarrera immédiatement.`
                : `All AI decisions and manual overrides for the "${pendingResetStep ? stepLabels[pendingResetStep] : ''}" step will be wiped on every file that is not excluded or already committed. Excluded, committed, and duplicate files are left alone. Other steps are not affected. Analysis will restart immediately.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={resetStep.isPending || runAll.isPending}
              data-testid="reset-step-cancel"
            >
              {isFr ? 'Annuler' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={resetStep.isPending || runAll.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pendingResetStep) {
                  resetStep.mutate(pendingResetStep);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="reset-step-confirm"
            >
              {resetStep.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isFr ? 'Réinitialisation…' : 'Resetting…'}
                </>
              ) : isFr ? (
                "Reprendre l'étape"
              ) : (
                'Retry step'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
