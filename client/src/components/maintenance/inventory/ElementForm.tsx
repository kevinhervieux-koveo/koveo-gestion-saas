import { useState, useEffect, useMemo } from 'react';
import { useForm, UseFormReturn, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
import { format, addYears } from 'date-fns';
import { z } from 'zod';
import { FormModal, FormFieldWrapper } from '@/components/maintenance/FormModal';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ConditionBadge } from '@/components/maintenance/StatusBadges';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DocumentAttachmentManager } from '@/components/maintenance/inventory/DocumentAttachmentManager';
import { DollarSign } from 'lucide-react';
// import { useBuildingContext } from '@/hooks/use-building-context';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import type { Translations } from '@/lib/i18n';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { insertBuildingElementSchema, BuildingElement } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import {
  Search,
  Building,
  Info,
  Calculator,
  Clock,
  FileText,
  Edit2,
  Trash2,
  Loader2,
} from 'lucide-react';

// Form schema based on the building element schema but with form-specific types
const elementFormSchema = z.object({
  buildingId: z.string().uuid(),
  uniformatCode: z.string().min(1, 'UNIFORMAT code is required'),
  name: z.string().min(1, 'Element name is required').max(200),
  description: z.string().optional().or(z.literal('')), // Allow empty strings
  residenceId: z.string().uuid().nullable(), // Required choice but can be null for building-wide
  originalConstructionDate: z.date({ message: "Original construction date is required" }),
  lastInspectionDate: z.date().nullable().optional(), // Use date objects, allow null
  nextEvaluationDate: z.date().optional(), // Use date objects, simplified validation
  originalLifespan: z.coerce.number().int().min(1, "Must be at least 1"),
  currentLifespan: z.coerce.number().int().min(1, "Must be at least 1"),
  currentCondition: z.enum(['excellent', 'good', 'fair', 'poor', 'critical']),
  unit: z.string().max(20).default('unit'), // Default to 'unit'
  unitValue: z.coerce.number().min(0).default(1), // Default to 1
  notes: z.string().optional().or(z.literal('')), // Allow empty strings
  reconstructionCost: z.coerce.number().positive("Must be greater than 0"),
  costEstimationDate: z.date({ message: "Cost estimation date is required" }),
  access: z.enum(['not_restrained', 'restrained'], { message: "Access type is required" }),
  charge: z.enum(['common', 'personnal'], { message: "Charge type is required" }),
  // Additional form-only fields
  autoCalculateEvaluation: z.boolean().optional().default(true),
  quantity: z.coerce.number().min(1, "Must be at least 1").max(1000),
});

type ElementFormData = z.infer<typeof elementFormSchema>;

interface ElementFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  element?: BuildingElement | null;
  onSuccess?: (element: BuildingElement) => void;
  mode?: 'create' | 'edit' | 'view';
  buildingId?: string;
  organizationId?: string;
}

// UNIFORMAT code selection helper
interface UniformatCodeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onCodeSelect?: (codeData: any) => void; // For auto-suggest functionality
  error?: string;
  disabled?: boolean;
  hasError?: boolean;
}

function UniformatCodeSelector({ value, onChange, onCodeSelect, error, disabled = false, hasError = false }: UniformatCodeSelectorProps) {
  const { t } = useLanguage();
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
            placeholder={t('efSearchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn("pl-10", hasError && "border-red-500")}
            data-testid="uniformat-search"
            disabled={disabled}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowBrowser(true)}
          data-testid="browse-uniformat-button"
          disabled={disabled}
          className={cn(hasError && "border-red-500")}
        >
          <Building className="h-4 w-4 mr-2" />
          {t('efBrowseButton')}
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
              {t('efTypicalLifespanPrefix')}{selectedCode.typicalLifespan}{t('efTypicalLifespanSuffix')}
            </div>
          )}
        </div>
      )}

      {/* Search results */}
      {searchTerm && !disabled && (
        <div className="border rounded-lg max-h-48 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-center text-sm text-muted-foreground">
              {t('efLoadingCodes')}
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
                      {t('efTypicalLifespanShortPrefix')}{code.typicalLifespan}{t('efTypicalLifespanSuffix')}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 text-center text-sm text-muted-foreground">
              {t('efNoMatchingCodes')}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive">{error}</div>
      )}
      
      {/* UNIFORMAT Browser Dialog */}
      <Dialog open={showBrowser && !disabled} onOpenChange={(open) => {
        setShowBrowser(open);
        if (!open) resetBrowserNavigation();
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('efBrowseDialogTitle')}</DialogTitle>
            <div className="text-sm text-muted-foreground">
              {t('efBrowseDialogHint')}
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
                {t('efBreadcrumbLevel1')}
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
                    {t('efBreadcrumbLevel2Prefix')} ({selectedLevel1})
                  </Button>
                </>
              )}
              {selectedLevel2 && (
                <>
                  <span>→</span>
                  <span className="font-medium">{t('efBreadcrumbLevel3Prefix')} ({selectedLevel2})</span>
                </>
              )}
            </div>

            {/* Search - only when viewing all codes */}
            {!selectedLevel1 && !selectedLevel2 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={t('efSearchPlaceholderBrowser')}
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
                  {t('efLoadingCodes')}
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
                          <span className="text-xs text-orange-600">{t('efNavigateOnlyLabel')}</span>
                        )}
                      </div>
                      <div className="text-sm font-medium">{code.nameEn}</div>
                      <div className="text-xs text-muted-foreground">{code.nameFr}</div>
                      {code.typicalLifespan && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {t('efTypicalLifespanShortPrefix')}{code.typicalLifespan}{t('efTypicalLifespanSuffix')}
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="col-span-full p-4 text-center text-sm text-muted-foreground">
                    {t('efNoMatchingCodes')}
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
                        <span className="text-xs text-green-600">{t('efSelectableLabel')}</span>
                      ) : (
                        <span className="text-xs text-blue-600">{t('efNavigateLabel')}</span>
                      )}
                    </div>
                    <div className="text-sm font-medium">{code.nameEn}</div>
                    <div className="text-xs text-muted-foreground">{code.nameFr}</div>
                    {code.typicalLifespan && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {t('efTypicalLifespanShortPrefix')}{code.typicalLifespan}{t('efTypicalLifespanSuffix')}
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
  const { t } = useLanguage();
  // Simplified placeholder - no context for now
  const { toast } = useToast();
  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);
  const [isBuildingWideExplicit, setIsBuildingWideExplicit] = useState(true); // Track explicit building-wide choice
  
  // Local state to track current mode (allows switching from view to edit)
  const [currentMode, setCurrentMode] = useState<'create' | 'edit' | 'view'>(mode);

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
    resolver: zodResolver(elementFormSchema) as any,
    mode: 'onChange', // Validate on every change
    reValidateMode: 'onChange', // Re-validate on every change
    defaultValues: {
      buildingId: buildingId || '',
      name: '',
      description: '',
      residenceId: null,
      uniformatCode: '',
      originalConstructionDate: new Date(new Date().getFullYear() - 10, 0, 1), // Default to 10 years ago
      lastInspectionDate: null,
      nextEvaluationDate: undefined,
      originalLifespan: 20, // Default 20 year lifespan
      currentLifespan: 15, // Default 15 years remaining
      currentCondition: 'good',
      unit: 'unit',
      unitValue: 1,
      notes: '',
      reconstructionCost: 1, // Set to valid minimum value above 0.01
      costEstimationDate: new Date(),
      access: 'not_restrained',
      charge: 'common',
      autoCalculateEvaluation: true,
      quantity: 1,
    },
  });


  // Determine if form should be disabled
  const isFormDisabled = currentMode === 'view';


  // Reset current mode when modal opens or element changes
  useEffect(() => {
    setCurrentMode(mode);
  }, [mode, isOpen, element?.id]);

  // Update form when element changes
  useEffect(() => {
    if (element && (mode === 'edit' || mode === 'view')) {
      // Helper function to convert date strings to Date objects
      const parseDate = (dateString: string | null | undefined): Date | undefined => {
        if (!dateString) return undefined;
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? undefined : date;
      };

      // Only include form schema fields, not database fields
      const formData = {
        buildingId: element.buildingId,
        uniformatCode: element.uniformatCode,
        name: element.name,
        description: element.description || '',
        residenceId: element.residenceId || null, // Ensure null for building-wide
        originalConstructionDate: parseDate(element.originalConstructionDate),
        lastInspectionDate: parseDate(element.lastInspectionDate),
        nextEvaluationDate: parseDate(element.nextEvaluationDate),
        originalLifespan: element.originalLifespan || 20, // Required field - use default if missing
        currentLifespan: element.currentLifespan || 15, // Required field - use default if missing
        currentCondition: element.currentCondition,
        unit: element.unit || 'unit',
        unitValue: element.unitValue ? Number(element.unitValue) : 1,
        notes: element.notes || '',
        reconstructionCost: element.reconstructionCost ? Number(element.reconstructionCost) : 1, // Required field - use valid minimum
        costEstimationDate: parseDate(element.costEstimationDate) || new Date(),
        access: element.access || 'not_restrained',
        charge: element.charge || 'common',
        // Form-only fields
        autoCalculateEvaluation: true,
        quantity: Number(element.unitValue) || 1, // Use unitValue as quantity, default to 1
      };
      
      
      form.reset(formData);
      
      // Set building-wide state based on existing element data
      setIsBuildingWideExplicit(!element.residenceId);
    } else if (mode === 'create') {
      form.reset({
        buildingId: buildingId || '',
        name: '',
        description: '',
        residenceId: null,
        uniformatCode: '',
        originalConstructionDate: new Date(new Date().getFullYear() - 10, 0, 1), // Default to 10 years ago
        lastInspectionDate: null,
        nextEvaluationDate: null,
        originalLifespan: 20, // Default 20 year lifespan
        currentLifespan: 15, // Default 15 years remaining
        currentCondition: 'good',
        unit: 'unit',
        unitValue: 1,
        notes: '',
        reconstructionCost: 1, // Set to valid minimum value above 0.01
        costEstimationDate: new Date(), // Use Date object for validation
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
        form.setValue('originalConstructionDate', defaultConstructionDate); // Use Date object
      }
      // If no building construction year, keep the default from form.reset() (10 years ago)
      // Keep nextEvaluationDate as undefined for auto-calculation
      form.setValue('nextEvaluationDate', undefined);
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
      form.setValue('nextEvaluationDate', calculatedDate); // Use Date object directly
    }
  }, [autoCalculateEvaluation, currentLifespan, originalLifespan, selectedCondition, form]);

  // Check if form should be disabled

  // Create/update mutation
  const mutation = useCreateUpdateMutation<any, ElementFormData>({
    mutationFn: async (data) => {
      // Convert Date objects back to ISO strings for API
      const formatDate = (date: Date | undefined): string | undefined => {
        if (!date) return undefined;
        return date.toISOString().split('T')[0]; // Get YYYY-MM-DD format
      };

      const basePayload = {
        ...data,
        // Convert Date objects to strings for API
        originalConstructionDate: formatDate(data.originalConstructionDate),
        lastInspectionDate: formatDate(data.lastInspectionDate),
        nextEvaluationDate: formatDate(data.nextEvaluationDate),
        costEstimationDate: formatDate(data.costEstimationDate),
        // Remove form-only fields
        autoCalculateEvaluation: undefined,
        quantity: undefined,
      };

      if (mode === 'edit' && element) {
        const response = await apiRequest('PUT', `/api/maintenance/elements/${element.id}`, basePayload);
        return await response.json();
      } else {
        // Handle quantity for creating multiple elements
        const quantity = data.quantity || 1;
        
        if (quantity === 1) {
          // Single element creation
          const response = await apiRequest('POST', `/api/maintenance/buildings/${data.buildingId}/elements`, basePayload);
          return await response.json();
        } else {
          // Multiple element creation with numbered names
          const createdElements = [];
          
          for (let i = 1; i <= quantity; i++) {
            const numberedPayload = {
              ...basePayload,
              name: `${data.name} - ${i}`,
            };
            
            const response = await apiRequest('POST', `/api/maintenance/buildings/${data.buildingId}/elements`, numberedPayload);
            const result = await response.json();
            createdElements.push(result.data);
          }
          
          // Return the first element for consistency, but all elements are created
          return { data: createdElements[0], createdCount: createdElements.length };
        }
      }
    },
    queryKeysToInvalidate: [['/api/maintenance/buildings', buildingId, 'elements']],
    successTitle: (data) => {
      const createdCount = data?.createdCount || 1;
      const isMultiple = createdCount > 1;
      return mode === 'create'
        ? isMultiple
          ? `${createdCount}${t('efElementsCreatedSuffix')}`
          : t('efElementCreatedTitle')
        : t('efElementUpdatedTitle');
    },
    successMessage: (data) => {
      const createdCount = data?.createdCount || 1;
      const isMultiple = createdCount > 1;
      return mode === 'create'
        ? isMultiple
          ? `${t('efSuccessfullyCreatedPrefix')}${createdCount}${t('efSuccessfullyCreatedSuffix')}`
          : `${data?.data?.name}${t('efElementCreatedSuccessSuffix')}`
        : `${data?.data?.name}${t('efElementUpdatedSuccessSuffix')}`;
    },
    errorTitle: mode === 'create' ? t('efCreationFailedTitle') : t('efUpdateFailedTitle'),
    errorMessage: (error: any) => error?.message || (mode === 'create' ? t('efFailedToCreateElement') : t('efFailedToUpdateElement')),
    onSuccessCallback: (data) => {
      onSuccess?.(data.data);
      onOpenChange(false);
    },
  });

  // Delete mutation for removing elements
  const deleteMutation = useCreateUpdateMutation({
    mutationFn: async () => {
      if (!element?.id) throw new Error(t('efNoElementToDelete'));
      const response = await apiRequest('DELETE', `/api/maintenance/elements/${element.id}`);
      return response;
    },
    successTitle: t('efElementDeletedTitle'),
    successMessage: t('efElementDeletedDesc'),
    errorTitle: t('efDeletionFailedTitle'),
    errorMessage: (error: any) => error?.message || t('efFailedToDeleteElement'),
    queryKeysToInvalidate: ['building-elements'],
    onSuccessCallback: () => {
      onOpenChange(false);
      if (onSuccess && element) {
        onSuccess(element);
      }
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

  // Handle switching from view to edit mode
  const handleEnableEdit = () => {
    setCurrentMode('edit');
  };

  // Handle element deletion
  const handleDelete = () => {
    if (window.confirm(t('efDeleteConfirm'))) {
      deleteMutation.mutate();
    }
  };


  return (
    <FormModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={currentMode === 'create' ? t('efAddBuildingElement') : currentMode === 'view' ? t('efViewBuildingElement') : t('efEditBuildingElement')}
      description={currentMode === 'create' 
        ? t('efAddDescription')
        : currentMode === 'view'
        ? t('efViewDescription')
        : t('efEditDescription')
      }
      form={form as any}
      onSubmit={handleSubmit}
      isSubmitting={mutation.isPending}
      mode={currentMode}
      size="lg"
      data-testid="element-form"
      additionalActions={
        currentMode === 'edit' && element ? (
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending || mutation.isPending}
            data-testid="delete-element-button"
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('efDeletingProgress')}
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                {t('efDeleteButton')}
              </>
            )}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* UNIFORMAT Code Selection */}
        <FormFieldWrapper
          form={form as any}
          name="uniformatCode"
          label={t('efUniformatCodeLabel')}
          required
        >
          {(field, hasError) => (
            <UniformatCodeSelector
              value={field.value}
              onChange={field.onChange}
              onCodeSelect={handleUniformatCodeSelect}
              error={form.formState.errors.uniformatCode?.message}
              disabled={isFormDisabled}
              hasError={hasError}
            />
          )}
        </FormFieldWrapper>

        <Separator />

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormFieldWrapper
            form={form as any}
            name="name"
            label={t('efElementNameLabel')}
            required
          >
            {(field, hasError) => (
              <Input
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  setIsNameManuallyEdited(true);
                }}
                placeholder={t('efElementNamePlaceholder')}
                data-testid="element-name-input"
                disabled={isFormDisabled}
                className={hasError ? 'border-red-500' : ''}
              />
            )}
          </FormFieldWrapper>

          <FormFieldWrapper
            form={form as any}
            name="currentCondition"
            label={t('efCurrentConditionLabel')}
            required
          >
            {(field, hasError) => (
              <Select onValueChange={field.onChange} value={field.value} disabled={isFormDisabled}>
                <SelectTrigger data-testid="condition-select" className={hasError ? 'border-red-500' : ''}>
                  <SelectValue placeholder={t('efSelectCondition')} />
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
          form={form as any}
          name="description"
          label={t('efDescriptionLabel')}
          description={t('efDescriptionLabelHelper')}
        >
          {(field, hasError) => (
            <Textarea
              {...field}
              placeholder={t('efDescriptionPlaceholder')}
              rows={3}
              data-testid="element-description"
              disabled={isFormDisabled}
              className={hasError ? 'border-red-500' : ''}
            />
          )}
        </FormFieldWrapper>

        {/* Element Assignment */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormFieldWrapper
            form={form as any}
            name="residenceId"
            label={t('efResidenceAssignmentLabel')}
            description={t('efResidenceAssignmentDesc')}
            required
          >
            {(field, hasError) => {
              const selectedResidenceId = field.value;
              const isBuildingWide = !selectedResidenceId;
              
              // Get selected residence for display
              const selectedResidence = (residences || []).find((residence: any) => 
                residence.id === selectedResidenceId
              );

              return (
                <div className="space-y-2">
                  {/* Building-wide option */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="building-wide"
                      checked={isBuildingWide}
                      onCheckedChange={(checked) => {
                        if (checked === true) {
                          // Clear residence selection when building-wide is selected
                          field.onChange(null);
                          setIsBuildingWideExplicit(true);
                        } else {
                          setIsBuildingWideExplicit(false);
                        }
                      }}
                      data-testid="building-wide-checkbox"
                      disabled={isFormDisabled}
                    />
                    <label htmlFor="building-wide" className="text-sm font-medium">
                      {t('efBuildingWideElement')}
                    </label>
                  </div>

                  {/* Single residence selection */}
                  <div className="space-y-2">
                    <Select
                      value={selectedResidenceId || "building-wide"}
                      onValueChange={(value) => {
                        if (value === "building-wide") {
                          field.onChange(null);
                          setIsBuildingWideExplicit(true);
                        } else {
                          field.onChange(value);
                          setIsBuildingWideExplicit(false);
                        }
                      }}
                      disabled={isFormDisabled}
                    >
                      <SelectTrigger 
                        data-testid="residence-select-trigger"
                        className={cn(hasError && "border-red-500")}
                      >
                        <SelectValue placeholder={t('efSelectResidenceAssignment')} />
                      </SelectTrigger>
                      <SelectContent data-testid="residence-select-content">
                        <SelectItem value="building-wide">{t('efBuildingWideElement')}</SelectItem>
                        {(residences || []).map((residence: any) => (
                          <SelectItem 
                            key={residence.id} 
                            value={residence.id}
                            data-testid={`residence-option-${residence.id}`}
                          >
                            {t('efUnitPrefix')}{residence.unitNumber}
                            {residence.floor && (
                              <span className="text-muted-foreground ml-1">
                                ({t('efFloorPrefix')}{residence.floor})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Display current selection */}
                  {selectedResidence && (
                    <div className="text-sm text-muted-foreground">
                      {t('efAssignedToPrefix')}{selectedResidence.unitNumber}
                      {selectedResidence.floor && ` (${t('efFloorPrefix')}${selectedResidence.floor})`}
                    </div>
                  )}
                </div>
              );
            }}
          </FormFieldWrapper>

          <FormFieldWrapper
            form={form as any}
            name="access"
            label={t('efAccessTypeLabel')}
            description={t('efAccessTypeDesc')}
            required
          >
            {(field, hasError) => (
              <Select onValueChange={field.onChange} value={field.value} disabled={isFormDisabled}>
                <SelectTrigger data-testid="access-select" className={hasError ? 'border-red-500' : ''}>
                  <SelectValue placeholder={t('efSelectAccessType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_restrained">
                    <div className="flex flex-col">
                      <span>{t('efNotRestrained')}</span>
                      <span className="text-xs text-muted-foreground">{t('efNotRestrainedDesc')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="restrained">
                    <div className="flex flex-col">
                      <span>{t('efRestrained')}</span>
                      <span className="text-xs text-muted-foreground">{t('efRestrainedDesc')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormFieldWrapper>

          <FormFieldWrapper
            form={form as any}
            name="charge"
            label={t('efChargeTypeLabel')}
            description={t('efChargeTypeDesc')}
            required
          >
            {(field, hasError) => (
              <Select onValueChange={field.onChange} value={field.value} disabled={isFormDisabled}>
                <SelectTrigger data-testid="charge-select" className={hasError ? 'border-red-500' : ''}>
                  <SelectValue placeholder={t('efSelectChargeType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="common">
                    <div className="flex flex-col">
                      <span>{t('efCommon')}</span>
                      <span className="text-xs text-muted-foreground">{t('efCommonDesc')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="personnal">
                    <div className="flex flex-col">
                      <span>{t('efPersonal')}</span>
                      <span className="text-xs text-muted-foreground">{t('efPersonalDesc')}</span>
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
            {t('efTimelineHeading')}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormFieldWrapper
              form={form as any}
              name="originalConstructionDate"
              label={t('efOriginalConstructionDate')}
              required
            >
              {(field, hasError) => {
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
                  <Input
                    value={formatDateForInput(field.value)}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      if (inputValue === '') {
                        field.onChange(null);
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
                            // Date parsing error silently handled
                          }
                        }
                      }
                    }}
                    type="date"
                    max={format(new Date(), 'yyyy-MM-dd')}
                    data-testid="construction-date-input"
                    disabled={isFormDisabled}
                    className={hasError ? 'border-red-500' : ''}
                  />
                );
              }}
            </FormFieldWrapper>

            <div className="grid grid-cols-2 gap-2">
              <FormFieldWrapper
                form={form as any}
                name="originalLifespan"
                label={t('efOriginalLifespan')}
                required
              >
                {(field, hasError) => (
                  <Input
                    {...field}
                    type="number"
                    min="1"
                    max="200"
                    placeholder="25"
                    data-testid="original-lifespan-input"
                    disabled={isFormDisabled}
                    className={hasError ? 'border-red-500' : ''}
                  />
                )}
              </FormFieldWrapper>

              <FormFieldWrapper
                form={form as any}
                name="currentLifespan"
                label={t('efYearsLeftToReconstruction')}
                required
              >
                {(field, hasError) => (
                  <Input
                    {...field}
                    type="number"
                    min="1"
                    max="200"
                    placeholder="20"
                    data-testid="current-lifespan-input"
                    disabled={isFormDisabled}
                    className={hasError ? 'border-red-500' : ''}
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
            {t('efQuantityHeading')}
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <FormFieldWrapper
              form={form as any}
              name="unitValue"
              label={t('efQuantityLabel')}
            >
              {(field, hasError) => (
                <Input
                  {...field}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="100"
                  data-testid="unit-value-input"
                  disabled={isFormDisabled}
                  className={hasError ? 'border-red-500' : ''}
                />
              )}
            </FormFieldWrapper>

            <FormFieldWrapper
              form={form as any}
              name="unit"
              label={t('efUnitLabel')}
            >
              {(field, hasError) => (
                <Select onValueChange={field.onChange} value={field.value} disabled={isFormDisabled}>
                  <SelectTrigger data-testid="unit-select" className={hasError ? 'border-red-500' : ''}>
                    <SelectValue placeholder={t('efSelectUnit')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m2">{t('efUnitM2')}</SelectItem>
                    <SelectItem value="m">{t('efUnitM')}</SelectItem>
                    <SelectItem value="unit">{t('efUnitUnit')}</SelectItem>
                    <SelectItem value="m3">{t('efUnitM3')}</SelectItem>
                    <SelectItem value="kg">{t('efUnitKg')}</SelectItem>
                    <SelectItem value="L">{t('efUnitL')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormFieldWrapper>
          </div>
        </div>

        {/* Next Evaluation Date */}
        <FormFieldWrapper
          form={form as any}
          name="nextEvaluationDate"
          label={t('efNextEvaluationDate')}
        >
          {(field, hasError) => (
            <div className="space-y-2">
              <div className="flex items-center justify-end gap-2">
                <input
                  type="checkbox"
                  checked={autoCalculateEvaluation}
                  onChange={(e) => form.setValue('autoCalculateEvaluation', e.target.checked)}
                  className="rounded"
                  data-testid="auto-calculate-checkbox"
                  disabled={isFormDisabled}
                />
                <span className="text-xs text-muted-foreground">{t('efAutoCalculate')}</span>
              </div>
              
              <Input
                value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  // Fix controlled/uncontrolled warning by always passing Date or null
                  const dateValue = e.target.value ? new Date(e.target.value) : null;
                  field.onChange(dateValue);
                }}
                type="date"
                min={format(new Date(), 'yyyy-MM-dd')}
                disabled={autoCalculateEvaluation || isFormDisabled}
                data-testid="evaluation-date-input"
                className={hasError ? 'border-red-500' : ''}
              />
              
              {autoCalculateEvaluation && field.value && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  {/* eslint-disable-next-line i18n/no-untranslated-jsx-strings -- pre-existing untranslated string (task #708): translate in a follow-up */}
                  <Info className="h-3 w-3" />
                  {t('efAutoCalcHelper')}
                </div>
              )}
            </div>
          )}
        </FormFieldWrapper>

        {/* Reconstruction Cost Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            {t('efReconstructionEvaluation')}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormFieldWrapper
              form={form as any}
              name="reconstructionCost"
              label={t('efReconstructionCost')}
              required
            >
              {(field, hasError) => (
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    {...field}
                    type="number"
                    placeholder={t('efReconstructionCostPlaceholder')}
                    className={`pl-9 ${hasError ? 'border-red-500' : ''}`}
                    step="0.01"
                    min="0"
                    data-testid="reconstruction-cost-input"
                    disabled={isFormDisabled}
                  />
                </div>
              )}
            </FormFieldWrapper>
            
            <FormFieldWrapper
              form={form as any}
              name="costEstimationDate"
              label={t('efDateOfEstimation')}
              required
            >
              {(field, hasError) => (
                <Input
                  value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                  onChange={(e) => {
                    // Fix controlled/uncontrolled warning by always passing Date or null
                    const dateValue = e.target.value ? new Date(e.target.value) : null;
                    field.onChange(dateValue);
                  }}
                  type="date"
                  max={format(new Date(), 'yyyy-MM-dd')}
                  data-testid="cost-estimation-date-input"
                  disabled={isFormDisabled}
                  className={hasError ? 'border-red-500' : ''}
                />
              )}
            </FormFieldWrapper>
          </div>
        </div>

        <Separator />

        {/* Document Upload Section */}
        <DocumentAttachmentManager
          element={element}
          mode={mode || 'create'}
          buildingId={buildingId || ''}
          organizationId={organizationId || ''}
          onDocumentUploaded={(document) => {
            // Document uploaded successfully
          }}
          onDocumentDeleted={(documentId) => {
            // Document deleted successfully
          }}
        />

        <Separator />

        {/* Quantity/Duplicate Field */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            {t('efElementQuantityHeading')}
          </h4>
          <FormFieldWrapper
            form={form as any}
            name="quantity"
            label={t('efQuantityDuplicateLabel')}
            description={t('efQuantityDuplicateDesc')}
            required
          >
            {(field, hasError) => (
              <Input
                {...field}
                type="number"
                min="1"
                max="1000"
                placeholder="1"
                data-testid="element-quantity"
                className={`w-32 ${hasError ? 'border-red-500' : ''}`}
                disabled={isFormDisabled}
              />
            )}
          </FormFieldWrapper>
        </div>

        <Separator />

        {/* Notes */}
        <FormFieldWrapper
          form={form as any}
          name="notes"
          label={t('efNotesLabel')}
        >
          {(field, hasError) => (
            <Textarea
              {...field}
              placeholder={t('efNotesPlaceholder')}
              rows={3}
              data-testid="element-notes"
              disabled={isFormDisabled}
              className={hasError ? 'border-red-500' : ''}
            />
          )}
        </FormFieldWrapper>
      </div>
    </FormModal>
  );
}

export type { ElementFormProps };
