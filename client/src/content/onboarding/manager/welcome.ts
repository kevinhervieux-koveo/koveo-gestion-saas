import type { TourContent } from '../types';
import {
  PRED_HAS_TOPBAR_ROLE_BADGE,
  PRED_HAS_ROLE_SWITCHER,
  PRED_HAS_TOPBAR_USER_MENU,
} from './predicates';

export const WELCOME_TOUR: TourContent = {
  tourId: 'manager.core.welcome',
  roles: ['manager', 'demo_manager'],
  entryPath: '/',
  steps: [
    {
      id: 'welcome.dashboard',
      anchor: '[data-onboarding="dashboard.root"]',
      title: {
        fr: 'Bienvenue, gestionnaire',
        en: 'Welcome, Manager',
      },
      description: {
        fr: 'Ce tableau de bord affiche les demandes en attente, les travaux d\'entretien et les invitations récentes pour les bâtiments que vous gérez.',
        en: 'This dashboard shows pending demands, maintenance, and recent invitations across the buildings you manage.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-1.oauth-signin'],
    },
    {
      id: 'welcome.role-badge',
      anchor: '[data-onboarding="topbar.role-badge"]',
      title: {
        fr: 'Votre rôle',
        en: 'Your role',
      },
      description: {
        fr: 'Votre rôle est <strong>gestionnaire</strong>. Vous pouvez basculer en mode <strong>locataire</strong> pour voir ce qu\'ils voient.',
        en: 'Your role is <strong>manager</strong>. You can downgrade in-session to <strong>tenant</strong> to verify what they see.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-1.role-downgrade'],
      visibleIf: PRED_HAS_TOPBAR_ROLE_BADGE,
    },
    {
      id: 'welcome.downgrade',
      anchor: '[data-onboarding="topbar.role-switcher"]',
      title: {
        fr: 'Essayez la vue locataire',
        en: 'Try a tenant view',
      },
      description: {
        fr: 'Cliquez ici pour agir en tant que locataire. Utile pour déboguer «que voit mon résident ?». Revenez en mode gestionnaire à tout moment.',
        en: 'Click here to act as a tenant. Useful when debugging "what does my resident see?". Switch back any time.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-1.role-downgrade'],
      visibleIf: PRED_HAS_ROLE_SWITCHER,
    },
    {
      id: 'welcome.user-menu',
      anchor: '[data-onboarding="topbar.user-menu"]',
      title: {
        fr: 'Déconnexion et langue',
        en: 'Sign out & language',
      },
      description: {
        fr: 'Ouvrez le menu utilisateur pour vous déconnecter ou changer de langue (français / anglais).',
        en: 'Open the user menu to sign out or change between English and French.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-x-cross.localization', 'fr-1.oauth-signin'],
      visibleIf: PRED_HAS_TOPBAR_USER_MENU,
    },
  ],
};
