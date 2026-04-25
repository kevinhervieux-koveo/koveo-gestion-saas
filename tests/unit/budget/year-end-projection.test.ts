/**
 * @file Year-end projection helpers tests
 * @description Locks in the fiscal-year-end derivation used by the
 * "Year End Projection" card on the budget page. The card looks up the
 * forecast balance at `fyEndMonth` / `fyEndYear`, completely independent
 * of the user-selected chart window length. These tests cover the three
 * critical reference dates called out in the task description:
 *  - First day of the fiscal year (FY starting Jan 1)
 *  - Last day of the fiscal year
 *  - A mid-year reference date crossing a non-Jan FY boundary
 *
 * It also includes a snapshot of the bilingual tooltip i18n strings so
 * any future copy change is an explicit, reviewed action.
 */

import { describe, it, expect } from '@jest/globals';
import {
  getFiscalYearEnd,
  getMonthsRemainingToFiscalYearEnd,
} from '../../../client/src/lib/budget/year-end-projection';
import { translations } from '../../../client/src/lib/i18n';

describe('getFiscalYearEnd', () => {
  it('FY starting January 1 → FY-end is December of the same calendar year', () => {
    // First day of the fiscal year.
    expect(getFiscalYearEnd(new Date(2026, 0, 1), '2025-01-01')).toEqual({
      fyEndMonth: 12,
      fyEndYear: 2026,
    });

    // Last day of the fiscal year still resolves to the SAME fiscal year.
    expect(getFiscalYearEnd(new Date(2026, 11, 31), '2025-01-01')).toEqual({
      fyEndMonth: 12,
      fyEndYear: 2026,
    });

    // Mid-year reference date inside the same FY.
    expect(getFiscalYearEnd(new Date(2026, 5, 15), '2025-01-01')).toEqual({
      fyEndMonth: 12,
      fyEndYear: 2026,
    });
  });

  it('FY starting July 1 → FY-end is June of the next calendar year', () => {
    // First day of the FY: today = July 1 2026, FY ends June 30 2027.
    expect(getFiscalYearEnd(new Date(2026, 6, 1), '2026-07-01')).toEqual({
      fyEndMonth: 6,
      fyEndYear: 2027,
    });

    // Last day of the FY: today = June 30 2027, still inside the FY that
    // started July 1 2026 → FY-end stays June 2027.
    expect(getFiscalYearEnd(new Date(2027, 5, 30), '2026-07-01')).toEqual({
      fyEndMonth: 6,
      fyEndYear: 2027,
    });
  });

  it('mid-year reference date crossing a non-Jan FY boundary picks the correct FY', () => {
    // FY starts July 1. Today = March 15 2026 → still inside FY that
    // started July 1 2025 → FY-end is June 2026.
    expect(getFiscalYearEnd(new Date(2026, 2, 15), '2025-07-01')).toEqual({
      fyEndMonth: 6,
      fyEndYear: 2026,
    });

    // Same FY-start string, but today = September 15 2026 → now inside
    // the FY that started July 1 2026 → FY-end is June 2027.
    expect(getFiscalYearEnd(new Date(2026, 8, 15), '2025-07-01')).toEqual({
      fyEndMonth: 6,
      fyEndYear: 2027,
    });
  });

  it('falls back to December of the current calendar year when financialYearStart is missing or malformed', () => {
    const today = new Date(2026, 4, 15); // May 15 2026
    expect(getFiscalYearEnd(today, undefined)).toEqual({
      fyEndMonth: 12,
      fyEndYear: 2026,
    });
    expect(getFiscalYearEnd(today, null)).toEqual({
      fyEndMonth: 12,
      fyEndYear: 2026,
    });
    expect(getFiscalYearEnd(today, 'not-a-date')).toEqual({
      fyEndMonth: 12,
      fyEndYear: 2026,
    });
    expect(getFiscalYearEnd(today, '2025-13-01')).toEqual({
      fyEndMonth: 12,
      fyEndYear: 2026,
    });
  });
});

describe('getMonthsRemainingToFiscalYearEnd', () => {
  it('returns 0 when today IS the fiscal-year-end month', () => {
    // Calendar FY (starts Jan 1), today is December → FY-end is December → 0 remaining.
    expect(
      getMonthsRemainingToFiscalYearEnd(new Date(2026, 11, 5), '2025-01-01'),
    ).toBe(0);
  });

  it('returns the correct count for a calendar FY mid-year reference date', () => {
    // FY ends December 2026, today is May 2026 → 7 months remaining.
    expect(
      getMonthsRemainingToFiscalYearEnd(new Date(2026, 4, 1), '2025-01-01'),
    ).toBe(7);
  });

  it('returns the correct count across a non-Jan FY boundary', () => {
    // FY starts July 1. Today = March 15 2026 → FY-end June 2026 → 3 months.
    expect(
      getMonthsRemainingToFiscalYearEnd(new Date(2026, 2, 15), '2025-07-01'),
    ).toBe(3);

    // Today = September 15 2026 → FY-end June 2027 → 9 months.
    expect(
      getMonthsRemainingToFiscalYearEnd(new Date(2026, 8, 15), '2025-07-01'),
    ).toBe(9);
  });
});

describe('budget tooltip i18n strings (snapshot)', () => {
  it('matches the expected English copy for the projection-card and Length tooltips', () => {
    expect({
      tooltip: translations.en.budgetYearEndProjectionTooltip,
      fiscalYearEndLabel:
        translations.en.budgetYearEndProjectionFiscalYearEndLabel,
      monthsRemainingLabel:
        translations.en.budgetYearEndProjectionMonthsRemainingLabel,
      monthsRemainingUnit:
        translations.en.budgetYearEndProjectionMonthsRemainingUnit,
      lengthTooltip: translations.en.budgetLengthTooltip,
    }).toMatchInlineSnapshot(`
{
  "fiscalYearEndLabel": "Fiscal year-end",
  "lengthTooltip": "Controls the chart display horizon only. Does not affect the year-end projection.",
  "monthsRemainingLabel": "Months remaining",
  "monthsRemainingUnit": "months",
  "tooltip": "Balance projected at the end of the fiscal year. This value is independent of the chart window length.",
}
`);
  });

  it('matches the expected French copy for the projection-card and Length tooltips', () => {
    expect({
      tooltip: translations.fr.budgetYearEndProjectionTooltip,
      fiscalYearEndLabel:
        translations.fr.budgetYearEndProjectionFiscalYearEndLabel,
      monthsRemainingLabel:
        translations.fr.budgetYearEndProjectionMonthsRemainingLabel,
      monthsRemainingUnit:
        translations.fr.budgetYearEndProjectionMonthsRemainingUnit,
      lengthTooltip: translations.fr.budgetLengthTooltip,
    }).toMatchInlineSnapshot(`
{
  "fiscalYearEndLabel": "Fin de l'exercice",
  "lengthTooltip": "Contrôle uniquement la fenêtre d'affichage du graphique. N'affecte pas la projection de fin d'exercice.",
  "monthsRemainingLabel": "Mois restants",
  "monthsRemainingUnit": "mois",
  "tooltip": "Solde projeté à la fin de l'exercice financier. Cette valeur est indépendante de la durée affichée dans le graphique.",
}
`);
  });
});
