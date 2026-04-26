/**
 * `/api/health` handler factory.
 *
 * Extracted from `server/index.ts` so the response shape can be pinned
 * by an integration test (Task #1095) without having to boot the full
 * server. The handler is constructed at request time so the dynamic
 * imports it does (`./db`, `./bulk-import`) stay lazy — both are
 * imported on first probe so the health endpoint never adds startup
 * cost to a freshly booted process.
 *
 * Each "extra" field is independently best-effort:
 *   - `crossOrgDemands` — drift counter from the cross-org migration
 *     guard (0010/0015). Omitted on DB error so the endpoint stays up
 *     during early boot or a transient DB outage.
 *   - `bulkImportStaging` — `getStagingDiskUsage()` snapshot exposed
 *     for ops dashboards (Task #1095). Omitted on `statfs` failure for
 *     the same reason.
 *
 * The handler always responds with HTTP 200 and `status: 'healthy'`
 * because the upstream `healthCheckErrorHandler` in `server/index.ts`
 * also forces 200 — health checks must never report a 5xx that would
 * cause a deployment platform to bounce the pod.
 */
import type { Request, Response } from 'express';

export interface ApiHealthOptions {
  port: number;
  host: string;
}

export function createApiHealthHandler(opts: ApiHealthOptions) {
  return async function apiHealthHandler(_req: Request, res: Response) {
    // Drift healthcheck: count demand rows whose residence belongs to a
    // different building (cross-org leak). Should always be 0 after
    // migration 0015 runs on boot. Non-zero means a new row slipped past
    // the trigger guard and warrants investigation.
    let crossOrgDemands: number | null = null;
    try {
      const { db } = await import('../db');
      const { sql } = await import('drizzle-orm');
      const result = await db.execute(sql`
        SELECT count(*)::int AS cross_org_demands
        FROM demands d
        JOIN residences r ON r.id = d.residence_id
        WHERE r.building_id <> d.building_id
      `);
      crossOrgDemands = (result.rows[0] as { cross_org_demands: number })
        .cross_org_demands;
    } catch {
      // DB not yet reachable during early boot — omit the field rather
      // than failing the health check entirely.
    }

    // Task #1095: surface the same `StagingDiskUsage` snapshot Task
    // #1088 already logs from the janitor. An admin who suspects an
    // upload is slow because the disk is filling up can now
    // `curl /api/health` (or look at the admin "system status" surface
    // that consumes it) instead of having to ssh in and grep logs.
    //
    // The probe is a non-blocking `statfs` and is wrapped in a
    // try/catch so a transient I/O failure on the staging volume can
    // never take the health endpoint itself down — the field is simply
    // omitted in that case, mirroring how `crossOrgDemands` degrades.
    let bulkImportStaging:
      | {
          root: string;
          freeBytes: number;
          totalBytes: number;
          freePercent: number;
          isLow: boolean;
        }
      | null = null;
    try {
      const { getStagingDiskUsage } = await import('./bulk-import');
      const usage = await getStagingDiskUsage();
      if (usage) {
        bulkImportStaging = {
          root: usage.root,
          freeBytes: usage.freeBytes,
          totalBytes: usage.totalBytes,
          // Round to one decimal so the JSON is human-friendly without
          // losing useful precision (e.g. 12.7 % rather than 12.71834…).
          freePercent: Math.round(usage.freeRatio * 1000) / 10,
          isLow: usage.isLow,
        };
      }
    } catch {
      // Non-fatal — health endpoint continues without the field.
    }

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      port: opts.port,
      host: opts.host,
      ...(crossOrgDemands !== null ? { crossOrgDemands } : {}),
      ...(bulkImportStaging !== null ? { bulkImportStaging } : {}),
    });
  };
}
