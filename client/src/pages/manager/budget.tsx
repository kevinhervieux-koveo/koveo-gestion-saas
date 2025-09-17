import React, { useState } from 'react';
import { Header } from '@/components/layout/header';
import { useLanguage } from '@/hooks/use-language';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  PieChart, 
  BarChart, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Calculator,
  ArrowLeft,
  Settings,
  LineChart,
  Building,
  CreditCard,
  Receipt,
  Percent,
  Coins,
  Plus,
  Minus,
  Target,
  TrendingUp as TrendingUpIcon,
  Building2,
  FileText,
  PiggyBank
} from 'lucide-react';
import {
  LineChart as RechartsLineChart,
  Line as RechartsLine,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  CartesianGrid as RechartsCartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer as RechartsResponsiveContainer
} from 'recharts';

interface BudgetProps {
  organizationId?: string;
  buildingId?: string;
}

interface BankAccountSettings {
  bankAccountStartAmount?: number;
  bankAccountMinimums?: number;
  generalInflationRate?: number;
  revenueInflationRate?: number;
  // Extended configuration options
  emergencyFundMinimum?: number;
  reserveFundTarget?: number;
  operatingCashMinimum?: number;
  revenueGrowthRate?: number;
  revenueInflation?: number; // Added missing field for complete type alignment
  costInflationRate?: number;
  utilityInflationRate?: number;
  maintenanceInflationRate?: number;
  specialInvestmentBudget?: number;
  investmentHorizonYears?: number;
  capitalProjectReserve?: number;
}

interface BankAccountData {
  bankAccountStartAmount?: string;
  bankAccountMinimums?: string;
  generalInflationRate?: string;
  revenueInflationRate?: string;
}

interface ForecastData {
  year: number;
  month: number;
  revenue: number;
  spending: number;
  netCashFlow: number;
  balance: number;
  status: 'red' | 'yellow' | 'green';
  inflatedIncome: number;
  inflatedExpenses: number;
}

interface BudgetForecastResponse {
  buildingId: string;
  buildingName: string;
  forecastPeriod: string;
  startingBalance: number;
  minimumFund: number;
  generalInflationRate: number;
  revenueInflationRate: number;
  baselineMonthlyIncome: number;
  baselineMonthlyExpenses: number;
  recurrentBillsCount: number;
  uniqueBillsCount: number;
  forecast: ForecastData[];
}

function BudgetInner({ organizationId, buildingId }: BudgetProps) {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Development debug logging
  const isDev = import.meta.env.MODE === 'development';
  const debugLog = (action: string, data: any) => {
    if (isDev) {
      console.log(`💰 [BUDGET PAGE DEBUG] ${action}:`, data);
    }
  };

  React.useEffect(() => {
    debugLog('Component initialized', { organizationId, buildingId });
  }, [organizationId, buildingId, debugLog]);

  // Local state for budget settings simulation
  const [localSettings, setLocalSettings] = useState<BankAccountSettings>({
    bankAccountStartAmount: 0,
    bankAccountMinimums: 0,
    generalInflationRate: 2.0,
    revenueInflationRate: 2.0,
    // Extended configuration defaults
    emergencyFundMinimum: 10000,
    reserveFundTarget: 50000,
    operatingCashMinimum: 5000,
    revenueGrowthRate: 2.5,
    revenueInflation: 2.0,
    costInflationRate: 2.0,
    utilityInflationRate: 3.0,
    maintenanceInflationRate: 2.5,
    specialInvestmentBudget: 25000,
    investmentHorizonYears: 5,
    capitalProjectReserve: 100000,
  });
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Fetch bank account settings
  const { data: bankAccountData, isLoading: bankAccountLoading, error: bankAccountError } = useQuery({
    queryKey: [`/api/budgets/${buildingId}/bank-account`],
    enabled: !!buildingId,
  });

  // Debug logging for bank account data
  React.useEffect(() => {
    if (bankAccountData) {
      debugLog('Bank account data fetched', { buildingId, data: bankAccountData });
    }
  }, [bankAccountData, buildingId, debugLog]);

  React.useEffect(() => {
    if (bankAccountError) {
      debugLog('Bank account fetch error', { buildingId, error: bankAccountError });
    }
  }, [bankAccountError, buildingId, debugLog]);

  // Initialize local settings when bank account data is loaded
  React.useEffect(() => {
    if (bankAccountData) {
      const data = bankAccountData as any; // Extended data from server
      setLocalSettings(prev => ({
        ...prev,
        // Basic fields
        bankAccountStartAmount: parseFloat(data.bankAccountStartAmount || '0'),
        bankAccountMinimums: parseFloat(data.bankAccountMinimums || '0'),
        generalInflationRate: parseFloat(data.generalInflationRate || '2.0'),
        revenueInflationRate: parseFloat(data.revenueInflationRate || '2.0'),
        // Extended configuration fields
        emergencyFundMinimum: parseFloat(data.emergencyFundMinimum || '0'),
        operatingCashMinimum: parseFloat(data.operatingCashMinimum || '0'),
        revenueGrowthRate: parseFloat(data.revenueGrowthRate || '3.0'),
        revenueInflation: parseFloat(data.revenueInflation || '2.0'),
        reserveFundTarget: parseFloat(data.reserveFundTarget || '10000'),
        utilityInflationRate: parseFloat(data.utilityInflationRate || '3.0'),
        maintenanceInflationRate: parseFloat(data.maintenanceInflationRate || '4.0'),
        costInflationRate: parseFloat(data.costInflationRate || '3.5'),
        specialInvestmentBudget: parseFloat(data.specialInvestmentBudget || '0'),
        investmentHorizonYears: parseFloat(data.investmentHorizonYears || '10'),
        capitalProjectReserve: parseFloat(data.capitalProjectReserve || '5000'),
      }));
      debugLog('Local settings initialized with extended config', { 
        basicFields: {
          bankAccountStartAmount: data.bankAccountStartAmount,
          bankAccountMinimums: data.bankAccountMinimums,
          generalInflationRate: data.generalInflationRate,
          revenueInflationRate: data.revenueInflationRate
        },
        extendedFields: {
          emergencyFundMinimum: data.emergencyFundMinimum,
          operatingCashMinimum: data.operatingCashMinimum,
          revenueGrowthRate: data.revenueGrowthRate,
          // ... truncated for brevity
        }
      });
    }
  }, [bankAccountData, debugLog]);

  // Fetch budget forecast based on current settings  
  const { data: forecastData, isLoading: forecastLoading, error: forecastError, refetch: refetchForecast } = useQuery({
    queryKey: ['budgetForecast', buildingId],
    queryFn: async () => {
      debugLog('Fetching budget forecast', { buildingId, settings: localSettings });
      const response = await apiRequest('POST', `/api/budgets/${buildingId}/forecast`, localSettings);
      const data = await response.json();
      debugLog('Budget forecast API response', { buildingId, responseStatus: response.status });
      return data as BudgetForecastResponse;
    },
    enabled: !!buildingId,
  });

  // Trigger forecast refetch when settings change (debounced)
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (buildingId) {
        debugLog('Settings changed, refetching forecast', { buildingId, settings: localSettings });
        refetchForecast();
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [localSettings, buildingId, refetchForecast, debugLog]);

  // Debug logging for forecast data and errors
  React.useEffect(() => {
    if (forecastData) {
      debugLog('Budget forecast data received', { 
        buildingId, 
        forecastLength: forecastData?.forecast?.length,
        startingBalance: forecastData?.startingBalance,
        buildingName: forecastData?.buildingName
      });
    }
  }, [forecastData, buildingId, debugLog]);

  React.useEffect(() => {
    if (forecastError) {
      debugLog('Budget forecast fetch error', { buildingId, error: forecastError });
    }
  }, [forecastError, buildingId, debugLog]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: BankAccountSettings) => {
      debugLog('Saving budget settings', { buildingId, settings });
      const response = await apiRequest('PUT', `/api/budgets/${buildingId}/bank-account`, settings);
      const data = await response.json();
      debugLog('Budget settings save response', { buildingId, responseStatus: response.status, data });
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Budget settings saved successfully',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${buildingId}/bank-account`] });
      queryClient.invalidateQueries({ queryKey: ['budgetForecast', buildingId] });
      setSettingsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save budget settings',
        variant: 'destructive',
      });
    },
  });

  const handleBackToOrganization = () => {
    navigate('/manager/budget');
  };

  const handleBackToBuilding = () => {
    navigate(`/manager/budget?organization=${organizationId}`);
  };

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate(localSettings);
  };

  // Calculate summary metrics from forecast data
  const calculateSummaryMetrics = () => {
    if (!forecastData?.forecast || forecastData.forecast.length === 0) {
      return {
        currentBalance: 0,
        monthlyIncome: 0,
        monthlySpending: 0,
        yearEndBalance: 0,
        variance: 0,
      };
    }

    const currentMonth = forecastData.forecast[0];
    const yearEndMonth = forecastData.forecast[11] || currentMonth;
    const lastYearSameMonth = forecastData.forecast[12] || currentMonth;

    return {
      currentBalance: currentMonth.balance,
      monthlyIncome: currentMonth.revenue,
      monthlySpending: currentMonth.spending,
      yearEndBalance: yearEndMonth.balance,
      variance: currentMonth.balance - lastYearSameMonth.balance,
    };
  };

  // Extract spending categories from forecast data
  const getSpendingCategories = () => {
    if (!forecastData) return [];

    // Create spending categories based on forecast data
    const categories = [
      { 
        category: 'Monthly Income', 
        budget: forecastData.baselineMonthlyIncome * 12, 
        used: forecastData.baselineMonthlyIncome * 12, 
        color: 'bg-green-500' 
      },
      { 
        category: 'Monthly Expenses', 
        budget: forecastData.baselineMonthlyExpenses * 12, 
        used: forecastData.baselineMonthlyExpenses * 12, 
        color: 'bg-red-500' 
      },
      { 
        category: 'Recurrent Bills', 
        budget: forecastData.recurrentBillsCount * 1000, 
        used: forecastData.baselineMonthlyExpenses, 
        color: 'bg-blue-500' 
      },
      { 
        category: 'Unique Bills', 
        budget: forecastData.uniqueBillsCount * 500, 
        used: forecastData.uniqueBillsCount * 300, 
        color: 'bg-purple-500' 
      },
    ];

    return categories;
  };

  // Prepare chart data (showing balance trend for first 12 months)
  const getChartData = () => {
    if (!forecastData?.forecast) return [];

    return forecastData.forecast.slice(0, 12).map((item) => ({
      month: `${item.year}-${item.month.toString().padStart(2, '0')}`,
      balance: item.balance,
      status: item.status,
      revenue: item.revenue,
      spending: item.spending,
    }));
  };

  const summaryMetrics = calculateSummaryMetrics();
  const spendingCategories = getSpendingCategories();
  const chartData = getChartData();

  // Custom chart line color based on status
  const getLineColor = (status: string) => {
    switch (status) {
      case 'red': return '#ef4444';
      case 'yellow': return '#f59e0b';
      case 'green': return '#10b981';
      default: return '#6b7280';
    }
  };

  if (!buildingId) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title={t('budgetDashboard')} subtitle={t('budgetSubtitle')} />
        <div className='flex-1 flex items-center justify-center'>
          <div className='text-center text-muted-foreground'>
            <DollarSign className='w-12 h-12 mx-auto mb-4' />
            <p>Select a building to continue</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title={t('budgetDashboard')} subtitle={t('budgetSubtitle')} />
      
      {/* Back Navigation */}
      {(organizationId || buildingId) && (
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={buildingId ? handleBackToBuilding : handleBackToOrganization}
            className="flex items-center gap-2"
            data-testid={buildingId ? "button-back-to-building" : "button-back-to-organization"}
          >
            <ArrowLeft className="w-4 h-4" />
            {buildingId ? t('building') : t('organization')}
          </Button>

          {/* Settings Dialog */}
          <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-budget-settings">
                <Settings className="w-4 h-4 mr-2" />
                {t('settings')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Budget Settings</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="startAmount" className="text-right">
                    Start Amount
                  </Label>
                  <Input
                    id="startAmount"
                    type="number"
                    value={localSettings.bankAccountStartAmount}
                    onChange={(e) =>
                      setLocalSettings(prev => ({
                        ...prev,
                        bankAccountStartAmount: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="col-span-3"
                    data-testid="input-start-amount"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="minimums" className="text-right">
                    Minimum Fund
                  </Label>
                  <Input
                    id="minimums"
                    type="number"
                    value={localSettings.bankAccountMinimums}
                    onChange={(e) =>
                      setLocalSettings(prev => ({
                        ...prev,
                        bankAccountMinimums: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="col-span-3"
                    data-testid="input-minimum-fund"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="generalInflation" className="text-right">
                    General Inflation (%)
                  </Label>
                  <Input
                    id="generalInflation"
                    type="number"
                    step="0.1"
                    value={localSettings.generalInflationRate}
                    onChange={(e) =>
                      setLocalSettings(prev => ({
                        ...prev,
                        generalInflationRate: parseFloat(e.target.value) || 2.0,
                      }))
                    }
                    className="col-span-3"
                    data-testid="input-general-inflation"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="revenueInflation" className="text-right">
                    Revenue Inflation (%)
                  </Label>
                  <Input
                    id="revenueInflation"
                    type="number"
                    step="0.1"
                    value={localSettings.revenueInflationRate}
                    onChange={(e) =>
                      setLocalSettings(prev => ({
                        ...prev,
                        revenueInflationRate: parseFloat(e.target.value) || 2.0,
                      }))
                    }
                    className="col-span-3"
                    data-testid="input-revenue-inflation"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveSettings}
                  disabled={saveSettingsMutation.isPending}
                  data-testid="button-save-settings"
                >
                  {saveSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
      
      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {forecastLoading || bankAccountLoading ? (
            <div className='flex items-center justify-center py-12'>
              <div className='text-center'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4'></div>
                <p className='text-muted-foreground'>Loading budget data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
                <Card data-testid="card-current-balance">
                  <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>Current Balance</CardTitle>
                    <DollarSign className='h-4 w-4 text-muted-foreground' />
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold'>
                      ${summaryMetrics.currentBalance.toLocaleString()}
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      <span className={summaryMetrics.variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {summaryMetrics.variance >= 0 ? '+' : ''}${summaryMetrics.variance.toLocaleString()}
                      </span> {t('fromLastYear')}
                    </p>
                  </CardContent>
                </Card>
                
                <Card data-testid="card-monthly-income">
                  <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>Monthly Income</CardTitle>
                    <TrendingUp className='h-4 w-4 text-muted-foreground' />
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold'>
                      ${summaryMetrics.monthlyIncome.toLocaleString()}
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      Baseline revenue
                    </p>
                  </CardContent>
                </Card>
                
                <Card data-testid="card-monthly-spending">
                  <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>Monthly Spending</CardTitle>
                    <Calculator className='h-4 w-4 text-muted-foreground' />
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold'>
                      ${summaryMetrics.monthlySpending.toLocaleString()}
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      {Math.round((summaryMetrics.monthlySpending / summaryMetrics.monthlyIncome) * 100)}% of income
                    </p>
                  </CardContent>
                </Card>
                
                <Card data-testid="card-year-end-projection">
                  <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>Year End Projection</CardTitle>
                    <TrendingDown className='h-4 w-4 text-muted-foreground' />
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold'>
                      ${summaryMetrics.yearEndBalance.toLocaleString()}
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      Projected balance
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Budget Categories */}
              <Card data-testid="card-budget-categories">
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <PieChart className='w-5 h-5' />
                    {t('budgetCategories')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='space-y-4'>
                    {spendingCategories.map((item) => (
                      <div key={item.category} className='flex items-center justify-between p-4 border rounded-lg'>
                        <div className='flex items-center gap-3'>
                          <div className={`w-4 h-4 rounded-full ${item.color}`}></div>
                          <div>
                            <h3 className='font-semibold'>{item.category}</h3>
                            <p className='text-sm text-gray-600'>
                              ${item.used.toLocaleString()} / ${item.budget.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant={item.used > item.budget ? 'destructive' : 'secondary'}>
                          {Math.round((item.used / item.budget) * 100)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Monthly Balance Trend Chart */}
              <Card data-testid="card-balance-trend">
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <LineChart className='w-5 h-5' />
                    Monthly Balance Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='h-64'>
                    {chartData.length > 0 ? (
                      <RechartsResponsiveContainer width="100%" height="100%">
                        <RechartsLineChart data={chartData}>
                          <RechartsCartesianGrid strokeDasharray="3 3" />
                          <RechartsXAxis dataKey="month" />
                          <RechartsYAxis />
                          <RechartsTooltip 
                            formatter={(value: any, name: string) => [
                              `$${value.toLocaleString()}`,
                              name === 'balance' ? 'Balance' : name
                            ]}
                            labelFormatter={(label) => `Month: ${label}`}
                          />
                          <RechartsLine
                            type="monotone"
                            dataKey="balance"
                            stroke="#8884d8"
                            strokeWidth={2}
                            dot={{ fill: '#8884d8', strokeWidth: 2 }}
                          />
                        </RechartsLineChart>
                      </RechartsResponsiveContainer>
                    ) : (
                      <div className='h-64 flex items-center justify-center text-gray-500'>
                        <div className='text-center'>
                          <LineChart className='w-12 h-12 mx-auto mb-4 text-gray-300' />
                          <p>No data available</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Configuration Cards */}
              <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6'>
                {/* Bank Account Configuration */}
                <Card data-testid="card-bank-account-config">
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <CreditCard className='w-5 h-5' />
                      Bank Account Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div className='space-y-2'>
                      <Label htmlFor="starting-amount">Starting Balance</Label>
                      <div className='relative'>
                        <DollarSign className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                        <Input
                          id="starting-amount"
                          type="number"
                          value={localSettings.bankAccountStartAmount}
                          onChange={(e) =>
                            setLocalSettings(prev => ({
                              ...prev,
                              bankAccountStartAmount: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="pl-9"
                          placeholder="0"
                          data-testid="input-starting-balance"
                        />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor="emergency-fund">Emergency Fund Minimum</Label>
                      <div className='relative'>
                        <PiggyBank className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                        <Input
                          id="emergency-fund"
                          type="number"
                          value={localSettings.emergencyFundMinimum}
                          onChange={(e) =>
                            setLocalSettings(prev => ({
                              ...prev,
                              emergencyFundMinimum: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="pl-9"
                          placeholder="10000"
                          data-testid="input-emergency-fund"
                        />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor="operating-cash">Operating Cash Minimum</Label>
                      <div className='relative'>
                        <Coins className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                        <Input
                          id="operating-cash"
                          type="number"
                          value={localSettings.operatingCashMinimum}
                          onChange={(e) =>
                            setLocalSettings(prev => ({
                              ...prev,
                              operatingCashMinimum: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="pl-9"
                          placeholder="5000"
                          data-testid="input-operating-cash"
                        />
                      </div>
                    </div>
                    <div className='pt-2 border-t'>
                      <div className='text-sm text-muted-foreground'>
                        Current Balance: ${summaryMetrics.currentBalance.toLocaleString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Revenue Configuration */}
                <Card data-testid="card-revenue-config">
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <TrendingUpIcon className='w-5 h-5' />
                      Revenue Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div className='space-y-2'>
                      <Label htmlFor="revenue-growth">Revenue Growth Rate (%)</Label>
                      <div className='relative'>
                        <Percent className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                        <Input
                          id="revenue-growth"
                          type="number"
                          step="0.1"
                          value={localSettings.revenueGrowthRate}
                          onChange={(e) =>
                            setLocalSettings(prev => ({
                              ...prev,
                              revenueGrowthRate: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="pl-9"
                          placeholder="2.5"
                          data-testid="input-revenue-growth"
                        />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor="revenue-inflation">Revenue Inflation Rate (%)</Label>
                      <div className='relative'>
                        <TrendingUp className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                        <Input
                          id="revenue-inflation"
                          type="number"
                          step="0.1"
                          value={localSettings.revenueInflationRate}
                          onChange={(e) =>
                            setLocalSettings(prev => ({
                              ...prev,
                              revenueInflationRate: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="pl-9"
                          placeholder="2.0"
                          data-testid="input-revenue-inflation"
                        />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor="reserve-target">Reserve Fund Target</Label>
                      <div className='relative'>
                        <Target className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                        <Input
                          id="reserve-target"
                          type="number"
                          value={localSettings.reserveFundTarget}
                          onChange={(e) =>
                            setLocalSettings(prev => ({
                              ...prev,
                              reserveFundTarget: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="pl-9"
                          placeholder="50000"
                          data-testid="input-reserve-target"
                        />
                      </div>
                    </div>
                    <div className='pt-2 border-t'>
                      <div className='text-sm text-muted-foreground'>
                        Monthly Income: ${summaryMetrics.monthlyIncome.toLocaleString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Bills Configuration */}
                <Card data-testid="card-bills-config">
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <Receipt className='w-5 h-5' />
                      Bills Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div className='grid grid-cols-2 gap-4'>
                      <div className='text-center p-3 bg-blue-50 rounded-lg'>
                        <div className='text-lg font-semibold text-blue-600'>
                          {forecastData?.recurrentBillsCount || 0}
                        </div>
                        <div className='text-sm text-blue-600'>Recurrent Bills</div>
                      </div>
                      <div className='text-center p-3 bg-purple-50 rounded-lg'>
                        <div className='text-lg font-semibold text-purple-600'>
                          {forecastData?.uniqueBillsCount || 0}
                        </div>
                        <div className='text-sm text-purple-600'>Unique Bills</div>
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label>Bill Categories</Label>
                      <div className='space-y-2'>
                        {spendingCategories.slice(2).map((category) => (
                          <div key={category.category} className='flex items-center justify-between text-sm'>
                            <span className='flex items-center gap-2'>
                              <div className={`w-2 h-2 rounded-full ${category.color}`}></div>
                              {category.category}
                            </span>
                            <span className='font-medium'>
                              ${category.used.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className='pt-2 border-t'>
                      <div className='text-sm text-muted-foreground'>
                        Total Monthly Expenses: ${summaryMetrics.monthlySpending.toLocaleString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Inflation Configuration */}
                <Card data-testid="card-inflation-config">
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <BarChart className='w-5 h-5' />
                      Inflation Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div className='space-y-2'>
                      <Label htmlFor="general-inflation">General Inflation Rate (%)</Label>
                      <div className='relative'>
                        <Percent className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                        <Input
                          id="general-inflation"
                          type="number"
                          step="0.1"
                          value={localSettings.generalInflationRate}
                          onChange={(e) =>
                            setLocalSettings(prev => ({
                              ...prev,
                              generalInflationRate: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="pl-9"
                          placeholder="2.0"
                          data-testid="input-general-inflation-rate"
                        />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor="utility-inflation">Utility Inflation Rate (%)</Label>
                      <div className='relative'>
                        <TrendingUp className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                        <Input
                          id="utility-inflation"
                          type="number"
                          step="0.1"
                          value={localSettings.utilityInflationRate}
                          onChange={(e) =>
                            setLocalSettings(prev => ({
                              ...prev,
                              utilityInflationRate: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="pl-9"
                          placeholder="3.0"
                          data-testid="input-utility-inflation"
                        />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor="maintenance-inflation">Maintenance Inflation Rate (%)</Label>
                      <div className='relative'>
                        <Building className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                        <Input
                          id="maintenance-inflation"
                          type="number"
                          step="0.1"
                          value={localSettings.maintenanceInflationRate}
                          onChange={(e) =>
                            setLocalSettings(prev => ({
                              ...prev,
                              maintenanceInflationRate: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="pl-9"
                          placeholder="2.5"
                          data-testid="input-maintenance-inflation"
                        />
                      </div>
                    </div>
                    <div className='pt-2 border-t'>
                      <div className='text-sm text-muted-foreground'>
                        Affects future cost projections
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Special Capital Investment */}
                <Card data-testid="card-capital-investment" className='lg:col-span-2 xl:col-span-1'>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <Building2 className='w-5 h-5' />
                      Special Capital Investment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div className='space-y-2'>
                      <Label htmlFor="investment-budget">Investment Budget</Label>
                      <div className='relative'>
                        <DollarSign className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                        <Input
                          id="investment-budget"
                          type="number"
                          value={localSettings.specialInvestmentBudget}
                          onChange={(e) =>
                            setLocalSettings(prev => ({
                              ...prev,
                              specialInvestmentBudget: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="pl-9"
                          placeholder="25000"
                          data-testid="input-investment-budget"
                        />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor="investment-horizon">Investment Horizon (Years)</Label>
                      <div className='relative'>
                        <FileText className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                        <Input
                          id="investment-horizon"
                          type="number"
                          value={localSettings.investmentHorizonYears}
                          onChange={(e) =>
                            setLocalSettings(prev => ({
                              ...prev,
                              investmentHorizonYears: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="pl-9"
                          placeholder="5"
                          data-testid="input-investment-horizon"
                        />
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor="capital-reserve">Capital Project Reserve</Label>
                      <div className='relative'>
                        <PiggyBank className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                        <Input
                          id="capital-reserve"
                          type="number"
                          value={localSettings.capitalProjectReserve}
                          onChange={(e) =>
                            setLocalSettings(prev => ({
                              ...prev,
                              capitalProjectReserve: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="pl-9"
                          placeholder="100000"
                          data-testid="input-capital-reserve"
                        />
                      </div>
                    </div>
                    <div className='pt-2 border-t'>
                      <div className='text-sm text-muted-foreground'>
                        Plan for major capital improvements
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Wrap with hierarchical selection HOC using 2-level hierarchy (organization → building)
const Budget = withHierarchicalSelection(BudgetInner, {
  hierarchy: ['organization', 'building']
});

export default Budget;