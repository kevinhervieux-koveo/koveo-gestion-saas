import type { Express, Request, Response } from 'express';
import { eq, desc, and, sql, or, gte, lte, between, inArray } from 'drizzle-orm';
import { db } from '../db';
import { requireAuth, requireRole } from '../auth';
import { z } from 'zod';
import * as schema from '@shared/schema';

const { 
  commonSpaces, 
  bookings, 
  userBookingRestrictions, 
  userTimeLimits,
  buildings, 
  users, 
  userResidences,
  userOrganizations 
} = schema;

// Validation schemas
const commonSpaceFilterSchema = z.object({
  building_id: z.string().uuid().optional(),
});

const bookingFilterSchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

const createBookingSchema = z.object({
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
});

const createRestrictionSchema = z.object({
  common_space_id: z.string().uuid(),
  is_blocked: z.boolean(),
  reason: z.string().optional(),
});

const createCommonSpaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().optional(),
  building_id: z.string().uuid('Building ID must be a valid UUID'),
  is_reservable: z.boolean().default(true),
  capacity: z.number().int().min(1).max(200).optional(),
  opening_hours: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
    end: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format')
  }).optional(),
});

const setTimeLimitSchema = z.object({
  user_id: z.string().uuid(),
  common_space_id: z.string().uuid().optional(), // null means applies to all spaces
  limit_type: z.enum(['monthly', 'yearly']),
  limit_hours: z.number().int().min(1).max(8760), // Max 1 year worth of hours
});

const spaceIdSchema = z.object({
  spaceId: z.string().uuid(),
});

const bookingIdSchema = z.object({
  bookingId: z.string().uuid(),
});

const userIdSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * Helper function to get accessible building IDs for a user based on their role
 */
async function getAccessibleBuildingIds(user: any): Promise<string[]> {
  if (user.role === 'admin' && user.canAccessAllOrganizations) {
    // Admin with global access can see all buildings
    const allBuildings = await db
      .select({ id: buildings.id })
      .from(buildings)
      .where(eq(buildings.isActive, true));
    return allBuildings.map(b => b.id);
  }

  if (['admin', 'manager'].includes(user.role)) {
    // Manager or admin without global access: only buildings from their organizations
    if (!user.organizations || user.organizations.length === 0) {
      return []; // No organizations = no buildings
    }

    const orgBuildings = await db
      .select({ id: buildings.id })
      .from(buildings)
      .where(
        and(
          eq(buildings.isActive, true),
          inArray(buildings.organizationId, user.organizations)
        )
      );
    return orgBuildings.map(b => b.id);
  }

  if (['resident', 'tenant'].includes(user.role)) {
    // Residents/tenants can only access buildings where they have residences
    const userBuildingIds = await db
      .select({ buildingId: schema.residences.buildingId })
      .from(userResidences)
      .innerJoin(schema.residences, eq(userResidences.residenceId, schema.residences.id))
      .where(
        and(
          eq(userResidences.userId, user.id),
          eq(userResidences.isActive, true)
        )
      );
    return userBuildingIds.map(b => b.buildingId);
  }

  return []; // No access by default
}

/**
 * Helper function to calculate user's total booking hours for a time period
 */
async function getUserBookingHours(
  userId: string, 
  commonSpaceId: string | null, 
  limitType: 'monthly' | 'yearly'
): Promise<number> {
  const now = new Date();
  let startDate: Date;
  
  if (limitType === 'monthly') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    startDate = new Date(now.getFullYear(), 0, 1);
  }

  const conditions = [
    eq(bookings.userId, userId),
    eq(bookings.status, 'confirmed'),
    gte(bookings.startTime, startDate)
  ];

  if (commonSpaceId) {
    conditions.push(eq(bookings.commonSpaceId, commonSpaceId));
  }

  const userBookings = await db
    .select({
      totalHours: sql<number>`EXTRACT(EPOCH FROM SUM(${bookings.endTime} - ${bookings.startTime})) / 3600`
    })
    .from(bookings)
    .where(and(...conditions));

  return userBookings[0]?.totalHours || 0;
}

/**
 * Helper function to check if user has exceeded their booking time limit
 */
async function checkUserTimeLimit(
  userId: string,
  commonSpaceId: string,
  newBookingHours: number
): Promise<{ withinLimit: boolean; message?: string; remainingHours?: number }> {
  // Get user's time limits for this space (specific or global)
  const timeLimits = await db
    .select()
    .from(userTimeLimits)
    .where(
      and(
        eq(userTimeLimits.userId, userId),
        or(
          eq(userTimeLimits.commonSpaceId, commonSpaceId),
          sql`${userTimeLimits.commonSpaceId} IS NULL`
        )
      )
    )
    .orderBy(userTimeLimits.commonSpaceId); // Specific limits come first (nulls last)

  if (timeLimits.length === 0) {
    return { withinLimit: true }; // No limits set
  }

  // Use the most specific limit (space-specific over global)
  const activeLimit = timeLimits[0];
  const currentHours = await getUserBookingHours(
    userId, 
    activeLimit.commonSpaceId, 
    activeLimit.limitType as 'monthly' | 'yearly'
  );
  
  const totalAfterBooking = currentHours + newBookingHours;
  const remainingHours = Math.max(0, activeLimit.limitHours - currentHours);

  if (totalAfterBooking > activeLimit.limitHours) {
    const limitPeriod = activeLimit.limitType === 'monthly' ? 'ce mois' : 'cette année';
    return {
      withinLimit: false,
      message: `Limite de temps dépassée. Vous avez utilisé ${Math.round(currentHours)}h sur ${activeLimit.limitHours}h autorisées pour ${limitPeriod}. Il vous reste ${Math.round(remainingHours)}h disponibles.`,
      remainingHours
    };
  }

  return { withinLimit: true, remainingHours };
}

/**
 * Helper function to check if a time slot overlaps with existing bookings
 */
async function hasOverlappingBookings(
  commonSpaceId: string, 
  startTime: Date, 
  endTime: Date, 
  excludeBookingId?: string
): Promise<boolean> {
  const conditions = [
    eq(bookings.commonSpaceId, commonSpaceId),
    eq(bookings.status, 'confirmed'),
    or(
      // New booking starts during existing booking
      and(gte(bookings.startTime, startTime), lte(bookings.startTime, endTime)),
      // New booking ends during existing booking
      and(gte(bookings.endTime, startTime), lte(bookings.endTime, endTime)),
      // New booking completely contains existing booking
      and(lte(bookings.startTime, startTime), gte(bookings.endTime, endTime)),
      // Existing booking completely contains new booking
      and(gte(bookings.startTime, startTime), lte(bookings.endTime, endTime))
    )
  ];

  if (excludeBookingId) {
    conditions.push(sql`${bookings.id} != ${excludeBookingId}`);
  }

  const overlapping = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(...conditions))
    .limit(1);

  return overlapping.length > 0;
}

/**
 * Helper function to check if user is blocked from booking a space
 */
async function isUserBlocked(userId: string, commonSpaceId: string): Promise<boolean> {
  const restriction = await db
    .select({ isBlocked: userBookingRestrictions.isBlocked })
    .from(userBookingRestrictions)
    .where(
      and(
        eq(userBookingRestrictions.userId, userId),
        eq(userBookingRestrictions.commonSpaceId, commonSpaceId)
      )
    )
    .limit(1);

  return restriction.length > 0 && restriction[0].isBlocked;
}

/**
 * Helper function to check if booking time is within opening hours
 */
function isWithinOpeningHours(startTime: Date, endTime: Date, openingHours: any[]): boolean {
  if (!openingHours || openingHours.length === 0) {
    return true; // No restrictions if no opening hours defined
  }

  const startDay = startTime.toLocaleDateString('en-US', { weekday: 'long' });
  const endDay = endTime.toLocaleDateString('en-US', { weekday: 'long' });
  
  // For simplicity, require booking to be within same day
  if (startDay !== endDay) {
    return false;
  }

  const dayHours = openingHours.find(oh => oh.day === startDay);
  if (!dayHours) {
    return false; // No hours defined for this day
  }

  const startTimeStr = startTime.toTimeString().slice(0, 5); // HH:MM format
  const endTimeStr = endTime.toTimeString().slice(0, 5);

  return startTimeStr >= dayHours.open && endTimeStr <= dayHours.close;
}

/**
 * Registers all common spaces API endpoints
 */
export function registerCommonSpacesRoutes(app: Express): void {
  /**
   * GET /api/common-spaces - Retrieve common spaces for accessible buildings
   */
  app.get('/api/common-spaces', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user || req.session?.user;
      if (!user) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Validate query parameters
      const queryValidation = commonSpaceFilterSchema.safeParse(req.query);
      if (!queryValidation.success) {
        return res.status(400).json({
          message: 'Invalid query parameters',
          errors: queryValidation.error.issues
        });
      }

      const { building_id } = queryValidation.data;
      
      console.warn(`📊 Fetching common spaces for user ${user.id} with role ${user.role}`);

      // Get accessible building IDs
      const accessibleBuildingIds = await getAccessibleBuildingIds(user);
      
      if (accessibleBuildingIds.length === 0) {
        return res.json([]);
      }

      // Build conditions
      const conditions = [eq(buildings.isActive, true)];
      
      if (building_id) {
        if (!accessibleBuildingIds.includes(building_id)) {
          return res.status(403).json({
            message: 'Access denied to this building',
            code: 'INSUFFICIENT_PERMISSIONS'
          });
        }
        conditions.push(eq(commonSpaces.buildingId, building_id));
      } else {
        conditions.push(inArray(commonSpaces.buildingId, accessibleBuildingIds));
      }

      const spaces = await db
        .select({
          id: commonSpaces.id,
          name: commonSpaces.name,
          description: commonSpaces.description,
          buildingId: commonSpaces.buildingId,
          buildingName: buildings.name,
          isReservable: commonSpaces.isReservable,
          capacity: commonSpaces.capacity,
          contactPersonId: commonSpaces.contactPersonId,
          contactPersonName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
          openingHours: commonSpaces.openingHours,
          bookingRules: commonSpaces.bookingRules,
          createdAt: commonSpaces.createdAt,
          updatedAt: commonSpaces.updatedAt
        })
        .from(commonSpaces)
        .innerJoin(buildings, eq(commonSpaces.buildingId, buildings.id))
        .leftJoin(users, eq(commonSpaces.contactPersonId, users.id))
        .where(and(...conditions))
        .orderBy(buildings.name, commonSpaces.name);

      console.warn(`✅ Found ${spaces.length} common spaces for user ${user.id}`);
      res.json(spaces);

    } catch (error) {
      console.error('Error fetching common spaces:', error);
      res.status(500).json({
        message: 'Failed to fetch common spaces',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/common-spaces/:spaceId/bookings - Get bookings for a specific space
   */
  app.get('/api/common-spaces/:spaceId/bookings', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user || req.session?.user;
      if (!user) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Validate parameters
      const paramValidation = spaceIdSchema.safeParse(req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: 'Invalid space ID',
          errors: paramValidation.error.errors
        });
      }

      const queryValidation = bookingFilterSchema.safeParse(req.query);
      if (!queryValidation.success) {
        return res.status(400).json({
          message: 'Invalid query parameters',
          errors: queryValidation.error.errors
        });
      }

      const { spaceId } = paramValidation.data;
      const { start_date, end_date } = queryValidation.data;

      // Check if user has access to this space
      const space = await db
        .select({ 
          id: commonSpaces.id, 
          buildingId: commonSpaces.buildingId 
        })
        .from(commonSpaces)
        .where(eq(commonSpaces.id, spaceId))
        .limit(1);

      if (space.length === 0) {
        return res.status(404).json({
          message: 'Common space not found',
          code: 'NOT_FOUND'
        });
      }

      const accessibleBuildingIds = await getAccessibleBuildingIds(user);
      if (!accessibleBuildingIds.includes(space[0].buildingId)) {
        return res.status(403).json({
          message: 'Access denied to this common space',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Build query conditions
      const conditions = [eq(bookings.commonSpaceId, spaceId)];
      
      if (start_date) {
        conditions.push(gte(bookings.startTime, new Date(start_date)));
      }
      
      if (end_date) {
        conditions.push(lte(bookings.endTime, new Date(end_date)));
      }

      const spaceBookings = await db
        .select({
          id: bookings.id,
          commonSpaceId: bookings.commonSpaceId,
          userId: bookings.userId,
          userName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
          userEmail: users.email,
          startTime: bookings.startTime,
          endTime: bookings.endTime,
          status: bookings.status,
          createdAt: bookings.createdAt,
          updatedAt: bookings.updatedAt
        })
        .from(bookings)
        .innerJoin(users, eq(bookings.userId, users.id))
        .where(and(...conditions))
        .orderBy(bookings.startTime);

      res.json(spaceBookings);

    } catch (error) {
      console.error('Error fetching bookings:', error);
      res.status(500).json({
        message: 'Failed to fetch bookings',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/common-spaces/:spaceId/bookings - Create a new booking
   */
  app.post('/api/common-spaces/:spaceId/bookings', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user || req.session?.user;
      if (!user) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Validate parameters and body
      const paramValidation = spaceIdSchema.safeParse(req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: 'Invalid space ID',
          errors: paramValidation.error.errors
        });
      }

      const bodyValidation = createBookingSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: 'Invalid booking data',
          errors: bodyValidation.error.errors
        });
      }

      const { spaceId } = paramValidation.data;
      const { start_time, end_time } = bodyValidation.data;

      const startTime = new Date(start_time);
      const endTime = new Date(end_time);

      // Validate time range
      if (startTime >= endTime) {
        return res.status(400).json({
          message: 'Start time must be before end time',
          code: 'INVALID_TIME_RANGE'
        });
      }

      if (startTime < new Date()) {
        return res.status(400).json({
          message: 'Cannot book in the past',
          code: 'INVALID_TIME_RANGE'
        });
      }

      // Get common space details
      const space = await db
        .select({
          id: commonSpaces.id,
          name: commonSpaces.name,
          buildingId: commonSpaces.buildingId,
          isReservable: commonSpaces.isReservable,
          openingHours: commonSpaces.openingHours
        })
        .from(commonSpaces)
        .where(eq(commonSpaces.id, spaceId))
        .limit(1);

      if (space.length === 0) {
        return res.status(404).json({
          message: 'Common space not found',
          code: 'NOT_FOUND'
        });
      }

      const commonSpace = space[0];

      // Check if space is reservable
      if (!commonSpace.isReservable) {
        return res.status(400).json({
          message: 'This common space is not reservable',
          code: 'NOT_RESERVABLE'
        });
      }

      // Check user access to building
      const accessibleBuildingIds = await getAccessibleBuildingIds(user);
      if (!accessibleBuildingIds.includes(commonSpace.buildingId)) {
        return res.status(403).json({
          message: 'Access denied to this common space',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Check if user is blocked
      const blocked = await isUserBlocked(user.id, spaceId);
      if (blocked) {
        return res.status(403).json({
          message: 'You are blocked from booking this space',
          code: 'USER_BLOCKED'
        });
      }

      // Check opening hours
      if (commonSpace.openingHours && !isWithinOpeningHours(startTime, endTime, commonSpace.openingHours as any[])) {
        return res.status(400).json({
          message: 'Booking time is outside opening hours',
          code: 'OUTSIDE_OPENING_HOURS'
        });
      }

      // Check for overlapping bookings
      const hasOverlap = await hasOverlappingBookings(spaceId, startTime, endTime);
      if (hasOverlap) {
        return res.status(409).json({
          message: 'Time slot is already booked',
          code: 'TIME_CONFLICT'
        });
      }

      // Check user's time limits
      const bookingDurationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      const timeLimitCheck = await checkUserTimeLimit(user.id, spaceId, bookingDurationHours);
      
      if (!timeLimitCheck.withinLimit) {
        return res.status(403).json({
          message: timeLimitCheck.message,
          code: 'TIME_LIMIT_EXCEEDED',
          remainingHours: timeLimitCheck.remainingHours
        });
      }

      // Create booking
      const newBooking = await db
        .insert(bookings)
        .values({
          commonSpaceId: spaceId,
          userId: user.id,
          startTime,
          endTime,
          status: 'confirmed'
        })
        .returning();

      res.status(201).json({
        message: 'Booking created successfully',
        booking: newBooking[0]
      });

    } catch (error) {
      console.error('Error creating booking:', error);
      res.status(500).json({
        message: 'Failed to create booking',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * DELETE /api/common-spaces/bookings/:bookingId - Cancel a booking
   */
  app.delete('/api/common-spaces/bookings/:bookingId', requireAuth, async (req: any, res: Response) => {
    try {
      const user = req.user || req.session?.user;
      if (!user) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Validate parameters
      const paramValidation = bookingIdSchema.safeParse(req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: 'Invalid booking ID',
          errors: paramValidation.error.errors
        });
      }

      const { bookingId } = paramValidation.data;

      // Get booking details
      const booking = await db
        .select({
          id: bookings.id,
          userId: bookings.userId,
          commonSpaceId: bookings.commonSpaceId,
          buildingId: commonSpaces.buildingId,
          status: bookings.status
        })
        .from(bookings)
        .innerJoin(commonSpaces, eq(bookings.commonSpaceId, commonSpaces.id))
        .where(eq(bookings.id, bookingId))
        .limit(1);

      if (booking.length === 0) {
        return res.status(404).json({
          message: 'Booking not found',
          code: 'NOT_FOUND'
        });
      }

      const bookingDetails = booking[0];

      // Check permissions: users can cancel their own bookings, managers can cancel any in their buildings
      const canCancel = bookingDetails.userId === user.id || 
        (['admin', 'manager'].includes(user.role) && 
         (await getAccessibleBuildingIds(user)).includes(bookingDetails.buildingId));

      if (!canCancel) {
        return res.status(403).json({
          message: 'You can only cancel your own bookings',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Update booking status to cancelled
      await db
        .update(bookings)
        .set({
          status: 'cancelled',
          updatedAt: new Date()
        })
        .where(eq(bookings.id, bookingId));

      res.json({
        message: 'Booking cancelled successfully'
      });

    } catch (error) {
      console.error('Error cancelling booking:', error);
      res.status(500).json({
        message: 'Failed to cancel booking',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/common-spaces/:spaceId/stats - Get usage statistics (Manager/Admin only)
   */
  app.get('/api/common-spaces/:spaceId/stats', requireAuth, requireRole(['admin', 'manager']), async (req: any, res: Response) => {
    try {
      const user = req.user || req.session?.user;
      if (!user) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Validate parameters
      const paramValidation = spaceIdSchema.safeParse(req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: 'Invalid space ID',
          errors: paramValidation.error.errors
        });
      }

      const { spaceId } = paramValidation.data;

      // Check access to space
      const space = await db
        .select({ 
          id: commonSpaces.id, 
          buildingId: commonSpaces.buildingId,
          name: commonSpaces.name
        })
        .from(commonSpaces)
        .where(eq(commonSpaces.id, spaceId))
        .limit(1);

      if (space.length === 0) {
        return res.status(404).json({
          message: 'Common space not found',
          code: 'NOT_FOUND'
        });
      }

      const accessibleBuildingIds = await getAccessibleBuildingIds(user);
      if (!accessibleBuildingIds.includes(space[0].buildingId)) {
        return res.status(403).json({
          message: 'Access denied to this common space',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Calculate stats for last year
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const stats = await db
        .select({
          userId: bookings.userId,
          userName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
          userEmail: users.email,
          totalHours: sql<number>`EXTRACT(EPOCH FROM SUM(${bookings.endTime} - ${bookings.startTime})) / 3600`,
          totalBookings: sql<number>`COUNT(${bookings.id})`
        })
        .from(bookings)
        .innerJoin(users, eq(bookings.userId, users.id))
        .where(
          and(
            eq(bookings.commonSpaceId, spaceId),
            eq(bookings.status, 'confirmed'),
            gte(bookings.startTime, oneYearAgo)
          )
        )
        .groupBy(bookings.userId, users.firstName, users.lastName, users.email)
        .orderBy(desc(sql<number>`EXTRACT(EPOCH FROM SUM(${bookings.endTime} - ${bookings.startTime})) / 3600`));

      const totalStats = await db
        .select({
          totalBookings: sql<number>`COUNT(${bookings.id})`,
          totalHours: sql<number>`EXTRACT(EPOCH FROM SUM(${bookings.endTime} - ${bookings.startTime})) / 3600`,
          uniqueUsers: sql<number>`COUNT(DISTINCT ${bookings.userId})`
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.commonSpaceId, spaceId),
            eq(bookings.status, 'confirmed'),
            gte(bookings.startTime, oneYearAgo)
          )
        );

      res.json({
        spaceName: space[0].name,
        period: 'Last 12 months',
        summary: totalStats[0],
        userStats: stats
      });

    } catch (error) {
      console.error('Error fetching space stats:', error);
      res.status(500).json({
        message: 'Failed to fetch space statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/common-spaces/users/:userId/restrictions - Block/unblock user (Manager/Admin only)
   */
  app.post('/api/common-spaces/users/:userId/restrictions', requireAuth, requireRole(['admin', 'manager']), async (req: any, res: Response) => {
    try {
      const user = req.user || req.session?.user;
      if (!user) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Validate parameters and body
      const paramValidation = userIdSchema.safeParse(req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: 'Invalid user ID',
          errors: paramValidation.error.errors
        });
      }

      const bodyValidation = createRestrictionSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: 'Invalid restriction data',
          errors: bodyValidation.error.errors
        });
      }

      const { userId } = paramValidation.data;
      const { common_space_id, is_blocked, reason } = bodyValidation.data;

      // Check if target user exists
      const targetUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (targetUser.length === 0) {
        return res.status(404).json({
          message: 'User not found',
          code: 'NOT_FOUND'
        });
      }

      // Check if common space exists and user has access
      const space = await db
        .select({ 
          id: commonSpaces.id, 
          buildingId: commonSpaces.buildingId 
        })
        .from(commonSpaces)
        .where(eq(commonSpaces.id, common_space_id))
        .limit(1);

      if (space.length === 0) {
        return res.status(404).json({
          message: 'Common space not found',
          code: 'NOT_FOUND'
        });
      }

      const accessibleBuildingIds = await getAccessibleBuildingIds(user);
      if (!accessibleBuildingIds.includes(space[0].buildingId)) {
        return res.status(403).json({
          message: 'Access denied to this common space',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Check if restriction already exists
      const existingRestriction = await db
        .select({ id: userBookingRestrictions.id })
        .from(userBookingRestrictions)
        .where(
          and(
            eq(userBookingRestrictions.userId, userId),
            eq(userBookingRestrictions.commonSpaceId, common_space_id)
          )
        )
        .limit(1);

      if (existingRestriction.length > 0) {
        // Update existing restriction
        await db
          .update(userBookingRestrictions)
          .set({
            isBlocked: is_blocked,
            reason,
            updatedAt: new Date()
          })
          .where(eq(userBookingRestrictions.id, existingRestriction[0].id));
      } else {
        // Create new restriction
        await db
          .insert(userBookingRestrictions)
          .values({
            userId,
            commonSpaceId: common_space_id,
            isBlocked: is_blocked,
            reason
          });
      }

      res.json({
        message: `User ${is_blocked ? 'blocked from' : 'unblocked from'} booking this space`
      });

    } catch (error) {
      console.error('Error managing user restriction:', error);
      res.status(500).json({
        message: 'Failed to manage user restriction',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/common-spaces - Create a new common space (Manager/Admin only)
   */
  app.post('/api/common-spaces', requireAuth, requireRole(['admin', 'manager']), async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Validate request body
      const validationResult = createCommonSpaceSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: 'Invalid request data',
          errors: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      const { name, description, building_id, is_reservable, capacity, opening_hours } = validationResult.data;

      // Check if user has access to this building
      const accessibleBuildingIds = await getAccessibleBuildingIds(user);
      if (!accessibleBuildingIds.includes(building_id)) {
        return res.status(403).json({
          message: 'Access denied. You can only create spaces in buildings you manage.',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      // Verify building exists and is active
      const building = await db
        .select({ id: buildings.id, name: buildings.name })
        .from(buildings)
        .where(
          and(
            eq(buildings.id, building_id),
            eq(buildings.isActive, true)
          )
        )
        .limit(1);

      if (building.length === 0) {
        return res.status(404).json({
          message: 'Building not found or inactive',
          code: 'BUILDING_NOT_FOUND'
        });
      }

      // Check if a space with the same name already exists in this building
      const existingSpace = await db
        .select({ id: commonSpaces.id })
        .from(commonSpaces)
        .where(
          and(
            eq(commonSpaces.name, name),
            eq(commonSpaces.buildingId, building_id)
          )
        )
        .limit(1);

      if (existingSpace.length > 0) {
        return res.status(409).json({
          message: 'A common space with this name already exists in this building',
          code: 'DUPLICATE_NAME'
        });
      }

      // Create the new common space
      const newSpace = await db
        .insert(commonSpaces)
        .values({
          name,
          description: description || null,
          buildingId: building_id,
          isReservable: is_reservable,
          capacity: capacity || null,
          openingHours: opening_hours ? `${opening_hours.start}-${opening_hours.end}` : null,
        })
        .returning();

      console.log(`✅ Created new common space: ${name} in building ${building[0].name}`);

      res.status(201).json({
        message: 'Common space created successfully',
        space: {
          id: newSpace[0].id,
          name: newSpace[0].name,
          description: newSpace[0].description,
          buildingId: newSpace[0].buildingId,
          buildingName: building[0].name,
          isReservable: newSpace[0].isReservable,
          capacity: newSpace[0].capacity,
          openingHours: newSpace[0].openingHours,
          createdAt: newSpace[0].createdAt
        }
      });

    } catch (error) {
      console.error('Error creating common space:', error);
      res.status(500).json({
        message: 'Failed to create common space',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/common-spaces/users/:userId/time-limits - Set user time limits (Manager/Admin only)
   */
  app.post('/api/common-spaces/users/:userId/time-limits', requireAuth, requireRole(['admin', 'manager']), async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Validate parameters
      const paramValidation = userIdSchema.safeParse(req.params);
      if (!paramValidation.success) {
        return res.status(400).json({
          message: 'Invalid user ID',
          errors: paramValidation.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      // Validate request body
      const validationResult = setTimeLimitSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: 'Invalid time limit data',
          errors: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }

      const { userId } = paramValidation.data;
      const { user_id, common_space_id, limit_type, limit_hours } = validationResult.data;

      // Verify user exists
      const targetUser = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (targetUser.length === 0) {
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // If common_space_id is provided, verify space exists and user has access
      if (common_space_id) {
        const space = await db
          .select({ id: commonSpaces.id, name: commonSpaces.name, buildingId: commonSpaces.buildingId })
          .from(commonSpaces)
          .where(eq(commonSpaces.id, common_space_id))
          .limit(1);

        if (space.length === 0) {
          return res.status(404).json({
            message: 'Common space not found',
            code: 'SPACE_NOT_FOUND'
          });
        }

        const accessibleBuildingIds = await getAccessibleBuildingIds(user);
        if (!accessibleBuildingIds.includes(space[0].buildingId)) {
          return res.status(403).json({
            message: 'Access denied to this common space',
            code: 'INSUFFICIENT_PERMISSIONS'
          });
        }
      }

      // Check if a time limit already exists
      const existingLimit = await db
        .select({ id: userTimeLimits.id })
        .from(userTimeLimits)
        .where(
          and(
            eq(userTimeLimits.userId, userId),
            common_space_id 
              ? eq(userTimeLimits.commonSpaceId, common_space_id)
              : sql`${userTimeLimits.commonSpaceId} IS NULL`,
            eq(userTimeLimits.limitType, limit_type)
          )
        )
        .limit(1);

      if (existingLimit.length > 0) {
        // Update existing limit
        await db
          .update(userTimeLimits)
          .set({
            limitHours: limit_hours,
            updatedAt: new Date()
          })
          .where(eq(userTimeLimits.id, existingLimit[0].id));
      } else {
        // Create new limit
        await db
          .insert(userTimeLimits)
          .values({
            userId,
            commonSpaceId: common_space_id || null,
            limitType: limit_type,
            limitHours: limit_hours,
          });
      }

      console.log(`✅ Set time limit for user ${targetUser[0].firstName} ${targetUser[0].lastName}: ${limit_hours}h per ${limit_type}`);

      res.json({
        message: 'Time limit set successfully',
        user: {
          id: targetUser[0].id,
          name: `${targetUser[0].firstName} ${targetUser[0].lastName}`,
          limitType: limit_type,
          limitHours: limit_hours,
          spaceId: common_space_id
        }
      });

    } catch (error) {
      console.error('Error setting time limit:', error);
      res.status(500).json({
        message: 'Failed to set time limit',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/common-spaces/users/:userId/time-limits - Get user time limits
   */
  app.get('/api/common-spaces/users/:userId/time-limits', requireAuth, requireRole(['admin', 'manager']), async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { userId } = req.params;

      // Get user's time limits
      const limits = await db
        .select({
          id: userTimeLimits.id,
          userId: userTimeLimits.userId,
          commonSpaceId: userTimeLimits.commonSpaceId,
          spaceName: commonSpaces.name,
          limitType: userTimeLimits.limitType,
          limitHours: userTimeLimits.limitHours,
          createdAt: userTimeLimits.createdAt,
          updatedAt: userTimeLimits.updatedAt
        })
        .from(userTimeLimits)
        .leftJoin(commonSpaces, eq(userTimeLimits.commonSpaceId, commonSpaces.id))
        .where(eq(userTimeLimits.userId, userId))
        .orderBy(userTimeLimits.limitType, userTimeLimits.commonSpaceId);

      // Calculate current usage for each limit
      const limitsWithUsage = await Promise.all(
        limits.map(async (limit) => {
          const currentHours = await getUserBookingHours(
            userId,
            limit.commonSpaceId,
            limit.limitType as 'monthly' | 'yearly'
          );
          
          return {
            ...limit,
            currentHours: Math.round(currentHours * 100) / 100,
            remainingHours: Math.max(0, limit.limitHours - currentHours)
          };
        })
      );

      res.json({
        limits: limitsWithUsage
      });

    } catch (error) {
      console.error('Error fetching time limits:', error);
      res.status(500).json({
        message: 'Failed to fetch time limits',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}