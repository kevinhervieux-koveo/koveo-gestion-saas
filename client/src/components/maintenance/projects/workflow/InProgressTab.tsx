import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  useWorkflowTasks, 
  useWorkflowTaskMutations,
  useMarkStatusComplete,
  useReopenWorkflowStep,
  type ProjectWorkflowState 
} from '@/hooks/useProjectWorkflow';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { useToast } from '@/hooks/use-toast';
import { cn, formatStatus } from '@/lib/utils';
import { format } from 'date-fns';
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
  RotateCcw,
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
  
  // Local state for task editing to prevent API calls on every keystroke
  const [localTaskEdits, setLocalTaskEdits] = useState<Record<string, any>>({});
  const debounceTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  // Defensive null check for project data
  if (!project) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Project data is missing. Unable to load the in-progress tab.
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
  const { mutate: reopenStep, isPending: isReopening } = useReopenWorkflowStep();

  // Calculate task completion status
  const completedTasks = inProgressTasks.filter(task => task.isCompleted);
  const totalTasks = inProgressTasks.length;
  const allTasksCompleted = totalTasks > 0 ? completedTasks.length === totalTasks : true;

  const canAdvance = workflowState.canAdvance && workflowState.currentStatus === 'in_progress' && allTasksCompleted;

  // Debounced save function that only calls API after user stops typing
  const debouncedSaveTask = useCallback((taskId: string, updates: any) => {
    // Clear existing timeout for this task
    if (debounceTimeouts.current[taskId]) {
      clearTimeout(debounceTimeouts.current[taskId]);
    }

    // Set new timeout to save after 500ms of inactivity
    debounceTimeouts.current[taskId] = setTimeout(() => {
      updateTask.mutate({
        projectId: project.id,
        taskId,
        updates,
      }, {
        onSuccess: () => {
          // Clear local edits after successful save
          setLocalTaskEdits(prev => {
            const { [taskId]: removed, ...rest } = prev;
            return rest;
          });
        }
      });
      delete debounceTimeouts.current[taskId];
    }, 500);
  }, [project.id, updateTask]);

  // Handle local task updates (for typing)
  const handleTaskEdit = (taskId: string, field: string, value: any) => {
    setLocalTaskEdits(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        [field]: value
      }
    }));
    
    // Trigger debounced save
    debouncedSaveTask(taskId, { [field]: value });
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

  // Handle blur events to immediately save any pending changes
  const handleTaskBlur = (taskId: string, field: string, value: any) => {
    if (debounceTimeouts.current[taskId]) {
      clearTimeout(debounceTimeouts.current[taskId]);
      delete debounceTimeouts.current[taskId];
      
      // Immediately save on blur
      updateTask.mutate({
        projectId: project.id,
        taskId,
        updates: { [field]: value },
      }, {
        onSuccess: () => {
          // Clear local edits after successful save
          setLocalTaskEdits(prev => {
            const { [taskId]: removed, ...rest } = prev;
            return rest;
          });
        }
      });
    }
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimeouts.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, []);

  const handleCreateTask = () => {
    const newTaskIndex = inProgressTasks.length;
    createTask.mutate({
      projectId: project.id,
      taskData: {
        phase: 'in_progress',
        taskName: 'New Work Task',
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
    if (onMarkComplete) {
      // Use parent modal's completion handler for navigation
      onMarkComplete();
    } else {
      // Fallback to direct completion without navigation
      markComplete({
        projectId: project.id,
        currentStatus: 'in_progress',
      }, {
        onSuccess: () => {
          onUpdate();
        },
      });
    }
  };

  const handleReopen = () => {
    // Validate that we have the required data
    if (!project.id || !workflowState.currentStatus) {
      toast({
        title: "Cannot Reopen Step",
        description: "Workflow data is not available. Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }

    // Validate that current status matches this tab's phase
    if (workflowState.currentStatus !== 'in_progress') {
      toast({
        title: "Cannot Reopen Step",
        description: "This step can only be reopened when the project is currently in the In Progress phase.",
        variant: "destructive",
      });
      return;
    }

    reopenStep(
      { projectId: project.id, currentStatus: workflowState.currentStatus },
      { 
        onSuccess: () => {
          toast({
            title: "Step Reopened",
            description: "Successfully returned to the previous workflow step.",
          });
          onUpdate();
        },
        onError: (error: any) => {
          toast({
            title: "Failed to Reopen Step",
            description: error.message || "An error occurred while trying to reopen the step.",
            variant: "destructive",
          });
        }
      }
    );
  };

  // Check if auto-generated project
  const isAutoGenerated = project.origin === 'auto';
  return (
    <div className="space-y-6" data-testid="in-progress-tab">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Work In Progress</h3>
          <p className="text-sm text-muted-foreground">
            Manage active work execution and track progress
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Skip option info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>This step can be skipped in tab navigation</span>
          </div>
        </div>
      </div>

      {/* Auto-generated project notice */}
      {isAutoGenerated && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Auto-Generated Project</h4>
              <p className="text-sm text-blue-800 mt-1">
                This project was automatically generated and may have pre-populated fields and tasks 
                based on system analysis. You can modify all information as needed.
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
                        Work Tasks
                      </CardTitle>
                      <CardDescription>
                        Set reminder to for task to do by the manager during the work
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        {completedTasks.length} / {totalTasks} completed
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCreateTask}
                        disabled={createTask.isPending}
                        data-testid="button-add-work-task"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Task
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
                      <p>No work tasks defined</p>
                      <p className="text-sm mt-1">Add tasks to track work progress</p>
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
                                onBlur={(e) => handleTaskBlur(task.id, 'taskName', e.target.value)}
                                placeholder="Task description (required)"
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
                                    onBlur={(e) => handleTaskBlur(task.id, 'cost', parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-20 text-sm"
                                    data-testid={`input-work-task-cost-${index}`}
                                  />
                                </div>
                                <div className="flex items-center gap-1 w-40">
                                  <Input
                                    type="date"
                                    min={format(new Date(), 'yyyy-MM-dd')}
                                    value={getTaskValue(task, 'dueDate') || ''}
                                    onChange={(e) => {
                                      // Store the date string directly to avoid timezone issues
                                      const dateValue = e.target.value || null;
                                      handleTaskEdit(task.id, 'dueDate', dateValue);
                                    }}
                                    onBlur={(e) => {
                                      const dateValue = e.target.value || null;
                                      handleTaskBlur(task.id, 'dueDate', dateValue);
                                    }}
                                    className="flex-1"
                                    data-testid={`input-work-task-due-date-${index}`}
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
                                  {task.isCompleted ? 'Done' : 'Pending'}
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
                    <CardTitle className="text-base">Progress Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Tasks completed</span>
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
                          All tasks completed!
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
            <Button 
              variant="outline"
              onClick={handleReopen}
              disabled={isReopening || !workflowState.currentStatus || workflowState.currentStatus !== 'in_progress'}
              className="flex items-center gap-2"
              data-testid="button-reopen-inprogress"
            >
              <RotateCcw className="h-4 w-4" />
              {isReopening ? 'Reopening...' : 'Reopen Step'}
            </Button>
            
            <div className="text-sm text-muted-foreground">
              {workflowState.nextStatus && (
                <>Next: <span className="capitalize">{formatStatus(workflowState.nextStatus)}</span></>
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
              {isMarkingComplete ? 'Completing...' : 'Mark Work Complete'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}