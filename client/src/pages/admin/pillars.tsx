import { Header } from '@/components/layout/header';
import { PillarFramework } from '@/components/dashboard/pillar-framework';
import { Terminal } from 'lucide-react';

/**
 *
 */
export default function Pillars() {
  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='Pillar Framework' subtitle='Development framework and methodology' />

      {/* Refresh Command */}
      <div className='border-b bg-gray-50 px-6 py-3'>
        <div className='max-w-7xl mx-auto'>
          <div className='flex items-center gap-2 text-sm text-gray-600'>
            <Terminal className='h-4 w-4' />
            <span className='font-medium'>Refresh Command:</span>
            <code className='bg-gray-100 px-2 py-1 rounded text-xs font-mono'>
              npm run validate:all
            </code>
          </div>
        </div>
      </div>

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto'>
          <PillarFramework />
        </div>
      </div>
    </div>
  );
}
