import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { BuildingElement, ProjectElement } from '@shared/schemas/maintenance';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { cn, safeCapitalize } from '@/lib/utils';
import {
  Settings,
  Plus,
  Trash2,
  CheckCircle2,
  Building2,
  Wrench,
  AlertCircle,
} from 'lucide-react';

interface ElementManagementTabProps {
  project: MaintenanceProject;
  onUpdate: () => void;
}

interface ProjectElementWithDetails extends ProjectElement {
  element: BuildingElement;
}

const PROJECT_TYPES = [
  { value: 'repair', label: 'Repair', icon: '🔧', description: 'Fix existing components' },
  { value: 'minor_rehab', label: 'Minor Rehabilitation', icon: '🔨', description: 'Minor improvements' },
  { value: 'major_rehab', label: 'Major Rehabilitation', icon: '🏗️', description: 'Significant renovations' },
  { value: 'replacement', label: 'Replacement', icon: '🔄', description: 'Full component replacement' },
  { value: 'not_sure', label: 'Assessment Needed', icon: '❓', description: 'Requires evaluation' },
];

export function ElementManagementTab({ project, onUpdate }: ElementManagementTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkProjectType, setBulkProjectType] = useState<string>('');

  // Fetch building elements
  const { data: buildingElements = [], isLoading: loadingElements } = useQuery({
    queryKey: [`/api/maintenance/buildings/${project.buildingId}/elements`],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/buildings/${project.buildingId}/elements`);
      if (!response.ok) throw new Error('Failed to fetch building elements');
      const data = await response.json();
      return data.elements || [];
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
        title: 'Elements Added',
        description: 'Elements have been successfully added to the project.',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/maintenance/projects/${project.id}/elements`] });
      onUpdate();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add elements to project.',
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
        title: 'Element Removed',
        description: 'Element has been successfully removed from the project.',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/maintenance/projects/${project.id}/elements`] });
      onUpdate();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove element from project.',
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
        title: 'Element Updated',
        description: 'Project element has been successfully updated.',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/maintenance/projects/${project.id}/elements`] });
      onUpdate();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update project element.',
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

  const getProjectTypeDisplay = (projectType?: string) => {
    const type = PROJECT_TYPES.find(t => t.value === projectType);
    return type || { value: 'not_sure', label: 'Assessment Needed', icon: '❓', description: 'Requires evaluation' };
  };

  const linkedElementIds = projectElements.map(pe => pe.elementId);
  const availableElements = buildingElements.filter(element => 
    !linkedElementIds.includes(element.id)
  );

  if (loadingElements || loadingProjectElements) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Element Management
            </CardTitle>
            <CardDescription>Loading elements...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Project Elements */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Project Elements ({projectElements.length})
              </CardTitle>
              <CardDescription>
                Elements included in this maintenance project
              </CardDescription>
            </div>
            {selectedElements.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkEdit(true)}
                  data-testid="button-bulk-edit-project-type"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Bulk Edit Project Type ({selectedElements.length})
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {projectElements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No elements added to this project yet.</p>
              <p className="text-sm">Add elements from the available elements below.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {projectElements.map((projectElement) => {
                const element = buildingElements.find(e => e.id === projectElement.elementId);
                const projectTypeDisplay = getProjectTypeDisplay(projectElement.projectType);
                const isSelected = selectedElements.includes(projectElement.elementId);

                if (!element) return null;

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
                            <h4 className="font-medium">{element.name}</h4>
                            <Badge variant="outline">
                              {element.uniformatCode}
                            </Badge>
                          </div>
                          {element.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {element.description}
                            </p>
                          )}
                          
                          {/* Project Type Selection */}
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">Project Type:</label>
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
                                      <span>{type.icon}</span>
                                      <div>
                                        <div className="font-medium">{type.label}</div>
                                        <div className="text-xs text-muted-foreground">{type.description}</div>
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
      </Card>

      {/* Available Elements */}
      {availableElements.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Available Building Elements ({availableElements.length})
                </CardTitle>
                <CardDescription>
                  Add elements to this maintenance project
                </CardDescription>
              </div>
              {selectedElements.length > 0 && (
                <Button
                  onClick={handleAddSelectedElements}
                  disabled={addElementsMutation.isPending}
                  data-testid="button-add-selected-elements"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Selected ({selectedElements.length})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {availableElements.map((element) => {
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
        </Card>
      )}

      {/* Bulk Edit Dialog */}
      <Dialog open={showBulkEdit} onOpenChange={setShowBulkEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Edit Project Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Update project type for {selectedElements.length} selected elements
              </p>
              
              <Select value={bulkProjectType} onValueChange={setBulkProjectType}>
                <SelectTrigger data-testid="select-bulk-project-type">
                  <SelectValue placeholder="Select project type" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <span>{type.icon}</span>
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBulkEdit(false);
                  setBulkProjectType('');
                }}
                data-testid="button-cancel-bulk-edit"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkProjectTypeUpdate}
                disabled={!bulkProjectType || updateProjectElementMutation.isPending}
                data-testid="button-confirm-bulk-edit"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Update Project Type
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}