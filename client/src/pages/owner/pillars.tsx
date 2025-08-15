import { Header } from '@/components/layout/header';
import { PillarFramework } from '@/components/dashboard/pillar-framework';

export default function Pillars() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Pillar Framework"
        subtitle="Development framework and methodology"
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <PillarFramework />
        </div>
      </div>
    </div>
  );
}