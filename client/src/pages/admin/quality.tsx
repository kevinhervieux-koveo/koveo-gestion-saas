import { Header } from '@/components/layout/header';
import { QualityMetrics } from '@/components/dashboard/quality-metrics';
import { Terminal } from 'lucide-react';

/**
 *
 */
export default function Quality() {
  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='Quality Assurance' subtitle='Quality metrics and assurance tracking' />

      {/* Refresh Command */}
      <div className='border-b bg-gray-50 px-6 py-3'>
        <div className='max-w-7xl mx-auto'>
          <div className='flex items-center gap-2 text-sm text-gray-600'>
            <Terminal className='h-4 w-4' />
            <span className='font-medium'>Refresh Command:</span>
            <code className='bg-gray-100 px-2 py-1 rounded text-xs font-mono'>
              npm run quality:check
            </code>
          </div>
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
