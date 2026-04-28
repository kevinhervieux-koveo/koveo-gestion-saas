import type { TourContent } from '../types';
import {
  PRED_HAS_COMMUNICATIONS_NEW_BTN,
  PRED_HAS_MEETINGS_NAV,
  PRED_HAS_COMMON_SPACES,
} from './predicates';

export const COMMUNICATIONS_TOUR: TourContent = {
  tourId: 'manager.core.communications',
  roles: ['manager', 'demo_manager'],
  steps: [
    {
      id: 'comm.list',
      anchor: '[data-onboarding="nav.communications"]',
      title: {
        fr: 'Communications',
        en: 'Communications',
      },
      description: {
        fr: 'Annonces à l\'échelle de l\'organisation. Les locataires et résidents peuvent les consulter.',
        en: 'Org-wide announcements. Tenants and residents see them.',
      },
      placement: 'right',
      allowSkip: true,
      covers: ['fr-12.list-communications'],
    },
    {
      id: 'comm.create',
      anchor: '[data-onboarding="communications.new-btn"]',
      title: {
        fr: 'Publier une annonce',
        en: 'Post an announcement',
      },
      description: {
        fr: 'Le titre et le contenu sont obligatoires (au moins 1 caractère chacun). L\'attribution de l\'auteur est automatique.',
        en: 'Title and content are required (each ≥ 1 char). Author attribution is automatic.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-12.create-communication'],
      visibleIf: PRED_HAS_COMMUNICATIONS_NEW_BTN,
    },
    {
      id: 'comm.meetings',
      anchor: '[data-onboarding="nav.meetings"]',
      title: {
        fr: 'Réunions',
        en: 'Meetings',
      },
      description: {
        fr: 'Planifiez et listez les réunions. La durée doit être > 0 ; la date doit être dans le futur.',
        en: 'Schedule and list meetings. Duration must be > 0; date must be in the future.',
      },
      placement: 'right',
      allowSkip: true,
      covers: ['fr-13.list-meetings', 'fr-13.create-meeting'],
      visibleIf: PRED_HAS_MEETINGS_NAV,
    },
    {
      id: 'comm.spaces',
      anchor: '[data-onboarding="building.common-spaces-tab"]',
      title: {
        fr: 'Espaces communs',
        en: 'Common spaces',
      },
      description: {
        fr: 'Piscine, salle de sport, suite invités — listez et créez les espaces que vous gérez. (Les sous-outils de réservation sont accessibles dans cette version.)',
        en: 'Pool, gym, guest suite — list and create the spaces you manage. (Booking sub-tools are reachable in this build.)',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-14.list-common-spaces', 'fr-14.create-common-space'],
      visibleIf: PRED_HAS_COMMON_SPACES,
    },
  ],
};
