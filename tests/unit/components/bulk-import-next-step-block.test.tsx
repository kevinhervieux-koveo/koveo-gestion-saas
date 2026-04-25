import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  AUTO_STEPS,
  NextStepBlock,
  STEP_ORDER,
  STEP_PRE_STATUS,
  computeStillAnalyzingCount,
  type AutoStep,
} from '../../../client/src/pages/admin/bulk-import-next-step-block';
import type {
  BulkImportItem,
  BulkImportStep,
} from '../../../shared/schemas/bulk-import';

/**
 * Locks down the client-side guard added in Task #748: the "Next step"
 * button on the bulk-document-import page must stay disabled (and a
 * matching amber warning must appear) while at least one non-excluded
 * item is still in the pre-step status for the current AI auto-run
 * step. Excluded (rejected) items must never block the button, and
 * once every item has moved past the pre-step status the button must
 * become enabled again.
 *
 * Without this suite the original guard could regress silently — there
 * was no automated coverage when the guard shipped.
 */

type Status = BulkImportItem['status'];

function makeItem(status: Status): { status: Status } {
  return { status };
}

function indexOfStep(step: BulkImportStep): number {
  return STEP_ORDER.indexOf(step);
}

function renderBlock(
  items: ReadonlyArray<{ status: Status }>,
  step: BulkImportStep,
  opts: { isFr?: boolean; onNext?: () => void } = {},
) {
  const onNext = opts.onNext ?? jest.fn();
  render(
    <NextStepBlock
      items={items}
      currentStep={step}
      stepIndex={indexOfStep(step)}
      isFr={opts.isFr ?? false}
      onNext={onNext}
    />,
  );
  return { onNext };
}

describe('NextStepBlock — still-analyzing guard', () => {
  describe.each(AUTO_STEPS)('on auto-run step "%s"', (step) => {
    const preStatus = STEP_PRE_STATUS[step as AutoStep];

    it('disables Next step and shows the amber warning when one non-excluded item is still in the pre-step status', () => {
      renderBlock([makeItem(preStatus), makeItem('committed')], step);

      const button = screen.getByTestId('button-next-step');
      expect(button).toBeDisabled();

      const warning = screen.getByTestId('analyzing-warning');
      expect(warning).toHaveTextContent(
        '1 document(s) are still being analyzed',
      );
      expect(warning).toHaveClass('text-amber-700');
    });

    it('does not count rejected (excluded) items as still analyzing', () => {
      // Two rejected items that *would* otherwise be in the pre-step
      // status — they were excluded by the admin and must not block.
      renderBlock(
        [makeItem('rejected'), makeItem('rejected'), makeItem('committed')],
        step,
      );

      expect(screen.getByTestId('button-next-step')).toBeEnabled();
      expect(screen.queryByTestId('analyzing-warning')).toBeNull();
    });

    it('enables Next step once every item has moved past the pre-step status', () => {
      // Pick a status strictly after `preStatus` in the lifecycle so we
      // can be sure the guard releases.
      const movedOn: Status = 'committed';
      const { onNext } = renderBlock(
        [makeItem(movedOn), makeItem(movedOn)],
        step,
      );

      const button = screen.getByTestId('button-next-step');
      expect(button).toBeEnabled();
      expect(screen.queryByTestId('analyzing-warning')).toBeNull();

      fireEvent.click(button);
      expect(onNext).toHaveBeenCalledTimes(1);
    });
  });

  it('also treats the in-flight "screening" status as analyzing on the screening step', () => {
    // Special-case in the guard: while the run-all loop is mid-flight
    // the row briefly sits in `screening` (not the pre-status `pending`).
    renderBlock([makeItem('screening')], 'screening');

    expect(screen.getByTestId('button-next-step')).toBeDisabled();
    expect(screen.getByTestId('analyzing-warning')).toBeInTheDocument();
  });

  it('renders the French copy when isFr is true', () => {
    renderBlock([makeItem('pending')], 'screening', { isFr: true });

    const warning = screen.getByTestId('analyzing-warning');
    expect(warning).toHaveTextContent("encore en cours d'analyse");
    expect(screen.getByTestId('button-next-step')).toHaveTextContent(
      'Étape suivante',
    );
  });

  it('reports the actual count when multiple items are still pre-status', () => {
    renderBlock(
      [makeItem('pending'), makeItem('pending'), makeItem('pending')],
      'screening',
    );
    expect(screen.getByTestId('analyzing-warning')).toHaveTextContent(
      '3 document(s) are still being analyzed',
    );
  });

  it('does not render the warning when there are no items (button still enabled)', () => {
    renderBlock([], 'screening');
    expect(screen.queryByTestId('analyzing-warning')).toBeNull();
    expect(screen.getByTestId('button-next-step')).toBeEnabled();
  });

  it('disables Next step on the terminal "complete" step regardless of items', () => {
    // `complete` is the last entry in STEP_ORDER — there is no next
    // step to advance to, so the button must stay disabled even
    // though `complete` is not an auto-run step.
    renderBlock([makeItem('committed')], 'complete');
    expect(screen.getByTestId('button-next-step')).toBeDisabled();
    expect(screen.queryByTestId('analyzing-warning')).toBeNull();
  });
});

describe('computeStillAnalyzingCount', () => {
  it('returns 0 for non-auto steps', () => {
    expect(
      computeStillAnalyzingCount(
        [{ status: 'pending' }, { status: 'screened' }],
        'upload',
      ),
    ).toBe(0);
    expect(
      computeStillAnalyzingCount([{ status: 'committed' }], 'complete'),
    ).toBe(0);
  });

  it('counts items in the pre-step status, excluding rejected ones', () => {
    expect(
      computeStillAnalyzingCount(
        [
          { status: 'pending' },
          { status: 'pending' },
          { status: 'rejected' },
          { status: 'screened' },
        ],
        'screening',
      ),
    ).toBe(2);
  });

  it('counts the in-flight "screening" status only on the screening step', () => {
    expect(
      computeStillAnalyzingCount([{ status: 'screening' }], 'screening'),
    ).toBe(1);
    // Same status on a later step is not "still analyzing for this step".
    expect(
      computeStillAnalyzingCount([{ status: 'screening' }], 'sorting'),
    ).toBe(0);
  });

  it('covers every AutoStep in STEP_PRE_STATUS', () => {
    // If a new auto-step is added without wiring its pre-status the
    // guard would silently let users advance — fail fast here.
    const exhaustive: Record<AutoStep, Status> = {
      screening: 'pending',
      sorting: 'screened',
      branching: 'sorted',
      identification: 'branched',
      linking: 'identified',
    };
    for (const step of AUTO_STEPS) {
      expect(STEP_PRE_STATUS[step]).toBe(exhaustive[step]);
    }
  });
});
