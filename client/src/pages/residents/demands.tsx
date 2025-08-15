import { Header } from '@/components/layout/header';

/**
 *
 */
export default function MyDemands() {
  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='My Demands' subtitle='View and submit maintenance requests' />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto'>
          <p>My demands interface coming soon...</p>
        </div>
      </div>
    </div>
  );
}
