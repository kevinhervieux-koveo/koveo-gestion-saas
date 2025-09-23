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
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useUpdateProjectDetails, useMarkStatusComplete, type ProjectWorkflowState } from '@/hooks/useProjectWorkflow';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
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
} from 'lucide-react';

export interface PlannedTabProps {
  project: MaintenanceProject;
  workflowState: ProjectWorkflowState;
  onUpdate: () => void;
}

const plannedTabSchema = z.object({
  planningDescription: z.string().optional(),
  planningStartDate: z.date().optional(),
  estimatedCost: z.number().min(0, 'Cost must be non-negative').optional(),
  type: z.enum(['repair', 'minor_rehab', 'major_rehab', 'replacement', 'not_sure']),
});

type PlannedTabData = z.infer<typeof plannedTabSchema>;

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
 * Planned tab component for project planning and initial setup
 * Handles project description, start date, cost estimation, and type selection
 */
export function PlannedTab({ project, workflowState, onUpdate }: PlannedTabProps) {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);

  const { mutate: updateProject, isPending: isUpdating } = useUpdateProjectDetails();
  const { mutate: markComplete, isPending: isMarkingComplete } = useMarkStatusComplete();

  const form = useForm<PlannedTabData>({
    resolver: zodResolver(plannedTabSchema),
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
      status: 'planned',
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
            Set up project details, timeline, and cost estimates
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Project Details */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Project Description
                  </CardTitle>
                  <CardDescription>
                    Describe the work to be performed and any special requirements
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="planningDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the project scope, requirements, and any important details..."
                            className="min-h-[120px]"
                            {...field}
                            data-testid="input-planning-description"
                          />
                        </FormControl>
                        <FormDescription>
                          This description will be used throughout the project workflow
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
                    <Target className="h-5 w-5" />
                    Project Type
                  </CardTitle>
                  <CardDescription>
                    Select the type of work that best describes this project
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-project-type">
                              <SelectValue placeholder="Select project type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {projectTypes.map((type) => {
                              const TypeIcon = type.icon;
                              return (
                                <SelectItem key={type.value} value={type.value}>
                                  <div className="flex items-center gap-2">
                                    <TypeIcon className="h-4 w-4" />
                                    <div>
                                      <div className="font-medium">{type.label}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {type.description}
                                      </div>
                                    </div>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Timeline and Budget */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    Planning Timeline
                  </CardTitle>
                  <CardDescription>
                    Set when you want to start planning and preparation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="planningStartDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Planning Start Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                                data-testid="button-planning-start-date"
                              >
                                {field.value ? (
                                  format(field.value, 'PPP')
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
                                date < new Date(new Date().setHours(0, 0, 0, 0))
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          When do you want to begin detailed planning?
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
                    <DollarSign className="h-5 w-5" />
                    Budget Estimation
                  </CardTitle>
                  <CardDescription>
                    Provide an initial cost estimate for planning purposes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="estimatedCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Cost ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                            value={field.value || ''}
                            data-testid="input-estimated-cost"
                          />
                        </FormControl>
                        <FormDescription>
                          This is an initial estimate that can be refined later
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t">
            <div className="text-sm text-muted-foreground">
              {hasChanges && 'Unsaved changes • '}
              {workflowState.nextStatus && (
                <>Next: <span className="capitalize">{workflowState.nextStatus.replace('_', ' ')}</span></>
              )}
            </div>
            
            {canAdvance && (
              <Button 
                onClick={handleMarkComplete}
                disabled={isMarkingComplete || isUpdating}
                className="flex items-center gap-2"
                data-testid="button-mark-planned-complete"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isMarkingComplete ? 'Completing...' : 'Mark Planning Complete'}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}