import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useLanguage } from '@/hooks/use-language';

interface SuggestionItem {
  document: {
    id: string;
    name: string;
    documentType: string | null;
    effectiveDate: string | null;
    createdAt: string;
  };
  score: number;
  explain: {
    nameSimilarity: number;
    sharedCategory: boolean;
    sharedTagCount: number;
    dateProximityDays: number | null;
    sameBuilding: boolean;
    sameResidence: boolean;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  position: 'before' | 'after';
}

export function DocumentLinkPickerDialog({ open, onOpenChange, documentId, position }: Props) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  // The dialog is opened with an initial side, but users can flip the
  // before/after toggle below to change which side the picked candidate
  // will be linked as without closing the dialog.
  const [activePosition, setActivePosition] = useState<'before' | 'after'>(position);

  const { data, isLoading } = useQuery<{ suggestions: SuggestionItem[] }>({
    queryKey: ['/api/documents', documentId, 'link-suggestions', query],
    queryFn: async () => {
      const url = `/api/documents/${documentId}/link-suggestions?limit=15${query ? `&q=${encodeURIComponent(query)}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load suggestions');
      return res.json();
    },
    enabled: open,
  });

  const linkMutation = useMutation({
    mutationFn: async (targetDocumentId: string) => {
      return apiRequest('POST', `/api/documents/${documentId}/links`, {
        targetDocumentId,
        position: activePosition,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents', documentId, 'neighbors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents', documentId, 'links'] });
      toast({ title: t('documentLinkCreatedTitle'), description: t('documentLinkCreatedDesc') });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: t('documentLinkErrorTitle'),
        description: err?.message ?? t('documentLinkErrorDesc'),
        variant: 'destructive',
      });
    },
  });

  const title = activePosition === 'before' ? t('linkPreviousDocumentTitle') : t('linkNextDocumentTitle');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            {title}
          </DialogTitle>
          <DialogDescription>{t('linkDocumentPickerDescription')}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2" data-testid="link-position-toggle">
          <span className="text-sm text-muted-foreground">{t('linkPositionLabel') || 'Link as'}:</span>
          <div className="inline-flex rounded-md border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={activePosition === 'before' ? 'default' : 'ghost'}
              className="h-7 px-2 text-xs"
              onClick={() => setActivePosition('before')}
              data-testid="button-position-before"
            >
              {t('addPreviousDocument') || 'Previous'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activePosition === 'after' ? 'default' : 'ghost'}
              className="h-7 px-2 text-xs"
              onClick={() => setActivePosition('after')}
              data-testid="button-position-after"
            >
              {t('addNextDocument') || 'Next'}
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('linkDocumentSearchPlaceholder')}
            className="pl-9"
            data-testid="input-link-search"
          />
        </div>

        <div className="max-h-96 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !data?.suggestions?.length ? (
            <p className="text-center text-sm text-muted-foreground p-6">
              {t('linkDocumentNoCandidates')}
            </p>
          ) : (
            data.suggestions.map((s) => (
              <button
                key={s.document.id}
                type="button"
                disabled={linkMutation.isPending}
                onClick={() => linkMutation.mutate(s.document.id)}
                className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors disabled:opacity-50"
                data-testid={`suggestion-${s.document.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{s.document.name}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                      {s.document.documentType && <span>{s.document.documentType}</span>}
                      {s.document.effectiveDate && (
                        <span>{new Date(s.document.effectiveDate).toLocaleDateString()}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {s.explain.sharedCategory && (
                        <Badge variant="secondary" className="text-xs">{t('linkExplainSharedCategory')}</Badge>
                      )}
                      {s.explain.sharedTagCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {t('linkExplainSharedTags')}: {s.explain.sharedTagCount}
                        </Badge>
                      )}
                      {s.explain.dateProximityDays !== null && s.explain.dateProximityDays < 60 && (
                        <Badge variant="secondary" className="text-xs">
                          {t('linkExplainCloseInTime')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {s.score.toFixed(1)}
                  </Badge>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-link">
            {t('cancel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
