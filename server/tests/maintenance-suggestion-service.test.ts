/**
 * Unit tests for Maintenance Suggestion Service
 * Tests the core scoring algorithms and business logic
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

// Mock the database module
jest.mock('../db', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    and: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    inArray: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  }
}));

// Import the service after mocking
import { MaintenanceSuggestionService } from '../services/maintenanceSuggestionService';

describe('MaintenanceSuggestionService', () => {
  let service: MaintenanceSuggestionService;

  beforeEach(() => {
    service = new MaintenanceSuggestionService();
  });

  describe('Risk Scoring Algorithm', () => {
    test('should calculate correct age ratio', () => {
      // Test age ratio calculation
      const effectiveAgeYears = 15;
      const effectiveLifespan = 25;
      const expectedAgeRatio = 15 / 25; // 0.6

      // Access private method for testing (cast to any to bypass TypeScript)
      const ageRatio = (service as any).calculateAgeRatio(effectiveAgeYears, effectiveLifespan);
      
      expect(ageRatio).toBeCloseTo(expectedAgeRatio, 2);
    });

    test('should cap age ratio at 1.0 for overdue elements', () => {
      const effectiveAgeYears = 30;
      const effectiveLifespan = 20;
      
      const ageRatio = (service as any).calculateAgeRatio(effectiveAgeYears, effectiveLifespan);
      
      expect(ageRatio).toBe(1.0);
    });

    test('should map condition factors correctly', () => {
      const conditionFactors = {
        'excellent': 0.0,
        'good': 0.25,
        'fair': 0.5,
        'poor': 0.75,
        'critical': 1.0
      };

      Object.entries(conditionFactors).forEach(([condition, expectedFactor]) => {
        const factor = (service as any).getConditionFactor(condition);
        expect(factor).toBe(expectedFactor);
      });
    });

    test('should calculate exposure factors for different UNIFORMAT codes', () => {
      const testCases = [
        { code: 'B30', expectedMin: 1.15, expectedMax: 1.25 }, // Roofing
        { code: 'B20', expectedMin: 1.15, expectedMax: 1.25 }, // Exterior enclosure
        { code: 'G10', expectedMin: 1.15, expectedMax: 1.25 }, // Site preparation
        { code: 'C10', expectedMin: 0.85, expectedMax: 0.95 }, // Interior construction
        { code: 'D20', expectedMin: 1.05, expectedMax: 1.15 }, // Plumbing (winter risk)
        { code: 'D30', expectedMin: 0.95, expectedMax: 1.05 }, // HVAC
      ];

      testCases.forEach(({ code, expectedMin, expectedMax }) => {
        const factor = (service as any).getExposureFactor(code);
        expect(factor).toBeGreaterThanOrEqual(expectedMin);
        expect(factor).toBeLessThanOrEqual(expectedMax);
      });
    });

    test('should calculate risk score within bounds [0, 1]', () => {
      const testCases = [
        { ageRatio: 0.3, conditionFactor: 0.0, exposureFactorAdj: 0.0 }, // Low risk
        { ageRatio: 0.6, conditionFactor: 0.5, exposureFactorAdj: 0.1 }, // Medium risk
        { ageRatio: 1.0, conditionFactor: 1.0, exposureFactorAdj: 0.2 }, // High risk
      ];

      testCases.forEach(({ ageRatio, conditionFactor, exposureFactorAdj }) => {
        const riskScore = (service as any).calculateRiskScore(ageRatio, conditionFactor, exposureFactorAdj);
        
        expect(riskScore).toBeGreaterThanOrEqual(0);
        expect(riskScore).toBeLessThanOrEqual(1);
        expect(typeof riskScore).toBe('number');
      });
    });
  });

  describe('Suggestion Type and Priority Logic', () => {
    test('should recommend replacement for critical condition', () => {
      const element = {
        currentCondition: 'critical',
        // ... other properties would be here
      };
      const riskScore = 0.85;

      const suggestion = (service as any).determineSuggestionType(element, riskScore, 0);
      
      expect(suggestion.type).toBe('replacement');
      expect(suggestion.priority).toBe('critical');
    });

    test('should recommend replacement for overdue elements', () => {
      const element = {
        currentCondition: 'fair',
        // ... other properties would be here
      };
      const riskScore = 0.8;
      const remainingLifeYears = -2; // Overdue

      const suggestion = (service as any).determineSuggestionType(element, riskScore, remainingLifeYears);
      
      expect(suggestion.type).toBe('replacement');
      expect(suggestion.priority).toBe('critical');
    });

    test('should recommend major rehab for poor condition', () => {
      const element = {
        currentCondition: 'poor',
        // ... other properties would be here
      };
      const riskScore = 0.75;
      const remainingLifeYears = 2;

      const suggestion = (service as any).determineSuggestionType(element, riskScore, remainingLifeYears);
      
      expect(suggestion.type).toBe('major_rehab');
      expect(suggestion.priority).toBe('high');
    });

    test('should recommend minor rehab for fair condition', () => {
      const element = {
        currentCondition: 'fair',
        // ... other properties would be here
      };
      const riskScore = 0.6;
      const remainingLifeYears = 5;

      const suggestion = (service as any).determineSuggestionType(element, riskScore, remainingLifeYears);
      
      expect(suggestion.type).toBe('minor_rehab');
      expect(suggestion.priority).toBe('medium');
    });

    test('should recommend inspection for aging elements', () => {
      const element = {
        currentCondition: 'good',
        // ... other properties would be here
      };
      const riskScore = 0.55;
      const remainingLifeYears = 8;

      const suggestion = (service as any).determineSuggestionType(element, riskScore, remainingLifeYears);
      
      expect(suggestion.type).toBe('inspection');
      expect(['low', 'medium']).toContain(suggestion.priority);
    });
  });

  describe('Quebec Seasonality Rules', () => {
    test('should shift winter work to spring for exterior elements', () => {
      const winterDate = new Date('2024-01-15'); // January 15th
      const uniformatCode = 'B30'; // Roofing - exterior work

      const adjustedDate = (service as any).applySeasonalAdjustment(winterDate, uniformatCode);
      
      expect(adjustedDate.getMonth()).toBe(4); // May (0-indexed)
      expect(adjustedDate.getDate()).toBe(1); // May 1st
    });

    test('should shift winter work to March for interior elements', () => {
      const winterDate = new Date('2024-12-15'); // December 15th
      const uniformatCode = 'C10'; // Interior construction

      const adjustedDate = (service as any).applySeasonalAdjustment(winterDate, uniformatCode);
      
      expect(adjustedDate.getMonth()).toBe(2); // March (0-indexed)
      expect(adjustedDate.getDate()).toBe(1); // March 1st
    });

    test('should not shift work scheduled in optimal season', () => {
      const summerDate = new Date('2024-06-15'); // June 15th
      const uniformatCode = 'B20'; // Exterior enclosure

      const adjustedDate = (service as any).applySeasonalAdjustment(summerDate, uniformatCode);
      
      // Should remain unchanged
      expect(adjustedDate.getTime()).toBe(summerDate.getTime());
    });

    test('should prefer inspection months for inspections', () => {
      const testDate = new Date('2024-03-15'); // March 15th
      const uniformatCode = 'B30';

      const adjustedDate = (service as any).applySeasonalAdjustment(testDate, uniformatCode, 'inspection');
      
      // Should be moved to April-June or Sep-Oct
      const month = adjustedDate.getMonth();
      const isInPreferredSeason = (month >= 3 && month <= 5) || (month >= 8 && month <= 9); // Apr-Jun or Sep-Oct
      expect(isInPreferredSeason).toBe(true);
    });
  });

  describe('Utility Functions', () => {
    test('should clamp values between 0 and 1', () => {
      const clamp = (service as any).clamp01;
      
      expect(clamp(-0.5)).toBe(0);
      expect(clamp(0.5)).toBe(0.5);
      expect(clamp(1.5)).toBe(1);
      expect(clamp(0)).toBe(0);
      expect(clamp(1)).toBe(1);
    });

    test('should calculate remaining life correctly', () => {
      const effectiveLifespan = 25;
      const effectiveAgeYears = 15;
      const expectedRemainingLife = 25 - 15; // 10 years

      const remainingLife = (service as any).calculateRemainingLife(effectiveLifespan, effectiveAgeYears);
      
      expect(remainingLife).toBe(expectedRemainingLife);
    });

    test('should handle negative remaining life for overdue elements', () => {
      const effectiveLifespan = 20;
      const effectiveAgeYears = 25; // 5 years overdue
      const expectedRemainingLife = 20 - 25; // -5 years

      const remainingLife = (service as any).calculateRemainingLife(effectiveLifespan, effectiveAgeYears);
      
      expect(remainingLife).toBe(expectedRemainingLife);
      expect(remainingLife).toBeLessThan(0);
    });
  });
});