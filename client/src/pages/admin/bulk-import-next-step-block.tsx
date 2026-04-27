import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';
import type {
  BulkImportFallbackReason,
  BulkImportItem,
  BulkImportStep,
} from '@shared/schemas/bulk-import';

export const STEP_ORDER: BulkImportStep[] = [
  'upload',
  'screening',
  'sorting',
  'branching',
  'identification',
  'linking',
  'complete',
];

export type AutoStep =
  | 'screening'
  | 'sorting'
  | 'branching'
  | 'identification'
  | 'linking';

export const AUTO_STEPS: ReadonlyArray<AutoStep> = [
  'screening',
  'sorting',
  'branching',
  'identification',
  'linking',
];

export function isAutoStep(step: BulkImportStep): step is AutoStep {
  return (AUTO_STEPS as ReadonlyArray<string>).includes(step);
}

export const STEP_PRE_STATUS: Record<AutoStep, BulkImportItem['status']> = {
  screening: 'pending',
  sorting: 'screened',
  branching: 'sorted',
  identification: 'branched',
  linking: 'identified',
};

export type ItemWithStatus = { status: BulkImportItem['status'] };

/**
 * Returns true when an AI fallback result for `step` is still pending —
 * i.e., the AI failed and the admin has not yet manually resolved it.
 *
 * For `branching`, the admin resolves the fallback by manually setting
 * the branch (`branchManualOverride`).  For `identification`, by
 * manually entering the effective date
 * (`identificationEffectiveDateManualOverride`).  For `screening` and
 * `linking` no manual override exists, so any fallback always blocks.
 *
 * Must stay in sync with `isItemReadyForNextStep` in
 * `bulk-document-import.tsx`.
 */
export function isFallbackPending(
  step: BulkImportStep,
  fallbackReason: BulkImportFallbackReason | null | undefined,
  overrides: {
    branchManualOverride?: boolean | null;
    identificationEffectiveDateManualOverride?: boolean | null;
  },
): boolean {
  if (!fallbackReason) return false;
  if (step === 'branching' && overrides.branchManualOverride) return false;
  if (
    step === 'identification' &&
    overrides.identificationEffectiveDateManualOverride
  )
    return false;
  return true;
}

export function computeStillAnalyzingCount(
  items: ReadonlyArray<ItemWithStatus>,
  currentStep: BulkImportStep,
): number {
  if (!isAutoStep(currentStep)) return 0;
  const preStatus = STEP_PRE_STATUS[currentStep];
  return items.filter((i) => {
    if (i.status === preStatus) return true;
    // Mid-flight: items briefly sit in 'screening' status while the
    // run-all loop is processing them on the screening step.
    if (currentStep === 'screening' && i.status === 'screening') return true;
    return false;
  }).length;
}

export interface NextStepBlockProps {
  items: ReadonlyArray<ItemWithStatus>;
  currentStep: BulkImportStep;
  stepIndex: number;
  isFr: boolean;
  onNext: () => void;
  /** Number of residence_documents items still missing a residence (Task #780). */
  residenceIncompleteCount?: number;
  /**
   * Number of sorting-step items that still have an unresolved decision
   * (decisionState === 'pending' or 'rejected'). When > 0 the Next Step
   * button is blocked (Task #817).
   */
  sortingPendingCount?: number;
  /**
   * Number of items on the current step that still carry an AI fallback
   * (Task #1069). The backend auto-promotes AI-failed files to the next
   * status with a default value (e.g. branch = `building_documents` /
   * `other_documents`) and a `*Fallback` reason set, so the row UI keeps
   * telling the admin to "Vérifiez ce fichier ou excluez-le". Those files
   * have no real human assignation yet, so the Next Step button is blocked
   * until the admin retries, accepts, or excludes each one.
   */
  fallbackPendingCount?: number;
}

export function NextStepBlock({
  items,
  currentStep,
  stepIndex,
  isFr: _isFr,
  onNext,
  residenceIncompleteCount = 0,
  sortingPendingCount = 0,
  fallbackPendingCount = 0,
}: NextStepBlockProps) {
  const { tp, t } = useLanguage();
  const stillAnalyzingCount = computeStillAnalyzingCount(items, currentStep);
  const isNextBlocked =
    stepIndex >= STEP_ORDER.length - 1 ||
    stillAnalyzingCount > 0 ||
    residenceIncompleteCount > 0 ||
    sortingPendingCount > 0 ||
    fallbackPendingCount > 0;
  return (
    <div className="mt-4 flex flex-col items-end gap-2">
      {stillAnalyzingCount > 0 && (
        <p className="text-sm text-amber-700" data-testid="analyzing-warning">
          {tp('bulkImportAnalyzing', stillAnalyzingCount)}
        </p>
      )}
      {residenceIncompleteCount > 0 && (
        <p className="text-sm text-red-700" data-testid="residence-incomplete-warning">
          {tp('bulkImportResidenceIncomplete', residenceIncompleteCount)}
        </p>
      )}
      {sortingPendingCount > 0 && (
        <p className="text-sm text-amber-700" data-testid="sorting-pending-warning">
          {tp('bulkImportBranchingPending', sortingPendingCount)}
        </p>
      )}
      {fallbackPendingCount > 0 && (
        <p className="text-sm text-red-700" data-testid="fallback-pending-warning">
          {tp('bulkImportFallbackPending', fallbackPendingCount)}
        </p>
      )}
      <Button
        variant="outline"
        disabled={isNextBlocked}
        onClick={onNext}
        data-testid="button-next-step"
      >
        {t('bulkImportNextStep')}
      </Button>
    </div>
  );
}
