import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
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
import { BuildingElementsMultiSelect } from '@/components/ui/building-elements-multi-select';
import { useUpdateProjectDetails, useMarkStatusComplete, type ProjectWorkflowState } from '@/hooks/useProjectWorkflow';
import { ReopenStepDialog } from './ReopenStepDialog';
import { MaintenanceProject, BuildingElement } from '@shared/schemas/maintenance';
import { useToast } from '@/hooks/use-toast';
import { useBuildingContext } from '@/hooks/use-building-context';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn, formatStatus } from '@/lib/utils';
import { format } from 'date-fns';
import {
  CalendarIcon,
  DollarSign,
  AlertTriangle,
  Building2,
} from 'lucide-react';

export interface PlannedTabProps {
  project: MaintenanceProject;
  workflowState: ProjectWorkflowState;
  onUpdate: () => void;
  onAdvanceToNext?: (newStatus?: string) => void;
}

const plannedTabSchema = z.object({
  planningDescription: z.string().min(1, 'Description is required').max(1000, 'Description must be less than 1000 characters'),
  planningStartDate: z.date({
    message: 'Start planning date is required'
  }),
  estimatedCost: z.number().min(0, 'Cost must be non-negative').max(1000000, 'Cost must be less than $1,000,000'),
  financialYear: z.number().min(2000, 'Financial year must be 2000 or later').max(2100, 'Financial year must be 2100 or earlier'),
  selectedElements: z.array(z.string()).default([]),
});

type PlannedTabData = z.infer<typeof plannedTabSchema>;

/**
 * Planned tab component for project planning with 3 specific fields
 * Handles project description, start planning date, and estimated cost
 */
export function PlannedTab({ project, workflowState, onUpdate, onAdvanceToNext }: PlannedTabProps) {
  const { toast } = useToast();
  const { buildingId } = useBuildingContext();
  const [hasChanges, setHasChanges] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  
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
  const { mutate: markStatusComplete, isPending: isMarkingComplete } = useMarkStatusComplete();

  // Fetch building elements for selection
  const {
    data: elementsResponse,
    isLoading: isLoadingElements,
  } = useQuery({
    queryKey: ['/api/maintenance/buildings', buildingId, 'elements'],
    queryFn: async () => {
      if (!buildingId) throw new Error('Building ID is required');
      const response = await apiRequest('GET', `/api/maintenance/buildings/${buildingId}/elements`);
      return await response.json();
    },
    enabled: !!buildingId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch current project elements
  const {
    data: projectElementsResponse,
  } = useQuery({
    queryKey: ['/api/maintenance/projects', project.id, 'elements'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/projects/${project.id}/elements`);
      return await response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const availableElements: BuildingElement[] = elementsResponse?.data || [];
  const currentProjectElements = projectElementsResponse?.elements || [];
  const currentElementIds = currentProjectElements.map((pe: any) => pe.elementId);

  const form = useForm<PlannedTabData>({
    resolver: zodResolver(plannedTabSchema),
    defaultValues: {
      planningDescription: project.planningDescription || '',
      planningStartDate: project.planningStartDate ? new Date(project.planningStartDate) : undefined,
      estimatedCost: project.estimatedCost ? parseFloat(project.estimatedCost) : undefined,
      financialYear: project.financialYear || new Date().getFullYear(),
      selectedElements: currentElementIds,
    },
  });

  // Reset initial data loaded flag when project changes
  useEffect(() => {
    setInitialDataLoaded(false);
    setHasChanges(false);
  }, [project.id]);

  // Update form when project elements load initially
  useEffect(() => {
    if (!initialDataLoaded && projectElementsResponse) {
      form.setValue('selectedElements', currentElementIds, { shouldValidate: false, shouldDirty: false });
      setInitialDataLoaded(true);
      setHasChanges(false); // Ensure form is not marked dirty from initial load
    }
  }, [currentElementIds, form, initialDataLoaded, projectElementsResponse]);

  // Watch for form changes
  useEffect(() => {
    const subscription = form.watch(() => setHasChanges(true));
    return () => subscription.unsubscribe();
  }, [form]);


  const handleSave = async () => {
    const result = await form.trigger();
    if (!result) return; // Don't save if validation fails

    const values = form.getValues();
    
    // Update project details first
    updateProject({
      projectId: project.id,
      updates: {
        planningDescription: values.planningDescription,
        planningStartDate: values.planningStartDate?.toISOString().split('T')[0],
        estimatedCost: values.estimatedCost,
        financialYear: values.financialYear,
      },
      status: 'planned',
    }, {
      onSuccess: () => {
        // Always update project elements, even if empty (to handle removals)
        handleUpdateProjectElements(values.selectedElements || []);
        setHasChanges(false);
        onUpdate();
      },
    });
  };

  const handleMarkComplete = async () => {
    const result = await form.trigger();
    if (!result) return; // Don't save if validation fails

    const values = form.getValues();
    
    // Update project and mark as complete
    updateProject({
      projectId: project.id,
      updates: {
        planningDescription: values.planningDescription,
        planningStartDate: values.planningStartDate?.toISOString().split('T')[0],
        estimatedCost: values.estimatedCost,
        financialYear: values.financialYear,
      },
      status: 'submission', // Advance to next stage
    }, {
      onSuccess: () => {
        handleUpdateProjectElements(values.selectedElements || []);
        setHasChanges(false);
        onUpdate();
        toast({
          title: 'Success',
          description: 'Project planning completed and moved to submission stage.',
        });
        // Advance to the next tab
        if (onAdvanceToNext) {
          setTimeout(() => onAdvanceToNext('submission'), 500); // Small delay for toast to show
        }
      },
    });
  };

  // Check if all required fields are filled
  const values = form.watch();
  const isComplete = !!(
    values.planningDescription &&
    values.planningDescription.trim().length > 0 &&
    values.planningStartDate &&
    values.estimatedCost !== undefined &&
    values.financialYear !== undefined &&
    values.selectedElements &&
    values.selectedElements.length > 0
  );

  const handleUpdateProjectElements = async (selectedElementIds: string[]) => {
    try {
      // Get current project elements to see what needs to be added/removed
      const currentIds = currentElementIds;
      const toAdd = selectedElementIds.filter(id => !currentIds.includes(id));
      const toRemove = currentIds.filter(id => !selectedElementIds.includes(id));
      
      // Skip API calls if no changes needed
      if (toAdd.length === 0 && toRemove.length === 0) {
        return;
      }
      
      // Add new elements
      if (toAdd.length > 0) {
        await apiRequest('POST', `/api/maintenance/projects/${project.id}/elements`, {
          elementIds: toAdd,
        });
      }
      
      // Remove elements that are no longer selected
      if (toRemove.length > 0) {
        const projectElementsToRemove = currentProjectElements.filter((pe: any) => 
          toRemove.includes(pe.elementId)
        );
        
        for (const projectElement of projectElementsToRemove) {
          await apiRequest('DELETE', `/api/maintenance/project-elements/${projectElement.id}`);
        }
      }
      
      // Invalidate queries to keep cache in sync
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/projects', project.id, 'elements'] 
      });
      
    } catch (error) {
      console.error('Error updating project elements:', error);
      toast({
        title: 'Warning',
        description: 'Project saved but there was an issue updating the selected elements.',
        variant: 'destructive',
      });
    }
  };

  // Removed handleMarkComplete function - user requested button removal

  return (
    <div className="h-full flex flex-col" data-testid="planned-tab">
      {/* Header */}
      <div className="space-y-1 mb-6">
        <h3 className="text-lg font-semibold">Project Planning</h3>
        <p className="text-sm text-muted-foreground">
          Define the project description, planning timeline, and estimated cost
        </p>
      </div>

      {/* Scrollable form content */}
      <div className="flex-1 overflow-y-auto pr-2 -mr-2">
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
                <FormItem data-testid="form-item-start-planning-date">
                  <FormLabel>Start Planning Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      min={format(new Date(), 'yyyy-MM-dd')}
                      value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          field.onChange(new Date(e.target.value));
                        } else {
                          field.onChange(undefined);
                        }
                      }}
                      data-testid="input-start-planning-date"
                    />
                  </FormControl>
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

            {/* Financial Year */}
            <FormField
              control={form.control}
              name="financialYear"
              render={({ field }) => (
                <FormItem data-testid="form-item-financial-year">
                  <FormLabel>Financial Year</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="2024"
                      min="2000"
                      max="2100"
                      data-testid="input-financial-year"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    The financial year for budget assignment. Costs will be allocated to the closest month in this year.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status Display */}
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                Current Status: <span className="font-medium capitalize">{formatStatus(workflowState.currentStatus)}</span>
              </div>
            </div>
          </form>
        </Form>
      </div>

      {/* Fixed Building Elements Selection at Bottom */}
      <div className="border-t bg-background pt-4 mt-4">
        <Form {...form}>
          <FormField
            control={form.control}
            name="selectedElements"
            render={({ field }) => (
              <FormItem data-testid="form-item-building-elements">
                <FormLabel>Building Elements</FormLabel>
                <FormControl>
                  <BuildingElementsMultiSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    elements={availableElements}
                    disabled={isLoadingElements}
                    placeholder={isLoadingElements ? "Loading elements..." : "Select building elements for this project"}
                    searchPlaceholder="Search by name, code, or condition..."
                    emptyMessage={isLoadingElements ? "Loading..." : "No building elements found"}
                    data-testid="select-building-elements"
                  />
                </FormControl>
                <FormDescription>
                  Select the building elements that will be affected by this maintenance project.
                  {availableElements.length === 0 && !isLoadingElements && (
                    <span className="text-amber-600 dark:text-amber-400 block mt-1">
                      No building elements available. You may need to add elements to this building first.
                    </span>
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </Form>
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
          
          <div className="text-sm text-muted-foreground">
            {workflowState.nextStatus && (
              <>Next: <span className="capitalize">{formatStatus(workflowState.nextStatus)}</span></>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {hasChanges && (
            <Button 
              variant="outline" 
              onClick={handleSave} 
              disabled={isUpdating} 
              data-testid="button-save-changes"
            >
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
          
          {isComplete && (
            <Button 
              onClick={() => markStatusComplete(
                { projectId: project.id, currentStatus: 'planned' },
                {
                  onSuccess: (data) => {
                    onUpdate();
                    // Navigate to the next step after successful completion
                    if (onAdvanceToNext && data?.newStatus) {
                      onAdvanceToNext(data.newStatus);
                    } else if (onAdvanceToNext) {
                      // Default to submission if newStatus not available
                      onAdvanceToNext('submission');
                    }
                  }
                }
              )}
              disabled={isMarkingComplete} 
              data-testid="button-complete-planning"
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              {isMarkingComplete ? 'Completing...' : 'Complete Planning Phase'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}