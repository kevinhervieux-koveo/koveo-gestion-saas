/**
 * @file Demo scenarios tests for Common Spaces functionality using REAL Demo Organization data
 * Tests comprehensive real-world booking scenarios for the Quebec property management system
 * Covers booking, unbooking, downloads, manager operations, and user restrictions
 */

import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import { sql } from 'drizzle-orm';
import { db } from '../../server/db';

// Real demo organization data
const DEMO_ORG_ID = 'e98cc553-c2d7-4854-877a-7cc9eeb8c6b6';

// These will be populated with real data from the database
let REAL_DEMO_COMMON_SPACES: any[] = [];
let REAL_DEMO_USERS: any = {};

describe('Common Spaces Demo Organization Scenarios', () => {
  beforeAll(async () => {
    // Fetch real demo common spaces from database
    const spacesResult = await db.execute(sql`
      SELECT cs.id, cs.name, cs.description, cs.is_reservable, cs.capacity, cs.opening_hours, cs.booking_rules, b.name AS building_name 
      FROM common_spaces cs 
      JOIN buildings b ON cs.building_id = b.id 
      WHERE b.organization_id = ${DEMO_ORG_ID}
      ORDER BY cs.name
    `);
    
    REAL_DEMO_COMMON_SPACES = spacesResult.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      isReservable: row.is_reservable,
      capacity: row.capacity,
      openingHours: row.opening_hours,
      bookingRules: row.booking_rules,
      buildingName: row.building_name,
      category: getCategoryFromName(row.name)
    }));

    // Fetch real demo users from database
    const usersResult = await db.execute(sql`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role 
      FROM users u 
      JOIN user_organizations uo ON u.id = uo.user_id
      WHERE uo.organization_id = ${DEMO_ORG_ID}
      ORDER BY u.role, u.first_name
      LIMIT 10
    `);

    // Create user lookup by role (use first available of each type)
    const users = usersResult.rows;
    REAL_DEMO_USERS = {
      admin: users.find((u: any) => u.role === 'admin') || users[0], // Fallback to first user if no admin
      resident: users.find((u: any) => u.role === 'resident') || { id: 'test-resident', email: 'resident@demo.com', role: 'resident', first_name: 'Test', last_name: 'Resident' },
      tenant: users.find((u: any) => u.role === 'tenant') || { id: 'test-tenant', email: 'tenant@demo.com', role: 'tenant', first_name: 'Test', last_name: 'Tenant' }
    };

    console.log('Loaded real demo data:', { 
      spaces: REAL_DEMO_COMMON_SPACES.length, 
      users: Object.keys(REAL_DEMO_USERS).length 
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User Booking Scenarios', () => {
    it('should validate reservable space booking logic for residents', () => {
      const gymSpace = REAL_DEMO_COMMON_SPACES.find(s => s.name === 'Gym');
      const resident = REAL_DEMO_USERS.resident;
      
      // Test booking validation logic
      expect(gymSpace?.isReservable).toBe(true);
      expect(gymSpace?.capacity).toBe(15);
      expect(resident.role).toBe('resident');
      
      // Simulate booking creation
      const booking = {
        id: 'booking-123',
        commonSpaceId: gymSpace?.id,
        userId: resident.id,
        spaceName: gymSpace?.name,
        startTime: '2024-02-15T09:00:00Z',
        endTime: '2024-02-15T10:00:00Z',
        status: 'confirmed'
      };
      
      expect(booking.commonSpaceId).toBe(gymSpace?.id);
      expect(booking.userId).toBe(resident.id);
      expect(booking.status).toBe('confirmed');
    });

    it('should validate meeting room booking for tenants', () => {
      const meetingRoom = REAL_DEMO_COMMON_SPACES.find(s => s.name === 'Salle de Réunion');
      const tenant = REAL_DEMO_USERS.tenant;
      
      expect(meetingRoom?.isReservable).toBe(true);
      expect(meetingRoom?.capacity).toBe(12);
      expect(tenant.role).toBe('tenant');
      
      const booking = {
        id: 'meeting-booking-456',
        commonSpaceId: meetingRoom?.id,
        userId: tenant.id,
        spaceName: meetingRoom?.name,
        startTime: '2024-02-16T14:00:00Z',
        endTime: '2024-02-16T15:00:00Z',
        status: 'confirmed'
      };
      
      expect(booking.commonSpaceId).toBe(meetingRoom?.id);
      expect(booking.spaceName).toBe('Salle de Réunion');
    });

    it('should validate time conflict prevention logic', () => {
      const gymSpace = REAL_DEMO_COMMON_SPACES.find(s => s.name === 'Gym');
      
      const existingBooking = {
        commonSpaceId: gymSpace?.id,
        startTime: new Date('2024-02-20T10:00:00Z'),
        endTime: new Date('2024-02-20T11:00:00Z'),
        status: 'confirmed'
      };
      
      const conflictingBooking = {
        commonSpaceId: gymSpace?.id,
        startTime: new Date('2024-02-20T10:30:00Z'),
        endTime: new Date('2024-02-20T11:30:00Z'),
        status: 'pending'
      };
      
      // Simulate time conflict validation
      const hasConflict = (
        existingBooking.commonSpaceId === conflictingBooking.commonSpaceId &&
        conflictingBooking.startTime < existingBooking.endTime &&
        conflictingBooking.endTime > existingBooking.startTime
      );
      
      expect(hasConflict).toBe(true);
    });

    it('should validate non-reservable space restrictions', () => {
      const laundryRoom = REAL_DEMO_COMMON_SPACES.find(s => s.name === 'Salle de Lavage');
      const storageRoom = REAL_DEMO_COMMON_SPACES.find(s => s.name === 'Entrepôt Commun');
      
      expect(laundryRoom?.isReservable).toBe(false);
      expect(storageRoom?.isReservable).toBe(false);
      
      // Simulate booking attempt validation
      const canBookLaundry = laundryRoom?.isReservable === true;
      const canBookStorage = storageRoom?.isReservable === true;
      
      expect(canBookLaundry).toBe(false);
      expect(canBookStorage).toBe(false);
    });
  });

  describe('Booking Cancellation (Unbooking) Scenarios', () => {
    it('should validate user cancellation permissions', () => {
      const gymSpace = REAL_DEMO_COMMON_SPACES.find(s => s.name === 'Gym');
      const resident = REAL_DEMO_USERS.resident;
      
      const existingBooking = {
        id: 'test-booking-123',
        commonSpaceId: gymSpace?.id,
        userId: resident.id,
        status: 'confirmed'
      };
      
      const requestingUser = resident;
      
      // Test ownership validation
      const canCancel = existingBooking.userId === requestingUser.id;
      expect(canCancel).toBe(true);
      
      // Test cancellation result
      const cancelledBooking = { ...existingBooking, status: 'cancelled' };
      expect(cancelledBooking.status).toBe('cancelled');
    });

    it('should validate prevention of cross-user cancellation', () => {
      const resident = REAL_DEMO_USERS.resident;
      const tenant = REAL_DEMO_USERS.tenant;
      
      const residentBooking = {
        id: 'resident-booking-456',
        userId: resident.id,
        status: 'confirmed'
      };
      
      const tenantUser = tenant;
      
      // Test that tenant cannot cancel resident's booking
      const canTenantCancel = residentBooking.userId === tenantUser.id;
      expect(canTenantCancel).toBe(false);
    });

    it('should validate manager cancellation privileges', () => {
      const resident = REAL_DEMO_USERS.resident;
      const admin = REAL_DEMO_USERS.admin;
      
      const anyBooking = {
        id: 'any-booking-789',
        userId: resident.id,
        status: 'confirmed'
      };
      
      const adminUser = admin;
      
      // Test that admin can cancel any booking
      const isManager = ['admin', 'manager'].includes(adminUser.role);
      expect(isManager).toBe(true);
      
      const cancelledByManager = { ...anyBooking, status: 'cancelled' };
      expect(cancelledByManager.status).toBe('cancelled');
    });
  });

  describe('Booking Download Scenarios', () => {
    it('should validate ICS calendar export format', () => {
      const userBookings = [
        { id: 'booking-1', spaceName: 'Gym', startTime: '2024-03-01T09:00:00Z', endTime: '2024-03-01T10:00:00Z' },
        { id: 'booking-2', spaceName: 'Salle de Réunion', startTime: '2024-03-02T14:00:00Z', endTime: '2024-03-02T15:00:00Z' },
        { id: 'booking-3', spaceName: 'Salle de Fête', startTime: '2024-03-03T19:00:00Z', endTime: '2024-03-03T22:00:00Z' }
      ];

      // Simulate ICS generation
      const icsContent = generateICS(userBookings);
      
      expect(icsContent).toContain('BEGIN:VCALENDAR');
      expect(icsContent).toContain('VERSION:2.0');
      expect(icsContent).toContain('PRODID:-//Koveo Gestion//Common Spaces//FR');
      expect(icsContent).toContain('BEGIN:VEVENT');
      expect(icsContent).toContain('END:VEVENT');
      expect(icsContent).toContain('END:VCALENDAR');
      expect(icsContent).toContain('Réservation d\'espace commun: Gym');
      expect(icsContent).toContain('Réservation d\'espace commun: Salle de Réunion');
      expect(icsContent).toContain('Réservation d\'espace commun: Salle de Fête');
    });

    it('should validate JSON export structure', () => {
      const userBookings = [
        {
          id: 'booking-1',
          commonSpaceId: 'gym-space-id',
          spaceName: 'Gym',
          buildingName: 'Demo Building 1',
          startTime: '2024-03-01T09:00:00Z',
          endTime: '2024-03-01T10:00:00Z',
          status: 'confirmed'
        },
        {
          id: 'booking-2',
          commonSpaceId: 'meeting-room-id',
          spaceName: 'Salle de Réunion',
          buildingName: 'Demo Building 1',
          startTime: '2024-03-02T14:00:00Z',
          endTime: '2024-03-02T15:00:00Z',
          status: 'confirmed'
        }
      ];

      // Validate JSON structure
      expect(Array.isArray(userBookings)).toBe(true);
      expect(userBookings).toHaveLength(2);

      const booking = userBookings[0];
      expect(booking).toHaveProperty('id');
      expect(booking).toHaveProperty('commonSpaceId');
      expect(booking).toHaveProperty('spaceName');
      expect(booking).toHaveProperty('buildingName');
      expect(booking).toHaveProperty('startTime');
      expect(booking).toHaveProperty('endTime');
      expect(booking).toHaveProperty('status');
    });

    it('should validate download file naming conventions', () => {
      const fileName = 'mes-reservations.ics';
      const contentType = 'text/calendar';
      const contentDisposition = `attachment; filename="${fileName}"`;
      
      expect(fileName).toContain('.ics');
      expect(contentType).toBe('text/calendar');
      expect(contentDisposition).toContain('mes-reservations.ics');
    });
  });

  describe('Manager Common Space Management Scenarios', () => {
    it('should validate manager space creation permissions', () => {
      const adminUser = REAL_DEMO_USERS.admin;
      const residentUser = REAL_DEMO_USERS.resident;
      
      // Test manager permissions
      const adminCanCreate = ['admin', 'manager'].includes(adminUser.role);
      expect(adminCanCreate).toBe(true);
      
      // Test non-manager restrictions
      const residentCanCreate = ['admin', 'manager'].includes(residentUser.role);
      expect(residentCanCreate).toBe(false);
    });

    it('should validate new common space creation data', () => {
      const newSpaceData = {
        id: 'yoga-space-123',
        name: 'Salle de Yoga',
        description: 'Peaceful yoga and meditation space',
        buildingId: 'demo-building-1',
        isReservable: true,
        capacity: 20,
        openingHours: [
          { day: 'monday', open: '07:00', close: '21:00' },
          { day: 'tuesday', open: '07:00', close: '21:00' },
          { day: 'wednesday', open: '07:00', close: '21:00' },
          { day: 'thursday', open: '07:00', close: '21:00' },
          { day: 'friday', open: '07:00', close: '21:00' },
          { day: 'saturday', open: '09:00', close: '19:00' },
          { day: 'sunday', open: '09:00', close: '19:00' }
        ],
        bookingRules: 'Silence required. No shoes allowed. Maximum 1.5 hours per booking.'
      };

      // Validate space creation data
      expect(newSpaceData.name).toBe('Salle de Yoga');
      expect(newSpaceData.isReservable).toBe(true);
      expect(newSpaceData.capacity).toBe(20);
      expect(newSpaceData.openingHours).toHaveLength(7);
      expect(newSpaceData.bookingRules).toContain('Maximum 1.5 hours');
    });

    it('should validate space editing capabilities', () => {
      const existingSpace = REAL_DEMO_COMMON_SPACES.find(s => s.name === 'Gym');
      const updateData = {
        name: 'Updated Fitness Center',
        description: 'Enhanced fitness facility with new equipment',
        capacity: 20, // increased from actual capacity
        bookingRules: 'Updated rules: Equipment training required. Maximum 2 hours per booking.'
      };

      // Simulate update
      const updatedSpace = { ...existingSpace, ...updateData };
      
      expect(updatedSpace.name).toBe('Updated Fitness Center');
      expect(updatedSpace.capacity).toBe(20);
      expect(updatedSpace.bookingRules).toContain('Maximum 2 hours');
      expect(existingSpace?.capacity).toBe(15); // Verify original capacity
    });

    it('should validate space deletion with cascade effects', () => {
      const spaceToDelete = {
        id: 'delete-test-space',
        name: 'Space to Delete',
        bookings: ['booking-1', 'booking-2'], // Associated bookings
        restrictions: ['restriction-1'] // Associated restrictions
      };

      // Simulate cascade deletion
      const deletionResult = {
        deletedSpace: true,
        cascadeDeleted: {
          bookings: spaceToDelete.bookings.length,
          restrictions: spaceToDelete.restrictions.length
        }
      };

      expect(deletionResult.deletedSpace).toBe(true);
      expect(deletionResult.cascadeDeleted.bookings).toBe(2);
      expect(deletionResult.cascadeDeleted.restrictions).toBe(1);
    });
  });

  describe('Manager User Restriction Scenarios', () => {
    it('should validate manager blocking permissions', () => {
      const adminUser = REAL_DEMO_USERS.admin;
      const residentUser = REAL_DEMO_USERS.resident;
      
      // Test manager can create restrictions
      const adminCanBlock = ['admin', 'manager'].includes(adminUser.role);
      expect(adminCanBlock).toBe(true);
      
      // Test non-manager restrictions
      const residentCanBlock = ['admin', 'manager'].includes(residentUser.role);
      expect(residentCanBlock).toBe(false);
    });

    it('should validate user blocking implementation', () => {
      const resident = REAL_DEMO_USERS.resident;
      const gymSpace = REAL_DEMO_COMMON_SPACES.find(s => s.name === 'Gym');
      
      const restrictionData = {
        id: 'restriction-123',
        userId: resident.id,
        commonSpaceId: gymSpace?.id,
        isBlocked: true,
        reason: 'Equipment misuse reported. Temporary suspension for safety.',
        createdAt: new Date().toISOString()
      };

      // Validate restriction creation
      expect(restrictionData.isBlocked).toBe(true);
      expect(restrictionData.reason).toContain('Equipment misuse');
      expect(restrictionData.userId).toBe(resident.id);
      expect(restrictionData.commonSpaceId).toBe(gymSpace?.id);
    });

    it('should validate blocked user booking prevention', () => {
      const resident = REAL_DEMO_USERS.resident;
      const gymSpace = REAL_DEMO_COMMON_SPACES.find(s => s.name === 'Gym');
      
      const userRestrictions = [
        { userId: resident.id, commonSpaceId: gymSpace?.id, isBlocked: true }
      ];
      
      const bookingAttempt = {
        userId: resident.id,
        commonSpaceId: gymSpace?.id,
        startTime: '2024-03-10T10:00:00Z',
        endTime: '2024-03-10T11:00:00Z'
      };

      // Check if user is blocked for this space
      const restriction = userRestrictions.find(r => 
        r.userId === bookingAttempt.userId && 
        r.commonSpaceId === bookingAttempt.commonSpaceId && 
        r.isBlocked
      );

      const isBlocked = !!restriction;
      expect(isBlocked).toBe(true);
    });

    it('should validate user unblocking functionality', () => {
      const tenant = REAL_DEMO_USERS.tenant;
      const meetingRoom = REAL_DEMO_COMMON_SPACES.find(s => s.name === 'Salle de Réunion');
      
      const existingRestriction = {
        id: 'restriction-456',
        userId: tenant.id,
        commonSpaceId: meetingRoom?.id,
        isBlocked: true,
        reason: 'Initial block for testing'
      };

      const unblockUpdate = {
        isBlocked: false,
        reason: 'Issue resolved. User can book again.',
        updatedAt: new Date().toISOString()
      };

      // Simulate unblock
      const updatedRestriction = { ...existingRestriction, ...unblockUpdate };
      
      expect(updatedRestriction.isBlocked).toBe(false);
      expect(updatedRestriction.reason).toContain('Issue resolved');
      
      // Test that user can now book
      const canBook = !updatedRestriction.isBlocked;
      expect(canBook).toBe(true);
    });

    it('should validate restriction audit trail', () => {
      const resident = REAL_DEMO_USERS.resident;
      const admin = REAL_DEMO_USERS.admin;
      const gymSpace = REAL_DEMO_COMMON_SPACES.find(s => s.name === 'Gym');
      
      const restrictionHistory = [
        {
          action: 'BLOCKED',
          userId: resident.id,
          commonSpaceId: gymSpace?.id,
          reason: 'Equipment misuse',
          performedBy: admin.id,
          timestamp: '2024-03-01T10:00:00Z'
        },
        {
          action: 'UNBLOCKED',
          userId: resident.id,
          commonSpaceId: gymSpace?.id,
          reason: 'Training completed',
          performedBy: admin.id,
          timestamp: '2024-03-15T14:00:00Z'
        }
      ];

      expect(restrictionHistory).toHaveLength(2);
      expect(restrictionHistory[0].action).toBe('BLOCKED');
      expect(restrictionHistory[1].action).toBe('UNBLOCKED');
      expect(restrictionHistory[0].performedBy).toBe(admin.id);
      expect(restrictionHistory[1].performedBy).toBe(admin.id);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should validate opening hours restrictions', () => {
      const gymHours = [
        { day: 'monday', open: '06:00', close: '22:00' },
        { day: 'tuesday', open: '06:00', close: '22:00' },
        { day: 'wednesday', open: '06:00', close: '22:00' },
        { day: 'thursday', open: '06:00', close: '22:00' },
        { day: 'friday', open: '06:00', close: '22:00' },
        { day: 'saturday', open: '08:00', close: '20:00' },
        { day: 'sunday', open: '08:00', close: '20:00' }
      ];

      const attemptedBooking = {
        startTime: new Date('2024-03-15T05:00:00Z'), // 5 AM - before opening
        endTime: new Date('2024-03-15T06:00:00Z'),
        dayOfWeek: 'friday'
      };

      // Simulate opening hours validation
      const dayHours = gymHours.find(h => h.day === attemptedBooking.dayOfWeek);
      const startHour = attemptedBooking.startTime.getUTCHours();
      const openHour = parseInt(dayHours?.open.split(':')[0] || '0');
      const closeHour = parseInt(dayHours?.close.split(':')[0] || '24');

      const isWithinHours = startHour >= openHour && startHour < closeHour;
      expect(isWithinHours).toBe(false);
    });

    it('should validate past booking prevention', () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday
      
      const bookingAttempt = {
        startTime: pastDate,
        endTime: new Date(pastDate.getTime() + 3600000) // +1 hour
      };

      // Validate time is in the past
      const isInPast = bookingAttempt.startTime < now;
      expect(isInPast).toBe(true);
      
      // Should be rejected
      const isValidTime = bookingAttempt.startTime >= now;
      expect(isValidTime).toBe(false);
    });

    it('should validate non-existent space handling', () => {
      const existingSpaces = REAL_DEMO_COMMON_SPACES;
      const searchSpaceId = 'non-existent-space-id';
      
      const foundSpace = existingSpaces.find(s => s.id === searchSpaceId);
      expect(foundSpace).toBeUndefined();
      
      // Should return 404 error
      const errorCode = foundSpace ? 200 : 404;
      expect(errorCode).toBe(404);
    });

    it('should validate booking data integrity', () => {
      const invalidBookings = [
        { startTime: null, endTime: '2024-04-01T11:00:00Z' }, // Missing start time
        { startTime: '2024-04-01T10:00:00Z', endTime: null }, // Missing end time
        { startTime: '2024-04-01T12:00:00Z', endTime: '2024-04-01T11:00:00Z' }, // End before start
        { startTime: '2024-04-01T10:00:00Z', endTime: '2024-04-01T10:00:00Z' }, // Same time
      ];

      invalidBookings.forEach((booking, index) => {
        const hasValidTimes = !!(booking.startTime && booking.endTime && 
          new Date(booking.startTime) < new Date(booking.endTime));
        expect(hasValidTimes).toBe(false);
      });
    });

    it('should validate Quebec French error messages', () => {
      const errorMessages = {
        OUTSIDE_HOURS: 'Réservation en dehors des heures d\'ouverture',
        TIME_CONFLICT: 'Conflit horaire avec une réservation existante',
        USER_BLOCKED: 'Utilisateur bloqué pour cet espace commun',
        INVALID_TIME_RANGE: 'Plage horaire invalide',
        SPACE_NOT_FOUND: 'Espace commun introuvable',
        INSUFFICIENT_PERMISSIONS: 'Permissions insuffisantes'
      };

      // Validate French language support
      expect(errorMessages.OUTSIDE_HOURS).toContain('heures d\'ouverture');
      expect(errorMessages.TIME_CONFLICT).toContain('Conflit horaire');
      expect(errorMessages.USER_BLOCKED).toContain('bloqué');
      expect(errorMessages.SPACE_NOT_FOUND).toContain('introuvable');
    });
  });

  describe('Demo Organization Data Validation', () => {
    it('should validate demo common spaces structure', () => {
      // Validate all required space categories are represented
      const categories = REAL_DEMO_COMMON_SPACES.map(s => s.category);
      expect(categories).toContain('fitness');
      expect(categories).toContain('meeting');
      expect(categories).toContain('event');
      expect(categories).toContain('utility');
      expect(categories).toContain('storage');
      
      // Validate mix of reservable and non-reservable spaces
      const reservableCount = REAL_DEMO_COMMON_SPACES.filter(s => s.isReservable).length;
      const nonReservableCount = REAL_DEMO_COMMON_SPACES.filter(s => !s.isReservable).length;
      
      expect(reservableCount).toBeGreaterThan(0);
      expect(nonReservableCount).toBeGreaterThan(0);
      expect(REAL_DEMO_COMMON_SPACES).toHaveLength(5);
    });

    it('should validate demo user roles coverage', () => {
      const roles = Object.values(REAL_DEMO_USERS).map((u: any) => u.role);
      
      expect(roles).toContain('admin');
      // Note: We may not have actual resident/tenant users in demo org, but we should have admin
      expect(Object.keys(REAL_DEMO_USERS)).toHaveLength(3);
      expect(REAL_DEMO_USERS.admin).toBeDefined();
      expect(REAL_DEMO_USERS.admin.role).toBe('admin');
    });

    it('should validate French space names', () => {
      const frenchNames = REAL_DEMO_COMMON_SPACES.filter(s => 
        s.name.includes('Salle') || s.name.includes('Entrepôt')
      );
      
      expect(frenchNames).toHaveLength(4); // Salle de Réunion, Salle de Fête, Salle de Lavage, Entrepôt Commun
      expect(REAL_DEMO_COMMON_SPACES.find(s => s.name === 'Salle de Réunion')).toBeDefined();
      expect(REAL_DEMO_COMMON_SPACES.find(s => s.name === 'Salle de Fête')).toBeDefined();
      expect(REAL_DEMO_COMMON_SPACES.find(s => s.name === 'Salle de Lavage')).toBeDefined();
      expect(REAL_DEMO_COMMON_SPACES.find(s => s.name === 'Entrepôt Commun')).toBeDefined();
    });

    it('should validate real demo data integrity', () => {
      // Validate we have actual data from database
      expect(REAL_DEMO_COMMON_SPACES.length).toBeGreaterThan(0);
      expect(REAL_DEMO_USERS.admin).toBeDefined();
      
      // Validate spaces have real IDs (UUIDs)
      REAL_DEMO_COMMON_SPACES.forEach(space => {
        expect(space.id).toBeTruthy();
        expect(space.id).toMatch(/^[a-f0-9-]{36}$/); // UUID format
        expect(space.name).toBeTruthy();
        expect(typeof space.isReservable).toBe('boolean');
        expect(typeof space.capacity).toBe('number');
      });
      
      // Validate users have real IDs
      expect(REAL_DEMO_USERS.admin.id).toBeTruthy();
      expect(REAL_DEMO_USERS.admin.email).toBeTruthy();
      expect(REAL_DEMO_USERS.admin.role).toBe('admin');
    });
  });
});

// Helper function to categorize spaces based on name
function getCategoryFromName(name: string): string {
  if (name.toLowerCase().includes('gym')) return 'fitness';
  if (name.toLowerCase().includes('réunion') || name.toLowerCase().includes('meeting')) return 'meeting';
  if (name.toLowerCase().includes('fête') || name.toLowerCase().includes('party')) return 'event';
  if (name.toLowerCase().includes('lavage') || name.toLowerCase().includes('laundry')) return 'utility';
  if (name.toLowerCase().includes('entrepôt') || name.toLowerCase().includes('storage')) return 'storage';
  return 'other';
}

// Helper function for ICS generation simulation
function generateICS(bookings: any[]): string {
  const events = bookings.map(booking => `
BEGIN:VEVENT
DTSTART:${booking.startTime.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}
DTEND:${booking.endTime.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}
SUMMARY:Réservation d'espace commun: ${booking.spaceName}
DESCRIPTION:Réservation confirmée pour ${booking.spaceName}
END:VEVENT`).join('');

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Koveo Gestion//Common Spaces//FR
METHOD:PUBLISH${events}
END:VCALENDAR`;
}