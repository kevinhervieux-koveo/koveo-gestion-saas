import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { BuildingElement } from '@shared/schemas/maintenance';
import { differenceInDays, parseISO, isAfter, format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Package,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingUp,
  Activity,
  CheckCircle,
  Building,
  Wrench,
  FileText,
  Target,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Edit2,
  Save,
  X,
  CalendarIcon,
} from 'lucide-react';

interface InventoryOverviewProps {
  className?: string;
  buildingId?: string;
  organizationId?: string;
  building?: {
    id: string;
    name: string;
    constructionDate?: Date | string;
    [key: string]: any;
  };
}

/**
 * InventoryOverview component displaying key metrics and summary cards
 * Shows element counts, condition breakdown, alerts, and cost information
 */
export function InventoryOverview({ className, buildingId, organizationId, building }: InventoryOverviewProps) {
  // Collapsible state - collapsed by default
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Construction date editing state
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editingDate, setEditingDate] = useState<Date | undefined>(
    building?.constructionDate ? new Date(building.constructionDate) : undefined
  );

  // Sync editingDate with building prop changes
  useEffect(() => {
    if (building?.constructionDate && !isEditingDate) {
      setEditingDate(new Date(building.constructionDate));
    }
  }, [building?.constructionDate, isEditingDate]);
  
  const { toast } = useToast();
  
  // Mutation to update building construction date
  const updateBuildingMutation = useMutation({
    mutationFn: async (constructionDate: Date) => {
      if (!buildingId) throw new Error('Building ID is required');
      if (!organizationId) throw new Error('Organization ID is required');
      
      // For admin building updates, we need to fetch building data
      let buildingName;
      try {
        const buildingResponse = await apiRequest('GET', `/api/manager/buildings/${buildingId}`);
        const buildingData = await buildingResponse.json();
        buildingName = buildingData?.name;
        
        if (!buildingName) {
          console.error('Building name not found in response:', buildingData);
          throw new Error('Building name not found');
        }
      } catch (error) {
        console.error('Failed to fetch building data:', error);
        throw new Error('Unable to fetch building information');
      }
      
      const response = await apiRequest('PUT', `/api/admin/buildings/${buildingId}`, {
        name: buildingName,
        organizationId: organizationId,
        constructionDate: constructionDate.toISOString().split('T')[0], // YYYY-MM-DD format
      });
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate related queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/manager/buildings', buildingId] });
      queryClient.invalidateQueries({ queryKey: ['/api/manager/buildings'] });
      // Force refetch the building data immediately
      queryClient.refetchQueries({ queryKey: ['/api/manager/buildings', buildingId] });
      toast({
        title: 'Building updated',
        description: 'Construction date has been updated successfully',
      });
      setIsEditingDate(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update building construction date',
        variant: 'destructive',
      });
    },
  });
  
  // Handle construction date editing
  const handleSaveDate = () => {
    if (!editingDate) {
      toast({
        title: 'Invalid date',
        description: 'Please select a valid construction date',
        variant: 'destructive',
      });
      return;
    }
    
    const currentYear = new Date().getFullYear();
    if (editingDate.getFullYear() < 1800 || editingDate.getFullYear() > currentYear) {
      toast({
        title: 'Invalid date',
        description: `Please select a date between 1800 and ${currentYear}`,
        variant: 'destructive',
      });
      return;
    }
    
    updateBuildingMutation.mutate(editingDate);
  };

  const handleCancelEdit = () => {
    setEditingDate(building?.constructionDate ? new Date(building.constructionDate) : undefined);
    setIsEditingDate(false);
  };
  
  // Fetch building elements data (all elements, no filters)
  const { data: elementsData, isLoading: elementsLoading } = useQuery({
    queryKey: ['/api/maintenance/buildings', buildingId, 'elements'],
    queryFn: async () => {
      if (!buildingId) return { data: [] };
      const response = await apiRequest('GET', `/api/maintenance/buildings/${buildingId}/elements`);
      return await response.json();
    },
    enabled: !!buildingId,
  });

  const elements: BuildingElement[] = elementsData?.data || [];

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
      const category = element.uniformatCode ? element.uniformatCode.charAt(0) : 'Unknown';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommonCategory = Object.entries(uniformatCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || '';

    // Asset value calculation (sum of all reconstruction costs)
    const totalAssetValue = elements.reduce((sum, element) => {
      const cost = Number(element.reconstructionCost) || 0;
      return sum + cost;
    }, 0);

    return {
      totalElements,
      conditionCounts,
      overdueElements: overdueElements.length,
      dueSoonElements: dueSoonElements.length,
      criticalElements: criticalElements.length,
      averageAge: Math.round(averageAge * 10) / 10,
      mostCommonCategory,
      uniformatCounts,
      totalAssetValue,
    };
  }, [elements]);

  const isLoading = elementsLoading;

  if (isLoading) {
    return (
      <Collapsible 
        open={isExpanded} 
        onOpenChange={setIsExpanded} 
        className={cn('space-y-4', className)} 
        data-testid="inventory-overview"
      >
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Inventory Overview</h3>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" data-testid="inventory-overview-toggle">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span className="sr-only">Toggle inventory overview</span>
            </Button>
          </CollapsibleTrigger>
        </div>
        
        <CollapsibleContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        </CollapsibleContent>
      </Collapsible>
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
    <Collapsible 
      open={isExpanded} 
      onOpenChange={setIsExpanded} 
      className={cn('space-y-4', className)} 
      data-testid="inventory-overview"
    >
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Inventory Overview</h3>
          {building?.name && (
            <span className="text-sm text-muted-foreground">- {building.name}</span>
          )}
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" data-testid="inventory-overview-toggle">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span className="sr-only">Toggle inventory overview</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      
      <CollapsibleContent className="space-y-4">
        {/* Building Construction Date Field */}
        <Card data-testid="building-construction-date-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Building Construction Date</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {isEditingDate ? (
                <div className="flex items-center gap-2 w-full">
                  <Input
                    type="date"
                    value={editingDate ? format(editingDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      if (inputValue === '') {
                        setEditingDate(null);
                      } else {
                        // Let the native date input handle the parsing
                        if (inputValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                          try {
                            const dateValue = new Date(inputValue + 'T00:00:00');
                            if (!isNaN(dateValue.getTime())) {
                              setEditingDate(dateValue);
                            }
                          } catch (error) {
                            console.warn('Date parsing error:', error);
                          }
                        }
                      }
                    }}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    min="1800-01-01"
                    data-testid="construction-date-input"
                    className="w-auto"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveDate}
                    disabled={updateBuildingMutation.isPending}
                    data-testid="save-construction-date"
                  >
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={updateBuildingMutation.isPending}
                    data-testid="cancel-edit-construction-date"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <div className="text-2xl font-bold">
                    {building?.constructionDate ? format(new Date(building.constructionDate), 'MMM dd, yyyy') : '—'}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingDate(true)}
                    data-testid="edit-construction-date"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Default for new elements
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            ${metrics.totalAssetValue > 0 ? Math.round(metrics.totalAssetValue / 1000).toLocaleString() : '—'}K
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
                {metrics.mostCommonCategory ? (
                  <Badge variant="outline">
                    {metrics.mostCommonCategory} ({metrics.uniformatCounts[metrics.mostCommonCategory]})
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export type { InventoryOverviewProps };