import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
import { ColumnDef, Row } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ElementCard } from '@/components/maintenance/inventory/ElementCard';
import { ConditionBadge } from '@/components/maintenance/StatusBadges';
import { useBuildingContext } from '@/hooks/use-building-context';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { MaintenanceProject, BuildingElement, ProjectElement } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Edit2,
  DollarSign,
  Calendar,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  Download,
  Users,
  Target,
  Eye,
} from 'lucide-react';

export interface ProjectElementsProps {
  project: MaintenanceProject;
  className?: string;
  variant?: 'table' | 'cards';
  showCostAllocation?: boolean;
  showLifespanImpact?: boolean;
  onElementClick?: (element: BuildingElement) => void;
  editable?: boolean;
}

interface ProjectElementWithDetails extends ProjectElement {
  element: BuildingElement;
  uniformatCode?: string;
  elementName: string;
  currentCondition: string;
  lastInspectionDate?: string;
  estimatedCost?: number;
}

/**
 * ProjectElements component for managing building elements linked to a project
 * Supports element assignment, cost allocation, and impact tracking
 */
export function ProjectElements({
  project,
  className,
  variant = 'table',
  showCostAllocation = true,
  showLifespanImpact = true,
  onElementClick,
  editable = true,
}: ProjectElementsProps) {
  const { buildingId, hasPermission } = useBuildingContext();
  const { toast } = useToast();
  
  // State management
  const [isAddElementOpen, setIsAddElementOpen] = useState(false);
  const [isEditCostOpen, setIsEditCostOpen] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ProjectElementWithDetails | null>(null);
  const [elementToRemove, setElementToRemove] = useState<string | null>(null);
  const [selectedElements, setSelectedElements] = useState<Row<ProjectElementWithDetails>[]>([]);
  const [costAllocation, setCostAllocation] = useState<string>('');
  const [workDescription, setWorkDescription] = useState<string>('');
  const [lifespanImpact, setLifespanImpact] = useState<string>('');

  // Fetch project elements
  const {
    data: projectElementsResponse,
    isLoading: isLoadingElements,
    error: elementsError,
  } = useQuery({
    queryKey: ['/api/maintenance/projects', project.id, 'elements'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/projects/${project.id}/elements`);
      return await response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch available building elements for assignment
  const {
    data: availableElementsResponse,
    isLoading: isLoadingAvailable,
  } = useQuery({
    queryKey: ['/api/maintenance/buildings', buildingId, 'elements'],
    queryFn: async () => {
      if (!buildingId) throw new Error('Building ID is required');
      const response = await apiRequest('GET', `/api/maintenance/buildings/${buildingId}/elements`);
      return await response.json();
    },
    enabled: !!buildingId && isAddElementOpen,
  });

  const projectElements: ProjectElementWithDetails[] = projectElementsResponse?.elements || [];
  const availableElements: BuildingElement[] = availableElementsResponse?.elements || [];

  // Filter available elements to exclude already assigned ones
  const unassignedElements = availableElements.filter(
    element => !projectElements.some(pe => pe.elementId === element.id)
  );

  const elementsQueryKey: readonly unknown[] = ['/api/maintenance/projects', project.id, 'elements'];
  const projectQueryKey: readonly unknown[] = ['/api/maintenance/projects', project.id];

  // Add element mutation
  const addElementMutation = useCreateUpdateMutation<unknown, {
    elementId: string;
    workDescription?: string;
    costAllocation?: number;
    lifespanImpact?: number;
  }>({
    mutationFn: async (elementData) => {
      const response = await apiRequest('POST', `/api/maintenance/projects/${project.id}/elements`, {
        ...elementData,
        projectId: project.id,
      });
      return response.json();
    },
    successTitle: 'Element Added',
    successMessage: 'Building element has been added to the project successfully.',
    errorTitle: 'Failed to Add Element',
    errorMessage: (error: any) => error?.response?.data?.message || 'Please try again.',
    queryKeysToInvalidate: [elementsQueryKey],
    onSuccessCallback: () => {
      setIsAddElementOpen(false);
      resetForm();
    },
  });

  // Quick Project mutation
  const quickProjectMutation = useCreateUpdateMutation({
    mutationFn: async () => {
      const response = await apiRequest('PATCH', `/api/maintenance/projects/${project.id}`, {
        isQuickProject: true,
        estimatedCost: costAllocation ? parseFloat(costAllocation) : undefined,
        planningDescription: workDescription || 'Quick Project for planning purposes',
      });
      return response.json();
    },
    successTitle: 'Quick Project Created',
    successMessage: 'This project has been set as a Quick Project for planning purposes only.',
    errorTitle: 'Failed to Create Quick Project',
    errorMessage: (error: any) => error?.response?.data?.message || 'Please try again.',
    queryKeysToInvalidate: [projectQueryKey],
    onSuccessCallback: () => {
      setIsAddElementOpen(false);
      resetForm();
    },
  });

  // Update element mutation
  const updateElementMutation = useCreateUpdateMutation<unknown, {
    id: string;
    workDescription?: string;
    costAllocation?: number;
    lifespanImpact?: number;
  }>({
    mutationFn: async (elementData) => {
      const response = await apiRequest('PATCH', `/api/maintenance/project-elements/${elementData.id}`, elementData);
      return response.json();
    },
    successTitle: 'Element Updated',
    successMessage: 'Element details have been updated successfully.',
    errorTitle: 'Update Failed',
    errorMessage: (error: any) => error?.response?.data?.message || 'Please try again.',
    queryKeysToInvalidate: [elementsQueryKey],
    onSuccessCallback: () => {
      setIsEditCostOpen(false);
      setSelectedElement(null);
      resetForm();
    },
  });

  // Remove element mutation
  const removeElementMutation = useCreateUpdateMutation<unknown, string>({
    mutationFn: async (elementId: string) => {
      const response = await apiRequest('DELETE', `/api/maintenance/project-elements/${elementId}`);
      return response.json();
    },
    successTitle: 'Element Removed',
    successMessage: 'Element has been removed from the project.',
    errorTitle: 'Removal Failed',
    errorMessage: (error: any) => error?.response?.data?.message || 'Please try again.',
    queryKeysToInvalidate: [elementsQueryKey],
    onSuccessCallback: () => {
      setElementToRemove(null);
    },
  });

  // Bulk operations mutation
  const bulkUpdateMutation = useCreateUpdateMutation<unknown, {
    type: 'remove' | 'update_cost';
    elementIds: string[];
    data?: any;
  }>({
    mutationFn: async (operation) => {
      const response = await apiRequest('POST', `/api/maintenance/projects/${project.id}/elements/bulk`, operation);
      return response.json();
    },
    successTitle: 'Bulk Operation Complete',
    successMessage: (_data, operation) => {
      const actionLabel = operation.type === 'remove' ? 'removed' : 'updated';
      return `Selected elements have been ${actionLabel} successfully.`;
    },
    errorTitle: 'Bulk Operation Failed',
    errorMessage: (error: any) => error?.response?.data?.message || 'Please try again.',
    queryKeysToInvalidate: [elementsQueryKey],
    onSuccessCallback: () => {
      setSelectedElements([]);
    },
  });

  const resetForm = () => {
    setCostAllocation('');
    setWorkDescription('');
    setLifespanImpact('');
  };

  const handleAddElement = (elementId: string) => {
    if (!hasPermission('canEditMaintenance')) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to add elements to projects.",
        variant: "destructive",
      });
      return;
    }

    addElementMutation.mutate({
      elementId,
      workDescription: workDescription || undefined,
      costAllocation: costAllocation ? parseFloat(costAllocation) : undefined,
      lifespanImpact: lifespanImpact ? parseInt(lifespanImpact) : undefined,
    });
  };

  const handleUpdateElement = () => {
    if (!selectedElement) return;

    updateElementMutation.mutate({
      id: selectedElement.id,
      workDescription: workDescription || undefined,
      costAllocation: costAllocation ? parseFloat(costAllocation) : undefined,
      lifespanImpact: lifespanImpact ? parseInt(lifespanImpact) : undefined,
    });
  };

  const openEditDialog = (element: ProjectElementWithDetails) => {
    setSelectedElement(element);
    setCostAllocation(element.costAllocation?.toString() || '');
    setWorkDescription(element.workDescription || '');
    setLifespanImpact(element.lifespanImpact?.toString() || '');
    setIsEditCostOpen(true);
  };

  const handleCreateQuickProject = () => {
    if (!hasPermission('canEditMaintenance')) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to create Quick Projects.",
        variant: "destructive",
      });
      return;
    }

    quickProjectMutation.mutate();
  };

  // Helper variables
  const isInPlanningPhase = project.status === 'planned';
  const isQuickProject = (project as any).isQuickProject || false;

  // Define table columns
  const columns: ColumnDef<ProjectElementWithDetails>[] = useMemo(() => {
    const baseColumns: ColumnDef<ProjectElementWithDetails>[] = [
      {
        accessorKey: 'elementName',
        header: 'Element',
        cell: ({ row }) => {
          const element = row.original;
          return (
            <div className="space-y-1" data-testid={`element-name-${element.elementId}`}>
              <div className="font-medium">{element.elementName}</div>
              <div className="text-xs text-muted-foreground">
                {element.uniformatCode}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'currentCondition',
        header: 'Condition',
        cell: ({ row }) => (
          <ConditionBadge 
            condition={row.getValue('currentCondition')} 
            size="sm"
            data-testid={`element-condition-${row.original.elementId}`}
          />
        ),
      },
      {
        accessorKey: 'workDescription',
        header: 'Planned Work',
        cell: ({ row }) => {
          const description = row.getValue('workDescription') as string;
          return description ? (
            <div className="max-w-xs truncate" title={description}>
              {description}
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">Not specified</span>
          );
        },
      },
    ];

    if (showCostAllocation) {
      baseColumns.push({
        accessorKey: 'costAllocation',
        header: 'Cost Allocation',
        cell: ({ row }) => {
          const cost = row.getValue('costAllocation') as number;
          return cost ? (
            <div className="text-sm font-medium" data-testid={`element-cost-${row.original.elementId}`}>
              ${cost.toLocaleString()}
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">Not set</span>
          );
        },
      });
    }

    if (showLifespanImpact) {
      baseColumns.push({
        accessorKey: 'lifespanImpact',
        header: 'Lifespan Impact',
        cell: ({ row }) => {
          const impact = row.getValue('lifespanImpact') as number;
          return impact ? (
            <div className="text-sm" data-testid={`element-lifespan-${row.original.elementId}`}>
              +{impact} years
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">TBD</span>
          );
        },
      });
    }

    if (editable && hasPermission('canEditMaintenance')) {
      baseColumns.push({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const element = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="h-8 w-8 p-0"
                  data-testid={`element-actions-${element.elementId}`}
                >
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  onClick={() => onElementClick?.(element.element)}
                  data-testid={`action-view-element-${element.elementId}`}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                
                <DropdownMenuItem 
                  onClick={() => openEditDialog(element)}
                  data-testid={`action-edit-element-${element.elementId}`}
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit Allocation
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  onClick={() => setElementToRemove(element.id)}
                  className="text-red-600"
                  data-testid={`action-remove-element-${element.elementId}`}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove from Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      });
    }

    return baseColumns;
  }, [showCostAllocation, showLifespanImpact, editable, hasPermission, onElementClick]);

  // Bulk actions
  const bulkActions = useMemo(() => {
    if (!editable || !hasPermission('canEditMaintenance')) return [];

    return [
      {
        label: 'Remove Selected',
        icon: Trash2,
        onClick: (selectedRows: Row<ProjectElementWithDetails>[]) => {
          const elementIds = selectedRows.map(row => row.original.id);
          bulkUpdateMutation.mutate({ type: 'remove', elementIds });
        },
        variant: 'destructive' as const,
        disabled: (selectedRows: Row<ProjectElementWithDetails>[]) => selectedRows.length === 0,
      },
      {
        label: 'Export Elements',
        icon: Download,
        onClick: (selectedRows: Row<ProjectElementWithDetails>[]) => {
          // Export logic would be implemented here
          // Exporting elements - export logic handled in download function
        },
        disabled: (selectedRows: Row<ProjectElementWithDetails>[]) => selectedRows.length === 0,
      },
    ];
  }, [editable, hasPermission, bulkUpdateMutation]);

  if (isLoadingElements) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'cards') {
    return (
      <Card className={cn("w-full", className)} data-testid={`project-elements-${project.id}`}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Project Elements</CardTitle>
            
            {editable && hasPermission('canEditMaintenance') && (
              <Dialog open={isAddElementOpen} onOpenChange={setIsAddElementOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="add-element-button">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Element
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Building Element</DialogTitle>
                    <DialogDescription>
                      Select building elements to include in this project.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                    {/* Quick Project Option - Only in planning phase */}
                    {isInPlanningPhase && !isQuickProject && (
                      <Card className="cursor-pointer hover:bg-accent transition-colors border-2 border-dashed border-primary/50" onClick={handleCreateQuickProject}>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
                              <Target className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">Quick Project</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Planning-only project that cannot advance beyond planning phase
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {isLoadingAvailable ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-20" />
                      ))
                    ) : (
                      unassignedElements.map((element) => (
                        <ElementCard
                          key={element.id}
                          element={element}
                          variant="compact"
                          showActions={false}
                          showMetrics={false}
                          interactive={false}
                          className="cursor-pointer hover:bg-accent"
                          onClick={() => handleAddElement(element.id)}
                        />
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectElements.length === 0 ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4" />
                <p>No elements assigned to this project yet.</p>
              </div>
            ) : (
              projectElements.map((element) => (
                <ElementCard
                  key={element.elementId}
                  element={element.element}
                  variant="compact"
                  showActions={editable}
                  onEdit={() => openEditDialog(element)}
                  className="relative"
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)} data-testid={`project-elements-${project.id}`}>
      <DataTable
        columns={columns}
        data={projectElements}
        title="Project Elements"
        description={`${projectElements.length} building elements assigned to this project`}
        isLoading={isLoadingElements}
        searchPlaceholder="Search elements..."
        searchableColumn="elementName"
        enableRowSelection={editable}
        enableFiltering={true}
        enableSorting={true}
        enableColumnVisibility={true}
        enablePagination={true}
        pageSize={10}
        bulkActions={bulkActions}
        onSelectionChange={setSelectedElements}
        onRowClick={(row) => onElementClick?.(row.original.element)}
        emptyState={{
          title: "No Elements Assigned",
          description: "No building elements have been assigned to this project yet.",
          icon: Building2,
        }}
        getRowId={(row) => row.id}
        className="bg-card"
      />

      {/* Add Element Button for Table View */}
      {editable && hasPermission('canEditMaintenance') && (
        <div className="flex justify-end">
          <Dialog open={isAddElementOpen} onOpenChange={setIsAddElementOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-element-button">
                <Plus className="h-4 w-4 mr-2" />
                Add Element
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Building Elements</DialogTitle>
                <DialogDescription>
                  Select building elements to include in this project and optionally set cost allocation and work details.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Work Description</label>
                    <Textarea
                      placeholder="Describe the work to be done on these elements..."
                      value={workDescription}
                      onChange={(e) => setWorkDescription(e.target.value)}
                      rows={3}
                      data-testid="input-work-description"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Cost Allocation ($)</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      value={costAllocation}
                      onChange={(e) => setCostAllocation(e.target.value)}
                      data-testid="input-cost-allocation"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Lifespan Impact (Years)</label>
                    <Input
                      type="number"
                      placeholder="0"
                      min="0"
                      value={lifespanImpact}
                      onChange={(e) => setLifespanImpact(e.target.value)}
                      data-testid="input-lifespan-impact"
                    />
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Available Elements</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                    {/* Quick Project Option - Only in planning phase */}
                    {isInPlanningPhase && !isQuickProject && (
                      <div
                        className="p-3 border-2 border-dashed border-primary/50 rounded-lg cursor-pointer hover:bg-accent transition-colors"
                        onClick={handleCreateQuickProject}
                        data-testid="quick-project-option"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded">
                            <Target className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">Quick Project</div>
                            <div className="text-xs text-muted-foreground">
                              Planning-only project
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {isLoadingAvailable ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-16" />
                      ))
                    ) : unassignedElements.length === 0 && (!isInPlanningPhase || isQuickProject) ? (
                      <div className="col-span-full text-center py-4 text-muted-foreground">
                        <Building2 className="h-8 w-8 mx-auto mb-2" />
                        <p>All available elements are already assigned to this project.</p>
                      </div>
                    ) : (
                      unassignedElements.map((element) => (
                        <div
                          key={element.id}
                          className="p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                          onClick={() => handleAddElement(element.id)}
                          data-testid={`available-element-${element.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-sm">{element.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {element.uniformatCode}
                              </div>
                            </div>
                            <ConditionBadge condition={element.currentCondition} size="sm" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Edit Element Dialog */}
      <Dialog open={isEditCostOpen} onOpenChange={setIsEditCostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Element Details</DialogTitle>
            <DialogDescription>
              Update cost allocation and work details for this element.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Work Description</label>
              <Textarea
                placeholder="Describe the work to be done..."
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                rows={3}
                data-testid="edit-work-description"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Cost Allocation ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  value={costAllocation}
                  onChange={(e) => setCostAllocation(e.target.value)}
                  data-testid="edit-cost-allocation"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Lifespan Impact (Years)</label>
                <Input
                  type="number"
                  placeholder="0"
                  min="0"
                  value={lifespanImpact}
                  onChange={(e) => setLifespanImpact(e.target.value)}
                  data-testid="edit-lifespan-impact"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditCostOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateElement}
              disabled={updateElementMutation.isPending}
              data-testid="save-element-changes"
            >
              {updateElementMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Element Confirmation */}
      <AlertDialog open={!!elementToRemove} onOpenChange={() => setElementToRemove(null)}>
        <AlertDialogContent data-testid="remove-element-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Element</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this element from the project? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => elementToRemove && removeElementMutation.mutate(elementToRemove)}
              disabled={removeElementMutation.isPending}
            >
              {removeElementMutation.isPending ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export type { ProjectElementsProps };