// STUB: Money flow job - functionality removed but keeping interface for compatibility

export const moneyFlowJob = {
  async start(): Promise<void> {
    console.warn('⚠️ Money flow job disabled - skipping startup');
  },

  stop(): void {
    console.warn('⚠️ Money flow job disabled - skipping stop');
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
