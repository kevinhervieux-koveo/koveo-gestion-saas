import type { TourContent } from '../types';
import {
  PRED_HAS_BUILDING_BILLS_TAB,
  PRED_HAS_BILLS_ROW_STATUS,
  PRED_HAS_BILLS_ROW_DELETE,
  PRED_HAS_BILLS_ROW_NUMBER,
} from './predicates';

export const FINANCIALS_TOUR: TourContent = {
  tourId: 'manager.core.financials',
  roles: ['manager', 'demo_manager'],
  steps: [
    {
      id: 'fin.list',
      anchor: '[data-onboarding="building.bills-tab"]',
      title: {
        fr: 'Factures',
        en: 'Bills',
      },
      description: {
        fr: 'Toutes les factures pour ce bâtiment. Filtrez par catégorie et statut.',
        en: 'All bills for this building. Filter by category and status.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-7.list-bills'],
      visibleIf: PRED_HAS_BUILDING_BILLS_TAB,
    },
    {
      id: 'fin.create',
      anchor: '[data-onboarding="bills.new-btn"]',
      title: {
        fr: 'Créer une facture',
        en: 'Create a bill',
      },
      description: {
        fr: 'Obligatoire : titre, catégorie (énumération), total, type de paiement (<code>unique</code> ou <code>récurrent</code>), date de début. La facture porte <code>source: "mcp"</code> lorsqu\'elle est créée via API.',
        en: 'Required: title, category (enum), total, payment type (<code>unique</code> or <code>recurrent</code>), start date. The bill carries <code>source: "mcp"</code> when created via API.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-7.create-bill'],
    },
    {
      id: 'fin.status',
      anchor: '[data-onboarding="bills.row-status"]',
      title: {
        fr: 'Mettre à jour le statut',
        en: 'Update status',
      },
      description: {
        fr: 'Faites évoluer entre brouillon, envoyé, payé, en retard.',
        en: 'Move between draft, sent, paid, overdue.',
      },
      placement: 'left',
      allowSkip: true,
      covers: ['fr-7.update-bill-status'],
      visibleIf: PRED_HAS_BILLS_ROW_STATUS,
    },
    {
      id: 'fin.delete-cascade',
      anchor: '[data-onboarding="bills.row-delete"]',
      title: {
        fr: 'La suppression se répercute sur les paiements',
        en: 'Delete cascades to payments',
      },
      description: {
        fr: 'La suppression d\'une facture supprime ses paiements planifiés. La réponse indique ce qui a été mis en cascade.',
        en: 'Deleting a bill removes its scheduled payments. The response shows what was cascaded.',
      },
      placement: 'left',
      allowSkip: true,
      covers: ['fr-7.delete-bill'],
      visibleIf: PRED_HAS_BILLS_ROW_DELETE,
    },
    {
      id: 'fin.numbering',
      anchor: '[data-onboarding="bills.row-number"]',
      title: {
        fr: 'Numérotation des factures',
        en: 'Bill numbering',
      },
      description: {
        fr: 'Les numéros suivent le format <code>MCP-&lt;horodatage&gt;</code> pour les factures créées via API. Confirmez avec votre équipe comptable si vous changez le format.',
        en: 'Numbers follow <code>MCP-&lt;timestamp&gt;</code> for API-created bills. Confirm with your accounting team if you change format.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-7.bill-numbering'],
      visibleIf: PRED_HAS_BILLS_ROW_NUMBER,
    },
  ],
};
