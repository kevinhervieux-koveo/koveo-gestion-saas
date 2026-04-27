import { Header } from '@/components/layout/header';
import { QualityMetrics } from '@/components/dashboard/quality-metrics';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface QualityLastRun {
  lastRunDate?: string;
}

/**
 * Quality Assurance admin page.
 * Displays quality metrics and provides a refresh action for the data.
 */
export default function Quality() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const { data, isFetching } = useQuery<QualityLastRun>({
    queryKey: ['/api/quality-metrics'],
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/quality-metrics'] });
  };

  const formatLastRun = () => {
    if (!data?.lastRunDate) {
      return t('notAvailable');
    }
    const date = new Date(data.lastRunDate);
    const locale = language === 'fr' ? 'fr-CA' : 'en-CA';
    return `${date.toLocaleDateString(locale)} ${date.toLocaleTimeString(locale)}`;
  };

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title={t('qualityAssurance')} subtitle='Quality metrics and assurance tracking' />

      {/* Last run info & refresh action */}
      <div className='border-b bg-gray-50 px-6 py-3'>
        <div className='max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3'>
          <div className='text-sm text-gray-700' data-testid='text-last-run'>
            <span className='font-medium'>{t('lastRun')}:</span>{' '}
            <span>{formatLastRun()}</span>
          </div>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={handleRefresh}
            disabled={isFetching}
            data-testid='button-refresh-quality'
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`}
            />
            {isFetching ? t('loading') : t('refreshQuality')}
          </Button>
        </div>
      </div>

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-8'>
          <QualityMetrics />
        </div>
      </div>
    </div>
  );
}
