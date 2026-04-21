import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  useWorkflowTasks, 
  useWorkflowTaskMutations,
  useProjectNotifications,
  useProjectNotificationMutations,
  useMarkStatusComplete,
  type ProjectWorkflowState 
} from '@/hooks/useProjectWorkflow';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { useToast } from '@/hooks/use-toast';
import { cn, formatStatus } from '@/lib/utils';
import { ReopenStepDialog } from './ReopenStepDialog';
import { TaskDateInput } from './TaskDateInput';
import { queryClient } from '@/lib/queryClient';
import {
  CheckCircle2,
  Plus,
  Trash2,
  Clock,
  Bell,
  MessageSquare,
  ListChecks,
  DollarSign,
  Info,
  GripVertical,
  Check,
  X,
  AlertTriangle,
  Calendar,
} from 'lucide-react';

export interface PreWorkTabProps {
  project: MaintenanceProject;
  workflowState: ProjectWorkflowState;
  onUpdate: () => void;
}

const notificationSchema = z.object({
  messageText: z.string().min(1, 'Message is required'),
  timingType: z.enum(['one_day_before', 'three_days_before', 'one_week_before', 'custom']),
  customDaysBefore: z.number().min(1).optional(),
});

type NotificationData = z.infer<typeof notificationSchema>;

/**
 * Pre-Work tab component for preparation tasks and user notifications
 * Handles custom task lists, user messages, and notification timing
 */
export function PreWorkTab({ project, workflowState, onUpdate }: PreWorkTabProps) {
  const { toast } = useToast();

  // Defensive null check for project data
  if (!project) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Project data is missing. Unable to load the pre-work tab.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { 
    data: preWorkTasks = [], 
    isLoading: isLoadingTasks 
  } = useWorkflowTasks(project.id, 'pre_work');

  const { 
    data: notifications = [], 
    isLoading: isLoadingNotifications 
  } = useProjectNotifications(project.id);

  const { createTask, updateTask, deleteTask } = useWorkflowTaskMutations();
  const { createNotification, updateNotification, deleteNotification } = useProjectNotificationMutations();
  const { mutate: markComplete, isPending: isMarkingComplete } = useMarkStatusComplete();

  const notificationForm = useForm<NotificationData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      messageText: '',
      timingType: 'one_day_before',
      customDaysBefore: 1,
    },
  });

  // Calculate task completion status
  const completedTasks = preWorkTasks.filter(task => task.isCompleted);
  const totalTasks = preWorkTasks.length;
  const allTasksCompleted = totalTasks > 0 ? completedTasks.length === totalTasks : true;

  const canAdvance = workflowState.canAdvance && workflowState.currentStatus === 'pre_work' && allTasksCompleted;

  // Handle notification deletion
  const handleDeleteNotification = (notificationId: string) => {
    deleteNotification.mutate({
      projectId: project.id,
      notificationId,
    });
  };

  // Handle new task creation
  const handleCreateTask = () => {
    const newTaskIndex = preWorkTasks.length;
    createTask.mutate({
      projectId: project.id,
      taskData: {
        phase: 'pre_work',
        taskName: 'New Task',
        description: '',
        orderIndex: newTaskIndex,
        isCompleted: false,
      },
    });
  };

  // State for notification editing
  const [editingNotification, setEditingNotification] = useState<string | null>(null);
  
  // Local state for task editing
  const [localTaskEdits, setLocalTaskEdits] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Handle task edit (local state only)
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

  // Get the current value for a task field (local edit or original value)
  const getTaskValue = (task: any, field: string) => {
    return localTaskEdits[task.id]?.[field] ?? task[field];
  };

  // Save all pending changes
  const handleSaveChanges = () => {
    if (Object.keys(localTaskEdits).length === 0) return;
    
    const editsToSave = { ...localTaskEdits };
    setLocalTaskEdits({});
    setHasChanges(false);
    
    Object.entries(editsToSave).forEach(([taskId, updates]) => {
      updateTask.mutate({
        projectId: project.id,
        taskId,
        updates,
      });
    });
    
    // Invalidate tasks query to refresh data from server
    queryClient.invalidateQueries({ 
      queryKey: ['/api/maintenance/projects', project.id, 'tasks', 'pre_work'] 
    });
  };

  // Handle immediate task updates (for buttons like completion toggle)
  const handleUpdateTask = (taskId: string, updates: any) => {
    updateTask.mutate({
      projectId: project.id,
      taskId,
      updates,
    });
  };

  // Handle task deletion
  const handleDeleteTask = (taskId: string) => {
    deleteTask.mutate({
      projectId: project.id,
      taskId,
    });
  };

  // Handle notification submission (create or update)
  const handleSubmitNotification = (data: NotificationData) => {
    if (editingNotification) {
      // Update existing notification
      updateNotification.mutate({
        projectId: project.id,
        notificationId: editingNotification,
        updates: data,
      }, {
        onSuccess: () => {
          notificationForm.reset();
          setEditingNotification(null);
        },
      });
    } else {
      // Create new notification
      createNotification.mutate({
        projectId: project.id,
        notificationData: data,
      }, {
        onSuccess: () => {
          notificationForm.reset();
        },
      });
    }
  };

  // Handle notification editing
  const handleEditNotification = (notification: any) => {
    setEditingNotification(notification.id);
    notificationForm.reset({
      messageText: notification.messageText,
      timingType: notification.timingType,
      customDaysBefore: notification.customDaysBefore,
    });
  };

  // Handle cancel editing
  const handleCancelEdit = () => {
    setEditingNotification(null);
    notificationForm.reset({
      messageText: '',
      timingType: 'one_day_before',
      customDaysBefore: 1,
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
        markComplete({
          projectId: project.id,
          currentStatus: 'pre_work',
        }, {
          onSuccess: () => {
            onUpdate();
          },
        });
      }).catch(() => {
        toast({
          title: "Error",
          description: "Failed to save changes before completing phase",
          variant: "destructive",
        });
      });
    } else {
      // No pending changes, complete directly
      markComplete({
        projectId: project.id,
        currentStatus: 'pre_work',
      }, {
        onSuccess: () => {
          onUpdate();
        },
      });
    }
  };



  const timingOptions = [
    { value: 'one_day_before', label: '1 Day Before' },
    { value: 'three_days_before', label: '3 Days Before' },
    { value: 'one_week_before', label: '1 Week Before' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <div className="space-y-6" data-testid="pre-work-tab">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Pre-Work Preparation</h3>
          <p className="text-sm text-muted-foreground">
            Set up preparation tasks and user notifications
          </p>
        </div>
        
        {/* Skip option info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>This step can be skipped in tab navigation</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Left Column - Tasks */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ListChecks className="h-5 w-5" />
                    Preparation Tasks
                  </CardTitle>
                  <CardDescription>
                    Define tasks that need to be completed before work begins
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateTask}
                  disabled={createTask.isPending}
                  data-testid="button-add-preWork-task"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Task
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingTasks ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : preWorkTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ListChecks className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No preparation tasks defined</p>
                  <p className="text-sm mt-1">Add tasks that need to be completed before work starts</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {preWorkTasks.map((task, index) => (
                    <div key={task.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground mt-1" />
                        <div className="flex-1 space-y-2">
                          <Input
                            value={getTaskValue(task, 'taskName')}
                            onChange={(e) => handleTaskEdit(task.id, 'taskName', e.target.value)}
                            placeholder="Task description (required)"
                            className="font-medium"
                            data-testid={`input-task-description-${index}`}
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
                                data-testid={`input-task-cost-${index}`}
                              />
                            </div>
                            <div className="flex items-center gap-1 w-40">
                              <TaskDateInput
                                taskId={task.id}
                                currentValue={getTaskValue(task, 'dueDate')}
                                onDateChange={handleTaskEdit}
                                index={index}
                                testIdPrefix="task"
                              />
                            </div>
                            <Button
                              variant={task.isCompleted ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleUpdateTask(task.id, { isCompleted: !task.isCompleted })}
                              className="flex items-center gap-1"
                              data-testid={`button-task-toggle-${index}`}
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
                          data-testid={`button-delete-task-${index}`}
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
        </div>

        {/* Notification Settings */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Set up automated reminders that will be sent to all users linked to this building
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...notificationForm}>
                <form onSubmit={notificationForm.handleSubmit(handleSubmitNotification)} className="space-y-4">
                  <FormField
                    control={notificationForm.control}
                    name="messageText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notification Message</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter notification message..."
                            {...field}
                            data-testid="textarea-notification-message"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={notificationForm.control}
                      name="timingType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timing</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-notification-timing">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {timingOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {notificationForm.watch('timingType') === 'custom' && (
                      <FormField
                        control={notificationForm.control}
                        name="customDaysBefore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Days Before</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                                data-testid="input-custom-days"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      type="submit" 
                      disabled={createNotification.isPending || updateNotification.isPending}
                      size="sm"
                      data-testid="button-submit-notification"
                    >
                      {editingNotification ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Update Notification
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Notification
                        </>
                      )}
                    </Button>
                    {editingNotification && (
                      <Button 
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCancelEdit}
                        data-testid="button-cancel-edit"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </Form>

              {/* Display Created Notifications */}
              {notifications.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <div className="flex items-center gap-2 mb-4">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-medium text-sm">Created Notifications ({notifications.length})</h4>
                  </div>
                  <div className="space-y-3">
                    {notifications.map((notification) => (
                      <div key={notification.id} className="border rounded-lg p-3 bg-muted/20">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                {notification.timingType === 'custom' 
                                  ? `${notification.customDaysBefore} days before`
                                  : formatStatus(notification.timingType, 'Not specified').replace('_', ' ')
                                }
                              </span>
                              {notification.isSent ? (
                                <Badge variant="secondary" className="text-green-600 bg-green-50">
                                  <Check className="h-3 w-3 mr-1" />
                                  Sent
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-orange-600 bg-orange-50">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Pending
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {notification.messageText}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditNotification(notification)}
                              disabled={!!editingNotification}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 h-8 w-8 p-0"
                              data-testid={`button-edit-notification-${notification.id}`}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteNotification(notification.id)}
                              disabled={deleteNotification.isPending || !!editingNotification}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 h-8 w-8 p-0"
                              data-testid={`button-delete-notification-${notification.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
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
              {updateTask.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
          
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
            data-testid="button-mark-prework-complete"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isMarkingComplete ? 'Completing...' : 'Complete Pre-Work Phase'}
          </Button>
        )}
      </div>
    </div>
  );
}