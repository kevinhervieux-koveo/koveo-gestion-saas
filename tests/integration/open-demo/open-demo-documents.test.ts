import request from 'supertest';
import express from 'express';
import { sessionConfig, setupAuthRoutes } from '../../../server/auth';
import { registerDocumentRoutes } from '../../../server/api/documents';
import { storage } from '../../../server/storage';
import { canUserPerformWriteOperation, isOpenDemoUser } from '../../../server/rbac';

// Mock dependencies
jest.mock('../../../server/storage');
jest.mock('../../../server/rbac');

const mockStorage = storage as jest.Mocked<typeof storage>;
const mockCanUserPerformWriteOperation = canUserPerformWriteOperation as jest.MockedFunction<typeof canUserPerformWriteOperation>;
const mockIsOpenDemoUser = isOpenDemoUser as jest.MockedFunction<typeof isOpenDemoUser>;

describe('Open Demo Document Management Restrictions', () => {
  let app: express.Application;
  let agent: any;

  const openDemoManager = {
    id: 'open-demo-manager-id',
    email: 'demo.manager.open@example.com',
    password: 'Demo@123456',
    role: 'manager',
    isActive: true,
    firstName: 'Demo',
    lastName: 'Manager',
    organizations: ['open-demo-org-id']
  };

  const openDemoTenant = {
    id: 'open-demo-tenant-id',
    email: 'demo.tenant.open@example.com',
    password: 'Demo@123456',
    role: 'tenant',
    isActive: true,
    firstName: 'Demo',
    lastName: 'Tenant',
    organizations: ['open-demo-org-id']
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(sessionConfig);
    
    setupAuthRoutes(app as any);
    registerDocumentRoutes(app as any);
    
    agent = request.agent(app);
    jest.clearAllMocks();

    // Mock RBAC to restrict Open Demo users
    mockCanUserPerformWriteOperation.mockImplementation(async (userId: string) => {
      return !['open-demo-manager-id', 'open-demo-tenant-id', 'open-demo-resident-id'].includes(userId);
    });

    // Mock isOpenDemoUser to return true for Open Demo users
    mockIsOpenDemoUser.mockImplementation(async (userId: string) => {
      return ['open-demo-manager-id', 'open-demo-tenant-id', 'open-demo-resident-id'].includes(userId);
    });

    mockStorage.getUser.mockImplementation(async (userId: string) => {
      switch (userId) {
        case 'open-demo-manager-id':
          return openDemoManager;
        case 'open-demo-tenant-id':
          return openDemoTenant;
        default:
          return null;
      }
    });
  });

  describe('Document Upload Restrictions', () => {
    test('should prevent Open Demo manager from uploading documents', async () => {
      // Login as Open Demo manager
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .post('/api/documents')
        .attach('file', Buffer.from('test content'), 'test.pdf')
        .field('title', 'Test Document')
        .field('category', 'legal')
        .field('buildingId', 'building-123');

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction|upload.*not.*allowed/i);
    });

    test('should prevent Open Demo tenant from uploading documents', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .post('/api/documents')
        .send({
          title: 'Tenant Document',
          category: 'maintenance',
          content: 'Document content',
          buildingId: 'building-123'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent bulk document upload by Open Demo users', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .post('/api/documents/bulk')
        .send({
          documents: [
            { title: 'Doc 1', category: 'legal', buildingId: 'building-123' },
            { title: 'Doc 2', category: 'financial', buildingId: 'building-123' }
          ]
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Document Modification Restrictions', () => {
    test('should prevent Open Demo users from updating document metadata', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .patch('/api/documents/doc-123')
        .send({
          title: 'Updated Document Title',
          category: 'updated-category'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from deleting documents', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent.delete('/api/documents/doc-123');

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from archiving documents', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .patch('/api/documents/doc-123/archive')
        .send();

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Document Sharing Restrictions', () => {
    test('should prevent Open Demo users from sharing documents', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .post('/api/documents/doc-123/share')
        .send({
          shareWith: ['user-456'],
          permissions: ['read']
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from creating document links', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .post('/api/documents/doc-123/share-link')
        .send({
          expiresAt: '2025-12-31T23:59:59Z'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Document Version Control Restrictions', () => {
    test('should prevent Open Demo users from creating document versions', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .post('/api/documents/doc-123/versions')
        .attach('file', Buffer.from('updated content'), 'updated-doc.pdf')
        .field('versionNotes', 'Updated version');

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from deleting document versions', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent.delete('/api/documents/doc-123/versions/version-456');

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Document Read Access', () => {
    test('should allow Open Demo users to read documents', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      // Mock document data
      mockStorage.getDocuments = jest.fn().mockResolvedValue([{
        id: 'doc-123',
        title: 'Demo Document',
        category: 'legal',
        buildingId: 'building-123',
        createdAt: new Date()
      }]);

      const response = await agent.get('/api/documents');

      expect(response.status).toBe(200);
    });

    test('should prevent Open Demo tenants from downloading documents', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456'
      });

      // Mock document download
      mockStorage.getDocument = jest.fn().mockResolvedValue({
        id: 'doc-123',
        title: 'Demo Document',
        filePath: '/path/to/document.pdf',
        buildingId: 'building-123'
      });

      const response = await agent.get('/api/documents/doc-123/download');

      // Should prevent download (Open Demo users cannot download documents/statements)
      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/download.*not.*available.*demo|demo.*download.*restricted/i);
      expect(response.body.code).toBe('DEMO_DOWNLOAD_RESTRICTED');
    });

    test('should prevent Open Demo managers from downloading documents', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      // Mock document download
      mockStorage.getDocument = jest.fn().mockResolvedValue({
        id: 'doc-456',
        title: 'Management Document',
        filePath: '/path/to/statement.pdf',
        buildingId: 'building-456'
      });

      const response = await agent.get('/api/documents/doc-456/download');

      // Should prevent download (Open Demo users cannot download documents/statements)
      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/download.*not.*available.*demo|demo.*download.*restricted/i);
      expect(response.body.code).toBe('DEMO_DOWNLOAD_RESTRICTED');
    });

    test('should allow Open Demo users to view document metadata', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      mockStorage.getDocument = jest.fn().mockResolvedValue({
        id: 'doc-123',
        title: 'Demo Document',
        category: 'legal',
        buildingId: 'building-123',
        createdAt: new Date()
      });

      const response = await agent.get('/api/documents/doc-123');

      expect(response.status).toBe(200);
    });
  });

  describe('Document Category Management Restrictions', () => {
    test('should prevent Open Demo users from creating document categories', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .post('/api/documents/categories')
        .send({
          name: 'New Category',
          description: 'A new document category'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from updating document categories', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .patch('/api/documents/categories/category-123')
        .send({
          name: 'Updated Category Name'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });
});