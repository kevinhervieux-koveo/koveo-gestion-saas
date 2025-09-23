import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  useWorkflowTasks, 
  useWorkflowTaskMutations,
  useMarkStatusComplete, 
  type ProjectWorkflowState 
} from '@/hooks/useProjectWorkflow';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Plus,
  Trash2,
  Broom,
  ListChecks,
  DollarSign,
  Info,
  GripVertical,
  Check,
  Clock,
  ClipboardCheck,
  FileText,
} from 'lucide-react';

export interface PostWorkTabProps {
  project: MaintenanceProject;
  workflowState: ProjectWorkflowState;
  onUpdate: () => void;
}

/**
 * Post-Work tab component for cleanup and finalization tasks
 * Handles post-work tasks, cleanup activities, and finalization steps
 */
export function PostWorkTab({ project, workflowState, onUpdate }: PostWorkTabProps) {
  const { 
    data: postWorkTasks = [], 
    isLoading: isLoadingTasks 
  } = useWorkflowTasks(project.id, 'post_work');

  const { createTask, updateTask, deleteTask } = useWorkflowTaskMutations();
  const { mutate: markComplete, isPending: isMarkingComplete } = useMarkStatusComplete();

  const canAdvance = workflowState.canAdvance && workflowState.currentStatus === 'post_work';

  const handleCreateTask = () => {
    const newTaskIndex = postWorkTasks.length;
    createTask.mutate({
      projectId: project.id,
      taskData: {
        phase: 'post_work',
        taskName: 'New Post-Work Task',
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
    markComplete({
      projectId: project.id,
      currentStatus: 'post_work',
    }, {
      onSuccess: () => {
        onUpdate();
      },
    });
  };

  // Suggested post-work tasks
  const suggestedTasks = [
    { name: 'Site cleanup and debris removal', description: 'Clean work area and remove all construction debris' },
    { name: 'Final quality inspection', description: 'Inspect completed work for quality and code compliance' },
    { name: 'Documentation and photos', description: 'Document completed work with photos and paperwork' },
    { name: 'Warranty information', description: 'Provide warranty documentation and maintenance instructions' },
    { name: 'Final walkthrough with stakeholders', description: 'Conduct final walkthrough and obtain approval' },
    { name: 'Return of access keys/cards', description: 'Return any temporary access credentials' },
    { name: 'Invoice and payment processing', description: 'Submit final invoice and process payments' },
  ];

  const addSuggestedTask = (suggestedTask: { name: string; description: string }) => {
    const newTaskIndex = postWorkTasks.length;
    createTask.mutate({
      projectId: project.id,
      taskData: {
        phase: 'post_work',
        taskName: suggestedTask.name,
        description: suggestedTask.description,
        cost: 0,
        isCompleted: false,
        orderIndex: newTaskIndex,
      },
    });
  };

  const completedTasks = postWorkTasks.filter(task => task.isCompleted);
  const totalTasks = postWorkTasks.length;

  return (
    <div className="space-y-6" data-testid="post-work-tab">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Post-Work Activities</h3>
          <p className="text-sm text-muted-foreground">
            Cleanup, finalization, and project closure tasks
          </p>
        </div>
        
        {/* Skip option info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>This step can be skipped in tab navigation</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Tasks Column - Takes up 2/3 width */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Broom className="h-5 w-5" />
                    Post-Work Tasks
                  </CardTitle>
                  <CardDescription>
                    Tasks to complete after the main work is finished
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
                    data-testid="button-add-postWork-task"
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
                  <Broom className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No post-work tasks defined</p>
                  <p className="text-sm mt-1">Add cleanup and finalization tasks</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {postWorkTasks.map((task, index) => (
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
                            data-testid={`input-postWork-task-name-${index}`}
                          />
                          <Textarea
                            value={task.description || ''}
                            onChange={(e) => handleUpdateTask(task.id, { description: e.target.value })}
                            placeholder="Task description (optional)"
                            className="text-sm"
                            rows={2}
                            data-testid={`textarea-postWork-task-description-${index}`}
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
                                data-testid={`input-postWork-task-cost-${index}`}
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
                              data-testid={`button-postWork-task-toggle-${index}`}
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
                          data-testid={`button-delete-postWork-task-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Progress Bar */}
              {totalTasks > 0 && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Task Progress</span>
                    <span className="font-medium">{completedTasks.length} / {totalTasks}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all" 
                      style={{ width: `${totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0}%` }}
                    />
                  </div>
                  {completedTasks.length === totalTasks && totalTasks > 0 && (
                    <div className="flex items-center gap-2 text-green-600 text-sm font-medium mt-2">
                      <CheckCircle2 className="h-4 w-4" />
                      All post-work tasks completed!
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Column - Takes up 1/3 width */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="h-4 w-4" />
                Suggested Tasks
              </CardTitle>
              <CardDescription className="text-sm">
                Common post-work activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {suggestedTasks.map((suggestedTask, index) => {
                  // Check if this suggested task is already added
                  const isAlreadyAdded = postWorkTasks.some(task => 
                    task.taskName.toLowerCase().includes(suggestedTask.name.toLowerCase().split(' ')[0])
                  );

                  return (
                    <div key={index} className="p-2 border rounded text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-xs">{suggestedTask.name}</p>
                          <p className="text-muted-foreground text-xs mt-1">
                            {suggestedTask.description}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addSuggestedTask(suggestedTask)}
                          disabled={isAlreadyAdded || createTask.isPending}
                          className="flex-shrink-0 h-6 w-6 p-0"
                          data-testid={`button-add-suggested-task-${index}`}
                        >
                          {isAlreadyAdded ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Plus className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Checklist
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center",
                    totalTasks > 0 && completedTasks.length === totalTasks 
                      ? "bg-green-600 border-green-600 text-white" 
                      : "border-gray-300"
                  )}>
                    {totalTasks > 0 && completedTasks.length === totalTasks && (
                      <Check className="w-3 h-3" />
                    )}
                  </div>
                  <span>All post-work tasks completed</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-gray-300"></div>
                  <span className="text-muted-foreground">Final inspection passed</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-gray-300"></div>
                  <span className="text-muted-foreground">Documentation submitted</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-gray-300"></div>
                  <span className="text-muted-foreground">Stakeholder approval received</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-6 border-t">
        <div className="text-sm text-muted-foreground">
          {workflowState.nextStatus && (
            <>Next: <span className="capitalize">{workflowState.nextStatus.replace('_', ' ')}</span></>
          )}
        </div>
        
        {canAdvance && (
          <Button 
            onClick={handleMarkComplete}
            disabled={isMarkingComplete}
            className="flex items-center gap-2"
            data-testid="button-mark-postwork-complete"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isMarkingComplete ? 'Completing...' : 'Complete Post-Work Phase'}
          </Button>
        )}
      </div>
    </div>
  );
}