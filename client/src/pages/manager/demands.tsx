import { Header } from '@/components/layout/header';

export default function Demands() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Demands Management"
        subtitle="Manage maintenance requests and demands"
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <p>Demands management interface coming soon...</p>
        </div>
      </div>
    </div>
  );
}