import { AgentDashboard } from '@/components/ai-agent';

/**
 * AI Agent Management Page for Administrators
 */
export default function AdminAiAgent() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <AgentDashboard />
      </div>
    </div>
  );
}