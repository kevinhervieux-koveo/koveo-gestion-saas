/**
 * @file YearEndProjectionTooltipContent — RTL tests
 * @description Verifies that the "Projection de fin d'exercice" tooltip
 * renders the fiscal-year-end date, months remaining, and explanation
 * copy with the correct data-testid attributes.
 *
 * The component is a pure presentational component so no mocks are
 * needed — we simply pass props and assert on the rendered output.
 */

import React from 'react';
import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { YearEndProjectionTooltipContent } from '../../../client/src/pages/manager/budget/YearEndProjectionTooltipContent';

describe('YearEndProjectionTooltipContent', () => {
  const defaultProps = {
    activeFiscalYearLabel: '2025-2026',
    fyEndLabel: 'mars 2026',
    monthsRemaining: 11,
    activeFiscalYearTitle: 'Exercice actif',
    fiscalYearEndTitle: "Fin de l'exercice",
    monthsRemainingTitle: 'Mois restants',
    monthsRemainingUnit: 'mois',
    explanationText:
      "Projection du solde bancaire à la fin de l'exercice fiscal en cours.",
  };

  it('renders the active fiscal year label', () => {
    render(<YearEndProjectionTooltipContent {...defaultProps} />);
    const el = screen.getByTestId('tooltip-year-end-projection-active-fy');
    expect(el).toHaveTextContent('2025-2026');
    expect(el).toHaveTextContent('Exercice actif');
  });

  it('renders the fiscal year-end date', () => {
    render(<YearEndProjectionTooltipContent {...defaultProps} />);
    const el = screen.getByTestId('tooltip-year-end-projection-fy-end');
    expect(el).toHaveTextContent('mars 2026');
    expect(el).toHaveTextContent("Fin de l'exercice");
  });

  it('renders the months remaining count and unit', () => {
    render(<YearEndProjectionTooltipContent {...defaultProps} />);
    const el = screen.getByTestId('tooltip-year-end-projection-months-remaining');
    expect(el).toHaveTextContent('11');
    expect(el).toHaveTextContent('mois');
    expect(el).toHaveTextContent('Mois restants');
  });

  it('renders the explanation copy', () => {
    render(<YearEndProjectionTooltipContent {...defaultProps} />);
    const el = screen.getByTestId('tooltip-year-end-projection-explanation');
    expect(el).toHaveTextContent(
      "Projection du solde bancaire à la fin de l'exercice fiscal en cours.",
    );
  });

  it('shows an em-dash when activeFiscalYearLabel is null', () => {
    render(
      <YearEndProjectionTooltipContent {...defaultProps} activeFiscalYearLabel={null} />,
    );
    const el = screen.getByTestId('tooltip-year-end-projection-active-fy');
    expect(el).toHaveTextContent('—');
  });

  it('shows an em-dash when activeFiscalYearLabel is undefined', () => {
    render(
      <YearEndProjectionTooltipContent {...defaultProps} activeFiscalYearLabel={undefined} />,
    );
    const el = screen.getByTestId('tooltip-year-end-projection-active-fy');
    expect(el).toHaveTextContent('—');
  });

  it('reflects different monthsRemaining values correctly', () => {
    render(<YearEndProjectionTooltipContent {...defaultProps} monthsRemaining={3} />);
    const el = screen.getByTestId('tooltip-year-end-projection-months-remaining');
    expect(el).toHaveTextContent('3');
  });

  it('uses English labels when English translations are supplied', () => {
    render(
      <YearEndProjectionTooltipContent
        activeFiscalYearLabel="2025-2026"
        fyEndLabel="March 2026"
        monthsRemaining={11}
        activeFiscalYearTitle="Active fiscal year"
        fiscalYearEndTitle="Fiscal year-end"
        monthsRemainingTitle="Months remaining"
        monthsRemainingUnit="months"
        explanationText="Projected bank balance at the end of the current fiscal year."
      />,
    );
    expect(screen.getByTestId('tooltip-year-end-projection-fy-end')).toHaveTextContent(
      'March 2026',
    );
    expect(
      screen.getByTestId('tooltip-year-end-projection-months-remaining'),
    ).toHaveTextContent('months');
    expect(
      screen.getByTestId('tooltip-year-end-projection-explanation'),
    ).toHaveTextContent('Projected bank balance at the end of the current fiscal year.');
  });
});
