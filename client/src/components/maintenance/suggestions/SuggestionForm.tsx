// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
import { z } from 'zod';
import { addMonths, format } from 'date-fns';
import { FormModal } from '@/components/maintenance/FormModal';
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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useBuildingContext } from '@/hooks/use-building-context';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import {
  CalendarIcon,
  Building,
  DollarSign,
  AlertCircle,
  Lightbulb,
  Calculator,
  Zap,
} from 'lucide-react';
import { insertEvaluationSuggestionSchema } from '@shared/schemas/maintenance';
import { SuggestionFormProps, SuggestionWithElement } from './types';
import { useLanguage } from '@/hooks/use-language';

// Form validation schema based on maintenance schema
const suggestionFormSchema = insertEvaluationSuggestionSchema.extend({
  costEstimate: z.number().min(0, 'Cost must be non-negative').optional(),
  description: z.string().optional(),
  autoCalculate: z.boolean().default(false),
});

type SuggestionFormData = z.infer<typeof suggestionFormSchema>;

// Suggestion type options
const suggestionTypes = [
  { value: 'inspection', label: 'Inspection', description: 'Regular condition assessment' },
  { value: 'minor_rehab', label: 'Minor Rehabilitation', description: 'Small repairs and maintenance' },
  { value: 'major_rehab', label: 'Major Rehabilitation', description: 'Significant renovation work' },
  { value: 'replacement', label: 'Replacement', description: 'Complete element replacement' },
];

// Priority options
const priorities = [
  { value: 'low', label: 'Low', color: 'text-gray-600', description: 'Can be deferred' },
  { value: 'medium', label: 'Medium', color: 'text-blue-600', description: 'Should be addressed soon' },
  { value: 'high', label: 'High', color: 'text-orange-600', description: 'Needs attention' },
  { value: 'critical', label: 'Critical', color: 'text-red-600', description: 'Urgent action required' },
];

/**
 * SuggestionForm component for creating and editing evaluation suggestions
 * Uses FormModal with comprehensive validation and auto-calculation features
 */
export function SuggestionForm({
  isOpen,
  onOpenChange,
  suggestion,
  elementId,
  buildingId,
  onSubmit,
  mode = 'create',
}: SuggestionFormProps) {
  const { t } = useLanguage();
  const { hasPermission } = useBuildingContext();

  // Fetch building elements for selection
  const {
    data: elementsResponse,
    isLoading: isLoadingElements,
  } = useQuery({
    queryKey: ['/api/maintenance/buildings', buildingId, 'elements'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/buildings/${buildingId}/elements`);
      return await response.json();
    },
    enabled: isOpen && !!buildingId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const elements = elementsResponse?.elements || [];
  const selectedElement = elements.find((el: any) => el.id === (elementId || suggestion?.elementId));

  // Auto-calculation query for suggestions
  const {
    data: calculationResponse,
    isLoading: isCalculating,
    refetch: recalculate,
  } = useQuery({
    queryKey: ['/api/maintenance/suggestions/calculate', elementId || suggestion?.elementId],
    queryFn: async () => {
      const targetElementId = elementId || suggestion?.elementId;
      if (!targetElementId) return null;
      
      const response = await apiRequest('GET', `/api/maintenance/suggestions/calculate?elementId=${targetElementId}`);
      return await response.json();
    },
    enabled: false, // Only run when explicitly triggered
  });

  // Form initialization
  const form = useForm<SuggestionFormData>({
    resolver: zodResolver(suggestionFormSchema),
    defaultValues: {
      buildingId: buildingId || '',
      elementId: elementId || suggestion?.elementId || '',
      suggestedDate: suggestion?.suggestedDate ? new Date(suggestion.suggestedDate) : addMonths(new Date(), 1),
      suggestedType: suggestion?.suggestedType || 'inspection',
      reason: suggestion?.reason || '',
      priority: suggestion?.priority || 'medium',
      costEstimate: suggestion?.costEstimate || undefined,
      description: '',
      autoCalculate: false,
    },
  });

  // Watch form values for auto-calculation
  const watchedElementId = form.watch('elementId');
  const watchedAutoCalculate = form.watch('autoCalculate');

  // Create/Update mutation
  const createMutation = useCreateUpdateMutation<any, SuggestionFormData>({
    mutationFn: async (data) => {
      const endpoint = mode === 'edit' && suggestion?.id
        ? `/api/maintenance/suggestions/${suggestion.id}`
        : '/api/maintenance/suggestions';

      const method = mode === 'edit' ? 'PATCH' : 'POST';

      const response = await apiRequest(method, endpoint, {
        ...data,
        suggestedDate: data.suggestedDate?.toISOString(),
      });
      return response.json();
    },
    queryKeysToInvalidate: [
      '/api/maintenance/suggestions',
      ['/api/maintenance/buildings', buildingId, 'suggestions'],
    ],
    successTitle: mode === 'edit' ? 'Suggestion Updated' : 'Suggestion Created',
    successMessage: `The suggestion has been ${mode === 'edit' ? 'updated' : 'created'} successfully.`,
    errorTitle: 'Error',
    errorMessage: `Failed to ${mode === 'edit' ? 'update' : 'create'} suggestion. Please try again.`,
    onSuccessCallback: (data) => {
      onSubmit?.(data.suggestion);
      onOpenChange(false);
      form.reset();
    },
    onErrorCallback: (error) => {
      console.error('Suggestion mutation failed:', error);
    },
  });

  // Auto-calculate suggestions when element changes
  useEffect(() => {
    if (watchedAutoCalculate && watchedElementId && isOpen) {
      recalculate();
    }
  }, [watchedAutoCalculate, watchedElementId, isOpen, recalculate]);

  // Apply calculated values
  useEffect(() => {
    if (calculationResponse?.calculation && watchedAutoCalculate) {
      const calc = calculationResponse.calculation;
      
      form.setValue('suggestedType', calc.recommendedType);
      form.setValue('priority', calc.recommendedPriority);
      form.setValue('reason', calc.reason);
      form.setValue('suggestedDate', new Date(calc.suggestedDate));
      if (calc.costEstimate) {
        form.setValue('costEstimate', calc.costEstimate);
      }
    }
  }, [calculationResponse, watchedAutoCalculate, form]);

  // Handle form submission
  const handleSubmit = (data: SuggestionFormData) => {
    createMutation.mutate(data);
  };

  // Generate smart reason based on element data
  const generateSmartReason = () => {
    if (!selectedElement) return;
    
    const elementAge = selectedElement.originalConstructionDate 
      ? new Date().getFullYear() - new Date(selectedElement.originalConstructionDate).getFullYear()
      : 0;
    
    const lifespan = selectedElement.currentLifespan || selectedElement.originalLifespan || 0;
    const condition = selectedElement.currentCondition || 'good';
    
    let reason = '';
    
    if (elementAge > lifespan * 0.8) {
      reason = `Element is nearing end of useful life (${elementAge}/${lifespan} years). `;
    } else if (condition === 'poor' || condition === 'critical') {
      reason = `Element condition is ${condition} and requires attention. `;
    } else {
      reason = `Routine evaluation recommended for ${selectedElement.name}. `;
    }
    
    reason += `Current condition: ${condition}. Age: ${elementAge} years.`;
    
    form.setValue('reason', reason);
  };

  return (
    <FormModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={mode === 'edit' ? 'Edit Suggestion' : 'Create Suggestion'}
      description={mode === 'edit' ? 'Update the evaluation suggestion details.' : 'Create a new evaluation suggestion for building maintenance.'}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={createMutation.isPending}
      submitLabel={mode === 'edit' ? 'Update Suggestion' : 'Create Suggestion'}
      size="lg"
      data-testid="suggestion-form"
    >
      <Form {...form}>
        <div className="space-y-6">
          {/* Element Selection */}
          <FormField
            control={form.control}
            name="elementId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Building Element</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-element">
                      <SelectValue placeholder="Select element" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isLoadingElements ? (
                      <div className="p-2">
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ) : (
                      elements.map((element: any) => (
                        <SelectItem key={element.id} value={element.id}>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            <span>{element.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {element.uniformatCode}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormDescription>
                  {t('selectTheBuildingElementForThis')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Auto-calculation toggle */}
          <FormField
            control={form.control}
            name="autoCalculate"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-base flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Auto-Calculate Suggestion
                  </FormLabel>
                  <FormDescription>
                    {t('automaticallyCalculateSuggestionTypePriorityAnd')}
                  </FormDescription>
                </div>
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="h-4 w-4"
                    data-testid="auto-calculate-toggle"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Suggestion Type and Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="suggestedType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Suggestion Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {suggestionTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div>
                            <div className="font-medium">{type.label}</div>
                            <div className="text-xs text-muted-foreground">{type.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                            <span className={cn("font-medium", priority.color)}>●</span>
                            <div>
                              <div className="font-medium">{priority.label}</div>
                              <div className="text-xs text-muted-foreground">{priority.description}</div>
                            </div>
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

          {/* Suggested Date */}
          <FormField
            control={form.control}
            name="suggestedDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Suggested Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        data-testid="date-picker-trigger"
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
                      disabled={(date) => date < new Date()}
                      initialFocus
                      data-testid="date-picker-calendar"
                    />
                  </PopoverContent>
                </Popover>
                <FormDescription>
                  {t('whenThisEvaluationOrWorkShould')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Cost Estimate */}
          <FormField
            control={form.control}
            name="costEstimate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cost Estimate (Optional)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="0.00"
                      className="pl-10"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value ? parseFloat(value) : undefined);
                      }}
                      data-testid="input-cost-estimate"
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  {t('estimatedCostForTheSuggestedWork')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Reason */}
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center justify-between">
                  Reason
                  {selectedElement && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={generateSmartReason}
                      className="text-xs"
                      data-testid="generate-reason-button"
                    >
                      <Lightbulb className="h-3 w-3 mr-1" />
                      Generate
                    </Button>
                  )}
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Explain why this suggestion is needed..."
                    className="resize-none"
                    rows={3}
                    {...field}
                    data-testid="input-reason"
                  />
                </FormControl>
                <FormDescription>
                  {t('detailedExplanationForTheSuggestion')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Calculation Results */}
          {isCalculating && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <Zap className="h-4 w-4 text-blue-600 animate-pulse" />
              <span className="text-sm text-blue-800">Calculating recommendations...</span>
            </div>
          )}

          {calculationResponse?.calculation && watchedAutoCalculate && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">{t('autoCalculatedRecommendations')}</span>
              </div>
              <div className="text-xs text-green-700 space-y-1">
                <div>Type: {calculationResponse.calculation.recommendedType}</div>
                <div>Priority: {calculationResponse.calculation.recommendedPriority}</div>
                <div>Date: {format(new Date(calculationResponse.calculation.suggestedDate), 'PPP')}</div>
                {calculationResponse.calculation.costEstimate && (
                  <div>Estimated Cost: ${calculationResponse.calculation.costEstimate.toLocaleString()}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </Form>
    </FormModal>
  );
}