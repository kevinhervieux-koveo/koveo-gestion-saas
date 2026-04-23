import { eq, and, or, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '@shared/schema';

const { bookings, commonSpaces, userBookingRestrictions, userTimeLimits } = schema;

/**
 * Common-space booking-rule helpers shared between the REST API
 * (`server/api/common-spaces.ts`) and the MCP server
 * (`server/mcp/server.ts`). Extracting these guarantees that AI assistants
 * acting through MCP enforce identical opening-hours, time-limit,
 * blocked-user, and conflict rules as the resident/manager web UI.
 */

/**
 * Sum of confirmed booking hours for a user in the current monthly or
 * yearly period, optionally scoped to a single common space.
 */
export async function getUserBookingHours(
  userId: string,
  commonSpaceId: string | null,
  limitType: 'monthly' | 'yearly'
): Promise<number> {
  const now = new Date();
  const startDate =
    limitType === 'monthly'
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getFullYear(), 0, 1);

  const conditions = [
    eq(bookings.userId, userId),
    eq(bookings.status, 'confirmed'),
    gte(bookings.startTime, startDate),
  ];
  if (commonSpaceId) {
    conditions.push(eq(bookings.commonSpaceId, commonSpaceId));
  }

  const rows = await db
    .select({
      totalHours: sql<number>`EXTRACT(EPOCH FROM SUM(${bookings.endTime} - ${bookings.startTime})) / 3600`,
    })
    .from(bookings)
    .where(and(...conditions));

  return rows[0]?.totalHours || 0;
}

/**
 * Verify a candidate booking would not push the user past their
 * monthly/yearly time limit for this space (or their global limit).
 */
export async function checkUserTimeLimit(
  userId: string,
  commonSpaceId: string,
  newBookingHours: number
): Promise<{ withinLimit: boolean; message?: string; remainingHours?: number }> {
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
    .orderBy(userTimeLimits.commonSpaceId);

  if (timeLimits.length === 0) return { withinLimit: true };

  const activeLimit = timeLimits[0];
  const currentHours = await getUserBookingHours(
    userId,
    activeLimit.commonSpaceId,
    activeLimit.limitType as 'monthly' | 'yearly'
  );

  const remainingHours = Math.max(0, activeLimit.limitHours - currentHours);
  if (currentHours + newBookingHours > activeLimit.limitHours) {
    const limitPeriod = activeLimit.limitType === 'monthly' ? 'ce mois' : 'cette année';
    return {
      withinLimit: false,
      message: `Limite de temps dépassée. Vous avez utilisé ${Math.round(currentHours)}h sur ${activeLimit.limitHours}h autorisées pour ${limitPeriod}. Il vous reste ${Math.round(remainingHours)}h disponibles.`,
      remainingHours,
    };
  }
  return { withinLimit: true, remainingHours };
}

/**
 * Returns true if the proposed `[startTime, endTime)` window collides
 * with an existing confirmed booking on the space.
 */
export async function hasOverlappingBookings(
  commonSpaceId: string,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string
): Promise<boolean> {
  const conditions = [
    eq(bookings.commonSpaceId, commonSpaceId),
    eq(bookings.status, 'confirmed'),
    or(
      and(gte(bookings.startTime, startTime), lte(bookings.startTime, endTime)),
      and(gte(bookings.endTime, startTime), lte(bookings.endTime, endTime)),
      and(lte(bookings.startTime, startTime), gte(bookings.endTime, endTime)),
      and(gte(bookings.startTime, startTime), lte(bookings.endTime, endTime))
    ),
  ];
  if (excludeBookingId) {
    conditions.push(sql`${bookings.id} != ${excludeBookingId}`);
  }
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(...conditions))
    .limit(1);
  return rows.length > 0;
}

/**
 * Returns true when the user has been explicitly blocked from booking
 * the given common space.
 */
export async function isUserBlocked(userId: string, commonSpaceId: string): Promise<boolean> {
  const rows = await db
    .select({ isBlocked: userBookingRestrictions.isBlocked })
    .from(userBookingRestrictions)
    .where(
      and(
        eq(userBookingRestrictions.userId, userId),
        eq(userBookingRestrictions.commonSpaceId, commonSpaceId)
      )
    )
    .limit(1);
  return rows.length > 0 && rows[0].isBlocked;
}

/**
 * Returns true if `[startTime, endTime)` falls within the configured
 * opening hours (per-day open/close pairs in America/Montreal). When
 * `openingHours` is empty/unset, the space is treated as unrestricted.
 */
export function isWithinOpeningHours(startTime: Date, endTime: Date, openingHours: any): boolean {
  let hours: any = openingHours;
  if (typeof hours === 'string') {
    try {
      hours = JSON.parse(hours);
    } catch {
      return true;
    }
  }
  if (!Array.isArray(hours) || hours.length === 0) return true;

  const timezone = 'America/Montreal';
  const startDay = startTime
    .toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone })
    .toLowerCase();
  const endDay = endTime
    .toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone })
    .toLowerCase();

  if (startDay !== endDay) return false;

  const dayHours = hours.find((oh: any) => oh.day && oh.day.toLowerCase() === startDay);
  if (!dayHours) return false;

  const startHour = parseInt(
    startTime.toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: timezone })
  );
  const startMinute = parseInt(
    startTime.toLocaleString('en-US', { minute: '2-digit', timeZone: timezone })
  );
  const endHour = parseInt(
    endTime.toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: timezone })
  );
  const endMinute = parseInt(
    endTime.toLocaleString('en-US', { minute: '2-digit', timeZone: timezone })
  );

  const startTimeStr = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
  const endTimeStr = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

  return startTimeStr >= dayHours.open && endTimeStr <= dayHours.close;
}

/**
 * Normalize the JSONB `openingHours` field into the array shape
 * expected by `isWithinOpeningHours`. Returns `[]` when no schedule is
 * configured, in which case callers should treat the space as open.
 */
export function normalizeOpeningHours(raw: unknown): Array<{ day: string; open: string; close: string }> {
  let parsed: any = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  return Array.isArray(parsed) ? parsed : [];
}

export type CommonSpaceForBookingChecks = {
  id: string;
  name: string;
  buildingId: string;
  isReservable: boolean;
  openingHours: unknown;
};

/**
 * Loads the columns needed to enforce booking rules for a single space.
 * Returns null when the space does not exist.
 */
export async function loadCommonSpaceForBookingChecks(
  spaceId: string
): Promise<CommonSpaceForBookingChecks | null> {
  const rows = await db
    .select({
      id: commonSpaces.id,
      name: commonSpaces.name,
      buildingId: commonSpaces.buildingId,
      isReservable: commonSpaces.isReservable,
      openingHours: commonSpaces.openingHours,
    })
    .from(commonSpaces)
    .where(eq(commonSpaces.id, spaceId))
    .limit(1);
  return rows[0] ?? null;
}
