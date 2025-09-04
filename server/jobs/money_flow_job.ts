// STUB: Money flow job - functionality removed but keeping interface for compatibility

export const moneyFlowJob = {
  async start(): Promise<void> {
  },

  stop(): void {
  },

  getStatus(): any {
    return {
      status: 'disabled',
      message: 'Money flow automation has been disabled',
      lastRun: null,
      nextRun: null,
    };
  },

  getStatistics(): any {
    return {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastRunTime: null,
    };
  },
};
