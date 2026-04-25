// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, X, FileText, Loader2, ChevronLeft, ChevronRight, LinkIcon, Pencil, ListOrdered } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { DocumentLinkPickerDialog } from '@/components/documents/DocumentLinkPickerDialog';
import { DocumentSequencePanel } from '@/components/documents/DocumentSequencePanel';

interface DocumentInlineViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName?: string | null;
  downloadUrl?: string;
  mimeType?: string | null;
  documentId?: string;
  onNavigate?: (documentId: string) => void;
}

interface NeighborInfo {
  id: string;
  name: string;
  source: 'explicit' | 'date';
  effectiveDate: string | null;
  createdAt: string;
}

function formatNeighborDate(n: NeighborInfo): string {
  const raw = n.effectiveDate ?? n.createdAt;
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}

interface NeighborsResponse {
  currentId: string;
  previous: NeighborInfo | null;
  previousIsChainEnd?: boolean;
  next: NeighborInfo | null;
  nextIsChainEnd?: boolean;
}

type PreviewKind = 'pdf' | 'image' | 'text' | 'unsupported';

type PreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; blobUrl: string }
  | { status: 'error' };

function getExtension(name?: string | null): string {
  if (!name) return '';
  const idx = name.lastIndexOf('.');
  if (idx < 0) return '';
  return name.slice(idx + 1).toLowerCase();
}

function detectPreviewKind(
  mimeType?: string | null,
  fileName?: string | null,
): PreviewKind {
  const mime = (mimeType || '').toLowerCase();
  const ext = getExtension(fileName);

  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext)) {
    return 'image';
  }
  if (mime.startsWith('text/') || ['txt', 'csv', 'log', 'md'].includes(ext)) {
    return 'text';
  }
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
}: DocumentInlineViewerProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [linkPickerOpen, setLinkPickerOpen] = useState<false | 'before' | 'after'>(false);
  const [sequencePanelOpen, setSequencePanelOpen] = useState(false);

  const { data: neighbors } = useQuery<NeighborsResponse>({
    queryKey: ['/api/documents', documentId, 'neighbors'],
    enabled: !!documentId && isOpen,
  });

  const previewKind = useMemo(
    () => detectPreviewKind(mimeType, fileName),
    [mimeType, fileName],
  );

  // PDFs and text are fetched with credentials and rendered from a blob URL
  // so that backend errors surface as an explicit fallback instead of a
  // silent broken-iframe icon.
  const needsFetch = previewKind === 'pdf' || previewKind === 'text';
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' });

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
        const response = await fetch(fileUrl, {
          method: 'GET',
          credentials: 'include',
        });
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
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
      if (createdBlobUrl) {
        window.URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [isOpen, needsFetch, fileUrl]);

  const handleDownload = async () => {
    const url = downloadUrl
      ?? (fileUrl.includes('?')
        ? `${fileUrl}&download=true`
        : `${fileUrl}?download=true`);

    try {
      const response = await fetch(url, { method: 'GET', credentials: 'include' });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

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
      toast({
        title: t('downloadFailed') || 'Download failed',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const displayName = fileName || t('documentAttachment') || 'Document';

  const renderUnsupportedFallback = (testId: string) => (
    <div
      className="w-full h-full flex flex-col items-center justify-center p-6 text-center gap-4"
      data-testid={testId}
    >
      <FileText className="w-16 h-16 text-gray-400" />
      <div className="space-y-1">
        <p className="text-base font-medium">
          {t('previewNotAvailable') || 'Preview not available'}
        </p>
        <p className="text-sm text-gray-500 max-w-md">
          {t('previewNotAvailableDescription')
            || 'This file type cannot be previewed in the browser. Download the file to open it in a compatible application.'}
        </p>
      </div>
      <Button
        type="button"
        onClick={handleDownload}
        data-testid="button-inline-viewer-download-fallback"
      >
        <Download className="w-4 h-4 mr-2" />
        {t('download') || 'Download'}
      </Button>
    </div>
  );

  const renderPreview = () => {
    switch (previewKind) {
      case 'image':
        return (
          <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
            <img
              src={fileUrl}
              alt={displayName}
              className="max-w-full max-h-full object-contain"
              data-testid="img-inline-viewer"
            />
          </div>
        );
      case 'pdf':
      case 'text':
        if (preview.status === 'loading' || preview.status === 'idle') {
          return (
            <div
              className="w-full h-full flex items-center justify-center"
              data-testid="inline-viewer-loading"
            >
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          );
        }
        if (preview.status === 'error') {
          return renderUnsupportedFallback('inline-viewer-error');
        }
        return (
          <iframe
            src={preview.blobUrl}
            title={displayName}
            className="w-full h-full border-0"
            data-testid="iframe-inline-viewer"
          />
        );
      case 'unsupported':
      default:
        return renderUnsupportedFallback('inline-viewer-unsupported');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0"
        aria-describedby={undefined}
        hideCloseButton
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-2 px-4 py-3 border-b shrink-0 space-y-0">
          <DialogTitle className="truncate text-base font-medium">
            {displayName}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              data-testid="button-inline-viewer-download"
            >
              <Download className="w-4 h-4 mr-2" />
              {t('download') || 'Download'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              data-testid="button-inline-viewer-close"
              aria-label={t('close') || 'Close'}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        {documentId && (
          <div
            className="flex items-center justify-between gap-2 px-4 py-2 border-b shrink-0 bg-muted/30"
            data-testid="document-sequence-chips"
          >
            <div className="flex items-center gap-2">
              {neighbors?.previous ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate?.(neighbors.previous!.id)}
                    disabled={!onNavigate}
                    data-testid="button-prev-document"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    <span className="flex flex-col items-start leading-tight">
                      <span className="truncate max-w-[180px]">{neighbors.previous.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatNeighborDate(neighbors.previous)}
                      </span>
                    </span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {neighbors.previous.source === 'explicit' ? t('linkedBadge') : t('byDateBadge')}
                    </Badge>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setLinkPickerOpen('before')}
                    data-testid="button-edit-prev-link"
                    aria-label={t('editPreviousLink') || 'Change previous link'}
                    title={t('editPreviousLink') || 'Change previous link'}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : neighbors?.previousIsChainEnd ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  data-testid="button-prev-document-chain-end"
                  aria-label={t('firstDocumentOfChain') || 'First document of chain'}
                  title={t('firstDocumentOfChain') || 'First document of chain'}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  <span className="text-xs text-muted-foreground">
                    {t('firstDocumentOfChain') || 'First document'}
                  </span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setLinkPickerOpen('before')}
                  data-testid="button-link-prev-document"
                >
                  <LinkIcon className="w-4 h-4 mr-1" />
                  {t('addPreviousDocument') || 'Link previous'}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={sequencePanelOpen ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setSequencePanelOpen((v) => !v)}
                data-testid="button-toggle-sequence-panel"
                aria-pressed={sequencePanelOpen}
              >
                <ListOrdered className="w-4 h-4 mr-1" />
                {t('chainPanelTitle') || 'Sequence'}
              </Button>
              {neighbors?.next ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setLinkPickerOpen('after')}
                    data-testid="button-edit-next-link"
                    aria-label={t('editNextLink') || 'Change next link'}
                    title={t('editNextLink') || 'Change next link'}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate?.(neighbors.next!.id)}
                    disabled={!onNavigate}
                    data-testid="button-next-document"
                  >
                    <Badge variant="secondary" className="mr-2 text-xs">
                      {neighbors.next.source === 'explicit' ? t('linkedBadge') : t('byDateBadge')}
                    </Badge>
                    <span className="flex flex-col items-end leading-tight">
                      <span className="truncate max-w-[180px]">{neighbors.next.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatNeighborDate(neighbors.next)}
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </>
              ) : neighbors?.nextIsChainEnd ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  data-testid="button-next-document-chain-end"
                  aria-label={t('lastDocumentOfChain') || 'Last document of chain'}
                  title={t('lastDocumentOfChain') || 'Last document of chain'}
                >
                  <span className="text-xs text-muted-foreground">
                    {t('lastDocumentOfChain') || 'Last document'}
                  </span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setLinkPickerOpen('after')}
                  data-testid="button-link-next-document"
                >
                  <LinkIcon className="w-4 h-4 mr-1" />
                  {t('addNextDocument') || 'Link next'}
                </Button>
              )}
            </div>
          </div>
        )}
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 bg-gray-100 dark:bg-gray-900">
            {isOpen && renderPreview()}
          </div>
          {documentId && sequencePanelOpen && (
            <DocumentSequencePanel
              documentId={documentId}
              onNavigate={onNavigate}
              className="w-80 shrink-0 border-l overflow-y-auto bg-background"
            />
          )}
        </div>
        {documentId && linkPickerOpen !== false && (
          <DocumentLinkPickerDialog
            open={!!linkPickerOpen}
            onOpenChange={(o) => { if (!o) setLinkPickerOpen(false); }}
            documentId={documentId}
            position={linkPickerOpen}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}