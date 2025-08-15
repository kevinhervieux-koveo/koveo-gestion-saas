import { Header } from '@/components/layout/header';

export default function MyResidence() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="My Residence"
        subtitle="View and manage your residence information"
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <p>My residence interface coming soon...</p>
        </div>
      </div>
    </div>
  );
}