import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format, addYears } from 'date-fns';
import { z } from 'zod';
import { FormModal, FormFieldWrapper } from '@/components/maintenance/FormModal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ConditionBadge } from '@/components/maintenance/StatusBadges';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SharedUploader } from '@/components/document-management/SharedUploader';
import { DollarSign } from 'lucide-react';
// import { useBuildingContext } from '@/hooks/use-building-context';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { insertBuildingElementSchema, BuildingElement } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import {
  CalendarIcon,
  Search,
  Building,
  Info,
  Calculator,
  Clock,
  FileText,
} from 'lucide-react';

// Form schema based on the building element schema but with form-specific types
const elementFormSchema = z.object({
  buildingId: z.string().uuid(),
  uniformatCode: z.string().min(1, 'UNIFORMAT code is required'),
  name: z.string().min(1, 'Element name is required').max(200),
  description: z.string().optional(),
  residenceIds: z.array(z.string().uuid()).default([]), // Multi-select residence selection
  originalConstructionDate: z.string().optional(),
  lastInspectionDate: z.string().optional(),
  nextEvaluationDate: z.string().optional(),
  originalLifespan: z.coerce.number().min(1).max(200).optional(),
  currentLifespan: z.coerce.number().min(1).max(200).optional(),
  currentCondition: z.enum(['excellent', 'good', 'fair', 'poor', 'critical']),
  unit: z.string().max(20).optional(),
  unitValue: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
  reconstructionCost: z.coerce.number().min(0).optional(),
  costEstimationDate: z.string().optional(),
  access: z.enum(['not_restrained', 'restrained']).default('not_restrained'),
  charge: z.enum(['common', 'personnal']).default('common'),
  // Additional form-only fields
  autoCalculateEvaluation: z.boolean().optional(),
  quantity: z.coerce.number().min(1).max(1000).default(1), // Duplicate/quantity field
});

type ElementFormData = z.infer<typeof elementFormSchema>;

interface ElementFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  element?: BuildingElement | null;
  onSuccess?: (element: BuildingElement) => void;
  mode?: 'create' | 'edit';
  buildingId?: string;
  organizationId?: string;
}

// UNIFORMAT code selection helper
interface UniformatCodeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onCodeSelect?: (codeData: any) => void; // For auto-suggest functionality
  error?: string;
}

function UniformatCodeSelector({ value, onChange, onCodeSelect, error }: UniformatCodeSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showBrowser, setShowBrowser] = useState(false);
  const [selectedLevel1, setSelectedLevel1] = useState<string | null>(null);
  const [selectedLevel2, setSelectedLevel2] = useState<string | null>(null);

  const {
    data: uniformatResponse,
    isLoading,
  } = useQuery({
    queryKey: ['/api/maintenance/uniformat'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/maintenance/uniformat');
      return await response.json();
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  const uniformatCodes = uniformatResponse?.data || [];
  
  const filteredCodes = useMemo(() => {
    // For search results, only show selectable codes (level 3)
    const selectableCodes = uniformatCodes.filter((code: any) => code.selectable);
    
    if (!searchTerm) return selectableCodes.slice(0, 20); // Show first 20 selectable codes by default
    
    return selectableCodes.filter((code: any) => 
      code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      code.nameFr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      code.nameEn.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 50);
  }, [uniformatCodes, searchTerm]);

  // Group codes by level for hierarchical navigation
  const groupedCodes = useMemo(() => {
    const grouped = {
      level1: uniformatCodes.filter((code: any) => code.level === 1),
      level2: uniformatCodes.filter((code: any) => code.level === 2),
      level3: uniformatCodes.filter((code: any) => code.level === 3),
    };
    return grouped;
  }, [uniformatCodes]);

  // Get current navigation items based on selection state
  const getCurrentLevelItems = () => {
    if (selectedLevel2) {
      // Show level 3 items under selected level 2
      return groupedCodes.level3.filter((code: any) => 
        code.code.startsWith(selectedLevel2)
      );
    } else if (selectedLevel1) {
      // Show level 2 items under selected level 1
      return groupedCodes.level2.filter((code: any) => 
        code.code.startsWith(selectedLevel1)
      );
    } else {
      // Show level 1 items
      return groupedCodes.level1;
    }
  };

  const resetBrowserNavigation = () => {
    setSelectedLevel1(null);
    setSelectedLevel2(null);
    setSearchTerm('');
  };

  const selectedCode = uniformatCodes.find((code: any) => code.code === value);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search UNIFORMAT codes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="uniformat-search"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowBrowser(true)}
          data-testid="browse-uniformat-button"
        >
          <Building className="h-4 w-4 mr-2" />
          Browse
        </Button>
      </div>

      {/* Selected code display */}
      {selectedCode && (
        <div className="p-3 bg-muted rounded-lg" data-testid="selected-uniformat">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline">{selectedCode.code}</Badge>
            <span className="text-sm font-medium">{selectedCode.nameEn}</span>
          </div>
          <div className="text-xs text-muted-foreground">{selectedCode.nameFr}</div>
          {selectedCode.typicalLifespan && (
            <div className="text-xs text-muted-foreground mt-1">
              Typical lifespan: {selectedCode.typicalLifespan} years
            </div>
          )}
        </div>
      )}

      {/* Search results */}
      {searchTerm && (
        <div className="border rounded-lg max-h-48 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-center text-sm text-muted-foreground">
              Loading UNIFORMAT codes...
            </div>
          ) : filteredCodes.length > 0 ? (
            <div className="divide-y">
              {filteredCodes.map((code: any) => (
                <button
                  key={code.code}
                  type="button"
                  className="w-full p-3 text-left hover:bg-muted transition-colors"
                  onClick={() => {
                    onChange(code.code);
                    setSearchTerm('');
                  }}
                  data-testid={`uniformat-option-${code.code}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{code.code}</Badge>
                    <span className="text-sm font-medium">{code.nameEn}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{code.nameFr}</div>
                  {code.typicalLifespan && (
                    <div className="text-xs text-muted-foreground">
                      Typical: {code.typicalLifespan} years
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 text-center text-sm text-muted-foreground">
              No matching codes found
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive">{error}</div>
      )}
      
      {/* UNIFORMAT Browser Dialog */}
      <Dialog open={showBrowser} onOpenChange={(open) => {
        setShowBrowser(open);
        if (!open) resetBrowserNavigation();
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Browse UNIFORMAT Codes</DialogTitle>
            <div className="text-sm text-muted-foreground">
              Navigate: Level 1 → Level 2 → Level 3 (only Level 3 can be selected for elements)
            </div>
          </DialogHeader>
          <div className="space-y-4">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedLevel1(null);
                  setSelectedLevel2(null);
                }}
                className="text-blue-600 hover:text-blue-800"
              >
                Level 1
              </Button>
              {selectedLevel1 && (
                <>
                  <span>→</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedLevel2(null)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Level 2 ({selectedLevel1})
                  </Button>
                </>
              )}
              {selectedLevel2 && (
                <>
                  <span>→</span>
                  <span className="font-medium">Level 3 ({selectedLevel2})</span>
                </>
              )}
            </div>

            {/* Search - only when viewing all codes */}
            {!selectedLevel1 && !selectedLevel2 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search UNIFORMAT codes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}

            {/* Content Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="col-span-full p-4 text-center text-sm text-muted-foreground">
                  Loading UNIFORMAT codes...
                </div>
              ) : searchTerm && !selectedLevel1 && !selectedLevel2 ? (
                // Search results (all levels)
                filteredCodes.length > 0 ? (
                  filteredCodes.map((code: any) => (
                    <button
                      key={code.code}
                      type="button"
                      className={cn(
                        "p-3 text-left border rounded-lg transition-colors",
                        code.selectable 
                          ? "hover:bg-green-50 border-green-200 hover:border-green-300" 
                          : "hover:bg-muted opacity-60 cursor-not-allowed"
                      )}
                      onClick={() => {
                        if (code.selectable) {
                          onChange(code.code);
                          onCodeSelect?.(code);
                          setShowBrowser(false);
                          resetBrowserNavigation();
                        }
                      }}
                      disabled={!code.selectable}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant={code.selectable ? "default" : "outline"} 
                          className="text-xs"
                        >
                          {code.code} (L{code.level})
                        </Badge>
                        {!code.selectable && (
                          <span className="text-xs text-orange-600">Navigate only</span>
                        )}
                      </div>
                      <div className="text-sm font-medium">{code.nameEn}</div>
                      <div className="text-xs text-muted-foreground">{code.nameFr}</div>
                      {code.typicalLifespan && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Typical: {code.typicalLifespan} years
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="col-span-full p-4 text-center text-sm text-muted-foreground">
                    No matching codes found
                  </div>
                )
              ) : (
                // Hierarchical navigation
                getCurrentLevelItems().map((code: any) => (
                  <button
                    key={code.code}
                    type="button"
                    className={cn(
                      "p-3 text-left border rounded-lg transition-colors",
                      code.selectable 
                        ? "hover:bg-green-50 border-green-200 hover:border-green-300" 
                        : "hover:bg-blue-50 border-blue-200 hover:border-blue-300"
                    )}
                    onClick={() => {
                      if (code.selectable) {
                        // Level 3: Select this code
                        onChange(code.code);
                        onCodeSelect?.(code);
                        setShowBrowser(false);
                        resetBrowserNavigation();
                      } else if (code.level === 1) {
                        // Level 1: Navigate to level 2
                        setSelectedLevel1(code.code);
                      } else if (code.level === 2) {
                        // Level 2: Navigate to level 3
                        setSelectedLevel2(code.code);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant={code.selectable ? "default" : "outline"} 
                        className="text-xs"
                      >
                        {code.code}
                      </Badge>
                      {code.level === 3 ? (
                        <span className="text-xs text-green-600">Selectable</span>
                      ) : (
                        <span className="text-xs text-blue-600">Navigate →</span>
                      )}
                    </div>
                    <div className="text-sm font-medium">{code.nameEn}</div>
                    <div className="text-xs text-muted-foreground">{code.nameFr}</div>
                    {code.typicalLifespan && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Typical: {code.typicalLifespan} years
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * ElementForm component for creating and editing building elements
 * Integrates with FormModal foundation and includes UNIFORMAT code selection
 */
export function ElementForm({
  isOpen,
  onOpenChange,
  element,
  onSuccess,
  mode = element ? 'edit' : 'create',
  buildingId,
  organizationId,
}: ElementFormProps) {
  // Simplified placeholder - no context for now
  const { toast } = useToast();
  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);
  const [constructionDate, setConstructionDate] = useState<Date | undefined>();
  const [nextEvaluationDate, setNextEvaluationDate] = useState<Date | undefined>();
  const [costEstimationDate, setCostEstimationDate] = useState<Date | undefined>(new Date()); // Default to today
  const [isBuildingWideExplicit, setIsBuildingWideExplicit] = useState(true); // Track explicit building-wide choice

  // Fetch building data to get yearBuilt for default construction date
  const { data: building } = useQuery({
    queryKey: ['building', buildingId],
    enabled: !!buildingId,
  });

  // Fetch residences for the building (for optional residence selection)
  const { data: residences } = useQuery({
    queryKey: ['residences', buildingId],
    queryFn: async () => {
      if (!buildingId) return [];
      const response = await apiRequest('GET', `/api/buildings/${buildingId}/residences`);
      return await response.json();
    },
    enabled: !!buildingId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const form = useForm<ElementFormData>({
    resolver: zodResolver(elementFormSchema),
    defaultValues: {
      buildingId: buildingId || '',
      name: '',
      description: '',
      residenceIds: [],
      uniformatCode: '',
      originalLifespan: undefined,
      currentLifespan: undefined,
      currentCondition: 'good',
      unit: '',
      unitValue: undefined,
      notes: '',
      reconstructionCost: undefined,
      costEstimationDate: format(new Date(), 'yyyy-MM-dd'),
      access: 'not_restrained',
      charge: 'common',
      autoCalculateEvaluation: true,
      quantity: 1,
    },
  });

  // Update form when element changes
  useEffect(() => {
    if (element && mode === 'edit') {
      const formData = {
        ...element,
        buildingId: element.buildingId,
        originalLifespan: element.originalLifespan || undefined,
        currentLifespan: element.currentLifespan || undefined,
        unitValue: element.unitValue ? Number(element.unitValue) : undefined,
        reconstructionCost: element.reconstructionCost ? Number(element.reconstructionCost) : undefined,
        costEstimationDate: element.costEstimationDate || format(new Date(), 'yyyy-MM-dd'),
        autoCalculateEvaluation: true,
      };
      
      form.reset(formData);
      
      // Set building-wide state based on existing element data
      setIsBuildingWideExplicit(element.residenceIds?.length === 0 || !element.residenceIds);
      
      if (element.originalConstructionDate) {
        setConstructionDate(new Date(element.originalConstructionDate));
      }
      if (element.nextEvaluationDate) {
        setNextEvaluationDate(new Date(element.nextEvaluationDate));
      }
      if (element.costEstimationDate) {
        setCostEstimationDate(new Date(element.costEstimationDate));
      }
    } else if (mode === 'create') {
      form.reset({
        buildingId: buildingId || '',
        name: '',
        description: '',
        residenceIds: [],
        uniformatCode: '',
        originalLifespan: undefined,
        currentLifespan: undefined,
        currentCondition: 'good',
        unit: '',
        unitValue: undefined,
        notes: '',
        reconstructionCost: undefined,
        costEstimationDate: format(new Date(), 'yyyy-MM-dd'),
        access: 'not_restrained',
        charge: 'common',
        autoCalculateEvaluation: true,
        quantity: 1,
      });
      
      // Reset to building-wide by default for new elements
      setIsBuildingWideExplicit(true);
      
      // Set default construction date from building's constructionYear or yearBuilt
      const buildingData = building as any;
      const constructionYear = buildingData?.constructionYear || buildingData?.yearBuilt || buildingData?.year;
      if (constructionYear) {
        const defaultConstructionDate = new Date(constructionYear, 0, 1); // January 1st of the year
        setConstructionDate(defaultConstructionDate);
      } else {
        setConstructionDate(undefined);
      }
      setNextEvaluationDate(undefined);
    }
  }, [element, mode, buildingId, building, form]);

  // Auto-calculate next evaluation date
  const autoCalculateEvaluation = form.watch('autoCalculateEvaluation');
  const selectedCondition = form.watch('currentCondition');
  const currentLifespan = form.watch('currentLifespan');
  const originalLifespan = form.watch('originalLifespan');

  useEffect(() => {
    if (autoCalculateEvaluation && (currentLifespan || originalLifespan)) {
      // currentLifespan and originalLifespan now represent "years left to reconstruction"
      const yearsLeft = currentLifespan || originalLifespan || 20;
      const conditionMultipliers = {
        excellent: 0.9,
        good: 0.7,
        fair: 0.5,
        poor: 0.3,
        critical: 0.1,
      };
      
      const multiplier = conditionMultipliers[selectedCondition] || 0.7;
      // Calculate next evaluation as a fraction of remaining years
      const yearsUntilEvaluation = Math.max(1, Math.round(yearsLeft * multiplier * 0.15));
      
      const calculatedDate = addYears(new Date(), yearsUntilEvaluation);
      setNextEvaluationDate(calculatedDate);
    }
  }, [autoCalculateEvaluation, currentLifespan, originalLifespan, selectedCondition]);

  // Create/update mutation
  const mutation = useMutation({
    mutationFn: async (data: ElementFormData) => {
      const payload = {
        ...data,
        originalConstructionDate: constructionDate ? format(constructionDate, 'yyyy-MM-dd') : null,
        nextEvaluationDate: nextEvaluationDate ? format(nextEvaluationDate, 'yyyy-MM-dd') : null,
        costEstimationDate: costEstimationDate ? format(costEstimationDate, 'yyyy-MM-dd') : null,
      };

      if (mode === 'edit' && element) {
        const response = await apiRequest('PATCH', `/api/maintenance/elements/${element.id}`, payload);
        return await response.json();
      } else {
        const response = await apiRequest('POST', '/api/maintenance/elements', payload);
        return await response.json();
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'elements'] });
      onSuccess?.(data.element);
      onOpenChange(false);
      
      toast({
        title: mode === 'create' ? 'Element created' : 'Element updated',
        description: `${data.element.name} has been ${mode === 'create' ? 'created' : 'updated'} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: mode === 'create' ? 'Creation failed' : 'Update failed',
        description: error.message || `Failed to ${mode} element`,
        variant: 'destructive',
      });
    },
  });

  // Auto-suggest element name when UNIFORMAT code is selected
  const handleUniformatCodeSelect = (codeData: any) => {
    if (!isNameManuallyEdited && codeData?.nameEn) {
      form.setValue('name', codeData.nameEn);
    }
    // Also set lifespan if available
    if (codeData?.typicalLifespan) {
      form.setValue('originalLifespan', codeData.typicalLifespan);
      form.setValue('currentLifespan', codeData.typicalLifespan);
    }
  };

  const handleSubmit = async (data: ElementFormData) => {
    await mutation.mutateAsync(data);
  };

  return (
    <FormModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'Add Building Element' : 'Edit Building Element'}
      description={mode === 'create' 
        ? 'Add a new building element to the inventory with its specifications and condition'
        : 'Update the building element information and condition'
      }
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={mutation.isPending}
      mode={mode}
      size="lg"
      data-testid="element-form"
    >
      <div className="space-y-6">
        {/* UNIFORMAT Code Selection */}
        <FormFieldWrapper
          form={form}
          name="uniformatCode"
          label="UNIFORMAT Code"
          required
        >
          {(field) => (
            <UniformatCodeSelector
              value={field.value}
              onChange={field.onChange}
              onCodeSelect={handleUniformatCodeSelect}
              error={form.formState.errors.uniformatCode?.message}
            />
          )}
        </FormFieldWrapper>

        <Separator />

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormFieldWrapper
            form={form}
            name="name"
            label="Element Name"
            required
          >
            {(field) => (
              <Input
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  setIsNameManuallyEdited(true);
                }}
                placeholder="e.g., Exterior Wall - North"
                data-testid="element-name-input"
              />
            )}
          </FormFieldWrapper>

          <FormFieldWrapper
            form={form}
            name="currentCondition"
            label="Current Condition"
            required
          >
            {(field) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger data-testid="condition-select">
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">
                    <div className="flex items-center gap-2">
                      <ConditionBadge condition="excellent" size="sm" />
                    </div>
                  </SelectItem>
                  <SelectItem value="good">
                    <div className="flex items-center gap-2">
                      <ConditionBadge condition="good" size="sm" />
                    </div>
                  </SelectItem>
                  <SelectItem value="fair">
                    <div className="flex items-center gap-2">
                      <ConditionBadge condition="fair" size="sm" />
                    </div>
                  </SelectItem>
                  <SelectItem value="poor">
                    <div className="flex items-center gap-2">
                      <ConditionBadge condition="poor" size="sm" />
                    </div>
                  </SelectItem>
                  <SelectItem value="critical">
                    <div className="flex items-center gap-2">
                      <ConditionBadge condition="critical" size="sm" />
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormFieldWrapper>
        </div>

        <FormFieldWrapper
          form={form}
          name="description"
          label="Description"
          description="Optional detailed description of the element"
        >
          {(field) => (
            <Textarea
              {...field}
              placeholder="Describe the element location, specifications, or other relevant details..."
              rows={3}
              data-testid="element-description"
            />
          )}
        </FormFieldWrapper>

        {/* Element Assignment */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormFieldWrapper
            form={form}
            name="residenceIds"
            label="Residence Assignment"
            description="Select if this element is building-wide or applies to specific residences"
          >
            {(field) => {
              const selectedResidenceIds = field.value || [];
              const isBuildingWide = isBuildingWideExplicit;
              
              // Get selected residences for display
              const selectedResidences = (residences || []).filter((residence: any) => 
                selectedResidenceIds.includes(residence.id)
              );

              return (
                <div className="space-y-2">
                  {/* Building-wide option */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="building-wide"
                      checked={isBuildingWide}
                      onCheckedChange={(checked) => {
                        setIsBuildingWideExplicit(checked === true);
                        if (checked === true) {
                          // Clear all residence selections when building-wide is selected
                          field.onChange([]);
                        }
                        // When unchecking building-wide, keep current selection but allow changes
                        // The user can then click the residence selector to choose specific residences
                      }}
                      data-testid="building-wide-checkbox"
                    />
                    <label htmlFor="building-wide" className="text-sm font-medium">
                      Building-wide element
                    </label>
                  </div>

                  {/* Residence selection popover */}
                  <div className="space-y-2">
                    <Popover onOpenChange={(open) => {
                      if (open && isBuildingWide) {
                        // Auto-uncheck building-wide when user clicks to select specific residences
                        field.onChange([]);
                      }
                    }}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between",
                            isBuildingWide && "border-dashed border-2 bg-muted/30"
                          )}
                          data-testid="residence-multi-select-trigger"
                        >
                          <span className="truncate">
                            {isBuildingWide 
                              ? "Click to select specific residences..."
                              : selectedResidences.length === 0
                              ? "Select specific residences..."
                              : selectedResidences.length === 1
                              ? `Unit ${selectedResidences[0].unitNumber}`
                              : `${selectedResidences.length} residences selected`
                            }
                          </span>
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" data-testid="residence-multi-select-content">
                        <div className="p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm">Select Specific Residences</h4>
                            <div className="flex gap-2">
                              {selectedResidences.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => field.onChange([])}
                                  data-testid="clear-all-residences"
                                >
                                  Clear all
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // Switch back to building-wide
                                  field.onChange([]);
                                }}
                                data-testid="switch-to-building-wide"
                              >
                                Building-wide
                              </Button>
                            </div>
                          </div>
                          
                          {/* Residence checkboxes */}
                          <div className="max-h-64 overflow-y-auto space-y-2">
                            {(residences || []).length === 0 ? (
                              <div className="text-sm text-muted-foreground text-center py-4">
                                No residences found
                              </div>
                            ) : (
                              (residences || []).map((residence: any) => {
                                const isSelected = selectedResidenceIds.includes(residence.id);
                                return (
                                  <div key={residence.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`residence-${residence.id}`}
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        let newIds = [...selectedResidenceIds];
                                        if (checked) {
                                          // Add residence to selection
                                          if (!newIds.includes(residence.id)) {
                                            newIds.push(residence.id);
                                          }
                                        } else {
                                          // Remove residence from selection
                                          newIds = newIds.filter(id => id !== residence.id);
                                        }
                                        field.onChange(newIds);
                                      }}
                                      data-testid={`residence-checkbox-${residence.id}`}
                                    />
                                    <label 
                                      htmlFor={`residence-${residence.id}`}
                                      className="text-sm cursor-pointer flex-1"
                                    >
                                      Unit {residence.unitNumber}
                                      {residence.floor && (
                                        <span className="text-muted-foreground ml-1">
                                          (Floor {residence.floor})
                                        </span>
                                      )}
                                    </label>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Selection summary */}
                          {selectedResidences.length > 0 && (
                            <div className="pt-2 border-t">
                              <div className="text-xs text-muted-foreground mb-2">
                                Selected ({selectedResidences.length}):
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {selectedResidences.map((residence: any) => (
                                  <Badge key={residence.id} variant="secondary" className="text-xs">
                                    {residence.unitNumber}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newIds = selectedResidenceIds.filter(id => id !== residence.id);
                                        field.onChange(newIds);
                                      }}
                                      className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full w-3 h-3 flex items-center justify-center"
                                      data-testid={`remove-residence-${residence.id}`}
                                    >
                                      ×
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Selected residences display when closed */}
                    {!isBuildingWide && selectedResidences.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2" data-testid="selected-residences-display">
                        {selectedResidences.map((residence: any) => (
                          <Badge key={residence.id} variant="outline" className="text-xs">
                            Unit {residence.unitNumber}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            }}
          </FormFieldWrapper>

          <FormFieldWrapper
            form={form}
            name="access"
            label="Access Type"
            description="Access restrictions for this element"
            required
          >
            {(field) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger data-testid="access-select">
                  <SelectValue placeholder="Select access type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_restrained">
                    <div className="flex flex-col">
                      <span>Not Restrained</span>
                      <span className="text-xs text-muted-foreground">Free access</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="restrained">
                    <div className="flex flex-col">
                      <span>Restrained</span>
                      <span className="text-xs text-muted-foreground">Restricted access</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormFieldWrapper>

          <FormFieldWrapper
            form={form}
            name="charge"
            label="Charge Type"
            description="Who is responsible for costs"
            required
          >
            {(field) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger data-testid="charge-select">
                  <SelectValue placeholder="Select charge type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="common">
                    <div className="flex flex-col">
                      <span>Common</span>
                      <span className="text-xs text-muted-foreground">Building responsibility</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="personnal">
                    <div className="flex flex-col">
                      <span>Personal</span>
                      <span className="text-xs text-muted-foreground">Resident responsibility</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormFieldWrapper>
        </div>

        <Separator />

        {/* Dates and Lifespan */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Timeline & Lifespan
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Original Construction Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !constructionDate && "text-muted-foreground"
                    )}
                    data-testid="construction-date-button"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {constructionDate ? format(constructionDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={constructionDate}
                    onSelect={setConstructionDate}
                    initialFocus
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <FormFieldWrapper
                form={form}
                name="originalLifespan"
                label="Original Lifespan (years)"
              >
                {(field) => (
                  <Input
                    {...field}
                    type="number"
                    min="1"
                    max="200"
                    placeholder="25"
                    data-testid="original-lifespan-input"
                  />
                )}
              </FormFieldWrapper>

              <FormFieldWrapper
                form={form}
                name="currentLifespan"
                label="Years left to reconstruction"
              >
                {(field) => (
                  <Input
                    {...field}
                    type="number"
                    min="1"
                    max="200"
                    placeholder="20"
                    data-testid="current-lifespan-input"
                  />
                )}
              </FormFieldWrapper>
            </div>
          </div>
        </div>

        <Separator />

        {/* Quantity and Unit */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Quantity & Unit
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <FormFieldWrapper
              form={form}
              name="unitValue"
              label="Quantity"
            >
              {(field) => (
                <Input
                  {...field}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="100"
                  data-testid="unit-value-input"
                />
              )}
            </FormFieldWrapper>

            <FormFieldWrapper
              form={form}
              name="unit"
              label="Unit"
            >
              {(field) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger data-testid="unit-select">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m2">m² (square meters)</SelectItem>
                    <SelectItem value="m">m (linear meters)</SelectItem>
                    <SelectItem value="unit">unit (each)</SelectItem>
                    <SelectItem value="m3">m³ (cubic meters)</SelectItem>
                    <SelectItem value="kg">kg (kilograms)</SelectItem>
                    <SelectItem value="L">L (liters)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormFieldWrapper>
          </div>
        </div>

        {/* Next Evaluation Date */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Next Evaluation Date</label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoCalculateEvaluation}
                onChange={(e) => form.setValue('autoCalculateEvaluation', e.target.checked)}
                className="rounded"
                data-testid="auto-calculate-checkbox"
              />
              <span className="text-xs text-muted-foreground">Auto-calculate</span>
            </div>
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !nextEvaluationDate && "text-muted-foreground"
                )}
                disabled={autoCalculateEvaluation}
                data-testid="evaluation-date-button"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {nextEvaluationDate ? format(nextEvaluationDate, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={nextEvaluationDate}
                onSelect={setNextEvaluationDate}
                initialFocus
                disabled={(date) => date < new Date()}
              />
            </PopoverContent>
          </Popover>
          
          {autoCalculateEvaluation && nextEvaluationDate && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              Automatically calculated based on condition and remaining years
            </div>
          )}
        </div>

        {/* Reconstruction Cost Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Reconstruction Evaluation
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormFieldWrapper
              form={form}
              name="reconstructionCost"
              label="Reconstruction Cost"
            >
              {(field) => (
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    {...field}
                    type="number"
                    placeholder="0.00"
                    className="pl-9"
                    step="0.01"
                    min="0"
                    data-testid="reconstruction-cost-input"
                  />
                </div>
              )}
            </FormFieldWrapper>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Date of Estimation</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !costEstimationDate && "text-muted-foreground"
                    )}
                    data-testid="cost-estimation-date-button"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {costEstimationDate ? format(costEstimationDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={costEstimationDate}
                    onSelect={setCostEstimationDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <Separator />

        {/* Document Upload Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Asset Documentation
          </h4>
          <p className="text-sm text-muted-foreground">
            Upload pictures of the asset to help with identification and condition assessment.
          </p>
          <SharedUploader
            onDocumentChange={(file, text) => {
              // Handle file upload
              console.log('Document uploaded:', { file, text });
            }}
            allowedFileTypes={[
              'image/jpeg',
              'image/png', 
              'image/gif',
              'image/webp',
              'application/pdf'
            ]}
            maxFileSize={10}
            defaultTab="file"
            formType="maintenance"
            uploadContext={{
              organizationId: organizationId || '',
              buildingId: buildingId || '',
              category: 'element_documents'
            }}
            className="min-h-32"
          />
        </div>

        <Separator />

        {/* Quantity/Duplicate Field */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Element Quantity
          </h4>
          <FormFieldWrapper
            form={form}
            name="quantity"
            label="Quantity (Duplicate)"
            description="Number of identical elements to create (e.g., 30 windows, 5 doors)"
          >
            {(field) => (
              <Input
                {...field}
                type="number"
                min="1"
                max="1000"
                placeholder="1"
                data-testid="element-quantity"
                className="w-32"
              />
            )}
          </FormFieldWrapper>
        </div>

        <Separator />

        {/* Notes */}
        <FormFieldWrapper
          form={form}
          name="notes"
          label="Notes"
        >
          {(field) => (
            <Textarea
              {...field}
              placeholder="Any additional notes about this element..."
              rows={3}
              data-testid="element-notes"
            />
          )}
        </FormFieldWrapper>
      </div>
    </FormModal>
  );
}

export type { ElementFormProps };