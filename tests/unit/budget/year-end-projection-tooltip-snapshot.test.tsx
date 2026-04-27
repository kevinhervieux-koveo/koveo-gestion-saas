/**
 * @file Year-end projection tooltip — rendered component snapshot
 * @description Snapshot test for the `YearEndProjectionTooltipContent` component
 * extracted from the budget page.  Covers Task #1311 requirement (4): verify
 * the tooltip renders the correct markup when a project's fiscal year changes,
 * locking in the DOM structure so any future copy or layout change is an
 * explicit, reviewed action.
 *
 * Two scenarios are captured:
 *  (a) Calendar-year FY (Jan 1 start) — mid-year reference date
 *  (b) Non-Jan FY (July 1 start) — project FY changed, now pointing to the
 *      next fiscal year
 */

import React from 'react';
import { describe, it, expect } from '@jest/globals';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { YearEndProjectionTooltipContent } from '../../../client/src/pages/manager/budget/YearEndProjectionTooltipContent';
import {
  getFiscalYearEnd,
  getMonthsRemainingToFiscalYearEnd,
} from '../../../client/src/lib/budget/year-end-projection';
import { getFinancialYearRange } from '../../../client/src/utils/financial-year';
import { translations } from '../../../client/src/lib/i18n';

const en = translations.en;

function buildFyEndLabel(fyEndMonth: number, fyEndYear: number): string {
  const date = new Date(fyEndYear, fyEndMonth - 1, 1);
  return date.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
}

describe('YearEndProjectionTooltipContent — rendered snapshot', () => {
  it('renders the tooltip for a calendar-year FY (Jan 1 start) — mid-year, label "2026-2027"', () => {
    const financialYearStart = '2026-01-01';
    const today = new Date(2026, 4, 15); // May 15 2026
    const { label: activeFYLabel } = getFinancialYearRange(financialYearStart, today);
    const { fyEndMonth, fyEndYear } = getFiscalYearEnd(today, financialYearStart);
    const monthsRemaining = getMonthsRemainingToFiscalYearEnd(today, financialYearStart);
    const fyEndLabel = buildFyEndLabel(fyEndMonth, fyEndYear);

    const { container } = render(
      <YearEndProjectionTooltipContent
        activeFiscalYearLabel={activeFYLabel}
        fyEndLabel={fyEndLabel}
        monthsRemaining={monthsRemaining}
        activeFiscalYearTitle={en.budgetYearEndProjectionActiveFiscalYearLabel}
        fiscalYearEndTitle={en.budgetYearEndProjectionFiscalYearEndLabel}
        monthsRemainingTitle={en.budgetYearEndProjectionMonthsRemainingLabel}
        monthsRemainingUnit={en.budgetYearEndProjectionMonthsRemainingUnit}
        explanationText={en.budgetYearEndProjectionTooltip}
      />,
    );

    expect(container.firstChild).toMatchInlineSnapshot(`
<div
  class="space-y-1"
>
  <div
    data-testid="tooltip-year-end-projection-active-fy"
  >
    <span
      class="font-medium"
    >
      Active fiscal year
      :
    </span>
     
    2026-2027
  </div>
  <div
    data-testid="tooltip-year-end-projection-fy-end"
  >
    <span
      class="font-medium"
    >
      Fiscal year-end
      :
    </span>
     
    December 2026
  </div>
  <div
    data-testid="tooltip-year-end-projection-months-remaining"
  >
    <span
      class="font-medium"
    >
      Months remaining
      :
    </span>
     
    7
     
    months
  </div>
  <div
    data-testid="tooltip-year-end-projection-explanation"
  >
    Balance projected at the end of the fiscal year. This value is independent of the chart window length.
  </div>
</div>
`);
  });

  it('renders the tooltip after a project FY change to a non-Jan FY (July 1 start) pointing to next FY', () => {
    const financialYearStart = '2025-07-01';
    const today = new Date(2026, 8, 15); // September 15 2026 — now inside FY 2026-2027
    const { label: activeFYLabel } = getFinancialYearRange(financialYearStart, today);
    const { fyEndMonth, fyEndYear } = getFiscalYearEnd(today, financialYearStart);
    const monthsRemaining = getMonthsRemainingToFiscalYearEnd(today, financialYearStart);
    const fyEndLabel = buildFyEndLabel(fyEndMonth, fyEndYear);

    const { container } = render(
      <YearEndProjectionTooltipContent
        activeFiscalYearLabel={activeFYLabel}
        fyEndLabel={fyEndLabel}
        monthsRemaining={monthsRemaining}
        activeFiscalYearTitle={en.budgetYearEndProjectionActiveFiscalYearLabel}
        fiscalYearEndTitle={en.budgetYearEndProjectionFiscalYearEndLabel}
        monthsRemainingTitle={en.budgetYearEndProjectionMonthsRemainingLabel}
        monthsRemainingUnit={en.budgetYearEndProjectionMonthsRemainingUnit}
        explanationText={en.budgetYearEndProjectionTooltip}
      />,
    );

    expect(container.firstChild).toMatchInlineSnapshot(`
<div
  class="space-y-1"
>
  <div
    data-testid="tooltip-year-end-projection-active-fy"
  >
    <span
      class="font-medium"
    >
      Active fiscal year
      :
    </span>
     
    2026-2027
  </div>
  <div
    data-testid="tooltip-year-end-projection-fy-end"
  >
    <span
      class="font-medium"
    >
      Fiscal year-end
      :
    </span>
     
    June 2027
  </div>
  <div
    data-testid="tooltip-year-end-projection-months-remaining"
  >
    <span
      class="font-medium"
    >
      Months remaining
      :
    </span>
     
    9
     
    months
  </div>
  <div
    data-testid="tooltip-year-end-projection-explanation"
  >
    Balance projected at the end of the fiscal year. This value is independent of the chart window length.
  </div>
</div>
`);
  });

  it('renders the fallback dash when activeFiscalYearLabel is undefined', () => {
    const { container } = render(
      <YearEndProjectionTooltipContent
        activeFiscalYearLabel={undefined}
        fyEndLabel="December 2026"
        monthsRemaining={7}
        activeFiscalYearTitle={en.budgetYearEndProjectionActiveFiscalYearLabel}
        fiscalYearEndTitle={en.budgetYearEndProjectionFiscalYearEndLabel}
        monthsRemainingTitle={en.budgetYearEndProjectionMonthsRemainingLabel}
        monthsRemainingUnit={en.budgetYearEndProjectionMonthsRemainingUnit}
        explanationText={en.budgetYearEndProjectionTooltip}
      />,
    );

    expect(container.firstChild).toMatchInlineSnapshot(`
<div
  class="space-y-1"
>
  <div
    data-testid="tooltip-year-end-projection-active-fy"
  >
    <span
      class="font-medium"
    >
      Active fiscal year
      :
    </span>
     
    —
  </div>
  <div
    data-testid="tooltip-year-end-projection-fy-end"
  >
    <span
      class="font-medium"
    >
      Fiscal year-end
      :
    </span>
     
    December 2026
  </div>
  <div
    data-testid="tooltip-year-end-projection-months-remaining"
  >
    <span
      class="font-medium"
    >
      Months remaining
      :
    </span>
     
    7
     
    months
  </div>
  <div
    data-testid="tooltip-year-end-projection-explanation"
  >
    Balance projected at the end of the fiscal year. This value is independent of the chart window length.
  </div>
</div>
`);
  });
});
