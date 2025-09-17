import React, { useState } from 'react';
import { Header } from '@/components/layout/header';
import { useLanguage } from '@/hooks/use-language';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
  PiggyBank,
  Filter,
  Eye,
  EyeOff,
  Calendar,
  ChevronDown
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

interface BudgetFilters {
  viewType: 'month' | 'year';
  periodLength: number; // months for month view, years for year view
  startMonth?: number;
  startYear?: number;
  dataVisibility: {
    revenue: boolean;
    spending: boolean;
    balance: boolean;
    netCashFlow: boolean;
  };
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
  }, [organizationId, buildingId]);

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

  // Filter state management
  const [filters, setFilters] = useState<BudgetFilters>({
    viewType: 'month',
    periodLength: 12, // Default to 12 months
    startMonth: new Date().getMonth() + 1, // Current month (1-12)
    startYear: new Date().getFullYear(),
    dataVisibility: {
      revenue: true,
      spending: true,
      balance: true,
      netCashFlow: false,
    },
  });

  // Fetch bank account settings
  const { data: bankAccountData, isLoading: bankAccountLoading, error: bankAccountError } = useQuery({
    queryKey: [`/api/budgets/${buildingId}/bank-account`],
    enabled: !!buildingId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Debug logging for bank account data
  React.useEffect(() => {
    if (bankAccountData) {
      debugLog('Bank account data fetched', { buildingId, data: bankAccountData });
    }
  }, [bankAccountData, buildingId]);

  React.useEffect(() => {
    if (bankAccountError) {
      debugLog('Bank account fetch error', { buildingId, error: bankAccountError });
    }
  }, [bankAccountError, buildingId]);

  // Initialize local settings when bank account data is loaded
  React.useEffect(() => {
    if (!bankAccountData) return;
    
    const data = bankAccountData as any; // Extended data from server
    const nextSettings = {
      // Basic fields
      bankAccountStartAmount: parseFloat(data.bankAccountStartAmount || '0'),
      bankAccountMinimums: parseFloat(data.bankAccountMinimums || '0'),
      generalInflationRate: parseFloat(data.generalInflationRate || '2.0'),
      revenueInflationRate: parseFloat(data.revenueInflationRate || '2.0'),
      // Extended configuration fields
      emergencyFundMinimum: parseFloat(data.emergencyFundMinimum || '10000'),
      operatingCashMinimum: parseFloat(data.operatingCashMinimum || '5000'),
      revenueGrowthRate: parseFloat(data.revenueGrowthRate || '2.5'),
      revenueInflation: parseFloat(data.revenueInflation || '2.0'),
      reserveFundTarget: parseFloat(data.reserveFundTarget || '50000'),
      utilityInflationRate: parseFloat(data.utilityInflationRate || '3.0'),
      maintenanceInflationRate: parseFloat(data.maintenanceInflationRate || '2.5'),
      costInflationRate: parseFloat(data.costInflationRate || '2.0'),
      specialInvestmentBudget: parseFloat(data.specialInvestmentBudget || '25000'),
      investmentHorizonYears: parseFloat(data.investmentHorizonYears || '5'),
      capitalProjectReserve: parseFloat(data.capitalProjectReserve || '100000'),
    };
    
    // Only update if data has actually changed to prevent infinite loops
    setLocalSettings(prev => {
      const hasChanged = JSON.stringify({
        bankAccountStartAmount: prev.bankAccountStartAmount,
        bankAccountMinimums: prev.bankAccountMinimums,
        generalInflationRate: prev.generalInflationRate,
        revenueInflationRate: prev.revenueInflationRate,
        emergencyFundMinimum: prev.emergencyFundMinimum,
        operatingCashMinimum: prev.operatingCashMinimum,
        revenueGrowthRate: prev.revenueGrowthRate,
        revenueInflation: prev.revenueInflation,
        reserveFundTarget: prev.reserveFundTarget,
        utilityInflationRate: prev.utilityInflationRate,
        maintenanceInflationRate: prev.maintenanceInflationRate,
        costInflationRate: prev.costInflationRate,
        specialInvestmentBudget: prev.specialInvestmentBudget,
        investmentHorizonYears: prev.investmentHorizonYears,
        capitalProjectReserve: prev.capitalProjectReserve,
      }) !== JSON.stringify(nextSettings);
      
      if (!hasChanged) return prev;
      
      debugLog('Local settings updated from server data', {});
      return { ...prev, ...nextSettings };
    });
  }, [bankAccountData]);

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
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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
  }, [localSettings, buildingId]);

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
  }, [forecastData, buildingId]);

  React.useEffect(() => {
    if (forecastError) {
      debugLog('Budget forecast fetch error', { buildingId, error: forecastError });
    }
  }, [forecastError, buildingId]);

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

  // Calculate summary metrics from forecast data with filters applied
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

    // Calculate start index based on start date selection
    let startIndex = 0;
    if (filters.startMonth && filters.startYear) {
      const startDate = new Date(filters.startYear, filters.startMonth - 1, 1);
      startIndex = forecastData.forecast.findIndex(item => {
        const itemDate = new Date(item.year, item.month - 1, 1);
        return itemDate >= startDate;
      });
      if (startIndex === -1) startIndex = 0; // fallback if not found
    }

    // Apply filter period window (start + length)
    const maxPeriods = filters.viewType === 'month' ? filters.periodLength : filters.periodLength * 12;
    const endIndex = Math.min(startIndex + maxPeriods, forecastData.forecast.length);
    const filteredData = forecastData.forecast.slice(startIndex, endIndex);

    if (filteredData.length === 0) {
      return {
        currentBalance: 0,
        monthlyIncome: 0,
        monthlySpending: 0,
        yearEndBalance: 0,
        variance: 0,
      };
    }

    const currentMonth = filteredData[0];
    const lastPeriod = filteredData[filteredData.length - 1] || currentMonth;
    
    // Calculate variance using aligned prior-year period within selected window
    let priorYearBalance = 0;
    const priorYearIndex = startIndex - 12; // 12 months ago from current start
    if (priorYearIndex >= 0 && priorYearIndex < forecastData.forecast.length) {
      priorYearBalance = forecastData.forecast[priorYearIndex].balance;
    } else {
      // Fallback: use baseline starting balance if no prior year data
      priorYearBalance = forecastData.startingBalance;
    }

    return {
      currentBalance: currentMonth.balance,
      monthlyIncome: currentMonth.revenue,
      monthlySpending: currentMonth.spending,
      yearEndBalance: lastPeriod.balance,
      variance: currentMonth.balance - priorYearBalance,
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

  // Prepare chart data with filters applied
  const getChartData = () => {
    if (!forecastData?.forecast) return [];

    // Calculate start index based on start date selection
    let startIndex = 0;
    if (filters.startMonth && filters.startYear) {
      const startDate = new Date(filters.startYear, filters.startMonth - 1, 1);
      startIndex = forecastData.forecast.findIndex(item => {
        const itemDate = new Date(item.year, item.month - 1, 1);
        return itemDate >= startDate;
      });
      if (startIndex === -1) startIndex = 0; // fallback if not found
    }

    // Apply filter period window (start + length)
    const maxPeriods = filters.viewType === 'month' ? filters.periodLength : filters.periodLength * 12;
    const endIndex = Math.min(startIndex + maxPeriods, forecastData.forecast.length);
    const filteredData = forecastData.forecast.slice(startIndex, endIndex);

    if (filters.viewType === 'year') {
      // Group monthly data into yearly data
      const yearlyData: { [key: number]: { 
        revenue: number; 
        spending: number; 
        balance: number; 
        netCashFlow: number; 
        count: number 
      } } = {};

      filteredData.forEach((item) => {
        if (!yearlyData[item.year]) {
          yearlyData[item.year] = { revenue: 0, spending: 0, balance: 0, netCashFlow: 0, count: 0 };
        }
        yearlyData[item.year].revenue += item.revenue;
        yearlyData[item.year].spending += item.spending;
        yearlyData[item.year].netCashFlow += item.netCashFlow;
        yearlyData[item.year].count++;
        // Use last month's balance for the year
        yearlyData[item.year].balance = item.balance;
      });

      // Sort yearly data chronologically after Object.entries
      return Object.entries(yearlyData)
        .sort(([yearA], [yearB]) => parseInt(yearA) - parseInt(yearB))
        .map(([year, data]) => ({
          month: year,
          balance: data.balance,
          revenue: data.revenue,
          spending: data.spending,
          netCashFlow: data.netCashFlow,
          status: 'green' as const, // TODO: Calculate status based on yearly data
        }));
    }

    // Monthly view with individual months
    return filteredData.map((item) => ({
      month: `${item.year}-${item.month.toString().padStart(2, '0')}`,
      balance: item.balance,
      status: item.status,
      revenue: item.revenue,
      spending: item.spending,
      netCashFlow: item.netCashFlow,
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

      {/* Comprehensive Filter Controls */}
      <div className="p-4 border-b border-gray-200 bg-gray-50/50">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Filter Header */}
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold text-lg">Budget Filters</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* View Toggle Section */}
            <Card className="p-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  View Type
                </Label>
                <Select 
                  value={filters.viewType} 
                  onValueChange={(value: 'month' | 'year') => {
                    setFilters(prev => ({
                      ...prev,
                      viewType: value,
                      periodLength: value === 'month' ? 12 : 5, // Reset to default
                    }));
                  }}
                >
                  <SelectTrigger data-testid="select-view-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monthly View</SelectItem>
                    <SelectItem value="year">Yearly View</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Period Window Section */}
            <Card className="p-4">
              <div className="space-y-4">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <ChevronDown className="w-4 h-4" />
                  Period Window
                </Label>
                
                {/* Start Date Selection */}
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground">Start Date</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {filters.viewType === 'month' && (
                      <Select 
                        value={filters.startMonth?.toString() || ''} 
                        onValueChange={(value) => {
                          setFilters(prev => ({
                            ...prev,
                            startMonth: parseInt(value) || 1,
                          }));
                        }}
                      >
                        <SelectTrigger data-testid="select-start-month">
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                            <SelectItem key={month} value={month.toString()}>
                              {new Date(2024, month - 1, 1).toLocaleDateString('en-US', { month: 'short' })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Select 
                      value={filters.startYear?.toString() || ''} 
                      onValueChange={(value) => {
                        setFilters(prev => ({
                          ...prev,
                          startYear: parseInt(value) || new Date().getFullYear(),
                        }));
                      }}
                    >
                      <SelectTrigger data-testid="select-start-year">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({length: 10}, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Period Length */}
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground">Length</Label>
                  <div className="flex items-center gap-2">
                    <Select 
                      value={filters.periodLength.toString()} 
                      onValueChange={(value) => {
                        setFilters(prev => ({
                          ...prev,
                          periodLength: parseInt(value),
                        }));
                      }}
                    >
                      <SelectTrigger data-testid="select-period-length">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {filters.viewType === 'month' ? (
                          <>
                            <SelectItem value="6">6 months</SelectItem>
                            <SelectItem value="12">12 months</SelectItem>
                            <SelectItem value="18">18 months</SelectItem>
                            <SelectItem value="24">24 months</SelectItem>
                            <SelectItem value="36">36 months</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="1">1 year</SelectItem>
                            <SelectItem value="2">2 years</SelectItem>
                            <SelectItem value="3">3 years</SelectItem>
                            <SelectItem value="5">5 years</SelectItem>
                            <SelectItem value="10">10 years</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">
                      {filters.viewType === 'month' ? 'months' : 'years'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Data Visibility Toggles Section */}
            <Card className="p-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Data Visibility
                </Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-revenue" className="text-sm cursor-pointer flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      Revenue
                    </Label>
                    <Switch 
                      id="toggle-revenue"
                      checked={filters.dataVisibility.revenue}
                      onCheckedChange={(checked) => {
                        setFilters(prev => ({
                          ...prev,
                          dataVisibility: { ...prev.dataVisibility, revenue: checked },
                        }));
                      }}
                      data-testid="switch-revenue-visibility"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-spending" className="text-sm cursor-pointer flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-500" />
                      Spending
                    </Label>
                    <Switch 
                      id="toggle-spending"
                      checked={filters.dataVisibility.spending}
                      onCheckedChange={(checked) => {
                        setFilters(prev => ({
                          ...prev,
                          dataVisibility: { ...prev.dataVisibility, spending: checked },
                        }));
                      }}
                      data-testid="switch-spending-visibility"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-balance" className="text-sm cursor-pointer flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-blue-500" />
                      Balance
                    </Label>
                    <Switch 
                      id="toggle-balance"
                      checked={filters.dataVisibility.balance}
                      onCheckedChange={(checked) => {
                        setFilters(prev => ({
                          ...prev,
                          dataVisibility: { ...prev.dataVisibility, balance: checked },
                        }));
                      }}
                      data-testid="switch-balance-visibility"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-cashflow" className="text-sm cursor-pointer flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-purple-500" />
                      Net Cash Flow
                    </Label>
                    <Switch 
                      id="toggle-cashflow"
                      checked={filters.dataVisibility.netCashFlow}
                      onCheckedChange={(checked) => {
                        setFilters(prev => ({
                          ...prev,
                          dataVisibility: { ...prev.dataVisibility, netCashFlow: checked },
                        }));
                      }}
                      data-testid="switch-cashflow-visibility"
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Filter Status Summary */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
            <span>
              Showing: <Badge variant="secondary">{filters.periodLength} {filters.viewType === 'month' ? 'months' : 'years'}</Badge>
            </span>
            <Separator orientation="vertical" className="h-4" />
            <span>
              Data: {Object.entries(filters.dataVisibility).filter(([_, visible]) => visible).length} of 4 categories visible
            </span>
          </div>
        </div>
      </div>
      
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

              {/* Enhanced Multi-Series Chart with Visibility Toggles */}
              <Card data-testid="card-enhanced-trend-chart">
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <LineChart className='w-5 h-5' />
                    Budget Trend Analysis - {filters.viewType === 'month' ? 'Monthly' : 'Yearly'} View
                  </CardTitle>
                  <div className='text-sm text-muted-foreground'>
                    Showing {filters.periodLength} {filters.viewType === 'month' ? 'months' : 'years'}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Visible Data Series Legend */}
                  <div className="flex flex-wrap gap-4 mb-4 p-3 bg-gray-50 rounded-lg" data-testid="chart-legend">
                    {filters.dataVisibility.balance && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="text-sm font-medium">Balance</span>
                      </div>
                    )}
                    {filters.dataVisibility.revenue && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-sm font-medium">Revenue</span>
                      </div>
                    )}
                    {filters.dataVisibility.spending && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-sm font-medium">Spending</span>
                      </div>
                    )}
                    {filters.dataVisibility.netCashFlow && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                        <span className="text-sm font-medium">Net Cash Flow</span>
                      </div>
                    )}
                  </div>

                  <div className='h-80'>
                    {chartData.length > 0 ? (
                      <RechartsResponsiveContainer width="100%" height="100%">
                        <RechartsLineChart data={chartData}>
                          <RechartsCartesianGrid strokeDasharray="3 3" />
                          <RechartsXAxis dataKey="month" />
                          <RechartsYAxis />
                          <RechartsTooltip 
                            formatter={(value: any, name: string) => {
                              const formattedValue = `$${Math.abs(value).toLocaleString()}${value < 0 ? ' (deficit)' : ''}`;
                              const nameMapping: { [key: string]: string } = {
                                balance: 'Balance',
                                revenue: 'Revenue', 
                                spending: 'Spending',
                                netCashFlow: 'Net Cash Flow'
                              };
                              return [formattedValue, nameMapping[name] || name];
                            }}
                            labelFormatter={(label) => `Period: ${label}`}
                          />
                          
                          {/* Balance Line - Blue */}
                          {filters.dataVisibility.balance && (
                            <RechartsLine
                              type="monotone"
                              dataKey="balance"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                              name="balance"
                            />
                          )}
                          
                          {/* Revenue Line - Green */}
                          {filters.dataVisibility.revenue && (
                            <RechartsLine
                              type="monotone"
                              dataKey="revenue"
                              stroke="#10b981"
                              strokeWidth={2}
                              dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                              name="revenue"
                            />
                          )}
                          
                          {/* Spending Line - Red */}
                          {filters.dataVisibility.spending && (
                            <RechartsLine
                              type="monotone"
                              dataKey="spending"
                              stroke="#ef4444"
                              strokeWidth={2}
                              dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                              name="spending"
                            />
                          )}
                          
                          {/* Net Cash Flow Line - Purple */}
                          {filters.dataVisibility.netCashFlow && (
                            <RechartsLine
                              type="monotone"
                              dataKey="netCashFlow"
                              stroke="#8b5cf6"
                              strokeWidth={2}
                              dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                              name="netCashFlow"
                            />
                          )}
                        </RechartsLineChart>
                      </RechartsResponsiveContainer>
                    ) : (
                      <div className='h-80 flex items-center justify-center text-gray-500'>
                        <div className='text-center'>
                          <LineChart className='w-12 h-12 mx-auto mb-4 text-gray-300' />
                          <p>No data available for selected filters</p>
                          <p className='text-sm'>Try adjusting your filter settings</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Chart Controls and Information */}
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg" data-testid="chart-info">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className="font-medium">
                          Displaying: {chartData.length} {filters.viewType === 'month' ? 'months' : 'years'}
                        </span>
                        <span className="text-muted-foreground">
                          View: {filters.viewType === 'month' ? 'Monthly' : 'Yearly'}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        {Object.values(filters.dataVisibility).filter(Boolean).length} of 4 series visible
                      </div>
                    </div>
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