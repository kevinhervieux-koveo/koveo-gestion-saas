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
  title: string;
  description: string;
}

// Explicit condition/age/risk matrices for project type determination
interface ProjectTypeMatrix {
  condition: string;
  ageRatioMin: number;
  ageRatioMax: number;
  riskScoreMin: number;
  riskScoreMax: number;
  projectType: 'inspection' | 'minor_rehab' | 'major_rehab' | 'replacement';
  priority: 'low' | 'medium' | 'high' | 'critical';
  daysOffset: number;
  title: string;
  description: string;
}

// Staged escalation rules for generating multiple interventions
interface EscalationStage {
  stageOrder: number;
  triggerAgeRatio: number;
  projectType: 'inspection' | 'minor_rehab' | 'major_rehab' | 'replacement';
  daysFromNow: number;
  prerequisiteTypes?: string[];
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
 * Redesigned to create diverse project types with explicit matrices and staged escalation
 */
export class MaintenanceSuggestionService {
  
  // Explicit condition/age/risk → project type matrices
  private readonly PROJECT_TYPE_MATRICES: ProjectTypeMatrix[] = [
    // CRITICAL CONDITION - Immediate replacement needed
    {
      condition: 'critical',
      ageRatioMin: 0,
      ageRatioMax: 2,
      riskScoreMin: 0,
      riskScoreMax: 1,
      projectType: 'replacement',
      priority: 'critical',
      daysOffset: 15,
      title: 'Emergency Replacement Required',
      description: 'Element is in critical condition and poses safety/operational risks. Immediate replacement needed.'
    },
    
    // POOR CONDITION matrices
    {
      condition: 'poor',
      ageRatioMin: 0.9,
      ageRatioMax: 2,
      riskScoreMin: 0,
      riskScoreMax: 1,
      projectType: 'replacement',
      priority: 'high',
      daysOffset: 60,
      title: 'End-of-Life Replacement',
      description: 'Element has reached end of useful life and requires full replacement to maintain functionality.'
    },
    {
      condition: 'poor',
      ageRatioMin: 0.7,
      ageRatioMax: 0.9,
      riskScoreMin: 0,
      riskScoreMax: 1,
      projectType: 'major_rehab',
      priority: 'high',
      daysOffset: 90,
      title: 'Major Rehabilitation Required',
      description: 'Significant deterioration requires comprehensive restoration to extend service life.'
    },
    {
      condition: 'poor',
      ageRatioMin: 0,
      ageRatioMax: 0.7,
      riskScoreMin: 0,
      riskScoreMax: 1,
      projectType: 'major_rehab',
      priority: 'medium',
      daysOffset: 120,
      title: 'Extensive Restoration Needed',
      description: 'Poor condition despite relatively low age indicates need for major rehabilitation.'
    },
    
    // FAIR CONDITION matrices
    {
      condition: 'fair',
      ageRatioMin: 0.8,
      ageRatioMax: 2,
      riskScoreMin: 0,
      riskScoreMax: 1,
      projectType: 'major_rehab',
      priority: 'medium',
      daysOffset: 180,
      title: 'Preventive Major Rehabilitation',
      description: 'Advanced age with fair condition suggests need for comprehensive restoration before further decline.'
    },
    {
      condition: 'fair',
      ageRatioMin: 0.6,
      ageRatioMax: 0.8,
      riskScoreMin: 0,
      riskScoreMax: 1,
      projectType: 'minor_rehab',
      priority: 'medium',
      daysOffset: 120,
      title: 'Targeted Repair and Renewal',
      description: 'Selective repairs and improvements needed to prevent further deterioration.'
    },
    {
      condition: 'fair',
      ageRatioMin: 0,
      ageRatioMax: 0.6,
      riskScoreMin: 0,
      riskScoreMax: 1,
      projectType: 'minor_rehab',
      priority: 'low',
      daysOffset: 180,
      title: 'Early Intervention Repairs',
      description: 'Address specific issues to maintain functionality and prevent premature aging.'
    },
    
    // GOOD CONDITION matrices
    {
      condition: 'good',
      ageRatioMin: 0.8,
      ageRatioMax: 2,
      riskScoreMin: 0,
      riskScoreMax: 1,
      projectType: 'minor_rehab',
      priority: 'low',
      daysOffset: 365,
      title: 'Preventive Maintenance Upgrade',
      description: 'Proactive improvements to extend service life as element approaches maturity.'
    },
    {
      condition: 'good',
      ageRatioMin: 0.5,
      ageRatioMax: 0.8,
      riskScoreMin: 0,
      riskScoreMax: 1,
      projectType: 'inspection',
      priority: 'medium',
      daysOffset: 180,
      title: 'Mid-Life Assessment',
      description: 'Comprehensive inspection to assess condition and plan future maintenance needs.'
    },
    {
      condition: 'good',
      ageRatioMin: 0,
      ageRatioMax: 0.5,
      riskScoreMin: 0,
      riskScoreMax: 1,
      projectType: 'inspection',
      priority: 'low',
      daysOffset: 365,
      title: 'Routine Condition Assessment',
      description: 'Standard inspection to document current condition and verify performance.'
    },
    
    // EXCELLENT CONDITION matrices
    {
      condition: 'excellent',
      ageRatioMin: 0.7,
      ageRatioMax: 2,
      riskScoreMin: 0,
      riskScoreMax: 1,
      projectType: 'inspection',
      priority: 'low',
      daysOffset: 365,
      title: 'Aging Element Monitoring',
      description: 'Monitor excellent condition element as it approaches design life for early intervention planning.'
    },
    {
      condition: 'excellent',
      ageRatioMin: 0,
      ageRatioMax: 0.7,
      riskScoreMin: 0,
      riskScoreMax: 1,
      projectType: 'inspection',
      priority: 'low',
      daysOffset: 730,
      title: 'Performance Verification',
      description: 'Verify continued excellent performance and document baseline condition.'
    }
  ];
  
  // Staged escalation rules for generating multiple interventions over time
  private readonly ESCALATION_STAGES: EscalationStage[] = [
    {
      stageOrder: 1,
      triggerAgeRatio: 0.4,
      projectType: 'inspection',
      daysFromNow: 30,
      prerequisiteTypes: []
    },
    {
      stageOrder: 2,
      triggerAgeRatio: 0.6,
      projectType: 'minor_rehab',
      daysFromNow: 180,
      prerequisiteTypes: ['inspection']
    },
    {
      stageOrder: 3,
      triggerAgeRatio: 0.8,
      projectType: 'major_rehab',
      daysFromNow: 365,
      prerequisiteTypes: ['inspection', 'minor_rehab']
    },
    {
      stageOrder: 4,
      triggerAgeRatio: 1.0,
      projectType: 'replacement',
      daysFromNow: 730,
      prerequisiteTypes: ['inspection', 'minor_rehab', 'major_rehab']
    }
  ];
  
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
      
      // Generate multiple suggestions using staged escalation model
      const suggestions = this.generateStagedSuggestions(element, riskData, effectiveLife);
      
      // Apply Quebec seasonal adjustments to all suggestions
      suggestions.forEach(suggestion => {
        const adjustedDate = this.seasonShift(suggestion.suggestedDate, element.uniformatCode, suggestion.type);
        suggestion.suggestedDate = adjustedDate;
      });

      // Process each suggestion through updated deduplication logic
      let processedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let sampleSuggestion = null;
      
      for (const suggestion of suggestions) {
        const dedupeResult = this.dedupeLogic(element, suggestion, existingSuggestions);
      
        if (dedupeResult.action === 'skip') {
          skippedCount++;
          continue;
        }

        // Create sample data for first processed suggestion
        if (!sampleSuggestion) {
          sampleSuggestion = {
            elementName: element.name,
            uniformatCode: element.uniformatCode,
            type: suggestion.type,
            priority: suggestion.priority,
            suggestedDate: suggestion.suggestedDate.toISOString().split('T')[0],
            reason: suggestion.reason
          };
        }

        // If dry run, don't actually create/update
        if (options.dryRun) {
          if (dedupeResult.action === 'create') processedCount++;
          if (dedupeResult.action === 'update') updatedCount++;
          continue;
        }

        // Execute the action
        if (dedupeResult.action === 'create') {
          await this.createSuggestion(element.id, suggestion);
          processedCount++;
        } else if (dedupeResult.action === 'update' && dedupeResult.existingId) {
          await this.updateSuggestion(dedupeResult.existingId, suggestion);
          updatedCount++;
        }
      }

      return {
        created: processedCount,
        updated: updatedCount,
        skipped: skippedCount,
        sample: sampleSuggestion,
        errors
      };

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
   * Generate multiple staged suggestions based on explicit matrices and escalation model
   */
  generateStagedSuggestions(element: BuildingElement, riskData: RiskScoreData, effectiveLife: EffectiveLifeData): SuggestionData[] {
    const suggestions: SuggestionData[] = [];
    const { ageRatio, riskScore } = riskData;
    const now = new Date();
    
    // Check for inspection needs (no inspection in 12+ months)
    const needsInspection = !element.lastInspectionDate || 
      (now.getTime() - new Date(element.lastInspectionDate).getTime()) > (365 * 24 * 60 * 60 * 1000);
    
    // 1. Find immediate suggestion using explicit matrices
    const immediateSuggestion = this.findMatrixBasedSuggestion(element, riskData, effectiveLife, needsInspection);
    if (immediateSuggestion) {
      suggestions.push(immediateSuggestion);
    }
    
    // 2. Generate staged escalation suggestions if appropriate
    const escalationSuggestions = this.generateEscalationSuggestions(element, riskData, effectiveLife);
    suggestions.push(...escalationSuggestions);
    
    // 3. Add urgent inspection if needed and not already included
    if (needsInspection && !suggestions.some(s => s.type === 'inspection')) {
      const urgentInspection = this.createUrgentInspectionSuggestion(element, riskData, effectiveLife);
      suggestions.unshift(urgentInspection); // Add at beginning for priority
    }
    
    return suggestions;
  }
  
  /**
   * Find suggestion using explicit condition/age/risk matrices
   */
  private findMatrixBasedSuggestion(element: BuildingElement, riskData: RiskScoreData, effectiveLife: EffectiveLifeData, needsInspection: boolean): SuggestionData | null {
    const { ageRatio, riskScore } = riskData;
    
    // Find matching matrix entry
    const matchingMatrix = this.PROJECT_TYPE_MATRICES.find(matrix => {
      return matrix.condition === element.currentCondition &&
             ageRatio >= matrix.ageRatioMin &&
             ageRatio < matrix.ageRatioMax &&
             riskScore >= matrix.riskScoreMin &&
             riskScore <= matrix.riskScoreMax;
    });
    
    if (!matchingMatrix) {
      // Fallback to default inspection if no matrix matches
      return this.createDefaultInspectionSuggestion(element, riskData, effectiveLife);
    }
    
    const now = new Date();
    const suggestedDate = new Date(now.getTime() + (matchingMatrix.daysOffset * 24 * 60 * 60 * 1000));
    
    // Adjust priority based on risk score
    let priority = matchingMatrix.priority;
    if (riskScore >= 0.85) {
      priority = 'critical';
    } else if (riskScore >= 0.7 && priority !== 'critical') {
      priority = 'high';
    }
    
    const reason = this.buildEnhancedReasonText(element, riskData, effectiveLife, matchingMatrix, needsInspection);
    
    return {
      type: matchingMatrix.projectType,
      priority,
      suggestedDate,
      reason,
      title: matchingMatrix.title,
      description: matchingMatrix.description
    };
  }
  
  /**
   * Generate escalation suggestions for future interventions
   */
  private generateEscalationSuggestions(element: BuildingElement, riskData: RiskScoreData, effectiveLife: EffectiveLifeData): SuggestionData[] {
    const { ageRatio } = riskData;
    const suggestions: SuggestionData[] = [];
    const now = new Date();
    
    // Only generate escalation for elements not already at critical condition
    if (element.currentCondition === 'critical') {
      return suggestions;
    }
    
    // Find applicable escalation stages based on current age ratio
    const applicableStages = this.ESCALATION_STAGES.filter(stage => 
      ageRatio < stage.triggerAgeRatio // Only stages not yet reached
    ).sort((a, b) => a.stageOrder - b.stageOrder); // Order by stage sequence
    
    for (const stage of applicableStages) {
      // Calculate when this stage should be triggered
      const yearsToTrigger = (stage.triggerAgeRatio - ageRatio) * effectiveLife.effectiveLifespan;
      const daysToTrigger = Math.max(stage.daysFromNow, yearsToTrigger * 365);
      const suggestedDate = new Date(now.getTime() + (daysToTrigger * 24 * 60 * 60 * 1000));
      
      // Determine priority based on urgency
      let priority: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (daysToTrigger < 90) priority = 'high';
      else if (daysToTrigger < 365) priority = 'medium';
      
      const suggestion: SuggestionData = {
        type: stage.projectType,
        priority,
        suggestedDate,
        reason: `Staged escalation: ${stage.projectType} planned when element reaches ${(stage.triggerAgeRatio * 100).toFixed(0)}% of design life (${(yearsToTrigger).toFixed(1)} years from now)`,
        title: this.getEscalationTitle(stage.projectType, stage.triggerAgeRatio),
        description: this.getEscalationDescription(stage.projectType, yearsToTrigger)
      };
      
      suggestions.push(suggestion);
    }
    
    return suggestions;
  }
  
  /**
   * Create urgent inspection suggestion
   */
  private createUrgentInspectionSuggestion(element: BuildingElement, riskData: RiskScoreData, effectiveLife: EffectiveLifeData): SuggestionData {
    const now = new Date();
    const lastInspection = element.lastInspectionDate ? new Date(element.lastInspectionDate) : null;
    const daysSinceInspection = lastInspection ? (now.getTime() - lastInspection.getTime()) / (1000 * 60 * 60 * 24) : 999;
    
    return {
      type: 'inspection',
      priority: daysSinceInspection > 730 ? 'high' : 'medium',
      suggestedDate: new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)), // 30 days
      reason: `Overdue inspection: Last inspected ${lastInspection ? daysSinceInspection.toFixed(0) + ' days ago' : 'never'}. Required for maintenance planning.`,
      title: 'Overdue Condition Assessment',
      description: `Element requires inspection to assess current condition and update maintenance strategy.`
    };
  }
  
  /**
   * Create default inspection suggestion as fallback
   */
  private createDefaultInspectionSuggestion(element: BuildingElement, riskData: RiskScoreData, effectiveLife: EffectiveLifeData): SuggestionData {
    const now = new Date();
    return {
      type: 'inspection',
      priority: 'low',
      suggestedDate: new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)), // 1 year
      reason: this.buildEnhancedReasonText(element, riskData, effectiveLife, null, false),
      title: 'Standard Condition Assessment',
      description: 'Routine inspection to monitor element condition and performance.'
    };
  }
  
  /**
   * Get escalation title based on project type and trigger ratio
   */
  private getEscalationTitle(projectType: string, triggerRatio: number): string {
    const percentage = (triggerRatio * 100).toFixed(0);
    
    switch (projectType) {
      case 'inspection':
        return `Mid-Life Assessment (${percentage}% Design Life)`;
      case 'minor_rehab':
        return `Preventive Maintenance (${percentage}% Design Life)`;
      case 'major_rehab':
        return `Life Extension Project (${percentage}% Design Life)`;
      case 'replacement':
        return `End-of-Life Replacement (${percentage}% Design Life)`;
      default:
        return `Planned Intervention (${percentage}% Design Life)`;
    }
  }
  
  /**
   * Get escalation description based on project type and years to trigger
   */
  private getEscalationDescription(projectType: string, yearsToTrigger: number): string {
    const yearText = yearsToTrigger.toFixed(1);
    
    switch (projectType) {
      case 'inspection':
        return `Comprehensive assessment planned in ${yearText} years to evaluate condition and update maintenance strategy.`;
      case 'minor_rehab':
        return `Targeted repairs and improvements planned in ${yearText} years to maintain functionality and extend service life.`;
      case 'major_rehab':
        return `Comprehensive restoration planned in ${yearText} years to significantly extend element's useful life.`;
      case 'replacement':
        return `Full replacement planned in ${yearText} years as element approaches end of design life.`;
      default:
        return `Planned maintenance intervention in ${yearText} years based on predictive modeling.`;
    }
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
   * Apply enhanced deduplication logic to support multiple concurrent suggestion types
   * Updated to allow diverse project types per element while preventing true duplicates
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

    // NEW LOGIC: Allow multiple concurrent suggestion types per element
    // Only prevent duplicates of the SAME TYPE with similar dates
    
    // Find suggestions of the same type
    const sameTypeSuggestions = activeSuggestions.filter(s => s.suggestedType === newSuggestion.type);
    
    if (sameTypeSuggestions.length === 0) {
      // No existing suggestions of this type - always create
      console.log(`✅ Creating new ${newSuggestion.type} suggestion for ${element.name} - no existing suggestions of this type`);
      return { action: 'create' };
    }

    // For same-type suggestions, check if update is warranted
    const candidateForUpdate = sameTypeSuggestions.reduce((best, current) => {
      // Prefer the most recent or highest priority suggestion
      const priorityOrder = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
      const currentLevel = priorityOrder[current.priority as keyof typeof priorityOrder] || 1;
      const bestLevel = priorityOrder[best.priority as keyof typeof priorityOrder] || 1;
      
      if (currentLevel > bestLevel) return current;
      if (currentLevel < bestLevel) return best;
      
      // Same priority - prefer more recent
      return new Date(current.createdAt || 0) > new Date(best.createdAt || 0) ? current : best;
    }, sameTypeSuggestions[0]);

    const priorityOrder = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
    const newPriorityLevel = priorityOrder[newSuggestion.priority];
    const existingPriorityLevel = priorityOrder[candidateForUpdate.priority as keyof typeof priorityOrder] || 1;

    // Check for update conditions
    const existingDate = new Date(candidateForUpdate.suggestedDate);
    const newDate = newSuggestion.suggestedDate;
    const dateDiffMs = Math.abs(newDate.getTime() - existingDate.getTime());
    const dateDiffDays = dateDiffMs / (1000 * 60 * 60 * 24);
    
    // Update conditions (more permissive for staged escalation)
    const hasPriorityEscalation = newPriorityLevel > existingPriorityLevel;
    const hasSignificantDateChange = dateDiffDays >= 7; // Increased to 7 days to reduce noise
    const hasSeasonalViolation = this.checkQuebecSeasonalViolation(
      candidateForUpdate.suggestedDate, 
      element.uniformatCode, 
      newSuggestion.type
    );
    const hasSeasonChange = this.hasSeasonChanged(
      existingDate, 
      newDate, 
      element.uniformatCode, 
      newSuggestion.type
    );
    
    // NEW: Check for significant content changes (title/description)
    const hasContentChange = this.hasSignificantContentChange(candidateForUpdate, newSuggestion);

    // Update if any significant changes are detected
    if (hasPriorityEscalation || hasSignificantDateChange || hasSeasonalViolation || hasSeasonChange || hasContentChange) {
      
      const updateReasons = [];
      if (hasPriorityEscalation) updateReasons.push(`priority escalation (${candidateForUpdate.priority} → ${newSuggestion.priority})`);
      if (hasSignificantDateChange) updateReasons.push(`date change (${dateDiffDays.toFixed(1)} days)`);
      if (hasSeasonalViolation) updateReasons.push('Quebec seasonal compliance');
      if (hasSeasonChange) updateReasons.push('seasonal shift');
      if (hasContentChange) updateReasons.push('content update');
      
      console.log(`🔄 Updating ${newSuggestion.type} suggestion for ${element.name}: ${updateReasons.join(', ')}`);
      
      return { action: 'update', existingId: candidateForUpdate.id };
    }

    // Check for near-duplicate detection (same type, similar date, similar priority)
    const isNearDuplicate = dateDiffDays < 7 && Math.abs(newPriorityLevel - existingPriorityLevel) <= 1;
    
    if (isNearDuplicate) {
      console.log(`⏭️  Skipping ${newSuggestion.type} suggestion for ${element.name} - near-duplicate detected`);
      return { action: 'skip' };
    }

    // Default to create for staged escalation scenarios
    console.log(`✅ Creating additional ${newSuggestion.type} suggestion for ${element.name} - staged escalation`);
    return { action: 'create' };
  }
  
  /**
   * Check if there are significant content changes between existing and new suggestions
   */
  private hasSignificantContentChange(existing: EvaluationSuggestion, newSuggestion: SuggestionData): boolean {
    // For now, basic check on reason text changes
    // Could be enhanced to check title/description if those fields are added to the database
    if (!existing.reason || !newSuggestion.reason) {
      return true; // If either is missing, consider it a change
    }
    
    // Check for meaningful differences in reason text
    const existingWords = existing.reason.toLowerCase().split(/\s+/);
    const newWords = newSuggestion.reason.toLowerCase().split(/\s+/);
    
    // Simple heuristic: significant change if >30% of words are different
    const commonWords = existingWords.filter(word => newWords.includes(word));
    const similarityRatio = commonWords.length / Math.max(existingWords.length, newWords.length);
    
    return similarityRatio < 0.7; // Less than 70% similarity = significant change
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
   * Build enhanced reason text with calculation details and matrix information
   */
  private buildEnhancedReasonText(
    element: BuildingElement,
    riskData: RiskScoreData,
    effectiveLife: EffectiveLifeData,
    matrix: ProjectTypeMatrix | null,
    needsInspection: boolean
  ): string {
    const { ageRatio, conditionFactor, exposureFactor, riskScore } = riskData;
    const { effectiveAgeYears, remainingLifeYears } = effectiveLife;

    let reason = `Risk Assessment: ${(riskScore * 100).toFixed(1)}% | `;
    reason += `Age: ${effectiveAgeYears.toFixed(1)}/${effectiveLife.effectiveLifespan} years (${(ageRatio * 100).toFixed(1)}%) | `;
    reason += `Condition: ${element.currentCondition} | `;
    reason += `Exposure Factor: ${(exposureFactor * 100).toFixed(0)}% | `;
    reason += `Remaining Life: ${remainingLifeYears.toFixed(1)} years`;

    // Add matrix-based trigger information
    if (matrix) {
      reason += ` | MATRIX: ${matrix.condition}+age(${(matrix.ageRatioMin * 100).toFixed(0)}-${(matrix.ageRatioMax * 100).toFixed(0)}%)`;
    }

    // Add specific triggers based on project type
    if (matrix?.projectType === 'replacement') {
      if (element.currentCondition === 'critical') {
        reason += ' | TRIGGER: Critical condition - safety/operational risk';
      } else if (remainingLifeYears <= 0) {
        reason += ' | TRIGGER: End of design life reached';
      } else {
        reason += ' | TRIGGER: Matrix-based replacement criteria met';
      }
    } else if (matrix?.projectType === 'major_rehab') {
      reason += ' | TRIGGER: Significant rehabilitation needed to extend service life';
    } else if (matrix?.projectType === 'minor_rehab') {
      reason += ' | TRIGGER: Targeted repairs needed to prevent deterioration';
    } else if (matrix?.projectType === 'inspection') {
      if (needsInspection) {
        reason += ' | TRIGGER: Overdue inspection required';
      } else {
        reason += ' | TRIGGER: Scheduled condition assessment';
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
        not(eq(maintenanceProjects.status, 'completed'))
      ))
      .limit(1);

    return activeProjects.length > 0;
  }

  /**
   * Create new suggestion in database with enhanced data
   */
  private async createSuggestion(elementId: string, suggestion: SuggestionData): Promise<void> {
    const suggestionData = {
      elementId,
      suggestedDate: suggestion.suggestedDate.toISOString().split('T')[0], // Convert Date to string (YYYY-MM-DD)
      suggestedType: suggestion.type,
      priority: suggestion.priority,
      reason: suggestion.reason,
      status: 'pending'
    };

    console.log(`💾 Creating ${suggestion.type} suggestion: ${suggestion.title}`);
    await db.insert(evaluationSuggestions).values(suggestionData as any);
  }

  /**
   * Update existing suggestion in database with enhanced data
   */
  private async updateSuggestion(suggestionId: string, suggestion: SuggestionData): Promise<void> {
    console.log(`💾 Updating suggestion: ${suggestion.title}`);
    await db
      .update(evaluationSuggestions)
      .set({
        suggestedDate: suggestion.suggestedDate.toISOString().split('T')[0], // Convert Date to string (YYYY-MM-DD)
        suggestedType: suggestion.type,
        priority: suggestion.priority,
        reason: suggestion.reason,
        updatedAt: new Date()
      } as any)
      .where(eq(evaluationSuggestions.id, suggestionId));
  }
}

// Export singleton instance
export const maintenanceSuggestionService = new MaintenanceSuggestionService();