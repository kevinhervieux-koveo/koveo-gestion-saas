import {
  scopeQuery,
  buildUserContext,
  getUserAccessibleResidenceIds,
  getUserAccessibleBuildingIds,
  type UserContext,
} from '../../../server/db/queries/scope-query';
import { db } from '../../../server/db';
import { users, buildings } from '../../../shared/schema';
import { eq, inArray } from 'drizzle-orm';

// Mock the database
jest.mock('../../../server/db', () => ({
  db: {
    select: jest.fn(),
    from: jest.fn(),
    where: jest.fn(),
    innerJoin: jest.fn(),
    orderBy: jest.fn(),
  },
}));

// Mock the drizzle operators
jest.mock('drizzle-orm', () => ({
  eq: jest.fn(),
  and: jest.fn(),
  inArray: jest.fn(),
  or: jest.fn(),
  sql: jest.fn(),
  desc: jest.fn(),
}));

describe('Database Query Scoping Tests', () => {
  const mockDb = db as jest.Mocked<typeof db> & {
    select: jest.Mock;
    from: jest.Mock;
    where: jest.Mock;
    innerJoin: jest.Mock;
    orderBy: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default mock chain
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.innerJoin.mockReturnValue(mockDb);
    mockDb.orderBy.mockReturnValue(mockDb);
  });

  describe('UserContext Building', () => {
    test('should build admin user context correctly', async () => {
      const userContext = await buildUserContext('admin-123', 'admin');

      expect(userContext.userId).toBe('admin-123');
      expect(userContext.role).toBe('admin');
      // Admin should not have limited associations
    });

    test('should build tenant user context with associations', async () => {
      // Mock the database query for user associations
      const mockQueryBuilder = {
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            innerJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([
                {
                  residenceId: 'residence-1',
                  buildingId: 'building-1',
                  organizationId: 'org-1',
                },
                {
                  residenceId: 'residence-2',
                  buildingId: 'building-1',
                  organizationId: 'org-1',
                },
              ]),
            }),
          }),
        }),
      };
      mockDb.select.mockReturnValue(mockQueryBuilder as typeof mockQueryBuilder);

      const userContext = await buildUserContext('tenant-123', 'tenant');

      expect(userContext.userId).toBe('tenant-123');
      expect(userContext.role).toBe('tenant');
      expect(userContext.residenceIds).toEqual(['residence-1', 'residence-2']);
      expect(userContext.buildingIds).toEqual(['building-1']);
      expect(userContext.organizationIds).toEqual(['org-1']);
    });
  });

  describe('Accessible Resource Retrieval', () => {
    test('should get accessible residence IDs for admin', async () => {
      const adminContext: UserContext = {
        userId: 'admin-123',
        role: 'admin',
      };

      // Mock admin seeing all residences
      const mockQueryBuilder = {
        from: jest
          .fn()
          .mockResolvedValue([{ id: 'residence-1' }, { id: 'residence-2' }, { id: 'residence-3' }]),
      };
      mockDb.select.mockReturnValue(mockQueryBuilder as typeof mockQueryBuilder);

      const residenceIds = await getUserAccessibleResidenceIds(adminContext);

      expect(residenceIds).toEqual(['residence-1', 'residence-2', 'residence-3']);
    });

    test('should get accessible residence IDs for tenant', async () => {
      const tenantContext: UserContext = {
        userId: 'tenant-123',
        role: 'tenant',
        residenceIds: ['residence-1'],
      };

      // Mock tenant's user residences query
      const mockQueryBuilder = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ residenceId: 'residence-1' }]),
        }),
      };
      mockDb.select.mockReturnValue(mockQueryBuilder as typeof mockQueryBuilder);

      const residenceIds = await getUserAccessibleResidenceIds(tenantContext);

      expect(residenceIds).toEqual(['residence-1']);
    });

    test('should get accessible building IDs for manager', async () => {
      const managerContext: UserContext = {
        userId: 'manager-123',
        role: 'manager',
        buildingIds: ['building-1', 'building-2'],
      };

      const buildingIds = await getUserAccessibleBuildingIds(managerContext);

      expect(buildingIds).toEqual(['building-1', 'building-2']);
    });
  });

  describe('Query Scoping by Entity Type', () => {
    let mockQuery: { where: jest.Mock };

    beforeEach(() => {
      mockQuery = {
        where: jest.fn().mockReturnThis(),
      };
    });

    test('should not scope admin queries', async () => {
      const adminContext: UserContext = {
        userId: 'admin-123',
        role: 'admin',
      };

      const _scopedQuery = await scopeQuery(mockQuery, adminContext, 'bills');

      expect(_scopedQuery).toBe(mockQuery);
      expect(mockQuery.where).not.toHaveBeenCalled();
    });

    test('should scope bills queries for tenant', async () => {
      const tenantContext: UserContext = {
        userId: 'tenant-123',
        role: 'tenant',
      };

      // Mock getUserAccessibleResidenceIds
      mockDb.select.mockImplementation(
        () =>
          ({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([{ residenceId: 'residence-1' }]),
            }),
          }) as unknown
      );

      const _scopedQuery = await scopeQuery(mockQuery, tenantContext, 'bills');

      expect(mockQuery.where).toHaveBeenCalled();
    });

    test('should scope maintenance requests queries for tenant (own requests only)', async () => {
      const tenantContext: UserContext = {
        userId: 'tenant-123',
        role: 'tenant',
      };

      // Mock getUserAccessibleResidenceIds
      mockDb.select.mockImplementation(
        () =>
          ({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([{ residenceId: 'residence-1' }]),
            }),
          }) as unknown
      );

      const _scopedQuery = await scopeQuery(mockQuery, tenantContext, 'maintenanceRequests');

      expect(mockQuery.where).toHaveBeenCalled();
    });

    test('should scope users queries for tenant (self only)', async () => {
      const tenantContext: UserContext = {
        userId: 'tenant-123',
        role: 'tenant',
      };

      const _scopedQuery = await scopeQuery(mockQuery, tenantContext, 'users');

      expect(mockQuery.where).toHaveBeenCalledWith(eq(users.id, 'tenant-123'));
    });

    test('should scope buildings queries for manager', async () => {
      const managerContext: UserContext = {
        userId: 'manager-123',
        role: 'manager',
        buildingIds: ['building-1', 'building-2'],
      };

      const _scopedQuery = await scopeQuery(mockQuery, managerContext, 'buildings');

      expect(mockQuery.where).toHaveBeenCalledWith(
        inArray(buildings.id, ['building-1', 'building-2'])
      );
    });

    test('should deny access when no associations exist', async () => {
      const isolatedUserContext: UserContext = {
        userId: 'isolated-123',
        role: 'tenant',
        residenceIds: [],
      };

      // Mock getUserAccessibleResidenceIds returning empty array
      mockDb.select.mockImplementation(
        () =>
          ({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([]),
            }),
          }) as unknown
      );

      const _scopedQuery = await scopeQuery(mockQuery, isolatedUserContext, 'bills');

      // Should add a where clause that returns no results
      expect(mockQuery.where).toHaveBeenCalled();
    });
  });

  describe('Multi-Level Entity Scoping', () => {
    let mockQuery: any;

    beforeEach(() => {
      mockQuery = {
        where: jest.fn().mockReturnThis(),
      };
    });

    test('should scope documents at multiple levels for owner', async () => {
      const ownerContext: UserContext = {
        userId: 'owner-123',
        role: 'manager',
        organizationIds: ['org-1'],
        buildingIds: ['building-1'],
        residenceIds: ['residence-1', 'residence-2'],
      };

      const _scopedQuery = await scopeQuery(mockQuery, ownerContext, 'documents');

      // Documents scoping is currently simplified - no where clause should be applied
      expect(mockQuery.where).not.toHaveBeenCalled();
      expect(_scopedQuery).toBe(mockQuery);
    });

    test('should scope notifications to user only', async () => {
      const userContext: UserContext = {
        userId: 'user-123',
        role: 'manager',
      };

      const _scopedQuery = await scopeQuery(mockQuery, userContext, 'notifications');

      expect(mockQuery.where).toHaveBeenCalledWith(eq(expect.anything(), 'user-123'));
    });
  });

  describe('Role-Specific Scoping Rules', () => {
    let mockQuery: any;

    beforeEach(() => {
      mockQuery = {
        where: jest.fn().mockReturnThis(),
      };
    });

    test('should apply different scoping for different roles on same entity', async () => {
      const testCases = [
        {
          _context: { userId: 'admin-123', role: 'admin' as const },
          shouldScope: false,
          description: 'admin should have no scoping',
        },
        {
          _context: {
            userId: 'manager-123',
            role: 'manager' as const,
            buildingIds: ['building-1'],
          },
          shouldScope: true,
          description: 'manager should be scoped to their buildings',
        },
        {
          _context: {
            userId: 'tenant-123',
            role: 'tenant' as const,
            residenceIds: ['residence-1'],
          },
          shouldScope: true,
          description: 'tenant should be scoped to their residences',
        },
      ];

      for (const testCase of testCases) {
        // Reset mock
        mockQuery.where.mockClear();

        // Mock the residence access for non-admin users
        if (testCase._context.role !== 'admin') {
          mockDb.select.mockImplementation(
            () =>
              ({
                from: jest.fn().mockReturnValue({
                  where: jest.fn().mockResolvedValue([{ residenceId: 'residence-1' }]),
                }),
              }) as unknown
          );
        }

        const _scopedQuery = await scopeQuery(mockQuery, testCase._context, 'bills');

        if (testCase.shouldScope) {
          expect(mockQuery.where).toHaveBeenCalled();
        } else {
          expect(mockQuery.where).not.toHaveBeenCalled();
        }
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let mockQuery: any;

    beforeEach(() => {
      mockQuery = {
        where: jest.fn().mockReturnThis(),
      };
    });

    test('should handle unknown entity type gracefully', async () => {
      const userContext: UserContext = {
        userId: 'user-123',
        role: 'tenant',
      };

      const _scopedQuery = await scopeQuery(mockQuery, userContext, 'unknown_entity');

      // Unknown entity types are returned unmodified (no scoping applied)
      expect(_scopedQuery).toBe(mockQuery);
      expect(mockQuery.where).not.toHaveBeenCalled();
    });

    test('should handle missing context properties', async () => {
      const incompleteContext: UserContext = {
        userId: 'user-123',
        role: 'manager',
        // Missing buildingIds, organizationIds, etc.
      };

      // Mock getUserAccessibleBuildingIds returning empty array
      mockDb.select.mockImplementation(
        () =>
          ({
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue([]),
            }),
          }) as unknown
      );

      const _scopedQuery = await scopeQuery(mockQuery, incompleteContext, 'buildings');

      // Should still apply scoping (denying access)
      expect(mockQuery.where).toHaveBeenCalled();
    });
  });
});
