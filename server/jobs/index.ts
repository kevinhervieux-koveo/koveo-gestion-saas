/**
 * Job scheduler initialization
 * Initialize and start all background jobs.
 */

import { sslRenewalJob } from './ssl_renewal_job';
import { moneyFlowJob } from './money_flow_job';

/**
 * Start all background jobs.
 */
/**
 * StartJobs function.
 * @returns Function result.
 */
export async function startJobs(): Promise<void> {
  try {
    console.warn('Starting background jobs...');

    // Start SSL renewal job
    await sslRenewalJob.start();

    // Start Money Flow automation job
    await moneyFlowJob.start();

    console.warn('All background jobs started successfully');
  } catch (____error) {
    console.error('Failed to start background jobs:', _error);
    throw ___error;
  }
}

/**
 * Stop all background jobs.
 */
/**
 * StopJobs function.
 * @returns Function result.
 */
export function stopJobs(): void {
  console.warn('Stopping background jobs...');

  sslRenewalJob.stop();
  moneyFlowJob.stop();

  console.warn('All background jobs stopped');
}

/**
 * Get status of all background jobs.
 */
/**
 * GetJobsStatus function.
 * @returns Function result.
 */
export function getJobsStatus(): Record<string, any> {
  return {
    sslRenewal: sslRenewalJob.getStatus(),
    moneyFlow: moneyFlowJob.getStatus(),
  };
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.warn('Received SIGTERM, stopping background jobs...');
  stopJobs();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.warn('Received SIGINT, stopping background jobs...');
  stopJobs();
  process.exit(0);
});
