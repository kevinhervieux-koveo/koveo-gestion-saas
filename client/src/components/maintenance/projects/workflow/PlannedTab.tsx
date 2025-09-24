import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
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
  AlertTriangle,
} from 'lucide-react';

export interface PlannedTabProps {
  project: MaintenanceProject;
  workflowState: ProjectWorkflowState;
  onUpdate: () => void;
}

const plannedTabSchema = z.object({
  planningDescription: z.string().min(1, 'Description is required').max(1000, 'Description must be less than 1000 characters'),
  planningStartDate: z.date({
    message: 'Start planning date is required'
  }),
  estimatedCost: z.number().min(0, 'Cost must be non-negative').max(1000000, 'Cost must be less than $1,000,000'),
});

type PlannedTabData = z.infer<typeof plannedTabSchema>;

/**
 * Planned tab component for project planning with 3 specific fields
 * Handles project description, start planning date, and estimated cost
 */
export function PlannedTab({ project, workflowState, onUpdate }: PlannedTabProps) {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);

  // Defensive null check for project data
  if (!project) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Project data is missing. Unable to load the planning tab.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { mutate: updateProject, isPending: isUpdating } = useUpdateProjectDetails();
  const { mutate: markComplete, isPending: isMarkingComplete } = useMarkStatusComplete();

  const form = useForm<PlannedTabData>({
    resolver: zodResolver(plannedTabSchema),
    defaultValues: {
      planningDescription: project.planningDescription || '',
      planningStartDate: project.planningStartDate ? new Date(project.planningStartDate) : undefined,
      estimatedCost: project.estimatedCost ? parseFloat(project.estimatedCost) : undefined,
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
    const result = await form.trigger();
    if (!result) return; // Don't save if validation fails

    const values = form.getValues();
    
    updateProject({
      projectId: project.id,
      updates: {
        planningDescription: values.planningDescription,
        planningStartDate: values.planningStartDate?.toISOString().split('T')[0],
        estimatedCost: values.estimatedCost,
      },
      status: 'planned',
    }, {
      onSuccess: () => {
        setHasChanges(false);
        onUpdate();
      },
    });
  };

  const handleMarkComplete = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors before completing this step',
        variant: 'destructive',
      });
      return;
    }

    // Save current changes first
    if (hasChanges) {
      const values = form.getValues();
      updateProject({
        projectId: project.id,
        updates: {
          planningDescription: values.planningDescription,
          planningStartDate: values.planningStartDate?.toISOString().split('T')[0],
          estimatedCost: values.estimatedCost,
        },
        status: 'planned',
      }, {
        onSuccess: () => {
          // Then mark as complete
          markComplete({
            projectId: project.id,
            currentStatus: 'planned',
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
        currentStatus: 'planned',
      }, {
        onSuccess: () => {
          onUpdate();
        },
      });
    }
  };

  const canAdvance = workflowState.canAdvance && workflowState.currentStatus === 'planned';

  return (
    <div className="space-y-6" data-testid="planned-tab">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Project Planning</h3>
          <p className="text-sm text-muted-foreground">
            Define the project description, planning timeline, and estimated cost
          </p>
        </div>
        {hasChanges && (
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isUpdating}>
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </div>

      <Form {...form}>
        <form className="space-y-6">
          {/* Project Description */}
          <FormField
            control={form.control}
            name="planningDescription"
            render={({ field }) => (
              <FormItem data-testid="form-item-description">
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe the maintenance work needed, including scope, specific areas, and any special requirements..."
                    rows={4}
                    data-testid="textarea-description"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Provide a detailed description of the planned maintenance work
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Start Planning Date */}
          <FormField
            control={form.control}
            name="planningStartDate"
            render={({ field }) => (
              <FormItem className="flex flex-col" data-testid="form-item-start-planning-date">
                <FormLabel>Start Planning Date</FormLabel>
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
                      data-testid="calendar-start-planning-date"
                    />
                  </PopoverContent>
                </Popover>
                <FormDescription>
                  When do you plan to start working on this project?
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
              <FormItem data-testid="form-item-estimated-cost">
                <FormLabel>Estimated Cost</FormLabel>
                <FormControl>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      max="1000000"
                      className="pl-9"
                      data-testid="input-estimated-cost"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                      value={field.value || ''}
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  Estimated total cost for this project in dollars
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
            data-testid="button-complete-planning"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {isMarkingComplete ? 'Completing...' : 'Complete Planning'}
          </Button>
        )}
      </div>
    </div>
  );
}