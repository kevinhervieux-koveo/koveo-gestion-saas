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
import { useLanguage } from '@/hooks/use-language';
import { apiRequest } from '@/lib/queryClient';
import { insertMaintenanceProjectSchema, MaintenanceProject, EvaluationSuggestion } from '@shared/schemas/maintenance';
import { cn, parseDateOnly, parseDateOnlyLoose } from '@/lib/utils';
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
  const { t } = useLanguage();
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
      plannedStartDate: project?.plannedStartDate
        ? (parseDateOnlyLoose(project.plannedStartDate) ?? new Date())
        : undefined,
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
        form.setValue('plannedStartDate', parseDateOnlyLoose(evaluationSuggestion.suggestedDate) ?? new Date());
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
        financialYear: projectData.financialYear,
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
    successTitle: mode === 'create' ? t('projectFormToastCreatedTitle') : t('projectFormToastUpdatedTitle'),
    successMessage: (response) => {
      const projectTitle = response.project?.title || response.data?.title || '';
      const template = mode === 'create' ? t('projectFormToastCreatedDesc') : t('projectFormToastUpdatedDesc');
      return template.replace('{title}', projectTitle);
    },
    errorTitle: mode === 'create' ? t('projectFormToastCreationFailed') : t('projectFormToastUpdateFailed'),
    errorMessage: (error: any) =>
      error?.response?.data?.message || error?.message || t('projectFormToastErrorOccurred'),
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

      // Budgets, dashboards, and reports group project costs by
      // `maintenance_projects.financialYear` (and `plannedStartDate`).
      // The forecast endpoint reads those fields on demand — there are no
      // stored allocation rows to recompute — so we just invalidate every
      // forecast cache so the next read picks up the new values.
      queryClient.invalidateQueries({ queryKey: ['/api/budgets/forecast'] });
      if (actualBuildingId) {
        queryClient.invalidateQueries({
          queryKey: ['budgetForecast', actualBuildingId],
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['budgetForecast'] });
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
      const message = error?.response?.data?.message || error?.message || t('projectFormToastErrorOccurred');
      setError(message);
    },
  });

  const handleSubmit = async (data: ProjectFormData) => {
    // Validate buildingId is available
    if (!data.buildingId) {
      setError(t('projectFormToastBuildingIdRequired'));
      toast({
        title: t('validationError'),
        description: t('projectFormToastBuildingIdRequired'),
        variant: "destructive",
      });
      return;
    }

    if (!hasPermission('canCreateProjects') && mode === 'create') {
      toast({
        title: t('projectFormToastPermissionDenied'),
        description: t('projectFormToastNoCreatePermission'),
        variant: "destructive",
      });
      return;
    }

    if (!hasPermission('canEditMaintenance') && mode === 'edit') {
      toast({
        title: t('projectFormToastPermissionDenied'),
        description: t('projectFormToastNoEditPermission'),
        variant: "destructive",
      });
      return;
    }

    setError(null);
    saveMutation.mutate(data);
  };


  const title = mode === 'create' 
    ? (evaluationSuggestion ? t('projectFormCreateFromSuggestionTitle') : t('projectFormCreateNewTitle'))
    : t('projectFormEditTitle');

  const description = mode === 'create'
    ? t('projectFormCreateDescription')
    : t('projectFormEditDescription');

  return (
    <FormModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={saveMutation.isPending}
      submitLabel={mode === 'create' ? t('projectFormSubmitCreate') : t('projectFormSubmitUpdate')}
      cancelLabel={t('cancel')}
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
                  {t('projectFormCreatingFromSuggestionTitle')}
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {t('projectFormCreatingFromSuggestionDesc')}
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
                    <FormLabel className="text-base font-medium">{t('quickProject')}</FormLabel>
                    <FormDescription>
                      {t('projectFormQuickProjectDesc')}
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
                  <FormLabel>{t('projectFormTitleLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('projectFormTitlePlaceholder')}
                      {...field}
                      data-testid="input-quick-project-title"
                    />
                  </FormControl>
                  <FormDescription>
                    {t('projectFormTitleDesc')}
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
                  <FormLabel>{t('projectFormDescriptionLabel')} <span className="text-muted-foreground">{t('projectFormOptional')}</span></FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('projectFormDescriptionPlaceholderQuick')}
                      className="min-h-[80px]"
                      {...field}
                      data-testid="textarea-quick-project-description"
                    />
                  </FormControl>
                  <FormDescription>
                    {t('projectFormDescriptionDescQuick')}
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
                    <FormLabel>{t('projectFormBudgetLabel')}</FormLabel>
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
                      {t('projectFormBudgetDescQuick')}
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
                    <FormLabel>{t('projectFormFinancialYearLabel')}</FormLabel>
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
                      {t('projectFormFinancialYearDescQuick')}
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
                  <FormLabel>{t('projectFormProjectDateLabel')}</FormLabel>
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
                    {t('projectFormProjectDateDesc')}
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
              <FormLabel>{t('projectFormProjectNumberLabel')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('projectFormProjectNumberPlaceholder')}
                  {...field}
                  data-testid="input-project-number"
                />
              </FormControl>
              <FormDescription>
                {t('projectFormProjectNumberDesc')}
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
              <FormLabel>{t('projectFormProjectTitleLabel')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('projectFormTitlePlaceholder')}
                  {...field}
                  data-testid="input-project-title"
                />
              </FormControl>
              <FormDescription>
                {t('projectFormTitleDesc')}
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
              <FormLabel>{t('projectFormDescriptionLabel')}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('projectFormDescriptionPlaceholderStandard')}
                  className="min-h-[100px]"
                  {...field}
                  data-testid="textarea-project-description"
                />
              </FormControl>
              <FormDescription>
                {t('projectFormDescriptionDescStandard')}
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
                <FormLabel>{t('projectFormPlannedStartDateLabel')}</FormLabel>
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
                  {t('projectFormPlannedStartDateDesc')}
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
                <FormLabel>{t('projectFormTotalBudgetLabel')}</FormLabel>
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
                  {t('projectFormTotalBudgetDesc')}
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
                <FormLabel>{t('projectFormFinancialYearLabel')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="2024"
                    min="2000"
                    max="2100"
                    data-testid="input-project-financial-year"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)
                    }
                  />
                </FormControl>
                <FormDescription>
                  {t('projectFormFinancialYearDescStandard')}
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
                <FormLabel>{t('projectFormActualCostLabel')}</FormLabel>
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
                  {t('projectFormActualCostDesc')}
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

