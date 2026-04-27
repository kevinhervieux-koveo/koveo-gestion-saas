import { describe, it, expect } from '@jest/globals';
import { translations } from '../../../client/src/lib/i18n.ts';

/**
 * Simulates the tp() helper from use-language.tsx for test purposes.
 * Uses Intl.PluralRules to pick the correct plural form.
 */
function tp(
  lang: 'en' | 'fr',
  baseKey: string,
  count: number,
  values?: Record<string, string | number>,
): string {
  const rules = new Intl.PluralRules(lang);
  const category = rules.select(count);
  const suffix = category === 'one' ? '_one' : '_other';
  const fullKey = `${baseKey}${suffix}` as keyof typeof translations.en;
  const template = (translations[lang] as Record<string, string>)[fullKey] ?? fullKey;
  const allValues = { count, ...(values ?? {}) };
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const val = allValues[name as keyof typeof allValues];
    return val === undefined || val === null ? `{${name}}` : String(val);
  });
}

describe('Plural translation correctness', () => {
  describe('wfElementsBulkRemoveWarning', () => {
    const key = 'wfElementsBulkRemoveWarning';

    it('EN: uses singular for count=1', () => {
      const result = tp('en', key, 1);
      expect(result).toContain('1 selected element');
      expect(result).not.toContain('elements');
    });

    it('EN: uses plural for count=0', () => {
      const result = tp('en', key, 0);
      expect(result).toContain('0 selected elements');
    });

    it('EN: uses plural for count=2', () => {
      const result = tp('en', key, 2);
      expect(result).toContain('2 selected elements');
    });

    it('EN: uses plural for count=5', () => {
      const result = tp('en', key, 5);
      expect(result).toContain('5 selected elements');
    });

    it('FR: uses singular for count=0 (French rule: 0 and 1 are singular)', () => {
      const result = tp('fr', key, 0);
      expect(result).toContain('0 élément sélectionné');
      expect(result).not.toContain('éléments');
    });

    it('FR: uses singular for count=1', () => {
      const result = tp('fr', key, 1);
      expect(result).toContain('1 élément sélectionné');
      expect(result).not.toContain('éléments');
    });

    it('FR: uses plural for count=2', () => {
      const result = tp('fr', key, 2);
      expect(result).toContain('2 éléments sélectionnés');
    });

    it('FR: uses plural for count=10', () => {
      const result = tp('fr', key, 10);
      expect(result).toContain('10 éléments sélectionnés');
    });
  });

  describe('docManagerDocumentCount', () => {
    const key = 'docManagerDocumentCount';

    it('EN: singular for count=1 with name placeholder', () => {
      const result = tp('en', key, 1, { name: 'Roof' });
      expect(result).toBe('1 document for Roof');
    });

    it('EN: plural for count=0 with name placeholder', () => {
      const result = tp('en', key, 0, { name: 'Roof' });
      expect(result).toBe('0 documents for Roof');
    });

    it('EN: plural for count=3 with name placeholder', () => {
      const result = tp('en', key, 3, { name: 'HVAC System' });
      expect(result).toBe('3 documents for HVAC System');
    });

    it('FR: singular for count=0 and count=1 with name placeholder', () => {
      expect(tp('fr', key, 0, { name: 'Toit' })).toBe('0 document pour Toit');
      expect(tp('fr', key, 1, { name: 'Toit' })).toBe('1 document pour Toit');
    });

    it('FR: plural for count=2+ with name placeholder', () => {
      expect(tp('fr', key, 2, { name: 'Toit' })).toBe('2 documents pour Toit');
      expect(tp('fr', key, 5, { name: 'Toit' })).toBe('5 documents pour Toit');
    });
  });

  describe('bulkImportAnalyzing', () => {
    const key = 'bulkImportAnalyzing';

    it('EN: singular for count=1', () => {
      const result = tp('en', key, 1);
      expect(result).toContain('1 document is still being analyzed');
      expect(result).not.toMatch(/\d+ documents/);
    });

    it('EN: plural for count=2', () => {
      const result = tp('en', key, 2);
      expect(result).toContain('2 documents are still being analyzed');
    });

    it('FR: singular for count=1', () => {
      const result = tp('fr', key, 1);
      expect(result).toContain('1 document est encore en cours');
    });

    it('FR: plural for count=3', () => {
      const result = tp('fr', key, 3);
      expect(result).toContain('3 documents sont encore en cours');
    });
  });

  describe('bulkImportResidenceIncomplete', () => {
    const key = 'bulkImportResidenceIncomplete';

    it('EN: singular for count=1', () => {
      const result = tp('en', key, 1);
      expect(result).toContain('1 residence document needs');
      expect(result).not.toMatch(/documents need/);
    });

    it('EN: plural for count=4', () => {
      const result = tp('en', key, 4);
      expect(result).toContain('4 residence documents need');
    });

    it('FR: singular for count=1', () => {
      const result = tp('fr', key, 1);
      expect(result).toContain('1 document de résidence nécessite');
    });

    it('FR: plural for count=2', () => {
      const result = tp('fr', key, 2);
      expect(result).toContain('2 documents de résidence nécessitent');
    });
  });

  describe('bulkImportBranchingPending', () => {
    const key = 'bulkImportBranchingPending';

    it('EN: singular for count=1', () => {
      const result = tp('en', key, 1);
      expect(result).toContain('1 branching decision needs');
    });

    it('EN: plural for count=3', () => {
      const result = tp('en', key, 3);
      expect(result).toContain('3 branching decisions need');
    });

    it('FR: singular for count=1', () => {
      const result = tp('fr', key, 1);
      expect(result).toContain('1 décision de branchement en attente');
    });

    it('FR: plural for count=5', () => {
      const result = tp('fr', key, 5);
      expect(result).toContain('5 décisions de branchement en attente');
    });
  });

  describe('bulkImportFallbackPending', () => {
    const key = 'bulkImportFallbackPending';

    it('EN: singular for count=1', () => {
      const result = tp('en', key, 1);
      expect(result).toContain('1 file needs');
    });

    it('EN: plural for count=2', () => {
      const result = tp('en', key, 2);
      expect(result).toContain('2 files need');
    });

    it('FR: singular for count=1', () => {
      const result = tp('fr', key, 1);
      expect(result).toContain('1 fichier doit être assigné');
    });

    it('FR: plural for count=4', () => {
      const result = tp('fr', key, 4);
      expect(result).toContain('4 fichiers doivent être assignés');
    });
  });

  describe('bulkImportCommitted', () => {
    const key = 'bulkImportCommitted';

    it('EN: singular for count=1', () => {
      const result = tp('en', key, 1);
      expect(result).toBe('1 document committed.');
    });

    it('EN: plural for count=0', () => {
      const result = tp('en', key, 0);
      expect(result).toBe('0 documents committed.');
    });

    it('EN: plural for count=5', () => {
      const result = tp('en', key, 5);
      expect(result).toBe('5 documents committed.');
    });

    it('FR: singular for count=0', () => {
      const result = tp('fr', key, 0);
      expect(result).toBe('0 document sauvegardé.');
    });

    it('FR: singular for count=1', () => {
      const result = tp('fr', key, 1);
      expect(result).toBe('1 document sauvegardé.');
    });

    it('FR: plural for count=2', () => {
      const result = tp('fr', key, 2);
      expect(result).toBe('2 documents sauvegardés.');
    });
  });

  describe('failedToDeleteDocumentsCount', () => {
    const key = 'failedToDeleteDocumentsCount';

    it('EN: singular for count=1', () => {
      const result = tp('en', key, 1);
      expect(result).toContain('1 document');
      expect(result).not.toMatch(/\d+ documents/);
    });

    it('EN: plural for count=3', () => {
      const result = tp('en', key, 3);
      expect(result).toContain('3 documents');
    });

    it('FR: singular for count=1', () => {
      const result = tp('fr', key, 1);
      expect(result).toContain('1 document');
    });

    it('FR: plural for count=2', () => {
      const result = tp('fr', key, 2);
      expect(result).toContain('2 documents');
    });
  });
});

describe('Placeholder substitution in translations', () => {
  it('substitutes {count} in plural key', () => {
    const result = tp('en', 'docManagerDocumentCount', 3, { name: 'Test' });
    expect(result).not.toContain('{count}');
    expect(result).toContain('3');
  });

  it('substitutes {name} placeholder in docManagerDocumentCount', () => {
    const result = tp('en', 'docManagerDocumentCount', 1, { name: 'My Element' });
    expect(result).not.toContain('{name}');
    expect(result).toContain('My Element');
  });

  it('substitutes multiple placeholders at once', () => {
    const result = tp('en', 'docManagerDocumentCount', 2, { name: 'Element X' });
    expect(result).toBe('2 documents for Element X');
  });

  it('substitutes placeholders in French strings', () => {
    const result = tp('fr', 'docManagerDocumentCount', 3, { name: 'Toit' });
    expect(result).toBe('3 documents pour Toit');
    expect(result).not.toContain('{count}');
    expect(result).not.toContain('{name}');
  });

  it('substitutes {planTotal} and {vendorPrice} in wfPaymentMismatchWarning', () => {
    const template = translations.en.wfPaymentMismatchWarning;
    const substituted = template
      .replace('{planTotal}', '$1,000')
      .replace('{vendorPrice}', '$1,200');
    expect(substituted).toContain('$1,000');
    expect(substituted).toContain('$1,200');
    expect(substituted).not.toContain('{planTotal}');
    expect(substituted).not.toContain('{vendorPrice}');
  });

  it('all new plural keys have both _one and _other in both languages', () => {
    const newPluralBases = [
      'docManagerDocumentCount',
      'bulkImportAnalyzing',
      'bulkImportResidenceIncomplete',
      'bulkImportBranchingPending',
      'bulkImportFallbackPending',
      'bulkImportCommitted',
    ];
    for (const base of newPluralBases) {
      for (const lang of ['en', 'fr'] as const) {
        const t = translations[lang] as Record<string, string>;
        expect(t[`${base}_one`]).toBeDefined();
        expect(typeof t[`${base}_one`]).toBe('string');
        expect(t[`${base}_one`].length).toBeGreaterThan(0);
        expect(t[`${base}_other`]).toBeDefined();
        expect(typeof t[`${base}_other`]).toBe('string');
        expect(t[`${base}_other`].length).toBeGreaterThan(0);
      }
    }
  });
});

describe('AI confidence badge translation keys', () => {
  const keys = [
    'bills.aiConfidenceHigh',
    'bills.aiConfidenceMedium',
    'bills.aiConfidenceLow',
  ] as const;

  it('all AI confidence keys exist in English', () => {
    for (const key of keys) {
      const value = (translations.en as Record<string, string>)[key];
      expect(value).toBeDefined();
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('all AI confidence keys exist in French', () => {
    for (const key of keys) {
      const value = (translations.fr as Record<string, string>)[key];
      expect(value).toBeDefined();
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('English confidence labels are distinct from each other', () => {
    const high = (translations.en as Record<string, string>)['bills.aiConfidenceHigh'];
    const medium = (translations.en as Record<string, string>)['bills.aiConfidenceMedium'];
    const low = (translations.en as Record<string, string>)['bills.aiConfidenceLow'];
    expect(high).not.toBe(medium);
    expect(medium).not.toBe(low);
    expect(high).not.toBe(low);
  });

  it('French confidence labels are distinct from each other', () => {
    const high = (translations.fr as Record<string, string>)['bills.aiConfidenceHigh'];
    const medium = (translations.fr as Record<string, string>)['bills.aiConfidenceMedium'];
    const low = (translations.fr as Record<string, string>)['bills.aiConfidenceLow'];
    expect(high).not.toBe(medium);
    expect(medium).not.toBe(low);
    expect(high).not.toBe(low);
  });
});
