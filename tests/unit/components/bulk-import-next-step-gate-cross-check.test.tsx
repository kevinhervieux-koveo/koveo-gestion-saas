/**
 * Task #1232 — Cross-check the Next-step gate logic.
 *
 * The bulk-document-import wizard has two pieces of code that must
 * agree about whether an item with an AI fallback blocks the
 * Next-step button:
 *
 *   - `isItemReadyForNextStep` (per-row readiness in
 *     `client/src/pages/admin/bulk-document-import.tsx`) — drives the
 *     filtered residual list shown when the "hide ready" toggle is on.
 *   - `isFallbackPending` (aggregate gate count in
 *     `client/src/pages/admin/bulk-import-next-step-block.tsx`) —
 *     drives `fallbackPendingCount` which disables the Next-step
 *     button at the wizard level.
 *
 * Both functions encode the same manual-override rules:
 *   identification: `identificationEffectiveDateManualOverride` resolves
 *                   the fallback;
 *   branching:      `branchManualOverride` resolves the fallback;
 *   screening / linking: no manual override exists.
 *
 * If a future change touches one without the other, the wizard could
 * either disable Next-step while the residual list is empty (admin
 * stuck with nothing to fix), or enable Next-step while the residual
 * list still shows blocking rows. There was no automated coverage that
 * drove **both** functions with the same item data — this suite closes
 * that gap by feeding a matrix of `BulkImportItemLite` fixtures
 * (identification/branching × fallback present/absent × manual
 * override on/off) to both helpers and asserting their conclusions
 * about whether the item blocks the Next-step button match.
 */

import { describe, it, expect, jest } from '@jest/globals';

// -----------------------------------------------------------------------------
// Module mocks (declared before importing the page under test).
// The page-level component imports a handful of UI helpers that load
// browser-only deps; we don't render anything here, but the page module
// must still parse cleanly so we mock the same set of modules the other
// page-level tests in this directory mock.
// -----------------------------------------------------------------------------

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => key,
    tp: (key: string, _count: number) => key,
    setLanguage: jest.fn(),
  }),
}));

jest.mock('@/components/layout/header', () => ({
  Header: () => null,
}));

jest.mock('@/components/common/DocumentInlineViewer', () => ({
  DocumentInlineViewer: () => null,
}));

import {
  isItemReadyForNextStep,
  type BulkImportItemLite,
} from '@/pages/admin/bulk-document-import';
import { isFallbackPending } from '@/pages/admin/bulk-import-next-step-block';
import type {
  BulkImportFallbackReason,
  BulkImportStep,
} from '@shared/schemas/bulk-import';

// -----------------------------------------------------------------------------
// Fixture builder
// -----------------------------------------------------------------------------

/**
 * The two steps that have a manual-override flag wired into both
 * helpers. Screening and linking are intentionally excluded from the
 * matrix because they have no override path — there is nothing to
 * cross-check against drift there. We still ship a smaller suite for
 * them below to confirm both helpers agree that every fallback blocks.
 */
const OVERRIDABLE_STEPS = ['identification', 'branching'] as const;
type OverridableStep = (typeof OVERRIDABLE_STEPS)[number];

const ALL_FALLBACK_STEPS: ReadonlyArray<BulkImportStep> = [
  'screening',
  'branching',
  'identification',
  'linking',
];

const SAMPLE_REASON: BulkImportFallbackReason = 'api_error';

interface MatrixOverrides {
  branchManualOverride: boolean;
  identificationEffectiveDateManualOverride: boolean;
}

/**
 * Builds a minimally-valid `BulkImportItemLite` whose status is past
 * every step's pre-status. That way the per-row readiness check is
 * gated **only** by the fallback / manual-override rules — exactly the
 * surface area we want to cross-check against `isFallbackPending`.
 *
 * The branch is set to `building_documents` so the residence check on
 * the branching step is a no-op (residence is only required when
 * branch === 'residence_documents').
 */
function makeItem(
  step: OverridableStep,
  hasFallback: boolean,
  overrides: MatrixOverrides,
): BulkImportItemLite {
  return {
    id: `item-${step}-${hasFallback}-${overrides.branchManualOverride}-${overrides.identificationEffectiveDateManualOverride}`,
    originalName: 'doc.pdf',
    mimeType: 'application/pdf',
    // `committed` sits past every pre-status in the lifecycle so the
    // status branch of `isItemReadyForNextStep` always returns true,
    // leaving the fallback gate as the only thing that can block.
    status: 'committed',
    preExcludeStatus: null,
    excludeSource: null,
    screeningConfidence: 1,
    screeningFallback: null,
    screeningDegraded: null,
    screeningRetryCount: 1,
    screeningTypeGuess: null,
    screeningBucketGuess: null,
    screeningQaReason: null,
    screeningPeriodHint: null,
    screeningPeriodHintManualOverride: false,
    screeningParsedPeriodHintDate: null,
    screeningRotationDegrees: 0,
    screeningRotationApplied: false,
    sortingConfidence: 1,
    sortingFallback: null,
    sortingRetryCount: 1,
    sortingDegraded: null,
    sortingDecision: 'keep',
    sortingReason: null,
    sortingMergeWithItemId: null,
    sortingMergeWithItemIds: null,
    sortingSplitAtPage: null,
    sortingDecisionState: 'accepted',
    sortingManualOverride: false,
    sortingDecisionSplitIntoItemIds: null,
    sortingDecisionDraft: false,
    sortingDecisionSplitFinalNames: null,
    finalFileName: null,
    branchingConfidence: 1,
    branchingFallback: step === 'branching' && hasFallback ? SAMPLE_REASON : null,
    branchingRetryCount: 1,
    branchingDegraded: null,
    branch: 'building_documents',
    subCategory: null,
    branchReason: null,
    branchManualOverride: overrides.branchManualOverride,
    residenceId: null,
    residenceConfidence: null,
    residenceReason: null,
    residenceFallbackReason: null,
    residenceManualOverride: false,
    residenceAiSuggestedId: null,
    residenceAiSuggested: false,
    residenceAiConfirmed: false,
    identificationConfidence: 1,
    identificationFallback:
      step === 'identification' && hasFallback ? SAMPLE_REASON : null,
    identificationRetryCount: 1,
    identificationDegraded: null,
    identificationName: 'doc',
    identificationDescription: null,
    identificationTags: null,
    identificationAiSuggestedTagIds: null,
    identificationEffectiveDate: '2025-01-01',
    identificationEffectiveDateManualOverride:
      overrides.identificationEffectiveDateManualOverride,
    linkingConfidence: 1,
    linkingFallback: null,
    linkingRetryCount: 1,
    linkingDegraded: null,
    linkingReason: null,
    linkingBeforeItemId: null,
    linkingAfterItemId: null,
    duplicateOfDocumentId: null,
    duplicateOfDocumentName: null,
    duplicateOfBuildingId: null,
    duplicateOfBuildingName: null,
    duplicateOfResidenceLabel: null,
    duplicateOfDocumentType: null,
    duplicateOfDocumentRemoved: false,
  };
}

function fallbackReasonFor(
  item: BulkImportItemLite,
  step: BulkImportStep,
): BulkImportFallbackReason | null {
  switch (step) {
    case 'screening':
      return item.screeningFallback;
    case 'branching':
      return item.branchingFallback;
    case 'identification':
      return item.identificationFallback;
    case 'linking':
      return item.linkingFallback;
    default:
      return null;
  }
}

// -----------------------------------------------------------------------------
// Matrix
// -----------------------------------------------------------------------------

interface MatrixCase {
  step: OverridableStep;
  hasFallback: boolean;
  overrides: MatrixOverrides;
  /**
   * Expected truth value of "this item blocks the Next-step button
   * because of an unresolved fallback on `step`". Both helpers must
   * agree on this.
   */
  blocks: boolean;
}

function buildMatrix(): MatrixCase[] {
  const cases: MatrixCase[] = [];
  for (const step of OVERRIDABLE_STEPS) {
    for (const hasFallback of [false, true]) {
      for (const branchOverride of [false, true]) {
        for (const idOverride of [false, true]) {
          const overrides: MatrixOverrides = {
            branchManualOverride: branchOverride,
            identificationEffectiveDateManualOverride: idOverride,
          };
          // Only the override that matches `step` resolves the fallback.
          const overrideResolvesFallback =
            (step === 'branching' && branchOverride) ||
            (step === 'identification' && idOverride);
          const blocks = hasFallback && !overrideResolvesFallback;
          cases.push({ step, hasFallback, overrides, blocks });
        }
      }
    }
  }
  return cases;
}

const MATRIX = buildMatrix();

// Sanity-check the matrix shape so a future edit can't silently shrink it.
// 2 steps × 2 (fallback) × 2 (branch override) × 2 (id override) = 16.
if (MATRIX.length !== 16) {
  throw new Error(
    `Expected 16 matrix cases, generator produced ${MATRIX.length}`,
  );
}

describe('Next-step gate cross-check (Task #1232)', () => {
  describe.each(MATRIX)(
    'step=$step hasFallback=$hasFallback overrides=$overrides',
    ({ step, hasFallback, overrides, blocks }) => {
      const item = makeItem(step, hasFallback, overrides);

      it('isItemReadyForNextStep agrees with the expected blocking outcome', () => {
        // Ready means "does NOT block" — invert.
        expect(isItemReadyForNextStep(item, step)).toBe(!blocks);
      });

      it('isFallbackPending agrees with the expected blocking outcome', () => {
        expect(
          isFallbackPending(step, fallbackReasonFor(item, step), {
            branchManualOverride: item.branchManualOverride,
            identificationEffectiveDateManualOverride:
              item.identificationEffectiveDateManualOverride,
          }),
        ).toBe(blocks);
      });

      it('both helpers reach the same conclusion on the same fixture', () => {
        // The whole point of this suite: the per-row readiness check
        // and the aggregate gate count must always agree about whether
        // this item should block the Next-step button.
        const ready = isItemReadyForNextStep(item, step);
        const pending = isFallbackPending(
          step,
          fallbackReasonFor(item, step),
          {
            branchManualOverride: item.branchManualOverride,
            identificationEffectiveDateManualOverride:
              item.identificationEffectiveDateManualOverride,
          },
        );
        expect(ready).toBe(!pending);
      });
    },
  );

  // -----------------------------------------------------------------------
  // Smaller cross-check for the no-override steps. Screening and linking
  // expose no manual-override flag, so every fallback must block in
  // both helpers regardless of which override flags happen to be set.
  // -----------------------------------------------------------------------
  describe.each(['screening', 'linking'] as const)(
    'no-override step "%s"',
    (step) => {
      it.each([
        { branchManualOverride: false, identificationEffectiveDateManualOverride: false },
        { branchManualOverride: true, identificationEffectiveDateManualOverride: true },
      ])(
        'a fallback always blocks regardless of overrides=%j',
        (overrides) => {
          // Build the item with an identification override turned on as
          // a foil: it must NOT leak into the screening / linking gate.
          const item: BulkImportItemLite = {
            ...makeItem('identification', false, overrides),
            screeningFallback: step === 'screening' ? SAMPLE_REASON : null,
            linkingFallback: step === 'linking' ? SAMPLE_REASON : null,
          };
          expect(isItemReadyForNextStep(item, step)).toBe(false);
          expect(
            isFallbackPending(step, fallbackReasonFor(item, step), {
              branchManualOverride: item.branchManualOverride,
              identificationEffectiveDateManualOverride:
                item.identificationEffectiveDateManualOverride,
            }),
          ).toBe(true);
        },
      );

      it('no fallback never blocks for either helper', () => {
        const item = makeItem('identification', false, {
          branchManualOverride: false,
          identificationEffectiveDateManualOverride: false,
        });
        expect(isItemReadyForNextStep(item, step)).toBe(true);
        expect(
          isFallbackPending(step, fallbackReasonFor(item, step), {
            branchManualOverride: item.branchManualOverride,
            identificationEffectiveDateManualOverride:
              item.identificationEffectiveDateManualOverride,
          }),
        ).toBe(false);
      });
    },
  );

  // Coverage assertion: the matrix must exercise every combination.
  // Without this, a future edit could remove a leg of the truth table
  // and the suite would still pass on the survivors.
  it('exercises all 16 combinations of the (step × fallback × overrides) matrix', () => {
    const seen = new Set<string>();
    for (const c of MATRIX) {
      seen.add(
        `${c.step}|${c.hasFallback}|${c.overrides.branchManualOverride}|${c.overrides.identificationEffectiveDateManualOverride}`,
      );
    }
    expect(seen.size).toBe(16);
  });
});
