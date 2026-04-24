import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
} from 'lucide-react';
import {
  bandForConfidence,
  type BulkImportFallbackReason,
  type BulkImportItem,
  type BulkImportSession,
  type BulkImportStep,
  type ConfidenceBand,
} from '@shared/schemas/bulk-import';

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

function iconForMime(mime: string | null | undefined) {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return FileImage;
  if (m === 'application/pdf') return FileText;
  if (m.includes('zip') || m.includes('compressed')) return FileArchive;
  if (m.includes('sheet') || m.includes('excel') || m.includes('csv')) return FileSpreadsheet;
  if (m.includes('word') || m.includes('document') || m.startsWith('text/')) return FileText;
  return FileIcon;
}

function ItemThumbnail({ item }: { item: BulkImportItem }) {
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

const STEP_ORDER: BulkImportStep[] = [
  'upload',
  'screening',
  'sorting',
  'branching',
  'identification',
  'linking',
  'complete',
];

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

const FALLBACK_REASON_LABEL_EN: Record<BulkImportFallbackReason, string> = {
  oversize: 'File too large to analyze',
  unsupported_mime: 'File type not supported by AI',
  extraction_failed: 'Could not extract document text',
  missing_file: 'Staged file unreadable',
};
const FALLBACK_REASON_LABEL_FR: Record<BulkImportFallbackReason, string> = {
  oversize: 'Fichier trop volumineux pour l’analyse',
  unsupported_mime: 'Type de fichier non pris en charge',
  extraction_failed: 'Extraction du texte impossible',
  missing_file: 'Fichier en attente illisible',
};

function FallbackReasonBadge({
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
  isFr,
  stepLabels,
}: {
  session: BulkImportSession;
  buildings: HistoryRowBuilding[];
  expanded: boolean;
  onToggle: () => void;
  onResume: () => void;
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
  const { data: sessions = [], isLoading } = useQuery<BulkImportSession[]>({
    queryKey: ['/api/admin/bulk-import/sessions'],
  });
  const sorted = useMemo(
    () =>
      [...sessions].sort(
        (a, b) =>
          new Date(b.createdAt as unknown as string).getTime() -
          new Date(a.createdAt as unknown as string).getTime(),
      ),
    [sessions],
  );

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
            {sorted.map((s) => (
              <HistorySessionRow
                key={s.id}
                session={s}
                buildings={buildings}
                expanded={expandedId === s.id}
                onToggle={() => onToggle(s.id)}
                onResume={() => onResume(s.id)}
                isFr={isFr}
                stepLabels={stepLabels}
              />
            ))}
          </div>
        )}
      </CardContent>
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resume on reload via localStorage.
  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) setSessionId(cached);
  }, []);

  useEffect(() => {
    if (sessionId) localStorage.setItem(STORAGE_KEY, sessionId);
  }, [sessionId]);

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings'],
  });

  const { data: payload, isLoading: loadingSession } = useQuery<SessionPayload>({
    queryKey: ['/api/admin/bulk-import/sessions', sessionId],
    enabled: !!sessionId,
    refetchInterval: 5000,
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
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bulk-import/sessions'] });
      toast({
        title: isFr ? 'Session créée' : 'Session created',
        description: isFr ? 'Vous pouvez téléverser des fichiers.' : 'You can upload files now.',
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
        queryKey: ['/api/admin/bulk-import/sessions', sessionId],
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
        queryKey: ['/api/admin/bulk-import/sessions', sessionId],
      });
      toast({ title: isFr ? 'Téléversement réussi' : 'Files uploaded' });
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
        queryKey: ['/api/admin/bulk-import/sessions', sessionId],
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

  const helpText = isFr
    ? "Importez en lot des dossiers de documents (PDF, Word, Excel, images, zips) pour un immeuble. L'assistant IA vous guide à travers cinq étapes : filtrage, tri, aiguillage, identification et liaison. Vous pouvez fermer la page à tout moment et reprendre — la session est sauvegardée."
    : 'Bulk-import folders of mixed documents (PDF, Word, Excel, images, zips) for one building. The AI assistant walks you through five steps: screening, sorting, branching, identification, and linking. You can close the page at any time and resume — the session is saved.';

  const stepActionFor = (step: BulkImportStep): null | {
    label: string;
    action: 'screen' | 'sort' | 'branch' | 'identify' | 'link' | 'commit';
  } => {
    switch (step) {
      case 'screening':
        return { label: isFr ? 'Filtrer' : 'Screen', action: 'screen' };
      case 'sorting':
        return { label: isFr ? 'Trier' : 'Sort', action: 'sort' };
      case 'branching':
        return { label: isFr ? 'Aiguiller' : 'Branch', action: 'branch' };
      case 'identification':
        return { label: isFr ? 'Identifier' : 'Identify', action: 'identify' };
      case 'linking':
        return { label: isFr ? 'Lier' : 'Link', action: 'link' };
      default:
        return null;
    }
  };

  const stepConfidenceField: Record<string, keyof BulkImportItem> = {
    screening: 'screening',
    sorting: 'sortingDecision',
    branching: 'branchDecision',
    identification: 'identification',
    linking: 'linkDecisions',
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
              <CardContent>
                <p className="text-sm text-muted-foreground">{helpText}</p>
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
                <div className="space-y-2">
                  <Label>{isFr ? 'Immeuble' : 'Building'}</Label>
                  {buildings.length === 0 ? (
                    <p className="text-sm text-muted-foreground" data-testid="text-no-buildings">
                      {isFr ? 'Aucun immeuble disponible.' : 'No buildings available.'}
                    </p>
                  ) : (
                    <div
                      className="grid gap-3 sm:grid-cols-2"
                      data-testid="grid-building-picker"
                    >
                      {buildings.map((b) => {
                        const selected = buildingId === b.id;
                        const location = [b.city, b.province].filter(Boolean).join(', ');
                        const isCreating = createSession.isPending && selected;
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
                                  <Badge variant="outline" className="text-[10px] capitalize">
                                    {b.buildingType}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
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
                    <div className="space-y-2">
                      {items.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          {isFr ? 'Aucun fichier' : 'No items'}
                        </p>
                      )}
                      {items.map((item) => {
                        const action = stepActionFor(currentStep);
                        const field = stepConfidenceField[currentStep];
                        const decision = field
                          ? (item[field] as {
                              confidence?: number;
                              fallbackReason?: BulkImportFallbackReason | null;
                            } | null)
                          : null;
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 rounded-md border p-3"
                            data-testid={`item-row-${item.id}`}
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <ItemThumbnail item={item} />
                              <div className="min-w-0 flex flex-col">
                                <span className="truncate font-medium">{item.originalName}</span>
                                <span className="text-xs text-muted-foreground">
                                  {item.status}
                                  {item.mimeType ? ` · ${item.mimeType}` : ''}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <FallbackReasonBadge
                                reason={decision?.fallbackReason}
                                isFr={isFr}
                              />
                              <ConfidenceBadge value={decision?.confidence} />
                              {action && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    runStep.mutate({ itemId: item.id, action: action.action })
                                  }
                                  disabled={runStep.isPending}
                                  data-testid={`button-${action.action}-${item.id}`}
                                >
                                  {runStep.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  {action.label}
                                </Button>
                              )}
                              {currentStep === 'linking' && item.status === 'linked' && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() =>
                                    runStep.mutate({ itemId: item.id, action: 'commit' })
                                  }
                                  data-testid={`button-commit-${item.id}`}
                                >
                                  {isFr ? 'Sauvegarder' : 'Commit'}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        disabled={stepIndex >= STEP_ORDER.length - 1}
                        onClick={() => updateStep.mutate(STEP_ORDER[stepIndex + 1])}
                        data-testid="button-next-step"
                      >
                        {isFr ? 'Étape suivante' : 'Next step'}
                      </Button>
                    </div>
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
