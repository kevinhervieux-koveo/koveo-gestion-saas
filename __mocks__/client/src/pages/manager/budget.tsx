import React from 'react';

// Mock version of budget component that doesn't use import.meta.env
const BudgetMock = ({ buildingId, organizationId }: { buildingId?: string; organizationId?: string }) => {
  // Mock isDev without using import.meta.env
  const isDev = process.env.NODE_ENV === 'development';
  const debugLog = (action: string, data: any) => {
    if (isDev) {
      console.log(`[Budget Debug] ${action}:`, data);
    }
  };

  return (
    <div data-testid="budget-page">
      <div data-testid="button-budget-settings">Settings</div>
      <div data-testid="budget-content">
        Budget content for building: {buildingId}
      </div>
      
      {/* Mock settings dialog */}
      <div>
        <div>Budget Settings</div>
        <input data-testid="input-start-amount" defaultValue="50000" />
        <input data-testid="input-minimum-fund" defaultValue="10000" />
        <input data-testid="input-general-inflation" defaultValue="2.5" />
        <input data-testid="input-revenue-inflation" defaultValue="3.0" />
        <button data-testid="button-save-settings">Save</button>
      </div>
    </div>
  );
};

// Export as both default and named export to match the real component structure
export const BudgetInner = BudgetMock;
export default BudgetMock;