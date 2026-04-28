import type { TourContent } from '../types';
import {
  PRED_HAS_TOPBAR_SETTINGS_LINK,
  PRED_HAS_SETTINGS_RESTART_ALL,
} from './predicates';

export const SETTINGS_TOUR: TourContent = {
  tourId: 'manager.core.settings',
  roles: ['manager', 'demo_manager'],
  entryPath: '/settings',
  steps: [
    {
      id: 'settings.entry',
      anchor: '[data-onboarding="topbar.settings-link"]',
      title: {
        fr: 'Paramètres',
        en: 'Settings',
      },
      description: {
        fr: 'Le profil, la langue, les notifications et l\'accompagnement se trouvent ici.',
        en: 'Profile, language, notifications, and onboarding live here.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-x-cross.settings'],
      visibleIf: PRED_HAS_TOPBAR_SETTINGS_LINK,
      entryPath: '/settings',
    },
    {
      id: 'settings.restart',
      anchor: '[data-onboarding="settings.onboarding.restart-all"]',
      title: {
        fr: 'Relancer une visite ultérieurement',
        en: 'Restart any tour later',
      },
      description: {
        fr: 'Relancez n\'importe quelle visite guidée depuis ce panneau. La section <strong>Nouveautés</strong> signale les visites mises à jour lorsque les fonctionnalités du produit changent.',
        en: 'Re-run any tour from this panel. The <strong>What\'s new</strong> section flags updated tours when product features change.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-x-onboarding.restart'],
      visibleIf: PRED_HAS_SETTINGS_RESTART_ALL,
      entryPath: '/settings/onboarding',
    },
  ],
};
