/**
 * ACL Integration Tests with Mocked Dependencies
 * 
 * These tests use dependency injection to verify ACL behavior with controlled scenarios:
 * - Allow scenarios: When ACL grants access
 * - Deny scenarios: When ACL blocks access
 * - Admin bypass: No ACL check needed
 * - File not found: Fallback behavior
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  createDocumentService, 
  DocumentContext, 
  AccessCheckResult,
  DocumentServiceDependencies,
  AclEvaluator 
} from '../services/document-service';
import { ObjectStorageService, ObjectNotFoundError } from '../objectStorage';
import { ObjectPermission } from '../objectAcl';

class MockObjectStorageService {
  private files: Map<string, any> = new Map();
  public getObjectEntityFileCalls: string[] = [];

  addFile(path: string, file: any = { name: 'mock-file' }) {
    this.files.set(path, file);
  }

  async getObjectEntityFile(path: string) {
    this.getObjectEntityFileCalls.push(path);
    if (this.files.has(path)) {
      return this.files.get(path);
    }
    throw new ObjectNotFoundError();
  }

  async getCustomPathUploadURL(path: string) {
    return `https://storage.example.com/upload?path=${path}`;
  }

  async trySetObjectEntityAclPolicy(path: string, policy: any) {
    return true;
  }

  getPublicObjectSearchPaths() {
    return ['/public'];
  }

  getPrivateObjectDir() {
    return '/.private';
  }
}

function createMockAclEvaluator(defaultResult: boolean = false): AclEvaluator & { setCalls: any[], results: Map<string, boolean> } {
  const results = new Map<string, boolean>();
  const setCalls: any[] = [];
  
  return {
    results,
    setCalls,
    canAccessObject: async (args: { userId: string; objectFile: any; requestedPermission: ObjectPermission }) => {
      setCalls.push(args);
      const key = `${args.userId}:${args.objectFile?.name || 'unknown'}`;
      if (results.has(key)) {
        return results.get(key)!;
      }
      return defaultResult;
    },
  };
}

describe('ACL Mocked Integration Tests', () => {
  let mockStorage: MockObjectStorageService;
  let mockAcl: ReturnType<typeof createMockAclEvaluator>;

  beforeEach(() => {
    mockStorage = new MockObjectStorageService();
    mockAcl = createMockAclEvaluator(false);
  });

  describe('Admin Role Bypass', () => {
    it('should allow admin access without calling storage or ACL', async () => {
      const service = createDocumentService({
        objectStorage: mockStorage as unknown as ObjectStorageService,
        aclEvaluator: mockAcl,
      });

      const result = await service.canUserAccessDocument(
        'admin-user-id',
        'admin',
        '/objects/buildings/123/documents/sensitive.pdf'
      );

      expect(result).toEqual({ allowed: true });
      expect(mockStorage.getObjectEntityFileCalls).toHaveLength(0);
      expect(mockAcl.setCalls).toHaveLength(0);
    });

    it('should allow demo_admin access without calling storage or ACL', async () => {
      const service = createDocumentService({
        objectStorage: mockStorage as unknown as ObjectStorageService,
        aclEvaluator: mockAcl,
      });

      const result = await service.canUserAccessDocument(
        'demo-admin-id',
        'demo_admin',
        '/objects/buildings/456/bills/invoice.pdf'
      );

      expect(result).toEqual({ allowed: true });
      expect(mockStorage.getObjectEntityFileCalls).toHaveLength(0);
    });
  });

  describe('ACL Allow Scenarios', () => {
    it('should return allowed=true when ACL grants access', async () => {
      mockStorage.addFile('/objects/buildings/managed-building/documents/report.pdf', { name: 'report.pdf' });
      mockAcl.results.set('manager-user-id:report.pdf', true);

      const service = createDocumentService({
        objectStorage: mockStorage as unknown as ObjectStorageService,
        aclEvaluator: mockAcl,
      });

      const result = await service.canUserAccessDocument(
        'manager-user-id',
        'manager',
        '/objects/buildings/managed-building/documents/report.pdf'
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(mockAcl.setCalls).toHaveLength(1);
    });

    it('should allow tenant access to their building documents when ACL permits', async () => {
      mockStorage.addFile('/objects/buildings/tenant-building/bills/utility.pdf', { name: 'utility.pdf' });
      mockAcl.results.set('tenant-user-id:utility.pdf', true);

      const service = createDocumentService({
        objectStorage: mockStorage as unknown as ObjectStorageService,
        aclEvaluator: mockAcl,
      });

      const result = await service.canUserAccessDocument(
        'tenant-user-id',
        'tenant',
        '/objects/buildings/tenant-building/bills/utility.pdf'
      );

      expect(result.allowed).toBe(true);
    });

    it('should allow resident access to their residence documents when ACL permits', async () => {
      mockStorage.addFile('/objects/buildings/res-building/residences/unit-101/documents/lease.pdf', { name: 'lease.pdf' });
      mockAcl.results.set('resident-user-id:lease.pdf', true);

      const service = createDocumentService({
        objectStorage: mockStorage as unknown as ObjectStorageService,
        aclEvaluator: mockAcl,
      });

      const result = await service.canUserAccessDocument(
        'resident-user-id',
        'resident',
        '/objects/buildings/res-building/residences/unit-101/documents/lease.pdf'
      );

      expect(result.allowed).toBe(true);
    });
  });

  describe('ACL Deny Scenarios', () => {
    it('should return allowed=false with reason when ACL denies access', async () => {
      mockStorage.addFile('/objects/buildings/other-building/documents/private.pdf', { name: 'private.pdf' });
      mockAcl.results.set('tenant-user-id:private.pdf', false);

      const service = createDocumentService({
        objectStorage: mockStorage as unknown as ObjectStorageService,
        aclEvaluator: mockAcl,
      });

      const result = await service.canUserAccessDocument(
        'tenant-user-id',
        'tenant',
        '/objects/buildings/other-building/documents/private.pdf'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Access denied by ACL policy');
    });

    it('should deny tenant access to another building', async () => {
      mockStorage.addFile('/objects/buildings/building-b/documents/sensitive.pdf', { name: 'sensitive.pdf' });

      const service = createDocumentService({
        objectStorage: mockStorage as unknown as ObjectStorageService,
        aclEvaluator: mockAcl,
      });

      const result = await service.canUserAccessDocument(
        'tenant-in-building-a',
        'tenant',
        '/objects/buildings/building-b/documents/sensitive.pdf'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Access denied by ACL policy');
    });

    it('should deny resident access to another residence', async () => {
      mockStorage.addFile('/objects/buildings/building-1/residences/unit-202/documents/other-lease.pdf', { name: 'other-lease.pdf' });

      const service = createDocumentService({
        objectStorage: mockStorage as unknown as ObjectStorageService,
        aclEvaluator: mockAcl,
      });

      const result = await service.canUserAccessDocument(
        'resident-in-unit-101',
        'resident',
        '/objects/buildings/building-1/residences/unit-202/documents/other-lease.pdf'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Access denied by ACL policy');
    });

    it('should deny demo_manager access to non-demo building when ACL denies', async () => {
      mockStorage.addFile('/objects/buildings/real-building/documents/production-data.pdf', { name: 'production-data.pdf' });

      const service = createDocumentService({
        objectStorage: mockStorage as unknown as ObjectStorageService,
        aclEvaluator: mockAcl,
      });

      const result = await service.canUserAccessDocument(
        'demo-manager-id',
        'demo_manager',
        '/objects/buildings/real-building/documents/production-data.pdf'
      );

      expect(result.allowed).toBe(false);
    });
  });

  describe('File Not Found Fallback', () => {
    it('should allow access when file not found (fallback for 404 handling)', async () => {
      const service = createDocumentService({
        objectStorage: mockStorage as unknown as ObjectStorageService,
        aclEvaluator: mockAcl,
      });

      const result = await service.canUserAccessDocument(
        'manager-id',
        'manager',
        '/objects/buildings/nonexistent/documents/missing.pdf'
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('File not found');
    });
  });

  describe('Path Normalization in ACL Checks', () => {
    it('should normalize path before storage lookup', async () => {
      mockStorage.addFile('/objects/buildings/123/documents/file.pdf', { name: 'file.pdf' });
      mockAcl.results.set('user-id:file.pdf', true);

      const service = createDocumentService({
        objectStorage: mockStorage as unknown as ObjectStorageService,
        aclEvaluator: mockAcl,
      });

      await service.canUserAccessDocument(
        'user-id',
        'manager',
        'buildings/123/documents/file.pdf'
      );

      expect(mockStorage.getObjectEntityFileCalls[0]).toBe('/objects/buildings/123/documents/file.pdf');
    });
  });
});

describe('Multi-Role ACL Scenarios', () => {
  let mockStorage: MockObjectStorageService;
  let mockAcl: ReturnType<typeof createMockAclEvaluator>;

  beforeEach(() => {
    mockStorage = new MockObjectStorageService();
    mockAcl = createMockAclEvaluator(false);
  });

  it('should handle manager with multi-building access', async () => {
    const paths = [
      '/objects/buildings/building-a/documents/doc1.pdf',
      '/objects/buildings/building-b/documents/doc2.pdf',
      '/objects/buildings/building-c/bills/bill.pdf',
    ];

    for (const path of paths) {
      const filename = path.split('/').pop()!;
      mockStorage.addFile(path, { name: filename });
      mockAcl.results.set(`multi-building-manager:${filename}`, true);
    }

    const service = createDocumentService({
      objectStorage: mockStorage as unknown as ObjectStorageService,
      aclEvaluator: mockAcl,
    });

    for (const path of paths) {
      const result = await service.canUserAccessDocument(
        'multi-building-manager',
        'manager',
        path
      );
      expect(result.allowed).toBe(true);
    }
  });

  it('should handle mixed access scenarios', async () => {
    mockStorage.addFile('/objects/buildings/b1/documents/allowed.pdf', { name: 'allowed.pdf' });
    mockStorage.addFile('/objects/buildings/b2/documents/denied.pdf', { name: 'denied.pdf' });
    mockAcl.results.set('mixed-user:allowed.pdf', true);
    mockAcl.results.set('mixed-user:denied.pdf', false);

    const service = createDocumentService({
      objectStorage: mockStorage as unknown as ObjectStorageService,
      aclEvaluator: mockAcl,
    });

    const allowedResult = await service.canUserAccessDocument(
      'mixed-user',
      'manager',
      '/objects/buildings/b1/documents/allowed.pdf'
    );
    expect(allowedResult.allowed).toBe(true);

    const deniedResult = await service.canUserAccessDocument(
      'mixed-user',
      'manager',
      '/objects/buildings/b2/documents/denied.pdf'
    );
    expect(deniedResult.allowed).toBe(false);
    expect(deniedResult.reason).toBe('Access denied by ACL policy');
  });
});

describe('Bill Document ACL Scenarios', () => {
  let mockStorage: MockObjectStorageService;
  let mockAcl: ReturnType<typeof createMockAclEvaluator>;

  beforeEach(() => {
    mockStorage = new MockObjectStorageService();
    mockAcl = createMockAclEvaluator(false);
  });

  it('should allow manager access to building bills when ACL permits', async () => {
    mockStorage.addFile('/objects/buildings/billing-building/bills/invoice_2024.pdf', { name: 'invoice_2024.pdf' });
    mockAcl.results.set('billing-manager:invoice_2024.pdf', true);

    const service = createDocumentService({
      objectStorage: mockStorage as unknown as ObjectStorageService,
      aclEvaluator: mockAcl,
    });

    const result = await service.canUserAccessDocument(
      'billing-manager',
      'manager',
      '/objects/buildings/billing-building/bills/invoice_2024.pdf'
    );

    expect(result.allowed).toBe(true);
  });

  it('should deny tenant access to other building bills', async () => {
    mockStorage.addFile('/objects/buildings/other-building/bills/confidential.pdf', { name: 'confidential.pdf' });

    const service = createDocumentService({
      objectStorage: mockStorage as unknown as ObjectStorageService,
      aclEvaluator: mockAcl,
    });

    const result = await service.canUserAccessDocument(
      'tenant-in-different-building',
      'tenant',
      '/objects/buildings/other-building/bills/confidential.pdf'
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Access denied by ACL policy');
  });
});
