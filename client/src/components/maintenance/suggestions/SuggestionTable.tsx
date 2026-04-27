import { useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCreateUpdateMutation } from '@/lib/common-hooks';
import { ColumnDef, Row } from '@tanstack/react-table';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { DataTable } from '@/components/ui/data-table';
import { PriorityBadge, EvaluationStatusBadge } from '@/components/maintenance/StatusBadges';
import { useBuildingContext } from '@/hooks/use-building-context';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn, parseDateOnly, parseDateOnlyLoose } from '@/lib/utils';
import {
  CheckCircle,
  Clock,
  Calendar,
  DollarSign,
  MoreHorizontal,
  Wrench,
  X,
  Eye,
  Edit2,
  AlertTriangle,
  Building,
  FileDown,
  Users,
  CalendarDays,
  TrendingUp,
  Search,
} from 'lucide-react';
import { SuggestionTableProps, SuggestionWithElement, SuggestionAction, BulkSuggestionAction } from './types';

/**
 * SuggestionTable component for displaying and managing evaluation suggestions
 * Provides comprehensive table with filtering, sorting, and bulk operations
 */
export function SuggestionTable({
  buildingId,
  suggestions: externalSuggestions,
  isLoading: externalLoading = false,
  onSuggestionAction,
  onBulkAction,
  filters,
  onFiltersChange,
  className,
}: SuggestionTableProps) {
  const { hasPermission } = useBuildingContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSuggestions, setSelectedSuggestions] = useState<SuggestionWithElement[]>([]);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkAction, setBulkAction] = useState<BulkSuggestionAction | null>(null);

  // Fetch suggestions if not provided externally
  const {
    data: suggestionsResponse,
    isLoading: isLoadingSuggestions,
    error: suggestionsError,
  } = useQuery({
    queryKey: ['/api/maintenance/suggestions', buildingId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.append('search', filters.search);
      if (filters?.types?.length) params.append('types', filters.types.join(','));
      if (filters?.priorities?.length) params.append('priorities', filters.priorities.join(','));
      if (filters?.statuses?.length) params.append('statuses', filters.statuses.join(','));
      if (filters?.dateRange) {
        params.append('startDate', filters.dateRange.start.toISOString());
        params.append('endDate', filters.dateRange.end.toISOString());
      }
      
      const response = await apiRequest('GET', `/api/maintenance/buildings/${buildingId}/suggestions?${params}`);
      return await response.json();
    },
    enabled: !externalSuggestions && !!buildingId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const suggestions = externalSuggestions || suggestionsResponse?.suggestions || [];
  const isLoading = externalLoading || isLoadingSuggestions;

  // Bulk action mutations
  const bulkAcceptMutation = useCreateUpdateMutation<unknown, string[]>({
    mutationFn: async (suggestionIds: string[]) => {
      const response = await apiRequest('PATCH', `/api/maintenance/suggestions/bulk`, {
        action: 'accept',
        suggestionIds,
        buildingId,
      });
      return response.json();
    },
    successTitle: 'Suggestions Accepted',
    successMessage: () => `${selectedSuggestions.length} suggestions have been accepted.`,
    errorTitle: 'Error',
    errorMessage: 'Failed to accept suggestions. Please try again.',
    queryKeysToInvalidate: [['/api/maintenance/suggestions']],
    onSuccessCallback: () => {
      setSelectedSuggestions([]);
      setShowBulkDialog(false);
    },
  });

  const bulkScheduleMutation = useCreateUpdateMutation<unknown, { suggestionIds: string[]; date: Date }>({
    mutationFn: async (data) => {
      const response = await apiRequest('PATCH', `/api/maintenance/suggestions/bulk`, {
        action: 'schedule',
        suggestionIds: data.suggestionIds,
        scheduledDate: data.date.toISOString(),
        buildingId,
      });
      return response.json();
    },
    successTitle: 'Suggestions Scheduled',
    successMessage: () => `${selectedSuggestions.length} suggestions have been scheduled.`,
    errorTitle: 'Error',
    errorMessage: 'Failed to schedule suggestions. Please try again.',
    queryKeysToInvalidate: [['/api/maintenance/suggestions']],
    onSuccessCallback: () => {
      setSelectedSuggestions([]);
      setShowBulkDialog(false);
    },
  });

  // Table columns definition
  const columns = useMemo<ColumnDef<SuggestionWithElement>[]>(() => [
    // Selection column
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          data-testid="select-all-suggestions"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          data-testid={`select-suggestion-${row.original.id}`}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },

    // Element column
    {
      accessorKey: 'element.name',
      header: 'Element',
      cell: ({ row }) => {
        const element = row.original.element;
        return (
          <div className="space-y-1">
            <div className="font-medium">{element?.name || 'Unknown Element'}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Building className="h-3 w-3" />
              {element?.uniformatCode || 'N/A'}
            </div>
          </div>
        );
      },
    },

    // Suggestion type column
    {
      accessorKey: 'suggestedType',
      header: 'Type',
      cell: ({ row }) => {
        const type = row.getValue('suggestedType') as string;
        const typeColors = {
          inspection: 'bg-blue-100 text-blue-800',
          minor_rehab: 'bg-yellow-100 text-yellow-800',
          major_rehab: 'bg-orange-100 text-orange-800',
          replacement: 'bg-red-100 text-red-800',
        };
        
        return (
          <Badge 
            variant="outline" 
            className={cn("capitalize", typeColors[type as keyof typeof typeColors])}
          >
            {type?.replace('_', ' ')}
          </Badge>
        );
      },
    },

    // Priority column
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => (
        <PriorityBadge priority={row.getValue('priority')} size="sm" />
      ),
    },

    // Urgency column
    {
      id: 'urgency',
      header: 'Urgency',
      cell: ({ row }) => {
        const suggestion = row.original;
        const today = new Date();
        const suggestedDate = parseDateOnlyLoose(suggestion.suggestedDate) ?? new Date();
        const daysUntilDue = Math.ceil((suggestedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        let urgencyLevel = 'low';
        let urgencyColor = 'text-green-600 bg-green-50';
        let urgencyIcon = Clock;
        
        if (daysUntilDue < 0) {
          urgencyLevel = 'overdue';
          urgencyColor = 'text-red-600 bg-red-50';
          urgencyIcon = AlertTriangle;
        } else if (daysUntilDue <= 30) {
          urgencyLevel = 'critical';
          urgencyColor = 'text-red-600 bg-red-50';
          urgencyIcon = AlertTriangle;
        } else if (daysUntilDue <= 60) {
          urgencyLevel = 'high';
          urgencyColor = 'text-orange-600 bg-orange-50';
          urgencyIcon = Clock;
        }

        const UrgencyIcon = urgencyIcon;
        
        return (
          <div className={cn("flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium", urgencyColor)}>
            <UrgencyIcon className="h-3 w-3" />
            {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d overdue` : `${daysUntilDue}d`}
          </div>
        );
      },
    },

    // Cost estimate column
    {
      id: 'costEstimate',
      header: 'Cost Est.',
      cell: ({ row }) => {
        const cost = row.original.costEstimate;
        return cost ? (
          <div className="flex items-center gap-1 text-sm">
            <DollarSign className="h-3 w-3 text-green-600" />
            ${cost.toLocaleString()}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        );
      },
    },

    // Due date column
    {
      accessorKey: 'suggestedDate',
      header: 'Due Date',
      cell: ({ row }) => {
        const raw = row.getValue('suggestedDate') as string;
        const date = parseDateOnlyLoose(raw) ?? new Date();
        return (
          <div className="space-y-1">
            <div className="text-sm font-medium">{format(date, 'MMM d, yyyy')}</div>
            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(date, { addSuffix: true })}
            </div>
          </div>
        );
      },
    },

    // Status column
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <EvaluationStatusBadge status={row.getValue('status')} size="sm" />
      ),
    },

    // Actions column
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const suggestion = row.original;
        
        const handleAction = (action: SuggestionAction) => {
          onSuggestionAction?.(suggestion, action);
        };

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0"
                data-testid={`suggestion-actions-${suggestion.id}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleAction('view_details')}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              
              {hasPermission('canEditMaintenance') && suggestion.status === 'pending' && (
                <>
                  <DropdownMenuItem onClick={() => handleAction('accept')}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Accept
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAction('create_project')}>
                    <Wrench className="h-4 w-4 mr-2" />
                    Create Project
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAction('schedule')}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              
              {hasPermission('canEditMaintenance') && (
                <>
                  <DropdownMenuItem onClick={() => handleAction('edit')}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAction('duplicate')}>
                    <FileDown className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-red-600"
                    onClick={() => handleAction('dismiss')}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Dismiss
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
    },
  ], [hasPermission, onSuggestionAction]);

  // Bulk actions configuration
  const bulkActions = useMemo(() => {
    if (!hasPermission('canEditMaintenance')) return [];

    return [
      {
        label: 'Accept Selected',
        icon: CheckCircle,
        onClick: (selectedRows: Row<SuggestionWithElement>[]) => {
          setSelectedSuggestions(selectedRows.map(row => row.original));
          setBulkAction('accept_multiple');
          setShowBulkDialog(true);
        },
        disabled: (selectedRows: Row<SuggestionWithElement>[]) => 
          selectedRows.every(row => row.original.status !== 'pending'),
      },
      {
        label: 'Bulk Schedule',
        icon: CalendarDays,
        onClick: (selectedRows: Row<SuggestionWithElement>[]) => {
          setSelectedSuggestions(selectedRows.map(row => row.original));
          setBulkAction('bulk_schedule');
          setShowBulkDialog(true);
        },
        disabled: (selectedRows: Row<SuggestionWithElement>[]) => 
          selectedRows.every(row => row.original.status !== 'pending'),
      },
      {
        label: 'Update Priority',
        icon: TrendingUp,
        onClick: (selectedRows: Row<SuggestionWithElement>[]) => {
          setSelectedSuggestions(selectedRows.map(row => row.original));
          setBulkAction('update_priority');
          onBulkAction?.(selectedRows.map(row => row.original), 'update_priority');
        },
      },
      {
        label: 'Export',
        icon: FileDown,
        onClick: (selectedRows: Row<SuggestionWithElement>[]) => {
          onBulkAction?.(selectedRows.map(row => row.original), 'export');
        },
      },
      {
        label: 'Assign Vendor',
        icon: Users,
        onClick: (selectedRows: Row<SuggestionWithElement>[]) => {
          setSelectedSuggestions(selectedRows.map(row => row.original));
          setBulkAction('assign_vendor');
          onBulkAction?.(selectedRows.map(row => row.original), 'assign_vendor');
        },
      },
    ];
  }, [hasPermission, onBulkAction]);

  // Handle bulk action confirmation
  const handleBulkConfirm = useCallback(() => {
    const suggestionIds = selectedSuggestions.map(s => s.id);
    
    switch (bulkAction) {
      case 'accept_multiple':
        bulkAcceptMutation.mutate(suggestionIds);
        break;
      case 'bulk_schedule':
        // For simplicity, schedule for next month
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        bulkScheduleMutation.mutate({ suggestionIds, date: nextMonth });
        break;
      default:
        break;
    }
  }, [bulkAction, selectedSuggestions, bulkAcceptMutation, bulkScheduleMutation]);

  // Handle row selection change
  const handleSelectionChange = useCallback((selectedRows: Row<SuggestionWithElement>[]) => {
    setSelectedSuggestions(selectedRows.map(row => row.original));
  }, []);

  return (
    <>
      <DataTable
        columns={columns}
        data={suggestions}
        title="Evaluation Suggestions"
        description={`Manage maintenance and evaluation suggestions for building elements`}
        isLoading={isLoading}
        searchPlaceholder="Search suggestions..."
        searchableColumn="element.name"
        enableRowSelection={true}
        bulkActions={bulkActions}
        onSelectionChange={handleSelectionChange}
        emptyState={{
          title: "No suggestions found",
          description: "No evaluation suggestions match your current filters. Try adjusting your search criteria.",
          icon: Search,
        }}
        className={cn("w-full", className)}
        data-testid="suggestions-table"
      />

      {/* Bulk Action Confirmation Dialog */}
      <AlertDialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <AlertDialogContent data-testid="bulk-action-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === 'accept_multiple' && 'Accept Selected Suggestions'}
              {bulkAction === 'bulk_schedule' && 'Schedule Selected Suggestions'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === 'accept_multiple' && 
                `Are you sure you want to accept ${selectedSuggestions.length} selected suggestions? This action cannot be undone.`
              }
              {bulkAction === 'bulk_schedule' && 
                `Schedule ${selectedSuggestions.length} selected suggestions for next month? You can adjust dates individually later.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowBulkDialog(false);
                setBulkAction(null);
                setSelectedSuggestions([]);
              }}
              data-testid="cancel-bulk-action"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkConfirm}
              disabled={bulkAcceptMutation.isPending || bulkScheduleMutation.isPending}
              data-testid="confirm-bulk-action"
            >
              {(bulkAcceptMutation.isPending || bulkScheduleMutation.isPending) 
                ? 'Processing...' 
                : 'Confirm'
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}