import { Header } from '@/components/layout/header';

/**
 *
 */
export default function IdeaBox() {
  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='Idea Box' subtitle='Submit and vote on feature suggestions' />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto'>
          <p>Idea box interface coming soon...</p>
        </div>
      </div>
    </div>
  );
}
