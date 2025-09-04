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
      return;
    }

    this.pendingBillUpdates.add(billId);
    console.log(
      `⏰ Scheduling money flow update for bill ${billId} in ${this.DELAY_MINUTES} minutes`
    );

    setTimeout(async () => {
      try {

        // Generate money flow entries for the bill
        const moneyFlowEntries = await moneyFlowAutomationService.generateForBill(billId);

        // Get the building ID from the bill to update budgets
        const buildingId = await this.getBuildingIdFromBill(billId);
        if (buildingId) {
          await this.scheduleBudgetUpdate(buildingId);
        }
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
      return;
    }

    this.pendingResidenceUpdates.add(residenceId);
    console.log(
      `⏰ Scheduling money flow update for residence ${residenceId} in ${this.DELAY_MINUTES} minutes`
    );

    setTimeout(async () => {
      try {

        // Generate money flow entries for the residence
        const moneyFlowEntries = await moneyFlowAutomationService.generateForResidence(residenceId);
        console.log(
          `💰 Generated ${moneyFlowEntries} money flow entries for residence ${residenceId}`
        );

        // Get the building ID from the residence to update budgets
        const buildingId = await this.getBuildingIdFromResidence(residenceId);
        if (buildingId) {
          await this.scheduleBudgetUpdate(buildingId);
        }
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
      console.log(
        `🏢 Building ${buildingId} already has a pending budget update, skipping duplicate`
      );
      return;
    }

    this.pendingBuildingBudgetUpdates.add(buildingId);
    console.log(
      `⏰ Scheduling budget update for building ${buildingId} in ${this.DELAY_MINUTES} minutes`
    );

    setTimeout(async () => {
      try {

        // Repopulate budget entries for the building
        const budgetEntries = await monthlyBudgetService.repopulateBudgetsForBuilding(buildingId);
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
    } catch (error: any) {
      console.error('❌ Error getting building ID:', error);
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
    } catch (error: any) {
      console.error('❌ Error getting building ID:', error);
      return null;
    }
  }

  /**
   * Force immediate update (for testing or urgent updates).
   * @param billId
   */
  async forceImmediateBillUpdate(billId: string): Promise<void> {

    // Generate money flow entries for the bill
    const moneyFlowEntries = await moneyFlowAutomationService.generateForBill(billId);

    // Update budget immediately
    const buildingId = await this.getBuildingIdFromBill(billId);
    if (buildingId) {
      const budgetEntries = await monthlyBudgetService.repopulateBudgetsForBuilding(buildingId);
    }
  }

  /**
   * Force immediate update (for testing or urgent updates).
   * @param residenceId
   */
  async forceImmediateResidenceUpdate(residenceId: string): Promise<void> {

    // Generate money flow entries for the residence
    const moneyFlowEntries = await moneyFlowAutomationService.generateForResidence(residenceId);
    console.log(
      `💰 Generated ${moneyFlowEntries} money flow entries for residence ${residenceId}`
    );

    // Update budget immediately
    const buildingId = await this.getBuildingIdFromResidence(residenceId);
    if (buildingId) {
      const budgetEntries = await monthlyBudgetService.repopulateBudgetsForBuilding(buildingId);
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
