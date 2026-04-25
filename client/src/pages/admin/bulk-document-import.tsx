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
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useLanguage } from '@/hooks/use-language';
import {
  Upload,
  Trash2,
  Sparkles,
  ChevronRight,
  ChevronDown,
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
} from 'lucide-react';
import {
  type BulkImportFallbackReason,
  type BulkImportItem,
  type BulkImportSession,
  type BulkImportStep,
} from '@shared/schemas/bulk-import';
import { ConfidenceBadge } from './bulk-import-confidence-badge';
import { FallbackReasonBadge } from './bulk-import-fallback-reason-badge';
import {
  AUTO_STEPS,
  NextStepBlock,
  STEP_ORDER,
  STEP_PRE_STATUS,
  isAutoStep,
  type AutoStep,
} from './bulk-import-next-step-block';
import { DocumentInlineViewer } from '@/components/common/DocumentInlineViewer';

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

/** Lean item shape returned by the /lite polling endpoint (Task #727). */
interface BulkImportItemLite {
  id: string;
  originalName: string;
  mimeType: string | null;
  status: BulkImportItem['status'];
  preExcludeStatus: BulkImportItem['status'] | null;
  screeningConfidence: number | null;
  screeningFallback: BulkImportFallbackReason | null;
  /** quickAnalysis fields from Screening (Task #767). Null for old sessions. */
  screeningTypeGuess: string | null;
  screeningBucketGuess: string | null;
  screeningQaReason: string | null;
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
  branchingConfidence: number | null;
  branchingFallback: BulkImportFallbackReason | null;
  identificationConfidence: number | null;
  identificationFallback: BulkImportFallbackReason | null;
  linkingConfidence: number | null;
  linkingFallback: BulkImportFallbackReason | null;
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

interface SessionPayload {
  session: BulkImportSession;
  items: BulkImportItem[];
}

const HISTORY_PAGE_SIZE = 20;

interface RunAllProgress {
  total: number;
  processed: number;
  failed: number;
  startedAt: string;
  finishedAt: string | null;
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
function hasQuickAnalysisSignal(item: BulkImportItemLite): boolean {
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
                  return (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-sm border bg-background px-3 py-2"
                      data-testid={`history-item-${item.id}`}
                    >
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
  const toggleItemExpanded = (id: string) =>
    setExpandedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Filters for the building picker on the "Start a session" card
  // (Task #600). Local-only state; not persisted across reloads.
  const [buildingSearch, setBuildingSearch] = useState('');
  const [buildingTypeFilter, setBuildingTypeFilter] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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
    // Poll faster while auto-screening is in progress so the per-item
    // status / confidence badges update in near real-time. Once every
    // file has a final status we throttle back to 5s (Task #575).
    refetchInterval: (query) => {
      const data = query.state.data as SessionPayloadLite | undefined;
      if (!data) return 5000;
      const screeningActive =
        data.session.currentStep === 'screening' &&
        data.items.some((i) => i.status === 'pending' || i.status === 'screening');
      return screeningActive ? 2000 : 5000;
    },
  });

  const session = payload?.session;
  const items = payload?.items ?? [];
  const currentStep: BulkImportStep = session?.currentStep ?? 'upload';

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

  const uploadFiles = useMutation({
    mutationFn: async (files: FileList) => {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('files', f));
      const res = await fetch(
        `/api/admin/bulk-import/sessions/${sessionId}/items`,
        { method: 'POST', body: fd, credentials: 'include' },
      );
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/admin/bulk-import/sessions', sessionId, 'lite'],
      });
      toast({ title: isFr ? 'Téléversement réussi' : 'Files uploaded' });
    },
  });

  /**
   * Kick off the server-side fire-and-forget screen-all loop (Task
   * #575). The server returns immediately and processes pending items
   * sequentially in the background, so we never block the user — they
   * can leave the page and the screening will continue.
   */
  const screenAll = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        'POST',
        `/api/admin/bulk-import/sessions/${sessionId}/screen-all`,
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
   * Track which session we've already auto-triggered screen-all for so
   * the effect below does not fire repeatedly while the wizard polls.
   * The server-side lock is the real source of truth (it returns 202
   * `in-progress` if already running), but skipping a redundant POST
   * avoids needless network traffic. The flag is only set after the
   * mutation *succeeds* so a transient network failure does not
   * permanently disable the auto-trigger for this session.
   */
  const autoScreenedSessionRef = useRef<string | null>(null);
  /**
   * Synchronous guard against firing the mutation twice from rapid
   * re-renders before the first request resolves (the ref above is
   * only set on success, so it cannot guard against the in-flight
   * window on its own).
   */
  const screenAllInFlightRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    if (currentStep !== 'screening') return;
    if (items.length === 0) return;
    if (autoScreenedSessionRef.current === sessionId) return;
    if (screenAllInFlightRef.current) return;

    const hasScreening = items.some((i) => i.status === 'screening');
    const hasPending = items.some((i) => i.status === 'pending');
    // If any item is already screening, the server-side loop is in
    // progress — just keep polling, do not re-trigger (matches the
    // task spec exactly).
    if (hasScreening) {
      autoScreenedSessionRef.current = sessionId;
      return;
    }
    if (!hasPending) return;

    screenAllInFlightRef.current = true;
    screenAll.mutate(undefined, {
      onSuccess: () => {
        autoScreenedSessionRef.current = sessionId;
        screenAllInFlightRef.current = false;
      },
      onError: () => {
        // Leave `autoScreenedSessionRef` unset so the next poll can
        // retry the trigger after a transient failure.
        screenAllInFlightRef.current = false;
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, currentStep, items.length, items.map((i) => i.status).join(',')]);

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
    ? "Importez en lot des dossiers de documents (PDF, Word, Excel, images, zips) pour un immeuble. L'assistant vous guide à travers 7 étapes. Vous pouvez fermer la page à tout moment et reprendre — la session est sauvegardée."
    : 'Bulk-import folders of mixed documents (PDF, Word, Excel, images, zips) for one building. The wizard walks you through 7 steps. You can close the page at any time and resume — the session is saved.';

  const stepDescriptions: Record<BulkImportStep, string> = isFr
    ? {
        upload:
          "Choisissez l'immeuble et déposez les documents (PDF, Word, Excel, images ou archives zip) à traiter.",
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
          'Choose the building and drop in the documents (PDF, Word, Excel, images, or zip archives) you want to process.',
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
                  <CardHeader>
                    <CardTitle>
                      {isFr ? 'Étape :' : 'Step:'} {stepLabels[currentStep]}
                    </CardTitle>
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
                        const isRunning =
                          (!!progress && !progress.finishedAt) ||
                          runAll.isPending;
                        const noWork = !progress && !runAll.isPending;
                        return (
                          <div
                            className="mb-3 flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm"
                            data-testid={`auto-run-progress-${currentStep}`}
                          >
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
                          </div>
                        );
                      })()}
                    <div className="space-y-2">
                      {items.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          {isFr ? 'Aucun fichier' : 'No items'}
                        </p>
                      )}
                      {items.map((item) => {
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
                        const isExcluded = item.status === 'rejected';
                        const showRetry =
                          !isExcluded &&
                          !!retryAction &&
                          ((!!decision?.fallbackReason) ||
                            (stillEligible && !!progress?.finishedAt));
                        // Committed/duplicate items are terminal and
                        // not eligible for the exclude toggle (matches
                        // the server-side guard).
                        const canToggleExclude =
                          item.status !== 'committed' &&
                          item.status !== 'duplicate';
                        const togglePending =
                          toggleExclude.isPending &&
                          toggleExclude.variables?.itemId === item.id;
                        // Only offer an expansion control when there's
                        // actually quickAnalysis signal worth showing.
                        // Items with no AI guesses (or all-unknown) keep
                        // the compact row layout (Task #771).
                        const hasAnalysis = hasQuickAnalysisSignal(item);
                        const isExpanded = expandedItemIds.has(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`rounded-md border transition ${
                              isExcluded ? 'bg-muted/40 opacity-60' : ''
                            }`}
                            data-testid={`item-row-${item.id}`}
                            data-excluded={isExcluded ? 'true' : 'false'}
                          >
                            <div className="flex items-center justify-between gap-3 p-3">
                            {hasAnalysis ? (
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
                            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                              {isExcluded && (
                                <Badge
                                  variant="outline"
                                  className="border-amber-300 bg-amber-50 text-amber-900"
                                  data-testid={`badge-excluded-${item.id}`}
                                >
                                  {isFr ? 'Exclu' : 'Excluded'}
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
                                  {currentStep === 'sorting' && decision?.decision && (
                                    <Badge
                                      variant="outline"
                                      className="shrink-0 border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200"
                                      title={(() => {
                                        const base = decision.reason ?? '';
                                        if (decision.decision === 'merge' && decision.mergeWithItemId) {
                                          const sibling = items.find((i) => i.id === decision.mergeWithItemId);
                                          const siblingName = sibling?.originalName ?? decision.mergeWithItemId;
                                          return isFr
                                            ? `${base}${base ? ' · ' : ''}Fusionner avec : ${siblingName}`
                                            : `${base}${base ? ' · ' : ''}Merge with: ${siblingName}`;
                                        }
                                        return base || undefined;
                                      })()}
                                      data-testid={`sorting-decision-${item.id}`}
                                    >
                                      {decision.decision === 'keep'
                                        ? isFr ? 'Conserver' : 'Keep'
                                        : decision.decision === 'merge'
                                        ? isFr ? 'Fusionner' : 'Merge'
                                        : isFr ? 'Scinder' : 'Split'}
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
                                  <FallbackReasonBadge
                                    reason={decision?.fallbackReason}
                                    isFr={isFr}
                                  />
                                  <ConfidenceBadge
                                    value={decision?.confidence}
                                    fallbackReason={decision?.fallbackReason}
                                    isFr={isFr}
                                  />
                                </>
                              )}
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
                                  disabled={runStep.isPending}
                                  data-testid={`button-retry-${currentStep}-${item.id}`}
                                >
                                  {runStep.isPending ? (
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
                            </div>
                            {hasAnalysis && isExpanded && (
                              <div
                                className="border-t bg-muted/30 px-3 py-3"
                                data-testid={`item-detail-panel-${item.id}`}
                              >
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {isFr ? 'Analyse de l’IA' : 'AI analysis'}
                                </div>
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
                                {item.screeningQaReason && (
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
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <NextStepBlock
                      items={items}
                      currentStep={currentStep}
                      stepIndex={stepIndex}
                      isFr={isFr}
                      onNext={() => updateStep.mutate(STEP_ORDER[stepIndex + 1])}
                    />
                  </CardContent>
                </Card>
              )}

              {currentStep === 'complete' && (
                <Card>
                  <CardHeader>
                    <CardTitle>{isFr ? 'Terminé' : 'Complete'}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {isFr
                        ? `${items.filter((i) => i.status === 'committed').length} document(s) sauvegardé(s).`
                        : `${items.filter((i) => i.status === 'committed').length} document(s) committed.`}
                    </p>
                    {items.length > 0 && (
                      <div className="space-y-2">
                        {items.map((item) => (
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
                    )}
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
    </div>
  );
}
