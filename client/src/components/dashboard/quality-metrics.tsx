import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

export function QualityMetrics() {
  const { t } = useLanguage();

  const metrics = [
    {
      value: '95%',
      label: t('codeCoverage'),
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      value: 'A+',
      label: t('codeQuality'),
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      value: '0',
      label: t('securityIssues'),
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
    {
      value: '12ms',
      label: t('buildTime'),
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
    },
  ];

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <TrendingUp className="text-koveo-navy mr-3" size={20} />
          {t('qualityMetrics')}
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={`text-center p-4 ${metric.bgColor} rounded-lg`}
            >
              <div className={`text-2xl font-bold ${metric.textColor}`}>{metric.value}</div>
              <div className="text-sm text-gray-600">{metric.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
