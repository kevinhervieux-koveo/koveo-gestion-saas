import { Header } from '@/components/layout/header';

export default function Bills() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Bills Management"
        subtitle="Manage bills and invoicing"
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <p>Bills management interface coming soon...</p>
        </div>
      </div>
    </div>
  );
}