import React, { useState, useMemo } from 'react';
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
import { Residence } from '@shared/schema';
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
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  LineChart as RechartsLineChart,
  Line as RechartsLine,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  CartesianGrid as RechartsCartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer as RechartsResponsiveContainer,
  ReferenceLine as RechartsReferenceLine
} from 'recharts';

interface BudgetProps {
  organizationId?: string;
  buildingId?: string;
}

interface BankAccountSettings {
  bankAccountStartAmount?: number;
  bankAccountStartDate?: string;
  bankAccountMinimums?: number;
  generalInflationRate?: number;
  // Extended configuration options
  emergencyFundMinimum?: number;
  operatingCashMinimum?: number;
  revenueGrowthRate?: number;
  costInflationRate?: number;
  utilityInflationRate?: number;
  maintenanceInflationRate?: number;
  specialInvestmentBudget?: number;
  investmentHorizonYears?: number;
  capitalProjectReserve?: number;
  // Bills configuration options
  useGlobalBillsInflation?: boolean;
  globalBillsInflationRate?: number;
  unplannedBillsAmount?: number;
  // Per-category inflation rates (used when useGlobalBillsInflation is false)
  categoryInflationRates?: {
    utilities?: number;
    maintenance?: number;
    general?: number;
    other?: number;
  };
  // Custom bank fields as dynamic key-value pairs
  customBankFields?: { [fieldName: string]: number };
}

interface BankAccountData {
  bankAccountStartAmount?: string;
  bankAccountStartDate?: string;
  bankAccountMinimums?: string;
  generalInflationRate?: string;
  bankAccountUpdatedAt?: string;
}

interface ForecastData {
  year: number;
  month: number;
  revenue: number;
  spending: number;
  netCashFlow: number;
  balance: number;
  capitalInvestment: number;
  status: 'red' | 'yellow' | 'green';
  inflatedIncome: number;
  inflatedRecurringExpenses: number;
  inflatedUnplannedBills: number;
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
    capitalInvestments: boolean;
    minimumRequirement: boolean;
  };
}

interface CustomRevenueLine {
  id: string;
  description: string;
  monthlyAmount: number;
}

interface CustomBankAccountField {
  id: string;
  fieldName: string;
  fieldValue: number;
}

interface RevenueData {
  residenceRevenue: number;
  customRevenueLines: CustomRevenueLine[];
  totalRevenue: number;
}

interface CapitalInvestment {
  id: string;
  title: string;
  description?: string;
  amount: number;
  targetDate: string; // ISO date string
  urgency: 'not_urgent' | 'urgent' | 'suggested';
  type: 'auto_generated' | 'custom';
  ownershipType: 'residences' | 'owner';
  category?: string;
  createdAt?: string;
}

interface InvestmentFilters {
  urgency?: 'not_urgent' | 'urgent' | 'suggested' | 'all';
}

interface InvestmentSummary {
  totalAmount: number;
  urgentAmount: number;
  suggestedAmount: number;
  notUrgentAmount: number;
  count: number;
  urgentCount: number;
  suggestedCount: number;
  notUrgentCount: number;
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
    bankAccountStartDate: new Date().toISOString().split('T')[0], // Default to today
    bankAccountMinimums: 0,
    generalInflationRate: 2.0,
    // Extended configuration defaults
    emergencyFundMinimum: 10000,
    operatingCashMinimum: 5000,
    revenueGrowthRate: 2.5,
    costInflationRate: 2.0,
    utilityInflationRate: 3.0,
    maintenanceInflationRate: 2.5,
    specialInvestmentBudget: 25000,
    investmentHorizonYears: 5,
    capitalProjectReserve: 100000,
    // Bills configuration defaults
    useGlobalBillsInflation: true,
    globalBillsInflationRate: 2.5,
    unplannedBillsAmount: 0,
    categoryInflationRates: {
      utilities: 3.0,
      maintenance: 2.5,
      general: 2.0,
      other: 2.0,
    },
  });

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
      capitalInvestments: true,
      minimumRequirement: true,
    },
  });
  
  // Budget filters collapsible state
  const [filtersCollapsed, setFiltersCollapsed] = useState(() => {
    const saved = localStorage.getItem('budget-filters-collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  
  // Save collapsed state to localStorage
  React.useEffect(() => {
    localStorage.setItem('budget-filters-collapsed', JSON.stringify(filtersCollapsed));
  }, [filtersCollapsed]);

  // Custom revenue lines state
  const [customRevenueLines, setCustomRevenueLines] = useState<CustomRevenueLine[]>([]);
  const [newRevenueLine, setNewRevenueLine] = useState<{description: string; monthlyAmount: string}>({
    description: '',
    monthlyAmount: ''
  });

  // Custom bank account fields state - managed separately for UI but synced with localSettings
  const [customBankFields, setCustomBankFields] = useState<CustomBankAccountField[]>([]);
  const [newBankField, setNewBankField] = useState<{fieldName: string; fieldValue: string}>({
    fieldName: '',
    fieldValue: ''
  });

  // Capital investments state management
  const [capitalInvestments, setCapitalInvestments] = useState<CapitalInvestment[]>([]);
  const [capitalInvestmentMode, setCapitalInvestmentMode] = useState<'urgent' | 'suggested'>('suggested');
  const [investmentFilters, setInvestmentFilters] = useState<InvestmentFilters>({
    urgency: 'all',
  });
  const [newInvestment, setNewInvestment] = useState<{
    title: string;
    description: string;
    amount: string;
    targetDate: string;
    urgency: 'not_urgent' | 'urgent' | 'suggested';
    ownershipType: 'residences' | 'owner';
  }>({
    title: '',
    description: '',
    amount: '',
    targetDate: '',
    urgency: 'not_urgent',
    ownershipType: 'residences',
  });
  const [editingInvestment, setEditingInvestment] = useState<CapitalInvestment | null>(null);
  const [addInvestmentDialogOpen, setAddInvestmentDialogOpen] = useState(false);
  const [editInvestmentDialogOpen, setEditInvestmentDialogOpen] = useState(false);

  // Fetch bank account settings
  const { data: bankAccountData, isLoading: bankAccountLoading, error: bankAccountError } = useQuery({
    queryKey: [`/api/budgets/${buildingId}/bank-account`],
    enabled: !!buildingId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Fetch residences for the building
  const { data: residences = [], isLoading: residencesLoading, error: residencesError } = useQuery<Residence[]>({
    queryKey: ['/api/buildings', buildingId, 'residences'],
    enabled: !!buildingId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Fetch capital investments for the building
  const { data: serverInvestments, isLoading: investmentsLoading, error: investmentsError } = useQuery<CapitalInvestment[]>({
    queryKey: [`/api/budgets/${buildingId}/investments`],
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

  // Debug logging for capital investments data
  React.useEffect(() => {
    if (serverInvestments) {
      debugLog('Capital investments data fetched', { buildingId, count: serverInvestments.length });
    }
  }, [serverInvestments, buildingId]);

  React.useEffect(() => {
    if (investmentsError) {
      debugLog('Capital investments fetch error', { buildingId, error: investmentsError });
    }
  }, [investmentsError, buildingId]);

  // Initialize local settings when bank account data is loaded
  React.useEffect(() => {
    if (!bankAccountData) return;
    
    const data = bankAccountData as any; // Extended data from server
    
    // Helper function to safely parse numeric values, preserving 0
    const parseNumericValue = (value: any, defaultValue: number): number => {
      if (value === null || value === undefined || value === '') return defaultValue;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : defaultValue;
    };

    // Helper function to safely parse boolean values from various formats
    const parseBooleanValue = (value: any, defaultValue: boolean): boolean => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const normalized = value.toLowerCase().trim();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
      }
      return defaultValue;
    };
    
    const nextSettings = {
      // Basic fields with safe parsing that preserves zero values
      bankAccountStartAmount: parseNumericValue(data.bankAccountStartAmount, 0),
      bankAccountStartDate: data.bankAccountStartDate || new Date().toISOString().split('T')[0],
      bankAccountMinimums: parseNumericValue(data.bankAccountMinimums, 0),
      generalInflationRate: parseNumericValue(data.generalInflationRate, 2.0),
      // Extended configuration fields with safe parsing
      emergencyFundMinimum: parseNumericValue(data.emergencyFundMinimum, 10000),
      operatingCashMinimum: parseNumericValue(data.operatingCashMinimum, 5000),
      revenueGrowthRate: parseNumericValue(data.revenueGrowthRate, 2.5),
      utilityInflationRate: parseNumericValue(data.utilityInflationRate, 3.0),
      maintenanceInflationRate: parseNumericValue(data.maintenanceInflationRate, 2.5),
      costInflationRate: parseNumericValue(data.costInflationRate, 2.0),
      specialInvestmentBudget: parseNumericValue(data.specialInvestmentBudget, 25000),
      investmentHorizonYears: parseNumericValue(data.investmentHorizonYears, 5),
      capitalProjectReserve: parseNumericValue(data.capitalProjectReserve, 100000),
      // Bills configuration fields with safe parsing that preserves zero values
      useGlobalBillsInflation: parseBooleanValue(data.useGlobalBillsInflation, true),
      globalBillsInflationRate: parseNumericValue(data.globalBillsInflationRate, 2.5),
      unplannedBillsAmount: parseNumericValue(data.unplannedBillsAmount, 0),
      categoryInflationRates: {
        utilities: parseNumericValue(data.categoryInflationRates?.utilities, 3.0),
        maintenance: parseNumericValue(data.categoryInflationRates?.maintenance, 2.5),
        general: parseNumericValue(data.categoryInflationRates?.general, 2.0),
        other: parseNumericValue(data.categoryInflationRates?.other, 2.0),
      },
      // Include custom bank fields for persistence
      customBankFields: data.customBankFields || {},
    };
    
    // Only update if data has actually changed to prevent infinite loops
    setLocalSettings(prev => {
      const hasChanged = JSON.stringify({
        bankAccountStartAmount: prev.bankAccountStartAmount,
        bankAccountStartDate: prev.bankAccountStartDate,
        bankAccountMinimums: prev.bankAccountMinimums,
        generalInflationRate: prev.generalInflationRate,
        emergencyFundMinimum: prev.emergencyFundMinimum,
        operatingCashMinimum: prev.operatingCashMinimum,
        revenueGrowthRate: prev.revenueGrowthRate,
        utilityInflationRate: prev.utilityInflationRate,
        maintenanceInflationRate: prev.maintenanceInflationRate,
        costInflationRate: prev.costInflationRate,
        specialInvestmentBudget: prev.specialInvestmentBudget,
        investmentHorizonYears: prev.investmentHorizonYears,
        capitalProjectReserve: prev.capitalProjectReserve,
        useGlobalBillsInflation: prev.useGlobalBillsInflation,
        globalBillsInflationRate: prev.globalBillsInflationRate,
        unplannedBillsAmount: prev.unplannedBillsAmount,
        categoryInflationRates: prev.categoryInflationRates,
        customBankFields: prev.customBankFields,
      }) !== JSON.stringify(nextSettings);
      
      if (!hasChanged) return prev;
      
      debugLog('Local settings updated from server data', {});
      return { ...prev, ...nextSettings };
    });
    
    // Initialize custom bank fields from server data
    if (data.customBankFields) {
      // Always include core fields first
      const coreFields = [
        { 
          id: 'emergency-fund', 
          fieldName: 'Emergency Fund Minimum', 
          fieldValue: parseFloat(data.emergencyFundMinimum || '10000') || 10000 
        },
        { 
          id: 'operating-cash', 
          fieldName: 'Operating Cash Minimum', 
          fieldValue: parseFloat(data.operatingCashMinimum || '5000') || 5000 
        },
      ];
      
      // Add custom fields from server
      const customFieldsFromServer = Object.entries(data.customBankFields)
        .filter(([name]) => name !== 'Emergency Fund Minimum' && name !== 'Operating Cash Minimum')
        .map(([name, value], index) => ({
          id: `server-field-${index}`,
          fieldName: name,
          fieldValue: parseFloat(String(value)) || 0,
        }));
        
      const allFields = [...coreFields, ...customFieldsFromServer];
      setCustomBankFields(allFields);
      // Initial sync to ensure localSettings are updated
      setTimeout(() => {
        syncCustomFieldsToLocalSettings(allFields);
      }, 0);
    } else {
      // Initialize with core required fields if no custom fields from server
      const coreFields = [
        { 
          id: 'emergency-fund', 
          fieldName: 'Emergency Fund Minimum', 
          fieldValue: parseFloat(data.emergencyFundMinimum || '10000') || 10000 
        },
        { 
          id: 'operating-cash', 
          fieldName: 'Operating Cash Minimum', 
          fieldValue: parseFloat(data.operatingCashMinimum || '5000') || 5000 
        },
      ];
      setCustomBankFields(coreFields);
      // Initial sync to ensure localSettings are updated
      setTimeout(() => {
        syncCustomFieldsToLocalSettings(coreFields);
      }, 0);
    }
    
    // Initialize custom revenue lines from server data
    if (data.customRevenueLines && Array.isArray(data.customRevenueLines)) {
      setCustomRevenueLines(data.customRevenueLines);
      debugLog('Custom revenue lines loaded from server', { count: data.customRevenueLines.length });
    } else {
      // Initialize with empty array if no custom revenue lines from server
      setCustomRevenueLines([]);
    }
  }, [bankAccountData]);

  // Initialize capital investments from server data
  React.useEffect(() => {
    if (serverInvestments && Array.isArray(serverInvestments)) {
      // Filter custom investments only (auto-generated will be recreated)
      const customInvestments = serverInvestments.filter(inv => inv.type === 'custom');
      setCapitalInvestments(prev => {
        // Keep any auto-generated investments from current session
        const autoGenerated = prev.filter(inv => inv.type === 'auto_generated');
        return [...customInvestments, ...autoGenerated];
      });
      debugLog('Capital investments initialized from server', { count: customInvestments.length });
    }
  }, [serverInvestments]);

  // Fetch budget forecast based on current settings  
  const { data: forecastData, isLoading: forecastLoading, error: forecastError, refetch: refetchForecast } = useQuery({
    queryKey: ['budgetForecast', buildingId, capitalInvestmentMode],
    queryFn: async () => {
      const requestData = { ...localSettings, capitalInvestmentMode };
      debugLog('Fetching budget forecast', { buildingId, settings: localSettings, capitalInvestmentMode });
      const response = await apiRequest('POST', `/api/budgets/${buildingId}/forecast`, requestData);
      const data = await response.json();
      debugLog('Budget forecast API response', { buildingId, responseStatus: response.status, mode: capitalInvestmentMode });
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
        debugLog('Settings changed, refetching forecast', { buildingId, settings: localSettings, capitalInvestmentMode });
        refetchForecast();
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [localSettings, capitalInvestmentMode, buildingId, refetchForecast]);

  // Sync custom bank fields with localSettings whenever they change
  React.useEffect(() => {
    if (customBankFields.length > 0) {
      syncCustomFieldsToLocalSettings(customBankFields);
      debugLog('Custom bank fields changed, syncing to localSettings', { customBankFields });
    }
  }, [customBankFields]);

  // CRITICAL FIX: Sync filters.periodLength to localSettings.investmentHorizonYears when in yearly view
  React.useEffect(() => {
    if (filters.viewType === 'year' && filters.periodLength !== localSettings.investmentHorizonYears) {
      setLocalSettings(prev => ({
        ...prev,
        investmentHorizonYears: filters.periodLength,
      }));
      debugLog('Syncing periodLength to investmentHorizonYears via useEffect', { 
        periodLength: filters.periodLength,
        viewType: filters.viewType,
        previousInvestmentHorizonYears: localSettings.investmentHorizonYears
      });
    }
  }, [filters.periodLength, filters.viewType, localSettings.investmentHorizonYears]);

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


  // Save bank account settings mutation
  const saveBankAccountMutation = useMutation({
    mutationFn: async () => {
      debugLog('Saving bank account settings', { buildingId, settings: localSettings });
      
      // Calculate what will be sent to prevent double-counting
      const coreFieldsTotal = (localSettings.emergencyFundMinimum || 0) + (localSettings.operatingCashMinimum || 0);
      const customFieldsOnly = customBankFields
        .filter(field => 
          field.fieldName !== 'Emergency Fund Minimum' && 
          field.fieldName !== 'Operating Cash Minimum'
        );
      const customFieldsTotal = customFieldsOnly.reduce((total, field) => total + field.fieldValue, 0);
      const expectedBackendTotal = coreFieldsTotal + customFieldsTotal;
      
      debugLog('Minimum Requirement Calculation Debug', {
        emergencyFundMinimum: localSettings.emergencyFundMinimum,
        operatingCashMinimum: localSettings.operatingCashMinimum,
        coreFieldsTotal,
        customFieldsOnly: customFieldsOnly.length,
        customFieldsTotal,
        expectedBackendTotal,
        uiDisplayTotal: customBankFields.reduce((total, field) => total + field.fieldValue, 0)
      });
      
      const bankAccountPayload = {
        ...localSettings,
        // Exclude Emergency Fund and Operating Cash from customBankFields to prevent double-counting
        // since they're already included as separate emergencyFundMinimum and operatingCashMinimum fields
        customBankFields: customFieldsOnly.reduce((acc, field) => {
          acc[field.fieldName] = field.fieldValue;
          return acc;
        }, {} as { [key: string]: number })
      };
      const response = await apiRequest('PUT', `/api/budgets/${buildingId}/bank-account`, bankAccountPayload);
      const data = await response.json();
      debugLog('Bank account save response', { buildingId, responseStatus: response.status, data });
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Success', 
        description: 'Bank account settings saved successfully',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${buildingId}/bank-account`] });
      refetchForecast();
    },
    onError: (error: any) => {
      debugLog('Bank account save error', { buildingId, error });
      toast({
        title: 'Error',
        description: error?.message || 'Failed to save bank account settings',
        variant: 'destructive',
      });
    },
  });

  // Save revenue configuration mutation (including custom revenue lines)
  const saveRevenueConfigurationMutation = useMutation({
    mutationFn: async () => {
      debugLog('Saving revenue configuration', { buildingId, customRevenueLines, revenueGrowthRate: localSettings.revenueGrowthRate });
      
      const revenueConfigPayload = {
        // Only send the fields needed for revenue configuration
        revenueGrowthRate: localSettings.revenueGrowthRate,
        customRevenueLines: customRevenueLines,
        // Include current settings to prevent data loss
        ...localSettings,
        // Exclude Emergency Fund and Operating Cash from customBankFields to prevent double-counting
        customBankFields: customBankFields
          .filter(field => 
            field.fieldName !== 'Emergency Fund Minimum' && 
            field.fieldName !== 'Operating Cash Minimum'
          )
          .reduce((acc, field) => {
            acc[field.fieldName] = field.fieldValue;
            return acc;
          }, {} as { [key: string]: number })
      };
      
      const response = await apiRequest('PUT', `/api/budgets/${buildingId}/bank-account`, revenueConfigPayload);
      const data = await response.json();
      debugLog('Revenue configuration save response', { buildingId, responseStatus: response.status, data });
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Success', 
        description: 'Revenue configuration saved successfully',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${buildingId}/bank-account`] });
      refetchForecast();
    },
    onError: (error: any) => {
      debugLog('Revenue configuration save error', { buildingId, error });
      toast({
        title: 'Error',
        description: error?.message || 'Failed to save revenue configuration',
        variant: 'destructive',
      });
    },
  });

  // Save unplanned bills amount mutation (dedicated endpoint)
  const saveUnplannedBillsMutation = useMutation({
    mutationFn: async (amount: number) => {
      debugLog('Saving unplanned bills amount', { buildingId, amount });
      const payload = {
        unplannedBillsAmount: amount,
        notes: 'Updated via budget configuration'
      };
      const response = await apiRequest('PUT', `/api/budgets/${buildingId}/unplanned-bills`, payload);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ _error: 'Unknown error' }));
        throw new Error(errorData._error || `HTTP ${response.status}`);
      }
      const data = await response.json();
      debugLog('Unplanned bills save response', { buildingId, responseStatus: response.status, data });
      return { ...data, savedAmount: amount };
    },
    onSuccess: (data) => {
      // CRITICAL FIX: Immediately update local state to ensure UI updates
      setLocalSettings(prev => ({
        ...prev,
        unplannedBillsAmount: data.savedAmount
      }));
      
      toast({
        title: 'Success', 
        description: 'Unplanned bills amount saved successfully',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${buildingId}/bank-account`] });
      refetchForecast();
      
      debugLog('Unplanned bills state updated immediately', { 
        buildingId, 
        savedAmount: data.savedAmount,
        previousAmount: localSettings.unplannedBillsAmount
      });
    },
    onError: (error: any) => {
      debugLog('Unplanned bills save error', { buildingId, error });
      toast({
        title: 'Error',
        description: error?.message || 'Failed to save unplanned bills amount',
        variant: 'destructive',
      });
    },
  });

  // Save capital investments mutation
  const saveInvestmentsMutation = useMutation({
    mutationFn: async (investments: CapitalInvestment[]) => {
      // Only save custom investments (auto-generated are recreated on load)
      const customInvestments = investments.filter(inv => inv.type === 'custom');
      debugLog('Saving capital investments', { buildingId, count: customInvestments.length });
      const response = await apiRequest('PUT', `/api/budgets/${buildingId}/investments`, { investments: customInvestments });
      const data = await response.json();
      debugLog('Capital investments save response', { buildingId, responseStatus: response.status, data });
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Success', 
        description: 'Capital investments saved successfully',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/budgets/${buildingId}/investments`] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save capital investments',
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


  // Calculate residence revenue from monthly fees
  const calculateResidenceRevenue = () => {
    if (!residences || residences.length === 0) return 0;
    
    return residences
      .filter((residence) => {
        // Only include active residences
        return residence?.isActive !== false; // Default to true if undefined
      })
      .reduce((total, residence) => {
        // Handle null/undefined residence
        if (!residence || !residence.monthlyFees) return total;
        
        // Parse monthlyFees with robust validation
        const feesString = String(residence.monthlyFees).replace(/[^0-9.-]/g, ''); // Remove currency symbols
        const monthlyFees = parseFloat(feesString);
        
        // Only add valid positive numbers
        if (!isNaN(monthlyFees) && monthlyFees >= 0) {
          return total + monthlyFees;
        }
        
        return total;
      }, 0);
  };

  // Calculate total revenue (residence + custom lines)
  const calculateTotalRevenue = () => {
    const residenceRevenue = calculateResidenceRevenue();
    const customRevenue = customRevenueLines.reduce((total, line) => total + line.monthlyAmount, 0);
    return residenceRevenue + customRevenue;
  };

  // Add custom revenue line
  const addCustomRevenueLine = () => {
    if (!newRevenueLine.description.trim() || !newRevenueLine.monthlyAmount.trim()) return;
    
    // Validate amount is a positive number
    const amount = parseFloat(newRevenueLine.monthlyAmount);
    if (isNaN(amount) || amount < 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid positive number for the monthly amount.',
        variant: 'destructive',
      });
      return;
    }
    
    const newLine: CustomRevenueLine = {
      id: `custom-${Date.now()}`,
      description: newRevenueLine.description.trim(),
      monthlyAmount: amount,
    };
    
    setCustomRevenueLines(prev => [...prev, newLine]);
    setNewRevenueLine({ description: '', monthlyAmount: '' });
  };

  // Remove custom revenue line
  const removeCustomRevenueLine = (id: string) => {
    setCustomRevenueLines(prev => prev.filter(line => line.id !== id));
  };

  // Add custom bank account field
  const addCustomBankField = () => {
    if (!newBankField.fieldName.trim() || !newBankField.fieldValue.trim()) return;
    
    // Validate amount is a positive number
    const value = parseFloat(newBankField.fieldValue);
    if (isNaN(value) || value < 0) {
      toast({
        title: 'Invalid Value',
        description: 'Please enter a valid positive number for the field value.',
        variant: 'destructive',
      });
      return;
    }
    
    const newField: CustomBankAccountField = {
      id: `bank-field-${Date.now()}`,
      fieldName: newBankField.fieldName.trim(),
      fieldValue: value,
    };
    
    setCustomBankFields(prev => {
      const updated = [...prev, newField];
      // Sync the updated fields with localSettings
      syncCustomFieldsToLocalSettings(updated);
      return updated;
    });
    setNewBankField({ fieldName: '', fieldValue: '' });
  };

  // Remove custom bank account field
  const removeCustomBankField = (id: string) => {
    setCustomBankFields(prev => {
      const updated = prev.filter(field => field.id !== id);
      // Sync the updated fields with localSettings
      syncCustomFieldsToLocalSettings(updated);
      return updated;
    });
  };

  // Update custom bank account field and sync with localSettings
  const updateCustomBankField = (id: string, updates: Partial<CustomBankAccountField>) => {
    setCustomBankFields(prev => {
      const updated = prev.map(field => 
        field.id === id ? { ...field, ...updates } : field
      );
      // Sync updated custom fields with localSettings
      syncCustomFieldsToLocalSettings(updated);
      return updated;
    });
  };
  
  // Sync custom bank fields to localSettings for API persistence and forecast calculations
  const syncCustomFieldsToLocalSettings = (fields: CustomBankAccountField[]) => {
    const customFieldsObj: { [key: string]: number } = {};
    let emergencyFund = 0;
    let operatingCash = 0;
    
    fields.forEach(field => {
      // Handle special core fields that map to specific localSettings properties
      if (field.fieldName === 'Emergency Fund Minimum') {
        emergencyFund = field.fieldValue;
      } else if (field.fieldName === 'Operating Cash Minimum') {
        operatingCash = field.fieldValue;
      } else {
        // Store other custom fields in the customBankFields object
        customFieldsObj[field.fieldName] = field.fieldValue;
      }
    });
    
    setLocalSettings(prev => ({
      ...prev,
      emergencyFundMinimum: emergencyFund,
      operatingCashMinimum: operatingCash,
      customBankFields: customFieldsObj,
    }));
  };

  // Auto-generation logic for capital investments based on budget analysis (with non-overlapping recommendations)
  const generateSuggestedInvestments = (): CapitalInvestment[] => {
    const suggestions: CapitalInvestment[] = [];
    const metrics = calculateSummaryMetrics();
    const emergencyMin = localSettings.emergencyFundMinimum || 10000;
    const operatingMin = localSettings.operatingCashMinimum || 5000;
    const currentBalance = metrics.currentBalance;
    
    // Calculate discrete, non-overlapping funding needs
    let cumulativeTarget = 0;
    
    // 1. Emergency Fund - most critical
    if (currentBalance < emergencyMin) {
      const emergencyShortfall = emergencyMin - currentBalance;
      suggestions.push({
        id: `auto-emergency-${Date.now()}`,
        title: 'Emergency Fund Replenishment',
        description: `Current balance (${currentBalance.toLocaleString()}) is below emergency fund minimum (${emergencyMin.toLocaleString()})`,
        amount: emergencyShortfall,
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days from now
        urgency: 'urgent', // More critical than operating cash
        type: 'auto_generated',
        ownershipType: 'owner',
        category: 'Emergency Fund',
        createdAt: new Date().toISOString(),
      });
      cumulativeTarget += emergencyShortfall;
    }
    
    // 2. Operating Cash - additional buffer beyond emergency fund
    const totalRecommendedCash = emergencyMin + operatingMin;
    if (currentBalance < totalRecommendedCash) {
      // Only suggest the operating cash portion that's not already covered by emergency fund
      const operatingShortfall = totalRecommendedCash - Math.max(currentBalance, emergencyMin);
      if (operatingShortfall > 0) {
        suggestions.push({
          id: `auto-operating-${Date.now()}`,
          title: 'Operating Cash Buffer',
          description: `Additional operating cash needed beyond emergency fund for smooth operations (${operatingMin.toLocaleString()} buffer)`,
          amount: operatingShortfall,
          targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 60 days from now
          urgency: 'suggested',
          type: 'auto_generated',
          ownershipType: 'owner',
          category: 'Operating Cash',
          createdAt: new Date().toISOString(),
        });
        cumulativeTarget += operatingShortfall;
      }
    }
    
    // 3. Cash Flow Support - based on forecast projections (independent of static minimums)
    if (forecastData?.forecast) {
      const filteredForecast = getFilteredForecastData();
      const negativeMonths = filteredForecast.filter(month => month.balance < 0);
      
      if (negativeMonths.length > 0) {
        const firstNegative = negativeMonths[0];
        const maxDeficit = Math.abs(Math.min(...negativeMonths.map(m => m.balance)));
        
        // Only suggest if forecast deficit exceeds our current cash targets
        const projectedBalanceAfterTargets = currentBalance + cumulativeTarget;
        if (maxDeficit > projectedBalanceAfterTargets) {
          const additionalCashFlowNeeded = maxDeficit - projectedBalanceAfterTargets; // Removed hardcoded safety buffer
          suggestions.push({
            id: `auto-cashflow-${Date.now()}`,
            title: 'Cash Flow Support',
            description: `Additional funds needed for projected negative balance of ${maxDeficit.toLocaleString()} in ${firstNegative.month}/${firstNegative.year}`,
            amount: additionalCashFlowNeeded,
            targetDate: new Date(firstNegative.year, firstNegative.month - 1, 1).toISOString().split('T')[0],
            urgency: 'urgent',
            type: 'auto_generated',
            ownershipType: 'owner',
            category: 'Cash Flow',
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
    
    return suggestions;
  };

  // Deduplication helper to prevent overlapping auto-generated investments
  const deduplicateInvestments = (suggestions: CapitalInvestment[]): CapitalInvestment[] => {
    const deduped: CapitalInvestment[] = [];
    const seenCategories = new Set<string>();
    
    // Sort by urgency priority (urgent first) to keep most important suggestions
    const sorted = [...suggestions].sort((a, b) => {
      const urgencyOrder = { urgent: 0, suggested: 1, not_urgent: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });
    
    for (const suggestion of sorted) {
      const categoryKey = `${suggestion.category || 'general'}-${suggestion.ownershipType}`;
      
      // Only add if we haven't seen this category/ownership combination
      if (!seenCategories.has(categoryKey)) {
        seenCategories.add(categoryKey);
        deduped.push(suggestion);
      }
    }
    
    return deduped;
  };

  // Get filtered forecast data based on current filter settings
  const getFilteredForecastData = () => {
    if (!forecastData?.forecast) return [];
    
    let startIndex = 0;
    if (filters.startMonth && filters.startYear) {
      const startDate = new Date(filters.startYear, filters.startMonth - 1, 1);
      startIndex = forecastData.forecast.findIndex(item => {
        const itemDate = new Date(item.year, item.month - 1, 1);
        return itemDate >= startDate;
      });
      if (startIndex === -1) startIndex = 0;
    }
    
    const maxPeriods = filters.viewType === 'month' ? filters.periodLength : filters.periodLength * 12;
    const endIndex = Math.min(startIndex + maxPeriods, forecastData.forecast.length);
    return forecastData.forecast.slice(startIndex, endIndex);
  };

  // Investment CRUD operations
  const addInvestment = () => {
    if (!newInvestment.title.trim() || !newInvestment.amount.trim() || !newInvestment.targetDate) return;
    
    const amount = parseFloat(newInvestment.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid positive number for the investment amount.',
        variant: 'destructive',
      });
      return;
    }
    
    const investment: CapitalInvestment = {
      id: `custom-${Date.now()}`,
      title: newInvestment.title.trim(),
      description: newInvestment.description.trim() || undefined,
      amount,
      targetDate: newInvestment.targetDate,
      urgency: newInvestment.urgency,
      type: 'custom',
      ownershipType: newInvestment.ownershipType,
      createdAt: new Date().toISOString(),
    };
    
    setCapitalInvestments(prev => {
      const updated = [...prev, investment];
      // Auto-save after adding investment
      saveInvestmentsMutation.mutate(updated);
      return updated;
    });
    
    setNewInvestment({
      title: '',
      description: '',
      amount: '',
      targetDate: '',
      urgency: 'not_urgent',
      ownershipType: 'residences',
    });
    setAddInvestmentDialogOpen(false);
    
    toast({
      title: 'Investment Added',
      description: `${investment.title} has been added to the investment plan.`,
    });
  };

  const updateInvestment = (id: string, updates: Partial<CapitalInvestment>) => {
    setCapitalInvestments(prev => {
      const updated = prev.map(inv => 
        inv.id === id ? { ...inv, ...updates } : inv
      );
      // Auto-save after updating investment
      saveInvestmentsMutation.mutate(updated);
      return updated;
    });
  };

  const removeInvestment = (id: string) => {
    const investment = capitalInvestments.find(inv => inv.id === id);
    if (investment?.type === 'auto_generated') {
      toast({
        title: 'Cannot Remove',
        description: 'Auto-generated investments cannot be removed. Address the underlying budget issue instead.',
        variant: 'destructive',
      });
      return;
    }
    
    setCapitalInvestments(prev => {
      const updated = prev.filter(inv => inv.id !== id);
      // Auto-save after removing investment
      saveInvestmentsMutation.mutate(updated);
      return updated;
    });
    
    toast({
      title: 'Investment Removed',
      description: 'The investment has been removed from the plan.',
    });
  };

  const startEditInvestment = (investment: CapitalInvestment) => {
    if (investment.type === 'auto_generated') {
      toast({
        title: 'Cannot Edit',
        description: 'Auto-generated investments cannot be edited. Address the underlying budget issue instead.',
        variant: 'destructive',
      });
      return;
    }
    
    setEditingInvestment(investment);
    setEditInvestmentDialogOpen(true);
  };

  const saveEditInvestment = () => {
    if (!editingInvestment) return;
    
    updateInvestment(editingInvestment.id, editingInvestment);
    setEditingInvestment(null);
    setEditInvestmentDialogOpen(false);
    
    toast({
      title: 'Investment Updated',
      description: 'The investment has been updated successfully.',
    });
  };

  // Filter investments based on current filters and date range
  const getFilteredInvestments = (): CapitalInvestment[] => {
    let filtered = [...capitalInvestments];
    
    // Apply urgency filter
    if (investmentFilters.urgency && investmentFilters.urgency !== 'all') {
      filtered = filtered.filter(inv => inv.urgency === investmentFilters.urgency);
    }
    
    // Always apply date window filter (within time window is always on)
    if (filters.startMonth && filters.startYear) {
      const windowStart = new Date(filters.startYear, filters.startMonth - 1, 1);
      const periodMonths = filters.viewType === 'month' ? filters.periodLength : filters.periodLength * 12;
      const windowEnd = new Date(windowStart.getTime() + periodMonths * 30 * 24 * 60 * 60 * 1000);
      
      filtered = filtered.filter(inv => {
        const invDate = new Date(inv.targetDate);
        return invDate >= windowStart && invDate <= windowEnd;
      });
    }
    
    // Sort by target date (earliest first), then by urgency (urgent -> suggested -> not_urgent)
    filtered.sort((a, b) => {
      const dateCompare = new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
      if (dateCompare !== 0) return dateCompare;
      
      const urgencyOrder = { urgent: 0, suggested: 1, not_urgent: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });
    
    return filtered;
  };

  // Calculate investment summary metrics
  const calculateInvestmentSummary = (): InvestmentSummary => {
    const filtered = getFilteredInvestments();
    
    return {
      totalAmount: filtered.reduce((sum, inv) => sum + inv.amount, 0),
      urgentAmount: filtered.filter(inv => inv.urgency === 'urgent').reduce((sum, inv) => sum + inv.amount, 0),
      suggestedAmount: filtered.filter(inv => inv.urgency === 'suggested').reduce((sum, inv) => sum + inv.amount, 0),
      notUrgentAmount: filtered.filter(inv => inv.urgency === 'not_urgent').reduce((sum, inv) => sum + inv.amount, 0),
      count: filtered.length,
      urgentCount: filtered.filter(inv => inv.urgency === 'urgent').length,
      suggestedCount: filtered.filter(inv => inv.urgency === 'suggested').length,
      notUrgentCount: filtered.filter(inv => inv.urgency === 'not_urgent').length,
    };
  };

  // CRITICAL FIX: Dedicated helper function that always returns monthly-resolution pre-injection data
  // Independent of viewType and capitalInvestmentMode to resolve granularity issues
  const buildMonthlyBaselineSeries = (forecastData: BudgetForecastResponse | undefined, filters: BudgetFilters) => {
    if (!forecastData?.forecast || forecastData.forecast.length === 0) {
      return { startingBalance: 0, monthlyNetFlows: [] };
    }

    // ALWAYS work with monthly data from the forecast (never aggregated)
    // This ensures monthly granularity regardless of display viewType
    const monthlyForecast = forecastData.forecast; // Already monthly resolution

    // Calculate baseline starting balance B0 at filtered range start (pre-injection)
    let baselineStartingBalance = forecastData.startingBalance;

    // Calculate start index based on filters
    let startIndex = 0;
    if (filters.startMonth && filters.startYear) {
      const startDate = new Date(filters.startYear, filters.startMonth - 1, 1);
      startIndex = monthlyForecast.findIndex(item => {
        const itemDate = new Date(item.year, item.month - 1, 1);
        return itemDate >= startDate;
      });
      if (startIndex === -1) startIndex = 0;

      // If not starting at global forecast start, reconstruct B0 at filtered start
      // using pre-injection flows (revenue - spending, no capital injections)
      if (startIndex > 0) {
        let reconstructedBalance = forecastData.startingBalance;
        for (let i = 0; i < startIndex; i++) {
          const monthData = monthlyForecast[i];
          // Accumulate net cash flows without capital injections
          const netCashFlow = monthData.revenue - monthData.spending;
          reconstructedBalance += netCashFlow;
        }
        baselineStartingBalance = reconstructedBalance;
      }
    }

    // Calculate the number of months to include based on filters
    // For Year view: convert years to months, for Month view: use months directly
    const totalMonths = filters.viewType === 'month' ? filters.periodLength : filters.periodLength * 12;
    const endIndex = Math.min(startIndex + totalMonths, monthlyForecast.length);
    
    // Extract monthly pre-injection net flows for the filtered period
    const monthlyNetFlows: number[] = [];
    for (let i = startIndex; i < endIndex; i++) {
      const monthData = monthlyForecast[i];
      // Calculate net flow without capital injections (revenue - spending)
      const netFlow = monthData.revenue - monthData.spending;
      monthlyNetFlows.push(netFlow);
    }

    debugLog('buildMonthlyBaselineSeries', {
      viewType: filters.viewType,
      periodLength: filters.periodLength,
      totalMonthsCalculated: totalMonths,
      actualMonthsReturned: monthlyNetFlows.length,
      startIndex,
      endIndex,
      baselineStartingBalance,
      firstFewNetFlows: monthlyNetFlows.slice(0, 3)
    });

    // VALIDATION: In Year view, ensure we're working with months not years
    if (filters.viewType === 'year') {
      const expectedMonths = filters.periodLength * 12;
      if (monthlyNetFlows.length > 0 && monthlyNetFlows.length !== expectedMonths) {
        debugLog('GRANULARITY VALIDATION WARNING', {
          expectedMonths,
          actualLength: monthlyNetFlows.length,
          message: 'Monthly flow count does not match expected months for year view'
        });
      }
    }

    return { startingBalance: baselineStartingBalance, monthlyNetFlows };
  };

  // FIXED: Calculate monthly payment needed for urgent scenario using cumulative shortfall methodology
  const calculateUrgentMonthlyPayment = (): number => {
    if (!forecastData?.forecast || forecastData.forecast.length === 0) {
      return 0;
    }

    const threshold = 0; // Urgent scenario: prevent balance going below $0
    
    // CRITICAL FIX: Use dedicated monthly baseline helper independent of viewType
    const { startingBalance: baselineBalance, monthlyNetFlows } = buildMonthlyBaselineSeries(forecastData, filters);
    
    if (monthlyNetFlows.length === 0) {
      return 0;
    }

    // **CUMULATIVE SHORTFALL METHOD WITH MONTHLY GRANULARITY**
    // 1. Compute prefix sums S_k = sum_{i=1..k} f_i for each monthly period k
    const prefixSums: number[] = [];
    let runningSum = 0;
    for (let k = 0; k < monthlyNetFlows.length; k++) {
      runningSum += monthlyNetFlows[k];
      prefixSums.push(runningSum);
    }
    
    // 2. Calculate minimum constant payment: m = max_{k≥1} max(0, T - (B0 + S_k)) / k
    let maxMonthlyPayment = 0;
    
    for (let k = 0; k < prefixSums.length; k++) {
      const periodEndBalance = baselineBalance + prefixSums[k]; // Balance at end of period k+1 without payment
      const shortfall = Math.max(0, threshold - periodEndBalance);
      const monthlyPaymentNeeded = shortfall / (k + 1); // Divide by period number (k+1)
      
      if (monthlyPaymentNeeded > maxMonthlyPayment) {
        maxMonthlyPayment = monthlyPaymentNeeded;
      }
    }
    
    // 3. ENHANCED VALIDATION: Simulate with computed payment and verify all periods ≥ threshold
    if (maxMonthlyPayment > 0) {
      let testBalance = baselineBalance;
      let validationPassed = true;
      const validationDetails: { period: number; balance: number; passed: boolean }[] = [];
      
      for (let k = 0; k < monthlyNetFlows.length; k++) {
        testBalance += monthlyNetFlows[k] + maxMonthlyPayment; // Add net flow + constant payment
        const passed = testBalance >= threshold;
        validationDetails.push({ period: k + 1, balance: testBalance, passed });
        
        if (!passed) {
          validationPassed = false;
          break;
        }
      }
      
      if (!validationPassed) {
        debugLog('URGENT PAYMENT VALIDATION FAILED - applying adaptive buffer', {
          maxMonthlyPayment,
          validationDetails: validationDetails.slice(0, 5) // Show first 5 periods
        });
        // Apply progressive buffer based on severity of failure
        maxMonthlyPayment *= 1.05; // 5% buffer for more robust protection
      }
      
      // Final validation after buffer
      testBalance = baselineBalance;
      for (let k = 0; k < monthlyNetFlows.length; k++) {
        testBalance += monthlyNetFlows[k] + maxMonthlyPayment;
        if (testBalance < threshold) {
          debugLog('CRITICAL: Final validation still failed after buffer', {
            period: k + 1,
            balance: testBalance,
            threshold,
            payment: maxMonthlyPayment
          });
        }
      }
    }
    
    // 4. GRANULARITY VALIDATION: Ensure we computed exactly the expected number of monthly periods
    const expectedMonths = filters.viewType === 'month' ? filters.periodLength : filters.periodLength * 12;
    if (monthlyNetFlows.length !== expectedMonths && monthlyNetFlows.length < forecastData.forecast.length) {
      debugLog('GRANULARITY MISMATCH DETECTED', {
        expectedMonths,
        actualMonths: monthlyNetFlows.length,
        viewType: filters.viewType,
        periodLength: filters.periodLength
      });
    }
    
    // 5. SCENARIO VALIDATION: When urgent scenario requires capital investment, assert m > 0
    if (maxMonthlyPayment <= 0) {
      const totalShortfall = prefixSums.some(sum => baselineBalance + sum < threshold);
      if (totalShortfall) {
        debugLog('SCENARIO VALIDATION WARNING: Expected payment > 0 for urgent scenario with shortfall', {
          baselineBalance,
          threshold,
          minPrefixBalance: Math.min(...prefixSums.map(sum => baselineBalance + sum))
        });
      }
    }
    
    debugLog('Urgent Monthly Payment - Enhanced Methodology', {
      threshold,
      baselineBalance,
      monthlyPeriodsProcessed: monthlyNetFlows.length,
      prefixSums: prefixSums.slice(0, 3), // Show first 3 for debugging
      maxMonthlyPayment: Math.round(maxMonthlyPayment * 100) / 100,
      viewType: filters.viewType,
      periodLength: filters.periodLength,
      granularityValidated: monthlyNetFlows.length === expectedMonths
    });

    return Math.round(maxMonthlyPayment * 100) / 100;
  };

  // FIXED: Calculate monthly payment needed for suggested scenario using cumulative shortfall methodology
  const calculateSuggestedMonthlyPayment = (): number => {
    if (!forecastData?.forecast || forecastData.forecast.length === 0) {
      return 0;
    }

    const threshold = forecastData.minimumFund || 0; // Suggested scenario: maintain minimum requirement
    
    // CRITICAL FIX: Use dedicated monthly baseline helper independent of viewType
    // SCENARIO DECOUPLING: Both urgent and suggested scenarios use IDENTICAL baseline data
    const { startingBalance: baselineBalance, monthlyNetFlows } = buildMonthlyBaselineSeries(forecastData, filters);
    
    if (monthlyNetFlows.length === 0) {
      return 0;
    }

    // **CUMULATIVE SHORTFALL METHOD WITH MONTHLY GRANULARITY**
    // 1. Compute prefix sums S_k = sum_{i=1..k} f_i for each monthly period k
    const prefixSums: number[] = [];
    let runningSum = 0;
    for (let k = 0; k < monthlyNetFlows.length; k++) {
      runningSum += monthlyNetFlows[k];
      prefixSums.push(runningSum);
    }
    
    // 2. Calculate minimum constant payment: m = max_{k≥1} max(0, T - (B0 + S_k)) / k
    let maxMonthlyPayment = 0;
    
    for (let k = 0; k < prefixSums.length; k++) {
      const periodEndBalance = baselineBalance + prefixSums[k]; // Balance at end of period k+1 without payment
      const shortfall = Math.max(0, threshold - periodEndBalance);
      const monthlyPaymentNeeded = shortfall / (k + 1); // Divide by period number (k+1)
      
      if (monthlyPaymentNeeded > maxMonthlyPayment) {
        maxMonthlyPayment = monthlyPaymentNeeded;
      }
    }
    
    // 3. ENHANCED VALIDATION: Simulate with computed payment and verify all periods ≥ threshold
    if (maxMonthlyPayment > 0) {
      let testBalance = baselineBalance;
      let validationPassed = true;
      const validationDetails: { period: number; balance: number; passed: boolean }[] = [];
      
      for (let k = 0; k < monthlyNetFlows.length; k++) {
        testBalance += monthlyNetFlows[k] + maxMonthlyPayment; // Add net flow + constant payment
        const passed = testBalance >= threshold;
        validationDetails.push({ period: k + 1, balance: testBalance, passed });
        
        if (!passed) {
          validationPassed = false;
          break;
        }
      }
      
      if (!validationPassed) {
        debugLog('SUGGESTED PAYMENT VALIDATION FAILED - applying adaptive buffer', {
          maxMonthlyPayment,
          validationDetails: validationDetails.slice(0, 5) // Show first 5 periods
        });
        // Apply progressive buffer based on severity of failure
        maxMonthlyPayment *= 1.05; // 5% buffer for more robust protection
      }
      
      // Final validation after buffer
      testBalance = baselineBalance;
      for (let k = 0; k < monthlyNetFlows.length; k++) {
        testBalance += monthlyNetFlows[k] + maxMonthlyPayment;
        if (testBalance < threshold) {
          debugLog('CRITICAL: Final validation still failed after buffer', {
            period: k + 1,
            balance: testBalance,
            threshold,
            payment: maxMonthlyPayment
          });
        }
      }
    }
    
    // 4. GRANULARITY VALIDATION: Ensure we computed exactly the expected number of monthly periods
    const expectedMonths = filters.viewType === 'month' ? filters.periodLength : filters.periodLength * 12;
    if (monthlyNetFlows.length !== expectedMonths && monthlyNetFlows.length < forecastData.forecast.length) {
      debugLog('GRANULARITY MISMATCH DETECTED', {
        expectedMonths,
        actualMonths: monthlyNetFlows.length,
        viewType: filters.viewType,
        periodLength: filters.periodLength
      });
    }
    
    // 5. SCENARIO VALIDATION: When suggested scenario requires capital investment, assert m > 0
    if (maxMonthlyPayment <= 0) {
      const totalShortfall = prefixSums.some(sum => baselineBalance + sum < threshold);
      if (totalShortfall) {
        debugLog('SCENARIO VALIDATION WARNING: Expected payment > 0 for suggested scenario with shortfall', {
          baselineBalance,
          threshold,
          minPrefixBalance: Math.min(...prefixSums.map(sum => baselineBalance + sum))
        });
      }
    }
    
    debugLog('Suggested Monthly Payment - Enhanced Methodology', {
      threshold,
      baselineBalance,
      monthlyPeriodsProcessed: monthlyNetFlows.length,
      prefixSums: prefixSums.slice(0, 3), // Show first 3 for debugging
      maxMonthlyPayment: Math.round(maxMonthlyPayment * 100) / 100,
      viewType: filters.viewType,
      periodLength: filters.periodLength,
      granularityValidated: monthlyNetFlows.length === expectedMonths,
      scenarioDecoupled: true // Both scenarios now use identical baseline data
    });

    return Math.round(maxMonthlyPayment * 100) / 100;
  };

  // Auto-generate investments when forecast data changes (with proper deduplication)
  React.useEffect(() => {
    if (forecastData && buildingId) {
      const suggestions = generateSuggestedInvestments();
      
      // Single atomic update: replace all auto-generated investments
      setCapitalInvestments(prev => {
        const customInvestments = prev.filter(inv => inv.type !== 'auto_generated');
        const deduplicatedSuggestions = deduplicateInvestments(suggestions);
        debugLog('Auto-generated investments', { count: deduplicatedSuggestions.length, suggestions: deduplicatedSuggestions });
        return [...customInvestments, ...deduplicatedSuggestions];
      });
    }
  }, [forecastData, localSettings.emergencyFundMinimum, localSettings.operatingCashMinimum, buildingId]);

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
      monthlyIncome: calculateTotalRevenue(),
      monthlySpending: currentMonth.spending + (localSettings.unplannedBillsAmount || 0),
      yearEndBalance: lastPeriod.balance,
      variance: currentMonth.balance - priorYearBalance,
    };
  };

  // Extract spending categories from forecast data - separated into revenue and expense categories
  const getBudgetCategories = () => {
    if (!forecastData) return { revenueCategories: [], expenseCategories: [], allCategories: [] };

    // Use our new revenue calculation instead of baseline income
    const totalMonthlyRevenue = calculateTotalRevenue();
    const residenceRevenue = calculateResidenceRevenue();
    const customRevenue = customRevenueLines.reduce((total, line) => total + line.monthlyAmount, 0);
    
    // Calculate total monthly expenses including unplanned bills
    const totalMonthlyExpenses = forecastData.baselineMonthlyExpenses + (localSettings.unplannedBillsAmount || 0);

    const revenueCategories = [
      { 
        category: 'Total Monthly Revenue', 
        budget: totalMonthlyRevenue * 12, 
        used: totalMonthlyRevenue * 12, 
        color: 'bg-green-500',
        type: 'revenue' as const
      },
      { 
        category: 'Residence Revenue', 
        budget: residenceRevenue * 12, 
        used: residenceRevenue * 12, 
        color: 'bg-blue-500',
        type: 'revenue' as const
      },
      { 
        category: 'Custom Revenue', 
        budget: customRevenue * 12, 
        used: customRevenue * 12, 
        color: 'bg-purple-500',
        type: 'revenue' as const
      },
    ];

    const expenseCategories = [
      { 
        category: 'Monthly Expenses', 
        budget: forecastData.baselineMonthlyExpenses * 12, 
        used: forecastData.baselineMonthlyExpenses * 12, 
        color: 'bg-red-500',
        type: 'expense' as const
      },
      // Add unplanned bills as a separate category if amount > 0
      ...(localSettings.unplannedBillsAmount > 0 ? [{
        category: 'Unplanned Bills', 
        budget: localSettings.unplannedBillsAmount * 12, 
        used: localSettings.unplannedBillsAmount * 12, 
        color: 'bg-orange-500',
        type: 'expense' as const
      }] : []),
      { 
        category: 'Total Monthly Expenses (incl. Unplanned)', 
        budget: totalMonthlyExpenses * 12, 
        used: totalMonthlyExpenses * 12, 
        color: 'bg-gray-600',
        type: 'expense' as const
      },
    ];

    const allCategories = [...revenueCategories, ...expenseCategories];

    return { revenueCategories, expenseCategories, allCategories };
  };

  // Legacy function for backward compatibility - returns all categories
  const getSpendingCategories = () => {
    return getBudgetCategories().allCategories;
  };

  // Calculate capital investments for chart
  const calculateCapitalInvestmentsForPeriod = (startDate: Date, endDate: Date) => {
    const filteredInvestments = getFilteredInvestments();
    return filteredInvestments
      .filter(investment => {
        const investmentDate = new Date(investment.targetDate);
        return investmentDate >= startDate && investmentDate < endDate;
      })
      .reduce((total, investment) => total + investment.amount, 0);
  };

  // Prepare chart data with filters applied
  const getChartData = () => {
    if (!forecastData?.forecast) return [];

    // Calculate combined revenue once for consistent display
    const combinedRevenue = calculateTotalRevenue();

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
        capitalInvestments: number;
        count: number 
      } } = {};

      filteredData.forEach((item) => {
        if (!yearlyData[item.year]) {
          yearlyData[item.year] = { revenue: 0, spending: 0, balance: 0, netCashFlow: 0, capitalInvestments: 0, count: 0 };
        }
        // Use combined revenue instead of forecast revenue
        yearlyData[item.year].revenue += combinedRevenue;
        // Include unplanned bills in spending calculation for consistency
        const totalSpending = item.spending + (localSettings.unplannedBillsAmount || 0);
        yearlyData[item.year].spending += totalSpending;
        // Recalculate net cash flow with combined revenue and total spending
        yearlyData[item.year].netCashFlow += (combinedRevenue - totalSpending);
        
        // Fix: Use actual capital investment data from forecast (automatic balance management)
        yearlyData[item.year].capitalInvestments += item.capitalInvestment || 0;
        
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
          capitalInvestments: data.capitalInvestments,
          status: 'green' as const, // TODO: Calculate status based on yearly data
        }));
    }

    // Monthly view with individual months
    return filteredData.map((item) => {
      // Include unplanned bills in spending calculation for consistency
      const totalSpending = item.spending + (localSettings.unplannedBillsAmount || 0);
      
      return {
        month: `${item.year}-${item.month.toString().padStart(2, '0')}`,
        balance: item.balance,
        status: item.status,
        revenue: combinedRevenue, // Use combined revenue instead of forecast revenue
        spending: totalSpending, // Include unplanned bills
        netCashFlow: combinedRevenue - totalSpending, // Recalculate with combined revenue and total spending
        // Fix: Use actual capital investment data from forecast (automatic balance management)
        capitalInvestments: item.capitalInvestment || 0,
      };
    });
  };

  // Robust current balance calculation with saved bank account data prioritized
  const getCurrentBalanceWithFallbacks = () => {
    // Helper function to safely format currency
    const formatCurrency = (value: number) => {
      if (!Number.isFinite(value)) return '$0';
      return `$${value.toLocaleString()}`;
    };

    // Helper function to format date for display
    const formatSavedDate = (dateString: string) => {
      try {
        return new Date(dateString).toLocaleDateString();
      } catch {
        return 'Unknown date';
      }
    };

    // PRIMARY SOURCE: Saved bank account data (prioritized over forecast)
    if (bankAccountData) {
      const data = bankAccountData as any; // Type assertion for bank account data
      const startAmount = typeof data.bankAccountStartAmount === 'string' 
        ? parseFloat(data.bankAccountStartAmount) 
        : data.bankAccountStartAmount;
      
      // Check if we have both saved amount and updated date to confirm it's saved data
      if (Number.isFinite(startAmount) && data.bankAccountUpdatedAt) {
        return {
          value: startAmount,
          formatted: formatCurrency(startAmount),
          source: 'saved_balance',
          savedDate: formatSavedDate(data.bankAccountUpdatedAt),
          available: true
        };
      }
      
      // If we have amount but no update date, still show it but mark as unsaved
      if (Number.isFinite(startAmount)) {
        return {
          value: startAmount,
          formatted: formatCurrency(startAmount),
          source: 'bank_account',
          available: true
        };
      }
    }

    // Fallback 1: summaryMetrics.currentBalance (forecast data)
    const summaryMetrics = calculateSummaryMetrics();
    if (summaryMetrics && Number.isFinite(summaryMetrics.currentBalance)) {
      return {
        value: summaryMetrics.currentBalance,
        formatted: formatCurrency(summaryMetrics.currentBalance),
        source: 'forecast',
        available: true
      };
    }

    // Fallback 2: forecastData.startingBalance
    if (Number.isFinite(Number(forecastData?.startingBalance))) {
      return {
        value: Number(forecastData.startingBalance),
        formatted: formatCurrency(Number(forecastData.startingBalance)),
        source: 'forecast_starting',
        available: true
      };
    }

    // Fallback 3: localSettings.bankAccountStartAmount
    if (Number.isFinite(Number(localSettings.bankAccountStartAmount))) {
      return {
        value: Number(localSettings.bankAccountStartAmount),
        formatted: formatCurrency(Number(localSettings.bankAccountStartAmount)),
        source: 'local_settings',
        available: true
      };
    }

    // No valid data available
    return {
      value: 0,
      formatted: '$0',
      source: 'none',
      available: false
    };
  };

  // Memoize summary metrics to prevent duplicate calculations
  const summaryMetrics = useMemo(() => {
    return calculateSummaryMetrics();
  }, [forecastData, filters, localSettings]);

  const budgetData = getBudgetCategories();
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

        </div>
      )}

      {/* Comprehensive Filter Controls */}
      <div className="p-4 border-b border-gray-200 bg-gray-50/50">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Filter Header */}
          <div 
            className="flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-md transition-colors" 
            onClick={() => setFiltersCollapsed(!filtersCollapsed)}
            data-testid="button-toggle-filters"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold text-lg">Budget Filters</h3>
            </div>
            {filtersCollapsed ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform" />
            ) : (
              <ChevronUp className="w-5 h-5 text-muted-foreground transition-transform" />
            )}
          </div>

          {!filtersCollapsed && (
            <>
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
                    const defaultPeriodLength = value === 'month' ? 12 : 5;
                    setFilters(prev => ({
                      ...prev,
                      viewType: value,
                      periodLength: defaultPeriodLength, // Reset to default
                    }));
                    
                    // CRITICAL FIX: When switching to yearly view, sync periodLength to investmentHorizonYears
                    if (value === 'year') {
                      setLocalSettings(prev => ({
                        ...prev,
                        investmentHorizonYears: defaultPeriodLength,
                      }));
                      debugLog('View type changed to yearly, synced periodLength to investmentHorizonYears', { 
                        viewType: value, 
                        periodLength: defaultPeriodLength 
                      });
                    }
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
                        const periodLength = parseInt(value);
                        setFilters(prev => ({
                          ...prev,
                          periodLength,
                        }));
                        
                        // CRITICAL FIX: When in yearly view, sync periodLength to investmentHorizonYears for forecast API
                        if (filters.viewType === 'year') {
                          setLocalSettings(prev => ({
                            ...prev,
                            investmentHorizonYears: periodLength,
                          }));
                          debugLog('Period length synced to investmentHorizonYears', { 
                            periodLength, 
                            viewType: filters.viewType 
                          });
                        }
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
                            <SelectItem value="15">15 years</SelectItem>
                            <SelectItem value="20">20 years</SelectItem>
                            <SelectItem value="25">25 years</SelectItem>
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-capital-investments" className="text-sm cursor-pointer flex items-center gap-2">
                      <PiggyBank className="w-4 h-4 text-orange-500" />
                      Capital Investments ({capitalInvestmentMode})
                    </Label>
                    <Switch 
                      id="toggle-capital-investments"
                      checked={filters.dataVisibility.capitalInvestments}
                      onCheckedChange={(checked) => {
                        setFilters(prev => ({
                          ...prev,
                          dataVisibility: { ...prev.dataVisibility, capitalInvestments: checked },
                        }));
                      }}
                      data-testid="switch-capital-investments-visibility"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-minimum-requirement" className="text-sm cursor-pointer flex items-center gap-2">
                      <Target className="w-4 h-4 text-amber-600" />
                      Minimum Requirement
                    </Label>
                    <Switch 
                      id="toggle-minimum-requirement"
                      checked={filters.dataVisibility.minimumRequirement}
                      onCheckedChange={(checked) => {
                        setFilters(prev => ({
                          ...prev,
                          dataVisibility: { ...prev.dataVisibility, minimumRequirement: checked },
                        }));
                      }}
                      data-testid="switch-minimum-requirement-visibility"
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
                  Data: {Object.entries(filters.dataVisibility).filter(([_, visible]) => visible).length} of 5 categories visible
                </span>
              </div>
            </>
          )}
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
                  </CardContent>
                </Card>
                
                <Card data-testid="card-monthly-income">
                  <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>Monthly Revenue</CardTitle>
                    <TrendingUp className='h-4 w-4 text-muted-foreground' />
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold'>
                      ${calculateTotalRevenue().toLocaleString()}
                    </div>
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
                  </CardContent>
                </Card>
              </div>


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
                    {filters.dataVisibility.capitalInvestments && (
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${capitalInvestmentMode === 'urgent' ? 'bg-red-600' : 'bg-orange-500'}`}></div>
                        <span className="text-sm font-medium">Capital Investments ({capitalInvestmentMode})</span>
                      </div>
                    )}
                    {filters.dataVisibility.minimumRequirement && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-amber-600 border-dashed"></div>
                        <span className="text-sm font-medium">Minimum Requirement</span>
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
                                netCashFlow: 'Net Cash Flow',
                                capitalInvestments: `Capital Investments (${capitalInvestmentMode})`
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

                          {/* Capital Investments Line - Color based on scenario mode */}
                          {filters.dataVisibility.capitalInvestments && (
                            <RechartsLine
                              type="monotone"
                              dataKey="capitalInvestments"
                              stroke={capitalInvestmentMode === 'urgent' ? '#dc2626' : '#f59e0b'}
                              strokeWidth={2}
                              strokeDasharray={capitalInvestmentMode === 'urgent' ? '5,5' : undefined}
                              dot={{ fill: capitalInvestmentMode === 'urgent' ? '#dc2626' : '#f59e0b', strokeWidth: 2, r: 4 }}
                              name="capitalInvestments"
                            />
                          )}
                          
                          {/* Minimum Requirement Reference Line */}
                          {filters.dataVisibility.minimumRequirement && forecastData?.minimumFund && (
                            <RechartsReferenceLine
                              y={forecastData.minimumFund}
                              stroke="#d97706"
                              strokeDasharray="8,4"
                              strokeWidth={2}
                              label={{ 
                                value: `Min Req: $${forecastData.minimumFund.toLocaleString()}`, 
                                position: 'right',
                                style: { fill: '#d97706', fontSize: '12px', fontWeight: 'bold' }
                              }}
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
                        {Object.values(filters.dataVisibility).filter(Boolean).length} of 6 series visible
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Configuration Cards */}
              <div className='grid grid-cols-1 gap-6'>
                {/* Bank Account Configuration */}
                <Card data-testid="card-bank-account-config">
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <Building className='w-5 h-5' />
                      Bank Account Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    {/* Starting Balance with Date */}
                    <div className='grid grid-cols-2 gap-4'>
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
                        {/* Current Balance Suggestion - Always Available with Robust Fallbacks */}
                        {(() => {
                          const currentBalanceInfo = getCurrentBalanceWithFallbacks();
                          const isLoading = forecastLoading || bankAccountLoading;
                          const isValueChanged = currentBalanceInfo.value !== localSettings.bankAccountStartAmount;
                          const isValidValue = currentBalanceInfo.available && Number.isFinite(currentBalanceInfo.value);
                          
                          return (
                            <div className='flex items-center justify-between text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 rounded-md p-2'>
                              <span>
                                {currentBalanceInfo.available ? (
                                  <span className='flex items-center gap-2'>
                                    <span>
                                      Current balance: <span className='font-medium text-foreground' data-testid="text-current-balance">{currentBalanceInfo.formatted}</span>
                                    </span>
                                    <span className='flex items-center gap-1 text-xs text-muted-foreground'>
                                      <span>
                                        {currentBalanceInfo.source === 'saved_balance' ? `(saved on ${currentBalanceInfo.savedDate})` :
                                         currentBalanceInfo.source === 'forecast' ? '(from forecast)' :
                                         currentBalanceInfo.source === 'forecast_starting' ? '(from forecast start)' : 
                                         currentBalanceInfo.source === 'bank_account' ? '(from bank data)' : 
                                         currentBalanceInfo.source === 'local_settings' ? '(from settings)' : '(no data)'}
                                      </span>
                                    </span>
                                  </span>
                                ) : (
                                  <span className='flex items-center gap-2'>
                                    {(forecastLoading || bankAccountLoading) ? (
                                      <>
                                        <div className='w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin'></div>
                                        Loading current balance...
                                      </>
                                    ) : (
                                      <span className='text-orange-600'>No balance data available</span>
                                    )}
                                  </span>
                                )}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!isValidValue || !isValueChanged}
                                onClick={() => {
                                  if (!isValidValue) return;
                                  
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    bankAccountStartAmount: currentBalanceInfo.value,
                                  }));
                                  
                                  toast({
                                    title: 'Current balance applied',
                                    description: `Starting balance set to ${currentBalanceInfo.formatted}`,
                                  });
                                }}
                                className='h-6 px-2 text-xs'
                                data-testid="button-use-current-balance"
                                title={!isValidValue ? 'No valid balance data available' : 
                                       !isValueChanged ? 'Value is already set' : 'Apply current balance'}
                              >
                                Use Current Balance
                              </Button>
                            </div>
                          );
                        })()}
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor="balance-date">Balance Date</Label>
                        <Input
                          id="balance-date"
                          type="date"
                          value={localSettings.bankAccountStartDate}
                          onChange={(e) =>
                            setLocalSettings(prev => ({
                              ...prev,
                              bankAccountStartDate: e.target.value,
                            }))
                          }
                          data-testid="input-balance-date"
                        />
                      </div>
                    </div>

                    {/* Save Account Balance Button */}
                    <div className='flex items-center justify-between pt-3 border-t'>
                      <div className='text-sm text-muted-foreground'>
                        Save the current Starting Balance and Balance Date to the server
                      </div>
                      <Button
                        type="button"
                        onClick={() => saveBankAccountMutation.mutate()}
                        disabled={saveBankAccountMutation.isPending}
                        className='flex items-center gap-2'
                        data-testid="button-save-account-balance"
                      >
                        {saveBankAccountMutation.isPending ? (
                          <>
                            <div className='w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin'></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <PiggyBank className='w-4 h-4' />
                            Save Account Balance
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Bank Account Summary */}
                    <div className='pt-2 border-t space-y-2'>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>Starting Balance:</span>
                        <span className='font-medium'>${localSettings.bankAccountStartAmount?.toLocaleString()}</span>
                      </div>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>Balance Date:</span>
                        <span className='font-medium'>
                          {localSettings.bankAccountStartDate ? new Date(localSettings.bankAccountStartDate).toLocaleDateString() : 'Not set'}
                        </span>
                      </div>
                      {(bankAccountData as BankAccountData)?.bankAccountUpdatedAt && (
                        <div className='flex justify-between text-sm'>
                          <span className='text-muted-foreground'>Last Updated:</span>
                          <span className='font-medium text-blue-600'>
                            {new Date((bankAccountData as BankAccountData).bankAccountUpdatedAt!).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Minimum requirement */}
                <Card data-testid="card-minimum-requirement-config">
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <Target className='w-5 h-5' />
                      Minimum requirement
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4'>

                    {/* Dynamic Custom Bank Account Fields */}
                    <div className='space-y-3'>
                      <Label className='flex items-center gap-2'>
                        <Settings className='w-4 h-4' />
                        Custom Bank Account Fields
                      </Label>
                      
                      {/* Existing Custom Bank Account Fields */}
                      {customBankFields.map((field) => (
                        <div key={field.id} className='flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg'>
                          <div className='flex-1 space-y-2'>
                            <Input
                              value={field.fieldName}
                              onChange={(e) =>
                                updateCustomBankField(field.id, { fieldName: e.target.value })
                              }
                              placeholder="Field name"
                              className='text-sm font-medium'
                              data-testid={`input-bank-field-name-${field.id}`}
                            />
                            <div className='relative'>
                              <DollarSign className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                              <Input
                                type="number"
                                step="0.01"
                                value={field.fieldValue}
                                onChange={(e) => {
                                  const newValue = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                  if (!isNaN(newValue) && newValue >= 0) {
                                    updateCustomBankField(field.id, { fieldValue: newValue });
                                  }
                                }}
                                placeholder="0"
                                className='pl-9'
                                data-testid={`input-bank-field-value-${field.id}`}
                              />
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCustomBankField(field.id)}
                            className='text-red-500 hover:text-red-700'
                            data-testid={`button-remove-bank-field-${field.id}`}
                          >
                            <Minus className='w-4 h-4' />
                          </Button>
                        </div>
                      ))}

                      {/* Add New Custom Bank Account Field */}
                      <div className='space-y-3 p-3 border-2 border-dashed border-gray-300 rounded-lg'>
                        <div className='grid grid-cols-1 gap-3'>
                          <div>
                            <Label htmlFor="bank-field-name">Field Name</Label>
                            <Input
                              id="bank-field-name"
                              type="text"
                              value={newBankField.fieldName}
                              onChange={(e) =>
                                setNewBankField(prev => ({
                                  ...prev,
                                  fieldName: e.target.value,
                                }))
                              }
                              placeholder="e.g., Reserve Fund, Maintenance Buffer, Capital Reserve"
                              data-testid="input-new-bank-field-name"
                            />
                          </div>
                          <div className='flex gap-2'>
                            <div className='flex-1'>
                              <Label htmlFor="bank-field-value">Value ($)</Label>
                              <div className='relative'>
                                <DollarSign className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                                <Input
                                  id="bank-field-value"
                                  type="number"
                                  value={newBankField.fieldValue}
                                  onChange={(e) =>
                                    setNewBankField(prev => ({
                                      ...prev,
                                      fieldValue: e.target.value,
                                    }))
                                  }
                                  placeholder="0.00"
                                  className="pl-9"
                                  data-testid="input-new-bank-field-value"
                                />
                              </div>
                            </div>
                            <div className='flex items-end'>
                              <Button
                                onClick={addCustomBankField}
                                disabled={!newBankField.fieldName.trim() || !newBankField.fieldValue.trim()}
                                data-testid="button-add-custom-bank-field"
                              >
                                <Plus className='w-4 h-4 mr-2' />
                                Add
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Minimum Requirement Summary */}
                    <div className='pt-2 border-t space-y-2'>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>Total Minimum Requirement:</span>
                        <span className='font-medium'>
                          ${customBankFields.reduce((total, field) => total + field.fieldValue, 0).toLocaleString()}
                        </span>
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        Includes Emergency Fund + Operating Cash + Custom Fields
                      </div>
                    </div>

                    {/* Save Bank Account Settings Button */}
                    <div className='pt-4 border-t'>
                      <Button 
                        onClick={() => saveBankAccountMutation.mutate()}
                        disabled={saveBankAccountMutation.isPending}
                        className='w-full'
                        data-testid="button-save-minimum-requirement"
                      >
                        {saveBankAccountMutation.isPending ? (
                          <>
                            <div className='animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2'></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <Target className='w-4 h-4 mr-2' />
                            Save Minimum requirement
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Revenue Configuration */}
                <div className="w-full mb-6">
                  <Card data-testid="card-revenue-config">
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <TrendingUpIcon className='w-5 h-5' />
                      Revenue Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    {/* Revenue Growth Rate (keep existing) */}
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

                    {/* Residence Revenue Display */}
                    <div className='space-y-3'>
                      <Label className='flex items-center gap-2'>
                        <Building2 className='w-4 h-4' />
                        Residence Revenue
                      </Label>
                      <div className='bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg' data-testid="residence-revenue-display">
                        {residencesLoading ? (
                          <div className='flex items-center justify-center py-4'>
                            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                              <div className='animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full'></div>
                              Loading residence data...
                            </div>
                          </div>
                        ) : residencesError ? (
                          <div className='flex items-center justify-center py-4'>
                            <div className='text-center'>
                              <p className='text-sm text-red-600 mb-1'>Failed to load residence data</p>
                              <p className='text-xs text-muted-foreground'>Revenue calculation may be incomplete</p>
                            </div>
                          </div>
                        ) : (
                          <div className='flex items-center justify-between'>
                            <div className='space-y-1'>
                              <p className='text-sm font-medium'>Monthly Residence Fees</p>
                              <p className='text-xs text-muted-foreground'>
                                {residences?.filter(r => r?.isActive !== false).length || 0} active residences
                              </p>
                            </div>
                            <div className='text-right'>
                              <p className='text-lg font-semibold text-blue-600'>
                                ${calculateResidenceRevenue().toLocaleString()}
                              </p>
                              <p className='text-xs text-muted-foreground'>per month</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Custom Revenue Lines */}
                    <div className='space-y-3'>
                      <Label className='flex items-center gap-2'>
                        <Plus className='w-4 h-4' />
                        Custom Revenue Sources
                      </Label>
                      
                      {/* Existing Custom Revenue Lines */}
                      {customRevenueLines.map((line) => (
                        <div key={line.id} className='flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg'>
                          <div className='flex-1'>
                            <p className='text-sm font-medium'>{line.description}</p>
                            <p className='text-xs text-muted-foreground'>Monthly revenue</p>
                          </div>
                          <div className='text-right'>
                            <p className='text-lg font-semibold text-green-600'>
                              ${line.monthlyAmount.toLocaleString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCustomRevenueLine(line.id)}
                            className='text-red-500 hover:text-red-700'
                            data-testid={`button-remove-revenue-${line.id}`}
                          >
                            <Minus className='w-4 h-4' />
                          </Button>
                        </div>
                      ))}

                      {/* Add New Custom Revenue Line */}
                      <div className='space-y-3 p-3 border-2 border-dashed border-gray-300 rounded-lg'>
                        <div className='grid grid-cols-1 gap-3'>
                          <div>
                            <Label htmlFor="revenue-description">Description</Label>
                            <Input
                              id="revenue-description"
                              type="text"
                              value={newRevenueLine.description}
                              onChange={(e) =>
                                setNewRevenueLine(prev => ({
                                  ...prev,
                                  description: e.target.value,
                                }))
                              }
                              placeholder="e.g., Laundry room, Parking fees, etc."
                              data-testid="input-revenue-description"
                            />
                          </div>
                          <div className='flex gap-2'>
                            <div className='flex-1'>
                              <Label htmlFor="revenue-amount">Monthly Amount ($)</Label>
                              <Input
                                id="revenue-amount"
                                type="number"
                                value={newRevenueLine.monthlyAmount}
                                onChange={(e) =>
                                  setNewRevenueLine(prev => ({
                                    ...prev,
                                    monthlyAmount: e.target.value,
                                  }))
                                }
                                placeholder="0.00"
                                data-testid="input-revenue-amount"
                              />
                            </div>
                            <div className='flex items-end'>
                              <Button
                                onClick={addCustomRevenueLine}
                                disabled={!newRevenueLine.description.trim() || !newRevenueLine.monthlyAmount.trim()}
                                data-testid="button-add-custom-revenue"
                              >
                                <Plus className='w-4 h-4 mr-2' />
                                Add
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Revenue Summary */}
                    <div className='pt-2 border-t space-y-2'>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>Residence Revenue:</span>
                        <span className='font-medium'>${calculateResidenceRevenue().toLocaleString()}</span>
                      </div>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>Custom Revenue:</span>
                        <span className='font-medium'>
                          ${customRevenueLines.reduce((total, line) => total + line.monthlyAmount, 0).toLocaleString()}
                        </span>
                      </div>
                      <div className='flex justify-between text-base font-semibold pt-2 border-t'>
                        <span>Total Monthly Revenue:</span>
                        <span className='text-green-600'>${calculateTotalRevenue().toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Save Revenue Configuration Button */}
                    <div className='pt-4 border-t'>
                      <Button 
                        onClick={() => saveRevenueConfigurationMutation.mutate()}
                        disabled={saveRevenueConfigurationMutation.isPending}
                        className='w-full'
                        data-testid="button-save-revenue-config"
                      >
                        {saveRevenueConfigurationMutation.isPending ? (
                          <>
                            <div className='animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2'></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <TrendingUpIcon className='w-4 h-4 mr-2' />
                            Save Revenue Configuration
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                  </Card>
                </div>

                {/* Bills Configuration */}
                <div className="w-full mb-6">
                  <Card data-testid="card-bills-config">
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <Receipt className='w-5 h-5' />
                      Bills Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div className='grid grid-cols-2 gap-4'>
                      <div className='text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg'>
                        <div className='text-lg font-semibold text-blue-600'>
                          {forecastData?.recurrentBillsCount || 0}
                        </div>
                        <div className='text-sm text-blue-600'>Recurrent Bills</div>
                      </div>
                      <div className='text-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg'>
                        <div className='text-lg font-semibold text-purple-600'>
                          {forecastData?.uniqueBillsCount || 0}
                        </div>
                        <div className='text-sm text-purple-600'>Unique Bills</div>
                      </div>
                    </div>

                    {/* Inflation Rate Controls */}
                    <div className='space-y-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg'>
                      <Label className='flex items-center gap-2 text-base font-semibold'>
                        <Percent className='w-4 h-4' />
                        Inflation Rate Settings
                      </Label>
                      
                      {/* Global vs Per-Category Toggle */}
                      <div className='flex items-center justify-between'>
                        <div className='space-y-0.5'>
                          <Label className='text-sm'>Inflation Rate Mode</Label>
                          <p className='text-xs text-muted-foreground'>
                            {localSettings.useGlobalBillsInflation 
                              ? 'Apply same rate to all bills'
                              : 'Set different rates per category'
                            }
                          </p>
                        </div>
                        <div className='flex items-center space-x-2'>
                          <Label className='text-xs'>Per-Category</Label>
                          <Switch
                            checked={localSettings.useGlobalBillsInflation}
                            onCheckedChange={(checked) =>
                              setLocalSettings(prev => ({
                                ...prev,
                                useGlobalBillsInflation: checked,
                              }))
                            }
                            data-testid="switch-inflation-mode"
                          />
                          <Label className='text-xs'>Global</Label>
                        </div>
                      </div>

                      {/* Global Inflation Rate */}
                      {localSettings.useGlobalBillsInflation && (
                        <div className='space-y-2'>
                          <Label htmlFor="global-inflation" className='text-sm'>
                            Global Bills Inflation Rate (%)
                          </Label>
                          <div className='relative'>
                            <Percent className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                            <Input
                              id="global-inflation"
                              type="number"
                              step="0.1"
                              min="0"
                              max="20"
                              value={localSettings.globalBillsInflationRate}
                              onChange={(e) =>
                                setLocalSettings(prev => ({
                                  ...prev,
                                  globalBillsInflationRate: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="pl-9"
                              placeholder="2.5"
                              data-testid="input-global-inflation"
                            />
                          </div>
                          <p className='text-xs text-muted-foreground'>
                            Applied to all bill categories for future projections
                          </p>
                        </div>
                      )}

                      {/* Per-Category Inflation Rates */}
                      {!localSettings.useGlobalBillsInflation && (
                        <div className='space-y-3'>
                          <Label className='text-sm'>Category-Specific Inflation Rates (%)</Label>
                          <div className='grid grid-cols-1 gap-3'>
                            <div className='flex items-center gap-2'>
                              <div className='flex-1'>
                                <Label htmlFor="utilities-inflation" className='text-xs'>Utilities</Label>
                                <div className='relative'>
                                  <Percent className='absolute left-2 top-2.5 h-3 w-3 text-muted-foreground' />
                                  <Input
                                    id="utilities-inflation"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="20"
                                    value={localSettings.categoryInflationRates?.utilities}
                                    onChange={(e) =>
                                      setLocalSettings(prev => ({
                                        ...prev,
                                        categoryInflationRates: {
                                          ...prev.categoryInflationRates,
                                          utilities: parseFloat(e.target.value) || 0,
                                        },
                                      }))
                                    }
                                    className="pl-6 text-xs"
                                    placeholder="3.0"
                                    data-testid="input-utilities-inflation"
                                  />
                                </div>
                              </div>
                              <div className='flex-1'>
                                <Label htmlFor="maintenance-inflation" className='text-xs'>Maintenance</Label>
                                <div className='relative'>
                                  <Percent className='absolute left-2 top-2.5 h-3 w-3 text-muted-foreground' />
                                  <Input
                                    id="maintenance-inflation"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="20"
                                    value={localSettings.categoryInflationRates?.maintenance}
                                    onChange={(e) =>
                                      setLocalSettings(prev => ({
                                        ...prev,
                                        categoryInflationRates: {
                                          ...prev.categoryInflationRates,
                                          maintenance: parseFloat(e.target.value) || 0,
                                        },
                                      }))
                                    }
                                    className="pl-6 text-xs"
                                    placeholder="2.5"
                                    data-testid="input-maintenance-inflation"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className='flex items-center gap-2'>
                              <div className='flex-1'>
                                <Label htmlFor="general-inflation" className='text-xs'>General</Label>
                                <div className='relative'>
                                  <Percent className='absolute left-2 top-2.5 h-3 w-3 text-muted-foreground' />
                                  <Input
                                    id="general-inflation"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="20"
                                    value={localSettings.categoryInflationRates?.general}
                                    onChange={(e) =>
                                      setLocalSettings(prev => ({
                                        ...prev,
                                        categoryInflationRates: {
                                          ...prev.categoryInflationRates,
                                          general: parseFloat(e.target.value) || 0,
                                        },
                                      }))
                                    }
                                    className="pl-6 text-xs"
                                    placeholder="2.0"
                                    data-testid="input-general-inflation"
                                  />
                                </div>
                              </div>
                              <div className='flex-1'>
                                <Label htmlFor="other-inflation" className='text-xs'>Other</Label>
                                <div className='relative'>
                                  <Percent className='absolute left-2 top-2.5 h-3 w-3 text-muted-foreground' />
                                  <Input
                                    id="other-inflation"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="20"
                                    value={localSettings.categoryInflationRates?.other}
                                    onChange={(e) =>
                                      setLocalSettings(prev => ({
                                        ...prev,
                                        categoryInflationRates: {
                                          ...prev.categoryInflationRates,
                                          other: parseFloat(e.target.value) || 0,
                                        },
                                      }))
                                    }
                                    className="pl-6 text-xs"
                                    placeholder="2.0"
                                    data-testid="input-other-inflation"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                          <p className='text-xs text-muted-foreground'>
                            Set different inflation rates for each category of bills
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Unplanned Bills */}
                    <div className='space-y-3 p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg'>
                      <Label htmlFor="unplanned-bills" className='flex items-center gap-2 text-sm font-semibold text-orange-700 dark:text-orange-300'>
                        <CreditCard className='w-4 h-4' />
                        Unplanned Bills (Monthly)
                      </Label>
                      <div className='space-y-2'>
                        <div className='relative'>
                          <DollarSign className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                          <Input
                            id="unplanned-bills"
                            type="number"
                            min="0"
                            step="0.01"
                            value={localSettings.unplannedBillsAmount}
                            onChange={(e) =>
                              setLocalSettings(prev => ({
                                ...prev,
                                unplannedBillsAmount: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="pl-9"
                            placeholder="0.00"
                            data-testid="input-unplanned-bills"
                          />
                        </div>
                        <div className='flex gap-2'>
                          <Button
                            size="sm"
                            onClick={() => saveUnplannedBillsMutation.mutate(localSettings.unplannedBillsAmount || 0)}
                            disabled={saveUnplannedBillsMutation.isPending}
                            className='flex-1 bg-orange-600 hover:bg-orange-700 text-white'
                            data-testid="button-save-unplanned-bills"
                          >
                            {saveUnplannedBillsMutation.isPending ? (
                              <>
                                <div className='animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full mr-2'></div>
                                Saving...
                              </>
                            ) : (
                              <>
                                <CreditCard className='w-3 h-3 mr-2' />
                                Save
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className='space-y-1'>
                        <p className='text-xs text-orange-600 dark:text-orange-400'>
                          Additional budget for unexpected expenses each month
                        </p>
                        {localSettings.unplannedBillsAmount > 0 ? (
                          <p className='text-xs text-orange-700 dark:text-orange-300 font-medium'>
                            ✓ Manual override: ${localSettings.unplannedBillsAmount.toLocaleString()}/month
                          </p>
                        ) : (
                          <p className='text-xs text-muted-foreground'>
                            💡 Based on historical data (set to 0 for manual control)
                          </p>
                        )}
                      </div>
                    </div>


                    {/* Summary */}
                    <div className='pt-2 border-t space-y-1'>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>Monthly Expenses:</span>
                        <span className='font-medium'>${Number(summaryMetrics?.monthlySpending ?? 0).toLocaleString()}</span>
                      </div>
                      {localSettings.unplannedBillsAmount > 0 && (
                        <div className='flex justify-between text-sm'>
                          <span className='text-orange-600 dark:text-orange-400'>Unplanned Bills:</span>
                          <span className='font-medium text-orange-600 dark:text-orange-400'>
                            ${localSettings.unplannedBillsAmount.toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className='flex justify-between text-sm font-semibold pt-1 border-t'>
                        <span>Total Monthly Expenses:</span>
                        <span>
                          ${Number(summaryMetrics?.monthlySpending ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                </div>


                {/* Capital Investment Scenarios */}
                <Card data-testid="card-capital-investment-scenarios">
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <Building2 className='w-5 h-5' />
                      Capital Investment Scenarios
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-6'>
                    {/* Capital Investment Mode Selection */}
                    <div className='bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
                      <div className='flex flex-col space-y-3'>
                        <div className='flex items-center gap-2 mb-2'>
                          <Target className='w-4 h-4 text-blue-600 dark:text-blue-400' />
                          <span className='text-sm font-medium text-blue-700 dark:text-blue-300'>Capital Investment Strategy</span>
                        </div>
                        <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
                          <label 
                            className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                              capitalInvestmentMode === 'urgent' 
                                ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/30' 
                                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                            }`}
                            data-testid="label-urgent-capital-mode"
                          >
                            <div className='flex items-center space-x-3'>
                              <input
                                type="radio"
                                name="capitalInvestmentMode"
                                value="urgent"
                                checked={capitalInvestmentMode === 'urgent'}
                                onChange={(e) => setCapitalInvestmentMode(e.target.value as 'urgent' | 'suggested')}
                                className='text-blue-600 focus:ring-blue-500'
                                data-testid="radio-urgent-capital-mode"
                              />
                              <div className='flex-1'>
                                <div className='font-medium text-gray-900 dark:text-gray-100'>Urgent Capital Only</div>
                                <div className='text-sm text-gray-600 dark:text-gray-400'>Only inject capital when balance would go below $0 (emergency injection)</div>
                                {(() => {
                                  const monthlyPayment = calculateUrgentMonthlyPayment();
                                  return monthlyPayment > 0 ? (
                                    <div className='text-sm font-medium text-red-600 dark:text-red-400 mt-1' data-testid="text-urgent-monthly-payment">
                                      Monthly Payment: ${monthlyPayment.toLocaleString()}
                                    </div>
                                  ) : (
                                    <div className='text-sm font-medium text-green-600 dark:text-green-400 mt-1'>
                                      No payment needed
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </label>
                          
                          <label 
                            className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                              capitalInvestmentMode === 'suggested' 
                                ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/30' 
                                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                            }`}
                            data-testid="label-suggested-capital-mode"
                          >
                            <div className='flex items-center space-x-3'>
                              <input
                                type="radio"
                                name="capitalInvestmentMode"
                                value="suggested"
                                checked={capitalInvestmentMode === 'suggested'}
                                onChange={(e) => setCapitalInvestmentMode(e.target.value as 'urgent' | 'suggested')}
                                className='text-blue-600 focus:ring-blue-500'
                                data-testid="radio-suggested-capital-mode"
                              />
                              <div className='flex-1'>
                                <div className='font-medium text-gray-900 dark:text-gray-100'>Suggested Capital</div>
                                <div className='text-sm text-gray-600 dark:text-gray-400'>Inject capital to maintain minimum requirement threshold</div>
                                {(() => {
                                  const monthlyPayment = calculateSuggestedMonthlyPayment();
                                  return monthlyPayment > 0 ? (
                                    <div className='text-sm font-medium text-yellow-600 dark:text-yellow-400 mt-1' data-testid="text-suggested-monthly-payment">
                                      Monthly Payment: ${monthlyPayment.toLocaleString()}
                                    </div>
                                  ) : (
                                    <div className='text-sm font-medium text-green-600 dark:text-green-400 mt-1'>
                                      No payment needed
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </label>
                        </div>
                        <div className='text-xs text-blue-600 dark:text-blue-400 mt-2'>
                          💡 This setting affects the forecast calculations and capital investment timing in the budget graph
                        </div>
                      </div>
                    </div>
                    {/* Investment Summary & Filters */}
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                      {/* Summary Cards */}
                      {(() => {
                        const summary = calculateInvestmentSummary();
                        return (
                          <>
                            <div className='bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3'>
                              <div className='flex items-center gap-2 mb-2'>
                                <div className='w-3 h-3 bg-red-500 rounded-full'></div>
                                <span className='text-sm font-medium text-red-700 dark:text-red-300'>Urgent</span>
                              </div>
                              <div className='text-2xl font-bold text-red-900 dark:text-red-100' data-testid="text-urgent-amount">
                                ${summary.urgentAmount.toLocaleString()}
                              </div>
                              <div className='text-xs text-red-600 dark:text-red-400'>
                                {summary.urgentCount} investment{summary.urgentCount !== 1 ? 's' : ''}
                              </div>
                            </div>
                            
                            <div className='bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3'>
                              <div className='flex items-center gap-2 mb-2'>
                                <div className='w-3 h-3 bg-yellow-500 rounded-full'></div>
                                <span className='text-sm font-medium text-yellow-700 dark:text-yellow-300'>Suggested</span>
                              </div>
                              <div className='text-2xl font-bold text-yellow-900 dark:text-yellow-100' data-testid="text-suggested-amount">
                                ${summary.suggestedAmount.toLocaleString()}
                              </div>
                              <div className='text-xs text-yellow-600 dark:text-yellow-400'>
                                {summary.suggestedCount} investment{summary.suggestedCount !== 1 ? 's' : ''}
                              </div>
                            </div>
                            
                            <div className='bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3'>
                              <div className='flex items-center gap-2 mb-2'>
                                <div className='w-3 h-3 bg-green-500 rounded-full'></div>
                                <span className='text-sm font-medium text-green-700 dark:text-green-300'>Not Urgent</span>
                              </div>
                              <div className='text-2xl font-bold text-green-900 dark:text-green-100' data-testid="text-not-urgent-amount">
                                ${summary.notUrgentAmount.toLocaleString()}
                              </div>
                              <div className='text-xs text-green-600 dark:text-green-400'>
                                {summary.notUrgentCount} investment{summary.notUrgentCount !== 1 ? 's' : ''}
                              </div>
                            </div>
                            
                            <div className='bg-gray-50 dark:bg-gray-950/20 border border-gray-200 dark:border-gray-800 rounded-lg p-3'>
                              <div className='flex items-center gap-2 mb-2'>
                                <Calculator className='w-4 h-4 text-gray-600 dark:text-gray-400' />
                                <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>Total</span>
                              </div>
                              <div className='text-2xl font-bold text-gray-900 dark:text-gray-100' data-testid="text-total-amount">
                                ${summary.totalAmount.toLocaleString()}
                              </div>
                              <div className='text-xs text-gray-600 dark:text-gray-400'>
                                {summary.count} investment{summary.count !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Investment Controls */}
                    <div className='flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between'>
                      <div className='flex flex-wrap gap-2'>
                        {/* Urgency Filter */}
                        <Select 
                          value={investmentFilters.urgency || 'all'} 
                          onValueChange={(value) => 
                            setInvestmentFilters(prev => ({ 
                              ...prev, 
                              urgency: value as any 
                            }))
                          }
                        >
                          <SelectTrigger className="w-[140px]" data-testid="select-urgency-filter">
                            <Filter className='w-4 h-4 mr-2' />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Urgency</SelectItem>
                            <SelectItem value="urgent">Urgent Only</SelectItem>
                            <SelectItem value="suggested">Suggested Only</SelectItem>
                            <SelectItem value="not_urgent">Not Urgent Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Add Investment Button */}
                      <Dialog open={addInvestmentDialogOpen} onOpenChange={setAddInvestmentDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" data-testid="button-add-investment">
                            <Plus className='w-4 h-4 mr-2' />
                            Add Investment
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add New Investment</DialogTitle>
                          </DialogHeader>
                          <div className='space-y-4'>
                            <div className='space-y-2'>
                              <Label htmlFor="investment-title">Title *</Label>
                              <Input
                                id="investment-title"
                                value={newInvestment.title}
                                onChange={(e) => setNewInvestment(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="e.g., Roof Replacement"
                                data-testid="input-investment-title"
                              />
                            </div>
                            
                            <div className='space-y-2'>
                              <Label htmlFor="investment-description">Description</Label>
                              <Input
                                id="investment-description"
                                value={newInvestment.description}
                                onChange={(e) => setNewInvestment(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Optional details about the investment"
                                data-testid="input-investment-description"
                              />
                            </div>
                            
                            <div className='grid grid-cols-2 gap-4'>
                              <div className='space-y-2'>
                                <Label htmlFor="investment-amount">Amount *</Label>
                                <div className='relative'>
                                  <DollarSign className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                                  <Input
                                    id="investment-amount"
                                    type="number"
                                    value={newInvestment.amount}
                                    onChange={(e) => setNewInvestment(prev => ({ ...prev, amount: e.target.value }))}
                                    placeholder="25000"
                                    className="pl-9"
                                    data-testid="input-investment-amount"
                                  />
                                </div>
                              </div>
                              
                              <div className='space-y-2'>
                                <Label htmlFor="investment-date">Target Date *</Label>
                                <Input
                                  id="investment-date"
                                  type="date"
                                  value={newInvestment.targetDate}
                                  onChange={(e) => setNewInvestment(prev => ({ ...prev, targetDate: e.target.value }))}
                                  data-testid="input-investment-date"
                                />
                              </div>
                            </div>
                            
                            <div className='grid grid-cols-2 gap-4'>
                              <div className='space-y-2'>
                                <Label htmlFor="investment-urgency">Urgency Level</Label>
                                <Select 
                                  value={newInvestment.urgency} 
                                  onValueChange={(value) => setNewInvestment(prev => ({ ...prev, urgency: value as any }))}
                                >
                                  <SelectTrigger data-testid="select-investment-urgency">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="not_urgent">Not Urgent</SelectItem>
                                    <SelectItem value="suggested">Suggested</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div className='space-y-2'>
                                <Label htmlFor="investment-ownership">Ownership Type</Label>
                                <Select 
                                  value={newInvestment.ownershipType} 
                                  onValueChange={(value) => setNewInvestment(prev => ({ ...prev, ownershipType: value as any }))}
                                >
                                  <SelectTrigger data-testid="select-investment-ownership">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="residences">For Residences</SelectItem>
                                    <SelectItem value="owner">For Owner</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            <div className='flex gap-2 pt-4'>
                              <Button onClick={addInvestment} className='flex-1' data-testid="button-save-investment">
                                Add Investment
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={() => setAddInvestmentDialogOpen(false)}
                                data-testid="button-cancel-investment"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Investment List */}
                    <div className='space-y-3'>
                      {(() => {
                        const filteredInvestments = getFilteredInvestments();
                        
                        if (filteredInvestments.length === 0) {
                          // CRITICAL FIX: Add proper filter gate to respect investmentFilters.urgency
                          // Only show payment entries when filter allows them
                          const currentModeUrgency = capitalInvestmentMode === 'urgent' ? 'urgent' : 'suggested';
                          if (!(investmentFilters.urgency === 'all' || investmentFilters.urgency === currentModeUrgency)) {
                            // Return original empty state if filters don't match
                            return (
                              <div className='text-center py-8 text-muted-foreground' data-testid="text-no-investments-filtered">
                                <Building2 className='w-8 h-8 mx-auto mb-2 opacity-50' />
                                <p>No investments match the current filters</p>
                                <p className='text-sm'>Add custom investments or adjust filters to see items</p>
                              </div>
                            );
                          }
                          
                          // Calculate monthly payment based on current capital investment mode
                          const monthlyPayment = capitalInvestmentMode === 'urgent' 
                            ? calculateUrgentMonthlyPayment() 
                            : calculateSuggestedMonthlyPayment();
                          
                          // Only show monthly payment entries if payment > 0
                          if (monthlyPayment > 0) {
                            // Generate monthly payment entries for current time window
                            const paymentEntries: (CapitalInvestment & { isMonthlyPayment: boolean })[] = [];
                            const startMonth = filters.startMonth || 1;
                            const startYear = filters.startYear || new Date().getFullYear();
                            const totalMonths = filters.viewType === 'year' 
                              ? filters.periodLength * 12 
                              : filters.periodLength;
                            
                            for (let i = 0; i < totalMonths; i++) {
                              const entryDate = new Date(startYear, startMonth - 1 + i, 1);
                              const monthName = entryDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                              
                              const description = capitalInvestmentMode === 'urgent'
                                ? 'Monthly payment to prevent deficit'
                                : 'Monthly payment to maintain minimum requirement';
                              
                              const title = `${monthName} Payment`;
                              
                              paymentEntries.push({
                                id: `payment-${i}`,
                                title,
                                description,
                                amount: monthlyPayment,
                                targetDate: entryDate.toISOString().split('T')[0],
                                urgency: capitalInvestmentMode === 'urgent' ? 'urgent' as const : 'suggested' as const,
                                type: 'auto_generated' as const,
                                ownershipType: 'residences' as const,
                                category: 'monthly_payment',
                                createdAt: new Date().toISOString(),
                                isMonthlyPayment: true
                              });
                            }
                            
                            // Render monthly payment entries using existing investment styling
                            return paymentEntries.map((payment) => {
                              const urgencyConfig = {
                                urgent: { 
                                  bg: 'bg-red-100 dark:bg-red-950/30', 
                                  text: 'text-red-800 dark:text-red-200', 
                                  border: 'border-red-200 dark:border-red-800',
                                  badge: 'bg-red-500'
                                },
                                suggested: { 
                                  bg: 'bg-yellow-100 dark:bg-yellow-950/30', 
                                  text: 'text-yellow-800 dark:text-yellow-200', 
                                  border: 'border-yellow-200 dark:border-yellow-800',
                                  badge: 'bg-yellow-500'
                                },
                              };
                              
                              const config = urgencyConfig[payment.urgency as keyof typeof urgencyConfig];
                              const targetDate = new Date(payment.targetDate);
                              
                              return (
                                <div 
                                  key={payment.id} 
                                  className={`${config.bg} ${config.border} border rounded-lg p-4 mb-3`}
                                  data-testid={`card-payment-entry-${payment.id}`}
                                >
                                  <div className='flex items-start justify-between'>
                                    <div className='flex-1'>
                                      <div className='flex items-center gap-3 mb-2'>
                                        <h4 className={`font-semibold ${config.text}`} data-testid={`text-payment-title-${payment.id}`}>
                                          {payment.title}
                                        </h4>
                                        <div className='flex items-center gap-2'>
                                          <div className={`w-2 h-2 ${config.badge} rounded-full`} data-testid={`indicator-urgency-${payment.id}`}></div>
                                          <Badge variant="outline" className={`text-xs ${config.text} border-current`} data-testid={`badge-urgency-${payment.id}`}>
                                            {payment.urgency}
                                          </Badge>
                                          <Badge variant="secondary" className='text-xs' data-testid={`badge-type-${payment.id}`}>
                                            Monthly Payment
                                          </Badge>
                                        </div>
                                      </div>
                                      
                                      <p className={`text-sm ${config.text} opacity-80 mb-2`} data-testid={`text-payment-description-${payment.id}`}>
                                        {payment.description}
                                      </p>
                                      
                                      <div className='flex flex-wrap items-center gap-4 text-sm'>
                                        <span className={`font-medium ${config.text}`} data-testid={`text-payment-amount-${payment.id}`}>
                                          ${payment.amount.toLocaleString()}
                                        </span>
                                        <span className={`${config.text} opacity-75`} data-testid={`text-payment-date-${payment.id}`}>
                                          <Calendar className='w-3 h-3 inline mr-1' />
                                          {targetDate.toLocaleDateString()}
                                        </span>
                                        <span className={`${config.text} opacity-75`} data-testid={`text-payment-ownership-${payment.id}`}>
                                          <Building className='w-3 h-3 inline mr-1' />
                                          For Residences
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          }
                          
                          // Fall back to original empty state if no monthly payment needed
                          return (
                            <div className='text-center py-8 text-muted-foreground' data-testid="text-no-investments">
                              <Building2 className='w-8 h-8 mx-auto mb-2 opacity-50' />
                              <p>No investments match the current filters</p>
                              <p className='text-sm'>Add custom investments or adjust filters to see items</p>
                            </div>
                          );
                        }
                        
                        return filteredInvestments.map((investment) => {
                          const urgencyConfig = {
                            urgent: { 
                              bg: 'bg-red-100 dark:bg-red-950/30', 
                              text: 'text-red-800 dark:text-red-200', 
                              border: 'border-red-200 dark:border-red-800',
                              badge: 'bg-red-500'
                            },
                            suggested: { 
                              bg: 'bg-yellow-100 dark:bg-yellow-950/30', 
                              text: 'text-yellow-800 dark:text-yellow-200', 
                              border: 'border-yellow-200 dark:border-yellow-800',
                              badge: 'bg-yellow-500'
                            },
                            not_urgent: { 
                              bg: 'bg-green-100 dark:bg-green-950/30', 
                              text: 'text-green-800 dark:text-green-200', 
                              border: 'border-green-200 dark:border-green-800',
                              badge: 'bg-green-500'
                            },
                          };
                          
                          const config = urgencyConfig[investment.urgency];
                          const targetDate = new Date(investment.targetDate);
                          const isAutoGenerated = investment.type === 'auto_generated';
                          
                          return (
                            <div 
                              key={investment.id} 
                              className={`${config.bg} ${config.border} border rounded-lg p-4`}
                              data-testid={`card-investment-${investment.id}`}
                            >
                              <div className='flex items-start justify-between'>
                                <div className='flex-1'>
                                  <div className='flex items-center gap-3 mb-2'>
                                    <h4 className={`font-semibold ${config.text}`} data-testid={`text-investment-title-${investment.id}`}>
                                      {investment.title}
                                    </h4>
                                    <div className='flex items-center gap-2'>
                                      <div className={`w-2 h-2 ${config.badge} rounded-full`}></div>
                                      <Badge variant="outline" className={`text-xs ${config.text} border-current`}>
                                        {investment.urgency.replace('_', ' ')}
                                      </Badge>
                                      {isAutoGenerated && (
                                        <Badge variant="secondary" className='text-xs'>
                                          Auto-generated
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {investment.description && (
                                    <p className={`text-sm ${config.text} opacity-80 mb-2`}>
                                      {investment.description}
                                    </p>
                                  )}
                                  
                                  <div className='flex flex-wrap items-center gap-4 text-sm'>
                                    <span className={`font-medium ${config.text}`} data-testid={`text-investment-amount-${investment.id}`}>
                                      ${investment.amount.toLocaleString()}
                                    </span>
                                    <span className={`${config.text} opacity-75`}>
                                      <Calendar className='w-3 h-3 inline mr-1' />
                                      {targetDate.toLocaleDateString()}
                                    </span>
                                    <span className={`${config.text} opacity-75`}>
                                      <Building className='w-3 h-3 inline mr-1' />
                                      {investment.ownershipType === 'residences' ? 'For Residences' : 'For Owner'}
                                    </span>
                                  </div>
                                </div>
                                
                                {!isAutoGenerated && (
                                  <div className='flex gap-1 ml-4'>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => startEditInvestment(investment)}
                                      className={`h-8 w-8 p-0 ${config.text} hover:bg-white/50 dark:hover:bg-black/50`}
                                      data-testid={`button-edit-investment-${investment.id}`}
                                    >
                                      <FileText className='w-3 h-3' />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeInvestment(investment.id)}
                                      className={`h-8 w-8 p-0 ${config.text} hover:bg-white/50 dark:hover:bg-black/50`}
                                      data-testid={`button-remove-investment-${investment.id}`}
                                    >
                                      <Minus className='w-3 h-3' />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Edit Investment Dialog */}
                    <Dialog open={editInvestmentDialogOpen} onOpenChange={setEditInvestmentDialogOpen}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Investment</DialogTitle>
                        </DialogHeader>
                        {editingInvestment && (
                          <div className='space-y-4'>
                            <div className='space-y-2'>
                              <Label htmlFor="edit-investment-title">Title *</Label>
                              <Input
                                id="edit-investment-title"
                                value={editingInvestment.title}
                                onChange={(e) => setEditingInvestment(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                                data-testid="input-edit-investment-title"
                              />
                            </div>
                            
                            <div className='space-y-2'>
                              <Label htmlFor="edit-investment-description">Description</Label>
                              <Input
                                id="edit-investment-description"
                                value={editingInvestment.description || ''}
                                onChange={(e) => setEditingInvestment(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                                data-testid="input-edit-investment-description"
                              />
                            </div>
                            
                            <div className='grid grid-cols-2 gap-4'>
                              <div className='space-y-2'>
                                <Label htmlFor="edit-investment-amount">Amount *</Label>
                                <div className='relative'>
                                  <DollarSign className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                                  <Input
                                    id="edit-investment-amount"
                                    type="number"
                                    value={editingInvestment.amount}
                                    onChange={(e) => setEditingInvestment(prev => prev ? ({ ...prev, amount: parseFloat(e.target.value) || 0 }) : null)}
                                    className="pl-9"
                                    data-testid="input-edit-investment-amount"
                                  />
                                </div>
                              </div>
                              
                              <div className='space-y-2'>
                                <Label htmlFor="edit-investment-date">Target Date *</Label>
                                <Input
                                  id="edit-investment-date"
                                  type="date"
                                  value={editingInvestment.targetDate}
                                  onChange={(e) => setEditingInvestment(prev => prev ? ({ ...prev, targetDate: e.target.value }) : null)}
                                  data-testid="input-edit-investment-date"
                                />
                              </div>
                            </div>
                            
                            <div className='grid grid-cols-2 gap-4'>
                              <div className='space-y-2'>
                                <Label htmlFor="edit-investment-urgency">Urgency Level</Label>
                                <Select 
                                  value={editingInvestment.urgency} 
                                  onValueChange={(value) => setEditingInvestment(prev => prev ? ({ ...prev, urgency: value as any }) : null)}
                                >
                                  <SelectTrigger data-testid="select-edit-investment-urgency">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="not_urgent">Not Urgent</SelectItem>
                                    <SelectItem value="suggested">Suggested</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div className='space-y-2'>
                                <Label htmlFor="edit-investment-ownership">Ownership Type</Label>
                                <Select 
                                  value={editingInvestment.ownershipType} 
                                  onValueChange={(value) => setEditingInvestment(prev => prev ? ({ ...prev, ownershipType: value as any }) : null)}
                                >
                                  <SelectTrigger data-testid="select-edit-investment-ownership">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="residences">For Residences</SelectItem>
                                    <SelectItem value="owner">For Owner</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            <div className='flex gap-2 pt-4'>
                              <Button onClick={saveEditInvestment} className='flex-1' data-testid="button-save-edit-investment">
                                Save Changes
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={() => setEditInvestmentDialogOpen(false)}
                                data-testid="button-cancel-edit-investment"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
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