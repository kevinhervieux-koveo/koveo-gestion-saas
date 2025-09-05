import { describe, test, expect, beforeEach } from '@jest/globals';
import { addDays, format } from 'date-fns';

/**
 * Enhanced Calendar Features Unit Tests
 * Tests the new opening hours visibility and reservation functionality
 */

describe('Enhanced Calendar Features', () => {
  // Test data structures matching the enhanced schema
  const mockCommonSpace = {
    id: '75c4f108-3ec1-437d-bdec-35d1f8e2a44d',
    name: 'Salle communautaire',
    isReservable: true,
    openingHours: [
      {
        day: 'monday',
        open: '08:00',
        close: '20:00',
        isOpen: true,
        breaks: [
          { start: '12:00', end: '13:00', reason: 'Cleaning' }
        ]
      },
      {
        day: 'tuesday',
        open: '08:00',
        close: '20:00',
        isOpen: true,
        breaks: []
      },
      {
        day: 'wednesday',
        open: '08:00',
        close: '20:00',
        isOpen: false
      },
      {
        day: 'thursday',
        open: '10:00',
        close: '18:00',
        isOpen: true,
        breaks: []
      },
      {
        day: 'friday',
        open: '08:00',
        close: '22:00',
        isOpen: true,
        breaks: []
      },
      {
        day: 'saturday',
        open: '09:00',
        close: '17:00',
        isOpen: true,
        breaks: []
      }
      // Sunday not defined (closed)
    ],
    unavailablePeriods: [
      {
        startDate: '2025-12-24T00:00:00Z',
        endDate: '2025-12-26T23:59:59Z',
        reason: 'Holiday closure',
        recurrence: 'yearly'
      },
      {
        startDate: '2025-01-15T00:00:00Z',
        endDate: '2025-01-17T23:59:59Z',
        reason: 'Maintenance',
        recurrence: 'none'
      }
    ]
  };

  // Use a future Monday for bookings
  const getFutureMonday = () => {
    const today = new Date();
    const futureMonday = addDays(today, 14);
    while (futureMonday.getDay() !== 1) { // 1 = Monday
      futureMonday.setDate(futureMonday.getDate() + 1);
    }
    return futureMonday;
  };

  const futureBookingDate = getFutureMonday();
  const mockBookings = [
    {
      id: 'booking-1',
      startTime: new Date(futureBookingDate.getFullYear(), futureBookingDate.getMonth(), futureBookingDate.getDate(), 14, 0, 0).toISOString(),
      endTime: new Date(futureBookingDate.getFullYear(), futureBookingDate.getMonth(), futureBookingDate.getDate(), 16, 0, 0).toISOString(),
      status: 'confirmed' as const,
      userId: 'user-1'
    },
    {
      id: 'booking-2',
      startTime: new Date(futureBookingDate.getFullYear(), futureBookingDate.getMonth(), futureBookingDate.getDate(), 10, 0, 0).toISOString(),
      endTime: new Date(futureBookingDate.getFullYear(), futureBookingDate.getMonth(), futureBookingDate.getDate(), 11, 30, 0).toISOString(),
      status: 'confirmed' as const,
      userId: 'user-2'
    }
  ];

  describe('Opening Hours Structure Validation', () => {
    test('should validate enhanced opening hours structure', () => {
      const { openingHours } = mockCommonSpace;
      
      expect(openingHours).toBeDefined();
      expect(Array.isArray(openingHours)).toBe(true);
      
      // Check Monday entry with breaks
      const mondayHours = openingHours?.find(h => h.day === 'monday');
      expect(mondayHours).toBeDefined();
      expect(mondayHours?.isOpen).toBe(true);
      expect(mondayHours?.open).toBe('08:00');
      expect(mondayHours?.close).toBe('20:00');
      expect(mondayHours?.breaks).toBeDefined();
      expect(Array.isArray(mondayHours?.breaks)).toBe(true);
      expect(mondayHours?.breaks?.length).toBe(1);
      expect(mondayHours?.breaks?.[0].start).toBe('12:00');
      expect(mondayHours?.breaks?.[0].end).toBe('13:00');
      expect(mondayHours?.breaks?.[0].reason).toBe('Cleaning');

      // Check Wednesday (closed day)
      const wednesdayHours = openingHours?.find(h => h.day === 'wednesday');
      expect(wednesdayHours).toBeDefined();
      expect(wednesdayHours?.isOpen).toBe(false);
    });

    test('should validate unavailable periods structure', () => {
      const { unavailablePeriods } = mockCommonSpace;
      
      expect(unavailablePeriods).toBeDefined();
      expect(Array.isArray(unavailablePeriods)).toBe(true);
      expect(unavailablePeriods?.length).toBe(2);

      // Holiday closure
      const holidayClosure = unavailablePeriods?.[0];
      expect(holidayClosure?.startDate).toBe('2025-12-24T00:00:00Z');
      expect(holidayClosure?.endDate).toBe('2025-12-26T23:59:59Z');
      expect(holidayClosure?.reason).toBe('Holiday closure');
      expect(holidayClosure?.recurrence).toBe('yearly');

      // Maintenance period
      const maintenancePeriod = unavailablePeriods?.[1];
      expect(maintenancePeriod?.startDate).toBe('2025-01-15T00:00:00Z');
      expect(maintenancePeriod?.endDate).toBe('2025-01-17T23:59:59Z');
      expect(maintenancePeriod?.reason).toBe('Maintenance');
      expect(maintenancePeriod?.recurrence).toBe('none');
    });
  });

  describe('Day Availability Logic', () => {
    const isDayAvailable = (checkDate: Date, space = mockCommonSpace): boolean => {
      // Past dates are not available
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayToCheck = new Date(checkDate);
      dayToCheck.setHours(0, 0, 0, 0);
      
      if (dayToCheck < today) {
        return false;
      }

      // Check unavailable periods
      if (space.unavailablePeriods) {
        for (const period of space.unavailablePeriods) {
          const startDate = new Date(period.startDate);
          const endDate = new Date(period.endDate);
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);
          
          if (dayToCheck >= startDate && dayToCheck <= endDate) {
            return false;
          }
        }
      }

      // Check opening hours
      if (space.openingHours) {
        const dayName = checkDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const dayHours = space.openingHours.find(h => h.day.toLowerCase() === dayName);
        
        if (!dayHours || dayHours.isOpen === false) {
          return false;
        }
      }

      return true;
    };

    test('should correctly identify available days', () => {
      const today = new Date();
      const tomorrow = addDays(today, 1);
      // Use a more future date to avoid any edge cases
      const futureMonday = addDays(today, 14); // Two weeks from today, ensure it's Monday
      while (futureMonday.getDay() !== 1) { // 1 = Monday
        futureMonday.setDate(futureMonday.getDate() + 1);
      }

      expect(isDayAvailable(tomorrow)).toBe(true);
      expect(isDayAvailable(futureMonday)).toBe(true);
    });

    test('should correctly identify past dates as unavailable', () => {
      const yesterday = addDays(new Date(), -1);
      expect(isDayAvailable(yesterday)).toBe(false);
    });

    test('should correctly identify closed days as unavailable', () => {
      const today = new Date();
      // Find next Wednesday (closed day)
      const futureWednesday = addDays(today, 7);
      while (futureWednesday.getDay() !== 3) { // 3 = Wednesday
        futureWednesday.setDate(futureWednesday.getDate() + 1);
      }
      
      // Find next Sunday (no hours defined)  
      const futureSunday = addDays(today, 7);
      while (futureSunday.getDay() !== 0) { // 0 = Sunday
        futureSunday.setDate(futureSunday.getDate() + 1);
      }
      
      expect(isDayAvailable(futureWednesday)).toBe(false);
      expect(isDayAvailable(futureSunday)).toBe(false);
    });

    test('should correctly identify unavailable periods', () => {
      const christmasEve = new Date('2025-12-24');
      const christmasDay = new Date('2025-12-25');
      const boxingDay = new Date('2025-12-26');
      const maintenanceDay = new Date('2025-01-16');
      
      expect(isDayAvailable(christmasEve)).toBe(false);
      expect(isDayAvailable(christmasDay)).toBe(false);
      expect(isDayAvailable(boxingDay)).toBe(false);
      expect(isDayAvailable(maintenanceDay)).toBe(false);
    });
  });

  describe('Time Slot Availability Logic', () => {
    const isTimeSlotAvailable = (date: Date, time: string, duration: number = 60): boolean => {
      // Check if day is available
      if (!isDayAvailable(date)) {
        return false;
      }

      const [hour, minute] = time.split(':').map(Number);
      const slotStart = new Date(date);
      slotStart.setHours(hour, minute, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + duration);

      // Check opening hours
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const dayHours = mockCommonSpace.openingHours?.find(h => h.day.toLowerCase() === dayName);

      if (!dayHours || dayHours.isOpen === false) {
        return false;
      }

      // Parse opening hours
      const openTime = new Date(date);
      const [openHour, openMinute] = dayHours.open.split(':').map(Number);
      openTime.setHours(openHour, openMinute, 0, 0);

      const closeTime = new Date(date);
      const [closeHour, closeMinute] = dayHours.close.split(':').map(Number);
      closeTime.setHours(closeHour, closeMinute, 0, 0);

      // Check if slot is within opening hours
      if (slotStart < openTime || slotEnd > closeTime) {
        return false;
      }

      // Check breaks
      if (dayHours.breaks) {
        for (const breakPeriod of dayHours.breaks) {
          const breakStart = new Date(date);
          const [breakStartHour, breakStartMinute] = breakPeriod.start.split(':').map(Number);
          breakStart.setHours(breakStartHour, breakStartMinute, 0, 0);

          const breakEnd = new Date(date);
          const [breakEndHour, breakEndMinute] = breakPeriod.end.split(':').map(Number);
          breakEnd.setHours(breakEndHour, breakEndMinute, 0, 0);

          // Check if slot overlaps with break
          if (
            (slotStart >= breakStart && slotStart < breakEnd) ||
            (slotEnd > breakStart && slotEnd <= breakEnd) ||
            (slotStart <= breakStart && slotEnd >= breakEnd)
          ) {
            return false;
          }
        }
      }

      // Check conflicts with existing bookings
      const dayBookings = mockBookings.filter(booking => {
        const bookingDate = new Date(booking.startTime);
        return bookingDate.toDateString() === date.toDateString() && booking.status === 'confirmed';
      });

      return !dayBookings.some(booking => {
        const bookingStart = new Date(booking.startTime);
        const bookingEnd = new Date(booking.endTime);

        return (
          (slotStart >= bookingStart && slotStart < bookingEnd) ||
          (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
          (slotStart <= bookingStart && slotEnd >= bookingEnd)
        );
      });
    };

    const isDayAvailable = (checkDate: Date): boolean => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayToCheck = new Date(checkDate);
      dayToCheck.setHours(0, 0, 0, 0);
      
      if (dayToCheck < today) {
        return false;
      }

      if (mockCommonSpace.unavailablePeriods) {
        for (const period of mockCommonSpace.unavailablePeriods) {
          const startDate = new Date(period.startDate);
          const endDate = new Date(period.endDate);
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);
          
          if (dayToCheck >= startDate && dayToCheck <= endDate) {
            return false;
          }
        }
      }

      if (mockCommonSpace.openingHours) {
        const dayName = checkDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const dayHours = mockCommonSpace.openingHours.find(h => h.day.toLowerCase() === dayName);
        
        if (!dayHours || dayHours.isOpen === false) {
          return false;
        }
      }

      return true;
    };

    test('should allow available time slots within opening hours', () => {
      const today = new Date();
      const futureMonday = addDays(today, 14);
      while (futureMonday.getDay() !== 1) { // 1 = Monday
        futureMonday.setDate(futureMonday.getDate() + 1);
      }
      
      expect(isTimeSlotAvailable(futureMonday, '08:00')).toBe(true); // Opening time
      expect(isTimeSlotAvailable(futureMonday, '09:00')).toBe(true); // Within hours
      expect(isTimeSlotAvailable(futureMonday, '19:00')).toBe(true); // Before closing
    });

    test('should reject time slots outside opening hours', () => {
      const today = new Date();
      const futureMonday = addDays(today, 14);
      while (futureMonday.getDay() !== 1) { // 1 = Monday
        futureMonday.setDate(futureMonday.getDate() + 1);
      }
      
      expect(isTimeSlotAvailable(futureMonday, '07:00')).toBe(false); // Before opening
      expect(isTimeSlotAvailable(futureMonday, '20:00')).toBe(false); // At closing time (would end after)
      expect(isTimeSlotAvailable(futureMonday, '21:00')).toBe(false); // After closing
    });

    test('should reject time slots during breaks', () => {
      const today = new Date();
      const futureMonday = addDays(today, 14);
      while (futureMonday.getDay() !== 1) { // 1 = Monday
        futureMonday.setDate(futureMonday.getDate() + 1);
      }
      
      expect(isTimeSlotAvailable(futureMonday, '12:00')).toBe(false); // During break
      expect(isTimeSlotAvailable(futureMonday, '12:30')).toBe(false); // During break
      expect(isTimeSlotAvailable(futureMonday, '11:30')).toBe(false); // Would extend into break
      expect(isTimeSlotAvailable(futureMonday, '13:00')).toBe(true); // After break
    });

    test('should reject time slots that conflict with existing bookings', () => {
      const bookingDate = new Date(futureBookingDate); // Use the same future Monday
      
      // Test times that should be available (not conflicting with bookings)
      // Monday opening hours are 8:00-20:00, so these should be available
      expect(isTimeSlotAvailable(bookingDate, '08:00')).toBe(true); // Opening time
      expect(isTimeSlotAvailable(bookingDate, '09:00')).toBe(true); // Before first booking
      
      // Booking exists 10:00-11:30, these should be blocked
      expect(isTimeSlotAvailable(bookingDate, '10:00')).toBe(false);
      expect(isTimeSlotAvailable(bookingDate, '11:00')).toBe(false);
      
      // Booking exists 14:00-16:00, these should be blocked
      expect(isTimeSlotAvailable(bookingDate, '14:00')).toBe(false);
      expect(isTimeSlotAvailable(bookingDate, '15:00')).toBe(false);
      
      // Time after bookings should be available
      expect(isTimeSlotAvailable(bookingDate, '18:00')).toBe(true); // Well after bookings
    });
  });

  describe('Visual Indicators Logic', () => {
    test('should correctly identify booked time slots', () => {
      const bookingDate = new Date(futureBookingDate);
      // Test that the booking detection logic works
      const bookingTimes = ['10:30', '11:00', '14:30', '15:00']; // Times within booking periods
      
      bookingTimes.forEach(time => {
        const hasBooking = mockBookings.some(booking => {
          const bookingStart = new Date(booking.startTime);
          const bookingEnd = new Date(booking.endTime);
          const timeSlot = new Date(bookingDate);
          const [hour, minute] = time.split(':').map(Number);
          timeSlot.setHours(hour, minute, 0, 0);
          
          return timeSlot >= bookingStart && timeSlot < bookingEnd;
        });
        
        expect(hasBooking).toBe(true);
      });
    });

    test('should correctly identify available time slots', () => {
      const bookingDate = new Date(futureBookingDate);
      const availableTimes = ['08:00', '09:00', '13:00', '17:00']; // Times outside booking periods
      
      availableTimes.forEach(time => {
        const hasBooking = mockBookings.some(booking => {
          const bookingStart = new Date(booking.startTime);
          const bookingEnd = new Date(booking.endTime);
          const timeSlot = new Date(bookingDate);
          const [hour, minute] = time.split(':').map(Number);
          timeSlot.setHours(hour, minute, 0, 0);
          
          return timeSlot >= bookingStart && timeSlot < bookingEnd;
        });
        
        expect(hasBooking).toBe(false);
      });
    });
  });

  describe('Calendar Display Logic', () => {
    test('should provide correct CSS classes for different day states', () => {
      const getDateClass = (date: Date) => {
        const today = new Date();
        const isCurrentDay = date.toDateString() === today.toDateString();
        const isAvailable = isDayAvailable(date);
        
        if (!isAvailable) {
          return 'bg-red-100 text-red-600 cursor-not-allowed border border-red-200';
        } else if (isCurrentDay) {
          return 'bg-blue-100 text-blue-900 hover:bg-blue-200';
        } else {
          return 'hover:bg-gray-100';
        }
      };

      const today = new Date();
      const futureWednesday = new Date('2025-06-04'); // Closed day
      const futureMonday = addDays(new Date(), 21); // Use a date in the future
      while (futureMonday.getDay() !== 1) { // 1 = Monday
        futureMonday.setDate(futureMonday.getDate() + 1);
      }
      
      expect(getDateClass(today)).toContain('bg-blue-100'); // Today
      expect(getDateClass(futureWednesday)).toContain('bg-red-100'); // Unavailable
      expect(getDateClass(futureMonday)).toBe('hover:bg-gray-100'); // Available
    });

    const isDayAvailable = (checkDate: Date): boolean => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayToCheck = new Date(checkDate);
      dayToCheck.setHours(0, 0, 0, 0);
      
      if (dayToCheck < today) {
        return false;
      }

      if (mockCommonSpace.unavailablePeriods) {
        for (const period of mockCommonSpace.unavailablePeriods) {
          const startDate = new Date(period.startDate);
          const endDate = new Date(period.endDate);
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);
          
          if (dayToCheck >= startDate && dayToCheck <= endDate) {
            return false;
          }
        }
      }

      if (mockCommonSpace.openingHours) {
        const dayName = checkDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const dayHours = mockCommonSpace.openingHours.find(h => h.day.toLowerCase() === dayName);
        
        if (!dayHours || dayHours.isOpen === false) {
          return false;
        }
      }

      return true;
    };

    test('should show correct legend items', () => {
      const legendItems = [
        { color: 'bg-blue-600', label: 'Selected' },
        { color: 'bg-orange-500', label: 'Booked' },
        { color: 'bg-red-500', label: 'Unavailable' },
        { color: 'bg-blue-200', label: 'Today' }
      ];
      
      expect(legendItems).toHaveLength(4);
      expect(legendItems.find(item => item.label === 'Unavailable')).toBeDefined();
    });

    test('should provide correct CSS classes for time slot buttons', () => {
      const getTimeSlotClass = (time: string, isAvailable: boolean, hasBooking: boolean, isSelected: boolean) => {
        if (!isAvailable) {
          return 'bg-red-100 border-red-200 text-red-600 cursor-not-allowed';
        } else if (hasBooking) {
          return 'bg-orange-100 border-orange-200 text-orange-700 cursor-not-allowed';
        } else if (isSelected) {
          return 'bg-blue-500 border-blue-600 text-white font-semibold';
        } else {
          return 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300';
        }
      };

      expect(getTimeSlotClass('09:00', true, false, false)).toBe('bg-white border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300');
      expect(getTimeSlotClass('09:00', true, false, true)).toBe('bg-blue-500 border-blue-600 text-white font-semibold');
      expect(getTimeSlotClass('09:00', true, true, false)).toBe('bg-orange-100 border-orange-200 text-orange-700 cursor-not-allowed');
      expect(getTimeSlotClass('09:00', false, false, false)).toBe('bg-red-100 border-red-200 text-red-600 cursor-not-allowed');
    });
  });

  describe('New Booking Form Tests', () => {
    test('should validate time slot grid generation', () => {
      const timeSlots: string[] = [];
      for (let hour = 6; hour <= 22; hour++) {
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
        timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
      
      expect(timeSlots).toContain('06:00');
      expect(timeSlots).toContain('06:30');
      expect(timeSlots).toContain('22:00');
      expect(timeSlots).toContain('22:30');
      expect(timeSlots.length).toBe(34); // 17 hours * 2 slots per hour
    });

    test('should handle start and end time selection logic', () => {
      let currentStartTime = '';
      let currentEndTime = '';
      
      const selectTime = (time: string) => {
        if (!currentStartTime || (currentStartTime && currentEndTime)) {
          // Set start time
          currentStartTime = time;
          currentEndTime = '';
        } else {
          // Set end time if start time is already set
          if (time > currentStartTime) {
            currentEndTime = time;
          } else {
            // If selected time is before start time, make it the new start time
            currentStartTime = time;
            currentEndTime = '';
          }
        }
      };
      
      // Initial state
      expect(currentStartTime).toBe('');
      expect(currentEndTime).toBe('');
      
      // Select first time (should become start time)
      selectTime('09:00');
      expect(currentStartTime).toBe('09:00');
      expect(currentEndTime).toBe('');
      
      // Select later time (should become end time)
      selectTime('11:00');
      expect(currentStartTime).toBe('09:00');
      expect(currentEndTime).toBe('11:00');
      
      // Select another time (should reset and become new start time)
      selectTime('14:00');
      expect(currentStartTime).toBe('14:00');
      expect(currentEndTime).toBe('');
      
      // Select earlier time (should become new start time)
      selectTime('13:00');
      expect(currentStartTime).toBe('13:00');
      expect(currentEndTime).toBe('');
    });

    test('should calculate booking duration correctly', () => {
      const calculateDuration = (startTime: string, endTime: string) => {
        if (!startTime || !endTime) return null;
        
        const start = new Date(`2000-01-01T${startTime}:00`);
        const end = new Date(`2000-01-01T${endTime}:00`);
        const duration = (end.getTime() - start.getTime()) / (1000 * 60);
        
        return {
          totalMinutes: duration,
          hours: Math.floor(duration / 60),
          minutes: duration % 60
        };
      };
      
      const duration1 = calculateDuration('09:00', '11:00');
      expect(duration1?.totalMinutes).toBe(120);
      expect(duration1?.hours).toBe(2);
      expect(duration1?.minutes).toBe(0);
      
      const duration2 = calculateDuration('14:30', '16:00');
      expect(duration2?.totalMinutes).toBe(90);
      expect(duration2?.hours).toBe(1);
      expect(duration2?.minutes).toBe(30);
      
      const noDuration = calculateDuration('09:00', '');
      expect(noDuration).toBe(null);
    });

    test('should validate form submission requirements', () => {
      const validateBookingForm = (startTime: string, endTime: string, date: Date) => {
        return {
          hasStartTime: !!startTime,
          hasEndTime: !!endTime,
          hasValidTimeRange: startTime && endTime && endTime > startTime,
          hasDate: !!date,
          isComplete: !!(startTime && endTime && date && endTime > startTime)
        };
      };
      
      const incompleteForm = validateBookingForm('', '', new Date());
      expect(incompleteForm.hasStartTime).toBe(false);
      expect(incompleteForm.hasEndTime).toBe(false);
      expect(incompleteForm.isComplete).toBe(false);
      
      const partialForm = validateBookingForm('09:00', '', new Date());
      expect(partialForm.hasStartTime).toBe(true);
      expect(partialForm.hasEndTime).toBe(false);
      expect(partialForm.isComplete).toBe(false);
      
      const completeForm = validateBookingForm('09:00', '11:00', new Date());
      expect(completeForm.hasStartTime).toBe(true);
      expect(completeForm.hasEndTime).toBe(true);
      expect(completeForm.hasValidTimeRange).toBe(true);
      expect(completeForm.isComplete).toBe(true);
      
      const invalidTimeRange = validateBookingForm('11:00', '09:00', new Date());
      expect(invalidTimeRange.hasValidTimeRange).toBe(false);
      expect(invalidTimeRange.isComplete).toBe(false);
    });
  });

  describe('Integration Testing', () => {
    test('should handle complete booking flow validation', () => {
      const testDate = new Date('2025-06-02'); // Monday
      const testTime = '15:00';
      
      // Step 1: Check if day is available - use future date to ensure it's available
      const futureTestDate = addDays(new Date(), 14);
      while (futureTestDate.getDay() !== 1) { // 1 = Monday
        futureTestDate.setDate(futureTestDate.getDate() + 1);
      }
      const dayAvailable = isDayAvailable(futureTestDate);
      expect(dayAvailable).toBe(true);
      
      // Step 2: Check if time slot is available
      const timeAvailable = isTimeSlotAvailable(futureTestDate, testTime);
      expect(timeAvailable).toBe(true);
      
      // Step 3: Validate booking constraints
      const [hour, minute] = testTime.split(':').map(Number);
      expect(hour).toBeGreaterThanOrEqual(8); // After opening
      expect(hour).toBeLessThan(20); // Before closing
    });

    test('should integrate with new hour grid booking interface', () => {
      // Simulate the new booking interface flow
      let selectedDate = new Date();
      let selectedStartTime = '';
      let selectedEndTime = '';
      let isDialogOpen = false;
      
      // Step 1: Date selection from calendar
      const selectDate = (date: Date) => {
        selectedDate = date;
        isDialogOpen = true;
      };
      
      // Step 2: Time selection from grid
      const selectTimeSlot = (time: string) => {
        if (!selectedStartTime || (selectedStartTime && selectedEndTime)) {
          selectedStartTime = time;
          selectedEndTime = '';
        } else if (time > selectedStartTime) {
          selectedEndTime = time;
        } else {
          selectedStartTime = time;
          selectedEndTime = '';
        }
      };
      
      // Step 3: Form validation
      const canSubmit = () => {
        return !!(selectedDate && selectedStartTime && selectedEndTime && selectedEndTime > selectedStartTime);
      };
      
      // Test the flow
      const testDate = addDays(new Date(), 7);
      selectDate(testDate);
      expect(isDialogOpen).toBe(true);
      expect(selectedDate).toBe(testDate);
      
      selectTimeSlot('10:00');
      expect(selectedStartTime).toBe('10:00');
      expect(selectedEndTime).toBe('');
      expect(canSubmit()).toBe(false);
      
      selectTimeSlot('12:00');
      expect(selectedStartTime).toBe('10:00');
      expect(selectedEndTime).toBe('12:00');
      expect(canSubmit()).toBe(true);
    });

    const isDayAvailable = (checkDate: Date): boolean => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayToCheck = new Date(checkDate);
      dayToCheck.setHours(0, 0, 0, 0);
      
      if (dayToCheck < today) {
        return false;
      }

      if (mockCommonSpace.unavailablePeriods) {
        for (const period of mockCommonSpace.unavailablePeriods) {
          const startDate = new Date(period.startDate);
          const endDate = new Date(period.endDate);
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);
          
          if (dayToCheck >= startDate && dayToCheck <= endDate) {
            return false;
          }
        }
      }

      if (mockCommonSpace.openingHours) {
        const dayName = checkDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const dayHours = mockCommonSpace.openingHours.find(h => h.day.toLowerCase() === dayName);
        
        if (!dayHours || dayHours.isOpen === false) {
          return false;
        }
      }

      return true;
    };

    const isTimeSlotAvailable = (date: Date, time: string): boolean => {
      if (!isDayAvailable(date)) {
        return false;
      }

      const [hour, minute] = time.split(':').map(Number);
      const slotStart = new Date(date);
      slotStart.setHours(hour, minute, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + 60);

      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const dayHours = mockCommonSpace.openingHours?.find(h => h.day.toLowerCase() === dayName);

      if (!dayHours || dayHours.isOpen === false) {
        return false;
      }

      const openTime = new Date(date);
      const [openHour, openMinute] = dayHours.open.split(':').map(Number);
      openTime.setHours(openHour, openMinute, 0, 0);

      const closeTime = new Date(date);
      const [closeHour, closeMinute] = dayHours.close.split(':').map(Number);
      closeTime.setHours(closeHour, closeMinute, 0, 0);

      if (slotStart < openTime || slotEnd > closeTime) {
        return false;
      }

      if (dayHours.breaks) {
        for (const breakPeriod of dayHours.breaks) {
          const breakStart = new Date(date);
          const [breakStartHour, breakStartMinute] = breakPeriod.start.split(':').map(Number);
          breakStart.setHours(breakStartHour, breakStartMinute, 0, 0);

          const breakEnd = new Date(date);
          const [breakEndHour, breakEndMinute] = breakPeriod.end.split(':').map(Number);
          breakEnd.setHours(breakEndHour, breakEndMinute, 0, 0);

          if (
            (slotStart >= breakStart && slotStart < breakEnd) ||
            (slotEnd > breakStart && slotEnd <= breakEnd) ||
            (slotStart <= breakStart && slotEnd >= breakEnd)
          ) {
            return false;
          }
        }
      }

      return true;
    };

    test('should handle edge cases correctly', () => {
      // Test exactly at opening/closing times
      const thursday = new Date('2025-06-05'); // Thursday 10:00-18:00
      
      // Thursday 10:00-18:00, let's use a future Thursday to avoid date issues
      const futureThursday = addDays(new Date(), 14);
      while (futureThursday.getDay() !== 4) { // 4 = Thursday
        futureThursday.setDate(futureThursday.getDate() + 1);
      }
      
      expect(isTimeSlotAvailable(futureThursday, '10:00')).toBe(true); // Opening time
      expect(isTimeSlotAvailable(futureThursday, '17:00')).toBe(true); // Last valid slot
      expect(isTimeSlotAvailable(futureThursday, '18:00')).toBe(false); // Would end after closing
      
      // Test break boundaries - use future Monday
      const futureMonday = addDays(new Date(), 14);
      while (futureMonday.getDay() !== 1) { // 1 = Monday
        futureMonday.setDate(futureMonday.getDate() + 1);
      }
      
      expect(isTimeSlotAvailable(futureMonday, '11:00')).toBe(true); // Before break
      expect(isTimeSlotAvailable(futureMonday, '11:30')).toBe(false); // Would extend into break
      expect(isTimeSlotAvailable(futureMonday, '13:00')).toBe(true); // After break
    });
  });

  describe('New Booking Form UI Components', () => {
    test('should display selected date information prominently', () => {
      const formatDisplayDate = (date: Date, language: string = 'fr') => {
        const options: Intl.DateTimeFormatOptions = {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        };
        const locale = language === 'fr' ? 'fr-CA' : 'en-CA';
        return date.toLocaleDateString(locale, options);
      };
      
      const testDate = new Date('2025-06-02');
      const frenchDisplay = formatDisplayDate(testDate, 'fr');
      const englishDisplay = formatDisplayDate(testDate, 'en');
      
      expect(frenchDisplay).toContain('lundi');
      expect(frenchDisplay).toContain('juin');
      expect(englishDisplay).toContain('Monday');
      expect(englishDisplay).toContain('June');
    });

    test('should show opening hours for selected date', () => {
      const getOpeningHoursForDate = (date: Date, openingHours: any[]) => {
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        return openingHours.find(h => h.day.toLowerCase() === dayName);
      };
      
      const mondayDate = new Date('2025-06-02'); // Monday
      const wednesdayDate = new Date('2025-06-04'); // Wednesday (closed)
      
      const mondayHours = getOpeningHoursForDate(mondayDate, mockCommonSpace.openingHours!);
      const wednesdayHours = getOpeningHoursForDate(wednesdayDate, mockCommonSpace.openingHours!);
      
      expect(mondayHours?.open).toBe('08:00');
      expect(mondayHours?.close).toBe('20:00');
      expect(mondayHours?.isOpen).toBe(true);
      
      expect(wednesdayHours?.isOpen).toBe(false);
    });

    test('should provide validation messages for incomplete forms', () => {
      const getValidationMessage = (startTime: string, endTime: string, language: string = 'fr') => {
        if (!startTime) {
          return language === 'fr' 
            ? 'Veuillez sélectionner une heure de début'
            : 'Please select a start time';
        }
        if (startTime && !endTime) {
          return language === 'fr' 
            ? 'Veuillez sélectionner une heure de fin'
            : 'Please select an end time';
        }
        return null;
      };
      
      expect(getValidationMessage('', '', 'fr')).toBe('Veuillez sélectionner une heure de début');
      expect(getValidationMessage('', '', 'en')).toBe('Please select a start time');
      expect(getValidationMessage('09:00', '', 'fr')).toBe('Veuillez sélectionner une heure de fin');
      expect(getValidationMessage('09:00', '', 'en')).toBe('Please select an end time');
      expect(getValidationMessage('09:00', '11:00', 'fr')).toBe(null);
    });

    test('should display booking summary with duration calculation', () => {
      const generateBookingSummary = (startTime: string, endTime: string, language: string = 'fr') => {
        if (!startTime || !endTime) return null;
        
        const start = new Date(`2000-01-01T${startTime}:00`);
        const end = new Date(`2000-01-01T${endTime}:00`);
        const durationMs = end.getTime() - start.getTime();
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        
        const startLabel = language === 'fr' ? 'Début:' : 'Start:';
        const endLabel = language === 'fr' ? 'Fin:' : 'End:';
        const durationLabel = language === 'fr' ? 'Durée:' : 'Duration:';
        
        let durationText = `${hours}h`;
        if (minutes > 0) {
          durationText += ` ${minutes}min`;
        }
        
        return {
          startLabel,
          endLabel, 
          durationLabel,
          startTime,
          endTime,
          durationText
        };
      };
      
      const summary = generateBookingSummary('09:00', '11:30', 'fr');
      expect(summary?.startLabel).toBe('Début:');
      expect(summary?.endLabel).toBe('Fin:');
      expect(summary?.durationLabel).toBe('Durée:');
      expect(summary?.durationText).toBe('2h 30min');
      
      const englishSummary = generateBookingSummary('14:00', '16:00', 'en');
      expect(englishSummary?.startLabel).toBe('Start:');
      expect(englishSummary?.durationText).toBe('2h');
    });
  });
});