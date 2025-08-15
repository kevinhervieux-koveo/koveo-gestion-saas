import { Header } from '@/components/layout/header';

export default function MyBuilding() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="My Building"
        subtitle="View building information and amenities"
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <p>My building interface coming soon...</p>
        </div>
      </div>
    </div>
  );
}