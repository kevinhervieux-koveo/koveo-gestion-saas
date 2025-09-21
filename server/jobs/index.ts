/**
 * Job scheduler initialization
 * Initialize and start all background jobs.
 */

// SSL functionality temporarily disabled due to build issues
// import { sslRenewalJob } from './ssl_renewal_job';
import { notificationJobScheduler } from './notification-automation';

/**
 * Start all background jobs.
 */
export async function startJobs(): Promise<void> {
  try {
    // SSL renewal job temporarily disabled
    // await sslRenewalJob.start();
    
    // Initialize notification automation job
    notificationJobScheduler.init();
    
    console.log('✅ Background jobs initialized (SSL disabled, notification automation enabled)');
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
  
  // Stop notification automation job
  notificationJobScheduler.destroy();
  
  console.log('✅ Background jobs stopped');
}

/**
 * Get status of all background jobs.
 */
export async function getJobsStatus(): Promise<Record<string, any>> {
  return {
    // SSL renewal temporarily disabled
    // sslRenewal: sslRenewalJob.getStatus(),
    notificationAutomation: await notificationJobScheduler.getJobStatus(),
    status: 'running',
    message: 'SSL functionality temporarily disabled, notification automation enabled'
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
