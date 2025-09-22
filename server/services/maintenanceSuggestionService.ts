/**
 * Maintenance Suggestion Service
 * 
 * Smart evaluation suggestion algorithm for Quebec building maintenance
 * Implements risk-based scoring with seasonal adjustments for maintenance planning
 */

import { db } from '../db';
import { eq, and, or, isNull, inArray, desc, asc, sql, not } from 'drizzle-orm';
import { 
  buildingElements,
  elementHistory,
  evaluationSuggestions,
  maintenanceProjects,
  uniformatCodes,
  type BuildingElement,
  type ElementHistory,
  type EvaluationSuggestion,
  type InsertEvaluationSuggestion,
} from '@shared/schemas/maintenance';
import { UNIFORMAT_CATALOG } from '@shared/data/uniformat-catalog';

// Types for service inputs and outputs
interface EffectiveLifeData {
  effectiveInstallDate: Date;
  effectiveLifespan: number;
  effectiveAgeYears: number;
  remainingLifeYears: number;
}

interface RiskScoreData {
  ageRatio: number;
  conditionFactor: number;
  exposureFactor: number;
  riskScore: number;
}

interface SuggestionData {
  type: 'inspection' | 'minor_rehab' | 'major_rehab' | 'replacement';
  priority: 'low' | 'medium' | 'high' | 'critical';
  suggestedDate: Date;
  reason: string;
}

interface GenerationResult {
  created: number;
  updated: number;
  skipped: number;
  sampleSuggestions: Array<{
    elementName: string;
    uniformatCode: string;
    type: string;
    priority: string;
    suggestedDate: string;
    reason: string;
  }>;
  errors: string[];
}

/**
 * Main Maintenance Suggestion Service Class
 */
export class MaintenanceSuggestionService {
  
  /**
   * Generate suggestions for all elements in a building
   */
  async generateForBuilding(
    buildingId: string, 
    options: { 
      dryRun?: boolean; 
      limit?: number;
      forceRegeneration?: boolean;
    } = {}
  ): Promise<GenerationResult> {
    console.log(`🔧 Generating maintenance suggestions for building ${buildingId}`);
    
    const result: GenerationResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      sampleSuggestions: [],
      errors: []
    };

    try {
      // Get all active building elements
      const elements = await db
        .select()
        .from(buildingElements)
        .where(and(
          eq(buildingElements.buildingId, buildingId),
          eq(buildingElements.isActive, true)
        ))
        .limit(options.limit || 1000);

      console.log(`📋 Found ${elements.length} active elements to evaluate`);

      // Get existing suggestions for deduplication
      const elementIds = elements.map(e => e.id);
      const existingSuggestions = elementIds.length > 0 ? await db
        .select()
        .from(evaluationSuggestions)
        .where(
          inArray(evaluationSuggestions.elementId, elementIds)
        ) : [];

      // Batch load element history for all elements
      const allHistory = elementIds.length > 0 ? await db
        .select()
        .from(elementHistory)
        .where(inArray(elementHistory.elementId, elementIds))
        .orderBy(desc(elementHistory.eventDate)) : [];
      
      const historyByElement = new Map<string, ElementHistory[]>();
      allHistory.forEach(h => {
        if (!historyByElement.has(h.elementId)) {
          historyByElement.set(h.elementId, []);
        }
        historyByElement.get(h.elementId)!.push(h);
      });

      // Batch check for active projects
      const activeProjectElements = elementIds.length > 0 ? await db
        .select({ elementId: sql`project_elements.element_id` })
        .from(maintenanceProjects)
        .innerJoin(sql`project_elements`, sql`maintenance_projects.id = project_elements.project_id`)
        .where(and(
          inArray(sql`project_elements.element_id`, elementIds),
          not(eq(maintenanceProjects.status, 'completed'))
        )) : [];
      
      const activeProjectElementIds = new Set(activeProjectElements.map(p => p.elementId));

      const suggestionsByElement = new Map<string, EvaluationSuggestion[]>();
      existingSuggestions.forEach(s => {
        if (!suggestionsByElement.has(s.elementId)) {
          suggestionsByElement.set(s.elementId, []);
        }
        suggestionsByElement.get(s.elementId)!.push(s);
      });

      // Process each element
      for (const element of elements) {
        try {
          const suggestions = await this.processElement(
            element,
            suggestionsByElement.get(element.id) || [],
            historyByElement.get(element.id) || [],
            activeProjectElementIds.has(element.id),
            options
          );

          // Apply processing results
          result.created += suggestions.created;
          result.updated += suggestions.updated;
          result.skipped += suggestions.skipped;
          
          if (suggestions.sample) {
            result.sampleSuggestions.push(suggestions.sample);
          }
          
          if (suggestions.errors.length > 0) {
            result.errors.push(...suggestions.errors);
          }

        } catch (elementError: any) {
          console.error(`❌ Error processing element ${element.id}:`, elementError);
          result.errors.push(`Element ${element.name}: ${elementError.message}`);
        }
      }

      console.log(`✅ Generation completed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
      return result;

    } catch (error: any) {
      console.error(`❌ Critical error generating suggestions for building ${buildingId}:`, error);
      result.errors.push(`Critical error: ${error.message}`);
      return result;
    }
  }

  /**
   * Process a single building element
   */
  private async processElement(
    element: BuildingElement,
    existingSuggestions: EvaluationSuggestion[],
    elementHistory: ElementHistory[],
    hasActiveProject: boolean,
    options: { dryRun?: boolean; forceRegeneration?: boolean } = {}
  ): Promise<{
    created: number;
    updated: number; 
    skipped: number;
    sample?: any;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // Skip elements already linked to active projects unless forcing regeneration
      if (!options.forceRegeneration && hasActiveProject) {
        return { created: 0, updated: 0, skipped: 1, errors };
      }
      
      // Get UNIFORMAT data for exposure factors
      const uniformatData = UNIFORMAT_CATALOG.find(u => u.code === element.uniformatCode);
      if (!uniformatData) {
        errors.push(`UNIFORMAT code ${element.uniformatCode} not found in catalog`);
        return { created: 0, updated: 0, skipped: 1, errors };
      }

      // Calculate effective life data
      const effectiveLife = this.computeEffectiveLife(element, elementHistory, uniformatData);
      
      // Calculate risk score
      const riskData = this.computeRisk(element, uniformatData, effectiveLife);
      
      // Determine suggestion type and priority
      const suggestion = this.pickSuggestion(element, riskData, effectiveLife);
      
      // Apply Quebec seasonal adjustments
      const adjustedDate = this.seasonShift(suggestion.suggestedDate, element.uniformatCode, suggestion.type);
      suggestion.suggestedDate = adjustedDate;

      // Apply deduplication logic
      const dedupeResult = this.dedupeLogic(element, suggestion, existingSuggestions);
      
      if (dedupeResult.action === 'skip') {
        return { created: 0, updated: 0, skipped: 1, errors };
      }

      // Create sample data for response
      const sample = {
        elementName: element.name,
        uniformatCode: element.uniformatCode,
        type: suggestion.type,
        priority: suggestion.priority,
        suggestedDate: suggestion.suggestedDate.toISOString().split('T')[0],
        reason: suggestion.reason
      };

      // If dry run, don't actually create/update
      if (options.dryRun) {
        return {
          created: dedupeResult.action === 'create' ? 1 : 0,
          updated: dedupeResult.action === 'update' ? 1 : 0,
          skipped: 0,
          sample,
          errors
        };
      }

      // Execute the action
      if (dedupeResult.action === 'create') {
        await this.createSuggestion(element.id, suggestion);
        return { created: 1, updated: 0, skipped: 0, sample, errors };
      } else if (dedupeResult.action === 'update' && dedupeResult.existingId) {
        await this.updateSuggestion(dedupeResult.existingId, suggestion);
        return { created: 0, updated: 1, skipped: 0, sample, errors };
      }

      return { created: 0, updated: 0, skipped: 1, errors };

    } catch (error: any) {
      errors.push(error.message);
      return { created: 0, updated: 0, skipped: 1, errors };
    }
  }

  /**
   * Compute effective life data based on element and history
   */
  computeEffectiveLife(element: BuildingElement, history: ElementHistory[], uniformatData: any): EffectiveLifeData {
    const now = new Date();
    
    // Find the latest major intervention (major_rehab or replacement)
    const majorInterventions = history
      .filter(h => ['major_rehab', 'replacement'].includes(h.eventType))
      .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());

    // Determine effective install date
    let effectiveInstallDate: Date;
    if (majorInterventions.length > 0) {
      effectiveInstallDate = new Date(majorInterventions[0].eventDate);
    } else if (element.originalConstructionDate) {
      effectiveInstallDate = new Date(element.originalConstructionDate);
    } else {
      // Fallback to 20 years ago if no data available
      effectiveInstallDate = new Date(now.getFullYear() - 20, 0, 1);
    }

    // Calculate effective lifespan with UNIFORMAT catalog fallback
    let effectiveLifespan = element.currentLifespan || element.originalLifespan || uniformatData.typicalLifespan || 25;
    
    // Apply lifespan impact from interventions
    history.forEach(intervention => {
      if (intervention.lifespanImpact && intervention.lifespanImpact > 0) {
        effectiveLifespan += intervention.lifespanImpact;
      }
    });

    // Calculate effective age and remaining life
    const effectiveAgeYears = (now.getTime() - effectiveInstallDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    const remainingLifeYears = Math.max(0, effectiveLifespan - effectiveAgeYears);

    return {
      effectiveInstallDate,
      effectiveLifespan,
      effectiveAgeYears,
      remainingLifeYears
    };
  }

  /**
   * Compute risk score based on age, condition, and exposure factors
   */
  computeRisk(element: BuildingElement, uniformatData: any, effectiveLife: EffectiveLifeData): RiskScoreData {
    // Age ratio (bounded 0 to >1)
    const ageRatio = Math.max(0, effectiveLife.effectiveAgeYears / effectiveLife.effectiveLifespan);

    // Condition factor mapping
    const conditionFactors = {
      'excellent': 0.0,
      'good': 0.25,
      'fair': 0.5,
      'poor': 0.75,
      'critical': 1.0
    };
    const conditionFactor = conditionFactors[element.currentCondition] || 0.5;

    // Exposure factor based on UNIFORMAT code
    let exposureFactor = 1.0; // Default for services D*
    const code = element.uniformatCode;

    if (code.startsWith('B30')) { // Roofing
      exposureFactor = 1.2;
    } else if (code.startsWith('B20')) { // Exterior enclosure
      exposureFactor = 1.2;
    } else if (code.startsWith('G')) { // Sitework
      exposureFactor = 1.2;
    } else if (code.startsWith('C')) { // Interiors
      exposureFactor = 0.9;
    } else if (code.startsWith('D20')) { // Plumbing - winter risk (covers D2010, D2020, etc.)
      exposureFactor = 1.1;
    }

    // Quebec winter adjustment (additional 0.1 for exterior elements during winter months)
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const isWinter = currentMonth >= 11 || currentMonth <= 2; // Dec, Jan, Feb
    
    if (isWinter && (code.startsWith('B') || code.startsWith('G'))) {
      exposureFactor += 0.1;
    }

    // Calculate final risk score: 60% age, 30% condition, 10% exposure
    const rawRiskScore = (0.6 * ageRatio) + (0.3 * conditionFactor) + (0.1 * exposureFactor);
    const riskScore = Math.min(1.0, Math.max(0.0, rawRiskScore)); // Clamp to [0,1]

    return {
      ageRatio,
      conditionFactor,
      exposureFactor,
      riskScore
    };
  }

  /**
   * Determine suggestion type and priority based on risk score and conditions
   */
  pickSuggestion(element: BuildingElement, riskData: RiskScoreData, effectiveLife: EffectiveLifeData): SuggestionData {
    const { riskScore, ageRatio } = riskData;
    const { remainingLifeYears } = effectiveLife;
    const now = new Date();

    // Check for inspection needs (no inspection in 12+ months)
    const needsInspection = !element.lastInspectionDate || 
      (now.getTime() - new Date(element.lastInspectionDate).getTime()) > (365 * 24 * 60 * 60 * 1000);

    let type: 'inspection' | 'minor_rehab' | 'major_rehab' | 'replacement';
    let priority: 'low' | 'medium' | 'high' | 'critical';
    let suggestedDate = new Date();

    // Replacement logic
    if (element.currentCondition === 'critical' || remainingLifeYears <= 0) {
      type = 'replacement';
      priority = 'critical';
      suggestedDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
    }
    // Major rehab logic  
    else if (element.currentCondition === 'poor' || ageRatio >= 0.9) {
      type = 'major_rehab';
      priority = 'high';
      suggestedDate = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000)); // 90 days
    }
    // Minor rehab logic
    else if (element.currentCondition === 'fair' || (ageRatio >= 0.7 && ageRatio < 0.9)) {
      type = 'minor_rehab';
      priority = 'medium';
      suggestedDate = new Date(now.getTime() + (180 * 24 * 60 * 60 * 1000)); // 180 days
    }
    // Inspection logic
    else if (needsInspection || (ageRatio >= 0.5 && ageRatio < 0.7)) {
      type = 'inspection';
      priority = ageRatio >= 0.6 ? 'medium' : 'low';
      suggestedDate = new Date(now.getTime() + (60 * 24 * 60 * 60 * 1000)); // 60 days
    }
    // Default inspection
    else {
      type = 'inspection';
      priority = 'low';
      suggestedDate = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year
    }

    // Override priority based on final risk score
    if (riskScore >= 0.85) {
      priority = 'critical';
    } else if (riskScore >= 0.7) {
      priority = 'high';
    } else if (riskScore >= 0.5) {
      priority = 'medium';
    } else if (type !== 'inspection') {
      priority = 'low';
    }

    // Build detailed reason
    const reason = this.buildReasonText(element, riskData, effectiveLife, type, needsInspection);

    return {
      type,
      priority,
      suggestedDate,
      reason
    };
  }

  /**
   * Apply Quebec seasonal adjustments for work scheduling
   */
  seasonShift(suggestedDate: Date, uniformatCode: string, suggestionType: string): Date {
    const month = suggestedDate.getMonth(); // 0-11
    const isWinter = month >= 11 || month <= 2; // Dec, Jan, Feb, Mar
    const isPhysicalWork = ['major_rehab', 'replacement'].includes(suggestionType);

    if (!isWinter || !isPhysicalWork) {
      return suggestedDate;
    }

    // Determine if exterior/sitework or interior/services
    const isExteriorSitework = uniformatCode.startsWith('B') || uniformatCode.startsWith('G');
    
    // Calculate next appropriate season
    const year = suggestedDate.getFullYear();
    const today = new Date();
    let adjustedDate: Date;
    
    if (isExteriorSitework) {
      // Shift to next May 1st for exterior/sitework
      const nextMay = new Date(year, 4, 1); // May 1st of current year
      if (nextMay <= today) {
        // If May 1st has already passed this year, use next year's May 1st
        adjustedDate = new Date(year + 1, 4, 1);
      } else {
        adjustedDate = nextMay;
      }
    } else {
      // Shift to next March 1st for interior/services
      const nextMarch = new Date(year, 2, 1); // March 1st of current year
      if (nextMarch <= today) {
        // If March 1st has already passed this year, use next year's March 1st
        adjustedDate = new Date(year + 1, 2, 1);
      } else {
        adjustedDate = nextMarch;
      }
    }

    console.log(`📅 Seasonal shift applied: ${suggestedDate.toISOString().split('T')[0]} → ${adjustedDate.toISOString().split('T')[0]} for ${uniformatCode}`);
    return adjustedDate;
  }

  /**
   * Apply deduplication logic to prevent duplicate suggestions
   * Enhanced to handle Quebec seasonal compliance and date changes
   */
  dedupeLogic(
    element: BuildingElement,
    newSuggestion: SuggestionData,
    existingSuggestions: EvaluationSuggestion[]
  ): { action: 'create' | 'update' | 'skip'; existingId?: string } {
    
    // Filter to active suggestions only
    const activeSuggestions = existingSuggestions.filter(s => 
      !['completed', 'dismissed'].includes(s.status)
    );

    if (activeSuggestions.length === 0) {
      return { action: 'create' };
    }

    // Find matching suggestions by type
    const matchingSuggestions = activeSuggestions.filter(s => s.suggestedType === newSuggestion.type);
    
    if (matchingSuggestions.length === 0) {
      return { action: 'create' };
    }

    // Check if we should update based on priority escalation or condition worsening
    const highestExisting = matchingSuggestions.reduce((highest, current) => {
      const priorityOrder = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
      const currentLevel = priorityOrder[current.priority as keyof typeof priorityOrder] || 1;
      const highestLevel = priorityOrder[highest.priority as keyof typeof priorityOrder] || 1;
      return currentLevel > highestLevel ? current : highest;
    }, matchingSuggestions[0]);

    const priorityOrder = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
    const newPriorityLevel = priorityOrder[newSuggestion.priority];
    const existingPriorityLevel = priorityOrder[highestExisting.priority as keyof typeof priorityOrder] || 1;

    // ENHANCED LOGIC: Check for multiple update conditions
    
    // 1. Priority escalation (existing logic)
    const hasPriorityEscalation = newPriorityLevel > existingPriorityLevel;
    
    // 2. Date difference check (≥1 day difference)
    const existingDate = new Date(highestExisting.suggestedDate);
    const newDate = newSuggestion.suggestedDate;
    const dateDiffMs = Math.abs(newDate.getTime() - existingDate.getTime());
    const dateDiffDays = dateDiffMs / (1000 * 60 * 60 * 24);
    const hasSignificantDateChange = dateDiffDays >= 1;
    
    // 3. Quebec seasonal compliance check
    const hasSeasonalViolation = this.checkQuebecSeasonalViolation(
      highestExisting.suggestedDate, 
      element.uniformatCode, 
      newSuggestion.type
    );
    
    // 4. Season change detection
    const hasSeasonChange = this.hasSeasonChanged(
      existingDate, 
      newDate, 
      element.uniformatCode, 
      newSuggestion.type
    );

    // Update if any of these conditions are met:
    if (hasPriorityEscalation || hasSignificantDateChange || hasSeasonalViolation || hasSeasonChange) {
      
      // Log the reasons for update
      const updateReasons = [];
      if (hasPriorityEscalation) updateReasons.push('priority escalation');
      if (hasSignificantDateChange) updateReasons.push(`date change (${dateDiffDays.toFixed(1)} days)`);
      if (hasSeasonalViolation) updateReasons.push('Quebec seasonal compliance violation');
      if (hasSeasonChange) updateReasons.push('seasonal shift change');
      
      console.log(`🔄 Updating suggestion for element ${element.name} due to: ${updateReasons.join(', ')}`);
      console.log(`   → Date change: ${existingDate.toISOString().split('T')[0]} → ${newDate.toISOString().split('T')[0]}`);
      
      return { action: 'update', existingId: highestExisting.id };
    }

    // Skip - no significant change warranted
    return { action: 'skip' };
  }

  /**
   * Check if existing suggestion date violates Quebec seasonal requirements
   */
  private checkQuebecSeasonalViolation(
    existingDateStr: string, 
    uniformatCode: string, 
    suggestionType: string
  ): boolean {
    const existingDate = new Date(existingDateStr);
    const month = existingDate.getMonth(); // 0-11
    const isWinter = month >= 11 || month <= 2; // Dec, Jan, Feb, Mar
    const isPhysicalWork = ['major_rehab', 'replacement'].includes(suggestionType);
    
    // If it's physical work scheduled in winter months, it's a violation
    return isWinter && isPhysicalWork;
  }

  /**
   * Check if the season has changed between existing and new dates
   */
  private hasSeasonChanged(
    existingDate: Date, 
    newDate: Date, 
    uniformatCode: string, 
    suggestionType: string
  ): boolean {
    const isPhysicalWork = ['major_rehab', 'replacement'].includes(suggestionType);
    
    if (!isPhysicalWork) {
      return false; // Season changes only matter for physical work
    }
    
    // Determine if exterior/sitework or interior/services
    const isExteriorSitework = uniformatCode.startsWith('B') || uniformatCode.startsWith('G');
    
    // Get the target seasonal dates for both existing and new dates
    const existingSeasonalDate = this.getTargetSeasonalDate(existingDate, isExteriorSitework);
    const newSeasonalDate = this.getTargetSeasonalDate(newDate, isExteriorSitework);
    
    // Check if the target seasonal dates are different
    return existingSeasonalDate.getTime() !== newSeasonalDate.getTime();
  }

  /**
   * Get the target seasonal date for a given date
   */
  private getTargetSeasonalDate(date: Date, isExteriorSitework: boolean): Date {
    const year = date.getFullYear();
    const today = new Date();
    
    if (isExteriorSitework) {
      // Target May 1st for exterior/sitework
      const mayDate = new Date(year, 4, 1); // May 1st
      if (mayDate <= today) {
        return new Date(year + 1, 4, 1); // Next year's May 1st
      }
      return mayDate;
    } else {
      // Target March 1st for interior/services  
      const marchDate = new Date(year, 2, 1); // March 1st
      if (marchDate <= today) {
        return new Date(year + 1, 2, 1); // Next year's March 1st
      }
      return marchDate;
    }
  }

  /**
   * Build detailed reason text with calculation details
   */
  private buildReasonText(
    element: BuildingElement,
    riskData: RiskScoreData,
    effectiveLife: EffectiveLifeData,
    type: string,
    needsInspection: boolean
  ): string {
    const { ageRatio, conditionFactor, exposureFactor, riskScore } = riskData;
    const { effectiveAgeYears, remainingLifeYears } = effectiveLife;

    let reason = `Risk Score: ${(riskScore * 100).toFixed(1)}% | `;
    reason += `Age: ${effectiveAgeYears.toFixed(1)}/${effectiveLife.effectiveLifespan} years (${(ageRatio * 100).toFixed(1)}%) | `;
    reason += `Condition: ${element.currentCondition} (${(conditionFactor * 100).toFixed(0)}%) | `;
    reason += `Exposure: ${(exposureFactor * 100).toFixed(0)}% | `;
    reason += `Remaining Life: ${remainingLifeYears.toFixed(1)} years`;

    // Add specific triggers
    if (type === 'replacement') {
      if (element.currentCondition === 'critical') {
        reason += ' | TRIGGER: Critical condition requires immediate replacement';
      } else if (remainingLifeYears <= 0) {
        reason += ' | TRIGGER: End of service life reached';
      }
    } else if (type === 'major_rehab') {
      if (element.currentCondition === 'poor') {
        reason += ' | TRIGGER: Poor condition requires major rehabilitation';
      } else if (ageRatio >= 0.9) {
        reason += ' | TRIGGER: Age ratio exceeds 90%';
      }
    } else if (type === 'minor_rehab') {
      if (element.currentCondition === 'fair') {
        reason += ' | TRIGGER: Fair condition suggests preventive rehabilitation';
      } else {
        reason += ' | TRIGGER: Age-based preventive maintenance window';
      }
    } else if (type === 'inspection') {
      if (needsInspection) {
        reason += ' | TRIGGER: No inspection in past 12 months';
      } else {
        reason += ' | TRIGGER: Routine inspection based on age and risk';
      }
    }

    return reason;
  }

  /**
   * Helper method to get element history (now unused - replaced with batch loading)
   * @deprecated Use batch loading in generateForBuilding instead
   */
  private async getElementHistory(elementId: string): Promise<ElementHistory[]> {
    return await db
      .select()
      .from(elementHistory)
      .where(eq(elementHistory.elementId, elementId))
      .orderBy(desc(elementHistory.eventDate));
  }

  /**
   * Check if element has active maintenance project (now unused - replaced with batch loading)
   * @deprecated Use batch loading in generateForBuilding instead
   */
  private async hasActiveProject(elementId: string): Promise<boolean> {
    const activeProjects = await db
      .select({ id: maintenanceProjects.id })
      .from(maintenanceProjects)
      .innerJoin(sql`project_elements`, sql`maintenance_projects.id = project_elements.project_id`)
      .where(and(
        sql`project_elements.element_id = ${elementId}`,
        not(inArray(maintenanceProjects.status, ['completed', 'cancelled']))
      ))
      .limit(1);

    return activeProjects.length > 0;
  }

  /**
   * Create new suggestion in database
   */
  private async createSuggestion(elementId: string, suggestion: SuggestionData): Promise<void> {
    const suggestionData: InsertEvaluationSuggestion = {
      elementId,
      suggestedDate: suggestion.suggestedDate.toISOString().split('T')[0], // Convert Date to string (YYYY-MM-DD)
      suggestedType: suggestion.type,
      priority: suggestion.priority,
      reason: suggestion.reason,
      status: 'pending'
    };

    await db.insert(evaluationSuggestions).values(suggestionData);
  }

  /**
   * Update existing suggestion in database
   */
  private async updateSuggestion(suggestionId: string, suggestion: SuggestionData): Promise<void> {
    await db
      .update(evaluationSuggestions)
      .set({
        suggestedDate: suggestion.suggestedDate.toISOString().split('T')[0], // Convert Date to string (YYYY-MM-DD)
        suggestedType: suggestion.type,
        priority: suggestion.priority,
        reason: suggestion.reason,
        updatedAt: new Date()
      })
      .where(eq(evaluationSuggestions.id, suggestionId));
  }
}

// Export singleton instance
export const maintenanceSuggestionService = new MaintenanceSuggestionService();