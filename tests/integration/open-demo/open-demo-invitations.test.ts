import request from 'supertest';
import express from 'express';
import { sessionConfig, setupAuthRoutes } from '../../../server/auth';
import { registerRoutes } from '../../../server/routes-minimal';
import { storage } from '../../../server/storage';
import { canUserPerformWriteOperation } from '../../../server/rbac';

// Mock dependencies
jest.mock('../../../server/storage');
jest.mock('../../../server/rbac');

const mockStorage = storage as jest.Mocked<typeof storage>;
const mockCanUserPerformWriteOperation = canUserPerformWriteOperation as jest.MockedFunction<
  typeof canUserPerformWriteOperation
>;

describe('Open Demo Invitation System Restrictions', () => {
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
    organizations: ['open-demo-org-id'],
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
  };

  beforeEach(async () => {
    app = express();
    app.use(express.json());

    // Setup all routes including invitation routes
    await registerRoutes(app);

    agent = request.agent(app);
    jest.clearAllMocks();

    // Mock RBAC to restrict Open Demo users
    mockCanUserPerformWriteOperation.mockImplementation(async (userId: string) => {
      return !['open-demo-manager-id', 'open-demo-tenant-id', 'open-demo-resident-id'].includes(
        userId
      );
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

  describe('User Invitation Restrictions', () => {
    test('should prevent Open Demo manager from sending invitations', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.post('/api/invitations').send({
        email: 'newuser@example.com',
        role: 'tenant',
        organizationId: 'open-demo-org-id',
        personalMessage: 'Welcome to our building',
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(
        /view.*only|read.*only|demo.*restriction|invit.*not.*allowed/i
      );
    });

    test('should prevent Open Demo tenant from sending invitations', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);

      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.post('/api/invitations').send({
        email: 'friend@example.com',
        role: 'resident',
        residenceId: 'residence-123',
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent bulk invitation sending by Open Demo users', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.post('/api/invitations/bulk').send({
        invitations: [
          { email: 'user1@example.com', role: 'tenant' },
          { email: 'user2@example.com', role: 'resident' },
        ],
        organizationId: 'open-demo-org-id',
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Invitation Management Restrictions', () => {
    test('should prevent Open Demo users from cancelling invitations', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.post('/api/invitations/invitation-123/cancel').send();

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from resending invitations', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);

      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.post('/api/invitations/invitation-123/resend').send();

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from updating invitation details', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.patch('/api/invitations/invitation-123').send({
        role: 'manager',
        personalMessage: 'Updated message',
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from deleting invitations', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.delete('/api/invitations/invitation-123');

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Invitation Template Management Restrictions', () => {
    test('should prevent Open Demo users from creating invitation templates', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.post('/api/invitations/templates').send({
        name: 'Welcome Template',
        subject: 'Welcome to our building',
        body: 'Welcome message...',
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from updating invitation templates', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);

      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.patch('/api/invitations/templates/template-123').send({
        body: 'Updated template body',
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Role Assignment Restrictions', () => {
    test('should prevent Open Demo users from assigning admin roles', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.post('/api/invitations').send({
        email: 'admin@example.com',
        role: 'admin',
        organizationId: 'open-demo-org-id',
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });

    test('should prevent Open Demo users from changing user roles', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.patch('/api/users/user-123/role').send({
        role: 'manager',
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Organization Invitation Settings Restrictions', () => {
    test('should prevent Open Demo users from updating invitation settings', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent
        .patch('/api/organizations/open-demo-org-id/invitation-settings')
        .send({
          requireApproval: false,
          defaultExpirationDays: 14,
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });

  describe('Read Access for Invitations', () => {
    test('should allow Open Demo users to view invitations (read-only)', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      // Mock invitation data
      mockStorage.getInvitations = jest.fn().mockResolvedValue([
        {
          id: 'invitation-123',
          email: 'user@example.com',
          role: 'tenant',
          status: 'pending',
          organizationId: 'open-demo-org-id',
          createdAt: new Date(),
        },
      ]);

      const response = await agent.get('/api/invitations');

      expect(response.status).toBe(200);
    });

    test('should allow Open Demo users to view invitation details', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoTenant);
      mockStorage.updateUser.mockResolvedValue(openDemoTenant);

      await agent.post('/api/auth/login').send({
        email: 'demo.tenant.open@example.com',
        password: 'Demo@123456',
      });

      mockStorage.getInvitation = jest.fn().mockResolvedValue({
        id: 'invitation-123',
        email: 'user@example.com',
        role: 'resident',
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const response = await agent.get('/api/invitations/invitation-123');

      expect(response.status).toBe(200);
    });

    test('should allow Open Demo users to view invitation templates', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      mockStorage.getInvitationTemplates = jest.fn().mockResolvedValue([
        {
          id: 'template-123',
          name: 'Welcome Template',
          subject: 'Welcome',
          body: 'Welcome message',
        },
      ]);

      const response = await agent.get('/api/invitations/templates');

      expect(response.status).toBe(200);
    });
  });

  describe('Security Validation', () => {
    test('should prevent Open Demo users from accessing invitation admin functions', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.get('/api/invitations/admin/stats');

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(
        /view.*only|read.*only|demo.*restriction|insufficient.*permissions/i
      );
    });

    test('should prevent Open Demo users from bulk invitation operations', async () => {
      mockStorage.getUserByEmail.mockResolvedValue(openDemoManager);
      mockStorage.updateUser.mockResolvedValue(openDemoManager);

      await agent.post('/api/auth/login').send({
        email: 'demo.manager.open@example.com',
        password: 'Demo@123456',
      });

      const response = await agent.delete('/api/invitations/bulk').send({
        invitationIds: ['inv-1', 'inv-2', 'inv-3'],
      });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/view.*only|read.*only|demo.*restriction/i);
    });
  });
});
