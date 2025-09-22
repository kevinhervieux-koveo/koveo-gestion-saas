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
import {
  MoreHorizontal,
  Eye,
  Edit2,
  Clock,
  Upload,
  FileText,
  Download,
  Calendar,
  AlertTriangle,
  Building,
  CheckSquare,
  X,
} from 'lucide-react';

interface ElementTableProps {
  className?: string;
  buildingId?: string;
  organizationId?: string;
  onViewElement?: (element: BuildingElement) => void;
  onEditElement?: (element: BuildingElement) => void;
  onAddHistory?: (element: BuildingElement) => void;
  onUploadDocuments?: (element: BuildingElement) => void;
  selectedElements?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  enableBulkActions?: boolean;
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
  onAddHistory,
  onUploadDocuments,
  selectedElements = [],
  onSelectionChange,
  enableBulkActions = true,
}: ElementTableProps) {
  // const { buildingId, hasPermission } = useBuildingContext();
  // Simple permission check - in real implementation this would use proper role-based permissions
  const hasPermission = (permission: string) => true;
  const { toast } = useToast();
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  // Fetch building elements
  const {
    data: elementsResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/maintenance/buildings', buildingId, 'elements'],
    queryFn: async () => {
      if (!buildingId) throw new Error('Building ID required');
      const response = await apiRequest('GET', `/api/maintenance/buildings/${buildingId}/elements`);
      return await response.json();
    },
    enabled: !!buildingId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const elements: BuildingElement[] = elementsResponse?.elements || [];

  // Bulk operations mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ elementIds, updates }: { elementIds: string[]; updates: Partial<BuildingElement> }) => {
      const response = await apiRequest('PATCH', '/api/maintenance/elements/bulk', {
        elementIds,
        updates,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'elements'] });
      setRowSelection({});
      toast({
        title: 'Elements updated',
        description: 'Selected elements have been updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update elements',
        variant: 'destructive',
      });
    },
  });

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
    ];

    return baseColumns;
  }, [calculateElementAge, getEvaluationUrgency, enableBulkActions]);

  // Row actions
  const renderRowActions = useCallback((row: Row<BuildingElement>) => {
    const element = row.original;
    const canEdit = hasPermission('canEditMaintenance');
    const canManageDocuments = hasPermission('canManageDocuments');

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="h-8 w-8 p-0"
            data-testid={`actions-menu-${element.id}`}
          >
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" data-testid={`actions-menu-content-${element.id}`}>
          <DropdownMenuItem 
            onClick={() => onViewElement?.(element)}
            data-testid={`view-element-${element.id}`}
          >
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>
          
          {canEdit && (
            <DropdownMenuItem 
              onClick={() => onEditElement?.(element)}
              data-testid={`edit-element-${element.id}`}
            >
              <Edit2 className="mr-2 h-4 w-4" />
              Edit Element
            </DropdownMenuItem>
          )}
          
          {canEdit && (
            <DropdownMenuItem 
              onClick={() => onAddHistory?.(element)}
              data-testid={`add-history-${element.id}`}
            >
              <Clock className="mr-2 h-4 w-4" />
              Add History Entry
            </DropdownMenuItem>
          )}
          
          {canManageDocuments && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onUploadDocuments?.(element)}
                data-testid={`upload-documents-${element.id}`}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Documents
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }, [hasPermission, onViewElement, onEditElement, onAddHistory, onUploadDocuments]);

  // Bulk actions
  const selectedElementsCount = Object.keys(rowSelection).filter(id => rowSelection[id]).length;
  const selectedElementIds = Object.keys(rowSelection).filter(id => rowSelection[id]);

  const bulkActions = useMemo(() => {
    if (!enableBulkActions || selectedElementsCount === 0) return null;

    const handleBulkConditionUpdate = async (condition: string) => {
      await bulkUpdateMutation.mutateAsync({
        elementIds: selectedElementIds,
        updates: { currentCondition: condition as any },
      });
    };

    const handleBulkExport = () => {
      const selectedElements = elements.filter(el => selectedElementIds.includes(el.id));
      const csvData = selectedElements.map(el => ({
        Name: el.name,
        'UNIFORMAT Code': el.uniformatCode,
        Condition: el.currentCondition,
        'Construction Date': el.originalConstructionDate || '',
        'Original Lifespan': el.originalLifespan || '',
        'Current Lifespan': el.currentLifespan || '',
        'Last Inspection': el.lastInspectionDate || '',
        'Next Evaluation': el.nextEvaluationDate || '',
      }));
      
      const csvContent = [
        Object.keys(csvData[0]).join(','),
        ...csvData.map(row => Object.values(row).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `building-elements-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
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
              <Button variant="outline" size="sm" data-testid="bulk-condition-button">
                <CheckSquare className="h-4 w-4 mr-2" />
                Update Condition
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleBulkConditionUpdate('excellent')}>
                Excellent
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkConditionUpdate('good')}>
                Good
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkConditionUpdate('fair')}>
                Fair
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkConditionUpdate('poor')}>
                Poor
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkConditionUpdate('critical')}>
                Critical
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleBulkExport}
            data-testid="bulk-export-button"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
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
  }, [enableBulkActions, selectedElementsCount, selectedElementIds, elements, bulkUpdateMutation]);

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

  return (
    <div className={cn('space-y-4', className)} data-testid="element-table">
      {bulkActions}
      
      <DataTable
        columns={columns}
        data={elements}
        title="Building Elements"
        description={`Inventory of ${elements.length} building elements and their conditions`}
        isLoading={isLoading}
        searchPlaceholder="Search elements by name or UNIFORMAT code..."
        searchableColumn="name"
        enableFiltering={true}
        enableSorting={true}
        enableColumnVisibility={true}
        enablePagination={true}
        pageSize={25}
        emptyState={{
          title: 'No elements found',
          description: 'No building elements have been added to this building yet. Add your first element to get started.',
          icon: Building,
        }}
        renderRowActions={renderRowActions}
      />
    </div>
  );
}

export type { ElementTableProps };