import { Header } from '@/components/layout/header';
import { Law25Compliance } from '@/components/dashboard/law25-compliance';
import { Terminal, Shield } from 'lucide-react';

/**
 * Quebec Law 25 compliance dashboard page for administrators.
 * Provides comprehensive overview of privacy compliance status and violations.
 */
export default function Compliance() {
  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header 
        title='Quebec Law 25 Compliance' 
        subtitle='Privacy compliance monitoring and violation tracking' 
      />

      {/* Refresh Command */}
      <div className='border-b bg-blue-50 px-6 py-3'>
        <div className='max-w-7xl mx-auto'>
          <div className='flex items-center gap-2 text-sm text-blue-700'>
            <Terminal className='h-4 w-4' />
            <span className='font-medium'>Scan Command:</span>
            <code className='bg-blue-100 px-2 py-1 rounded text-xs font-mono'>npm run quality:check</code>
            <span className='text-blue-600 ml-4'>•</span>
            <Shield className='h-4 w-4' />
            <span className='font-medium'>Semgrep CLI:</span>
            <code className='bg-blue-100 px-2 py-1 rounded text-xs font-mono'>npx semgrep --config=.semgrep.yml .</code>
          </div>
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