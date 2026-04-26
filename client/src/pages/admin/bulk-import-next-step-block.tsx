import { Button } from '@/components/ui/button';
import type {
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
  return (AUTO_STEPS as readonly string[]).includes(step);
}

export const STEP_PRE_STATUS: Record<AutoStep, BulkImportItem['status']> = {
  screening: 'pending',
  sorting: 'screened',
  branching: 'sorted',
  identification: 'branched',
  linking: 'identified',
};

interface ItemWithStatus {
  status: BulkImportItem['status'];
}

export function computeStillAnalyzingCount(
  items: ReadonlyArray<ItemWithStatus>,
  currentStep: BulkImportStep,
): number {
  if (!isAutoStep(currentStep)) return 0;
  const preStatus = STEP_PRE_STATUS[currentStep];
  return items.filter((item) => {
    if (item.status === 'rejected') return false;
    return (
      item.status === preStatus ||
      (currentStep === 'screening' && item.status === 'screening')
    );
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
  isFr,
  onNext,
  residenceIncompleteCount = 0,
  sortingPendingCount = 0,
  fallbackPendingCount = 0,
}: NextStepBlockProps) {
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
          {isFr
            ? `${stillAnalyzingCount} document(s) sont encore en cours d'analyse. Attendez la fin de l'analyse ou excluez-les pour continuer.`
            : `${stillAnalyzingCount} document(s) are still being analyzed. Wait for them to finish or exclude them to continue.`}
        </p>
      )}
      {residenceIncompleteCount > 0 && (
        <p className="text-sm text-red-700" data-testid="residence-incomplete-warning">
          {isFr
            ? `${residenceIncompleteCount} document(s) de résidence nécessitent une résidence avant de continuer.`
            : `${residenceIncompleteCount} residence document(s) need a residence selected before you can continue.`}
        </p>
      )}
      {sortingPendingCount > 0 && (
        <p className="text-sm text-amber-700" data-testid="sorting-pending-warning">
          {isFr
            ? `${sortingPendingCount} décision(s) de branchement en attente. Acceptez ou choisissez manuellement pour continuer.`
            : `${sortingPendingCount} branching decision(s) need your review. Accept or choose manually to continue.`}
        </p>
      )}
      {fallbackPendingCount > 0 && (
        <p className="text-sm text-red-700" data-testid="fallback-pending-warning">
          {isFr
            ? `${fallbackPendingCount} fichier(s) doivent être assignés manuellement (l'IA n'a pas pu les traiter). Vérifiez-les ou excluez-les pour continuer.`
            : `${fallbackPendingCount} file(s) need a manual assignment (the AI could not process them). Review or exclude them to continue.`}
        </p>
      )}
      <Button
        variant="outline"
        disabled={isNextBlocked}
        onClick={onNext}
        data-testid="button-next-step"
      >
        {isFr ? 'Étape suivante' : 'Next step'}
      </Button>
    </div>
  );
}
