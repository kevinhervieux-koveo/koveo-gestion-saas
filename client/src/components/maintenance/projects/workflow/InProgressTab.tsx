import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  useWorkflowTasks, 
  useWorkflowTaskMutations,
  useMarkStatusComplete,
  type ProjectWorkflowState 
} from '@/hooks/useProjectWorkflow';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { cn, formatStatus } from '@/lib/utils';
import { format } from 'date-fns';
import { ReopenStepDialog } from './ReopenStepDialog';
import { TaskDateInput } from './TaskDateInput';
import { queryClient } from '@/lib/queryClient';
import {
  CheckCircle2,
  Plus,
  Trash2,
  ListChecks,
  DollarSign,
  Info,
  GripVertical,
  Check,
  Clock,
  AlertTriangle,
} from 'lucide-react';

export interface InProgressTabProps {
  project: MaintenanceProject;
  workflowState: ProjectWorkflowState;
  onUpdate: () => void;
  onMarkComplete?: () => void;
}

/**
 * In Progress tab component for active work execution
 * Handles task management and tracking progress
 */
export function InProgressTab({ project, workflowState, onUpdate, onMarkComplete }: InProgressTabProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  
  // Local state for task editing to prevent API calls on every keystroke
  const [localTaskEdits, setLocalTaskEdits] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Defensive null check for project data
  if (!project) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          {/* eslint-disable-next-line i18n/no-untranslated-jsx-strings -- pre-existing untranslated string (task #708): translate in a follow-up */}
          <AlertDescription>
            {t('wfInProgressProjectMissing')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { 
    data: inProgressTasks = [], 
    isLoading: isLoadingTasks 
  } = useWorkflowTasks(project.id, 'in_progress');

  const { createTask, updateTask, deleteTask } = useWorkflowTaskMutations();
  const { mutate: markComplete, isPending: isMarkingComplete } = useMarkStatusComplete();

  // Calculate task completion status
  const completedTasks = inProgressTasks.filter(task => task.isCompleted);
  const totalTasks = inProgressTasks.length;
  const allTasksCompleted = totalTasks > 0 ? completedTasks.length === totalTasks : true;

  const canAdvance = workflowState.canAdvance && workflowState.currentStatus === 'in_progress' && allTasksCompleted;

  // Save all pending changes
  const handleSaveChanges = () => {
    Object.entries(localTaskEdits).forEach(([taskId, updates]) => {
      updateTask.mutate({
        projectId: project.id,
        taskId,
        updates,
      }, {
        onSuccess: () => {
          setLocalTaskEdits({});
          setHasChanges(false);
          // Invalidate tasks query to refresh data from server
          queryClient.invalidateQueries({ 
            queryKey: ['/api/maintenance/projects', project.id, 'tasks', 'in_progress'] 
          });
        }
      });
    });
  };

  // Handle local task updates (for typing)
  const handleTaskEdit = (taskId: string, field: string, value: any) => {
    setLocalTaskEdits(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        [field]: value
      }
    }));
    setHasChanges(true);
  };

  // Handle immediate task updates (for buttons like completion toggle)
  const handleUpdateTask = (taskId: string, updates: any) => {
    updateTask.mutate({
      projectId: project.id,
      taskId,
      updates,
    });
  };

  // Get the current value for a task field (local edit or original value)
  const getTaskValue = (task: any, field: string) => {
    return localTaskEdits[task.id]?.[field] ?? task[field];
  };


  const handleCreateTask = () => {
    const newTaskIndex = inProgressTasks.length;
    createTask.mutate({
      projectId: project.id,
      taskData: {
        phase: 'in_progress',
        taskName: t('inProgressNewWorkTaskDefault'),
        description: undefined,
        cost: undefined,
        orderIndex: newTaskIndex,
        isCompleted: false,
      },
    });
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTask.mutate({
      projectId: project.id,
      taskId,
    });
  };

  const handleMarkComplete = () => {
    // Save any pending changes first
    if (hasChanges && Object.keys(localTaskEdits).length > 0) {
      // Save changes first, then complete phase
      const savePromises = Object.entries(localTaskEdits).map(([taskId, updates]) => 
        new Promise((resolve, reject) => {
          updateTask.mutate({
            projectId: project.id,
            taskId,
            updates,
          }, {
            onSuccess: resolve,
            onError: reject
          });
        })
      );

      Promise.all(savePromises).then(() => {
        setLocalTaskEdits({});
        setHasChanges(false);
        
        // Now complete the phase
        if (onMarkComplete) {
          onMarkComplete();
        } else {
          markComplete({
            projectId: project.id,
            currentStatus: 'in_progress',
          }, {
            onSuccess: () => {
              onUpdate();
            },
          });
        }
      }).catch(() => {
        toast({
          title: t('workflowErrorTitle'),
          description: t('workflowFailedToSavePhaseDescription'),
          variant: "destructive",
        });
      });
    } else {
      // No pending changes, complete directly
      if (onMarkComplete) {
        onMarkComplete();
      } else {
        markComplete({
          projectId: project.id,
          currentStatus: 'in_progress',
        }, {
          onSuccess: () => {
            onUpdate();
          },
        });
      }
    }
  };


  // Check if auto-generated project
  const isAutoGenerated = project.origin === 'auto';
  return (
    <div className="space-y-6" data-testid="in-progress-tab">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{t('inProgressHeader')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('inProgressSubheader')}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Skip option info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>{t('workflowStepCanBeSkipped')}</span>
          </div>
        </div>
      </div>

      {/* Auto-generated project notice */}
      {isAutoGenerated && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">{t('autoGeneratedProjectTitle')}</h4>
              <p className="text-sm text-blue-800 mt-1">
                {t('autoGeneratedProjectDesc')}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6">
          {/* Task Management */}
          <div className="space-y-4">
            <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <ListChecks className="h-5 w-5" />
                        {t('inProgressWorkTasksTitle')}
                      </CardTitle>
                      <CardDescription>
                        {t('inProgressWorkTasksDescription')}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        {t('inProgressTaskCountTemplate').replace('{completed}', String(completedTasks.length)).replace('{total}', String(totalTasks))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCreateTask}
                        disabled={createTask.isPending}
                        data-testid="button-add-work-task"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {t('inProgressAddTaskButton')}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingTasks ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                      ))}
                    </div>
                  ) : inProgressTasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ListChecks className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>{t('inProgressNoWorkTasksDefined')}</p>
                      <p className="text-sm mt-1">{t('inProgressAddTasksHelper')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {inProgressTasks.map((task, index) => (
                        <div key={task.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground mt-1" />
                            <div className="flex-1 space-y-2">
                              <Input
                                value={getTaskValue(task, 'taskName')}
                                onChange={(e) => handleTaskEdit(task.id, 'taskName', e.target.value)}
                                placeholder={t('inProgressTaskDescriptionPlaceholder')}
                                className="font-medium"
                                data-testid={`input-work-task-name-${index}`}
                              />
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={getTaskValue(task, 'cost') || ''}
                                    onChange={(e) => handleTaskEdit(task.id, 'cost', parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-20 text-sm"
                                    data-testid={`input-work-task-cost-${index}`}
                                  />
                                </div>
                                <div className="flex items-center gap-1 w-40">
                                  <TaskDateInput
                                    taskId={task.id}
                                    currentValue={getTaskValue(task, 'dueDate')}
                                    onDateChange={handleTaskEdit}
                                    index={index}
                                    testIdPrefix="work-task"
                                  />
                                </div>
                                <Button
                                  variant={task.isCompleted ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handleUpdateTask(task.id, { isCompleted: !task.isCompleted })}
                                  className="flex items-center gap-1"
                                  data-testid={`button-work-task-toggle-${index}`}
                                >
                                  {task.isCompleted ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                  {task.isCompleted ? t('preWorkTaskDoneBadge') : t('preWorkTaskPendingBadge')}
                                </Button>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-delete-work-task-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Progress Summary */}
              {totalTasks > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t('workflowProgressSummaryTitle')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{t('workflowTasksCompletedLabel')}</span>
                        <span className="font-medium">{completedTasks.length} / {totalTasks}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all" 
                          style={{ width: `${totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0}%` }}
                        />
                      </div>
                      {completedTasks.length === totalTasks && totalTasks > 0 && (
                        <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                          <Check className="h-4 w-4" />
                          {t('workflowAllTasksCompleted')}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 border-t">
          <div className="flex items-center gap-3">
            <ReopenStepDialog
              projectId={project.id}
              currentStatus={workflowState.currentStatus}
              onSuccess={onUpdate}
              triggerText={t('reopenStepTrigger')}
            />
            
            {hasChanges && (
              <Button 
                variant="outline" 
                onClick={handleSaveChanges} 
                disabled={updateTask.isPending}
                data-testid="button-save-changes"
              >
                {updateTask.isPending ? t('workflowSavingButton') : t('workflowSaveChangesButton')}
              </Button>
            )}
            
            <div className="text-sm text-muted-foreground">
              {workflowState.nextStatus && (
                <>{t('workflowNextLabel')} <span className="capitalize">{formatStatus(workflowState.nextStatus)}</span></>
              )}
            </div>
          </div>
          
          {canAdvance && (
            <Button 
              onClick={handleMarkComplete}
              disabled={isMarkingComplete}
              className="flex items-center gap-2"
              data-testid="button-mark-inprogress-complete"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isMarkingComplete ? t('preWorkCompletingButton') : t('inProgressMarkWorkCompleteButton')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}