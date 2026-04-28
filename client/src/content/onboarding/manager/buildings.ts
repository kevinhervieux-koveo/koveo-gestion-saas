import type { TourContent } from '../types';
import {
  PRED_HAS_BUILDINGS_NEW_BTN,
  PRED_HAS_RESIDENCES_TAB,
  PRED_HAS_RESIDENCES_NEW_BTN,
  PRED_HAS_RESIDENCE_LINK_BTN,
  PRED_HAS_LINKED_RESIDENCE_USER,
  PRED_HAS_BUILDING_DELETE_BTN,
} from './predicates';

export const BUILDINGS_TOUR: TourContent = {
  tourId: 'manager.core.buildings',
  roles: ['manager', 'demo_manager'],
  entryPath: '/buildings',
  steps: [
    {
      id: 'bld.list',
      anchor: '[data-onboarding="nav.buildings"]',
      title: {
        fr: 'Vos bâtiments',
        en: 'Your buildings',
      },
      description: {
        fr: 'Tous les bâtiments des organisations que vous gérez. Cliquez sur l\'un d\'eux pour voir ses résidences, factures et demandes.',
        en: 'Every building in the orgs you manage. Click into one to see residences, bills, and demands.',
      },
      placement: 'right',
      allowSkip: true,
      covers: ['fr-3.list-buildings', 'fr-3.get-building'],
    },
    {
      id: 'bld.create',
      anchor: '[data-onboarding="buildings.new-btn"]',
      title: {
        fr: 'Ajouter un bâtiment',
        en: 'Add a new building',
      },
      description: {
        fr: '<strong>Obligatoire :</strong> nom, adresse, ville, code postal, nombre total d\'unités. Optionnel : date de construction, étages, stationnement, rangement, commodités, compte bancaire, factures imprévues, inflation.',
        en: '<strong>Required:</strong> name, address, city, postal code, total units. Optional: construction date, floors, parking, storage, amenities, bank account, unplanned bills, inflation.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-3.create-building'],
      visibleIf: PRED_HAS_BUILDINGS_NEW_BTN,
    },
    {
      id: 'bld.residences-tab',
      anchor: '[data-onboarding="building.residences-tab"]',
      title: {
        fr: 'Résidences d\'un bâtiment',
        en: 'Residences inside a building',
      },
      description: {
        fr: 'Une ligne par unité. À partir de là, vous pouvez ajouter des résidences et associer des locataires.',
        en: 'One row per unit. From here you can add residences and link tenants.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-4.list-residences'],
      visibleIf: PRED_HAS_RESIDENCES_TAB,
    },
    {
      id: 'bld.create-residence',
      anchor: '[data-onboarding="residences.new-btn"]',
      title: {
        fr: 'Créer une résidence',
        en: 'Create a residence',
      },
      description: {
        fr: 'Seul le <strong>numéro d\'unité</strong> est obligatoire. Les autres champs (étage, chambres, stationnement, rangement, % de propriété) sont optionnels.',
        en: 'Only <strong>unitNumber</strong> is required. Other fields (floor, bedrooms, parking, storage, ownership %) are optional.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-4.create-residence'],
      visibleIf: PRED_HAS_RESIDENCES_NEW_BTN,
    },
    {
      id: 'bld.link-user',
      anchor: '[data-onboarding="residence.link-user-btn"]',
      title: {
        fr: 'Associer une personne à une résidence',
        en: 'Link a person to a residence',
      },
      description: {
        fr: 'Choisissez la relation <strong>propriétaire</strong>, <strong>locataire</strong> ou <strong>occupant</strong>. L\'association inter-organisations est autorisée et intentionnelle.',
        en: 'Choose the <strong>owner</strong>, <strong>tenant</strong>, or <strong>occupant</strong> relationship. Cross-org linking is allowed and intentional.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-4.link-user-to-residence'],
      visibleIf: PRED_HAS_RESIDENCE_LINK_BTN,
    },
    {
      id: 'bld.unlink-user',
      anchor: '[data-onboarding="residence.row-unlink-btn"]',
      title: {
        fr: 'Dissocier quelqu\'un',
        en: 'Unlink someone',
      },
      description: {
        fr: 'Met fin à l\'association (l\'historique de résidence est conservé).',
        en: 'Soft-ends the link (residency history is preserved).',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-4.unlink-user-from-residence'],
      visibleIf: PRED_HAS_LINKED_RESIDENCE_USER,
    },
    {
      id: 'bld.delete-cascade',
      anchor: '[data-onboarding="building.delete-btn"]',
      title: {
        fr: 'La suppression d\'un bâtiment entraîne une cascade',
        en: 'Deleting a building cascades',
      },
      description: {
        fr: 'Supprime les résidences, factures, paiements, demandes, entretien, espaces communs et invitations en attente liés au bâtiment. Il n\'y a pas de suppression logique.',
        en: 'Removes residences, bills, payments, demands, maintenance, common spaces, and pending invitations attached to the building. There is no soft-delete.',
      },
      placement: 'bottom',
      allowSkip: true,
      covers: ['fr-3.delete-building', 'fr-4.delete-residence'],
      visibleIf: PRED_HAS_BUILDING_DELETE_BTN,
    },
  ],
};
