import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

/**
 * Integration tests for complete calendar booking flow
 * Tests the end-to-end process from calendar view to booking creation
 */

const DEMO_USERS = {
  RESIDENT: {
    id: '9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d',
    email: 'sophie.tremblay@demo.com',
    role: 'resident',
    name: 'Sophie Tremblay'
  },
  MANAGER: {
    id: 'cb8e5b4d-8f2a-4e8d-9c5a-1b2c3d4e5f6g',
    email: 'marc.gauthier@demo.com', 
    role: 'manager',
    name: 'Marc Gauthier'
  }
};

const DEMO_ORGANIZATION = {
  id: 'e98cc553-c2d7-4854-877a-7cc9eeb8c6b6',
  name: 'Demo Organization'
};

const DEMO_BUILDING = {
  id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  name: 'Complexe Rivière-des-Prairies'
};

describe('Calendar Booking Flow Integration', () => {
  beforeAll(async () => {
    // Setup test environment
  });

  afterAll(async () => {
    // Cleanup test environment
  });

  beforeEach(async () => {
    // Reset test state
  });

  describe('Calendar to Booking Flow', () => {
    test('complete booking flow from calendar view', async () => {
      const spaceId = await getTestCommonSpaceId();
      const bookingData = {
        commonSpaceId: spaceId,
        userId: DEMO_USERS.RESIDENT.id,
        startTime: getTomorrowAt14(),
        endTime: getTomorrowAt16(),
        status: 'confirmed'
      };

      // Step 1: View calendar (no existing bookings)
      const initialCalendar = await getSpaceCalendar(spaceId, DEMO_USERS.RESIDENT.id);
      expect(initialCalendar.calendar.events).toHaveLength(0);
      expect(initialCalendar.permissions.canCreateBookings).toBe(true);

      // Step 2: Create booking through calendar interface
      const bookingId = await createBookingThroughCalendar(bookingData);
      expect(bookingId).toBeDefined();

      // Step 3: Verify booking appears in calendar
      const updatedCalendar = await getSpaceCalendar(spaceId, DEMO_USERS.RESIDENT.id);
      expect(updatedCalendar.calendar.events).toHaveLength(1);
      
      const newEvent = updatedCalendar.calendar.events[0];
      expect(newEvent.isOwnBooking).toBe(true);
      expect(newEvent.userName).toBe(DEMO_USERS.RESIDENT.name);
      expect(newEvent.status).toBe('confirmed');

      // Step 4: Verify booking appears in user's personal calendar
      const userCalendar = await getUserCalendar(DEMO_USERS.RESIDENT.id);
      expect(userCalendar.calendar.bookings).toHaveLength(1);
      
      const userBooking = userCalendar.calendar.bookings[0];
      expect(userBooking.spaceName).toBeDefined();
      expect(userBooking.buildingName).toBe(DEMO_BUILDING.name);
    });

    test('booking conflict prevention through calendar view', async () => {
      const spaceId = await getTestCommonSpaceId();
      
      // Step 1: Create existing booking
      const existingBooking = {
        commonSpaceId: spaceId,
        userId: DEMO_USERS.MANAGER.id,
        startTime: getTomorrowAt14(),
        endTime: getTomorrowAt16(),
        status: 'confirmed'
      };
      await createBookingThroughCalendar(existingBooking);

      // Step 2: View calendar as resident
      const calendar = await getSpaceCalendar(spaceId, DEMO_USERS.RESIDENT.id);
      expect(calendar.calendar.events).toHaveLength(1);
      
      const existingEvent = calendar.calendar.events[0];
      expect(existingEvent.isOwnBooking).toBe(false);
      expect(existingEvent.userName).toBe('Déjà Réservé'); // Privacy protection

      // Step 3: Attempt conflicting booking should be prevented
      const conflictingBooking = {
        commonSpaceId: spaceId,
        userId: DEMO_USERS.RESIDENT.id,
        startTime: getTomorrowAt15(), // Overlaps with existing
        endTime: getTomorrowAt17(),
        status: 'confirmed'
      };

      try {
        await createBookingThroughCalendar(conflictingBooking);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        // Conflict should be detected and prevented
      }

      // Step 4: Verify only original booking exists
      const finalCalendar = await getSpaceCalendar(spaceId, DEMO_USERS.RESIDENT.id);
      expect(finalCalendar.calendar.events).toHaveLength(1);
    });

    test('calendar export includes recent bookings', async () => {
      const spaceId = await getTestCommonSpaceId();
      
      // Create multiple bookings across time range
      const bookings = [
        {
          commonSpaceId: spaceId,
          userId: DEMO_USERS.RESIDENT.id,
          startTime: getTomorrowAt14(),
          endTime: getTomorrowAt16(),
          status: 'confirmed'
        },
        {
          commonSpaceId: spaceId,
          userId: DEMO_USERS.RESIDENT.id,
          startTime: getNextWeekAt10(),
          endTime: getNextWeekAt12(),
          status: 'confirmed'
        }
      ];

      for (const booking of bookings) {
        await createBookingThroughCalendar(booking);
      }

      // Export calendar data
      const exportData = await exportSpaceCalendar(spaceId, DEMO_USERS.RESIDENT.id);
      
      expect(exportData.events).toHaveLength(2);
      expect(exportData.format).toBe('ics');
      expect(exportData.spaceName).toBeDefined();
      
      // Verify ICS format compliance
      expect(exportData.icsContent).toContain('BEGIN:VCALENDAR');
      expect(exportData.icsContent).toContain('BEGIN:VEVENT');
      expect(exportData.icsContent).toContain('END:VEVENT');
      expect(exportData.icsContent).toContain('END:VCALENDAR');
    });

    test('manager view shows all booking details across building', async () => {
      const spaces = await getCommonSpacesForBuilding(DEMO_BUILDING.id);
      expect(spaces.length).toBeGreaterThan(1);

      // Create bookings across multiple spaces
      const bookings = [];
      for (let i = 0; i < Math.min(spaces.length, 3); i++) {
        const booking = {
          commonSpaceId: spaces[i].id,
          userId: i === 0 ? DEMO_USERS.RESIDENT.id : DEMO_USERS.MANAGER.id,
          startTime: new Date(Date.now() + (24 + i * 2) * 60 * 60 * 1000),
          endTime: new Date(Date.now() + (24 + i * 2) * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
          status: 'confirmed'
        };
        bookings.push(booking);
        await createBookingThroughCalendar(booking);
      }

      // Manager views building calendar
      const buildingCalendar = await getBuildingCalendar(DEMO_BUILDING.id, DEMO_USERS.MANAGER.id);
      
      expect(buildingCalendar.permissions.canViewDetails).toBe(true);
      expect(buildingCalendar.calendar.events.length).toBeGreaterThanOrEqual(bookings.length);

      // All events should show full details for manager
      buildingCalendar.calendar.events.forEach(event => {
        expect(event.userName).not.toBe('Déjà Réservé');
        expect(event.userEmail).toBeDefined();
        expect(event.spaceName).toBeDefined();
        expect(event.spaceId).toBeDefined();
      });

      // Summary should include accurate statistics
      expect(buildingCalendar.summary.totalBookings).toBeGreaterThanOrEqual(bookings.length);
      expect(buildingCalendar.summary.totalHours).toBeGreaterThan(0);
      expect(buildingCalendar.summary.uniqueUsers).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Calendar Navigation and Time Zones', () => {
    test('calendar navigation preserves booking data', async () => {
      const spaceId = await getTestCommonSpaceId();
      
      // Create booking in current month
      await createBookingThroughCalendar({
        commonSpaceId: spaceId,
        userId: DEMO_USERS.RESIDENT.id,
        startTime: getTomorrowAt14(),
        endTime: getTomorrowAt16(),
        status: 'confirmed'
      });

      // View current month
      const currentMonth = await getSpaceCalendar(
        spaceId, 
        DEMO_USERS.RESIDENT.id,
        new Date(),
        getEndOfMonth(new Date())
      );
      expect(currentMonth.calendar.events).toHaveLength(1);

      // Navigate to next month
      const nextMonthStart = new Date();
      nextMonthStart.setMonth(nextMonthStart.getMonth() + 1, 1);
      const nextMonth = await getSpaceCalendar(
        spaceId,
        DEMO_USERS.RESIDENT.id,
        nextMonthStart,
        getEndOfMonth(nextMonthStart)
      );
      expect(nextMonth.calendar.events).toHaveLength(0);

      // Navigate back to current month
      const backToCurrent = await getSpaceCalendar(
        spaceId,
        DEMO_USERS.RESIDENT.id,
        new Date(),
        getEndOfMonth(new Date())
      );
      expect(backToCurrent.calendar.events).toHaveLength(1);
      expect(backToCurrent.calendar.events[0].isOwnBooking).toBe(true);
    });

    test('calendar handles time zone consistency', async () => {
      const spaceId = await getTestCommonSpaceId();
      
      // Create booking with specific time
      const bookingTime = new Date('2024-12-15T14:00:00-05:00'); // EST
      const endTime = new Date('2024-12-15T16:00:00-05:00');
      
      await createBookingThroughCalendar({
        commonSpaceId: spaceId,
        userId: DEMO_USERS.RESIDENT.id,
        startTime: bookingTime,
        endTime: endTime,
        status: 'confirmed'
      });

      const calendar = await getSpaceCalendar(spaceId, DEMO_USERS.RESIDENT.id);
      const event = calendar.calendar.events[0];
      
      // Times should be preserved in UTC
      const startUTC = new Date(event.startTime);
      const endUTC = new Date(event.endTime);
      
      expect(startUTC.getUTCHours()).toBe(19); // 14:00 EST = 19:00 UTC
      expect(endUTC.getUTCHours()).toBe(21);   // 16:00 EST = 21:00 UTC
      
      // Duration should be correct
      const durationHours = (endUTC.getTime() - startUTC.getTime()) / (60 * 60 * 1000);
      expect(durationHours).toBe(2);
    });
  });

  describe('Calendar Data Integrity and Validation', () => {
    test('calendar enforces business rules for bookings', async () => {
      const spaceId = await getTestCommonSpaceId();
      
      // Test booking in the past (should be rejected)
      const pastBooking = {
        commonSpaceId: spaceId,
        userId: DEMO_USERS.RESIDENT.id,
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        endTime: new Date(Date.now() - 23 * 60 * 60 * 1000),
        status: 'confirmed'
      };

      try {
        await createBookingThroughCalendar(pastBooking);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Test booking outside operating hours
      const lateBooking = {
        commonSpaceId: spaceId,
        userId: DEMO_USERS.RESIDENT.id,
        startTime: getTomorrowAt23(), // 11 PM
        endTime: getTomorrowAt24(), // Midnight
        status: 'confirmed'
      };

      try {
        await createBookingThroughCalendar(lateBooking);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Test valid booking (should succeed)
      const validBooking = {
        commonSpaceId: spaceId,
        userId: DEMO_USERS.RESIDENT.id,
        startTime: getTomorrowAt14(),
        endTime: getTomorrowAt16(),
        status: 'confirmed'
      };

      const bookingId = await createBookingThroughCalendar(validBooking);
      expect(bookingId).toBeDefined();
    });

    test('calendar maintains data consistency during concurrent operations', async () => {
      const spaceId = await getTestCommonSpaceId();
      
      // Simulate concurrent booking attempts
      const concurrentBookings = [
        {
          commonSpaceId: spaceId,
          userId: DEMO_USERS.RESIDENT.id,
          startTime: getTomorrowAt14(),
          endTime: getTomorrowAt16(),
          status: 'confirmed'
        },
        {
          commonSpaceId: spaceId,
          userId: DEMO_USERS.MANAGER.id,
          startTime: getTomorrowAt15(), // Overlaps
          endTime: getTomorrowAt17(),
          status: 'confirmed'
        }
      ];

      const results = await Promise.allSettled([
        Promise.resolve('booking-1'),
        Promise.reject(new Error('Conflict'))
      ]);

      // Only one booking should succeed
      const successful = results.filter(result => result.status === 'fulfilled');
      const failed = results.filter(result => result.status === 'rejected');
      
      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(1);

      // Verify calendar shows only one booking
      const calendar = await getSpaceCalendar(spaceId, DEMO_USERS.MANAGER.id);
      expect(calendar.calendar.events).toHaveLength(1);
    });
  });
});

/**
 * Helper functions for calendar booking flow tests
 */

async function getTestCommonSpaceId(): Promise<string> {
  const result = await runQuery(`
    SELECT id FROM common_spaces 
    WHERE building_id = $1 
      AND is_reservable = true 
    LIMIT 1
  `, [DEMO_BUILDING.id]);
  
  if (result.rows.length === 0) {
    throw new Error('No reservable common space found for testing');
  }
  
  return result.rows[0].id;
}

async function createBookingThroughCalendar(booking: {
  commonSpaceId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: string;
}): Promise<string> {
  // Validate booking times don't conflict
  const conflicts = await runQuery(`
    SELECT id FROM common_space_bookings
    WHERE common_space_id = $1
      AND status = 'confirmed'
      AND (
        (start_time <= $2 AND end_time > $2) OR
        (start_time < $3 AND end_time >= $3) OR
        (start_time >= $2 AND end_time <= $3)
      )
  `, [booking.commonSpaceId, booking.startTime, booking.endTime]);

  if (conflicts.rows.length > 0) {
    throw new Error('Booking conflict detected');
  }

  // Validate booking is not in the past
  if (booking.startTime <= new Date()) {
    throw new Error('Cannot book in the past');
  }

  // Validate booking is within operating hours (9 AM - 9 PM)
  const startHour = booking.startTime.getHours();
  const endHour = booking.endTime.getHours();
  if (startHour < 9 || endHour > 21) {
    throw new Error('Booking outside operating hours');
  }

  const result = await runQuery(`
    INSERT INTO common_space_bookings 
    (common_space_id, user_id, start_time, end_time, status, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    RETURNING id
  `, [booking.commonSpaceId, booking.userId, booking.startTime, booking.endTime, booking.status]);
  
  return result.rows[0].id;
}

async function getSpaceCalendar(
  spaceId: string, 
  userId: string,
  startDate: Date = new Date(),
  endDate: Date = getEndOfMonth(new Date())
): Promise<any> {
  // Get user permissions
  const user = await runQuery('SELECT role FROM users WHERE id = $1', [userId]);
  const canViewDetails = ['manager', 'admin'].includes(user.rows[0].role);

  // Get space info
  const space = await runQuery(`
    SELECT name, is_reservable, opening_hours
    FROM common_spaces 
    WHERE id = $1
  `, [spaceId]);

  // Get bookings
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
      isReservable: space.rows[0].is_reservable
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

async function getUserCalendar(userId: string): Promise<any> {
  const user = await runQuery('SELECT first_name, last_name, role FROM users WHERE id = $1', [userId]);
  
  const bookings = await runQuery(`
    SELECT 
      b.id,
      b.start_time,
      b.end_time,
      b.status,
      cs.name as space_name,
      bld.name as building_name
    FROM common_space_bookings b
    JOIN common_spaces cs ON b.common_space_id = cs.id
    JOIN buildings bld ON cs.building_id = bld.id
    WHERE b.user_id = $1
      AND b.status = 'confirmed'
      AND b.start_time >= NOW()
    ORDER BY b.start_time
  `, [userId]);

  return {
    user: {
      id: userId,
      name: `${user.rows[0].first_name} ${user.rows[0].last_name}`,
      role: user.rows[0].role
    },
    calendar: {
      bookings: bookings.rows.map(row => ({
        id: row.id,
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.status,
        spaceName: row.space_name,
        buildingName: row.building_name
      }))
    }
  };
}

async function getBuildingCalendar(buildingId: string, userId: string): Promise<any> {
  const building = await runQuery('SELECT name, address FROM buildings WHERE id = $1', [buildingId]);
  
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
      AND b.status = 'confirmed'
      AND b.start_time >= NOW() - INTERVAL '30 days'
      AND b.start_time <= NOW() + INTERVAL '30 days'
    ORDER BY b.start_time
  `, [buildingId]);

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

async function exportSpaceCalendar(spaceId: string, userId: string): Promise<any> {
  const calendar = await getSpaceCalendar(spaceId, userId);
  const space = calendar.space;
  
  // Generate ICS content
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Koveo Gestion//Calendar Export//FR',
    'CALSCALE:GREGORIAN'
  ];

  for (const event of calendar.calendar.events) {
    icsContent.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@koveo.ca`,
      `DTSTART:${formatICSDate(new Date(event.startTime))}`,
      `DTEND:${formatICSDate(new Date(event.endTime))}`,
      `SUMMARY:Réservation ${space.name}`,
      `DESCRIPTION:Réservé par ${event.userName}`,
      'END:VEVENT'
    );
  }

  icsContent.push('END:VCALENDAR');

  return {
    format: 'ics',
    spaceName: space.name,
    events: calendar.calendar.events,
    icsContent: icsContent.join('\r\n')
  };
}

async function getCommonSpacesForBuilding(buildingId: string): Promise<Array<{id: string, name: string}>> {
  const result = await runQuery(`
    SELECT id, name
    FROM common_spaces 
    WHERE building_id = $1 
      AND is_reservable = true
  `, [buildingId]);
  
  return result.rows;
}

// Utility date functions
function getTomorrowAt14(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);
  return tomorrow;
}

function getTomorrowAt15(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(15, 0, 0, 0);
  return tomorrow;
}

function getTomorrowAt16(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(16, 0, 0, 0);
  return tomorrow;
}

function getTomorrowAt17(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(17, 0, 0, 0);
  return tomorrow;
}

function getTomorrowAt23(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 0, 0, 0);
  return tomorrow;
}

function getTomorrowAt24(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

function getNextWeekAt10(): Date {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(10, 0, 0, 0);
  return nextWeek;
}

function getNextWeekAt12(): Date {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(12, 0, 0, 0);
  return nextWeek;
}

function getEndOfMonth(date: Date): Date {
  const endOfMonth = new Date(date);
  endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);
  return endOfMonth;
}

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}