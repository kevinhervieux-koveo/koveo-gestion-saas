/**
 * Task #1642 — Regression: POST /api/onboarding/progress payload validation.
 *
 * Before the fix, the engine sent `currentStep: -1` because indexOf() returns
 * -1 when driver.js doesn't preserve the step object reference. The server's
 * Zod schema (`z.number().int().min(0)`) correctly rejects -1 with a 400.
 *
 * This test imports the REAL `updateProgressSchema` that is exported from
 * server/api/auto/onboarding.ts (exported specifically for this test, Task #1642).
 * That way, any future change to the server-side schema is automatically caught
 * here — no local copy to drift out of sync.
 *
 * We test the Zod schema directly (no HTTP stack, no DB) to keep the test fast
 * and independent of infrastructure mocks.
 */
import { describe, it, expect } from '@jest/globals';

// Import the real schema from a dependency-free file (no DB, auth, or content
// imports).  Extracted to server/api/auto/onboarding-schemas.ts (Task #1642)
// so tests can validate the REAL schema without mocking the full server stack.
import { updateProgressSchema } from '../../../server/api/auto/onboarding-schemas';

// All tour IDs currently shipped in the content layer (derived from smoke.ts).
// Keeping a static list here keeps the test lean and explicit about which IDs
// the server is expected to accept.
const ALL_TOUR_IDS = [
  'onboarding.smoke',
  'manager.core.welcome',
  'manager.core.buildings',
  'manager.core.invitations',
  'manager.core.financials',
  'manager.core.requests',
  'manager.core.communications',
  'manager.core.settings',
];

describe('POST /api/onboarding/progress — real server-side updateProgressSchema', () => {
  describe('accepts valid engine payloads for every shipped tour id', () => {
    it.each(ALL_TOUR_IDS)('%s — in_progress step 0', (tourId) => {
      const result = updateProgressSchema.safeParse({
        tourId,
        status: 'in_progress',
        currentStep: 0,
        seenVersion: 1,
      });
      expect(result.success).toBe(true);
    });

    it.each(ALL_TOUR_IDS)('%s — completed', (tourId) => {
      const result = updateProgressSchema.safeParse({
        tourId,
        status: 'completed',
        currentStep: 0,
        seenVersion: 1,
      });
      expect(result.success).toBe(true);
    });

    it.each(ALL_TOUR_IDS)('%s — skipped', (tourId) => {
      const result = updateProgressSchema.safeParse({
        tourId,
        status: 'skipped',
        currentStep: 0,
        seenVersion: 0,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('rejects payloads that caused the original 400 errors', () => {
    it('rejects currentStep: -1 (the indexOf sentinel)', () => {
      const result = updateProgressSchema.safeParse({
        tourId: 'onboarding.smoke',
        status: 'in_progress',
        currentStep: -1,
        seenVersion: 1,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.code).toBe('too_small');
      expect(result.error?.issues[0]?.path).toEqual(['currentStep']);
    });

    it('rejects any negative currentStep', () => {
      for (const step of [-1, -2, -10]) {
        const result = updateProgressSchema.safeParse({
          tourId: 'manager.core.welcome',
          status: 'in_progress',
          currentStep: step,
          seenVersion: 1,
        });
        expect(result.success).toBe(false);
      }
    });

    it('rejects an empty tourId', () => {
      const result = updateProgressSchema.safeParse({
        tourId: '',
        status: 'in_progress',
        currentStep: 0,
        seenVersion: 1,
      });
      expect(result.success).toBe(false);
    });

    it('rejects an invalid status value', () => {
      const result = updateProgressSchema.safeParse({
        tourId: 'onboarding.smoke',
        status: 'running',
        currentStep: 0,
        seenVersion: 1,
      });
      expect(result.success).toBe(false);
    });
  });
});
