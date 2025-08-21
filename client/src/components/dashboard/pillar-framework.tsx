import { Card, CardContent } from '@/components/ui/card';
import { Columns } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

/**
 * Pillar framework component that displays the five core development pillars
 * of the Koveo Gestion methodology with their descriptions and status.
 * @returns JSX element displaying the pillar framework interface.
 */
/**
 * PillarFramework function.
 * @returns Function result.
 */
export function PillarFramework() {
  const { t } = useLanguage();

  const pillars = [
    {
      id: 1,
      title: t('validationQAPillar'),
      description: t('coreQualityAssurance'),
      status: 'in-progress',
      statusText: t('inProgress'),
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      numberBg: 'bg-blue-500',
      statusColor: 'text-orange-600',
    },
    {
      id: 2,
      title: t('testingPillar'),
      description: t('automatedTestingFramework'),
      status: 'pending',
      statusText: t('pending'),
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      numberBg: 'bg-gray-400',
      statusColor: 'text-gray-400',
    },
    {
      id: 3,
      title: t('securityPillar'),
      description: t('law25ComplianceFramework'),
      status: 'pending',
      statusText: t('pending'),
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      numberBg: 'bg-gray-400',
      statusColor: 'text-gray-400',
    },
  ];

  return (
    <Card>
      <CardContent className='p-6'>
        <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
          <Columns className='text-koveo-navy mr-3' size={20} />
          {t('pillarMethodology')}
        </h3>

        <div className='space-y-3'>
          {pillars.map((pillar) => (
            <div
              key={pillar.id}
              className={`flex items-center justify-between p-3 ${pillar.bgColor} border ${pillar.borderColor} rounded-lg ${
                pillar.status === 'pending' ? 'opacity-50' : ''
              }`}
            >
              <div className='flex items-center space-x-3'>
                <div
                  className={`w-8 h-8 ${pillar.numberBg} rounded-full flex items-center justify-center`}
                >
                  <span className='text-white font-bold text-sm'>{pillar.id}</span>
                </div>
                <div>
                  <p
                    className={`font-medium ${pillar.status === 'pending' ? 'text-gray-600' : 'text-gray-900'}`}
                  >
                    {pillar.title}
                  </p>
                  <p
                    className={`text-sm ${pillar.status === 'pending' ? 'text-gray-500' : 'text-gray-600'}`}
                  >
                    {pillar.description}
                  </p>
                </div>
              </div>
              <span className={`text-sm font-medium ${pillar.statusColor}`}>
                {pillar.statusText}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
