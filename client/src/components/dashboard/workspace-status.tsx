import { Card, CardContent } from '@/components/ui/card';
import { Monitor, CheckCircle, Clock, Circle } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

/**
 * Workspace Status Component.
 * 
 * Displays the current status of workspace setup and configuration tasks.
 * Shows completion status for environment, dependencies, and framework setup.
 * @returns JSX element for the workspace status display.
 */
export function WorkspaceStatus() {
  const { t } = useLanguage();

  const statusItems = [
    {
      name: t('environmentSetup'),
      status: 'complete',
      icon: CheckCircle,
      color: 'text-green-600',
    },
    {
      name: t('dependenciesInstallation'),
      status: 'complete',
      icon: CheckCircle,
      color: 'text-green-600',
    },
    {
      name: t('typeScriptConfiguration'),
      status: 'in-progress',
      icon: Clock,
      color: 'text-orange-600',
    },
    {
      name: t('pillarFramework'),
      status: 'pending',
      icon: Circle,
      color: 'text-gray-400',
    },
  ];

  const getStatusText = (status: string) => {
    switch (status) {
      case 'complete':
        return t('complete');
      case 'in-progress':
        return t('inProgress');
      case 'pending':
        return t('pending');
      default:
        return status;
    }
  };

  return (
    <Card>
      <CardContent className='p-6'>
        <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
          <Monitor className='text-koveo-navy mr-3' size={20} />
          {t('workspaceStatus')}
        </h3>

        <div className='space-y-4'>
          {statusItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.name} className='flex items-center justify-between py-2'>
                <span className='text-gray-600'>{item.name}</span>
                <div className={`flex items-center ${item.color}`}>
                  <Icon className='mr-2' size={16} />
                  <span className='text-sm font-medium'>{getStatusText(item.status)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
