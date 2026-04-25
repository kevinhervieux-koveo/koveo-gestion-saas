import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths, subYears } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  BarChart,
  Bar,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { chartColors, buildChartConfig } from '@/lib/chart-colors';
import { useBuildingContext } from '@/hooks/use-building-context';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Brain,
  DollarSign,
  Calendar,
  BarChart3,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  Clock,
  Snowflake,
  Sun,
  Leaf,
  MapPin,
  Target,
  Zap,
  Activity,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  BarChart as BarChartIcon,
  Eye,
  FileDown,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { SuggestionAnalyticsProps, AnalyticsInsight } from './types';
import { useLanguage } from '@/hooks/use-language';

const colors = chartColors;

// Seasonal patterns for Quebec climate
const seasonalFactors = {
  spring: { label: 'Spring', factor: 1.2, color: colors.success, icon: Leaf },
  summer: { label: 'Summer', factor: 1.0, color: colors.warning, icon: Sun },
  fall: { label: 'Fall', factor: 1.1, color: colors.orange, icon: Leaf },
  winter: { label: 'Winter', factor: 1.5, color: colors.info, icon: Snowflake },
};

/**
 * SuggestionAnalytics component for advanced analytics and insights
 * Provides predictive maintenance insights, cost-benefit analysis, and optimization recommendations
 */
export function SuggestionAnalytics({
  buildingId,
  organizationId,
  timeRange = 'year',
  onInsightAction,
  className,
}: SuggestionAnalyticsProps) {
  const { t } = useLanguage();
  const { hasPermission } = useBuildingContext();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('predictive');
  const [selectedInsight, setSelectedInsight] = useState<AnalyticsInsight | null>(null);

  // Fetch analytics data
  const {
    data: analyticsResponse,
    isLoading: isLoadingAnalytics,
    error: analyticsError,
  } = useQuery({
    queryKey: ['/api/maintenance/analytics/suggestions', buildingId, organizationId, timeRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (buildingId) params.append('buildingId', buildingId);
      if (organizationId) params.append('organizationId', organizationId);
      params.append('timeRange', timeRange);
      
      const response = await apiRequest('GET', `/api/maintenance/analytics/suggestions?${params}`);
      return await response.json();
    },
    enabled: !!buildingId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const analytics = analyticsResponse?.analytics || {
    insights: [],
    predictions: [],
    costBenefitAnalysis: {},
    lifespanOptimization: [],
    seasonalPatterns: {},
    roiCalculations: {},
    performanceMetrics: {},
  };

  // Mock data for demonstration (to be replaced with actual API data)
  const mockInsights: AnalyticsInsight[] = [
    {
      id: '1',
      type: 'cost_savings',
      title: 'Proactive HVAC Maintenance Opportunity',
      description: 'By performing preventive maintenance on HVAC systems 6 months earlier, you could save 35% on repair costs.',
      impact: 'high',
      confidence: 87,
      estimatedSavings: 45000,
      recommendedActions: [
        'Schedule HVAC inspections for Q2',
        'Replace filters preemptively',
        'Calibrate controls annually'
      ],
      dataPoints: [
        { metric: 'Historical Failure Rate', value: 23, trend: 'decreasing' },
        { metric: 'Maintenance Cost Trend', value: 15000, trend: 'increasing' },
        { metric: 'Energy Efficiency', value: 78, trend: 'stable' }
      ],
      affectedElements: ['hvac-001', 'hvac-002', 'hvac-003']
    },
    {
      id: '2',
      type: 'lifespan_optimization',
      title: 'Roof Membrane Lifecycle Extension',
      description: 'Implementing quarterly inspections and minor repairs could extend roof lifespan by 3-5 years.',
      impact: 'high',
      confidence: 92,
      estimatedSavings: 125000,
      recommendedActions: [
        'Implement quarterly roof inspections',
        'Establish preventive sealing program',
        'Monitor drainage system monthly'
      ],
      dataPoints: [
        { metric: 'Current Lifespan Utilization', value: 75, trend: 'increasing' },
        { metric: 'Weather Impact Score', value: 6.8, trend: 'stable' },
        { metric: 'Maintenance Frequency', value: 2, trend: 'decreasing' }
      ],
      affectedElements: ['roof-001']
    },
    {
      id: '3',
      type: 'seasonal_planning',
      title: 'Winter Preparation Cost Optimization',
      description: 'Scheduling exterior work during summer months reduces costs by 25% compared to emergency winter repairs.',
      impact: 'medium',
      confidence: 78,
      estimatedSavings: 28000,
      recommendedActions: [
        'Plan exterior work for May-September',
        'Stock winter emergency supplies',
        'Schedule heating system maintenance in fall'
      ],
      dataPoints: [
        { metric: 'Seasonal Cost Variance', value: 25, trend: 'stable' },
        { metric: 'Emergency Repair Frequency', value: 8, trend: 'increasing' },
        { metric: 'Resource Availability', value: 60, trend: 'decreasing' }
      ],
      affectedElements: ['exterior-001', 'heating-001']
    }
  ];

  // Predictive maintenance data
  const predictiveData = [
    { month: 'Jan', predicted: 12, actual: 10, confidence: 85 },
    { month: 'Feb', predicted: 8, actual: 9, confidence: 82 },
    { month: 'Mar', predicted: 15, actual: 14, confidence: 88 },
    { month: 'Apr', predicted: 18, actual: 16, confidence: 79 },
    { month: 'May', predicted: 22, actual: 0, confidence: 91 },
    { month: 'Jun', predicted: 25, actual: 0, confidence: 89 },
  ];

  // Cost-benefit analysis data
  const costBenefitData = [
    { approach: 'Reactive', cost: 100000, downtime: 240, satisfaction: 60 },
    { approach: 'Preventive', cost: 75000, downtime: 120, satisfaction: 80 },
    { approach: 'Predictive', cost: 65000, downtime: 60, satisfaction: 95 },
  ];

  // Seasonal pattern data
  const seasonalData = [
    { season: 'Spring', emergencies: 15, planned: 45, cost: 125000, efficiency: 85 },
    { season: 'Summer', emergencies: 8, planned: 60, cost: 95000, efficiency: 95 },
    { season: 'Fall', emergencies: 12, planned: 50, cost: 110000, efficiency: 88 },
    { season: 'Winter', emergencies: 25, planned: 25, cost: 180000, efficiency: 65 },
  ];

  // Element lifespan optimization data
  const lifespanData = [
    { element: 'HVAC Systems', current: 15, potential: 18, savings: 45000 },
    { element: 'Roofing', current: 20, potential: 25, savings: 125000 },
    { element: 'Electrical', current: 25, potential: 28, savings: 35000 },
    { element: 'Plumbing', current: 30, potential: 35, savings: 28000 },
    { element: 'Flooring', current: 12, potential: 15, savings: 18000 },
  ];

  // ROI calculation data
  const roiData = [
    { category: 'Preventive Maintenance', investment: 25000, savings: 75000, roi: 200, payback: 4 },
    { category: 'Predictive Analytics', investment: 15000, savings: 45000, roi: 200, payback: 5 },
    { category: 'Energy Efficiency', investment: 35000, savings: 85000, roi: 143, payback: 6 },
    { category: 'Automation Systems', investment: 50000, savings: 120000, roi: 140, payback: 6 },
  ];

  // Handle insight action
  const handleInsightAction = (insight: AnalyticsInsight, action: string) => {
    onInsightAction?.(insight, action);
    toast({
      title: "Action Initiated",
      description: `${action} action has been started for: ${insight.title}`,
    });
  };

  // Get trend icon
  const getTrendIcon = (trend: 'increasing' | 'decreasing' | 'stable', value?: number) => {
    switch (trend) {
      case 'increasing':
        return <ArrowUpRight className="h-3 w-3 text-green-600" />;
      case 'decreasing':
        return <ArrowDownRight className="h-3 w-3 text-red-600" />;
      default:
        return <Minus className="h-3 w-3 text-gray-600" />;
    }
  };

  // Get impact color
  const getImpactColor = (impact: 'low' | 'medium' | 'high') => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  if (isLoadingAnalytics) {
    return (
      <div className={cn("space-y-6", className)} data-testid="suggestion-analytics-loading">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn("space-y-6", className)} data-testid="suggestion-analytics">
        {/* Analytics Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl flex items-center gap-2">
                <Brain className="h-6 w-6" />
                Advanced Analytics & Insights
              </CardTitle>

              <div className="flex items-center gap-2">
                <Select value={timeRange} onValueChange={() => {}}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="year">1 Year</SelectItem>
                    <SelectItem value="2years">2 Years</SelectItem>
                    <SelectItem value="5years">5 Years</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" size="sm">
                  <FileDown className="h-4 w-4 mr-1" />
                  Export Analysis
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Key Insights Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mockInsights.map((insight) => (
            <Card key={insight.id} className="relative" data-testid={`insight-${insight.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {insight.type === 'cost_savings' && <DollarSign className="h-4 w-4 text-green-600" />}
                    {insight.type === 'lifespan_optimization' && <Target className="h-4 w-4 text-blue-600" />}
                    {insight.type === 'seasonal_planning' && <Calendar className="h-4 w-4 text-orange-600" />}
                    {insight.type === 'risk_mitigation' && <AlertTriangle className="h-4 w-4 text-red-600" />}
                    <Badge className={getImpactColor(insight.impact)}>
                      {insight.impact} impact
                    </Badge>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {insight.confidence}% confidence
                  </Badge>
                </div>
                <CardTitle className="text-sm">{insight.title}</CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{insight.description}</p>
                
                {insight.estimatedSavings && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-600">
                      ${insight.estimatedSavings.toLocaleString()} estimated savings
                    </span>
                  </div>
                )}

                {/* Key Data Points */}
                <div className="space-y-1">
                  {insight.dataPoints.slice(0, 2).map((point, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{point.metric}:</span>
                      <div className="flex items-center gap-1">
                        <span>{typeof point.value === 'number' && point.value > 1000 ? 
                          `$${point.value.toLocaleString()}` : point.value}</span>
                        {getTrendIcon(point.trend)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    className="flex-1 text-xs"
                    onClick={() => handleInsightAction(insight, 'implement')}
                    data-testid={`implement-insight-${insight.id}`}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Implement
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setSelectedInsight(insight)}
                    data-testid={`view-insight-${insight.id}`}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Analytics Tabs */}
        <Card>
          <CardHeader>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="predictive" data-testid="tab-predictive">
                  <Brain className="h-4 w-4 mr-1" />
                  Predictive
                </TabsTrigger>
                <TabsTrigger value="cost-benefit" data-testid="tab-cost-benefit">
                  <DollarSign className="h-4 w-4 mr-1" />
                  Cost-Benefit
                </TabsTrigger>
                <TabsTrigger value="seasonal" data-testid="tab-seasonal">
                  <Calendar className="h-4 w-4 mr-1" />
                  Seasonal
                </TabsTrigger>
                <TabsTrigger value="optimization" data-testid="tab-optimization">
                  <Target className="h-4 w-4 mr-1" />
                  Optimization
                </TabsTrigger>
              </TabsList>

              <TabsContent value="predictive" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Predictive Maintenance Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Maintenance Predictions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={buildChartConfig({
                        predicted: { label: 'Predicted', color: colors.primary },
                        actual: { label: 'Actual', color: colors.success },
                      })} className="h-[300px] w-full">
                        <LineChart data={predictiveData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          <Line 
                            type="monotone" 
                            dataKey="predicted" 
                            stroke={colors.primary} 
                            strokeDasharray="5 5"
                            name="Predicted"
                          />
                          <Line 
                            type="monotone" 
                            dataKey="actual" 
                            stroke={colors.success} 
                            name="Actual"
                          />
                        </LineChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  {/* Confidence Metrics */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Prediction Accuracy</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {predictiveData.slice(-3).map((item, idx) => (
                          <div key={idx} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>{item.month} Confidence</span>
                              <span className="font-medium">{item.confidence}%</span>
                            </div>
                            <Progress value={item.confidence} className="h-2" />
                          </div>
                        ))}
                        
                        <div className="pt-3 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Overall Accuracy</span>
                            <span className="font-bold text-lg">87%</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="cost-benefit" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Cost Comparison */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{t('maintenanceApproachComparison')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={buildChartConfig({
                        cost: { label: 'Annual Cost', color: colors.danger },
                        downtime: { label: 'Downtime', color: colors.warning },
                        satisfaction: { label: 'Satisfaction', color: colors.success },
                      })} className="h-[300px] w-full">
                        <BarChart data={costBenefitData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="approach" />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => {
                            const label = name === 'cost' ? 'Annual Cost' : 
                              name === 'downtime' ? 'Downtime (hours)' : 'Satisfaction (%)';
                            const formatted = name === 'cost' ? `$${Number(value).toLocaleString()}` : String(value);
                            return (
                              <div className="flex flex-1 justify-between items-center leading-none">
                                <span className="text-muted-foreground">{label}</span>
                                <span className="font-mono font-medium tabular-nums text-foreground ml-2">{formatted}</span>
                              </div>
                            );
                          }} />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          <Bar dataKey="cost" fill={colors.danger} name="Annual Cost" />
                          <Bar dataKey="downtime" fill={colors.warning} name="Downtime" />
                          <Bar dataKey="satisfaction" fill={colors.success} name="Satisfaction" />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  {/* ROI Analysis */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">ROI by Investment Category</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {roiData.map((item, idx) => (
                          <div key={idx} className="border rounded-lg p-3">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-medium text-sm">{item.category}</span>
                              <Badge variant="outline">{item.roi}% ROI</Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                              <div>
                                <div>Investment</div>
                                <div className="font-medium">${item.investment.toLocaleString()}</div>
                              </div>
                              <div>
                                <div>Savings</div>
                                <div className="font-medium text-green-600">${item.savings.toLocaleString()}</div>
                              </div>
                              <div>
                                <div>Payback</div>
                                <div className="font-medium">{item.payback} months</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="seasonal" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Seasonal Patterns */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Seasonal Maintenance Patterns</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={buildChartConfig({
                        emergencies: { label: 'Emergency Repairs', color: colors.danger },
                        planned: { label: 'Planned Maintenance', color: colors.success },
                      })} className="h-[300px] w-full">
                        <BarChart data={seasonalData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="season" />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          <Bar dataKey="emergencies" fill={colors.danger} name="Emergency Repairs" />
                          <Bar dataKey="planned" fill={colors.success} name="Planned Maintenance" />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  {/* Seasonal Efficiency */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Seasonal Cost & Efficiency</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {seasonalData.map((season, idx) => {
                          const SeasonIcon = Object.values(seasonalFactors)[idx]?.icon || Calendar;
                          return (
                            <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <SeasonIcon className="h-5 w-5" style={{ color: Object.values(seasonalFactors)[idx]?.color }} />
                                <div>
                                  <div className="font-medium">{season.season}</div>
                                  <div className="text-xs text-muted-foreground">
                                    ${season.cost.toLocaleString()} cost
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">{season.efficiency}%</div>
                                <div className="text-xs text-muted-foreground">efficiency</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="optimization" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Lifespan Optimization */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Element Lifespan Optimization</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={buildChartConfig({
                        current: { label: 'Current Lifespan', color: colors.info },
                        potential: { label: 'Potential Lifespan', color: colors.success },
                      })} className="h-[300px] w-full">
                        <BarChart data={lifespanData} layout="horizontal">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="element" type="category" width={100} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                          <Bar dataKey="current" fill={colors.info} name="Current Lifespan" />
                          <Bar dataKey="potential" fill={colors.success} name="Potential Lifespan" />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  {/* Optimization Opportunities */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Top Optimization Opportunities</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {lifespanData.sort((a, b) => b.savings - a.savings).slice(0, 5).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <div className="font-medium text-sm">{item.element}</div>
                              <div className="text-xs text-muted-foreground">
                                +{item.potential - item.current} years extension
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-green-600">
                                ${item.savings.toLocaleString()}
                              </div>
                              <div className="text-xs text-muted-foreground">savings</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </CardHeader>
        </Card>
      </div>
    </TooltipProvider>
  );
}