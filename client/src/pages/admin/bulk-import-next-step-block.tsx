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
}

export function NextStepBlock({
  items,
  currentStep,
  stepIndex,
  isFr,
  onNext,
}: NextStepBlockProps) {
  const stillAnalyzingCount = computeStillAnalyzingCount(items, currentStep);
  const isNextBlocked =
    stepIndex >= STEP_ORDER.length - 1 || stillAnalyzingCount > 0;
  return (
    <div className="mt-4 flex flex-col items-end gap-2">
      {stillAnalyzingCount > 0 && (
        <p className="text-sm text-amber-700" data-testid="analyzing-warning">
          {isFr
            ? `${stillAnalyzingCount} document(s) sont encore en cours d'analyse. Attendez la fin de l'analyse ou excluez-les pour continuer.`
            : `${stillAnalyzingCount} document(s) are still being analyzed. Wait for them to finish or exclude them to continue.`}
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
