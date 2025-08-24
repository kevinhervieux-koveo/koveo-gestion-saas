/**
 * @file Integration tests for Buildings API endpoints
 * Tests all building-related API endpoints with proper authentication,
 * role-based access control, data validation, and error handling.
 */

import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock dependencies
const mockDb = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  eq: jest.fn(),
  and: jest.fn(),
  like: jest.fn(),
  ilike: jest.fn(),
  or: jest.fn(),
  returning: jest.fn(),
  values: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
};

jest.mock('../../server/db', () => ({
  db: mockDb,
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
  and: jest.fn(),
  like: jest.fn(),
  ilike: jest.fn(),
  or: jest.fn(),
}));

// Mock auth middleware
const mockRequireAuth = (req: any, res: any, next: any) => {
  req.user = req.mockUser || {
    id: 'admin-123',
    role: 'admin',
    organizationId: 'org-123',
    organizationName: 'Test Org',
  };
  next();
};

jest.mock('../../server/auth', () => ({
  requireAuth: mockRequireAuth,
}));

// Import the building routes
import { registerBuildingRoutes } from '../../server/api/buildings';

describe('Buildings API Integration Tests', () => {
  let app: express.Express;

  const mockBuildings = [
    {
      id: 'building-1',
      name: 'Maple Heights',
      address: '123 Rue Sainte-Catherine',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H3A 1A1',
      buildingType: 'condo',
      yearBuilt: 2020,
      totalUnits: 50,
      totalFloors: 10,
      parkingSpaces: 30,
      storageSpaces: 25,
      organizationId: 'org-123',
      organizationName: 'Test Org',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'building-2',
      name: 'Oak Gardens',
      address: '456 Boulevard René-Lévesque',
      city: 'Quebec City',
      province: 'QC',
      postalCode: 'G1R 2B5',
      buildingType: 'rental',
      yearBuilt: 2018,
      totalUnits: 75,
      totalFloors: 15,
      parkingSpaces: 0,
      storageSpaces: 0,
      organizationId: 'org-456',
      organizationName: 'Other Org',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockOrganizations = [
    {
      id: 'org-123',
      name: 'Test Org',
      type: 'management_company',
    },
    {
      id: 'org-456',
      name: 'Other Org',
      type: 'syndicate',
    },
  ];

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerBuildingRoutes(app);
    jest.clearAllMocks();
  });

  describe('GET /api/manager/buildings', () => {
    it('should return buildings for admin user with proper access control', async () => {
      // Mock database queries
      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.leftJoin.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.eq.mockReturnValue(true);
      mockDb.and.mockReturnValue(true);
      mockDb.leftJoin.mockResolvedValueOnce(mockBuildings);

      const response = await request(app)
        .get('/api/manager/buildings')
        .expect(200);

      expect(response.body).toHaveProperty('buildings');
      expect(Array.isArray(response.body.buildings)).toBe(true);
    });

    it('should filter buildings by search term', async () => {
      const filteredBuildings = [mockBuildings[0]];
      
      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.leftJoin.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.leftJoin.mockResolvedValueOnce(filteredBuildings);

      const response = await request(app)
        .get('/api/manager/buildings?search=Maple')
        .expect(200);

      expect(response.body.buildings).toHaveLength(1);
      expect(response.body.buildings[0].name).toBe('Maple Heights');
    });

    it('should handle Koveo organization special access', async () => {
      // Mock Koveo user
      app.use('/api/manager/buildings', (req: any, res, next) => {
        req.mockUser = {
          id: 'koveo-admin',
          role: 'admin',
          organizationId: 'koveo-org',
          organizationName: 'Koveo',
        };
        next();
      });

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.leftJoin.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.leftJoin.mockResolvedValueOnce(mockBuildings); // Should return all buildings

      const response = await request(app)
        .get('/api/manager/buildings')
        .expect(200);

      expect(response.body.buildings).toHaveLength(2);
    });

    it('should return 401 for unauthenticated requests', async () => {
      app.use('/api/manager/buildings', (req: any, res, next) => {
        req.mockUser = null; // Simulate no auth
        res.status(401).json({ message: 'Authentication required' });
      });

      await request(app)
        .get('/api/manager/buildings')
        .expect(401);
    });

    it('should return 403 for residents and tenants', async () => {
      app.use('/api/manager/buildings', (req: any, res, next) => {
        req.mockUser = {
          id: 'resident-123',
          role: 'resident',
          organizationId: 'org-123',
        };
        res.status(403).json({ message: 'Manager or Admin access required' });
      });

      await request(app)
        .get('/api/manager/buildings')
        .expect(403);
    });
  });

  describe('POST /api/admin/buildings', () => {
    const validBuildingData = {
      name: 'New Building',
      organizationId: 'org-123',
      address: '789 Rue de la Paix',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H2X 1Y7',
      buildingType: 'condo',
      yearBuilt: 2023,
      totalUnits: 30,
      totalFloors: 8,
      parkingSpaces: 20,
      storageSpaces: 15,
    };

    it('should create a new building with valid data', async () => {
      const newBuilding = {
        ...validBuildingData,
        id: 'new-building-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValueOnce(mockDb);
      mockDb.values.mockReturnValueOnce(mockDb);
      mockDb.returning.mockResolvedValueOnce([newBuilding]);

      const response = await request(app)
        .post('/api/admin/buildings')
        .send(validBuildingData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Building created successfully');
      expect(response.body).toHaveProperty('building');
      expect(response.body.building.name).toBe('New Building');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        address: '789 Rue de la Paix',
        city: 'Montreal',
        // Missing name and organizationId
      };

      const response = await request(app)
        .post('/api/admin/buildings')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation error');
      expect(response.body.message).toContain('required');
    });

    it('should handle numeric field validation', async () => {
      const dataWithInvalidNumbers = {
        ...validBuildingData,
        yearBuilt: 'invalid-year',
        totalUnits: -5,
      };

      const response = await request(app)
        .post('/api/admin/buildings')
        .send(dataWithInvalidNumbers)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation error');
    });

    it('should allow zero values for optional numeric fields', async () => {
      const dataWithZeros = {
        ...validBuildingData,
        parkingSpaces: 0,
        storageSpaces: 0,
      };

      const newBuilding = {
        ...dataWithZeros,
        id: 'new-building-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValueOnce(mockDb);
      mockDb.values.mockReturnValueOnce(mockDb);
      mockDb.returning.mockResolvedValueOnce([newBuilding]);

      const response = await request(app)
        .post('/api/admin/buildings')
        .send(dataWithZeros)
        .expect(201);

      expect(response.body.building.parkingSpaces).toBe(0);
      expect(response.body.building.storageSpaces).toBe(0);
    });

    it('should return 403 for non-admin users', async () => {
      app.use('/api/admin/buildings', (req: any, res, next) => {
        req.mockUser = {
          id: 'manager-123',
          role: 'manager',
          organizationId: 'org-123',
        };
        res.status(403).json({ message: 'Admin access required' });
      });

      await request(app)
        .post('/api/admin/buildings')
        .send(validBuildingData)
        .expect(403);
    });

    it('should handle database errors gracefully', async () => {
      mockDb.insert.mockReturnValueOnce(mockDb);
      mockDb.values.mockReturnValueOnce(mockDb);
      mockDb.returning.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/admin/buildings')
        .send(validBuildingData)
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Internal server error');
    });
  });

  describe('PUT /api/admin/buildings/:id', () => {
    const buildingId = 'building-1';
    const updateData = {
      name: 'Updated Building Name',
      organizationId: 'org-123',
      address: '123 Updated Street',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H3A 1A1',
      buildingType: 'condo',
      totalUnits: 55,
      parkingSpaces: 0, // Test zero value
    };

    it('should update building for admin users', async () => {
      const existingBuilding = [mockBuildings[0]];
      const updatedBuilding = { ...mockBuildings[0], ...updateData };

      // Mock existing building check
      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(existingBuilding);

      // Mock update
      mockDb.update.mockReturnValueOnce(mockDb);
      mockDb.set.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.returning.mockResolvedValueOnce([updatedBuilding]);

      const response = await request(app)
        .put(`/api/admin/buildings/${buildingId}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Building updated successfully');
      expect(response.body.building.name).toBe('Updated Building Name');
      expect(response.body.building.parkingSpaces).toBe(0);
    });

    it('should update building for manager users', async () => {
      app.use(`/api/admin/buildings/${buildingId}`, (req: any, res, next) => {
        req.mockUser = {
          id: 'manager-123',
          role: 'manager',
          organizationId: 'org-123',
        };
        next();
      });

      const existingBuilding = [mockBuildings[0]];
      const updatedBuilding = { ...mockBuildings[0], ...updateData };

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(existingBuilding);

      mockDb.update.mockReturnValueOnce(mockDb);
      mockDb.set.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.returning.mockResolvedValueOnce([updatedBuilding]);

      const response = await request(app)
        .put(`/api/admin/buildings/${buildingId}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Building updated successfully');
    });

    it('should return 404 for non-existent building', async () => {
      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce([]); // No building found

      const response = await request(app)
        .put(`/api/admin/buildings/${buildingId}`)
        .send(updateData)
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Building not found');
    });

    it('should validate required fields for updates', async () => {
      const invalidUpdateData = {
        address: 'Updated address',
        // Missing required name and organizationId
      };

      const response = await request(app)
        .put(`/api/admin/buildings/${buildingId}`)
        .send(invalidUpdateData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation error');
    });

    it('should return 403 for residents and tenants', async () => {
      app.use(`/api/admin/buildings/${buildingId}`, (req: any, res, next) => {
        req.mockUser = {
          id: 'resident-123',
          role: 'resident',
          organizationId: 'org-123',
        };
        res.status(403).json({ message: 'Admin or Manager access required' });
      });

      await request(app)
        .put(`/api/admin/buildings/${buildingId}`)
        .send(updateData)
        .expect(403);
    });
  });

  describe('DELETE /api/admin/buildings/:id', () => {
    const buildingId = 'building-1';

    it('should delete building for admin users', async () => {
      const existingBuilding = [mockBuildings[0]];

      // Mock existing building check
      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(existingBuilding);

      // Mock soft delete (update isActive to false)
      mockDb.update.mockReturnValueOnce(mockDb);
      mockDb.set.mockReturnValueOnce(mockDb);
      mockDb.where.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .delete(`/api/admin/buildings/${buildingId}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Building deleted successfully');
    });

    it('should return 403 for manager users', async () => {
      app.use(`/api/admin/buildings/${buildingId}`, (req: any, res, next) => {
        req.mockUser = {
          id: 'manager-123',
          role: 'manager',
          organizationId: 'org-123',
        };
        res.status(403).json({ message: 'Admin access required' });
      });

      await request(app)
        .delete(`/api/admin/buildings/${buildingId}`)
        .expect(403);
    });

    it('should return 404 for non-existent building', async () => {
      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce([]); // No building found

      const response = await request(app)
        .delete(`/api/admin/buildings/${buildingId}`)
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Building not found');
    });

    it('should return 403 for non-admin users', async () => {
      app.use(`/api/admin/buildings/${buildingId}`, (req: any, res, next) => {
        req.mockUser = {
          id: 'resident-123',
          role: 'resident',
          organizationId: 'org-123',
        };
        res.status(403).json({ message: 'Admin access required' });
      });

      await request(app)
        .delete(`/api/admin/buildings/${buildingId}`)
        .expect(403);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON in requests', async () => {
      const response = await request(app)
        .post('/api/admin/buildings')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle extremely long building names', async () => {
      const longNameData = {
        name: 'A'.repeat(1000), // Very long name
        organizationId: 'org-123',
      };

      const response = await request(app)
        .post('/api/admin/buildings')
        .send(longNameData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation error');
    });

    it('should handle special characters in building names', async () => {
      const specialCharData = {
        name: 'Bâtiment Côte-des-Neiges (Édifice St-Laurent)',
        organizationId: 'org-123',
        address: 'Côte-des-Neiges, Montréal',
        city: 'Montréal',
        province: 'QC',
        postalCode: 'H3V 1A1',
      };

      const newBuilding = {
        ...specialCharData,
        id: 'new-building-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValueOnce(mockDb);
      mockDb.values.mockReturnValueOnce(mockDb);
      mockDb.returning.mockResolvedValueOnce([newBuilding]);

      const response = await request(app)
        .post('/api/admin/buildings')
        .send(specialCharData)
        .expect(201);

      expect(response.body.building.name).toBe('Bâtiment Côte-des-Neiges (Édifice St-Laurent)');
    });

    it('should handle database connection failures', async () => {
      mockDb.select.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .get('/api/manager/buildings')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Internal server error');
    });
  });

  describe('Quebec-specific Validation', () => {
    it('should validate Quebec postal codes', async () => {
      const invalidPostalCodeData = {
        name: 'Test Building',
        organizationId: 'org-123',
        postalCode: '12345', // Invalid Quebec format
      };

      const response = await request(app)
        .post('/api/admin/buildings')
        .send(invalidPostalCodeData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation error');
    });

    it('should accept valid Quebec postal codes', async () => {
      const validQuebecData = {
        name: 'Test Building',
        organizationId: 'org-123',
        postalCode: 'H3A 1A1',
        province: 'QC',
      };

      const newBuilding = {
        ...validQuebecData,
        id: 'new-building-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValueOnce(mockDb);
      mockDb.values.mockReturnValueOnce(mockDb);
      mockDb.returning.mockResolvedValueOnce([newBuilding]);

      const response = await request(app)
        .post('/api/admin/buildings')
        .send(validQuebecData)
        .expect(201);

      expect(response.body.building.postalCode).toBe('H3A 1A1');
    });

    it('should handle French building types and names', async () => {
      const frenchBuildingData = {
        name: 'Résidence Les Érables',
        organizationId: 'org-123',
        address: 'Rue de la Cathédrale',
        city: 'Québec',
        province: 'QC',
        buildingType: 'condo',
      };

      const newBuilding = {
        ...frenchBuildingData,
        id: 'new-building-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.insert.mockReturnValueOnce(mockDb);
      mockDb.values.mockReturnValueOnce(mockDb);
      mockDb.returning.mockResolvedValueOnce([newBuilding]);

      const response = await request(app)
        .post('/api/admin/buildings')
        .send(frenchBuildingData)
        .expect(201);

      expect(response.body.building.name).toBe('Résidence Les Érables');
      expect(response.body.building.city).toBe('Québec');
    });
  });
});