import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
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
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useBuildingContext } from '@/hooks/use-building-context';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { insertMaintenanceProjectSchema, MaintenanceProject, EvaluationSuggestion } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import {
  CalendarIcon,
  Building2,
  Target,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Info,
  DollarSign,
  User,
} from 'lucide-react';

export interface ProjectFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project?: MaintenanceProject;
  evaluationSuggestion?: EvaluationSuggestion;
  mode?: 'create' | 'edit';
  onSuccess?: (project: MaintenanceProject) => void;
}

// Extended schema with additional validation
const projectFormSchema = insertMaintenanceProjectSchema.extend({
  description: z.string().optional(),
  vendorId: z.string().uuid().optional(),
  plannedStartDate: z.date().optional(),
  plannedEndDate: z.date().optional(),
}).refine((data) => {
  // End date must be after start date
  if (data.plannedStartDate && data.plannedEndDate) {
    return data.plannedEndDate > data.plannedStartDate;
  }
  return true;
}, {
  message: "End date must be after start date",
  path: ["plannedEndDate"],
});

type ProjectFormData = z.infer<typeof projectFormSchema>;

const projectTypes = [
  { value: 'evaluation', label: 'Evaluation', icon: Target, description: 'Assessment and analysis' },
  { value: 'repair', label: 'Repair', icon: Wrench, description: 'Fix existing components' },
  { value: 'minor_rehab', label: 'Minor Rehabilitation', icon: Building2, description: 'Minor improvements' },
  { value: 'major_rehab', label: 'Major Rehabilitation', icon: Building2, description: 'Significant renovations' },
  { value: 'replacement', label: 'Replacement', icon: CheckCircle2, description: 'Full component replacement' },
];

const projectStatuses = [
  { value: 'planned', label: 'Planned', description: 'Project is in planning phase' },
  { value: 'evaluation', label: 'Evaluation', description: 'Under evaluation' },
  { value: 'submission', label: 'Submission', description: 'Submitted for approval' },
  { value: 'pre_work', label: 'Pre-Work', description: 'Preparing for work' },
  { value: 'work', label: 'In Progress', description: 'Work is ongoing' },
  { value: 'post_work', label: 'Post-Work', description: 'Work completed, cleanup phase' },
  { value: 'completed', label: 'Completed', description: 'Project finished' },
];

const priorities = [
  { value: 'low', label: 'Low', color: 'text-gray-600' },
  { value: 'medium', label: 'Medium', color: 'text-blue-600' },
  { value: 'high', label: 'High', color: 'text-orange-600' },
  { value: 'critical', label: 'Critical', color: 'text-red-600' },
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
  const { buildingId, hasPermission } = useBuildingContext();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch vendors for selection
  const {
    data: vendorsResponse,
    isLoading: isLoadingVendors,
  } = useQuery({
    queryKey: ['/api/maintenance/vendors', buildingId],
    queryFn: async () => {
      if (!buildingId) throw new Error('Building ID is required');
      const response = await apiRequest('GET', `/api/maintenance/vendors?buildingId=${buildingId}`);
      return await response.json();
    },
    enabled: !!buildingId,
  });

  const vendors = vendorsResponse?.vendors || [];

  // Generate default project number for new projects
  const generateProjectNumber = () => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${year}${month}-${random}`;
  };

  // Initialize form with default values
  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      buildingId: buildingId || '',
      projectNumber: project?.projectNumber || generateProjectNumber(),
      title: project?.title || evaluationSuggestion?.reason || '',
      type: project?.type || evaluationSuggestion?.suggestedType || 'repair',
      status: project?.status || 'planned',
      priority: project?.priority || evaluationSuggestion?.priority || 'medium',
      totalBudget: project?.totalBudget ? parseFloat(project.totalBudget) : undefined,
      actualCost: project?.actualCost ? parseFloat(project.actualCost) : 0,
      plannedStartDate: project?.plannedStartDate ? new Date(project.plannedStartDate) : undefined,
      plannedEndDate: project?.plannedEndDate ? new Date(project.plannedEndDate) : undefined,
      suggestionId: project?.suggestionId || evaluationSuggestion?.id,
      description: '',
      vendorId: undefined,
      createdBy: project?.createdBy || '', // This will be set by the backend
    },
  });

  // Update form when evaluation suggestion changes
  useEffect(() => {
    if (evaluationSuggestion && !project) {
      form.setValue('title', evaluationSuggestion.reason);
      form.setValue('type', evaluationSuggestion.suggestedType);
      form.setValue('priority', evaluationSuggestion.priority);
      form.setValue('suggestionId', evaluationSuggestion.id);
      
      // Set suggested date as start date
      if (evaluationSuggestion.suggestedDate) {
        form.setValue('plannedStartDate', new Date(evaluationSuggestion.suggestedDate));
      }
    }
  }, [evaluationSuggestion, project, form]);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const endpoint = project 
        ? `/api/maintenance/projects/${project.id}`
        : '/api/maintenance/projects';
      
      const method = project ? 'PATCH' : 'POST';
      
      const response = await apiRequest(method, endpoint, {
        ...data,
        totalBudget: data.totalBudget?.toString(),
        actualCost: data.actualCost?.toString(),
        plannedStartDate: data.plannedStartDate?.toISOString().split('T')[0],
        plannedEndDate: data.plannedEndDate?.toISOString().split('T')[0],
      });
      
      return response.json();
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/maintenance/buildings', buildingId, 'projects'] 
      });
      
      // Also invalidate evaluation suggestions if this was created from one
      if (evaluationSuggestion) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/maintenance/evaluation-suggestions'] 
        });
      }
      
      toast({
        title: mode === 'create' ? "Project Created" : "Project Updated",
        description: `Project "${response.project?.title}" has been ${mode === 'create' ? 'created' : 'updated'} successfully.`,
      });
      
      onSuccess?.(response.project);
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'An error occurred';
      setError(message);
      toast({
        title: mode === 'create' ? "Creation Failed" : "Update Failed",
        description: message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (data: ProjectFormData) => {
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

    setIsSubmitting(true);
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
      isSubmitting={isSubmitting}
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

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {priorities.map((priority) => (
                      <SelectItem key={priority.value} value={priority.value}>
                        <div className="flex items-center gap-2">
                          <span className={priority.color}>●</span>
                          {priority.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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

        {/* Project Type and Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
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
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4" />
                            <div className="flex flex-col">
                              <span>{type.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {type.description}
                              </span>
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

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-project-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {projectStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        <div className="flex flex-col">
                          <span>{status.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {status.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="plannedStartDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Planned Start Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        data-testid="button-start-date"
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a start date</span>
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
                  When the project is planned to start
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="plannedEndDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Planned End Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        data-testid="button-end-date"
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick an end date</span>
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
                      disabled={(date) => {
                        const startDate = form.getValues('plannedStartDate');
                        return startDate ? date < startDate : 
                               date < new Date(new Date().setHours(0, 0, 0, 0));
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormDescription>
                  When the project is planned to complete
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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

          <FormField
            control={form.control}
            name="vendorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assigned Vendor</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-vendor">
                      <SelectValue placeholder="Select vendor (optional)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No vendor assigned</SelectItem>
                    {isLoadingVendors ? (
                      <div className="p-2">
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ) : (
                      vendors.map((vendor: any) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <div className="flex flex-col">
                              <span>{vendor.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {vendor.category}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Contractor or vendor assigned to this project
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
      </div>
    </FormModal>
  );
}

export type { ProjectFormProps };