/**
 * Auto-forwarding and Back Button Logic Tests
 * Tests the smart navigation logic for auto-forwarding and back button visibility
 */

import { describe, test, expect } from '@jest/globals';

// Mock organization, building, and residence data types
interface Organization {
  id: string;
  name: string;
}

interface Building {
  id: string;
  name: string;
  organizationId?: string;
}

interface Residence {
  id: string;
  unitNumber: string;
  buildingId: string;
}

describe('Auto-forwarding Logic', () => {
  describe('Single Option Auto-forwarding', () => {
    test('should auto-forward when user has single organization', () => {
      const organizations: Organization[] = [
        { id: 'org-1', name: 'Organization A' }
      ];
      const currentLevel = 'organization';
      const organizationId = null;
      
      const shouldAutoForward = 
        currentLevel === 'organization' && 
        organizations.length === 1 && 
        !organizationId;
      
      expect(shouldAutoForward).toBe(true);
    });

    test('should auto-forward when user has single building', () => {
      const buildings: Building[] = [
        { id: 'building-1', name: 'Building A' }
      ];
      const currentLevel = 'building';
      const buildingId = null;
      
      const shouldAutoForward = 
        currentLevel === 'building' && 
        buildings.length === 1 && 
        !buildingId;
      
      expect(shouldAutoForward).toBe(true);
    });

    test('should auto-forward when user has single residence', () => {
      const residences: Residence[] = [
        { id: 'residence-1', unitNumber: '101', buildingId: 'building-1' }
      ];
      const currentLevel = 'residence';
      const residenceId = null;
      
      const shouldAutoForward = 
        currentLevel === 'residence' && 
        residences.length === 1 && 
        !residenceId;
      
      expect(shouldAutoForward).toBe(true);
    });
  });

  describe('Multiple Options - No Auto-forwarding', () => {
    test('should NOT auto-forward when user has multiple organizations', () => {
      const organizations: Organization[] = [
        { id: 'org-1', name: 'Organization A' },
        { id: 'org-2', name: 'Organization B' }
      ];
      const currentLevel = 'organization';
      const organizationId = null;
      
      const shouldAutoForward = 
        currentLevel === 'organization' && 
        organizations.length === 1 && 
        !organizationId;
      
      expect(shouldAutoForward).toBe(false);
    });

    test('should NOT auto-forward when user has multiple buildings', () => {
      const buildings: Building[] = [
        { id: 'building-1', name: 'Building A' },
        { id: 'building-2', name: 'Building B' }
      ];
      const currentLevel = 'building';
      const buildingId = null;
      
      const shouldAutoForward = 
        currentLevel === 'building' && 
        buildings.length === 1 && 
        !buildingId;
      
      expect(shouldAutoForward).toBe(false);
    });

    test('should NOT auto-forward when user has multiple residences', () => {
      const residences: Residence[] = [
        { id: 'residence-1', unitNumber: '101', buildingId: 'building-1' },
        { id: 'residence-2', unitNumber: '102', buildingId: 'building-1' }
      ];
      const currentLevel = 'residence';
      const residenceId = null;
      
      const shouldAutoForward = 
        currentLevel === 'residence' && 
        residences.length === 1 && 
        !residenceId;
      
      expect(shouldAutoForward).toBe(false);
    });
  });

  describe('Already Selected - No Auto-forwarding', () => {
    test('should NOT auto-forward when organization already selected', () => {
      const organizations: Organization[] = [
        { id: 'org-1', name: 'Organization A' }
      ];
      const currentLevel = 'organization';
      const organizationId = 'org-1'; // Already selected
      
      const shouldAutoForward = 
        currentLevel === 'organization' && 
        organizations.length === 1 && 
        !organizationId;
      
      expect(shouldAutoForward).toBe(false);
    });

    test('should NOT auto-forward when building already selected', () => {
      const buildings: Building[] = [
        { id: 'building-1', name: 'Building A' }
      ];
      const currentLevel = 'building';
      const buildingId = 'building-1'; // Already selected
      
      const shouldAutoForward = 
        currentLevel === 'building' && 
        buildings.length === 1 && 
        !buildingId;
      
      expect(shouldAutoForward).toBe(false);
    });

    test('should NOT auto-forward when residence already selected', () => {
      const residences: Residence[] = [
        { id: 'residence-1', unitNumber: '101', buildingId: 'building-1' }
      ];
      const currentLevel = 'residence';
      const residenceId = 'residence-1'; // Already selected
      
      const shouldAutoForward = 
        currentLevel === 'residence' && 
        residences.length === 1 && 
        !residenceId;
      
      expect(shouldAutoForward).toBe(false);
    });
  });

  describe('Wrong Level - No Auto-forwarding', () => {
    test('should NOT auto-forward when at different level than expected', () => {
      const organizations: Organization[] = [
        { id: 'org-1', name: 'Organization A' }
      ];
      const currentLevel = 'building'; // Different level
      const organizationId = null;
      
      const shouldAutoForward = 
        currentLevel === 'organization' && 
        organizations.length === 1 && 
        !organizationId;
      
      expect(shouldAutoForward).toBe(false);
    });
  });
});

describe('Back Button Logic', () => {
  describe('Single-level Hierarchy (Residents)', () => {
    test('should show back button for single-level hierarchy with multiple options', () => {
      const hierarchyConfig = { hierarchy: ['building'], hierarchyLength: 1 };
      const buildingId = 'building-1';
      const buildings: Building[] = [
        { id: 'building-1', name: 'Building A' },
        { id: 'building-2', name: 'Building B' }
      ];
      
      const shouldShowBackButton = 
        hierarchyConfig.hierarchy.includes('building') && 
        hierarchyConfig.hierarchyLength === 1 && 
        !!buildingId && 
        buildings.length > 1;
      
      expect(shouldShowBackButton).toBe(true);
    });

    test('should NOT show back button for single-level hierarchy with single option', () => {
      const hierarchyConfig = { hierarchy: ['building'], hierarchyLength: 1 };
      const buildingId = 'building-1';
      const buildings: Building[] = [
        { id: 'building-1', name: 'Building A' }
      ];
      
      const shouldShowBackButton = 
        hierarchyConfig.hierarchy.includes('building') && 
        hierarchyConfig.hierarchyLength === 1 && 
        !!buildingId && 
        buildings.length > 1;
      
      expect(shouldShowBackButton).toBe(false);
    });

    test('should NOT show back button when no selection made', () => {
      const hierarchyConfig = { hierarchy: ['building'], hierarchyLength: 1 };
      const buildingId = null;
      const buildings: Building[] = [
        { id: 'building-1', name: 'Building A' },
        { id: 'building-2', name: 'Building B' }
      ];
      
      const shouldShowBackButton = 
        hierarchyConfig.hierarchy.includes('building') && 
        hierarchyConfig.hierarchyLength === 1 && 
        !!buildingId && 
        buildings.length > 1;
      
      expect(shouldShowBackButton).toBe(false);
    });

    test('should NOT show back button for non-building single-level hierarchy', () => {
      const hierarchyConfig = { hierarchy: ['residence'], hierarchyLength: 1 };
      const buildingId = 'building-1';
      const buildings: Building[] = [
        { id: 'building-1', name: 'Building A' },
        { id: 'building-2', name: 'Building B' }
      ];
      
      const shouldShowBackButton = 
        hierarchyConfig.hierarchy.includes('building') && 
        hierarchyConfig.hierarchyLength === 1 && 
        !!buildingId && 
        buildings.length > 1;
      
      expect(shouldShowBackButton).toBe(false);
    });
  });

  describe('Multi-level Hierarchy (Managers)', () => {
    test('should show back button for multi-level with multiple buildings', () => {
      const hierarchyConfig = { hierarchy: ['organization', 'building'], hierarchyLength: 2 };
      const buildingId = 'building-1';
      const buildings: Building[] = [
        { id: 'building-1', name: 'Building A', organizationId: 'org-1' },
        { id: 'building-2', name: 'Building B', organizationId: 'org-1' },
        { id: 'building-3', name: 'Building C', organizationId: 'org-1' }
      ];
      
      const shouldShowBackButton = 
        hierarchyConfig.hierarchy.includes('building') && 
        buildings.length > 1 && 
        !!buildingId;
      
      expect(shouldShowBackButton).toBe(true);
    });

    test('should show back button for multi-level with multiple organizations', () => {
      const hierarchyConfig = { hierarchy: ['organization', 'building'], hierarchyLength: 2 };
      const organizationId = 'org-1';
      const organizations: Organization[] = [
        { id: 'org-1', name: 'Organization A' },
        { id: 'org-2', name: 'Organization B' }
      ];
      
      const shouldShowBackButton = 
        hierarchyConfig.hierarchy.includes('organization') && 
        organizations.length > 1 && 
        !!organizationId;
      
      expect(shouldShowBackButton).toBe(true);
    });

    test('should NOT show back button for multi-level with single building', () => {
      const hierarchyConfig = { hierarchy: ['organization', 'building'], hierarchyLength: 2 };
      const buildingId = 'building-1';
      const buildings: Building[] = [
        { id: 'building-1', name: 'Building A', organizationId: 'org-1' }
      ];
      
      const shouldShowBackButton = 
        hierarchyConfig.hierarchy.includes('building') && 
        buildings.length > 1 && 
        !!buildingId;
      
      expect(shouldShowBackButton).toBe(false);
    });
  });

  describe('Complex Hierarchy Scenarios', () => {
    test('should show back button at residence level when multiple buildings exist', () => {
      const hierarchyConfig = { hierarchy: ['organization', 'building', 'residence'], hierarchyLength: 3 };
      const buildingId = 'building-1';
      const residenceId = 'residence-1';
      const buildings: Building[] = [
        { id: 'building-1', name: 'Building A', organizationId: 'org-1' },
        { id: 'building-2', name: 'Building B', organizationId: 'org-1' }
      ];
      
      const shouldShowBackButton = 
        hierarchyConfig.hierarchy.includes('building') && 
        buildings.length > 1 && 
        !!buildingId;
      
      expect(shouldShowBackButton).toBe(true);
    });

    test('should prioritize organization back button when multiple orgs and buildings exist', () => {
      const hierarchyConfig = { hierarchy: ['organization', 'building'], hierarchyLength: 2 };
      const organizationId = 'org-1';
      const buildingId = null; // At organization level
      const organizations: Organization[] = [
        { id: 'org-1', name: 'Organization A' },
        { id: 'org-2', name: 'Organization B' }
      ];
      const buildings: Building[] = [
        { id: 'building-1', name: 'Building A', organizationId: 'org-1' },
        { id: 'building-2', name: 'Building B', organizationId: 'org-2' }
      ];
      
      // Should prioritize organization back button
      const shouldShowOrgBackButton = 
        hierarchyConfig.hierarchy.includes('organization') && 
        organizations.length > 1 && 
        !!organizationId;
        
      const shouldShowBuildingBackButton = 
        hierarchyConfig.hierarchy.includes('building') && 
        buildings.length > 1 && 
        !!buildingId;
      
      expect(shouldShowOrgBackButton).toBe(true);
      expect(shouldShowBuildingBackButton).toBe(false); // No buildingId
    });
  });

  describe('Smart Back Button Behavior', () => {
    test('should determine correct back button label for building level', () => {
      const currentLevel = 'complete'; // User is viewing details
      const hierarchyConfig = { hierarchy: ['building'], hierarchyLength: 1 };
      const buildingId = 'building-1';
      
      const backButtonConfig = {
        showBackButton: hierarchyConfig.hierarchyLength === 1 && !!buildingId,
        backButtonLabel: 'Building'
      };
      
      expect(backButtonConfig.showBackButton).toBe(true);
      expect(backButtonConfig.backButtonLabel).toBe('Building');
    });

    test('should determine correct back button label for organization level', () => {
      const hierarchyConfig = { hierarchy: ['organization', 'building'], hierarchyLength: 2 };
      const organizationId = 'org-1';
      
      const backButtonConfig = {
        showBackButton: !!organizationId,
        backButtonLabel: 'Organization'
      };
      
      expect(backButtonConfig.showBackButton).toBe(true);
      expect(backButtonConfig.backButtonLabel).toBe('Organization');
    });

    test('should not show back button when no previous level exists', () => {
      const hierarchyConfig = { hierarchy: ['building'], hierarchyLength: 1 };
      const buildingId = null; // At selection level
      
      const backButtonConfig = {
        showBackButton: hierarchyConfig.hierarchyLength === 1 && !!buildingId,
        backButtonLabel: undefined
      };
      
      expect(backButtonConfig.showBackButton).toBe(false);
      expect(backButtonConfig.backButtonLabel).toBe(undefined);
    });
  });
});