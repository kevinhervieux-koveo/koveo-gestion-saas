import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { GripVertical, Trash2, Loader2, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useLanguage } from '@/hooks/use-language';

interface ChainDocument {
  id: string;
  name: string;
  documentType: string | null;
  effectiveDate: string | null;
  createdAt: string;
}

interface ChainResponse {
  currentId: string;
  documents: ChainDocument[];
}

interface DocumentSequencePanelProps {
  documentId: string;
  onNavigate?: (documentId: string) => void;
  className?: string;
}

/**
 * Drag-and-drop editor for the explicit reading sequence of documents that
 * `documentId` belongs to. Uses native HTML5 drag-and-drop (no extra deps)
 * and persists changes via the batch reorder endpoint, with optimistic UI
 * so the new order is reflected immediately on drop.
 */
export function DocumentSequencePanel({ documentId, onNavigate, className }: DocumentSequencePanelProps) {
  const { t } = useLanguage();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<ChainResponse>({
    queryKey: ['/api/documents', documentId, 'chain'],
  });

  const [localOrder, setLocalOrder] = useState<ChainDocument[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Server-side state is source of truth: reset our local copy whenever the
  // chain we receive from the API changes (post-mutation or initial load).
  useEffect(() => {
    if (data?.documents) setLocalOrder(data.documents);
  }, [data?.documents]);

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      return apiRequest('POST', `/api/documents/${documentId}/chain/reorder`, { orderedIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents', documentId, 'chain'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents', documentId, 'neighbors'] });
    },
    onError: (err: any) => {
      // Roll back to the server's last-known order on error.
      if (data?.documents) setLocalOrder(data.documents);
      toast({
        title: t('chainReorderErrorTitle') || 'Reorder failed',
        description: err?.message ?? '',
        variant: 'destructive',
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (idToRemove: string) => {
      return apiRequest('POST', `/api/documents/${idToRemove}/chain/remove`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents', documentId, 'chain'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents', documentId, 'neighbors'] });
      toast({
        title: t('chainRemoveSuccessTitle') || 'Removed from sequence',
      });
    },
    onError: (err: any) => {
      toast({
        title: t('chainRemoveErrorTitle') || 'Remove failed',
        description: err?.message ?? '',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className={className} data-testid="document-sequence-panel-loading">
        <div className="flex items-center justify-center p-4">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      </div>
    );
  }

  const items = localOrder ?? [];
  if (items.length <= 1) {
    return (
      <div className={className} data-testid="document-sequence-panel-empty">
        <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
          <ListOrdered className="w-4 h-4" />
          <span>{t('chainPanelEmpty') || 'No sequence yet — link a previous or next document to start one.'}</span>
        </div>
      </div>
    );
  }

  const commitOrder = (next: ChainDocument[]) => {
    setLocalOrder(next);
    reorderMutation.mutate(next.map((d) => d.id));
  };

  const handleDragStart = (id: string) => (e: React.DragEvent) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Required for Firefox to actually start the drag.
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragOverId) setDragOverId(id);
  };

  const handleDrop = (targetId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = draggingId ?? e.dataTransfer.getData('text/plain');
    setDraggingId(null);
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;

    const fromIdx = items.findIndex((d) => d.id === sourceId);
    const toIdx = items.findIndex((d) => d.id === targetId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

    const next = items.slice();
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    commitOrder(next);
  };

  return (
    <div className={className} data-testid="document-sequence-panel">
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <ListOrdered className="w-4 h-4" />
        <h3 className="text-sm font-medium">{t('chainPanelTitle') || 'Sequence'}</h3>
        {reorderMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>
      <ul className="divide-y" data-testid="document-sequence-list">
        {items.map((doc, idx) => {
          const isCurrent = doc.id === documentId;
          const isDragging = draggingId === doc.id;
          const isDragOver = dragOverId === doc.id && draggingId && draggingId !== doc.id;
          return (
            <li
              key={doc.id}
              draggable
              onDragStart={handleDragStart(doc.id)}
              onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
              onDragOver={handleDragOver(doc.id)}
              onDragLeave={() => { if (dragOverId === doc.id) setDragOverId(null); }}
              onDrop={handleDrop(doc.id)}
              className={[
                'flex items-center gap-2 px-3 py-2 group',
                isDragging ? 'opacity-50' : '',
                isDragOver ? 'bg-accent border-t-2 border-primary' : '',
                isCurrent ? 'bg-muted/50' : '',
              ].join(' ')}
              data-testid={`sequence-row-${doc.id}`}
            >
              <button
                type="button"
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                aria-label={t('chainDragHandleLabel') || 'Drag to reorder'}
                data-testid={`sequence-drag-handle-${doc.id}`}
                tabIndex={-1}
              >
                <GripVertical className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground w-6 tabular-nums">{idx + 1}.</span>
              <button
                type="button"
                className="flex-1 text-left min-w-0"
                onClick={() => { if (!isCurrent && onNavigate) onNavigate(doc.id); }}
                disabled={isCurrent || !onNavigate}
                data-testid={`sequence-open-${doc.id}`}
              >
                <div className="truncate text-sm">{doc.name}</div>
                {doc.effectiveDate && (
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(doc.effectiveDate).toLocaleDateString()}
                  </div>
                )}
              </button>
              {isCurrent && (
                <Badge variant="secondary" className="text-[10px]">
                  {t('chainCurrentBadge') || 'Current'}
                </Badge>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-60 hover:opacity-100"
                aria-label={t('chainRemoveAction') || 'Remove from sequence'}
                title={t('chainRemoveAction') || 'Remove from sequence'}
                onClick={() => removeMutation.mutate(doc.id)}
                disabled={removeMutation.isPending}
                data-testid={`sequence-remove-${doc.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
