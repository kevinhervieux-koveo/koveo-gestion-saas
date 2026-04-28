/**
 * Standalone Zod schemas for the onboarding API routes.
 *
 * Extracted to a zero-dependency file so unit tests (Task #1642) can import
 * these schemas directly without pulling in the DB client, auth middleware,
 * or any other heavy server dependencies.
 */
import { z } from 'zod';

/** Schema for POST /api/onboarding/progress */
export const updateProgressSchema = z.object({
  tourId: z.string().min(1),
  status: z.enum(['not_started', 'in_progress', 'completed', 'skipped']),
  currentStep: z.number().int().min(0),
  seenVersion: z.number().int().min(0),
});

/** Schema for POST /api/onboarding/restart */
export const restartSchema = z.object({
  tourId: z.string().min(1),
});
