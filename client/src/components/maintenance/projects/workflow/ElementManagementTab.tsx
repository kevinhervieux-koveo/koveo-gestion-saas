import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import type { Translations } from '@/lib/i18n';
import { apiRequest } from '@/lib/queryClient';
import { BuildingElement, ProjectElement, ProjectWorkflowState } from '@shared/schemas/maintenance';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { useMarkStatusComplete } from '@/hooks/useProjectWorkflow';
import { cn, safeCapitalize } from '@/lib/utils';
import {
  Settings,
  Plus,
  Trash2,
  CheckCircle2,
  Building2,
  Wrench,
  AlertCircle,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Target,
  HelpCircle,
} from 'lucide-react';

interface ElementManagementTabProps {
  project: MaintenanceProject;
  workflowState: ProjectWorkflowState;
  onUpdate: () => void;
  onNavigateToTab?: (tabId: string) => void;
}

interface ProjectElementWithDetails extends ProjectElement {
  element: BuildingElement;
}

const PROJECT_TYPES = [
  { value: 'repair', labelKey: 'wfElementsTypeRepairLabel', icon: Wrench, descriptionKey: 'wfElementsTypeRepairDesc' },
  { value: 'minor_rehab', labelKey: 'wfElementsTypeMinorRehabLabel', icon: Building2, descriptionKey: 'wfElementsTypeMinorRehabDesc' },
  { value: 'major_rehab', labelKey: 'wfElementsTypeMajorRehabLabel', icon: Building2, descriptionKey: 'wfElementsTypeMajorRehabDesc' },
  { value: 'replacement', labelKey: 'wfElementsTypeReplacementLabel', icon: CheckCircle2, descriptionKey: 'wfElementsTypeReplacementDesc' },
  { value: 'not_sure', labelKey: 'wfElementsTypeAssessmentLabel', icon: Target, descriptionKey: 'wfElementsTypeAssessmentDesc' },
] as const;

export function ElementManagementTab({ project, workflowState, onUpdate, onNavigateToTab }: ElementManagementTabProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkProjectType, setBulkProjectType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [bulkAction, setBulkAction] = useState<'update_type' | 'remove'>('update_type');
  const [isProjectElementsCollapsed, setIsProjectElementsCollapsed] = useState<boolean>(false);
  const [isAvailableElementsCollapsed, setIsAvailableElementsCollapsed] = useState<boolean>(true);

  // Add workflow completion functionality
  const { mutate: markComplete, isPending: isMarkingComplete } = useMarkStatusComplete();

  const handleMarkComplete = () => {
    markComplete({
      projectId: project.id,
      currentStatus: 'submission',
    }, {
      onSuccess: (data) => {
        // Navigate to the next tab if provided and available
        if (data.newStatus && onNavigateToTab) {
          onNavigateToTab(data.newStatus);
        }
        // Update the workflow state
        onUpdate();
      },
    });
  };

  // Fetch building elements
  const { data: buildingElements = [], isLoading: loadingElements } = useQuery({
    queryKey: [`/api/maintenance/buildings/${project.buildingId}/elements`],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/buildings/${project.buildingId}/elements`);
      if (!response.ok) throw new Error('Failed to fetch building elements');
      const data = await response.json();
      return data.data || [];
    },
  });

  // Fetch project elements (elements linked to this project)
  const { data: projectElements = [], isLoading: loadingProjectElements } = useQuery({
    queryKey: [`/api/maintenance/projects/${project.id}/elements`],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/projects/${project.id}/elements`);
      if (!response.ok) throw new Error('Failed to fetch project elements');
      const data = await response.json();
      return data.elements || [];
    },
  });

  // Add elements to project mutation
  const addElementsMutation = useMutation({
    mutationFn: async (elementIds: string[]) => {
      const response = await apiRequest('POST', `/api/maintenance/projects/${project.id}/elements`, {
        elementIds,
      });
      if (!response.ok) throw new Error('Failed to add elements to project');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('wfElementsAddedTitle'),
        description: t('wfElementsAddedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: [`/api/maintenance/projects/${project.id}/elements`] });
      onUpdate();
    },
    onError: (error) => {
      toast({
        title: t('workflowErrorTitle'),
        description: error.message || t('wfElementsAddFailedDescription'),
        variant: 'destructive',
      });
    },
  });

  // Remove element from project mutation
  const removeElementMutation = useMutation({
    mutationFn: async (projectElementId: string) => {
      const response = await apiRequest('DELETE', `/api/maintenance/project-elements/${projectElementId}`);
      if (!response.ok) throw new Error('Failed to remove element from project');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('wfElementsRemovedTitle'),
        description: t('wfElementsRemovedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: [`/api/maintenance/projects/${project.id}/elements`] });
      onUpdate();
    },
    onError: (error) => {
      toast({
        title: t('workflowErrorTitle'),
        description: error.message || t('wfElementsRemoveFailedDescription'),
        variant: 'destructive',
      });
    },
  });

  // Update project element mutation
  const updateProjectElementMutation = useMutation({
    mutationFn: async ({ projectElementId, updates }: { projectElementId: string; updates: any }) => {
      const response = await apiRequest('PATCH', `/api/maintenance/project-elements/${projectElementId}`, updates);
      if (!response.ok) throw new Error('Failed to update project element');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('wfElementsUpdatedTitle'),
        description: t('wfElementsUpdatedDescription'),
      });
      queryClient.invalidateQueries({ queryKey: [`/api/maintenance/projects/${project.id}/elements`] });
      onUpdate();
    },
    onError: (error) => {
      toast({
        title: t('workflowErrorTitle'),
        description: error.message || t('wfElementsUpdateFailedDescription'),
        variant: 'destructive',
      });
    },
  });

  const handleElementSelect = (elementId: string, selected: boolean) => {
    if (selected) {
      setSelectedElements(prev => [...prev, elementId]);
    } else {
      setSelectedElements(prev => prev.filter(id => id !== elementId));
    }
  };

  const handleSelectAllProjectElements = () => {
    const allProjectElementIds = filteredProjectElements.map(pe => pe.elementId);
    const allSelected = allProjectElementIds.every(id => selectedElements.includes(id));
    
    if (allSelected) {
      // Deselect all project elements
      setSelectedElements(prev => prev.filter(id => !allProjectElementIds.includes(id)));
    } else {
      // Select all project elements
      const newSelections = [...new Set([...selectedElements, ...allProjectElementIds])];
      setSelectedElements(newSelections);
    }
  };

  const handleAddSelectedElements = () => {
    if (selectedElements.length > 0) {
      addElementsMutation.mutate(selectedElements);
      setSelectedElements([]);
    }
  };

  const handleBulkProjectTypeUpdate = () => {
    if (!bulkProjectType || selectedElements.length === 0) return;

    // Update project type for all selected elements that are already in the project
    const selectedProjectElements = projectElements.filter(pe => 
      selectedElements.includes(pe.elementId)
    );

    selectedProjectElements.forEach(pe => {
      updateProjectElementMutation.mutate({
        projectElementId: pe.id,
        updates: { projectType: bulkProjectType },
      });
    });

    setShowBulkEdit(false);
    setBulkProjectType('');
    setSelectedElements([]);
  };

  const handleProjectTypeChange = (projectElementId: string, projectType: string) => {
    updateProjectElementMutation.mutate({
      projectElementId,
      updates: { projectType },
    });
  };

  const handleBulkRemoveElements = () => {
    if (selectedElements.length === 0) return;

    // Remove all selected elements that are in the project
    const selectedProjectElements = projectElements.filter(pe => 
      selectedElements.includes(pe.elementId)
    );

    selectedProjectElements.forEach(pe => {
      removeElementMutation.mutate(pe.id);
    });

    setShowBulkEdit(false);
    setSelectedElements([]);
  };

  const handleBulkAction = () => {
    if (bulkAction === 'remove') {
      handleBulkRemoveElements();
    } else if (bulkAction === 'update_type') {
      handleBulkProjectTypeUpdate();
    }
  };

  // Filter function for search
  const filterElements = (elements: any[]) => {
    if (!searchTerm.trim()) return elements;
    
    const term = searchTerm.toLowerCase();
    return elements.filter(element => {
      // For project elements, search in both element name and description
      if (element.elementName) {
        return element.elementName.toLowerCase().includes(term) ||
               element.uniformatCode?.toLowerCase().includes(term) ||
               element.description?.toLowerCase().includes(term);
      }
      // For building elements, search in name and description
      return element.name?.toLowerCase().includes(term) ||
             element.uniformatCode?.toLowerCase().includes(term) ||
             element.description?.toLowerCase().includes(term);
    });
  };

  const getProjectTypeDisplay = (projectType?: string) => {
    const type = PROJECT_TYPES.find(pt => pt.value === projectType);
    return type || { value: 'not_sure', labelKey: 'wfElementsTypeAssessmentLabel', icon: HelpCircle, descriptionKey: 'wfElementsTypeAssessmentDesc' } as const;
  };

  const linkedElementIds = projectElements.map(pe => pe.elementId);
  const availableElements = buildingElements.filter(element => 
    !linkedElementIds.includes(element.id)
  );

  // Apply filters
  const filteredProjectElements = filterElements(projectElements);
  const filteredAvailableElements = filterElements(availableElements);

  if (loadingElements || loadingProjectElements) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t('wfElementsManagementTitle')}
            </CardTitle>
            <CardDescription>{t('wfElementsLoading')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder={t('wfElementsSearchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
              data-testid="input-search-elements"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchTerm('')}
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {searchTerm && (
            <div className="mt-2 text-sm text-muted-foreground">
              {t('wfElementsFilteringByPrefix')} "{searchTerm}" • {filteredProjectElements.length + filteredAvailableElements.length} {t('wfElementsResultsSuffix')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Elements */}
      {filteredAvailableElements.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div 
                className="flex items-center gap-2 cursor-pointer" 
                onClick={() => setIsAvailableElementsCollapsed(!isAvailableElementsCollapsed)}
              >
                {isAvailableElementsCollapsed ? (
                  <ChevronRight className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    {t('wfElementsAvailableTitle')} ({searchTerm ? filteredAvailableElements.length : availableElements.length})
                  </CardTitle>
                  <CardDescription>
                    {t('wfElementsAddDescription')}
                    {searchTerm && ` ${t('wfElementsFilteredBySuffix')} "${searchTerm}"`}
                  </CardDescription>
                </div>
              </div>
              {selectedElements.length > 0 && (
                <Button
                  onClick={handleAddSelectedElements}
                  disabled={addElementsMutation.isPending}
                  data-testid="button-add-selected-elements"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('wfElementsAddSelectedButton')} ({selectedElements.length})
                </Button>
              )}
            </div>
          </CardHeader>
          {!isAvailableElementsCollapsed && (
          <CardContent>
            <div className="grid gap-3">
              {filteredAvailableElements.map((element) => {
                const isSelected = selectedElements.includes(element.id);

                return (
                  <Card key={element.id} className={cn("transition-all", isSelected && "ring-2 ring-primary")}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => 
                            handleElementSelect(element.id, checked as boolean)
                          }
                          data-testid={`checkbox-available-element-${element.id}`}
                        />
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{element.name}</h4>
                            <Badge variant="outline">
                              {element.uniformatCode}
                            </Badge>
                            <Badge variant="secondary">
                              {safeCapitalize(element.currentCondition || 'unknown')}
                            </Badge>
                          </div>
                          {element.description && (
                            <p className="text-sm text-muted-foreground">
                              {element.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
          )}
        </Card>
      )}

      {/* Project Elements */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div 
              className="flex items-center gap-2 cursor-pointer" 
              onClick={() => setIsProjectElementsCollapsed(!isProjectElementsCollapsed)}
            >
              {isProjectElementsCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {t('wfElementsProjectTitle')} ({projectElements.length})
                </CardTitle>
                <CardDescription>
                  {t('wfElementsIncludedDescription')}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              {filteredProjectElements.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAllProjectElements}
                  data-testid="button-select-all-project-elements"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {filteredProjectElements.every(pe => selectedElements.includes(pe.elementId)) ? t('wfElementsDeselectAllButton') : t('wfElementsSelectAllButton')}
                </Button>
              )}
              {selectedElements.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkEdit(true)}
                  data-testid="button-bulk-edit"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {t('wfElementsBulkActionsButton')} ({selectedElements.length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {!isProjectElementsCollapsed && (
        <CardContent>
          {filteredProjectElements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
              {searchTerm ? (
                <div>
                  <p>{t('wfElementsNoMatchPrefix')} "{searchTerm}"</p>
                  <p className="text-sm">{t('wfElementsAdjustSearchHint')}</p>
                </div>
              ) : projectElements.length === 0 ? (
                <div>
                  <p>{t('wfElementsNoneAddedYet')}</p>
                  <p className="text-sm">{t('wfElementsAddFromAvailable')}</p>
                </div>
              ) : (
                <div>
                  <p>{t('wfElementsNoMatchTitle')}</p>
                  <p className="text-sm">{t('wfElementsTryDifferent')}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredProjectElements.map((projectElement) => {
                const projectTypeDisplay = getProjectTypeDisplay(projectElement.projectType);
                const isSelected = selectedElements.includes(projectElement.elementId);

                return (
                  <Card key={projectElement.id} className={cn("transition-all", isSelected && "ring-2 ring-primary")}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => 
                            handleElementSelect(projectElement.elementId, checked as boolean)
                          }
                          data-testid={`checkbox-project-element-${projectElement.elementId}`}
                        />
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">
                              {projectElement.elementName || projectElement.element?.name || t('wfElementsUnknownElement')}
                            </h4>
                            <Badge variant="outline">
                              {projectElement.uniformatCode}
                            </Badge>
                          </div>
                          {projectElement.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {projectElement.description}
                            </p>
                          )}
                          
                          {/* Project Type Selection */}
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">{t('wfElementsProjectTypeFieldLabel')}</label>
                            <Select
                              value={projectElement.projectType || 'not_sure'}
                              onValueChange={(value) => handleProjectTypeChange(projectElement.id, value)}
                            >
                              <SelectTrigger className="w-64" data-testid={`select-project-type-${projectElement.elementId}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PROJECT_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    <div className="flex items-center gap-2">
                                      <type.icon className="h-4 w-4" />
                                      <div>
                                        <div className="font-medium">{t(type.labelKey as keyof Translations)}</div>
                                        <div className="text-xs text-muted-foreground">{t(type.descriptionKey as keyof Translations)}</div>
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeElementMutation.mutate(projectElement.id)}
                          disabled={removeElementMutation.isPending}
                          data-testid={`button-remove-element-${projectElement.elementId}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
        )}
      </Card>

      {/* Bulk Edit Dialog */}
      <Dialog open={showBulkEdit} onOpenChange={setShowBulkEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('wfElementsBulkActionsButton')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                {t('wfElementsBulkActionDescPrefix')} {selectedElements.length} {t('wfElementsBulkActionDescSuffix')}
              </p>
              
              {/* Action Selection */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="update_type"
                    checked={bulkAction === 'update_type'}
                    onCheckedChange={(checked) => checked && setBulkAction('update_type')}
                    data-testid="checkbox-bulk-update-type"
                  />
                  <label
                    htmlFor="update_type"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {t('wfElementsChangeTypeOption')}
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remove"
                    checked={bulkAction === 'remove'}
                    onCheckedChange={(checked) => checked && setBulkAction('remove')}
                    data-testid="checkbox-bulk-remove"
                  />
                  <label
                    htmlFor="remove"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {t('wfElementsRemoveOption')}
                  </label>
                </div>
              </div>

              {/* Project Type Selection - only show when updating type */}
              {bulkAction === 'update_type' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">{t('wfElementsSelectNewTypeLabel')}</label>
                  <Select value={bulkProjectType} onValueChange={setBulkProjectType}>
                    <SelectTrigger data-testid="select-bulk-project-type">
                      <SelectValue placeholder={t('wfElementsSelectTypePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{t(type.labelKey as keyof Translations)}</div>
                              <div className="text-xs text-muted-foreground">{t(type.descriptionKey as keyof Translations)}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Warning for remove action */}
              {bulkAction === 'remove' && (
                <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">{t('wfElementsWarningLabel')}</span>
                  </div>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {t('wfElementsBulkRemoveWarning', { count: selectedElements.length })}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBulkEdit(false);
                  setBulkProjectType('');
                  setBulkAction('update_type');
                }}
                data-testid="button-cancel-bulk-edit"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleBulkAction}
                disabled={
                  (bulkAction === 'update_type' && !bulkProjectType) ||
                  updateProjectElementMutation.isPending ||
                  removeElementMutation.isPending
                }
                variant={bulkAction === 'remove' ? 'destructive' : 'default'}
                data-testid="button-confirm-bulk-edit"
              >
                {bulkAction === 'remove' ? (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('wfElementsRemoveButton')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {t('wfElementsUpdateTypeButton')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete Submission Phase Button */}
      {workflowState.canAdvance && workflowState.currentStatus === 'submission' && (
        <div className="flex items-center justify-between pt-6 border-t">
          <div className="text-sm text-muted-foreground">
            {workflowState.nextStatus && (
              <>{t('wfElementsNextLabel')} <span className="capitalize">{workflowState.nextStatus.replace(/_/g, ' ')}</span></>
            )}
          </div>
          
          <Button 
            onClick={handleMarkComplete}
            disabled={isMarkingComplete}
            className="flex items-center gap-2"
            data-testid="button-complete-submission-phase"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isMarkingComplete ? t('wfElementsCompletingButton') : t('wfElementsCompleteSubmissionButton')}
          </Button>
        </div>
      )}
    </div>
  );
}
