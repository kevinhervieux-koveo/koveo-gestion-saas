import type { TourContent } from '../types';
import {
  PRED_HAS_INVITATIONS_NEW_BTN,
  PRED_HAS_INVITATIONS_RESIDENCE_INPUT,
  PRED_HAS_INVITATIONS_EMAIL_INPUT,
  PRED_HAS_INVITATIONS_LIST,
  PRED_HAS_INVITATIONS_ROW_ACTIONS,
  PRED_HAS_INVITATION_HISTORY,
} from './predicates';

export const INVITATIONS_TOUR: TourContent = {
  tourId: 'manager.core.invitations',
  roles: ['manager', 'demo_manager'],
  steps: [
    {
      id: 'inv.new',
      anchor: '[data-onboarding="invitations.new-btn"]',
      title: {
        fr: 'Inviter une personne',
        en: 'Invite a person',
      },
      description: {
        fr: 'Vous pouvez inviter un <strong>gestionnaire</strong>, un <strong>locataire</strong> ou un <strong>résident</strong>. Les invitations admin sont réservées aux administrateurs.',
        en: 'You can invite <strong>manager</strong>, <strong>tenant</strong>, or <strong>resident</strong>. Admin invites are reserved for admins.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-6.invite-user'],
      visibleIf: PRED_HAS_INVITATIONS_NEW_BTN,
    },
    {
      id: 'inv.with-residence',
      anchor: '[data-onboarding="invitations.residence-input"]',
      title: {
        fr: 'Pré-associer une résidence',
        en: 'Pre-link a residence',
      },
      description: {
        fr: 'Optionnel : associez une résidence à l\'invitation pour que l\'utilisateur y soit automatiquement lié lorsqu\'il accepte.',
        en: 'Optional: attach a residence to the invitation so the user is auto-linked when they accept.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-6.invite-with-residence-prelinked'],
      visibleIf: PRED_HAS_INVITATIONS_RESIDENCE_INPUT,
    },
    {
      id: 'inv.duplicate-rule',
      anchor: '[data-onboarding="invitations.email-input"]',
      title: {
        fr: 'Une seule invitation en attente par courriel',
        en: 'One pending invite per email',
      },
      description: {
        fr: 'Un doublon retourne <code>INVITATION_ALREADY_PENDING</code>. Renvoyer ou annuler l\'invitation originale plutôt que d\'en créer une nouvelle.',
        en: 'A duplicate returns <code>INVITATION_ALREADY_PENDING</code>. Resend or cancel the original instead of inviting again.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-6.duplicate-invite-guard'],
      visibleIf: PRED_HAS_INVITATIONS_EMAIL_INPUT,
    },
    {
      id: 'inv.list',
      anchor: '[data-onboarding="invitations.list"]',
      title: {
        fr: 'Invitations en attente',
        en: 'Pending invitations',
      },
      description: {
        fr: 'Vous voyez les invitations <strong>que vous avez envoyées</strong> (pas celles de vos collègues). Filtrez par organisation ou par courriel.',
        en: 'You see invitations <strong>you sent</strong> (not your peers\'). Filter by org or email.',
      },
      placement: 'top',
      allowSkip: true,
      covers: ['fr-6.list-pending-invitations'],
    },
    {
      id: 'inv.cancel-resend',
      anchor: '[data-onboarding="invitations.row-actions"]',
      title: {
        fr: 'Annuler ou renvoyer',
        en: 'Cancel or resend',
      },
      description: {
        fr: 'Renvoyer prolonge l\'expiration de 7 jours. Annuler révoque le lien.',
        en: 'Resend extends expiry by 7 days. Cancel revokes the link.',
      },
      placement: 'left',
      allowSkip: true,
      covers: ['fr-6.cancel-invitation', 'fr-6.resend-invitation'],
    },
    {
      id: 'inv.audit-history',
      anchor: '[data-onboarding="invitations.history-btn"]',
      title: {
        fr: 'Historique d\'audit',
        en: 'Audit history',
      },
      description: {
        fr: 'Chaque action sur une invitation est consignée. Utilisez ceci quand une invitation semble avoir «disparu» — vérifiez l\'audit avant de réinviter.',
        en: 'Every action on an invitation is logged. Use this when an invite seems to "disappear" — check audit before re-inviting.',
      },
      placement: 'left',
      allowSkip: true,
      covers: ['fr-6.invitation-audit-history'],
      visibleIf: PRED_HAS_INVITATION_HISTORY,
    },
  ],
};
