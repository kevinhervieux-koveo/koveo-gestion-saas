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
  const [userMessage, setUserMessage] = useState('');
  const [hasMessageChanges, setHasMessageChanges] = useState(false);

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
  const { createNotification, updateNotification } = useProjectNotificationMutations();
  const { mutate: markComplete, isPending: isMarkingComplete } = useMarkStatusComplete();

  const notificationForm = useForm<NotificationData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      messageText: '',
      timingType: 'one_day_before',
      customDaysBefore: 1,
    },
  });

  const canAdvance = workflowState.canAdvance && workflowState.currentStatus === 'pre_work';

  // Handle new task creation
  const handleCreateTask = () => {
    const newTaskIndex = preWorkTasks.length;
    createTask.mutate({
      projectId: project.id,
      taskData: {
        phase: 'pre_work',
        taskName: 'New Task',
        description: '',
        cost: 0,
        dueDate: undefined,
        isCompleted: false,
        orderIndex: newTaskIndex,
      },
    });
  };

  // Handle task update
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

  // Handle notification creation
  const handleCreateNotification = (data: NotificationData) => {
    createNotification.mutate({
      projectId: project.id,
      notificationData: data,
    }, {
      onSuccess: () => {
        notificationForm.reset();
      },
    });
  };

  const handleMarkComplete = () => {
    markComplete({
      projectId: project.id,
      currentStatus: 'pre_work',
    }, {
      onSuccess: () => {
        onUpdate();
      },
    });
  };

  // Auto-save user message
  useEffect(() => {
    if (!hasMessageChanges) return;

    const timer = setTimeout(() => {
      // TODO: Implement user message save to project
      console.log('Saving user message:', userMessage);
      setHasMessageChanges(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [hasMessageChanges, userMessage]);

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                            value={task.taskName}
                            onChange={(e) => handleUpdateTask(task.id, { taskName: e.target.value })}
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
                                value={task.cost || ''}
                                onChange={(e) => handleUpdateTask(task.id, { cost: parseFloat(e.target.value) || 0 })}
                                placeholder="0.00"
                                className="w-20 text-sm"
                                data-testid={`input-task-cost-${index}`}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <Input
                                type="date"
                                value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}
                                onChange={(e) => handleUpdateTask(task.id, { dueDate: e.target.value || null })}
                                className="w-32 text-sm"
                                data-testid={`input-task-due-date-${index}`}
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

        {/* Right Column - User Communication */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                User Message
              </CardTitle>
              <CardDescription>
                Information for residents about access, noise, or other important details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={userMessage}
                onChange={(e) => {
                  setUserMessage(e.target.value);
                  setHasMessageChanges(true);
                }}
                placeholder="Enter information for residents about the upcoming work..."
                className="min-h-[120px]"
                data-testid="textarea-user-message"
              />
              {hasMessageChanges && (
                <p className="text-xs text-muted-foreground mt-2">
                  Changes will be saved automatically
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Set up automated reminders and notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...notificationForm}>
                <form onSubmit={notificationForm.handleSubmit(handleCreateNotification)} className="space-y-4">
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

                  <Button 
                    type="submit" 
                    disabled={createNotification.isPending}
                    size="sm"
                    data-testid="button-create-notification"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Notification
                  </Button>
                </form>
              </Form>

              {/* Existing Notifications */}
              {notifications.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium">Scheduled Notifications</h4>
                  {notifications.map((notification) => (
                    <div key={notification.id} className="p-2 border rounded text-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{notification.messageText}</p>
                          <p className="text-muted-foreground text-xs">
                            {notification.timingType === 'custom' 
                              ? `${notification.customDaysBefore} days before`
                              : formatStatus(notification.timingType, 'Not specified')
                            }
                          </p>
                        </div>
                        {notification.isSent && (
                          <Check className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-6 border-t">
        <div className="text-sm text-muted-foreground">
          {workflowState.nextStatus && (
            <>Next: <span className="capitalize">{formatStatus(workflowState.nextStatus)}</span></>
          )}
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