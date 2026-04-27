/**
 * Resident maintenance request REST endpoint — Task #1277 / #1314.
 *
 * Maintenance requests can already be created by the AI assistant via the
 * MCP `create_maintenance_request` tool. Until this task there was no REST
 * endpoint or UI form, which meant residents could only file requests by
 * asking the assistant. This module adds POST /api/maintenance-requests so
 * the resident-facing form (see `client/src/pages/residents/residence.tsx`
 * and the dashboard) has a real backend to talk to.
 *
 * The endpoint mirrors the residence-scope guard the MCP tool already
 * enforces:
 *   - the residence must exist,
 *   - the caller must be allowed to access the residence per `canUserAccessResidence`
 *     (admins/managers via their accessible orgs; residents/tenants via an
 *     ACTIVE `userResidences` link).
 *
 * Validation reuses `insertMaintenanceRequestSchema` (and therefore the
 * shared `MAINTENANCE_CATEGORY_VALUES` enum + DB CHECK constraint applied
 * by migration 0009_maintenance_category_check.sql), so an invalid category
 * is rejected by Zod with a 400 before we ever touch the database — no
 * surface can drift away from the canonical 9-value enum.
 *
 * Persistence is routed through `storage.createMaintenanceRequest()` so the
 * storage layer (cache invalidation, MemStorage in tests) stays consistent
 * with manager-side flows.
 */
import type { Express } from 'express';
import { requireAuth } from '../../auth';
import { canUserAccessResidence } from '../../rbac';
import { insertMaintenanceRequestSchema } from '../../../shared/schemas/operations';
import { storage } from '../../storage';
import { z } from 'zod';

// `insertMaintenanceRequestSchema.priority` is `z.string().default('medium')`,
// which would let any string slip through and only fail at the DB enum level
// (a 500). Tighten it to the same 5-value enum the `maintenance_priority`
// pgEnum + DB column already enforce, so invalid priorities are rejected at
// validation time with a clean 400.
const PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent', 'emergency'] as const;
type MaintenancePriority = (typeof PRIORITY_VALUES)[number];
const prioritySchema = z.enum(PRIORITY_VALUES).default('medium');

// Max 3 images; each image string (base64 data URL) must not exceed ~10 MB
// encoded — 10 * 1024 * 1024 * (4/3) ≈ 13_981_013 characters. We use
// 14_000_000 as a round cap that gracefully covers a ~10 MB raw image.
const MAX_IMAGE_COUNT = 3;
const MAX_IMAGE_STRING_LENGTH = 14_000_000;

const restCreateSchema = insertMaintenanceRequestSchema
  .omit({
    submittedBy: true,
    assignedTo: true,
    scheduledDate: true,
  })
  .extend({
    priority: prioritySchema,
    images: z
      .array(
        z
          .string()
          .max(
            MAX_IMAGE_STRING_LENGTH,
            `Each image must not exceed ${MAX_IMAGE_STRING_LENGTH} characters`
          )
      )
      .max(MAX_IMAGE_COUNT, `At most ${MAX_IMAGE_COUNT} images are allowed`)
      .optional(),
  });

export default function register(app: Express): void {
  app.post('/api/maintenance-requests', requireAuth, async (req: any, res: any) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const parsed = restCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: 'Invalid maintenance request',
          errors: parsed.error.flatten(),
        });
      }
      const data = parsed.data;

      const hasAccess = await canUserAccessResidence(user.id, data.residenceId);
      if (!hasAccess) {
        return res.status(403).json({
          message: 'Access denied to this residence',
          code: 'RESIDENCE_ACCESS_DENIED',
        });
      }

      const priority: MaintenancePriority = data.priority ?? 'medium';
      const row = await storage.createMaintenanceRequest({
        residenceId: data.residenceId,
        title: data.title,
        description: data.description,
        category: data.category,
        priority,
        submittedBy: user.id,
        images: data.images && data.images.length > 0 ? data.images : undefined,
      });

      return res.status(201).json(row);
    } catch (err: any) {
      console.error('[POST /api/maintenance-requests] failed', err);
      return res.status(500).json({
        message: 'Failed to create maintenance request',
        code: 'INTERNAL_ERROR',
      });
    }
  });
}
