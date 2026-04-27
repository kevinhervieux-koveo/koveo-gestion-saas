/**
 * @jest-environment node
 *
 * Task #1456 — getSystemFamilyDisplay helper and i18n key completeness
 *
 * Verifies:
 *   - getSystemFamilyDisplay returns localized label for a known system family
 *   - getSystemFamilyDisplay falls back to raw DB label for an unknown system family
 *   - getSystemFamilyDisplay returns raw DB label for any non-system family
 *   - Every canonical name in SYSTEM_FAMILY_TRANSLATION_MAP has both
 *     a non-empty FR and EN translation key in the i18n file
 *   - All 26 canonical names from the seed are covered in the translation map
 */

import { describe, it, expect } from '@jest/globals';
import type { Translations } from '../../../client/src/lib/i18n';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));

jest.mock('../../../server/db', () => ({
  db: {
    select: jest.fn(() => ({ from: () => ({ where: () => Promise.resolve([]) }) })),
    insert: jest.fn(() => ({ values: () => Promise.resolve() })),
  },
}));

jest.mock('../../../shared/schemas/documents', () => ({
  documentLinkFamilies: { name: 'document_link_families', isSystem: {} },
}));

jest.mock('../../../server/utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

type TFn = (key: keyof Translations) => string;

const makeMockT = (overrides: Partial<Record<keyof Translations, string>> = {}): TFn =>
  (key: keyof Translations) => overrides[key] ?? (key as string);

describe('getSystemFamilyDisplay helper', () => {
  let getSystemFamilyDisplay: typeof import('../../../client/src/lib/system-family-display').getSystemFamilyDisplay;
  let SYSTEM_FAMILY_TRANSLATION_MAP: typeof import('../../../client/src/lib/system-family-display').SYSTEM_FAMILY_TRANSLATION_MAP;

  beforeAll(async () => {
    const mod = await import('../../../client/src/lib/system-family-display');
    getSystemFamilyDisplay = mod.getSystemFamilyDisplay;
    SYSTEM_FAMILY_TRANSLATION_MAP = mod.SYSTEM_FAMILY_TRANSLATION_MAP;
  });

  it('returns the localized label for a known system family', () => {
    const t = makeMockT({ sfNameSequence: 'Séquence', sfDescSequence: 'Ordre séquentiel' });
    const family = { name: 'Sequence', description: 'raw desc', isSystem: true };
    const result = getSystemFamilyDisplay(family, t);
    expect(result.name).toBe('Séquence');
    expect(result.description).toBe('Ordre séquentiel');
  });

  it('falls back to raw DB label for an unknown system family (forward compat)', () => {
    const t = makeMockT({});
    const family = { name: 'UnknownFutureFamily', description: 'some desc', isSystem: true };
    const result = getSystemFamilyDisplay(family, t);
    expect(result.name).toBe('UnknownFutureFamily');
    expect(result.description).toBe('some desc');
  });

  it('returns raw DB label for any non-system family regardless of name', () => {
    const t = makeMockT({ sfNameSequence: 'Séquence' });
    const family = { name: 'Sequence', description: 'org desc', isSystem: false };
    const result = getSystemFamilyDisplay(family, t);
    expect(result.name).toBe('Sequence');
    expect(result.description).toBe('org desc');
  });

  it('handles null description gracefully for non-system families', () => {
    const t = makeMockT({});
    const family = { name: 'Custom Family', description: null, isSystem: false };
    const result = getSystemFamilyDisplay(family, t);
    expect(result.name).toBe('Custom Family');
    expect(result.description).toBeNull();
  });
});

describe('i18n key completeness for system families', () => {
  it('every canonical name in SYSTEM_FAMILY_TRANSLATION_MAP has non-empty FR and EN translations', async () => {
    const { SYSTEM_FAMILY_TRANSLATION_MAP } = await import(
      '../../../client/src/lib/system-family-display'
    );
    const { translations } = await import('../../../client/src/lib/i18n');

    for (const [, entry] of Object.entries(SYSTEM_FAMILY_TRANSLATION_MAP)) {
      const enName = translations.en[entry.nameKey as keyof typeof translations.en];
      const frName = translations.fr[entry.nameKey as keyof typeof translations.fr];
      const enDesc = translations.en[entry.descKey as keyof typeof translations.en];
      const frDesc = translations.fr[entry.descKey as keyof typeof translations.fr];

      expect(enName).toBeTruthy();
      expect(frName).toBeTruthy();
      expect(enDesc).toBeTruthy();
      expect(frDesc).toBeTruthy();

      expect(typeof enName).toBe('string');
      expect(typeof frName).toBe('string');
      expect(String(enName).trim().length).toBeGreaterThan(0);
      expect(String(frName).trim().length).toBeGreaterThan(0);
    }
  });

  it('all 26 canonical names from the seed are covered in the translation map', async () => {
    const { KOVEO_DEFAULT_LINK_FAMILIES } = await import(
      '../../../server/api/document-link-families-seed'
    );
    const { SYSTEM_FAMILY_TRANSLATION_MAP } = await import(
      '../../../client/src/lib/system-family-display'
    );

    for (const family of KOVEO_DEFAULT_LINK_FAMILIES) {
      expect(SYSTEM_FAMILY_TRANSLATION_MAP).toHaveProperty(family.name);
    }
    expect(Object.keys(SYSTEM_FAMILY_TRANSLATION_MAP)).toHaveLength(
      KOVEO_DEFAULT_LINK_FAMILIES.length,
    );
  });
});
