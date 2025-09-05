import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { registerDocumentRoutes } from '../../server/api/documents';

/**
 * Document File Access Control Integration Tests
 * 
 * Tests the actual /api/documents/:id/file endpoint to verify:
 * - Manager and resident should have access to building files they are assigned to
 * - Tenant should have access to building files they are assigned to and marked for tenant
 * - Manager has access to all residences files in their organization  
 * - Resident has access to residence files of residences they are assigned to
 * - Tenant has access to residence files of residences they are assigned to and marked for tenant
 */

// Mock data for testing
const mockOrganizations = [
  { id: 'org-1', name: 'Test Organization', type: 'condominium' },
  { id: 'org-2', name: 'Other Organization', type: 'condominium' }
];

const mockBuildings = [
  { id: 'building-1', name: 'Building A', organizationId: 'org-1', address: '123 Main St' },
  { id: 'building-2', name: 'Building B', organizationId: 'org-1', address: '456 Oak Ave' },
  { id: 'building-3', name: 'Building C', organizationId: 'org-2', address: '789 Pine St' },
];

const mockResidences = [
  { id: 'residence-1', unitNumber: '101', buildingId: 'building-1' },
  { id: 'residence-2', unitNumber: '102', buildingId: 'building-1' },
  { id: 'residence-3', unitNumber: '201', buildingId: 'building-2' },
  { id: 'residence-4', unitNumber: '301', buildingId: 'building-3' },
];

const mockUsers = {
  admin: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
  manager: { id: 'manager-1', email: 'manager@test.com', role: 'manager' },
  resident1: { id: 'resident-1', email: 'resident1@test.com', role: 'resident' },
  resident2: { id: 'resident-2', email: 'resident2@test.com', role: 'resident' },
  tenant1: { id: 'tenant-1', email: 'tenant1@test.com', role: 'tenant' },
  tenant2: { id: 'tenant-2', email: 'tenant2@test.com', role: 'tenant' },
};

const mockDocuments = [
  // Building documents
  {
    id: 'doc-building-1-public',
    name: 'Building 1 Public Rules',
    buildingId: 'building-1',
    residenceId: null,
    isVisibleToTenants: true,
    documentType: 'bylaw',
    filePath: 'buildings/building-1/rules.pdf',
    uploadedById: 'manager-1'
  },
  {
    id: 'doc-building-1-private',
    name: 'Building 1 Manager Only',
    buildingId: 'building-1',
    residenceId: null,
    isVisibleToTenants: false,
    documentType: 'financial',
    filePath: 'buildings/building-1/budget.pdf',
    uploadedById: 'manager-1'
  },
  {
    id: 'doc-building-2-public',
    name: 'Building 2 Public Info',
    buildingId: 'building-2',
    residenceId: null,
    isVisibleToTenants: true,
    documentType: 'maintenance',
    filePath: 'buildings/building-2/maintenance.pdf',
    uploadedById: 'manager-1'
  },
  {
    id: 'doc-building-3-external',
    name: 'External Building Doc',
    buildingId: 'building-3',
    residenceId: null,
    isVisibleToTenants: true,
    documentType: 'bylaw',
    filePath: 'buildings/building-3/external.pdf',
    uploadedById: 'admin-1'
  },
  
  // Residence documents
  {
    id: 'doc-residence-1-public',
    name: 'Residence 1 Public Doc',
    buildingId: null,
    residenceId: 'residence-1',
    isVisibleToTenants: true,
    documentType: 'lease',
    filePath: 'residences/residence-1/lease.pdf',
    uploadedById: 'resident-1'
  },
  {
    id: 'doc-residence-1-private',
    name: 'Residence 1 Private Doc',
    buildingId: null,
    residenceId: 'residence-1',
    isVisibleToTenants: false,
    documentType: 'legal',
    filePath: 'residences/residence-1/private.pdf',
    uploadedById: 'resident-1'
  },
  {
    id: 'doc-residence-3-public',
    name: 'Residence 3 Public Doc',
    buildingId: null,
    residenceId: 'residence-3',
    isVisibleToTenants: true,
    documentType: 'maintenance',
    filePath: 'residences/residence-3/maintenance.pdf',
    uploadedById: 'resident-2'
  },
  {
    id: 'doc-residence-4-external',
    name: 'External Residence Doc',
    buildingId: null,
    residenceId: 'residence-4',
    isVisibleToTenants: true,
    documentType: 'lease',
    filePath: 'residences/residence-4/lease.pdf',
    uploadedById: 'tenant-2'
  }
];

const mockUserOrganizations = [
  { userId: 'manager-1', organizationId: 'org-1' },
];

const mockUserResidences = [
  { userId: 'resident-1', residenceId: 'residence-1' },
  { userId: 'resident-2', residenceId: 'residence-3' },
  { userId: 'tenant-1', residenceId: 'residence-1' },
  { userId: 'tenant-2', residenceId: 'residence-4' },
];

// Mock storage implementation
const mockStorage = {
  getUserOrganizations: jest.fn(),
  getUserResidences: jest.fn(),
  getBuildings: jest.fn(),
  getResidences: jest.fn(),
  getDocuments: jest.fn(),
};

// Mock fs module for file existence checks
const mockFs = {
  existsSync: jest.fn(),
  statSync: jest.fn(),
};

// Setup Express app for testing
let app: express.Application;

beforeEach(() => {
  jest.clearAllMocks();
  
  // Create Express app
  app = express();
  app.use(express.json());
  
  // Setup session middleware (simplified for testing)
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));
  
  // Mock authentication middleware
  const mockAuth = (req: any, res: any, next: any) => {
    if (req.user) {
      next();
    } else {
      res.status(401).json({ message: 'Unauthorized' });
    }
  };
  
  // Replace requireAuth with mock
  jest.doMock('../../server/auth', () => ({
    requireAuth: mockAuth
  }));
  
  // Mock storage module
  jest.doMock('../../server/storage', () => ({
    storage: mockStorage
  }));
  
  // Mock fs module
  jest.doMock('fs', () => mockFs);
  
  // Register document routes
  registerDocumentRoutes(app);
  
  // Setup default mock return values
  mockStorage.getBuildings.mockResolvedValue(mockBuildings);
  mockStorage.getResidences.mockResolvedValue(mockResidences);
  mockStorage.getDocuments.mockResolvedValue(mockDocuments);
  
  // Setup mock file system
  mockFs.existsSync.mockReturnValue(true);
  mockFs.statSync.mockReturnValue({
    mtime: new Date(),
    isFile: () => true
  });
});

afterEach(() => {
  jest.resetAllMocks();
  jest.clearAllMocks();
});

describe('Document File Access Control', () => {
  
  describe('Admin Access', () => {
    it('should allow admin to access any document file', async () => {
      const user = mockUsers.admin;
      mockStorage.getUserOrganizations.mockResolvedValue([]);
      mockStorage.getUserResidences.mockResolvedValue([]);
      
      const response = await request(app)
        .get('/api/documents/doc-building-1-private/file')
        .set('user', JSON.stringify(user))
        .expect(200);
        
      expect(response.status).toBe(200);
    });
  });
  
  describe('Manager Access to Building Files', () => {
    it('should allow manager to access building files in their organization', async () => {
      const user = mockUsers.manager;
      mockStorage.getUserOrganizations.mockResolvedValue([{ organizationId: 'org-1' }]);
      mockStorage.getUserResidences.mockResolvedValue([]);
      
      const response = await request(app)
        .get('/api/documents/doc-building-1-public/file')
        .set('user', JSON.stringify(user))
        .expect(200);
        
      expect(response.status).toBe(200);
    });
    
    it('should allow manager to access private building files in their organization', async () => {
      const user = mockUsers.manager;
      mockStorage.getUserOrganizations.mockResolvedValue([{ organizationId: 'org-1' }]);
      mockStorage.getUserResidences.mockResolvedValue([]);
      
      const response = await request(app)
        .get('/api/documents/doc-building-1-private/file')
        .set('user', JSON.stringify(user))
        .expect(200);
        
      expect(response.status).toBe(200);
    });
    
    it('should deny manager access to building files outside their organization', async () => {
      const user = mockUsers.manager;
      mockStorage.getUserOrganizations.mockResolvedValue([{ organizationId: 'org-1' }]);
      mockStorage.getUserResidences.mockResolvedValue([]);
      
      const response = await request(app)
        .get('/api/documents/doc-building-3-external/file')
        .set('user', JSON.stringify(user))
        .expect(403);
        
      expect(response.body.message).toBe('Access denied');
    });
  });
  
  describe('Manager Access to Residence Files', () => {
    it('should allow manager to access residence files in their organization', async () => {
      const user = mockUsers.manager;
      mockStorage.getUserOrganizations.mockResolvedValue([{ organizationId: 'org-1' }]);
      mockStorage.getUserResidences.mockResolvedValue([]);
      
      const response = await request(app)
        .get('/api/documents/doc-residence-1-public/file')
        .set('user', JSON.stringify(user))
        .expect(200);
        
      expect(response.status).toBe(200);
    });
    
    it('should deny manager access to residence files outside their organization', async () => {
      const user = mockUsers.manager;
      mockStorage.getUserOrganizations.mockResolvedValue([{ organizationId: 'org-1' }]);
      mockStorage.getUserResidences.mockResolvedValue([]);
      
      const response = await request(app)
        .get('/api/documents/doc-residence-4-external/file')
        .set('user', JSON.stringify(user))
        .expect(403);
        
      expect(response.body.message).toBe('Access denied');
    });
  });
  
  describe('Resident Access to Building Files', () => {
    it('should allow resident to access building files they are assigned to', async () => {
      const user = mockUsers.resident1; // assigned to residence-1 in building-1
      mockStorage.getUserOrganizations.mockResolvedValue([]);
      mockStorage.getUserResidences.mockResolvedValue([{ residenceId: 'residence-1' }]);
      
      const response = await request(app)
        .get('/api/documents/doc-building-1-public/file')
        .set('user', JSON.stringify(user))
        .expect(200);
        
      expect(response.status).toBe(200);
    });
    
    it('should allow resident to access private building files they are assigned to', async () => {
      const user = mockUsers.resident1; // assigned to residence-1 in building-1
      mockStorage.getUserOrganizations.mockResolvedValue([]);
      mockStorage.getUserResidences.mockResolvedValue([{ residenceId: 'residence-1' }]);
      
      const response = await request(app)
        .get('/api/documents/doc-building-1-private/file')
        .set('user', JSON.stringify(user))
        .expect(200);
        
      expect(response.status).toBe(200);
    });
    
    it('should deny resident access to building files they are not assigned to', async () => {
      const user = mockUsers.resident1; // assigned to residence-1 in building-1
      mockStorage.getUserOrganizations.mockResolvedValue([]);
      mockStorage.getUserResidences.mockResolvedValue([{ residenceId: 'residence-1' }]);
      
      const response = await request(app)
        .get('/api/documents/doc-building-2-public/file')
        .set('user', JSON.stringify(user))
        .expect(403);
        
      expect(response.body.message).toBe('Access denied');
    });
  });
  
  describe('Resident Access to Residence Files', () => {
    it('should allow resident to access residence files they are assigned to', async () => {
      const user = mockUsers.resident1; // assigned to residence-1
      mockStorage.getUserOrganizations.mockResolvedValue([]);
      mockStorage.getUserResidences.mockResolvedValue([{ residenceId: 'residence-1' }]);
      
      const response = await request(app)
        .get('/api/documents/doc-residence-1-public/file')
        .set('user', JSON.stringify(user))
        .expect(200);
        
      expect(response.status).toBe(200);
    });
    
    it('should allow resident to access private residence files they are assigned to', async () => {
      const user = mockUsers.resident1; // assigned to residence-1
      mockStorage.getUserOrganizations.mockResolvedValue([]);
      mockStorage.getUserResidences.mockResolvedValue([{ residenceId: 'residence-1' }]);
      
      const response = await request(app)
        .get('/api/documents/doc-residence-1-private/file')
        .set('user', JSON.stringify(user))
        .expect(200);
        
      expect(response.status).toBe(200);
    });
    
    it('should deny resident access to residence files they are not assigned to', async () => {
      const user = mockUsers.resident1; // assigned to residence-1
      mockStorage.getUserOrganizations.mockResolvedValue([]);
      mockStorage.getUserResidences.mockResolvedValue([{ residenceId: 'residence-1' }]);
      
      const response = await request(app)
        .get('/api/documents/doc-residence-3-public/file')
        .set('user', JSON.stringify(user))
        .expect(403);
        
      expect(response.body.message).toBe('Access denied');
    });
  });
  
  describe('Tenant Access to Building Files', () => {
    it('should allow tenant to access building files marked for tenants in assigned building', async () => {
      const user = mockUsers.tenant1; // assigned to residence-1 in building-1
      mockStorage.getUserOrganizations.mockResolvedValue([]);
      mockStorage.getUserResidences.mockResolvedValue([{ residenceId: 'residence-1' }]);
      
      const response = await request(app)
        .get('/api/documents/doc-building-1-public/file')
        .set('user', JSON.stringify(user))
        .expect(200);
        
      expect(response.status).toBe(200);
    });
    
    it('should deny tenant access to building files not marked for tenants', async () => {
      const user = mockUsers.tenant1; // assigned to residence-1 in building-1
      mockStorage.getUserOrganizations.mockResolvedValue([]);
      mockStorage.getUserResidences.mockResolvedValue([{ residenceId: 'residence-1' }]);
      
      const response = await request(app)
        .get('/api/documents/doc-building-1-private/file')
        .set('user', JSON.stringify(user))
        .expect(403);
        
      expect(response.body.message).toBe('Access denied');
    });
    
    it('should deny tenant access to building files in other buildings', async () => {
      const user = mockUsers.tenant1; // assigned to residence-1 in building-1
      mockStorage.getUserOrganizations.mockResolvedValue([]);
      mockStorage.getUserResidences.mockResolvedValue([{ residenceId: 'residence-1' }]);
      
      const response = await request(app)
        .get('/api/documents/doc-building-2-public/file')
        .set('user', JSON.stringify(user))
        .expect(403);
        
      expect(response.body.message).toBe('Access denied');
    });
  });
  
  describe('Tenant Access to Residence Files', () => {
    it('should allow tenant to access residence files marked for tenants in assigned residence', async () => {
      const user = mockUsers.tenant1; // assigned to residence-1
      mockStorage.getUserOrganizations.mockResolvedValue([]);
      mockStorage.getUserResidences.mockResolvedValue([{ residenceId: 'residence-1' }]);
      
      const response = await request(app)
        .get('/api/documents/doc-residence-1-public/file')
        .set('user', JSON.stringify(user))
        .expect(200);
        
      expect(response.status).toBe(200);
    });
    
    it('should deny tenant access to residence files not marked for tenants', async () => {
      const user = mockUsers.tenant1; // assigned to residence-1
      mockStorage.getUserOrganizations.mockResolvedValue([]);
      mockStorage.getUserResidences.mockResolvedValue([{ residenceId: 'residence-1' }]);
      
      const response = await request(app)
        .get('/api/documents/doc-residence-1-private/file')
        .set('user', JSON.stringify(user))
        .expect(403);
        
      expect(response.body.message).toBe('Access denied');
    });
    
    it('should deny tenant access to residence files in other residences', async () => {
      const user = mockUsers.tenant1; // assigned to residence-1
      mockStorage.getUserOrganizations.mockResolvedValue([]);
      mockStorage.getUserResidences.mockResolvedValue([{ residenceId: 'residence-1' }]);
      
      const response = await request(app)
        .get('/api/documents/doc-residence-3-public/file')
        .set('user', JSON.stringify(user))
        .expect(403);
        
      expect(response.body.message).toBe('Access denied');
    });
  });
  
  describe('Document Not Found Cases', () => {
    it('should return 404 for non-existent documents', async () => {
      const user = mockUsers.admin;
      mockStorage.getUserOrganizations.mockResolvedValue([]);
      mockStorage.getUserResidences.mockResolvedValue([]);
      
      const response = await request(app)
        .get('/api/documents/non-existent-doc/file')
        .set('user', JSON.stringify(user))
        .expect(404);
        
      expect(response.body.message).toBe('Document not found');
    });
  });
  
  describe('Authentication Required', () => {
    it('should require authentication for file access', async () => {
      const response = await request(app)
        .get('/api/documents/doc-building-1-public/file')
        .expect(401);
        
      expect(response.body.message).toBe('Unauthorized');
    });
  });
});

/**
 * Test Summary:
 * 
 * These tests validate the actual API endpoint /api/documents/:id/file to ensure:
 * ✅ Admin: Global access to all documents
 * ✅ Manager: Access to building files in their organization
 * ✅ Manager: Access to residence files in their organization  
 * ✅ Resident: Access to building files they are assigned to
 * ✅ Resident: Access to residence files they are assigned to
 * ✅ Tenant: Access to building files marked for tenants in assigned building
 * ✅ Tenant: Access to residence files marked for tenants in assigned residence
 * ✅ Tenant: Denied access to private documents
 * ✅ Cross-user isolation: Users cannot access files from other assignments
 * ✅ Authentication: Endpoints require valid authentication
 * ✅ Error handling: Proper 404/403/401 responses
 */