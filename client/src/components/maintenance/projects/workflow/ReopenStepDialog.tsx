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
import { RotateCcw, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ReopenStepDialogProps {
  projectId: string;
  currentStatus: string;
  onSuccess: () => void;
  disabled?: boolean;
  triggerText?: string;
}

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planning',
  submission: 'Vendor Submission',
  pre_work: 'Pre-Work',
  in_progress: 'In Progress',
  post_work: 'Post-Work',
  completed: 'Completed'
};

export function ReopenStepDialog({ 
  projectId, 
  currentStatus, 
  onSuccess, 
  disabled = false,
  triggerText = 'Reopen Step'
}: ReopenStepDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [reason, setReason] = useState('');

  const { 
    data: allowedTargets = [], 
    isLoading: isLoadingTargets,
    error: targetsError 
  } = useReopenTargets(projectId);
  
  const { mutate: reopenStep, isPending: isReopening } = useReopenWorkflowStep();

  const handleReopen = () => {
    if (!selectedTarget) {
      toast({
        title: 'Please select a target',
        description: 'You must select which phase to reopen to.',
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
            title: 'Step Reopened',
            description: `Successfully reopened to ${STATUS_LABELS[selectedTarget] || selectedTarget} phase.`,
          });
          setOpen(false);
          setSelectedTarget('');
          setReason('');
          onSuccess();
        },
        onError: (error: any) => {
          toast({
            title: 'Failed to Reopen Step',
            description: error.message || 'An error occurred while trying to reopen the step.',
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
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reopen Workflow Step</DialogTitle>
          <DialogDescription>
            Select which previous phase you'd like to reopen to. Your progress in future phases will be preserved.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {targetsError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load available reopen targets. Please try again.
              </AlertDescription>
            </Alert>
          ) : !hasTargets && !isLoadingTargets ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No previous phases available to reopen to. The project must have completed at least one phase to use this feature.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="target-status">Target Phase</Label>
                <Select
                  value={selectedTarget}
                  onValueChange={setSelectedTarget}
                  disabled={isLoadingTargets || isReopening}
                >
                  <SelectTrigger data-testid="select-reopen-target">
                    <SelectValue placeholder={isLoadingTargets ? "Loading phases..." : "Select a phase to reopen to"} />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedTargets.map((status: string) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABELS[status] || status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why you're reopening this step..."
                  disabled={isReopening}
                  className="min-h-[80px]"
                  data-testid="textarea-reopen-reason"
                />
              </div>

              {selectedTarget && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Note:</strong> Reopening to {STATUS_LABELS[selectedTarget] || selectedTarget} will preserve your progress in future phases. You can continue working where you left off.
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
            Cancel
          </Button>
          <Button 
            onClick={handleReopen}
            disabled={!selectedTarget || isReopening || !hasTargets}
            data-testid="button-reopen-confirm"
          >
            {isReopening ? 'Reopening...' : 'Reopen to Phase'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}