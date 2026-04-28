/**
 * Idempotent onboarding tour versions seeder.
 *
 * Walks the code-defined tour list (SMOKE_TOUR_DEF, which includes the smoke
 * tour and all manager tours) and upserts rows into `onboarding_versions`:
 *
 *   - Inserts a new row if the `tour_id` is missing. Uses ON CONFLICT DO NOTHING
 *     so concurrent multi-instance starts are safe.
 *   - If the row exists but its stored `content_hash` differs from the freshly
 *     computed one (including when the stored hash is NULL from old SQL migrations),
 *     bumps `version` by 1 and updates `content_hash` + `description`.
 *   - Otherwise leaves the row untouched.
 *
 * Safe to run on every server start (idempotent). Gated on
 * `isOnboardingEnabled()` so environments with the feature off don't write
 * rows. Failures are logged but never crash the server.
 *
 * Description is derived directly from the tour's own `description.en` field so
 * there is a single source of truth — no separate mapping needed.
 *
 * This replaces the hand-written SQL migration approach: whenever a developer
 * adds a new tour to the content files, it automatically registers on next
 * deploy — no SQL migration required.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { onboardingVersions } from '../../shared/schemas/onboarding';
import { SMOKE_TOUR_DEF } from './auto/onboarding-content';
import { computeTourContentHash } from '../lib/onboarding-health-analyzer';
import { isOnboardingEnabled } from '../utils/feature-flags';
import { logInfo, logError } from '../utils/logger';

/**
 * Seed / sync `onboarding_versions` from the code-defined tour catalog.
 *
 * Logs a one-line summary:
 *   [ONBOARDING SEED] registered 2 new tours, bumped 1 to version 2, 5 unchanged
 */
export async function seedOnboardingVersions(): Promise<void> {
  if (!isOnboardingEnabled()) return;

  try {
    const existingRows = await db.select().from(onboardingVersions);
    const byTourId = new Map(existingRows.map((r) => [r.tourId, r]));

    let added = 0;
    let bumped = 0;
    let unchanged = 0;

    for (const tour of SMOKE_TOUR_DEF) {
      const currentHash = computeTourContentHash(tour);
      const existing = byTourId.get(tour.tourId);
      // Description sourced from the tour content itself — single source of truth.
      const description = tour.description.en;

      if (!existing) {
        // Use onConflictDoNothing so concurrent multi-instance startup races
        // are safe: if another instance already inserted the row, we skip cleanly.
        // .returning() lets us know whether a row was actually written or silently
        // skipped, so the summary log reflects only genuine inserts.
        const inserted = await db
          .insert(onboardingVersions)
          .values({
            tourId: tour.tourId,
            version: 1,
            contentHash: currentHash,
            description,
            publishedAt: new Date(),
          })
          .onConflictDoNothing()
          .returning({ tourId: onboardingVersions.tourId });
        if (inserted.length > 0) {
          added++;
        }
      } else if (existing.contentHash !== currentHash) {
        // Hash differs OR was NULL (old SQL migrations didn't include content_hash).
        // Both cases are treated as a mismatch: bump version so users see the
        // "new content" indicator and re-experience the tour.
        await db
          .update(onboardingVersions)
          .set({
            version: existing.version + 1,
            contentHash: currentHash,
            description,
            publishedAt: new Date(),
          })
          .where(eq(onboardingVersions.tourId, tour.tourId));
        bumped++;
      } else {
        unchanged++;
      }
    }

    logInfo(
      `[ONBOARDING SEED] registered ${added} new tours, bumped ${bumped} to new version, ${unchanged} unchanged`,
    );
  } catch (error) {
    logError('[ONBOARDING SEED] Failed to seed onboarding versions', error as Error);
  }
}
