import { Header } from '@/components/layout/header';
import { Law25Compliance } from '@/components/dashboard/law25-compliance';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatComplianceDate } from '@/lib/i18n';

interface Law25LastScan {
  lastScanDate?: string;
}

/**
 * Quebec Law 25 compliance dashboard page for administrators.
 * Provides comprehensive overview of privacy compliance status and violations.
 */
export default function Compliance() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const { data, isFetching } = useQuery<Law25LastScan>({
    queryKey: ['/api/law25-compliance'],
  });

  const handleRescan = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/law25-compliance'] });
  };

  const formatLastScan = () => {
    if (!data?.lastScanDate) {
      return t('notAvailable');
    }
    return formatComplianceDate(data.lastScanDate, language);
  };

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header
        title={t('quebecLaw25Compliance')}
        subtitle={t('privacyComplianceMonitoring')}
      />

      {/* Last scan info & re-scan action */}
      <div className='border-b bg-gray-50 px-6 py-3'>
        <div className='max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3'>
          <div className='text-sm text-gray-700' data-testid='text-last-scan'>
            <span className='font-medium'>{t('lastScan')}:</span>{' '}
            <span>{formatLastScan()}</span>
          </div>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={handleRescan}
            disabled={isFetching}
            data-testid='button-rescan-compliance'
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`}
            />
            {isFetching ? t('loading') : t('rescanCompliance')}
          </Button>
        </div>
      </div>

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-8'>
          <Law25Compliance />
        </div>
      </div>
    </div>
  );
}
