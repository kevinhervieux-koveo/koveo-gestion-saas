/**
 * Admin KPI dashboard API.
 *
 * Surfaces aggregations over the generic `kpi_events` table so admins
 * (and Looker-style queries) can see how product/AI features are
 * actually used. Currently exposes the bulk-import filename
 * suggestion accept rate (Task #1406).
 */
import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth';
import { aggregateBulkImportFilenameSuggestions } from '../services/kpi';
import { logError } from '../utils/logger';

type AuthenticatedRequest = Request & { user?: { id: string; role: string } };

const querySchema = z.object({
  sinceDays: z.coerce.number().int().min(1).max(365).optional(),
});

export function registerKpiRoutes(app: Express): void {
  app.get(
    '/api/admin/kpi/bulk-import-filename-suggestions',
    requireAuth,
    requireRole(['admin']),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { sinceDays } = querySchema.parse(req.query);
        const rows = await aggregateBulkImportFilenameSuggestions({
          sinceDays,
        });
        return res.json({
          metricKey: 'bulk_import.filename_suggestion',
          sinceDays: sinceDays ?? 90,
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
