/**
 * @file Integration tests for Common Spaces API endpoints
 * Tests all common space booking-related API endpoints with proper authentication,
 * role-based access control, booking logic validation, and data integrity.
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
  innerJoin: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  eq: jest.fn(),
  and: jest.fn(),
  or: jest.fn(),
  gte: jest.fn(),
  lte: jest.fn(),
  sql: jest.fn(),
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
  or: jest.fn(),
  gte: jest.fn(),
  lte: jest.fn(),
  between: jest.fn(),
  inArray: jest.fn(),
  sql: jest.fn(),
  desc: jest.fn(),
}));

// Mock auth middleware
const mockRequireAuth = (req: any, res: any, next: any) => {
  if (req.headers.authorization || req.body?.mockUser) {
    req.user = req.body?.mockUser || {
      id: 'user-123',
      role: 'resident',
      organizations: ['org-123'],
      canAccessAllOrganizations: false,
    };
    next();
  } else {
    res.status(401).json({ message: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
};

const mockRequireRole = (roles: string[]) => (req: any, res: any, next: any) => {
  const user = req.user || req.mockUser;
  if (user && roles.includes(user.role)) {
    next();
  } else {
    res.status(403).json({ message: 'Insufficient permissions', code: 'INSUFFICIENT_PERMISSIONS' });
  }
};

jest.mock('../../server/auth', () => ({
  requireAuth: mockRequireAuth,
  requireRole: mockRequireRole,
}));

// Import the common spaces routes
import { registerCommonSpacesRoutes } from '../../server/api/common-spaces';

describe('Common Spaces API Integration Tests', () => {
  let app: express.Express;

  const mockBuildings = [
    {
      id: 'building-1',
      name: 'Maple Heights',
      organizationId: 'org-123',
      isActive: true,
    },
    {
      id: 'building-2', 
      name: 'Oak Gardens',
      organizationId: 'org-456',
      isActive: true,
    },
  ];

  const mockCommonSpaces = [
    {
      id: 'space-1',
      name: 'Gym',
      description: 'Building gymnasium',
      buildingId: 'building-1',
      isReservable: true,
      capacity: 20,
      openingHours: [
        { day: 'monday', open: '06:00', close: '22:00' },
        { day: 'tuesday', open: '06:00', close: '22:00' },
        { day: 'wednesday', open: '06:00', close: '22:00' },
        { day: 'thursday', open: '06:00', close: '22:00' },
        { day: 'friday', open: '06:00', close: '22:00' },
        { day: 'saturday', open: '08:00', close: '20:00' },
        { day: 'sunday', open: '08:00', close: '20:00' },
      ],
      bookingRules: 'Maximum 2 hours per booking',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'space-2',
      name: 'Meeting Room',
      description: 'Conference room',
      buildingId: 'building-1',
      isReservable: false,
      capacity: 10,
      openingHours: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'space-3',
      name: 'Pool',
      description: 'Swimming pool',
      buildingId: 'building-2',
      isReservable: true,
      capacity: 15,
      openingHours: [
        { day: 'monday', open: '09:00', close: '21:00' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockBookings = [
    {
      id: 'booking-1',
      commonSpaceId: 'space-1',
      userId: 'user-456',
      startTime: new Date('2024-01-15T10:00:00Z'),
      endTime: new Date('2024-01-15T11:00:00Z'),
      status: 'confirmed',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'booking-2',
      commonSpaceId: 'space-1',
      userId: 'user-123',
      startTime: new Date('2024-01-15T14:00:00Z'),
      endTime: new Date('2024-01-15T15:00:00Z'),
      status: 'confirmed',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockUserResidences = [
    {
      userId: 'user-123',
      residenceId: 'residence-1',
      buildingId: 'building-1',
      isActive: true,
    },
    {
      userId: 'user-456',
      residenceId: 'residence-2',
      buildingId: 'building-2',
      isActive: true,
    },
  ];

  const mockRestrictions = [
    {
      id: 'restriction-1',
      userId: 'user-blocked',
      commonSpaceId: 'space-1',
      isBlocked: true,
      reason: 'Violated booking rules',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    app = express();
    app.use(express.json());
    
    // Setup default mock behaviors
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.limit.mockReturnValue(mockDb);
    mockDb.innerJoin.mockReturnValue(mockDb);
    mockDb.leftJoin.mockReturnValue(mockDb);
    mockDb.groupBy.mockReturnValue(mockDb);
    mockDb.orderBy.mockReturnValue(mockDb);
    mockDb.insert.mockReturnValue(mockDb);
    mockDb.values.mockReturnValue(mockDb);
    mockDb.update.mockReturnValue(mockDb);
    mockDb.set.mockReturnValue(mockDb);
    mockDb.returning.mockReturnValue([]);
    
    registerCommonSpacesRoutes(app);
  });

  describe('GET /api/common-spaces', () => {
    it('should return common spaces for authenticated user buildings', async () => {
      // Mock resident user with access to building-1
      const residentUser = {
        id: 'user-123',
        role: 'resident',
        organizations: ['org-123'],
        canAccessAllOrganizations: false,
      };

      // Setup mock for getAccessibleBuildingIds call
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          innerJoin: () => ({
            ...mockDb,
            where: () => [{ buildingId: 'building-1' }],
          }),
        }),
      }));

      // Mock common spaces query result
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          innerJoin: () => ({
            ...mockDb,
            leftJoin: () => ({
              ...mockDb,
              where: () => ({
                ...mockDb,
                orderBy: () => mockCommonSpaces.filter(space => space.buildingId === 'building-1'),
              }),
            }),
          }),
        }),
      }));

      const response = await request(app)
        .get('/api/common-spaces')
        .set('Authorization', 'Bearer token')
        .send({ mockUser: residentUser });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return empty array if user has no accessible buildings', async () => {
      // Mock user with no residences
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          innerJoin: () => ({
            ...mockDb,
            where: () => [],
          }),
        }),
      }));

      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => [],
        }),
      }));

      const response = await request(app)
        .get('/api/common-spaces')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/common-spaces');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Authentication required');
    });
  });

  describe('POST /api/common-spaces/:spaceId/bookings', () => {
    const validBookingData = {
      start_time: '2024-01-20T09:00:00Z',
      end_time: '2024-01-20T10:00:00Z',
    };

    beforeEach(() => {
      // Mock user access to building
      mockDb.select.mockImplementation(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          innerJoin: () => ({
            ...mockDb,
            where: () => [{ buildingId: 'building-1' }],
          }),
        }),
      }));
    });

    it('should successfully create a booking in an available time slot', async () => {
      // Mock space lookup
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => ({
            ...mockDb,
            limit: () => [mockCommonSpaces[0]], // Reservable gym
          }),
        }),
      }));

      // Mock no overlapping bookings
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => [],
        }),
      }));

      // Mock user not blocked
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => [],
        }),
      }));

      // Mock successful booking creation
      mockDb.insert.mockImplementationOnce(() => ({
        ...mockDb,
        values: () => ({
          ...mockDb,
          returning: () => [{
            id: 'new-booking-id',
            ...validBookingData,
            userId: 'user-123',
            commonSpaceId: 'space-1',
            status: 'confirmed',
          }],
        }),
      }));

      const response = await request(app)
        .post('/api/common-spaces/space-1/bookings')
        .set('Authorization', 'Bearer token')
        .send(validBookingData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Booking created successfully');
      expect(response.body.booking).toBeDefined();
    });

    it('should reject booking if it overlaps with existing booking', async () => {
      // Mock space lookup
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => ({
            ...mockDb,
            limit: () => [mockCommonSpaces[0]],
          }),
        }),
      }));

      // Mock overlapping booking exists
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => [mockBookings[0]], // Overlapping booking
        }),
      }));

      const response = await request(app)
        .post('/api/common-spaces/space-1/bookings')
        .set('Authorization', 'Bearer token')
        .send({
          start_time: '2024-01-15T10:30:00Z', // Overlaps with existing booking
          end_time: '2024-01-15T11:30:00Z',
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Time slot is already booked');
      expect(response.body.code).toBe('TIME_CONFLICT');
    });

    it('should reject booking outside opening hours', async () => {
      // Mock space lookup
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => ({
            ...mockDb,
            limit: () => [mockCommonSpaces[0]],
          }),
        }),
      }));

      const response = await request(app)
        .post('/api/common-spaces/space-1/bookings')
        .set('Authorization', 'Bearer token')
        .send({
          start_time: '2024-01-20T05:00:00Z', // Before opening hours (6 AM)
          end_time: '2024-01-20T06:00:00Z',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Booking time is outside opening hours');
      expect(response.body.code).toBe('OUTSIDE_OPENING_HOURS');
    });

    it('should reject booking for blocked user', async () => {
      // Mock space lookup
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => ({
            ...mockDb,
            limit: () => [mockCommonSpaces[0]],
          }),
        }),
      }));

      // Mock user is blocked
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => [mockRestrictions[0]], // User is blocked
        }),
      }));

      const blockedUser = {
        id: 'user-blocked',
        role: 'resident',
        organizations: ['org-123'],
      };

      const response = await request(app)
        .post('/api/common-spaces/space-1/bookings')
        .set('Authorization', 'Bearer token')
        .send(validBookingData);

      response.body.mockUser = blockedUser;

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('You are blocked from booking this space');
      expect(response.body.code).toBe('USER_BLOCKED');
    });

    it('should reject booking for non-reservable space', async () => {
      // Mock non-reservable space lookup
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => ({
            ...mockDb,
            limit: () => [mockCommonSpaces[1]], // Non-reservable meeting room
          }),
        }),
      }));

      const response = await request(app)
        .post('/api/common-spaces/space-2/bookings')
        .set('Authorization', 'Bearer token')
        .send(validBookingData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('This common space is not reservable');
      expect(response.body.code).toBe('NOT_RESERVABLE');
    });

    it('should reject booking in the past', async () => {
      // Mock space lookup
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => ({
            ...mockDb,
            limit: () => [mockCommonSpaces[0]],
          }),
        }),
      }));

      const response = await request(app)
        .post('/api/common-spaces/space-1/bookings')
        .set('Authorization', 'Bearer token')
        .send({
          start_time: '2020-01-01T10:00:00Z', // Past date
          end_time: '2020-01-01T11:00:00Z',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Cannot book in the past');
      expect(response.body.code).toBe('INVALID_TIME_RANGE');
    });

    it('should reject invalid data with 400 error (Zod validation)', async () => {
      const response = await request(app)
        .post('/api/common-spaces/space-1/bookings')
        .set('Authorization', 'Bearer token')
        .send({
          start_time: 'invalid-date',
          end_time: 'invalid-date',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid');
    });

    it('should reject booking if start time is after end time', async () => {
      // Mock space lookup
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => ({
            ...mockDb,
            limit: () => [mockCommonSpaces[0]],
          }),
        }),
      }));

      const response = await request(app)
        .post('/api/common-spaces/space-1/bookings')
        .set('Authorization', 'Bearer token')
        .send({
          start_time: '2024-01-20T11:00:00Z',
          end_time: '2024-01-20T10:00:00Z', // End before start
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Start time must be before end time');
      expect(response.body.code).toBe('INVALID_TIME_RANGE');
    });
  });

  describe('Access Control and Permissions', () => {
    it('should prevent resident from accessing spaces in other buildings', async () => {
      // Mock user with access only to building-1
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          innerJoin: () => ({
            ...mockDb,
            where: () => [{ buildingId: 'building-1' }], // Only building-1
          }),
        }),
      }));

      // Mock common spaces query - should only return building-1 spaces
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => mockCommonSpaces.filter(space => space.buildingId === 'building-1'),
        }),
      }));

      const response = await request(app)
        .get('/api/common-spaces')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      // Should not include spaces from building-2
      const returnedSpaces = response.body;
      const building2Spaces = returnedSpaces.filter((space: any) => space.buildingId === 'building-2');
      expect(building2Spaces).toHaveLength(0);
    });

    it('should prevent resident from accessing manager statistics endpoint', async () => {
      const residentUser = {
        id: 'user-123',
        role: 'resident',
        organizations: ['org-123'],
      };

      const response = await request(app)
        .get('/api/common-spaces/space-1/stats')
        .set('Authorization', 'Bearer token')
        .send();

      response.body.mockUser = residentUser;

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Insufficient permissions');
    });

    it('should allow manager to access statistics endpoint', async () => {
      const managerUser = {
        id: 'manager-123',
        role: 'manager',
        organizations: ['org-123'],
      };

      // Mock space lookup for stats
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => ({
            ...mockDb,
            limit: () => [mockCommonSpaces[0]],
          }),
        }),
      }));

      // Mock manager access to building
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => [{ id: 'building-1' }],
        }),
      }));

      // Mock stats queries
      mockDb.select.mockImplementation(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          innerJoin: () => ({
            ...mockDb,
            where: () => ({
              ...mockDb,
              groupBy: () => ({
                ...mockDb,
                orderBy: () => [],
              }),
            }),
          }),
          where: () => ({
            ...mockDb,
            groupBy: () => ({
              ...mockDb,
              orderBy: () => [],
            }),
          }),
        }),
      }));

      const response = await request(app)
        .get('/api/common-spaces/space-1/stats')
        .set('Authorization', 'Bearer token')
        .send();

      response.body.mockUser = managerUser;

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/common-spaces/bookings/:bookingId', () => {
    it('should allow resident to cancel their own booking', async () => {
      const residentUser = {
        id: 'user-123',
        role: 'resident',
        organizations: ['org-123'],
      };

      // Mock booking lookup - user owns this booking
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => ({
            ...mockDb,
            limit: () => [{
              id: 'booking-2',
              userId: 'user-123', // Same as requesting user
              commonSpaceId: 'space-1',
              status: 'confirmed',
            }],
          }),
        }),
      }));

      // Mock successful update
      mockDb.update.mockImplementationOnce(() => ({
        ...mockDb,
        set: () => ({
          ...mockDb,
          where: () => Promise.resolve(),
        }),
      }));

      const response = await request(app)
        .delete('/api/common-spaces/bookings/booking-2')
        .set('Authorization', 'Bearer token')
        .send();

      response.body.mockUser = residentUser;

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Booking cancelled successfully');
    });

    it('should prevent resident from cancelling other users bookings', async () => {
      const residentUser = {
        id: 'user-123',
        role: 'resident',
        organizations: ['org-123'],
      };

      // Mock booking lookup - user does NOT own this booking
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => ({
            ...mockDb,
            limit: () => [{
              id: 'booking-1',
              userId: 'user-456', // Different user
              commonSpaceId: 'space-1',
              status: 'confirmed',
            }],
          }),
        }),
      }));

      const response = await request(app)
        .delete('/api/common-spaces/bookings/booking-1')
        .set('Authorization', 'Bearer token')
        .send();

      response.body.mockUser = residentUser;

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Can only cancel your own bookings');
    });

    it('should allow manager to cancel any booking in their building', async () => {
      const managerUser = {
        id: 'manager-123',
        role: 'manager',
        organizations: ['org-123'],
      };

      // Mock booking lookup
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => ({
            ...mockDb,
            limit: () => [{
              id: 'booking-1',
              userId: 'user-456', // Different user
              commonSpaceId: 'space-1',
              status: 'confirmed',
            }],
          }),
        }),
      }));

      // Mock manager access to building via space
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => ({
            ...mockDb,
            limit: () => [{ buildingId: 'building-1' }],
          }),
        }),
      }));

      // Mock manager access to building-1
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => [{ id: 'building-1' }],
        }),
      }));

      // Mock successful update
      mockDb.update.mockImplementationOnce(() => ({
        ...mockDb,
        set: () => ({
          ...mockDb,
          where: () => Promise.resolve(),
        }),
      }));

      const response = await request(app)
        .delete('/api/common-spaces/bookings/booking-1')
        .set('Authorization', 'Bearer token')
        .send();

      response.body.mockUser = managerUser;

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Booking cancelled successfully');
    });
  });

  describe('POST /api/common-spaces/users/:userId/restrictions', () => {
    it('should allow manager to block/unblock users', async () => {
      const managerUser = {
        id: 'manager-123',
        role: 'manager',
        organizations: ['org-123'],
      };

      // Mock target user exists
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => ({
            ...mockDb,
            limit: () => [{ id: 'user-456' }],
          }),
        }),
      }));

      // Mock space exists
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => ({
            ...mockDb,
            limit: () => [{ id: 'space-1', buildingId: 'building-1' }],
          }),
        }),
      }));

      // Mock manager access to building
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => [{ id: 'building-1' }],
        }),
      }));

      // Mock no existing restriction
      mockDb.select.mockImplementationOnce(() => ({
        ...mockDb,
        from: () => ({
          ...mockDb,
          where: () => ({
            ...mockDb,
            limit: () => [],
          }),
        }),
      }));

      // Mock successful restriction creation
      mockDb.insert.mockImplementationOnce(() => ({
        ...mockDb,
        values: () => Promise.resolve(),
      }));

      const response = await request(app)
        .post('/api/common-spaces/users/user-456/restrictions')
        .set('Authorization', 'Bearer token')
        .send({
          common_space_id: 'space-1',
          is_blocked: true,
          reason: 'Violated booking rules',
        });

      response.body.mockUser = managerUser;

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('User blocked from booking this space');
    });

    it('should reject restriction with invalid data (Zod validation)', async () => {
      const managerUser = {
        id: 'manager-123',
        role: 'manager',
        organizations: ['org-123'],
      };

      const response = await request(app)
        .post('/api/common-spaces/users/invalid-uuid/restrictions')
        .set('Authorization', 'Bearer token')
        .send({
          common_space_id: 'invalid-uuid',
          is_blocked: 'not-a-boolean', // Invalid type
        });

      response.body.mockUser = managerUser;

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/Invalid/);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should reject invalid space ID format', async () => {
      const response = await request(app)
        .post('/api/common-spaces/invalid-uuid/bookings')
        .set('Authorization', 'Bearer token')
        .send({
          start_time: '2024-01-20T09:00:00Z',
          end_time: '2024-01-20T10:00:00Z',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid');
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/common-spaces/space-1/bookings')
        .set('Authorization', 'Bearer token')
        .send({
          start_time: '2024-01-20T09:00:00Z',
          // Missing end_time
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid');
    });

    it('should reject malformed datetime strings', async () => {
      const response = await request(app)
        .post('/api/common-spaces/space-1/bookings')
        .set('Authorization', 'Bearer token')
        .send({
          start_time: 'not-a-date',
          end_time: '2024-01-20T10:00:00Z',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid');
    });

    it('should handle non-existent space gracefully', async () => {
      const response = await request(app)
        .post('/api/common-spaces/invalid-uuid-format/bookings')
        .set('Authorization', 'Bearer token')
        .send({
          start_time: '2024-01-20T09:00:00Z',
          end_time: '2024-01-20T10:00:00Z',
        });

      // Invalid UUID format should trigger validation error first
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid');
    });

    it('should handle non-existent booking for cancellation', async () => {
      const response = await request(app)
        .delete('/api/common-spaces/bookings/invalid-uuid-format')
        .set('Authorization', 'Bearer token');

      // Invalid UUID format should trigger validation error first
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid');
    });
  });
});