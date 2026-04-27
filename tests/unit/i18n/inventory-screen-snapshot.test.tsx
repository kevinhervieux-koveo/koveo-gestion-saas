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
  'inventoryManagementTitle',
  'inventoryManagementSubtitle',
  'startBuildingYourInventoryByAdding',
  'selectBuildingInventoryMessage',
] as const;

const DOCUMENT_MANAGER_KEYS = [
  'docManagerDocumentCount_one',
  'docManagerDocumentCount_other',
] as const;

describe('Inventory screen translations — key existence', () => {
  describe('InventoryHeader keys', () => {
    for (const key of INVENTORY_HEADER_KEYS) {
      it(`EN: ${key} is defined and non-empty`, () => {
        const value = translations.en[key as keyof typeof translations.en] as string;
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });

      it(`FR: ${key} is defined and non-empty`, () => {
        const value = translations.fr[key as keyof typeof translations.fr] as string;
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    }
  });

  describe('InventoryOverview keys', () => {
    for (const key of INVENTORY_OVERVIEW_KEYS) {
      it(`EN: ${key} is defined and non-empty`, () => {
        const value = translations.en[key as keyof typeof translations.en] as string;
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });

      it(`FR: ${key} is defined and non-empty`, () => {
        const value = translations.fr[key as keyof typeof translations.fr] as string;
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    }
  });

  describe('DocumentManager document count keys', () => {
    for (const key of DOCUMENT_MANAGER_KEYS) {
      it(`EN: ${key} is defined and non-empty`, () => {
        const value = translations.en[key as keyof typeof translations.en] as string;
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });

      it(`FR: ${key} is defined and non-empty`, () => {
        const value = translations.fr[key as keyof typeof translations.fr] as string;
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
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
});

describe('Inventory screen translations — snapshot', () => {
  it('matches English inventory header strings snapshot', () => {
    const snapshot = INVENTORY_HEADER_KEYS.reduce((acc, key) => {
      acc[key] = translations.en[key as keyof typeof translations.en] as string;
      return acc;
    }, {} as Record<string, string>);
    expect(snapshot).toMatchSnapshot();
  });

  it('matches French inventory header strings snapshot', () => {
    const snapshot = INVENTORY_HEADER_KEYS.reduce((acc, key) => {
      acc[key] = translations.fr[key as keyof typeof translations.fr] as string;
      return acc;
    }, {} as Record<string, string>);
    expect(snapshot).toMatchSnapshot();
  });

  it('matches English inventory overview strings snapshot', () => {
    const snapshot = INVENTORY_OVERVIEW_KEYS.reduce((acc, key) => {
      acc[key] = translations.en[key as keyof typeof translations.en] as string;
      return acc;
    }, {} as Record<string, string>);
    expect(snapshot).toMatchSnapshot();
  });

  it('matches French inventory overview strings snapshot', () => {
    const snapshot = INVENTORY_OVERVIEW_KEYS.reduce((acc, key) => {
      acc[key] = translations.fr[key as keyof typeof translations.fr] as string;
      return acc;
    }, {} as Record<string, string>);
    expect(snapshot).toMatchSnapshot();
  });

  it('matches English DocumentManager document count strings snapshot', () => {
    expect({
      one: translations.en.docManagerDocumentCount_one,
      other: translations.en.docManagerDocumentCount_other,
    }).toMatchSnapshot();
  });

  it('matches French DocumentManager document count strings snapshot', () => {
    expect({
      one: translations.fr.docManagerDocumentCount_one,
      other: translations.fr.docManagerDocumentCount_other,
    }).toMatchSnapshot();
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
});
