import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  useWorkflowTasks, 
  useWorkflowTaskMutations,
  useUpdateProjectDetails,
  useMarkStatusComplete, 
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
  Calendar as CalendarIcon,
  Building2,
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
}

const inProgressSchema = z.object({
  workStartDate: z.date().optional(),
  description: z.string().optional(),
});

type InProgressData = z.infer<typeof inProgressSchema>;

/**
 * In Progress tab component for active work execution
 * Handles work start date, task management, and work description
 */
export function InProgressTab({ project, workflowState, onUpdate }: InProgressTabProps) {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);

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
  const { mutate: updateProject, isPending: isUpdating } = useUpdateProjectDetails();
  const { mutate: markComplete, isPending: isMarkingComplete } = useMarkStatusComplete();

  const form = useForm<InProgressData>({
    resolver: zodResolver(inProgressSchema),
    defaultValues: {
      workStartDate: project.workStartDate ? new Date(project.workStartDate) : undefined,
      description: project.planningDescription || '',
    },
  });

  const canAdvance = workflowState.canAdvance && workflowState.currentStatus === 'in_progress';

  // Watch for form changes
  useEffect(() => {
    const subscription = form.watch(() => setHasChanges(true));
    return () => subscription.unsubscribe();
  }, [form]);

  // Auto-save when user stops typing
  useEffect(() => {
    if (!hasChanges) return;

    const timer = setTimeout(() => {
      handleSave();
    }, 2000);

    return () => clearTimeout(timer);
  }, [hasChanges, form.getValues()]);

  const handleSave = async () => {
    const values = form.getValues();
    
    updateProject({
      projectId: project.id,
      updates: {
        workStartDate: values.workStartDate?.toISOString().split('T')[0],
        // Note: Description might be stored differently - adjust based on schema
      },
      status: 'in_progress',
    }, {
      onSuccess: () => {
        setHasChanges(false);
        onUpdate();
      },
    });
  };

  const handleCreateTask = () => {
    const newTaskIndex = inProgressTasks.length;
    createTask.mutate({
      projectId: project.id,
      taskData: {
        phase: 'in_progress',
        taskName: 'New Work Task',
        description: '',
        cost: 0,
        isCompleted: false,
        orderIndex: newTaskIndex,
      },
    });
  };

  const handleUpdateTask = (taskId: string, updates: any) => {
    updateTask.mutate({
      projectId: project.id,
      taskId,
      updates,
    });
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTask.mutate({
      projectId: project.id,
      taskId,
    });
  };

  const handleMarkComplete = () => {
    // Save current changes first
    if (hasChanges) {
      const values = form.getValues();
      updateProject({
        projectId: project.id,
        updates: {
          workStartDate: values.workStartDate?.toISOString().split('T')[0],
        },
        status: 'in_progress',
      }, {
        onSuccess: () => {
          markComplete({
            projectId: project.id,
            currentStatus: 'in_progress',
          }, {
            onSuccess: () => {
              onUpdate();
            },
          });
        },
      });
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
  };

  // Check if auto-generated project
  const isAutoGenerated = project.origin === 'auto';
  const completedTasks = inProgressTasks.filter(task => task.isCompleted);
  const totalTasks = inProgressTasks.length;

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
          
          {hasChanges && (
            <Button variant="outline" size="sm" onClick={handleSave} disabled={isUpdating}>
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
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

      <Form {...form}>
        <form className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Work Details */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    Work Schedule
                  </CardTitle>
                  <CardDescription>
                    When did the actual work begin?
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="workStartDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Work Start Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                                data-testid="button-work-start-date"
                              >
                                {field.value ? (
                                  format(field.value, 'PPP')
                                ) : (
                                  <span>Select work start date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() || date < new Date('1900-01-01')
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          Record when work actually started (can be in the past)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Work Description
                  </CardTitle>
                  <CardDescription>
                    Details about the work being performed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the work being performed, any issues encountered, progress updates..."
                            className="min-h-[120px]"
                            {...field}
                            data-testid="textarea-work-description"
                          />
                        </FormControl>
                        <FormDescription>
                          Document work progress, issues, or important updates
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Task Management */}
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
                        Track specific tasks being completed during work
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
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {inProgressTasks.map((task, index) => (
                        <div 
                          key={task.id} 
                          className={cn(
                            'border rounded-lg p-3 space-y-2',
                            task.isCompleted && 'bg-green-50 border-green-200'
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground mt-1" />
                            <div className="flex-1 space-y-2">
                              <Input
                                value={task.taskName}
                                onChange={(e) => handleUpdateTask(task.id, { taskName: e.target.value })}
                                placeholder="Task name"
                                className={cn(
                                  'font-medium',
                                  task.isCompleted && 'line-through text-muted-foreground'
                                )}
                                data-testid={`input-work-task-name-${index}`}
                              />
                              <Textarea
                                value={task.description || ''}
                                onChange={(e) => handleUpdateTask(task.id, { description: e.target.value })}
                                placeholder="Task description (optional)"
                                className="text-sm"
                                rows={2}
                                data-testid={`textarea-work-task-description-${index}`}
                              />
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={task.cost || ''}
                                    onChange={(e) => handleUpdateTask(task.id, { cost: parseFloat(e.target.value) || 0 })}
                                    placeholder="0.00"
                                    className="w-20 text-sm"
                                    data-testid={`input-work-task-cost-${index}`}
                                  />
                                </div>
                                <Button
                                  variant={task.isCompleted ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handleUpdateTask(task.id, { isCompleted: !task.isCompleted })}
                                  className={cn(
                                    'flex items-center gap-1',
                                    task.isCompleted && 'bg-green-600 hover:bg-green-700'
                                  )}
                                  data-testid={`button-work-task-toggle-${index}`}
                                >
                                  {task.isCompleted ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                  {task.isCompleted ? 'Done' : 'In Progress'}
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
            <div className="text-sm text-muted-foreground">
              {hasChanges && 'Unsaved changes • '}
              {workflowState.nextStatus && (
                <>Next: <span className="capitalize">{formatStatus(workflowState.nextStatus)}</span></>
              )}
            </div>
            
            {canAdvance && (
              <Button 
                onClick={handleMarkComplete}
                disabled={isMarkingComplete || isUpdating}
                className="flex items-center gap-2"
                data-testid="button-mark-inprogress-complete"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isMarkingComplete ? 'Completing...' : 'Mark Work Complete'}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}