import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInYears, parseISO } from 'date-fns';
import { StandardCard } from '@/components/common/StandardCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConditionBadge } from '@/components/maintenance/StatusBadges';
import { apiRequest } from '@/lib/queryClient';
import { BuildingElement } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import {
  Edit2,
  Clock,
  Calendar,
  DollarSign,
  FileText,
  Package,
} from 'lucide-react';

interface ElementCardProps {
  element: BuildingElement;
  className?: string;
  onEdit?: (element: BuildingElement) => void;
  onViewTimeline?: (element: BuildingElement) => void;
  showActions?: boolean;
  showMetrics?: boolean;
  showPhotos?: boolean;
  compact?: boolean;
}

interface ElementMetrics {
  totalCost: number;
  historyCount: number;
  documentCount: number;
  photoCount: number;
  lastMaintenanceDate?: string;
  averageCostPerYear: number;
}

/**
 * ElementCard component for displaying individual building element information
 * Shows element summary, condition, metrics, and quick actions
 */
export function ElementCard({
  element,
  className,
  onEdit,
  onViewTimeline,
  showActions = true,
  showMetrics = true,
  showPhotos = true,
  compact = false,
}: ElementCardProps) {
  const { t } = useLanguage();
  // Simplified placeholder - no context for now
  const hasPermission = () => true;

  // Fetch element metrics and additional data
  const {
    data: metricsResponse,
    isLoading: isLoadingMetrics,
  } = useQuery({
    queryKey: ['/api/maintenance/elements', element.id, 'metrics'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/elements/${element.id}/metrics`);
      return await response.json();
    },
    enabled: showMetrics,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const metrics: ElementMetrics = metricsResponse?.metrics || {
    totalCost: 0,
    historyCount: 0,
    documentCount: 0,
    photoCount: 0,
    averageCostPerYear: 0,
  };

  // Fetch element photos
  const {
    data: photosResponse,
    isLoading: isLoadingPhotos,
  } = useQuery({
    queryKey: ['/api/maintenance/elements', element.id, 'photos'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/maintenance/elements/${element.id}/documents?type=image`);
      return await response.json();
    },
    enabled: showPhotos,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const photos = photosResponse?.documents || [];

  // Calculate derived metrics
  const elementAge = useMemo(() => {
    if (!element.originalConstructionDate) return 0;
    return differenceInYears(new Date(), parseISO(element.originalConstructionDate));
  }, [element.originalConstructionDate]);

  const lifespanProgress = useMemo(() => {
    const lifespan = element.currentLifespan || element.originalLifespan;
    if (!lifespan || elementAge === 0) return 0;
    return Math.min((elementAge / lifespan) * 100, 100);
  }, [elementAge, element.currentLifespan, element.originalLifespan]);

  const evaluationUrgency = useMemo(() => {
    if (!element.nextEvaluationDate) return null;
    
    const evaluationDate = parseISO(element.nextEvaluationDate);
    const today = new Date();
    const daysDiff = Math.ceil((evaluationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff < 0) return { status: 'overdue', label: t('emcOverdueBadge'), variant: 'destructive' as const };
    if (daysDiff <= 30) return { status: 'due-soon', label: t('emcDueSoonBadge'), variant: 'outline' as const };
    return { status: 'scheduled', label: t('emcScheduledBadge'), variant: 'secondary' as const };
  }, [element.nextEvaluationDate, t]);

  const canEdit = hasPermission();

  // Get element icon based on uniformat code or type
  const getElementIcon = () => {
    return <Package className="w-5 h-5 text-blue-500" />;
  };

  const conditionLabel = (cond: string) => {
    switch (cond) {
      case 'excellent': return t('ihdrConditionExcellent');
      case 'good': return t('ihdrConditionGood');
      case 'fair': return t('ihdrConditionFair');
      case 'poor': return t('ihdrConditionPoor');
      case 'critical': return t('ihdrConditionCritical');
      default: return cond.charAt(0).toUpperCase() + cond.slice(1);
    }
  };

  // Build badges array for StandardCard - only show in non-compact mode
  const badges = !compact ? [
    {
      text: element.uniformatCode,
      variant: 'outline' as const,
      className: 'text-xs'
    },
    // Use ConditionBadge component for condition display - but need to map to badge format
    element.currentCondition && {
      text: conditionLabel(element.currentCondition),
      variant: element.currentCondition === 'critical' ? 'destructive' as const : 
               element.currentCondition === 'poor' ? 'outline' as const : 'secondary' as const,
      className: 'text-xs'
    },
    evaluationUrgency && {
      text: evaluationUrgency.label,
      variant: evaluationUrgency.variant,
      className: 'text-xs'
    }
  ].filter(Boolean) : [];

  // Build actions array for StandardCard
  const actions = showActions ? [
    canEdit && onEdit && {
      icon: <Edit2 className="w-4 h-4" />,
      label: t('emcEditElementLabel'),
      text: !compact ? t('emcEditButton') : undefined,
      onClick: () => onEdit(element),
      variant: 'ghost' as const,
      testId: `edit-element-${element.id}`
    }
  ].filter(Boolean) : [];

  // Build metadata array for StandardCard - only show in non-compact mode
  const metadata = !compact ? [
    element.originalConstructionDate && {
      icon: <Calendar className="w-3 h-3" />,
      label: t('emcBuiltLabel'),
      value: format(parseISO(element.originalConstructionDate), 'MMM yyyy')
    },
    element.lastInspectionDate && {
      icon: <Clock className="w-3 h-3" />,
      label: t('emcLastInspectionLabel'),
      value: format(parseISO(element.lastInspectionDate), 'MMM yyyy')
    }
  ].filter(Boolean) : [];

  // Photo preview component
  const photoPreview = showPhotos && !compact && photos.length > 0 && (
    <div className="flex gap-2 overflow-x-auto mb-3">
      {photos.slice(0, 3).map((photo: any, index: number) => (
        <div
          key={photo.id}
          className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-muted"
          data-testid={`photo-preview-${index}`}
        >
          <img
            src={photo.url}
            alt={`${element.name} ${t('emcPhotoAltSuffix')} ${index + 1}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ))}
      {photos.length > 3 && (
        <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground">
          +{photos.length - 3}
        </div>
      )}
      {isLoadingPhotos && (
        <Skeleton className="w-16 h-16 rounded-md" />
      )}
    </div>
  );

  // Children content (detailed info - only shown in non-compact mode)
  const childrenContent = (
    <div className="space-y-4">
      {/* Photo preview */}
      {photoPreview}

      {/* Age and Lifespan */}
      <div className="space-y-2" data-testid={`lifespan-info-${element.id}`}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('emcAgeLifespanLabel')}</span>
          <span className="font-medium">
            {elementAge} / {element.currentLifespan || element.originalLifespan || '—'} {t('emcYearsSuffix')}
          </span>
        </div>
        
        {element.originalLifespan && (
          <div className="space-y-1">
            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <div
                className={cn(
                  "h-2 rounded-full transition-all",
                  lifespanProgress > 80 ? "bg-red-500" : 
                  lifespanProgress > 60 ? "bg-yellow-500" : "bg-green-500"
                )}
                style={{ width: `${Math.min(lifespanProgress, 100)}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {lifespanProgress.toFixed(0)}{t('emcLifespanProgressSuffix')}
            </div>
          </div>
        )}
      </div>

      {/* Key Dates */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground mb-1">{t('emcConstructionLabel')}</div>
          <div className="font-medium">
            {element.originalConstructionDate 
              ? format(parseISO(element.originalConstructionDate), 'MMM yyyy')
              : t('emcUnknown')
            }
          </div>
        </div>
        
        <div>
          <div className="text-muted-foreground mb-1">{t('emcLastInspectionLabel')}</div>
          <div className="font-medium">
            {element.lastInspectionDate 
              ? format(parseISO(element.lastInspectionDate), 'MMM yyyy')
              : t('emcNever')
            }
          </div>
        </div>
      </div>

      {/* Next Evaluation */}
      {element.nextEvaluationDate && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{t('emcNextEvaluationLabel')}</div>
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {format(parseISO(element.nextEvaluationDate), 'MMM d, yyyy')}
            </span>
            {evaluationUrgency && (
              <Badge variant={evaluationUrgency.variant} className="text-xs">
                {evaluationUrgency.label}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Metrics */}
      {showMetrics && (
        <div className="pt-2 border-t">
          {isLoadingMetrics ? (
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1" data-testid={`cost-metrics-${element.id}`}>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  {t('emcTotalCostLabel')}
                </div>
                <div className="font-medium">
                  ${metrics.totalCost.toLocaleString()}
                </div>
                {metrics.averageCostPerYear > 0 && (
                  <div className="text-xs text-muted-foreground">
                    ${metrics.averageCostPerYear.toLocaleString()}{t('emcCostPerYearAvgSuffix')}
                  </div>
                )}
              </div>
              
              <div className="space-y-1" data-testid={`activity-metrics-${element.id}`}>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  {t('emcActivityLabel')}
                </div>
                <div className="font-medium">
                  {metrics.historyCount} {t('emcEntriesSuffix')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {metrics.documentCount} {t('emcDocumentsSuffix')}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      {showActions && (
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2">
            {onViewTimeline && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewTimeline(element)}
                data-testid={`view-timeline-${element.id}`}
              >
                <Clock className="h-4 w-4 mr-1" />
                {t('emcTimelineButton')}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Unit and Value */}
      {(element.unit || element.unitValue) && (
        <div className="text-sm text-muted-foreground" data-testid={`unit-value-${element.id}`}>
          {element.unitValue} {element.unit}
        </div>
      )}
    </div>
  );

  return (
    <StandardCard
      title={element.name}
      description={!compact ? element.description : undefined}
      icon={getElementIcon()}
      badges={badges}
      actions={actions}
      metadata={metadata}
      spacing={compact ? 'compact' : 'normal'}
      className={className}
      testId={`element-card-${element.id}`}
    >
      {!compact && childrenContent}
    </StandardCard>
  );
}

export type { ElementCardProps };