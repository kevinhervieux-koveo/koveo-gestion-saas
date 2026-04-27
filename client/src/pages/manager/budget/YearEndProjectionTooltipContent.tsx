import React from 'react';

interface YearEndProjectionTooltipContentProps {
  activeFiscalYearLabel: string | null | undefined;
  fyEndLabel: string;
  monthsRemaining: number;
  activeFiscalYearTitle: string;
  fiscalYearEndTitle: string;
  monthsRemainingTitle: string;
  monthsRemainingUnit: string;
  explanationText: string;
}

export function YearEndProjectionTooltipContent({
  activeFiscalYearLabel,
  fyEndLabel,
  monthsRemaining,
  activeFiscalYearTitle,
  fiscalYearEndTitle,
  monthsRemainingTitle,
  monthsRemainingUnit,
  explanationText,
}: YearEndProjectionTooltipContentProps) {
  return (
    <div className='space-y-1'>
      <div data-testid='tooltip-year-end-projection-active-fy'>
        <span className='font-medium'>{activeFiscalYearTitle}:</span>{' '}
        {activeFiscalYearLabel ?? '—'}
      </div>
      <div data-testid='tooltip-year-end-projection-fy-end'>
        <span className='font-medium'>{fiscalYearEndTitle}:</span>{' '}
        {fyEndLabel}
      </div>
      <div data-testid='tooltip-year-end-projection-months-remaining'>
        <span className='font-medium'>{monthsRemainingTitle}:</span>{' '}
        {monthsRemaining} {monthsRemainingUnit}
      </div>
      <div data-testid='tooltip-year-end-projection-explanation'>
        {explanationText}
      </div>
    </div>
  );
}
