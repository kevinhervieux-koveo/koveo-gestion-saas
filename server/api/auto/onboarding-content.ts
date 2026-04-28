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
 * Includes the smoke tour and the manager catalog (Task #1590).
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
  'manager.core.welcome': {
    fr: 'Bienvenue, gestionnaire',
    en: 'Welcome, Manager',
  },
  'manager.core.buildings': {
    fr: 'Bâtiments et résidences',
    en: 'Manage buildings & residences',
  },
  'manager.core.invitations': {
    fr: 'Inviter des personnes',
    en: 'Invite people',
  },
  'manager.core.financials': {
    fr: 'Factures',
    en: 'Bills',
  },
  'manager.core.requests': {
    fr: 'Demandes et entretien',
    en: 'Demands & maintenance',
  },
  'manager.core.communications': {
    fr: 'Communications, réunions et espaces',
    en: 'Communications, meetings & spaces',
  },
  'manager.core.settings': {
    fr: 'Relancer une visite',
    en: 'Restart any tour later',
  },
};

const TOUR_DESCRIPTIONS: Record<string, { fr: string; en: string }> = {
  'onboarding.smoke': {
    fr: 'Découvrez les fonctionnalités principales de la plateforme en quelques étapes.',
    en: 'Discover the main features of the platform in a few steps.',
  },
  'manager.core.welcome': {
    fr: 'Tableau de bord, rôle gestionnaire, vue locataire et menu utilisateur.',
    en: 'Dashboard overview, manager role, tenant view, and user menu.',
  },
  'manager.core.buildings': {
    fr: 'Gérez vos bâtiments, résidences et les liens avec vos locataires.',
    en: 'Manage your buildings, residences, and tenant links.',
  },
  'manager.core.invitations': {
    fr: 'Invitez des gestionnaires, locataires et résidents ; gérez les invitations en attente.',
    en: 'Invite managers, tenants, and residents; manage pending invitations.',
  },
  'manager.core.financials': {
    fr: 'Créez et gérez les factures de vos bâtiments.',
    en: 'Create and manage bills for your buildings.',
  },
  'manager.core.requests': {
    fr: 'Traitez les demandes et les ordres d\'entretien de vos résidents.',
    en: 'Handle resident demands and maintenance work orders.',
  },
  'manager.core.communications': {
    fr: 'Publiez des annonces, planifiez des réunions et gérez les espaces communs.',
    en: 'Post announcements, schedule meetings, and manage common spaces.',
  },
  'manager.core.settings': {
    fr: 'Accédez aux paramètres et relancez vos visites guidées à tout moment.',
    en: 'Access settings and restart guided tours at any time.',
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
