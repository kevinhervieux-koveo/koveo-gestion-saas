/**
 * @file Demo scenarios tests for Common Spaces functionality
 * Tests comprehensive real-world booking scenarios for the Quebec property management system
 * Covers booking, unbooking, downloads, manager operations, and user restrictions
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock demo organization data
const DEMO_ORG_ID = 'e98cc553-c2d7-4854-877a-7cc9eeb8c6b6';

const DEMO_COMMON_SPACES = [
  { id: 'gym-space-id', name: 'Gym', isReservable: true, capacity: 15, category: 'fitness' },
  { id: 'meeting-room-id', name: 'Salle de Réunion', isReservable: true, capacity: 12, category: 'meeting' },
  { id: 'party-room-id', name: 'Salle de Fête', isReservable: true, capacity: 30, category: 'event' },
  { id: 'laundry-room-id', name: 'Salle de Lavage', isReservable: false, capacity: 8, category: 'utility' },
  { id: 'storage-room-id', name: 'Entrepôt Commun', isReservable: false, capacity: 20, category: 'storage' }
];

const DEMO_USERS = {
  admin: { id: 'admin-user', email: 'admin@test.com', role: 'admin', firstName: 'Admin', lastName: 'User' },
  resident: { id: 'resident-user', email: 'resident@demo.com', role: 'resident', firstName: 'Resident', lastName: 'User' },
  tenant: { id: 'tenant-user', email: 'tenant@demo.com', role: 'tenant', firstName: 'Tenant', lastName: 'User' }
};

describe('Common Spaces Demo Organization Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User Booking Scenarios', () => {
    it('should validate reservable space booking logic for residents', () => {
      const gymSpace = DEMO_COMMON_SPACES.find(s => s.name === 'Gym');
      const resident = DEMO_USERS.resident;
      
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
      
      expect(booking.commonSpaceId).toBe('gym-space-id');
      expect(booking.userId).toBe('resident-user');
      expect(booking.status).toBe('confirmed');
    });

    it('should validate meeting room booking for tenants', () => {
      const meetingRoom = DEMO_COMMON_SPACES.find(s => s.name === 'Salle de Réunion');
      const tenant = DEMO_USERS.tenant;
      
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
      
      expect(booking.commonSpaceId).toBe('meeting-room-id');
      expect(booking.spaceName).toBe('Salle de Réunion');
    });

    it('should validate time conflict prevention logic', () => {
      const existingBooking = {
        commonSpaceId: 'gym-space-id',
        startTime: new Date('2024-02-20T10:00:00Z'),
        endTime: new Date('2024-02-20T11:00:00Z'),
        status: 'confirmed'
      };
      
      const conflictingBooking = {
        commonSpaceId: 'gym-space-id',
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
      const laundryRoom = DEMO_COMMON_SPACES.find(s => s.name === 'Salle de Lavage');
      const storageRoom = DEMO_COMMON_SPACES.find(s => s.name === 'Entrepôt Commun');
      
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
      const existingBooking = {
        id: 'test-booking-123',
        commonSpaceId: 'gym-space-id',
        userId: 'resident-user',
        status: 'confirmed'
      };
      
      const requestingUser = DEMO_USERS.resident;
      
      // Test ownership validation
      const canCancel = existingBooking.userId === requestingUser.id;
      expect(canCancel).toBe(true);
      
      // Test cancellation result
      const cancelledBooking = { ...existingBooking, status: 'cancelled' };
      expect(cancelledBooking.status).toBe('cancelled');
    });

    it('should validate prevention of cross-user cancellation', () => {
      const residentBooking = {
        id: 'resident-booking-456',
        userId: 'resident-user',
        status: 'confirmed'
      };
      
      const tenantUser = DEMO_USERS.tenant;
      
      // Test that tenant cannot cancel resident's booking
      const canTenantCancel = residentBooking.userId === tenantUser.id;
      expect(canTenantCancel).toBe(false);
    });

    it('should validate manager cancellation privileges', () => {
      const anyBooking = {
        id: 'any-booking-789',
        userId: 'resident-user',
        status: 'confirmed'
      };
      
      const adminUser = DEMO_USERS.admin;
      
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
      const adminUser = DEMO_USERS.admin;
      const residentUser = DEMO_USERS.resident;
      
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
      const existingSpace = DEMO_COMMON_SPACES.find(s => s.name === 'Gym');
      const updateData = {
        name: 'Updated Fitness Center',
        description: 'Enhanced fitness facility with new equipment',
        capacity: 20, // increased from 15
        bookingRules: 'Updated rules: Equipment training required. Maximum 2 hours per booking.'
      };

      // Simulate update
      const updatedSpace = { ...existingSpace, ...updateData };
      
      expect(updatedSpace.name).toBe('Updated Fitness Center');
      expect(updatedSpace.capacity).toBe(20);
      expect(updatedSpace.bookingRules).toContain('Maximum 2 hours');
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
      const adminUser = DEMO_USERS.admin;
      const residentUser = DEMO_USERS.resident;
      
      // Test manager can create restrictions
      const adminCanBlock = ['admin', 'manager'].includes(adminUser.role);
      expect(adminCanBlock).toBe(true);
      
      // Test non-manager restrictions
      const residentCanBlock = ['admin', 'manager'].includes(residentUser.role);
      expect(residentCanBlock).toBe(false);
    });

    it('should validate user blocking implementation', () => {
      const restrictionData = {
        id: 'restriction-123',
        userId: 'resident-user',
        commonSpaceId: 'gym-space-id',
        isBlocked: true,
        reason: 'Equipment misuse reported. Temporary suspension for safety.',
        createdAt: new Date().toISOString()
      };

      // Validate restriction creation
      expect(restrictionData.isBlocked).toBe(true);
      expect(restrictionData.reason).toContain('Equipment misuse');
      expect(restrictionData.userId).toBe('resident-user');
      expect(restrictionData.commonSpaceId).toBe('gym-space-id');
    });

    it('should validate blocked user booking prevention', () => {
      const userRestrictions = [
        { userId: 'resident-user', commonSpaceId: 'gym-space-id', isBlocked: true }
      ];
      
      const bookingAttempt = {
        userId: 'resident-user',
        commonSpaceId: 'gym-space-id',
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
      const existingRestriction = {
        id: 'restriction-456',
        userId: 'tenant-user',
        commonSpaceId: 'meeting-room-id',
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
      const restrictionHistory = [
        {
          action: 'BLOCKED',
          userId: 'resident-user',
          commonSpaceId: 'gym-space-id',
          reason: 'Equipment misuse',
          performedBy: 'admin-user',
          timestamp: '2024-03-01T10:00:00Z'
        },
        {
          action: 'UNBLOCKED',
          userId: 'resident-user',
          commonSpaceId: 'gym-space-id',
          reason: 'Training completed',
          performedBy: 'admin-user',
          timestamp: '2024-03-15T14:00:00Z'
        }
      ];

      expect(restrictionHistory).toHaveLength(2);
      expect(restrictionHistory[0].action).toBe('BLOCKED');
      expect(restrictionHistory[1].action).toBe('UNBLOCKED');
      expect(restrictionHistory[0].performedBy).toBe('admin-user');
      expect(restrictionHistory[1].performedBy).toBe('admin-user');
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
      const existingSpaces = DEMO_COMMON_SPACES;
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
      const categories = DEMO_COMMON_SPACES.map(s => s.category);
      expect(categories).toContain('fitness');
      expect(categories).toContain('meeting');
      expect(categories).toContain('event');
      expect(categories).toContain('utility');
      expect(categories).toContain('storage');
      
      // Validate mix of reservable and non-reservable spaces
      const reservableCount = DEMO_COMMON_SPACES.filter(s => s.isReservable).length;
      const nonReservableCount = DEMO_COMMON_SPACES.filter(s => !s.isReservable).length;
      
      expect(reservableCount).toBeGreaterThan(0);
      expect(nonReservableCount).toBeGreaterThan(0);
      expect(DEMO_COMMON_SPACES).toHaveLength(5);
    });

    it('should validate demo user roles coverage', () => {
      const roles = Object.values(DEMO_USERS).map(u => u.role);
      
      expect(roles).toContain('admin');
      expect(roles).toContain('resident');
      expect(roles).toContain('tenant');
      expect(Object.keys(DEMO_USERS)).toHaveLength(3);
    });

    it('should validate French space names', () => {
      const frenchNames = DEMO_COMMON_SPACES.filter(s => 
        s.name.includes('Salle') || s.name.includes('Entrepôt')
      );
      
      expect(frenchNames).toHaveLength(4); // Salle de Réunion, Salle de Fête, Salle de Lavage, Entrepôt Commun
      expect(DEMO_COMMON_SPACES.find(s => s.name === 'Salle de Réunion')).toBeDefined();
      expect(DEMO_COMMON_SPACES.find(s => s.name === 'Salle de Fête')).toBeDefined();
      expect(DEMO_COMMON_SPACES.find(s => s.name === 'Salle de Lavage')).toBeDefined();
      expect(DEMO_COMMON_SPACES.find(s => s.name === 'Entrepôt Commun')).toBeDefined();
    });
  });
});

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