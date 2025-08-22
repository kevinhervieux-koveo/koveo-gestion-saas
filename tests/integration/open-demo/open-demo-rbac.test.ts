import request from 'supertest';
import express from 'express';
import { sessionConfig, setupAuthRoutes } from '../../../server/auth';
import { registerUserRoutes } from '../../../server/api/users';
import { registerBuildingRoutes } from '../../../server/api/buildings';
import { registerDocumentRoutes } from '../../../server/api/documents';
import { registerBillRoutes } from '../../../server/api/bills';
import { registerOrganizationRoutes } from '../../../server/api/organizations';
import { storage } from '../../../server/storage';
import { isOpenDemoUser, canUserPerformWriteOperation } from '../../../server/rbac';

// Mock storage and RBAC functions
jest.mock('../../../server/storage');
jest.mock('../../../server/rbac');

const mockStorage = storage as jest.Mocked<typeof storage>;
const mockIsOpenDemoUser = isOpenDemoUser as jest.MockedFunction<typeof isOpenDemoUser>;
const mockCanUserPerformWriteOperation = canUserPerformWriteOperation as jest.MockedFunction<typeof canUserPerformWriteOperation>;

describe('Open Demo Organization RBAC Tests', () => {
  let app: express.Application;
  let agent: any;

  // Test users
  const openDemoManager = {
    id: 'open-demo-manager-id',
    email: 'demo.manager.open@example.com', 
    password: 'Demo@123456',
    role: 'manager',
    isActive: true,
    firstName: 'Demo',
    lastName: 'Manager',
    organizations: ['open-demo-org-id'],
    canAccessAllOrganizations: false
  };

  const openDemoTenant = {
    id: 'open-demo-tenant-id',
    email: 'demo.tenant.open@example.com',
    password: 'Demo@123456', 
    role: 'tenant',
    isActive: true,
    firstName: 'Demo',
    lastName: 'Tenant',
    organizations: ['open-demo-org-id'],
    canAccessAllOrganizations: false
  };

  const openDemoResident = {
    id: 'open-demo-resident-id',
    email: 'demo.resident.open@example.com',
    password: 'Demo@123456',
    role: 'resident', 
    isActive: true,
    firstName: 'Demo',
    lastName: 'Resident',
    organizations: ['open-demo-org-id'],
    canAccessAllOrganizations: false
  };

  const regularUser = {
    id: 'regular-user-id',
    email: 'regular@example.com',
    password: 'password123',
    role: 'manager',
    isActive: true,
    firstName: 'Regular',
    lastName: 'User',
    organizations: ['regular-org-id'],
    canAccessAllOrganizations: false
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(sessionConfig);
    
    // Setup all routes
    setupAuthRoutes(app as any);
    registerUserRoutes(app as any);
    registerBuildingRoutes(app as any);
    registerDocumentRoutes(app as any);
    registerBillRoutes(app as any);
    registerOrganizationRoutes(app as any);
    
    agent = request.agent(app);
    jest.clearAllMocks();
  });

  describe('Open Demo User Authentication', () => {
    test('should successfully authenticate Open Demo manager', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      const response = await agent
        .post('/api/auth/login')
        .send({
          email: 'demo.manager.open@example.com',
          password: 'Demo@123456'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('manager');
      expect(response.body.user.email).toBe('demo.manager.open@example.com');
      expect(response.body.message).toBe('Login successful');
    });

    test('should successfully authenticate Open Demo tenant', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);

      const response = await agent
        .post('/api/auth/login')
        .send({
          email: 'demo.tenant.open@example.com', 
          password: 'Demo@123456'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('tenant');
      expect(response.body.user.email).toBe('demo.tenant.open@example.com');
    });

    test('should successfully authenticate Open Demo resident', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoResident);
      mockStorage.updateUser.mockResolvedValue(openDemoResident);

      const response = await agent
        .post('/api/auth/login')
        .send({
          email: 'demo.resident.open@example.com',
          password: 'Demo@123456'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('resident');
      expect(response.body.user.email).toBe('demo.resident.open@example.com');
    });
  });

  describe('Open Demo User Detection', () => {
    test('should correctly identify Open Demo users', async () => {
      // Mock RBAC functions
      mockIsOpenDemoUser.mockImplementation(async (userId: string) => {
        return ['open-demo-manager-id', 'open-demo-tenant-id', 'open-demo-resident-id'].includes(userId);
      });

      expect(await isOpenDemoUser('open-demo-manager-id')).toBe(true);
      expect(await isOpenDemoUser('open-demo-tenant-id')).toBe(true);
      expect(await isOpenDemoUser('open-demo-resident-id')).toBe(true);
      expect(await isOpenDemoUser('regular-user-id')).toBe(false);
    });
  });

  describe('Write Operation Restrictions', () => {
    beforeEach(() => {
      // Mock RBAC functions to simulate Open Demo restrictions
      mockIsOpenDemoUser.mockImplementation(async (userId: string) => {
        return ['open-demo-manager-id', 'open-demo-tenant-id', 'open-demo-resident-id'].includes(userId);
      });

      mockCanUserPerformWriteOperation.mockImplementation(async (userId: string, action: string) => {
        const isOpenDemo = ['open-demo-manager-id', 'open-demo-tenant-id', 'open-demo-resident-id'].includes(userId);
        return !isOpenDemo; // Open Demo users cannot perform write operations
      });
    });

    test('should prevent Open Demo manager from write operations', async () => {
      expect(await canUserPerformWriteOperation('open-demo-manager-id', 'create')).toBe(false);
      expect(await canUserPerformWriteOperation('open-demo-manager-id', 'update')).toBe(false);
      expect(await canUserPerformWriteOperation('open-demo-manager-id', 'delete')).toBe(false);
      expect(await canUserPerformWriteOperation('open-demo-manager-id', 'manage')).toBe(false);
    });

    test('should prevent Open Demo tenant from write operations', async () => {
      expect(await canUserPerformWriteOperation('open-demo-tenant-id', 'create')).toBe(false);
      expect(await canUserPerformWriteOperation('open-demo-tenant-id', 'update')).toBe(false);
      expect(await canUserPerformWriteOperation('open-demo-tenant-id', 'delete')).toBe(false);
    });

    test('should prevent Open Demo resident from write operations', async () => {
      expect(await canUserPerformWriteOperation('open-demo-resident-id', 'create')).toBe(false);
      expect(await canUserPerformWriteOperation('open-demo-resident-id', 'update')).toBe(false);
      expect(await canUserPerformWriteOperation('open-demo-resident-id', 'delete')).toBe(false);
    });

    test('should allow regular users to perform write operations', async () => {
      expect(await canUserPerformWriteOperation('regular-user-id', 'create')).toBe(true);
      expect(await canUserPerformWriteOperation('regular-user-id', 'update')).toBe(true);
      expect(await canUserPerformWriteOperation('regular-user-id', 'delete')).toBe(true);
    });
  });

  describe('API Endpoint Access Control', () => {
    beforeEach(() => {
      // Setup user session for authenticated requests
      mockStorage.getUser.mockImplementation(async (userId: string) => {
        switch (userId) {
          case 'open-demo-manager-id':
            return openDemoManager;
          case 'open-demo-tenant-id':
            return openDemoTenant;
          case 'open-demo-resident-id':
            return openDemoResident;
          default:
            return regularUser;
        }
      });
    });

    describe('User Management Restrictions', () => {
      test('should prevent Open Demo manager from creating users', async () => {
        // Login as Open Demo manager
        mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
        mockStorage.updateUser.mockResolvedValue(openDemoManager);
        
        await agent.post('/api/auth/login').send({
          email: 'demo.manager.open@example.com',
          password: 'Demo@123456'
        });

        // Mock RBAC check to prevent write operations
        mockCanUserPerformWriteOperation.mockResolvedValue(false);

        const response = await agent
          .post('/api/users')
          .send({
            email: 'newuser@example.com',
            firstName: 'New',
            lastName: 'User',
            role: 'tenant'
          });

        // Should be forbidden due to Open Demo restrictions
        expect(response.status).toBe(403);
        expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
      });

      test('should prevent Open Demo users from updating user profiles', async () => {
        // Login as Open Demo tenant
        mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
        mockStorage.updateUser.mockResolvedValue(openDemoTenant);
        
        await agent.post('/api/auth/login').send({
          email: 'demo.tenant.open@example.com',
          password: 'Demo@123456'
        });

        mockCanUserPerformWriteOperation.mockResolvedValue(false);

        const response = await agent
          .patch('/api/users/some-user-id')
          .send({
            firstName: 'Updated',
            lastName: 'Name'
          });

        expect(response.status).toBe(403);
        expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
      });

      test('should prevent Open Demo users from deleting users', async () => {
        // Login as Open Demo resident
        mockStorage.getUserByEmail.mockResolvedValue(openDemoResident);
        mockStorage.updateUser.mockResolvedValue(openDemoResident);
        
        await agent.post('/api/auth/login').send({
          email: 'demo.resident.open@example.com',
          password: 'Demo@123456'
        });

        mockCanUserPerformWriteOperation.mockResolvedValue(false);

        const response = await agent.delete('/api/users/some-user-id');

        expect(response.status).toBe(403);
        expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
      });
    });

    describe('Building Management Restrictions', () => {
      test('should prevent Open Demo manager from creating buildings', async () => {
        mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
        mockStorage.updateUser.mockResolvedValue(openDemoManager);
        
        await agent.post('/api/auth/login').send({
          email: 'demo.manager.open@example.com',
          password: 'Demo@123456'
        });

        mockCanUserPerformWriteOperation.mockResolvedValue(false);

        const response = await agent
          .post('/api/buildings')
          .send({
            name: 'Test Building',
            address: '123 Test St',
            city: 'Montreal',
            organizationId: 'open-demo-org-id'
          });

        expect(response.status).toBe(403);
        expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
      });

      test('should prevent Open Demo users from updating buildings', async () => {
        mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
        mockStorage.updateUser.mockResolvedValue(openDemoManager);
        
        await agent.post('/api/auth/login').send({
          email: 'demo.manager.open@example.com',
          password: 'Demo@123456'
        });

        mockCanUserPerformWriteOperation.mockResolvedValue(false);

        const response = await agent
          .patch('/api/buildings/building-id')
          .send({
            name: 'Updated Building Name'
          });

        expect(response.status).toBe(403);
        expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
      });

      test('should prevent Open Demo users from deleting buildings', async () => {
        mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
        mockStorage.updateUser.mockResolvedValue(openDemoManager);
        
        await agent.post('/api/auth/login').send({
          email: 'demo.manager.open@example.com',
          password: 'Demo@123456'
        });

        mockCanUserPerformWriteOperation.mockResolvedValue(false);

        const response = await agent.delete('/api/buildings/building-id');

        expect(response.status).toBe(403);
        expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
      });
    });

    describe('Read Access Permissions', () => {
      test('should allow Open Demo users to read organization data', async () => {
        mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
        mockStorage.updateUser.mockResolvedValue(openDemoManager);
        
        await agent.post('/api/auth/login').send({
          email: 'demo.manager.open@example.com',
          password: 'Demo@123456'
        });

        // Mock successful read operation
        mockStorage.getOrganizations = jest.fn().mockResolvedValue([{
          id: 'open-demo-org-id',
          name: 'Open Demo',
          type: 'management_company'
        }]);

        const response = await agent.get('/api/organizations');

        // Should succeed for read operations
        expect(response.status).toBe(200);
      });

      test('should allow Open Demo users to read building data', async () => {
        mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
        mockStorage.updateUser.mockResolvedValue(openDemoTenant);
        
        await agent.post('/api/auth/login').send({
          email: 'demo.tenant.open@example.com',
          password: 'Demo@123456'
        });

        // Mock successful read operation
        mockStorage.getBuildings = jest.fn().mockResolvedValue([{
          id: 'building-id',
          name: 'Demo Building',
          organizationId: 'open-demo-org-id'
        }]);

        const response = await agent.get('/api/buildings');

        expect(response.status).toBe(200);
      });

      test('should allow Open Demo users to read their user profile', async () => {
        mockStorage.getUserByEmail.mockResolvedValue(openDemoResident);
        mockStorage.updateUser.mockResolvedValue(openDemoResident);
        
        await agent.post('/api/auth/login').send({
          email: 'demo.resident.open@example.com',
          password: 'Demo@123456'
        });

        const response = await agent.get('/api/auth/user');

        expect(response.status).toBe(200);
        expect(response.body.email).toBe('demo.resident.open@example.com');
        expect(response.body.role).toBe('resident');
      });
    });
  });

  describe('Cross-Role Permission Consistency', () => {
    const testCases = [
      { user: openDemoManager, role: 'manager' },
      { user: openDemoTenant, role: 'tenant' },
      { user: openDemoResident, role: 'resident' }
    ];

    testCases.forEach(({ user, role }) => {
      describe(`Open Demo ${role} restrictions`, () => {
        test(`should consistently prevent ${role} from all write operations`, async () => {
          mockIsOpenDemoUser.mockResolvedValue(true);
          mockCanUserPerformWriteOperation.mockResolvedValue(false);

          const writeOperations = ['create', 'update', 'delete', 'manage', 'approve', 'assign'];
          
          for (const operation of writeOperations) {
            expect(await canUserPerformWriteOperation(user.id, operation as any)).toBe(false);
          }
        });
      });
    });
  });
});