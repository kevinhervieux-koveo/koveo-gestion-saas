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
  bandForConfidence,
  type BulkImportFallbackReason,
  type BulkImportItem,
  type BulkImportSession,
  type BulkImportStep,
  type ConfidenceBand,
} from '@shared/schemas/bulk-import';
import { FallbackReasonBadge } from './bulk-import-fallback-reason-badge';

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
  sortingConfidence: number | null;
  sortingFallback: BulkImportFallbackReason | null;
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
): { confidence: number | null; fallbackReason: BulkImportFallbackReason | null } | null {
  switch (step) {
    case 'screening':
      return { confidence: item.screeningConfidence, fallbackReason: item.screeningFallback };
    case 'sorting':
      return { confidence: item.sortingConfidence, fallbackReason: item.sortingFallback };
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

const STEP_ORDER: BulkImportStep[] = [
  'upload',
  'screening',
  'sorting',
  'branching',
  'identification',
  'linking',
  'complete',
];

/** AI steps that are auto-run server-side (Task #592). */
type AutoStep = 'screening' | 'sorting' | 'branching' | 'identification' | 'linking';
const AUTO_STEPS: ReadonlyArray<AutoStep> = [
  'screening',
  'sorting',
  'branching',
  'identification',
  'linking',
];
function isAutoStep(step: BulkImportStep): step is AutoStep {
  return (AUTO_STEPS as readonly string[]).includes(step);
}

/** Status the item must be in before a step's run-all loop will pick it up. */
const STEP_PRE_STATUS: Record<AutoStep, BulkImportItem['status']> = {
  screening: 'pending',
  sorting: 'screened',
  branching: 'sorted',
  identification: 'branched',
  linking: 'identified',
};

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

const STEP_LABEL_EN: Record<BulkImportStep, string> = {
  upload: 'Upload',
  screening: 'Screening',
  sorting: 'Sorting',
  branching: 'Branching',
  identification: 'Identification',
  linking: 'Linking',
  complete: 'Complete',
};
const STEP_LABEL_FR: Record<BulkImportStep, string> = {
  upload: 'Téléversement',
  screening: 'Filtrage',
  sorting: 'Tri',
  branching: 'Aiguillage',
  identification: 'Identification',
  linking: 'Liaison',
  complete: 'Terminé',
};

const STORAGE_KEY = 'bulkImportActiveSessionId';

function ConfidenceBadge({ value }: { value: number | undefined | null }) {
  const band: ConfidenceBand = bandForConfidence(value);
  const variant: Record<ConfidenceBand, string> = {
    low: 'bg-red-100 text-red-800',
    medium: 'bg-amber-100 text-amber-800',
    high: 'bg-emerald-100 text-emerald-800',
  };
  const pct = value == null ? '—' : `${Math.round(value * 100)}%`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${variant[band]}`}
      data-testid={`badge-confidence-${band}`}
    >
      <Sparkles className="h-3 w-3" /> {pct}
    </span>
  );
}

const HISTORY_STEP_FIELDS: ReadonlyArray<{
  field: keyof BulkImportItem;
  labelEn: string;
  labelFr: string;
}> = [
  { field: 'screening', labelEn: 'Screening', labelFr: 'Filtrage' },
  { field: 'sortingDecision', labelEn: 'Sorting', labelFr: 'Tri' },
  { field: 'branchDecision', labelEn: 'Branching', labelFr: 'Aiguillage' },
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
        sorting:
          'Chaque document conservé est automatiquement classé dans une catégorie (facture, contrat, procès-verbal, etc.).',
        branching:
          'Les fichiers contenant plusieurs documents sont scindés au besoin en documents distincts.',
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
        sorting:
          'Each kept document is automatically classified into a category (e.g. invoice, contract, minutes).',
        branching:
          'Files that contain several documents are split into the right number of separate documents when needed.',
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
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between gap-3 rounded-md border p-3 transition ${
                              isExcluded ? 'bg-muted/40 opacity-60' : ''
                            }`}
                            data-testid={`item-row-${item.id}`}
                            data-excluded={isExcluded ? 'true' : 'false'}
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
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
                            <div className="flex items-center gap-3">
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
                                  <FallbackReasonBadge
                                    reason={decision?.fallbackReason}
                                    isFr={isFr}
                                  />
                                  <ConfidenceBadge value={decision?.confidence} />
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
                        );
                      })}
                    </div>
                    {(() => {
                      const stillAnalyzingCount = isAutoStep(currentStep)
                        ? items.filter((item) => {
                            if (item.status === 'rejected') return false;
                            const preStatus = STEP_PRE_STATUS[currentStep as AutoStep];
                            return (
                              item.status === preStatus ||
                              (currentStep === 'screening' && item.status === 'screening')
                            );
                          }).length
                        : 0;
                      const isNextBlocked =
                        stepIndex >= STEP_ORDER.length - 1 || stillAnalyzingCount > 0;
                      return (
                        <div className="mt-4 flex flex-col items-end gap-2">
                          {stillAnalyzingCount > 0 && (
                            <p
                              className="text-sm text-amber-700"
                              data-testid="analyzing-warning"
                            >
                              {isFr
                                ? `${stillAnalyzingCount} document(s) sont encore en cours d'analyse. Attendez la fin de l'analyse ou excluez-les pour continuer.`
                                : `${stillAnalyzingCount} document(s) are still being analyzed. Wait for them to finish or exclude them to continue.`}
                            </p>
                          )}
                          <Button
                            variant="outline"
                            disabled={isNextBlocked}
                            onClick={() => updateStep.mutate(STEP_ORDER[stepIndex + 1])}
                            data-testid="button-next-step"
                          >
                            {isFr ? 'Étape suivante' : 'Next step'}
                          </Button>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {currentStep === 'complete' && (
                <Card>
                  <CardHeader>
                    <CardTitle>{isFr ? 'Terminé' : 'Complete'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {isFr
                        ? `${items.filter((i) => i.status === 'committed').length} document(s) sauvegardé(s).`
                        : `${items.filter((i) => i.status === 'committed').length} document(s) committed.`}
                    </p>
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
