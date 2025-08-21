/**
 * @file Database Query Performance Tests
 * @description Tests for database query optimization and performance monitoring
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { performance } from 'perf_hooks';
import { db } from '../../server/db';
import { 
  users, 
  organizations, 
  buildings, 
  residences, 
  demands,
  demandComments,
  userOrganizations,
  userResidences
} from '../../shared/schema';
import { eq, and, or, inArray, desc, like, count, avg, sum, gt } from 'drizzle-orm';

// Performance thresholds in milliseconds
const QUERY_THRESHOLDS = {
  FAST: 50,      // < 50ms - excellent
  MEDIUM: 200,   // < 200ms - acceptable
  SLOW: 500,     // < 500ms - needs optimization
  TIMEOUT: 2000  // > 2000ms - unacceptable
};

interface QueryResult {
  duration: number;
  rowCount: number;
  queryName: string;
}

describe('Database Query Performance Tests', () => {
  let testData: {
    organizations: any[];
    buildings: any[];
    residences: any[];
    users: any[];
    demands: any[];
    comments: any[];
  };

  beforeAll(async () => {
    await setupLargeTestDataset();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  /**
   * Setup a large dataset for performance testing
   */
  async function setupLargeTestDataset() {
    const startTime = performance.now();
    
    // Create organizations
    const organizations = [];
    for (let i = 0; i < 10; i++) {
      const [org] = await db.insert(organizations).values({
        name: `Performance Test Org ${i + 1}`,
        type: 'management_company',
        address: `${100 + i} Performance St`,
        city: 'Montreal',
        province: 'QC',
        postalCode: `H${i + 1}P ${i + 1}P${i + 1}`,
        phone: `514-555-${String(i).padStart(4, '0')}`,
        email: `perf${i + 1}@test.com`
      }).returning();
      organizations.push(org);
    }

    // Create buildings (50 buildings across organizations)
    const buildings = [];
    for (let i = 0; i < 50; i++) {
      const orgIndex = i % organizations.length;
      const [building] = await db.insert(buildings).values({
        organizationId: organizations[orgIndex].id,
        name: `Performance Building ${i + 1}`,
        address: `${200 + i} Building Ave`,
        city: 'Montreal',
        province: 'QC',
        postalCode: `H${Math.floor(i / 10) + 1}B ${Math.floor(i / 10) + 1}B${i % 10}`,
        buildingType: i % 2 === 0 ? 'Apartment' : 'Condo',
        totalUnits: 20 + (i % 30),
        yearBuilt: 1990 + (i % 35)
      }).returning();
      buildings.push(building);
    }

    // Create residences (1000 residences across buildings)
    const residences = [];
    for (let i = 0; i < 1000; i++) {
      const buildingIndex = i % buildings.length;
      const unitNumber = Math.floor(i / buildings.length) * 100 + (i % 100) + 1;
      
      const [residence] = await db.insert(residences).values({
        buildingId: buildings[buildingIndex].id,
        unitNumber: String(unitNumber),
        floor: Math.floor(unitNumber / 100) + 1,
        squareFootage: 600 + (i % 800),
        bedrooms: 1 + (i % 4),
        bathrooms: 1 + (i % 3)
      }).returning();
      residences.push(residence);
    }

    // Create users (500 users)
    const users = [];
    const roles = ['admin', 'manager', 'resident', 'tenant'] as const;
    for (let i = 0; i < 500; i++) {
      const [user] = await db.insert(users).values({
        username: `perfuser${i + 1}`,
        email: `perfuser${i + 1}@test.com`,
        password: 'hashed_password',
        firstName: `User${i + 1}`,
        lastName: `Performance`,
        role: roles[i % roles.length]
      }).returning();
      users.push(user);

      // Link user to organization
      const orgIndex = i % organizations.length;
      await db.insert(userOrganizations).values({
        userId: user.id,
        organizationId: organizations[orgIndex].id,
        organizationRole: user.role
      });

      // Link some users to residences
      if (i % 2 === 0 && i < residences.length) {
        await db.insert(userResidences).values({
          userId: user.id,
          residenceId: residences[i].id,
          residenceRole: user.role === 'tenant' ? 'tenant' : 'owner'
        });
      }
    }

    // Create demands (2000 demands)
    const demands = [];
    const demandTypes = ['maintenance', 'complaint', 'information', 'other'] as const;
    const statuses = ['submitted', 'under_review', 'approved', 'in_progress', 'completed', 'rejected'] as const;
    
    for (let i = 0; i < 2000; i++) {
      const userIndex = i % users.length;
      const residenceIndex = i % residences.length;
      
      const [demand] = await db.insert(demands).values({
        submitterId: users[userIndex].id,
        type: demandTypes[i % demandTypes.length],
        description: `Performance test demand #${i + 1}. This is a longer description to test text search performance. It contains various keywords like urgent, repair, maintenance, complaint, and investigation.`,
        residenceId: residences[residenceIndex].id,
        buildingId: residences[residenceIndex].buildingId,
        status: statuses[i % statuses.length],
        createdAt: new Date(2024, 0, 1 + (i % 365)) // Spread across the year
      }).returning();
      demands.push(demand);
    }

    // Create comments (5000 comments)
    const comments = [];
    for (let i = 0; i < 5000; i++) {
      const demandIndex = i % demands.length;
      const userIndex = i % users.length;
      
      const [comment] = await db.insert(demandComments).values({
        demandId: demands[demandIndex].id,
        authorId: users[userIndex].id,
        content: `Performance test comment #${i + 1}. This comment provides additional context and details for testing purposes.`,
        isInternal: i % 5 === 0 // 20% internal comments
      }).returning();
      comments.push(comment);
    }

    testData = {
      organizations,
      buildings,
      residences,
      users,
      demands,
      comments
    };

    const setupTime = performance.now() - startTime;
    console.log(`Test data setup completed in ${setupTime.toFixed(2)}ms`);
  }

  /**
   * Cleanup all test data
   */
  async function cleanupTestData() {
    if (testData) {
      await db.delete(demandComments);
      await db.delete(demands);
      await db.delete(userResidences);
      await db.delete(userOrganizations);
      await db.delete(residences);
      await db.delete(buildings);
      await db.delete(users);
      await db.delete(organizations);
    }
  }

  /**
   * Execute query and measure performance
   */
  async function measureQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>
  ): Promise<QueryResult> {
    const startTime = performance.now();
    const result = await queryFn();
    const endTime = performance.now();
    
    const duration = endTime - startTime;
    const rowCount = Array.isArray(result) ? result.length : 1;
    
    return {
      duration,
      rowCount,
      queryName
    };
  }

  /**
   * Assert query performance meets threshold
   */
  function assertQueryPerformance(result: QueryResult, threshold: number) {
    console.log(`${result.queryName}: ${result.duration.toFixed(2)}ms (${result.rowCount} rows)`);
    expect(result.duration).toBeLessThan(threshold);
  }

  describe('Basic Query Performance', () => {
    it('should fetch single user by ID quickly', async () => {
      const userId = testData.users[0].id;
      
      const result = await measureQuery('Single user by ID', async () => {
        return await db.select().from(users).where(eq(users.id, userId)).limit(1);
      });

      assertQueryPerformance(result, QUERY_THRESHOLDS.FAST);
    });

    it('should fetch single building by ID with organization quickly', async () => {
      const buildingId = testData.buildings[0].id;
      
      const result = await measureQuery('Building with organization', async () => {
        return await db
          .select({
            building: buildings,
            organization: organizations
          })
          .from(buildings)
          .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
          .where(eq(buildings.id, buildingId))
          .limit(1);
      });

      assertQueryPerformance(result, QUERY_THRESHOLDS.FAST);
    });

    it('should count demands efficiently', async () => {
      const result = await measureQuery('Count all demands', async () => {
        return await db.select({ count: count() }).from(demands);
      });

      assertQueryPerformance(result, QUERY_THRESHOLDS.FAST);
    });
  });

  describe('Complex Query Performance', () => {
    it('should fetch demands with related data efficiently', async () => {
      const result = await measureQuery('Demands with joins', async () => {
        return await db
          .select({
            demand: demands,
            submitter: {
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName
            },
            residence: {
              id: residences.id,
              unitNumber: residences.unitNumber
            },
            building: {
              id: buildings.id,
              name: buildings.name,
              address: buildings.address
            }
          })
          .from(demands)
          .innerJoin(users, eq(demands.submitterId, users.id))
          .innerJoin(residences, eq(demands.residenceId, residences.id))
          .innerJoin(buildings, eq(demands.buildingId, buildings.id))
          .limit(100);
      });

      assertQueryPerformance(result, QUERY_THRESHOLDS.MEDIUM);
    });

    it('should perform aggregations efficiently', async () => {
      const result = await measureQuery('Demand statistics by building', async () => {
        return await db
          .select({
            buildingId: demands.buildingId,
            buildingName: buildings.name,
            totalDemands: count(),
            completedDemands: count(demands.status).filterWhere(eq(demands.status, 'completed')),
            avgCreationTime: avg(demands.createdAt)
          })
          .from(demands)
          .innerJoin(buildings, eq(demands.buildingId, buildings.id))
          .groupBy(demands.buildingId, buildings.name)
          .limit(50);
      });

      assertQueryPerformance(result, QUERY_THRESHOLDS.MEDIUM);
    });

    it('should handle complex filters efficiently', async () => {
      const recentDate = new Date(2024, 6, 1); // July 1, 2024
      
      const result = await measureQuery('Complex demand filtering', async () => {
        return await db
          .select()
          .from(demands)
          .innerJoin(users, eq(demands.submitterId, users.id))
          .innerJoin(residences, eq(demands.residenceId, residences.id))
          .where(
            and(
              or(
                eq(demands.type, 'maintenance'),
                eq(demands.type, 'complaint')
              ),
              inArray(demands.status, ['submitted', 'under_review', 'approved']),
              // gte(demands.createdAt, recentDate),
              or(
                like(demands.description, '%urgent%'),
                like(demands.description, '%emergency%')
              )
            )
          )
          .orderBy(desc(demands.createdAt))
          .limit(100);
      });

      assertQueryPerformance(result, QUERY_THRESHOLDS.MEDIUM);
    });
  });

  describe('Search Query Performance', () => {
    it('should perform text search on demands efficiently', async () => {
      const result = await measureQuery('Text search in demands', async () => {
        return await db
          .select()
          .from(demands)
          .where(
            or(
              like(demands.description, '%maintenance%'),
              like(demands.description, '%repair%'),
              like(demands.description, '%urgent%')
            )
          )
          .limit(100);
      });

      assertQueryPerformance(result, QUERY_THRESHOLDS.MEDIUM);
    });

    it('should perform multi-table search efficiently', async () => {
      const result = await measureQuery('Multi-table search', async () => {
        return await db
          .select({
            demand: demands,
            building: buildings,
            user: users
          })
          .from(demands)
          .innerJoin(buildings, eq(demands.buildingId, buildings.id))
          .innerJoin(users, eq(demands.submitterId, users.id))
          .where(
            or(
              like(buildings.name, '%Performance%'),
              like(users.firstName, '%User%'),
              like(demands.description, '%test%')
            )
          )
          .limit(100);
      });

      assertQueryPerformance(result, QUERY_THRESHOLDS.MEDIUM);
    });
  });

  describe('Pagination Performance', () => {
    it('should handle large offset pagination efficiently', async () => {
      const result = await measureQuery('Large offset pagination', async () => {
        return await db
          .select()
          .from(demands)
          .orderBy(desc(demands.createdAt))
          .limit(50)
          .offset(1000); // Skip first 1000 records
      });

      // Large offsets are typically slower
      assertQueryPerformance(result, QUERY_THRESHOLDS.SLOW);
    });

    it('should handle cursor-based pagination efficiently', async () => {
      const cursorDate = testData.demands[500].createdAt;
      
      const result = await measureQuery('Cursor-based pagination', async () => {
        return await db
          .select()
          .from(demands)
          .where(gt(demands.createdAt, cursorDate))
          .orderBy(desc(demands.createdAt))
          .limit(50);
      });

      assertQueryPerformance(result, QUERY_THRESHOLDS.MEDIUM);
    });
  });

  describe('Batch Operations Performance', () => {
    it('should handle batch inserts efficiently', async () => {
      const batchData = Array.from({ length: 100 }, (_, i) => ({
        submitterId: testData.users[i % testData.users.length].id,
        type: 'other' as const,
        description: `Batch insert test demand ${i + 1}`,
        residenceId: testData.residences[i % testData.residences.length].id,
        buildingId: testData.residences[i % testData.residences.length].buildingId,
        status: 'submitted' as const
      }));

      const result = await measureQuery('Batch insert 100 demands', async () => {
        return await db.insert(demands).values(batchData).returning({ id: demands.id });
      });

      assertQueryPerformance(result, QUERY_THRESHOLDS.MEDIUM);

      // Cleanup batch inserted demands
      const insertedIds = result.rowCount > 0 ? 
        await db.select({ id: demands.id }).from(demands).where(like(demands.description, 'Batch insert test%')) : 
        [];
      
      if (insertedIds.length > 0) {
        await db.delete(demands).where(inArray(demands.id, insertedIds.map(d => d.id)));
      }
    });

    it('should handle batch updates efficiently', async () => {
      // Get some demand IDs for testing
      const demandsToUpdate = await db
        .select({ id: demands.id })
        .from(demands)
        .where(eq(demands.status, 'submitted'))
        .limit(100);

      const demandIds = demandsToUpdate.map(d => d.id);
      
      if (demandIds.length > 0) {
        const result = await measureQuery('Batch update demand status', async () => {
          return await db
            .update(demands)
            .set({ 
              status: 'under_review',
              updatedAt: new Date()
            })
            .where(inArray(demands.id, demandIds))
            .returning({ id: demands.id });
        });

        assertQueryPerformance(result, QUERY_THRESHOLDS.MEDIUM);

        // Restore original status
        await db
          .update(demands)
          .set({ status: 'submitted' })
          .where(inArray(demands.id, demandIds));
      }
    });
  });

  describe('Index Utilization Performance', () => {
    it('should utilize primary key index efficiently', async () => {
      const randomIds = testData.users.slice(0, 10).map(u => u.id);
      
      const result = await measureQuery('Multiple users by IDs', async () => {
        return await db.select().from(users).where(inArray(users.id, randomIds));
      });

      assertQueryPerformance(result, QUERY_THRESHOLDS.FAST);
    });

    it('should utilize foreign key indexes efficiently', async () => {
      const buildingId = testData.buildings[0].id;
      
      const result = await measureQuery('Residences by building ID', async () => {
        return await db
          .select()
          .from(residences)
          .where(eq(residences.buildingId, buildingId));
      });

      assertQueryPerformance(result, QUERY_THRESHOLDS.FAST);
    });

    it('should perform well on status-based queries', async () => {
      const result = await measureQuery('Demands by status', async () => {
        return await db
          .select()
          .from(demands)
          .where(inArray(demands.status, ['submitted', 'under_review']))
          .limit(100);
      });

      assertQueryPerformance(result, QUERY_THRESHOLDS.MEDIUM);
    });
  });

  describe('Concurrent Query Performance', () => {
    it('should handle concurrent read queries efficiently', async () => {
      const concurrentQueries = Array.from({ length: 10 }, (_, i) =>
        measureQuery(`Concurrent query ${i + 1}`, async () => {
          return await db
            .select()
            .from(demands)
            .where(eq(demands.type, 'maintenance'))
            .limit(50)
            .offset(i * 50);
        })
      );

      const results = await Promise.all(concurrentQueries);
      
      results.forEach((result, index) => {
        console.log(`Concurrent query ${index + 1}: ${result.duration.toFixed(2)}ms`);
        expect(result.duration).toBeLessThan(QUERY_THRESHOLDS.SLOW);
      });
    });

    it('should maintain performance under mixed read/write load', async () => {
      const readQueries = Array.from({ length: 5 }, (_, i) =>
        measureQuery(`Mixed load read ${i + 1}`, async () => {
          return await db.select().from(users).limit(20).offset(i * 20);
        })
      );

      const writeQueries = Array.from({ length: 2 }, (_, i) =>
        measureQuery(`Mixed load write ${i + 1}`, async () => {
          return await db.insert(demandComments).values({
            demandId: testData.demands[i].id,
            authorId: testData.users[i].id,
            content: `Concurrent write test comment ${i + 1}`,
            isInternal: false
          }).returning({ id: demandComments.id });
        })
      );

      const allQueries = [...readQueries, ...writeQueries];
      const results = await Promise.all(allQueries);
      
      results.forEach(result => {
        expect(result.duration).toBeLessThan(QUERY_THRESHOLDS.SLOW);
      });

      // Cleanup test comments
      await db.delete(demandComments).where(like(demandComments.content, 'Concurrent write test%'));
    });
  });

  describe('Memory Usage and Query Optimization', () => {
    it('should handle large result sets without memory issues', async () => {
      // This test ensures we don't load excessive data into memory
      const result = await measureQuery('Large result set with limit', async () => {
        return await db
          .select({
            id: demands.id,
            type: demands.type,
            status: demands.status,
            createdAt: demands.createdAt
          })
          .from(demands)
          .orderBy(desc(demands.createdAt))
          .limit(1000); // Reasonable limit for UI pagination
      });

      assertQueryPerformance(result, QUERY_THRESHOLDS.MEDIUM);
      expect(result.rowCount).toBeLessThanOrEqual(1000);
    });

    it('should use appropriate query patterns for count operations', async () => {
      const result = await measureQuery('Efficient count with conditions', async () => {
        return await db
          .select({ 
            total: count(),
            buildingId: demands.buildingId
          })
          .from(demands)
          .where(eq(demands.type, 'maintenance'))
          .groupBy(demands.buildingId);
      });

      assertQueryPerformance(result, QUERY_THRESHOLDS.MEDIUM);
    });
  });
});