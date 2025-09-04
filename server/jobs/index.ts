/**
 * Job scheduler initialization
 * Initialize and start all background jobs.
 */

import { sslRenewalJob } from './ssl_renewal_job';

/**
 * Start all background jobs.
 */
/**
 * StartJobs function.
 * @returns Function result.
 */
export async function startJobs(): Promise<void> {
  try {

    // Start SSL renewal job
    await sslRenewalJob.start();

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

  sslRenewalJob.stop();

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
  };
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  stopJobs();
  process.exit(0);
});

process.on('SIGINT', () => {
  stopJobs();
  process.exit(0);
});
