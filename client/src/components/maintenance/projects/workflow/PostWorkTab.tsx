import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  useWorkflowTasks, 
  useWorkflowTaskMutations,
  useMarkStatusComplete,
  useReopenWorkflowStep, 
  type ProjectWorkflowState 
} from '@/hooks/useProjectWorkflow';
import { MaintenanceProject, BuildingElement } from '@shared/schemas/maintenance';
import { apiRequest, queryClient } from '@/lib/queryClient';
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
  Building2,
  Save,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

export interface PostWorkTabProps {
  project: MaintenanceProject;
  workflowState: ProjectWorkflowState;
  onUpdate: () => void;
  onMarkComplete?: () => void;
}

type InterventionType = 'repair' | 'minor_rehab' | 'major_rehab' | 'replace' | 'nothing';

interface ProjectElementWithDetails {
  id: string;
  projectId: string;
  elementId: string;
  workDescription?: string;
  costAllocation?: number;
  lifespanImpact?: number;
  confirmed: boolean;
  element: BuildingElement;
}

interface ElementLifespanUpdate {
  elementId: string;
  interventionType: InterventionType;
  lifespanImpactYears: number;
  confirmed: boolean;
}

/**
 * Post-Work tab component for cleanup and finalization tasks
 * Handles post-work task management, element lifespan tracking, and progress confirmation
 */
export function PostWorkTab({ project, workflowState, onUpdate, onMarkComplete }: PostWorkTabProps) {
  const { toast } = useToast();
  
  // Local state for task editing to prevent API calls on every keystroke
  const [localTaskEdits, setLocalTaskEdits] = useState<Record<string, any>>({});
  const debounceTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  
  // Local state for element lifespan updates (non-confirmation data)
  const [elementLifespanUpdates, setElementLifespanUpdates] = useState<Record<string, Omit<ElementLifespanUpdate, 'confirmed'>>>({});

  // Defensive null check for project data
  if (!project) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Project data is missing. Unable to load the post-work tab.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { 
    data: postWorkTasks = [], 
    isLoading: isLoadingTasks 
  } = useWorkflowTasks(project.id, 'post_work');

  const { createTask, updateTask, deleteTask } = useWorkflowTaskMutations();
  const { mutate: markComplete, isPending: isMarkingComplete } = useMarkStatusComplete();
  const { mutate: reopenStep, isPending: isReopening } = useReopenWorkflowStep();

  // Element confirmation mutations
  const elementConfirmationMutation = useMutation({
    mutationFn: async ({ elementId, confirmed }: { elementId: string; confirmed: boolean }) => {
      const element = projectElements.find(e => e.elementId === elementId);
      if (!element) throw new Error('Element not found');
      
      const response = await apiRequest('PATCH', `/api/maintenance/project-elements/${element.id}`, {
        confirmed
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/projects', project.id, 'elements'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: 'Failed to update element confirmation',
        variant: 'destructive',
      });
    },
  });

  // Bulk confirm all elements mutation
  const confirmAllMutation = useMutation({
    mutationFn: async (confirmed: boolean = true) => {
      const response = await apiRequest('PATCH', `/api/maintenance/projects/${project.id}/elements/confirm-all`, {
        confirmed
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/projects', project.id, 'elements'] });
      toast({
        title: 'Success',
        description: 'All elements confirmed successfully',
        variant: 'default',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: 'Failed to confirm all elements',
        variant: 'destructive',
      });
    },
  });

  // Fetch project elements
  const {
    data: projectElementsResponse,
    isLoading: isLoadingElements,
  } = useQuery({
    queryKey: ['/api/maintenance/projects', project.id, 'elements'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/projects/${project.id}/elements`);
      return await response.json();
    },
  });

  const projectElements: ProjectElementWithDetails[] = projectElementsResponse?.elements || [];

  // Calculate task completion status
  const completedTasks = postWorkTasks.filter(task => task.isCompleted);
  const totalTasks = postWorkTasks.length;
  const allTasksCompleted = totalTasks > 0 ? completedTasks.length === totalTasks : true;

  const allElementsConfirmed = projectElements.length === 0 || projectElements.every(element => element.confirmed);
  const canAdvance = workflowState.canAdvance && workflowState.currentStatus === 'post_work' && allTasksCompleted && allElementsConfirmed;

  // Helper function to get default lifespan impact for intervention type
  const getDefaultLifespanImpact = (interventionType: InterventionType): number => {
    switch (interventionType) {
      case 'repair': return 0;
      case 'minor_rehab': return 5;
      case 'major_rehab': return 15;
      case 'replace': return 25;
      case 'nothing': return 0;
      default: return 0;
    }
  };

  // Helper function to format intervention type for display
  const formatInterventionType = (type: InterventionType): string => {
    switch (type) {
      case 'minor_rehab': return 'Minor Rehab';
      case 'major_rehab': return 'Major Rehab';
      case 'nothing': return 'No Work';
      default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  // Initialize element lifespan updates when elements load (non-confirmation data)
  useEffect(() => {
    if (projectElements.length > 0) {
      const initialUpdates: Record<string, Omit<ElementLifespanUpdate, 'confirmed'>> = {};
      projectElements.forEach(element => {
        // Default to "nothing" intervention if not specified
        const defaultType: InterventionType = 'nothing';
        initialUpdates[element.elementId] = {
          elementId: element.elementId,
          interventionType: defaultType,
          lifespanImpactYears: getDefaultLifespanImpact(defaultType),
        };
      });
      setElementLifespanUpdates(initialUpdates);
    }
  }, [projectElements]);

  // Handle element intervention type change
  const handleInterventionTypeChange = (elementId: string, interventionType: InterventionType) => {
    setElementLifespanUpdates(prev => ({
      ...prev,
      [elementId]: {
        ...prev[elementId],
        interventionType,
        lifespanImpactYears: getDefaultLifespanImpact(interventionType),
      }
    }));
  };

  // Handle element lifespan impact change
  const handleLifespanImpactChange = (elementId: string, lifespanImpactYears: number) => {
    setElementLifespanUpdates(prev => ({
      ...prev,
      [elementId]: {
        ...prev[elementId],
        lifespanImpactYears,
      }
    }));
  };

  // Handle element confirmation toggle (now persisted to database)
  const handleElementConfirmation = (elementId: string, confirmed: boolean) => {
    elementConfirmationMutation.mutate({ elementId, confirmed });
  };

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
    const newTaskIndex = postWorkTasks.length;
    createTask.mutate({
      projectId: project.id,
      taskData: {
        phase: 'post_work',
        taskName: 'New Post-Work Task',
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
        currentStatus: 'post_work',
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
    if (workflowState.currentStatus !== 'post_work') {
      toast({
        title: "Cannot Reopen Step",
        description: "This step can only be reopened when the project is currently in the Post-Work phase.",
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
    <div className="space-y-6" data-testid="post-work-tab">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Post-Work Activities</h3>
          <p className="text-sm text-muted-foreground">
            Manage cleanup, finalization, and project closure tasks
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
                        Post-Work Tasks
                      </CardTitle>
                      <CardDescription>
                        Cleanup, finalization, and closure tasks to complete the project
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
                        data-testid="button-add-postwork-task"
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
                  ) : postWorkTasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ListChecks className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No post-work tasks defined</p>
                      <p className="text-sm mt-1">Add cleanup and finalization tasks</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {postWorkTasks.map((task, index) => (
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
                                data-testid={`input-postwork-task-name-${index}`}
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
                                    data-testid={`input-postwork-task-cost-${index}`}
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
                                    data-testid={`input-postwork-task-due-date-${index}`}
                                  />
                                </div>
                                <Button
                                  variant={task.isCompleted ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handleUpdateTask(task.id, { isCompleted: !task.isCompleted })}
                                  className="flex items-center gap-1"
                                  data-testid={`button-postwork-task-toggle-${index}`}
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
                              data-testid={`button-delete-postwork-task-${index}`}
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

              {/* Element Lifespan Impact Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Element Lifespan Impact
                      </CardTitle>
                      <CardDescription>
                        Review and confirm the lifespan impact of interventions on each project element
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          {projectElements.filter(el => el.confirmed).length} / {projectElements.length} confirmed
                        </div>
                      </div>
                      {projectElements.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => confirmAllMutation.mutate(true)}
                          disabled={confirmAllMutation.isPending || allElementsConfirmed}
                          className="whitespace-nowrap"
                          data-testid="button-confirm-all-elements"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Confirm All
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingElements ? (
                    <div className="space-y-3">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="h-24 bg-muted animate-pulse rounded" />
                      ))}
                    </div>
                  ) : projectElements.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No elements linked to this project</p>
                      <p className="text-sm mt-1">Elements must be added during the planning phase</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {projectElements.map((element) => {
                        const update = elementLifespanUpdates[element.elementId];
                        if (!update) return null;

                        return (
                          <div key={element.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-medium">{element.element?.name || 'Unknown Element'}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {element.element?.uniformatCode || 'No code'}
                                </p>
                                {element.workDescription && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Planned work: {element.workDescription}
                                  </p>
                                )}
                              </div>
                              {update.confirmed && (
                                <Badge className="bg-green-600">
                                  <ShieldCheck className="h-3 w-3 mr-1" />
                                  Confirmed
                                </Badge>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="text-sm font-medium mb-1 block">Work Done in Submission</label>
                                <div className="p-2 bg-muted/50 rounded text-sm" data-testid={`work-description-${element.elementId}`}>
                                  {element.workDescription || 'No work description provided'}
                                </div>
                              </div>

                              <div>
                                <label className="text-sm font-medium mb-1 block">Lifespan Impact (Years)</label>
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    step="1"
                                    min="0"
                                    max="50"
                                    value={update.lifespanImpactYears}
                                    onChange={(e) => 
                                      handleLifespanImpactChange(
                                        element.elementId, 
                                        Math.round(parseInt(e.target.value) || 0)
                                      )
                                    }
                                    data-testid={`input-lifespan-impact-${element.elementId}`}
                                  />
                                  <span className="text-xs text-muted-foreground">years</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Years added to remaining lifespan
                                </p>
                              </div>

                            </div>
                            
                            <div className="flex items-center space-x-2 mt-3">
                              <Checkbox
                                id={`confirm-${element.elementId}`}
                                checked={element.confirmed}
                                onCheckedChange={(checked) => 
                                  handleElementConfirmation(element.elementId, !!checked)
                                }
                                disabled={elementConfirmationMutation.isPending}
                                data-testid={`checkbox-confirm-element-${element.elementId}`}
                              />
                              <label 
                                htmlFor={`confirm-${element.elementId}`}
                                className="text-sm font-medium cursor-pointer"
                              >
                                Confirmed
                              </label>
                            </div>

                            <div className="text-sm bg-muted/50 rounded p-2">
                              <div className="flex items-center gap-1 font-medium">
                                <Info className="h-3 w-3" />
                                Impact Summary:
                              </div>
                              <p className="mt-1">
                                This work will{' '}
                                {update.lifespanImpactYears > 0 ? (
                                  <span className="font-medium text-blue-600">
                                    add {update.lifespanImpactYears} year{update.lifespanImpactYears !== 1 ? 's' : ''} to the element's remaining lifespan
                                  </span>
                                ) : (
                                  <span className="font-medium text-gray-600">not change the remaining lifespan</span>
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      })}

                      {/* Confirmation Status */}
                      {projectElements.length > 0 && (
                        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                          <div className="flex justify-between text-sm mb-2">
                            <span>Element Confirmations</span>
                            <span className="font-medium">
                              {projectElements.filter(el => elementLifespanUpdates[el.elementId]?.confirmed).length} / {projectElements.length}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all" 
                              style={{ 
                                width: `${projectElements.length > 0 ? 
                                  (projectElements.filter(el => elementLifespanUpdates[el.elementId]?.confirmed).length / projectElements.length) * 100 : 0}%` 
                              }}
                            />
                          </div>
                          {allElementsConfirmed && (
                            <div className="flex items-center gap-2 text-green-600 text-sm font-medium mt-2">
                              <CheckCircle2 className="h-4 w-4" />
                              All elements confirmed!
                            </div>
                          )}
                        </div>
                      )}
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
              disabled={isReopening || !workflowState.currentStatus || workflowState.currentStatus !== 'post_work'}
              className="flex items-center gap-2"
              data-testid="button-reopen-postwork"
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
          
          {canAdvance ? (
            <Button 
              onClick={handleMarkComplete}
              disabled={isMarkingComplete}
              className="flex items-center gap-2"
              data-testid="button-mark-postwork-complete"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isMarkingComplete ? 'Completing...' : 'Mark Project Complete'}
            </Button>
          ) : (
            <div className="text-sm text-muted-foreground">
              {!allTasksCompleted && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Complete all tasks to proceed
                </div>
              )}
              {allTasksCompleted && !allElementsConfirmed && (
                <div className="flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4" />
                  Confirm all element lifespan impacts to proceed
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}