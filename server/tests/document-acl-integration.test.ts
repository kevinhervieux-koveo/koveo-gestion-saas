import { describe, it, expect, beforeEach } from '@jest/globals';
import { documentService, DocumentContext, AccessCheckResult } from '../services/document-service';

describe('ACL Access Control Integration Tests', () => {
  describe('Admin Role Bypass - Direct Tests', () => {
    it('should allow admin access without checking storage', async () => {
      const result = await documentService.canUserAccessDocument(
        'admin-user-id',
        'admin',
        '/objects/buildings/123/documents/sensitive.pdf'
      );
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should allow demo_admin access to any path', async () => {
      const result = await documentService.canUserAccessDocument(
        'demo-admin-id',
        'demo_admin',
        '/objects/buildings/456/bills/invoice.pdf'
      );
      
      expect(result.allowed).toBe(true);
    });

    it('should allow admin access to all document types', async () => {
      const paths = [
        '/objects/buildings/b1/documents/doc.pdf',
        '/objects/buildings/b2/bills/bill.pdf',
        '/objects/buildings/b3/inventory/item.pdf',
        '/objects/buildings/b4/projects/project.pdf',
        '/objects/buildings/b5/demands/demand.pdf',
        '/objects/buildings/b6/residences/r1/documents/lease.pdf',
        '/objects/bugs/bug-1/screenshot.png',
        '/objects/features/feat-1/mockup.jpg',
      ];

      for (const path of paths) {
        const result = await documentService.canUserAccessDocument(
          'admin-id',
          'admin',
          path
        );
        expect(result.allowed).toBe(true);
      }
    });
  });

  describe('Non-Admin Access Check - Structure', () => {
    it('should return AccessCheckResult structure for non-admin roles', async () => {
      const roles = ['manager', 'tenant', 'resident', 'demo_manager', 'demo_tenant', 'demo_resident'];
      
      for (const role of roles) {
        const result: AccessCheckResult = await documentService.canUserAccessDocument(
          `${role}-user-id`,
          role,
          '/objects/buildings/test-building/documents/file.pdf'
        );
        
        expect(result).toHaveProperty('allowed');
        expect(typeof result.allowed).toBe('boolean');
        if (!result.allowed) {
          expect(result).toHaveProperty('reason');
          expect(typeof result.reason).toBe('string');
        }
      }
    });

    it('should normalize paths before checking access for all roles', async () => {
      const unnormalizedPath = 'buildings/123/documents/file.pdf';
      const normalizedPath = '/objects/buildings/123/documents/file.pdf';
      
      const roles = ['admin', 'manager', 'tenant', 'resident'];
      
      for (const role of roles) {
        const result1 = await documentService.canUserAccessDocument(
          'user-id',
          role,
          unnormalizedPath
        );
        
        const result2 = await documentService.canUserAccessDocument(
          'user-id',
          role,
          normalizedPath
        );
        
        expect(result1.allowed).toBe(result2.allowed);
      }
    });
  });

  describe('Path Consistency in Access Checks', () => {
    it('should handle paths with various slash patterns', async () => {
      const pathVariations = [
        'buildings/123/documents/file.pdf',
        '/buildings/123/documents/file.pdf',
        '//buildings/123/documents/file.pdf',
        '/objects/buildings/123/documents/file.pdf',
      ];

      for (const path of pathVariations) {
        const result = await documentService.canUserAccessDocument(
          'admin-id',
          'admin',
          path
        );
        expect(result.allowed).toBe(true);
      }
    });
  });
});

describe('Path Building and Normalization - Exact Assertions', () => {
  const UUID_FULL = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/;

  describe('Building Document Paths', () => {
    it('should generate exact building document path structure', () => {
      const context: DocumentContext = {
        type: 'documents',
        buildingId: 'building-uuid-exact',
      };
      const path = documentService.buildHierarchicalPath(context, 'test_document.pdf');
      
      expect(path).toMatch(/^buildings\/building-uuid-exact\/documents\/[a-f0-9-]{36}_test_document\.pdf$/);
    });

    it('should normalize to /objects/ prefix', () => {
      const context: DocumentContext = {
        type: 'documents',
        buildingId: 'building-123',
      };
      const rawPath = documentService.buildHierarchicalPath(context, 'file.pdf');
      const normalized = documentService.normalizePath(rawPath);
      
      expect(normalized).toMatch(/^\/objects\/buildings\/building-123\/documents\/[a-f0-9-]{36}_file\.pdf$/);
    });
  });

  describe('Bill Document Paths', () => {
    it('should generate exact bill document path structure', () => {
      const context: DocumentContext = {
        type: 'bills',
        buildingId: 'bill-building-uuid',
      };
      const path = documentService.buildHierarchicalPath(context, 'invoice_2024.pdf');
      
      expect(path).toMatch(/^buildings\/bill-building-uuid\/bills\/[a-f0-9-]{36}_invoice_2024\.pdf$/);
    });

    it('should normalize bill path with /objects/ prefix', () => {
      const context: DocumentContext = {
        type: 'bills',
        buildingId: 'billing-123',
      };
      const rawPath = documentService.buildHierarchicalPath(context, 'receipt.pdf');
      const normalized = documentService.normalizePath(rawPath);
      
      expect(normalized).toMatch(/^\/objects\/buildings\/billing-123\/bills\/[a-f0-9-]{36}_receipt\.pdf$/);
    });
  });

  describe('Residence Document Paths', () => {
    it('should generate exact residence document path structure', () => {
      const context: DocumentContext = {
        type: 'documents',
        buildingId: 'res-building',
        residenceId: 'unit-101',
      };
      const path = documentService.buildHierarchicalPath(context, 'lease_agreement.pdf');
      
      expect(path).toMatch(/^buildings\/res-building\/residences\/unit-101\/documents\/[a-f0-9-]{36}_lease_agreement\.pdf$/);
    });
  });

  describe('Inventory Document Paths', () => {
    it('should generate exact inventory path structure', () => {
      const context: DocumentContext = {
        type: 'inventory',
        buildingId: 'inv-building',
      };
      const path = documentService.buildHierarchicalPath(context, 'equipment_manual.pdf');
      
      expect(path).toMatch(/^buildings\/inv-building\/inventory\/[a-f0-9-]{36}_equipment_manual\.pdf$/);
    });
  });

  describe('Project Document Paths', () => {
    it('should generate exact project path structure', () => {
      const context: DocumentContext = {
        type: 'projects',
        buildingId: 'proj-building',
      };
      const path = documentService.buildHierarchicalPath(context, 'renovation_plan.pdf');
      
      expect(path).toMatch(/^buildings\/proj-building\/projects\/[a-f0-9-]{36}_renovation_plan\.pdf$/);
    });
  });

  describe('Demand Document Paths', () => {
    it('should generate exact demand path structure', () => {
      const context: DocumentContext = {
        type: 'demands',
        buildingId: 'demand-building',
      };
      const path = documentService.buildHierarchicalPath(context, 'complaint_form.pdf');
      
      expect(path).toMatch(/^buildings\/demand-building\/demands\/[a-f0-9-]{36}_complaint_form\.pdf$/);
    });
  });

  describe('Bug Attachment Paths', () => {
    it('should generate exact bug attachment path structure', () => {
      const context: DocumentContext = {
        type: 'bugs',
        entityId: 'bug-123',
      };
      const path = documentService.buildHierarchicalPath(context, 'error_screenshot.png');
      
      expect(path).toMatch(/^bugs\/bug-123\/[a-f0-9-]{36}_error_screenshot\.png$/);
    });
  });

  describe('Feature Attachment Paths', () => {
    it('should generate exact feature attachment path structure', () => {
      const context: DocumentContext = {
        type: 'features',
        entityId: 'feature-456',
      };
      const path = documentService.buildHierarchicalPath(context, 'design_mockup.png');
      
      expect(path).toMatch(/^features\/feature-456\/[a-f0-9-]{36}_design_mockup\.png$/);
    });
  });
});

describe('Path Round-Trip Integrity', () => {
  it('should maintain path integrity: build -> normalize -> storage -> normalize', () => {
    const context: DocumentContext = {
      type: 'bills',
      buildingId: 'round-trip-building',
    };
    const rawPath = documentService.buildHierarchicalPath(context, 'invoice.pdf');
    const normalized = documentService.normalizePath(rawPath);
    const storage = documentService.getStoragePath(normalized);
    const renormalized = documentService.normalizePath(storage);
    
    expect(renormalized).toBe(normalized);
    expect(normalized.startsWith('/objects/')).toBe(true);
    expect(storage.startsWith('/objects/')).toBe(false);
    expect(storage.startsWith('buildings/')).toBe(true);
  });

  it('should handle round-trip for all document types', () => {
    const contexts: Array<{ context: DocumentContext; expectedFolder: string }> = [
      { context: { type: 'documents', buildingId: 'b1' }, expectedFolder: 'documents' },
      { context: { type: 'bills', buildingId: 'b2' }, expectedFolder: 'bills' },
      { context: { type: 'inventory', buildingId: 'b3' }, expectedFolder: 'inventory' },
      { context: { type: 'projects', buildingId: 'b4' }, expectedFolder: 'projects' },
      { context: { type: 'demands', buildingId: 'b5' }, expectedFolder: 'demands' },
    ];

    for (const { context, expectedFolder } of contexts) {
      const rawPath = documentService.buildHierarchicalPath(context, 'test.pdf');
      const normalized = documentService.normalizePath(rawPath);
      const storage = documentService.getStoragePath(normalized);
      const renormalized = documentService.normalizePath(storage);
      
      expect(renormalized).toBe(normalized);
      expect(rawPath).toContain(`/${expectedFolder}/`);
    }
  });
});

describe('UUID Uniqueness and Format', () => {
  const UUID_FULL = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/;

  it('should include full UUID in generated paths', () => {
    const context: DocumentContext = {
      type: 'documents',
      buildingId: 'uuid-test-building',
    };
    const path = documentService.buildHierarchicalPath(context, 'test.pdf');
    
    const match = path.match(UUID_FULL);
    expect(match).toBeTruthy();
    expect(match![0].length).toBe(36);
  });

  it('should generate unique paths for same filename', () => {
    const context: DocumentContext = {
      type: 'bills',
      buildingId: 'unique-test-building',
    };
    
    const paths = new Set<string>();
    for (let i = 0; i < 20; i++) {
      paths.add(documentService.buildHierarchicalPath(context, 'same_file.pdf'));
    }
    
    expect(paths.size).toBe(20);
  });

  it('should place UUID before filename in path', () => {
    const context: DocumentContext = {
      type: 'documents',
      buildingId: 'building-1',
    };
    const path = documentService.buildHierarchicalPath(context, 'my_document.pdf');
    
    expect(path).toMatch(/\/[a-f0-9-]{36}_my_document\.pdf$/);
  });
});

describe('French Filename Normalization in Paths', () => {
  it('should normalize French accented characters', () => {
    const context: DocumentContext = {
      type: 'documents',
      buildingId: 'french-building',
    };
    const path = documentService.buildHierarchicalPath(context, 'Procès-verbal été 2024.pdf');
    
    expect(path).toContain('proces-verbal_ete_2024');
    expect(path).not.toContain('è');
    expect(path).not.toContain('é');
    expect(path).not.toContain(' ');
  });

  it('should lowercase all characters in path', () => {
    const context: DocumentContext = {
      type: 'bills',
      buildingId: 'case-test-building',
    };
    const path = documentService.buildHierarchicalPath(context, 'FACTURE_JANVIER.PDF');
    
    expect(path.toLowerCase()).toBe(path);
  });

  it('should preserve file extension', () => {
    const extensions = ['.pdf', '.doc', '.xlsx', '.png', '.jpg'];
    const context: DocumentContext = {
      type: 'documents',
      buildingId: 'ext-test-building',
    };
    
    for (const ext of extensions) {
      const path = documentService.buildHierarchicalPath(context, `test_file${ext}`);
      expect(path.endsWith(ext)).toBe(true);
    }
  });
});

describe('Document Type Validation', () => {
  it('should require buildingId for building-level documents', () => {
    const buildingLevelTypes: Array<'documents' | 'bills' | 'inventory' | 'projects' | 'demands'> = [
      'documents', 'bills', 'inventory', 'projects', 'demands'
    ];

    for (const type of buildingLevelTypes) {
      const context: DocumentContext = { type };
      
      expect(() => {
        documentService.buildHierarchicalPath(context, 'test.pdf');
      }).toThrow(/buildingId.*required/i);
    }
  });

  it('should not require buildingId for system-level documents', () => {
    const systemLevelContexts: DocumentContext[] = [
      { type: 'bugs', entityId: 'bug-1' },
      { type: 'features', entityId: 'feature-1' },
    ];

    for (const context of systemLevelContexts) {
      expect(() => {
        documentService.buildHierarchicalPath(context, 'test.pdf');
      }).not.toThrow();
    }
  });
});
