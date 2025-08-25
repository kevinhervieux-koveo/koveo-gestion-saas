import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';

// Mock database functions
const mockRunQuery = jest.fn();
const mockConnectDB = jest.fn();
const mockCloseDB = jest.fn();

/**
 * Test configuration data for calendar integration.
 */
const DEMO_USERS = {
  // Admin user with full access
  ADMIN: {
    id: '222f5a0d-6bc6-4f28-9f4d-32c133eed333',
    email: 'admin@koveo.ca',
    role: 'admin',
    name: 'Marie Tremblay'
  },
  // Manager user with organization access
  MANAGER: {
    id: 'cb8e5b4d-8f2a-4e8d-9c5a-1b2c3d4e5f6g',
    email: 'manager@koveo.ca',
    role: 'manager',
    name: 'Jean Dupuis'
  },
  // Resident user with limited access
  RESIDENT: {
    id: '9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d',
    email: 'resident@demo.ca',
    role: 'resident',  
    name: 'Sophie Martin'
  }
};

const DEMO_ORGANIZATION = {
  id: 'e98cc553-c2d7-4854-877a-7cc9eeb8c6b6',
  name: 'Demo Organization'
};

const DEMO_BUILDINGS = {
  BUILDING_1: {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    name: 'Complexe Rivière-des-Prairies'
  },
  BUILDING_2: {
    id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', 
    name: 'Résidence du Lac-Saint-Charles'
  }
};

/**
 * Integration tests for Common Spaces Calendar functionality
 * Tests calendar API endpoints and frontend integration with role-based permissions.
 */
describe('Common Spaces Calendar Integration', () => {
  beforeAll(async () => {
    await mockConnectDB();
  });

  afterAll(async () => {
    await mockCloseDB();
  });

  beforeEach(async () => {
    // Clean up any test bookings
    await mockRunQuery(`
      DELETE FROM common_space_bookings 
      WHERE start_time > NOW() - INTERVAL '1 day'
        AND status = 'confirmed'
        AND common_space_id IN (
          SELECT id FROM common_spaces 
          WHERE building_id IN ($1, $2)
        )
    `, [DEMO_BUILDINGS.BUILDING_1.id, DEMO_BUILDINGS.BUILDING_2.id]);
  });

  describe('Calendar API Endpoints', () => {
    test('User Calendar API returns personal bookings only', async () => {
      // Create test booking for resident user
      const testBooking = {
        commonSpaceId: await getTestCommonSpaceId(),
        userId: DEMO_USERS.RESIDENT.id,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // +2 hours
        status: 'confirmed'
      };

      await createTestBooking(testBooking);

      // Simulate API request for user calendar
      const startDate = new Date();
      startDate.setDate(1); // First of month
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0); // Last day of month

      const userCalendarData = await getUserCalendar(DEMO_USERS.RESIDENT.id, startDate, endDate);

      expect(userCalendarData).toHaveProperty('user');
      expect(userCalendarData.user.id).toBe(DEMO_USERS.RESIDENT.id);
      expect(userCalendarData).toHaveProperty('calendar');
      expect(userCalendarData.calendar).toHaveProperty('bookings');
      expect(Array.isArray(userCalendarData.calendar.bookings)).toBe(true);
      
      // Should contain the created booking
      const foundBooking = userCalendarData.calendar.bookings.find((booking: any) => 
        booking.userId === DEMO_USERS.RESIDENT.id
      );
      expect(foundBooking).toBeDefined();
      expect(foundBooking.spaceName).toBeDefined();
      expect(foundBooking.buildingName).toBeDefined();
    });

    test('Space Calendar API respects user permissions', async () => {
      const spaceId = await getTestCommonSpaceId();
      
      // Create bookings from different users
      const residentBooking = {
        commonSpaceId: spaceId,
        userId: DEMO_USERS.RESIDENT.id,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        status: 'confirmed'
      };

      const adminBooking = {
        commonSpaceId: spaceId,
        userId: DEMO_USERS.ADMIN.id,
        startTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 25 * 60 * 60 * 1000 + 60 * 60 * 1000),
        status: 'confirmed'
      };

      await createTestBooking(residentBooking);
      await createTestBooking(adminBooking);

      const startDate = new Date();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Test as resident - should see limited info for other bookings
      const residentView = await getSpaceCalendar(spaceId, DEMO_USERS.RESIDENT.id, startDate, endDate);
      
      expect(residentView).toHaveProperty('calendar');
      expect(residentView.calendar.events).toHaveLength(2);
      
      // Own booking should show full details
      const ownEvent = residentView.calendar.events.find((event: any) => event.isOwnBooking);
      expect(ownEvent).toBeDefined();
      expect(ownEvent.userName).toBe(DEMO_USERS.RESIDENT.name);
      
      // Other booking should show limited info
      const otherEvent = residentView.calendar.events.find((event: any) => !event.isOwnBooking);
      expect(otherEvent).toBeDefined();
      expect(otherEvent.userName).toBe('Déjà Réservé');
      expect(otherEvent.userEmail).toBeNull();

      // Test as manager - should see full details for all bookings
      const managerView = await getSpaceCalendar(spaceId, DEMO_USERS.MANAGER.id, startDate, endDate);
      
      expect(managerView.permissions.canViewDetails).toBe(true);
      expect(managerView.calendar.events).toHaveLength(2);
      
      // All events should show full details
      managerView.calendar.events.forEach((event: any) => {
        expect(event.userName).not.toBe('Déjà Réservé');
        expect(event.userEmail).toBeDefined();
      });
    });

    test('Building Calendar API aggregates all spaces for managers', async () => {
      const buildingId = DEMO_BUILDINGS.BUILDING_1.id;
      
      // Create bookings across multiple spaces in the building
      const spaces = await getCommonSpacesForBuilding(buildingId);
      expect(spaces.length).toBeGreaterThan(0);

      const bookings = [];
      for (let i = 0; i < Math.min(spaces.length, 3); i++) {
        const booking = {
          commonSpaceId: spaces[i].id,
          userId: i === 0 ? DEMO_USERS.RESIDENT.id : DEMO_USERS.ADMIN.id,
          startTime: new Date(Date.now() + (24 + i) * 60 * 60 * 1000),
          endTime: new Date(Date.now() + (24 + i) * 60 * 60 * 1000 + 60 * 60 * 1000),
          status: 'confirmed'
        };
        bookings.push(booking);
        await createTestBooking(booking);
      }

      const startDate = new Date();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Test manager building calendar
      const buildingCalendar = await getBuildingCalendar(buildingId, DEMO_USERS.MANAGER.id, startDate, endDate);
      
      expect(buildingCalendar).toHaveProperty('building');
      expect(buildingCalendar.building.id).toBe(buildingId);
      expect(buildingCalendar).toHaveProperty('calendar');
      expect(buildingCalendar.calendar.events).toHaveLength(bookings.length);
      
      // Should include space names in events
      buildingCalendar.calendar.events.forEach((event: any) => {
        expect(event.spaceName).toBeDefined();
        expect(event.spaceId).toBeDefined();
      });

      // Should include summary statistics
      expect(buildingCalendar).toHaveProperty('summary');
      expect(buildingCalendar.summary.totalBookings).toBeGreaterThanOrEqual(bookings.length);
      expect(buildingCalendar.summary.uniqueUsers).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Calendar Permission System', () => {
    test('Resident users see "Already Reserved" for other bookings', async () => {
      const spaceId = await getTestCommonSpaceId();
      
      // Create booking by admin user
      await createTestBooking({
        commonSpaceId: spaceId,
        userId: DEMO_USERS.ADMIN.id,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        status: 'confirmed'
      });

      const startDate = new Date();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const residentView = await getSpaceCalendar(spaceId, DEMO_USERS.RESIDENT.id, startDate, endDate);
      
      expect(residentView.permissions.canViewDetails).toBe(false);
      const event = residentView.calendar.events[0];
      expect(event.userName).toBe('Déjà Réservé');
      expect(event.userEmail).toBeNull();
      expect(event.isOwnBooking).toBe(false);
    });

    test('Manager and admin users see full booking details', async () => {
      const spaceId = await getTestCommonSpaceId();
      
      // Create booking by resident user
      await createTestBooking({
        commonSpaceId: spaceId,
        userId: DEMO_USERS.RESIDENT.id,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        status: 'confirmed'
      });

      const startDate = new Date();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Test manager view
      const managerView = await getSpaceCalendar(spaceId, DEMO_USERS.MANAGER.id, startDate, endDate);
      
      expect(managerView.permissions.canViewDetails).toBe(true);
      const managerEvent = managerView.calendar.events[0];
      expect(managerEvent.userName).toBe(DEMO_USERS.RESIDENT.name);
      expect(managerEvent.userEmail).toBe(DEMO_USERS.RESIDENT.email);

      // Test admin view
      const adminView = await getSpaceCalendar(spaceId, DEMO_USERS.ADMIN.id, startDate, endDate);
      
      expect(adminView.permissions.canViewDetails).toBe(true);
      const adminEvent = adminView.calendar.events[0];
      expect(adminEvent.userName).toBe(DEMO_USERS.RESIDENT.name);
      expect(adminEvent.userEmail).toBe(DEMO_USERS.RESIDENT.email);
    });

    test('Own bookings always show full details regardless of role', async () => {
      const spaceId = await getTestCommonSpaceId();
      
      // Create booking by resident user
      await createTestBooking({
        commonSpaceId: spaceId,
        userId: DEMO_USERS.RESIDENT.id,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        status: 'confirmed'
      });

      const startDate = new Date();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const residentView = await getSpaceCalendar(spaceId, DEMO_USERS.RESIDENT.id, startDate, endDate);
      
      const ownBooking = residentView.calendar.events.find((event: any) => event.isOwnBooking);
      expect(ownBooking).toBeDefined();
      expect(ownBooking.userName).toBe(DEMO_USERS.RESIDENT.name);
      expect(ownBooking.userEmail).toBe(DEMO_USERS.RESIDENT.email);
      expect(ownBooking.isOwnBooking).toBe(true);
    });
  });

  describe('Calendar Integration with Existing Booking System', () => {
    test('Calendar shows existing bookings with correct status', async () => {
      const spaceId = await getTestCommonSpaceId();
      
      // Create confirmed and cancelled bookings
      await createTestBooking({
        commonSpaceId: spaceId,
        userId: DEMO_USERS.RESIDENT.id,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        status: 'confirmed'
      });

      await createTestBooking({
        commonSpaceId: spaceId,
        userId: DEMO_USERS.RESIDENT.id,
        startTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 26 * 60 * 60 * 1000 + 60 * 60 * 1000),
        status: 'cancelled'
      });

      const startDate = new Date();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const calendar = await getSpaceCalendar(spaceId, DEMO_USERS.RESIDENT.id, startDate, endDate);
      
      // Should only show confirmed bookings in calendar view
      expect(calendar.calendar.events).toHaveLength(1);
      expect(calendar.calendar.events[0].status).toBe('confirmed');
    });

    test('Calendar respects time limits and booking restrictions', async () => {
      const spaceId = await getTestCommonSpaceId();
      
      // Verify that space is reservable
      const space = await runQuery(`
        SELECT is_reservable, opening_hours
        FROM common_spaces 
        WHERE id = $1
      `, [spaceId]);

      expect(space.rows[0].is_reservable).toBe(true);
      
      // Calendar should indicate space availability
      const startDate = new Date();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const calendar = await getSpaceCalendar(spaceId, DEMO_USERS.RESIDENT.id, startDate, endDate);
      
      expect(calendar.space.isReservable).toBe(true);
      expect(calendar.permissions.canCreateBookings).toBe(true);
    });
  });

  describe('Calendar Data Integrity', () => {
    test('Calendar events include all required fields', async () => {
      const spaceId = await getTestCommonSpaceId();
      
      await createTestBooking({
        commonSpaceId: spaceId,
        userId: DEMO_USERS.ADMIN.id,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 90 * 60 * 1000), // 1.5 hours
        status: 'confirmed'
      });

      const startDate = new Date();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const calendar = await getSpaceCalendar(spaceId, DEMO_USERS.ADMIN.id, startDate, endDate);
      
      const event = calendar.calendar.events[0];
      
      // Validate all required event fields
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('startTime');
      expect(event).toHaveProperty('endTime');
      expect(event).toHaveProperty('status');
      expect(event).toHaveProperty('userName');
      expect(event.status).toBe('confirmed');
      
      // Validate time formats
      expect(new Date(event.startTime)).toBeInstanceOf(Date);
      expect(new Date(event.endTime)).toBeInstanceOf(Date);
      
      // Validate duration calculation
      const duration = new Date(event.endTime).getTime() - new Date(event.startTime).getTime();
      expect(duration).toBe(90 * 60 * 1000); // 1.5 hours in milliseconds
    });

    test('Calendar summary statistics are accurate', async () => {
      const buildingId = DEMO_BUILDINGS.BUILDING_1.id;
      const spaces = await getCommonSpacesForBuilding(buildingId);
      
      // Create multiple bookings with known statistics
      const testBookings = [
        {
          commonSpaceId: spaces[0].id,
          userId: DEMO_USERS.RESIDENT.id,
          startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours
          status: 'confirmed'
        },
        {
          commonSpaceId: spaces[0].id,
          userId: DEMO_USERS.ADMIN.id,
          startTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 26 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hour
          status: 'confirmed'
        }
      ];

      for (const booking of testBookings) {
        await createTestBooking(booking);
      }

      const startDate = new Date();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const calendar = await getBuildingCalendar(buildingId, DEMO_USERS.MANAGER.id, startDate, endDate);
      
      expect(calendar.summary.totalBookings).toBeGreaterThanOrEqual(2);
      expect(calendar.summary.totalHours).toBeGreaterThanOrEqual(3); // 2 + 1 hours
      expect(calendar.summary.uniqueUsers).toBeGreaterThanOrEqual(2);
    });
  });
});

/**
 * Helper functions for calendar integration tests.
 */

/**
 *
 */
async function getTestCommonSpaceId(): Promise<string> {
  const result = await runQuery(`
    SELECT id FROM common_spaces 
    WHERE building_id = $1 
      AND is_reservable = true 
    LIMIT 1
  `, [DEMO_BUILDINGS.BUILDING_1.id]);
  
  if (result.rows.length === 0) {
    throw new Error('No reservable common space found for testing');
  }
  
  return result.rows[0].id;
}

/**
 *
 * @param booking
 * @param booking.commonSpaceId
 * @param booking.userId
 * @param booking.startTime
 * @param booking.endTime
 * @param booking.status
 */
async function createTestBooking(booking: {
  commonSpaceId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: string;
}): Promise<string> {
  const result = await runQuery(`
    INSERT INTO common_space_bookings 
    (common_space_id, user_id, start_time, end_time, status, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    RETURNING id
  `, [booking.commonSpaceId, booking.userId, booking.startTime, booking.endTime, booking.status]);
  
  return result.rows[0].id;
}

/**
 *
 * @param userId
 * @param startDate
 * @param endDate
 */
async function getUserCalendar(userId: string, startDate: Date, endDate: Date): Promise<any> {
  // Simulate the user calendar API endpoint
  const result = await runQuery(`
    SELECT 
      b.id,
      b.start_time,
      b.end_time,
      b.status,
      cs.name as space_name,
      cs.id as space_id,
      bld.name as building_name,
      bld.id as building_id
    FROM common_space_bookings b
    JOIN common_spaces cs ON b.common_space_id = cs.id
    JOIN buildings bld ON cs.building_id = bld.id
    WHERE b.user_id = $1
      AND b.start_time >= $2
      AND b.start_time <= $3
      AND b.status = 'confirmed'
    ORDER BY b.start_time
  `, [userId, startDate, endDate]);

  const user = await runQuery('SELECT id, first_name, last_name, role FROM users WHERE id = $1', [userId]);

  return {
    user: {
      id: userId,
      name: `${user.rows[0].first_name} ${user.rows[0].last_name}`,
      role: user.rows[0].role
    },
    calendar: {
      view: 'month',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      bookings: result.rows.map(row => ({
        id: row.id,
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.status,
        spaceName: row.space_name,
        spaceId: row.space_id,
        buildingName: row.building_name,
        buildingId: row.building_id
      }))
    },
    summary: {
      totalBookings: result.rows.length,
      totalHours: result.rows.reduce((total, row) => {
        return total + (new Date(row.end_time).getTime() - new Date(row.start_time).getTime()) / (60 * 60 * 1000);
      }, 0)
    }
  };
}

/**
 *
 * @param spaceId
 * @param userId
 * @param startDate
 * @param endDate
 */
async function getSpaceCalendar(spaceId: string, userId: string, startDate: Date, endDate: Date): Promise<any> {
  // Check user permissions
  const user = await runQuery('SELECT role FROM users WHERE id = $1', [userId]);
  const canViewDetails = ['manager', 'admin'].includes(user.rows[0].role);

  // Get space info
  const space = await runQuery(`
    SELECT name, is_reservable, opening_hours
    FROM common_spaces 
    WHERE id = $1
  `, [spaceId]);

  // Get bookings for the space
  const bookings = await runQuery(`
    SELECT 
      b.id,
      b.start_time,
      b.end_time,
      b.status,
      b.user_id,
      u.first_name,
      u.last_name,
      u.email
    FROM common_space_bookings b
    JOIN users u ON b.user_id = u.id
    WHERE b.common_space_id = $1
      AND b.start_time >= $2
      AND b.start_time <= $3
      AND b.status = 'confirmed'
    ORDER BY b.start_time
  `, [spaceId, startDate, endDate]);

  const events = bookings.rows.map(row => {
    const isOwnBooking = row.user_id === userId;
    
    return {
      id: row.id,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status,
      userId: canViewDetails || isOwnBooking ? row.user_id : null,
      userName: canViewDetails || isOwnBooking ? `${row.first_name} ${row.last_name}` : 'Déjà Réservé',
      userEmail: canViewDetails || isOwnBooking ? row.email : null,
      isOwnBooking
    };
  });

  return {
    space: {
      id: spaceId,
      name: space.rows[0].name,
      isReservable: space.rows[0].is_reservable,
      openingHours: space.rows[0].opening_hours
    },
    calendar: {
      view: 'month',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      events
    },
    permissions: {
      canViewDetails,
      canCreateBookings: space.rows[0].is_reservable
    }
  };
}

/**
 *
 * @param buildingId
 * @param userId
 * @param startDate
 * @param endDate
 */
async function getBuildingCalendar(buildingId: string, userId: string, startDate: Date, endDate: Date): Promise<any> {
  // Get building info
  const building = await runQuery(`
    SELECT name, address
    FROM buildings 
    WHERE id = $1
  `, [buildingId]);

  // Get all bookings for spaces in this building
  const bookings = await runQuery(`
    SELECT 
      b.id,
      b.start_time,
      b.end_time,
      b.status,
      b.user_id,
      u.first_name,
      u.last_name,
      u.email,
      cs.name as space_name,
      cs.id as space_id
    FROM common_space_bookings b
    JOIN users u ON b.user_id = u.id
    JOIN common_spaces cs ON b.common_space_id = cs.id
    WHERE cs.building_id = $1
      AND b.start_time >= $2
      AND b.start_time <= $3
      AND b.status = 'confirmed'
    ORDER BY b.start_time
  `, [buildingId, startDate, endDate]);

  const events = bookings.rows.map(row => ({
    id: row.id,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    userId: row.user_id,
    userName: `${row.first_name} ${row.last_name}`,
    userEmail: row.email,
    spaceName: row.space_name,
    spaceId: row.space_id
  }));

  // Calculate summary statistics
  const uniqueUsers = [...new Set(events.map(e => e.userId))].length;
  const totalHours = events.reduce((total, event) => {
    return total + (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (60 * 60 * 1000);
  }, 0);

  return {
    building: {
      id: buildingId,
      name: building.rows[0].name,
      address: building.rows[0].address
    },
    calendar: {
      view: 'month',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      events
    },
    permissions: {
      canViewDetails: true,
      canCreateBookings: false
    },
    summary: {
      totalBookings: events.length,
      totalHours,
      uniqueUsers
    }
  };
}

/**
 *
 * @param buildingId
 */
async function getCommonSpacesForBuilding(buildingId: string): Promise<Array<{id: string, name: string}>> {
  const result = await runQuery(`
    SELECT id, name
    FROM common_spaces 
    WHERE building_id = $1 
      AND is_reservable = true
    ORDER BY name
  `, [buildingId]);
  
  return result.rows;
}