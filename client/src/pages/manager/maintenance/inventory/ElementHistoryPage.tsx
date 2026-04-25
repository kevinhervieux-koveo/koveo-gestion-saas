import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { HistoryTable } from '@/components/maintenance/inventory/HistoryTable';
import { useLanguage } from '@/hooks/use-language';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

/**
 * Standalone page that renders the full element maintenance history table
 * for a given building element. Accessible at:
 *   /manager/maintenance/elements/:elementId/history
 */
export default function ElementHistoryPage() {
  const { elementId } = useParams<{ elementId: string }>();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const {
    data: elementRes,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/maintenance/elements', elementId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/maintenance/elements/${elementId}`);
      return res.json();
    },
    enabled: !!elementId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const element = elementRes?.data;

  if (isLoading) {
    return (
      <div className="p-8 space-y-4" data-testid="element-history-page-loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !element) {
    return (
      <div className="p-8 text-center" data-testid="element-history-page-error">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-semibold">{t('htFailedToLoadTitle')}</p>
        <p className="text-muted-foreground mt-2">
          {error instanceof Error ? error.message : t('htFailedToLoadDesc')}
        </p>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => setLocation('/manager/maintenance/inventory')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('htReturnToInventory')}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4" data-testid="element-history-page">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation('/manager/maintenance/inventory')}
          data-testid="history-page-back-button"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('htReturnToInventory')}
        </Button>
        <h1 className="text-xl font-semibold" data-testid="element-history-page-title">
          {element.name}
        </h1>
      </div>
      <HistoryTable element={element} showSummary={true} compact={false} />
    </div>
  );
}
