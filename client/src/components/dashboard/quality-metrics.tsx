import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Interface for quality metrics data from the API including performance metrics.
 */
interface QualityMetricsData {
  coverage: string;
  codeQuality: string;
  securityIssues: string;
  buildTime: string;
  translationCoverage: string;
  // Performance metrics
  responseTime: string;
  memoryUsage: string;
  bundleSize: string;
  dbQueryTime: string;
  pageLoadTime: string;
}

/**
 *
 */
export function QualityMetrics() {
  const { t } = useLanguage();

  const { data: metricsData, isLoading } = useQuery<QualityMetricsData>({
    queryKey: ['/api/quality-metrics'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  const getColorByValue = (label: string, value: string) => {
    if (label === t('codeCoverage')) {
      const coverage = parseInt(value);
      if (coverage >= 80) {
        return { bg: 'bg-green-50', text: 'text-green-600' };
      }
      if (coverage >= 60) {
        return { bg: 'bg-yellow-50', text: 'text-yellow-600' };
      }
      return { bg: 'bg-red-50', text: 'text-red-600' };
    }

    if (label === t('translationCoverage')) {
      const coverage = parseInt(value);
      if (coverage >= 95) {
        return { bg: 'bg-green-50', text: 'text-green-600' };
      }
      if (coverage >= 80) {
        return { bg: 'bg-blue-50', text: 'text-blue-600' };
      }
      if (coverage >= 60) {
        return { bg: 'bg-yellow-50', text: 'text-yellow-600' };
      }
      return { bg: 'bg-red-50', text: 'text-red-600' };
    }

    if (label === t('codeQuality')) {
      if (['A+', 'A'].includes(value)) {
        return { bg: 'bg-green-50', text: 'text-green-600' };
      }
      if (['B+', 'B'].includes(value)) {
        return { bg: 'bg-blue-50', text: 'text-blue-600' };
      }
      return { bg: 'bg-yellow-50', text: 'text-yellow-600' };
    }

    if (label === t('securityIssues')) {
      const issues = parseInt(value);
      if (issues === 0) {
        return { bg: 'bg-green-50', text: 'text-green-600' };
      }
      if (issues <= 5) {
        return { bg: 'bg-yellow-50', text: 'text-yellow-600' };
      }
      return { bg: 'bg-red-50', text: 'text-red-600' };
    }

    // Performance metrics color coding with null safety
    if (label === t('responseTime')) {
      const timeMs = parseInt((value || '0ms').replace('ms', ''));
      if (timeMs <= 100) {
        return { bg: 'bg-green-50', text: 'text-green-600' };
      }
      if (timeMs <= 200) {
        return { bg: 'bg-yellow-50', text: 'text-yellow-600' };
      }
      return { bg: 'bg-red-50', text: 'text-red-600' };
    }

    if (label === t('memoryUsage')) {
      const memoryMB = parseInt((value || '0MB').replace('MB', ''));
      if (memoryMB <= 50) {
        return { bg: 'bg-green-50', text: 'text-green-600' };
      }
      if (memoryMB <= 100) {
        return { bg: 'bg-yellow-50', text: 'text-yellow-600' };
      }
      return { bg: 'bg-red-50', text: 'text-red-600' };
    }

    if (label === t('bundleSize')) {
      const sizeMB = parseFloat((value || '0MB').replace('MB', ''));
      if (sizeMB <= 2) {
        return { bg: 'bg-green-50', text: 'text-green-600' };
      }
      if (sizeMB <= 5) {
        return { bg: 'bg-yellow-50', text: 'text-yellow-600' };
      }
      return { bg: 'bg-red-50', text: 'text-red-600' };
    }

    if (label === t('dbQueryTime')) {
      const queryMs = parseInt((value || '0ms').replace('ms', ''));
      if (queryMs <= 50) {
        return { bg: 'bg-green-50', text: 'text-green-600' };
      }
      if (queryMs <= 100) {
        return { bg: 'bg-yellow-50', text: 'text-yellow-600' };
      }
      return { bg: 'bg-red-50', text: 'text-red-600' };
    }

    if (label === t('pageLoadTime')) {
      const loadMs = parseInt((value || '0ms').replace('ms', ''));
      if (loadMs <= 1000) {
        return { bg: 'bg-green-50', text: 'text-green-600' };
      }
      if (loadMs <= 2000) {
        return { bg: 'bg-yellow-50', text: 'text-yellow-600' };
      }
      return { bg: 'bg-red-50', text: 'text-red-600' };
    }

    return { bg: 'bg-orange-50', text: 'text-orange-600' };
  };

  const metrics = metricsData
    ? [
        {
          value: metricsData.coverage,
          label: t('codeCoverage'),
          ...getColorByValue(t('codeCoverage'), metricsData.coverage),
        },
        {
          value: metricsData.codeQuality,
          label: t('codeQuality'),
          ...getColorByValue(t('codeQuality'), metricsData.codeQuality),
        },
        {
          value: metricsData.securityIssues,
          label: t('securityIssues'),
          ...getColorByValue(t('securityIssues'), metricsData.securityIssues),
        },
        {
          value: metricsData.buildTime,
          label: t('buildTime'),
          ...getColorByValue(t('buildTime'), metricsData.buildTime),
        },
        {
          value: metricsData.translationCoverage,
          label: t('translationCoverage'),
          ...getColorByValue(t('translationCoverage'), metricsData.translationCoverage),
        },
        // Performance metrics with null safety
        {
          value: metricsData.responseTime || 'N/A',
          label: t('responseTime'),
          ...getColorByValue(t('responseTime'), metricsData.responseTime || '0ms'),
        },
        {
          value: metricsData.memoryUsage || 'N/A',
          label: t('memoryUsage'),
          ...getColorByValue(t('memoryUsage'), metricsData.memoryUsage || '0MB'),
        },
        {
          value: metricsData.bundleSize || 'N/A',
          label: t('bundleSize'),
          ...getColorByValue(t('bundleSize'), metricsData.bundleSize || '0MB'),
        },
        {
          value: metricsData.dbQueryTime || 'N/A',
          label: t('dbQueryTime'),
          ...getColorByValue(t('dbQueryTime'), metricsData.dbQueryTime || '0ms'),
        },
        {
          value: metricsData.pageLoadTime || 'N/A',
          label: t('pageLoadTime'),
          ...getColorByValue(t('pageLoadTime'), metricsData.pageLoadTime || '0ms'),
        },
      ]
    : [];

  return (
    <Card>
      <CardContent className='p-6'>
        <h3 className='text-lg font-semibold text-gray-900 mb-4 flex items-center'>
          <TrendingUp className='text-koveo-navy mr-3' size={20} />
          {t('qualityMetrics')}
        </h3>

        <div className='grid grid-cols-2 lg:grid-cols-5 xl:grid-cols-10 gap-4'>
          {isLoading
            ? // Loading skeleton
              Array.from({ length: 10 }).map((_, index) => (
                <div key={`skeleton-${index}`} className='text-center p-4 bg-gray-50 rounded-lg'>
                  <Skeleton className='h-8 w-16 mx-auto mb-2' />
                  <Skeleton className='h-4 w-20 mx-auto' />
                </div>
              ))
            : metrics.map((metric) => (
                <div key={metric.label} className={`text-center p-4 ${metric.bg} rounded-lg`}>
                  <div className={`text-2xl font-bold ${metric.text}`}>{metric.value}</div>
                  <div className='text-sm text-gray-600'>{metric.label}</div>
                </div>
              ))}
        </div>
      </CardContent>
    </Card>
  );
}
