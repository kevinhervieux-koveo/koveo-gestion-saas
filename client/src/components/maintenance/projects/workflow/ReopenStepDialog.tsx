import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useReopenTargets, useReopenWorkflowStep } from '@/hooks/useProjectWorkflow';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import type { Translations } from '@/lib/i18n';
import { RotateCcw, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ReopenStepDialogProps {
  projectId: string;
  currentStatus: string;
  onSuccess: () => void;
  disabled?: boolean;
  triggerText?: string;
}

const STATUS_LABEL_KEYS: Record<string, keyof Translations> = {
  planned: 'reopenStepStatusPlanning',
  submission: 'reopenStepStatusVendorSubmission',
  pre_work: 'reopenStepStatusPreWork',
  in_progress: 'reopenStepStatusInProgress',
  post_work: 'reopenStepStatusPostWork',
  completed: 'reopenStepStatusCompleted',
};

export function ReopenStepDialog({ 
  projectId, 
  currentStatus, 
  onSuccess, 
  disabled = false,
  triggerText
}: ReopenStepDialogProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [reason, setReason] = useState('');

  const getStatusLabel = (status: string) => {
    const key = STATUS_LABEL_KEYS[status];
    return key ? t(key) : status;
  };
  const resolvedTriggerText = triggerText ?? t('reopenStepTrigger');

  const { 
    data: allowedTargets = [], 
    isLoading: isLoadingTargets,
    error: targetsError 
  } = useReopenTargets(projectId);
  
  const { mutate: reopenStep, isPending: isReopening } = useReopenWorkflowStep();

  const handleReopen = () => {
    if (!selectedTarget) {
      toast({
        title: t('reopenStepSelectTargetTitle'),
        description: t('reopenStepSelectTargetDesc'),
        variant: 'destructive',
      });
      return;
    }

    reopenStep(
      { 
        projectId, 
        targetStatus: selectedTarget, 
        reason: reason.trim() || undefined 
      },
      {
        onSuccess: () => {
          toast({
            title: t('reopenStepSuccessTitle'),
            description: t('reopenStepSuccessDesc').replace('{phase}', getStatusLabel(selectedTarget)),
          });
          setOpen(false);
          setSelectedTarget('');
          setReason('');
          onSuccess();
        },
        onError: (error: any) => {
          toast({
            title: t('failedToReopenStepTitle'),
            description: error.message || t('reopenStepFailedDesc'),
            variant: 'destructive',
          });
        }
      }
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setSelectedTarget('');
      setReason('');
    }
    setOpen(newOpen);
  };

  const hasTargets = allowedTargets.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline"
          disabled={disabled}
          className="flex items-center gap-2"
          data-testid="button-reopen-step-trigger"
        >
          <RotateCcw className="h-4 w-4" />
          {resolvedTriggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('reopenStepDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('reopenStepDialogDescription')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {targetsError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('reopenStepLoadTargetsFailed')}
              </AlertDescription>
            </Alert>
          ) : !hasTargets && !isLoadingTargets ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('reopenStepNoTargetsAvailable')}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="target-status">{t('reopenStepTargetPhaseLabel')}</Label>
                <Select
                  value={selectedTarget}
                  onValueChange={setSelectedTarget}
                  disabled={isLoadingTargets || isReopening}
                >
                  <SelectTrigger data-testid="select-reopen-target">
                    <SelectValue placeholder={isLoadingTargets ? t('reopenStepLoadingPhasesPlaceholder') : t('reopenStepSelectPhasePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedTargets.map((status: string) => (
                      <SelectItem key={status} value={status}>
                        {getStatusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">{t('reopenStepReasonLabel')}</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('reopenStepReasonPlaceholder')}
                  disabled={isReopening}
                  className="min-h-[80px]"
                  data-testid="textarea-reopen-reason"
                />
              </div>

              {selectedTarget && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{t('reopenStepNoteLabel')}</strong> {t('reopenStepNoteBody').replace('{phase}', getStatusLabel(selectedTarget))}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
            disabled={isReopening}
            data-testid="button-reopen-cancel"
          >
            {t('cancel')}
          </Button>
          <Button 
            onClick={handleReopen}
            disabled={!selectedTarget || isReopening || !hasTargets}
            data-testid="button-reopen-confirm"
          >
            {isReopening ? t('reopenStepReopening') : t('reopenStepReopenToPhase')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}