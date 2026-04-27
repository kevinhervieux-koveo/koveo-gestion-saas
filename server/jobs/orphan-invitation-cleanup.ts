/**
 * Orphan Invitation Cleanup Job
 *
 * Periodically cancels invitations that point to deleted buildings or
 * residences.  These rows are harmless but clutter the invitation list
 * and can confuse operators.  The resend endpoint already refuses to act
 * on them; this job proactively marks them 'cancelled' so they no longer
 * appear in the pending queue.
 *
 * Run schedule: daily at 03:30 AM (America/Montreal), see maintenanceJobs.ts.
 */

import { db } from '../db';
import { and, eq, isNotNull, isNull, inArray, sql } from 'drizzle-orm';
import { invitations, invitationAuditLog, buildings, residences } from '@shared/schema';

export interface OrphanInvitationCleanupResult {
  ranAt: Date;
  cancelledBuilding: number;
  cancelledResidence: number;
  total: number;
  errors: string[];
}

/**
 * Cancel pending invitations whose buildingId or residenceId no longer
 * exists in the database.
 *
 * Only 'pending' invitations are touched — accepted/cancelled/expired rows
 * are already terminal and don't need further action.
 */
export async function cleanupOrphanInvitations(): Promise<OrphanInvitationCleanupResult> {
  const ranAt = new Date();
  const errors: string[] = [];
  let cancelledBuilding = 0;
  let cancelledResidence = 0;

  // --- Building orphans ---
  // Left-join invitations with buildings; where no matching building row exists
  // (buildings.id IS NULL) the invitation is orphaned.
  try {
    const orphanByBuilding = await db
      .select({ id: invitations.id })
      .from(invitations)
      .leftJoin(buildings, sql`${buildings.id} = ${invitations.buildingId}`)
      .where(
        and(
          eq(invitations.status, 'pending'),
          isNotNull(invitations.buildingId),
          isNull(buildings.id),
        ),
      );

    if (orphanByBuilding.length > 0) {
      const ids = orphanByBuilding.map((r) => r.id);
      await db
        .update(invitations)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(inArray(invitations.id, ids));

      for (const { id } of orphanByBuilding) {
        try {
          await db.insert(invitationAuditLog).values({
            invitationId: id,
            action: 'cancelled',
            performedBy: null,
            previousStatus: 'pending',
            newStatus: 'cancelled',
            details: {
              source: 'orphan-cleanup-job',
              reason: 'building_deleted',
              ranAt: ranAt.toISOString(),
            },
          });
        } catch {
          // Audit log failures must not block the cleanup itself.
        }
      }

      cancelledBuilding = ids.length;
    }
  } catch (err: any) {
    errors.push(`building orphan sweep: ${err?.message ?? String(err)}`);
  }

  // --- Residence orphans ---
  // Same pattern: left-join with residences to find dangling invitations.
  try {
    const orphanByResidence = await db
      .select({ id: invitations.id })
      .from(invitations)
      .leftJoin(residences, sql`${residences.id} = ${invitations.residenceId}`)
      .where(
        and(
          eq(invitations.status, 'pending'),
          isNotNull(invitations.residenceId),
          isNull(residences.id),
        ),
      );

    if (orphanByResidence.length > 0) {
      const ids = orphanByResidence.map((r) => r.id);
      await db
        .update(invitations)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(inArray(invitations.id, ids));

      for (const { id } of orphanByResidence) {
        try {
          await db.insert(invitationAuditLog).values({
            invitationId: id,
            action: 'cancelled',
            performedBy: null,
            previousStatus: 'pending',
            newStatus: 'cancelled',
            details: {
              source: 'orphan-cleanup-job',
              reason: 'residence_deleted',
              ranAt: ranAt.toISOString(),
            },
          });
        } catch {
          // Audit log failures must not block the cleanup itself.
        }
      }

      cancelledResidence = ids.length;
    }
  } catch (err: any) {
    errors.push(`residence orphan sweep: ${err?.message ?? String(err)}`);
  }

  return {
    ranAt,
    cancelledBuilding,
    cancelledResidence,
    total: cancelledBuilding + cancelledResidence,
    errors,
  };
}
