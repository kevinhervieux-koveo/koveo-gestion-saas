/**
 * Unit Tests for Hierarchical Storage Configuration
 *
 * Tests the new hierarchical storage system functions including:
 * - generateStorageDirectory() with various context levels
 * - mapLegacyDocumentType() for all document type mappings
 * - normalizeUserRole() for demo roles and edge cases
 * - validateUploadContext() for access control
 * - Path generation without duplicate "uploads" prefix
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateStorageDirectory,
  mapLegacyDocumentType,
  normalizeUserRole,
  validateUploadContext,
  getUploadConfig,
  isAiAnalysisEnabled,
  type UploadContext,
  UPLOAD_FORM_CONFIGS
} from '../../../shared/config/upload-config';

describe('Hierarchical Storage Configuration Tests', () => {
  
  describe('generateStorageDirectory()', () => {
    it('should generate basic storage path with type and organization only', () => {
      const context: UploadContext = {
        type: 'documents',
        organizationId: 'org-123',
        userRole: 'admin'
      };

      const result = generateStorageDirectory(context);
      expect(result).toBe('documents/org_org-123/role_admin');
    });

    it('should generate storage path with building level', () => {
      const context: UploadContext = {
        type: 'buildings',
        organizationId: 'org-456',
        buildingId: 'building-789',
        userRole: 'manager'
      };

      const result = generateStorageDirectory(context);
      expect(result).toBe('buildings/org_org-456/building_building-789/role_manager');
    });

    it('should generate storage path with residence level', () => {
      const context: UploadContext = {
        type: 'residences',
        organizationId: 'org-abc',
        buildingId: 'building-def',
        residenceId: 'residence-ghi',
        userRole: 'resident',
        userId: 'user-123'
      };

      const result = generateStorageDirectory(context);
      expect(result).toBe('residences/org_org-abc/building_building-def/residence_residence-ghi/role_resident/user_user-123');
    });

    it('should add user directory for tenant role', () => {
      const context: UploadContext = {
        type: 'documents',
        organizationId: 'org-xyz',
        buildingId: 'building-123',
        residenceId: 'residence-456',
        userRole: 'tenant',
        userId: 'tenant-789'
      };

      const result = generateStorageDirectory(context);
      expect(result).toBe('documents/org_org-xyz/building_building-123/residence_residence-456/role_tenant/user_tenant-789');
    });

    it('should add user directory for resident role', () => {
      const context: UploadContext = {
        type: 'maintenance',
        organizationId: 'org-test',
        buildingId: 'building-test',
        residenceId: 'residence-test',
        userRole: 'resident',
        userId: 'resident-test'
      };

      const result = generateStorageDirectory(context);
      expect(result).toBe('maintenance/org_org-test/building_building-test/residence_residence-test/role_resident/user_resident-test');
    });

    it('should handle normalized demo roles', () => {
      const context: UploadContext = {
        type: 'documents',
        organizationId: 'org-demo',
        userRole: 'demo_manager'
      };

      const result = generateStorageDirectory(context);
      expect(result).toBe('documents/org_org-demo/role_manager');
    });

    it('should handle missing organization ID with default', () => {
      const context: UploadContext = {
        type: 'bugs',
        userRole: 'admin'
      };

      const result = generateStorageDirectory(context);
      expect(result).toBe('bugs/org_default/role_admin');
    });

    it('should handle missing user role', () => {
      const context: UploadContext = {
        type: 'features',
        organizationId: 'org-test'
      };

      const result = generateStorageDirectory(context);
      expect(result).toBe('features/org_org-test/role_user');
    });

    it('should not add user directory for manager role', () => {
      const context: UploadContext = {
        type: 'bills',
        organizationId: 'org-manager',
        buildingId: 'building-manager',
        residenceId: 'residence-manager',
        userRole: 'manager',
        userId: 'manager-123'
      };

      const result = generateStorageDirectory(context);
      expect(result).toBe('bills/org_org-manager/building_building-manager/residence_residence-manager/role_manager');
    });

    it('should not add user directory for admin role', () => {
      const context: UploadContext = {
        type: 'documents',
        organizationId: 'org-admin',
        buildingId: 'building-admin',
        residenceId: 'residence-admin',
        userRole: 'admin',
        userId: 'admin-123'
      };

      const result = generateStorageDirectory(context);
      expect(result).toBe('documents/org_org-admin/building_building-admin/residence_residence-admin/role_admin');
    });

    it('should use POSIX-style path separators', () => {
      const context: UploadContext = {
        type: 'documents',
        organizationId: 'org\\test',
        buildingId: 'building\\test',
        userRole: 'manager'
      };

      const result = generateStorageDirectory(context);
      expect(result).toBe('documents/org_org/test/building_building/test/role_manager');
      expect(result.includes('\\\\')).toBe(false); // Should not have Windows separators
    });

    it('should handle all upload types', () => {
      const types = ['bills', 'buildings', 'residences', 'bugs', 'features', 'documents', 'maintenance'];
      
      types.forEach(type => {
        const context: UploadContext = {
          type: type as any,
          organizationId: 'org-test',
          userRole: 'admin'
        };

        const result = generateStorageDirectory(context);
        expect(result).toMatch(new RegExp(`^${type}/org_org-test/role_admin$`));
      });
    });
  });

  describe('mapLegacyDocumentType()', () => {
    it('should map legacy document types to documents', () => {
      const legacyTypes = [
        'contracts',
        'financial', 
        'insurance',
        'legal',
        'meeting_minutes',
        'permits',
        'inspection',
        'lease',
        'correspondence',
        'utilities',
        'bylaw',
        'other'
      ];

      legacyTypes.forEach(type => {
        expect(mapLegacyDocumentType(type)).toBe('documents');
      });
    });

    it('should preserve allowed document types', () => {
      const allowedTypes = ['bills', 'buildings', 'residences', 'bugs', 'features', 'documents', 'maintenance'];
      
      allowedTypes.forEach(type => {
        expect(mapLegacyDocumentType(type)).toBe(type);
      });
    });

    it('should default unknown types to documents', () => {
      const unknownTypes = ['unknown', 'invalid', 'random', '', null, undefined];
      
      unknownTypes.forEach(type => {
        expect(mapLegacyDocumentType(type as any)).toBe('documents');
      });
    });

    it('should handle case-sensitive mappings correctly', () => {
      expect(mapLegacyDocumentType('Contracts')).toBe('documents'); // Should default to documents for case mismatch
      expect(mapLegacyDocumentType('FINANCIAL')).toBe('documents'); // Should default to documents for case mismatch
      expect(mapLegacyDocumentType('contracts')).toBe('documents'); // Correct case mapping
      expect(mapLegacyDocumentType('financial')).toBe('documents'); // Correct case mapping
    });
  });

  describe('normalizeUserRole()', () => {
    it('should remove demo_ prefix from roles', () => {
      expect(normalizeUserRole('demo_manager')).toBe('manager');
      expect(normalizeUserRole('demo_tenant')).toBe('tenant');
      expect(normalizeUserRole('demo_resident')).toBe('resident');
      expect(normalizeUserRole('demo_admin')).toBe('admin');
    });

    it('should preserve non-demo roles', () => {
      expect(normalizeUserRole('manager')).toBe('manager');
      expect(normalizeUserRole('tenant')).toBe('tenant');
      expect(normalizeUserRole('resident')).toBe('resident');
      expect(normalizeUserRole('admin')).toBe('admin');
    });

    it('should handle edge cases', () => {
      expect(normalizeUserRole('')).toBe('user');
      expect(normalizeUserRole(null as any)).toBe('user');
      expect(normalizeUserRole(undefined as any)).toBe('user');
    });

    it('should handle roles with demo prefix but no actual role', () => {
      expect(normalizeUserRole('demo_')).toBe('');
      expect(normalizeUserRole('demo_unknown')).toBe('unknown');
    });

    it('should handle malformed demo roles', () => {
      expect(normalizeUserRole('demo')).toBe('demo'); // No underscore
      expect(normalizeUserRole('_demo_manager')).toBe('_demo_manager'); // Wrong prefix position
      expect(normalizeUserRole('manager_demo')).toBe('manager_demo'); // Wrong suffix
    });
  });

  describe('validateUploadContext()', () => {
    it('should allow admin to upload to any context', () => {
      const contexts = [
        { type: 'documents', organizationId: 'org-1' },
        { type: 'buildings', organizationId: 'org-1', buildingId: 'building-1' },
        { type: 'residences', organizationId: 'org-1', buildingId: 'building-1', residenceId: 'residence-1' },
        { type: 'documents' }, // No organization
      ];

      contexts.forEach(context => {
        expect(validateUploadContext(context as UploadContext, 'admin')).toBe(true);
        expect(validateUploadContext(context as UploadContext, 'demo_admin')).toBe(true);
      });
    });

    it('should allow manager to upload to their organization', () => {
      const validContexts = [
        { type: 'documents', organizationId: 'org-1' },
        { type: 'buildings', organizationId: 'org-1', buildingId: 'building-1' },
        { type: 'residences', organizationId: 'org-1', buildingId: 'building-1', residenceId: 'residence-1' },
      ];

      validContexts.forEach(context => {
        expect(validateUploadContext(context as UploadContext, 'manager')).toBe(true);
        expect(validateUploadContext(context as UploadContext, 'demo_manager')).toBe(true);
      });
    });

    it('should deny manager upload without organization', () => {
      const invalidContexts = [
        { type: 'documents' },
        { type: 'buildings', buildingId: 'building-1' },
      ];

      invalidContexts.forEach(context => {
        expect(validateUploadContext(context as UploadContext, 'manager')).toBe(false);
        expect(validateUploadContext(context as UploadContext, 'demo_manager')).toBe(false);
      });
    });

    it('should allow resident to upload to their building or residence', () => {
      const validContexts = [
        { type: 'documents', organizationId: 'org-1', buildingId: 'building-1' },
        { type: 'residences', organizationId: 'org-1', buildingId: 'building-1', residenceId: 'residence-1' },
        { type: 'documents', organizationId: 'org-1', residenceId: 'residence-1' }, // Can have residence without building
      ];

      validContexts.forEach(context => {
        expect(validateUploadContext(context as UploadContext, 'resident')).toBe(true);
        expect(validateUploadContext(context as UploadContext, 'demo_resident')).toBe(true);
      });
    });

    it('should deny resident upload without organization and building/residence', () => {
      const invalidContexts = [
        { type: 'documents' }, // No organization
        { type: 'documents', organizationId: 'org-1' }, // No building or residence
      ];

      invalidContexts.forEach(context => {
        expect(validateUploadContext(context as UploadContext, 'resident')).toBe(false);
        expect(validateUploadContext(context as UploadContext, 'demo_resident')).toBe(false);
      });
    });

    it('should allow tenant to upload only to their specific residence', () => {
      const validContext = {
        type: 'documents',
        organizationId: 'org-1',
        buildingId: 'building-1',
        residenceId: 'residence-1'
      };

      expect(validateUploadContext(validContext as UploadContext, 'tenant')).toBe(true);
      expect(validateUploadContext(validContext as UploadContext, 'demo_tenant')).toBe(true);
    });

    it('should deny tenant upload without full context', () => {
      const invalidContexts = [
        { type: 'documents' },
        { type: 'documents', organizationId: 'org-1' },
        { type: 'documents', organizationId: 'org-1', buildingId: 'building-1' }, // Missing residence
        { type: 'documents', organizationId: 'org-1', residenceId: 'residence-1' }, // Missing building
      ];

      invalidContexts.forEach(context => {
        expect(validateUploadContext(context as UploadContext, 'tenant')).toBe(false);
        expect(validateUploadContext(context as UploadContext, 'demo_tenant')).toBe(false);
      });
    });

    it('should deny unknown roles', () => {
      const context = {
        type: 'documents',
        organizationId: 'org-1',
        buildingId: 'building-1',
        residenceId: 'residence-1'
      };

      const unknownRoles = ['unknown', 'guest', 'visitor', '', null, undefined];
      unknownRoles.forEach(role => {
        expect(validateUploadContext(context as UploadContext, role as any)).toBe(false);
      });
    });
  });

  describe('getUploadConfig()', () => {
    it('should return correct config for known form types', () => {
      Object.keys(UPLOAD_FORM_CONFIGS).forEach(formType => {
        const config = getUploadConfig(formType);
        expect(config).toBe(UPLOAD_FORM_CONFIGS[formType]);
      });
    });

    it('should return documents config for unknown form types', () => {
      const unknownTypes = ['unknown', 'invalid', '', null, undefined];
      unknownTypes.forEach(type => {
        const config = getUploadConfig(type as any);
        expect(config).toBe(UPLOAD_FORM_CONFIGS.documents);
      });
    });

    it('should include all required config properties', () => {
      Object.values(UPLOAD_FORM_CONFIGS).forEach(config => {
        expect(config).toHaveProperty('aiAnalysisEnabled');
        expect(config).toHaveProperty('maxFileSize');
        expect(config).toHaveProperty('allowedFileTypes');
        expect(config).toHaveProperty('showCamera');
        expect(typeof config.aiAnalysisEnabled).toBe('boolean');
        expect(typeof config.maxFileSize).toBe('number');
        expect(Array.isArray(config.allowedFileTypes)).toBe(true);
        expect(typeof config.showCamera).toBe('boolean');
      });
    });
  });

  describe('isAiAnalysisEnabled()', () => {
    it('should return true for bills (AI enabled by default)', () => {
      expect(isAiAnalysisEnabled('bills')).toBe(true);
    });

    it('should return false for other form types (AI disabled by default)', () => {
      const disabledTypes = ['buildings', 'residences', 'bugs', 'features', 'documents', 'maintenance'];
      disabledTypes.forEach(type => {
        expect(isAiAnalysisEnabled(type)).toBe(false);
      });
    });

    it('should return false for unknown form types (default to documents config)', () => {
      const unknownTypes = ['unknown', 'invalid', '', null, undefined];
      unknownTypes.forEach(type => {
        expect(isAiAnalysisEnabled(type as any)).toBe(false);
      });
    });
  });

  describe('Storage Path Validation', () => {
    it('should not include "uploads" prefix in generated paths', () => {
      const context: UploadContext = {
        type: 'documents',
        organizationId: 'org-test',
        userRole: 'admin'
      };

      const result = generateStorageDirectory(context);
      expect(result.startsWith('uploads/')).toBe(false);
      expect(result.includes('/uploads/')).toBe(false);
    });

    it('should generate paths that prevent uploads/uploads duplication', () => {
      const contexts = [
        { type: 'bills', organizationId: 'org-1', userRole: 'manager' },
        { type: 'buildings', organizationId: 'org-1', buildingId: 'building-1', userRole: 'resident' },
        { type: 'residences', organizationId: 'org-1', buildingId: 'building-1', residenceId: 'residence-1', userRole: 'tenant', userId: 'user-1' }
      ];

      contexts.forEach(context => {
        const result = generateStorageDirectory(context as UploadContext);
        expect(result).not.toMatch(/uploads.*uploads/); // No double uploads
        expect(result).not.toMatch(/\/\//); // No double slashes
      });
    });

    it('should generate valid directory names without special characters', () => {
      const context: UploadContext = {
        type: 'documents',
        organizationId: 'org-123',
        buildingId: 'building-456',
        residenceId: 'residence-789',
        userRole: 'tenant',
        userId: 'user-abc'
      };

      const result = generateStorageDirectory(context);
      const parts = result.split('/');
      
      parts.forEach(part => {
        expect(part).not.toBe(''); // No empty parts
        expect(part).toMatch(/^[a-zA-Z0-9_-]+$/); // Only alphanumeric, underscore, hyphen
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined context gracefully', () => {
      expect(() => generateStorageDirectory(null as any)).toThrow();
      expect(() => generateStorageDirectory(undefined as any)).toThrow();
    });

    it('should handle empty string values in context', () => {
      const context: UploadContext = {
        type: 'documents',
        organizationId: '',
        buildingId: '',
        residenceId: '',
        userRole: '',
        userId: ''
      };

      const result = generateStorageDirectory(context);
      expect(result).toBe('documents/org_default/role_user');
    });

    it('should handle special characters in IDs', () => {
      const context: UploadContext = {
        type: 'documents',
        organizationId: 'org-with-special@chars!',
        buildingId: 'building-with#symbols$',
        userRole: 'admin'
      };

      const result = generateStorageDirectory(context);
      expect(result).toBe('documents/org_org-with-special@chars!/building_building-with#symbols$/role_admin');
    });

    it('should validate all upload form types exist', () => {
      const expectedTypes = ['bills', 'buildings', 'residences', 'bugs', 'features', 'documents', 'maintenance'];
      expectedTypes.forEach(type => {
        expect(UPLOAD_FORM_CONFIGS[type]).toBeDefined();
      });
    });

    it('should ensure consistent configuration structure', () => {
      const requiredFields = ['aiAnalysisEnabled', 'maxFileSize', 'allowedFileTypes', 'showCamera'];
      
      Object.entries(UPLOAD_FORM_CONFIGS).forEach(([type, config]) => {
        requiredFields.forEach(field => {
          expect(config).toHaveProperty(field);
        });
        
        // Validate field types
        expect(typeof config.aiAnalysisEnabled).toBe('boolean');
        expect(typeof config.maxFileSize).toBe('number');
        expect(Array.isArray(config.allowedFileTypes)).toBe(true);
        expect(typeof config.showCamera).toBe('boolean');
        
        // Validate field values
        expect(config.maxFileSize).toBeGreaterThan(0);
        expect(config.allowedFileTypes.length).toBeGreaterThan(0);
      });
    });
  });
});