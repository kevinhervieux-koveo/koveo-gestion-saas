import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  useWorkflowTasks, 
  useWorkflowTaskMutations,
  useMarkStatusComplete, 
  type ProjectWorkflowState 
} from '@/hooks/useProjectWorkflow';
import { MaintenanceProject, BuildingElement } from '@shared/schemas/maintenance';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn, formatStatus, safeCapitalize } from '@/lib/utils';
import {
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  ListChecks,
  DollarSign,
  Info,
  GripVertical,
  Check,
  Clock,
  ClipboardCheck,
  FileText,
  Settings,
  Building2,
  Save,
  AlertTriangle,
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
type ElementUpdateStatus = 'repair' | 'minor_rehab' | 'major_rehab' | 'replace' | 'nothing';

interface ProjectElementWithDetails {
  id: string;
  projectId: string;
  elementId: string;
  workDescription?: string;
  costAllocation?: number;
  lifespanImpact?: number;
  element: BuildingElement;
}

interface ElementUpdate {
  id: string;
  projectId: string;
  elementId: string;
  updateStatus: ElementUpdateStatus;
  actualCost?: number;
  notes?: string;
}

export function PostWorkTab({ project, workflowState, onUpdate }: PostWorkTabProps) {
  const { toast } = useToast();
  
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
  
  // Local state for element updates form
  const [elementFormData, setElementFormData] = useState<Record<string, {
    status: ElementUpdateStatus | '';
    cost: string;
    notes: string;
  }>>({});
  
  const { 
    data: postWorkTasks = [], 
    isLoading: isLoadingTasks 
  } = useWorkflowTasks(project.id, 'post_work');

  const { createTask, updateTask, deleteTask } = useWorkflowTaskMutations();
  const { mutate: markComplete, isPending: isMarkingComplete } = useMarkStatusComplete();

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

  // Fetch element updates
  const {
    data: elementUpdatesResponse,
    isLoading: isLoadingUpdates,
  } = useQuery({
    queryKey: ['/api/maintenance/projects', project.id, 'element-updates'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/projects/${project.id}/element-updates`);
      return await response.json();
    },
  });

  const projectElements: ProjectElementWithDetails[] = projectElementsResponse?.elements || [];
  const elementUpdates: ElementUpdate[] = elementUpdatesResponse?.updates || [];

  // Element update mutation
  const elementUpdateMutation = useMutation({
    mutationFn: async (updateData: {
      elementId: string;
      updateStatus: ElementUpdateStatus;
      actualCost?: number;
      notes?: string;
    }) => {
      const response = await apiRequest('POST', `/api/maintenance/projects/${project.id}/element-updates`, updateData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', project.id, 'element-updates'] 
      });
      toast({
        title: "Element Updated",
        description: "Element status has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Update Element",
        description: error.response?.data?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Initialize form data when element updates load
  useEffect(() => {
    if (elementUpdates.length > 0) {
      const initialData: Record<string, { status: ElementUpdateStatus | ''; cost: string; notes: string }> = {};
      elementUpdates.forEach(update => {
        initialData[update.elementId] = {
          status: update.updateStatus,
          cost: update.actualCost?.toString() || '',
          notes: update.notes || '',
        };
      });
      setElementFormData(prevData => ({ ...prevData, ...initialData }));
    }
  }, [elementUpdates]);

  // Helper function to get element update
  const getElementUpdate = (elementId: string): ElementUpdate | undefined => {
    return elementUpdates.find(update => update.elementId === elementId);
  };

  // Helper function to get element form data
  const getElementFormData = (elementId: string) => {
    return elementFormData[elementId] || {
      status: '' as const,
      cost: '',
      notes: '',
    };
  };

  // Helper function to update element form data
  const updateElementFormData = (elementId: string, field: 'status' | 'cost' | 'notes', value: string) => {
    setElementFormData(prev => ({
      ...prev,
      [elementId]: {
        ...getElementFormData(elementId),
        [field]: value,
      },
    }));
  };

  // Helper function to get status badge color
  const getStatusBadgeVariant = (status: ElementUpdateStatus) => {
    switch (status) {
      case 'repair': return 'secondary';
      case 'minor_rehab': return 'outline';
      case 'major_rehab': return 'default';
      case 'replace': return 'destructive';
      case 'nothing': return 'secondary';
      default: return 'outline';
    }
  };

  // Helper function to format element status for display
  const formatElementStatus = (status: ElementUpdateStatus) => {
    switch (status) {
      case 'minor_rehab': return 'Minor Rehab';
      case 'major_rehab': return 'Major Rehab';
      case 'nothing': return 'No Work';
      default: return safeCapitalize(status, 'Unknown');
    }
  };

  const handleElementUpdate = (elementId: string, updateStatus: ElementUpdateStatus, actualCost?: number, notes?: string) => {
    elementUpdateMutation.mutate({
      elementId,
      updateStatus,
      actualCost,
      notes,
    });
  };

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
          {/* Element Updates Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Element Updates
              </CardTitle>
              <CardDescription>
                Track what was actually done to each project element
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingElements || isLoadingUpdates ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-20 bg-muted animate-pulse rounded" />
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
                  {projectElements.map((projectElement) => {
                    const elementUpdate = getElementUpdate(projectElement.elementId);
                    const formData = getElementFormData(projectElement.elementId);

                    const handleSaveUpdate = () => {
                      if (formData.status) {
                        handleElementUpdate(
                          projectElement.elementId,
                          formData.status,
                          formData.cost ? parseFloat(formData.cost) : undefined,
                          formData.notes || undefined
                        );
                      }
                    };

                    return (
                      <div key={projectElement.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{projectElement.element.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {projectElement.element.uniformatCode}
                            </p>
                            {projectElement.workDescription && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Planned work: {projectElement.workDescription}
                              </p>
                            )}
                          </div>
                          {elementUpdate && (
                            <Badge variant={getStatusBadgeVariant(elementUpdate.updateStatus)}>
                              {formatElementStatus(elementUpdate.updateStatus)}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-sm font-medium mb-1 block">Update Status</label>
                            <Select
                              value={formData.status}
                              onValueChange={(value) => updateElementFormData(projectElement.elementId, 'status', value)}
                            >
                              <SelectTrigger data-testid={`select-element-status-${projectElement.elementId}`}>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="repair">Repair</SelectItem>
                                <SelectItem value="minor_rehab">Minor Rehab</SelectItem>
                                <SelectItem value="major_rehab">Major Rehab</SelectItem>
                                <SelectItem value="replace">Replace</SelectItem>
                                <SelectItem value="nothing">No Work Done</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <label className="text-sm font-medium mb-1 block">Actual Cost ($)</label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={formData.cost}
                              onChange={(e) => updateElementFormData(projectElement.elementId, 'cost', e.target.value)}
                              data-testid={`input-element-cost-${projectElement.elementId}`}
                            />
                          </div>

                          <div className="flex items-end">
                            <Button
                              onClick={handleSaveUpdate}
                              disabled={!formData.status || elementUpdateMutation.isPending}
                              size="sm"
                              className="w-full"
                              data-testid={`button-save-element-update-${projectElement.elementId}`}
                            >
                              <Save className="h-4 w-4 mr-1" />
                              {elementUpdateMutation.isPending ? 'Saving...' : 'Save'}
                            </Button>
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-1 block">Notes (optional)</label>
                          <Textarea
                            placeholder="Additional notes about the work performed..."
                            value={formData.notes}
                            onChange={(e) => updateElementFormData(projectElement.elementId, 'notes', e.target.value)}
                            rows={2}
                            data-testid={`textarea-element-notes-${projectElement.elementId}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
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
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
            <>Next: <span className="capitalize">{formatStatus(workflowState.nextStatus)}</span></>
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