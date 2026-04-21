/**
 * Maintenance Jobs Scheduler
 * 
 * Background job scheduling for smart maintenance evaluation suggestions
 * Runs daily at 02:15 local time (Quebec timezone) to generate suggestions
 * for all active buildings in the system.
 */

import cron from 'node-cron';
import { db } from '../db';
import { eq, and, inArray, sql, desc, asc } from 'drizzle-orm';
import { 
  buildingElements,
  evaluationSuggestions,
  maintenanceProjects
} from '@shared/schemas/maintenance';
import { organizations, userOrganizations, buildings } from '@shared/schema';
import { maintenanceSuggestionService } from '../services/maintenanceSuggestionService';

/**
 * Job execution statistics interface
 */
interface JobExecutionStats {
  totalBuildings: number;
  processedBuildings: number;
  failedBuildings: number;
  totalSuggestions: {
    created: number;
    updated: number;
    skipped: number;
  };
  errors: string[];
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds
}

/**
 * Building processing result interface
 */
interface BuildingProcessingResult {
  buildingId: string;
  buildingName: string;
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  processingTime: number; // milliseconds
}

/**
 * Maintenance Jobs Scheduler Class
 */
export class MaintenanceJobsScheduler {
  private isRunning = false;
  private lastRun: Date | null = null;
  private runCount = 0;
  private buildingLocks = new Map<string, Date>(); // Advisory locks per building
  private lastExecutionStats: JobExecutionStats | null = null;

  constructor() {
    // Initialize scheduler
  }

  /**
   * Initialize the maintenance jobs scheduler
   */
  init(): void {
    console.log('🔧 Initializing maintenance jobs scheduler...');
    
    // Schedule daily job at 02:15 AM Montreal time
    cron.schedule('15 2 * * *', async () => {
      await this.runDailySuggestionGeneration();
    }, {
      timezone: 'America/Montreal' // Quebec timezone
    });

    // Schedule weekly rebalancing job for winter-blocked dates (Saturdays at 03:00 AM)
    cron.schedule('0 3 * * 6', async () => {
      await this.runWeeklyRebalancing();
    }, {
      timezone: 'America/Montreal'
    });

    console.log('✅ Maintenance jobs scheduled');
    console.log('📅 Daily suggestions: Every day at 02:15 AM (America/Montreal)');
    console.log('🔄 Weekly rebalancing: Saturdays at 03:00 AM (America/Montreal)');
  }

  /**
   * Daily suggestion generation job - main orchestration function
   */
  private async runDailySuggestionGeneration(): Promise<void> {
    if (this.isRunning) {
      console.log('⏭️ Daily maintenance suggestion job already running, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      this.lastRun = new Date();
      this.runCount++;

      console.log('🔧 Starting daily maintenance suggestion generation job...');
      console.log(`📊 Run count: ${this.runCount}`);
      
      const stats = await this.generateSuggestionsForAllBuildings();
      this.lastExecutionStats = stats;
      
      if (stats.failedBuildings === 0) {
        console.log('✅ Daily maintenance suggestion generation completed successfully');
        console.log(`📊 Processed ${stats.processedBuildings}/${stats.totalBuildings} buildings`);
        console.log(`📈 Created: ${stats.totalSuggestions.created}, Updated: ${stats.totalSuggestions.updated}, Skipped: ${stats.totalSuggestions.skipped}`);
        console.log(`⏱️ Duration: ${(stats.duration / 1000).toFixed(2)}s`);
      } else {
        console.warn(`⚠️ Daily maintenance suggestion generation completed with ${stats.failedBuildings} failures`);
        console.warn(`📊 Processed ${stats.processedBuildings}/${stats.totalBuildings} buildings`);
        console.warn(`📈 Created: ${stats.totalSuggestions.created}, Updated: ${stats.totalSuggestions.updated}, Skipped: ${stats.totalSuggestions.skipped}`);
        console.warn(`❌ Errors: ${stats.errors.length}`);
      }

      // Log detailed statistics
      this.logJobResult('daily', stats);

    } catch (error: any) {
      console.error('❌ Critical error in daily maintenance suggestion job:', error);
      
      // Create error stats for logging
      const errorStats: JobExecutionStats = {
        totalBuildings: 0,
        processedBuildings: 0,
        failedBuildings: 0,
        totalSuggestions: { created: 0, updated: 0, skipped: 0 },
        errors: [error.message],
        startTime: this.lastRun || new Date(),
        endTime: new Date(),
        duration: 0
      };
      
      this.lastExecutionStats = errorStats;
      this.logJobResult('daily', errorStats);
      
    } finally {
      this.isRunning = false;
      this.cleanupOldBuildingLocks();
    }
  }

  /**
   * Generate suggestions for all active buildings in the system
   */
  private async generateSuggestionsForAllBuildings(): Promise<JobExecutionStats> {
    const startTime = new Date();
    const stats: JobExecutionStats = {
      totalBuildings: 0,
      processedBuildings: 0,
      failedBuildings: 0,
      totalSuggestions: { created: 0, updated: 0, skipped: 0 },
      errors: [],
      startTime,
      endTime: new Date(),
      duration: 0
    };

    try {
      // Get all active buildings
      const activeBuildings = await db
        .select({
          id: buildings.id,
          name: buildings.name,
          organizationId: buildings.organizationId,
          isActive: buildings.isActive
        })
        .from(buildings)
        .where(eq(buildings.isActive, true))
        .orderBy(asc(buildings.name));

      stats.totalBuildings = activeBuildings.length;
      console.log(`🏢 Found ${stats.totalBuildings} active buildings to process`);

      if (stats.totalBuildings === 0) {
        console.log('📝 No active buildings found, skipping generation');
        stats.endTime = new Date();
        stats.duration = stats.endTime.getTime() - startTime.getTime();
        return stats;
      }

      // Process buildings with advisory locking
      const buildingResults: BuildingProcessingResult[] = [];
      
      for (const building of activeBuildings) {
        try {
          // Check advisory lock
          const lockKey = building.id;
          const existingLock = this.buildingLocks.get(lockKey);
          const now = new Date();
          
          // Skip if locked within last 30 minutes
          if (existingLock && (now.getTime() - existingLock.getTime()) < (30 * 60 * 1000)) {
            console.log(`🔒 Building ${building.id} (${building.name}) is locked, skipping`);
            continue;
          }

          // Acquire lock
          this.buildingLocks.set(lockKey, now);
          
          console.log(`🔧 Processing building ${building.id} (${building.name})`);
          const buildingStartTime = new Date();

          // Generate suggestions for this building
          const result = await maintenanceSuggestionService.generateForBuilding(building.id, {
            dryRun: false,
            limit: 1000 // Process up to 1000 elements per building
          });

          const buildingEndTime = new Date();
          const processingTime = buildingEndTime.getTime() - buildingStartTime.getTime();

          const buildingResult: BuildingProcessingResult = {
            buildingId: building.id,
            buildingName: building.name,
            success: result.errors.length === 0,
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            errors: result.errors,
            processingTime
          };

          buildingResults.push(buildingResult);

          // Accumulate stats
          stats.totalSuggestions.created += result.created;
          stats.totalSuggestions.updated += result.updated;
          stats.totalSuggestions.skipped += result.skipped;
          
          if (result.errors.length > 0) {
            stats.failedBuildings++;
            stats.errors.push(`Building ${building.name}: ${result.errors.join(', ')}`);
          } else {
            stats.processedBuildings++;
          }

          console.log(`✅ Building ${building.name}: Created=${result.created}, Updated=${result.updated}, Skipped=${result.skipped}, Time=${(processingTime/1000).toFixed(2)}s`);

          // Release lock
          this.buildingLocks.delete(lockKey);

          // Add small delay between buildings to avoid overwhelming the database
          if (activeBuildings.length > 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

        } catch (buildingError: any) {
          console.error(`❌ Error processing building ${building.id} (${building.name}):`, buildingError);
          
          stats.failedBuildings++;
          stats.errors.push(`Building ${building.name}: ${buildingError.message}`);
          
          // Release lock on error
          this.buildingLocks.delete(building.id);
          
          buildingResults.push({
            buildingId: building.id,
            buildingName: building.name,
            success: false,
            created: 0,
            updated: 0,
            skipped: 0,
            errors: [buildingError.message],
            processingTime: 0
          });
        }
      }

      // Calculate final statistics
      stats.endTime = new Date();
      stats.duration = stats.endTime.getTime() - startTime.getTime();
      
      console.log('📊 Building processing summary:');
      buildingResults.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`   ${status} ${result.buildingName}: ${result.created}/${result.updated}/${result.skipped} (${(result.processingTime/1000).toFixed(2)}s)`);
      });

      return stats;

    } catch (error: any) {
      console.error('❌ Critical error during building iteration:', error);
      stats.errors.push(`Critical error: ${error.message}`);
      stats.failedBuildings = stats.totalBuildings;
      stats.endTime = new Date();
      stats.duration = stats.endTime.getTime() - startTime.getTime();
      return stats;
    }
  }

  /**
   * Weekly rebalancing job for winter-blocked suggestions
   */
  private async runWeeklyRebalancing(): Promise<void> {
    console.log('🔄 Starting weekly rebalancing job for winter-blocked suggestions...');
    
    try {
      const now = new Date();
      const currentMonth = now.getMonth(); // 0-11
      const isWinterSeason = currentMonth >= 11 || currentMonth <= 2; // Dec, Jan, Feb, Mar

      if (!isWinterSeason) {
        console.log('📅 Not winter season, skipping rebalancing');
        return;
      }

      // Find suggestions that are blocked by winter and can be moved to spring
      const winterBlockedSuggestions = await db
        .select()
        .from(evaluationSuggestions)
        .innerJoin(buildingElements, eq(evaluationSuggestions.elementId, buildingElements.id))
        .where(and(
          eq(evaluationSuggestions.status, 'pending'),
          inArray(evaluationSuggestions.suggestedType, ['major_rehab', 'replacement']),
          sql`DATE_PART('month', ${evaluationSuggestions.suggestedDate}) IN (12, 1, 2, 3)`,
          sql`${buildingElements.uniformatCode} LIKE 'B%' OR ${buildingElements.uniformatCode} LIKE 'G%'`
        ));

      console.log(`🔄 Found ${winterBlockedSuggestions.length} winter-blocked suggestions to rebalance`);

      let rebalancedCount = 0;
      for (const suggestion of winterBlockedSuggestions) {
        try {
          // Calculate new spring date
          const year = now.getFullYear();
          const springDate = new Date(year, 4, 1); // May 1st
          
          if (springDate.getTime() > now.getTime()) {
            await db
              .update(evaluationSuggestions)
              .set({
                suggestedDate: springDate.toISOString().split('T')[0], // Convert Date to string (YYYY-MM-DD)
                reason: sql`${evaluationSuggestions.reason} || ' | REBALANCED: Moved from winter to spring'`,
                updatedAt: new Date()
              })
              .where(eq(evaluationSuggestions.id, suggestion.evaluation_suggestions.id));
            
            rebalancedCount++;
          }
        } catch (error: any) {
          console.error(`❌ Error rebalancing suggestion ${suggestion.evaluation_suggestions.id}:`, error);
        }
      }

      console.log(`✅ Weekly rebalancing completed: ${rebalancedCount} suggestions moved to spring`);

    } catch (error: any) {
      console.error('❌ Error in weekly rebalancing job:', error);
    }
  }

  /**
   * Manual trigger for immediate execution (used by API endpoint)
   */
  async triggerManual(options: {
    buildingIds?: string[];
    organizationId?: string;
    dryRun?: boolean;
    limit?: number;
  } = {}): Promise<any> {
    console.log('🔄 Manual trigger requested for maintenance suggestion generation...');
    
    try {
      if (this.isRunning) {
        throw new Error('Daily job is already running. Please wait for it to complete.');
      }

      const startTime = new Date();

      // If specific buildings are provided, process only those
      if (options.buildingIds && options.buildingIds.length > 0) {
        console.log(`🎯 Processing specific buildings: ${options.buildingIds.join(', ')}`);
        
        let totalCreated = 0, totalUpdated = 0, totalSkipped = 0;
        const errors: string[] = [];

        for (const buildingId of options.buildingIds) {
          try {
            const result = await maintenanceSuggestionService.generateForBuilding(buildingId, {
              dryRun: options.dryRun || false,
              limit: options.limit
            });

            totalCreated += result.created;
            totalUpdated += result.updated;
            totalSkipped += result.skipped;
            errors.push(...result.errors);

          } catch (buildingError: any) {
            console.error(`❌ Error processing building ${buildingId}:`, buildingError);
            errors.push(`Building ${buildingId}: ${buildingError.message}`);
          }
        }

        const duration = new Date().getTime() - startTime.getTime();

        return {
          status: errors.length === 0 ? 'completed' : 'partial',
          manual: true,
          dryRun: options.dryRun || false,
          duration: duration,
          results: {
            buildings: options.buildingIds.length,
            created: totalCreated,
            updated: totalUpdated,
            skipped: totalSkipped,
            errors: errors.length
          },
          errors: errors.slice(0, 10) // Limit error details
        };
      }

      // Otherwise run full generation
      const stats = await this.generateSuggestionsForAllBuildings();
      
      return {
        status: stats.failedBuildings === 0 ? 'completed' : 'partial',
        manual: true,
        dryRun: false,
        duration: stats.duration,
        results: {
          buildings: stats.totalBuildings,
          processed: stats.processedBuildings,
          failed: stats.failedBuildings,
          ...stats.totalSuggestions
        },
        errors: stats.errors.slice(0, 10) // Limit error details
      };
      
    } catch (error: any) {
      console.error('❌ Error in manual trigger:', error);
      throw error;
    }
  }

  /**
   * Get current job status and statistics
   */
  async getJobStatus(): Promise<{
    isRunning: boolean;
    lastRun: Date | null;
    runCount: number;
    nextScheduled: string;
    buildingLocks: number;
    lastExecution?: JobExecutionStats;
  }> {
    // Calculate next scheduled run (tomorrow at 02:15 AM)
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setDate(now.getDate() + 1);
    nextRun.setHours(2, 15, 0, 0);
    
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      runCount: this.runCount,
      nextScheduled: nextRun.toISOString(),
      buildingLocks: this.buildingLocks.size,
      lastExecution: this.lastExecutionStats || undefined
    };
  }

  /**
   * Clean up old building locks (older than 1 hour)
   */
  private cleanupOldBuildingLocks(): void {
    const now = new Date();
    const oneHourAgo = now.getTime() - (60 * 60 * 1000);
    
    let cleaned = 0;
    for (const [buildingId, lockTime] of this.buildingLocks.entries()) {
      if (lockTime.getTime() < oneHourAgo) {
        this.buildingLocks.delete(buildingId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old building locks`);
    }
  }

  /**
   * Log job results for monitoring and debugging
   */
  private logJobResult(jobType: 'daily' | 'weekly' | 'manual', stats: JobExecutionStats): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      jobType,
      success: stats.failedBuildings === 0,
      runCount: this.runCount,
      duration: `${(stats.duration / 1000).toFixed(2)}s`,
      buildings: {
        total: stats.totalBuildings,
        processed: stats.processedBuildings,
        failed: stats.failedBuildings
      },
      suggestions: stats.totalSuggestions,
      errorCount: stats.errors.length,
      errors: stats.errors.slice(0, 5) // Limit logged errors
    };
    
    console.log('📋 Maintenance Job Log:', JSON.stringify(logEntry, null, 2));
  }

  /**
   * Stop all scheduled jobs (for graceful shutdown)
   */
  destroy(): void {
    console.log('🛑 Stopping maintenance jobs scheduler...');
    cron.getTasks().forEach(task => task.destroy());
    this.buildingLocks.clear();
    console.log('✅ Maintenance jobs scheduler stopped');
  }
}

// Export singleton instance
export const maintenanceJobsScheduler = new MaintenanceJobsScheduler();