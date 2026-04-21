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
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { 
  useWorkflowTasks, 
  useWorkflowTaskMutations,
  useMarkStatusComplete,
  useReopenWorkflowStep,
  type ProjectWorkflowState 
} from '@/hooks/useProjectWorkflow';
import { ReopenStepDialog } from './ReopenStepDialog';
import { TaskDateInput } from './TaskDateInput';
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
  projectType?: string;
  element: BuildingElement & {
    typicalLifespan?: number;
  };
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
  // Defensive null check for project data — must come BEFORE any hook calls
  // to comply with the Rules of Hooks. The parent modal already guards against
  // a missing project, but this provides a defensive fallback render.
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

  const { toast } = useToast();
  
  // Local state for task editing to prevent API calls on every keystroke
  const [localTaskEdits, setLocalTaskEdits] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);
  
  // Local state for element lifespan updates (non-confirmation data)
  const [elementLifespanUpdates, setElementLifespanUpdates] = useState<Record<string, Omit<ElementLifespanUpdate, 'confirmed'>>>({});

  // Track which element intervention types the user has manually overridden
  // within this post-work session. Manual overrides are preserved when server
  // data refreshes; non-overridden entries stay in sync with the latest
  // server-side `project_elements.projectType` value (i.e. changes made in
  // the submission step are reflected here when the user reopens post-work).
  const userOverriddenElementsRef = useRef<Set<string>>(new Set());
  
  // State for completion confirmation dialog
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);

  const { 
    data: postWorkTasks = [], 
    isLoading: isLoadingTasks 
  } = useWorkflowTasks(project.id, 'post_work');

  const { createTask, updateTask, deleteTask } = useWorkflowTaskMutations();
  const { mutate: markComplete, isPending: isMarkingComplete } = useMarkStatusComplete();
  const reopenStepMutation = useReopenWorkflowStep();

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

  // Smart calculation for lifespan impact based on intervention type and UNIFORMAT data
  const calculateLifespanSuggestion = (
    interventionType: InterventionType,
    element: (BuildingElement & { typicalLifespan?: number }) | null | undefined
  ): number => {
    // Null-safe: if the element record is missing (e.g. the underlying
    // building_element row was deleted), fall back to 25 years instead of
    // crashing the render.
    const typicalLifespan = element?.typicalLifespan || 25;
    
    switch (interventionType) {
      case 'repair': 
        return 0;
      case 'minor_rehab': 
        // Add 20% of typical lifespan for minor rehab
        return Math.round(typicalLifespan * 0.20);
      case 'major_rehab': 
        // Add 50% of typical lifespan for major rehab
        return Math.round(typicalLifespan * 0.50);
      case 'replace': 
        // For replacement, suggest the full typical lifespan
        return typicalLifespan;
      case 'nothing': 
        return 0;
      default: 
        return 0;
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

  // Initialize / re-sync element lifespan updates when project elements load
  // or change server-side. Manual user overrides made within this post-work
  // session are preserved; entries that were auto-initialized are kept in
  // sync with the latest server-side `project_elements.projectType` so that
  // changes made in the submission step are reflected here.
  useEffect(() => {
    if (projectElements.length === 0) return;

    setElementLifespanUpdates(prev => {
      const newUpdates = { ...prev };
      let didChange = false;

      projectElements.forEach(element => {
        // Map database 'replacement' to frontend 'replace'
        let serverInterventionType: InterventionType =
          (element.projectType as InterventionType) || 'nothing';
        if ((serverInterventionType as string) === 'replacement') {
          serverInterventionType = 'replace';
        }

        const existing = newUpdates[element.elementId];
        const isUserOverridden = userOverriddenElementsRef.current.has(element.elementId);

        if (!existing) {
          // First time we see this element — auto-initialize from server.
          newUpdates[element.elementId] = {
            elementId: element.elementId,
            interventionType: serverInterventionType,
            lifespanImpactYears: calculateLifespanSuggestion(serverInterventionType, element.element),
          };
          didChange = true;
          return;
        }

        // Skip server re-sync if the user has manually overridden this element
        // within the post-work session.
        if (isUserOverridden) return;

        // Re-sync intervention type and recalculated lifespan suggestion
        // when the server value has changed since auto-initialization.
        if (existing.interventionType !== serverInterventionType) {
          newUpdates[element.elementId] = {
            elementId: element.elementId,
            interventionType: serverInterventionType,
            lifespanImpactYears: calculateLifespanSuggestion(serverInterventionType, element.element),
          };
          didChange = true;
        }
      });

      return didChange ? newUpdates : prev;
    });
  }, [projectElements]);

  // Handle element intervention type change
  const handleInterventionTypeChange = (elementId: string, interventionType: InterventionType) => {
    // Element row may be missing (e.g. underlying building_element was
    // deleted). calculateLifespanSuggestion already null-guards and falls
    // back to a 25-year typical lifespan, so we still record the user's
    // intent rather than silently no-op'ing.
    const element = projectElements.find(e => e.elementId === elementId)?.element;

    // Mark this element as user-overridden so subsequent server refreshes
    // don't clobber the user's explicit choice within this post-work session.
    userOverriddenElementsRef.current.add(elementId);

    setElementLifespanUpdates(prev => ({
      ...prev,
      [elementId]: {
        ...prev[elementId],
        elementId,
        interventionType,
        lifespanImpactYears: calculateLifespanSuggestion(interventionType, element),
      }
    }));
  };

  // Handle element lifespan impact change
  const handleLifespanImpactChange = (elementId: string, lifespanImpactYears: number) => {
    // A manual lifespan edit is also a user override — server changes to
    // projectType should not silently overwrite it on the next refetch.
    userOverriddenElementsRef.current.add(elementId);

    setElementLifespanUpdates(prev => ({
      ...prev,
      [elementId]: {
        ...prev[elementId],
        elementId,
        lifespanImpactYears,
      }
    }));
  };

  // Handle element confirmation toggle (now persisted to database)
  const handleElementConfirmation = (elementId: string, confirmed: boolean) => {
    elementConfirmationMutation.mutate({ elementId, confirmed });
  };

  // Save all pending changes
  const handleSaveChanges = () => {
    const editsToProcess = Object.entries(localTaskEdits);
    let completedEdits = 0;
    const totalEdits = editsToProcess.length;

    editsToProcess.forEach(([taskId, updates]) => {
      // Convert field names to match backend schema before saving
      const fieldMap: Record<string, string> = {
        'dueDate': 'dueDate'
      };
      
      const backendUpdates = Object.keys(updates).reduce((acc, field) => {
        const backendField = fieldMap[field] || field;
        acc[backendField] = updates[field];
        return acc;
      }, {} as any);
      
      updateTask.mutate({
        projectId: project.id,
        taskId,
        updates: backendUpdates,
      }, {
        onSuccess: () => {
          completedEdits++;
          // Only clear state when all edits are completed
          if (completedEdits === totalEdits) {
            setLocalTaskEdits({});
            setHasChanges(false);
            // Invalidate tasks query to refresh data from server
            queryClient.invalidateQueries({ 
              queryKey: ['/api/maintenance/projects', project.id, 'tasks', 'post_work'] 
            });
            toast({
              title: 'Success',
              description: 'All changes saved successfully',
            });
          }
        },
        onError: (error: any) => {
          toast({
            title: 'Error',
            description: 'Failed to save some changes',
            variant: 'destructive',
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
    // Open confirmation dialog before completing
    setShowCompletionDialog(true);
  };

  // Handle confirmed completion with inventory updates
  const handleConfirmedCompletion = async () => {
    try {
      // Save any pending changes first
      if (hasChanges && Object.keys(localTaskEdits).length > 0) {
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

        await Promise.all(savePromises);
        setLocalTaskEdits({});
        setHasChanges(false);
      }

      // Apply inventory changes based on element lifespan updates.
      // Wrap each stage independently so the catch block can give a precise
      // error message instead of always blaming the inventory step.
      try {
        await applyInventoryChanges();
      } catch (inventoryError: any) {
        toast({
          title: 'Error',
          description: 'Failed to apply inventory changes. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Close dialog
      setShowCompletionDialog(false);

      // Complete the project
      try {
        if (onMarkComplete) {
          // Use parent modal's completion handler for navigation
          await Promise.resolve(onMarkComplete());
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
      } catch (completionError: any) {
        toast({
          title: 'Completion Failed',
          description: completionError?.message || 'Failed to mark the project complete. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      // Catch-all for any unexpected errors (e.g. saving pending edits)
      toast({
        title: 'Error',
        description: error?.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Apply inventory changes to building elements
  const applyInventoryChanges = async () => {
    const elementsToUpdate = projectElements.map(element => {
      const update = elementLifespanUpdates[element.elementId];
      if (!update) return null;
      
      return {
        elementId: element.elementId,
        interventionType: update.interventionType,
        lifespanImpactYears: update.lifespanImpactYears,
      };
    }).filter(Boolean);

    if (elementsToUpdate.length > 0) {
      const response = await apiRequest('POST', `/api/maintenance/projects/${project.id}/apply-inventory-changes`, {
        elements: elementsToUpdate,
        workCompletionDate: project.actualEndDate || new Date().toISOString().split('T')[0],
      });
      
      if (!response.ok) {
        throw new Error('Failed to apply inventory changes');
      }
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

    reopenStepMutation.mutate({
      projectId: project.id,
      targetStatus: 'in_progress', // Reopen to previous step
      reason: 'Manual reopening from post-work step'
    });
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
                                    placeholder="0.00"
                                    className="w-20 text-sm"
                                    data-testid={`input-postwork-task-cost-${index}`}
                                  />
                                </div>
                                <div className="flex items-center gap-1 w-40">
                                  <TaskDateInput
                                    taskId={task.id}
                                    currentValue={getTaskValue(task, 'dueDate')}
                                    onDateChange={handleTaskEdit}
                                    index={index}
                                    testIdPrefix="postwork-task"
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
                              {element.confirmed && (
                                <Badge className="bg-green-600">
                                  <ShieldCheck className="h-3 w-3 mr-1" />
                                  Confirmed
                                </Badge>
                              )}
                            </div>

                            {update.interventionType === 'replace' ? (
                              // Layout for replacement interventions - show suggested standard lifespan
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-sm font-medium mb-1 block">Intervention Type</label>
                                  <Select
                                    value={update.interventionType}
                                    onValueChange={(value: InterventionType) => 
                                      handleInterventionTypeChange(element.elementId, value)
                                    }
                                  >
                                    <SelectTrigger data-testid={`select-intervention-type-${element.elementId}`}>
                                      <SelectValue placeholder="Select intervention type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="nothing">No Work</SelectItem>
                                      <SelectItem value="repair">Repair</SelectItem>
                                      <SelectItem value="minor_rehab">Minor Rehab</SelectItem>
                                      <SelectItem value="major_rehab">Major Rehab</SelectItem>
                                      <SelectItem value="replace">Replacement</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div>
                                  <label className="text-sm font-medium mb-1 block">Suggested Standard Lifespan</label>
                                  <div className="p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded text-sm font-medium" data-testid={`suggested-lifespan-${element.elementId}`}>
                                    {element.element?.typicalLifespan || 25} years
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    UNIFORMAT standard lifespan for this element type
                                  </p>
                                </div>
                              </div>
                            ) : (
                              // Layout for repair/rehab interventions - enhanced with UNIFORMAT suggestions
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <label className="text-sm font-medium mb-1 block">Intervention Type</label>
                                  <Select
                                    value={update.interventionType}
                                    onValueChange={(value: InterventionType) => 
                                      handleInterventionTypeChange(element.elementId, value)
                                    }
                                  >
                                    <SelectTrigger data-testid={`select-intervention-type-${element.elementId}`}>
                                      <SelectValue placeholder="Select intervention type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="nothing">No Work</SelectItem>
                                      <SelectItem value="repair">Repair</SelectItem>
                                      <SelectItem value="minor_rehab">Minor Rehab</SelectItem>
                                      <SelectItem value="major_rehab">Major Rehab</SelectItem>
                                      <SelectItem value="replace">Replacement</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div>
                                  <label className="text-sm font-medium mb-1 block">Remaining Lifespan Before</label>
                                  <div className="p-2 bg-muted/50 rounded text-sm" data-testid={`remaining-lifespan-${element.elementId}`}>
                                    {element.element?.currentLifespan ? `${element.element.currentLifespan} years` : 'Not specified'}
                                  </div>
                                  {element.element?.typicalLifespan && ['minor_rehab', 'major_rehab'].includes(update.interventionType) && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      UNIFORMAT standard: {element.element.typicalLifespan} years • Suggested extension: {
                                        update.interventionType === 'minor_rehab' 
                                          ? Math.round(element.element.typicalLifespan * 0.20)
                                          : Math.round(element.element.typicalLifespan * 0.50)
                                      } years ({update.interventionType === 'minor_rehab' ? '20%' : '50%'})
                                    </p>
                                  )}
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
                                      placeholder={element.element?.typicalLifespan && ['minor_rehab', 'major_rehab'].includes(update.interventionType) 
                                        ? `Suggested: ${calculateLifespanSuggestion(update.interventionType, element.element)}`
                                        : '0'
                                      }
                                    />
                                    <span className="text-xs text-muted-foreground">years</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Years added to remaining lifespan
                                  </p>
                                </div>
                              </div>
                            )}
                            
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
                                  update.interventionType === 'replace' ? (
                                    <span className="font-medium text-blue-600">
                                      set the element's lifespan to {update.lifespanImpactYears} year{update.lifespanImpactYears !== 1 ? 's' : ''} starting from the date of the work
                                    </span>
                                  ) : (
                                    <span className="font-medium text-blue-600">
                                      add {update.lifespanImpactYears} year{update.lifespanImpactYears !== 1 ? 's' : ''} to the element's remaining lifespan
                                    </span>
                                  )
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
                              {projectElements.filter(el => el.confirmed).length} / {projectElements.length}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all" 
                              style={{ 
                                width: `${projectElements.length > 0 ? 
                                  (projectElements.filter(el => el.confirmed).length / projectElements.length) * 100 : 0}%` 
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
            <ReopenStepDialog
              projectId={project.id}
              currentStatus={workflowState.currentStatus}
              onSuccess={onUpdate}
              triggerText="Reopen Step"
            />
            
            {hasChanges && (
              <Button 
                variant="outline" 
                onClick={handleSaveChanges} 
                disabled={updateTask.isPending}
                data-testid="button-save-changes"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateTask.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
            
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

      {/* Completion Confirmation Dialog */}
      <AlertDialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Confirm Project Completion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Completing this project will apply changes to your building element inventory.
            </AlertDialogDescription>
            <div className="space-y-3 mt-4">
              <div>
                The following changes will be applied to your building element inventory:
              </div>
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                {projectElements.map((element) => {
                  const update = elementLifespanUpdates[element.elementId];
                  if (!update) return null;

                  return (
                    <div key={element.id} className="text-sm">
                      <strong>{element.element?.name || 'Unknown Element'}</strong>
                      {update.interventionType === 'replace' ? (
                        <div className="text-orange-700">
                          • Will be marked as replaced with new construction date
                          • New lifespan: {update.lifespanImpactYears} years
                        </div>
                      ) : update.interventionType === 'minor_rehab' || update.interventionType === 'major_rehab' ? (
                        <div className="text-blue-700">
                          • Current lifespan will be extended by {update.lifespanImpactYears} years
                          • Intervention type: {formatInterventionType(update.interventionType)}
                        </div>
                      ) : (
                        <div className="text-gray-600">
                          • No changes will be applied (intervention type: {formatInterventionType(update.interventionType)})
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="text-sm text-muted-foreground font-medium">
                These changes cannot be undone. Are you sure you want to complete this project?
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmedCompletion}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirm & Complete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}