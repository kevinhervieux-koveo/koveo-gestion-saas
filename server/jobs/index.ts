/**
 * Job scheduler initialization
 * Initialize and start all background jobs.
 */

// SSL functionality temporarily disabled due to build issues
// import { sslRenewalJob } from './ssl_renewal_job';

/**
 * Start all background jobs.
 */
export async function startJobs(): Promise<void> {
  try {
    // SSL renewal job temporarily disabled
    // await sslRenewalJob.start();
    
    console.log('✅ Background jobs initialized (SSL disabled)');
  } catch (error) {
    console.error('❌ Error starting background jobs:', error);
    throw error;
  }
}

/**
 * Stop all background jobs.
 */
export function stopJobs(): void {
  // SSL renewal job temporarily disabled
  // sslRenewalJob.stop();
  
  console.log('✅ Background jobs stopped');
}

/**
 * Get status of all background jobs.
 */
export function getJobsStatus(): Record<string, any> {
  return {
    // SSL renewal temporarily disabled
    // sslRenewal: sslRenewalJob.getStatus(),
    status: 'running',
    message: 'SSL functionality temporarily disabled'
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
