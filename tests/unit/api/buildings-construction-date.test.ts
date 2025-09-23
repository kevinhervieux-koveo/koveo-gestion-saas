import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';

// Define authenticated user type based on schema
interface AuthenticatedUser {
  id: string;
  role: 'admin' | 'manager' | 'tenant' | 'resident' | 'demo_manager' | 'demo_tenant' | 'demo_resident';
  organizations?: string[];
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

// Extend Express Request type to include user property
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

// Use global mocks - local mocks removed to prevent conflicts
// Global Jest configuration handles all database and schema mocking

// Import after mocks are defined
import buildingsRouter from '../../../server/api/buildings';

describe('Buildings Construction Date API Tests', () => {
  let app: express.Application;
  let agent: any;
  const testBuildingId = 'test-building-id';
  const testOrganizationId = 'test-org-id';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Setup session middleware for testing
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    }));

    // Add mock authentication to session with proper typing
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.session) {
        req.session.user = {
          id: 'test-user-id',
          role: 'manager',
          organizations: [testOrganizationId],
          email: 'test@example.com',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
        } as AuthenticatedUser;
      }
      next();
    });

    app.use('/api/buildings', buildingsRouter);
    agent = request.agent(app);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/buildings/:id - Construction Date Retrieval', () => {
    it('should return building with construction date', async () => {
      // Mock building data with construction date
      const mockBuilding = {
        id: testBuildingId,
        name: 'Test Building',
        address: '123 Test Street',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H2X 3K8',
        organizationId: testOrganizationId,
        constructionDate: '2020-06-15',
        totalUnits: 10,
        isActive: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      };

      // Note: Database queries would be mocked by global mocks in real test
      // Mock successful database response
      jest.doMock('../../../server/db', () => ({
        db: {
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([mockBuilding])
            })
          })
        }
      }));

      const response = await agent
        .get(`/api/buildings/${testBuildingId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('constructionDate');
      expect(response.body.constructionDate).toBe('2020-06-15');
      expect(response.body.id).toBe(testBuildingId);
      expect(response.body.name).toBe('Test Building');
    });

    it('should return building without construction date when null', async () => {
      // Mock building data without construction date
      const mockBuilding = {
        id: testBuildingId,
        name: 'Test Building',
        address: '123 Test Street',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H2X 3K8',
        organizationId: testOrganizationId,
        constructionDate: null,
        totalUnits: 10,
        isActive: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      };

      const response = await agent
        .get(`/api/buildings/${testBuildingId}`);

      expect(response.status).toBe(200);
      expect(response.body.constructionDate).toBeNull();
    });

    it('should handle building not found', async () => {
      // Mock empty database response
      jest.doMock('../../../server/db', () => ({
        db: {
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([])
            })
          })
        }
      }));

      const response = await agent
        .get('/api/buildings/non-existent-id');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/buildings/:id - Construction Date Updates', () => {
    it('should update building construction date successfully', async () => {
      const updateData = {
        name: 'Updated Building',
        constructionDate: '2021-08-20',
        organizationId: testOrganizationId,
      };

      const mockUpdatedBuilding = {
        ...updateData,
        id: testBuildingId,
        updatedAt: new Date(),
      };

      // Note: Database update would be mocked by global mocks
      jest.doMock('../../../server/db', () => ({
        db: {
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([mockUpdatedBuilding])
              })
            })
          })
        }
      }));

      const response = await agent
        .put(`/api/buildings/${testBuildingId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.constructionDate).toBe('2021-08-20');
      expect(response.body.name).toBe('Updated Building');
    });

    it('should handle invalid construction date format', async () => {
      const updateData = {
        name: 'Updated Building',
        constructionDate: 'invalid-date',
        organizationId: testOrganizationId,
      };

      const response = await agent
        .put(`/api/buildings/${testBuildingId}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });

    it('should clear construction date when set to null', async () => {
      const updateData = {
        name: 'Updated Building',
        constructionDate: null,
        organizationId: testOrganizationId,
      };

      const mockUpdatedBuilding = {
        ...updateData,
        id: testBuildingId,
        updatedAt: new Date(),
      };

      const response = await agent
        .put(`/api/buildings/${testBuildingId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.constructionDate).toBeNull();
    });

    it('should validate required fields when updating construction date', async () => {
      const updateData = {
        constructionDate: '2021-08-20',
        // Missing required name and organizationId
      };

      const response = await agent
        .put(`/api/buildings/${testBuildingId}`)
        .send(updateData);

      expect(response.status).toBe(400);
    });
  });

  describe('Admin Building Updates - Construction Date', () => {
    beforeEach(() => {
      // Set admin role for admin-specific tests
      app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.session) {
          req.session.user = {
            id: 'admin-user-id',
            role: 'admin',
            organizations: [],
            email: 'admin@example.com',
            username: 'admin',
            firstName: 'Admin',
            lastName: 'User',
          } as AuthenticatedUser;
        }
        next();
      });
    });

    it('should allow admin to update building construction date', async () => {
      const updateData = {
        name: 'Admin Updated Building',
        constructionDate: '2019-12-25',
        organizationId: testOrganizationId,
      };

      const response = await agent
        .put(`/api/admin/buildings/${testBuildingId}`)
        .send(updateData);

      // Note: This tests the admin endpoint pattern
      expect(response.status).toBe(200);
    });

    it('should validate admin permissions for construction date updates', async () => {
      // Reset to manager role to test permission denial
      app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.session) {
          req.session.user = {
            id: 'test-user-id',
            role: 'manager',
            organizations: [testOrganizationId],
          } as AuthenticatedUser;
        }
        next();
      });

      const updateData = {
        name: 'Unauthorized Update',
        constructionDate: '2019-12-25',
        organizationId: testOrganizationId,
      };

      const response = await agent
        .put(`/api/admin/buildings/${testBuildingId}`)
        .send(updateData);

      expect(response.status).toBe(403);
    });
  });

  describe('Database Operations - Construction Date', () => {
    it('should handle database connection errors during construction date retrieval', async () => {
      // Mock database error
      jest.doMock('../../../server/db', () => ({
        db: {
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockRejectedValue(new Error('Database connection failed'))
            })
          })
        }
      }));

      const response = await agent
        .get(`/api/buildings/${testBuildingId}`);

      expect(response.status).toBe(500);
    });

    it('should handle database errors during construction date updates', async () => {
      const updateData = {
        name: 'Updated Building',
        constructionDate: '2021-08-20',
        organizationId: testOrganizationId,
      };

      // Mock database update error
      jest.doMock('../../../server/db', () => ({
        db: {
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                returning: jest.fn().mockRejectedValue(new Error('Database update failed'))
              })
            })
          })
        }
      }));

      const response = await agent
        .put(`/api/buildings/${testBuildingId}`)
        .send(updateData);

      expect(response.status).toBe(500);
    });
  });

  describe('Construction Date Validation', () => {
    it('should accept valid ISO date strings', async () => {
      const validDates = [
        '2020-01-01',
        '2021-12-31',
        '1990-06-15',
        '2023-02-28'
      ];

      for (const date of validDates) {
        const updateData = {
          name: 'Test Building',
          constructionDate: date,
          organizationId: testOrganizationId,
        };

        const response = await agent
          .put(`/api/buildings/${testBuildingId}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.constructionDate).toBe(date);
      }
    });

    it('should reject invalid date formats', async () => {
      const invalidDates = [
        '2020/01/01',      // Wrong format
        '01-01-2020',      // Wrong format
        '2020-13-01',      // Invalid month
        '2020-01-32',      // Invalid day
        'not-a-date',      // Not a date
        '2020-1-1',        // Single digit month/day
      ];

      for (const date of invalidDates) {
        const updateData = {
          name: 'Test Building',
          constructionDate: date,
          organizationId: testOrganizationId,
        };

        const response = await agent
          .put(`/api/buildings/${testBuildingId}`)
          .send(updateData);

        expect(response.status).toBe(400);
      }
    });

    it('should accept null construction date to clear field', async () => {
      const updateData = {
        name: 'Test Building',
        constructionDate: null,
        organizationId: testOrganizationId,
      };

      const response = await agent
        .put(`/api/buildings/${testBuildingId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.constructionDate).toBeNull();
    });
  });
});