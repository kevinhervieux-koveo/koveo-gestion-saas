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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useUpdateProjectDetails, useMarkStatusComplete, type ProjectWorkflowState } from '@/hooks/useProjectWorkflow';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { useToast } from '@/hooks/use-toast';
import { cn, formatStatus } from '@/lib/utils';
import { format } from 'date-fns';
import {
  CalendarIcon,
  CheckCircle2,
  DollarSign,
  FileText,
  Settings,
  Target,
  Wrench,
  Building2,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface ConfigurationTabProps {
  project: MaintenanceProject;
  workflowState: ProjectWorkflowState;
  onUpdate: () => void;
}

const configurationTabSchema = z.object({
  planningDescription: z.string().optional(),
  planningStartDate: z.date().optional(),
  estimatedCost: z.number().min(0, 'Cost must be non-negative').optional(),
  type: z.enum(['repair', 'minor_rehab', 'major_rehab', 'replacement', 'not_sure']),
});

type ConfigurationTabData = z.infer<typeof configurationTabSchema>;

const projectTypes = [
  { 
    value: 'repair', 
    label: 'Repair', 
    icon: Wrench, 
    description: 'Fix existing components and restore functionality' 
  },
  { 
    value: 'minor_rehab', 
    label: 'Minor Rehabilitation', 
    icon: Settings, 
    description: 'Small-scale improvements and updates' 
  },
  { 
    value: 'major_rehab', 
    label: 'Major Rehabilitation', 
    icon: Building2, 
    description: 'Significant renovations and system upgrades' 
  },
  { 
    value: 'replacement', 
    label: 'Replacement', 
    icon: Target, 
    description: 'Complete replacement of components or systems' 
  },
  { 
    value: 'not_sure', 
    label: 'Assessment Needed', 
    icon: FileText, 
    description: 'Requires evaluation to determine appropriate work type' 
  },
];

/**
 * Configuration tab component for project setup and initial configuration
 * Handles project description, start date, cost estimation, type selection, and project deletion
 */
export function ConfigurationTab({ project, workflowState, onUpdate }: ConfigurationTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Defensive null check for project data
  if (!project) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Project data is missing. Unable to load the configuration tab.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { mutate: updateProject, isPending: isUpdating } = useUpdateProjectDetails();
  const { mutate: markComplete, isPending: isMarkingComplete } = useMarkStatusComplete();

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiRequest('DELETE', `/api/maintenance/projects/${projectId}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to delete project' }));
        throw new Error(error.message || 'Failed to delete project');
      }
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/projects'] });
      
      toast({
        title: 'Project Deleted',
        description: 'The project has been deleted successfully',
      });
      
      // Close modal and refresh parent component
      onUpdate();
    },
    onError: (error: Error) => {
      console.error('Failed to delete project:', error);
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete project',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setIsDeleting(false);
    },
  });

  const form = useForm<ConfigurationTabData>({
    resolver: zodResolver(configurationTabSchema),
    defaultValues: {
      planningDescription: project.planningDescription || '',
      planningStartDate: project.planningStartDate ? new Date(project.planningStartDate) : undefined,
      estimatedCost: project.estimatedCost ? parseFloat(project.estimatedCost) : undefined,
      type: project.type,
    },
  });

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
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [hasChanges, form.getValues()]);

  const handleSave = async () => {
    const values = form.getValues();
    
    updateProject({
      projectId: project.id,
      updates: {
        planningDescription: values.planningDescription,
        planningStartDate: values.planningStartDate?.toISOString().split('T')[0],
        estimatedCost: values.estimatedCost,
        type: values.type,
      },
      status: 'configuration',
    }, {
      onSuccess: () => {
        setHasChanges(false);
        onUpdate();
      },
    });
  };

  const handleMarkComplete = () => {
    // Save current changes first
    if (hasChanges) {
      const values = form.getValues();
      updateProject({
        projectId: project.id,
        updates: {
          planningDescription: values.planningDescription,
          planningStartDate: values.planningStartDate?.toISOString().split('T')[0],
          estimatedCost: values.estimatedCost,
          type: values.type,
        },
        status: 'configuration',
      }, {
        onSuccess: () => {
          // Then mark as complete
          markComplete({
            projectId: project.id,
            currentStatus: 'configuration',
          }, {
            onSuccess: () => {
              onUpdate();
            },
          });
        },
      });
    } else {
      // Just mark as complete
      markComplete({
        projectId: project.id,
        currentStatus: 'configuration',
      }, {
        onSuccess: () => {
          onUpdate();
        },
      });
    }
  };

  const handleDeleteProject = () => {
    setIsDeleting(true);
    deleteProjectMutation.mutate(project.id);
  };

  // Configuration is no longer part of the workflow progression
  const canAdvance = false;

  return (
    <div className="space-y-6" data-testid="configuration-tab">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Project Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Configure project details, timeline, and cost estimates. You can also delete the project from here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button variant="outline" size="sm" onClick={handleSave} disabled={isUpdating}>
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
          
          {/* Delete Project Button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                size="sm"
                data-testid="button-delete-project"
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Project
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent data-testid="delete-project-dialog">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this project? This action cannot be undone.
                  All project data, including submissions and workflow tasks, will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDeleteProject}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid="button-confirm-delete"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Project'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Form {...form}>
        <form className="space-y-6">
          {/* Project Type Selection */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem data-testid="form-item-type">
                <FormLabel>Project Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-project-type">
                      <SelectValue placeholder="Select project type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {projectTypes.map((type) => {
                      const IconComponent = type.icon;
                      return (
                        <SelectItem key={type.value} value={type.value} data-testid={`option-${type.value}`}>
                          <div className="flex items-center space-x-2">
                            <IconComponent className="h-4 w-4" />
                            <div className="flex flex-col">
                              <span className="font-medium">{type.label}</span>
                              <span className="text-xs text-muted-foreground">{type.description}</span>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Choose the type of maintenance work required for this project
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Project Description */}
          <FormField
            control={form.control}
            name="planningDescription"
            render={({ field }) => (
              <FormItem data-testid="form-item-description">
                <FormLabel>Project Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe the maintenance work needed, including scope, specific areas, and any special requirements..."
                    rows={4}
                    data-testid="textarea-description"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Provide a detailed description of the work to be performed
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Planning Start Date */}
          <FormField
            control={form.control}
            name="planningStartDate"
            render={({ field }) => (
              <FormItem className="flex flex-col" data-testid="form-item-start-date">
                <FormLabel>Preferred Start Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-[240px] pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        data-testid="button-date-picker"
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
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
                        date < new Date(new Date().setDate(new Date().getDate() - 1))
                      }
                      initialFocus
                      data-testid="calendar-start-date"
                    />
                  </PopoverContent>
                </Popover>
                <FormDescription>
                  When would you like this project to begin?
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Estimated Cost */}
          <FormField
            control={form.control}
            name="estimatedCost"
            render={({ field }) => (
              <FormItem data-testid="form-item-cost">
                <FormLabel>Estimated Budget</FormLabel>
                <FormControl>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="pl-9"
                      data-testid="input-estimated-cost"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                      value={field.value || ''}
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  Initial budget estimate for this project (can be updated later)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        <div className="text-sm text-muted-foreground">
          Current Status: <span className="font-medium capitalize">{formatStatus(workflowState.currentStatus)}</span>
        </div>
        
        {canAdvance && (
          <Button 
            onClick={handleMarkComplete}
            disabled={isMarkingComplete}
            data-testid="button-complete-configuration"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {isMarkingComplete ? 'Completing...' : 'Complete Configuration'}
          </Button>
        )}
      </div>
    </div>
  );
}