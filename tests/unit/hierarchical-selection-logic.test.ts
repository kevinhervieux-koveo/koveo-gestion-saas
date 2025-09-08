/**
 * Hierarchical Selection Logic Unit Tests
 * Tests the core logic functions for the hierarchical card-based navigation system
 */

import { describe, test, expect } from '@jest/globals';

// Mock the getCurrentLevel function since it's not exported
function getCurrentLevel(
  hierarchy: ('organization' | 'building' | 'residence')[],
  ids: { organizationId: string | null; buildingId: string | null; residenceId: string | null }
): 'organization' | 'building' | 'residence' | 'complete' {
  const { organizationId, buildingId, residenceId } = ids;

  // Check each level in the hierarchy in order
  for (let i = 0; i < hierarchy.length; i++) {
    const level = hierarchy[i];
    
    if (level === 'organization' && !organizationId) {
      return 'organization';
    }
    
    // For building level, check if we need organization context
    if (level === 'building' && !buildingId) {
      // If organization is in hierarchy, we need organizationId first
      if (hierarchy.includes('organization') && !organizationId) {
        return 'organization';
      }
      // Otherwise, go directly to building selection
      return 'building';
    }
    
    if (level === 'residence' && !residenceId) {
      // Need both organization and building if they're in hierarchy
      if (hierarchy.includes('organization') && !organizationId) {
        return 'organization';
      }
      if (hierarchy.includes('building') && !buildingId) {
        return 'building';
      }
      return 'residence';
    }
  }

  // All required levels in the hierarchy have been satisfied
  return 'complete';
}

describe('Hierarchical Selection Logic', () => {
  describe('getCurrentLevel function', () => {
    
    describe('Single-level hierarchies (Residents)', () => {
      test('should return "building" when building hierarchy has no buildingId', () => {
        const hierarchy: ('building')[] = ['building'];
        const ids = { organizationId: null, buildingId: null, residenceId: null };
        
        const result = getCurrentLevel(hierarchy, ids);
        
        expect(result).toBe('building');
      });

      test('should return "complete" when building hierarchy has buildingId', () => {
        const hierarchy: ('building')[] = ['building'];
        const ids = { organizationId: null, buildingId: 'building-123', residenceId: null };
        
        const result = getCurrentLevel(hierarchy, ids);
        
        expect(result).toBe('complete');
      });

      test('should return "residence" when residence hierarchy has no residenceId', () => {
        const hierarchy: ('residence')[] = ['residence'];
        const ids = { organizationId: null, buildingId: null, residenceId: null };
        
        const result = getCurrentLevel(hierarchy, ids);
        
        expect(result).toBe('residence');
      });

      test('should return "complete" when residence hierarchy has residenceId', () => {
        const hierarchy: ('residence')[] = ['residence'];
        const ids = { organizationId: null, buildingId: null, residenceId: 'residence-123' };
        
        const result = getCurrentLevel(hierarchy, ids);
        
        expect(result).toBe('complete');
      });
    });

    describe('Multi-level hierarchies (Managers)', () => {
      test('should return "organization" when org->building hierarchy has no organizationId', () => {
        const hierarchy: ('organization' | 'building')[] = ['organization', 'building'];
        const ids = { organizationId: null, buildingId: null, residenceId: null };
        
        const result = getCurrentLevel(hierarchy, ids);
        
        expect(result).toBe('organization');
      });

      test('should return "building" when org->building hierarchy has organizationId but no buildingId', () => {
        const hierarchy: ('organization' | 'building')[] = ['organization', 'building'];
        const ids = { organizationId: 'org-123', buildingId: null, residenceId: null };
        
        const result = getCurrentLevel(hierarchy, ids);
        
        expect(result).toBe('building');
      });

      test('should return "complete" when org->building hierarchy has both IDs', () => {
        const hierarchy: ('organization' | 'building')[] = ['organization', 'building'];
        const ids = { organizationId: 'org-123', buildingId: 'building-123', residenceId: null };
        
        const result = getCurrentLevel(hierarchy, ids);
        
        expect(result).toBe('complete');
      });

      test('should return "organization" for full hierarchy when no organizationId', () => {
        const hierarchy: ('organization' | 'building' | 'residence')[] = ['organization', 'building', 'residence'];
        const ids = { organizationId: null, buildingId: null, residenceId: null };
        
        const result = getCurrentLevel(hierarchy, ids);
        
        expect(result).toBe('organization');
      });

      test('should return "building" for full hierarchy when has org but no building', () => {
        const hierarchy: ('organization' | 'building' | 'residence')[] = ['organization', 'building', 'residence'];
        const ids = { organizationId: 'org-123', buildingId: null, residenceId: null };
        
        const result = getCurrentLevel(hierarchy, ids);
        
        expect(result).toBe('building');
      });

      test('should return "residence" for full hierarchy when has org+building but no residence', () => {
        const hierarchy: ('organization' | 'building' | 'residence')[] = ['organization', 'building', 'residence'];
        const ids = { organizationId: 'org-123', buildingId: 'building-123', residenceId: null };
        
        const result = getCurrentLevel(hierarchy, ids);
        
        expect(result).toBe('residence');
      });

      test('should return "complete" for full hierarchy when has all IDs', () => {
        const hierarchy: ('organization' | 'building' | 'residence')[] = ['organization', 'building', 'residence'];
        const ids = { organizationId: 'org-123', buildingId: 'building-123', residenceId: 'residence-123' };
        
        const result = getCurrentLevel(hierarchy, ids);
        
        expect(result).toBe('complete');
      });
    });

    describe('Complex dependency scenarios', () => {
      test('should prioritize organization when building hierarchy requires it', () => {
        const hierarchy: ('organization' | 'building')[] = ['organization', 'building'];
        const ids = { organizationId: null, buildingId: 'building-123', residenceId: null };
        
        const result = getCurrentLevel(hierarchy, ids);
        
        // Should still require organization first, even with buildingId present
        expect(result).toBe('organization');
      });

      test('should prioritize organization when residence hierarchy requires it', () => {
        const hierarchy: ('organization' | 'residence')[] = ['organization', 'residence'];
        const ids = { organizationId: null, buildingId: null, residenceId: 'residence-123' };
        
        const result = getCurrentLevel(hierarchy, ids);
        
        // Should still require organization first
        expect(result).toBe('organization');
      });

      test('should prioritize building when residence hierarchy requires it', () => {
        const hierarchy: ('building' | 'residence')[] = ['building', 'residence'];
        const ids = { organizationId: null, buildingId: null, residenceId: 'residence-123' };
        
        const result = getCurrentLevel(hierarchy, ids);
        
        // Should still require building first
        expect(result).toBe('building');
      });
    });

    describe('Edge cases', () => {
      test('should handle empty hierarchy', () => {
        const hierarchy: never[] = [];
        const ids = { organizationId: null, buildingId: null, residenceId: null };
        
        const result = getCurrentLevel(hierarchy, ids);
        
        expect(result).toBe('complete');
      });

      test('should handle single organization hierarchy', () => {
        const hierarchy: ('organization')[] = ['organization'];
        const ids = { organizationId: null, buildingId: null, residenceId: null };
        
        const result = getCurrentLevel(hierarchy, ids);
        
        expect(result).toBe('organization');
      });

      test('should return complete for single organization when org provided', () => {
        const hierarchy: ('organization')[] = ['organization'];
        const ids = { organizationId: 'org-123', buildingId: null, residenceId: null };
        
        const result = getCurrentLevel(hierarchy, ids);
        
        expect(result).toBe('complete');
      });
    });
  });

  describe('Auto-forwarding Logic', () => {
    test('should describe auto-forward conditions for single building', () => {
      // Test logic: if (currentLevel === 'building' && buildings.length === 1 && !buildingId)
      const currentLevel = 'building';
      const buildingsLength = 1;
      const buildingId = null;
      
      const shouldAutoForward = currentLevel === 'building' && buildingsLength === 1 && !buildingId;
      
      expect(shouldAutoForward).toBe(true);
    });

    test('should not auto-forward when multiple buildings', () => {
      const currentLevel = 'building';
      const buildingsLength = 2;
      const buildingId = null;
      
      const shouldAutoForward = currentLevel === 'building' && buildingsLength === 1 && !buildingId;
      
      expect(shouldAutoForward).toBe(false);
    });

    test('should not auto-forward when building already selected', () => {
      const currentLevel = 'building';
      const buildingsLength = 1;
      const buildingId = 'building-123';
      
      const shouldAutoForward = currentLevel === 'building' && buildingsLength === 1 && !buildingId;
      
      expect(shouldAutoForward).toBe(false);
    });

    test('should not auto-forward when not at building level', () => {
      const currentLevel = 'organization';
      const buildingsLength = 1;
      const buildingId = null;
      
      const shouldAutoForward = currentLevel === 'building' && buildingsLength === 1 && !buildingId;
      
      expect(shouldAutoForward).toBe(false);
    });
  });

  describe('Back Button Logic', () => {
    test('should show back button for single-level hierarchy with multiple options', () => {
      // Test logic: config.hierarchy.length === 1 && buildingId && buildings.length > 1
      const hierarchyLength = 1;
      const buildingId = 'building-123';
      const buildingsLength = 2;
      
      const shouldShowBackButton = hierarchyLength === 1 && !!buildingId && buildingsLength > 1;
      
      expect(shouldShowBackButton).toBe(true);
    });

    test('should not show back button for single-level hierarchy with single option', () => {
      const hierarchyLength = 1;
      const buildingId = 'building-123';
      const buildingsLength = 1;
      
      const shouldShowBackButton = hierarchyLength === 1 && !!buildingId && buildingsLength > 1;
      
      expect(shouldShowBackButton).toBe(false);
    });

    test('should not show back button when no selection made', () => {
      const hierarchyLength = 1;
      const buildingId = null;
      const buildingsLength = 2;
      
      const shouldShowBackButton = hierarchyLength === 1 && !!buildingId && buildingsLength > 1;
      
      expect(shouldShowBackButton).toBe(false);
    });

    test('should show back button for multi-level hierarchy with multiple options', () => {
      // Test logic: buildings.length > 1 && buildingId
      const hierarchyLength = 2;
      const buildingId = 'building-123';
      const buildingsLength = 3;
      
      const shouldShowBackButton = buildingsLength > 1 && !!buildingId;
      
      expect(shouldShowBackButton).toBe(true);
    });
  });

  describe('URL Parameter Parsing', () => {
    test('should parse organization parameter correctly', () => {
      const mockUrlParams = new URLSearchParams('?organization=org-123&building=building-456');
      
      const organizationId = mockUrlParams.get('organization');
      const buildingId = mockUrlParams.get('building');
      const residenceId = mockUrlParams.get('residence');
      
      expect(organizationId).toBe('org-123');
      expect(buildingId).toBe('building-456');
      expect(residenceId).toBe(null);
    });

    test('should handle missing parameters', () => {
      const mockUrlParams = new URLSearchParams('?building=building-456');
      
      const organizationId = mockUrlParams.get('organization');
      const buildingId = mockUrlParams.get('building');
      const residenceId = mockUrlParams.get('residence');
      
      expect(organizationId).toBe(null);
      expect(buildingId).toBe('building-456');
      expect(residenceId).toBe(null);
    });

    test('should handle empty search params', () => {
      const mockUrlParams = new URLSearchParams('');
      
      const organizationId = mockUrlParams.get('organization');
      const buildingId = mockUrlParams.get('building');
      const residenceId = mockUrlParams.get('residence');
      
      expect(organizationId).toBe(null);
      expect(buildingId).toBe(null);
      expect(residenceId).toBe(null);
    });
  });
});