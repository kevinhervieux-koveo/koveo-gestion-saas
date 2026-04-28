/**
 * Shared type definitions for the onboarding tour engine.
 *
 * Extracted into a standalone module to avoid circular dependencies between
 * smoke.ts (which re-exports ALL_TOURS) and per-role tour files (which import TourContent).
 */

export interface OnboardingStep {
  id: string;
  anchor: string;
  title: { fr: string; en: string };
  description: { fr: string; en: string };
  placement?: 'top' | 'bottom' | 'left' | 'right';
  allowSkip?: boolean;
  covers?: string[];
  visibleIf?: () => boolean;
  waitFor?: string;
}

export interface TourContent {
  tourId: string;
  roles: string[];
  steps: OnboardingStep[];
}
