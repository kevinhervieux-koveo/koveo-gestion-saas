import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Wrench, Clock } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import type { Translations } from '@/lib/i18n';

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string | null;
}

const STATUS_KEY_MAP: Record<string, keyof Translations> = {
  submitted: 'maintenanceStatusSubmitted',
  acknowledged: 'maintenanceStatusAcknowledged',
  in_progress: 'maintenanceStatusInProgress',
  completed: 'maintenanceStatusCompleted',
  cancelled: 'maintenanceStatusCancelled',
};

const PRIORITY_VARIANT_MAP: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low: 'secondary',
  medium: 'secondary',
  high: 'outline',
  urgent: 'destructive',
  emergency: 'destructive',
};

const STATUS_VARIANT_MAP: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  submitted: 'secondary',
  acknowledged: 'outline',
  in_progress: 'default',
  completed: 'secondary',
  cancelled: 'destructive',
};

interface ResidentMaintenanceListProps {
  residenceId: string;
}

export function ResidentMaintenanceList({ residenceId }: ResidentMaintenanceListProps) {
  const { t } = useLanguage();

  const { data: requests = [], isLoading } = useQuery<MaintenanceRequest[]>({
    queryKey: ['/api/maintenance-requests', residenceId],
    queryFn: async () => {
      const res = await fetch(`/api/maintenance-requests?residenceId=${encodeURIComponent(residenceId)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch maintenance requests');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className='space-y-2 mt-3 pt-3 border-t'>
        <p className='text-xs font-medium text-gray-500'>{t('myMaintenanceRequests')}</p>
        <div className='h-8 bg-gray-100 rounded animate-pulse' />
      </div>
    );
  }

  return (
    <div className='space-y-2 mt-3 pt-3 border-t' data-testid={`maintenance-list-${residenceId}`}>
      <p className='text-xs font-medium text-gray-500'>{t('myMaintenanceRequests')}</p>
      {requests.length === 0 ? (
        <p className='text-xs text-gray-400 italic'>{t('noMaintenanceRequests')}</p>
      ) : (
        <ul className='space-y-2'>
          {requests.map((req) => (
            <li
              key={req.id}
              className='rounded-md border bg-white dark:bg-gray-900 p-2 text-xs space-y-1'
              data-testid={`maintenance-request-${req.id}`}
            >
              <div className='flex items-start justify-between gap-2'>
                <span className='font-medium line-clamp-1 flex items-center gap-1'>
                  <Wrench className='w-3 h-3 shrink-0' />
                  {req.title}
                </span>
                <Badge
                  variant={STATUS_VARIANT_MAP[req.status] ?? 'secondary'}
                  className='text-xs shrink-0'
                >
                  {t(STATUS_KEY_MAP[req.status] ?? 'maintenanceStatusSubmitted')}
                </Badge>
              </div>
              <div className='flex items-center gap-2 text-gray-400'>
                <Badge
                  variant={PRIORITY_VARIANT_MAP[req.priority] ?? 'secondary'}
                  className='text-xs'
                >
                  {req.priority}
                </Badge>
                {req.createdAt && (
                  <span className='flex items-center gap-1'>
                    <Clock className='w-3 h-3' />
                    {new Date(req.createdAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
