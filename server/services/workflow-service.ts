import { db } from '../db';
import { eq, and, count, sum } from 'drizzle-orm';
import {
  maintenanceProjects,
  submissionVendors,
  workflowTasks,
  projectNotifications,
  projectElements,
  type MaintenanceProject,
} from '@shared/schemas/maintenance';

// Define the workflow status progression
const STATUS_PROGRESSION = [
  'planned',
  'submission', 
  'pre_work',
  'in_progress',
  'post_work',
  'completed'
] as const;

// Define which statuses can be skipped
const SKIPPABLE_STATUSES = [
  'submission',
  'pre_work',
  'in_progress',
  'post_work'
] as const;

export type WorkflowStatus = typeof STATUS_PROGRESSION[number];
export type SkippableStatus = typeof SKIPPABLE_STATUSES[number];

export interface SkipFlags {
  skipSubmission?: boolean;
  skipPreWork?: boolean;
  skipInProgress?: boolean;
  skipPostWork?: boolean;
}

export interface WorkflowState {
  projectId: string;
  currentStatus: WorkflowStatus;
  skipFlags: SkipFlags;
  completedStatuses: WorkflowStatus[];
  nextStatus: WorkflowStatus | null;
  canProgress: boolean;
  isQuickProject: boolean;
  progressionHistory: {
    status: WorkflowStatus;
    completedAt: Date | null;
    isSkipped: boolean;
  }[];
}

/**
 * Workflow Service
 * Manages project workflow state progression and business logic
 */
export class WorkflowService {
  
  /**
   * Get current workflow state for a project with skip flags and completion status
   */
  async getProjectWorkflowState(projectId: string): Promise<WorkflowState | null> {
    try {
      // Get project with current status and skip flags
      const project = await db
        .select()
        .from(maintenanceProjects)
        .where(eq(maintenanceProjects.id, projectId))
        .limit(1);

      if (project.length === 0) {
        return null;
      }

      const projectData = project[0];
      const currentStatus = projectData.status as WorkflowStatus;
      const isQuickProject = projectData.isQuickProject || false;
      
      const skipFlags: SkipFlags = {
        skipSubmission: projectData.skipSubmission || false,
        skipPreWork: projectData.skipPreWork || false,
        skipInProgress: projectData.skipInProgress || false,
        skipPostWork: projectData.skipPostWork || false,
      };

      // Calculate progression history and completed statuses
      const progressionHistory = this.calculateProgressionHistory(currentStatus, skipFlags);
      const completedStatuses = progressionHistory
        .filter(item => item.completedAt !== null || item.isSkipped)
        .map(item => item.status);

      // Determine next status
      const nextStatus = this.getNextStatus(currentStatus, skipFlags, isQuickProject);
      
      // Check if can progress - Quick Projects cannot progress beyond planning
      let canProgress = currentStatus !== 'completed' && 
                       nextStatus !== null && 
                       !(isQuickProject && currentStatus === 'planned');
      
      // Note: Removed the requirement for linked elements in planned stage
      // Projects can now advance from planned stage without requiring building elements
      // This allows users to complete the planning phase and move to subsequent stages

      return {
        projectId,
        currentStatus,
        skipFlags,
        completedStatuses,
        nextStatus,
        canProgress,
        isQuickProject,
        progressionHistory,
      };
    } catch (error) {
      console.error('Error getting project workflow state:', error);
      throw new Error('Failed to get project workflow state');
    }
  }

  /**
   * Advance project to next non-skipped status
   */
  async markStatusComplete(projectId: string, currentStatus: WorkflowStatus): Promise<WorkflowState> {
    try {
      // Get current project state
      const workflowState = await this.getProjectWorkflowState(projectId);
      if (!workflowState) {
        throw new Error('Project not found');
      }

      // Validate current status matches
      if (workflowState.currentStatus !== currentStatus) {
        throw new Error(`Project status mismatch. Expected: ${currentStatus}, Current: ${workflowState.currentStatus}`);
      }

      // Check if can progress
      if (!workflowState.canProgress) {
        if (workflowState.isQuickProject && workflowState.currentStatus === 'planned') {
          throw new Error('Quick Projects cannot advance beyond planning phase. Quick Projects are for planning purposes only.');
        }
        
        // Check if it's a non-Quick project in 'planned' status with no linked elements
        if (!workflowState.isQuickProject && workflowState.currentStatus === 'planned') {
          const linkedElementsCount = await this.countLinkedElements(projectId);
          if (linkedElementsCount === 0) {
            throw new Error('Project cannot advance from planning phase without linked elements. All projects must be linked to at least one element in the inventory before proceeding to the next phase.');
          }
        }
        
        throw new Error('Project cannot progress from current status');
      }

      const nextStatus = workflowState.nextStatus;
      if (!nextStatus) {
        throw new Error('No next status available');
      }

      // Calculate actual cost from all completed phases (including the one we're about to complete)
      // First update the status, then recalculate the cost based on completed phases

      // Update project status in database first
      await db
        .update(maintenanceProjects)
        .set({
          status: nextStatus,
          updatedAt: new Date(),
          // Set specific date fields based on status
          ...(nextStatus === 'in_progress' && { actualStartDate: new Date().toISOString().split('T')[0] }),
          ...(nextStatus === 'completed' && { actualEndDate: new Date().toISOString().split('T')[0] }),
        })
        .where(eq(maintenanceProjects.id, projectId));

      // Now recalculate actual cost based on all completed phases
      const actualCost = await this.calculateActualCostFromCompletedPhases(projectId);
      
      // Update the actual cost
      await db
        .update(maintenanceProjects)
        .set({
          actualCost: actualCost.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(maintenanceProjects.id, projectId));

      // Return updated workflow state
      return await this.getProjectWorkflowState(projectId) as WorkflowState;
    } catch (error) {
      console.error('Error marking status complete:', error);
      throw error;
    }
  }

  /**
   * Calculate actual cost based only on completed workflow phases and completed tasks
   */
  async calculateActualCostFromCompletedPhases(projectId: string): Promise<number> {
    try {
      const workflowState = await this.getProjectWorkflowState(projectId);
      if (!workflowState) {
        throw new Error('Project not found');
      }

      let totalActualCost = 0;

      // Only include submission costs if submission phase is completed
      if (workflowState.completedStatuses.includes('submission')) {
        const preferredVendorResult = await db
          .select({
            price: submissionVendors.price,
            paymentPlanCosts: submissionVendors.paymentPlanCosts
          })
          .from(submissionVendors)
          .where(
            and(
              eq(submissionVendors.projectId, projectId),
              eq(submissionVendors.preferred, true)
            )
          )
          .limit(1);

        if (preferredVendorResult.length > 0) {
          const vendor = preferredVendorResult[0];
          let vendorCost = 0;

          // Use payment plan costs if available (sum of all payment amounts)
          if (vendor.paymentPlanCosts && Array.isArray(vendor.paymentPlanCosts) && vendor.paymentPlanCosts.length > 0) {
            vendorCost = vendor.paymentPlanCosts.reduce((sum, cost) => {
              return sum + parseFloat(cost?.toString() || '0');
            }, 0);
          } else if (vendor.price) {
            // Fall back to price field if no payment plan costs
            vendorCost = parseFloat(vendor.price.toString() || '0');
          }

          totalActualCost += vendorCost;
        }
      }

      // Include completed task costs from:
      // 1. All completed phases
      // 2. The current phase (for individual completed tasks)
      const taskPhases = ['pre_work', 'in_progress', 'post_work'] as const;
      for (const phase of taskPhases) {
        // Include tasks from completed phases OR the current phase
        if (workflowState.completedStatuses.includes(phase) || workflowState.currentStatus === phase) {
          const completedTaskCostResult = await db
            .select({
              totalCost: sum(workflowTasks.cost)
            })
            .from(workflowTasks)
            .where(
              and(
                eq(workflowTasks.projectId, projectId),
                eq(workflowTasks.phase, phase),
                eq(workflowTasks.isCompleted, true) // Only completed tasks
              )
            );

          const phaseCost = parseFloat(completedTaskCostResult[0]?.totalCost?.toString() || '0');
          totalActualCost += phaseCost;
        }
      }

      return totalActualCost;
    } catch (error) {
      console.error('Error calculating actual cost from completed phases:', error);
      throw error;
    }
  }

  /**
   * Get allowed reopen targets - statuses that can be reopened to from current status
   */
  async getAllowedReopenTargets(projectId: string): Promise<WorkflowStatus[]> {
    try {
      const workflowState = await this.getProjectWorkflowState(projectId);
      if (!workflowState) {
        throw new Error('Project not found');
      }

      const currentIndex = STATUS_PROGRESSION.indexOf(workflowState.currentStatus);
      const allowedTargets: WorkflowStatus[] = [];

      // Can only reopen to previous completed/skipped statuses, not the current or future ones
      for (let i = 0; i < currentIndex; i++) {
        const status = STATUS_PROGRESSION[i];
        const wasCompleted = workflowState.completedStatuses.includes(status);
        const isSkipped = this.shouldSkipStatus(status, workflowState.skipFlags);
        
        // Allow reopening to statuses that were completed or skipped
        if (wasCompleted || isSkipped) {
          allowedTargets.push(status);
        }
      }

      return allowedTargets;
    } catch (error) {
      console.error('Error getting allowed reopen targets:', error);
      throw new Error('Failed to get allowed reopen targets');
    }
  }

  /**
   * Reopen workflow to a previous phase
   */
  async reopenToPhase(projectId: string, targetStatus: WorkflowStatus, reason?: string): Promise<WorkflowState> {
    try {
      // Get current workflow state
      const workflowState = await this.getProjectWorkflowState(projectId);
      if (!workflowState) {
        throw new Error('Project not found');
      }

      // Validate that target status is allowed
      const allowedTargets = await this.getAllowedReopenTargets(projectId);
      if (!allowedTargets.includes(targetStatus)) {
        throw new Error(`Cannot reopen to ${targetStatus}. Allowed targets: ${allowedTargets.join(', ')}`);
      }

      // Prevent reopening to current status
      if (workflowState.currentStatus === targetStatus) {
        throw new Error(`Project is already at ${targetStatus} status`);
      }

      const targetIndex = STATUS_PROGRESSION.indexOf(targetStatus);
      const currentIndex = STATUS_PROGRESSION.indexOf(workflowState.currentStatus);

      // Validate backward transition
      if (targetIndex >= currentIndex) {
        throw new Error('Can only reopen to previous statuses');
      }

      // Reset downstream phase artifacts
      await this.resetDownstreamArtifacts(projectId, targetIndex);

      // Update project status in database
      await db
        .update(maintenanceProjects)
        .set({
          status: targetStatus,
          updatedAt: new Date(),
          // Reset date fields for reopened phases
          ...(targetIndex < STATUS_PROGRESSION.indexOf('in_progress') && { 
            actualStartDate: null 
          }),
          ...(targetIndex < STATUS_PROGRESSION.indexOf('completed') && { 
            actualEndDate: null 
          }),
        })
        .where(eq(maintenanceProjects.id, projectId));

      // Recalculate actual cost based on remaining completed phases
      const actualCost = await this.calculateActualCostFromCompletedPhases(projectId);
      
      // Update the actual cost
      await db
        .update(maintenanceProjects)
        .set({
          actualCost: actualCost.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(maintenanceProjects.id, projectId));

      console.log(`🔄 [WORKFLOW REOPEN] Project ${projectId} reopened from ${workflowState.currentStatus} to ${targetStatus}${reason ? ` (Reason: ${reason})` : ''}`);

      // Return updated workflow state
      return await this.getProjectWorkflowState(projectId) as WorkflowState;
    } catch (error) {
      console.error('Error reopening workflow phase:', error);
      throw error;
    }
  }

  /**
   * Update skip flags for a project
   */
  async updateSkipFlags(projectId: string, skipFlags: SkipFlags): Promise<WorkflowState> {
    try {
      // Validate skip flags
      this.validateSkipFlags(skipFlags);

      // Get current project to validate state
      const currentState = await this.getProjectWorkflowState(projectId);
      if (!currentState) {
        throw new Error('Project not found');
      }

      // Prevent changing skip flags for already completed statuses
      const currentStatusIndex = STATUS_PROGRESSION.indexOf(currentState.currentStatus);
      
      // Check if trying to skip a status that's already passed
      if (skipFlags.skipSubmission && currentStatusIndex > STATUS_PROGRESSION.indexOf('submission')) {
        throw new Error('Cannot skip submission phase - already passed');
      }
      if (skipFlags.skipPreWork && currentStatusIndex > STATUS_PROGRESSION.indexOf('pre_work')) {
        throw new Error('Cannot skip pre-work phase - already passed');
      }
      if (skipFlags.skipInProgress && currentStatusIndex > STATUS_PROGRESSION.indexOf('in_progress')) {
        throw new Error('Cannot skip in-progress phase - already passed');
      }
      if (skipFlags.skipPostWork && currentStatusIndex > STATUS_PROGRESSION.indexOf('post_work')) {
        throw new Error('Cannot skip post-work phase - already passed');
      }

      // Update skip flags in database
      await db
        .update(maintenanceProjects)
        .set({
          skipSubmission: skipFlags.skipSubmission || false,
          skipPreWork: skipFlags.skipPreWork || false,
          skipInProgress: skipFlags.skipInProgress || false,
          skipPostWork: skipFlags.skipPostWork || false,
          updatedAt: new Date(),
        })
        .where(eq(maintenanceProjects.id, projectId));

      // Return updated workflow state
      return await this.getProjectWorkflowState(projectId) as WorkflowState;
    } catch (error) {
      console.error('Error updating skip flags:', error);
      throw error;
    }
  }

  /**
   * Determine next status in workflow based on current status and skip flags
   */
  getNextStatus(currentStatus: WorkflowStatus, skipFlags: SkipFlags, isQuickProject: boolean = false): WorkflowStatus | null {
    // Quick Projects cannot advance beyond planned status
    if (isQuickProject && currentStatus === 'planned') {
      return null;
    }
    
    const currentIndex = STATUS_PROGRESSION.indexOf(currentStatus);
    
    if (currentIndex === -1 || currentIndex >= STATUS_PROGRESSION.length - 1) {
      return null; // Already at end or invalid status
    }

    // Look for next non-skipped status
    for (let i = currentIndex + 1; i < STATUS_PROGRESSION.length; i++) {
      const nextStatus = STATUS_PROGRESSION[i];
      
      // Check if this status should be skipped
      if (this.shouldSkipStatus(nextStatus, skipFlags)) {
        continue; // Skip this status
      }
      
      return nextStatus;
    }

    return null; // No more statuses
  }

  /**
   * Validate which statuses can be skipped
   */
  isStatusSkippable(status: WorkflowStatus): boolean {
    return SKIPPABLE_STATUSES.includes(status as SkippableStatus);
  }

  /**
   * Private helper methods
   */

  /**
   * Preserve downstream phase artifacts when reopening to an earlier phase
   * This function intentionally does NOT reset progress from future phases
   */
  private async resetDownstreamArtifacts(projectId: string, targetIndex: number): Promise<void> {
    try {
      // Note: We intentionally preserve all downstream artifacts to maintain user progress
      // The user can still access and modify future phases as needed
      
      // Only reset project notifications that haven't been sent yet
      // This prevents duplicate notifications but preserves actual work progress
      await db
        .update(projectNotifications)
        .set({
          isSent: false,
        })
        .where(
          and(
            eq(projectNotifications.projectId, projectId),
            eq(projectNotifications.isSent, true)
          )
        );

      console.log(`🔄 [WORKFLOW REOPEN] Preserved progress in future phases when reopening to index ${targetIndex}`);
    } catch (error) {
      console.error('Error resetting downstream artifacts:', error);
      throw new Error('Failed to reset downstream artifacts');
    }
  }

  /**
   * Count the number of linked elements for a project
   */
  private async countLinkedElements(projectId: string): Promise<number> {
    try {
      const result = await db
        .select({ count: count() })
        .from(projectElements)
        .where(eq(projectElements.projectId, projectId));
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error counting linked elements:', error);
      return 0;
    }
  }

  private shouldSkipStatus(status: WorkflowStatus, skipFlags: SkipFlags): boolean {
    switch (status) {
      case 'submission':
        return skipFlags.skipSubmission || false;
      case 'pre_work':
        return skipFlags.skipPreWork || false;
      case 'in_progress':
        return skipFlags.skipInProgress || false;
      case 'post_work':
        return skipFlags.skipPostWork || false;
      default:
        return false; // Non-skippable statuses
    }
  }

  private calculateProgressionHistory(currentStatus: WorkflowStatus, skipFlags: SkipFlags): {
    status: WorkflowStatus;
    completedAt: Date | null;
    isSkipped: boolean;
  }[] {
    const currentIndex = STATUS_PROGRESSION.indexOf(currentStatus);
    
    return STATUS_PROGRESSION.map((status, index) => {
      const isSkipped = this.shouldSkipStatus(status, skipFlags);
      const isCompleted = index < currentIndex || (index === currentIndex && currentStatus === 'completed');
      
      return {
        status,
        completedAt: isCompleted ? new Date() : null, // In real implementation, would use actual completion dates
        isSkipped,
      };
    });
  }

  private validateSkipFlags(skipFlags: SkipFlags): void {
    // Validate that only skippable statuses are being skipped
    const validFlags = ['skipSubmission', 'skipPreWork', 'skipInProgress', 'skipPostWork'];
    
    for (const [key, value] of Object.entries(skipFlags)) {
      if (!validFlags.includes(key)) {
        throw new Error(`Invalid skip flag: ${key}`);
      }
      
      if (typeof value !== 'boolean' && value !== undefined) {
        throw new Error(`Skip flag ${key} must be a boolean`);
      }
    }
  }

  /**
   * Get workflow statistics for reporting
   */
  async getWorkflowStatistics(projectIds: string[]): Promise<{
    totalProjects: number;
    statusDistribution: Record<WorkflowStatus, number>;
    averageCompletionTime: number | null;
    projectsWithSkips: number;
  }> {
    try {
      if (projectIds.length === 0) {
        return {
          totalProjects: 0,
          statusDistribution: {
            planned: 0,
            submission: 0,
            pre_work: 0,
            in_progress: 0,
            post_work: 0,
            completed: 0,
          },
          averageCompletionTime: null,
          projectsWithSkips: 0,
        };
      }

      const projects = await db
        .select()
        .from(maintenanceProjects)
        .where(eq(maintenanceProjects.id, projectIds[0])); // Simplified for example

      // Calculate statistics
      const statusDistribution = STATUS_PROGRESSION.reduce((acc, status) => {
        acc[status] = projects.filter(p => p.status === status).length;
        return acc;
      }, {} as Record<WorkflowStatus, number>);

      const projectsWithSkips = projects.filter(p => 
        p.skipSubmission || p.skipPreWork || p.skipInProgress || p.skipPostWork
      ).length;

      // Calculate average completion time for completed projects
      const completedProjects = projects.filter(p => 
        p.status === 'completed' && p.createdAt && p.actualEndDate
      );
      
      const averageCompletionTime = completedProjects.length > 0
        ? completedProjects.reduce((acc, p) => {
            const duration = new Date(p.actualEndDate!).getTime() - p.createdAt.getTime();
            return acc + duration;
          }, 0) / completedProjects.length / (1000 * 60 * 60 * 24) // Convert to days
        : null;

      return {
        totalProjects: projects.length,
        statusDistribution,
        averageCompletionTime,
        projectsWithSkips,
      };
    } catch (error) {
      console.error('Error getting workflow statistics:', error);
      throw new Error('Failed to get workflow statistics');
    }
  }

  /**
   * Validate workflow transition rules
   */
  async validateWorkflowTransition(
    projectId: string, 
    fromStatus: WorkflowStatus, 
    toStatus: WorkflowStatus
  ): Promise<{ isValid: boolean; reason?: string }> {
    try {
      const workflowState = await this.getProjectWorkflowState(projectId);
      if (!workflowState) {
        return { isValid: false, reason: 'Project not found' };
      }

      // Check if current status matches fromStatus
      if (workflowState.currentStatus !== fromStatus) {
        return { 
          isValid: false, 
          reason: `Current status ${workflowState.currentStatus} does not match expected ${fromStatus}` 
        };
      }

      // Check if toStatus is the expected next status
      if (workflowState.nextStatus !== toStatus) {
        return { 
          isValid: false, 
          reason: `Cannot transition to ${toStatus}. Expected next status: ${workflowState.nextStatus}` 
        };
      }

      // Validate no backward transitions (except for admin overrides)
      const fromIndex = STATUS_PROGRESSION.indexOf(fromStatus);
      const toIndex = STATUS_PROGRESSION.indexOf(toStatus);
      
      if (toIndex <= fromIndex && toStatus !== 'completed') {
        return { 
          isValid: false, 
          reason: 'Backward transitions are not allowed in workflow' 
        };
      }

      return { isValid: true };
    } catch (error) {
      console.error('Error validating workflow transition:', error);
      return { isValid: false, reason: 'Validation error occurred' };
    }
  }
}

// Export singleton instance
export const workflowService = new WorkflowService();