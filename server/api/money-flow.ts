import type { Express } from 'express';
import { requireAuth } from '../auth';
import { moneyFlowJob } from '../jobs/money_flow_job';
import { moneyFlowAutomationService } from '../services/money-flow-automation';
import { z } from 'zod';

const generateForBillSchema = z.object({
  billId: z.string().uuid('Invalid bill ID format')
});

const generateForResidenceSchema = z.object({
  residenceId: z.string().uuid('Invalid residence ID format')
});

/**
 * Register money flow automation routes.
 * These endpoints allow manual triggering and monitoring of money flow automation.
 * @param app
 */
/**
 * RegisterMoneyFlowRoutes function.
 * @param app
 * @returns Function result.
 */
export function registerMoneyFlowRoutes(app: Express) {
  
  // Get money flow automation status and statistics
  app.get('/api/money-flow/status', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admins can access money flow status
      if (user.role !== 'admin' && !user.canAccessAllOrganizations) {
        return res.status(403).json({ 
          message: 'Access denied. Admin privileges required.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Get job status and statistics
      const [jobStatus, statistics] = await Promise.all([
        moneyFlowJob.getStatus(),
        moneyFlowJob.getStatistics()
      ]);

      res.json({
        job: jobStatus,
        statistics,
        lastUpdated: new Date().toISOString()
      });

    } catch (__error) {
      console.error('Error getting money flow status:', __error);
      res.status(500).json({ 
        message: 'Failed to get money flow status',
        error: __error instanceof Error ? __error.message : 'Unknown error'
      });
    }
  });

  // Manually trigger full money flow regeneration
  app.post('/api/money-flow/regenerate', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admins can trigger regeneration
      if (user.role !== 'admin' && !user.canAccessAllOrganizations) {
        return res.status(403).json({ 
          message: 'Access denied. Admin privileges required.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      console.log(`💰 Manual money flow regeneration triggered by user ${user.id}`);

      // Trigger full regeneration
      const result = await moneyFlowJob.triggerFullRegeneration();

      res.json({
        message: 'Money flow regeneration completed successfully',
        result,
        triggeredBy: user.id,
        timestamp: new Date().toISOString()
      });

    } catch (__error) {
      console.error('Error triggering money flow regeneration:', __error);
      res.status(500).json({ 
        message: 'Failed to trigger money flow regeneration',
        error: __error instanceof Error ? __error.message : 'Unknown error'
      });
    }
  });

  // Generate money flow entries for a specific bill
  app.post('/api/money-flow/generate-bill', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const { billId } = generateForBillSchema.parse(req.body);
      
      // Only admins and managers can trigger bill-specific generation
      if (user.role !== 'admin' && user.role !== 'manager' && !user.canAccessAllOrganizations) {
        return res.status(403).json({ 
          message: 'Access denied. Admin or Manager privileges required.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      console.log(`💰 Money flow generation for bill ${billId} triggered by user ${user.id}`);

      // Generate money flow for specific bill
      const entriesCreated = await moneyFlowJob.generateForBill(billId);

      res.json({
        message: 'Money flow generation completed for bill',
        billId,
        entriesCreated,
        triggeredBy: user.id,
        timestamp: new Date().toISOString()
      });

    } catch (__error) {
      console.error('Error generating money flow for bill:', __error);
      res.status(500).json({ 
        message: 'Failed to generate money flow for bill',
        error: __error instanceof Error ? __error.message : 'Unknown error'
      });
    }
  });

  // Generate money flow entries for a specific residence
  app.post('/api/money-flow/generate-residence', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      const { residenceId } = generateForResidenceSchema.parse(req.body);
      
      // Only admins and managers can trigger residence-specific generation
      if (user.role !== 'admin' && user.role !== 'manager' && !user.canAccessAllOrganizations) {
        return res.status(403).json({ 
          message: 'Access denied. Admin or Manager privileges required.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      console.log(`🏠 Money flow generation for residence ${residenceId} triggered by user ${user.id}`);

      // Generate money flow for specific residence
      const entriesCreated = await moneyFlowJob.generateForResidence(residenceId);

      res.json({
        message: 'Money flow generation completed for residence',
        residenceId,
        entriesCreated,
        triggeredBy: user.id,
        timestamp: new Date().toISOString()
      });

    } catch (__error) {
      console.error('Error generating money flow for residence:', __error);
      res.status(500).json({ 
        message: 'Failed to generate money flow for residence',
        error: __error instanceof Error ? __error.message : 'Unknown error'
      });
    }
  });

  // Get detailed money flow statistics
  app.get('/api/money-flow/statistics', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admins and managers can access detailed statistics
      if (user.role !== 'admin' && user.role !== 'manager' && !user.canAccessAllOrganizations) {
        return res.status(403).json({ 
          message: 'Access denied. Admin or Manager privileges required.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      const statistics = await moneyFlowAutomationService.getMoneyFlowStatistics();

      res.json({
        statistics,
        generatedAt: new Date().toISOString(),
        notes: {
          totalEntries: 'Total number of money flow entries in the system',
          billEntries: 'Entries generated from bills (expenses)',
          residenceEntries: 'Entries generated from residence monthly fees (income)',
          futureEntries: 'Entries with transaction dates in the future',
          dateRange: 'Range from oldest to newest entry'
        }
      });

    } catch (__error) {
      console.error('Error getting money flow statistics:', __error);
      res.status(500).json({ 
        message: 'Failed to get money flow statistics',
        error: __error instanceof Error ? __error.message : 'Unknown error'
      });
    }
  });

  // Test endpoint to verify money flow automation is working
  app.get('/api/money-flow/health', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      
      // Only admins can access health check
      if (user.role !== 'admin' && !user.canAccessAllOrganizations) {
        return res.status(403).json({ 
          message: 'Access denied. Admin privileges required.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      const jobStatus = moneyFlowJob.getStatus();
      const currentTime = new Date().toISOString();

      res.json({
        status: 'healthy',
        jobEnabled: jobStatus.enabled,
        jobRunning: jobStatus.running,
        schedule: jobStatus.schedule,
        currentTime,
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage()
        },
        message: 'Money flow automation system is operational'
      });

    } catch (__error) {
      console.error('Error in money flow health check:', __error);
      res.status(500).json({ 
        status: 'unhealthy',
        error: __error instanceof Error ? __error.message : 'Unknown error',
        message: 'Money flow automation system encountered an error'
      });
    }
  });
}