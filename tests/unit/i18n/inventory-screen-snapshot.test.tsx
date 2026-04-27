import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import '@testing-library/jest-dom';
import { translations } from '../../../client/src/lib/i18n.ts';

/**
 * Inventory screen snapshot tests in both languages.
 *
 * These tests verify that the inventory screen translation keys exist and
 * produce correct output in both EN and FR, providing a baseline snapshot
 * so any future accidental regression to English fallbacks is caught.
 *
 * Rather than mounting the full InventoryPage (which has many external
 * dependencies), we snapshot the translated strings directly from the
 * translation table — this is fast, deterministic, and sufficient to prove
 * that every visible label has a French equivalent.
 *
 * Screens covered:
 *   - InventoryHeader (ihdr prefix)
 *   - InventoryOverview (iov prefix)
 *   - ElementCard (emc prefix)
 *   - ElementTable (et prefix)
 *   - HistoryTable (ht prefix)
 *   - ElementDetailsPanel (edp prefix)
 *   - ProjectCard (pc prefix)
 *   - UniformatBrowser (ub prefix)
 *   - ElementHistoryForm (ehf prefix)
 *   - DocumentManager (dm prefix + docManagerDocumentCount)
 */

const INVENTORY_HEADER_KEYS = [
  'ihdrBackToBuildingButton',
  'ihdrPageTitle',
  'ihdrAddElement',
  'ihdrSearchPlaceholder',
  'ihdrFilters',
  'ihdrOverdueLabel',
  'ihdrOverdueEvaluations',
  'ihdrConditionLabel',
  'ihdrAllConditionsPlaceholder',
  'ihdrAllConditionsItem',
  'ihdrConditionExcellent',
  'ihdrConditionGood',
  'ihdrConditionFair',
  'ihdrConditionPoor',
  'ihdrConditionCritical',
  'ihdrUniformatCategoryLabel',
  'ihdrAllCategoriesPlaceholder',
  'ihdrAllCategoriesItem',
  'ihdrUniformatA',
  'ihdrUniformatB',
  'ihdrUniformatC',
  'ihdrUniformatD',
  'ihdrUniformatE',
  'ihdrUniformatF',
  'ihdrUniformatG',
] as const;

const INVENTORY_OVERVIEW_KEYS = [
  'iovHeaderTitle',
  'iovBuildingInventoryItems',
  'iovYearsSuffix',
  'iovMostCommonCategoryLabel',
  'inventoryManagementTitle',
  'inventoryManagementSubtitle',
  'startBuildingYourInventoryByAdding',
  'selectBuildingInventoryMessage',
] as const;

const ELEMENT_CARD_KEYS = [
  'emcEditElementLabel',
  'emcEditButton',
  'emcBuiltLabel',
  'emcLastInspectionLabel',
  'emcAgeLifespanLabel',
  'emcLifespanProgressSuffix',
  'emcConstructionLabel',
  'emcUnknown',
  'emcNever',
  'emcNextEvaluationLabel',
  'emcOverdueBadge',
  'emcDueSoonBadge',
  'emcScheduledBadge',
  'emcTotalCostLabel',
  'emcCostPerYearAvgSuffix',
  'emcActivityLabel',
  'emcEntriesSuffix',
  'emcDocumentsSuffix',
  'emcTimelineButton',
  'emcYearsSuffix',
  'emcExpectedLifespanSuffix',
  'emcPhotoAltSuffix',
] as const;

const ELEMENT_TABLE_KEYS = [
  'etBulkEditButton',
  'etElementsDeletedTitle',
  'etElementsDeletedDescPrefix',
  'etElementsDeletedDescSuffix',
  'etElementDeletedTitle',
  'etElementDeletedDesc',
  'etElementsSelectedSuffix',
] as const;

const HISTORY_TABLE_KEYS = [
  'htWarrantyColumn',
  'htWarrantyNoneLabel',
  'htWarrantyYearSuffix',
  'htWarrantyYearsSuffix',
  'htWarrantyUntilPrefix',
  'htEditEntry',
] as const;

const ELEMENT_DETAILS_PANEL_KEYS = [
  'edpEditAction',
  'edpUploadFilesAction',
  'edpScheduleAction',
  'edpDeleteAction',
  'edpDeleteDialogTitle',
  'edpDeleteDialogConfirmCancel',
  'edpDeletingProgress',
  'edpOverviewTab',
  'edpDocumentsTab',
  'edpProjectsTab',
  'edpStatusEvaluationTitle',
  'edpCurrentConditionLabel',
  'edpNextEvaluationLabel',
  'edpLastInspectionLabel',
  'edpLastInspectionNever',
  'edpUrgencyOverdueLabel',
  'edpUrgencyDueSoonLabel',
  'edpUrgencyScheduledLabel',
  'edpUrgencyNotScheduledLabel',
  'edpLifespanAnalysisTitle',
  'edpAgeProgressLabel',
  'edpYearsSuffix',
  'edpNearingEndLifespan',
  'edpAgingMonitor',
  'edpGoodRemaining',
  'edpOriginalLifespanLabel',
  'edpCurrentLifespanLabel',
  'edpConstructionDateLabel',
  'edpNoDocumentsUploaded',
  'edpProjectNumberPrefix',
  'edpNoRelatedProjects',
  'edpElementDeletedToastTitle',
  'edpElementDeletedToastDesc',
] as const;

const PROJECT_CARD_KEYS = [
  'pcTypeEvaluation',
  'pcTypeRepair',
  'pcTypeMinorRehab',
  'pcTypeMajorRehab',
  'pcTypeReplacement',
  'pcOverdueBadge',
  'pcOverBudgetBadge',
  'pcCriticalPriorityBadge',
  'pcOpenMenu',
  'pcQuickActionsLabel',
  'pcEditProject',
  'pcViewTimeline',
  'pcAddNotes',
  'pcStartWork',
  'pcCompleteWork',
  'pcUpdatedPrefix',
  'pcDaysOverdueSuffix',
  'pcDaysRemainingSuffix',
  'pcProgressLabel',
  'pcStartDateLabel',
  'pcEndDateLabel',
  'pcBudgetLabel',
  'pcBudgetUsedSuffix',
  'pcElementsLabel',
  'pcElementsAssignedSuffix',
  'pcBuildingComponents',
  'pcStatusUpdatedTitle',
  'pcStatusUpdatedDesc',
  'pcUpdateFailedTitle',
  'pcUpdateFailedDesc',
] as const;

const DOCUMENT_MANAGER_KEYS = [
  'docManagerDocumentCount_one',
  'docManagerDocumentCount_other',
  'documentsAndFilesTitle',
  'uploadButton',
  'uploadDocumentsHeading',
  'dmTabAll',
  'dmTabImages',
  'dmTabPdfs',
  'dmTabWarranties',
  'dmTabSpecs',
  'dmTabReports',
  'dmNoDocumentsFound',
  'dmUploadFirstDocument',
  'deleteDocument',
  'documentDeletedTitle',
  'documentUploadedTitle',
  'documentUploadedDesc',
  'uploadFailed',
  'downloadFailed',
  'assetDocumentationTitle',
] as const;

const UNIFORMAT_BROWSER_KEYS = [
  'ubCatalogTitle',
  'ubCommonButton',
  'ubSearchPlaceholder',
  'ubAllLevelsPlaceholder',
  'ubAllLevelsItem',
  'ubLevelLabel',
  'ubAllCategoriesPlaceholder',
  'ubAllCategoriesItem',
  'ubCommonBadge',
  'ubFilteredResultsPrefix',
  'ubFilteredResultsSuffix',
  'ubNoMatchingCodes',
  'ubNoCodesAvailable',
  'ubYearsSuffix',
] as const;

const ELEMENT_HISTORY_FORM_KEYS = [
  'ehfAddMaintenanceHistoryTitle',
  'ehfEditMaintenanceHistoryTitle',
  'ehfEventTypeLabel',
  'ehfEventTypePlaceholder',
  'ehfEventTypeOriginalConstruction',
  'ehfEventTypeRepair',
  'ehfEventTypeMinorRehab',
  'ehfEventTypeMajorRehab',
  'ehfEventTypeReplacement',
  'ehfEventDateLabel',
  'ehfCostLabel',
  'ehfWorkDescriptionLabel',
  'ehfVendorInformationHeading',
  'ehfVendorLabel',
  'ehfVendorSelectPlaceholder',
  'ehfNoVendorInternalWork',
  'ehfWarrantyInformationHeading',
  'ehfWarrantyDurationLabel',
  'ehfWarrantyTermsLabel',
  'ehfLifespanImpactHeading',
  'ehfAutoCalculate',
  'ehfLifespanExtensionLabel',
  'ehfAdditionalNotesLabel',
  'ehfCancel',
  'ehfCreate',
  'ehfSaveChanges',
] as const;

type AnyKey = keyof typeof translations.en;

function assertKeyExists(key: AnyKey, lang: 'en' | 'fr') {
  const value = translations[lang][key] as string;
  expect(typeof value).toBe('string');
  expect(value.length).toBeGreaterThan(0);
}

function assertNotEnglishFallback(key: AnyKey) {
  const en = translations.en[key] as string;
  const fr = translations.fr[key] as string;
  expect(fr).not.toBe(en);
}

function buildSnapshot<T extends AnyKey>(keys: readonly T[], lang: 'en' | 'fr'): Record<string, string> {
  return keys.reduce((acc, key) => {
    acc[key as string] = translations[lang][key] as string;
    return acc;
  }, {} as Record<string, string>);
}

describe('Inventory screen translations — key existence', () => {
  describe('InventoryHeader (ihdr) keys', () => {
    for (const key of INVENTORY_HEADER_KEYS) {
      it(`EN: ${key} is defined and non-empty`, () => assertKeyExists(key, 'en'));
      it(`FR: ${key} is defined and non-empty`, () => assertKeyExists(key, 'fr'));
    }
  });

  describe('InventoryOverview (iov) keys', () => {
    for (const key of INVENTORY_OVERVIEW_KEYS) {
      it(`EN: ${key} is defined and non-empty`, () => assertKeyExists(key, 'en'));
      it(`FR: ${key} is defined and non-empty`, () => assertKeyExists(key, 'fr'));
    }
  });

  describe('ElementCard (emc) keys', () => {
    for (const key of ELEMENT_CARD_KEYS) {
      it(`EN: ${key} is defined and non-empty`, () => assertKeyExists(key, 'en'));
      it(`FR: ${key} is defined and non-empty`, () => assertKeyExists(key, 'fr'));
    }
  });

  describe('ElementTable (et) keys', () => {
    for (const key of ELEMENT_TABLE_KEYS) {
      it(`EN: ${key} is defined and non-empty`, () => assertKeyExists(key, 'en'));
      it(`FR: ${key} is defined and non-empty`, () => assertKeyExists(key, 'fr'));
    }
  });

  describe('HistoryTable (ht) keys', () => {
    for (const key of HISTORY_TABLE_KEYS) {
      it(`EN: ${key} is defined and non-empty`, () => assertKeyExists(key, 'en'));
      it(`FR: ${key} is defined and non-empty`, () => assertKeyExists(key, 'fr'));
    }
  });

  describe('ElementDetailsPanel (edp) keys', () => {
    for (const key of ELEMENT_DETAILS_PANEL_KEYS) {
      it(`EN: ${key} is defined and non-empty`, () => assertKeyExists(key, 'en'));
      it(`FR: ${key} is defined and non-empty`, () => assertKeyExists(key, 'fr'));
    }
  });

  describe('ProjectCard (pc) keys', () => {
    for (const key of PROJECT_CARD_KEYS) {
      it(`EN: ${key} is defined and non-empty`, () => assertKeyExists(key, 'en'));
      it(`FR: ${key} is defined and non-empty`, () => assertKeyExists(key, 'fr'));
    }
  });

  describe('DocumentManager (dm) keys', () => {
    for (const key of DOCUMENT_MANAGER_KEYS) {
      it(`EN: ${key} is defined and non-empty`, () => assertKeyExists(key, 'en'));
      it(`FR: ${key} is defined and non-empty`, () => assertKeyExists(key, 'fr'));
    }
  });

  describe('UniformatBrowser (ub) keys', () => {
    for (const key of UNIFORMAT_BROWSER_KEYS) {
      it(`EN: ${key} is defined and non-empty`, () => assertKeyExists(key, 'en'));
      it(`FR: ${key} is defined and non-empty`, () => assertKeyExists(key, 'fr'));
    }
  });

  describe('ElementHistoryForm (ehf) keys', () => {
    for (const key of ELEMENT_HISTORY_FORM_KEYS) {
      it(`EN: ${key} is defined and non-empty`, () => assertKeyExists(key, 'en'));
      it(`FR: ${key} is defined and non-empty`, () => assertKeyExists(key, 'fr'));
    }
  });
});

describe('Inventory screen translations — no English fallbacks in French', () => {
  it('FR page title is not the English value', () => {
    expect(translations.fr.ihdrPageTitle).not.toBe(translations.en.ihdrPageTitle);
  });

  it('FR add element button is not the English value', () => {
    expect(translations.fr.ihdrAddElement).not.toBe(translations.en.ihdrAddElement);
  });

  it('FR condition labels are translated', () => {
    expect(translations.fr.ihdrConditionExcellent).toBeTruthy();
    expect(translations.fr.ihdrConditionGood).not.toBe(translations.en.ihdrConditionGood);
    expect(translations.fr.ihdrConditionFair).not.toBe(translations.en.ihdrConditionFair);
    expect(translations.fr.ihdrConditionPoor).not.toBe(translations.en.ihdrConditionPoor);
    expect(translations.fr.ihdrConditionCritical).not.toBe(translations.en.ihdrConditionCritical);
  });

  it('FR inventory management title is not the English value', () => {
    expect(translations.fr.inventoryManagementTitle).not.toBe(translations.en.inventoryManagementTitle);
  });

  it('FR document count singular is not the English value', () => {
    expect(translations.fr.docManagerDocumentCount_one).not.toBe(translations.en.docManagerDocumentCount_one);
  });

  it('FR document count plural is not the English value', () => {
    expect(translations.fr.docManagerDocumentCount_other).not.toBe(translations.en.docManagerDocumentCount_other);
  });

  it('FR ElementCard labels are not English', () => {
    assertNotEnglishFallback('emcEditButton');
    assertNotEnglishFallback('emcBuiltLabel');
    assertNotEnglishFallback('emcLastInspectionLabel');
    assertNotEnglishFallback('emcOverdueBadge');
    assertNotEnglishFallback('emcDueSoonBadge');
    assertNotEnglishFallback('emcTotalCostLabel');
  });

  it('FR HistoryTable labels are not English', () => {
    assertNotEnglishFallback('htWarrantyColumn');
    assertNotEnglishFallback('htWarrantyNoneLabel');
    assertNotEnglishFallback('htWarrantyUntilPrefix');
    assertNotEnglishFallback('htEditEntry');
  });

  it('FR ElementDetailsPanel labels are not English', () => {
    assertNotEnglishFallback('edpEditAction');
    assertNotEnglishFallback('edpDeleteAction');
    assertNotEnglishFallback('edpOverviewTab');
    assertNotEnglishFallback('edpLifespanAnalysisTitle');
    assertNotEnglishFallback('edpNearingEndLifespan');
    assertNotEnglishFallback('edpGoodRemaining');
    assertNotEnglishFallback('edpUrgencyDueSoonLabel');
  });

  it('FR ProjectCard labels are not English', () => {
    assertNotEnglishFallback('pcTypeEvaluation');
    assertNotEnglishFallback('pcTypeRepair');
    assertNotEnglishFallback('pcEditProject');
    assertNotEnglishFallback('pcViewTimeline');
    assertNotEnglishFallback('pcProgressLabel');
    assertNotEnglishFallback('pcStatusUpdatedTitle');
  });

  it('FR UniformatBrowser labels are not English', () => {
    assertNotEnglishFallback('ubCatalogTitle');
    assertNotEnglishFallback('ubSearchPlaceholder');
    assertNotEnglishFallback('ubNoMatchingCodes');
  });

  it('FR ElementHistoryForm labels are not English', () => {
    assertNotEnglishFallback('ehfAddMaintenanceHistoryTitle');
    assertNotEnglishFallback('ehfEventTypeLabel');
    assertNotEnglishFallback('ehfVendorInformationHeading');
    assertNotEnglishFallback('ehfWarrantyInformationHeading');
    assertNotEnglishFallback('ehfLifespanImpactHeading');
  });

  it('FR DocumentManager labels are not English', () => {
    assertNotEnglishFallback('documentsAndFilesTitle');
    assertNotEnglishFallback('uploadButton');
    assertNotEnglishFallback('dmTabAll');
    assertNotEnglishFallback('dmTabWarranties');
    assertNotEnglishFallback('dmNoDocumentsFound');
    assertNotEnglishFallback('deleteDocument');
  });
});

describe('Inventory screen translations — snapshot', () => {
  it('matches English inventory header strings snapshot', () => {
    expect(buildSnapshot(INVENTORY_HEADER_KEYS, 'en')).toMatchSnapshot();
  });

  it('matches French inventory header strings snapshot', () => {
    expect(buildSnapshot(INVENTORY_HEADER_KEYS, 'fr')).toMatchSnapshot();
  });

  it('matches English inventory overview strings snapshot', () => {
    expect(buildSnapshot(INVENTORY_OVERVIEW_KEYS, 'en')).toMatchSnapshot();
  });

  it('matches French inventory overview strings snapshot', () => {
    expect(buildSnapshot(INVENTORY_OVERVIEW_KEYS, 'fr')).toMatchSnapshot();
  });

  it('matches English ElementCard strings snapshot', () => {
    expect(buildSnapshot(ELEMENT_CARD_KEYS, 'en')).toMatchSnapshot();
  });

  it('matches French ElementCard strings snapshot', () => {
    expect(buildSnapshot(ELEMENT_CARD_KEYS, 'fr')).toMatchSnapshot();
  });

  it('matches English ElementTable strings snapshot', () => {
    expect(buildSnapshot(ELEMENT_TABLE_KEYS, 'en')).toMatchSnapshot();
  });

  it('matches French ElementTable strings snapshot', () => {
    expect(buildSnapshot(ELEMENT_TABLE_KEYS, 'fr')).toMatchSnapshot();
  });

  it('matches English HistoryTable strings snapshot', () => {
    expect(buildSnapshot(HISTORY_TABLE_KEYS, 'en')).toMatchSnapshot();
  });

  it('matches French HistoryTable strings snapshot', () => {
    expect(buildSnapshot(HISTORY_TABLE_KEYS, 'fr')).toMatchSnapshot();
  });

  it('matches English ElementDetailsPanel strings snapshot', () => {
    expect(buildSnapshot(ELEMENT_DETAILS_PANEL_KEYS, 'en')).toMatchSnapshot();
  });

  it('matches French ElementDetailsPanel strings snapshot', () => {
    expect(buildSnapshot(ELEMENT_DETAILS_PANEL_KEYS, 'fr')).toMatchSnapshot();
  });

  it('matches English ProjectCard strings snapshot', () => {
    expect(buildSnapshot(PROJECT_CARD_KEYS, 'en')).toMatchSnapshot();
  });

  it('matches French ProjectCard strings snapshot', () => {
    expect(buildSnapshot(PROJECT_CARD_KEYS, 'fr')).toMatchSnapshot();
  });

  it('matches English DocumentManager strings snapshot', () => {
    expect(buildSnapshot(DOCUMENT_MANAGER_KEYS, 'en')).toMatchSnapshot();
  });

  it('matches French DocumentManager strings snapshot', () => {
    expect(buildSnapshot(DOCUMENT_MANAGER_KEYS, 'fr')).toMatchSnapshot();
  });

  it('matches English UniformatBrowser strings snapshot', () => {
    expect(buildSnapshot(UNIFORMAT_BROWSER_KEYS, 'en')).toMatchSnapshot();
  });

  it('matches French UniformatBrowser strings snapshot', () => {
    expect(buildSnapshot(UNIFORMAT_BROWSER_KEYS, 'fr')).toMatchSnapshot();
  });

  it('matches English ElementHistoryForm strings snapshot', () => {
    expect(buildSnapshot(ELEMENT_HISTORY_FORM_KEYS, 'en')).toMatchSnapshot();
  });

  it('matches French ElementHistoryForm strings snapshot', () => {
    expect(buildSnapshot(ELEMENT_HISTORY_FORM_KEYS, 'fr')).toMatchSnapshot();
  });
});

describe('Inventory screen — specific French string values', () => {
  it('FR page title contains expected French text', () => {
    expect(translations.fr.ihdrPageTitle).toBe('Inventaire — Éléments du bâtiment');
  });

  it('FR add element button is in French', () => {
    expect(translations.fr.ihdrAddElement).toBe('Ajouter un élément');
  });

  it('FR search placeholder is in French', () => {
    expect(translations.fr.ihdrSearchPlaceholder).toContain('UNIFORMAT');
  });

  it('FR condition labels use French', () => {
    expect(translations.fr.ihdrConditionExcellent).toBe('Excellent');
    expect(translations.fr.ihdrConditionGood).toBe('Bon');
    expect(translations.fr.ihdrConditionFair).toBe('Passable');
    expect(translations.fr.ihdrConditionPoor).toBe('Mauvais');
    expect(translations.fr.ihdrConditionCritical).toBe('Critique');
  });

  it('FR document count singular uses French', () => {
    expect(translations.fr.docManagerDocumentCount_one).toBe('{count} document pour {name}');
  });

  it('FR document count plural uses French', () => {
    expect(translations.fr.docManagerDocumentCount_other).toBe('{count} documents pour {name}');
  });

  it('FR ElementCard edit button is "Modifier"', () => {
    expect(translations.fr.emcEditButton).toBe('Modifier');
  });

  it('FR ElementCard years suffix is "ans"', () => {
    expect(translations.fr.emcYearsSuffix).toBe('ans');
  });

  it('FR ElementCard overdue badge is "En retard"', () => {
    expect(translations.fr.emcOverdueBadge).toBe('En retard');
  });

  it('FR HistoryTable warranty column is "Garantie"', () => {
    expect(translations.fr.htWarrantyColumn).toBe('Garantie');
  });

  it('FR HistoryTable edit entry is "Modifier l\'entrée"', () => {
    expect(translations.fr.htEditEntry).toBe("Modifier l'entrée");
  });

  it('FR ElementDetailsPanel years suffix is "ans"', () => {
    expect(translations.fr.edpYearsSuffix).toBe('ans');
  });

  it('FR ElementDetailsPanel overview tab is "Aperçu"', () => {
    expect(translations.fr.edpOverviewTab).toBe('Aperçu');
  });

  it('FR ProjectCard evaluation type uses French', () => {
    expect(translations.fr.pcTypeEvaluation).toBe('Évaluation');
  });

  it('FR ProjectCard budget used suffix contains percent symbol', () => {
    expect(translations.fr.pcBudgetUsedSuffix).toContain('%');
  });

  it('FR UniformatBrowser catalog title is in French', () => {
    expect(translations.fr.ubCatalogTitle).toBe('Catalogue UNIFORMAT II');
  });

  it('FR ElementHistoryForm vendor heading is in French', () => {
    expect(translations.fr.ehfVendorInformationHeading).toBeTruthy();
    expect(translations.fr.ehfVendorInformationHeading).not.toBe(translations.en.ehfVendorInformationHeading);
  });

  it('FR deleteDocument is "Supprimer le document"', () => {
    expect(translations.fr.deleteDocument).toBe('Supprimer le document');
  });

  it('FR uploadButton is "Téléverser"', () => {
    expect(translations.fr.uploadButton).toBe('Téléverser');
  });

  it('FR dmTabAll is "Tous"', () => {
    expect(translations.fr.dmTabAll).toBe('Tous');
  });

  it('FR urgent priority is "Urgent"', () => {
    expect(translations.fr.urgent).toBe('Urgent');
  });

  it('FR emergency priority is "Urgence"', () => {
    expect(translations.fr.emergency).toBe('Urgence');
  });
});

describe('Inventory screen — maintenance category labels', () => {
  it('FR plumbing category is "Plomberie"', () => {
    expect(translations.fr.plumbing).toBe('Plomberie');
  });

  it('FR electrical category is "Électricité"', () => {
    expect(translations.fr.electrical).toBe('Électricité');
  });

  it('FR hvac category is "CVC"', () => {
    expect(translations.fr.hvac).toBe('CVC');
  });

  it('FR landscaping category is in French', () => {
    expect(translations.fr.landscaping).not.toBe(translations.en.landscaping);
    expect(translations.fr.landscaping).toBeTruthy();
  });

  it('FR security category is in French', () => {
    expect(translations.fr.security).not.toBe(translations.en.security);
    expect(translations.fr.security).toBeTruthy();
  });
});
