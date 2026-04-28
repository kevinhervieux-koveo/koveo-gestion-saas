/**
 * Onboarding tour catalog (server-side adapter).
 *
 * The single source of truth for tour content (anchors, copy, covers, steps)
 * lives in `client/src/content/onboarding/*`. This file re-exports a thin
 * server-shaped view of the same content so that:
 *
 *  - The /api/onboarding/health endpoint reports against the same anchors and
 *    covers[] arrays the frontend actually uses.
 *  - The freshness script (scripts/onboarding-health.ts) reports identically.
 *  - Adding a new tour file under client/src/content/onboarding/ requires no
 *    server-side duplication; just add it to ALL_TOURS in that module.
 *
 * Per-role tours (admin, manager, tenant, resident) are deferred to follow-up
 * tasks; only the smoke tour exists today.
 */

import { ALL_TOURS as CLIENT_TOURS } from '../../../client/src/content/onboarding/smoke';

export interface TourDefinition {
  tourId: string;
  title: { fr: string; en: string };
  description: { fr: string; en: string };
  roles: string[];
  steps: { id: string; anchor?: string; covers?: string[] }[];
}

const TOUR_TITLES: Record<string, { fr: string; en: string }> = {
  'onboarding.smoke': {
    fr: 'Bienvenue dans Koveo Gestion',
    en: 'Welcome to Koveo Gestion',
  },
};

const TOUR_DESCRIPTIONS: Record<string, { fr: string; en: string }> = {
  'onboarding.smoke': {
    fr: 'Découvrez les fonctionnalités principales de la plateforme en quelques étapes.',
    en: 'Discover the main features of the platform in a few steps.',
  },
};

export const SMOKE_TOUR_DEF: TourDefinition[] = CLIENT_TOURS.map((tour) => ({
  tourId: tour.tourId,
  title: TOUR_TITLES[tour.tourId] ?? { fr: tour.tourId, en: tour.tourId },
  description: TOUR_DESCRIPTIONS[tour.tourId] ?? { fr: '', en: '' },
  roles: tour.roles,
  steps: tour.steps.map((step) => ({
    id: step.id,
    anchor: step.anchor,
    covers: step.covers,
  })),
}));
