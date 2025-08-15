import { Header } from '@/components/layout/header';
import { QualityMetrics } from '@/components/dashboard/quality-metrics';

/**
 *
 */
export default function Quality() {
  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='Quality Assurance' subtitle='Quality metrics and assurance tracking' />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto'>
          <QualityMetrics />
        </div>
      </div>
    </div>
  );
}
