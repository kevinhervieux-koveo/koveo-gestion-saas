import { Header } from '@/components/layout/header';

export default function Settings() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Settings"
        subtitle="Manage your account and application settings"
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <p>Settings interface coming soon...</p>
        </div>
      </div>
    </div>
  );
}