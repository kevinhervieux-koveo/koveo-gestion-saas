/**
 * @file Registration wizard tests
 *
 * Locks in the progress-percentage contract fixed in Task #155:
 * step N of N_total shows Math.round((N / N_total) * 100) %, derived
 * from the active step index (not the count of completed steps).
 * A regression here previously made "step 2 of 4" read "25% terminé".
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  RegistrationWizard,
  WizardStep,
  WizardStepProps,
} from '../../../client/src/components/auth/registration-wizard';

jest.mock('../../../client/src/hooks/use-language', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    currentLanguage: 'fr',
  }),
}));

describe('Registration Wizard Tests', () => {
  test('should validate registration components exist', async () => {
    const wizardModule = await import('../../../client/src/components/auth/registration-wizard');
    expect(wizardModule.RegistrationWizard).toBeDefined();
  });

  test('should validate invitation schema exists', async () => {
    const schemaModule = await import('../../../shared/schema');
    expect(schemaModule.insertInvitationSchema).toBeDefined();
  });

  describe('progress percentage contract (Task #155)', () => {
    /**
     * Minimal step component: auto-reports `isValid=true` so the
     * wizard's "Suivant" button is enabled and we can navigate
     * step-by-step.
     */
    function AlwaysValidStep({ onValidationChange, isActive }: WizardStepProps) {
      React.useEffect(() => {
        if (isActive) {
          onValidationChange(true);
        }
      }, [isActive, onValidationChange]);
      return <div data-testid='step-body' />;
    }

    const buildSteps = (count: number): WizardStep[] =>
      Array.from({ length: count }, (_, i) => ({
        id: `step-${i + 1}`,
        title: `Step ${i + 1}`,
        description: `Description ${i + 1}`,
        component: AlwaysValidStep,
        isComplete: false,
        isValid: false,
      }));

    const renderWizard = (stepCount: number) =>
      render(
        <RegistrationWizard
          steps={buildSteps(stepCount)}
          onComplete={jest.fn()}
          onCancel={jest.fn()}
        />
      );

    const clickNext = () => {
      const nextButton = screen.getByRole('button', { name: /Suivant/i });
      // onValidationChange fires in a useEffect on mount; flush it.
      act(() => {
        fireEvent.click(nextButton);
      });
    };

    /**
     * Radix Progress renders two elements: the outer `role="progressbar"`
     * root and an inner indicator whose width is driven by
     * `transform: translateX(-{100 - value}%)`. In jsdom the root shows
     * `data-state="indeterminate"`, so we assert on the indicator's
     * transform (which directly reflects the `value` prop passed by
     * the wizard) to verify the rendered bar width.
     */
    const expectProgressBarReflects = (expectedPct: number) => {
      const progressRoot = document.querySelector('[role="progressbar"]');
      expect(progressRoot).not.toBeNull();
      const indicator = progressRoot!.firstElementChild as HTMLElement | null;
      expect(indicator).not.toBeNull();
      expect(indicator!.style.transform).toBe(`translateX(-${100 - expectedPct}%)`);
    };

    test.each([
      [1, 25],
      [2, 50],
      [3, 75],
    ])('step %i of 4 shows %i%% and matching progress bar width', (stepNumber, expectedPct) => {
      renderWizard(4);

      for (let i = 1; i < stepNumber; i++) {
        clickNext();
      }

      expect(
        screen.getByText(new RegExp(`Étape ${stepNumber} sur 4 • ${expectedPct}% terminé`))
      ).toBeInTheDocument();

      expectProgressBarReflects(expectedPct);
    });

    test('step 4 of 4 shows 100% and the final button is "Terminer"', () => {
      renderWizard(4);
      clickNext();
      clickNext();
      clickNext();

      expect(
        screen.getByText(/Étape 4 sur 4 • 100% terminé/)
      ).toBeInTheDocument();
      expectProgressBarReflects(100);

      expect(screen.getByRole('button', { name: /Terminer/i })).toBeInTheDocument();
    });

    test('formula is (currentStepIndex + 1) / total, not completed-step count', () => {
      // With a 2-step wizard, step 1 must read 50% (not 0%) - that's
      // the exact regression the Task #155 fix addresses.
      renderWizard(2);
      expect(screen.getByText(/Étape 1 sur 2 • 50% terminé/)).toBeInTheDocument();
      expectProgressBarReflects(50);
    });
  });
});
