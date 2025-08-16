/**
 * Job scheduler initialization
 * Initialize and start all background jobs.
 */

import { sslRenewalJob } from './ssl_renewal_job';

/**
 * Start all background jobs.
 */
export async function startJobs(): Promise<void> {
  try {
    console.log('Starting background jobs...');
    
    // Start SSL renewal job
    await sslRenewalJob.start();
    
    console.log('All background jobs started successfully');
  } catch (error) {
    console.error('Failed to start background jobs:', error);
    throw error;
  }
}

/**
 * Stop all background jobs.
 */
export function stopJobs(): void {
  console.log('Stopping background jobs...');
  
  sslRenewalJob.stop();
  
  console.log('All background jobs stopped');
}

/**
 * Get status of all background jobs.
 */
export function getJobsStatus(): Record<string, any> {
  return {
    sslRenewal: sslRenewalJob.getStatus()
  };
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, stopping background jobs...');
  stopJobs();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, stopping background jobs...');
  stopJobs();
  process.exit(0);
});