import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ColumnDef, Row } from '@tanstack/react-table';
import { format, differenceInYears, isAfter, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable } from '@/components/maintenance/DataTable';
import { ConditionBadge } from '@/components/maintenance/StatusBadges';
import { useBuildingContext } from '@/hooks/use-building-context';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { BuildingElement } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import { BulkEditCostDialog } from './BulkEditCostDialog';
import { BulkEditResidenceDialog } from './BulkEditResidenceDialog';
import { useLanguage } from '@/hooks/use-language';
import {
  Eye,
  Edit2,
  Building,
  X,
  Package,
  Trash2,
  AlertTriangle,
  Clock,
  Calendar,
} from 'lucide-react';

interface ElementTableProps {
  className?: string;
  buildingId?: string;
  organizationId?: string;
  onViewElement?: (element: BuildingElement) => void;
  onEditElement?: (element: BuildingElement) => void;
  onViewDocuments?: (element: BuildingElement) => void;
  onDeleteElement?: (element: BuildingElement) => void;
  selectedElements?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  enableBulkActions?: boolean;
  // Filter props
  searchTerm?: string;
  conditionFilter?: string;
  uniformatFilter?: string;
  showOverdueOnly?: boolean;
}

/**
 * ElementTable component for displaying building elements inventory
 * Features comprehensive filtering, sorting, and bulk operations
 */
export function ElementTable({
  className,
  buildingId,
  organizationId,
  onViewElement,
  onEditElement,
  onViewDocuments,
  onDeleteElement,
  selectedElements = [],
  onSelectionChange,
  enableBulkActions = true,
  searchTerm = '',
  conditionFilter = '',
  uniformatFilter = '',
  showOverdueOnly = false,
}: ElementTableProps) {
  const { t } = useLanguage();
  // const { buildingId, hasPermission } = useBuildingContext();
  // Simple permission check - in real implementation this would use proper role-based permissions
  const hasPermission = (permission: string) => true;
  
  // Define permission flags used in JSX
  const canEdit = hasPermission('canEditMaintenance');
  const canManageDocuments = hasPermission('canManageDocuments');
  const { toast } = useToast();
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [residenceDialogOpen, setResidenceDialogOpen] = useState(false);

  // Delete element mutation
  const deleteElementMutation = useMutation({
    mutationFn: async (elementId: string) => {
      if (!buildingId) {
        throw new Error('Building ID is required for deleting elements');
      }
      const response = await apiRequest('DELETE', `/api/maintenance/elements/${elementId}`);
      // Only parse JSON if response has content (not 204 No Content)
      if (response.status !== 204 && response.headers.get('content-type')?.includes('application/json')) {
        return await response.json();
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'elements'] });
      // Also invalidate the inventory overview data
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings'] });
      toast({
        title: 'Element deleted',
        description: 'The building element has been removed successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete building element',
        variant: 'destructive',
      });
    },
  });

  // Fetch building elements
  const { data: elementsData, isLoading, error } = useQuery({
    queryKey: ['/api/maintenance/buildings', buildingId, 'elements'],
    queryFn: async () => {
      if (!buildingId) return { data: [] };
      const response = await apiRequest('GET', `/api/maintenance/buildings/${buildingId}/elements`);
      return await response.json();
    },
    enabled: !!buildingId,
  });

  const allElements: BuildingElement[] = elementsData?.data || [];

  // Fetch UNIFORMAT codes for synonym search
  const { data: uniformatData } = useQuery({
    queryKey: ['/api/maintenance/uniformat'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/maintenance/uniformat');
      return await response.json();
    },
    staleTime: 30 * 60 * 1000,
  });

  // Create a map of UNIFORMAT codes to their synonyms for efficient lookup
  const uniformatSynonymsMap = useMemo(() => {
    const map = new Map<string, { synonymsEn?: string[]; synonymsFr?: string[] }>();
    const codes = uniformatData?.data || [];
    codes.forEach((code: any) => {
      if (code.synonymsEn || code.synonymsFr) {
        map.set(code.code, { synonymsEn: code.synonymsEn, synonymsFr: code.synonymsFr });
      }
    });
    return map;
  }, [uniformatData]);

  // Calculate element age and urgency
  const calculateElementAge = useCallback((constructionDate: string | null): number => {
    if (!constructionDate) return 0;
    return differenceInYears(new Date(), parseISO(constructionDate));
  }, []);

  const getEvaluationUrgency = useCallback((nextEvaluationDate: string | null): 'overdue' | 'due-soon' | 'scheduled' | 'none' => {
    if (!nextEvaluationDate) return 'none';
    
    const evaluationDate = parseISO(nextEvaluationDate);
    const today = new Date();
    const in30Days = new Date();
    in30Days.setDate(today.getDate() + 30);

    if (isAfter(today, evaluationDate)) return 'overdue';
    if (isAfter(evaluationDate, today) && isAfter(in30Days, evaluationDate)) return 'due-soon';
    return 'scheduled';
  }, []);

  // Apply filtering logic
  const elements = useMemo(() => {
    let filteredElements = allElements;

    // Search filter - includes element name, code, description, and UNIFORMAT synonyms
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filteredElements = filteredElements.filter(element => {
        // Direct matches on element properties
        if (element.name.toLowerCase().includes(searchLower) ||
            element.uniformatCode.toLowerCase().includes(searchLower) ||
            element.description?.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        // Check UNIFORMAT synonyms for this element's code
        const synonyms = uniformatSynonymsMap.get(element.uniformatCode);
        if (synonyms) {
          const matchesEnglishSynonym = synonyms.synonymsEn?.some(
            syn => syn.toLowerCase().includes(searchLower)
          );
          const matchesFrenchSynonym = synonyms.synonymsFr?.some(
            syn => syn.toLowerCase().includes(searchLower)
          );
          if (matchesEnglishSynonym || matchesFrenchSynonym) {
            return true;
          }
        }
        
        return false;
      });
    }

    // Condition filter
    if (conditionFilter && conditionFilter !== 'all') {
      filteredElements = filteredElements.filter(element => 
        element.currentCondition === conditionFilter
      );
    }

    // UNIFORMAT filter
    if (uniformatFilter && uniformatFilter !== 'all') {
      filteredElements = filteredElements.filter(element => 
        element.uniformatCode.startsWith(uniformatFilter)
      );
    }

    // Overdue evaluation filter
    if (showOverdueOnly) {
      filteredElements = filteredElements.filter(element => {
        if (!element.nextEvaluationDate) return false;
        const urgency = getEvaluationUrgency(element.nextEvaluationDate);
        return urgency === 'overdue';
      });
    }

    return filteredElements;
  }, [allElements, searchTerm, conditionFilter, uniformatFilter, showOverdueOnly, getEvaluationUrgency, uniformatSynonymsMap]);

  // Row selection handling
  const handleRowSelection = useCallback((updater: any) => {
    const newSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
    setRowSelection(newSelection);
    
    const selectedIds = Object.keys(newSelection).filter(id => newSelection[id]);
    onSelectionChange?.(selectedIds);
  }, [rowSelection, onSelectionChange]);

  // Table columns configuration
  const columns = useMemo<ColumnDef<BuildingElement>[]>(() => {
    const baseColumns: ColumnDef<BuildingElement>[] = [
      // Selection column for bulk actions
      ...(enableBulkActions ? [{
        id: 'select',
        header: ({ table }: any) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all elements"
            data-testid="select-all-checkbox"
          />
        ),
        cell: ({ row }: any) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select element"
            data-testid={`select-element-${row.original.id}`}
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 50,
      }] : []),

      // Element name and UNIFORMAT code
      {
        accessorKey: 'name',
        header: 'Element',
        cell: ({ row }) => {
          const element = row.original;
          return (
            <div className="space-y-1 min-w-0" data-testid={`element-name-${element.id}`}>
              <div className="font-medium truncate">{element.name}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {element.uniformatCode}
                </Badge>
                {element.description && (
                  <span className="truncate">{element.description}</span>
                )}
              </div>
            </div>
          );
        },
        enableSorting: true,
        sortingFn: 'alphanumeric',
      },

      // Current condition
      {
        accessorKey: 'currentCondition',
        header: 'Condition',
        cell: ({ row }) => {
          const condition = row.original.currentCondition;
          return (
            <ConditionBadge 
              condition={condition} 
              size="sm"
              data-testid={`condition-${row.original.id}`}
            />
          );
        },
        enableSorting: true,
        filterFn: (row, id, value) => {
          return value.includes(row.getValue(id));
        },
      },

      // Age and lifespan
      {
        id: 'age',
        header: 'Age / Lifespan',
        cell: ({ row }) => {
          const element = row.original;
          const age = calculateElementAge(element.originalConstructionDate);
          const originalLifespan = element.originalLifespan;
          const currentLifespan = element.currentLifespan || originalLifespan;
          
          const progressPercentage = originalLifespan ? Math.min((age / originalLifespan) * 100, 100) : 0;
          const isNearingEnd = progressPercentage > 80;
          
          return (
            <div className="space-y-1 min-w-0" data-testid={`age-${element.id}`}>
              <div className="text-sm font-medium">
                {age} / {currentLifespan || originalLifespan || '—'} years
              </div>
              {originalLifespan && (
                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all",
                      isNearingEnd ? "bg-red-500" : progressPercentage > 60 ? "bg-yellow-500" : "bg-green-500"
                    )}
                    style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                  />
                </div>
              )}
            </div>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const ageA = calculateElementAge(rowA.original.originalConstructionDate);
          const ageB = calculateElementAge(rowB.original.originalConstructionDate);
          return ageA - ageB;
        },
      },

      // Last inspection
      {
        accessorKey: 'lastInspectionDate',
        header: 'Last Inspection',
        cell: ({ row }) => {
          const date = row.original.lastInspectionDate;
          if (!date) {
            return (
              <Badge variant="outline" className="text-muted-foreground">
                Never
              </Badge>
            );
          }
          
          const inspectionDate = parseISO(date);
          const daysSince = differenceInYears(new Date(), inspectionDate) * 365 + 
                           (new Date().getTime() - inspectionDate.getTime()) / (1000 * 60 * 60 * 24);
          const isOld = daysSince > 365; // More than 1 year
          
          return (
            <div className="space-y-1" data-testid={`last-inspection-${row.original.id}`}>
              <div className="text-sm">{format(inspectionDate, 'MMM d, yyyy')}</div>
              {isOld && (
                <Badge variant="outline" className="text-xs text-orange-600">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Overdue
                </Badge>
              )}
            </div>
          );
        },
        enableSorting: true,
        sortingFn: 'datetime',
      },

      // Next evaluation
      {
        accessorKey: 'nextEvaluationDate',
        header: 'Next Evaluation',
        cell: ({ row }) => {
          const date = row.original.nextEvaluationDate;
          if (!date) {
            return (
              <Badge variant="outline" className="text-muted-foreground">
                Not scheduled
              </Badge>
            );
          }
          
          const urgency = getEvaluationUrgency(date);
          const evaluationDate = parseISO(date);
          
          const urgencyConfig = {
            overdue: { variant: 'destructive' as const, icon: AlertTriangle, label: 'Overdue' },
            'due-soon': { variant: 'outline' as const, icon: Clock, label: 'Due Soon' },
            scheduled: { variant: 'secondary' as const, icon: Calendar, label: 'Scheduled' },
            none: { variant: 'outline' as const, icon: Calendar, label: 'Not Set' },
          };
          
          const config = urgencyConfig[urgency];
          
          return (
            <div className="space-y-1" data-testid={`next-evaluation-${row.original.id}`}>
              <div className="text-sm">{format(evaluationDate, 'MMM d, yyyy')}</div>
              <Badge variant={config.variant} className="text-xs">
                <config.icon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
            </div>
          );
        },
        enableSorting: true,
        sortingFn: 'datetime',
      },

      // Actions column
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => renderRowActions(row),
        enableSorting: false,
        size: 60,
      },
    ];

    return baseColumns;
  }, [calculateElementAge, getEvaluationUrgency, enableBulkActions]);

  // Row actions
  const renderRowActions = useCallback((row: Row<BuildingElement>) => {
    const element = row.original;

    return (
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => onViewElement?.(element)}
          data-testid={`view-element-${element.id}`}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
        {canEdit && onEditElement && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onEditElement(element)}
            data-testid={`edit-element-${element.id}`}
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Edit
          </Button>
        )}
      </div>
    );
  }, [onViewElement, onEditElement, canEdit]);

  // Bulk actions - row selection keys are element IDs directly
  const selectedElementsCount = Object.keys(rowSelection).filter(id => rowSelection[id]).length;
  const selectedElementIds = Object.keys(rowSelection).filter(id => rowSelection[id]);

  const bulkActions = useMemo(() => {
    if (!enableBulkActions || selectedElementsCount === 0) return null;

    const handleBulkDelete = async () => {
      if (!confirm(`Are you sure you want to delete ${selectedElementsCount} element(s)? This action cannot be undone.`)) {
        return;
      }
      
      const results = [];
      let successCount = 0;
      let failCount = 0;
      
      for (const elementId of selectedElementIds) {
        try {
          await deleteElementMutation.mutateAsync(elementId);
          successCount++;
        } catch (error: any) {
          failCount++;
          console.error(`Failed to delete element ${elementId}:`, error);
          results.push({ elementId, error: error.message || 'Unknown error' });
        }
      }
      
      setRowSelection({});
      
      if (failCount === 0) {
        toast({
          title: 'Elements deleted',
          description: `Successfully deleted ${successCount} element(s)`,
        });
      } else if (successCount > 0) {
        toast({
          title: 'Partially completed',
          description: `Deleted ${successCount} elements, failed to delete ${failCount} elements`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Delete failed',
          description: `Failed to delete all ${failCount} elements. Please try again.`,
          variant: 'destructive',
        });
      }
    };

    const handleResidenceAssignment = () => {
      setResidenceDialogOpen(true);
    };

    const handleCostUpdate = () => {
      setCostDialogOpen(true);
    };

    return (
      <div className="flex items-center gap-2 p-4 bg-muted/50 border rounded-lg">
        <div className="flex-1">
          <p className="text-sm font-medium">
            {selectedElementsCount} element(s) selected
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                data-testid="bulk-edit-button"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Bulk Edit
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleResidenceAssignment}>
                <Building className="h-4 w-4 mr-2" />
                Change Residence Assignment
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCostUpdate}>
                <Package className="h-4 w-4 mr-2" />
                Update Cost
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleBulkDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setRowSelection({})}
            data-testid="clear-selection-button"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }, [enableBulkActions, selectedElementsCount, selectedElementIds, elements]);

  // Error state
  if (error) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Failed to load elements</h3>
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : 'An error occurred while loading building elements'}
        </p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full mx-auto mb-4" />
        <p className="text-muted-foreground">Loading building elements...</p>
      </div>
    );
  }

  // Empty state - no elements to display
  if (!elements.length) {
    return (
      <div className={cn('space-y-4', className)} data-testid="element-table">
        <div className="p-8 text-center space-y-4">
          <Package className="h-12 w-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-semibold mb-2">No Elements Found</h3>
            {/* eslint-disable-next-line i18n/no-untranslated-jsx-strings -- pre-existing untranslated string (task #708): translate in a follow-up */}
            <p className="text-muted-foreground">
              {t('startBuildingYourInventoryByAdding')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main table rendering
  return (
    <div className={cn('space-y-4', className)} data-testid="element-table">
      {enableBulkActions && selectedElementsCount > 0 && bulkActions}
      
      <DataTable 
        data={elements}
        columns={columns}
        rowSelection={rowSelection}
        onRowSelectionChange={handleRowSelection}
        enableRowSelection={true}
        getRowId={(row) => row.id}
        enablePagination={true}
        enableSorting={true}
        enableFiltering={false}
      />

      {/* Bulk Edit Dialogs */}
      {buildingId && (
        <>
          <BulkEditCostDialog
            isOpen={costDialogOpen}
            onOpenChange={setCostDialogOpen}
            selectedElementIds={selectedElementIds}
            buildingId={buildingId}
            onSuccess={() => setRowSelection({})}
          />
          <BulkEditResidenceDialog
            isOpen={residenceDialogOpen}
            onOpenChange={setResidenceDialogOpen}
            selectedElementIds={selectedElementIds}
            buildingId={buildingId}
            onSuccess={() => setRowSelection({})}
          />
        </>
      )}
    </div>
  );
}

export type { ElementTableProps };