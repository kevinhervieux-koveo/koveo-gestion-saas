import { logDebug } from './logger.js';

export interface ScenarioInput {
  year: number;
  month: number;
  revenue: number;
  spending: number;
  confirmedInvestments: number; // Only user-created/approved investments, NOT auto-generated
  minRequirement: number; // Emergency + Operating + custom minimums
}

export interface ScenarioResult {
  year: number;
  month: number;
  balanceBefore: number; // Balance before any auto-generated investments
  autoGenUrgent: number; // Auto-generated investment for urgent scenario
  autoGenSuggested: number; // Auto-generated investment for suggested scenario  
  finalBalanceUrgent: number; // Final balance with urgent investments
  finalBalanceSuggested: number; // Final balance with suggested investments
  minRequirement: number;
  revenue: number;
  spending: number;
}

export class ScenarioEngine {
  /**
   * Compute base balance series before applying any auto-generated investments
   */
  static computeBaseSeries(
    inputs: ScenarioInput[], 
    startingBalance: number
  ): ScenarioInput[] {
    let runningBalance = startingBalance;
    
    return inputs.map(input => {
      // Balance before scenario = previous ending balance + revenue - spending + confirmed investments
      const balanceBefore = runningBalance + input.revenue - input.spending + input.confirmedInvestments;
      
      // Update running balance for next iteration (no auto-gen investments included)
      runningBalance = balanceBefore;
      
      return {
        ...input,
        // Store balanceBefore for scenario calculations (we'll use a temp field)
        minRequirement: input.minRequirement
      };
    });
  }

  /**
   * Urgent Scenario: Minimal injection only when balance would fall below minimum
   * autoGen[i] = max(0, minRequirement[i] - balanceBefore[i])
   */
  static computeUrgent(inputs: ScenarioInput[], startingBalance: number): ScenarioResult[] {
    let runningBalance = startingBalance;
    
    return inputs.map(input => {
      // Calculate balance before any auto-generated investments
      const balanceBefore = runningBalance + input.revenue - input.spending + input.confirmedInvestments;
      
      // Urgent: Only inject if balance falls below minimum requirement
      const autoGenUrgent = Math.max(0, input.minRequirement - balanceBefore);
      const finalBalanceUrgent = balanceBefore + autoGenUrgent;
      
      // Update running balance for next iteration
      runningBalance = finalBalanceUrgent;
      
      return {
        year: input.year,
        month: input.month,
        balanceBefore,
        autoGenUrgent,
        autoGenSuggested: 0, // Will be calculated separately
        finalBalanceUrgent,
        finalBalanceSuggested: 0, // Will be calculated separately
        minRequirement: input.minRequirement,
        revenue: input.revenue,
        spending: input.spending
      };
    });
  }

  /**
   * Suggested Scenario: Forward-looking smoothing to avoid repeated injections
   * Maintains cumulative deficit and injects earlier to prevent future shortfalls
   */
  static computeSuggested(inputs: ScenarioInput[], startingBalance: number): ScenarioResult[] {
    let runningBalance = startingBalance;
    let cumulativeDeficit = 0;
    
    return inputs.map((input, index) => {
      // Calculate balance before any auto-generated investments
      const balanceBefore = runningBalance + input.revenue - input.spending + input.confirmedInvestments;
      
      // Calculate deficit for this period
      const deficit = Math.max(0, input.minRequirement - balanceBefore);
      
      // Update cumulative deficit
      const previousCumulativeDeficit = cumulativeDeficit;
      cumulativeDeficit = Math.max(0, cumulativeDeficit + deficit);
      
      // Auto-generated investment is the increase in cumulative deficit
      const autoGenSuggested = cumulativeDeficit - previousCumulativeDeficit;
      const finalBalanceSuggested = balanceBefore + autoGenSuggested;
      
      // Update running balance for next iteration
      runningBalance = finalBalanceSuggested;
      
      logDebug(`Suggested scenario calculation for ${input.year}-${input.month}`, {
        metadata: {
          balanceBefore,
          deficit,
          previousCumulativeDeficit,
          cumulativeDeficit,
          autoGenSuggested,
          finalBalanceSuggested,
          minRequirement: input.minRequirement
        }
      });
      
      return {
        year: input.year,
        month: input.month,
        balanceBefore,
        autoGenUrgent: 0, // Will be calculated separately
        autoGenSuggested,
        finalBalanceUrgent: 0, // Will be calculated separately  
        finalBalanceSuggested,
        minRequirement: input.minRequirement,
        revenue: input.revenue,
        spending: input.spending
      };
    });
  }

  /**
   * Compute both urgent and suggested scenarios
   */
  static computeAllScenarios(inputs: ScenarioInput[], startingBalance: number): ScenarioResult[] {
    const urgentResults = this.computeUrgent(inputs, startingBalance);
    const suggestedResults = this.computeSuggested(inputs, startingBalance);
    
    // Merge results
    return urgentResults.map((urgent, index) => {
      const suggested = suggestedResults[index];
      return {
        ...urgent,
        autoGenSuggested: suggested.autoGenSuggested,
        finalBalanceSuggested: suggested.finalBalanceSuggested
      };
    });
  }
}