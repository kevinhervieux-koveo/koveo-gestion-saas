// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import { eq, and, or, inArray } from 'drizzle-orm';
import { db } from '../db';
import { notifications, users, userOrganizations, buildings, type InsertNotification } from '@shared/schema';

/**
 * Service for handling demand-related notifications.
 * Notifies users when demands are edited or commented on.
 */
export class DemandNotificationService {
  /**
   * Notify the demand submitter when a manager/admin edits their demand.
   *
   * @param demandId - The ID of the demand that was edited.
   * @param editorId - The ID of the user who edited the demand.
   * @param submitterId - The ID of the demand creator to notify.
   */
  async notifyDemandEdited(
    demandId: string,
    editorId: string,
    submitterId: string
  ): Promise<void> {
    try {
      if (editorId === submitterId) {
        return;
      }

      const editor = await db
        .select({
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, editorId))
        .limit(1);

      const editorName = editor.length > 0
        ? `${editor[0].firstName || ''} ${editor[0].lastName || ''}`.trim() || 'A manager'
        : 'A manager';

      const notification: InsertNotification = {
        userId: submitterId,
        type: 'maintenance_update' as const,
        title: 'Your demand has been updated',
        message: `${editorName} has updated your demand. Please review the changes.`,
        relatedEntityId: demandId,
        relatedEntityType: 'demand',
      };

      await db.insert(notifications).values(notification);
    } catch (error) {
      console.error('Failed to send demand edit notification:', error);
    }
  }

  /**
   * Notify appropriate users when a comment is added to a demand.
   * - If commenter is manager/admin: notify the demand submitter
   * - If commenter is resident/tenant: notify all managers of the building's organization
   *
   * @param demandId - The ID of the demand that was commented on.
   * @param commenterId - The ID of the user who made the comment.
   * @param commenterRole - The role of the commenter.
   * @param submitterId - The ID of the demand creator.
   * @param buildingId - The ID of the building the demand belongs to.
   */
  async notifyDemandCommented(
    demandId: string,
    commenterId: string,
    commenterRole: string,
    submitterId: string,
    buildingId: string
  ): Promise<void> {
    try {
      const commenter = await db
        .select({
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, commenterId))
        .limit(1);

      const commenterName = commenter.length > 0
        ? `${commenter[0].firstName || ''} ${commenter[0].lastName || ''}`.trim() || 'Someone'
        : 'Someone';

      const isManagerOrAdmin = commenterRole === 'admin' || commenterRole === 'manager' || commenterRole === 'demo_manager';

      if (isManagerOrAdmin) {
        if (commenterId !== submitterId) {
          const notification: InsertNotification = {
            userId: submitterId,
            type: 'maintenance_update' as const,
            title: 'New comment on your demand',
            message: `${commenterName} commented on your demand.`,
            relatedEntityId: demandId,
            relatedEntityType: 'demand',
          };

          await db.insert(notifications).values(notification);
        }
      } else {
        const building = await db
          .select({ organizationId: buildings.organizationId })
          .from(buildings)
          .where(eq(buildings.id, buildingId))
          .limit(1);

        if (building.length === 0 || !building[0].organizationId) {
          return;
        }

        const organizationId = building[0].organizationId;

        const orgManagers = await db
          .select({
            userId: userOrganizations.userId,
            role: users.role,
          })
          .from(userOrganizations)
          .innerJoin(users, eq(userOrganizations.userId, users.id))
          .where(
            and(
              eq(userOrganizations.organizationId, organizationId),
              or(
                eq(users.role, 'admin'),
                eq(users.role, 'manager'),
                eq(users.role, 'demo_manager')
              )
            )
          );

        const managerIds = orgManagers
          .map((m) => m.userId)
          .filter((id) => id !== commenterId);

        if (managerIds.length === 0) {
          return;
        }

        const notificationInserts: InsertNotification[] = managerIds.map((managerId) => ({
          userId: managerId,
          type: 'maintenance_update' as const,
          title: 'New comment on a demand',
          message: `${commenterName} commented on a demand that requires your attention.`,
          relatedEntityId: demandId,
          relatedEntityType: 'demand',
        }));

        await db.insert(notifications).values(notificationInserts);
      }
    } catch (error) {
      console.error('Failed to send demand comment notification:', error);
    }
  }
}

export const demandNotificationService = new DemandNotificationService();