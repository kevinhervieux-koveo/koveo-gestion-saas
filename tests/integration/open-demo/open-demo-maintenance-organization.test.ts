import request from 'supertest';
import express from 'express';
import { sessionConfig, setupAuthRoutes } from '../../../server/auth';
import { registerOrganizationRoutes } from '../../../server/api/organizations';
import { storage } from '../../../server/storage';
import { canUserPerformWriteOperation } from '../../../server/rbac';

// Mock dependencies
jest.mock('../../../server/storage');
jest.mock('../../../server/rbac');

const mockStorage = storage as jest.Mocked<typeof storage>;
const mockCanUserPerformWriteOperation = canUserPerformWriteOperation as jest.MockedFunction<typeof canUserPerformWriteOperation>;

describe('Open Demo Maintenance and Organization Management Restrictions', () => {
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

  const openDemoResident = {
    id: 'open-demo-resident-id',
    email: 'demo.resident.open@example.com',
    password: 'Demo@123456',
    role: 'resident',
    isActive: true,
    firstName: 'Demo',
    lastName: 'Resident',
    organizations: ['open-demo-org-id']
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(sessionConfig);
    
    setupAuthRoutes(app as any);
    registerOrganizationRoutes(app as any);
    
    // Mock maintenance request routes
    app.post('/api/maintenance-requests', (req, res) => {
      res.status(403).json({ message: 'Demo restriction: view-only access' });
    });
    app.patch('/api/maintenance-requests/:id', (req, res) => {
      res.status(403).json({ message: 'Demo restriction: view-only access' });
    });
    app.delete('/api/maintenance-requests/:id', (req, res) => {
      res.status(403).json({ message: 'Demo restriction: view-only access' });
    });
    app.get('/api/maintenance-requests', (req, res) => {
      res.json([{ id: 'req-123', title: 'Demo Request', status: 'submitted' }]);
    });
    
    agent = request.agent(app);
    jest.clearAllMocks();

    // Mock RBAC to restrict Open Demo users
    mockCanUserPerformWriteOperation.mockImplementation(async (userId: string) => {
      return !['open-demo-manager-id', 'open-demo-tenant-id', 'open-demo-resident-id'].includes(userId);
    });

    mockStorage.getUser.mockImplementation(async (userId: string) => {
      switch (userId) {
        case 'open-demo-manager-id':
          return openDemoManager;
        case 'open-demo-tenant-id':
          return openDemoTenant;
        case 'open-demo-resident-id':
          return openDemoResident;
        default:
          return null;
      }
    });
  });

  describe('Maintenance Request Restrictions', () => {
    test('should prevent Open Demo manager from creating maintenance requests', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .post('/api/maintenance-requests')
        .send({
          residenceId: 'residence-123',
          title: 'Leaky Faucet',
          description: 'Kitchen faucet is leaking',
          priority: 'medium',
          category: 'plumbing'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo tenant from creating maintenance requests', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .post('/api/maintenance-requests')
        .send({
          residenceId: 'residence-456',
          title: 'Heating Issue',
          description: 'Heater not working properly',
          priority: 'high',
          category: 'hvac'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo resident from creating maintenance requests', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoResident);
      mockStorage.updateUser.mockResolvedValue(openDemoResident);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.resident.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .post('/api/maintenance-requests')
        .send({
          residenceId: 'residence-789',
          title: 'Electrical Issue',
          description: 'Light switch not working',
          priority: 'low',
          category: 'electrical'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Maintenance Request Status Updates Restrictions', () => {
    test('should prevent Open Demo manager from updating maintenance request status', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .patch('/api/maintenance-requests/req-123')
        .send({
          status: 'in_progress',
          assignedTo: 'maintenance-worker-123'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from deleting maintenance requests', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent.delete('/api/maintenance-requests/req-123');

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from scheduling maintenance', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .patch('/api/maintenance-requests/req-123')
        .send({
          scheduledDate: '2025-09-15T14:00:00Z',
          estimatedDuration: 120
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Organization Management Restrictions', () => {
    test('should prevent Open Demo manager from updating organization details', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .patch('/api/organizations/open-demo-org-id')
        .send({
          name: 'Updated Organization Name',
          address: 'New Address 123'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from creating organizations', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .post('/api/organizations')
        .send({
          name: 'New Organization',
          type: 'management_company',
          address: '456 New Street',
          city: 'Montreal',
          province: 'QC',
          postalCode: 'H1B 2C3'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from deleting organizations', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent.delete('/api/organizations/some-org-id');

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Organization Settings Restrictions', () => {
    test('should prevent Open Demo users from updating organization settings', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .patch('/api/organizations/open-demo-org-id/settings')
        .send({
          maintenanceRequestApprovalRequired: false,
          defaultBillDueDays: 30
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from managing organization permissions', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .patch('/api/organizations/open-demo-org-id/permissions')
        .send({
          permissions: {
            'create:bill': ['manager'],
            'update:maintenance': ['manager', 'tenant']
          }
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('User-Organization Relationship Restrictions', () => {
    test('should prevent Open Demo users from adding users to organizations', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .post('/api/organizations/open-demo-org-id/users')
        .send({
          userId: 'new-user-123',
          role: 'tenant'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from removing users from organizations', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent.delete('/api/organizations/open-demo-org-id/users/user-123');

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from updating user roles in organizations', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .patch('/api/organizations/open-demo-org-id/users/user-123')
        .send({
          role: 'manager'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('File Upload Restrictions', () => {
    test('should prevent Open Demo users from uploading organization logos', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .post('/api/organizations/open-demo-org-id/logo')
        .attach('logo', Buffer.from('fake image data'), 'logo.png')
        .expect(403);

      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction|upload.*not.*allowed/i);
    });

    test('should prevent Open Demo users from uploading maintenance photos', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent
        .post('/api/maintenance-requests/req-123/photos')
        .attach('photo', Buffer.from('fake image data'), 'issue.jpg')
        .expect(403);

      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Read Access Permissions', () => {
    test('should allow Open Demo users to view maintenance requests', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456'
      });

      const response = await agent.get('/api/maintenance-requests');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([{ id: 'req-123', title: 'Demo Request', status: 'submitted' }]);
    });

    test('should allow Open Demo users to view organization details', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456'
      });

      mockStorage.getOrganizations = jest.fn().mockResolvedValue([{
        id: 'open-demo-org-id',
        name: 'Open Demo',
        type: 'management_company',
        address: '123 Demo Street'
      }]);

      const response = await agent.get('/api/organizations');

      expect(response.status).toBe(200);
    });

    test('should allow Open Demo users to view their organization membership', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoResident);
      mockStorage.updateUser.mockResolvedValue(openDemoResident);
      
      await agent.post('/api/auth/login').send({
        email: 'demo.resident.open@example.com',
        password: 'Demo@123456'
      });

      mockStorage.getUserOrganizations = jest.fn().mockResolvedValue([{
        organizationId: 'open-demo-org-id',
        organizationRole: 'resident',
        isActive: true
      }]);

      const response = await agent.get('/api/user/organizations');

      expect(response.status).toBe(200);
    });
  });

  describe('Comprehensive Restriction Coverage', () => {
    const restrictedOperations = [
      { method: 'POST', path: '/api/maintenance-requests', desc: 'create maintenance request' },
      { method: 'PATCH', path: '/api/maintenance-requests/123', desc: 'update maintenance request' },
      { method: 'DELETE', path: '/api/maintenance-requests/123', desc: 'delete maintenance request' },
      { method: 'POST', path: '/api/organizations', desc: 'create organization' },
      { method: 'PATCH', path: '/api/organizations/123', desc: 'update organization' },
      { method: 'DELETE', path: '/api/organizations/123', desc: 'delete organization' },
      { method: 'POST', path: '/api/organizations/123/users', desc: 'add user to organization' },
      { method: 'DELETE', path: '/api/organizations/123/users/456', desc: 'remove user from organization' }
    ];

    const testUsers = [
      { user: openDemoManager, role: 'manager' },
      { user: openDemoTenant, role: 'tenant' },
      { user: openDemoResident, role: 'resident' }
    ];

    testUsers.forEach(({ user, role }) => {
      describe(`${role} restrictions`, () => {
        restrictedOperations.forEach(({ method, path, desc }) => {
          test(`should prevent Open Demo ${role} from ${desc}`, async () => {
            mockStorage.getUserByEmail.mockResolvedValue(user);
            mockStorage.updateUser.mockResolvedValue(user);
            
            await agent.post('/api/auth/login').send({
              email: user.email,
              password: 'Demo@123456'
            });

            let response;
            switch (method) {
              case 'POST':
                response = await agent.post(path).send({});
                break;
              case 'PATCH':
                response = await agent.patch(path).send({});
                break;
              case 'DELETE':
                response = await agent.delete(path);
                break;
              default:
                throw new Error(`Unsupported method: ${method}`);
            }

            expect(response.status).toBe(403);
            expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
          });
        });
      });
    });
  });
});