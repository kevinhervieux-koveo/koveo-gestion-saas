/**
 * Onboarding API (Task #1572).
 *
 * Endpoints:
 *   GET  /api/onboarding/me        — caller's progress for all tours
 *   GET  /api/onboarding/catalog   — tours visible to caller's role
 *   POST /api/onboarding/progress  — upsert step progress
 *   POST /api/onboarding/restart   — reset a specific tour to not_started
 *   GET  /api/onboarding/health    — freshness report (admin-only)
 *
 * Authorization rules:
 *   - Tenants/residents: read+write their own rows only.
 *   - Managers/admins: read their own rows.
 *   - /health: admin/super_admin only.
 *   - Feature-flagged: when ONBOARDING_ENABLED is off, all routes return 404.
 */
import type { Express } from 'express';
import { requireAuth } from '../../auth';
import { db } from '../../db';
import { isOnboardingEnabled } from '../../utils/feature-flags';
import { asyncHandler } from '../../utils/async-handler';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import {
  onboardingProgress,
  onboardingVersions,
  onboardingFeatureManifest,
} from '../../../shared/schemas/onboarding';
import { SMOKE_TOUR_DEF } from './onboarding-content';
import { analyzeOnboardingHealth } from '../../lib/onboarding-health-analyzer';

const updateProgressSchema = z.object({
  tourId: z.string().min(1),
  status: z.enum(['not_started', 'in_progress', 'completed', 'skipped']),
  currentStep: z.number().int().min(0),
  seenVersion: z.number().int().min(0),
});

const restartSchema = z.object({
  tourId: z.string().min(1),
});

function flagGuard(res: any): boolean {
  if (!isOnboardingEnabled()) {
    res.status(404).json({ message: 'Onboarding feature is not enabled.' });
    return false;
  }
  return true;
}

export default function register(app: Express) {
  // GET /api/onboarding/me — caller's progress for all tours.
  // For new users (no rows yet) we synthesize not_started entries for every
  // visible tour so the client can always detect which tours need to run.
  app.get(
    '/api/onboarding/me',
    requireAuth,
    asyncHandler(async (req: any, res) => {
      if (!flagGuard(res)) return;
      const userId = req.user.id;
      const role = req.user.role as string;

      const rows = await db
        .select()
        .from(onboardingProgress)
        .where(eq(onboardingProgress.userId, userId));

      const versions = await db.select().from(onboardingVersions);

      const versionMap: Record<string, number> = {};
      for (const v of versions) {
        versionMap[v.tourId] = v.version;
      }

      const existingByTour: Record<string, typeof rows[0]> = {};
      for (const row of rows) {
        existingByTour[row.tourId] = row;
      }

      // Synthesize not_started entries for tours the user has never seen.
      const visibleTours = SMOKE_TOUR_DEF.filter((tour) => {
        if (!tour.roles || tour.roles.length === 0) return true;
        return tour.roles.includes(role);
      });

      const progress = visibleTours.map((tour) => {
        const row = existingByTour[tour.tourId];
        const latestVersion = versionMap[tour.tourId] ?? 1;
        if (row) {
          return {
            ...row,
            latestVersion,
            hasNewContent: latestVersion > row.seenVersion,
          };
        }
        // New user: synthesize a not_started virtual row
        return {
          id: null,
          userId,
          tourId: tour.tourId,
          status: 'not_started' as const,
          currentStep: 0,
          seenVersion: 0,
          latestVersion,
          hasNewContent: false,
          startedAt: null,
          completedAt: null,
          updatedAt: null,
        };
      });

      res.json({ userId, progress });
    }, { errorMessage: 'Failed to fetch onboarding progress', errorLogPrefix: '[ONBOARDING] me error' }),
  );

  // GET /api/onboarding/catalog — tours visible to the caller's role
  app.get(
    '/api/onboarding/catalog',
    requireAuth,
    asyncHandler(async (req: any, res) => {
      if (!flagGuard(res)) return;
      const userId = req.user.id;
      const role = req.user.role as string;

      const visibleTours = SMOKE_TOUR_DEF.filter((tour) => {
        if (!tour.roles || tour.roles.length === 0) return true;
        return tour.roles.includes(role);
      });

      const progressRows = await db
        .select()
        .from(onboardingProgress)
        .where(eq(onboardingProgress.userId, userId));

      const progressByTour: Record<string, typeof progressRows[0]> = {};
      for (const row of progressRows) {
        progressByTour[row.tourId] = row;
      }

      const versions = await db.select().from(onboardingVersions);
      const versionMap: Record<string, number> = {};
      for (const v of versions) {
        versionMap[v.tourId] = v.version;
      }

      const catalog = visibleTours.map((tour) => {
        const prog = progressByTour[tour.tourId];
        const latestVersion = versionMap[tour.tourId] ?? 1;
        return {
          tourId: tour.tourId,
          title: tour.title,
          description: tour.description,
          roles: tour.roles,
          stepCount: tour.steps.length,
          status: prog?.status ?? 'not_started',
          currentStep: prog?.currentStep ?? 0,
          seenVersion: prog?.seenVersion ?? 0,
          latestVersion,
          completedAt: prog?.completedAt ?? null,
          hasNewContent: latestVersion > (prog?.seenVersion ?? 0),
        };
      });

      res.json({ catalog });
    }, { errorMessage: 'Failed to fetch onboarding catalog', errorLogPrefix: '[ONBOARDING] catalog error' }),
  );

  // POST /api/onboarding/progress — upsert step progress
  app.post(
    '/api/onboarding/progress',
    requireAuth,
    asyncHandler(async (req: any, res) => {
      if (!flagGuard(res)) return;
      const userId = req.user.id;

      const body = updateProgressSchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: 'Invalid request body', errors: body.error.format() });
      }

      const { tourId, status, currentStep, seenVersion } = body.data;

      const existing = await db
        .select()
        .from(onboardingProgress)
        .where(
          and(
            eq(onboardingProgress.userId, userId),
            eq(onboardingProgress.tourId, tourId),
          ),
        )
        .limit(1);

      const now = new Date();
      let result;

      if (existing.length === 0) {
        const inserted = await db
          .insert(onboardingProgress)
          .values({
            userId,
            tourId,
            status,
            currentStep,
            seenVersion,
            startedAt: status === 'in_progress' ? now : undefined,
            completedAt: status === 'completed' ? now : undefined,
            updatedAt: now,
          })
          .returning();
        result = inserted[0];
      } else {
        const updates: Partial<typeof onboardingProgress.$inferSelect> = {
          status,
          currentStep,
          seenVersion,
          updatedAt: now,
        };
        if (status === 'in_progress' && !existing[0].startedAt) {
          updates.startedAt = now;
        }
        if (status === 'completed') {
          updates.completedAt = now;
        }

        const updated = await db
          .update(onboardingProgress)
          .set(updates)
          .where(
            and(
              eq(onboardingProgress.userId, userId),
              eq(onboardingProgress.tourId, tourId),
            ),
          )
          .returning();
        result = updated[0];
      }

      res.json({ progress: result });
    }, { errorMessage: 'Failed to update onboarding progress', errorLogPrefix: '[ONBOARDING] progress error' }),
  );

  // POST /api/onboarding/restart — reset a specific tour to not_started
  app.post(
    '/api/onboarding/restart',
    requireAuth,
    asyncHandler(async (req: any, res) => {
      if (!flagGuard(res)) return;
      const userId = req.user.id;

      const body = restartSchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: 'Invalid request body', errors: body.error.format() });
      }

      const { tourId } = body.data;

      const existing = await db
        .select()
        .from(onboardingProgress)
        .where(
          and(
            eq(onboardingProgress.userId, userId),
            eq(onboardingProgress.tourId, tourId),
          ),
        )
        .limit(1);

      const now = new Date();

      if (existing.length === 0) {
        const inserted = await db
          .insert(onboardingProgress)
          .values({
            userId,
            tourId,
            status: 'not_started',
            currentStep: 0,
            seenVersion: 0,
            updatedAt: now,
          })
          .returning();
        return res.json({ progress: inserted[0], restarted: true });
      }

      const updated = await db
        .update(onboardingProgress)
        .set({
          status: 'not_started',
          currentStep: 0,
          completedAt: null,
          startedAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(onboardingProgress.userId, userId),
            eq(onboardingProgress.tourId, tourId),
          ),
        )
        .returning();

      res.json({ progress: updated[0], restarted: true });
    }, { errorMessage: 'Failed to restart onboarding tour', errorLogPrefix: '[ONBOARDING] restart error' }),
  );

  // GET /api/onboarding/health — freshness report (admin-only).
  // Merges two analysis sources:
  //  1. DB manifest (onboarding_feature_manifest) — admin-maintained feature list.
  //  2. Tour content (SMOKE_TOUR_DEF) — step-level anchor and coverage check.
  // This ensures the runtime report matches what scripts/onboarding-health.ts produces.
  app.get(
    '/api/onboarding/health',
    requireAuth,
    asyncHandler(async (req: any, res) => {
      if (!flagGuard(res)) return;

      const role = req.user.role as string;
      if (role !== 'admin' && role !== 'super_admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const manifestRows = await db.select().from(onboardingFeatureManifest);
      const versionRows = await db.select().from(onboardingVersions);

      // Use the shared analyzer so that this endpoint and
      // scripts/onboarding-health.ts produce identical reports.
      const report = analyzeOnboardingHealth(
        manifestRows.map((row) => ({
          featureId: row.featureId,
          description: row.featureName,
          isRequired: row.isRequired,
          coveredByTour: row.coveredByTour,
          anchorSelector: row.anchorSelector,
        })),
        SMOKE_TOUR_DEF,
        'database (onboarding_feature_manifest)',
        versionRows.map((row) => ({
          tourId: row.tourId,
          version: row.version,
          contentHash: row.contentHash,
        })),
      );

      res.json({
        ...report,
        versions: versionRows,
      });
    }, { errorMessage: 'Failed to fetch onboarding health', errorLogPrefix: '[ONBOARDING] health error' }),
  );
}
