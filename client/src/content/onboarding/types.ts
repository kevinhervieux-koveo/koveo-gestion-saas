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
  /**
   * The app route the tour must be started from so its anchors exist in the DOM.
   * When `start()` or `restart()` is called from a different route, the engine
   * navigates here first, then launches the tour after the page renders.
   * Tours without an entryPath keep today's behavior (launch on whatever page is active).
   */
  entryPath?: string;
}
