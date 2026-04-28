/**
 * Smoke tour content (Task #1572).
 *
 * A single-step tour that orients new users to the dashboard header and
 * points them at the Settings → Help & Onboarding sub-page for future
 * reference. This is the base tour that proves the engine works; per-role
 * tour catalogs (admin, manager, tenant, resident) are deferred to follow-up tasks.
 *
 * Anchor convention: every selector must start with [data-onboarding="<stable-id>"].
 * See CONTRIBUTING.md for the full convention.
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

export const SMOKE_TOUR: TourContent = {
  tourId: 'onboarding.smoke',
  roles: [],
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
      placement: 'bottom',
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
      placement: 'right',
      allowSkip: true,
      covers: ['settings.help'],
    },
  ],
};

export const ALL_TOURS: TourContent[] = [SMOKE_TOUR];
