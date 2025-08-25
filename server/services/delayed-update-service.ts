import { moneyFlowAutomationService } from './money-flow-automation';
import { monthlyBudgetService } from './monthly-budget-service';

/**
 * Service to handle delayed updates to money_flow and budget tables.
 * Waits 15 minutes after a dependency update before triggering regeneration.
 */
class DelayedUpdateService {
  private static instance: DelayedUpdateService;
  private readonly DELAY_MINUTES = 15;
  private readonly DELAY_MS = this.DELAY_MINUTES * 60 * 1000; // 15 minutes in milliseconds

  // Track pending updates to avoid duplicates
  private pendingBillUpdates = new Set<string>();
  private pendingResidenceUpdates = new Set<string>();
  private pendingBuildingBudgetUpdates = new Set<string>();

  /**
   *
   */
  private constructor() {
    console.warn(`🕐 Delayed Update Service initialized with ${this.DELAY_MINUTES}-minute delay`);
  }

  /**
   *
   */
  static getInstance(): DelayedUpdateService {
    if (!DelayedUpdateService.instance) {
      DelayedUpdateService.instance = new DelayedUpdateService();
    }
    return DelayedUpdateService.instance;
  }

  /**
   * Schedule money flow update for a bill after 15-minute delay.
   * @param billId
   */
  scheduleBillUpdate(billId: string): void {
    // Avoid duplicate updates for the same bill
    if (this.pendingBillUpdates.has(billId)) {
      console.warn(`📋 Bill ${billId} already has a pending update, skipping duplicate`);
      return;
    }

    this.pendingBillUpdates.add(billId);
    console.warn(
      `⏰ Scheduling money flow update for bill ${billId} in ${this.DELAY_MINUTES} minutes`
    );

    setTimeout(async () => {
      try {
        console.warn(`🔄 Executing delayed money flow update for bill ${billId}`);

        // Generate money flow entries for the bill
        const moneyFlowEntries = await moneyFlowAutomationService.generateForBill(billId);
        console.warn(`💰 Generated ${moneyFlowEntries} money flow entries for bill ${billId}`);

        // Get the building ID from the bill to update budgets
        const buildingId = await this.getBuildingIdFromBill(billId);
        if (buildingId) {
          await this.scheduleBudgetUpdate(buildingId);
        }
      } catch (_error) {
        console.error(`❌ Failed delayed money flow update for bill ${billId}:`, _error);
      } finally {
        this.pendingBillUpdates.delete(billId);
      }
    }, this.DELAY_MS);
  }

  /**
   * Schedule money flow update for a residence after 15-minute delay.
   * @param residenceId
   */
  scheduleResidenceUpdate(residenceId: string): void {
    // Avoid duplicate updates for the same residence
    if (this.pendingResidenceUpdates.has(residenceId)) {
      console.warn(`🏠 Residence ${residenceId} already has a pending update, skipping duplicate`);
      return;
    }

    this.pendingResidenceUpdates.add(residenceId);
    console.warn(
      `⏰ Scheduling money flow update for residence ${residenceId} in ${this.DELAY_MINUTES} minutes`
    );

    setTimeout(async () => {
      try {
        console.warn(`🔄 Executing delayed money flow update for residence ${residenceId}`);

        // Generate money flow entries for the residence
        const moneyFlowEntries = await moneyFlowAutomationService.generateForResidence(residenceId);
        console.warn(
          `💰 Generated ${moneyFlowEntries} money flow entries for residence ${residenceId}`
        );

        // Get the building ID from the residence to update budgets
        const buildingId = await this.getBuildingIdFromResidence(residenceId);
        if (buildingId) {
          await this.scheduleBudgetUpdate(buildingId);
        }
      } catch (_error) {
        console.error(`❌ Failed delayed money flow update for residence ${residenceId}:`, _error);
      } finally {
        this.pendingResidenceUpdates.delete(residenceId);
      }
    }, this.DELAY_MS);
  }

  /**
   * Schedule budget update for a building after money flow changes.
   * This is called internally after money flow updates complete.
   * @param buildingId
   */
  private async scheduleBudgetUpdate(buildingId: string): Promise<void> {
    // Avoid duplicate updates for the same building
    if (this.pendingBuildingBudgetUpdates.has(buildingId)) {
      console.warn(
        `🏢 Building ${buildingId} already has a pending budget update, skipping duplicate`
      );
      return;
    }

    this.pendingBuildingBudgetUpdates.add(buildingId);
    console.warn(
      `⏰ Scheduling budget update for building ${buildingId} in ${this.DELAY_MINUTES} minutes`
    );

    setTimeout(async () => {
      try {
        console.warn(`🔄 Executing delayed budget update for building ${buildingId}`);

        // Repopulate budget entries for the building
        const budgetEntries = await monthlyBudgetService.repopulateBudgetsForBuilding(buildingId);
        console.warn(`📊 Updated ${budgetEntries} budget entries for building ${buildingId}`);
      } catch (_error) {
        console.error(`❌ Failed delayed budget update for building ${buildingId}:`, _error);
      } finally {
        this.pendingBuildingBudgetUpdates.delete(buildingId);
      }
    }, this.DELAY_MS);
  }

  /**
   * Get building ID from bill ID.
   * @param billId
   */
  private async getBuildingIdFromBill(billId: string): Promise<string | null> {
    try {
      const { db } = await import('../db');
      const { bills } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      const result = await db
        .select({ buildingId: bills.buildingId })
        .from(bills)
        .where(eq(bills.id, billId))
        .limit(1);

      return result.length > 0 ? result[0].buildingId : null;
    } catch (_error) {
      console.error(`❌ Failed to get building ID for bill ${billId}:`, _error);
      return null;
    }
  }

  /**
   * Get building ID from residence ID.
   * @param residenceId
   */
  private async getBuildingIdFromResidence(residenceId: string): Promise<string | null> {
    try {
      const { db } = await import('../db');
      const { residences } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      const result = await db
        .select({ buildingId: residences.buildingId })
        .from(residences)
        .where(eq(residences.id, residenceId))
        .limit(1);

      return result.length > 0 ? result[0].buildingId : null;
    } catch (_error) {
      console.error(`❌ Failed to get building ID for residence ${residenceId}:`, _error);
      return null;
    }
  }

  /**
   * Force immediate update (for testing or urgent updates).
   * @param billId
   */
  async forceImmediateBillUpdate(billId: string): Promise<void> {
    console.warn(`⚡ Force immediate update for bill ${billId}`);

    // Generate money flow entries for the bill
    const moneyFlowEntries = await moneyFlowAutomationService.generateForBill(billId);
    console.warn(`💰 Generated ${moneyFlowEntries} money flow entries for bill ${billId}`);

    // Update budget immediately
    const buildingId = await this.getBuildingIdFromBill(billId);
    if (buildingId) {
      const budgetEntries = await monthlyBudgetService.repopulateBudgetsForBuilding(buildingId);
      console.warn(`📊 Updated ${budgetEntries} budget entries for building ${buildingId}`);
    }
  }

  /**
   * Force immediate update (for testing or urgent updates).
   * @param residenceId
   */
  async forceImmediateResidenceUpdate(residenceId: string): Promise<void> {
    console.warn(`⚡ Force immediate update for residence ${residenceId}`);

    // Generate money flow entries for the residence
    const moneyFlowEntries = await moneyFlowAutomationService.generateForResidence(residenceId);
    console.warn(
      `💰 Generated ${moneyFlowEntries} money flow entries for residence ${residenceId}`
    );

    // Update budget immediately
    const buildingId = await this.getBuildingIdFromResidence(residenceId);
    if (buildingId) {
      const budgetEntries = await monthlyBudgetService.repopulateBudgetsForBuilding(buildingId);
      console.warn(`📊 Updated ${budgetEntries} budget entries for building ${buildingId}`);
    }
  }

  /**
   * Get current status of pending updates.
   */
  getStatus(): {
    delayMinutes: number;
    pendingBillUpdates: number;
    pendingResidenceUpdates: number;
    pendingBudgetUpdates: number;
  } {
    return {
      delayMinutes: this.DELAY_MINUTES,
      pendingBillUpdates: this.pendingBillUpdates.size,
      pendingResidenceUpdates: this.pendingResidenceUpdates.size,
      pendingBudgetUpdates: this.pendingBuildingBudgetUpdates.size,
    };
  }
}

// Export singleton instance
export const delayedUpdateService = DelayedUpdateService.getInstance();
