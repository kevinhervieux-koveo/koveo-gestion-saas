// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import { useMemo, useCallback, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ColumnDef, Row } from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { fr as frLocale, enUS } from 'date-fns/locale';
import { parseDateOnly } from '@/lib/utils';
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
import { useLanguage } from '@/hooks/use-language';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  Pencil,
} from 'lucide-react';
import { HistoryEditDiffDialog } from './HistoryEditDiffDialog';

interface ElementHistoryEntry {
  id: string;
  elementId?: string;
  eventType: 'construction' | 'repair' | 'minor_rehab' | 'major_rehab' | 'replacement';
  eventDate: string;
  vendorId?: string;
  vendorName?: string;
  cost?: number | string | null;
  warranty?: {
    duration?: number;
    terms?: string;
    expiryDate?: string;
    endDate?: string;
  } | null;
  lifespanImpact?: number | null;
  workDescription: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string | null;
  editedBy?: string | null;
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
  const { t, language } = useLanguage();
  const dateFnsLocale = language === 'fr' ? frLocale : enUS;
  // Simplified placeholder - no context for now
  const hasPermission = () => true;
  const { toast } = useToast();

  const [auditEntry, setAuditEntry] = useState<{ id: string; eventType: string; eventDate: string } | null>(null);

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

  const history: ElementHistoryEntry[] = historyResponse?.data || historyResponse?.history || [];

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
        title: t('htHistoryEntryDeletedTitle'),
        description: t('htHistoryEntryDeletedDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('htDeleteFailedTitle'),
        description: error.message || t('htDeleteFailedDesc'),
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
    // Use parseDateOnly so the construction year is read in local time, not UTC midnight
    const constructionYear = element.originalConstructionDate
      ? (parseDateOnly(element.originalConstructionDate)?.getFullYear() ?? new Date().getFullYear())
      : null;
    const averageCostPerYear = history.length > 0 && constructionYear
      ? totalCost / (new Date().getFullYear() - constructionYear || 1)
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
      construction: { variant: 'secondary' as const, icon: Building, label: t('htConstructionEventLabel') },
      repair: { variant: 'outline' as const, icon: Wrench, label: t('htRepairEventLabel') },
      minor_rehab: { variant: 'default' as const, icon: TrendingUp, label: t('htMinorRehabEventLabel') },
      major_rehab: { variant: 'destructive' as const, icon: TrendingUp, label: t('htMajorRehabEventLabel') },
      replacement: { variant: 'secondary' as const, icon: Building, label: t('htReplacementEventLabel') },
    };

    const config = configs[eventType as keyof typeof configs] || configs.repair;
    
    return (
      <Badge variant={config.variant} className="text-xs">
        <config.icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  }, [t]);

  // Table columns configuration
  const columns = useMemo<ColumnDef<ElementHistoryEntry>[]>(() => [
    {
      accessorKey: 'eventDate',
      header: t('htDateColumn'),
      cell: ({ row }) => {
        // parseDateOnly parses YYYY-MM-DD in local time (not UTC midnight) to avoid
        // the off-by-one day shift in negative-offset timezones like America/Montreal.
        const date = parseDateOnly(row.original.eventDate);
        if (!date) {
          return (
            <div className="space-y-1" data-testid={`history-date-${row.original.id}`}>
              <div className="font-medium">—</div>
            </div>
          );
        }
        const datePattern = language === 'fr' ? 'd MMMM yyyy' : 'MMM d, yyyy';
        const updatedAt = row.original.updatedAt;
        const editedBy = row.original.editedBy;
        const editedLabel = updatedAt
          ? editedBy
            ? `Edited ${format(parseISO(updatedAt), datePattern, { locale: dateFnsLocale })} by ${editedBy}`
            : `Edited ${format(parseISO(updatedAt), datePattern, { locale: dateFnsLocale })}`
          : null;
        return (
          <div className="space-y-1" data-testid={`history-date-${row.original.id}`}>
            <div className="font-medium">{format(date, datePattern, { locale: dateFnsLocale })}</div>
            <div className="text-xs text-muted-foreground">{format(date, 'EEEE', { locale: dateFnsLocale })}</div>
            {editedLabel && (
              <span data-testid={`history-edited-${row.original.id}`}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                      data-testid={`history-audit-trigger-${row.original.id}`}
                      aria-label={t('htAuditViewChanges')}
                      onClick={() => setAuditEntry({
                        id: row.original.id,
                        eventType: row.original.eventType,
                        eventDate: row.original.eventDate,
                      })}
                    >
                      <Pencil className="h-2.5 w-2.5" />
                      <span>{t('htAuditEditedIndicator')}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{editedLabel}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              </span>
            )}
          </div>
        );
      },
      enableSorting: true,
      sortingFn: 'datetime',
    },

    {
      accessorKey: 'eventType',
      header: t('htEventTypeColumn'),
      cell: ({ row }) => getEventTypeBadge(row.original.eventType),
      enableSorting: true,
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },

    {
      accessorKey: 'workDescription',
      header: t('htDescriptionColumn'),
      cell: ({ row }) => {
        const description = row.original.workDescription;
        const lifespanImpact = row.original.lifespanImpact;
        
        return (
          <div className="space-y-1 max-w-xs" data-testid={`history-description-${row.original.id}`}>
            <div className="text-sm font-medium line-clamp-2">{description}</div>
            {lifespanImpact && lifespanImpact > 0 && (
              <Badge variant="outline" className="text-xs text-green-600">
                +{lifespanImpact} {t('htWarrantyYearsSuffix')}
              </Badge>
            )}
          </div>
        );
      },
      enableSorting: false,
    },

    {
      accessorKey: 'vendorName',
      header: t('htVendorColumn'),
      cell: ({ row }) => {
        const vendorName = row.original.vendorName;
        return vendorName ? (
          <div className="flex items-center gap-1" data-testid={`history-vendor-${row.original.id}`}>
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm">{vendorName}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{t('htInternalLabel')}</span>
        );
      },
      enableSorting: true,
    },

    {
      accessorKey: 'cost',
      header: t('htCostColumn'),
      cell: ({ row }) => {
        const cost = row.original.cost;
        return cost ? (
          <div className="flex items-center gap-1 font-medium" data-testid={`history-cost-${row.original.id}`}>
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span>${cost.toLocaleString()}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{t('htNoCostLabel')}</span>
        );
      },
      enableSorting: true,
      sortingFn: 'alphanumeric',
    },

    {
      accessorKey: 'warranty',
      header: t('htWarrantyColumn'),
      cell: ({ row }) => {
        const warranty = row.original.warranty;
        if (!warranty || !warranty.duration) {
          return <span className="text-xs text-muted-foreground">{t('htWarrantyNoneLabel')}</span>;
        }
        
        // parseDateOnly parses YYYY-MM-DD in local time, avoiding the
        // UTC-midnight off-by-one in negative-offset timezones (e.g.
        // America/Montreal). Do not replace with parseISO — see task
        // #1146 / #1151.
        const expiryDate = warranty.expiryDate ? parseDateOnly(warranty.expiryDate) : null;
        const isExpired = expiryDate && expiryDate < new Date();

        return (
          <div className="space-y-1" data-testid={`history-warranty-${row.original.id}`}>
            <Badge
              variant={isExpired ? 'outline' : 'secondary'}
              className={cn('text-xs', isExpired && 'text-red-600')}
            >
              {warranty.duration} {warranty.duration === 1 ? t('htWarrantyYearSuffix') : t('htWarrantyYearsSuffix')}
            </Badge>
            {expiryDate && (
              <div
                className="text-xs text-muted-foreground"
                data-testid={`history-warranty-expiry-${row.original.id}`}
              >
                {t('htWarrantyUntilPrefix')} {format(expiryDate, 'MMM yyyy', { locale: dateFnsLocale })}
              </div>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
  ], [getEventTypeBadge, t, language, dateFnsLocale]);

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
            <span className="sr-only">{t('htOpenMenu')}</span>
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
              {t('htEditEntry')}
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem 
            onClick={() => onViewDocuments?.(entry)}
            data-testid={`view-documents-${entry.id}`}
          >
            <FileText className="mr-2 h-4 w-4" />
            {t('htViewDocuments')}
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
                    {t('htDeleteEntry')}
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('htDeleteHistoryTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('areYouSureYouWantTo3')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('htCancelButton')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteHistoryMutation.mutate(entry.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t('htDeleteButton')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }, [hasPermission, onEditHistory, onViewDocuments, deleteHistoryMutation, t]);

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('htFailedToLoadTitle')}</h3>
          <p className="text-muted-foreground">
            {error instanceof Error ? error.message : t('htFailedToLoadDesc')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)} data-testid="history-table">
    <HistoryEditDiffDialog
      entry={auditEntry}
      isOpen={auditEntry !== null}
      onClose={() => setAuditEntry(null)}
    />
      {/* Summary metrics */}
      {showSummary && !compact && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('htTotalCostLabel')}</p>
                  <p className="text-2xl font-bold">${summaryMetrics.totalCost.toLocaleString()}</p>
                  {summaryMetrics.averageCostPerYear > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ${summaryMetrics.averageCostPerYear.toLocaleString()}{t('htCostPerYearAvgSuffix')}
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
                  <p className="text-sm text-muted-foreground">{t('htLifespanExtensionLabel')}</p>
                  <p className="text-2xl font-bold">+{summaryMetrics.totalLifespanImpact} {t('htWarrantyYearsSuffix')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('htLifespanFromInterventionsPrefix')} {summaryMetrics.entryCount} {t('htLifespanFromInterventionsSuffix')}
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
                  <p className="text-sm text-muted-foreground">{t('htLastMaintenanceLabel')}</p>
                  <p className="text-2xl font-bold" data-testid="latest-entry-date-summary">
                    {summaryMetrics.latestEntry 
                      ? (() => {
                          // parseDateOnly prevents UTC-midnight rollback in negative-offset zones
                          const d = parseDateOnly(summaryMetrics.latestEntry.eventDate);
                          return d
                            ? format(d, 'MMM yyyy', { locale: dateFnsLocale })
                            : summaryMetrics.latestEntry.eventDate;
                        })()
                      : t('htLastMaintenanceNever')
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
                  <p className="text-sm text-muted-foreground">{t('htWorkEventsLabel')}</p>
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
        title={compact ? undefined : t('htMaintenanceHistoryTitle')}
        description={compact ? undefined : `${t('htMaintenanceHistoryDescPrefix')} ${element.name}`}
        isLoading={isLoading}
        searchPlaceholder={t('htSearchPlaceholder')}
        searchableColumn="workDescription"
        enableFiltering={true}
        enableSorting={true}
        enableColumnVisibility={!compact}
        enablePagination={!compact}
        pageSize={compact ? 5 : 10}
        emptyState={{
          title: t('htNoHistoryTitle'),
          description: t('htNoHistoryDesc'),
          icon: Clock,
        }}
        renderRowActions={renderRowActions}
        className={compact ? 'border-none shadow-none' : ''}
      />
    </div>
  );
}

export type { HistoryTableProps, ElementHistoryEntry };