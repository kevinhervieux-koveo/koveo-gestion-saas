import type { TourContent } from '../types';
import {
  PRED_HAS_NAV_MAINTENANCE,
  PRED_HAS_MAINTENANCE_ACKNOWLEDGE,
  PRED_HAS_DEMANDS_CREATE_BTN,
  PRED_HAS_DEMANDS_RESIDENCE_INPUT,
} from './predicates';

export const REQUESTS_TOUR: TourContent = {
  tourId: 'manager.core.requests',
  roles: ['manager', 'demo_manager'],
  steps: [
    {
      id: 'req.demands-list',
      anchor: '[data-onboarding="nav.demands"]',
      title: {
        fr: 'Demandes',
        en: 'Demands',
      },
      description: {
        fr: 'Demandes des résidents pour de l\'information, des services ou d\'autres besoins non liés à l\'entretien. Portée organisationnelle.',
        en: 'Resident requests for information, services, or other non-maintenance asks. Org-scoped.',
      },
      placement: 'right',
      allowSkip: true,
      covers: ['fr-10.list-demands'],
    },
    {
      id: 'req.maintenance-list',
      anchor: '[data-onboarding="nav.maintenance"]',
      title: {
        fr: 'Demandes d\'entretien',
        en: 'Maintenance requests',
      },
      description: {
        fr: 'Ordres de travail déposés par les locataires. Portée organisationnelle.',
        en: 'Tenant-filed work orders. Org-scoped.',
      },
      placement: 'right',
      allowSkip: true,
      covers: ['fr-11.list-maintenance-requests'],
      visibleIf: PRED_HAS_NAV_MAINTENANCE,
    },
    {
      id: 'req.auto-assign',
      anchor: '[data-onboarding="maintenance.row-acknowledge-btn"]',
      title: {
        fr: 'Acquitter assigne la demande à vous',
        en: 'Acknowledging assigns it to you',
      },
      description: {
        fr: 'Lorsque vous faites passer une demande de <strong>soumise → acquittée</strong> pour la première fois, vous êtes automatiquement assigné. Réassignez manuellement si nécessaire.',
        en: 'When you move a request from <strong>submitted → acknowledged</strong> the first time, you are auto-assigned. Reassign manually if needed.',
      },
      placement: 'left',
      allowSkip: true,
      covers: ['fr-11.update-maintenance-request'],
      visibleIf: PRED_HAS_MAINTENANCE_ACKNOWLEDGE,
    },
    {
      id: 'req.building-only',
      anchor: '[data-onboarding="demands.create-btn"]',
      title: {
        fr: 'Demandes au niveau du bâtiment',
        en: 'Building-level demands',
      },
      description: {
        fr: 'Les locataires non liés à une résidence peuvent tout de même déposer des demandes au niveau du bâtiment (intentionnel — utile pour les demandes d\'information générales).',
        en: 'Tenants who aren\'t linked to a residence may still file building-scoped demands (intentional — useful for general info requests).',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-10.create-demand-building-only'],
      visibleIf: PRED_HAS_DEMANDS_CREATE_BTN,
    },
    {
      id: 'req.residence-rules',
      anchor: '[data-onboarding="demands.residence-input"]',
      title: {
        fr: 'Les demandes liées à une résidence nécessitent un lien',
        en: 'Residence-scoped demands need a link',
      },
      description: {
        fr: 'Un locataire ne peut déposer une demande liée à une résidence que s\'il y est associé. La plateforme rejette les incohérences.',
        en: 'A tenant may only file a residence-scoped demand if they are linked to that residence. The platform rejects mismatches.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-10.create-demand-residence-scoped'],
      visibleIf: PRED_HAS_DEMANDS_RESIDENCE_INPUT,
    },
  ],
};
