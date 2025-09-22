import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
// import { useBuildingContext } from '@/hooks/use-building-context';
import { apiRequest } from '@/lib/queryClient';
import { BuildingElement } from '@shared/schemas/maintenance';
import { differenceInDays, parseISO, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Package,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingUp,
  Calendar,
  Activity,
  CheckCircle,
  Building,
  Wrench,
  FileText,
  Target,
  BarChart3,
} from 'lucide-react';

interface InventoryOverviewProps {
  className?: string;
}

/**
 * InventoryOverview component displaying key metrics and summary cards
 * Shows element counts, condition breakdown, alerts, and cost information
 */
export function InventoryOverview({ className }: InventoryOverviewProps) {
  // Simplified placeholder - no API calls for now
  const buildingId = null;
  const elementsLoading = false;
  const summaryLoading = false;
  const elements: BuildingElement[] = [];
  const summary = {};

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalElements = elements.length;
    
    // Condition breakdown
    const conditionCounts = elements.reduce((acc, element) => {
      acc[element.currentCondition] = (acc[element.currentCondition] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Evaluation status
    const today = new Date();
    const overdueElements = elements.filter(element => {
      if (!element.nextEvaluationDate) return false;
      return isAfter(today, parseISO(element.nextEvaluationDate));
    });

    const dueSoonElements = elements.filter(element => {
      if (!element.nextEvaluationDate) return false;
      const evaluationDate = parseISO(element.nextEvaluationDate);
      const daysUntil = differenceInDays(evaluationDate, today);
      return daysUntil >= 0 && daysUntil <= 30;
    });

    // Critical conditions
    const criticalElements = elements.filter(element => 
      element.currentCondition === 'critical' || element.currentCondition === 'poor'
    );

    // Average age calculation
    const elementsWithAge = elements.filter(element => element.originalConstructionDate);
    const averageAge = elementsWithAge.length > 0 
      ? elementsWithAge.reduce((sum, element) => {
          const age = differenceInDays(today, parseISO(element.originalConstructionDate!)) / 365.25;
          return sum + age;
        }, 0) / elementsWithAge.length
      : 0;

    // Most common UNIFORMAT category
    const uniformatCounts = elements.reduce((acc, element) => {
      const category = element.uniformatCode.charAt(0);
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommonCategory = Object.entries(uniformatCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || '';

    return {
      totalElements,
      conditionCounts,
      overdueElements: overdueElements.length,
      dueSoonElements: dueSoonElements.length,
      criticalElements: criticalElements.length,
      averageAge: Math.round(averageAge * 10) / 10,
      mostCommonCategory,
      uniformatCounts,
    };
  }, [elements]);

  const isLoading = elementsLoading || summaryLoading;

  if (isLoading) {
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const conditionColors = {
    excellent: 'bg-green-500',
    good: 'bg-blue-500',
    fair: 'bg-yellow-500',
    poor: 'bg-orange-500',
    critical: 'bg-red-500',
  };

  const conditionLabels = {
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor',
    critical: 'Critical',
  };

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', className)} data-testid="inventory-overview">
      {/* Total Elements */}
      <Card data-testid="total-elements-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Elements</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="total-elements-count">
            {metrics.totalElements}
          </div>
          <p className="text-xs text-muted-foreground">
            Building inventory items
          </p>
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      <Card data-testid="critical-alerts-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600" data-testid="critical-elements-count">
            {metrics.criticalElements}
          </div>
          <p className="text-xs text-muted-foreground">
            Poor or critical condition
          </p>
        </CardContent>
      </Card>

      {/* Overdue Evaluations */}
      <Card data-testid="overdue-evaluations-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overdue Evaluations</CardTitle>
          <Clock className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600" data-testid="overdue-elements-count">
            {metrics.overdueElements}
          </div>
          <p className="text-xs text-muted-foreground">
            Past due date
          </p>
        </CardContent>
      </Card>

      {/* Total Asset Value */}
      <Card data-testid="asset-value-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Asset Value</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="asset-value-amount">
            $—K
          </div>
          <p className="text-xs text-muted-foreground">
            Estimated replacement cost
          </p>
        </CardContent>
      </Card>

      {/* Condition Breakdown Chart */}
      <Card className="md:col-span-2" data-testid="condition-breakdown-card">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Condition Breakdown
          </CardTitle>
          <CardDescription>
            Distribution of element conditions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(conditionLabels).map(([condition, label]) => {
            const count = metrics.conditionCounts[condition] || 0;
            const percentage = metrics.totalElements > 0 ? (count / metrics.totalElements) * 100 : 0;
            
            return (
              <div key={condition} className="space-y-1" data-testid={`condition-${condition}-breakdown`}>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-3 h-3 rounded-full', conditionColors[condition as keyof typeof conditionColors])} />
                    <span>{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{count}</span>
                    <span className="text-muted-foreground">({percentage.toFixed(1)}%)</span>
                  </div>
                </div>
                <Progress 
                  value={percentage} 
                  className="h-2"
                  data-testid={`condition-${condition}-progress`}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card className="md:col-span-2" data-testid="quick-stats-card">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Quick Statistics
          </CardTitle>
          <CardDescription>
            Key insights and trends
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1" data-testid="average-age-stat">
              <div className="text-sm text-muted-foreground">Average Age</div>
              <div className="text-lg font-semibold">{metrics.averageAge} years</div>
            </div>
            <div className="space-y-1" data-testid="due-soon-stat">
              <div className="text-sm text-muted-foreground">Due Soon (30 days)</div>
              <div className="text-lg font-semibold text-yellow-600">{metrics.dueSoonElements}</div>
            </div>
            <div className="space-y-1" data-testid="most-common-category-stat">
              <div className="text-sm text-muted-foreground">Most Common Category</div>
              <div className="text-lg font-semibold">
                {metrics.mostCommonCategory && (
                  <Badge variant="outline">
                    {metrics.mostCommonCategory} ({metrics.uniformatCounts[metrics.mostCommonCategory]})
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-1" data-testid="maintenance-cost-stat">
              <div className="text-sm text-muted-foreground">Maintenance YTD</div>
              <div className="text-lg font-semibold">
                $—K
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Evaluations */}
      <Card data-testid="upcoming-evaluations-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Due Soon</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600" data-testid="due-soon-count">
            {metrics.dueSoonElements}
          </div>
          <p className="text-xs text-muted-foreground">
            Next 30 days
          </p>
        </CardContent>
      </Card>

      {/* Completion Rate */}
      <Card data-testid="completion-rate-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Up to Date</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600" data-testid="up-to-date-percentage">
            {metrics.totalElements > 0 
              ? Math.round(((metrics.totalElements - metrics.overdueElements) / metrics.totalElements) * 100)
              : 0
            }%
          </div>
          <p className="text-xs text-muted-foreground">
            Evaluations current
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export type { InventoryOverviewProps };