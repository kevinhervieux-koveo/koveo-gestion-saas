// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Download,
  X,
  FileText,
  FileSpreadsheet,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  LinkIcon,
  Pencil,
  ListOrdered,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { DocumentLinkPickerDialog } from '@/components/documents/DocumentLinkPickerDialog';
import { DocumentSequencePanel } from '@/components/documents/DocumentSequencePanel';
import { parseDateOnlyLoose } from '@/lib/utils';
import { getSystemFamilyDisplay } from '@/lib/system-family-display';

export interface ChainSibling {
  id: string;
  originalName: string;
  mimeType: string | null;
}

interface DocumentInlineViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName?: string | null;
  downloadUrl?: string;
  mimeType?: string | null;
  documentId?: string;
  onNavigate?: (documentId: string) => void;
  chainSiblings?: ChainSibling[];
  chainIndex?: number;
  onChainNavigate?: (index: number) => void;
}

interface NeighborInfo {
  id: string;
  name: string;
  source: 'explicit' | 'date' | null;
  effectiveDate: string | null;
  createdAt: string;
  documentType: string | null;
}

interface FamilyRow {
  familyId: string;
  familyName: string;
  familyDescription: string | null;
  familyIsSystem: boolean;
  previous: NeighborInfo | null;
  previousIsChainEnd: boolean;
  next: NeighborInfo | null;
  nextIsChainEnd: boolean;
}

interface NeighborsResponse {
  currentId: string;
  families: FamilyRow[];
}

type LinkPickerState = false | { position: 'before' | 'after'; familyId: string | null };

type PreviewKind = 'pdf' | 'image' | 'text' | 'spreadsheet' | 'unsupported';
type PreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; blobUrl: string }
  | { status: 'error' };

type SheetData = { name: string; rows: string[][] };
type SpreadsheetState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; sheets: SheetData[]; activeSheet: number; page: number }
  | { status: 'error' };

const SPREADSHEET_PAGE_SIZE = 50;
const SPREADSHEET_MAX_COLS = 30;

const SPREADSHEET_MIMES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.oasis.opendocument.spreadsheet',
]);
const SPREADSHEET_EXTS = new Set(['xlsx', 'xls', 'xlsm', 'ods']);

function formatNeighborDate(n: NeighborInfo): string {
  if (n.effectiveDate) {
    const eff = parseDateOnlyLoose(n.effectiveDate);
    if (eff) return eff.toLocaleDateString();
  }
  if (!n.createdAt) return '';
  const d = new Date(n.createdAt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}

function getExtension(name?: string | null): string {
  if (!name) return '';
  const idx = name.lastIndexOf('.');
  if (idx < 0) return '';
  return name.slice(idx + 1).toLowerCase();
}

function detectPreviewKind(mimeType?: string | null, fileName?: string | null): PreviewKind {
  const mime = (mimeType || '').toLowerCase();
  const ext = getExtension(fileName);
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext)) return 'image';
  if (SPREADSHEET_MIMES.has(mime) || SPREADSHEET_EXTS.has(ext)) return 'spreadsheet';
  if (mime.startsWith('text/') || ['txt', 'csv', 'log', 'md', 'tsv'].includes(ext)) return 'text';
  return 'unsupported';
}

export function DocumentInlineViewer({
  isOpen,
  onClose,
  fileUrl,
  fileName,
  downloadUrl,
  mimeType,
  documentId,
  onNavigate,
  chainSiblings,
  chainIndex,
  onChainNavigate,
}: DocumentInlineViewerProps) {
  const { toast } = useToast();
  const { t } = useLanguage();

  // Family navigation state
  const [activeFamilyIdx, setActiveFamilyIdx] = useState(0);
  // sequence panel: null = closed, true = open (tracks active family)
  const [seqPanelOpen, setSeqPanelOpen] = useState(false);
  const [linkPickerOpen, setLinkPickerOpen] = useState<LinkPickerState>(false);

  const { data: neighbors } = useQuery<NeighborsResponse>({
    queryKey: ['/api/documents', documentId, 'neighbors'],
    enabled: !!documentId && isOpen,
  });

  const families: FamilyRow[] = neighbors?.families ?? [];
  const activeFamily: FamilyRow | undefined = families[activeFamilyIdx];

  // Clamp active index when families change
  useEffect(() => {
    if (families.length > 0 && activeFamilyIdx >= families.length) {
      setActiveFamilyIdx(families.length - 1);
    }
  }, [families.length, activeFamilyIdx]);

  // Keyboard navigation scoped to dialog content via onKeyDown handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (!activeFamily) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (activeFamily.previous && onNavigate) onNavigate(activeFamily.previous.id);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (activeFamily.next && onNavigate) onNavigate(activeFamily.next.id);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveFamilyIdx((idx) => Math.max(0, idx - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setActiveFamilyIdx((idx) => Math.min(families.length - 1, idx + 1));
          break;
        default:
          break;
      }
    },
    [activeFamily, families.length, onNavigate],
  );

  const previewKind = useMemo(() => detectPreviewKind(mimeType, fileName), [mimeType, fileName]);
  const needsFetch = previewKind === 'pdf' || previewKind === 'text';
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' });

  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetState>({ status: 'idle' });

  useEffect(() => {
    if (!isOpen || !needsFetch) {
      setPreview({ status: 'idle' });
      return;
    }
    let cancelled = false;
    let createdBlobUrl: string | undefined;
    setPreview({ status: 'loading' });
    (async () => {
      try {
        const response = await fetch(fileUrl, { method: 'GET', credentials: 'include' });
        if (cancelled) return;
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const blob = await response.blob();
        if (cancelled) return;
        createdBlobUrl = window.URL.createObjectURL(blob);
        setPreview({ status: 'ready', blobUrl: createdBlobUrl });
      } catch {
        if (cancelled) return;
        setPreview({ status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
      if (createdBlobUrl) window.URL.revokeObjectURL(createdBlobUrl);
    };
  }, [isOpen, needsFetch, fileUrl]);

  useEffect(() => {
    if (!isOpen || previewKind !== 'spreadsheet') {
      setSpreadsheet({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setSpreadsheet({ status: 'loading' });
    (async () => {
      try {
        const response = await fetch(fileUrl, { method: 'GET', credentials: 'include' });
        if (cancelled) return;
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.default.Workbook();
        // @ts-expect-error ExcelJS Buffer type predates the generic Buffer<T> introduced in @types/node >=22; ArrayBuffer is compatible at runtime
        await workbook.xlsx.load(arrayBuffer);
        const sheets: SheetData[] = workbook.worksheets.map((worksheet) => {
          const colCount = Math.min(worksheet.columnCount, SPREADSHEET_MAX_COLS);
          const rows: string[][] = [];
          worksheet.eachRow({ includeEmpty: false }, (row) => {
            const cells: string[] = [];
            for (let i = 1; i <= colCount; i++) {
              const v = row.getCell(i).value;
              cells.push(v == null ? '' : String(v));
            }
            if (cells.some((c) => c !== '')) rows.push(cells);
          });
          return { name: worksheet.name, rows };
        });
        if (cancelled) return;
        setSpreadsheet({ status: 'ready', sheets, activeSheet: 0, page: 0 });
      } catch {
        if (cancelled) return;
        setSpreadsheet({ status: 'error' });
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, previewKind, fileUrl]);

  const handleDownload = async () => {
    const url = downloadUrl ?? (fileUrl.includes('?') ? `${fileUrl}&download=true` : `${fileUrl}?download=true`);
    try {
      const response = await fetch(url, { method: 'GET', credentials: 'include' });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const contentDisposition = response.headers.get('Content-Disposition');
      let resolvedName = fileName || 'document';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match) resolvedName = match[1];
      }
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.download = resolvedName;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: t('downloadFailed') || 'Download failed', description: message, variant: 'destructive' });
    }
  };

  const displayName = fileName || t('documentAttachment') || 'Document';

  const renderUnsupportedFallback = (testId: string) => (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center gap-4" data-testid={testId}>
      <FileText className="w-16 h-16 text-gray-400" />
      <div className="space-y-1">
        <p className="text-base font-medium">{t('previewNotAvailable') || 'Preview not available'}</p>
        <p className="text-sm text-gray-500 max-w-md">
          {t('previewNotAvailableDescription') || 'This file type cannot be previewed. Download the file to open it in a compatible application.'}
        </p>
      </div>
      <Button type="button" onClick={handleDownload} data-testid="button-inline-viewer-download-fallback">
        <Download className="w-4 h-4 mr-2" />
        {t('download') || 'Download'}
      </Button>
    </div>
  );

  const renderSpreadsheetPreview = () => {
    if (spreadsheet.status === 'loading' || spreadsheet.status === 'idle') {
      return (
        <div className="w-full h-full flex items-center justify-center" data-testid="spreadsheet-viewer-loading">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      );
    }
    if (spreadsheet.status === 'error') return renderUnsupportedFallback('spreadsheet-viewer-error');
    const { sheets, activeSheet, page } = spreadsheet;
    if (!sheets.length) return renderUnsupportedFallback('spreadsheet-viewer-empty');
    const currentSheet = sheets[activeSheet] ?? sheets[0];
    const totalPages = Math.ceil(currentSheet.rows.length / SPREADSHEET_PAGE_SIZE);
    const pageRows = currentSheet.rows.slice(
      page * SPREADSHEET_PAGE_SIZE,
      (page + 1) * SPREADSHEET_PAGE_SIZE,
    );
    const setSheetPage = (newPage: number) => {
      setSpreadsheet((prev) =>
        prev.status === 'ready' ? { ...prev, page: newPage } : prev,
      );
    };
    const setActiveSheetIndex = (idx: number) => {
      setSpreadsheet((prev) =>
        prev.status === 'ready' ? { ...prev, activeSheet: idx, page: 0 } : prev,
      );
    };
    return (
      <div className="w-full h-full flex flex-col overflow-hidden" data-testid="spreadsheet-viewer">
        {sheets.length > 1 && (
          <div className="flex gap-1 px-2 pt-2 border-b bg-muted/30 shrink-0 flex-wrap" data-testid="spreadsheet-tabs">
            {sheets.map((sheet, idx) => (
              <button
                key={sheet.name}
                type="button"
                onClick={() => setActiveSheetIndex(idx)}
                className={[
                  'px-3 py-1 text-xs rounded-t border transition-colors',
                  idx === activeSheet
                    ? 'bg-background border-b-background font-semibold'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground',
                ].join(' ')}
                data-testid={`spreadsheet-tab-${idx}`}
              >
                {sheet.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-auto">
          {pageRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-muted-foreground">
              <FileSpreadsheet className="w-10 h-10 mb-2" />
              <p className="text-sm">Empty sheet</p>
            </div>
          ) : (
            <table className="text-xs border-collapse w-full" data-testid="spreadsheet-table">
              <tbody>
                {pageRows.map((row, rIdx) => (
                  <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className="border border-border px-2 py-0.5 whitespace-pre-wrap max-w-[200px] truncate"
                        title={cell}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 px-3 py-1 border-t shrink-0 text-xs text-muted-foreground bg-muted/20" data-testid="spreadsheet-pagination">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setSheetPage(page - 1)}
              className="px-2 py-0.5 rounded border disabled:opacity-40 hover:bg-muted transition-colors"
              data-testid="spreadsheet-page-prev"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span data-testid="spreadsheet-page-indicator">
              Rows {page * SPREADSHEET_PAGE_SIZE + 1}–{Math.min((page + 1) * SPREADSHEET_PAGE_SIZE, currentSheet.rows.length)} of {currentSheet.rows.length}
            </span>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setSheetPage(page + 1)}
              className="px-2 py-0.5 rounded border disabled:opacity-40 hover:bg-muted transition-colors"
              data-testid="spreadsheet-page-next"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderPreview = () => {
    switch (previewKind) {
      case 'image':
        return (
          <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
            <img src={fileUrl} alt={displayName} className="max-w-full max-h-full object-contain" data-testid="img-inline-viewer" />
          </div>
        );
      case 'pdf':
      case 'text':
        if (preview.status === 'loading' || preview.status === 'idle') {
          return <div className="w-full h-full flex items-center justify-center" data-testid="inline-viewer-loading"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
        }
        if (preview.status === 'error') return renderUnsupportedFallback('inline-viewer-error');
        return <iframe src={preview.blobUrl} title={displayName} className="w-full h-full border-0" data-testid="iframe-inline-viewer" />;
      case 'spreadsheet':
        return renderSpreadsheetPreview();
      default:
        return renderUnsupportedFallback('inline-viewer-unsupported');
    }
  };

  // Renders a single family navigation row
  const renderFamilyRow = (family: FamilyRow, idx: number) => {
    const isActive = idx === activeFamilyIdx;

    return (
      <div
        key={family.familyId}
        role="option"
        aria-selected={isActive}
        tabIndex={0}
        className={[
          'flex items-center gap-2 px-3 py-1.5 border-b transition-colors cursor-pointer select-none focus:outline-none focus:ring-1 focus:ring-inset focus:ring-primary',
          isActive ? 'bg-accent/50' : 'hover:bg-muted/30',
        ].join(' ')}
        onClick={() => setActiveFamilyIdx(idx)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveFamilyIdx(idx); } }}
        data-testid={`family-nav-row-${family.familyId}`}
      >
        {/* Up/down arrows — only when > 1 family */}
        {families.length > 1 && (
          <div className="flex flex-col shrink-0">
            <button
              type="button"
              className="p-0 h-3 text-muted-foreground hover:text-foreground disabled:opacity-30"
              onClick={(e) => { e.stopPropagation(); setActiveFamilyIdx(Math.max(0, idx - 1)); }}
              disabled={idx === 0}
              aria-label="Previous family"
              tabIndex={-1}
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              type="button"
              className="p-0 h-3 text-muted-foreground hover:text-foreground disabled:opacity-30"
              onClick={(e) => { e.stopPropagation(); setActiveFamilyIdx(Math.min(families.length - 1, idx + 1)); }}
              disabled={idx === families.length - 1}
              aria-label="Next family"
              tabIndex={-1}
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Family label */}
        {(() => {
          const display = getSystemFamilyDisplay(
            { name: family.familyName, description: family.familyDescription, isSystem: family.familyIsSystem ?? false },
            t,
          );
          return (
            <span className="text-xs font-medium text-muted-foreground shrink-0 min-w-[80px] max-w-[100px] truncate" title={display.description ?? display.name}>
              {display.name}
            </span>
          );
        })()}

        {/* Previous side */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {family.previous ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={(e) => { e.stopPropagation(); onNavigate?.(family.previous!.id); }}
                disabled={!onNavigate}
                data-testid={`button-prev-document-${family.familyId}`}
              >
                <ChevronLeft className="w-3 h-3 mr-0.5 shrink-0" />
                <span className="truncate max-w-[120px]">{family.previous.name}</span>
                <span className="text-[9px] text-muted-foreground ml-1 shrink-0">{formatNeighborDate(family.previous)}</span>
              </Button>
              <button
                type="button"
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                onClick={(e) => { e.stopPropagation(); setLinkPickerOpen({ position: 'before', familyId: family.familyId }); }}
                data-testid={`button-edit-prev-link-${family.familyId}`}
                aria-label={t('editPreviousLink') || 'Change previous link'}
                title={t('editPreviousLink') || 'Change previous link'}
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          ) : family.previousIsChainEnd ? (
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" disabled data-testid={`button-prev-chain-end-${family.familyId}`}>
              <ChevronLeft className="w-3 h-3 mr-0.5" />
              <span className="text-muted-foreground">{t('firstDocumentOfChain') || 'First'}</span>
            </Button>
          ) : (
            <button
              type="button"
              className="flex items-center gap-1 h-7 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={(e) => { e.stopPropagation(); setLinkPickerOpen({ position: 'before', familyId: family.familyId }); }}
              data-testid={`button-link-prev-${family.familyId}`}
            >
              <LinkIcon className="w-3 h-3" />
              {t('addPreviousDocument') || 'Link prev'}
            </button>
          )}
        </div>

        {/* Center: sequence panel toggle (bound to this family — clicking switches active family AND opens panel) */}
        <Button
          type="button"
          variant={seqPanelOpen && isActive ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-xs shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            if (!isActive) setActiveFamilyIdx(idx);
            setSeqPanelOpen((open) => (isActive ? !open : true));
          }}
          data-testid={`button-toggle-sequence-${family.familyId}`}
          aria-pressed={seqPanelOpen && isActive}
        >
          <ListOrdered className="w-3 h-3 mr-0.5" />
          {t('chainPanelTitle') || 'Seq'}
        </Button>

        {/* Next side */}
        <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
          {family.next ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                onClick={(e) => { e.stopPropagation(); setLinkPickerOpen({ position: 'after', familyId: family.familyId }); }}
                data-testid={`button-edit-next-link-${family.familyId}`}
                aria-label={t('editNextLink') || 'Change next link'}
                title={t('editNextLink') || 'Change next link'}
              >
                <Pencil className="w-3 h-3" />
              </button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={(e) => { e.stopPropagation(); onNavigate?.(family.next!.id); }}
                disabled={!onNavigate}
                data-testid={`button-next-document-${family.familyId}`}
              >
                <span className="text-[9px] text-muted-foreground mr-1 shrink-0">{formatNeighborDate(family.next)}</span>
                <span className="truncate max-w-[120px]">{family.next.name}</span>
                <ChevronRight className="w-3 h-3 ml-0.5 shrink-0" />
              </Button>
            </div>
          ) : family.nextIsChainEnd ? (
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" disabled data-testid={`button-next-chain-end-${family.familyId}`}>
              <span className="text-muted-foreground">{t('lastDocumentOfChain') || 'Last'}</span>
              <ChevronRight className="w-3 h-3 ml-0.5" />
            </Button>
          ) : (
            <button
              type="button"
              className="flex items-center gap-1 h-7 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={(e) => { e.stopPropagation(); setLinkPickerOpen({ position: 'after', familyId: family.familyId }); }}
              data-testid={`button-link-next-${family.familyId}`}
            >
              {t('addNextDocument') || 'Link next'}
              <LinkIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0 focus:outline-none"
        aria-describedby={undefined}
        hideCloseButton
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-2 px-4 py-3 border-b shrink-0 space-y-0">
          <DialogTitle className="truncate text-base font-medium">{displayName}</DialogTitle>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleDownload} data-testid="button-inline-viewer-download">
              <Download className="w-4 h-4 mr-2" />
              {t('download') || 'Download'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} data-testid="button-inline-viewer-close" aria-label={t('close') || 'Close'}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Chain siblings nav (multi-file steps) */}
        {chainSiblings && chainSiblings.length > 1 && chainIndex !== undefined && (
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-b shrink-0 bg-muted/30" data-testid="chain-nav-bar">
            <Button type="button" variant="outline" size="sm" onClick={() => onChainNavigate?.(chainIndex - 1)} disabled={chainIndex === 0 || !onChainNavigate} data-testid="button-chain-prev" aria-label={t('previousDocument') || 'Previous document'}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('previous') || 'Prev'}
            </Button>
            <span className="text-sm text-muted-foreground truncate text-center flex-1 min-w-0" data-testid="chain-nav-position">
              {chainIndex + 1}&thinsp;/&thinsp;{chainSiblings.length}
              {' — '}
              <span className="truncate">{chainSiblings[chainIndex]?.originalName}</span>
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => onChainNavigate?.(chainIndex + 1)} disabled={chainIndex === chainSiblings.length - 1 || !onChainNavigate} data-testid="button-chain-next" aria-label={t('nextDocument') || 'Next document'}>
              {t('next') || 'Next'}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Per-family navigation rows */}
        {documentId && (
          <div className="shrink-0" data-testid="document-family-nav" role="listbox" aria-label="Link families">
            {families.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
                <button
                  type="button"
                  className="flex items-center gap-1.5 h-7 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={() => setLinkPickerOpen({ position: 'after', familyId: null })}
                  data-testid="button-add-to-family"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  {t('addToLinkFamily') || 'Add to link family'}
                </button>
              </div>
            ) : (
              <>
                {families.map((family, idx) => renderFamilyRow(family, idx))}
                {/* Keyboard shortcut hint */}
                {families.length > 0 && (
                  <div className="px-3 py-1 text-[10px] text-muted-foreground/60 border-b select-none" aria-hidden="true">
                    ← → navigate · ↑ ↓ switch family
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 bg-gray-100 dark:bg-gray-900">
            {isOpen && renderPreview()}
          </div>
          {/* Sequence panel — always shows active family's chain */}
          {documentId && seqPanelOpen && activeFamily && (
            <DocumentSequencePanel
              documentId={documentId}
              familyId={activeFamily.familyId}
              familyName={getSystemFamilyDisplay({ name: activeFamily.familyName, description: activeFamily.familyDescription, isSystem: activeFamily.familyIsSystem ?? false }, t).name}
              onNavigate={onNavigate}
              className="w-80 shrink-0 border-l overflow-y-auto bg-background"
            />
          )}
        </div>

        {documentId && linkPickerOpen !== false && (
          <DocumentLinkPickerDialog
            open={true}
            onOpenChange={(o) => { if (!o) setLinkPickerOpen(false); }}
            documentId={documentId}
            position={linkPickerOpen.position}
            initialFamilyId={linkPickerOpen.familyId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
