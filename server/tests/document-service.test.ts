import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { documentService, DocumentContext } from '../services/document-service';

describe('DocumentService Unit Tests', () => {
  describe('normalizeFilename', () => {
    it('should normalize simple filenames', () => {
      const result = documentService.normalizeFilename('test-file.pdf');
      expect(result).toBe('test-file.pdf');
    });

    it('should convert uppercase to lowercase', () => {
      const result = documentService.normalizeFilename('TEST-FILE.PDF');
      expect(result).toBe('test-file.pdf');
    });

    it('should replace spaces with underscores', () => {
      const result = documentService.normalizeFilename('my test file.pdf');
      expect(result).toBe('my_test_file.pdf');
    });

    it('should remove accented characters', () => {
      const result = documentService.normalizeFilename('résumé-été.pdf');
      expect(result).toBe('resume-ete.pdf');
    });

    it('should replace special characters with underscores', () => {
      const result = documentService.normalizeFilename('file@#$%name.pdf');
      expect(result).toBe('file_name.pdf');
    });

    it('should collapse multiple underscores into one', () => {
      const result = documentService.normalizeFilename('file___name.pdf');
      expect(result).toBe('file_name.pdf');
    });

    it('should remove leading and trailing underscores', () => {
      const result = documentService.normalizeFilename('_file_name_.pdf');
      expect(result).toBe('file_name_.pdf');
    });

    it('should truncate long filenames while preserving extension', () => {
      const longName = 'a'.repeat(250) + '.pdf';
      const result = documentService.normalizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(200);
      expect(result.endsWith('.pdf')).toBe(true);
    });

    it('should generate fallback for empty filename', () => {
      const result = documentService.normalizeFilename('');
      expect(result).toMatch(/^file_[a-f0-9]{8}$/);
    });

    it('should handle French document names', () => {
      const result = documentService.normalizeFilename('Contrat de location été 2024.pdf');
      expect(result).toBe('contrat_de_location_ete_2024.pdf');
    });
  });

  describe('normalizePath', () => {
    it('should add /objects/ prefix to paths without it', () => {
      const result = documentService.normalizePath('buildings/123/documents/file.pdf');
      expect(result).toBe('/objects/buildings/123/documents/file.pdf');
    });

    it('should not double-add prefix if already present', () => {
      const result = documentService.normalizePath('/objects/buildings/123/documents/file.pdf');
      expect(result).toBe('/objects/buildings/123/documents/file.pdf');
    });

    it('should handle paths with leading slashes', () => {
      const result = documentService.normalizePath('/buildings/123/documents/file.pdf');
      expect(result).toBe('/objects/buildings/123/documents/file.pdf');
    });

    it('should handle paths with multiple leading slashes', () => {
      const result = documentService.normalizePath('///buildings/123/documents/file.pdf');
      expect(result).toBe('/objects/buildings/123/documents/file.pdf');
    });

    it('should return empty/null paths unchanged', () => {
      expect(documentService.normalizePath('')).toBe('');
    });
  });

  describe('getStoragePath', () => {
    it('should remove /objects/ prefix from paths', () => {
      const result = documentService.getStoragePath('/objects/buildings/123/documents/file.pdf');
      expect(result).toBe('buildings/123/documents/file.pdf');
    });

    it('should return paths without prefix unchanged', () => {
      const result = documentService.getStoragePath('buildings/123/documents/file.pdf');
      expect(result).toBe('buildings/123/documents/file.pdf');
    });
  });

  describe('buildHierarchicalPath', () => {
    it('should build correct path for building documents', () => {
      const context: DocumentContext = {
        type: 'documents',
        buildingId: 'building-123',
      };
      const result = documentService.buildHierarchicalPath(context, 'test.pdf');
      expect(result).toMatch(/^buildings\/building-123\/documents\/[a-f0-9-]+_test\.pdf$/);
    });

    it('should build correct path for bill documents', () => {
      const context: DocumentContext = {
        type: 'bills',
        buildingId: 'building-123',
        entityId: 'bill-456',
      };
      const result = documentService.buildHierarchicalPath(context, 'invoice.pdf');
      expect(result).toMatch(/^buildings\/building-123\/bills\/[a-f0-9-]+_invoice\.pdf$/);
    });

    it('should build correct path for inventory documents', () => {
      const context: DocumentContext = {
        type: 'inventory',
        buildingId: 'building-123',
      };
      const result = documentService.buildHierarchicalPath(context, 'inventory-item.pdf');
      expect(result).toMatch(/^buildings\/building-123\/inventory\/[a-f0-9-]+_inventory-item\.pdf$/);
    });

    it('should build correct path for project documents', () => {
      const context: DocumentContext = {
        type: 'projects',
        buildingId: 'building-123',
      };
      const result = documentService.buildHierarchicalPath(context, 'project-spec.pdf');
      expect(result).toMatch(/^buildings\/building-123\/projects\/[a-f0-9-]+_project-spec\.pdf$/);
    });

    it('should build correct path for demand documents', () => {
      const context: DocumentContext = {
        type: 'demands',
        buildingId: 'building-123',
      };
      const result = documentService.buildHierarchicalPath(context, 'demand.pdf');
      expect(result).toMatch(/^buildings\/building-123\/demands\/[a-f0-9-]+_demand\.pdf$/);
    });

    it('should build correct path for residence documents', () => {
      const context: DocumentContext = {
        type: 'documents',
        buildingId: 'building-123',
        residenceId: 'residence-456',
      };
      const result = documentService.buildHierarchicalPath(context, 'lease.pdf');
      expect(result).toMatch(/^buildings\/building-123\/residences\/residence-456\/documents\/[a-f0-9-]+_lease\.pdf$/);
    });

    it('should build correct path for bug attachments', () => {
      const context: DocumentContext = {
        type: 'bugs',
        entityId: 'bug-123',
      };
      const result = documentService.buildHierarchicalPath(context, 'screenshot.png');
      expect(result).toMatch(/^bugs\/bug-123\/[a-f0-9-]+_screenshot\.png$/);
    });

    it('should build correct path for feature attachments', () => {
      const context: DocumentContext = {
        type: 'features',
        entityId: 'feature-789',
      };
      const result = documentService.buildHierarchicalPath(context, 'mockup.png');
      expect(result).toMatch(/^features\/feature-789\/[a-f0-9-]+_mockup\.png$/);
    });

    it('should throw error if buildingId missing for building-level documents', () => {
      const context: DocumentContext = {
        type: 'documents',
      };
      expect(() => documentService.buildHierarchicalPath(context, 'test.pdf'))
        .toThrow('buildingId is required');
    });

    it('should include UUID in filename for uniqueness', () => {
      const context: DocumentContext = {
        type: 'documents',
        buildingId: 'building-123',
      };
      const result1 = documentService.buildHierarchicalPath(context, 'test.pdf');
      const result2 = documentService.buildHierarchicalPath(context, 'test.pdf');
      expect(result1).not.toBe(result2);
    });
  });

  describe('canUserAccessDocument (admin bypass)', () => {
    it('should allow admin users full access', async () => {
      const result = await documentService.canUserAccessDocument(
        'admin-user-id',
        'admin',
        '/objects/buildings/123/documents/test.pdf'
      );
      expect(result.allowed).toBe(true);
    });

    it('should allow demo_admin users full access', async () => {
      const result = await documentService.canUserAccessDocument(
        'demo-admin-id',
        'demo_admin',
        '/objects/buildings/123/documents/test.pdf'
      );
      expect(result.allowed).toBe(true);
    });
  });
});

describe('DocumentService Path Consistency Tests', () => {
  it('should maintain path consistency between normalizePath and getStoragePath', () => {
    const originalPath = 'buildings/123/documents/file.pdf';
    const normalized = documentService.normalizePath(originalPath);
    const storage = documentService.getStoragePath(normalized);
    expect(storage).toBe(originalPath);
  });

  it('should handle round-trip path conversion', () => {
    const paths = [
      'buildings/abc-123/documents/uuid_file.pdf',
      'buildings/xyz/bills/uuid_invoice.pdf',
      'buildings/test/residences/res-1/documents/uuid_lease.pdf',
      'bugs/bug-id/uuid_screenshot.png',
      'features/feat-id/uuid_mockup.jpg',
    ];

    for (const path of paths) {
      const normalized = documentService.normalizePath(path);
      expect(normalized.startsWith('/objects/')).toBe(true);
      const stripped = documentService.getStoragePath(normalized);
      expect(stripped).toBe(path);
    }
  });

  it('should generate valid paths for all document types', () => {
    const types = ['documents', 'bills', 'inventory', 'projects', 'demands'] as const;
    const buildingId = 'test-building-id';

    for (const type of types) {
      const context: DocumentContext = {
        type,
        buildingId,
      };
      const path = documentService.buildHierarchicalPath(context, 'test-file.pdf');
      expect(path).toContain(`buildings/${buildingId}/${type === 'demands' ? 'demands' : type}/`);
      expect(path).toContain('test-file.pdf');
    }
  });
});
