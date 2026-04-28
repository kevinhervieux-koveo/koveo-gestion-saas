import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react';
import { debugLog } from '@/lib/debug-log';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { getSystemFamilyDisplay, makeFamilyNameComparator } from '@/lib/system-family-display';
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
  GripVertical,
  Link2,
  Link2Off,
  Library,
  FolderOpen,
  Info,
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { StandaloneDatePicker } from '@/components/common/DatePickerField';
import {
  AI_DEGRADED_FAILURE_RATE_THRESHOLD,
  RETRYABLE_AI_FALLBACK_REASONS,
  bandForConfidence,
  type BulkImportFallbackReason,
  type BulkImportItem,
  type BulkImportSession,
  type BulkImportSessionAiFailureSummary,
  type BulkImportStep,
} from '@shared/schemas/bulk-import';
import { ConfidenceBadge } from './bulk-import-confidence-badge';
import { FallbackReasonBadge, TextOnlyDegradedBadge, FALLBACK_REASON_LABELS, FALLBACK_REASON_EXPLANATIONS, formatRetryAttempts } from './bulk-import-fallback-reason-badge';
import {
  resolveLinkingGroups,
  computeLinkingDropChanges,
  computeLinkingMakeStandaloneChanges,
  computeLinkingBreakGroupChanges,
  resolveFamilyGroups,
  getLinkingDisplayName,
} from './bulk-import-linking-groups';
import type { LinkingGroup, FamilyGroup, FamilyMembership, FamilyRow, ExistingFamilyDoc } from './bulk-import-linking-groups';
import {
  AUTO_STEPS,
  NextStepBlock,
  STEP_ORDER,
  STEP_PRE_STATUS,
  isAutoStep,
  isFallbackPending,
  type AutoStep,
} from './bulk-import-next-step-block';
import { DocumentInlineViewer } from '@/components/common/DocumentInlineViewer';
import { TagPicker } from '@/components/document-tags/TagPicker';
import { enumLabels } from '@/lib/i18n/enumLabels';

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
 * Localised label for an AI confidence value, derived from the shared
 * `bandForConfidence` thresholds (≥0.80 → High, ≥0.50 → Medium, <0.50 →
 * Low). Returns null when the confidence is not a usable number so
 * callers can omit the band suffix entirely instead of rendering an
 * empty separator (Task #1358).
 */
function confidenceBandLabel(
  confidence: number | null | undefined,
  isFr: boolean,
): string | null {
  if (confidence == null || Number.isNaN(confidence)) return null;
  const band = bandForConfidence(confidence);
  if (band === 'high') return isFr ? 'Élevée' : 'High';
  if (band === 'medium') return isFr ? 'Moyenne' : 'Medium';
  return isFr ? 'Faible' : 'Low';
}

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
export interface BulkImportItemLite {
  id: string;
  originalName: string;
  /**
   * Task #1373 — Folder-relative path captured at upload time when the
   * admin used the **Choose folder** button (e.g. `2024 bills/January/foo.pdf`).
   * For **Choose files** uploads this equals the basename. The wizard
   * derives the parent-folder portion from this field and renders it
   * read-only in the per-item details panel.
   */
  originalPath: string | null;
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
  /**
   * Task #1217: set to 'pdf_text_only' when the Screening step degraded a
   * large PDF to text-only analysis (PDF exceeded size/page-count thresholds).
   * Null means the PDF was analyzed normally (or the file is not a PDF).
   * Distinct from screeningFallback — the analysis succeeded but from text.
   */
  screeningDegraded: 'pdf_text_only' | null;
  /**
   * Task #1157: number of Anthropic attempts the worker made for the
   * Screening step on this item. 1 = first-try success, 2-3 = retried,
   * 0 = no API call (cache hit / no_api_key), null = legacy session
   * persisted before this field was added.
   */
  screeningRetryCount: number | null;
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
  /** Task #1157: Anthropic attempts for the Sorting step. See screeningRetryCount. */
  sortingRetryCount: number | null;
  /**
   * Task #1220: same `pdf_text_only` marker exposed for the Screening step
   * (see screeningDegraded), but for the Sorting step. Because the PDF
   * text-only degradation happens at the file-loading layer, every step
   * after Screening also reads from extracted text — surfacing this here
   * lets the UI render the "Analyzed from text only" badge in Sorting too.
   * Null on legacy sessions persisted before the marker existed (matches
   * the "not degraded" default).
   */
  sortingDegraded: 'pdf_text_only' | null;
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
  /** Task #1157: Anthropic attempts for the Branching step. See screeningRetryCount. */
  branchingRetryCount: number | null;
  /** Task #1220: text-only degradation marker for the Branching step. See sortingDegraded. */
  branchingDegraded: 'pdf_text_only' | null;
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
  /**
   * Task #1401 — clean human-readable filename stem the AI suggested for
   * this row in the Sorting (a.k.a. Branching) step. The Sorting rename
   * input defaults to this when the admin hasn't typed anything yet, and
   * shows an "AI suggestion" hint while the input value still matches
   * verbatim. `null` means the AI did not produce a suggestion (fallback
   * row, api_error, or unsanitisable response) — the input falls back to
   * the original-stem placeholder.
   */
  branchSuggestedFinalFileName: string | null;
  /**
   * Task #1454 — true when `branchSuggestedFinalFileName` is just the
   * sanitised stem of the original filename (i.e. not a real AI proposal).
   * Used to suppress the "AI suggestion" badge and the Linking-step display
   * name upgrade (Task #1635).
   */
  branchSuggestedFinalFileNameIsFallback: boolean;
  /**
   * Task #1401 — pair of clean filename stems for split rows, in slice
   * order (Part 1 / Part 2). Only populated when the AI itself flagged
   * the document as splittable. `null` otherwise.
   */
  branchSuggestedSplitFinalNames: [string, string] | null;
  identificationConfidence: number | null;
  identificationFallback: BulkImportFallbackReason | null;
  /** Task #1157: Anthropic attempts for the Identification step. See screeningRetryCount. */
  identificationRetryCount: number | null;
  /** Task #1220: text-only degradation marker for the Identification step. See sortingDegraded. */
  identificationDegraded: 'pdf_text_only' | null;
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
  /** Task #1157: Anthropic attempts for the Linking step. See screeningRetryCount. */
  linkingRetryCount: number | null;
  /** Task #1220: text-only degradation marker for the Linking step. See sortingDegraded. */
  linkingDegraded: 'pdf_text_only' | null;
  linkingReason: string | null;
  linkingBeforeItemId: string | null;
  linkingAfterItemId: string | null;
  /** Task #1233: true when an admin manually edited the linking chain for this item. */
  linkingManualOverride: boolean;
  /**
   * Task #1386: existing-library link fields. When an admin (or the AI)
   * has attached this item to an existing family, these hold the family ID
   * and the neighbor document ID that the new document will be placed
   * relative to. Exactly one of beforeDocumentId/afterDocumentId is set.
   */
  linkingFamilyId: string | null;
  linkingBeforeDocumentId: string | null;
  linkingAfterDocumentId: string | null;
  /** Task #1386: display names resolved server-side for the existing-family link. */
  linkingFamilyName: string | null;
  linkingNeighborDocumentName: string | null;
  /** 'before' | 'after' derived from which of before/after document ID is set. */
  linkingNeighborPosition: 'before' | 'after' | null;
  /**
   * Task #1549: AI-guessed family for items with no existing anchor documents.
   * When the building has 0 anchor documents the AI picks the most likely family.
   * Admin confirms with one click; the item becomes the family's first anchor.
   */
  linkingFamilyGuessId: string | null;
  linkingFamilyGuessConfidence: number | null;
  linkingFamilyGuessReason: string | null;
  /** Resolved server-side display name for the guessed family. */
  linkingFamilyGuessName: string | null;
  /** Resolved server-side description for the guessed family (may be null if unset). */
  linkingFamilyGuessDescription: string | null;
  /**
   * Task #1608: multi-family AI guesses (zero, one, or several). Each entry
   * carries a familyId, confidence, reason, and resolved familyName /
   * familyDescription. These are the raw AI guesses from linkDecisions.familyGuesses,
   * distinct from linkingMemberships (which are the committed membership rows).
   * Null when the AI returned no guesses or when not on the linking step.
   */
  linkingFamilyGuesses: Array<{
    familyId: string;
    confidence: number;
    reason: string;
    familyName: string | null;
    familyDescription: string | null;
  }> | null;
  /**
   * Task #1589: real family membership rows for this item, as persisted in
   * `bulk_import_item_family_memberships` and batch-resolved by the lite
   * endpoint. Ordered by `sequence` (nulls last) within each family.
   * Empty array when the item has no memberships (Standalone).
   */
  linkingMemberships: Array<{
    id: string;
    familyId: string;
    familyName: string;
    familyDescription: string | null;
    neighborDocumentId: string | null;
    position: 'before' | 'after' | null;
    source: 'ai' | 'manual';
    aiConfidence: number | null;
    sequence: number | null;
    reason: string | null;
  }>;
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

/**
 * Per-row enrichment of `BulkImportSession` returned by the
 * sessions-list endpoint (Task #1219). The base session row is
 * extended with an `aiFailureSummary` describing the share of items
 * in the session's current step whose `fallbackReason` is one of
 * `RETRYABLE_AI_FALLBACK_REASONS`. Computed server-side so the list
 * page can render the per-row indicator and aggregated banner without
 * round-tripping a /lite request for every session.
 *
 * The field is `optional` so legacy mock responses in tests (and the
 * intermediate state while a deploy rolls out a new server alongside
 * an old client) continue to render the list — they simply skip the
 * degraded indicator.
 */
type BulkImportSessionWithAiSummary = BulkImportSession & {
  aiFailureSummary?: BulkImportSessionAiFailureSummary;
};

/** Paginated sessions response (Task #727 / extended in Task #1219). */
interface SessionsPage {
  sessions: BulkImportSessionWithAiSummary[];
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
  /**
   * Task #1157: how many Anthropic attempts the worker made for this
   * step. Null on legacy items persisted before retryCount tracking.
   * Surfaced so the detail panel can show "AI failed after N attempts"
   * when a fallback was produced after multiple retries.
   */
  retryCount: number | null;
  decision?: 'keep' | 'merge' | 'split' | null;
  reason?: string | null;
  mergeWithItemId?: string | null;
  splitAtPage?: number | null;
} | null {
  switch (step) {
    case 'screening':
      return {
        confidence: item.screeningConfidence,
        fallbackReason: item.screeningFallback,
        retryCount: item.screeningRetryCount,
      };
    case 'sorting':
      return {
        confidence: item.sortingConfidence,
        fallbackReason: item.sortingFallback,
        retryCount: item.sortingRetryCount,
        decision: item.sortingDecision,
        reason: item.sortingReason,
        mergeWithItemId: item.sortingMergeWithItemId,
        splitAtPage: item.sortingSplitAtPage,
      };
    case 'branching':
      return {
        confidence: item.branchingConfidence,
        fallbackReason: item.branchingFallback,
        retryCount: item.branchingRetryCount,
      };
    case 'identification':
      return {
        confidence: item.identificationConfidence,
        fallbackReason: item.identificationFallback,
        retryCount: item.identificationRetryCount,
      };
    case 'linking':
      return {
        confidence: item.linkingConfidence,
        fallbackReason: item.linkingFallback,
        retryCount: item.linkingRetryCount,
      };
    default:
      return null;
  }
}

// LinkingGroup and resolveLinkingGroups are imported from ./bulk-import-linking-groups

function iconForMime(mime: string | null | undefined, fileName?: string | null) {
  const m = (mime ?? '').toLowerCase();
  const ext = fileName ? fileName.toLowerCase().split('.').pop() ?? '' : '';
  if (m.startsWith('image/')) return FileImage;
  if (m === 'application/pdf' || ext === 'pdf') return FileText;
  if (m.includes('zip') || m.includes('compressed')) return FileArchive;
  if (
    m.includes('sheet') ||
    m.includes('excel') ||
    m.includes('csv') ||
    m.includes('tab-separated') ||
    m.includes('oasis.opendocument.spreadsheet') ||
    ['xlsx', 'xls', 'xlsm', 'ods', 'csv', 'tsv'].includes(ext)
  ) return FileSpreadsheet;
  if (m.includes('word') || m.includes('document') || m.startsWith('text/')) return FileText;
  return FileIcon;
}

function ItemThumbnail({ item }: { item: { id: string; mimeType?: string | null; originalName: string } }) {
  const isImage = (item.mimeType ?? '').toLowerCase().startsWith('image/');
  const [broken, setBroken] = useState(false);
  const Icon = iconForMime(item.mimeType, item.originalName);
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
  /** Task #1534 — Linking-step candidate summary (only set on the linking progress entry). */
  candidateSummary?: {
    familyCount: number;
    anchorDocCount: number;
    openChainCount: number;
    maxInScopeCount: number;
  };
}

function readRunAllProgress(
  session: BulkImportSession | undefined,
  step: AutoStep,
): RunAllProgress | null {
  const progress = session?.progress as Record<string, unknown> | null | undefined;
  const runAll = progress?.runAll as Record<string, RunAllProgress> | undefined;
  return runAll?.[step] ?? null;
}

/**
 * Task #1534 — Determine which of the five "why no links" variants to show
 * on the linking-step empty-result banner, in priority order:
 *   no-families → no-anchor-docs → no-open-chains → all-out-of-scope → low-confidence
 */
type LinkingEmptyReason =
  | 'no-families'
  | 'no-anchor-docs'
  | 'no-open-chains'
  | 'all-out-of-scope'
  | 'low-confidence';

function getLinkingEmptyReason(
  candidateSummary: RunAllProgress['candidateSummary'] | undefined,
): LinkingEmptyReason {
  if (!candidateSummary || candidateSummary.familyCount === 0) return 'no-families';
  if (candidateSummary.anchorDocCount === 0) return 'no-anchor-docs';
  if (candidateSummary.openChainCount === 0) return 'no-open-chains';
  if (candidateSummary.maxInScopeCount === 0) return 'all-out-of-scope';
  return 'low-confidence';
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
export const STEP_LABEL_FR: Record<BulkImportStep, string> = {
  upload: 'Téléversement',
  screening: 'Filtrage',
  sorting: 'Aiguillage',
  branching: 'Tri',
  identification: 'Identification',
  linking: 'Liaison',
  complete: 'Terminé',
};

const STORAGE_KEY = 'bulkImportActiveSessionId';

/**
 * Task #1617: per-session storage key for the family-card collapse preference.
 * Persists which family IDs the admin has manually toggled away from the
 * auto-collapse default so the preference survives page reloads.
 */
export const COLLAPSED_FAMILIES_STORAGE_PREFIX = 'bulkImportCollapsedFamilies:';
export const collapsedFamiliesStorageKey = (sessionId: string): string =>
  `${COLLAPSED_FAMILIES_STORAGE_PREFIX}${sessionId}`;

/**
 * Task #1608/#1617: family-card auto-collapse default.
 *
 * A card auto-starts collapsed when:
 *   - it has nothing new to review (`newCount === 0`, e.g. existing-only
 *     cards rendered for context), so admins focus on cards that need
 *     attention; OR
 *   - it has 2+ new items, so busy sessions don't render a wall of rows.
 *
 * Cards with exactly one new item auto-start expanded so the single
 * pending doc is reviewable at a glance. The admin can toggle any card,
 * and the toggled-away IDs are persisted per session by Task #1617.
 */
export function familyCardAutoCollapsed(newCount: number): boolean {
  return newCount !== 1;
}

/**
 * Task #1608/#1617: apparent collapse state of a family card. Combines
 * the auto-collapse default with the admin's "toggled away from default"
 * set: a card whose ID is in the set displays the OPPOSITE of its default.
 */
export function isFamilyCardCollapsed(
  newCount: number,
  familyId: string,
  toggledFamilyIds: ReadonlySet<string>,
): boolean {
  const auto = familyCardAutoCollapsed(newCount);
  const toggled = toggledFamilyIds.has(familyId);
  return auto ? !toggled : toggled;
}

/**
 * Task #1608/#1617: returns a new "toggled away from default" set with
 * `familyId` flipped in/out. Pure (does not mutate `prev`) so it can be
 * used inside React state updaters and unit-tested in isolation.
 */
export function toggleFamilyCardCollapsed(
  prev: ReadonlySet<string>,
  familyId: string,
): Set<string> {
  const next = new Set(prev);
  if (next.has(familyId)) next.delete(familyId);
  else next.add(familyId);
  return next;
}

/**
 * Task #1617: read the persisted "toggled away from default" set for a
 * session. Returns an empty set on missing entry, malformed JSON, or any
 * storage access failure (e.g. private browsing).
 */
export function readPersistedCollapsedFamilyIds(sessionId: string): Set<string> {
  try {
    const raw = localStorage.getItem(collapsedFamiliesStorageKey(sessionId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

/**
 * Task #1617: persist the "toggled away from default" set for a session.
 * Silently tolerates quota errors and disabled storage so a write failure
 * never breaks the in-memory toggle.
 */
export function writePersistedCollapsedFamilyIds(
  sessionId: string,
  ids: ReadonlySet<string>,
): void {
  try {
    localStorage.setItem(
      collapsedFamiliesStorageKey(sessionId),
      JSON.stringify(Array.from(ids)),
    );
  } catch {
    // ignored — collapse still works for this session, just not persisted.
  }
}

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
  aiFailureSummary,
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
  /**
   * Task #1219: per-session AI-failure tally computed by the
   * sessions-list endpoint. Optional so a missing field (older server,
   * test mock) still renders the row — we just skip the degraded
   * indicator. The compact "service may be degraded" badge only renders
   * when `aiDegraded` is true so non-affected rows stay unchanged.
   */
  aiFailureSummary?: BulkImportSessionAiFailureSummary;
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
        {/* Task #1219: per-row "Anthropic looks degraded" indicator.
            Sibling of the toggle button (not nested) so it can be its
            own button without producing nested interactive elements.
            Only renders when the session's current step has a
            transient AI failure rate above
            AI_DEGRADED_FAILURE_RATE_THRESHOLD; clicking it opens the
            session at its current step so the existing in-page banner
            (Task #1209) takes over with the "Retry AI-failed items"
            action. We don't gate on `resumable` because a session can
            be `paused` and still benefit from the indicator, and the
            wizard's own controls handle non-actionable terminal states. */}
        {aiFailureSummary?.aiDegraded && aiFailureSummary.step && (
          <button
            type="button"
            onClick={onResume}
            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
            title={
              isFr
                ? `Anthropic a retourné des erreurs pour ${aiFailureSummary.aiFailedCount} des ${aiFailureSummary.aiTotalCount} fichiers de l'étape « ${stepLabels[aiFailureSummary.step]} » — ouvrez la session pour réessayer.`
                : `Anthropic returned errors for ${aiFailureSummary.aiFailedCount} of ${aiFailureSummary.aiTotalCount} ${stepLabels[aiFailureSummary.step]} items — open the session to retry.`
            }
            data-testid={`history-ai-degraded-${session.id}`}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {isFr
              ? `Anthropic dégradé (${aiFailureSummary.aiFailedCount}/${aiFailureSummary.aiTotalCount})`
              : `Anthropic degraded (${aiFailureSummary.aiFailedCount}/${aiFailureSummary.aiTotalCount})`}
          </button>
        )}
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

  const [allSessions, setAllSessions] = useState<BulkImportSessionWithAiSummary[]>([]);
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
      debugLog('hardDeleteSession start', { sessionId: id });
      await apiRequest(
        'DELETE',
        `/api/admin/bulk-import/sessions/${id}/hard`,
        {},
      );
      return id;
    },
    onSuccess: (id) => {
      debugLog('hardDeleteSession success', { sessionId: id });
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
    onError: (err, id) => {
      debugLog('hardDeleteSession error', { sessionId: id, error: err instanceof Error ? err.message : String(err) });
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
    ? sorted.find((s) => s.id === pendingDeleteId) ?? null
    : null;

  // Task #1219: aggregated "N sessions look degraded" banner. Counted
  // off the same per-row `aiFailureSummary.aiDegraded` flag the row
  // indicators use so the count and the highlighted rows always agree.
  // Hidden when the count is zero so the page stays quiet during
  // healthy operation.
  const degradedSessionCount = sorted.filter(
    (s) => s.aiFailureSummary?.aiDegraded === true,
  ).length;
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
        {/* Task #1219: aggregated "Anthropic looks degraded" banner.
            Renders once at the top of the list whenever at least one
            session in the loaded pages has its current step's AI
            failure rate above AI_DEGRADED_FAILURE_RATE_THRESHOLD, so
            admins can spot the problem before they pick a session to
            open. Mirrors the wizard's in-page degraded banner styling
            (Task #1209) for consistency. */}
        {degradedSessionCount > 0 && (
          <div
            className="mb-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
            role="status"
            data-testid="history-ai-degraded-banner"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span data-testid="history-ai-degraded-banner-message">
              {isFr
                ? degradedSessionCount > 1
                  ? `${degradedSessionCount} sessions ont un taux d'échec Anthropic élevé — ouvrez-les pour réessayer les fichiers en échec IA.`
                  : `1 session a un taux d'échec Anthropic élevé — ouvrez-la pour réessayer les fichiers en échec IA.`
                : degradedSessionCount > 1
                ? `${degradedSessionCount} sessions have a high Anthropic failure rate — open them to retry AI-failed items.`
                : `1 session has a high Anthropic failure rate — open it to retry AI-failed items.`}
            </span>
          </div>
        )}
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
            {sorted.map((s) => (
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
                aiFailureSummary={s.aiFailureSummary}
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
export function isItemReadyForNextStep(item: BulkImportItemLite, step: BulkImportStep): boolean {
  if (
    step === 'screening' ||
    step === 'branching' ||
    step === 'identification' ||
    step === 'linking'
  ) {
    // Task #1244: delegate the fallback / manual-override decision to
    // `isFallbackPending` so this per-row readiness check and the
    // aggregate `fallbackPendingCount` gate (which already calls
    // `isFallbackPending`) cannot drift apart by construction. The
    // manual-override rules (Task #1082) — branching honours
    // `branchManualOverride`, identification honours
    // `identificationEffectiveDateManualOverride`, screening / linking
    // have no override — now live in exactly one place.
    const decision = getItemStepDecision(item, step);
    if (
      isFallbackPending(step, decision?.fallbackReason, {
        branchManualOverride: item.branchManualOverride,
        identificationEffectiveDateManualOverride:
          item.identificationEffectiveDateManualOverride,
      })
    ) {
      return false;
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

/**
 * Task #1202: the yellow "AI service error" alert that explains a
 * fallback row used to read like a dead-end — admins had to scroll
 * back to the row's action toolbar to find Retry. This button surfaces
 * Retry inline in the alert so the recovery action lives next to the
 * explanation that motivates it.
 *
 * Task #1225: rendered for ALL fallback reasons, not just `api_error` /
 * `unreadable_response`. The backend per-item endpoint runs
 * unconditionally, so the admin should always be able to retry from
 * the inline alert.
 *
 * The button shares its in-flight tracking with the existing per-row
 * Retry button so a single retry in flight (manual click, run-all
 * loop, or step-level "Retry AI-failed items") shows exactly one
 * spinner regardless of how many surfaces the row appears in.
 *
 * Hidden when:
 *   - `retryAction` is null (non-AI step like Upload / Complete)
 *   - `hideRetry` is true (caller-supplied; Task #1225 removed all
 *     status/override/fallback-reason gates — see `showRetry` at each
 *     call site for what, if anything, sets this to `true` now)
 */
function InlineFallbackRetryButton({
  itemId,
  fallbackReason,
  retryAction,
  retryPending,
  hideRetry,
  isFr,
  onRetry,
  testIdPrefix = 'button-fallback-retry',
}: {
  itemId: string;
  fallbackReason: BulkImportFallbackReason | null | undefined;
  retryAction: 'screen' | 'sort' | 'branch' | 'identify' | 'link' | null;
  retryPending: boolean;
  /** Hide the button regardless of fallback reason — use for draft-split
   *  leads (whose AI step is already resolved) or when no retry action
   *  exists for the current step. Manual overrides and exclusions no
   *  longer hide the inline Retry (Task #1225). */
  hideRetry: boolean;
  isFr: boolean;
  onRetry: () => void;
  testIdPrefix?: string;
}) {
  if (!retryAction || hideRetry) return null;
  return (
    <div className="mt-2">
      <Button
        size="sm"
        variant="outline"
        className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
        onClick={onRetry}
        disabled={retryPending}
        data-testid={`${testIdPrefix}-${itemId}`}
      >
        {retryPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RotateCw className="mr-2 h-4 w-4" />
        )}
        {isFr ? 'Réessayer' : 'Retry'}
      </Button>
    </div>
  );
}

/**
 * Task #1202: Set form of `RETRYABLE_AI_FALLBACK_REASONS` (imported
 * from `@shared/schemas/bulk-import` so the wizard, the sessions-list
 * page from Task #1219, and the server's `aiFailureSummary` agree on
 * which reasons count as transient Anthropic-side trouble). Membership
 * checks happen on every item in the per-row alert loop so the Set is
 * cheaper than `.includes` on the shared array.
 *
 * Task #1209 — the top-of-step "Anthropic looks degraded" banner uses
 * the threshold + this Set together: when the share of items in the
 * current AI step whose `fallbackReason` is in this Set crosses
 * `AI_DEGRADED_FAILURE_RATE_THRESHOLD`, the wizard surfaces a single
 * yellow banner above the auto-run progress block summarising the
 * failure rate and linking the existing "Retry AI-failed items (N)"
 * action. Below the threshold the per-row yellow alerts and the
 * step-level retry button already give admins everything they need.
 */
const RETRYABLE_AI_FALLBACK_REASON_SET: ReadonlySet<BulkImportFallbackReason> =
  new Set(RETRYABLE_AI_FALLBACK_REASONS);

/**
 * Task #1213 — confirmation threshold for the in-page Cancel
 * button. Below this size the admin gets the snappy
 * immediate-cancel from Task #1208; at or above it we open an
 * AlertDialog so an accidental click while scanning a long
 * failure list doesn't kill the whole batch with no undo.
 *
 * Task #1241 — exported so the bulk-retry test fixtures size
 * themselves relative to this constant (THRESHOLD - 2 for the
 * sub-threshold case, THRESHOLD for the at-threshold case,
 * THRESHOLD + 1 for the above-threshold case) instead of
 * hard-coding 3 / 5 / 6 and silently breaking when the
 * threshold is tuned.
 */
export const BULK_RETRY_CONFIRM_THRESHOLD = 5;

/**
 * Task #1671: Minimum number of selected items that triggers a confirmation
 * prompt before the bulk-commit action is dispatched.
 */
export const BULK_COMMIT_CONFIRM_THRESHOLD = 10;

/**
 * Task #1671: Maps a per-item commit error to a short, actionable EN/FR
 * string suitable for inline display next to the row's Commit button.
 */
function getCommitErrorMessage(
  error: { errorCode?: string; message: string; predecessorSequence?: number },
  isFr: boolean,
): string {
  if (error.errorCode === 'first_anchor_conflict') {
    return isFr
      ? 'Un autre admin a déjà ancré cette famille — rechargez pour voir la nouvelle chaîne.'
      : 'Another admin already anchored this family — refresh to see the new chain.';
  }
  if (error.errorCode === 'awaiting_family_predecessor') {
    if (error.predecessorSequence != null) {
      return isFr
        ? `En attente que le document #${error.predecessorSequence} soit sauvegardé en premier.`
        : `Waiting for document #${error.predecessorSequence} to commit first.`;
    }
    return isFr
      ? 'En attente que le prédécesseur soit sauvegardé en premier.'
      : 'Waiting for predecessor to commit first.';
  }
  return error.message || (isFr ? 'Échec de la validation' : 'Commit failed');
}

export default function BulkDocumentImportPage() {
  const { language, tp, t } = useLanguage();
  const { toast } = useToast();
  const isFr = language === 'fr';
  const stepLabels = isFr ? STEP_LABEL_FR : STEP_LABEL_EN;

  const [buildingId, setBuildingId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<{
    id: string;
    originalName: string;
    mimeType: string | null;
    chainSiblings: { id: string; originalName: string; mimeType: string | null }[];
    chainIndex: number;
    /** Bulk-import linking step: ordered list of all family groups for up/down jumping. */
    familyGroups?: { familyLabel: string; siblings: { id: string; originalName: string; mimeType: string | null }[] }[];
    /** Index of the currently displayed family group within `familyGroups`. */
    familyGroupIndex?: number;
  } | null>(null);
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
  const { data: aiStatus } = useQuery<{ available: boolean; fallbackReason: 'no_api_key' | 'model_misconfigured' | null }>({
    queryKey: ['/api/admin/bulk-import/ai-status'],
  });
  const aiAvailable = aiStatus?.available ?? true;
  const aiFallbackReason = aiStatus?.fallbackReason ?? null;
  const [skipExisting, setSkipExisting] = useState(true);
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

  const {
    data: payload,
    isLoading: loadingSession,
    // Surface the timestamps so we can tell apart "last poll succeeded"
    // from "last poll errored" — TanStack keeps the previous `data`
    // around on a refetch failure so `data` alone can't tell us that
    // the most recent poll cycle errored out (Task #1234).
    errorUpdatedAt: liteErrorUpdatedAt,
    dataUpdatedAt: liteDataUpdatedAt,
    refetch: refetchLite,
  } = useQuery<SessionPayloadLite>({
    queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
    enabled: !!sessionId,
    // Poll faster while any AI step run-all loop is active so the
    // counter and "Analyzing: name" heartbeat update quickly (Task #898).
    // Once all steps are finished we throttle back to 5s.
    refetchInterval: (query) => {
      const data = query.state.data as SessionPayloadLite | undefined;
      if (!data) return 5000;
      // Guard against a transient bad poll response (missing session/items)
      // so a 502 or malformed payload never throws inside this callback and
      // crashes the component into the error boundary.
      const screeningActive =
        data?.session?.currentStep === 'screening' &&
        data?.items?.some((i) => i.status === 'pending' || i.status === 'screening');
      if (screeningActive) return 2000;
      const progress = data?.session?.progress as Record<string, unknown> | null | undefined;
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

  /**
   * Task #1608: Collect the unique family IDs that appear in membership rows
   * across all items when on the linking step. This drives the family-context
   * query below so each family card can render its existing library docs.
   */
  const linkingFamilyIds = useMemo(() => {
    if ((session?.currentStep ?? 'upload') !== 'linking') return [];
    const seen = new Set<string>();
    for (const it of (payload?.items ?? [])) {
      for (const m of it.linkingMemberships ?? []) {
        if (m.familyId) seen.add(m.familyId);
      }
      // Task #1608: also include family IDs from AI guesses so we can render
      // existing-library docs inside those family cards before any membership is created.
      for (const g of it.linkingFamilyGuesses ?? []) {
        if (g.familyId) seen.add(g.familyId);
      }
    }
    return Array.from(seen).sort();
  }, [session?.currentStep, payload?.items]);

  /**
   * Task #1608: Fetch the ordered existing docs for each family so the family
   * card can render them as read-only anchor rows interleaved with new items.
   * Only fires when there are family group IDs to resolve.
   */
  const { data: familyContextData } = useQuery<{
    families: Array<{
      familyId: string;
      familyName: string;
      familyDescription: string | null;
      documents: Array<{
        id: string;
        name: string;
        effectiveDate: string | Date | null;
        mimeType: string | null;
        residenceId: string | null;
        hasBefore: boolean;
        hasAfter: boolean;
      }>;
    }>;
  }>({
    queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'family-context', linkingFamilyIds],
    enabled: !!sessionId && linkingFamilyIds.length > 0,
    queryFn: async () => {
      const params = new URLSearchParams({ familyIds: linkingFamilyIds.join(',') });
      const res = await fetch(`/api/admin/bulk-import/sessions/${sessionId}/family-context?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch family context');
      return res.json();
    },
    staleTime: 60_000,
  });

  /**
   * Task #1608: Build a Map<familyId, ExistingFamilyDoc[]> from the family
   * context response so resolveFamilyGroups can produce interleaved rows.
   */
  const existingDocsByFamilyId = useMemo((): Map<string, ExistingFamilyDoc[]> => {
    if (!familyContextData?.families) return new Map();
    const map = new Map<string, ExistingFamilyDoc[]>();
    for (const fam of familyContextData.families) {
      map.set(fam.familyId, fam.documents.map((doc) => ({
        id: doc.id,
        name: doc.name,
        effectiveDate: doc.effectiveDate,
        mimeType: doc.mimeType,
        residenceId: doc.residenceId,
      })));
    }
    return map;
  }, [familyContextData]);

  // Hide-ready toggle (Task #1045). Defaults OFF on every step; resets
  // automatically when the wizard advances to a new step so hidden rows
  // from one step never bleed into the next.
  const [hideReady, setHideReady] = useState(false);
  useEffect(() => {
    setHideReady(false);
  }, [currentStep]);

  // Bulk-selection state (Task #1273). Tracks the set of itemIds the
  // admin has checked so the floating toolbar can fire Exclude /
  // Re-include actions against the new batched endpoint. Selection is
  // cleared whenever the wizard advances to a new step or switches
  // sessions so stale ids from a different view never sneak into a
  // bulk request.
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelectedItemIds(new Set());
  }, [currentStep, sessionId]);
  const toggleItemSelection = useCallback((itemId: string, selected: boolean) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);
  const clearItemSelection = useCallback(() => setSelectedItemIds(new Set()), []);

  // ---------------------------------------------------------------------------
  // Task #1405 — "Next AI suggestion" navigation on the Sorting step.
  //
  // Now that Task #1401 pre-fills the Sorting-step rename input with the
  // analyzer's `branchSuggestedFinalFileName` / `branchSuggestedSplitFinalNames`,
  // admins reviewing dozens of pending rows want a way to jump to the next
  // row whose value still matches the AI's suggestion verbatim — i.e. rows
  // that nobody has overridden yet — so they can scan/approve in bulk
  // without scrolling. This memo computes that ordered target list (one
  // entry per pending row whose rename input would render the "AI
  // suggestion" hint badge), and `goToNextAiNamedSortingRow` advances a
  // ref-tracked cursor cyclically and focuses the matched input so the
  // admin can press Enter to accept or just start typing to override.
  //
  // Merge children share the rename input on their lead, so we skip merge
  // siblings (`sortingMergeWithItemId` set) and only enter the lead's
  // testid (`branching-rename-merge-<leadId>`) once. Split decisions get
  // their own per-part input (`branching-rename-split-<id>-0|1`) and we
  // jump to whichever side still matches the AI suggestion (preferring
  // part 1 so admins read left-to-right).
  // ---------------------------------------------------------------------------
  const aiNamedSortingCursorRef = useRef<number>(-1);
  const aiNamedSortingTargets = useMemo<
    Array<{ itemId: string; testId: string }>
  >(() => {
    if (currentStep !== 'sorting') return [];
    const targets: Array<{ itemId: string; testId: string }> = [];
    for (const item of items) {
      if (item.sortingDecisionState !== 'pending') continue;
      if (
        item.status === 'rejected' ||
        item.status === 'committed' ||
        item.status === 'duplicate'
      ) {
        continue;
      }
      const decision = item.sortingDecision;
      if (!decision) continue;
      // Merge children defer their rename to the lead's input — skip them
      // here so each merge group contributes at most one navigation target.
      if (decision === 'merge' && item.sortingMergeWithItemId) continue;
      if (decision === 'split') {
        const aiPart1 = item.branchSuggestedSplitFinalNames?.[0] ?? null;
        const aiPart2 = item.branchSuggestedSplitFinalNames?.[1] ?? null;
        const split = inlineRenameSplit.get(item.id);
        const part1Value =
          split?.[0] ?? item.sortingDecisionSplitFinalNames?.[0] ?? aiPart1 ?? '';
        const part2Value =
          split?.[1] ?? item.sortingDecisionSplitFinalNames?.[1] ?? aiPart2 ?? '';
        const part1IsAi = !!aiPart1 && part1Value === aiPart1;
        const part2IsAi = !!aiPart2 && part2Value === aiPart2;
        if (part1IsAi) {
          targets.push({ itemId: item.id, testId: `branching-rename-split-${item.id}-0` });
        } else if (part2IsAi) {
          targets.push({ itemId: item.id, testId: `branching-rename-split-${item.id}-1` });
        }
        continue;
      }
      // keep / merge-lead path.
      const aiSuggested = item.branchSuggestedFinalFileName ?? null;
      if (!aiSuggested) continue;
      const renameValue = inlineRename.get(item.id) ?? item.finalFileName ?? aiSuggested;
      if (renameValue !== aiSuggested) continue;
      const testId = decision === 'merge'
        ? `branching-rename-merge-${item.id}`
        : `branching-rename-${item.id}`;
      targets.push({ itemId: item.id, testId });
    }
    return targets;
  }, [currentStep, items, inlineRename, inlineRenameSplit]);

  const goToNextAiNamedSortingRow = useCallback(() => {
    if (aiNamedSortingTargets.length === 0) return;
    const nextIdx =
      (aiNamedSortingCursorRef.current + 1) % aiNamedSortingTargets.length;
    aiNamedSortingCursorRef.current = nextIdx;
    const target = aiNamedSortingTargets[nextIdx];
    if (typeof document === 'undefined') return;
    const el = document.querySelector<HTMLInputElement>(
      `[data-testid="${target.testId}"]`,
    );
    if (!el) return;
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    el.focus({ preventScroll: true });
    try {
      el.select();
    } catch {
      /* select() not supported on every input type — ignore. */
    }
  }, [aiNamedSortingTargets]);

  // Reset the cursor when the step changes or the candidate list shrinks
  // so the very first press always lands on the first match.
  useEffect(() => {
    aiNamedSortingCursorRef.current = -1;
  }, [currentStep, aiNamedSortingTargets.length]);

  // Alt+J keyboard shortcut for jumping to the next AI-named row on the
  // Sorting step. Alt avoids clashing with native typing inside any of
  // the page's many text inputs (Enter / Tab would conflict with form
  // submission and field traversal).
  useEffect(() => {
    if (currentStep !== 'sorting') return;
    function onKeyDown(e: KeyboardEvent) {
      if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (e.key !== 'j' && e.key !== 'J') return;
      e.preventDefault();
      goToNextAiNamedSortingRow();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [currentStep, goToNextAiNamedSortingRow]);


  /**
   * Track consecutive errored polls of the lite status endpoint so we
   * can warn the admin when the counter has frozen because the server
   * is repeatedly failing (Task #1234). Without this, TanStack Query
   * keeps polling silently on its own retry schedule and the UI just
   * shows the last known progress, making a stalled run indistinguishable
   * from a healthy one.
   *
   * The counter increments whenever `errorUpdatedAt` advances (each
   * advance == one settled poll attempt that ended in error, after the
   * shared queryClient retries are exhausted) and resets to 0 whenever
   * a successful poll lands (`dataUpdatedAt` advances). The threshold
   * is intentionally low — once two settled polls in a row have failed
   * we assume the connection is genuinely interrupted rather than a
   * one-off hiccup.
   */
  const LITE_POLL_ERROR_THRESHOLD = 2;
  const lastSeenLiteErrorAtRef = useRef(0);
  const lastSeenLiteDataAtRef = useRef(0);
  const [consecutiveLitePollErrors, setConsecutiveLitePollErrors] = useState(0);
  useEffect(() => {
    if (liteErrorUpdatedAt && liteErrorUpdatedAt > lastSeenLiteErrorAtRef.current) {
      lastSeenLiteErrorAtRef.current = liteErrorUpdatedAt;
      setConsecutiveLitePollErrors((c) => c + 1);
    }
  }, [liteErrorUpdatedAt]);
  useEffect(() => {
    if (liteDataUpdatedAt && liteDataUpdatedAt > lastSeenLiteDataAtRef.current) {
      lastSeenLiteDataAtRef.current = liteDataUpdatedAt;
      setConsecutiveLitePollErrors(0);
      // Task #1372 — A recovered poll resets the linking stale-data banner
      // dismiss flag so the banner can re-appear if the connection drops again.
      setLinkingStaleDataDismissed(false);
    }
  }, [liteDataUpdatedAt]);
  const litePollInterrupted =
    consecutiveLitePollErrors >= LITE_POLL_ERROR_THRESHOLD;

  const createSession = useMutation({
    mutationFn: async (targetBuildingId: string) => {
      debugLog('createSession start', { buildingId: targetBuildingId });
      const res = await apiRequest('POST', '/api/admin/bulk-import/sessions', {
        buildingId: targetBuildingId,
      });
      return res.json() as Promise<BulkImportSession>;
    },
    onSuccess: (s) => {
      debugLog('createSession success', { sessionId: s.id });
      setSessionId(s.id);
      // Invalidate the history list (all paginated variants).
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bulk-import/sessions'] });
      toast({
        title: isFr ? 'Session créée' : 'Session created',
        description: isFr ? 'Vous pouvez téléverser des fichiers.' : 'You can upload files now.',
      });
    },
    onError: (err: unknown) => {
      debugLog('createSession error', { error: err instanceof Error ? err.message : String(err) });
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
      debugLog('updateStep start', { sessionId, step: next });
      const res = await apiRequest('PATCH', `/api/admin/bulk-import/sessions/${sessionId}`, {
        currentStep: next,
      });
      return res.json();
    },
    onSuccess: (_data, next) => {
      debugLog('updateStep success', { sessionId, step: next });
      return queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
    },
    onError: (err, next) => {
      debugLog('updateStep error', { sessionId, step: next, error: err instanceof Error ? err.message : String(err) });
    },
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
      debugLog('uploadFiles start', { sessionId, fileCount: allFiles.length });
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

      if (allowed.length === 0) return { items: [], skippedExisting: 0 };

      const fd = new FormData();
      allowed.forEach((f) => {
        fd.append('files', f);
        // Task #1373 — When the admin uploaded via **Choose folder**,
        // the browser sets `webkitRelativePath` on each File to the
        // folder-relative path (e.g. `2024 bills/January/foo.pdf`). We
        // append a parallel `relativePaths` text field per file so the
        // server can persist it to `originalPath` and forward the
        // parent folder as a soft AI hint to all 5 analyzer prompts.
        // We always append (even when empty) so the server-side array
        // stays index-aligned with the files array; the server treats
        // empty strings as "no folder context" (the Choose-files case).
        const rel =
          typeof (f as File & { webkitRelativePath?: string }).webkitRelativePath ===
            'string' &&
          (f as File & { webkitRelativePath?: string }).webkitRelativePath !== '' &&
          (f as File & { webkitRelativePath?: string }).webkitRelativePath !== f.name
            ? (f as File & { webkitRelativePath?: string }).webkitRelativePath!
            : '';
        fd.append('relativePaths', rel);
      });
      fd.append('skipExisting', skipExisting ? 'true' : 'false');
      const res = await fetch(
        `/api/admin/bulk-import/sessions/${sessionId}/items`,
        { method: 'POST', body: fd, credentials: 'include' },
      );
      if (!res.ok) throw new Error('Upload failed');
      const json = await res.json();
      // Handle both new shape { items, skippedExisting } and legacy array
      if (Array.isArray(json)) return { items: json, skippedExisting: 0 };
      return { items: json.items ?? [], skippedExisting: json.skippedExisting ?? 0 };
    },
    onSuccess: (data) => {
      const items = data?.items ?? [];
      const count = items.length;
      const skipped = data?.skippedExisting ?? 0;
      debugLog('uploadFiles success', { sessionId, count, skippedExisting: skipped });
      if (count === 0 && skipped === 0) return;
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
      if (count > 0) {
        toast({ title: isFr ? 'Téléversement réussi' : 'Files uploaded' });
      }
      if (skipped > 0) {
        toast({
          title: isFr
            ? `${skipped} fichier(s) déjà dans Koveo ignoré(s)`
            : `${skipped} file(s) already in Koveo were skipped`,
        });
      }
    },
    onError: (err) => {
      debugLog('uploadFiles error', { sessionId, error: err instanceof Error ? err.message : String(err) });
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
      debugLog('replaceFile start', { itemId, sessionId, fileSize: file.size, mimeType: file.type });
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
      debugLog('replaceFile success', { itemId: variables.itemId, sessionId });
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
    onError: (error, variables) => {
      debugLog('replaceFile error', { itemId: variables.itemId, sessionId, error: error instanceof Error ? error.message : String(error) });
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
      debugLog('runStep start', { itemId, action, sessionId });
      // Task #1411 — pipe the admin's UI language through to the
      // commit endpoint so the four KPI events emitted server-side
      // (branch destination, residence pick, effective date, tag
      // suggestion) carry a per-locale dimension on
      // /admin/kpi-dashboard. Other actions don't read uiLanguage on
      // the server, so sending it here is harmless.
      const body = action === 'commit' ? { uiLanguage: language } : {};
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/items/${itemId}/${action}`,
        body,
      );
      return res.json();
    },
    onSuccess: (_data, { itemId, action }) => {
      debugLog('runStep success', { itemId, action, sessionId });
      // Task #1671: clear any stale commit error for this item on success.
      // Also clear on 'link' success so a re-link doesn't leave the old
      // commit error message visible while the row is back to linked state.
      if (action === 'commit' || action === 'link') {
        setCommitErrors((prev) => {
          if (!prev.has(itemId)) return prev;
          const next = new Map(prev);
          next.delete(itemId);
          return next;
        });
      }
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
    },
    onError: (err, { itemId, action }) => {
      debugLog('runStep error', { itemId, action, sessionId, error: err instanceof Error ? err.message : String(err) });
      // Task #1671: store commit errors per-item for friendlier inline messages.
      if (action === 'commit') {
        const body =
          err instanceof ApiError && err.body && typeof err.body === 'object'
            ? (err.body as Record<string, unknown>)
            : undefined;
        const errorCode = body?.errorCode as string | undefined;
        const predecessorSequence = body?.predecessorSequence as number | undefined;
        setCommitErrors((prev) => {
          const next = new Map(prev);
          next.set(itemId, {
            errorCode,
            predecessorSequence,
            message: err instanceof Error ? err.message : String(err),
          });
          return next;
        });
      }
    },
  });

  /**
   * Task #1372 — Optimistic link overrides keyed by itemId.  Moved here
   * (before runAll and resetStep) so the setters are in scope for both
   * mutations' onSuccess callbacks.  Applied on top of the server-persisted
   * values so the UI reflects drops immediately without waiting for a query
   * invalidation round-trip.  Cleared on successful mutation, after a
   * run-all linking re-run completes, after resetStep('linking') succeeds,
   * or rolled back on error.
   */
  const [linkingOverrides, setLinkingOverrides] = useState<
    Map<string, { beforeItemId: string | null; afterItemId: string | null }>
  >(new Map());

  /**
   * Auto-trigger the server-side "run-all" loop for the current AI step
   * (Task #592). The endpoint is idempotent — calling it twice while a
   * loop is in flight is a no-op — so re-renders/remounts are safe. We
   * still keep a per-(session, step) ref so we don't fire on every
   * polling refresh.
   */
  const runAll = useMutation({
    mutationFn: async (step: AutoStep) => {
      debugLog('runAll start', { sessionId, step });
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/sessions/${sessionId}/run-all`,
        { step },
      );
      return res.json();
    },
    onSuccess: (_data, step) => {
      debugLog('runAll success', { sessionId, step });
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
    },
    onError: (err, step) => {
      debugLog('runAll error', { sessionId, step, error: err instanceof Error ? err.message : String(err) });
    },
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
      debugLog('resetStep start', { sessionId, step });
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/sessions/${sessionId}/reset-step`,
        { step },
      );
      return res.json();
    },
    onSuccess: (_data, step) => {
      debugLog('resetStep success', { sessionId, step });
      // Clear the once-per-(session, step) auto-trigger guard so the
      // useEffect above will re-fire if the wizard remounts on this
      // same step. The server already kicked off a fresh run-all
      // loop, but this keeps the client and server in agreement.
      triggeredAutoRunRef.current.delete(`${sessionId}:${step}`);
      setPendingResetStep(null);
      // Task #1372 — After a linking reset, the server replaces the chain
      // topology with fresh AI pointers.  Any optimistic overrides still in
      // memory would paint a stale chain on top of the new server state.
      if (step === 'linking') {
        setLinkingOverrides(new Map());
      }
      void queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
      toast({
        title: isFr
          ? 'Étape réinitialisée — analyse relancée'
          : 'Step reset — analysis restarted',
      });
    },
    onError: (err: unknown, step) => {
      debugLog('resetStep error', { sessionId, step, error: err instanceof Error ? err.message : String(err) });
      setPendingResetStep(null);
      toast({
        variant: 'destructive',
        title: isFr
          ? "Échec de la réinitialisation de l'étape"
          : 'Failed to reset step',
      });
    },
  });

  /**
   * Task #1202: step-level "Retry AI-failed items (N)" bulk action.
   *
   * Iterates over the failed item ids the caller passes in and dispatches
   * the existing per-item retry endpoint sequentially with a small
   * client-side stagger between calls. The stagger:
   *   1. Lets each item's `inFlightPerItemRetry` marker land on the
   *      server before the next request arrives, so the server-side
   *      gate (`perItemRetryKey`) can short-circuit duplicate retries.
   *   2. Spreads the resulting Anthropic calls over time instead of
   *      bursting `N` simultaneous calls — the per-item endpoint is
   *      intentionally exempt from the run-all worker pool's pacing
   *      (see comment by `RUN_ALL_INTER_CALL_DELAY_MS`) so without
   *      this gap a 20-row bulk retry would launch 20 simultaneous AI
   *      calls.
   *
   * `bulkRetryStep` is the step currently being processed so the
   * step-level button can show a spinner. Cleared in a `finally` so
   * an unhandled error inside the loop does not leave the UI stuck.
   */
  const [bulkRetryStep, setBulkRetryStep] = useState<AutoStep | null>(null);
  const bulkRetryAbortedRef = useRef(false);
  /**
   * Task #1213 — track the size of the current bulk retry batch and
   * how many items have already been processed so the Cancel handler
   * can decide whether to ask the admin to confirm. Refs (not state)
   * because the loop reads them synchronously between iterations and
   * the dialog snapshots them into state only when it needs to render.
   */
  const bulkRetryTotalRef = useRef(0);
  const bulkRetryProcessedRef = useRef(0);
  /**
   * Task #1238 — render-visible mirror of the two refs above so the
   * spinner-bearing button (and the cancel-confirm dialog title) can
   * tick "Retrying X of N…" as each per-item retry completes. Refs
   * stay the source of truth for the synchronous Cancel handler;
   * this state is just a re-render trigger updated alongside them.
   */
  const [bulkRetryProgress, setBulkRetryProgress] = useState<{
    processed: number;
    total: number;
  }>({ processed: 0, total: 0 });
  const retryAllAiFailedItems = useCallback(
    async (
      step: AutoStep,
      itemIds: string[],
      action: 'screen' | 'sort' | 'branch' | 'identify' | 'link',
    ) => {
      if (itemIds.length === 0) return;
      bulkRetryAbortedRef.current = false;
      bulkRetryTotalRef.current = itemIds.length;
      bulkRetryProcessedRef.current = 0;
      setBulkRetryProgress({ processed: 0, total: itemIds.length });
      setBulkRetryStep(step);
      try {
        for (const id of itemIds) {
          if (bulkRetryAbortedRef.current) break;
          try {
            await runStep.mutateAsync({ itemId: id, action });
          } catch {
            // Surface failures via the row-level alert; keep iterating
            // so a single 500 doesn't block the rest of the batch.
          }
          bulkRetryProcessedRef.current += 1;
          setBulkRetryProgress({
            processed: bulkRetryProcessedRef.current,
            total: bulkRetryTotalRef.current,
          });
          // Cooperative stagger between requests. ~200ms is large
          // enough for the server to persist the in-flight marker
          // before the next per-item retry endpoint call hits the
          // gate, but small enough that the bulk action still feels
          // responsive on a typical 5-10 row failure batch.
          if (!bulkRetryAbortedRef.current) {
            await new Promise<void>((r) => setTimeout(r, 200));
          }
        }
      } finally {
        setBulkRetryStep(null);
        bulkRetryTotalRef.current = 0;
        bulkRetryProcessedRef.current = 0;
        setBulkRetryProgress({ processed: 0, total: 0 });
      }
    },
    [runStep],
  );

  /**
   * Task #1671: Bulk-commit orchestrator for the Linking step.
   *
   * Given the list of commit-eligible item IDs, groups them by their
   * primary familyId (first membership row), sorts each group by
   * sequence ascending (nulls last), then commits the items
   * sequentially within each family group while the groups themselves
   * run in parallel.  Items with no family membership are committed in
   * a separate parallel group.
   *
   * A confirmation prompt is shown before dispatching when the count
   * exceeds BULK_COMMIT_CONFIRM_THRESHOLD.
   */
  const commitSelectedItems = useCallback(
    async (itemIds: string[]) => {
      if (itemIds.length === 0) return;
      if (
        itemIds.length > BULK_COMMIT_CONFIRM_THRESHOLD &&
        !window.confirm(
          isFr
            ? `Sauvegarder ${itemIds.length} fichiers d'un coup ?`
            : `Commit ${itemIds.length} files at once?`,
        )
      ) {
        return;
      }

      type CommitEntry = { id: string; sequence: number | null };
      const familyGroups = new Map<string, CommitEntry[]>();
      const noFamilyGroup: CommitEntry[] = [];

      for (const id of itemIds) {
        const item = items.find((i) => i.id === id);
        const memberships = item?.linkingMemberships ?? [];
        if (memberships.length === 0) {
          noFamilyGroup.push({ id, sequence: null });
        } else {
          const primaryFamilyId = memberships[0].familyId;
          if (!familyGroups.has(primaryFamilyId)) {
            familyGroups.set(primaryFamilyId, []);
          }
          familyGroups.get(primaryFamilyId)!.push({ id, sequence: memberships[0].sequence });
        }
      }

      // Sort each family group by sequence ascending, nulls last.
      for (const group of familyGroups.values()) {
        group.sort((a, b) => {
          if (a.sequence === null && b.sequence === null) return 0;
          if (a.sequence === null) return 1;
          if (b.sequence === null) return -1;
          return a.sequence - b.sequence;
        });
      }

      const total = itemIds.length;
      let processed = 0;

      bulkCommitAbortRef.current = false;
      setBulkCommitRunning(true);
      setBulkCommitProgress({ processed: 0, total });

      const runGroup = async (group: CommitEntry[]) => {
        for (const { id } of group) {
          if (bulkCommitAbortRef.current) break;
          try {
            await runStep.mutateAsync({ itemId: id, action: 'commit' });
          } catch {
            // Error stored in commitErrors via runStep onError; keep iterating.
          }
          processed += 1;
          setBulkCommitProgress({ processed, total });
        }
      };

      try {
        await Promise.all([
          ...Array.from(familyGroups.values()).map(runGroup),
          runGroup(noFamilyGroup),
        ]);
      } finally {
        setBulkCommitRunning(false);
        setBulkCommitProgress({ processed: 0, total: 0 });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, isFr, runStep],
  );

  /**
   * Snapshot used by the confirm-cancel AlertDialog. Captured at the
   * moment the admin clicks Cancel so the dialog body can show
   * "Stop retrying X of N?" with stable numbers even though the loop
   * keeps advancing while the dialog is open.
   */
  const [pendingBulkRetryCancel, setPendingBulkRetryCancel] = useState<
    { total: number; remaining: number } | null
  >(null);

  // Task #1671: per-item commit error map for friendlier inline messages.
  const [commitErrors, setCommitErrors] = useState<
    Map<string, { errorCode?: string; message: string; predecessorSequence?: number }>
  >(new Map());
  // Task #1671: bulk-commit progress and abort control (mirrors bulkRetryProgress pattern).
  const [bulkCommitRunning, setBulkCommitRunning] = useState(false);
  const [bulkCommitProgress, setBulkCommitProgress] = useState<{
    processed: number;
    total: number;
  }>({ processed: 0, total: 0 });
  const bulkCommitAbortRef = useRef(false);

  /**
   * Task #1208 (immediate-cancel path) + Task #1213 (confirmation
   * path) + Task #1237 (skip the confirm once a large batch is
   * almost done). For batches smaller than
   * `BULK_RETRY_CONFIRM_THRESHOLD` we keep the original snappy
   * behaviour: flip the same abort ref the session-change effect
   * uses so the loop in `retryAllAiFailedItems` exits before
   * dispatching the next per-item retry, and eagerly clear
   * `bulkRetryStep` so the UI returns to idle without waiting for
   * the in-flight `runStep` call to settle (the loop's `finally`
   * will set it again to the same null and is a no-op). For larger
   * batches we instead open an AlertDialog and defer the abort
   * until the admin confirms, so a stray click while scanning a
   * 30-row list doesn't halt the whole batch.
   *
   * Task #1237 carve-out: once the batch is almost done — fewer
   * than `BULK_RETRY_CONFIRM_THRESHOLD` items still pending — the
   * dialog ("Stop retrying 2 of 30?") becomes more friction than
   * safety and we fall back to the immediate-cancel path. The
   * carve-out only applies when the batch started STRICTLY larger
   * than the threshold; a batch that started exactly at threshold
   * (5 rows) is already small enough that a stray click costs at
   * most 5 retries either way, so it keeps the dialog as a safety
   * net regardless of progress (Task #1240 mirrors a live "X of N"
   * count into that dialog and relies on it opening even after
   * the loop has ticked once on a 5-row batch).
   */
  const cancelBulkRetry = useCallback(() => {
    const total = bulkRetryTotalRef.current;
    const remaining = Math.max(
      0,
      total - bulkRetryProcessedRef.current,
    );
    const reachedConfirmSize = total >= BULK_RETRY_CONFIRM_THRESHOLD;
    const almostDoneOnLargeBatch =
      total > BULK_RETRY_CONFIRM_THRESHOLD &&
      remaining < BULK_RETRY_CONFIRM_THRESHOLD;
    if (reachedConfirmSize && !almostDoneOnLargeBatch) {
      setPendingBulkRetryCancel({ total, remaining });
      return;
    }
    bulkRetryAbortedRef.current = true;
    setBulkRetryStep(null);
  }, []);

  /**
   * Confirm action of the Task #1213 AlertDialog — runs the same
   * cooperative-abort path the small-batch button uses today and
   * dismisses the dialog.
   */
  const confirmBulkRetryCancel = useCallback(() => {
    bulkRetryAbortedRef.current = true;
    setBulkRetryStep(null);
    setPendingBulkRetryCancel(null);
  }, []);

  // Cooperative cancellation hook — when the wizard's session changes
  // (admin navigated away / cleared the session) any in-flight bulk
  // retry loop should stop dispatching so we don't keep firing per-
  // item retries against a stale session id.
  useEffect(() => {
    bulkRetryAbortedRef.current = true;
    setBulkRetryStep(null);
    return () => {
      bulkRetryAbortedRef.current = true;
    };
  }, [sessionId]);

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

  const runAllTransitionRef = useRef<{
    step: string | null;
    startedAt: string | null;
    finishedAt: string | null;
  }>({ step: null, startedAt: null, finishedAt: null });
  useEffect(() => {
    if (!isAutoStep(currentStep)) return;
    const prev = runAllTransitionRef.current;
    const next = {
      step: currentStep,
      startedAt: currentProgress?.startedAt ?? null,
      finishedAt: currentProgress?.finishedAt ?? null,
    };
    if (prev.step !== next.step) {
      runAllTransitionRef.current = next;
      return;
    }
    if (!prev.startedAt && next.startedAt) {
      debugLog('run-all transition pending→running', {
        sessionId,
        step: currentStep,
        startedAt: next.startedAt,
        total: currentProgress?.total ?? null,
      });
    }
    // Task #1372 — Detect run-all completion when finishedAt advances to any
    // new non-null value.  Using `!prev.finishedAt && next.finishedAt` alone
    // would miss re-runs where the previous run's finishedAt (T1) is still
    // stored and the server sets a new finishedAt (T2) without the poll ever
    // capturing the intermediate null (because the reset and completion happen
    // between two polls).  Comparing by value handles both the initial-run
    // and re-run cases.
    if (next.finishedAt && prev.finishedAt !== next.finishedAt) {
      debugLog('run-all transition running→done', {
        sessionId,
        step: currentStep,
        finishedAt: next.finishedAt,
        processed: currentProgress?.processed ?? null,
        failed: currentProgress?.failed ?? null,
        total: currentProgress?.total ?? null,
      });
      // Task #1372 — When the linking AI step finishes a re-run the server
      // has replaced the chain topology with new pointers.  Clear any
      // optimistic overrides so the UI renders server truth instead of a
      // stale chain from a previous run.
      if (currentStep === 'linking') {
        setLinkingOverrides(new Map());
      }
    }
    runAllTransitionRef.current = next;
  }, [currentStep, currentProgress?.startedAt, currentProgress?.finishedAt, sessionId, setLinkingOverrides]);

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
      debugLog('toggleExclude start', { itemId, sessionId, excluded });
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
    onSettled: (_data, err, vars) => {
      if (!err) debugLog('toggleExclude success', { itemId: vars.itemId, sessionId, excluded: vars.excluded });
      return queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
    },
  });

  /**
   * Toggle the exclusion of every checked item in one round-trip
   * (Task #1273). Mirrors `toggleExclude`'s optimistic update so the
   * cached lite payload flips immediately for all selected rows, then
   * reconciles against the server's authoritative `preExcludeStatus`
   * after the batched response lands. Terminal rows (committed /
   * duplicate) are skipped server-side and counted under
   * `skipped` — surfaced in the success toast so admins know exactly
   * how many of their checked rows were actually flipped.
   */
  const bulkToggleExclude = useMutation({
    mutationFn: async ({
      itemIds,
      excluded,
    }: {
      itemIds: string[];
      excluded: boolean;
    }) => {
      const res = await apiRequest(
        'PATCH',
        `/api/admin/bulk-import/sessions/${sessionId}/items/exclude-bulk`,
        { itemIds, excluded },
      );
      return res.json() as Promise<{
        updated: number;
        items: BulkImportItem[];
        skipped: { committed: number; duplicate: number; notFound: number };
      }>;
    },
    onMutate: async ({ itemIds, excluded }) => {
      debugLog('bulkToggleExclude start', { sessionId, count: itemIds.length, excluded });
      const queryKey = ['/api/admin/bulk-import/sessions', sessionId, 'lite'];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SessionPayloadLite>(queryKey);
      if (previous) {
        const ids = new Set(itemIds);
        queryClient.setQueryData<SessionPayloadLite>(queryKey, {
          ...previous,
          items: previous.items.map((it) => {
            if (!ids.has(it.id)) return it;
            // Mirror the per-item endpoint's terminal-state guard
            // client-side so the optimistic flip never paints a
            // committed/duplicate row as rejected.
            if (it.status === 'committed' || it.status === 'duplicate') return it;
            if (excluded) {
              if (it.status === 'rejected') return it;
              return {
                ...it,
                status: 'rejected' as const,
                preExcludeStatus: it.preExcludeStatus ?? it.status,
              };
            }
            if (it.status !== 'rejected') return it;
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
        title: isFr ? 'Échec de la mise à jour groupée' : 'Bulk update failed',
      });
    },
    onSuccess: (data, vars) => {
      debugLog('bulkToggleExclude success', {
        sessionId,
        excluded: vars.excluded,
        updated: data.updated,
        skipped: data.skipped,
      });
      const skippedTotal =
        data.skipped.committed + data.skipped.duplicate + data.skipped.notFound;
      const titleEn = vars.excluded
        ? `Excluded ${data.updated} file${data.updated === 1 ? '' : 's'}`
        : `Re-included ${data.updated} file${data.updated === 1 ? '' : 's'}`;
      const titleFr = vars.excluded
        ? `${data.updated} fichier${data.updated === 1 ? '' : 's'} exclu${data.updated === 1 ? '' : 's'}`
        : `${data.updated} fichier${data.updated === 1 ? '' : 's'} réinclus`;
      const skippedSuffixEn =
        skippedTotal > 0 ? ` (${skippedTotal} skipped)` : '';
      const skippedSuffixFr =
        skippedTotal > 0 ? ` (${skippedTotal} ignoré${skippedTotal === 1 ? '' : 's'})` : '';
      toast({
        title: (isFr ? titleFr : titleEn) + (isFr ? skippedSuffixFr : skippedSuffixEn),
      });
      clearItemSelection();
    },
    onSettled: () => {
      return queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
    },
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
      debugLog('reassignItem start', { itemId, sessionId, branch, subCategory });
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
    onSuccess: (_data, vars) => {
      debugLog('reassignItem success', { itemId: vars.itemId, sessionId, branch: vars.branch });
      setReassignPickerItemId(null);
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
      toast({
        title: isFr ? 'Fichier réaffecté' : 'File reassigned',
      });
    },
    onError: (_err, vars) => {
      debugLog('reassignItem error', { itemId: vars.itemId, sessionId, branch: vars.branch });
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
  const { data: buildingResidences = [], isError: buildingResidencesError } = useQuery<Array<{ id: string; unitNumber: string }>>({
    queryKey: ['/api/buildings', session?.buildingId, 'residences'],
    enabled: !!session?.buildingId && currentStep === 'branching',
    queryFn: async () => {
      const res = await fetch(`/api/buildings/${session!.buildingId}/residences`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
        { action, decision, mergeWithItemId, mergeWithItemIds, splitAtPage, uiLanguage: language },
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

  // ---------------------------------------------------------------------------
  // Task #1410 — Alt+K paired shortcut: accept the currently-focused
  // AI-named pending row and auto-advance to the next match.
  //
  // Task #1405 lets admins press Alt+J to jump focus to the next pending
  // row whose rename input still equals the AI suggestion verbatim. To
  // turn that into a true "scan & approve" loop they still had to mouse
  // over to the row's Accept button. Alt+K closes the loop: while focus
  // sits inside one of the AI-named rename inputs (which is exactly where
  // Alt+J leaves it), one keystroke commits the AI suggestion via the
  // same `setSortingDecision` mutation the per-row Accept button fires,
  // then jumps focus to the next still-AI-named row.
  //
  // No-op rules (so a stray Alt+K never silently overrides the admin):
  //   - Focus must sit on one of the AI-named rename inputs. Anything
  //     else (a different input, a button, the body) is ignored.
  //   - The rename value must still equal the AI suggestion verbatim;
  //     the moment the admin types anything different the row drops out
  //     of `aiNamedSortingTargets` and Alt+K becomes a no-op.
  //   - Already-in-flight `setSortingDecision` mutations short-circuit
  //     so a double-tap can't fire two POSTs against the same row.
  //
  // The hook lives next to `setSortingDecision` (instead of next to the
  // Alt+J handler higher up) because it depends on the mutation, which
  // is declared further down the function body.
  // ---------------------------------------------------------------------------
  const acceptFocusedAiNamedSortingRow = useCallback(() => {
    if (currentStep !== 'sorting') return;
    if (setSortingDecision.isPending) return;
    if (typeof document === 'undefined') return;
    const focused = document.activeElement as HTMLElement | null;
    if (!focused) return;
    const focusedTestId = focused.getAttribute('data-testid');
    if (!focusedTestId) return;
    const matchIdx = aiNamedSortingTargets.findIndex(
      (t) => t.testId === focusedTestId,
    );
    if (matchIdx === -1) return;
    const target = aiNamedSortingTargets[matchIdx];
    const item = items.find((i) => i.id === target.itemId);
    if (!item) return;
    cancelAutoSave(item.id);
    // Mirror the per-row Accept button so any inline slice/merge
    // overrides the admin staged elsewhere on the row are committed
    // alongside the AI-named rename, instead of being discarded.
    const inlineSlice = inlineSlicePage.get(item.id);
    const inlineMerge = inlineMergeOrder.get(item.id);
    if (inlineSlice !== undefined) {
      setSortingDecision.mutate({
        itemId: item.id,
        action: 'manual',
        decision: 'split',
        splitAtPage: inlineSlice,
      });
    } else if (inlineMerge !== undefined) {
      setSortingDecision.mutate({
        itemId: item.id,
        action: 'manual',
        decision: 'merge',
        mergeWithItemIds: inlineMerge.slice(1),
      });
    } else {
      setSortingDecision.mutate({ itemId: item.id, action: 'accept' });
    }
    // Auto-advance to the next still-AI-named row. We compute the next
    // target from the pre-mutation list (skipping the just-accepted
    // item) so the focus jump is synchronous and doesn't have to wait
    // for the lite-poll refetch to drop the row from the targets memo.
    const remaining = aiNamedSortingTargets.filter(
      (t) => t.itemId !== item.id,
    );
    if (remaining.length === 0) {
      aiNamedSortingCursorRef.current = -1;
      return;
    }
    const nextTarget = remaining[matchIdx % remaining.length];
    aiNamedSortingCursorRef.current = aiNamedSortingTargets.indexOf(nextTarget);
    const nextEl = document.querySelector<HTMLInputElement>(
      `[data-testid="${nextTarget.testId}"]`,
    );
    if (!nextEl) return;
    if (typeof nextEl.scrollIntoView === 'function') {
      nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    nextEl.focus({ preventScroll: true });
    try {
      nextEl.select();
    } catch {
      /* select() not supported on every input type — ignore. */
    }
  }, [
    currentStep,
    items,
    aiNamedSortingTargets,
    inlineSlicePage,
    inlineMergeOrder,
    setSortingDecision,
  ]);

  useEffect(() => {
    if (currentStep !== 'sorting') return;
    function onKeyDown(e: KeyboardEvent) {
      if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (e.key !== 'k' && e.key !== 'K') return;
      e.preventDefault();
      acceptFocusedAiNamedSortingRow();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [currentStep, acceptFocusedAiNamedSortingRow]);

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
   * Task #1386: Set or clear the existing-family link for a single item.
   * Calls POST /api/admin/bulk-import/items/:id/set-existing-link-decision.
   * After success, invalidates the session lite cache so the new
   * linkingFamilyId / linkingBeforeDocumentId / linkingAfterDocumentId fields
   * appear immediately in the row without waiting for the polling interval.
   *
   * On error, a per-item inline message is shown (EN/FR) instead of a generic toast.
   */
  /** Task #1386: per-item inline error state for the existing-family picker. */
  const [existingLinkDecisionErrors, setExistingLinkDecisionErrors] = useState<
    Map<string, { errorCode?: string; message: string }>
  >(new Map());

  /** Task #1386: map an errorCode returned by set-existing-link-decision to EN/FR copy. */
  const getExistingLinkErrorMessage = (errorCode: string | undefined): string => {
    const msgs: Record<string, [string, string]> = {
      family_not_found:      ['Famille introuvable',                       'Family not found'],
      family_not_visible:    ['Famille non autorisée',                     'Family not authorized'],
      neighbor_not_found:    ['Document voisin introuvable',               'Neighbor document not found'],
      scope_mismatch:        ['Le document voisin est hors périmètre',     'Neighbor document is out of scope'],
      self_link:             ['Impossible de lier un document à lui-même', 'Cannot link a document to itself'],
      neighbor_not_in_family:['Le voisin n\'appartient pas à cette famille', 'Neighbor does not belong to this family'],
      occupied_side:         ['Ce côté est déjà occupé dans la famille',   'This side is already occupied in the family'],
      cycle_detected:        ['Ce lien créerait une boucle dans la chaîne','This link would create a cycle in the chain'],
      missing_fields:        ['Tous les champs sont requis',               'All fields are required'],
    };
    if (!errorCode || !(errorCode in msgs)) return isFr ? 'Erreur inattendue' : 'Unexpected error';
    const [fr, en] = msgs[errorCode];
    return isFr ? fr : en;
  };

  const setExistingLinkDecision = useMutation({
    mutationFn: async ({
      itemId,
      familyId,
      neighborDocumentId,
      position,
    }: {
      itemId: string;
      familyId: string | null;
      neighborDocumentId: string | null;
      position: 'before' | 'after' | null;
    }) => {
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/items/${itemId}/set-existing-link-decision`,
        { familyId, neighborDocumentId, position },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string; errorCode?: string };
        const err = new Error(body.error ?? 'Failed to set existing link');
        (err as Error & { errorCode?: string }).errorCode = body.errorCode;
        throw err;
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
      setExistingLinkDecisionErrors((prev) => {
        const m = new Map(prev);
        m.delete(variables.itemId);
        return m;
      });
    },
    onError: (err: Error & { errorCode?: string }, variables) => {
      const code = err.errorCode;
      if (code) {
        setExistingLinkDecisionErrors((prev) => {
          const m = new Map(prev);
          m.set(variables.itemId, { errorCode: code, message: err.message });
          return m;
        });
      } else {
        toast({
          variant: 'destructive',
          title: isFr ? 'Échec de la mise à jour du lien de bibliothèque' : 'Failed to update library link',
          description: err.message,
        });
      }
    },
  });

  /**
   * Task #1549: IDs of items for which the AI family-guess reason tooltip is
   * expanded. Toggles on the reason button click.
   */
  const [guesReasonOpenIds, setGuessReasonOpenIds] = useState<Set<string>>(new Set());

  /**
   * Task #1608/#1617: IDs of family cards whose collapse state the admin
   * has manually toggled AWAY from the auto-collapse default (see
   * `familyCardAutoCollapsed` for the rule). Storing the toggled-away set
   * — rather than absolute collapse state — preserves the auto-default
   * for any new cards that appear after a reload, satisfying #1617's
   * "untouched cards still follow the default" requirement.
   */
  const [collapsedFamilyIds, setCollapsedFamilyIds] = useState<Set<string>>(new Set());

  /**
   * Task #1617: hydrate the collapse preference from localStorage whenever
   * the active session changes. Runs once on mount (after the resume effect
   * sets sessionId from STORAGE_KEY) and again whenever the admin switches
   * sessions, so each session keeps its own preference.
   */
  useEffect(() => {
    if (!sessionId) {
      setCollapsedFamilyIds(new Set());
      return;
    }
    setCollapsedFamilyIds(readPersistedCollapsedFamilyIds(sessionId));
  }, [sessionId]);

  /**
   * Task #1608: Drag state for reordering new items within a family card.
   * Tracks which item is being dragged and which slot it's hovering over.
   * Format of dragOverKey: `${familyId}::${rowIndex}`.
   *
   * Task #1616: `dragOverPosition` records whether the cursor is in the upper
   * half ('before') or lower half ('after') of the hovered row, so a thin
   * horizontal drop-zone bar can be rendered between rows instead of
   * highlighting the row itself.
   */
  const [dragSrcId, setDragSrcId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null);

  /**
   * Task #1549: "Commit to Family" — first-anchor path.
   * Calls set-existing-link-decision (first-anchor) then commit sequentially.
   */
  const commitToFamilyGuess = useMutation({
    mutationFn: async ({ itemId, familyId }: { itemId: string; familyId: string }) => {
      const decisionRes = await apiRequest(
        'POST',
        `/api/admin/bulk-import/items/${itemId}/set-existing-link-decision`,
        { familyId, neighborDocumentId: null, position: null },
      );
      if (!decisionRes.ok) {
        const body = await decisionRes.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? 'Failed to set family decision');
      }
      const commitRes = await apiRequest(
        'POST',
        `/api/admin/bulk-import/items/${itemId}/commit`,
        {},
      );
      if (!commitRes.ok) {
        const body = await commitRes.json().catch(() => ({})) as { error?: string; errorCode?: string };
        if (body.errorCode === 'first_anchor_conflict') {
          throw Object.assign(
            new Error(body.error ?? 'Another document was already committed as the first anchor for this family.'),
            { errorCode: 'first_anchor_conflict' },
          );
        }
        throw new Error(body.error ?? 'Failed to commit');
      }
      return commitRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
    },
    onError: (err: Error & { errorCode?: string }) => {
      const isConflict = err.errorCode === 'first_anchor_conflict';
      toast({
        variant: 'destructive',
        title: isConflict
          ? (isFr ? 'Conflit de premier ancrage' : 'First anchor conflict')
          : (isFr ? 'Échec de la validation de la famille' : 'Failed to commit to family'),
        description: isConflict
          ? (isFr
            ? 'Un autre document a déjà été validé comme premier ancrage pour cette famille. Choisissez un voisin à la place.'
            : 'Another document was already committed as the first anchor for this family. Please pick a neighbor instead.')
          : err.message,
      });
    },
  });

  /** Task #1386: item ID for which the "Attach to existing family" picker is open. */
  const [existingLinkPickerItemId, setExistingLinkPickerItemId] = useState<string | null>(null);
  /** Task #1386: selected family ID in the picker (controlled). */
  const [existingLinkPickerFamilyId, setExistingLinkPickerFamilyId] = useState<string>('');
  /** Task #1386: selected neighbor document ID in the picker (controlled). */
  const [existingLinkPickerDocId, setExistingLinkPickerDocId] = useState<string>('');
  /** Task #1386: selected position in the picker (controlled). */
  const [existingLinkPickerPosition, setExistingLinkPickerPosition] = useState<'before' | 'after'>('before');
  /**
   * Task #1589: when true the picker is opened for "Add to another family"
   * (POST family-memberships) rather than "Set existing link decision"
   * (which replaces the single linkingFamilyId).
   */
  const [existingLinkPickerIsAddMode, setExistingLinkPickerIsAddMode] = useState(false);

  /**
   * Task #1589: local edit buffer for the sequence position input in family group
   * item rows. Key is `${itemId}-${familyId}`. Cleared on poll refresh is intentional
   * — if the user does not save, the old value is shown on next render.
   */
  const [sequenceInputValues, setSequenceInputValues] = useState<Map<string, string>>(new Map());

  /**
   * Task #1589: create a new family membership for an item.
   * Used by the "Add to another family" picker in add mode.
   */
  const createMembership = useMutation({
    mutationFn: async ({
      itemId,
      familyId,
      neighborDocumentId,
      position,
    }: {
      itemId: string;
      familyId: string;
      neighborDocumentId: string | null;
      position: 'before' | 'after' | null;
    }) => {
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/items/${itemId}/family-memberships`,
        { familyId, neighborDocumentId, position },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string; errorCode?: string };
        throw Object.assign(new Error(body.error ?? 'Failed to create membership'), { errorCode: body.errorCode });
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
    },
    onError: (err: Error) => {
      toast({
        variant: 'destructive',
        title: isFr ? 'Échec de l\'ajout à la famille' : 'Failed to add to family',
        description: err.message,
      });
    },
  });

  /**
   * Task #1589: delete a specific family membership row.
   * Used by the per-row "Remove from this family" button inside family group cards.
   */
  const deleteMembership = useMutation({
    mutationFn: async ({ itemId, membershipId }: { itemId: string; membershipId: string }) => {
      const res = await apiRequest(
        'DELETE',
        `/api/admin/bulk-import/items/${itemId}/family-memberships/${membershipId}`,
        undefined,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? 'Failed to remove from family');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
    },
    onError: (err: Error) => {
      toast({
        variant: 'destructive',
        title: isFr ? 'Échec de la suppression du membership' : 'Failed to remove from family',
        description: err.message,
      });
    },
  });

  /**
   * Task #1589: update a membership's sequence (or other fields).
   * Task #1655: uses optimistic updates so the UI responds instantly without
   * a full re-render.  The cache is updated before the request fires; on
   * success the optimistic state stays (no refetch); on error we roll back
   * and then invalidate to resync with the server.
   */
  const updateMembership = useMutation({
    mutationFn: async ({
      itemId,
      membershipId,
      sequence,
      neighborDocumentId,
      position,
    }: {
      itemId: string;
      membershipId: string;
      sequence: number;
      familyId?: string | null;
      neighborDocumentId?: string;
      position?: 'before' | 'after';
    }) => {
      const body: Record<string, unknown> = { sequence };
      if (neighborDocumentId != null) body.neighborDocumentId = neighborDocumentId;
      if (position != null) body.position = position;
      const res = await apiRequest(
        'PATCH',
        `/api/admin/bulk-import/items/${itemId}/family-memberships/${membershipId}`,
        body,
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errBody.error ?? 'Failed to update membership');
      }
      return res.json();
    },
    onMutate: async ({ membershipId, sequence: newSeq, familyId, neighborDocumentId, position }) => {
      const queryKey = ['/api/admin/bulk-import/sessions', sessionId, 'lite'];
      await queryClient.cancelQueries({ queryKey });
      const snapshot = queryClient.getQueryData<SessionPayloadLite>(queryKey);
      if (snapshot && familyId) {
        // Collect sequence-carrying memberships in this family (mirrors the server's
        // WHERE sequence IS NOT NULL filter in renumberFamilySequences).  The moved
        // membership is always included — it is acquiring a sequence right now.
        const siblings: Array<{ itemIdx: number; mIdx: number; id: string; sequence: number | null }> = [];
        snapshot.items.forEach((item, itemIdx) => {
          item.linkingMemberships.forEach((m, mIdx) => {
            if (m.familyId === familyId && (m.sequence != null || m.id === membershipId)) {
              siblings.push({ itemIdx, mIdx, id: m.id, sequence: m.sequence });
            }
          });
        });
        // Apply the new sequence to the pinned membership and optionally clear neighbor.
        siblings.forEach((s) => {
          if (s.id === membershipId) s.sequence = newSeq;
        });
        // Sort: ascending sequence; pinned row wins any tie.
        siblings.sort((a, b) => {
          const seqA = a.sequence ?? Infinity;
          const seqB = b.sequence ?? Infinity;
          if (seqA !== seqB) return seqA - seqB;
          if (a.id === membershipId) return -1;
          if (b.id === membershipId) return 1;
          return a.id.localeCompare(b.id);
        });
        // Build a map from membershipId → new 1-based sequence.
        const newSeqById = new Map<string, number>(siblings.map((s, i) => [s.id, i + 1]));
        // Apply to the items in cache.
        const newItems = snapshot.items.map((item) => {
          const newMemberships = item.linkingMemberships.map((m) => {
            if (m.familyId !== familyId) return m;
            const updatedSeq = newSeqById.get(m.id);
            if (updatedSeq === undefined) return m;
            // Mirror the server's behavior: when sequence changes without an
            // explicit neighbor, clear the stored neighborDocumentId/position.
            const isTarget = m.id === membershipId;
            const clearNeighbor = isTarget && neighborDocumentId == null && position == null;
            return {
              ...m,
              sequence: updatedSeq,
              neighborDocumentId: clearNeighbor ? null : (isTarget && neighborDocumentId != null ? neighborDocumentId : m.neighborDocumentId),
              position: clearNeighbor ? null : (isTarget && position != null ? position : m.position),
            };
          });
          return { ...item, linkingMemberships: newMemberships };
        });
        queryClient.setQueryData<SessionPayloadLite>(queryKey, { ...snapshot, items: newItems });
      }
      return { snapshot };
    },
    onSuccess: () => {
      // Optimistic state is already applied — no refetch needed on the happy path.
    },
    onError: (err: Error, _vars, context) => {
      toast({
        variant: 'destructive',
        title: isFr ? 'Échec du réordonnancement' : 'Reorder failed',
        description: err.message,
      });
      // Roll back to the pre-mutation snapshot, then resync with the server.
      if (context?.snapshot) {
        queryClient.setQueryData(
          ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
          context.snapshot,
        );
      }
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
    },
  });

  /**
   * Task #1386: load link candidates for the item whose picker is open.
   * Only fires when `existingLinkPickerItemId` is set.
   */
  const linkCandidatesQuery = useQuery<{
    families: Array<{
      id: string;
      name: string;
      description: string | null;
      isSystem: boolean;
      documents: Array<{
        id: string;
        name: string;
        effectiveDate: string | null;
        mimeType: string | null;
        canLinkBefore: boolean;
        canLinkAfter: boolean;
      }>;
    }>;
  }>({
    queryKey: ['/api/admin/bulk-import/items', existingLinkPickerItemId, 'link-candidates'],
    enabled: existingLinkPickerItemId !== null,
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

  // ---------------------------------------------------------------------------
  // Task #1233 — Linking step drag-and-drop state
  // ---------------------------------------------------------------------------

  // linkingOverrides / setLinkingOverrides are declared earlier in the
  // component (before runAll / resetStep) so those mutations' onSuccess
  // callbacks can call setLinkingOverrides.  See Task #1372.

  /**
   * Task #1372 — When the lite poll fails while on the linking step, a
   * non-blocking banner warns the admin that the chain view may be stale.
   * This flag tracks whether the admin has dismissed that banner.  It resets
   * whenever a successful poll lands (liteDataUpdatedAt advances) so the
   * warning re-appears if the connection drops again after recovering.
   */
  const [linkingStaleDataDismissed, setLinkingStaleDataDismissed] = useState(false);

  /**
   * Task #1534 — When the linking run-all finishes with zero linked items,
   * a banner explains why.  Dismissible for the rest of the session view;
   * state lives in component state (not persisted) so a fresh run-all
   * after a reset shows the banner again.
   */
  const [linkingEmptyResultDismissed, setLinkingEmptyResultDismissed] = useState(false);

  /** ID of the item currently being dragged (linking step only). */
  const [linkingDragId, setLinkingDragId] = useState<string | null>(null);

  /**
   * Drop indicator state: which item the dragged item would land relative to,
   * and whether above or below it.  Used to render the insertion line.
   */
  const [linkingDropTarget, setLinkingDropTarget] = useState<{
    targetId: string;
    position: 'before' | 'after';
  } | null>(null);

  /** aria-live announcement updated after each keyboard or mouse drop. */
  const [linkingAnnouncement, setLinkingAnnouncement] = useState('');

  /**
   * Task #1233: Persist admin-curated linking chain positions via the new
   * set-linking-decision endpoint.  Fires one call per changed item in
   * parallel and waits for all to settle.  On any error, rolls back the
   * optimistic override and shows a destructive toast.
   */
  const setLinkingDecision = useMutation({
    mutationFn: async (
      changes: Array<{ itemId: string; beforeItemId: string | null; afterItemId: string | null }>,
    ) => {
      debugLog('setLinkingDecision start', { count: changes.length, sessionId });
      // Use the batch endpoint so all writes are wrapped in a single DB
      // transaction — either all succeed or none are applied (all-or-rollback).
      await apiRequest(
        'POST',
        `/api/admin/bulk-import/sessions/${sessionId}/batch-set-linking-decisions`,
        { decisions: changes },
      );
    },
    onSuccess: () => {
      debugLog('setLinkingDecision success', { sessionId });
      setLinkingOverrides(new Map()); // clear optimistic state — server is now source of truth
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
    },
    onError: (err: unknown, _changes) => {
      debugLog('setLinkingDecision error', { sessionId, error: err instanceof Error ? err.message : String(err) });
      // The batch endpoint is transactional; on error nothing was written.
      // Simply reset the optimistic overrides so the UI reverts to server state.
      setLinkingOverrides(new Map());
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
      toast({
        variant: 'destructive',
        title: isFr
          ? 'Erreur lors de la mise à jour des liaisons'
          : 'Failed to update linking chain',
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });

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

  // ---------------------------------------------------------------------------
  // Task #1233 — Linking step DnD helper functions
  // ---------------------------------------------------------------------------

  /**
   * Returns the effective before/after IDs for an item, preferring any
   * optimistic override over the server-persisted value.
   */
  function getLinkingEffective(id: string) {
    const ov = linkingOverrides.get(id);
    const it = items.find((i) => i.id === id);
    return {
      before: ov !== undefined ? ov.beforeItemId : (it?.linkingBeforeItemId ?? null),
      after: ov !== undefined ? ov.afterItemId : (it?.linkingAfterItemId ?? null),
    };
  }

  /**
   * Task #1372 — Map of every item's server-persisted before/after pointers,
   * without optimistic overrides.  Passed into the change computers so the
   * stale-neighbor sweep can find invisible items whose persisted pointers
   * still reference chain members being mutated, and emit nulling corrections
   * for them.  Built from the current items snapshot; recalculated on each
   * render (items is already a reference from the lite-poll cache).
   */
  const persistedPointerMap = new Map(
    items.map((it) => [
      it.id,
      {
        before: it.linkingBeforeItemId,
        after: it.linkingAfterItemId,
      },
    ]),
  );

  /**
   * Apply computed changes optimistically and fire the persistence mutation.
   * Each entry in `changes` replaces that item's before/after values.
   */
  function applyLinkingChanges(
    changes: Array<{ itemId: string; beforeItemId: string | null; afterItemId: string | null }>,
  ) {
    if (!changes.length) return;
    setLinkingOverrides((prev) => {
      const next = new Map(prev);
      for (const { itemId, beforeItemId, afterItemId } of changes) {
        next.set(itemId, { beforeItemId, afterItemId });
      }
      return next;
    });
    debugLog('linking: apply changes', { sessionId, count: changes.length });
    setLinkingDecision.mutate(changes);
  }

  /**
   * Core drop handler: inserts `dragId` immediately before or after `targetId`.
   *
   * Instead of patching neighbors incrementally (which leaves stale pointers
   * when the moved item was adjacent to the target), we derive the full
   * ordered sequence for every affected chain, perform the reorder in the
   * array, and then regenerate consistent before/after pairs for every item
   * in those sequences.  This guarantees the resulting topology is correct
   * regardless of where in the chain the drag starts or ends.
   */
  function handleLinkingDrop(dragId: string, targetId: string, position: 'before' | 'after') {
    const changes = computeLinkingDropChanges(dragId, targetId, position, getLinkingEffective, persistedPointerMap);
    if (changes.length === 0) return;
    applyLinkingChanges(changes);
  }

  /**
   * Detaches `dragId` from whatever chain it belongs to, making it standalone
   * (before = null, after = null) and reconnecting its former neighbors.
   */
  function handleLinkingMakeStandalone(dragId: string) {
    const changes = computeLinkingMakeStandaloneChanges(dragId, getLinkingEffective, persistedPointerMap);
    if (changes.length === 0) return;
    applyLinkingChanges(changes);
  }

  /**
   * Detaches every member of a chain at once: each member becomes
   * standalone (before = null, after = null).  Used by the "Break group"
   * button in the chain header.
   */
  function handleLinkingBreakGroup(itemIds: string[]) {
    const changes = computeLinkingBreakGroupChanges(itemIds, getLinkingEffective, persistedPointerMap);
    if (changes.length === 0) return;
    applyLinkingChanges(changes);
    const count = changes.length;
    setLinkingAnnouncement(
      isFr
        ? `Chaîne dissociée — ${count} fichier${count > 1 ? 's' : ''} désormais autonome${count > 1 ? 's' : ''}`
        : `Chain broken — ${count} file${count > 1 ? 's' : ''} now standalone`,
    );
  }

  /**
   * Keyboard DnD for linking rows: ArrowUp/Down moves within a group,
   * ArrowLeft makes the item standalone, ArrowRight joins the next group.
   */
  function handleLinkingKeyDown(
    e: React.KeyboardEvent,
    itemId: string,
    _groupId: string | null,
  ) {
    const { groups } = resolveLinkingGroups(items, linkingOverrides);
    const currentGroup = groups.find((g) => g.items.some((i) => i.id === itemId));
    const currentIdx = currentGroup?.items.findIndex((i) => i.id === itemId) ?? -1;

    if (e.key === 'ArrowUp' && currentGroup && currentIdx > 0) {
      e.preventDefault();
      handleLinkingDrop(itemId, currentGroup.items[currentIdx - 1].id, 'before');
      setLinkingAnnouncement(
        isFr
          ? `Position ${currentIdx} sur ${currentGroup.items.length}`
          : `Position ${currentIdx} of ${currentGroup.items.length}`,
      );
    } else if (e.key === 'ArrowDown' && currentGroup && currentIdx < currentGroup.items.length - 1) {
      e.preventDefault();
      handleLinkingDrop(itemId, currentGroup.items[currentIdx + 1].id, 'after');
      setLinkingAnnouncement(
        isFr
          ? `Position ${currentIdx + 2} sur ${currentGroup.items.length}`
          : `Position ${currentIdx + 2} of ${currentGroup.items.length}`,
      );
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handleLinkingMakeStandalone(itemId);
      setLinkingAnnouncement(isFr ? 'Fichier dissocié du groupe' : 'File removed from group');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      // Find the next group *below* the current item in visual order.
      // Groups are ordered by the position of their head item in `items`.
      let nextGroup: LinkingGroup<BulkImportItemLite> | undefined;
      if (currentGroup) {
        // Grouped item: join the group immediately after the current one.
        const currentGroupIdx = groups.findIndex((g) => g.id === currentGroup.id);
        nextGroup = groups[currentGroupIdx + 1];
      } else {
        // Standalone item: join the first group whose head appears after this
        // item in the flat items list, falling back to the first group overall.
        const itemIdx = items.findIndex((i) => i.id === itemId);
        nextGroup =
          groups.find((g) => items.findIndex((vi) => vi.id === g.items[0].id) > itemIdx) ??
          groups[0];
      }
      if (nextGroup) {
        handleLinkingDrop(itemId, nextGroup.items[nextGroup.items.length - 1].id, 'after');
        setLinkingAnnouncement(
          isFr
            ? `Déplacé dans le groupe suivant, position ${nextGroup.items.length + 1}`
            : `Moved to next group, position ${nextGroup.items.length + 1}`,
        );
      }
    }
  }

  const stepIndex = useMemo(() => STEP_ORDER.indexOf(currentStep), [currentStep]);

  const helpIntro = isFr
    ? "Importez en lot des dossiers de documents (PDF, Word, Excel, ODS, CSV, TSV, images) pour un immeuble. L'assistant vous guide à travers 7 étapes. Vous pouvez fermer la page à tout moment et reprendre — la session est sauvegardée."
    : 'Bulk-import folders of mixed documents (PDF, Word, Excel, ODS, CSV, TSV, images) for one building. The wizard walks you through 7 steps. You can close the page at any time and resume — the session is saved.';

  const stepDescriptions: Record<BulkImportStep, string> = isFr
    ? {
        upload:
          "Choisissez l'immeuble et déposez les documents (PDF, Word, Excel, ODS, CSV, TSV, images) à traiter.",
        screening:
          "L'IA lit chaque fichier et décide s'il s'agit d'un vrai document à conserver ou à écarter.",
        // Descriptions are keyed by internal step key, so they swap in
        // lockstep with the labels above to remain coherent: step
        // `sorting` (keep/merge/split) gets the "Aiguillage" copy, and
        // step `branching` (destination bucket) gets the "Tri" copy.
        sorting:
          "Les fichiers contenant plusieurs documents sont scindés au besoin en documents distincts. Astuce : utilisez « Suggestion suivante » (Alt+J) pour aller à la prochaine ligne en attente dont le nom correspond encore à la suggestion de l'IA, puis Alt+K pour accepter la ligne actuellement ciblée et passer à la suivante.",
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
          'Choose the building and drop in the documents (PDF, Word, Excel, ODS, CSV, TSV, images) you want to process.',
        screening:
          'The AI reads each file and decides whether it looks like a real document worth keeping or should be discarded.',
        // Descriptions are keyed by internal step key, so they swap in
        // lockstep with the labels above to remain coherent: step
        // `sorting` (keep/merge/split) gets the "Branching" copy, and
        // step `branching` (destination bucket) gets the "Sorting" copy.
        sorting:
          'Files that contain several documents are split into the right number of separate documents when needed. Tip: use "Next AI suggestion" (Alt+J) to jump to the next pending row whose rename still matches the AI suggestion, then Alt+K to accept the currently focused row and advance to the next match.',
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
              data-testid={`alert-ai-unavailable${aiFallbackReason ? `-${aiFallbackReason}` : ''}`}
              className="border-amber-300 bg-amber-50 text-amber-900 [&>svg]:text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 dark:[&>svg]:text-amber-100"
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {aiFallbackReason === 'model_misconfigured'
                  ? (isFr ? 'IA mal configurée' : 'AI misconfigured')
                  : (isFr ? 'IA indisponible' : 'AI unavailable')}
              </AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  {aiFallbackReason === 'model_misconfigured'
                    ? t('aiUnavailableMisconfigured')
                    : t('aiUnavailableNoApiKey')}
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
                                  data-testid={`option-building-type-${t}`}
                                >
                                  {enumLabels.buildingType(t, isFr ? 'fr' : 'en')}
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
                                className="text-xs font-semibold tracking-wide text-muted-foreground"
                                data-testid={`group-org-header-${group.id}`}
                              >
                                {group.name}
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                {group.items.map((b) => {
                                  const selected = buildingId === b.id;
                                  const titleCasedCity = b.city
                                    ? b.city.replace(/\b\w/g, (c) => c.toUpperCase())
                                    : null;
                                  const location = [titleCasedCity, b.province]
                                    .filter(Boolean)
                                    .join(', ');
                                  const typeLabel = b.buildingType
                                    ? enumLabels.buildingType(b.buildingType, isFr ? 'fr' : 'en')
                                    : null;
                                  const addressIsSameAsName =
                                    b.address?.trim().toLowerCase() === b.name?.trim().toLowerCase();
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
                                        {b.address && !addressIsSameAsName && (
                                          <div className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                                            <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                            <span className="truncate">{b.address}</span>
                                          </div>
                                        )}
                                        {location && (
                                          <div className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                                            {addressIsSameAsName && (
                                              <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                            )}
                                            <span className="truncate">{location}</span>
                                          </div>
                                        )}
                                        <div className="mt-1 flex flex-wrap items-center gap-1">
                                          {typeof b.totalUnits === 'number' && (
                                            <Badge variant="secondary" className="text-[10px]">
                                              {b.totalUnits}{' '}
                                              {isFr ? 'unités' : 'units'}
                                            </Badge>
                                          )}
                                          {typeLabel && (
                                            <Badge
                                              variant="outline"
                                              className="text-[10px]"
                                            >
                                              {typeLabel}
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
                <CardContent className="overflow-x-auto pt-6 pb-4">
                  <div className="flex min-w-max items-center gap-2">
                    {STEP_ORDER.map((s, i) => (
                      <div key={s} className="flex items-center gap-2">
                        <button
                          onClick={() => updateStep.mutate(s)}
                          className={`whitespace-nowrap rounded-md px-3 py-1 text-sm transition ${
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
                          <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                  </div>
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
                    <div className="flex items-start gap-3 rounded-md border p-3">
                      <Checkbox
                        id="skip-existing-checkbox"
                        checked={skipExisting}
                        onCheckedChange={(v) => setSkipExisting(v === true)}
                        data-testid="checkbox-skip-existing"
                      />
                      <div className="space-y-1">
                        <Label
                          htmlFor="skip-existing-checkbox"
                          className="cursor-pointer font-medium"
                        >
                          {isFr
                            ? 'Importer uniquement les fichiers absents de Koveo'
                            : 'Only import files not already in Koveo'}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {isFr
                            ? 'Les fichiers déjà engagés dans Koveo pour cette organisation seront ignorés automatiquement.'
                            : 'Files whose content is already committed in Koveo for this organization will be skipped automatically.'}
                        </p>
                      </div>
                    </div>
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
                    <p className="text-xs text-muted-foreground">
                      {isFr
                        ? 'Formats acceptés : PDF, Word, Excel (.xlsx, .xls, .xlsm), ODS, CSV, TSV, images'
                        : 'Accepted formats: PDF, Word, Excel (.xlsx, .xls, .xlsm), ODS, CSV, TSV, images'}
                    </p>
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
                            onClick={() => setPreviewItem({ id: item.id, originalName: item.originalName, mimeType: item.mimeType, chainSiblings: [], chainIndex: 0 })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setPreviewItem({ id: item.id, originalName: item.originalName, mimeType: item.mimeType, chainSiblings: [], chainIndex: 0 });
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
                  <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                    <CardTitle>
                      {isFr ? 'Étape :' : 'Step:'} {stepLabels[currentStep]}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                      {/* Task #1405 — "Next AI suggestion" button. Only
                          surfaced on the Sorting step where the rename
                          input is pre-filled with the AI's suggestion;
                          the title attribute announces the Alt+J
                          shortcut in the same locale as the label so
                          keyboard-driven admins can discover it. */}
                      {currentStep === 'sorting' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={goToNextAiNamedSortingRow}
                          disabled={aiNamedSortingTargets.length === 0}
                          data-testid="button-next-ai-named-sorting"
                          title={
                            isFr
                              ? "Aller à la prochaine ligne en attente dont le nom correspond encore à la suggestion de l'IA (raccourci : Alt+J). Une fois ciblée, appuyez sur Alt+K pour accepter cette ligne et passer à la suivante."
                              : 'Jump to the next pending row whose rename still matches the AI suggestion (shortcut: Alt+J). Once focused, press Alt+K to accept that row and advance to the next match.'
                          }
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          {isFr
                            ? `Suggestion suivante (${aiNamedSortingTargets.length})`
                            : `Next AI suggestion (${aiNamedSortingTargets.length})`}
                        </Button>
                      )}
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
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Lite-status poll interruption banner (Task #1234) —
                        the linking run is the long-tail step where the
                        underlying DB-heavy lite endpoint is most likely
                        to start returning JSON 500s mid-run (Task #1231
                        switched it from a proxy 502 to a JSON 500 so the
                        frontend no longer crashes). When that happens
                        the counter freezes silently because TanStack
                        keeps the previous payload around; this inline
                        warning tells the admin the status updates have
                        paused so they don't mistake a stalled connection
                        for a stalled job. It auto-clears as soon as a
                        successful poll comes back. Task #1234 introduced
                        this banner scoped to the linking step; Task #1247
                        widened the gate to every auto step (screening,
                        sorting, branching, identification, linking) since
                        they all rely on the same /sessions/:id/lite poll. */}
                    {isAutoStep(currentStep) && litePollInterrupted && (
                      <div
                        className="mb-3 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
                        data-testid="lite-poll-interrupted-banner"
                        role="status"
                      >
                        <AlertTriangle
                          className="h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          {isFr
                            ? 'Mises à jour du statut interrompues — nouvelle tentative…'
                            : 'Status updates paused — retrying…'}
                        </span>
                      </div>
                    )}
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
                        // Task #1202: ids of rows whose AI step failed with
                        // a transient reason (api_error / unreadable_response)
                        // and are still candidates for the retry endpoint.
                        // Excluded rows are filtered out so a manual exclude
                        // doesn't ask the analyzer to re-run a file the
                        // admin already gave up on.
                        const aiFailedItemIds = items
                          .filter((it) => {
                            if (it.status === 'rejected') return false;
                            const dec = getItemStepDecision(it, currentStep);
                            return (
                              !!dec?.fallbackReason &&
                              RETRYABLE_AI_FALLBACK_REASON_SET.has(dec.fallbackReason)
                            );
                          })
                          .map((it) => it.id);
                        const aiFailedCount = aiFailedItemIds.length;
                        const stepBulkRetryRunning =
                          bulkRetryStep === currentStep;
                        // Task #1209: top-of-step "service may be
                        // degraded" banner. Denominator is the total
                        // count of items in the session for the current
                        // step (matches the "N of M" framing in the
                        // task brief, e.g. "6 of 12 sorting items").
                        // The banner only renders when the rate of
                        // retryable AI failures crosses
                        // AI_DEGRADED_FAILURE_RATE_THRESHOLD AND there
                        // is at least one row to act on — otherwise
                        // the per-row yellow alerts are sufficient.
                        const totalForRate = items.length;
                        const aiFailureRate =
                          totalForRate > 0
                            ? aiFailedCount / totalForRate
                            : 0;
                        const showDegradedBanner =
                          aiFailedCount > 0 &&
                          aiFailureRate > AI_DEGRADED_FAILURE_RATE_THRESHOLD;
                        const stepLabel = stepLabels[currentStep];
                        return (
                          <>
                            {showDegradedBanner && (
                              <div
                                className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
                                data-testid={`auto-run-ai-degraded-banner-${currentStep}`}
                                role="status"
                              >
                                <AlertTriangle
                                  className="h-4 w-4 shrink-0"
                                  aria-hidden="true"
                                />
                                <span
                                  className="flex-1"
                                  data-testid={`auto-run-ai-degraded-message-${currentStep}`}
                                >
                                  {isFr
                                    ? `Anthropic a retourné des erreurs pour ${aiFailedCount} des ${totalForRate} fichiers de l'étape « ${stepLabel} » — le service est peut-être dégradé en ce moment.`
                                    : `Anthropic returned errors for ${aiFailedCount} of ${totalForRate} ${stepLabel} items — service may be degraded right now.`}
                                </span>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded text-xs font-medium text-amber-900 underline hover:text-amber-950 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-200 dark:hover:text-amber-100"
                                  data-testid={`auto-run-ai-degraded-retry-${currentStep}`}
                                  disabled={stepBulkRetryRunning}
                                  onClick={() => {
                                    if (!isAutoStep(currentStep)) return;
                                    void retryAllAiFailedItems(
                                      currentStep,
                                      aiFailedItemIds,
                                      stepRetryAction[currentStep],
                                    );
                                  }}
                                >
                                  {stepBulkRetryRunning ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RotateCw className="h-3 w-3" />
                                  )}
                                  {stepBulkRetryRunning
                                    ? isFr
                                      ? `Réessai de ${bulkRetryProgress.processed} sur ${bulkRetryProgress.total}…`
                                      : `Retrying ${bulkRetryProgress.processed} of ${bulkRetryProgress.total}…`
                                    : isFr
                                    ? `Réessayer les fichiers en échec IA (${aiFailedCount})`
                                    : `Retry AI-failed items (${aiFailedCount})`}
                                </button>
                              </div>
                            )}
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
                                {/* Task #1202: step-level "Retry AI-failed
                                    items (N)" surfaces only when there is at
                                    least one transient-failure row to act on.
                                    Disabled while the bulk loop for THIS step
                                    is already running so a double-click can't
                                    queue duplicate retries (the per-item
                                    server gate would no-op them anyway, but
                                    surfacing the disabled state matches admin
                                    expectations). */}
                                {aiFailedCount > 0 && isAutoStep(currentStep) && (
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 text-xs text-amber-800 underline hover:text-amber-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-300 dark:hover:text-amber-200"
                                    data-testid={`auto-run-retry-failed-${currentStep}`}
                                    disabled={stepBulkRetryRunning}
                                    onClick={() => {
                                      if (!isAutoStep(currentStep)) return;
                                      void retryAllAiFailedItems(
                                        currentStep,
                                        aiFailedItemIds,
                                        stepRetryAction[currentStep],
                                      );
                                    }}
                                  >
                                    {stepBulkRetryRunning ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <RotateCw className="h-3 w-3" />
                                    )}
                                    {stepBulkRetryRunning
                                      ? isFr
                                        ? `Réessai de ${bulkRetryProgress.processed} sur ${bulkRetryProgress.total}…`
                                        : `Retrying ${bulkRetryProgress.processed} of ${bulkRetryProgress.total}…`
                                      : isFr
                                      ? `Réessayer les fichiers en échec IA (${aiFailedCount})`
                                      : `Retry AI-failed items (${aiFailedCount})`}
                                  </button>
                                )}
                                {/* Task #1208: in-page Cancel for the
                                    bulk retry loop. Sits beside the
                                    spinner-bearing Retry button so the
                                    admin has an obvious way to abort a
                                    long batch (wrong building, AI still
                                    down, …) without refreshing or
                                    navigating away. Cooperative —
                                    flips the same abort ref the
                                    session-change effect uses, so the
                                    in-flight per-item runStep call
                                    completes but no further retries
                                    are dispatched. */}
                                {stepBulkRetryRunning && (
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground"
                                    data-testid={`auto-run-retry-cancel-${currentStep}`}
                                    onClick={cancelBulkRetry}
                                  >
                                    <X className="h-3 w-3" />
                                    {isFr ? 'Annuler' : 'Cancel'}
                                  </button>
                                )}
                                {/* Task #1243: explicit "Run All" trigger so
                                    admins can manually kick the run-all loop
                                    for the current auto step. The loop is
                                    auto-fired once per (session, step) visit
                                    via the useEffect at line ~2529, but items
                                    can become eligible after that initial
                                    trigger (e.g. identification just finished,
                                    or transient AI failures rolled back to a
                                    pre-step status). The Linking step
                                    especially benefits because items finish
                                    identification asynchronously and can land
                                    in `identified` after the auto-trigger has
                                    already fired. The endpoint is idempotent
                                    — calling it while a loop is in flight is
                                    a server-side no-op — so the button stays
                                    safe to click. Disabled while the run-all
                                    loop is already in flight (`isRunning`) or
                                    a reset is being applied. */}
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                  data-testid={`auto-run-trigger-${currentStep}`}
                                  disabled={isRunning || resetStep.isPending}
                                  onClick={() => {
                                    if (isAutoStep(currentStep)) {
                                      runAll.mutate(currentStep);
                                    }
                                  }}
                                >
                                  <Play
                                    className={`h-3 w-3 ${runAll.isPending ? 'animate-pulse' : ''}`}
                                  />
                                  {isFr ? 'Tout exécuter' : 'Run all'}
                                </button>
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
                          </>
                        );
                      })()}
                    {currentStep === 'branching' ? (() => {
                      // Group items by destination branch. Items without a
                      // branch (old sessions or not-yet-routed) go under
                      // "Unsorted" at the top (Task #768).
                      // Task #804 filtered out excluded (rejected) files from
                      // the branching view. Task #1225 reverses this: branching
                      // is always an AI auto-step so every row — including
                      // excluded ones — must be reachable so admins can click
                      // Retry without first un-excluding the row.
                      const branchingItems = items;
                      // Task #1045: when the hide-ready toggle is ON, filter
                      // out items that are already ready for the next step
                      // before grouping so group counts and empty groups stay
                      // consistent with the rendered rows. Bulk-action banners
                      // (Accept all / Review AI suggestions) still read the
                      // unfiltered branchingItems so they remain accurate.
                      // Task #1225: excluded (rejected) items are always kept
                      // in displayedBranchingItems even when hideReady is ON.
                      // isItemReadyForNextStep returns true for rejected rows
                      // because their status clears the branching status gates,
                      // but we must keep them visible so the Retry button is
                      // reachable without first un-excluding the file.
                      const displayedBranchingItems = hideReady
                        ? branchingItems.filter((item) => item.status === 'rejected' || !isItemReadyForNextStep(item, 'branching'))
                        : branchingItems;
                      const grouped = new Map<string, BulkImportItemLite[]>();
                      // Excluded items (status === 'rejected') that have never been
                      // assigned a branch destination are intentionally skipped here.
                      // Placing them in the 'Unsorted' bucket creates noise when all
                      // files in a session were excluded before branching ran.
                      // Excluded items WITH a branch still appear in their section so
                      // the per-row Retry button remains reachable (Task #1225).
                      const itemsToGroup = displayedBranchingItems.filter(
                        (item) => !(item.status === 'rejected' && item.branch === null),
                      );
                      for (const item of itemsToGroup) {
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
                            {hideReady && itemsToGroup.length === 0 && branchingItems.length > 0 && branchingItems.some((i) => i.status !== 'rejected')
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
                                {isFr ? 'Confirmer toutes les suggestions IA' : 'Confirm all AI suggestions'}
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
                                {section.key !== 'unsorted' && (() => {
                                  const scCounts = new Map<string, number>();
                                  for (const it of section.items) {
                                    if (it.subCategory) scCounts.set(it.subCategory, (scCounts.get(it.subCategory) ?? 0) + 1);
                                  }
                                  if (scCounts.size === 0) return null;
                                  return Array.from(scCounts.entries()).map(([sc, cnt]) => (
                                    <Badge
                                      key={sc}
                                      variant="outline"
                                      className="text-[11px] border-purple-200 bg-purple-50/50 text-purple-800 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-300"
                                      data-testid={`branching-section-subcat-${section.key}-${sc}`}
                                    >
                                      {subCatLabelsHeader[sc] ?? sc}: {cnt}
                                    </Badge>
                                  ));
                                })()}
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
                                  <div className="flex flex-col gap-1 w-full sm:w-auto">
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
                                        className="h-8 w-full sm:w-[200px] text-xs"
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
                                  <div className="flex flex-col gap-1 w-full sm:w-auto">
                                    <Label className="text-xs">{isFr ? 'Sous-catégorie' : 'Sub-category'}</Label>
                                    <Select
                                      value={groupReassignSubCategory}
                                      onValueChange={setGroupReassignSubCategory}
                                    >
                                      <SelectTrigger
                                        className="h-8 w-full sm:w-[200px] text-xs"
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
                                    <div className="flex flex-col gap-1 w-full sm:w-auto">
                                      <Label className="text-xs">
                                        {isFr ? 'Résidence' : 'Residence'}
                                      </Label>
                                      <Select
                                        value={groupReassignResidenceId}
                                        onValueChange={setGroupReassignResidenceId}
                                      >
                                        <SelectTrigger
                                          className="h-8 w-full sm:w-[220px] text-xs"
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
                                  const isExcluded = item.status === 'rejected';
                                  // Task #1225: inline Retry is available on every
                                  // row that has a retry action for the current auto
                                  // step, regardless of fallback/run-all state,
                                  // exclusion, or manual overrides. Warning
                                  // title/aria-label hints are shown on excluded /
                                  // overridden rows so the admin knows what will happen.
                                  const showRetry = !!retryAction;
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
                                          onClick={() => setPreviewItem({ id: item.id, originalName: item.originalName, mimeType: item.mimeType, chainSiblings: [], chainIndex: 0 })}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              setPreviewItem({ id: item.id, originalName: item.originalName, mimeType: item.mimeType, chainSiblings: [], chainIndex: 0 });
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
                                          {showRetry && retryAction && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => runStep.mutate({ itemId: item.id, action: retryAction })}
                                              disabled={retryPending}
                                              data-testid={`button-retry-${currentStep}-${item.id}`}
                                              title={
                                                isExcluded
                                                  ? (isFr ? 'Relancer l\'IA — cette ligne restera exclue' : 'Re-run AI — this row will stay excluded')
                                                  : item.branchManualOverride
                                                  ? (isFr ? 'Relancer l\'IA — votre choix manuel pourrait être écrasé' : 'Re-run AI — this may overwrite your manual choice')
                                                  : undefined
                                              }
                                              aria-label={
                                                isExcluded
                                                  ? (isFr ? 'Relancer l\'IA — cette ligne restera exclue' : 'Re-run AI — this row will stay excluded')
                                                  : item.branchManualOverride
                                                  ? (isFr ? 'Relancer l\'IA — votre choix manuel pourrait être écrasé' : 'Re-run AI — this may overwrite your manual choice')
                                                  : (isFr ? 'Réessayer' : 'Retry')
                                              }
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
                                                  <>
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
                                                    {item.residenceConfidence != null && (() => {
                                                      const band = bandForConfidence(item.residenceConfidence);
                                                      const label = confidenceBandLabel(item.residenceConfidence, isFr);
                                                      const chipClass = band === 'high'
                                                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200'
                                                        : band === 'medium'
                                                          ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200'
                                                          : 'border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200';
                                                      return (
                                                        <Badge
                                                          variant="outline"
                                                          className={`shrink-0 ${chipClass} text-xs`}
                                                          data-testid={`badge-residence-confidence-${item.id}`}
                                                        >
                                                          {label}
                                                        </Badge>
                                                      );
                                                    })()}
                                                  </>
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
                                              <FallbackReasonBadge reason={decision?.fallbackReason} isFr={isFr} retryCount={decision?.retryCount} />
                                              {/*
                                                Task #1220: surface the
                                                "Analyzed from text only"
                                                badge in the Branching step
                                                too. The branching layout has
                                                its own card above and never
                                                hits the shared block, so the
                                                badge is added inline here.
                                                Suppressed when the step
                                                recorded an error fallback so
                                                the error badge keeps
                                                precedence, mirroring the
                                                Screening behaviour from
                                                Task #1217.
                                              */}
                                              {!item.branchingFallback && (
                                                <TextOnlyDegradedBadge
                                                  degraded={item.branchingDegraded}
                                                  isFr={isFr}
                                                />
                                              )}
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
                                      {/* Task #1207: surface the full "AI service error"
                                          alert (with inline Retry) on branching rows so
                                          recovery is one click away — matches what the
                                          sorting and screening step rows already offer.
                                          Task #1225: no longer suppressed for excluded
                                          rows or branchManualOverride rows — the backend
                                          endpoint runs unconditionally and Retry is always
                                          available (with a hover/focus warning when the
                                          row has a manual override). */}
                                      {decision?.fallbackReason && (
                                        <div
                                          className="border-t bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                          data-testid={`detail-fallback-explanation-${item.id}`}
                                        >
                                          <p className="font-medium">
                                            {(isFr ? FALLBACK_REASON_LABELS.fr : FALLBACK_REASON_LABELS.en)[decision.fallbackReason]}
                                          </p>
                                          <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                                            {(isFr ? FALLBACK_REASON_EXPLANATIONS.fr : FALLBACK_REASON_EXPLANATIONS.en)[decision.fallbackReason]}
                                          </p>
                                          {(() => {
                                            const retryLine = formatRetryAttempts(decision.retryCount, isFr);
                                            return retryLine ? (
                                              <p
                                                className="mt-0.5 text-amber-700 dark:text-amber-400"
                                                data-testid={`detail-fallback-retry-${item.id}`}
                                              >
                                                {retryLine}
                                              </p>
                                            ) : null;
                                          })()}
                                          <InlineFallbackRetryButton
                                            itemId={item.id}
                                            fallbackReason={decision.fallbackReason}
                                            retryAction={retryAction}
                                            retryPending={retryPending}
                                            hideRetry={!showRetry}
                                            isFr={isFr}
                                            onRetry={() =>
                                              retryAction &&
                                              runStep.mutate({
                                                itemId: item.id,
                                                action: retryAction,
                                              })
                                            }
                                          />
                                        </div>
                                      )}
                                      {isPickerOpen && (
                                        <div
                                          className="border-t bg-muted/30 px-3 py-3 flex flex-wrap items-end gap-3"
                                          data-testid={`reassign-picker-${item.id}`}
                                        >
                                          <div className="flex flex-col gap-1 w-full sm:w-auto">
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
                                              <SelectTrigger className="h-8 w-full sm:w-[200px] text-xs" data-testid={`reassign-branch-select-${item.id}`}>
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
                                          <div className="flex flex-col gap-1 w-full sm:w-auto">
                                            <Label className="text-xs">{isFr ? 'Sous-catégorie' : 'Sub-category'}</Label>
                                            <Select
                                              value={reassignSubCategory}
                                              onValueChange={setReassignSubCategory}
                                            >
                                              <SelectTrigger className="h-8 w-full sm:w-[200px] text-xs" data-testid={`reassign-subcategory-select-${item.id}`}>
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
                                            <div className="flex flex-col gap-1 w-full sm:w-auto">
                                              <Label className="text-xs">
                                                {isFr ? 'Résidence' : 'Residence'}
                                              </Label>
                                              {item.residenceAiSuggestedId
                                                && reassignResidenceId === item.residenceAiSuggestedId
                                                && !item.residenceAiConfirmed && (() => {
                                                const aiName = residencesById.get(item.residenceAiSuggestedId) ?? item.residenceAiSuggestedId.slice(0, 8);
                                                const bandLabel = confidenceBandLabel(item.residenceConfidence, isFr);
                                                const bandSuffix = bandLabel ? ` · ${bandLabel}` : '';
                                                return (
                                                  <span
                                                    className="flex items-center gap-1 text-[11px] text-violet-700 dark:text-violet-300"
                                                    data-testid={`reassign-residence-ai-hint-${item.id}`}
                                                  >
                                                    <Sparkles className="h-3 w-3" />
                                                    {isFr
                                                      ? `Suggestion de l'IA : ${aiName}${bandSuffix}`
                                                      : `AI suggestion: ${aiName}${bandSuffix}`}
                                                  </span>
                                                );
                                              })()}
                                              <Select
                                                value={reassignResidenceId}
                                                onValueChange={setReassignResidenceId}
                                              >
                                                <SelectTrigger
                                                  className="h-8 w-full sm:w-[220px] text-xs"
                                                  data-testid={`reassign-residence-select-${item.id}`}
                                                >
                                                  <SelectValue placeholder={isFr ? 'Choisir une résidence…' : 'Choose a residence…'} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {buildingResidencesError ? (
                                                    <SelectItem value="__error__" disabled className="text-xs text-red-600 dark:text-red-400" data-testid="reassign-residence-error">
                                                      {t('residenceUnitsLoadError')}
                                                    </SelectItem>
                                                  ) : buildingResidences.length === 0 ? (
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
                                          <div className="flex flex-col gap-1 w-full sm:w-auto">
                                            <Label className="text-xs">
                                              {isFr ? 'Résidence' : 'Residence'}
                                            </Label>
                                            {item.residenceAiSuggestedId
                                              && residencePickerValue === item.residenceAiSuggestedId
                                              && !item.residenceAiConfirmed && (() => {
                                              const aiName = residencesById.get(item.residenceAiSuggestedId) ?? item.residenceAiSuggestedId.slice(0, 8);
                                              const bandLabel = confidenceBandLabel(item.residenceConfidence, isFr);
                                              const bandSuffix = bandLabel ? ` · ${bandLabel}` : '';
                                              return (
                                                <span
                                                  className="flex items-center gap-1 text-[11px] text-violet-700 dark:text-violet-300"
                                                  data-testid={`residence-picker-ai-hint-${item.id}`}
                                                >
                                                  <Sparkles className="h-3 w-3" />
                                                  {isFr
                                                    ? `Suggestion de l'IA : ${aiName}${bandSuffix}`
                                                    : `AI suggestion: ${aiName}${bandSuffix}`}
                                                </span>
                                              );
                                            })()}
                                            <Select
                                              value={residencePickerValue}
                                              onValueChange={setResidencePickerValue}
                                            >
                                              <SelectTrigger className="h-8 w-full sm:w-[220px] text-xs" data-testid={`residence-picker-select-${item.id}`}>
                                                <SelectValue placeholder={isFr ? 'Choisir une résidence…' : 'Choose a residence…'} />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {buildingResidencesError ? (
                                                  <SelectItem value="__error__" disabled className="text-xs text-red-600 dark:text-red-400" data-testid="residence-picker-error">
                                                    {t('residenceUnitsLoadError')}
                                                  </SelectItem>
                                                ) : buildingResidences.length === 0 ? (
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
                      {/* Task #804: excluded (rejected) files were hidden from
                          step 3+ so later steps stayed uncluttered. Task #1225
                          reverses this for AI auto-steps: every row — including
                          excluded ones — must be reachable so admins can click
                          Retry without first un-excluding the row. The Retry
                          button for excluded rows carries a warning aria-label
                          ("this row will stay excluded"). For non-auto steps
                          (Upload, Complete) the old hide behaviour is kept. */}
                      {(() => {
                        const visibleItems = isAutoStep(currentStep)
                          ? items
                          : items.filter((item) => item.status !== 'rejected');
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
                        // Task #1233: For the linking step, compute AI-suggested /
                        // admin-curated document chains so non-head group members
                        // can be hidden from the flat list and rendered inside
                        // their group card instead.
                        const linkingGroupsData = currentStep === 'linking'
                          ? resolveLinkingGroups(visibleItems, linkingOverrides)
                          : { groups: [] as LinkingGroup<BulkImportItemLite>[], standaloneIds: new Set<string>() };

                        // Task #1425 / Task #1589: compute family groups (many-to-many item→family).
                        // Use the real `linkingMemberships` array from the lite endpoint
                        // (batch-fetched from bulk_import_item_family_memberships) so that
                        // items appear in named family cards even when the family has 0
                        // anchor documents (empty-anchor AI-guess case from Task #1589).

                        // Task #1636: Build canonical ID mapper from server-canonical families.
                        // familyContextData.families returns canonical family IDs (post-fix).
                        // We map any stale alias familyId in memberships to the canonical ID
                        // by matching on normalized family name.
                        const _familyCanonicalIdFor = (() => {
                          if (!familyContextData?.families) return undefined;
                          const normToCanonical = new Map<string, string>();
                          for (const fam of familyContextData.families) {
                            normToCanonical.set(fam.familyName.trim().toLowerCase(), fam.familyId);
                          }
                          const dupToCanonical = new Map<string, string>();
                          for (const it of visibleItems) {
                            for (const lm of it.linkingMemberships ?? []) {
                              if (!lm.familyId || !lm.familyName) continue;
                              const canonical = normToCanonical.get(lm.familyName.trim().toLowerCase());
                              if (canonical && canonical !== lm.familyId) {
                                dupToCanonical.set(lm.familyId, canonical);
                              }
                            }
                          }
                          return dupToCanonical.size > 0
                            ? (id: string) => dupToCanonical.get(id) ?? id
                            : undefined;
                        })();

                        const _resolvedFamilyGroupsData = currentStep === 'linking'
                          ? resolveFamilyGroups(
                              visibleItems.map((item) => ({
                                id: item.id,
                                memberships: (item.linkingMemberships ?? []).map((lm) => ({
                                  id: lm.id,
                                  itemId: item.id,
                                  familyId: lm.familyId,
                                  familyName: lm.familyName,
                                  familyDescription: lm.familyDescription,
                                  neighborDocumentId: lm.neighborDocumentId,
                                  position: lm.position,
                                  source: lm.source,
                                  manualOverride: lm.source === 'manual',
                                  aiConfidence: lm.aiConfidence,
                                  reason: lm.reason,
                                  sequence: lm.sequence,
                                } satisfies FamilyMembership)),
                                _item: item,
                              })),
                              // Task #1608: pass existing docs map so resolver
                              // produces interleaved mixed rows.
                              existingDocsByFamilyId,
                              // Task #1636: canonical ID mapper (preferred path).
                              _familyCanonicalIdFor,
                            )
                          : { groups: [] as FamilyGroup[], unassignedItems: [] as Array<{ id: string; memberships: FamilyMembership[]; _item: BulkImportItemLite }> };

                        // Task #1608: merge in "context-only" family groups — families that have
                        // existing library docs but no session items assigned (newCount === 0).
                        // These appear as collapsed cards showing only the existing anchors.
                        // We need to include them so admins can drag new items onto those anchor rows.
                        const contextOnlyGroups: FamilyGroup[] = [];
                        if (currentStep === 'linking' && familyContextData?.families) {
                          const assignedFamilyIds = new Set(
                            _resolvedFamilyGroupsData.groups.map((g) => g.familyId).filter(Boolean),
                          );
                          for (const contextFam of familyContextData.families) {
                            if (assignedFamilyIds.has(contextFam.familyId)) continue;
                            const existingDocs = existingDocsByFamilyId.get(contextFam.familyId) ?? [];
                            if (existingDocs.length === 0) continue;
                            contextOnlyGroups.push({
                              familyId: contextFam.familyId,
                              familyName: contextFam.familyName,
                              items: [],
                              rows: existingDocs.map((doc) => ({ kind: 'existing' as const, doc })),
                              newCount: 0,
                              existingCount: existingDocs.length,
                              membershipByItemId: new Map(),
                            });
                          }
                        }
                        const familyGroupsData = {
                          ..._resolvedFamilyGroupsData,
                          groups: [..._resolvedFamilyGroupsData.groups, ...contextOnlyGroups].sort(
                            (a, b) => (a.familyName ?? '').localeCompare(b.familyName ?? '', language, { sensitivity: 'base' }),
                          ),
                        };

                        const linkingGroupAllMemberIds = new Set<string>();
                        if (currentStep === 'linking') {
                          // Task #1425: items assigned to a named family are NOT shown in
                          // the top-level flat list – they appear inside their family group.
                          for (const grp of familyGroupsData.groups) {
                            for (const it of grp.items) linkingGroupAllMemberIds.add(it.id);
                          }
                          // Keep legacy chain group members hidden too (backward compat).
                          for (const grp of linkingGroupsData.groups) {
                            for (const it of grp.items) linkingGroupAllMemberIds.add(it.id);
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
                          : currentStep === 'linking'
                            ? visibleItems.filter((item) => !linkingGroupAllMemberIds.has(item.id))
                            : visibleItems;
                        // Task #1045: when the hide-ready toggle is ON, filter
                        // out items that are already ready for the next step.
                        // Applied after sibling removal so lead–sibling grouping
                        // is unaffected (hidden leads take their siblings with them).
                        // Task #1225: excluded (rejected) items are always kept
                        // visible even when hideReady is ON — isItemReadyForNextStep
                        // returns true for rejected rows on identification and
                        // linking (status passes all status-gate checks) but we
                        // need them visible so the Retry button is reachable.
                        const displayedTopLevelItems = hideReady
                          ? topLevelItems.filter((item) => item.status === 'rejected' || !isItemReadyForNextStep(item, currentStep))
                          : topLevelItems;
                        // Bulk-selection toolbar inputs (Task #1273): only
                        // rows the admin can actually flip count toward the
                        // counters and the select-all-visible action so the
                        // toolbar's totals always match what the server will
                        // accept.
                        const selectableTopLevelItems = displayedTopLevelItems.filter(
                          (it) => it.status !== 'committed' && it.status !== 'duplicate',
                        );
                        const selectableTopLevelIds = selectableTopLevelItems.map((it) => it.id);
                        const selectedVisibleIds = selectableTopLevelIds.filter((id) =>
                          selectedItemIds.has(id),
                        );
                        const selectedVisibleCount = selectedVisibleIds.length;
                        const selectedAllOnPage =
                          selectableTopLevelIds.length > 0 &&
                          selectedVisibleCount === selectableTopLevelIds.length;
                        const selectedHasIndeterminate =
                          selectedVisibleCount > 0 && !selectedAllOnPage;
                        const bulkExcludePending = bulkToggleExclude.isPending;
                        // Task #1671: IDs of ALL selected items (across all
                        // views including family-card members) that are
                        // commit-eligible (status === 'linked') on the linking step.
                        const commitEligibleIds =
                          currentStep === 'linking'
                            ? [...selectedItemIds].filter((id) => {
                                const it = items.find((i) => i.id === id);
                                return it?.status === 'linked';
                              })
                            : [];
                        const commitEligibleCount = commitEligibleIds.length;
                        return (
                          <>
                      {/* Task #1273 — bulk-selection toolbar. Renders above the
                          row list whenever any visible row is checked so the
                          admin can exclude / re-include the entire selection
                          in a single round-trip. Mirrors the per-row contract:
                          terminal rows (committed/duplicate) are filtered out
                          of the selection counters and the "select visible"
                          action so the totals can never overstate what the
                          server will accept. */}
                      {selectableTopLevelIds.length > 0 && (
                        <div
                          className="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-3 rounded-md border border-border bg-background px-3 py-2 shadow-sm"
                          data-testid="bulk-exclude-toolbar"
                        >
                          <Checkbox
                            id="bulk-select-visible"
                            checked={
                              selectedHasIndeterminate
                                ? 'indeterminate'
                                : selectedAllOnPage
                            }
                            onCheckedChange={(state) => {
                              if (state === true) {
                                setSelectedItemIds((prev) => {
                                  const next = new Set(prev);
                                  for (const id of selectableTopLevelIds) next.add(id);
                                  return next;
                                });
                              } else {
                                setSelectedItemIds((prev) => {
                                  const next = new Set(prev);
                                  for (const id of selectableTopLevelIds) next.delete(id);
                                  return next;
                                });
                              }
                            }}
                            data-testid="bulk-select-visible-checkbox"
                            aria-label={
                              isFr
                                ? 'Tout sélectionner sur cette page'
                                : 'Select all on this page'
                            }
                          />
                          <Label
                            htmlFor="bulk-select-visible"
                            className="cursor-pointer text-sm text-muted-foreground"
                          >
                            {selectedVisibleCount > 0
                              ? isFr
                                ? `${selectedVisibleCount} sélectionné${selectedVisibleCount === 1 ? '' : 's'}`
                                : `${selectedVisibleCount} selected`
                              : isFr
                                ? 'Tout sélectionner sur cette page'
                                : 'Select all on this page'}
                          </Label>
                          <div className="ml-auto flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              data-testid="bulk-exclude-button"
                              disabled={selectedVisibleCount === 0 || bulkExcludePending}
                              onClick={() =>
                                bulkToggleExclude.mutate({
                                  itemIds: selectedVisibleIds,
                                  excluded: true,
                                })
                              }
                            >
                              {bulkExcludePending && bulkToggleExclude.variables?.excluded === true ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              {isFr
                                ? `Exclure la sélection${selectedVisibleCount > 0 ? ` (${selectedVisibleCount})` : ''}`
                                : `Exclude selected${selectedVisibleCount > 0 ? ` (${selectedVisibleCount})` : ''}`}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              data-testid="bulk-reinclude-button"
                              disabled={selectedVisibleCount === 0 || bulkExcludePending}
                              onClick={() =>
                                bulkToggleExclude.mutate({
                                  itemIds: selectedVisibleIds,
                                  excluded: false,
                                })
                              }
                            >
                              {bulkExcludePending && bulkToggleExclude.variables?.excluded === false ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              {isFr
                                ? `Réinclure la sélection${selectedVisibleCount > 0 ? ` (${selectedVisibleCount})` : ''}`
                                : `Re-include selected${selectedVisibleCount > 0 ? ` (${selectedVisibleCount})` : ''}`}
                            </Button>
                            {/* Task #1671 — "Commit selected (N)" button. Only on the
                                linking step; disabled when no commit-eligible items are
                                selected or when a bulk commit is already running. */}
                            {currentStep === 'linking' && (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-8 text-xs"
                                data-testid="bulk-commit-button"
                                disabled={commitEligibleCount === 0 || bulkCommitRunning}
                                title={
                                  bulkCommitRunning
                                    ? undefined
                                    : commitEligibleCount === 0
                                      ? (isFr
                                          ? 'Sélectionnez des fichiers liés pour les sauvegarder'
                                          : 'Select linked files to commit')
                                      : undefined
                                }
                                onClick={() => {
                                  void commitSelectedItems(commitEligibleIds);
                                }}
                              >
                                {bulkCommitRunning ? (
                                  <>
                                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                    {isFr
                                      ? `Sauvegarde ${bulkCommitProgress.processed} sur ${bulkCommitProgress.total}…`
                                      : `Committing ${bulkCommitProgress.processed} of ${bulkCommitProgress.total}…`}
                                  </>
                                ) : (
                                  isFr
                                    ? `Sauvegarder la sélection${commitEligibleCount > 0 ? ` (${commitEligibleCount})` : ''}`
                                    : `Commit selected${commitEligibleCount > 0 ? ` (${commitEligibleCount})` : ''}`
                                )}
                              </Button>
                            )}
                            {selectedVisibleCount > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs"
                                data-testid="bulk-clear-selection-button"
                                onClick={clearItemSelection}
                              >
                                {isFr ? 'Effacer' : 'Clear'}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                      {/* Task #1233 — accessibility: live region for keyboard DnD announcements */}
                      {currentStep === 'linking' && (
                        <div
                          role="status"
                          aria-live="polite"
                          aria-atomic="true"
                          className="sr-only"
                        >
                          {linkingAnnouncement}
                        </div>
                      )}

                      {/* Task #1372 — Stale-data banner: shown on the linking step when
                          the lite poll has been failing, warning the admin that the
                          chain view may not reflect the latest server state.  Non-
                          blocking — the admin can still act, but is nudged to retry. */}
                      {currentStep === 'linking' && litePollInterrupted && !linkingStaleDataDismissed && (
                        <div
                          className="mb-3 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
                          data-testid="linking-stale-data-banner"
                          role="status"
                        >
                          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="flex-1">
                            {isFr
                              ? 'La vue des chaînes peut être désynchronisée — rechargez pour voir les dernières données.'
                              : 'The chain view may be out of date — reload to see the latest data.'}
                          </span>
                          <button
                            type="button"
                            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                            onClick={() => void refetchLite()}
                          >
                            <RefreshCw className="h-3 w-3" aria-hidden="true" />
                            {isFr ? 'Réessayer' : 'Retry'}
                          </button>
                          <button
                            type="button"
                            aria-label={isFr ? 'Masquer l\'avertissement' : 'Dismiss warning'}
                            className="ml-1 rounded p-0.5 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                            onClick={() => setLinkingStaleDataDismissed(true)}
                          >
                            ×
                          </button>
                        </div>
                      )}

                      {/* Task #1534 — Empty-result banner: shown when the linking run-all
                          finished but zero items ended up with a linkingFamilyId. Explains
                          which gate filtered all candidates out, with raw counts for
                          support triage. Dismissible per session view. */}
                      {(() => {
                        if (currentStep !== 'linking') return null;
                        const linkingProgress = readRunAllProgress(session, 'linking');
                        if (!linkingProgress?.finishedAt) return null;
                        const anyLinked = items.some(
                          (i) => i.status !== 'rejected' && (i as BulkImportItemLite).linkingFamilyId,
                        );
                        if (anyLinked) return null;
                        if (linkingEmptyResultDismissed) return null;
                        const cs = linkingProgress.candidateSummary;
                        const reason = getLinkingEmptyReason(cs);
                        const headlineFr: Record<LinkingEmptyReason, string> = {
                          'no-families': "Aucune famille de liens n'existe encore pour cette organisation. Configurez-en une dans Document Tags pour permettre la liaison.",
                          'no-anchor-docs': "Aucun document de cet immeuble n'est encore rattaché à une famille existante. Importez ou liez d'abord un document d'ancrage.",
                          'no-open-chains': "Toutes les chaînes existantes de cet immeuble ont déjà un voisin de chaque côté.",
                          'all-out-of-scope': `L'IA a trouvé ${cs?.openChainCount ?? 0} document(s) candidat(s) dans cet immeuble, mais aucun ne correspondait à la portée de résidence des fichiers importés.`,
                          'low-confidence': `L'IA a évalué ${cs?.maxInScopeCount ?? 0} candidat(s) mais n'a trouvé aucune correspondance suffisamment fiable.`,
                        };
                        const headlineEn: Record<LinkingEmptyReason, string> = {
                          'no-families': 'No link families exist yet for this organization. Set one up in Document Tags to enable linking.',
                          'no-anchor-docs': 'No document in this building is attached to an existing family yet. Commit or link an anchor document first.',
                          'no-open-chains': 'Every existing chain in this building already has a neighbor on both sides.',
                          'all-out-of-scope': `The AI found ${cs?.openChainCount ?? 0} candidate document(s) in this building, but none matched the residence scope of the imported files.`,
                          'low-confidence': `The AI evaluated ${cs?.maxInScopeCount ?? 0} candidate(s) but did not find any match confident enough.`,
                        };
                        const rawCountsFr = cs
                          ? `${cs.familyCount} famille${cs.familyCount !== 1 ? 's' : ''} · ${cs.anchorDocCount} document${cs.anchorDocCount !== 1 ? 's' : ''} d'ancrage · ${cs.openChainCount} chaîne${cs.openChainCount !== 1 ? 's' : ''} ouverte${cs.openChainCount !== 1 ? 's' : ''}`
                          : null;
                        const rawCountsEn = cs
                          ? `${cs.familyCount} ${cs.familyCount !== 1 ? 'families' : 'family'} · ${cs.anchorDocCount} anchor ${cs.anchorDocCount !== 1 ? 'documents' : 'document'} · ${cs.openChainCount} open ${cs.openChainCount !== 1 ? 'chains' : 'chain'}`
                          : null;
                        return (
                          <div
                            className="mb-3 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200"
                            data-testid="linking-empty-result-banner"
                            data-reason={reason}
                            role="status"
                          >
                            <div className="flex items-start gap-2">
                              <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                              <div className="flex-1 min-w-0">
                                <p className="leading-snug">
                                  {isFr ? headlineFr[reason] : headlineEn[reason]}
                                </p>
                                {(rawCountsFr || rawCountsEn) && (
                                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                                    {isFr ? rawCountsFr : rawCountsEn}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                aria-label={isFr ? "Masquer l'explication" : 'Dismiss explanation'}
                                className="ml-1 rounded p-0.5 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 flex-shrink-0"
                                onClick={() => setLinkingEmptyResultDismissed(true)}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Task #1425: Family group cards — items grouped by the existing
                          document family they are assigned to. Replaces the old in-session
                          "Chain" concept (Task #1233/1386). One card per named family;
                          items with no family assignment remain in the flat list below. */}
                      {currentStep === 'linking' && familyGroupsData.groups.map((group) => {
                        const famGroupItems = group.items.map((wrapped) => (wrapped as { id: string; memberships: FamilyMembership[]; _item: BulkImportItemLite })._item);
                        const hasManual = group.items.some((wrapped) => {
                          const m = group.membershipByItemId.get(wrapped.id);
                          return m?.manualOverride;
                        });
                        // Task #1608/#1617: collapse/expand toggle. The auto-collapse
                        // default + admin override come from `isFamilyCardCollapsed`
                        // (see `familyCardAutoCollapsed` for the rule). The toggled-away
                        // set is persisted per session so the preference survives
                        // page reloads.
                        const familyId = group.familyId ?? '';
                        const isCollapsed = isFamilyCardCollapsed(
                          group.newCount,
                          familyId,
                          collapsedFamilyIds,
                        );
                        const toggleCollapse = () => {
                          const next = toggleFamilyCardCollapsed(collapsedFamilyIds, familyId);
                          setCollapsedFamilyIds(next);
                          if (sessionId) {
                            writePersistedCollapsedFamilyIds(sessionId, next);
                          }
                        };
                        return (
                          <div
                            key={group.familyId}
                            data-testid={`family-group-${group.familyId}`}
                            className="rounded-lg border-2 border-indigo-300/60 bg-indigo-50/60 dark:border-indigo-700/60 dark:bg-indigo-950/30 space-y-1.5 p-2 mb-2"
                          >
                            {/* Group header — Task #1608: shows new+existing counts, collapse/expand */}
                            <div className="flex items-center gap-2 px-1 pb-0.5 flex-wrap">
                              <button
                                type="button"
                                onClick={toggleCollapse}
                                className="flex items-center gap-1.5 text-left min-w-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                                aria-label={isCollapsed
                                  ? (isFr ? 'Développer la famille' : 'Expand family')
                                  : (isFr ? 'Réduire la famille' : 'Collapse family')}
                                data-testid={`family-card-toggle-${group.familyId}`}
                              >
                                {isCollapsed
                                  ? <ChevronRight className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                                  : <ChevronDown className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />}
                                <FolderOpen className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 truncate max-w-[14rem]">
                                  {group.familyName}
                                </span>
                              </button>
                              {/* Task #1608: show new + existing counts separately */}
                              {group.newCount > 0 && (
                                <span className="text-xs text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                  {isFr
                                    ? `${group.newCount} nouveau${group.newCount > 1 ? 'x' : ''}`
                                    : `${group.newCount} new`}
                                </span>
                              )}
                              {group.existingCount > 0 && (
                                <span className="text-xs text-indigo-400 dark:text-indigo-500 whitespace-nowrap">
                                  {isFr
                                    ? `+ ${group.existingCount} existant${group.existingCount > 1 ? 's' : ''}`
                                    : `+ ${group.existingCount} existing`}
                                </span>
                              )}
                              {hasManual && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                                >
                                  {isFr ? 'Manuel' : 'Manual'}
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs ml-auto"
                                data-testid={`family-group-clear-all-${group.familyId}`}
                                aria-label={isFr ? 'Retirer tous de cette famille' : 'Remove all from this family'}
                                disabled={setExistingLinkDecision.isPending}
                                onClick={() => {
                                  for (const gi of famGroupItems) {
                                    if (gi.status !== 'committed' && gi.status !== 'duplicate') {
                                      // Task #1589: for items with a membership row in the
                                      // new table, delete the membership rather than using
                                      // the legacy set-existing-link-decision path (which
                                      // only clears the JSONB linkDecisions, not the memberships
                                      // table, so the item would still appear in the group).
                                      const membership = group.membershipByItemId.get(gi.id);
                                      if (membership?.id) {
                                        deleteMembership.mutate({
                                          itemId: gi.id,
                                          membershipId: membership.id,
                                        });
                                      } else {
                                        setExistingLinkDecision.mutate({
                                          itemId: gi.id,
                                          familyId: null,
                                          neighborDocumentId: null,
                                          position: null,
                                        });
                                      }
                                    }
                                  }
                                }}
                              >
                                <Link2Off className="h-3.5 w-3.5" />
                                <span className="ml-1">
                                  {isFr ? 'Retirer de la famille' : 'Remove from family'}
                                </span>
                              </Button>
                            </div>

                            {/* Task #1608: Group rows — mixed existing (read-only) + new (draggable).
                                Collapsed state hides all rows; header shows summary instead. */}
                            {!isCollapsed && group.rows.map((row, rowIdx) => {
                              // Task #1608: Existing library doc row — read-only anchor.
                              if (row.kind === 'existing') {
                                const existingDoc = row.doc;
                                const ExistingDocIcon = iconForMime(existingDoc.mimeType ?? null, existingDoc.name);
                                // Task #1616: position-aware drop indicator for existing-doc rows.
                                const existingDragKey = `existing-${group.familyId}-${existingDoc.id}`;
                                const showExistingIndicatorBefore =
                                  dragSrcId != null && dragOverKey === existingDragKey && dragOverPosition === 'before';
                                const showExistingIndicatorAfter =
                                  dragSrcId != null && dragOverKey === existingDragKey && dragOverPosition === 'after';
                                return (
                                  <Fragment key={`existing-${existingDoc.id}`}>
                                    {showExistingIndicatorBefore && (
                                      <div
                                        data-testid={`family-row-drop-indicator-${group.familyId}-${rowIdx}-before`}
                                        aria-hidden="true"
                                        className="h-1 my-0.5 rounded-full bg-indigo-500 dark:bg-indigo-400"
                                      />
                                    )}
                                    <div
                                      data-testid={`family-row-existing-${existingDoc.id}-${group.familyId}`}
                                      className="rounded border bg-slate-50/60 dark:bg-slate-900/40 flex items-center gap-2 p-2 opacity-80 border-slate-200 dark:border-slate-700"
                                      onDragOver={(e) => {
                                        if (!dragSrcId) return;
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const pos: 'before' | 'after' =
                                          e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                                        setDragOverKey(existingDragKey);
                                        setDragOverPosition(pos);
                                      }}
                                      onDragLeave={() => {
                                        setDragOverKey((prev) => prev === existingDragKey ? null : prev);
                                      }}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        const srcId = e.dataTransfer.getData('text/plain') || dragSrcId;
                                        const dropPos: 'before' | 'after' = dragOverPosition ?? 'after';
                                        setDragSrcId(null);
                                        setDragOverKey(null);
                                        setDragOverPosition(null);
                                        if (!srcId) return;
                                        // Place the dragged new item adjacent to this existing doc anchor,
                                        // honoring the upper/lower half of the hovered row (Task #1616).
                                        const srcMembership = group.membershipByItemId.get(srcId);
                                        // Compute fallback sequence: count new rows up to (and including
                                        // when 'after') this anchor's index in the mixed rows list.
                                        const upTo = dropPos === 'after' ? rowIdx + 1 : rowIdx;
                                        const newRowsBeforeHere = group.rows
                                          .slice(0, upTo)
                                          .filter((r) => r.kind === 'new' && (r.item as { id: string }).id !== srcId)
                                          .length;
                                        const newSeq = newRowsBeforeHere + 1;
                                        if (srcMembership?.id) {
                                          updateMembership.mutate({
                                            itemId: srcId,
                                            membershipId: srcMembership.id,
                                            sequence: newSeq,
                                            familyId: srcMembership.familyId,
                                            neighborDocumentId: existingDoc.id,
                                            position: dropPos,
                                          });
                                        } else if (group.familyId) {
                                          createMembership.mutate({
                                            itemId: srcId,
                                            familyId: group.familyId,
                                            neighborDocumentId: existingDoc.id,
                                            position: dropPos,
                                          });
                                        }
                                      }}
                                    >
                                    <ExistingDocIcon className="h-4 w-4 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                                    <span className="text-sm truncate text-slate-600 dark:text-slate-400 flex-1">
                                      {existingDoc.name}
                                    </span>
                                    {existingDoc.effectiveDate && (
                                      <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
                                        {typeof existingDoc.effectiveDate === 'string'
                                          ? existingDoc.effectiveDate.slice(0, 10)
                                          : (existingDoc.effectiveDate as Date).toISOString().slice(0, 10)}
                                      </span>
                                    )}
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] flex-shrink-0 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400"
                                    >
                                      {isFr ? 'Existant' : 'Existing'}
                                    </Badge>
                                    </div>
                                    {showExistingIndicatorAfter && (
                                      <div
                                        data-testid={`family-row-drop-indicator-${group.familyId}-${rowIdx}-after`}
                                        aria-hidden="true"
                                        className="h-1 my-0.5 rounded-full bg-indigo-500 dark:bg-indigo-400"
                                      />
                                    )}
                                  </Fragment>
                                );
                              }
                              // Task #1608: New session item row — full complex rendering unchanged.
                              const groupItem = (row.item as { id: string; memberships: FamilyMembership[]; _item: BulkImportItemLite })._item;
                              const m = group.membershipByItemId.get(groupItem.id);
                              const grpDecision = getItemStepDecision(groupItem, 'linking');
                              const grpIsExcluded = groupItem.status === 'rejected';
                              const grpRetryPending =
                                (runStep.isPending && runStep.variables?.itemId === groupItem.id);
                              const grpTogglePending =
                                (toggleExclude.isPending && toggleExclude.variables?.itemId === groupItem.id);
                              const grpCanToggleExclude =
                                groupItem.status !== 'committed' && groupItem.status !== 'duplicate';
                              const GrpItemIcon = iconForMime(groupItem.mimeType, groupItem.originalName);
                              // Task #1608: drag-and-drop state for reordering within the family card.
                              // Task #1616: dragOverPosition determines whether to show the drop
                              // indicator above ('before') or below ('after') this row.
                              const dragKey = `${group.familyId ?? ''}::${rowIdx}`;
                              const isDragging = dragSrcId === groupItem.id;
                              const isHoverTarget =
                                dragOverKey === dragKey && dragSrcId != null && dragSrcId !== groupItem.id;
                              const showIndicatorBefore = isHoverTarget && dragOverPosition === 'before';
                              const showIndicatorAfter = isHoverTarget && dragOverPosition === 'after';
                              return (
                                <Fragment key={groupItem.id}>
                                  {showIndicatorBefore && (
                                    <div
                                      data-testid={`family-row-drop-indicator-${group.familyId}-${rowIdx}-before`}
                                      aria-hidden="true"
                                      className="h-1 my-0.5 rounded-full bg-indigo-500 dark:bg-indigo-400"
                                    />
                                  )}
                                  <div
                                    data-testid={`linking-row-${groupItem.id}`}
                                    draggable={!!m?.id}
                                    className={[
                                      'rounded border bg-background flex flex-col gap-1 p-2',
                                      isDragging ? 'opacity-50 border-dashed' : '',
                                    ].filter(Boolean).join(' ')}
                                  onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData('text/plain', groupItem.id);
                                    setDragSrcId(groupItem.id);
                                  }}
                                  onDragOver={(e) => {
                                    if (dragSrcId === groupItem.id) return;
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                    // Task #1616: choose 'before' or 'after' based on cursor Y
                                    // relative to the row's vertical midpoint.
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const pos: 'before' | 'after' =
                                      e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                                    setDragOverKey(dragKey);
                                    setDragOverPosition(pos);
                                  }}
                                  onDragLeave={(e) => {
                                    // Task #1655: only clear the indicator when the cursor truly
                                    // leaves this row — not when it moves onto a child element
                                    // (which would fire onDragLeave before onDragOver on the child
                                    // and make the indicator flicker on every child boundary).
                                    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                                    setDragOverKey((prev) => prev === dragKey ? null : prev);
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const srcId = e.dataTransfer.getData('text/plain') || dragSrcId;
                                    // Task #1616: capture position before clearing state.
                                    const dropPos: 'before' | 'after' = dragOverPosition ?? 'before';
                                    setDragSrcId(null);
                                    setDragOverKey(null);
                                    setDragOverPosition(null);
                                    if (!srcId || srcId === groupItem.id) return;
                                    // Task #1616: compute the dragged item's new 1-based sequence
                                    // by simulating the post-drop list. This makes 'before' vs
                                    // 'after' the target row produce the right slot regardless of
                                    // whether the dragged item was originally above or below it.
                                    const newRowIds = group.rows
                                      .filter((r) => r.kind === 'new')
                                      .map((r) => (r.item as { id: string }).id);
                                    const reordered = newRowIds.filter((id) => id !== srcId);
                                    const targetIdxInReordered = reordered.indexOf(groupItem.id);
                                    let newSeq: number | undefined;
                                    if (targetIdxInReordered >= 0) {
                                      const insertAt =
                                        dropPos === 'before' ? targetIdxInReordered : targetIdxInReordered + 1;
                                      newSeq = insertAt + 1; // 1-based
                                    }
                                    // Task #1608: compute (neighborDocumentId, position) from
                                    // the mixed rows array so the backend can position relative
                                    // to an existing-library anchor rather than a raw sequence.
                                    const targetMixedIdx = group.rows.findIndex(
                                      (r) => r.kind === 'new' && (r.item as { id: string }).id === groupItem.id,
                                    );
                                    let neighborDocumentId: string | undefined;
                                    let position: 'before' | 'after' | undefined;
                                    if (targetMixedIdx >= 0) {
                                      // Search backwards for the nearest 'existing' row.
                                      for (let i = targetMixedIdx - 1; i >= 0; i--) {
                                        const r = group.rows[i];
                                        if (r.kind === 'existing') {
                                          neighborDocumentId = (r.doc as { id: string }).id;
                                          position = 'after';
                                          break;
                                        }
                                      }
                                      if (!neighborDocumentId) {
                                        // Search forwards.
                                        for (let i = targetMixedIdx + 1; i < group.rows.length; i++) {
                                          const r = group.rows[i];
                                          if (r.kind === 'existing') {
                                            neighborDocumentId = (r.doc as { id: string }).id;
                                            position = 'before';
                                            break;
                                          }
                                        }
                                      }
                                    }
                                    const srcMembership = group.membershipByItemId.get(srcId);
                                    if (srcMembership?.id) {
                                      updateMembership.mutate({
                                        itemId: srcId,
                                        membershipId: srcMembership.id,
                                        sequence: newSeq ?? srcMembership.sequence ?? 1,
                                        familyId: srcMembership.familyId,
                                        neighborDocumentId,
                                        position,
                                      });
                                    }
                                  }}
                                  onDragEnd={() => {
                                    setDragSrcId(null);
                                    setDragOverKey(null);
                                    setDragOverPosition(null);
                                  }}
                                  tabIndex={m?.id ? 0 : undefined}
                                  onKeyDown={(e) => {
                                    if (!m?.id) return;
                                    const newRows = group.rows.filter((r) => r.kind === 'new');
                                    const currentNewIdx = newRows.findIndex(
                                      (r) => r.kind === 'new' && (r.item as { id: string }).id === groupItem.id,
                                    );
                                    if (currentNewIdx < 0) return;
                                    let targetNewIdx: number | null = null;
                                    if (e.key === 'ArrowUp' && currentNewIdx > 0) {
                                      e.preventDefault();
                                      targetNewIdx = currentNewIdx - 1;
                                    } else if (e.key === 'ArrowDown' && currentNewIdx < newRows.length - 1) {
                                      e.preventDefault();
                                      targetNewIdx = currentNewIdx + 1;
                                    }
                                    if (targetNewIdx == null) return;
                                    const targetItem = newRows[targetNewIdx].item as { id: string };
                                    const targetMixedIdx = group.rows.findIndex(
                                      (r) => r.kind === 'new' && (r.item as { id: string }).id === targetItem.id,
                                    );
                                    let neighborDocumentId: string | undefined;
                                    let neighborPosition: 'before' | 'after' | undefined;
                                    if (targetMixedIdx >= 0) {
                                      for (let i = targetMixedIdx - 1; i >= 0; i--) {
                                        const r = group.rows[i];
                                        if (r.kind === 'existing') {
                                          neighborDocumentId = (r.doc as { id: string }).id;
                                          neighborPosition = 'after';
                                          break;
                                        }
                                      }
                                      if (!neighborDocumentId) {
                                        for (let i = targetMixedIdx + 1; i < group.rows.length; i++) {
                                          const r = group.rows[i];
                                          if (r.kind === 'existing') {
                                            neighborDocumentId = (r.doc as { id: string }).id;
                                            neighborPosition = 'before';
                                            break;
                                          }
                                        }
                                      }
                                    }
                                    updateMembership.mutate({
                                      itemId: groupItem.id,
                                      membershipId: m.id!,
                                      sequence: targetNewIdx + 1,
                                      familyId: m.familyId,
                                      neighborDocumentId,
                                      position: neighborPosition,
                                    });
                                  }}
                                >
                                  <div className="flex flex-col gap-1 min-w-0">
                                    {/* Line 1: drag handle, file icon, sequence badge, filename, position input, neighbor text */}
                                    <div className="flex items-center gap-2 min-w-0">
                                      {/* Task #1608: Drag handle — visible only when this item has a membership to reorder */}
                                      {m?.id && (
                                        <GripVertical
                                          className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0 cursor-grab active:cursor-grabbing"
                                          aria-hidden="true"
                                        />
                                      )}
                                      {/* File icon */}
                                      <GrpItemIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                      {/* Task #1589: sequence badge — now before the filename */}
                                      {m?.sequence != null && (
                                        <span
                                          className="text-xs font-mono text-indigo-600 dark:text-indigo-400 flex-shrink-0"
                                          data-testid={`family-row-position-${groupItem.id}-${group.familyId}`}
                                          title={isFr ? `Position dans la famille: ${m.sequence}` : `Position in family: ${m.sequence}`}
                                        >
                                          #{m.sequence}
                                        </span>
                                      )}
                                      {/* Filename button */}
                                      <button
                                        type="button"
                                        className="min-w-0 flex-1 text-left hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                                        data-testid={`item-preview-trigger-${groupItem.id}`}
                                        onClick={() => {
                                          const allFamilyGroups = familyGroupsData.groups.map((fg) => {
                                            const fgItems = fg.items.map((w) => (w as { id: string; memberships: FamilyMembership[]; _item: BulkImportItemLite })._item);
                                            return {
                                              familyLabel: fg.familyName,
                                              siblings: fgItems.map((i) => ({ id: i.id, originalName: i.originalName, mimeType: i.mimeType })),
                                            };
                                          });
                                          const gIdx = familyGroupsData.groups.indexOf(group);
                                          setPreviewItem({
                                            id: groupItem.id,
                                            originalName: groupItem.originalName,
                                            mimeType: groupItem.mimeType,
                                            chainSiblings: famGroupItems.map((gi) => ({
                                              id: gi.id,
                                              originalName: gi.originalName,
                                              mimeType: gi.mimeType,
                                            })),
                                            chainIndex: famGroupItems.indexOf(groupItem),
                                            familyGroups: allFamilyGroups,
                                            familyGroupIndex: gIdx >= 0 ? gIdx : undefined,
                                          });
                                        }}
                                      >
                                        <span className="text-sm truncate block" title={groupItem.originalName}>{getLinkingDisplayName(groupItem)}</span>
                                      </button>
                                      {/* Editable sequence position input */}
                                      {m?.id && (
                                        <input
                                          type="number"
                                          min={1}
                                          max={group.newCount || 1}
                                          data-testid={`family-row-position-input-${groupItem.id}-${group.familyId}`}
                                          className="w-12 text-xs border border-border rounded px-1 py-0.5 text-center bg-background text-foreground flex-shrink-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          value={sequenceInputValues.has(`${groupItem.id}-${group.familyId}`)
                                            ? sequenceInputValues.get(`${groupItem.id}-${group.familyId}`)!
                                            : (m.sequence ?? '')}
                                          title={isFr ? 'Modifier la position dans la famille' : 'Edit position in family'}
                                          onChange={(e) => {
                                            const key = `${groupItem.id}-${group.familyId}`;
                                            setSequenceInputValues((prev) => {
                                              const next = new Map(prev);
                                              next.set(key, e.target.value);
                                              return next;
                                            });
                                          }}
                                          onBlur={(e) => {
                                            const raw = parseInt(e.target.value, 10);
                                            // Task #1655: clamp to count of sequence-carrying (new) rows only,
                                            // not the total group size which includes read-only existing-library rows.
                                            const groupSize = group.newCount || 1;
                                            const newSeq = isNaN(raw) ? NaN : Math.min(Math.max(raw, 1), groupSize);
                                            if (!isNaN(newSeq) && newSeq !== m.sequence) {
                                              updateMembership.mutate({ itemId: groupItem.id, membershipId: m.id!, sequence: newSeq, familyId: m.familyId });
                                            }
                                            const key = `${groupItem.id}-${group.familyId}`;
                                            setSequenceInputValues((prev) => {
                                              const next = new Map(prev);
                                              next.delete(key);
                                              return next;
                                            });
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') e.currentTarget.blur();
                                            if (e.key === 'Escape') {
                                              const key = `${groupItem.id}-${group.familyId}`;
                                              setSequenceInputValues((prev) => {
                                                const next = new Map(prev);
                                                next.delete(key);
                                                return next;
                                              });
                                              e.currentTarget.blur();
                                            }
                                          }}
                                        />
                                      )}
                                      {/* Position within family (neighbor link) */}
                                      {m?.neighborDocumentId && m.position && (
                                        <span className="text-xs text-muted-foreground flex-shrink-0 truncate max-w-[10rem]">
                                          {m.position === 'after'
                                            ? (isFr ? `Après: ${groupItem.linkingNeighborDocumentName ?? m.neighborDocumentId}` : `After: ${groupItem.linkingNeighborDocumentName ?? m.neighborDocumentId}`)
                                            : (isFr ? `Avant: ${groupItem.linkingNeighborDocumentName ?? m.neighborDocumentId}` : `Before: ${groupItem.linkingNeighborDocumentName ?? m.neighborDocumentId}`)}
                                        </span>
                                      )}
                                    </div>
                                    {/* Line 2: action buttons */}
                                    <div
                                      className="flex items-center gap-1 pl-6"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {!grpIsExcluded && groupItem.status === 'linked' && (
                                        <Button
                                          size="sm"
                                          variant="default"
                                          className="h-7 text-xs"
                                          onClick={() => runStep.mutate({ itemId: groupItem.id, action: 'commit' })}
                                          disabled={grpRetryPending}
                                          data-testid={`button-commit-${groupItem.id}`}
                                        >
                                          {isFr ? 'Sauvegarder' : 'Commit'}
                                        </Button>
                                      )}
                                      {/* Task #1671: inline commit error message */}
                                      {commitErrors.has(groupItem.id) && (
                                        <span
                                          className="text-xs text-destructive"
                                          data-testid={`commit-error-${groupItem.id}`}
                                        >
                                          {getCommitErrorMessage(commitErrors.get(groupItem.id)!, isFr)}
                                        </span>
                                      )}
                                      {!grpIsExcluded && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs"
                                          onClick={() => runStep.mutate({ itemId: groupItem.id, action: 'link' })}
                                          disabled={grpRetryPending}
                                          data-testid={`button-retry-linking-${groupItem.id}`}
                                        >
                                          {grpRetryPending
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : <RotateCw className="h-3.5 w-3.5" />}
                                          <span className="ml-1">{isFr ? 'Réessayer' : 'Retry'}</span>
                                        </Button>
                                      )}
                                      {/* Task #1589: "Add to another family" button */}
                                      {!grpIsExcluded && grpCanToggleExclude && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-2 text-xs"
                                          data-testid={`add-to-family-btn-${groupItem.id}`}
                                          title={isFr ? 'Ajouter à une autre famille' : 'Add to another family'}
                                          disabled={createMembership.isPending}
                                          onClick={() => {
                                            if (existingLinkPickerItemId === groupItem.id && existingLinkPickerIsAddMode) {
                                              setExistingLinkPickerItemId(null);
                                            } else {
                                              setExistingLinkPickerItemId(groupItem.id);
                                              setExistingLinkPickerFamilyId('');
                                              setExistingLinkPickerDocId('');
                                              setExistingLinkPickerPosition('before');
                                              setExistingLinkPickerIsAddMode(true);
                                            }
                                          }}
                                        >
                                          <Library className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                      {/* Task #1589: "Remove from this family" — DELETE the specific membership row */}
                                      {!grpIsExcluded && grpCanToggleExclude && m?.id && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-2 text-xs"
                                          onClick={() => deleteMembership.mutate({ itemId: groupItem.id, membershipId: m.id })}
                                          disabled={deleteMembership.isPending}
                                          data-testid={`remove-from-family-btn-${groupItem.id}-${group.familyId}`}
                                          title={isFr ? 'Retirer de cette famille' : 'Remove from this family'}
                                        >
                                          <Link2Off className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                      {grpCanToggleExclude && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 w-7 p-0"
                                          onClick={() => toggleExclude.mutate({ itemId: groupItem.id, excluded: !grpIsExcluded })}
                                          disabled={grpTogglePending}
                                          aria-pressed={grpIsExcluded}
                                          data-testid={`button-toggle-exclude-${groupItem.id}`}
                                          title={grpIsExcluded ? (isFr ? 'Réinclure' : 'Re-include') : (isFr ? 'Exclure' : 'Exclude')}
                                        >
                                          {grpTogglePending
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : grpIsExcluded
                                              ? <Eye className="h-3.5 w-3.5" />
                                              : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  {/* Badges row */}
                                  <div className="flex items-center gap-2 flex-wrap pl-6">
                                    {grpIsExcluded ? (
                                      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                                        {isFr ? 'Exclu' : 'Excluded'}
                                      </Badge>
                                    ) : (
                                      <>
                                        <FallbackReasonBadge
                                          reason={grpDecision?.fallbackReason}
                                          isFr={isFr}
                                          retryCount={grpDecision?.retryCount}
                                        />
                                        {!grpDecision?.fallbackReason && (
                                          <TextOnlyDegradedBadge
                                            degraded={groupItem.linkingDegraded}
                                            isFr={isFr}
                                          />
                                        )}
                                        <ConfidenceBadge
                                          value={grpDecision?.confidence}
                                          fallbackReason={grpDecision?.fallbackReason}
                                          isFr={isFr}
                                        />
                                        {m?.manualOverride && (
                                          <Badge
                                            variant="outline"
                                            className="text-[10px] border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                                            data-testid={`linking-manual-tag-${groupItem.id}`}
                                          >
                                            {isFr ? 'Manuel' : 'Manual'}
                                          </Badge>
                                        )}
                                      </>
                                    )}
                                  </div>
                                  {/* Task #1589: "Add to another family" picker panel — rendered
                                      inline when the "Add to another family" button is clicked. */}
                                  {existingLinkPickerItemId === groupItem.id && existingLinkPickerIsAddMode && (
                                    <div
                                      className="mx-2 mb-1 rounded border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-3 space-y-2"
                                      data-testid={`existing-link-picker-${groupItem.id}`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                                          {isFr ? 'Ajouter à une famille' : 'Add to a family'}
                                        </span>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 px-2 text-xs"
                                          onClick={() => { setExistingLinkPickerItemId(null); setExistingLinkPickerIsAddMode(false); }}
                                        >
                                          ✕
                                        </Button>
                                      </div>
                                      {linkCandidatesQuery.isLoading && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          {isFr ? 'Chargement des candidats…' : 'Loading candidates…'}
                                        </div>
                                      )}
                                      {linkCandidatesQuery.data && (
                                        <>
                                          {linkCandidatesQuery.data.families.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">
                                              {isFr
                                                ? 'Aucun document existant disponible comme point d\'ancrage.'
                                                : 'No existing documents available as anchor points.'}
                                            </p>
                                          ) : (
                                            <div className="space-y-2">
                                              <div>
                                                <label className="text-xs font-medium text-blue-900 dark:text-blue-200 block mb-1">
                                                  {isFr ? 'Famille' : 'Family'}
                                                </label>
                                                <select
                                                  className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                                                  value={existingLinkPickerFamilyId}
                                                  data-testid={`existing-link-family-select-${groupItem.id}`}
                                                  onChange={(e) => {
                                                    setExistingLinkPickerFamilyId(e.target.value);
                                                    setExistingLinkPickerDocId('');
                                                  }}
                                                >
                                                  <option value="">
                                                    {isFr ? '— Choisir une famille —' : '— Choose a family —'}
                                                  </option>
                                                  {linkCandidatesQuery.data.families
                                                    .slice()
                                                    .sort(makeFamilyNameComparator(language, t))
                                                    .map((f) => (
                                                    <option
                                                      key={f.id}
                                                      value={f.id}
                                                      disabled={(groupItem.linkingMemberships ?? []).some((lm) => lm.familyId === f.id)}
                                                    >
                                                      {getSystemFamilyDisplay(f, t).name}{(groupItem.linkingMemberships ?? []).some((lm) => lm.familyId === f.id) ? (isFr ? ' (déjà ajouté)' : ' (already added)') : ''}
                                                    </option>
                                                  ))}
                                                </select>
                                              </div>
                                              {existingLinkPickerFamilyId && (() => {
                                                const fam = linkCandidatesQuery.data!.families.find((f) => f.id === existingLinkPickerFamilyId);
                                                if (!fam) return null;
                                                if (fam.documents.length === 0) return (
                                                  <div className="space-y-1">
                                                    <p className="text-xs text-muted-foreground" data-testid={`existing-link-empty-family-note-${groupItem.id}`}>
                                                      {isFr
                                                        ? 'Cette famille n\'a pas encore de document. Ce document en sera le premier ancrage.'
                                                        : 'This family has no documents yet. This document will become its first anchor.'}
                                                    </p>
                                                    <Button
                                                      size="sm"
                                                      variant="default"
                                                      className="h-7 text-xs"
                                                      data-testid={`existing-link-commit-first-anchor-${groupItem.id}`}
                                                      disabled={createMembership.isPending}
                                                      onClick={() => {
                                                        createMembership.mutate(
                                                          { itemId: groupItem.id, familyId: existingLinkPickerFamilyId, neighborDocumentId: null, position: null },
                                                          { onSuccess: () => { setExistingLinkPickerItemId(null); setExistingLinkPickerIsAddMode(false); } },
                                                        );
                                                      }}
                                                    >
                                                      {createMembership.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (isFr ? 'Définir comme premier ancrage' : 'Set as first anchor')}
                                                    </Button>
                                                  </div>
                                                );
                                                return (
                                                  <div className="space-y-2">
                                                    <div>
                                                      <label className="text-xs font-medium text-blue-900 dark:text-blue-200 block mb-1">
                                                        {isFr ? 'Document voisin' : 'Neighbor document'}
                                                      </label>
                                                      <select
                                                        className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                                                        value={existingLinkPickerDocId}
                                                        data-testid={`existing-link-doc-select-${groupItem.id}`}
                                                        onChange={(e) => {
                                                          setExistingLinkPickerDocId(e.target.value);
                                                          const doc = fam.documents.find((d) => d.id === e.target.value);
                                                          if (doc) {
                                                            if (doc.canLinkBefore && !doc.canLinkAfter) setExistingLinkPickerPosition('before');
                                                            else if (!doc.canLinkBefore && doc.canLinkAfter) setExistingLinkPickerPosition('after');
                                                          }
                                                        }}
                                                      >
                                                        <option value="">{isFr ? '— Choisir un document —' : '— Choose a document —'}</option>
                                                        {fam.documents.map((d) => (
                                                          <option key={d.id} value={d.id}>
                                                            {d.name}{d.effectiveDate ? ` (${d.effectiveDate.slice(0, 10)})` : ''}
                                                          </option>
                                                        ))}
                                                      </select>
                                                    </div>
                                                    {existingLinkPickerDocId && (() => {
                                                      const doc = fam.documents.find((d) => d.id === existingLinkPickerDocId);
                                                      if (!doc) return null;
                                                      return (
                                                        <div className="space-y-1">
                                                          <div className="flex gap-2">
                                                            {doc.canLinkBefore && (
                                                              <label className="flex items-center gap-1 text-xs cursor-pointer">
                                                                <input type="radio" name={`add-fam-position-${groupItem.id}`} value="before" checked={existingLinkPickerPosition === 'before'} onChange={() => setExistingLinkPickerPosition('before')} />
                                                                {isFr ? 'Avant' : 'Before'}
                                                              </label>
                                                            )}
                                                            {doc.canLinkAfter && (
                                                              <label className="flex items-center gap-1 text-xs cursor-pointer">
                                                                <input type="radio" name={`add-fam-position-${groupItem.id}`} value="after" checked={existingLinkPickerPosition === 'after'} onChange={() => setExistingLinkPickerPosition('after')} />
                                                                {isFr ? 'Après' : 'After'}
                                                              </label>
                                                            )}
                                                          </div>
                                                          <Button
                                                            size="sm"
                                                            variant="default"
                                                            className="h-7 text-xs"
                                                            data-testid={`existing-link-confirm-${groupItem.id}`}
                                                            disabled={createMembership.isPending}
                                                            onClick={() => {
                                                              createMembership.mutate(
                                                                { itemId: groupItem.id, familyId: existingLinkPickerFamilyId, neighborDocumentId: existingLinkPickerDocId, position: existingLinkPickerPosition },
                                                                { onSuccess: () => { setExistingLinkPickerItemId(null); setExistingLinkPickerIsAddMode(false); } },
                                                              );
                                                            }}
                                                          >
                                                            {createMembership.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (isFr ? 'Confirmer le lien' : 'Confirm link')}
                                                          </Button>
                                                        </div>
                                                      );
                                                    })()}
                                                  </div>
                                                );
                                              })()}
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  )}
                                  </div>
                                  {showIndicatorAfter && (
                                    <div
                                      data-testid={`family-row-drop-indicator-${group.familyId}-${rowIdx}-after`}
                                      aria-hidden="true"
                                      className="h-1 my-0.5 rounded-full bg-indigo-500 dark:bg-indigo-400"
                                    />
                                  )}
                                </Fragment>
                              );
                            })}
                          </div>
                        );
                      })}

                      {/* Legacy in-session chain groups (backward compat: shown read-only
                          for items processed before Task #1425 that still have in-session
                          chain links). New items will only have family groups above. */}
                      {currentStep === 'linking' && linkingGroupsData.groups
                        .filter((grp) => !grp.items.some((gi) => familyGroupsData.groups.some((fg) => fg.items.some((fw) => fw.id === gi.id))))
                        .map((group) => (
                          <div
                            key={group.id}
                            data-testid={`linking-group-${group.id}`}
                            className="rounded-lg border-2 border-primary/30 bg-primary/5 dark:bg-primary/10 space-y-1.5 p-2 mb-2"
                          >
                            <div className="flex items-center gap-2 px-1 pb-0.5">
                              <Link2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                              <span className="text-xs font-semibold text-primary">
                                {isFr
                                  ? `Chaîne · ${group.items.length} fichier${group.items.length > 1 ? 's' : ''}`
                                  : `Chain · ${group.items.length} file${group.items.length > 1 ? 's' : ''}`}
                              </span>
                              {group.isManual && (
                                <Badge variant="outline" className="text-[10px] border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 ml-1">
                                  {isFr ? 'Manuel' : 'Manual'}
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs ml-auto"
                                data-testid={`linking-break-group-${group.id}`}
                                aria-label={isFr ? 'Dissocier la chaîne' : 'Break chain'}
                                onClick={() => handleLinkingBreakGroup(group.items.map((gi) => gi.id))}
                              >
                                <Link2Off className="h-3.5 w-3.5" />
                                <span className="ml-1">{isFr ? 'Dissocier la chaîne' : 'Break chain'}</span>
                              </Button>
                            </div>
                            {group.items.map((groupItem, groupIdx) => {
                              const grpDecision = getItemStepDecision(groupItem, 'linking');
                              const grpIsExcluded = groupItem.status === 'rejected';
                              const grpRetryPending = (runStep.isPending && runStep.variables?.itemId === groupItem.id);
                              const grpTogglePending = (toggleExclude.isPending && toggleExclude.variables?.itemId === groupItem.id);
                              const grpCanToggleExclude = groupItem.status !== 'committed' && groupItem.status !== 'duplicate';
                              const GrpItemIcon = iconForMime(groupItem.mimeType, groupItem.originalName);
                              return (
                                <div key={groupItem.id} data-testid={`linking-row-${groupItem.id}`} className="rounded border bg-background flex flex-col gap-1 p-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-xs tabular-nums text-muted-foreground w-8 flex-shrink-0 text-right">{groupIdx + 1}/{group.items.length}</span>
                                    <button type="button" className="flex items-center gap-2 min-w-0 flex-1 text-left hover:underline" data-testid={`item-preview-trigger-${groupItem.id}`}
                                      onClick={() => setPreviewItem({ id: groupItem.id, originalName: groupItem.originalName, mimeType: groupItem.mimeType, chainSiblings: group.items.map((gi) => ({ id: gi.id, originalName: gi.originalName, mimeType: gi.mimeType })), chainIndex: groupIdx })}>
                                      <GrpItemIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                      <span className="text-sm truncate">{groupItem.originalName}</span>
                                    </button>
                                    <div className="flex items-center gap-1 flex-shrink-0 ml-auto" onClick={(e) => e.stopPropagation()}>
                                      {!grpIsExcluded && groupItem.status === 'linked' && (
                                        <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => runStep.mutate({ itemId: groupItem.id, action: 'commit' })} disabled={grpRetryPending} data-testid={`button-commit-${groupItem.id}`}>{isFr ? 'Sauvegarder' : 'Commit'}</Button>
                                      )}
                                      {/* Task #1671: inline commit error */}
                                      {commitErrors.has(groupItem.id) && (
                                        <span className="text-xs text-destructive" data-testid={`commit-error-${groupItem.id}`}>
                                          {getCommitErrorMessage(commitErrors.get(groupItem.id)!, isFr)}
                                        </span>
                                      )}
                                      {!grpIsExcluded && (
                                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => runStep.mutate({ itemId: groupItem.id, action: 'link' })} disabled={grpRetryPending} data-testid={`button-retry-linking-${groupItem.id}`}>
                                          {grpRetryPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                                          <span className="ml-1">{isFr ? 'Réessayer' : 'Retry'}</span>
                                        </Button>
                                      )}
                                      {grpCanToggleExclude && (
                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleExclude.mutate({ itemId: groupItem.id, excluded: !grpIsExcluded })} disabled={grpTogglePending} aria-pressed={grpIsExcluded} data-testid={`button-toggle-exclude-${groupItem.id}`} title={grpIsExcluded ? (isFr ? 'Réinclure' : 'Re-include') : (isFr ? 'Exclure' : 'Exclude')}>
                                          {grpTogglePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : grpIsExcluded ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap pl-[5.5rem]">
                                    {grpIsExcluded ? (
                                      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">{isFr ? 'Exclu' : 'Excluded'}</Badge>
                                    ) : (
                                      <>
                                        <FallbackReasonBadge reason={grpDecision?.fallbackReason} isFr={isFr} retryCount={grpDecision?.retryCount} />
                                        {!grpDecision?.fallbackReason && <TextOnlyDegradedBadge degraded={groupItem.linkingDegraded} isFr={isFr} />}
                                        <ConfidenceBadge value={grpDecision?.confidence} fallbackReason={grpDecision?.fallbackReason} isFr={isFr} />
                                        {groupItem.linkingManualOverride && (
                                          <Badge variant="outline" className="text-[10px] border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300" data-testid={`linking-manual-tag-${groupItem.id}`}>{isFr ? 'Manuel' : 'Manual'}</Badge>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}

                      {/* Task #1386: DnD drop zone removed — linking now uses
                          existing-family picker only, no in-session reordering. */}

                      {displayedTopLevelItems.length === 0 && (
                        familyGroupsData.groups.length === 0 && linkingGroupsData.groups.length === 0 || currentStep !== 'linking'
                      ) && (
                        <p className="text-sm text-muted-foreground" data-testid={`empty-state-${currentStep}`}>
                          {hideReady && topLevelItems.length > 0
                            ? (isFr ? "Tous les fichiers sont prêts pour l'étape suivante." : 'All files are ready for the next step.')
                            : (isFr ? 'Aucun fichier' : 'No items')}
                        </p>
                      )}
                      {displayedTopLevelItems.length === 0 && (familyGroupsData.groups.length > 0 || linkingGroupsData.groups.length > 0) && currentStep === 'linking' && (
                        <p className="text-sm text-muted-foreground" data-testid={`empty-state-${currentStep}-standalone`}>
                          {isFr ? 'Aucun fichier autonome' : 'No standalone files'}
                        </p>
                      )}
                      {displayedTopLevelItems.map((item) => {
                        const decision = getItemStepDecision(item, currentStep);
                        const isAuto = isAutoStep(currentStep);
                        const retryAction = isAuto
                          ? stepRetryAction[currentStep as AutoStep]
                          : null;
                        const progress = isAuto
                          ? readRunAllProgress(session, currentStep as AutoStep)
                          : null;
                        // Draft-split leads have status='rejected' but are kept
                        // visible so the admin can adjust or revert the split.
                        const isDraftSplitLead =
                          currentStep === 'sorting' &&
                          item.status === 'rejected' &&
                          !!item.sortingDecisionSplitIntoItemIds?.length &&
                          item.preExcludeStatus == null;
                        const isExcluded = item.status === 'rejected' && !isDraftSplitLead;
                        // Task #1225: inline Retry is available on every
                        // row that has a retry action for the current auto
                        // step, regardless of fallback/run-all state,
                        // exclusion, or manual overrides. Warning
                        // title/aria-label hints are shown on excluded /
                        // overridden rows so the admin knows what will happen.
                        const showRetry = !!retryAction;
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
                        // Task #1386: DnD removed from Linking step; items use existing-family picker only.
                        const isLinkingStandalone = currentStep === 'linking';
                        return (
                          <div
                            key={item.id}
                            className={[
                              'rounded-md border transition',
                              isExcluded ? 'bg-muted/40 opacity-60' : '',
                            ].join(' ')}
                            data-testid={isLinkingStandalone && !isExcluded ? `linking-row-${item.id}` : `item-row-${item.id}`}
                            data-excluded={isExcluded ? 'true' : 'false'}
                          >
                            {/* Task #1386: linking-step header bar for standalone rows (drag handle removed) */}
                            {isLinkingStandalone && (
                              <div className="flex items-center gap-2 px-2 pt-2">
                                <span
                                  data-testid={`linking-row-position-${item.id}`}
                                  className="text-xs text-muted-foreground"
                                >
                                  {isFr ? 'Autonome' : 'Standalone'}
                                </span>
                                {(item.linkingManualOverride || linkingOverrides.has(item.id)) && (
                                  <Badge
                                    data-testid={`linking-manual-tag-${item.id}`}
                                    variant="outline"
                                    className="border-amber-300 bg-amber-50 text-amber-900 text-xs"
                                  >
                                    {isFr ? 'Manuel' : 'Manual'}
                                  </Badge>
                                )}
                                {/* Task #1608: Multi-family AI guess chips — shown for items with
                                    one or more AI guesses but no committed family assignment yet.
                                    Falls back to legacy single-guess block when no guesses array. */}
                                {(() => {
                                  const guesses = item.linkingFamilyGuesses;
                                  const legacyGuessId = item.linkingFamilyGuessId;
                                  // Build the effective guess list (new multi-guess or legacy single).
                                  const effectiveGuesses: Array<{
                                    familyId: string;
                                    familyName: string | null;
                                    confidence: number | null;
                                    reason: string | null;
                                    description: string | null;
                                  }> = guesses && guesses.length > 0
                                    ? guesses.map((g) => ({
                                        familyId: g.familyId,
                                        familyName: g.familyName,
                                        confidence: g.confidence,
                                        reason: g.reason,
                                        description: g.familyDescription,
                                      }))
                                    : legacyGuessId
                                    ? [{
                                        familyId: legacyGuessId,
                                        familyName: item.linkingFamilyGuessName,
                                        confidence: item.linkingFamilyGuessConfidence,
                                        reason: item.linkingFamilyGuessReason,
                                        description: item.linkingFamilyGuessDescription,
                                      }]
                                    : [];
                                  if (effectiveGuesses.length === 0 || item.linkingFamilyId) return null;
                                  return (
                                    <div
                                      className="flex flex-col gap-1.5 mt-1 rounded border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950 px-2 py-1.5"
                                      data-testid={`ai-family-suggestion-${item.id}`}
                                    >
                                      <span className="text-xs font-semibold text-violet-900 dark:text-violet-200 flex items-center gap-1">
                                        <Sparkles className="h-3 w-3 flex-shrink-0" />
                                        {effectiveGuesses.length === 1
                                          ? (isFr ? 'Suggestion IA :' : 'AI suggestion:')
                                          : (isFr ? `${effectiveGuesses.length} suggestions IA :` : `${effectiveGuesses.length} AI suggestions:`)}
                                      </span>
                                      {/* One chip per guess */}
                                      {effectiveGuesses.map((guess, gIdx) => {
                                        const conf = guess.confidence;
                                        const level = conf == null ? null : conf >= 0.8 ? 'high' : conf >= 0.5 ? 'medium' : 'low';
                                        const confLabel = level == null ? null : isFr
                                          ? (level === 'high' ? 'élevée' : level === 'medium' ? 'moyenne' : 'faible')
                                          : level;
                                        const pillClass = level === 'high'
                                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                          : level === 'medium'
                                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                          : level === 'low'
                                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                          : '';
                                        const reasonKey = `${item.id}-guess-${gIdx}`;
                                        const reasonOpen = guesReasonOpenIds.has(reasonKey);
                                        return (
                                          <div
                                            key={guess.familyId}
                                            className="flex flex-col gap-1 rounded border border-violet-100 dark:border-violet-900 bg-white dark:bg-violet-900/30 px-2 py-1"
                                            data-testid={`ai-family-suggestion-${item.id}-${guess.familyId}`}
                                          >
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span
                                                className="text-xs font-medium text-violet-800 dark:text-violet-300 truncate max-w-[160px]"
                                                title={guess.familyName ?? guess.familyId}
                                              >
                                                {guess.familyName ?? guess.familyId}
                                              </span>
                                              {confLabel && (
                                                <span
                                                  className={`text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${pillClass}`}
                                                  data-testid={`ai-family-suggestion-confidence-${item.id}-${guess.familyId}`}
                                                >
                                                  {confLabel}
                                                </span>
                                              )}
                                              {guess.reason && (
                                                <button
                                                  type="button"
                                                  className="text-xs text-violet-600 dark:text-violet-400 underline underline-offset-2 hover:text-violet-800 dark:hover:text-violet-200 flex-shrink-0"
                                                  data-testid={`ai-family-suggestion-reason-${item.id}-${guess.familyId}`}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setGuessReasonOpenIds((prev) => {
                                                      const next = new Set(prev);
                                                      if (next.has(reasonKey)) next.delete(reasonKey);
                                                      else next.add(reasonKey);
                                                      return next;
                                                    });
                                                  }}
                                                >
                                                  {reasonOpen
                                                    ? (isFr ? 'Masquer' : 'Hide reason')
                                                    : (isFr ? 'Raison' : 'Why?')}
                                                </button>
                                              )}
                                              <Button
                                                size="sm"
                                                variant="default"
                                                className="h-6 px-2 text-xs bg-violet-700 hover:bg-violet-800 text-white ml-auto flex-shrink-0"
                                                data-testid={`accept-family-suggestion-${item.id}-${guess.familyId}`}
                                                disabled={updateMembership.isPending || createMembership.isPending}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  // Task #1608: confirm the AI-suggested family without committing the item.
                                                  // If a membership row already exists (AI pre-created), patch its sequence
                                                  // to mark as manually accepted. Otherwise create the membership fresh.
                                                  const membershipForFamily = item.linkingMemberships?.find(
                                                    (lm) => lm.familyId === guess.familyId,
                                                  );
                                                  if (membershipForFamily?.id) {
                                                    updateMembership.mutate({
                                                      itemId: item.id,
                                                      membershipId: membershipForFamily.id,
                                                      sequence: membershipForFamily.sequence ?? 1,
                                                      familyId: membershipForFamily.familyId,
                                                    });
                                                  } else {
                                                    createMembership.mutate({
                                                      itemId: item.id,
                                                      familyId: guess.familyId,
                                                      neighborDocumentId: null,
                                                      position: null,
                                                    });
                                                  }
                                                }}
                                              >
                                                {(updateMembership.isPending || createMembership.isPending)
                                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                                  : (isFr ? 'Accepter' : 'Accept')}
                                              </Button>
                                            </div>
                                            {guess.description && (
                                              <p className="text-xs text-violet-600 dark:text-violet-400">
                                                {guess.description}
                                              </p>
                                            )}
                                            {reasonOpen && guess.reason && (
                                              <p className="text-xs text-violet-700 dark:text-violet-300 italic">
                                                {guess.reason}
                                              </p>
                                            )}
                                          </div>
                                        );
                                      })}
                                      {/* Choose a different family (not one of the guesses) */}
                                      <div className="flex gap-1.5 mt-0.5">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 px-2 text-xs text-violet-700 dark:text-violet-400 hover:text-violet-900"
                                          data-testid={`choose-different-family-button-${item.id}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (existingLinkPickerItemId === item.id) {
                                              setExistingLinkPickerItemId(null);
                                            } else {
                                              setExistingLinkPickerItemId(item.id);
                                              setExistingLinkPickerFamilyId('');
                                              setExistingLinkPickerDocId('');
                                              setExistingLinkPickerPosition('before');
                                            }
                                          }}
                                        >
                                          {isFr ? 'Autre famille…' : 'Choose different family…'}
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })()}
                                {/* Task #1386: existing-library link badge + picker */}
                                {item.linkingFamilyId && (
                                  <Badge
                                    data-testid={`linking-existing-family-badge-${item.id}`}
                                    variant="outline"
                                    className="border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200 text-xs flex items-center gap-1"
                                    title={item.linkingFamilyName ?? undefined}
                                  >
                                    <Library className="h-3 w-3 flex-shrink-0" />
                                    {item.linkingFamilyName
                                      ? item.linkingFamilyName
                                      : (isFr ? 'Déjà dans Koveo' : 'Already in Koveo')}
                                  </Badge>
                                )}
                                {item.linkingFamilyId && item.linkingNeighborDocumentName && (
                                  <span
                                    className="text-xs text-blue-800 dark:text-blue-300 flex items-center gap-1"
                                    data-testid={`linking-existing-neighbor-context-${item.id}`}
                                  >
                                    {item.linkingNeighborPosition === 'before'
                                      ? (isFr ? 'Avant' : 'Before')
                                      : (isFr ? 'Après' : 'After')}
                                    {' · '}
                                    <span className="font-medium truncate max-w-[120px]" title={item.linkingNeighborDocumentName}>
                                      {item.linkingNeighborDocumentName}
                                    </span>
                                  </span>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-xs ml-auto"
                                  data-testid={`linking-attach-family-btn-${item.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (existingLinkPickerItemId === item.id) {
                                      setExistingLinkPickerItemId(null);
                                    } else {
                                      setExistingLinkPickerItemId(item.id);
                                      setExistingLinkPickerFamilyId(item.linkingFamilyId ?? '');
                                      const neighborId = item.linkingBeforeDocumentId ?? item.linkingAfterDocumentId ?? '';
                                      setExistingLinkPickerDocId(neighborId);
                                      setExistingLinkPickerPosition(item.linkingBeforeDocumentId ? 'before' : 'after');
                                    }
                                  }}
                                >
                                  <Library className="h-3.5 w-3.5 mr-1" />
                                  {isFr ? 'Lier à la bibliothèque' : 'Link to library'}
                                </Button>
                              </div>
                            )}
                            {/* Task #1386: existing-family link picker panel (inline) */}
                            {isLinkingStandalone && existingLinkPickerItemId === item.id && (
                              <div
                                className="mx-2 mb-2 rounded border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-3 space-y-2"
                                data-testid={`existing-link-picker-${item.id}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                                    {isFr ? 'Attacher à une famille existante' : 'Attach to an existing family'}
                                  </span>
                                  {item.linkingFamilyId && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-xs text-red-700 hover:text-red-900 dark:text-red-400"
                                      data-testid={`existing-link-clear-${item.id}`}
                                      disabled={setExistingLinkDecision.isPending}
                                      onClick={() => {
                                        setExistingLinkDecision.mutate({
                                          itemId: item.id,
                                          familyId: null,
                                          neighborDocumentId: null,
                                          position: null,
                                        });
                                        setExistingLinkPickerItemId(null);
                                      }}
                                    >
                                      {isFr ? 'Effacer le lien' : 'Clear link'}
                                    </Button>
                                  )}
                                </div>
                                {linkCandidatesQuery.isLoading && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    {isFr ? 'Chargement des candidats…' : 'Loading candidates…'}
                                  </div>
                                )}
                                {linkCandidatesQuery.isError && (
                                  <p className="text-xs text-red-700 dark:text-red-400">
                                    {isFr ? 'Échec du chargement des candidats.' : 'Failed to load candidates.'}
                                  </p>
                                )}
                                {linkCandidatesQuery.data && (
                                  <>
                                    {linkCandidatesQuery.data.families.length === 0 ? (
                                      <p className="text-xs text-muted-foreground">
                                        {isFr
                                          ? 'Aucun document existant disponible comme point d\'ancrage.'
                                          : 'No existing documents available as anchor points.'}
                                      </p>
                                    ) : (
                                      <div className="space-y-2">
                                        <div>
                                          <label className="text-xs font-medium text-blue-900 dark:text-blue-200 block mb-1">
                                            {isFr ? 'Famille' : 'Family'}
                                          </label>
                                          <select
                                            className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                                            value={existingLinkPickerFamilyId}
                                            data-testid={`existing-link-family-select-${item.id}`}
                                            onChange={(e) => {
                                              setExistingLinkPickerFamilyId(e.target.value);
                                              setExistingLinkPickerDocId('');
                                              setExistingLinkDecisionErrors((prev) => {
                                                const m = new Map(prev); m.delete(item.id); return m;
                                              });
                                            }}
                                          >
                                            <option value="">
                                              {isFr ? '— Choisir une famille —' : '— Choose a family —'}
                                            </option>
                                            {linkCandidatesQuery.data.families.map((f) => (
                                              <option key={f.id} value={f.id}>{f.name}</option>
                                            ))}
                                          </select>
                                          {existingLinkPickerFamilyId && (() => {
                                            const selectedFam = linkCandidatesQuery.data!.families.find(
                                              (f) => f.id === existingLinkPickerFamilyId,
                                            );
                                            return selectedFam?.description ? (
                                              <p
                                                className="text-xs text-muted-foreground mt-0.5"
                                                data-testid={`existing-link-family-description-${item.id}`}
                                              >
                                                {selectedFam.description}
                                              </p>
                                            ) : null;
                                          })()}
                                        </div>
                                        {existingLinkPickerFamilyId && (() => {
                                          const fam = linkCandidatesQuery.data!.families.find(
                                            (f) => f.id === existingLinkPickerFamilyId,
                                          );
                                          if (!fam) return null;
                                          // Task #1549: empty family — offer first-anchor commit.
                                          if (fam.documents.length === 0) return (
                                            <div className="space-y-1">
                                              <p
                                                className="text-xs text-muted-foreground"
                                                data-testid={`existing-link-empty-family-note-${item.id}`}
                                              >
                                                {isFr
                                                  ? 'Cette famille n\'a pas encore de document. Ce document en sera le premier ancrage.'
                                                  : 'This family has no documents yet. This document will become its first anchor.'}
                                              </p>
                                              {/* Task #1589: add mode uses createMembership; standard mode uses setExistingLinkDecision */}
                                              <Button
                                                size="sm"
                                                variant="default"
                                                className="h-7 text-xs"
                                                data-testid={`existing-link-commit-first-anchor-${item.id}`}
                                                disabled={existingLinkPickerIsAddMode ? createMembership.isPending : setExistingLinkDecision.isPending}
                                                onClick={() => {
                                                  if (existingLinkPickerIsAddMode) {
                                                    createMembership.mutate(
                                                      { itemId: item.id, familyId: existingLinkPickerFamilyId, neighborDocumentId: null, position: null },
                                                      { onSuccess: () => { setExistingLinkPickerItemId(null); setExistingLinkPickerIsAddMode(false); } },
                                                    );
                                                  } else {
                                                    setExistingLinkDecision.mutate(
                                                      { itemId: item.id, familyId: existingLinkPickerFamilyId, neighborDocumentId: null, position: null },
                                                      { onSuccess: () => setExistingLinkPickerItemId(null) },
                                                    );
                                                  }
                                                }}
                                              >
                                                {(existingLinkPickerIsAddMode ? createMembership.isPending : setExistingLinkDecision.isPending)
                                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                  : (isFr ? 'Définir comme premier ancrage' : 'Set as first anchor')}
                                              </Button>
                                            </div>
                                          );
                                          return (
                                            <>
                                              <div>
                                                <label className="text-xs font-medium text-blue-900 dark:text-blue-200 block mb-1">
                                                  {isFr ? 'Document voisin' : 'Neighbor document'}
                                                </label>
                                                <select
                                                  className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                                                  value={existingLinkPickerDocId}
                                                  data-testid={`existing-link-doc-select-${item.id}`}
                                                  onChange={(e) => {
                                                    setExistingLinkPickerDocId(e.target.value);
                                                    const doc = fam.documents.find((d) => d.id === e.target.value);
                                                    if (doc) {
                                                      if (doc.canLinkBefore && !doc.canLinkAfter) setExistingLinkPickerPosition('before');
                                                      else if (!doc.canLinkBefore && doc.canLinkAfter) setExistingLinkPickerPosition('after');
                                                    }
                                                  }}
                                                >
                                                  <option value="">
                                                    {isFr ? '— Choisir un document —' : '— Choose a document —'}
                                                  </option>
                                                  {fam.documents.map((d) => (
                                                    <option key={d.id} value={d.id}>
                                                      {d.name}
                                                      {d.effectiveDate ? ` (${d.effectiveDate.slice(0, 10)})` : ''}
                                                    </option>
                                                  ))}
                                                </select>
                                              </div>
                                              {existingLinkPickerDocId && (() => {
                                                const doc = fam.documents.find((d) => d.id === existingLinkPickerDocId);
                                                if (!doc) return null;
                                                return (
                                                  <div>
                                                    <label className="text-xs font-medium text-blue-900 dark:text-blue-200 block mb-1">
                                                      {isFr ? 'Position' : 'Position'}
                                                    </label>
                                                    <div className="flex gap-2">
                                                      {doc.canLinkBefore && (
                                                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                                                          <input
                                                            type="radio"
                                                            name={`existing-link-position-${item.id}`}
                                                            value="before"
                                                            checked={existingLinkPickerPosition === 'before'}
                                                            onChange={() => setExistingLinkPickerPosition('before')}
                                                            data-testid={`existing-link-position-before-${item.id}`}
                                                          />
                                                          {isFr ? 'Avant' : 'Before'}
                                                        </label>
                                                      )}
                                                      {doc.canLinkAfter && (
                                                        <label className="flex items-center gap-1 text-xs cursor-pointer">
                                                          <input
                                                            type="radio"
                                                            name={`existing-link-position-${item.id}`}
                                                            value="after"
                                                            checked={existingLinkPickerPosition === 'after'}
                                                            onChange={() => setExistingLinkPickerPosition('after')}
                                                            data-testid={`existing-link-position-after-${item.id}`}
                                                          />
                                                          {isFr ? 'Après' : 'After'}
                                                        </label>
                                                      )}
                                                    </div>
                                                    {/* Task #1589: add mode creates a membership; standard mode sets link decision */}
                                                    <Button
                                                      size="sm"
                                                      variant="default"
                                                      className="mt-2 h-7 text-xs"
                                                      data-testid={`existing-link-confirm-${item.id}`}
                                                      disabled={existingLinkPickerIsAddMode ? createMembership.isPending : setExistingLinkDecision.isPending}
                                                      onClick={() => {
                                                        if (!existingLinkPickerFamilyId || !existingLinkPickerDocId) return;
                                                        if (existingLinkPickerIsAddMode) {
                                                          createMembership.mutate({
                                                            itemId: item.id,
                                                            familyId: existingLinkPickerFamilyId,
                                                            neighborDocumentId: existingLinkPickerDocId,
                                                            position: existingLinkPickerPosition,
                                                          }, {
                                                            onSuccess: () => {
                                                              setExistingLinkPickerItemId(null);
                                                              setExistingLinkPickerIsAddMode(false);
                                                            },
                                                          });
                                                        } else {
                                                          setExistingLinkDecisionErrors((prev) => {
                                                            const m = new Map(prev); m.delete(item.id); return m;
                                                          });
                                                          setExistingLinkDecision.mutate({
                                                            itemId: item.id,
                                                            familyId: existingLinkPickerFamilyId,
                                                            neighborDocumentId: existingLinkPickerDocId,
                                                            position: existingLinkPickerPosition,
                                                          }, {
                                                            onSuccess: () => {
                                                              setExistingLinkPickerItemId(null);
                                                            },
                                                          });
                                                        }
                                                      }}
                                                    >
                                                      {(existingLinkPickerIsAddMode ? createMembership.isPending : setExistingLinkDecision.isPending)
                                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        : (isFr ? 'Confirmer le lien' : 'Confirm link')}
                                                    </Button>
                                                    {existingLinkDecisionErrors.has(item.id) && (
                                                      <p
                                                        className="text-xs text-red-700 dark:text-red-400 mt-1"
                                                        data-testid={`existing-link-error-${item.id}`}
                                                      >
                                                        {getExistingLinkErrorMessage(
                                                          existingLinkDecisionErrors.get(item.id)?.errorCode,
                                                        )}
                                                      </p>
                                                    )}
                                                  </div>
                                                );
                                              })()}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
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
                                const SiblingIcon = iconForMime(sibling.mimeType, sibling.originalName);
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
                                              chainSiblings: [],
                                              chainIndex: 0,
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
                                                          const FileIconComp = iconForMime(fileItem?.mimeType, fileItem?.originalName);
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
                                                                  <button
                                                                    type="button"
                                                                    disabled={idx === 0}
                                                                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                                                                    aria-label={isFr ? 'Retirer du groupe' : 'Remove from group'}
                                                                    title={
                                                                      idx === 0
                                                                        ? (isFr ? 'Le fichier principal ne peut pas être retiré' : 'The lead file cannot be removed')
                                                                        : (isFr ? 'Retirer du groupe' : 'Remove from group')
                                                                    }
                                                                    data-testid={`branching-merge-remove-${sibling.id}-${idx}`}
                                                                    onClick={() => {
                                                                      if (idx === 0) return;
                                                                      const filtered = displayedMergeGroupIds.filter((_, i) => i !== idx);
                                                                      if (filtered.length <= 1) {
                                                                        cancelAutoSave(sibling.id);
                                                                        setInlineMergeOrder((prev) => {
                                                                          const next = new Map(prev);
                                                                          next.delete(sibling.id);
                                                                          return next;
                                                                        });
                                                                        scheduleAutoSave(sibling, 'keep');
                                                                      } else {
                                                                        setInlineMergeOrder((prev) => new Map(prev).set(sibling.id, filtered));
                                                                        scheduleAutoSave(sibling);
                                                                      }
                                                                    }}
                                                                  >
                                                                    <X className="h-3.5 w-3.5" />
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
                                                      {(() => {
                                                        // Task #1401 — default to AI-suggested split names when the
                                                        // admin hasn't typed an override and the analyzer produced a
                                                        // pair. The hint badge below the input fires when the value
                                                        // still matches the suggestion verbatim.
                                                        // Task #1454 — suppress the badge for stem-fallback values.
                                                        const aiPart1 = sibling.branchSuggestedSplitFinalNames?.[0] ?? null;
                                                        const aiPart2 = sibling.branchSuggestedSplitFinalNames?.[1] ?? null;
                                                        const splitIsRealAi = !!aiPart1 && !(sibling as unknown as { branchSuggestedFinalFileNameIsFallback?: boolean }).branchSuggestedFinalFileNameIsFallback;
                                                        const part1Value = inlineRenameSplit.get(sibling.id)?.[0]
                                                          ?? sibling.sortingDecisionSplitFinalNames?.[0]
                                                          ?? aiPart1
                                                          ?? '';
                                                        const part2Value = inlineRenameSplit.get(sibling.id)?.[1]
                                                          ?? sibling.sortingDecisionSplitFinalNames?.[1]
                                                          ?? aiPart2
                                                          ?? '';
                                                        const part1IsAi = splitIsRealAi && part1Value === aiPart1;
                                                        const part2IsAi = splitIsRealAi && !!aiPart2 && part2Value === aiPart2;
                                                        return (
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
                                                                  value={part1Value}
                                                                  placeholder={`${renameStem} (1)`}
                                                                  onChange={(e) => {
                                                                    const part2 = inlineRenameSplit.get(sibling.id)?.[1] ?? sibling.sortingDecisionSplitFinalNames?.[1] ?? aiPart2 ?? '';
                                                                    setInlineRenameSplit((prev) => new Map(prev).set(sibling.id, [e.target.value, part2]));
                                                                    scheduleAutoSave(sibling);
                                                                  }}
                                                                />
                                                                {fileExt && <span className="text-sm text-muted-foreground shrink-0">{fileExt}</span>}
                                                              </div>
                                                              {part1IsAi && (
                                                                <span
                                                                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                                                                  data-testid={`branching-rename-split-ai-hint-${sibling.id}-0`}
                                                                >
                                                                  <Sparkles className="h-3 w-3" />
                                                                  {isFr ? "Suggestion de l'IA" : 'AI suggestion'}
                                                                </span>
                                                              )}
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
                                                                  value={part2Value}
                                                                  placeholder={`${renameStem} (2)`}
                                                                  onChange={(e) => {
                                                                    const part1 = inlineRenameSplit.get(sibling.id)?.[0] ?? sibling.sortingDecisionSplitFinalNames?.[0] ?? aiPart1 ?? '';
                                                                    setInlineRenameSplit((prev) => new Map(prev).set(sibling.id, [part1, e.target.value]));
                                                                    scheduleAutoSave(sibling);
                                                                  }}
                                                                />
                                                                {fileExt && <span className="text-sm text-muted-foreground shrink-0">{fileExt}</span>}
                                                              </div>
                                                              {part2IsAi && (
                                                                <span
                                                                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                                                                  data-testid={`branching-rename-split-ai-hint-${sibling.id}-1`}
                                                                >
                                                                  <Sparkles className="h-3 w-3" />
                                                                  {isFr ? "Suggestion de l'IA" : 'AI suggestion'}
                                                                </span>
                                                              )}
                                                            </div>
                                                          </>
                                                        );
                                                      })()}
                                                    </>
                                                  ) : (() => {
                                                    // Task #1401 — non-split rename input defaults to the lead
                                                    // item's AI-suggested filename when the admin hasn't typed
                                                    // anything and no `finalFileName` override is persisted yet.
                                                    // Task #1454 — `branchSuggestedFinalFileName` is now always
                                                    // non-null after branching (stem fallback when AI omitted a
                                                    // suggestion). Only show the badge for real AI proposals.
                                                    const aiSuggested = leadItem.branchSuggestedFinalFileName ?? null;
                                                    const isRealAiSuggestion = !!aiSuggested && !(leadItem as unknown as { branchSuggestedFinalFileNameIsFallback?: boolean }).branchSuggestedFinalFileNameIsFallback;
                                                    const renameValue = inlineRename.get(mergeLeadId)
                                                      ?? leadItem.finalFileName
                                                      ?? aiSuggested
                                                      ?? '';
                                                    const isAi = isRealAiSuggestion && renameValue === aiSuggested;
                                                    return (
                                                      <div className="flex flex-col gap-1">
                                                        <label className="text-xs text-muted-foreground">
                                                          {isFr ? 'Nouveau nom :' : 'New name:'}
                                                        </label>
                                                        <div className="flex items-center gap-1">
                                                          <input
                                                            type="text"
                                                            className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                                            data-testid={renameTestId}
                                                            value={renameValue}
                                                            placeholder={renameStem}
                                                            onChange={(e) => {
                                                              setInlineRename((prev) => new Map(prev).set(mergeLeadId, e.target.value));
                                                              scheduleAutoSave(leadItem, sortingPickerStates.get(sibling.id)?.decision);
                                                            }}
                                                          />
                                                          {fileExt && <span className="text-sm text-muted-foreground shrink-0">{fileExt}</span>}
                                                        </div>
                                                        {isAi && (
                                                          <span
                                                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                                                            data-testid={`branching-rename-ai-hint-${mergeLeadId}`}
                                                          >
                                                            <Sparkles className="h-3 w-3" />
                                                            {isFr ? "Suggestion de l'IA" : 'AI suggestion'}
                                                          </span>
                                                        )}
                                                      </div>
                                                    );
                                                  })()}
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
                                                    {(() => {
                                                      const retryLine = formatRetryAttempts(sibDecision.retryCount, isFr);
                                                      return retryLine ? (
                                                        <p
                                                          className="mt-0.5 text-amber-700 dark:text-amber-400"
                                                          data-testid={`detail-fallback-retry-${sibling.id}`}
                                                        >
                                                          {retryLine}
                                                        </p>
                                                      ) : null;
                                                    })()}
                                                    <InlineFallbackRetryButton
                                                      itemId={sibling.id}
                                                      fallbackReason={sibDecision.fallbackReason}
                                                      retryAction={retryAction}
                                                      retryPending={
                                                        (runStep.isPending &&
                                                          runStep.variables?.itemId === sibling.id) ||
                                                        (isAuto &&
                                                          !!progress?.inFlight?.some(
                                                            (e) => e.itemId === sibling.id,
                                                          ))
                                                      }
                                                      hideRetry={false}
                                                      isFr={isFr}
                                                      onRetry={() =>
                                                        retryAction &&
                                                        runStep.mutate({
                                                          itemId: sibling.id,
                                                          action: retryAction,
                                                        })
                                                      }
                                                    />
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
                            {/* Task #1273 — per-row selection checkbox. Hidden
                                for terminal rows (committed/duplicate) so the
                                admin cannot stage a selection the server would
                                reject. Stops click propagation so checking the
                                row never triggers the preview. */}
                            {canToggleExclude && (
                              <Checkbox
                                checked={selectedItemIds.has(item.id)}
                                onCheckedChange={(state) =>
                                  toggleItemSelection(item.id, state === true)
                                }
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`bulk-select-checkbox-${item.id}`}
                                aria-label={
                                  isFr ? 'Sélectionner ce fichier' : 'Select this file'
                                }
                                className="flex-shrink-0"
                              />
                            )}
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
                              onClick={() => setPreviewItem({ id: item.id, originalName: item.originalName, mimeType: item.mimeType, chainSiblings: [], chainIndex: 0 })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setPreviewItem({ id: item.id, originalName: item.originalName, mimeType: item.mimeType, chainSiblings: [], chainIndex: 0 });
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
                                  title={item.originalName}
                                >
                                  {getLinkingDisplayName(item)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {item.status}
                                  {item.mimeType ? ` · ${item.mimeType}` : ''}
                                </span>
                              </div>
                            </div>
                            {currentStep !== 'sorting' && (
                              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:shrink-0" onClick={(e) => e.stopPropagation()}>
                                {showRetry && retryAction && (
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
                                    title={
                                      isExcluded
                                        ? (isFr ? 'Relancer l\'IA — cette ligne restera exclue' : 'Re-run AI — this row will stay excluded')
                                        : (currentStep === 'identification' && item.identificationEffectiveDateManualOverride)
                                        ? (isFr ? 'Relancer l\'IA — votre choix manuel pourrait être écrasé' : 'Re-run AI — this may overwrite your manual choice')
                                        : undefined
                                    }
                                    aria-label={
                                      isExcluded
                                        ? (isFr ? 'Relancer l\'IA — cette ligne restera exclue' : 'Re-run AI — this row will stay excluded')
                                        : (currentStep === 'identification' && item.identificationEffectiveDateManualOverride)
                                        ? (isFr ? 'Relancer l\'IA — votre choix manuel pourrait être écrasé' : 'Re-run AI — this may overwrite your manual choice')
                                        : (isFr ? 'Réessayer' : 'Retry')
                                    }
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
                                {/* Task #1671: inline commit error */}
                                {commitErrors.has(item.id) && (
                                  <span
                                    className="text-xs text-destructive"
                                    data-testid={`commit-error-${item.id}`}
                                  >
                                    {getCommitErrorMessage(commitErrors.get(item.id)!, isFr)}
                                  </span>
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
                                  {/*
                                    Task #1220: render the "Analyzed from text
                                    only" badge in the Sorting step too. The
                                    sorting layout bypasses the shared
                                    FallbackReasonBadge / TextOnlyDegradedBadge
                                    block below (it lives behind
                                    `currentStep !== 'sorting'`), so the badge
                                    is added inline here. Suppressed when an
                                    error fallback was recorded so the error
                                    badge keeps precedence, mirroring the
                                    Screening behaviour from Task #1217.
                                  */}
                                  {currentStep === 'sorting' && !item.sortingFallback && (
                                    <TextOnlyDegradedBadge
                                      degraded={item.sortingDegraded}
                                      isFr={isFr}
                                    />
                                  )}
                                  {currentStep === 'sorting' && !isExcluded && (() => {
                                    const bucketKey = item.branch ?? item.screeningBucketGuess;
                                    if (!bucketKey || bucketKey === 'unknown') return null;
                                    const destLabels = isFr ? BRANCH_DESTINATION_LABEL_FR : BRANCH_DESTINATION_LABEL_EN;
                                    const bucketLabels = isFr ? BUCKET_GUESS_LABEL_FR : BUCKET_GUESS_LABEL_EN;
                                    const bucketLabel = destLabels[bucketKey as BranchDestination] ?? bucketLabels[bucketKey] ?? bucketKey;
                                    return (
                                      <Badge
                                        variant="outline"
                                        className="shrink-0 border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-700 dark:bg-teal-950 dark:text-teal-200"
                                        data-testid={`sorting-branch-bucket-${item.id}`}
                                      >
                                        {bucketLabel}
                                      </Badge>
                                    );
                                  })()}
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
                                        retryCount={decision?.retryCount}
                                      />
                                      {/*
                                        Task #1217 / #1220: render the
                                        "Analyzed from text only" badge
                                        whenever the underlying step worked
                                        from extracted PDF text. The flag is
                                        replayed per step from the Lite
                                        endpoint (`*Degraded`) so admins see
                                        the badge in Screening, Identification
                                        and Linking too — not only in Screening.
                                        The branching step has its own custom
                                        layout (handled separately, see
                                        `branchingDegraded` below). The badge
                                        is suppressed when the step recorded
                                        an error fallback so the error badge
                                        keeps precedence.
                                      */}
                                      {currentStep === 'screening' && !item.screeningFallback && (
                                        <TextOnlyDegradedBadge
                                          degraded={item.screeningDegraded}
                                          isFr={isFr}
                                        />
                                      )}
                                      {currentStep === 'identification' && !item.identificationFallback && (
                                        <TextOnlyDegradedBadge
                                          degraded={item.identificationDegraded}
                                          isFr={isFr}
                                        />
                                      )}
                                      {currentStep === 'linking' && !item.linkingFallback && (
                                        <TextOnlyDegradedBadge
                                          degraded={item.linkingDegraded}
                                          isFr={isFr}
                                        />
                                      )}
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
                                    // What the server currently has — used to determine
                                    // whether the local value is dirty (differs from server).
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
                                        className="flex flex-wrap items-center gap-1"
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
                                          onBlur={() => {
                                            if (!dirty || setEffectiveDate.isPending) return;
                                            setEffectiveDate.mutate({
                                              itemId: item.id,
                                              effectiveDate: trimmed.length > 0 ? trimmed : null,
                                            });
                                          }}
                                          disabled={setEffectiveDate.isPending}
                                          className="h-7 w-full sm:w-40 text-xs"
                                          aria-label={
                                            isFr ? 'Date d’effet' : 'Effective date'
                                          }
                                          data-testid={`identification-effective-date-input-${item.id}`}
                                        />
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
                              {currentStep === 'sorting' && showRetry && retryAction && (
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
                                  title={
                                    isExcluded
                                      ? (isFr ? 'Relancer l\'IA — cette ligne restera exclue' : 'Re-run AI — this row will stay excluded')
                                      : item.sortingManualOverride
                                      ? (isFr ? 'Relancer l\'IA — votre choix manuel pourrait être écrasé' : 'Re-run AI — this may overwrite your manual choice')
                                      : undefined
                                  }
                                  aria-label={
                                    isExcluded
                                      ? (isFr ? 'Relancer l\'IA — cette ligne restera exclue' : 'Re-run AI — this row will stay excluded')
                                      : item.sortingManualOverride
                                      ? (isFr ? 'Relancer l\'IA — votre choix manuel pourrait être écrasé' : 'Re-run AI — this may overwrite your manual choice')
                                      : (isFr ? 'Réessayer' : 'Retry')
                                  }
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
                                {/*
                                  Task #1373 — When the admin uploaded
                                  via Choose folder, surface the parent
                                  folder portion of `originalPath` as a
                                  read-only line so they can verify what
                                  the AI received as a soft hint. We
                                  reuse the same path normalisation as
                                  the server (` / ` separator). Hidden
                                  for Choose-files uploads where
                                  originalPath equals the basename.
                                */}
                                {(() => {
                                  const op = item.originalPath ?? '';
                                  const segments = op
                                    .split(/[\\/]+/)
                                    .filter((s) => s.length > 0);
                                  if (segments.length <= 1) return null;
                                  segments.pop();
                                  const folder = segments.join(' / ');
                                  if (!folder) return null;
                                  return (
                                    <div
                                      className="mb-2 text-xs text-muted-foreground"
                                      data-testid={`item-folder-hint-${item.id}`}
                                    >
                                      <span className="font-medium">
                                        {isFr ? 'Dossier source' : 'Source folder'}:
                                      </span>{' '}
                                      <span className="font-mono">{folder}</span>
                                    </div>
                                  );
                                })()}
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
                                                const FileIconComp = iconForMime(fileItem?.mimeType, fileItem?.originalName);
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
                                                        <button
                                                          type="button"
                                                          disabled={idx === 0}
                                                          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                                                          aria-label={isFr ? 'Retirer du groupe' : 'Remove from group'}
                                                          title={
                                                            idx === 0
                                                              ? (isFr ? 'Le fichier principal ne peut pas être retiré' : 'The lead file cannot be removed')
                                                              : (isFr ? 'Retirer du groupe' : 'Remove from group')
                                                          }
                                                          data-testid={`branching-merge-remove-${item.id}-${idx}`}
                                                          onClick={() => {
                                                            if (idx === 0) return;
                                                            const filtered = displayedMergeGroupIds.filter((_, i) => i !== idx);
                                                            if (filtered.length <= 1) {
                                                              cancelAutoSave(item.id);
                                                              setInlineMergeOrder((prev) => {
                                                                const next = new Map(prev);
                                                                next.delete(item.id);
                                                                return next;
                                                              });
                                                              scheduleAutoSave(item, 'keep');
                                                            } else {
                                                              setInlineMergeOrder((prev) => new Map(prev).set(item.id, filtered));
                                                              scheduleAutoSave(item);
                                                            }
                                                          }}
                                                        >
                                                          <X className="h-3.5 w-3.5" />
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
                                                {(() => {
                                                  // Task #1401 — see twin block in the merge-sibling
                                                  // path above for the value-precedence rationale.
                                                  const aiPart1 = item.branchSuggestedSplitFinalNames?.[0] ?? null;
                                                  const aiPart2 = item.branchSuggestedSplitFinalNames?.[1] ?? null;
                                                  const part1Value = inlineRenameSplit.get(item.id)?.[0]
                                                    ?? item.sortingDecisionSplitFinalNames?.[0]
                                                    ?? aiPart1
                                                    ?? '';
                                                  const part2Value = inlineRenameSplit.get(item.id)?.[1]
                                                    ?? item.sortingDecisionSplitFinalNames?.[1]
                                                    ?? aiPart2
                                                    ?? '';
                                                  const part1IsAi = !!aiPart1 && part1Value === aiPart1;
                                                  const part2IsAi = !!aiPart2 && part2Value === aiPart2;
                                                  return (
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
                                                            value={part1Value}
                                                            placeholder={`${renameStem} (1)`}
                                                            onChange={(e) => {
                                                              const part2 = inlineRenameSplit.get(item.id)?.[1] ?? item.sortingDecisionSplitFinalNames?.[1] ?? aiPart2 ?? '';
                                                              setInlineRenameSplit((prev) => new Map(prev).set(item.id, [e.target.value, part2]));
                                                              scheduleAutoSave(item);
                                                            }}
                                                          />
                                                          {fileExt && <span className="text-sm text-muted-foreground shrink-0">{fileExt}</span>}
                                                        </div>
                                                        {part1IsAi && (
                                                          <span
                                                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                                                            data-testid={`branching-rename-split-ai-hint-${item.id}-0`}
                                                          >
                                                            <Sparkles className="h-3 w-3" />
                                                            {isFr ? "Suggestion de l'IA" : 'AI suggestion'}
                                                          </span>
                                                        )}
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
                                                            value={part2Value}
                                                            placeholder={`${renameStem} (2)`}
                                                            onChange={(e) => {
                                                              const part1 = inlineRenameSplit.get(item.id)?.[0] ?? item.sortingDecisionSplitFinalNames?.[0] ?? aiPart1 ?? '';
                                                              setInlineRenameSplit((prev) => new Map(prev).set(item.id, [part1, e.target.value]));
                                                              scheduleAutoSave(item);
                                                            }}
                                                          />
                                                          {fileExt && <span className="text-sm text-muted-foreground shrink-0">{fileExt}</span>}
                                                        </div>
                                                        {part2IsAi && (
                                                          <span
                                                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                                                            data-testid={`branching-rename-split-ai-hint-${item.id}-1`}
                                                          >
                                                            <Sparkles className="h-3 w-3" />
                                                            {isFr ? "Suggestion de l'IA" : 'AI suggestion'}
                                                          </span>
                                                        )}
                                                      </div>
                                                    </>
                                                  );
                                                })()}
                                              </>
                                            ) : (() => {
                                              // Task #1401 — see twin block in the merge-sibling
                                              // path above for the value-precedence rationale.
                                              const aiSuggested = leadItem.branchSuggestedFinalFileName ?? null;
                                              const renameValue = inlineRename.get(mergeLeadId)
                                                ?? leadItem.finalFileName
                                                ?? aiSuggested
                                                ?? '';
                                              const isAi = !!aiSuggested && renameValue === aiSuggested;
                                              return (
                                                <div className="flex flex-col gap-1">
                                                  <label className="text-xs text-muted-foreground">
                                                    {isFr ? 'Nouveau nom :' : 'New name:'}
                                                  </label>
                                                  <div className="flex items-center gap-1">
                                                    <input
                                                      type="text"
                                                      className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                                      data-testid={renameTestId}
                                                      value={renameValue}
                                                      placeholder={renameStem}
                                                      onChange={(e) => {
                                                        setInlineRename((prev) => new Map(prev).set(mergeLeadId, e.target.value));
                                                        scheduleAutoSave(leadItem, sortingPickerStates.get(item.id)?.decision);
                                                      }}
                                                    />
                                                    {fileExt && <span className="text-sm text-muted-foreground shrink-0">{fileExt}</span>}
                                                  </div>
                                                  {isAi && (
                                                    <span
                                                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                                                      data-testid={`branching-rename-ai-hint-${mergeLeadId}`}
                                                    >
                                                      <Sparkles className="h-3 w-3" />
                                                      {isFr ? "Suggestion de l'IA" : 'AI suggestion'}
                                                    </span>
                                                  )}
                                                </div>
                                              );
                                            })()}
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
                                              {(() => {
                                                const retryLine = formatRetryAttempts(decision.retryCount, isFr);
                                                return retryLine ? (
                                                  <p
                                                    className="mt-0.5 text-amber-700 dark:text-amber-400"
                                                    data-testid={`detail-fallback-retry-${item.id}`}
                                                  >
                                                    {retryLine}
                                                  </p>
                                                ) : null;
                                              })()}
                                              <InlineFallbackRetryButton
                                                itemId={item.id}
                                                fallbackReason={decision.fallbackReason}
                                                retryAction={retryAction}
                                                retryPending={retryPending}
                                                hideRetry={!showRetry}
                                                isFr={isFr}
                                                onRetry={() =>
                                                  retryAction &&
                                                  runStep.mutate({
                                                    itemId: item.id,
                                                    action: retryAction,
                                                  })
                                                }
                                              />
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
                                        {(() => {
                                          const retryLine = formatRetryAttempts(decision.retryCount, isFr);
                                          return retryLine ? (
                                            <p
                                              className="mt-0.5 text-amber-700 dark:text-amber-400"
                                              data-testid={`detail-fallback-retry-${item.id}`}
                                            >
                                              {retryLine}
                                            </p>
                                          ) : null;
                                        })()}
                                        <InlineFallbackRetryButton
                                          itemId={item.id}
                                          fallbackReason={decision.fallbackReason}
                                          retryAction={retryAction}
                                          retryPending={retryPending}
                                          // Task #1225: manual overrides no longer
                                          // suppress the inline Retry button.
                                          // Only draft-split leads (isDraftSplitLead
                                          // → !showRetry) and non-AI steps
                                          // (!retryAction) hide the button.
                                          hideRetry={!showRetry}
                                          isFr={isFr}
                                          onRetry={() =>
                                            retryAction &&
                                            runStep.mutate({
                                              itemId: item.id,
                                              action: retryAction,
                                            })
                                          }
                                        />
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
                        // Task #1069 / #1230: AI-failed files on the current step
                        // (screening / branching / identification / linking)
                        // were auto-promoted with a default value but no real
                        // human assignation. Block Next Step until the admin
                        // retries, accepts, or excludes each one.
                        // Manual overrides (date override on identification,
                        // branch override on branching) are treated as
                        // resolved — see isFallbackPending and
                        // isItemReadyForNextStep, which must agree.
                        // Sorting already gates on sortingDecisionState via
                        // sortingPendingCount above. Complete has no AI step.
                        currentStep === 'screening' ||
                        currentStep === 'branching' ||
                        currentStep === 'identification' ||
                        currentStep === 'linking'
                          ? items.filter(
                              (i) =>
                                i.status !== 'rejected' &&
                                isFallbackPending(
                                  currentStep,
                                  getItemStepDecision(i, currentStep)?.fallbackReason,
                                  {
                                    branchManualOverride: i.branchManualOverride,
                                    identificationEffectiveDateManualOverride:
                                      i.identificationEffectiveDateManualOverride,
                                  },
                                ),
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
                    <p
                      className="text-sm text-muted-foreground"
                      data-testid="complete-committed-count"
                    >
                      {tp('bulkImportCommitted', items.filter((i) => i.status === 'committed').length)}
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
                            onClick={() => setPreviewItem({ id: item.id, originalName: item.originalName, mimeType: item.mimeType, chainSiblings: [], chainIndex: 0 })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setPreviewItem({ id: item.id, originalName: item.originalName, mimeType: item.mimeType, chainSiblings: [], chainIndex: 0 });
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
        chainSiblings={previewItem?.chainSiblings}
        chainIndex={previewItem?.chainIndex}
        onChainNavigate={(newIndex) => {
          if (!previewItem?.chainSiblings) return;
          const sibling = previewItem.chainSiblings[newIndex];
          if (!sibling) return;
          setPreviewItem({
            id: sibling.id,
            originalName: sibling.originalName,
            mimeType: sibling.mimeType,
            chainSiblings: previewItem.chainSiblings,
            chainIndex: newIndex,
            familyGroups: previewItem.familyGroups,
            familyGroupIndex: previewItem.familyGroupIndex,
          });
        }}
        familyGroups={previewItem?.familyGroups}
        familyGroupIndex={previewItem?.familyGroupIndex}
        onFamilyGroupNavigate={(targetIdx) => {
          if (!previewItem?.familyGroups) return;
          const targetGroup = previewItem.familyGroups[targetIdx];
          if (!targetGroup || !targetGroup.siblings.length) return;
          const firstSibling = targetGroup.siblings[0];
          setPreviewItem({
            id: firstSibling.id,
            originalName: firstSibling.originalName,
            mimeType: firstSibling.mimeType,
            chainSiblings: targetGroup.siblings,
            chainIndex: 0,
            familyGroups: previewItem.familyGroups,
            familyGroupIndex: targetIdx,
          });
        }}
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

      {/* Task #1213 — confirm "Cancel bulk retry" for batches at or
          above BULK_RETRY_CONFIRM_THRESHOLD so an accidental click on
          the in-page Cancel button (Task #1208) while scanning a long
          failure list does not abort the whole batch with no undo. */}
      <AlertDialog
        open={pendingBulkRetryCancel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingBulkRetryCancel(null);
          }
        }}
      >
        <AlertDialogContent data-testid="cancel-bulk-retry-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="cancel-bulk-retry-title">
              {isFr
                ? `Annuler la relance groupée (${bulkRetryProgress.processed} sur ${bulkRetryProgress.total}) ?`
                : `Cancel the bulk retry (${bulkRetryProgress.processed} of ${bulkRetryProgress.total})?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isFr
                ? `Arrêter la relance de ${pendingBulkRetryCancel?.remaining ?? 0} fichier(s) sur ${pendingBulkRetryCancel?.total ?? 0} ? La relance en cours se terminera mais aucun nouveau fichier ne sera retenté.`
                : `Stop retrying ${pendingBulkRetryCancel?.remaining ?? 0} of ${pendingBulkRetryCancel?.total ?? 0}? The in-flight retry will finish but no further files will be attempted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-bulk-retry-dismiss">
              {isFr ? 'Continuer la relance' : 'Keep retrying'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmBulkRetryCancel();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="cancel-bulk-retry-confirm"
            >
              {isFr ? 'Arrêter la relance' : 'Stop retrying'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              {pendingResetStep === 'linking'
                ? isFr
                  ? "Les regroupements de fichiers créés lors de cette session seront effacés et relancés par l'IA. Les liens vers des documents déjà présents dans la plateforme (famille et voisin) sont conservés — ces fichiers restent marqués comme liés et ne seront pas réanalysés. Les fichiers exclus, finalisés ou marqués comme doublons ne sont pas touchés."
                  : 'In-session chain groupings will be cleared and re-run by AI. Links to existing platform documents (family and neighbor) are preserved — those files stay marked as linked and will not be re-analyzed. Excluded, committed, and duplicate files are left alone.'
                : isFr
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
