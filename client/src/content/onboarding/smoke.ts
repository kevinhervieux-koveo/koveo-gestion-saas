/**
 * Smoke tour content (Task #1572).
 *
 * A single-step tour that orients new users to the dashboard header and
 * points them at the Settings → Help & Onboarding sub-page for future
 * reference. This is the base tour that proves the engine works; per-role
 * tour catalogs (admin, manager, tenant, resident) follow in separate modules.
 *
 * Anchor convention: every selector must start with [data-onboarding="<stable-id>"].
 * See CONTRIBUTING.md for the full convention.
 */

import { MANAGER_TOURS } from './manager';

export type { OnboardingStep, TourContent } from './types';

export const SMOKE_TOUR = {
  tourId: 'onboarding.smoke',
  roles: [] as string[],
  steps: [
    {
      id: 'dashboard.header',
      anchor: '[data-onboarding="dashboard.header"]',
      title: {
        fr: 'Bienvenue dans Koveo Gestion',
        en: 'Welcome to Koveo Gestion',
      },
      description: {
        fr: 'Voici votre tableau de bord principal. Il vous donne un aperçu de votre portefeuille immobilier, vos finances et vos demandes en cours.',
        en: 'This is your main dashboard. It gives you an overview of your real estate portfolio, finances, and pending requests.',
      },
      placement: 'bottom' as const,
      allowSkip: true,
      covers: ['dashboard.overview'],
    },
    {
      id: 'settings.onboarding',
      anchor: '[data-onboarding="settings.onboarding.link"]',
      title: {
        fr: 'Paramètres — Aide & Démarrage',
        en: 'Settings — Help & Onboarding',
      },
      description: {
        fr: 'Vous pouvez relancer cette visite guidée à tout moment depuis Paramètres → Aide & Démarrage. Vous y trouverez aussi les nouveautés de la plateforme.',
        en: 'You can restart this guided tour at any time from Settings → Help & Onboarding. You will also find platform updates there.',
      },
      placement: 'right' as const,
      allowSkip: true,
      covers: ['settings.help'],
    },
  ],
};

export const ALL_TOURS = [SMOKE_TOUR, ...MANAGER_TOURS];
