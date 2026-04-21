/**
 * Test suite for Quebec seasonal deferral functionality
 * Validates that the critical bug in seasonShift function has been fixed
 */

import { MaintenanceSuggestionService } from '../services/maintenanceSuggestionService';

describe('Quebec Seasonal Deferral', () => {
  let service: MaintenanceSuggestionService;

  beforeEach(() => {
    service = new MaintenanceSuggestionService();
  });

  describe('seasonShift function', () => {
    it('should defer exterior physical work from winter to May 1st', () => {
      // Test exterior work in December
      const decemberDate = new Date(2024, 11, 15); // Dec 15, 2024
      const result = service.seasonShift(decemberDate, 'B30', 'major_rehab');
      
      expect(result.getMonth()).toBe(4); // May (month 4)
      expect(result.getDate()).toBe(1);
      expect(result.getFullYear()).toBe(2025);
    });

    it('should defer interior physical work from winter to March 1st', () => {
      // Test interior work in January 
      const januaryDate = new Date(2024, 0, 15); // Jan 15, 2024
      const result = service.seasonShift(januaryDate, 'D2010', 'replacement');
      
      expect(result.getMonth()).toBe(2); // March (month 2)
      expect(result.getDate()).toBe(1);
      expect(result.getFullYear()).toBe(2024);
    });

    it('should not defer inspections regardless of season', () => {
      // Test inspection in December (winter)
      const decemberDate = new Date(2024, 11, 15); // Dec 15, 2024
      const result = service.seasonShift(decemberDate, 'B30', 'inspection');
      
      // Should return the original date unchanged
      expect(result.getTime()).toBe(decemberDate.getTime());
    });

    it('should not defer physical work during allowed seasons', () => {
      // Test major rehab in June (allowed season)
      const juneDate = new Date(2024, 5, 15); // Jun 15, 2024
      const result = service.seasonShift(juneDate, 'B30', 'major_rehab');
      
      // Should return the original date unchanged
      expect(result.getTime()).toBe(juneDate.getTime());
    });

    it('should handle March deferral correctly when March has passed', () => {
      // Mock current date to be after March 1st
      const mockToday = new Date(2024, 2, 15); // March 15, 2024
      const originalDate = Date;
      global.Date = class extends originalDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(mockToday.getTime());
          } else {
            super(...args);
          }
        }
        static now() {
          return mockToday.getTime();
        }
      } as any;

      try {
        // Test interior work scheduled for March when we're already in March
        const marchDate = new Date(2024, 2, 10); // Mar 10, 2024
        const result = service.seasonShift(marchDate, 'C10', 'major_rehab');
        
        // Should defer to next year's March 1st
        expect(result.getMonth()).toBe(2); // March (month 2)
        expect(result.getDate()).toBe(1);
        expect(result.getFullYear()).toBe(2025);
      } finally {
        global.Date = originalDate;
      }
    });

    it('should handle edge case for different UNIFORMAT codes', () => {
      // Test various UNIFORMAT codes
      const winterDate = new Date(2024, 1, 15); // Feb 15, 2024
      
      // Exterior (B) - should go to May
      const exteriorResult = service.seasonShift(winterDate, 'B20', 'replacement');
      expect(exteriorResult.getMonth()).toBe(4); // May
      
      // Sitework (G) - should go to May  
      const siteworkResult = service.seasonShift(winterDate, 'G10', 'major_rehab');
      expect(siteworkResult.getMonth()).toBe(4); // May
      
      // Interior (C) - should go to March
      const interiorResult = service.seasonShift(winterDate, 'C30', 'replacement');
      expect(interiorResult.getMonth()).toBe(2); // March
      
      // Services (D) - should go to March
      const servicesResult = service.seasonShift(winterDate, 'D40', 'major_rehab');
      expect(servicesResult.getMonth()).toBe(2); // March
    });

    it('should handle minor_rehab correctly (not considered physical work)', () => {
      // Test minor rehab in winter
      const winterDate = new Date(2024, 11, 15); // Dec 15, 2024
      const result = service.seasonShift(winterDate, 'B30', 'minor_rehab');
      
      // Should NOT defer minor_rehab, return original date
      expect(result.getTime()).toBe(winterDate.getTime());
    });
  });

  describe('Critical bug validation', () => {
    it('should correctly identify physical work from suggestionType, not uniformatCode', () => {
      // This test validates the core bug fix
      const winterDate = new Date(2024, 0, 15); // Jan 15, 2024
      
      // The old bug: uniformatCode.split('_')[0] would return "B30", not "major_rehab"
      // This should now work correctly because we check suggestionType
      const result = service.seasonShift(winterDate, 'B30', 'major_rehab');
      
      // Should be deferred (not equal to original date)
      expect(result.getTime()).not.toBe(winterDate.getTime());
      expect(result.getMonth()).toBe(4); // Should be deferred to May
    });
  });
});

console.log('✅ Quebec seasonal deferral tests created successfully');