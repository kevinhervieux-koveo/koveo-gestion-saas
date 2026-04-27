/**
 * Admin KPI dashboard API.
 *
 * Surfaces aggregations over the generic `kpi_events` table so internal
 * Koveo staff (super-admins) can see how product/AI features are
 * actually used. Currently exposes the bulk-import filename
 * suggestion accept rate (Task #1406).
 *
 * Gated behind {@link requireSuperAdmin} (Task #1412): the dashboard
 * exposes cross-organization telemetry and is intended for internal
 * diagnostics only — customer admins must not see it.
 */
import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireSuperAdmin } from '../auth';
import { aggregateBulkImportFilenameSuggestions } from '../services/kpi';
import { logError } from '../utils/logger';

type AuthenticatedRequest = Request & { user?: { id: string; role: string } };

const isoDateSchema = z
  .string()
  .datetime({ offset: true })
  .transform((v) => new Date(v));

const querySchema = z
  .object({
    sinceDays: z.coerce.number().int().min(1).max(365).optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    organizationId: z.string().uuid().optional(),
  })
  .refine((v) => !(v.from && v.to) || v.from <= v.to, {
    message: '`from` must be on or before `to`',
    path: ['from'],
  });

export function registerKpiRoutes(app: Express): void {
  app.get(
    '/api/admin/kpi/bulk-import-filename-suggestions',
    requireAuth,
    requireSuperAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = querySchema.parse(req.query);
        const { sinceDays, from, to, organizationId } = parsed;
        const rows = await aggregateBulkImportFilenameSuggestions({
          sinceDays,
          from,
          to,
          organizationId,
        });
        return res.json({
          metricKey: 'bulk_import.filename_suggestion',
          sinceDays: from || to ? null : sinceDays ?? 90,
          from: from ? from.toISOString() : null,
          to: to ? to.toISOString() : null,
          organizationId: organizationId ?? null,
          rows,
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ error: err.errors });
        }
        logError(
          '[kpi] failed to aggregate bulk-import filename suggestions',
          err as Error,
        );
        return res
          .status(500)
          .json({ error: 'Failed to aggregate KPI events' });
      }
    },
  );
}
