import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInYears, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConditionBadge } from '@/components/maintenance/StatusBadges';
// import { useBuildingContext } from '@/hooks/use-building-context';
import { apiRequest } from '@/lib/queryClient';
import { BuildingElement } from '@shared/schemas/maintenance';
import { cn } from '@/lib/utils';
import {
  Edit2,
  Clock,
  Camera,
  AlertTriangle,
  Calendar,
  DollarSign,
  Building,
  FileText,
  TrendingUp,
  Info,
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
    
    if (daysDiff < 0) return { status: 'overdue', label: 'Overdue', variant: 'destructive' as const };
    if (daysDiff <= 30) return { status: 'due-soon', label: 'Due Soon', variant: 'outline' as const };
    return { status: 'scheduled', label: 'Scheduled', variant: 'secondary' as const };
  }, [element.nextEvaluationDate]);

  const canEdit = hasPermission('canEditMaintenance');

  return (
    <Card 
      className={cn(
        'hover:shadow-md transition-shadow duration-200',
        compact ? 'p-3' : '',
        className
      )} 
      data-testid={`element-card-${element.id}`}
    >
      <CardHeader className={cn('space-y-3', compact ? 'pb-3' : 'pb-4')}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 space-y-2">
            <CardTitle className={cn('text-lg leading-tight', compact ? 'text-base' : '')}>
              <div className="flex items-center gap-2">
                <span className="truncate" data-testid={`element-name-${element.id}`}>
                  {element.name}
                </span>
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {element.uniformatCode}
                </Badge>
              </div>
            </CardTitle>
            
            {element.description && !compact && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {element.description}
              </p>
            )}
            
            <div className="flex items-center gap-2">
              <ConditionBadge 
                condition={element.currentCondition} 
                size="sm"
                data-testid={`condition-badge-${element.id}`}
              />
              
              {evaluationUrgency && (
                <Badge 
                  variant={evaluationUrgency.variant} 
                  className="text-xs"
                  data-testid={`evaluation-urgency-${element.id}`}
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  {evaluationUrgency.label}
                </Badge>
              )}
            </div>
          </div>

          {showActions && (
            <div className="flex items-center gap-1 ml-2">
              {canEdit && onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(element)}
                  data-testid={`edit-element-${element.id}`}
                >
                  <Edit2 className="h-4 w-4" />
                  {!compact && <span className="ml-1">Edit</span>}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Photo preview */}
        {showPhotos && !compact && photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {photos.slice(0, 3).map((photo: any, index: number) => (
              <div
                key={photo.id}
                className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-muted"
                data-testid={`photo-preview-${index}`}
              >
                <img
                  src={photo.url}
                  alt={`${element.name} photo ${index + 1}`}
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
        )}
      </CardHeader>

      <CardContent className={cn('space-y-4', compact ? 'pt-0' : '')}>
        {/* Age and Lifespan */}
        <div className="space-y-2" data-testid={`lifespan-info-${element.id}`}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Age / Lifespan</span>
            <span className="font-medium">
              {elementAge} / {element.currentLifespan || element.originalLifespan || '—'} years
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
                {lifespanProgress.toFixed(0)}% of expected lifespan
              </div>
            </div>
          )}
        </div>

        {/* Key Dates */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground mb-1">Construction</div>
            <div className="font-medium">
              {element.originalConstructionDate 
                ? format(parseISO(element.originalConstructionDate), 'MMM yyyy')
                : 'Unknown'
              }
            </div>
          </div>
          
          <div>
            <div className="text-muted-foreground mb-1">Last Inspection</div>
            <div className="font-medium">
              {element.lastInspectionDate 
                ? format(parseISO(element.lastInspectionDate), 'MMM yyyy')
                : 'Never'
              }
            </div>
          </div>
        </div>

        {/* Next Evaluation */}
        {element.nextEvaluationDate && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Next Evaluation</div>
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
        {showMetrics && !compact && (
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
                    Total Cost
                  </div>
                  <div className="font-medium">
                    ${metrics.totalCost.toLocaleString()}
                  </div>
                  {metrics.averageCostPerYear > 0 && (
                    <div className="text-xs text-muted-foreground">
                      ${metrics.averageCostPerYear.toLocaleString()}/year avg
                    </div>
                  )}
                </div>
                
                <div className="space-y-1" data-testid={`activity-metrics-${element.id}`}>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    Activity
                  </div>
                  <div className="font-medium">
                    {metrics.historyCount} entries
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {metrics.documentCount} documents
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        {showActions && !compact && (
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
                  Timeline
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
      </CardContent>
    </Card>
  );
}

export type { ElementCardProps };