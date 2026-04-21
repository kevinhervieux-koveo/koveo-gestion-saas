import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
import { format } from 'date-fns';
import { z } from 'zod';
import { FormModal } from '@/components/maintenance/FormModal';
import {
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useBuildingContext } from '@/hooks/use-building-context';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { insertMaintenanceProjectSchema, MaintenanceProject, EvaluationSuggestion } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Info,
  DollarSign,
  User,
  Calendar,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export interface ProjectFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project?: MaintenanceProject;
  evaluationSuggestion?: EvaluationSuggestion;
  mode?: 'create' | 'edit';
  onSuccess?: (project: MaintenanceProject) => void;
}

// Extended schema with additional validation
// Remove createdBy since it's set by the backend based on current user
const projectFormSchema = insertMaintenanceProjectSchema
  .omit({ createdBy: true })
  .extend({
    description: z.string().optional(),
    buildingId: z.string().uuid('Building ID is required'),
    type: z.enum(['repair', 'minor_rehab', 'major_rehab', 'replacement', 'not_sure']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    // Ensure financialYear is included in schema validation
    financialYear: z.number().int().min(2000).max(2100).optional(),
    // Quick Project fields
    isQuickProject: z.boolean().default(false),
    quickProjectBudget: z.number().min(0).optional(),
    quickProjectDate: z.date().optional(),
  })
  .refine((data) => {
    // Conditional validation for Quick Projects
    if (data.isQuickProject) {
      return (
        data.title?.trim().length > 0 &&
        data.quickProjectBudget !== undefined &&
        data.quickProjectBudget > 0 &&
        data.quickProjectDate !== undefined &&
        data.financialYear !== undefined &&
        data.financialYear > 2000 &&
        data.financialYear < 2100
      );
    }
    return true;
  }, {
    message: "Quick Projects require Title, Budget (> 0), Financial Year (2000-2100), and Project Date",
  });

type ProjectFormData = z.infer<typeof projectFormSchema>;

const projectStatuses = [
  { value: 'planned', label: 'Planned', description: 'Project is in planning phase' },
  { value: 'evaluation', label: 'Evaluation', description: 'Under evaluation' },
  { value: 'submission', label: 'Submission', description: 'Submitted for approval' },
  { value: 'pre_work', label: 'Pre-Work', description: 'Preparing for work' },
  { value: 'work', label: 'In Progress', description: 'Work is ongoing' },
  { value: 'post_work', label: 'Post-Work', description: 'Work completed, cleanup phase' },
  { value: 'completed', label: 'Completed', description: 'Project finished' },
];

/**
 * ProjectForm component for creating and editing maintenance projects
 * Uses FormModal foundation with comprehensive validation and integration
 */
export function ProjectForm({
  isOpen,
  onOpenChange,
  project,
  evaluationSuggestion,
  mode = project ? 'edit' : 'create',
  onSuccess,
}: ProjectFormProps) {
  // Get building context for real buildingId and permissions
  const { buildingId, organizationId: contextOrganizationId, hasPermission } = useBuildingContext();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  
  // Fetch building's financial year for Quick Project default date
  const {
    data: budgetResponse,
  } = useQuery({
    queryKey: ['/api/budgets', buildingId],
    queryFn: async () => {
      if (!buildingId) throw new Error('Building ID is required');
      const response = await apiRequest('GET', `/api/budgets/${buildingId}`);
      return await response.json();
    },
    enabled: !!buildingId && mode === 'create',
  });


  // Generate default project number for new projects
  const generateProjectNumber = () => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${year}${month}-${random}`;
  };

  // Get current or default financial year for Quick Projects
  const getDefaultFinancialYear = () => {
    if (budgetResponse?.budgets && budgetResponse.budgets.length > 0) {
      // Get the most recent year from budget data
      const years = budgetResponse.budgets.map((budget: any) => budget.year);
      return Math.max(...years);
    }
    return new Date().getFullYear();
  };

  const getDefaultQuickProjectDate = () => {
    const financialYear = getDefaultFinancialYear();
    return new Date(financialYear, 0, 1); // January 1st of the financial year
  };

  // Map evaluation suggestion type to project type
  // Evaluation suggestions can have 'inspection' type, which is not valid for projects
  const mapSuggestedTypeToProjectType = (suggestedType: string | undefined): 'repair' | 'minor_rehab' | 'major_rehab' | 'replacement' | 'not_sure' => {
    if (!suggestedType || suggestedType === 'inspection') {
      return 'not_sure';
    }
    return suggestedType as 'repair' | 'minor_rehab' | 'major_rehab' | 'replacement' | 'not_sure';
  };

  // Initialize form with default values
  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      buildingId: buildingId || undefined, // Will be validated to ensure it's available
      projectNumber: project?.projectNumber || generateProjectNumber(),
      title: project?.title || evaluationSuggestion?.reason || '',
      type: project?.type || mapSuggestedTypeToProjectType(evaluationSuggestion?.suggestedType),
      priority: project?.priority || evaluationSuggestion?.priority || 'medium',
      totalBudget: project?.totalBudget ? parseFloat(project.totalBudget) : undefined,
      actualCost: project?.actualCost ? parseFloat(project.actualCost) : 0,
      plannedStartDate: project?.plannedStartDate ? new Date(project.plannedStartDate) : undefined,
      suggestionId: project?.suggestionId || evaluationSuggestion?.id,
      description: project?.planningDescription || '',
      // Quick Project defaults
      isQuickProject: false,
      quickProjectBudget: undefined,
      quickProjectDate: mode === 'create' ? getDefaultQuickProjectDate() : undefined,
      financialYear: mode === 'create' ? getDefaultFinancialYear() : project?.financialYear,
      // createdBy removed - will be set by the backend based on current user
    },
  });

  // Update buildingId when it becomes available
  useEffect(() => {
    if (buildingId && !form.getValues('buildingId')) {
      form.setValue('buildingId', buildingId);
    }
  }, [buildingId, form]);

  // Update Quick Project defaults when budget data becomes available
  useEffect(() => {
    if (budgetResponse && mode === 'create' && !project) {
      const financialYear = getDefaultFinancialYear();
      const defaultDate = new Date(financialYear, 0, 1);
      
      form.setValue('financialYear', financialYear);
      form.setValue('quickProjectDate', defaultDate);
    }
  }, [budgetResponse, mode, project, form]);


  // Update form when evaluation suggestion changes
  useEffect(() => {
    if (evaluationSuggestion && !project) {
      form.setValue('title', evaluationSuggestion.reason);
      form.setValue('type', mapSuggestedTypeToProjectType(evaluationSuggestion.suggestedType));
      form.setValue('priority', evaluationSuggestion.priority);
      form.setValue('suggestionId', evaluationSuggestion.id);
      
      // Set suggested date as start date
      if (evaluationSuggestion.suggestedDate) {
        form.setValue('plannedStartDate', new Date(evaluationSuggestion.suggestedDate));
      }
    }
  }, [evaluationSuggestion, project, form]);

  // Create/Update mutation
  const saveMutation = useCreateUpdateMutation<any, ProjectFormData>({
    mutationFn: async (data) => {
      const endpoint = project 
        ? `/api/maintenance/projects/${project.id}`
        : '/api/maintenance/projects';
      
      const method = project ? 'PUT' : 'POST';
      
      // Handle Quick Project data mapping
      let processedData = { ...data };
      if (data.isQuickProject && mode === 'create') {
        processedData = {
          ...data,
          // Map Quick Project fields to regular project fields
          totalBudget: data.quickProjectBudget,
          actualCost: data.quickProjectBudget, // Set actual cost equal to budget for completed projects
          plannedStartDate: data.quickProjectDate,
          estimatedCost: data.quickProjectBudget,
          // Set default values for Quick Projects
          type: 'not_sure',
          priority: 'medium',
        };
      }
      
      const projectData = processedData;
      
      // Ensure required fields are properly set
      if (!projectData.buildingId) {
        throw new Error('Building ID is required');
      }
      
      // Build payload with proper field mapping and filtering
      const payload: any = {
        buildingId: projectData.buildingId,
        projectNumber: projectData.projectNumber,
        title: projectData.title,
        type: projectData.type,
        priority: projectData.priority,
        totalBudget: projectData.totalBudget?.toString(),
        actualCost: projectData.actualCost?.toString(),
        plannedStartDate: projectData.plannedStartDate?.toISOString().split('T')[0],
        plannedEndDate: projectData.plannedEndDate?.toISOString().split('T')[0],
        // Map 'description' to 'planningDescription' per backend schema
        planningDescription: projectData.description,
        estimatedCost: projectData.estimatedCost?.toString(),
        suggestionId: projectData.suggestionId,
        autoGeneratedId: projectData.autoGeneratedId,
        skipSubmission: projectData.skipSubmission,
        skipPreWork: projectData.skipPreWork,
        skipInProgress: projectData.skipInProgress,
        skipPostWork: projectData.skipPostWork,
      };
      
      // Remove undefined/null values to keep payload clean
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
          delete payload[key];
        }
      });
      
      
      const response = await apiRequest(method, endpoint, payload);
      const result = await response.json();
      
      return result;
    },
    successTitle: mode === 'create' ? 'Project Created' : 'Project Updated',
    successMessage: (response) =>
      `Project "${response.project?.title || response.data?.title}" has been ${mode === 'create' ? 'created' : 'updated'} successfully.`,
    errorTitle: mode === 'create' ? 'Creation Failed' : 'Update Failed',
    errorMessage: (error: any) =>
      error?.response?.data?.message || error?.message || 'An error occurred',
    invalidateQueries: (response, queryClient) => {
      // Use the buildingId from the actual form data that was used to create the project
      // This ensures we invalidate the correct cache even if the context buildingId differs
      const actualBuildingId =
        response.project?.buildingId || response.data?.buildingId || buildingId;

      if (actualBuildingId) {
        queryClient.invalidateQueries({
          queryKey: ['/api/maintenance/buildings', actualBuildingId, 'projects'],
        });
      } else {
        // Invalidate all project queries as fallback
        queryClient.invalidateQueries({
          predicate: (query) => {
            return (
              query.queryKey.includes('/api/maintenance/buildings') &&
              query.queryKey.includes('projects')
            );
          },
        });
      }

      // Also invalidate evaluation suggestions if this was created from one
      if (evaluationSuggestion) {
        queryClient.invalidateQueries({
          queryKey: ['/api/maintenance/evaluation-suggestions'],
        });
      }
    },
    onSuccessCallback: (response) => {
      onSuccess?.(response.project || response.data);
      onOpenChange(false);
      form.reset();
    },
    onErrorCallback: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'An error occurred';
      setError(message);
    },
  });

  const handleSubmit = async (data: ProjectFormData) => {
    // Validate buildingId is available
    if (!data.buildingId) {
      setError('Building ID is required but not available. Please refresh the page and try again.');
      toast({
        title: "Validation Error",
        description: "Building ID is required but not available. Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }

    if (!hasPermission('canCreateProjects') && mode === 'create') {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to create projects.",
        variant: "destructive",
      });
      return;
    }

    if (!hasPermission('canEditMaintenance') && mode === 'edit') {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to edit projects.",
        variant: "destructive",
      });
      return;
    }

    setError(null);
    saveMutation.mutate(data);
  };


  const title = mode === 'create' 
    ? (evaluationSuggestion ? 'Create Project from Suggestion' : 'Create New Project')
    : 'Edit Project';

  const description = mode === 'create'
    ? 'Create a new maintenance project to track work and manage resources.'
    : 'Update project details and configuration.';

  return (
    <FormModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={saveMutation.isPending}
      submitLabel={mode === 'create' ? 'Create Project' : 'Update Project'}
      size="lg"
      error={error}
    >
      <div className="space-y-6">
        {/* Project from Evaluation Suggestion Info */}
        {evaluationSuggestion && mode === 'create' && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Creating from Evaluation Suggestion
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  This project is being created based on an evaluation suggestion. 
                  Some fields have been pre-populated for you.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Project Toggle - Only for creation mode */}
        {mode === 'create' && !evaluationSuggestion && (
          <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
            <FormField
              control={form.control}
              name="isQuickProject"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-medium">Quick Project</FormLabel>
                    <FormDescription>
                      Create a simplified project with essential fields only (Title, Description, Budget, Financial Year, Date)
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="toggle-quick-project"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Quick Project Fields */}
        {form.watch('isQuickProject') && mode === 'create' && (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Roof Repair - Building A"
                      {...field}
                      data-testid="input-quick-project-title"
                    />
                  </FormControl>
                  <FormDescription>
                    Clear, descriptive name for the project
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description <span className="text-muted-foreground">(Optional)</span></FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of the project..."
                      className="min-h-[80px]"
                      {...field}
                      data-testid="textarea-quick-project-description"
                    />
                  </FormControl>
                  <FormDescription>
                    Optional detailed description
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quickProjectBudget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget</FormLabel>
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
                          data-testid="input-quick-project-budget"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                          value={field.value || ''}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Project budget in dollars
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="financialYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Financial Year</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="2024"
                        min="2000"
                        max="2100"
                        data-testid="input-quick-project-financial-year"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                      />
                    </FormControl>
                    <FormDescription>
                      Budget assignment year
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="quickProjectDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Date</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        className="pl-9"
                        value={field.value ? field.value.toISOString().split('T')[0] : ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            field.onChange(new Date(e.target.value));
                          } else {
                            field.onChange(undefined);
                          }
                        }}
                        data-testid="input-quick-project-date"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Target completion date for the project
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Standard Project Fields - Hidden when Quick Project is enabled */}
        {(!form.watch('isQuickProject') || mode === 'edit') && (
          <>
        {/* Basic Information */}
        <FormField
          control={form.control}
          name="projectNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Number</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., 2024-001"
                  {...field}
                  data-testid="input-project-number"
                />
              </FormControl>
              <FormDescription>
                Unique identifier for this project
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Title</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Roof Repair - Building A"
                  {...field}
                  data-testid="input-project-title"
                />
              </FormControl>
              <FormDescription>
                Clear, descriptive name for the project
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Detailed description of the project scope and objectives..."
                  className="min-h-[100px]"
                  {...field}
                  data-testid="textarea-project-description"
                />
              </FormControl>
              <FormDescription>
                Optional detailed description of the project
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Timeline */}
        <FormField
          control={form.control}
          name="plannedStartDate"
          render={({ field }) => {
            // Format the date value for the input
            const formatDateForInput = (date: Date | null | undefined): string => {
              if (!date) return '';
              try {
                return format(date, 'yyyy-MM-dd');
              } catch {
                return '';
              }
            };

            return (
              <FormItem>
                <FormLabel>Planned Start Date</FormLabel>
                <FormControl>
                  <Input
                    value={formatDateForInput(field.value)}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      if (inputValue === '') {
                        field.onChange(undefined);
                      } else {
                        // Let the native date input handle the parsing
                        // Only update when we have a complete valid date string (YYYY-MM-DD)
                        if (inputValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                          try {
                            const dateValue = new Date(inputValue + 'T00:00:00');
                            // Validate that the date is valid
                            if (!isNaN(dateValue.getTime())) {
                              field.onChange(dateValue);
                            }
                          } catch (error) {
                            // Date parsing error handled silently
                          }
                        }
                      }
                    }}
                    type="date"
                    min={format(new Date(), 'yyyy-MM-dd')}
                    data-testid="input-start-date"
                  />
                </FormControl>
                <FormDescription>
                  When the project is planned to start
                </FormDescription>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        {/* Budget and Vendor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="totalBudget"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Budget</FormLabel>
                <FormControl>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="0.00"
                      className="pl-9"
                      step="0.01"
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                      data-testid="input-total-budget"
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  Total allocated budget for this project
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Current Cost (for edit mode) */}
        {mode === 'edit' && (
          <FormField
            control={form.control}
            name="actualCost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Actual Cost</FormLabel>
                <FormControl>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="0.00"
                      className="pl-9"
                      step="0.01"
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                      data-testid="input-actual-cost"
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  Current actual cost spent on this project
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
          </>
        )}
      </div>
    </FormModal>
  );
}

