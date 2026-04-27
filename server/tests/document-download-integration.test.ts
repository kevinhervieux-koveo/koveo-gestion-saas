import { describe, it, expect, beforeAll, afterAll, jest, beforeEach } from '@jest/globals';
import { documentService, DocumentContext } from '../services/document-service';
import { safeMimeType } from '../utils/safe-header';
import { buildContentDisposition } from '../utils/content-disposition';

const UUID_REGEX = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/;
const SHORT_UUID = /[a-f0-9]{8}/;

describe('DocumentService Access Control Integration Tests', () => {
  describe('Admin Role Access', () => {
    it('should allow admin users full access to any document path', async () => {
      const result = await documentService.canUserAccessDocument(
        'admin-user-id',
        'admin',
        '/objects/buildings/123/documents/test.pdf'
      );
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should allow demo_admin users full access', async () => {
      const result = await documentService.canUserAccessDocument(
        'demo-admin-id',
        'demo_admin',
        '/objects/buildings/123/bills/invoice.pdf'
      );
      expect(result.allowed).toBe(true);
    });

    it('should handle paths with different building IDs', async () => {
      const paths = [
        '/objects/buildings/building-1/documents/file.pdf',
        '/objects/buildings/building-2/bills/invoice.pdf',
        '/objects/buildings/building-3/inventory/item.pdf',
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

  describe('Non-Admin Access Check - ACL Based', () => {
    it('should check ACL for manager role', async () => {
      const result = await documentService.canUserAccessDocument(
        'manager-user-id',
        'manager',
        '/objects/buildings/building-123/documents/sensitive.pdf'
      );
      expect(result).toHaveProperty('allowed');
      expect(typeof result.allowed).toBe('boolean');
      if (!result.allowed) {
        expect(result.reason).toBeDefined();
      }
    });

    it('should check ACL for tenant role', async () => {
      const result = await documentService.canUserAccessDocument(
        'tenant-user-id',
        'tenant',
        '/objects/buildings/building-456/bills/invoice.pdf'
      );
      expect(result).toHaveProperty('allowed');
      expect(typeof result.allowed).toBe('boolean');
    });

    it('should check ACL for resident role', async () => {
      const result = await documentService.canUserAccessDocument(
        'resident-user-id',
        'resident',
        '/objects/buildings/building-789/residences/unit-101/documents/lease.pdf'
      );
      expect(result).toHaveProperty('allowed');
      expect(typeof result.allowed).toBe('boolean');
    });
  });

  describe('Path Normalization in Access Checks', () => {
    it('should normalize paths before access checks', async () => {
      const rawPath = 'buildings/123/documents/file.pdf';
      const normalizedPath = '/objects/buildings/123/documents/file.pdf';
      
      const result1 = await documentService.canUserAccessDocument(
        'admin-id',
        'admin',
        rawPath
      );
      
      const result2 = await documentService.canUserAccessDocument(
        'admin-id',
        'admin',
        normalizedPath
      );
      
      expect(result1.allowed).toBe(result2.allowed);
    });

    it('should handle paths with multiple leading slashes', async () => {
      const result = await documentService.canUserAccessDocument(
        'admin-id',
        'admin',
        '///buildings/123/documents/file.pdf'
      );
      expect(result.allowed).toBe(true);
    });
  });
});

describe('DocumentService Path Building - Exact Path Assertions', () => {
  describe('Building Document Paths', () => {
    it('should generate exact path structure for building documents', () => {
      const context: DocumentContext = {
        type: 'documents',
        buildingId: 'building-uuid-123',
      };
      const path = documentService.buildHierarchicalPath(context, 'contract.pdf');
      
      expect(path).toMatch(/^buildings\/building-uuid-123\/documents\/[a-f0-9-]+_contract\.pdf$/);
      expect(path.startsWith('buildings/')).toBe(true);
      expect(path).toContain('/documents/');
      expect(path.match(UUID_REGEX)).toBeTruthy();
    });

    it('should add /objects/ prefix when normalized', () => {
      const context: DocumentContext = {
        type: 'documents',
        buildingId: 'building-abc',
      };
      const rawPath = documentService.buildHierarchicalPath(context, 'file.pdf');
      const normalizedPath = documentService.normalizePath(rawPath);
      
      expect(normalizedPath).toMatch(/^\/objects\/buildings\/building-abc\/documents\/[a-f0-9-]+_file\.pdf$/);
    });
  });

  describe('Bill Document Paths', () => {
    it('should generate exact path structure for bill documents', () => {
      const context: DocumentContext = {
        type: 'bills',
        buildingId: 'billing-building-uuid',
      };
      const path = documentService.buildHierarchicalPath(context, 'invoice_2024.pdf');
      
      expect(path).toMatch(/^buildings\/billing-building-uuid\/bills\/[a-f0-9-]+_invoice_2024\.pdf$/);
      expect(path.startsWith('buildings/')).toBe(true);
      expect(path).toContain('/bills/');
    });

    it('should normalize bill paths with /objects/ prefix', () => {
      const context: DocumentContext = {
        type: 'bills',
        buildingId: 'bill-building-123',
      };
      const rawPath = documentService.buildHierarchicalPath(context, 'receipt.pdf');
      const normalizedPath = documentService.normalizePath(rawPath);
      
      expect(normalizedPath.startsWith('/objects/')).toBe(true);
      expect(normalizedPath).toMatch(/^\/objects\/buildings\/bill-building-123\/bills\/[a-f0-9-]+_receipt\.pdf$/);
    });
  });

  describe('Residence Document Paths', () => {
    it('should generate exact path structure for residence documents', () => {
      const context: DocumentContext = {
        type: 'documents',
        buildingId: 'building-uuid',
        residenceId: 'residence-uuid',
      };
      const path = documentService.buildHierarchicalPath(context, 'lease_agreement.pdf');
      
      expect(path).toMatch(/^buildings\/building-uuid\/residences\/residence-uuid\/documents\/[a-f0-9-]+_lease_agreement\.pdf$/);
      expect(path).toContain('/residences/');
      expect(path).toContain('/documents/');
    });

    it('should normalize residence paths with /objects/ prefix', () => {
      const context: DocumentContext = {
        type: 'documents',
        buildingId: 'bld-id',
        residenceId: 'res-id',
      };
      const rawPath = documentService.buildHierarchicalPath(context, 'unit_photo.jpg');
      const normalizedPath = documentService.normalizePath(rawPath);
      
      expect(normalizedPath).toMatch(/^\/objects\/buildings\/bld-id\/residences\/res-id\/documents\/[a-f0-9-]+_unit_photo\.jpg$/);
    });
  });

  describe('Inventory Document Paths', () => {
    it('should generate exact path structure for inventory documents', () => {
      const context: DocumentContext = {
        type: 'inventory',
        buildingId: 'inv-building',
      };
      const path = documentService.buildHierarchicalPath(context, 'item_manual.pdf');
      
      expect(path).toMatch(/^buildings\/inv-building\/inventory\/[a-f0-9-]+_item_manual\.pdf$/);
      expect(path).toContain('/inventory/');
    });
  });

  describe('Project Document Paths', () => {
    it('should generate exact path structure for project documents', () => {
      const context: DocumentContext = {
        type: 'projects',
        buildingId: 'proj-building',
      };
      const path = documentService.buildHierarchicalPath(context, 'renovation_plan.pdf');
      
      expect(path).toMatch(/^buildings\/proj-building\/projects\/[a-f0-9-]+_renovation_plan\.pdf$/);
      expect(path).toContain('/projects/');
    });
  });

  describe('System-Level Document Paths', () => {
    it('should generate exact path structure for bug attachments', () => {
      const context: DocumentContext = {
        type: 'bugs',
        entityId: 'bug-12345',
      };
      const path = documentService.buildHierarchicalPath(context, 'screenshot.png');
      
      expect(path).toMatch(/^bugs\/bug-12345\/[a-f0-9-]+_screenshot\.png$/);
      expect(path.startsWith('bugs/')).toBe(true);
    });

    it('should generate exact path structure for feature attachments', () => {
      const context: DocumentContext = {
        type: 'features',
        entityId: 'feature-67890',
      };
      const path = documentService.buildHierarchicalPath(context, 'mockup.png');
      
      expect(path).toMatch(/^features\/feature-67890\/[a-f0-9-]+_mockup\.png$/);
      expect(path.startsWith('features/')).toBe(true);
    });
  });
});

describe('DocumentService Filename Normalization - Exact Behavior', () => {
  describe('French and Special Characters', () => {
    it('should normalize French accented filenames exactly', () => {
      expect(documentService.normalizeFilename('contrat été.pdf')).toMatch(/contrat_ete.*\.pdf$/);
      expect(documentService.normalizeFilename('réunion générale.pdf')).toMatch(/reunion_generale.*\.pdf$/);
      expect(documentService.normalizeFilename('procès-verbal assemblée.pdf')).toMatch(/proces-verbal_assemblee.*\.pdf$/);
    });

    it('should lowercase all characters', () => {
      const result = documentService.normalizeFilename('CONTRACT_SUMMER.PDF');
      expect(result).toMatch(/contract_summer.*\.pdf$/);
      expect(result).not.toMatch(/[A-Z]/);
    });

    it('should preserve file extensions exactly', () => {
      const extensions = ['.pdf', '.doc', '.xlsx', '.png', '.jpg', '.jpeg', '.gif'];
      for (const ext of extensions) {
        const result = documentService.normalizeFilename(`test file${ext}`);
        expect(result.endsWith(ext)).toBe(true);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should generate fallback filename for empty input', () => {
      const result = documentService.normalizeFilename('');
      expect(result).toMatch(/^file_[a-f0-9]{8}$/);
    });

    it('should handle files with no extension', () => {
      const result = documentService.normalizeFilename('readme');
      expect(result).toBe('readme');
    });

    it('should collapse multiple spaces and special chars', () => {
      const result = documentService.normalizeFilename('file   with   spaces.pdf');
      expect(result).not.toContain('   ');
      expect(result).toMatch(/file_with_spaces.*\.pdf$/);
    });

    it('should handle very long filenames', () => {
      const longName = 'a'.repeat(300) + '.pdf';
      const result = documentService.normalizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(200);
      expect(result.endsWith('.pdf')).toBe(true);
    });
  });
});

describe('Path Round-Trip Consistency', () => {
  it('should maintain consistency: normalizePath -> getStoragePath -> normalizePath', () => {
    const testPaths = [
      'buildings/123/documents/file.pdf',
      '/buildings/456/bills/invoice.pdf',
      '/objects/buildings/789/inventory/item.pdf',
    ];

    for (const original of testPaths) {
      const normalized = documentService.normalizePath(original);
      const storage = documentService.getStoragePath(normalized);
      const renormalized = documentService.normalizePath(storage);
      
      expect(renormalized).toBe(normalized);
    }
  });

  it('should extract correct storage path from normalized path', () => {
    const testCases = [
      { normalized: '/objects/buildings/123/file.pdf', storage: 'buildings/123/file.pdf' },
      { normalized: '/objects/bugs/456/image.png', storage: 'bugs/456/image.png' },
      { normalized: '/objects/features/789/doc.pdf', storage: 'features/789/doc.pdf' },
    ];

    for (const { normalized, storage } of testCases) {
      expect(documentService.getStoragePath(normalized)).toBe(storage);
    }
  });

  it('should add /objects/ prefix to all path variations', () => {
    const variations = [
      'buildings/123/file.pdf',
      '/buildings/123/file.pdf',
      '//buildings/123/file.pdf',
      '///buildings/123/file.pdf',
    ];

    for (const path of variations) {
      const normalized = documentService.normalizePath(path);
      expect(normalized).toBe('/objects/buildings/123/file.pdf');
    }
  });
});

describe('Bill Download Path Integration', () => {
  it('should generate bill paths consistent with download expectations', () => {
    const context: DocumentContext = {
      type: 'bills',
      buildingId: 'test-building-id',
    };
    const filename = 'invoice_january_2024.pdf';
    const path = documentService.buildHierarchicalPath(context, filename);
    const normalizedPath = documentService.normalizePath(path);
    const storagePath = documentService.getStoragePath(normalizedPath);
    
    expect(normalizedPath.startsWith('/objects/')).toBe(true);
    expect(normalizedPath).toContain('/buildings/test-building-id/bills/');
    expect(storagePath.startsWith('/objects/')).toBe(false);
    expect(storagePath.startsWith('buildings/')).toBe(true);
    expect(storagePath).toContain('/bills/');
    expect(storagePath).toContain('invoice_january_2024');
  });

  it('should handle special characters in bill filenames', () => {
    const context: DocumentContext = {
      type: 'bills',
      buildingId: 'building-id',
    };
    const filename = 'Facture électricité - Décembre 2024.pdf';
    const path = documentService.buildHierarchicalPath(context, filename);
    
    expect(path).not.toContain(' ');
    expect(path).not.toContain('é');
    expect(path.toLowerCase()).toBe(path);
    expect(path).toContain('facture_electricite');
    expect(path).toContain('decembre_2024');
  });
});

describe('Document Type Validation', () => {
  it('should require buildingId for building-level documents', () => {
    const types: Array<'documents' | 'bills' | 'inventory' | 'projects' | 'demands'> = [
      'documents', 'bills', 'inventory', 'projects', 'demands'
    ];

    for (const type of types) {
      const context: DocumentContext = {
        type,
      };
      
      expect(() => {
        documentService.buildHierarchicalPath(context, 'test.pdf');
      }).toThrow(/buildingId.*required/i);
    }
  });

  it('should not require buildingId for system-level documents', () => {
    const systemTypes = [
      { type: 'bugs' as const, entityId: 'bug-1' },
      { type: 'features' as const, entityId: 'feature-1' },
    ];

    for (const { type, entityId } of systemTypes) {
      const context: DocumentContext = { type, entityId };
      
      expect(() => {
        documentService.buildHierarchicalPath(context, 'test.pdf');
      }).not.toThrow();
    }
  });
});

describe('UUID Uniqueness in Paths', () => {
  it('should generate unique paths for same filename across multiple calls', () => {
    const context: DocumentContext = {
      type: 'documents',
      buildingId: 'building-id',
    };
    
    const paths = new Set<string>();
    for (let i = 0; i < 10; i++) {
      paths.add(documentService.buildHierarchicalPath(context, 'same-file.pdf'));
    }
    
    expect(paths.size).toBe(10);
  });

  it('should include full UUID in generated paths', () => {
    const context: DocumentContext = {
      type: 'bills',
      buildingId: 'building-id',
    };
    const path = documentService.buildHierarchicalPath(context, 'invoice.pdf');
    
    expect(path.match(UUID_REGEX)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// File type MIME mapping — Task #1484
// Documents surface in: buildings, residences, bills, demands, maintenance,
// support (bugs/features). The supported set is:
//   PDF · Word (.docx) · plain text (.txt) · JPEG · PNG · Excel (.xlsx)
// ---------------------------------------------------------------------------

const SUPPORTED_FILE_TYPES: Array<{ ext: string; mime: string; label: string }> = [
  { ext: 'pdf',  mime: 'application/pdf',                                                 label: 'PDF' },
  { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word' },
  { ext: 'txt',  mime: 'text/plain',                                                      label: 'Plain text' },
  { ext: 'jpg',  mime: 'image/jpeg',                                                      label: 'JPEG' },
  { ext: 'png',  mime: 'image/png',                                                       label: 'PNG' },
  { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel' },
];

describe('Supported File Type MIME Validation', () => {
  describe('safeMimeType passes canonical MIME strings through unchanged', () => {
    for (const { mime, label } of SUPPORTED_FILE_TYPES) {
      it(`should pass through ${label} MIME type: ${mime}`, () => {
        expect(safeMimeType(mime)).toBe(mime);
      });
    }

    it('should return octet-stream fallback for null', () => {
      expect(safeMimeType(null)).toBe('application/octet-stream');
    });

    it('should return octet-stream fallback for undefined', () => {
      expect(safeMimeType(undefined)).toBe('application/octet-stream');
    });

    it('should return octet-stream fallback for empty string', () => {
      expect(safeMimeType('')).toBe('application/octet-stream');
    });

    it('should reject an invalid MIME string and return fallback', () => {
      expect(safeMimeType('not-a-mime-type')).toBe('application/octet-stream');
    });
  });
});

describe('Content-Disposition: inline preview vs attachment download', () => {
  it('should produce inline disposition for preview mode', () => {
    const header = buildContentDisposition('report.pdf', { type: 'inline' });
    expect(header).toMatch(/^inline/);
    expect(header).toContain('report.pdf');
  });

  it('should produce attachment disposition for download mode', () => {
    const header = buildContentDisposition('report.pdf', { type: 'attachment' });
    expect(header).toMatch(/^attachment/);
    expect(header).toContain('report.pdf');
  });

  it('should default to attachment when no type is specified', () => {
    const header = buildContentDisposition('report.pdf');
    expect(header).toMatch(/^attachment/);
  });

  describe('per file type: inline preview', () => {
    for (const { ext, label } of SUPPORTED_FILE_TYPES) {
      it(`should build inline Content-Disposition for ${label} (.${ext})`, () => {
        const filename = `document.${ext}`;
        const header = buildContentDisposition(filename, { type: 'inline' });
        expect(header).toMatch(/^inline/);
        expect(header).toContain(filename);
      });
    }
  });

  describe('per file type: attachment download', () => {
    for (const { ext, label } of SUPPORTED_FILE_TYPES) {
      it(`should build attachment Content-Disposition for ${label} (.${ext})`, () => {
        const filename = `document.${ext}`;
        const header = buildContentDisposition(filename, { type: 'attachment' });
        expect(header).toMatch(/^attachment/);
        expect(header).toContain(filename);
      });
    }
  });

  it('should handle French filenames with RFC 5987 extended encoding for inline', () => {
    const header = buildContentDisposition('Procès-verbal assemblée.pdf', { type: 'inline' });
    expect(header).toMatch(/^inline/);
    expect(header).toContain("filename*=UTF-8''");
  });

  it('should handle French filenames with RFC 5987 extended encoding for attachment', () => {
    const header = buildContentDisposition('Facture électricité.pdf', { type: 'attachment' });
    expect(header).toMatch(/^attachment/);
    expect(header).toContain("filename*=UTF-8''");
  });
});

describe('Document path generation per module and file type', () => {
  const MODULES: Array<{ label: string; context: DocumentContext }> = [
    {
      label: 'buildings',
      context: { type: 'documents', buildingId: 'bld-001' },
    },
    {
      label: 'residences',
      context: { type: 'documents', buildingId: 'bld-001', residenceId: 'res-001' },
    },
    {
      label: 'bills',
      context: { type: 'bills', buildingId: 'bld-001' },
    },
    {
      label: 'demands',
      context: { type: 'demands', buildingId: 'bld-001' },
    },
    {
      label: 'maintenance',
      context: { type: 'maintenance', buildingId: 'bld-001' },
    },
    {
      label: 'support (bugs)',
      context: { type: 'bugs', entityId: 'bug-001' },
    },
    {
      label: 'support (features)',
      context: { type: 'features', entityId: 'feat-001' },
    },
  ];

  for (const { label, context } of MODULES) {
    describe(`module: ${label}`, () => {
      for (const { ext, label: fileLabel } of SUPPORTED_FILE_TYPES) {
        it(`should generate a valid path for ${fileLabel} (.${ext})`, () => {
          const filename = `testfile.${ext}`;
          const path = documentService.buildHierarchicalPath(context, filename);

          expect(typeof path).toBe('string');
          expect(path.length).toBeGreaterThan(0);
          expect(path).toMatch(UUID_REGEX);
          expect(path).toContain(`.${ext}`);
          expect(path).not.toContain(' ');

          const normalized = documentService.normalizePath(path);
          expect(normalized.startsWith('/objects/')).toBe(true);
        });
      }
    });
  }
});

describe('MIME type and path consistency per file type across modules', () => {
  it('should preserve PDF MIME type through safeMimeType after path is built', () => {
    const path = documentService.buildHierarchicalPath(
      { type: 'documents', buildingId: 'bld-pdf' },
      'spec.pdf'
    );
    expect(path.endsWith('.pdf')).toBe(true);
    expect(safeMimeType('application/pdf')).toBe('application/pdf');
  });

  it('should preserve Word MIME type through safeMimeType after path is built', () => {
    const path = documentService.buildHierarchicalPath(
      { type: 'projects', buildingId: 'bld-docx' },
      'renovation_plan.docx'
    );
    expect(path.endsWith('.docx')).toBe(true);
    const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    expect(safeMimeType(mime)).toBe(mime);
  });

  it('should preserve plain text MIME type through safeMimeType after path is built', () => {
    const path = documentService.buildHierarchicalPath(
      { type: 'demands', buildingId: 'bld-txt' },
      'notes.txt'
    );
    expect(path.endsWith('.txt')).toBe(true);
    expect(safeMimeType('text/plain')).toBe('text/plain');
  });

  it('should preserve JPEG MIME type through safeMimeType after path is built', () => {
    const path = documentService.buildHierarchicalPath(
      { type: 'maintenance', buildingId: 'bld-jpg' },
      'damage_photo.jpg'
    );
    expect(path.endsWith('.jpg')).toBe(true);
    expect(safeMimeType('image/jpeg')).toBe('image/jpeg');
  });

  it('should preserve PNG MIME type through safeMimeType after path is built', () => {
    const path = documentService.buildHierarchicalPath(
      { type: 'documents', buildingId: 'bld-png', residenceId: 'res-png' },
      'floor_plan.png'
    );
    expect(path.endsWith('.png')).toBe(true);
    expect(safeMimeType('image/png')).toBe('image/png');
  });

  it('should preserve Excel MIME type through safeMimeType after path is built', () => {
    const path = documentService.buildHierarchicalPath(
      { type: 'bills', buildingId: 'bld-xlsx' },
      'budget_2024.xlsx'
    );
    expect(path.endsWith('.xlsx')).toBe(true);
    const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    expect(safeMimeType(mime)).toBe(mime);
  });
});
