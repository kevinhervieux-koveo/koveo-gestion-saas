import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBuildingPermissions } from '@/hooks/use-building-context';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { translateProjectPriority, translateProjectType } from './projectEnumLabels';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { handleApiError } from '@/lib/demo-error-handler';
import { EvaluationSuggestion, MaintenanceProject } from '@shared/schemas/maintenance';
import { format } from 'date-fns';
import { cn, parseDateOnly, parseDateOnlyLoose } from '@/lib/utils';
import {
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Target,
  Building2,
  Zap,
  Plus,
  X,
  Calendar,
  TrendingUp,
  Filter,
  Search,
} from 'lucide-react';

export interface SuggestionsIntegrationProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSuggestions?: EvaluationSuggestion[];
  onSelectionChange?: (suggestions: EvaluationSuggestion[]) => void;
  onSuccess?: (projects: MaintenanceProject[]) => void;
  buildingId?: string;
  organizationId?: string;
}

interface SuggestionWithProject extends EvaluationSuggestion {
  estimatedCost?: number;
  projectTitle?: string;
  projectType?: string;
  projectPriority?: string;
}

/**
 * SuggestionsIntegration component for creating projects from evaluation suggestions
 * Provides bulk project creation workflow with suggestion review and approval
 */
export function SuggestionsIntegration({
  isOpen,
  onClose,
  selectedSuggestions = [],
  onSelectionChange,
  onSuccess,
  buildingId,
  organizationId,
}: SuggestionsIntegrationProps) {
  const { hasPermission } = useBuildingPermissions();
  const { toast } = useToast();
  const { language, t, tp } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [projectDefaults, setProjectDefaults] = useState({
    defaultBudget: '',
    defaultDuration: '30',
    defaultPriority: 'medium' as const,
  });

  // Fetch suggestions for current building
  const {
    data: suggestionsResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/maintenance/buildings', buildingId, 'suggestions'],
    queryFn: async () => {
      if (!buildingId) throw new Error('Building ID is required');
      const response = await apiRequest('GET', `/api/maintenance/buildings/${buildingId}/suggestions`);
      return await response.json();
    },
    enabled: !!buildingId && isOpen,
    staleTime: 2 * 60 * 1000,
  });

  // Filter to only pending suggestions client-side
  const allSuggestions: SuggestionWithProject[] = suggestionsResponse?.suggestions || [];
  const suggestions = allSuggestions.filter(suggestion => suggestion.status === 'pending');

  // Filter suggestions based on search and filters
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter(suggestion => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          suggestion.reason.toLowerCase().includes(searchLower) ||
          suggestion.suggestedType.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Priority filter
      if (priorityFilter && suggestion.priority !== priorityFilter) {
        return false;
      }

      // Type filter
      if (typeFilter && suggestion.suggestedType !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [suggestions, searchTerm, priorityFilter, typeFilter]);

  // Convert suggestions to projects mutation (using individual conversion endpoint)
  // Exception (task #229): mutation produces a per-suggestion result toast
  // whose content depends on the input variables, which `useCreateUpdateMutation`
  // does not model — kept as raw `useMutation`.
  const createProjectsMutation = useMutation({
    mutationFn: async (selectedSuggestionIds: string[]) => {
      const createdProjects = [];
      
      // Convert each suggestion individually
      for (const suggestionId of selectedSuggestionIds) {
        try {
          const response = await apiRequest('POST', `/api/maintenance/suggestions/${suggestionId}/convert-to-project`, {
            defaultBudget: projectDefaults.defaultBudget,
            defaultDuration: projectDefaults.defaultDuration,
            defaultPriority: projectDefaults.defaultPriority,
          });
          const result = await response.json();
          if (result.success && result.data) {
            createdProjects.push(result.data);
          }
        } catch (error) {
          console.error(`Failed to convert suggestion ${suggestionId}:`, error);
          // Continue with other suggestions even if one fails
        }
      }
      
      return { projects: createdProjects };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'suggestions'] });
      
      const createdProjects = data.projects || [];
      onSuccess?.(createdProjects);
      onClose();
      
      toast({
        title: t('pvProjectsCreatedTitle'),
        description: tp('pvProjectsCreatedDesc', createdProjects.length),
      });
    },
    onError: (error) => {
      handleApiError(error, language, t('pvFailedToCreateProjects'));
      console.error('Project creation failed:', error);
    },
  });

  // Handle suggestion selection
  const handleSuggestionToggle = useCallback((suggestion: SuggestionWithProject, checked: boolean) => {
    const newSelection = checked
      ? [...selectedSuggestions, suggestion]
      : selectedSuggestions.filter(s => s.id !== suggestion.id);
    
    onSelectionChange?.(newSelection);
  }, [selectedSuggestions, onSelectionChange]);

  // Handle select all
  const handleSelectAll = useCallback((checked: boolean) => {
    const newSelection = checked ? filteredSuggestions : [];
    onSelectionChange?.(newSelection);
  }, [filteredSuggestions, onSelectionChange]);

  // Handle create projects
  const handleCreateProjects = useCallback(() => {
    if (selectedSuggestions.length === 0) {
      toast({
        title: t('pvNoSuggestionsSelectedTitle'),
        description: t('pvNoSuggestionsSelectedDesc'),
        variant: "destructive",
      });
      return;
    }

    const selectedIds = selectedSuggestions.map(s => s.id);
    createProjectsMutation.mutate(selectedIds);
  }, [selectedSuggestions, createProjectsMutation, toast, t]);

  // Calculate estimated total cost
  const estimatedTotalCost = useMemo(() => {
    const defaultBudget = projectDefaults.defaultBudget ? parseFloat(projectDefaults.defaultBudget) : 0;
    return selectedSuggestions.length * defaultBudget;
  }, [selectedSuggestions.length, projectDefaults.defaultBudget]);

  if (!hasPermission('canCreateProjects')) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col" data-testid="suggestions-integration-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            {t('pvCreateProjectsFromSuggestions')}
          </DialogTitle>
          <DialogDescription>
            {t('pvSuggestionsDialogDesc')}
          </DialogDescription>
        </DialogHeader>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4 flex-1 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('pvFailedToLoadSuggestions')}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        {!isLoading && !error && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={t('pvSearchSuggestionsPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-suggestions"
                />
              </div>
              
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t('pvAllPrioritiesPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('pvAllPrioritiesItem')}</SelectItem>
                  <SelectItem value="low">{t('low')}</SelectItem>
                  <SelectItem value="medium">{t('medium')}</SelectItem>
                  <SelectItem value="high">{t('high')}</SelectItem>
                  <SelectItem value="critical">{t('critical')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t('pvAllTypesPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('pvAllTypesItem')}</SelectItem>
                  <SelectItem value="inspection">{t('pvTypeInspection')}</SelectItem>
                  <SelectItem value="minor_rehab">{t('pvTypeMinorRehab')}</SelectItem>
                  <SelectItem value="major_rehab">{t('pvTypeMajorRehab')}</SelectItem>
                  <SelectItem value="replacement">{t('pvTypeReplacement')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selection Summary */}
            {filteredSuggestions.length > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Checkbox
                        id="select-all"
                        checked={selectedSuggestions.length === filteredSuggestions.length && filteredSuggestions.length > 0}
                        onCheckedChange={handleSelectAll}
                        data-testid="select-all-suggestions"
                      />
                      <Label htmlFor="select-all" className="text-sm font-medium">
                        {t('pvSelectAllSuggestions').replace('{count}', String(filteredSuggestions.length))}
                      </Label>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      {tp('pvNSelected', selectedSuggestions.length)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Suggestions List */}
            <div className="flex-1 overflow-auto">
              {filteredSuggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Lightbulb className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t('pvNoSuggestionsFound')}</h3>
                  <p className="text-muted-foreground text-center">
                    {suggestions.length === 0 
                      ? t('pvNoPendingSuggestions')
                      : t('pvNoSuggestionsMatchFilters')
                    }
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4" data-testid="suggestions-list">
                  {filteredSuggestions.map((suggestion) => {
                    const isSelected = selectedSuggestions.some(s => s.id === suggestion.id);
                    
                    return (
                      <Card 
                        key={suggestion.id} 
                        className={cn(
                          "cursor-pointer transition-colors",
                          isSelected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/50"
                        )}
                        onClick={() => handleSuggestionToggle(suggestion, !isSelected)}
                        data-testid={`suggestion-card-${suggestion.id}`}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleSuggestionToggle(suggestion, checked as boolean)}
                              className="mt-1"
                              data-testid={`suggestion-checkbox-${suggestion.id}`}
                            />
                            
                            <div className="flex-1 space-y-2">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <h4 className="text-sm font-medium leading-tight">
                                    {t('pvSuggestionTypeElementEvaluation').replace('{type}', translateProjectType(suggestion.suggestedType, t))}
                                  </h4>
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {suggestion.reason}
                                  </p>
                                </div>
                                
                                <div className="flex items-center gap-2 ml-4">
                                  <Badge 
                                    variant={suggestion.priority === 'critical' ? 'destructive' : 
                                            suggestion.priority === 'high' ? 'default' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {translateProjectPriority(suggestion.priority, t)}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {translateProjectType(suggestion.suggestedType, t)}
                                  </Badge>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(parseDateOnlyLoose(suggestion.suggestedDate) ?? new Date(), 'MMM dd, yyyy')}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {t('pvElementHash').replace('{id}', suggestion.elementId?.slice(-8) ?? '')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Project Defaults Configuration */}
            {selectedSuggestions.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{t('pvProjectDefaultsTitle')}</CardTitle>
                  <CardDescription>
                    {t('pvProjectDefaultsDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="default-budget" className="text-xs">{t('pvDefaultBudgetLabel')}</Label>
                      <Input
                        id="default-budget"
                        type="number"
                        placeholder="0"
                        value={projectDefaults.defaultBudget}
                        onChange={(e) => setProjectDefaults(prev => ({ ...prev, defaultBudget: e.target.value }))}
                        data-testid="default-budget-input"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="default-duration" className="text-xs">{t('pvDurationDaysLabel')}</Label>
                      <Input
                        id="default-duration"
                        type="number"
                        value={projectDefaults.defaultDuration}
                        onChange={(e) => setProjectDefaults(prev => ({ ...prev, defaultDuration: e.target.value }))}
                        data-testid="default-duration-input"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="default-priority" className="text-xs">{t('pvDefaultPriorityLabel')}</Label>
                      <Select 
                        value={projectDefaults.defaultPriority} 
                        onValueChange={(value: any) => setProjectDefaults(prev => ({ ...prev, defaultPriority: value }))}
                      >
                        <SelectTrigger data-testid="default-priority-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">{t('low')}</SelectItem>
                          <SelectItem value="medium">{t('medium')}</SelectItem>
                          <SelectItem value="high">{t('high')}</SelectItem>
                          <SelectItem value="critical">{t('critical')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {estimatedTotalCost > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {t('pvEstimatedTotalBudget')} <span className="font-medium">${estimatedTotalCost.toLocaleString()}</span>
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedSuggestions.length > 0 && (
              <span>{tp('pvSuggestionsSelectedFooter', selectedSuggestions.length)}</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} data-testid="cancel-button">
              {t('cancel')}
            </Button>
            <Button 
              onClick={handleCreateProjects}
              disabled={selectedSuggestions.length === 0 || createProjectsMutation.isPending}
              data-testid="create-projects-button"
            >
              {createProjectsMutation.isPending ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  {t('pvCreatingButton')}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('pvCreateNProjects')
                    .replace('{count}', String(selectedSuggestions.length))
                    .replace('{plural}', selectedSuggestions.length !== 1 ? 's' : '')}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}