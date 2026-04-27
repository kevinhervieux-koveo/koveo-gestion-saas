import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createElement } from 'react';
import { LanguageProvider } from '../../../client/src/hooks/use-language.tsx';
import { useLanguage } from '../../../client/src/hooks/use-language.tsx';
import { translations } from '../../../client/src/lib/i18n.ts';

/**
 * A minimal test component that calls t() with the given key and values and
 * renders the result into a <span> so we can assert on it.
 */
function TDisplay({
  keyName,
  values,
}: {
  keyName: keyof typeof translations.en;
  values?: Record<string, string | number>;
}) {
  const { t } = useLanguage();
  return createElement('span', { 'data-testid': 'result' }, t(keyName, values));
}

function renderT(
  lang: 'en' | 'fr',
  keyName: keyof typeof translations.en,
  values?: Record<string, string | number>,
) {
  localStorage.setItem('koveo-language', lang);
  const { unmount } = render(
    createElement(LanguageProvider, null, createElement(TDisplay, { keyName, values })),
  );
  const text = screen.getByTestId('result').textContent ?? '';
  unmount();
  return text;
}

describe('t() placeholder substitution (real helper)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('simple single-placeholder substitution', () => {
    it('replaces {count} with the supplied value', () => {
      const result = renderT('en', 'pvOverdueProjectsAlert_other', { count: 3 });
      expect(result).toContain('3');
      expect(result).not.toContain('{count}');
    });

    it('replaces {name} placeholder in a French string', () => {
      const result = renderT('fr', 'docManagerDocumentCount_other', { count: 5, name: 'Toit' });
      expect(result).toContain('Toit');
      expect(result).not.toContain('{name}');
    });

    it('replaces a numeric value coerced to string', () => {
      const result = renderT('en', 'pvEventsScheduledOnDate_one', { count: 1 });
      expect(result).toContain('1');
      expect(result).not.toContain('{count}');
    });
  });

  describe('multiple placeholders in one string', () => {
    it('replaces {start}, {end}, and {total} in paginationShowingResults_other', () => {
      const result = renderT('en', 'paginationShowingResults_other', {
        start: 1,
        end: 10,
        total: 42,
      });
      expect(result).toContain('1');
      expect(result).toContain('10');
      expect(result).toContain('42');
      expect(result).not.toContain('{start}');
      expect(result).not.toContain('{end}');
      expect(result).not.toContain('{total}');
    });

    it('replaces multiple placeholders in a French pagination string', () => {
      const result = renderT('fr', 'paginationShowingResults_other', {
        start: 11,
        end: 20,
        total: 100,
      });
      expect(result).toContain('11');
      expect(result).toContain('20');
      expect(result).toContain('100');
      expect(result).not.toContain('{start}');
      expect(result).not.toContain('{end}');
      expect(result).not.toContain('{total}');
    });

    it('replaces {planTotal} and {vendorPrice} in wfPaymentMismatchWarning', () => {
      const result = renderT('en', 'wfPaymentMismatchWarning', {
        planTotal: '$1,000',
        vendorPrice: '$1,200',
      });
      expect(result).toContain('$1,000');
      expect(result).toContain('$1,200');
      expect(result).not.toContain('{planTotal}');
      expect(result).not.toContain('{vendorPrice}');
    });
  });

  describe('missing-value fallback', () => {
    it('leaves {placeholder} intact when no values object is provided', () => {
      const result = renderT('en', 'pvOverdueProjectsAlert_other');
      expect(result).toContain('{count}');
    });

    it('leaves {placeholder} intact when the named key is absent from values', () => {
      const result = renderT('en', 'pvOverdueProjectsAlert_other', { wrongKey: 99 });
      expect(result).toContain('{count}');
    });

    it('leaves {placeholder} intact when values object is empty', () => {
      const result = renderT('en', 'pvSuggestionsSelectedFooter_other', {});
      expect(result).toContain('{count}');
    });
  });

  describe('numeric values', () => {
    it('coerces integer to string correctly', () => {
      const result = renderT('en', 'pvEventsScheduledOnDate_other', { count: 0 });
      expect(result).toContain('0');
    });

    it('coerces float to string correctly', () => {
      const result = renderT('en', 'paginationShowingResults_other', {
        start: 1.5,
        end: 10,
        total: 20,
      });
      expect(result).toContain('1.5');
    });
  });

  describe('placeholder regex behaviour', () => {
    it('matches {word} but not { spaced }', () => {
      const regex = /\{(\w+)\}/g;
      expect('{count}'.match(regex)).not.toBeNull();
      expect('{ count }'.match(regex)).toBeNull();
    });

    it('replaces all occurrences of the same placeholder via the real helper', () => {
      const result = renderT('en', 'paginationShowingResults_other', {
        start: 1,
        end: 10,
        total: 10,
      });
      expect(result).not.toContain('{start}');
      expect(result).not.toContain('{end}');
      expect(result).not.toContain('{total}');
    });
  });
});
