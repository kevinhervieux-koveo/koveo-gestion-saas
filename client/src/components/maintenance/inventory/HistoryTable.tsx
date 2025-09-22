import { useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ColumnDef, Row } from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { DataTable } from '@/components/maintenance/DataTable';
// import { useBuildingContext } from '@/hooks/use-building-context';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { BuildingElement } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import {
  MoreHorizontal,
  Edit2,
  Trash2,
  FileText,
  DollarSign,
  Calendar,
  Wrench,
  Building,
  TrendingUp,
  AlertTriangle,
  Clock,
  User,
} from 'lucide-react';

interface ElementHistoryEntry {
  id: string;
  elementId: string;
  eventType: 'construction' | 'repair' | 'minor_rehab' | 'major_rehab' | 'replacement';
  eventDate: string;
  vendorId?: string;
  vendorName?: string;
  cost?: number;
  warranty?: {
    duration?: number;
    terms?: string;
    expiryDate?: string;
  };
  lifespanImpact?: number;
  workDescription: string;
  createdBy: string;
  createdAt: string;
}

interface HistoryTableProps {
  element: BuildingElement;
  className?: string;
  onEditHistory?: (entry: ElementHistoryEntry) => void;
  onViewDocuments?: (entry: ElementHistoryEntry) => void;
  showSummary?: boolean;
  compact?: boolean;
  buildingId?: string;
  organizationId?: string;
}

/**
 * HistoryTable component for displaying element maintenance history
 * Shows all work performed with costs, vendors, and impact analysis
 */
export function HistoryTable({
  element,
  className,
  onEditHistory,
  onViewDocuments,
  showSummary = true,
  compact = false,
  buildingId,
  organizationId,
}: HistoryTableProps) {
  // Simplified placeholder - no context for now
  const hasPermission = () => true;
  const { toast } = useToast();

  // Fetch element history
  const {
    data: historyResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/maintenance/elements', element.id, 'history'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/elements/${element.id}/history`);
      return await response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const history: ElementHistoryEntry[] = historyResponse?.history || [];

  // Delete history entry mutation
  const deleteHistoryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const response = await apiRequest('DELETE', `/api/maintenance/elements/${element.id}/history/${entryId}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/elements', element.id, 'history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings'] }); // Refresh element data
      toast({
        title: 'History entry deleted',
        description: 'The history entry has been removed successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete history entry',
        variant: 'destructive',
      });
    },
  });

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const totalCost = history.reduce((sum, entry) => sum + (entry.cost || 0), 0);
    const totalLifespanImpact = history.reduce((sum, entry) => sum + (entry.lifespanImpact || 0), 0);
    const eventCounts = history.reduce((counts, entry) => {
      counts[entry.eventType] = (counts[entry.eventType] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const latestEntry = history.length > 0 ? history[0] : null; // Assuming sorted by date desc
    const averageCostPerYear = history.length > 0 && element.originalConstructionDate 
      ? totalCost / (new Date().getFullYear() - new Date(element.originalConstructionDate).getFullYear() || 1)
      : 0;

    return {
      totalCost,
      totalLifespanImpact,
      eventCounts,
      latestEntry,
      averageCostPerYear,
      entryCount: history.length,
    };
  }, [history, element.originalConstructionDate]);

  // Event type badge configurations
  const getEventTypeBadge = useCallback((eventType: string) => {
    const configs = {
      construction: { variant: 'secondary' as const, icon: Building, label: 'Construction' },
      repair: { variant: 'outline' as const, icon: Wrench, label: 'Repair' },
      minor_rehab: { variant: 'default' as const, icon: TrendingUp, label: 'Minor Rehab' },
      major_rehab: { variant: 'destructive' as const, icon: TrendingUp, label: 'Major Rehab' },
      replacement: { variant: 'secondary' as const, icon: Building, label: 'Replacement' },
    };

    const config = configs[eventType as keyof typeof configs] || configs.repair;
    
    return (
      <Badge variant={config.variant} className="text-xs">
        <config.icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  }, []);

  // Table columns configuration
  const columns = useMemo<ColumnDef<ElementHistoryEntry>[]>(() => [
    {
      accessorKey: 'eventDate',
      header: 'Date',
      cell: ({ row }) => {
        const date = parseISO(row.original.eventDate);
        return (
          <div className="space-y-1" data-testid={`history-date-${row.original.id}`}>
            <div className="font-medium">{format(date, 'MMM d, yyyy')}</div>
            <div className="text-xs text-muted-foreground">{format(date, 'EEEE')}</div>
          </div>
        );
      },
      enableSorting: true,
      sortingFn: 'datetime',
    },

    {
      accessorKey: 'eventType',
      header: 'Event Type',
      cell: ({ row }) => getEventTypeBadge(row.original.eventType),
      enableSorting: true,
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },

    {
      accessorKey: 'workDescription',
      header: 'Description',
      cell: ({ row }) => {
        const description = row.original.workDescription;
        const lifespanImpact = row.original.lifespanImpact;
        
        return (
          <div className="space-y-1 max-w-xs" data-testid={`history-description-${row.original.id}`}>
            <div className="text-sm font-medium line-clamp-2">{description}</div>
            {lifespanImpact && lifespanImpact > 0 && (
              <Badge variant="outline" className="text-xs text-green-600">
                +{lifespanImpact} years
              </Badge>
            )}
          </div>
        );
      },
      enableSorting: false,
    },

    {
      accessorKey: 'vendorName',
      header: 'Vendor',
      cell: ({ row }) => {
        const vendorName = row.original.vendorName;
        return vendorName ? (
          <div className="flex items-center gap-1" data-testid={`history-vendor-${row.original.id}`}>
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm">{vendorName}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Internal</span>
        );
      },
      enableSorting: true,
    },

    {
      accessorKey: 'cost',
      header: 'Cost',
      cell: ({ row }) => {
        const cost = row.original.cost;
        return cost ? (
          <div className="flex items-center gap-1 font-medium" data-testid={`history-cost-${row.original.id}`}>
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span>${cost.toLocaleString()}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No cost</span>
        );
      },
      enableSorting: true,
      sortingFn: 'alphanumeric',
    },

    {
      accessorKey: 'warranty',
      header: 'Warranty',
      cell: ({ row }) => {
        const warranty = row.original.warranty;
        if (!warranty || !warranty.duration) {
          return <span className="text-xs text-muted-foreground">None</span>;
        }
        
        const expiryDate = warranty.expiryDate ? parseISO(warranty.expiryDate) : null;
        const isExpired = expiryDate && expiryDate < new Date();
        
        return (
          <div className="space-y-1" data-testid={`history-warranty-${row.original.id}`}>
            <Badge 
              variant={isExpired ? 'outline' : 'secondary'} 
              className={cn('text-xs', isExpired && 'text-red-600')}
            >
              {warranty.duration} {warranty.duration === 1 ? 'year' : 'years'}
            </Badge>
            {expiryDate && (
              <div className="text-xs text-muted-foreground">
                Until {format(expiryDate, 'MMM yyyy')}
              </div>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
  ], [getEventTypeBadge]);

  // Row actions
  const renderRowActions = useCallback((row: Row<ElementHistoryEntry>) => {
    const entry = row.original;
    const canEdit = hasPermission('canEditMaintenance');

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="h-8 w-8 p-0"
            data-testid={`history-actions-${entry.id}`}
          >
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem 
              onClick={() => onEditHistory?.(entry)}
              data-testid={`edit-history-${entry.id}`}
            >
              <Edit2 className="mr-2 h-4 w-4" />
              Edit Entry
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem 
            onClick={() => onViewDocuments?.(entry)}
            data-testid={`view-documents-${entry.id}`}
          >
            <FileText className="mr-2 h-4 w-4" />
            View Documents
          </DropdownMenuItem>
          
          {canEdit && (
            <>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => e.preventDefault()}
                    data-testid={`delete-history-${entry.id}`}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Entry
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete History Entry</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this history entry? This action cannot be undone 
                      and may affect element lifespan calculations.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteHistoryMutation.mutate(entry.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }, [hasPermission, onEditHistory, onViewDocuments, deleteHistoryMutation]);

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to load history</h3>
          <p className="text-muted-foreground">
            {error instanceof Error ? error.message : 'An error occurred while loading element history'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)} data-testid="history-table">
      {/* Summary metrics */}
      {showSummary && !compact && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Cost</p>
                  <p className="text-2xl font-bold">${summaryMetrics.totalCost.toLocaleString()}</p>
                  {summaryMetrics.averageCostPerYear > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ${summaryMetrics.averageCostPerYear.toLocaleString()}/year avg
                    </p>
                  )}
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Lifespan Extension</p>
                  <p className="text-2xl font-bold">+{summaryMetrics.totalLifespanImpact} years</p>
                  <p className="text-xs text-muted-foreground">
                    From {summaryMetrics.entryCount} interventions
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Last Maintenance</p>
                  <p className="text-2xl font-bold">
                    {summaryMetrics.latestEntry 
                      ? format(parseISO(summaryMetrics.latestEntry.eventDate), 'MMM yyyy')
                      : 'Never'
                    }
                  </p>
                  {summaryMetrics.latestEntry && (
                    <p className="text-xs text-muted-foreground">
                      {summaryMetrics.latestEntry.eventType.replace('_', ' ')}
                    </p>
                  )}
                </div>
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Work Events</p>
                  <p className="text-2xl font-bold">{summaryMetrics.entryCount}</p>
                  <div className="flex gap-1 mt-1">
                    {Object.entries(summaryMetrics.eventCounts).map(([type, count]) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {count}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Wrench className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* History table */}
      <DataTable
        columns={columns}
        data={history}
        title={compact ? undefined : "Maintenance History"}
        description={compact ? undefined : `Complete history of work performed on ${element.name}`}
        isLoading={isLoading}
        searchPlaceholder="Search by description, vendor, or event type..."
        searchableColumn="workDescription"
        enableFiltering={true}
        enableSorting={true}
        enableColumnVisibility={!compact}
        enablePagination={!compact}
        pageSize={compact ? 5 : 10}
        emptyState={{
          title: 'No history found',
          description: 'No maintenance work has been recorded for this element yet.',
          icon: Clock,
        }}
        renderRowActions={renderRowActions}
        className={compact ? 'border-none shadow-none' : ''}
      />
    </div>
  );
}

export type { HistoryTableProps, ElementHistoryEntry };