import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createElement } from 'react';
import { LanguageProvider } from '../../../client/src/hooks/use-language.tsx';
import { useLanguage } from '../../../client/src/hooks/use-language.tsx';
import { translations } from '../../../client/src/lib/i18n.ts';

type TpBaseKey = Parameters<ReturnType<typeof useLanguage>['tp']>[0];

/**
 * A minimal test component that calls tp() with the given args and renders
 * the result into a <span> so we can assert on it.
 */
function TpDisplay({
  baseKey,
  count,
  values,
}: {
  baseKey: TpBaseKey;
  count: number;
  values?: Record<string, string | number>;
}) {
  const { tp } = useLanguage();
  const text = tp(baseKey, count, values);
  return createElement('span', { 'data-testid': 'result' }, text);
}

function renderTp(
  lang: 'en' | 'fr',
  baseKey: TpBaseKey,
  count: number,
  values?: Record<string, string | number>,
) {
  localStorage.setItem('koveo-language', lang);
  const { unmount } = render(
    createElement(
      LanguageProvider,
      null,
      createElement(TpDisplay, { baseKey, count, values }),
    ),
  );
  const text = screen.getByTestId('result').textContent ?? '';
  unmount();
  return text;
}

describe('tp() plural helper (real helper)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('missing _one/_other pair behaviour', () => {
    it('returns the raw key when both variants are absent', () => {
      // @ts-expect-error task #1481 — intentionally tests runtime fallback with a non-existent base key
      const result = renderTp('en', 'nonExistentBaseKey', 1);
      expect(result).toBe('nonExistentBaseKey_one');
    });

    it('returns the raw key for _other when missing', () => {
      // @ts-expect-error task #1481 — intentionally tests runtime fallback with a non-existent base key
      const result = renderTp('en', 'nonExistentBaseKey', 2);
      expect(result).toBe('nonExistentBaseKey_other');
    });
  });

  describe('French zero-singular edge case (CLDR)', () => {
    it('FR: 0 maps to _one (singular) per CLDR rules', () => {
      const rules = new Intl.PluralRules('fr');
      expect(rules.select(0)).toBe('one');
    });

    it('FR: pvOverdueProjectsAlert count=0 uses singular form', () => {
      const result = renderTp('fr', 'pvOverdueProjectsAlert', 0);
      expect(result).toContain('0');
      expect(result).not.toMatch(/projets/);
    });

    it('FR: pvOverdueProjectsAlert count=1 uses singular form', () => {
      const result = renderTp('fr', 'pvOverdueProjectsAlert', 1);
      expect(result).toContain('1');
      expect(result).not.toMatch(/projets/);
    });

    it('FR: pvOverdueProjectsAlert count=2 uses plural form', () => {
      const result = renderTp('fr', 'pvOverdueProjectsAlert', 2);
      expect(result).toContain('2');
      expect(result).toMatch(/projets/);
    });

    it('FR: pvEventsScheduledOnDate count=0 uses singular', () => {
      const result = renderTp('fr', 'pvEventsScheduledOnDate', 0);
      expect(result).toContain('0');
      expect(result).not.toMatch(/événements/);
    });

    it('FR: pvEventsScheduledOnDate count=1 uses singular', () => {
      const result = renderTp('fr', 'pvEventsScheduledOnDate', 1);
      expect(result).toContain('1');
      expect(result).not.toMatch(/événements/);
    });

    it('FR: pvEventsScheduledOnDate count=3 uses plural', () => {
      const result = renderTp('fr', 'pvEventsScheduledOnDate', 3);
      expect(result).toContain('3');
      expect(result).toMatch(/événements/);
    });
  });

  describe('English plural rules', () => {
    it('EN: count=1 selects _one form', () => {
      const rules = new Intl.PluralRules('en');
      expect(rules.select(1)).toBe('one');
    });

    it('EN: count=0 selects _other form', () => {
      const rules = new Intl.PluralRules('en');
      expect(rules.select(0)).toBe('other');
    });

    it('EN: pvOverdueProjectsAlert count=1 uses singular', () => {
      const result = renderTp('en', 'pvOverdueProjectsAlert', 1);
      expect(result).toContain('1');
      expect(result).not.toMatch(/projects/);
    });

    it('EN: pvOverdueProjectsAlert count=0 uses plural', () => {
      const result = renderTp('en', 'pvOverdueProjectsAlert', 0);
      expect(result).toContain('0');
      expect(result).toMatch(/projects/);
    });

    it('EN: pvProjectsCreatedDesc count=1 uses singular', () => {
      const result = renderTp('en', 'pvProjectsCreatedDesc', 1);
      expect(result).toContain('1');
      expect(result).not.toMatch(/projects/);
    });

    it('EN: pvProjectsCreatedDesc count=5 uses plural', () => {
      const result = renderTp('en', 'pvProjectsCreatedDesc', 5);
      expect(result).toContain('5');
      expect(result).toMatch(/projects/);
    });
  });

  describe('count is always injected as {count} placeholder', () => {
    it('injects count automatically without explicit values arg', () => {
      const result = renderTp('en', 'pvSuggestionsSelectedFooter', 7);
      expect(result).toContain('7');
      expect(result).not.toContain('{count}');
    });

    it('injects count even when extra values are supplied', () => {
      const result = renderTp('en', 'pvOverdueProjectsAlert', 4, { extra: 'ignored' });
      expect(result).toContain('4');
      expect(result).not.toContain('{count}');
    });
  });

  describe('call-site contrast: t() leaves {count} vs tp() fills it', () => {
    it('the raw _other template contains {count}', () => {
      const raw = (translations.en as Record<string, string>)['pvOverdueProjectsAlert_other'];
      expect(raw).toBeDefined();
      expect(raw).toContain('{count}');
    });

    it('tp() correctly substitutes count for pvSuggestionsSelectedFooter', () => {
      const rawTemplate = (translations.en as Record<string, string>)[
        'pvSuggestionsSelectedFooter_other'
      ];
      expect(rawTemplate).toContain('{count}');

      const result = renderTp('en', 'pvSuggestionsSelectedFooter', 3);
      expect(result).toContain('3');
      expect(result).not.toContain('{count}');
    });

    it('tp() correctly substitutes count for pvEventsScheduledOnDate', () => {
      const result = renderTp('en', 'pvEventsScheduledOnDate', 5);
      expect(result).toContain('5');
      expect(result).not.toContain('{count}');
    });
  });

  describe('all migrated keys have both _one and _other in both languages', () => {
    const migratedKeys = [
      'pvOverdueProjectsAlert',
      'pvProjectsCreatedDesc',
      'pvSuggestionsSelectedFooter',
      'pvEventsScheduledOnDate',
      'pvNSelected',
      'pvNActive',
      'pvNCompleted',
      'pdvOverdueProjectsAlert',
      'submissionPreferredCountTemplate',
      'etElementsSelected',
      'etElementsDeletedDesc',
      'projectsSelected',
      'projectsCreatedFromSuggestions',
      'bulkCostUpdateDesc',
      'bulkCostToastUpdatedDesc',
      'bulkResidenceDesc',
      'bulkResidenceToastUpdatedDesc',
      'postWorkSetLifespanToYearsTemplate',
      'postWorkAddYearsToLifespanTemplate',
      'paginationShowingResults',
    ];

    for (const base of migratedKeys) {
      it(`${base} has _one and _other in both languages`, () => {
        for (const lang of ['en', 'fr'] as const) {
          const t = translations[lang] as Record<string, string>;
          expect(t[`${base}_one`]).toBeDefined();
          expect(typeof t[`${base}_one`]).toBe('string');
          expect(t[`${base}_one`].length).toBeGreaterThan(0);
          expect(t[`${base}_other`]).toBeDefined();
          expect(typeof t[`${base}_other`]).toBe('string');
          expect(t[`${base}_other`].length).toBeGreaterThan(0);
        }
      });
    }
  });
});
