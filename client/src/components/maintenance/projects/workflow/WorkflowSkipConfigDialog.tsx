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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUpdateSkipFlags, useDeleteProject, type ProjectWorkflowState } from '@/hooks/useProjectWorkflow';
import { Settings, CheckCircle2, Clock, Users, Building2, Wrench, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WorkflowSkipConfigDialogProps {
  projectId: string;
  workflowState: ProjectWorkflowState;
  onUpdate: () => void;
  onDelete?: () => void; // Callback when project is deleted
  isQuickProject?: boolean; // Only quick projects can be deleted
}

const STEP_CONFIG = {
  submission: {
    icon: Users,
    label: 'Submission',
    description: 'Skip vendor submissions and selection phase',
    key: 'skipSubmission' as const,
  },
  pre_work: {
    icon: Building2,
    label: 'Pre-Work',
    description: 'Skip preparation and coordination phase',
    key: 'skipPreWork' as const,
  },
  in_progress: {
    icon: Wrench,
    label: 'In Progress',
    description: 'Skip active work execution phase',
    key: 'skipInProgress' as const,
  },
  post_work: {
    icon: CheckCircle2,
    label: 'Post-Work',
    description: 'Skip cleanup and finalization phase',
    key: 'skipPostWork' as const,
  },
} as const;

/**
 * Dialog for configuring which workflow steps to skip
 */
export function WorkflowSkipConfigDialog({ 
  projectId, 
  workflowState, 
  onUpdate,
  onDelete,
  isQuickProject = false
}: WorkflowSkipConfigDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { mutate: updateSkipFlags, isPending } = useUpdateSkipFlags();
  const { mutate: deleteProject, isPending: isDeleting } = useDeleteProject();

  const handleSkipFlagChange = (stepKey: keyof typeof workflowState.skipFlags, enabled: boolean) => {
    const currentSkipFlags = workflowState.skipFlags || {};
    const newSkipFlags = {
      ...currentSkipFlags,
      [stepKey]: enabled,
    };

    updateSkipFlags(
      {
        projectId,
        skipFlags: newSkipFlags,
      },
      {
        onSuccess: () => {
          onUpdate();
          // Force a small delay to ensure state updates properly
          setTimeout(() => {
            onUpdate();
          }, 100);
        },
      }
    );
  };

  const handleDeleteProject = () => {
    deleteProject(projectId, {
      onSuccess: () => {
        setShowDeleteConfirm(false);
        setIsOpen(false);
        if (onDelete) {
          onDelete();
        }
      },
    });
  };

  const getStepStatus = (stepId: string) => {
    const currentIndex = ['planned', 'submission', 'pre_work', 'in_progress', 'post_work', 'completed'].indexOf(workflowState.currentStatus);
    const stepIndex = ['planned', 'submission', 'pre_work', 'in_progress', 'post_work', 'completed'].indexOf(stepId);
    
    if (stepIndex < currentIndex) {
      return 'completed';
    } else if (stepIndex === currentIndex) {
      return 'current';
    } else {
      return 'upcoming';
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          data-testid="button-workflow-config"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="workflow-skip-config-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Workflow Configuration
          </DialogTitle>
          <DialogDescription>
            Configure which workflow steps to skip for this project. Skipped steps will be automatically bypassed during progression.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {Object.entries(STEP_CONFIG).map(([stepId, config]) => {
            const Icon = config.icon;
            const stepStatus = getStepStatus(stepId);
            const skipFlags = workflowState.skipFlags || {};
            const isSkipped = skipFlags[config.key] || false;
            const canToggle = stepStatus !== 'completed';

            return (
              <Card
                key={stepId}
                className={cn(
                  "relative transition-colors",
                  stepStatus === 'completed' && "bg-green-50 border-green-200",
                  stepStatus === 'current' && "bg-blue-50 border-blue-200",
                  isSkipped && stepStatus !== 'completed' && "bg-gray-50 border-gray-300"
                )}
                data-testid={`skip-config-${stepId}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className={cn(
                        "h-5 w-5",
                        stepStatus === 'completed' && "text-green-600",
                        stepStatus === 'current' && "text-blue-600",
                        stepStatus === 'upcoming' && "text-gray-400"
                      )} />
                      <div>
                        <CardTitle className="text-base">{config.label}</CardTitle>
                        <CardDescription className="text-sm">
                          {config.description}
                        </CardDescription>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {stepStatus === 'completed' && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Completed
                        </span>
                      )}
                      {stepStatus === 'current' && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          Current
                        </span>
                      )}
                      {isSkipped && stepStatus !== 'completed' && (
                        <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                          Skipped
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <Label 
                      htmlFor={`skip-${stepId}`}
                      className={cn(
                        "text-sm",
                        !canToggle && "text-gray-400"
                      )}
                    >
                      {isSkipped ? 'Skip this step' : 'Include this step'}
                    </Label>
                    <Switch
                      key={`${projectId}-${config.key}-${isSkipped}`}
                      id={`skip-${stepId}`}
                      checked={isSkipped}
                      disabled={!canToggle || isPending}
                      onCheckedChange={(checked) => handleSkipFlagChange(config.key, checked)}
                      data-testid={`switch-skip-${stepId}`}
                    />
                  </div>
                  
                  {!canToggle && (
                    <p className="text-xs text-gray-500 mt-2">
                      This step has already been completed and cannot be modified.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-3">
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={() => setShowDeleteConfirm(true)}
              data-testid="button-delete-project"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </Button>

            <div className="text-sm text-muted-foreground">
              Changes are applied immediately
            </div>
          </div>
          
          <Button onClick={() => setIsOpen(false)} data-testid="button-close-config">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Rendered at top level so the nested AlertDialog does not conflict with the
        outer Dialog's focus/overlay management (radix-ui modal interaction bug). */}
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Project</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to permanently delete this project? This action cannot be undone.
            All project data, tasks, vendor submissions, and workflow history will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteProject}
            className="bg-red-600 hover:bg-red-700"
            data-testid="confirm-delete-project"
          >
            Delete Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}