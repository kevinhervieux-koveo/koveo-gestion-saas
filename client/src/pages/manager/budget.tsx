import { Header } from '@/components/layout/header';

/**
 *
 */
export default function Budget() {
  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='Budget Management' subtitle='Manage budgets and financial planning' />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto'>
          <p>Budget management interface coming soon...</p>
        </div>
      </div>
    </div>
  );
}
