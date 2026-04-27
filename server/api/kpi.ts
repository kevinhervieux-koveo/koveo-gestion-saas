/**
 * Admin KPI dashboard API.
 *
 * Surfaces aggregations over the generic `kpi_events` table so internal
 * Koveo staff (super-admins) can see how product/AI features are
 * actually used.
 *
 * Currently exposes the bulk-import AI-suggestion accept-rate metrics
 * (filename — Task #1406; branch destination, residence pick,
 * effective date, tag suggestion — Task #1411). Every endpoint shares
 * the same row shape (per-(language, branch) breakdown) so the
 * dashboard can render them with one component.
 *
 * Gated behind {@link requireSuperAdmin} (Task #1412): the dashboard
 * exposes cross-organization telemetry and is intended for internal
 * diagnostics only — customer admins must not see it.
 */
import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import {
  BULK_IMPORT_BRANCH_METRIC_KEY,
  BULK_IMPORT_EFFECTIVE_DATE_METRIC_KEY,
  BULK_IMPORT_FILENAME_METRIC_KEY,
  BULK_IMPORT_RESIDENCE_METRIC_KEY,
  BULK_IMPORT_TAG_METRIC_KEY,
  type BulkImportAiMetricKey,
} from '@shared/schema';
import { requireAuth, requireSuperAdmin } from '../auth';
import {
  aggregateBulkImportAiMetric,
  type AiAcceptAggregateRow,
} from '../services/kpi';
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

/**
 * Wire one KPI endpoint backed by a single metric key. Every metric
 * we expose right now uses the shared aggregator + row shape, so the
 * route bodies are identical except for the key and the error
 * message.
 */
function registerAiMetricRoute(
  app: Express,
  options: {
    path: string;
    metricKey: BulkImportAiMetricKey;
    errorLabel: string;
  },
): void {
  app.get(
    options.path,
    requireAuth,
    requireSuperAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = querySchema.parse(req.query);
        const { sinceDays, from, to, organizationId } = parsed;
        const rows: AiAcceptAggregateRow[] = await aggregateBulkImportAiMetric(
          options.metricKey,
          { sinceDays, from, to, organizationId },
        );
        return res.json({
          metricKey: options.metricKey,
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
          `[kpi] failed to aggregate ${options.errorLabel}`,
          err as Error,
        );
        return res
          .status(500)
          .json({ error: 'Failed to aggregate KPI events' });
      }
    },
  );
}

export function registerKpiRoutes(app: Express): void {
  registerAiMetricRoute(app, {
    path: '/api/admin/kpi/bulk-import-filename-suggestions',
    metricKey: BULK_IMPORT_FILENAME_METRIC_KEY,
    errorLabel: 'bulk-import filename suggestions',
  });
  registerAiMetricRoute(app, {
    path: '/api/admin/kpi/bulk-import-branch-destinations',
    metricKey: BULK_IMPORT_BRANCH_METRIC_KEY,
    errorLabel: 'bulk-import branch destinations',
  });
  registerAiMetricRoute(app, {
    path: '/api/admin/kpi/bulk-import-residence-picks',
    metricKey: BULK_IMPORT_RESIDENCE_METRIC_KEY,
    errorLabel: 'bulk-import residence picks',
  });
  registerAiMetricRoute(app, {
    path: '/api/admin/kpi/bulk-import-effective-dates',
    metricKey: BULK_IMPORT_EFFECTIVE_DATE_METRIC_KEY,
    errorLabel: 'bulk-import effective dates',
  });
  registerAiMetricRoute(app, {
    path: '/api/admin/kpi/bulk-import-tag-suggestions',
    metricKey: BULK_IMPORT_TAG_METRIC_KEY,
    errorLabel: 'bulk-import tag suggestions',
  });
}
