// STUB: Money flow automation service - functionality removed but keeping interface for compatibility
// This prevents import errors while the system is being cleaned up

export const moneyFlowAutomationService = {
  async generateForBill(billId: string): Promise<number> {
    console.warn(`⚠️ Money flow automation disabled - skipping bill ${billId}`);
    return 0;
  },

  async generateForResidence(residenceId: string): Promise<number> {
    console.warn(`⚠️ Money flow automation disabled - skipping residence ${residenceId}`);
    return 0;
  },

  async getMoneyFlowStatistics(): Promise<any> {
    return {
      totalEntries: 0,
      billEntries: 0,
      residenceEntries: 0,
      lastGeneratedAt: null,
    };
  },
};
