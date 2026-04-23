import React, { useState, useMemo, useEffect, useRef } from 'react';
import { logDebug, logError } from '@/lib/logger';
import { loadPdfLibs } from '@/lib/pdf-export';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { buildForecastRequestBody } from '@/lib/forecast-request';
import { useToast } from '@/hooks/use-toast';
import { handleApiError } from '@/lib/demo-error-handler';
import { Residence } from '@shared/schema';
import { MaintenanceProject } from '@shared/schemas/maintenance';
import { stripLeadingZeros, normalizeMoney } from '@/utils/number';
import { useCurrentFinancialYear } from '@/hooks/use-current-financial-year';
import { getFinancialYearRange } from '@/utils/financial-year';
import { preserveManagerContext } from '@/utils/manager-navigation';
import { BudgetChart } from './BudgetChart';
import { BudgetProjectDialogs, type QuickProjectData, type EditingProjectData } from './BudgetProjectDialogs';
import { useBudgetUICollapse } from './hooks/useBudgetUICollapse';
import { useBudgetProjects } from './hooks/useBudgetProjects';
import type {
  BudgetProps,
  PunctualRevenueGrowth,
  BankAccountSettings,
  ForecastData,
  BudgetForecastResponse,
  BudgetFilters,
  CustomRevenueLine,
  CustomBankAccountField,
  RevenueData,
  CapitalInvestment,
  InvestmentFilters,
  InvestmentSummary,
  Project,
  ChartDataPoint,
} from './types';
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
  ChevronUp,
  Trash2,
  RefreshCw,
  HelpCircle,
  Pencil,
  Download,
  List,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react';
import { GanttChart } from '@/components/GanttChart';


function BudgetInner({ organizationId, buildingId, buildingName }: BudgetProps) {
  const { t, language } = useLanguage();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const budgetChartRef = useRef<HTMLDivElement>(null);

  const handleDownloadChartPDF = async () => {
    if (!budgetChartRef.current) return;
    try {
      const { jsPDF, html2canvas } = await loadPdfLibs();
      const canvas = await html2canvas(budgetChartRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - margin * 2;
      const imgRatio = canvas.width / canvas.height;
      const pageRatio = availableWidth / availableHeight;
      let imgWidth: number;
      let imgHeight: number;
      if (imgRatio > pageRatio) {
        imgWidth = availableWidth;
        imgHeight = availableWidth / imgRatio;
      } else {
        imgHeight = availableHeight;
        imgWidth = availableHeight * imgRatio;
      }
      const x = margin + (availableWidth - imgWidth) / 2;
      const y = margin + (availableHeight - imgHeight) / 2;
      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      pdf.save(`budget-trend-analysis.pdf`);
    } catch (error) {
      console.error('Failed to download chart as PDF:', error);
    }
  };

  // Helper function to format dates for HTML date inputs (yyyy-MM-dd)
  const formatDateForInput = (date: string | Date | undefined | null): string => {
    if (!date) return '';
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) return '';
      return dateObj.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Budget debug logging was removed for production; keep a no-op so existing
  // call sites remain valid without pulling in any env-specific gate.
  const debugLog = (_action: string, _data: any) => {
    // no-op
  };

  // Component initialization logging
  useEffect(() => {
    logDebug('🔍 [BUDGET] Component mounted', { organizationId, buildingId });
  }, []);

  // Log context changes
  useEffect(() => {
    logDebug('🔍 [BUDGET] Context changed:', { organizationId, buildingId });
    debugLog('Component initialized', { organizationId, buildingId });
  }, [organizationId, buildingId]);

  // Helper function to convert calendar date to financial year
  const getFinancialYear = (calendarYear: number, calendarMonth: number, financialYearStart?: string): number => {
    const fyStart = parseFinancialYearStart(financialYearStart);
    
    // If the calendar month is before the financial year start month, 
    // it belongs to the previous financial year
    if (calendarMonth < fyStart.month) {
      return calendarYear - 1;
    } else {
      return calendarYear;
    }
  };

  // Helper function to parse financial year start date and extract month/year
  const parseFinancialYearStart = (financialYearStart?: string): { month: number; year: number } => {
    try {
      if (!financialYearStart) {
        // Fallback to current date if no financial year start is set
        return {
          month: new Date().getMonth() + 1, // Current month (1-12)
          year: new Date().getFullYear()
        };
      }

      // Parse YYYY-MM-DD format
      const dateMatch = financialYearStart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!dateMatch) {
        // Invalid format, fallback to current date
        debugLog('Invalid financialYearStart format, using current date', { financialYearStart });
        return {
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear()
        };
      }

      const [, yearStr, monthStr] = dateMatch;
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      // Validate year and month ranges
      if (year < 1900 || year > 2100 || month < 1 || month > 12) {
        debugLog('Invalid year or month in financialYearStart, using current date', { year, month });
        return {
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear()
        };
      }

      debugLog('Parsed financial year start date', { financialYearStart, month, year });
      return { month, year };
    } catch (error) {
      debugLog('Error parsing financialYearStart, using current date', { financialYearStart, error });
      return {
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      };
    }
  };

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
    unplannedBillsStartDate: (() => {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return nextMonth.toISOString().split('T')[0];
    })(), // Default to first day of next month
    categoryInflationRates: {
      utilities: 3.0,
      maintenance: 2.5,
      general: 2.0,
      other: 2.0,
    },
  });

  // Filter state management - Initialize with current date
  const getInitialFilters = (): BudgetFilters => {
    const now = new Date();
    return {
      viewType: 'month',
      periodLength: 12, // Default to 12 months
      startMonth: now.getMonth() + 1, // 1-12
      startYear: now.getFullYear(),
      dataVisibility: {
        revenue: true,
        spending: true,
        balanceStart: false,
        balanceEnd: true,
        netCashFlow: false,
        capitalInvestments: true,
        minimumRequirement: true,
        project: true,
      },
    };
  };
  
  const [filters, setFilters] = useState<BudgetFilters>(getInitialFilters());

  // Projects panel view mode (list vs gantt) - persisted per session
  const [projectViewMode, setProjectViewMode] = useState<'list' | 'gantt'>(() => {
    if (typeof window === 'undefined') return 'list';
    const saved = window.sessionStorage.getItem('budget.projectViewMode');
    return saved === 'gantt' ? 'gantt' : 'list';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('budget.projectViewMode', projectViewMode);
    }
  }, [projectViewMode]);
  
  // Log filter changes
  useEffect(() => {
    logDebug('🔍 [BUDGET] Filters updated:', filters);
  }, [filters]);
  
  // Budget filters + configuration cards collapsible UI state (localStorage-synced)
  const {
    filtersCollapsed,
    setFiltersCollapsed,
    cardsCollapsed,
    setCardsCollapsed,
    toggleCard,
  } = useBudgetUICollapse();

  // Custom revenue lines state
  const [customRevenueLines, setCustomRevenueLines] = useState<CustomRevenueLine[]>([]);
  const [newRevenueLine, setNewRevenueLine] = useState<{description: string; monthlyAmount: string}>({
    description: '',
    monthlyAmount: ''
  });
  
  // Punctual revenue growth state
  const [punctualGrowthEntries, setPunctualGrowthEntries] = useState<PunctualRevenueGrowth[]>([]);
  const [newPunctualGrowth, setNewPunctualGrowth] = useState<{year: string; month: string; percentage: string; inflationIncluded: boolean}>({
    year: String(new Date().getFullYear() + 1),
    month: '1',
    percentage: '',
    inflationIncluded: true
  });

  // Custom bank account fields state - managed separately for UI but synced with localSettings
  const [customBankFields, setCustomBankFields] = useState<CustomBankAccountField[]>([]);
  const [newBankField, setNewBankField] = useState<{fieldName: string; fieldValue: string}>({
    fieldName: '',
    fieldValue: ''
  });

  // Capital investments state management
  const [capitalInvestments, setCapitalInvestments] = useState<CapitalInvestment[]>([]);
  // Default to 'custom' so the Budget page lands on the same numbers as
  // the Overview page (which hardcodes 'custom') for the same building.
  // Users can still switch to 'urgent' or 'suggested' from the mode toggle;
  // see tests/unit/budget/overview-budget-parity.test.ts for the parity lock.
  const [capitalInvestmentMode, setCapitalInvestmentMode] = useState<'urgent' | 'suggested' | 'custom'>('custom');
  const [investmentFilters, setInvestmentFilters] = useState<InvestmentFilters>({
    urgency: 'all',
  });
  const [newInvestment, setNewInvestment] = useState<{
    title: string;
    description: string;
    amount: string;
    targetDate: string;
    urgency: 'not_urgent' | 'urgent' | 'suggested';
  }>({
    title: 'Investment 1',
    description: '',
    amount: '',
    targetDate: '',
    urgency: 'not_urgent',
  });
  const [editingInvestment, setEditingInvestment] = useState<CapitalInvestment | null>(null);
  const [addInvestmentDialogOpen, setAddInvestmentDialogOpen] = useState(false);
  const [editInvestmentDialogOpen, setEditInvestmentDialogOpen] = useState(false);
  
  // Track pending investment sync operations to prevent race conditions
  const pendingInvestmentsSyncRef = React.useRef(false);

  // Project state management
  const [addQuickProjectDialogOpen, setAddQuickProjectDialogOpen] = useState(false);
  const [editProjectDialogOpen, setEditProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<EditingProjectData | null>(null);
  
  // State for project workflow modal (for non-quick projects)
  const [selectedProjectForWorkflow, setSelectedProjectForWorkflow] = useState<MaintenanceProject | null>(null);
  const [showProjectWorkflowModal, setShowProjectWorkflowModal] = useState(false);
  const [newQuickProject, setNewQuickProject] = useState<QuickProjectData>({
    title: '',
    totalBudget: '',
    financialYear: new Date().getFullYear().toString(),
    plannedMonth: '1',
    plannedDay: '1',
    description: '',
  });

  // Fetch bank account settings
  const { data: bankAccountData, isLoading: bankAccountLoading, error: bankAccountError } = useQuery({
    queryKey: ['/api/budgets', buildingId, 'bank-account'],
    enabled: !!buildingId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Use the current financial year hook for automatic tracking
  const { currentFinancialYear } = useCurrentFinancialYear(
    (bankAccountData as any)?.financialYearStart || null,
    !!buildingId
  );

  // Track whether filters have been initialized from financial year data
  // This prevents overriding user's manual year/month selection after initial load
  const filtersInitializedRef = React.useRef(false);
  
  // Update filters when the financial year changes - only on initial load
  // After initial load, user's manual selections take precedence
  useEffect(() => {
    if (currentFinancialYear && !filtersInitializedRef.current) {
      let startMonth = currentFinancialYear.start.getMonth() + 1; // 0-11 to 1-12
      let startYear = parseInt(currentFinancialYear.startYear, 10);

      // Snap up to the bank account effective start anchor if needed.
      // The chart cannot show a period before the bank account start date
      // (or Jan 1 of the current year when no bank account start is set).
      const data = bankAccountData as any;
      const todayYear = new Date().getFullYear();
      const anchorYear = data?.bankAccountStartDate
        ? new Date(data.bankAccountStartDate).getFullYear()
        : todayYear;
      const anchorMonth = data?.bankAccountStartDate
        ? new Date(data.bankAccountStartDate).getMonth() + 1
        : 1;
      const requestedIdx = startYear * 12 + (startMonth - 1);
      const anchorIdx = anchorYear * 12 + (anchorMonth - 1);
      if (requestedIdx < anchorIdx) {
        startYear = anchorYear;
        startMonth = anchorMonth;
      }

      setFilters(prev => ({
        ...prev,
        startMonth,
        startYear,
      }));

      filtersInitializedRef.current = true;
      debugLog('Filters initialized from currentFinancialYear', { startMonth, startYear });
    }
  }, [currentFinancialYear, bankAccountData]);

  // Fetch residences for the building
  const { data: residences = [], isLoading: residencesLoading, error: residencesError } = useQuery<Residence[]>({
    queryKey: ['/api/buildings', buildingId, 'residences'],
    enabled: !!buildingId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Fetch capital investments for the building
  const { data: serverInvestments, isLoading: investmentsLoading, error: investmentsError } = useQuery<CapitalInvestment[]>({
    queryKey: ['/api/budgets', buildingId, 'investments'],
    enabled: !!buildingId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Pending financial-year shifts (projectId -> new financialYear) applied
  // locally on the budget page before the manager confirms with a PATCH.
  const [pendingProjectYears, setPendingProjectYears] = useState<Map<string, number>>(new Map());

  // Maintenance projects domain: query + projects[] state + sync effect +
  // projectStatesRef (preserves per-project includeInBudget toggles across refetches).
  const {
    projects,
    setProjects,
    projectStatesRef,
    projectsLoading,
  } = useBudgetProjects(buildingId, localSettings.financialYearStart, pendingProjectYears);

  // Initialize local settings when bank account data is loaded
  useEffect(() => {
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
      // Financial year start (defaults to current year January 1st)
      financialYearStart: data.financialYearStart || new Date().getFullYear() + '-01-01',
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
      unplannedBillsStartDate: data.unplannedBillsStartDate || new Date().toISOString().split('T')[0],
      // Historical unique bills data
      historicalUniqueBillsAmount: parseNumericValue(data.historicalUniqueBillsAmount, 0),
      historicalUniqueBillsConfidence: data.historicalUniqueBillsConfidence || 'no_data',
      historicalUniqueBillsYearsAnalyzed: parseNumericValue(data.historicalUniqueBillsYearsAnalyzed, 0),
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
        financialYearStart: prev.financialYearStart,
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
        unplannedBillsStartDate: prev.unplannedBillsStartDate,
        historicalUniqueBillsAmount: prev.historicalUniqueBillsAmount,
        historicalUniqueBillsConfidence: prev.historicalUniqueBillsConfidence,
        historicalUniqueBillsYearsAnalyzed: prev.historicalUniqueBillsYearsAnalyzed,
        categoryInflationRates: prev.categoryInflationRates,
        customBankFields: prev.customBankFields,
      }) !== JSON.stringify(nextSettings);
      
      if (!hasChanged) return prev;
      
      debugLog('Local settings updated from server data', {});
      return { ...prev, ...nextSettings };
    });
    
    // Initialize custom bank fields from server data
    if (data.customBankFields) {
      // Only include core fields if they have non-zero values (allow user to delete them)
      const coreFields = [];
      const emergencyFundValue = parseFloat(data.emergencyFundMinimum || '0') || 0;
      const operatingCashValue = parseFloat(data.operatingCashMinimum || '0') || 0;
      
      if (emergencyFundValue > 0) {
        coreFields.push({ 
          id: 'emergency-fund', 
          fieldName: 'Emergency Fund Minimum', 
          fieldValue: emergencyFundValue 
        });
      }
      
      if (operatingCashValue > 0) {
        coreFields.push({ 
          id: 'operating-cash', 
          fieldName: 'Operating Cash Minimum', 
          fieldValue: operatingCashValue 
        });
      }
      
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
      // Initialize with core required fields if no custom fields from server and they have non-zero values
      const coreFields = [];
      const emergencyFundValue = parseFloat(data.emergencyFundMinimum || '0') || 0;
      const operatingCashValue = parseFloat(data.operatingCashMinimum || '0') || 0;
      
      if (emergencyFundValue > 0) {
        coreFields.push({ 
          id: 'emergency-fund', 
          fieldName: 'Emergency Fund Minimum', 
          fieldValue: emergencyFundValue 
        });
      }
      
      if (operatingCashValue > 0) {
        coreFields.push({ 
          id: 'operating-cash', 
          fieldName: 'Operating Cash Minimum', 
          fieldValue: operatingCashValue 
        });
      }
      
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
    
    // Initialize punctual revenue growth entries from server data
    if (data.punctualRevenueGrowth && Array.isArray(data.punctualRevenueGrowth)) {
      setPunctualGrowthEntries(data.punctualRevenueGrowth);
      debugLog('Punctual revenue growth entries loaded from server', { count: data.punctualRevenueGrowth.length });
    } else {
      // Initialize with empty array if no punctual growth entries from server
      setPunctualGrowthEntries([]);
    }
  }, [bankAccountData]);

  // Create debounced forecast parameters using useMemo
  // This ensures queryKey and request body match exactly, preventing unnecessary refetches
  const forecastParams = useMemo(() => {
    // Get list of project IDs that should be included in budget calculations
    const includedProjectIds = projects
      .filter(p => p.includeInBudget)
      .map(p => p.id);
    
    // Build the request body via the shared helper so the Budget page and
    // the Overview page (client/src/pages/dashboard/overview.tsx) cannot
    // drift apart on the inputs they hand to the forecast endpoint. The
    // canonical schema lives at server/api/forecast-input-schema.ts and
    // the parity test at tests/unit/budget/budget-graph-consistency.test.ts
    // locks in that both pages produce equivalent inputs.
    //
    // CRITICAL: Always send projectIds to control which projects affect
    // forecast. Backend interprets: undefined = all, [] = none, ['id1'] =
    // specific. This ensures toggling all projects OFF correctly excludes
    // them.
    const params = buildForecastRequestBody({
      bankAccountConfig: localSettings,
      capitalInvestmentMode,
      filters: {
        viewType: filters.viewType,
        periodLength: filters.periodLength,
        startMonth: filters.startMonth,
        startYear: filters.startYear,
      },
      projectIds: includedProjectIds,
      // Pass any pending Previous/Next project-period shifts so the chart's
      // server-computed spending line previews the new financial year before
      // the user clicks Confirm. Empty when no shift is staged.
      projectYearOverrides: Object.fromEntries(pendingProjectYears),
      customRevenueLines: customRevenueLines || [],
      punctualRevenueGrowth: punctualGrowthEntries || [],
      investmentFilters: investmentFilters || { urgency: 'all' },
    });
    
    debugLog('Forecast params computed', {
      buildingId,
      paramKeys: Object.keys(params),
      capitalInvestmentMode: params.capitalInvestmentMode,
      customRevenueLines: (params.customRevenueLines as unknown[] | undefined)?.length,
      filters: {
        viewType: params.viewType,
        periodLength: params.periodLength,
        startMonth: params.startMonth,
        startYear: params.startYear
      }
    });
    
    return params;
  }, [
    // Core dependencies - only include what actually affects the forecast
    buildingId,
    capitalInvestmentMode,
    localSettings.bankAccountStartAmount,
    localSettings.bankAccountStartDate,
    localSettings.bankAccountMinimums,
    localSettings.generalInflationRate,
    localSettings.financialYearStart,
    localSettings.emergencyFundMinimum,
    localSettings.operatingCashMinimum,
    localSettings.revenueGrowthRate,
    localSettings.utilityInflationRate,
    localSettings.maintenanceInflationRate,
    localSettings.costInflationRate,
    localSettings.specialInvestmentBudget,
    localSettings.investmentHorizonYears,
    localSettings.capitalProjectReserve,
    localSettings.useGlobalBillsInflation,
    localSettings.globalBillsInflationRate,
    localSettings.unplannedBillsAmount,
    JSON.stringify(localSettings.categoryInflationRates),
    // Custom revenue lines - only when they actually change
    JSON.stringify(customRevenueLines),
    // Punctual revenue growth entries
    JSON.stringify(punctualGrowthEntries),
    // Filters - only relevant ones
    filters.viewType,
    filters.periodLength,
    filters.startMonth,
    filters.startYear,
    // Investment filters
    investmentFilters.urgency,
    // CRITICAL: Projects - serialize to detect changes in inclusion status
    // This ensures forecast refetches when projects are toggled or modified
    JSON.stringify(projects.map(p => ({ id: p.id, includeInBudget: p.includeInBudget }))),
    // Pending project-period shifts so the spending line previews the new
    // financial year as soon as the user taps Previous/Next.
    JSON.stringify(Array.from(pendingProjectYears.entries()))
  ]);

  // Fetch existing capital investments from database
  const { 
    data: dbCapitalInvestments = [], 
    isLoading: dbInvestmentsLoading, 
    error: dbInvestmentsError,
    refetch: refetchDbInvestments 
  } = useQuery<CapitalInvestment[]>({
    queryKey: ['capital-investments', buildingId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/budgets/${buildingId}/investments`);
      const data = await response.json();
      debugLog('Capital investments loaded from database', { buildingId, count: data.length });
      return data;
    },
    enabled: !!buildingId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Initialize capital investments from database data (improved initialization logic)
  const dbInitializedRef = React.useRef(false);
  const previousDbDataRef = React.useRef<CapitalInvestment[]>([]);
  
  useEffect(() => {
    if (dbCapitalInvestments && Array.isArray(dbCapitalInvestments)) {
      // Check if database data has changed since last initialization
      const dataChanged = JSON.stringify(previousDbDataRef.current) !== JSON.stringify(dbCapitalInvestments);
      
      if (!dbInitializedRef.current || dataChanged) {
        // Only include database investments that are 'custom' type to avoid conflicts with auto-generated
        const dbCustomInvestments = dbCapitalInvestments.filter(inv => inv.type === 'custom');
        
        setCapitalInvestments(prev => {
          // Remove any existing database investments and keep only auto-generated ones
          const autoGeneratedInvestments = prev.filter(inv => inv.type === 'auto_generated');
          // Combine with fresh database investments
          return [...dbCustomInvestments, ...autoGeneratedInvestments];
        });
        
        dbInitializedRef.current = true;
        previousDbDataRef.current = dbCapitalInvestments;
        debugLog('Capital investments initialized/updated from database', { 
          count: dbCustomInvestments.length, 
          totalDbData: dbCapitalInvestments.length,
          dataChanged 
        });
      }
    }
  }, [dbCapitalInvestments]);

  // Fetch budget forecast based on current settings  
  const { data: forecastData, isLoading: forecastLoading, error: forecastError, refetch: refetchForecast } = useQuery<BudgetForecastResponse>({
    queryKey: [
      'budgetForecast', 
      buildingId, 
      forecastParams // Use the computed params as single dependency
    ],
    queryFn: async () => {
      debugLog('Fetching budget forecast', { 
        buildingId, 
        paramsKeys: Object.keys(forecastParams),
        mode: forecastParams.capitalInvestmentMode
      });
      const response = await apiRequest('POST', `/api/budgets/${buildingId}/forecast`, forecastParams);
      const data = await response.json();
      debugLog('Budget forecast API response', { buildingId, responseStatus: response.status, mode: forecastParams.capitalInvestmentMode });
      return data as BudgetForecastResponse;
    },
    enabled: !!buildingId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // Add debouncing via staleTime to prevent rapid API calls
    staleTime: 500, // 500ms before considering data stale
    // Keep previous data during refetches to avoid UI flicker (v5 syntax)
    placeholderData: (previousData) => previousData,
  });

  // Note: Manual forecast refetch removed - expanded queryKey now handles automatic updates

  // REMOVED: Sync useEffect that was causing double triggers
  // Custom bank fields are now handled directly in forecastParams useMemo

  // CRITICAL FIX: Sync filters.periodLength to localSettings.investmentHorizonYears when in yearly view
  // Note: localSettings.investmentHorizonYears is intentionally NOT in dependency array to prevent
  // infinite loop with server data updates
  useEffect(() => {
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
  }, [filters.periodLength, filters.viewType]);

  // Update Period Window when financialYearStart changes
  // NOTE: We use a ref to track the previous financialYearStart to detect actual changes
  // We intentionally exclude filters.startMonth and filters.startYear from dependencies
  // to prevent overriding user's manual year selection
  const prevFinancialYearStartRef = React.useRef<string | null>(null);
  
  useEffect(() => {
    if (localSettings.financialYearStart) {
      // Only update filters when financialYearStart actually changes (not on every render)
      const hasFinancialYearStartChanged = prevFinancialYearStartRef.current !== null && 
        prevFinancialYearStartRef.current !== localSettings.financialYearStart;
      
      if (hasFinancialYearStartChanged) {
        const financialYearDate = parseFinancialYearStart(localSettings.financialYearStart);
        
        setFilters(prev => ({
          ...prev,
          startMonth: financialYearDate.month,
          startYear: financialYearDate.year,
        }));
        
        debugLog('Updated Period Window from financialYearStart change', { 
          previousFinancialYearStart: prevFinancialYearStartRef.current,
          newFinancialYearStart: localSettings.financialYearStart,
          newStartMonth: financialYearDate.month,
          newStartYear: financialYearDate.year
        });
      }
      
      // Update the ref to current value
      prevFinancialYearStartRef.current = localSettings.financialYearStart;
    }
  }, [localSettings.financialYearStart]);

  // Debug logging for forecast data and errors
  useEffect(() => {
    if (forecastData) {
      debugLog('Budget forecast data received', { 
        buildingId, 
        forecastLength: forecastData?.forecast?.length,
        startingBalance: forecastData?.startingBalance,
        buildingName: forecastData?.buildingName
      });
    }
  }, [forecastData, buildingId]);

  useEffect(() => {
    if (forecastError) {
      debugLog('Budget forecast fetch error', { buildingId, error: forecastError });
    }
  }, [forecastError, buildingId]);


  // Save bank account settings mutation
  // Exception (task #229): mutations in this file route errors through
  // `handleApiError` for demo-mode/locale-aware messaging — kept as raw `useMutation`.
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
        title: t('budgetBankAccountSaveSuccess'), 
        description: t('budgetBankAccountSaveSuccessDesc'),
      });
      // Invalidate both bank account data and forecast queries
      queryClient.invalidateQueries({ queryKey: ['/api/budgets', buildingId, 'bank-account'] });
      queryClient.invalidateQueries({ queryKey: ['budgetForecast', buildingId] });
    },
    onError: (error: any) => {
      debugLog('Bank account save error', { buildingId, error });
      handleApiError(
        error,
        language,
        language === 'fr' ? 'Échec de la sauvegarde des paramètres du compte bancaire' : 'Failed to save bank account settings'
      );
    },
  });

  // Save revenue configuration mutation (including custom revenue lines and punctual growth)
  const saveRevenueConfigurationMutation = useMutation({
    mutationFn: async () => {
      debugLog('Saving revenue configuration', { 
        buildingId, 
        customRevenueLines, 
        punctualRevenueGrowth: punctualGrowthEntries,
        revenueGrowthRate: localSettings.revenueGrowthRate 
      });
      
      const revenueConfigPayload = {
        // Only send the fields needed for revenue configuration
        revenueGrowthRate: localSettings.revenueGrowthRate,
        customRevenueLines: customRevenueLines,
        punctualRevenueGrowth: punctualGrowthEntries,
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
        title: t('budgetRevenueSaveSuccess'), 
        description: t('budgetRevenueSaveSuccessDesc'),
      });
      // Invalidate both bank account data and forecast queries
      queryClient.invalidateQueries({ queryKey: ['/api/budgets', buildingId, 'bank-account'] });
      queryClient.invalidateQueries({ queryKey: ['budgetForecast', buildingId] });
    },
    onError: (error: any) => {
      debugLog('Revenue configuration save error', { buildingId, error });
      handleApiError(
        error,
        language,
        language === 'fr' ? 'Échec de la sauvegarde de la configuration des revenus' : 'Failed to save revenue configuration'
      );
    },
  });

  // Save unplanned bills amount mutation (dedicated endpoint)
  const saveUnplannedBillsMutation = useMutation({
    mutationFn: async (amount: number) => {
      debugLog('Saving unplanned bills amount', { buildingId, amount });
      const payload = {
        unplannedBillsAmount: amount,
        unplannedBillsStartDate: localSettings.unplannedBillsStartDate,
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
        unplannedBillsAmount: data.savedAmount,
        unplannedBillsStartDate:
          data.unplannedBillsStartDate ?? prev.unplannedBillsStartDate,
      }));
      
      toast({
        title: t('budgetBillsSaveSuccess'), 
        description: t('budgetBillsSaveSuccessDesc'),
      });
      // Invalidate both bank account data and forecast queries
      queryClient.invalidateQueries({ queryKey: ['/api/budgets', buildingId, 'bank-account'] });
      queryClient.invalidateQueries({ queryKey: ['budgetForecast', buildingId] });
      
      debugLog('Unplanned bills state updated immediately', { 
        buildingId, 
        savedAmount: data.savedAmount,
        previousAmount: localSettings.unplannedBillsAmount
      });
    },
    onError: (error: any) => {
      debugLog('Unplanned bills save error', { buildingId, error });
      handleApiError(
        error,
        language,
        language === 'fr' ? 'Échec de la sauvegarde du montant des factures imprévues' : 'Failed to save unplanned bills amount'
      );
    },
  });

  // Save capital investments mutation
  const saveInvestmentsMutation = useMutation({
    mutationFn: async (investments: CapitalInvestment[]) => {
      // Set pending flag before starting mutation
      pendingInvestmentsSyncRef.current = true;
      
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
        title: t('budgetInvestmentsSaveSuccess'), 
        description: t('budgetInvestmentsSaveSuccessDesc'),
      });
      // Invalidate both investments data and forecast queries
      queryClient.invalidateQueries({ queryKey: ['/api/budgets', buildingId, 'investments'] });
      queryClient.invalidateQueries({ queryKey: ['budgetForecast', buildingId] });
      
      // Clear pending flag after successful save
      pendingInvestmentsSyncRef.current = false;
    },
    onError: (error: any) => {
      // Clear pending flag after error
      pendingInvestmentsSyncRef.current = false;
      
      handleApiError(
        error,
        language,
        language === 'fr' ? 'Échec de la sauvegarde des investissements en capital' : 'Failed to save capital investments'
      );
    },
  });

  // Create quick project mutation
  const createQuickProjectMutation = useMutation({
    mutationFn: async (projectData: {
      title: string;
      totalBudget: number;
      financialYear: number;
      plannedMonth: number;
      plannedDay: number;
      description?: string;
    }) => {
      debugLog('Creating quick project', { buildingId, projectData });
      
      // Generate a unique project number for quick projects
      const projectNumber = `QP-${Date.now()}`;
      
      // Create the planned start date from year, month, and day
      const plannedStartDate = `${projectData.financialYear}-${String(projectData.plannedMonth).padStart(2, '0')}-${String(projectData.plannedDay).padStart(2, '0')}`;
      
      const payload = {
        buildingId,
        projectNumber,
        title: projectData.title,
        type: 'not_sure' as const,
        status: 'planned' as const,
        totalBudget: projectData.totalBudget,
        actualCost: 0,
        estimatedCost: projectData.totalBudget,
        financialYear: projectData.financialYear,
        plannedStartDate,
        isQuickProject: true,
        origin: 'manual' as const,
        planningDescription: projectData.description || '',
        priority: 'medium' as const,
      };
      
      const response = await apiRequest('POST', '/api/maintenance/projects', payload);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      const data = await response.json();
      debugLog('Quick project created', { buildingId, data });
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: t('budgetQuickProjectAdded'),
        description: t('budgetQuickProjectAddedDesc').replace('{title}', data.data?.title || 'Project'),
      });
      // Invalidate projects query to refetch
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'projects'] });
      // Close dialog
      setAddQuickProjectDialogOpen(false);
      // Reset form
      setNewQuickProject({
        title: '',
        totalBudget: '',
        financialYear: new Date().getFullYear().toString(),
        plannedMonth: (new Date().getMonth() + 1).toString(),
        plannedDay: new Date().getDate().toString(),
        description: '',
      });
    },
    onError: (error: any) => {
      debugLog('Quick project creation error', { buildingId, error });
      handleApiError(
        error,
        language,
        language === 'fr' ? 'Échec de la création du projet rapide' : 'Failed to create quick project'
      );
    },
  });

  // Delete quick project mutation
  const deleteQuickProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      debugLog('Deleting quick project', { buildingId, projectId });
      const response = await apiRequest('DELETE', `/api/maintenance/projects/${projectId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      return projectId;
    },
    onSuccess: (projectId) => {
      toast({
        title: t('budgetQuickProjectDeleted'),
        description: t('budgetQuickProjectDeletedDesc'),
      });
      // Invalidate projects query to refetch
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'projects'] });
      // Remove from local state immediately
      setProjects(prev => prev.filter(p => p.id !== projectId));
      projectStatesRef.current.delete(projectId);
    },
    onError: (error: any) => {
      debugLog('Quick project deletion error', { buildingId, error });
      handleApiError(
        error,
        language,
        language === 'fr' ? 'Échec de la suppression du projet rapide' : 'Failed to delete quick project'
      );
    },
  });

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: async (projectData: {
      id: string;
      title: string;
      totalBudget: number;
      financialYear: number;
      plannedMonth: number;
      plannedDay: number;
      description?: string;
    }) => {
      debugLog('Updating project', { buildingId, projectData });
      
      const plannedStartDate = `${projectData.financialYear}-${String(projectData.plannedMonth).padStart(2, '0')}-${String(projectData.plannedDay).padStart(2, '0')}`;
      
      const payload = {
        title: projectData.title,
        totalBudget: projectData.totalBudget,
        estimatedCost: projectData.totalBudget,
        financialYear: projectData.financialYear,
        plannedStartDate,
        planningDescription: projectData.description || '',
      };
      
      const response = await apiRequest('PATCH', `/api/maintenance/projects/${projectData.id}`, payload);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      const data = await response.json();
      debugLog('Project updated', { buildingId, data });
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: language === 'fr' ? 'Projet mis à jour' : 'Project Updated',
        description: (language === 'fr' ? 'Le projet "{title}" a été mis à jour avec succès' : 'Project "{title}" has been updated successfully').replace('{title}', data.data?.title || 'Project'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'projects'] });
      setEditProjectDialogOpen(false);
      setEditingProject(null);
    },
    onError: (error: any) => {
      debugLog('Project update error', { buildingId, error });
      handleApiError(
        error,
        language,
        language === 'fr' ? 'Échec de la mise à jour du projet' : 'Failed to update project'
      );
    },
  });

  // Mutation that persists a period shift confirmed from the project card.
  const confirmProjectYearMutation = useMutation({
    mutationFn: async ({ id, financialYear }: { id: string; financialYear: number }) => {
      const response = await apiRequest('PATCH', `/api/maintenance/projects/${id}`, {
        financialYear,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      return { id, financialYear };
    },
    onSuccess: ({ id }) => {
      setPendingProjectYears(prev => {
        if (!prev.has(id)) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'projects'] });
      toast({
        title: language === 'fr' ? 'Période mise à jour' : 'Period updated',
      });
    },
    onError: (error: any) => {
      handleApiError(
        error,
        language,
        language === 'fr' ? 'Échec de la mise à jour de la période' : 'Failed to update period'
      );
    },
  });

  // Minimum shiftable financial year (cannot move a project before the
  // current financial year). Maximum is 25 years out — same horizon used by
  // the overview page's available-fiscal-years selector.
  const minShiftableYear: number = currentFinancialYear
    ? parseInt(currentFinancialYear.startYear, 10)
    : new Date().getFullYear();
  const maxShiftableYear: number = new Date().getFullYear() + 25;

  const shiftProjectYear = (project: Project, delta: number) => {
    const baseYear = project.financialYear;
    const nextYear = baseYear + delta;
    if (nextYear < minShiftableYear || nextYear > maxShiftableYear) return;
    setPendingProjectYears(prev => {
      const next = new Map(prev);
      next.set(project.id, nextYear);
      return next;
    });
  };

  const handleBackToOrganization = () => {
    navigate('/manager/budget');
  };

  const handleBackToBuilding = () => {
    navigate(preserveManagerContext('/manager/budget', organizationId));
  };

  // Handle complete page refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Floating refresh button scroll detection
  const [showFloatingRefresh, setShowFloatingRefresh] = useState(false);
  
  const handleRefreshPage = async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      debugLog('Starting page refresh', { buildingId });
      
      // Invalidate all relevant queries using exact keys from component
      await Promise.all([
        queryClient.invalidateQueries({ 
          queryKey: ['/api/budgets', buildingId, 'bank-account'], 
          refetchType: 'active' 
        }),
        queryClient.invalidateQueries({ 
          queryKey: ['/api/buildings', buildingId, 'residences'], 
          refetchType: 'active' 
        }),
        queryClient.invalidateQueries({ 
          queryKey: ['/api/budgets', buildingId, 'investments'], 
          refetchType: 'active' 
        }),
        queryClient.invalidateQueries({ 
          queryKey: ['budgetForecast', buildingId], 
          refetchType: 'active' 
        })
      ]);
      
      // Show success toast
      toast({
        title: t('budgetRefreshSuccess'),
        description: t('budgetRefreshSuccessDesc'),
      });
      
      debugLog('Page refresh completed successfully', { buildingId });
    } catch (error) {
      debugLog('Error during page refresh', { buildingId, error });
      toast({
        title: t('budgetRefreshFailed'),
        description: t('budgetRefreshFailedDesc'),
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Intersection Observer for floating refresh button visibility
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    // Find the actual scroll container
    const findScrollContainer = (element: Element): Element | null => {
      let parent = element.parentElement;
      while (parent) {
        const computedStyle = window.getComputedStyle(parent);
        if (
          computedStyle.overflowY === 'auto' || 
          computedStyle.overflowY === 'scroll' ||
          computedStyle.overflow === 'auto' ||
          computedStyle.overflow === 'scroll' ||
          parent.hasAttribute('data-scroll-container')
        ) {
          return parent;
        }
        parent = parent.parentElement;
      }
      return null;
    };

    const scrollContainer = findScrollContainer(sentinel);
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show floating button when sentinel is out of view (scrolled past it)
        setShowFloatingRefresh(!entry.isIntersecting);
      },
      {
        root: scrollContainer,
        threshold: 0,
        // Use a smaller margin for better responsiveness
        rootMargin: '-50px 0px 0px 0px'
      }
    );

    observer.observe(sentinel);

    // Set initial state
    const rect = sentinel.getBoundingClientRect();
    const containerRect = scrollContainer?.getBoundingClientRect() || { top: 0 };
    setShowFloatingRefresh(rect.top < containerRect.top - 50);

    return () => {
      observer.disconnect();
    };
  }, []);


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
        title: t('budgetInvalidAmount'),
        description: t('budgetInvalidAmountDesc'),
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
  
  // Add punctual revenue growth entry
  const addPunctualGrowthEntry = () => {
    if (!newPunctualGrowth.year.trim() || !newPunctualGrowth.month.trim() || !newPunctualGrowth.percentage.trim()) return;
    
    const year = parseInt(newPunctualGrowth.year);
    const month = parseInt(newPunctualGrowth.month);
    const percentage = parseFloat(newPunctualGrowth.percentage);
    
    if (isNaN(year) || year < new Date().getFullYear()) {
      toast({
        title: t('validationError'),
        description: t('budgetInvalidYear'),
        variant: 'destructive',
      });
      return;
    }
    
    if (isNaN(month) || month < 1 || month > 12) {
      toast({
        title: t('validationError'),
        description: t('budgetInvalidMonth'),
        variant: 'destructive',
      });
      return;
    }
    
    if (isNaN(percentage) || percentage < 0) {
      toast({
        title: t('budgetInvalidAmount'),
        description: t('budgetInvalidAmountDesc'),
        variant: 'destructive',
      });
      return;
    }
    
    // Check if year-month combination already exists
    if (punctualGrowthEntries.some(entry => entry.year === year && entry.month === month)) {
      toast({
        title: t('validationError'),
        description: t('budgetYearMonthAlreadyExists'),
        variant: 'destructive',
      });
      return;
    }
    
    const newEntry: PunctualRevenueGrowth = {
      id: `growth-${Date.now()}`,
      year,
      month,
      percentage,
      inflationIncluded: newPunctualGrowth.inflationIncluded,
    };
    
    setPunctualGrowthEntries(prev => [...prev, newEntry].sort((a, b) => a.year - b.year || a.month - b.month));
    setNewPunctualGrowth({ 
      year: String(new Date().getFullYear() + 1), 
      month: '1',
      percentage: '', 
      inflationIncluded: true 
    });
  };
  
  // Remove punctual revenue growth entry
  const removePunctualGrowthEntry = (id: string) => {
    setPunctualGrowthEntries(prev => prev.filter(entry => entry.id !== id));
  };
  
  // Toggle inflation included for punctual growth entry
  const toggleInflationIncluded = (id: string) => {
    setPunctualGrowthEntries(prev => 
      prev.map(entry => 
        entry.id === id 
          ? { ...entry, inflationIncluded: !entry.inflationIncluded }
          : entry
      )
    );
  };

  // Add custom bank account field
  const addCustomBankField = () => {
    if (!newBankField.fieldName.trim() || !newBankField.fieldValue.trim()) return;
    
    // Validate amount is a positive number
    const value = parseFloat(newBankField.fieldValue);
    if (isNaN(value) || value < 0) {
      toast({
        title: t('budgetInvalidValue'),
        description: t('budgetInvalidValueDesc'),
        variant: 'destructive',
      });
      return;
    }
    
    const newField: CustomBankAccountField = {
      id: `bank-field-${Date.now()}`,
      fieldName: newBankField.fieldName.trim(),
      fieldValue: value,
    };
    
    const updatedFields = [...customBankFields, newField];
    
    // Update state
    setCustomBankFields(updatedFields);
    syncCustomFieldsToLocalSettings(updatedFields);
    setNewBankField({ fieldName: '', fieldValue: '' });
    
    // Trigger save to update forecast and graph immediately after state updates
    // Using setTimeout to ensure React's state batching completes before mutation
    setTimeout(() => {
      saveBankAccountMutation.mutate();
    }, 150);
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

  // Auto-generation logic for capital investments based on budget forecast data and selected mode
  const generateSuggestedInvestments = (): CapitalInvestment[] => {
    debugLog('generateSuggestedInvestments called', {
      mode: capitalInvestmentMode,
      hasForecastData: !!forecastData?.forecast,
      forecastLength: forecastData?.forecast?.length || 0
    });
    
    const suggestions: CapitalInvestment[] = [];
    const metrics = calculateSummaryMetrics();
    const emergencyMin = localSettings.emergencyFundMinimum || 10000;
    const operatingMin = localSettings.operatingCashMinimum || 5000;
    const currentBalance = metrics.currentBalance;
    
    debugLog('Auto-generation settings and metrics', {
      emergencyMin,
      operatingMin,
      currentBalance,
      mode: capitalInvestmentMode
    });
    
    // Custom mode: No auto-generation
    if (capitalInvestmentMode === 'custom') {
      debugLog('Custom mode: No auto-generated investments', { mode: capitalInvestmentMode });
      return suggestions;
    }
    
    // Use backend forecast data to generate investment scenarios based on mode
    if (forecastData?.forecast) {
      debugLog('Processing forecast data for auto-generation', {
        forecastLength: forecastData.forecast.length,
        mode: capitalInvestmentMode
      });
      
      forecastData.forecast.forEach((monthData, index) => {
        // Use the backend-calculated auto-generated investment from forecast
        if (monthData.autoGeneratedInvestment && monthData.autoGeneratedInvestment > 0) {
          const targetDate = new Date(monthData.year, monthData.month - 1, 1);
          
          // Calculate balance criticality for urgency determination
          const balanceBeforeInvestment = monthData.balanceBeforeScenario || monthData.balance;
          const balanceRatio = balanceBeforeInvestment / emergencyMin;
          const isEmergencyLevel = balanceRatio < 0.5; // Below 50% of emergency minimum
          const isLowLevel = balanceRatio < 1.0; // Below emergency minimum
          
          // Determine if we should include this investment based on the selected mode
          let shouldInclude = false;
          let urgency: 'urgent' | 'suggested' | 'not_urgent' = 'suggested';
          
          if (capitalInvestmentMode === 'urgent') {
            // Urgent mode: Only include investments when balance is critically low
            if (isEmergencyLevel) {
              shouldInclude = true;
              urgency = 'urgent';
            }
          } else if (capitalInvestmentMode === 'suggested') {
            // Suggested mode: Trust backend calculations - if backend says investment is needed, include it
            shouldInclude = true; // Backend already calculated this month needs an investment
            urgency = isEmergencyLevel ? 'urgent' : 'suggested';
          }
          
          debugLog('Investment evaluation', {
            period: monthData.period,
            balanceBeforeInvestment,
            balanceRatio,
            isEmergencyLevel,
            isLowLevel,
            shouldInclude,
            urgency,
            mode: capitalInvestmentMode
          });
          
          if (shouldInclude) {
            suggestions.push({
              id: `generated-${capitalInvestmentMode}-${monthData.period}`,
              title: `${urgency === 'urgent' ? t('budgetUrgentCapitalInjection') : t('budgetSuggestedCapitalInjection')} - ${targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
              description: t('budgetAutoGeneratedScenario').replace('{mode}', capitalInvestmentMode).replace('{amount}', monthData.autoGeneratedInvestment.toFixed(2)),
              amount: monthData.autoGeneratedInvestment,
              targetDate: targetDate.toISOString().split('T')[0],
              urgency,
              category: 'emergency_fund',
              type: 'auto_generated',
              ownershipType: 'owner',
              createdAt: new Date().toISOString(),
            });
          }
        }
      });
    } else {
      debugLog('No forecast data available for auto-generation', { mode: capitalInvestmentMode });
    }
    
    debugLog('Auto-generation completed', {
      mode: capitalInvestmentMode,
      generatedCount: suggestions.length,
      suggestions: suggestions.map(s => ({ id: s.id, amount: s.amount, urgency: s.urgency }))
    });
    
    return suggestions;
  };

  // Deduplication helper to prevent overlapping auto-generated investments
  const deduplicateInvestments = (suggestions: CapitalInvestment[]): CapitalInvestment[] => {
    const deduped: CapitalInvestment[] = [];
    const seenCombinations = new Set<string>();
    
    // Sort by urgency priority (urgent first), then by target date (earliest first)
    const sorted = [...suggestions].sort((a, b) => {
      const urgencyOrder = { urgent: 0, suggested: 1, not_urgent: 2 };
      const urgencyCompare = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyCompare !== 0) return urgencyCompare;
      
      // If same urgency, sort by date
      return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
    });
    
    for (const suggestion of sorted) {
      // Include target date in the key so investments in different months are treated as separate items
      const combinationKey = `${suggestion.category || 'general'}-${suggestion.ownershipType}-${suggestion.targetDate}`;
      
      // Only add if we haven't seen this exact combination (including date)
      if (!seenCombinations.has(combinationKey)) {
        seenCombinations.add(combinationKey);
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
    logDebug('addInvestment called', { newInvestment });
    
    if (!newInvestment.title.trim() || !newInvestment.amount.trim() || !newInvestment.targetDate) {
      logDebug('Validation failed - missing required fields', {
        title: newInvestment.title,
        amount: newInvestment.amount,
        targetDate: newInvestment.targetDate
      });
      toast({
        title: t('validationError'),
        description: t('budgetPleaseCompleteRequiredFields'),
        variant: 'destructive',
      });
      return;
    }
    
    const amount = parseFloat(newInvestment.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: t('budgetInvalidAmount'),
        description: t('budgetInvalidAmountDesc'),
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
      ownershipType: 'owner', // Default to owner since field is removed
      createdAt: new Date().toISOString(),
    };
    
    setCapitalInvestments(prev => {
      const updated = [...prev, investment];
      // Auto-save after adding investment
      saveInvestmentsMutation.mutate(updated);
      return updated;
    });
    
    setNewInvestment({
      title: 'Investment 1',
      description: '',
      amount: '',
      targetDate: '',
      urgency: 'not_urgent',
    });
    setAddInvestmentDialogOpen(false);
    
    toast({
      title: t('budgetInvestmentAdded'),
      description: t('budgetInvestmentAddedDesc').replace('{title}', investment.title),
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
        title: t('budgetCannotRemoveAutoGenerated'),
        description: t('budgetCannotRemoveAutoGeneratedDesc'),
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
      title: t('budgetInvestmentRemoved'),
      description: t('budgetInvestmentRemovedDesc'),
    });
  };

  const startEditInvestment = (investment: CapitalInvestment) => {
    if (investment.type === 'auto_generated') {
      toast({
        title: t('budgetCannotEditAutoGenerated'),
        description: t('budgetCannotEditAutoGeneratedDesc'),
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
      title: t('budgetInvestmentUpdated'),
      description: t('budgetInvestmentUpdatedDesc'),
    });
  };

  const confirmAutoGeneratedInvestment = (id: string) => {
    const investment = capitalInvestments.find(inv => inv.id === id);
    if (!investment || investment.type !== 'auto_generated') {
      toast({
        title: t('budgetInvestmentNotFound'),
        description: t('budgetInvestmentNotFoundDesc'),
        variant: 'destructive',
      });
      return;
    }

    // Convert auto-generated investment to custom investment
    const confirmedInvestment: CapitalInvestment = {
      ...investment,
      type: 'custom', // Change from auto_generated to custom
      createdAt: new Date().toISOString(), // Update creation timestamp
    };

    setCapitalInvestments(prev => {
      const updated = prev.map(inv => 
        inv.id === id ? confirmedInvestment : inv
      );
      // Auto-save after confirming investment
      saveInvestmentsMutation.mutate(updated);
      return updated;
    });

    toast({
      title: t('budgetInvestmentConfirmed'),
      description: t('budgetInvestmentConfirmedDesc'),
    });
  };

  // Filter investments based on current filters and date range
  const getFilteredInvestments = (): CapitalInvestment[] => {
    let filtered = [...capitalInvestments];
    
    // Filter by capital investment strategy: only show auto-generated investments that match the selected mode
    filtered = filtered.filter(inv => {
      // Always include custom investments (user-added)
      if (inv.type === 'custom') {
        return true;
      }
      
      // For auto-generated investments, show all in urgent/suggested modes, none in custom mode
      if (inv.type === 'auto_generated') {
        if (capitalInvestmentMode === 'custom') {
          // Custom mode: Never show auto-generated investments
          return false;
        } else {
          // Urgent and Suggested modes: Show ALL auto-generated investments regardless of urgency
          // This allows users to see all scenario investments at once
          return true;
        }
      }
      
      return true;
    });
    
    // Apply date window filter to show investments within the selected time period
    if (filters.startMonth && filters.startYear) {
      const windowStart = new Date(filters.startYear, filters.startMonth - 1, 1);
      const periodMonths = filters.viewType === 'month' ? filters.periodLength : filters.periodLength * 12;
      // Make windowEnd inclusive by going to the last day of the final month
      const windowEndMonth = filters.startMonth - 1 + periodMonths;
      const windowEnd = new Date(filters.startYear, windowEndMonth, 0); // Last day of the previous month gives us the last day of target month
      
      debugLog('Investment date filtering', {
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        startMonth: filters.startMonth,
        startYear: filters.startYear,
        periodMonths,
        viewType: filters.viewType,
        periodLength: filters.periodLength
      });
      
      filtered = filtered.filter(inv => {
        const invDate = new Date(inv.targetDate);
        const isInWindow = invDate >= windowStart && invDate <= windowEnd;
        
        debugLog('Investment date check', {
          investmentId: inv.id,
          targetDate: inv.targetDate,
          invDate: invDate.toISOString(),
          isInWindow,
          title: inv.title
        });
        
        return isInWindow;
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

  // Auto-generate investments when forecast data changes (with proper scenario switching and clearing)
  useEffect(() => {
    if (forecastData && buildingId) {
      debugLog('Auto-generation effect triggered', { 
        mode: capitalInvestmentMode, 
        hasForecastData: !!forecastData,
        dbInvestmentsAvailable: !!dbCapitalInvestments,
        isPendingSync: pendingInvestmentsSyncRef.current
      });
      
      const suggestions = generateSuggestedInvestments();
      
      // Single atomic update: replace all auto-generated investments and ensure database investments are included
      setCapitalInvestments(prev => {
        // CRITICAL FIX: Clear ALL previous auto-generated investments when switching scenarios
        const customInvestments = prev.filter(inv => inv.type !== 'auto_generated');
        
        // CRITICAL FIX: Skip database merge when a sync operation is pending to prevent race conditions
        // If we're in the middle of saving/deleting, don't merge database investments yet
        const dbCustomInvestments = pendingInvestmentsSyncRef.current 
          ? [] 
          : (dbCapitalInvestments || []).filter(inv => inv.type === 'custom');
        
        // Merge custom investments from state and database, avoiding duplicates
        const mergedCustomInvestments = [
          ...customInvestments,
          ...dbCustomInvestments.filter(dbInv => !customInvestments.some(stateInv => stateInv.id === dbInv.id))
        ];
        
        const deduplicatedSuggestions = deduplicateInvestments(suggestions);
        
        const next = [...mergedCustomInvestments, ...deduplicatedSuggestions];

        // Skip the state update when the resulting list is identical to avoid
        // creating a new array reference. Without this guard the effect can
        // re-run on every render (forecastData reference flip during refetch),
        // cascading into a "Maximum update depth exceeded" loop.
        if (next.length === prev.length) {
          const sameContent = next.every((inv, i) => {
            const p = prev[i];
            return (
              p.id === inv.id &&
              p.type === inv.type &&
              p.urgency === inv.urgency &&
              p.amount === inv.amount &&
              p.targetDate === inv.targetDate &&
              p.title === inv.title &&
              p.ownershipType === inv.ownershipType &&
              p.description === inv.description &&
              p.category === inv.category &&
              p.createdAt === inv.createdAt
            );
          });
          if (sameContent) return prev;
        }

        debugLog('Auto-generated investments update', { 
          mode: capitalInvestmentMode,
          previousAutoGenerated: prev.filter(inv => inv.type === 'auto_generated').length,
          customInStateCount: customInvestments.length,
          dbCustomCount: dbCustomInvestments.length,
          mergedCustomCount: mergedCustomInvestments.length,
          newAutoGeneratedCount: deduplicatedSuggestions.length,
          totalFinalCount: next.length,
          isPendingSync: pendingInvestmentsSyncRef.current
        });

        return next;
      });
    }
  }, [
    forecastData, 
    localSettings.emergencyFundMinimum, 
    localSettings.operatingCashMinimum, 
    buildingId, 
    capitalInvestmentMode, // CRITICAL: This triggers scenario switching recalculation
    dbCapitalInvestments, // Add database investments as dependency to fix race condition
    // Add filter dependencies so monthly payments recalculate when time period changes
    filters.viewType,
    filters.periodLength,
    filters.startMonth,
    filters.startYear
  ]);

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

    // Monthly spending: use the backend-provided baseline normalized monthly cost.
    // This is independent of the selected window (start date / length), so the
    // stat card stays consistent regardless of how the user slices the forecast.
    const monthlySpending = forecastData.baselineMonthlyExpenses ?? 0;

    // Year-end projection: balance at the end of the CURRENT fiscal year, looked
    // up in the full forecast array (not the sliced window) so it does not
    // change when the user switches between 12-month / 24-month views.
    // Explicit fallback: if no financialYearStart is configured, treat the
    // fiscal year as the calendar year (FY-end = December of current year).
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;
    const fyStartRaw = localSettings.financialYearStart;
    const hasValidFyStart = !!fyStartRaw && /^\d{4}-\d{2}-\d{2}$/.test(fyStartRaw);
    let fyEndMonth: number;
    let fyEndYear: number;
    if (!hasValidFyStart) {
      fyEndMonth = 12;
      fyEndYear = todayYear;
    } else {
      const fyStart = parseFinancialYearStart(fyStartRaw);
      fyEndMonth = fyStart.month === 1 ? 12 : fyStart.month - 1;
      // Current fiscal year = calendar year in which the FY containing today started.
      const currentFyStartYear = getFinancialYear(todayYear, todayMonth, fyStartRaw);
      // If FY starts in January, FY-end is December of same year; otherwise
      // FY-end is fyEndMonth of (start year + 1).
      fyEndYear = fyStart.month === 1 ? currentFyStartYear : currentFyStartYear + 1;
    }
    const fyEndPeriod = forecastData.forecast.find(
      (p) => p.year === fyEndYear && p.month === fyEndMonth
    );
    const yearEndBalance = fyEndPeriod ? fyEndPeriod.balance : lastPeriod.balance;

    return {
      currentBalance: currentMonth.balance,
      monthlyIncome: calculateTotalRevenue(),
      monthlySpending,
      yearEndBalance,
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
    
    const totalProjectMonthlyCost = projects
      .filter(p => p.includeInBudget)
      .reduce((total, project) => {
        const actualCost = Number(project.actualCost) || 0;
        const estimatedCost = Number(project.estimatedCost) || 0;
        const totalBudget = Number(project.totalBudget) || 0;
        let projectCost: number;
        if (project.status === 'completed') {
          projectCost = actualCost;
        } else {
          const budgetCost = estimatedCost || totalBudget;
          projectCost = Math.max(actualCost, budgetCost);
        }
        return total + (projectCost / 12);
      }, 0);

    const totalMonthlyExpenses = forecastData.baselineMonthlyExpenses + totalProjectMonthlyCost;

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
      ...(totalProjectMonthlyCost > 0 ? [{
        category: 'Project Costs', 
        budget: totalProjectMonthlyCost * 12, 
        used: totalProjectMonthlyCost * 12, 
        color: 'bg-teal-500',
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

  // Helper function to aggregate capital investments by month and urgency (includes ALL investment types)
  const aggregateInvestmentsByMonth = (year: number, month: number) => {
    // Find all investments that target this specific month (custom, database, and auto-generated)
    const monthInvestments = capitalInvestments.filter(investment => {
      const targetDate = new Date(investment.targetDate);
      return targetDate.getFullYear() === year && targetDate.getMonth() + 1 === month;
    });

    const result = {
      urgent: 0,
      suggested: 0,
      notUrgent: 0,
      total: 0,
      // Track investment types for debugging
      custom: 0,
      autoGenerated: 0,
      customCount: 0,
      autoGeneratedCount: 0
    };

    monthInvestments.forEach(investment => {
      const amount = investment.amount;
      result.total += amount;
      
      // Track by investment type
      if (investment.type === 'custom') {
        result.custom += amount;
        result.customCount++;
      } else if (investment.type === 'auto_generated') {
        result.autoGenerated += amount;
        result.autoGeneratedCount++;
      }
      
      // Track by urgency level
      switch (investment.urgency) {
        case 'urgent':
          result.urgent += amount;
          break;
        case 'suggested':
          result.suggested += amount;
          break;
        case 'not_urgent':
          result.notUrgent += amount;
          break;
      }
    });

    debugLog('Investment aggregation for month', {
      year,
      month,
      monthInvestments: monthInvestments.length,
      result,
      investmentBreakdown: {
        custom: { count: result.customCount, amount: result.custom },
        autoGenerated: { count: result.autoGeneratedCount, amount: result.autoGenerated }
      },
      investments: monthInvestments.map(inv => ({ 
        id: inv.id, 
        amount: inv.amount, 
        urgency: inv.urgency,
        type: inv.type,
        title: inv.title 
      }))
    });

    return result;
  };

  // Helper function to aggregate ONLY custom/user-added capital investments (excludes auto-generated)
  const aggregateCustomInvestmentsByMonth = (year: number, month: number) => {
    // Find only custom investments that target this specific month
    const monthInvestments = capitalInvestments.filter(investment => {
      const targetDate = new Date(investment.targetDate);
      return targetDate.getFullYear() === year && 
             targetDate.getMonth() + 1 === month &&
             investment.type === 'custom'; // Only custom investments
    });

    // Sum custom investment amounts
    const total = monthInvestments.reduce((total, investment) => total + investment.amount, 0);
    
    debugLog('Custom investment aggregation for month', {
      year,
      month,
      customInvestmentsCount: monthInvestments.length,
      total,
      investments: monthInvestments.map(inv => ({ 
        id: inv.id, 
        amount: inv.amount, 
        title: inv.title 
      }))
    });
    
    return total;
  };

  // Aggregate projects by month for chart data
  const aggregateProjectsByMonth = (year: number, month: number) => {
    // Find all projects that belong to this specific month/year and are included in budget
    const monthProjects = projects.filter(project => {
      if (!project.includeInBudget) return false;
      
      // For projects, we'll spread the cost across the financial year months
      // Calculate which financial year this month belongs to
      const monthFinancialYear = getFinancialYear(year, month, localSettings.financialYearStart);
      
      // Only include projects that match this financial year
      return project.financialYear === monthFinancialYear;
    });

    const result = {
      total: 0,
      projectCount: 0,
      // Track by project type for debugging
      maintenance: 0,
      quickProjects: 0,
      maintenanceCount: 0,
      quickProjectCount: 0
    };

    // Get the financial year start date for proper monthly distribution
    const financialYearStart = parseFinancialYearStart(localSettings.financialYearStart);
    const currentFinancialYear = getFinancialYear(year, month, localSettings.financialYearStart);
    
    monthProjects.forEach(project => {
      // Normalize all monetary fields to numbers to ensure consistent calculations
      const actualCost = Number(project.actualCost) || 0;
      const estimatedCost = Number(project.estimatedCost) || 0;
      const totalBudget = Number(project.totalBudget) || 0;
      
      // Calculate monthly cost based on project completion status
      let projectCost: number;
      if (project.status === 'completed') {
        // For completed projects, use actual cost
        projectCost = actualCost;
      } else {
        // For incomplete projects, use maximum of actual cost and budget
        const budgetCost = estimatedCost || totalBudget;
        projectCost = Math.max(actualCost, budgetCost);
      }
      
      // Spread the cost evenly across the financial year (12 months)
      const monthlyCost = projectCost / 12;
      
      result.total += monthlyCost;
      result.projectCount++;
      
      // Track by project type
      if (project.isQuickProject) {
        result.quickProjects += monthlyCost;
        result.quickProjectCount++;
      } else {
        result.maintenance += monthlyCost;
        result.maintenanceCount++;
      }
    });

    debugLog('Project aggregation for month', {
      year,
      month,
      monthProjects: monthProjects.length,
      result,
      currentFinancialYear,
      projectBreakdown: {
        maintenance: { count: result.maintenanceCount, amount: result.maintenance },
        quickProjects: { count: result.quickProjectCount, amount: result.quickProjects }
      },
      projects: monthProjects.map(proj => {
        // Normalize all monetary fields to numbers
        const actualCost = Number(proj.actualCost) || 0;
        const estimatedCost = Number(proj.estimatedCost) || 0;
        const totalBudget = Number(proj.totalBudget) || 0;
        
        let projectCost: number;
        if (proj.status === 'completed') {
          projectCost = actualCost;
        } else {
          const budgetCost = estimatedCost || totalBudget;
          projectCost = Math.max(actualCost, budgetCost);
        }
        
        return {
          id: proj.id, 
          amount: projectCost, 
          monthlyAmount: projectCost / 12,
          financialYear: proj.financialYear,
          title: proj.title,
          includeInBudget: proj.includeInBudget,
          status: proj.status,
          actualCost: actualCost,
          estimatedCost: estimatedCost,
          totalBudget: totalBudget
        };
      })
    });

    return result;
  };

  // Prepare chart data with filters applied
  const getChartData = () => {
    if (!forecastData?.forecast) return [];

    // Use actual inflated revenue from forecast instead of hardcoded values
    // const combinedRevenue = calculateTotalRevenue(); // REMOVED: This was using fixed values

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
      // Group monthly data into financial yearly data
      const yearlyData: { [key: number]: { 
        revenue: number; 
        spending: number; 
        balanceStart: number;
        balanceEnd: number; 
        netCashFlow: number; 
        capitalInvestments: number;
        urgentInvestments: number;
        suggestedInvestments: number;
        notUrgentInvestments: number;
        projects: number;
        count: number;
        monthsInYear: number;
        statuses: ('red' | 'yellow' | 'green')[];
      } } = {};

      filteredData.forEach((item, index) => {
        // Convert calendar date to financial year
        const financialYear = getFinancialYear(item.year, item.month, localSettings.financialYearStart);
        
        if (!yearlyData[financialYear]) {
          yearlyData[financialYear] = { revenue: 0, spending: 0, balanceStart: 0, balanceEnd: 0, netCashFlow: 0, capitalInvestments: 0, urgentInvestments: 0, suggestedInvestments: 0, notUrgentInvestments: 0, projects: 0, count: 0, monthsInYear: 0, statuses: [] };
        }
        // Use actual inflated revenue from forecast data
        yearlyData[financialYear].revenue += item.revenue;
        // Use backend projectCosts to separate spending from projects
        const backendProjectCosts = item.projectCosts || 0;
        yearlyData[financialYear].spending += (item.spending - backendProjectCosts);
        // netCashFlow: item.spending already includes projects, no double-counting
        yearlyData[financialYear].netCashFlow += (item.revenue - item.spending);
        
        // Get auto-generated investments directly from forecast data (scenario-specific)
        const autoGeneratedAmount = item.autoGeneratedInvestment || 0;
        
        // Get ONLY custom/user-added investments from state for this month (excludes auto-generated to avoid double-counting)
        const customInvestmentsAmount = aggregateCustomInvestmentsByMonth(item.year, item.month);
        
        // Aggregate capital investments for the year
        yearlyData[financialYear].capitalInvestments += (autoGeneratedAmount + customInvestmentsAmount);
        yearlyData[financialYear].urgentInvestments += autoGeneratedAmount; // Auto-generated from current scenario
        yearlyData[financialYear].notUrgentInvestments += customInvestmentsAmount; // Custom investments

        // Aggregate project costs from backend data
        yearlyData[financialYear].projects = (yearlyData[financialYear].projects || 0) + backendProjectCosts;
        
        yearlyData[financialYear].count++;
        yearlyData[financialYear].monthsInYear++;
        yearlyData[financialYear].statuses.push(item.status);
        
        // For yearly view: Use first month's balance as start, last month's balance as end.
        // Mirror the monthly branch's preference order so that reconciliation
        // (balanceEnd ≈ balanceStart + revenue − spending − projects) holds for
        // every visible year, including the first one after slicing/filtering:
        //   1. per-period startingBalance returned by the backend
        //   2. previous month's ending balance
        //   3. top-level forecast startingBalance
        //   4. configured bank-account starting amount
        if (yearlyData[financialYear].count === 1) {
          const prevIndex = startIndex + index - 1;
          if (item.startingBalance !== undefined && item.startingBalance !== null) {
            yearlyData[financialYear].balanceStart = item.startingBalance;
          } else if (prevIndex >= 0 && forecastData.forecast[prevIndex]) {
            yearlyData[financialYear].balanceStart = forecastData.forecast[prevIndex].balance;
          } else if (forecastData.startingBalance !== undefined && forecastData.startingBalance !== null) {
            yearlyData[financialYear].balanceStart = forecastData.startingBalance;
          } else {
            yearlyData[financialYear].balanceStart = localSettings.bankAccountStartAmount || 0;
          }
        }
        // Always update end balance to the latest month in the financial year
        yearlyData[financialYear].balanceEnd = item.balance;
      });

      // Sort yearly data chronologically after Object.entries
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      
      return Object.entries(yearlyData)
        .sort(([yearA], [yearB]) => parseInt(yearA) - parseInt(yearB))
        .map(([year, data]) => {
          // Calculate yearly status: red if any month is red, yellow if any is yellow, else green
          let yearStatus: 'red' | 'yellow' | 'green' = 'green';
          if (data.statuses.includes('red')) {
            yearStatus = 'red';
          } else if (data.statuses.includes('yellow')) {
            yearStatus = 'yellow';
          }
          
          // Determine if this year is in the future
          const isFuture = parseInt(year) > currentYear;
          
          return {
            month: year,
            balanceStart: data.balanceStart,
            balanceEnd: data.balanceEnd,
            revenue: data.revenue,
            spending: data.spending,
            netCashFlow: data.netCashFlow,
            capitalInvestments: data.capitalInvestments,
            urgentInvestments: data.urgentInvestments,
            suggestedInvestments: data.suggestedInvestments,
            notUrgentInvestments: data.notUrgentInvestments,
            projects: data.projects,
            status: yearStatus,
            isFuture: isFuture, // Flag to indicate if this is a future period
          };
        });
    }

    // Monthly view with individual months
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
    
    return filteredData.map((item, index) => {
      // Calculate start of period balance. Prefer the per-period startingBalance
      // returned by the backend so reconciliation works for every row, including
      // the first visible row after slicing/filtering. Fall back to the previous
      // period's ending balance, and finally to the configured starting amount.
      let balanceStart: number;
      const prevIndex = startIndex + index - 1;
      if (item.startingBalance !== undefined && item.startingBalance !== null) {
        balanceStart = item.startingBalance;
      } else if (prevIndex >= 0 && forecastData.forecast[prevIndex]) {
        balanceStart = forecastData.forecast[prevIndex].balance;
      } else if (forecastData.startingBalance !== undefined && forecastData.startingBalance !== null) {
        balanceStart = forecastData.startingBalance;
      } else {
        balanceStart = localSettings.bankAccountStartAmount || 0;
      }
      
      // Get auto-generated investments directly from forecast data (scenario-specific)
      const autoGeneratedAmount = item.autoGeneratedInvestment || 0;
      
      // Get ONLY custom/user-added investments from state for this month (excludes auto-generated to avoid double-counting)
      const customInvestmentsAmount = aggregateCustomInvestmentsByMonth(item.year, item.month);
      
      // Total capital investments = auto-generated (from scenario) + custom (from user)
      const totalCapitalInvestments = autoGeneratedAmount + customInvestmentsAmount;
      
      // Use backend projectCosts to separate spending from projects
      const backendProjectCosts = item.projectCosts || 0;
      const spendingWithoutProjects = item.spending - backendProjectCosts;
      
      // Determine if this period is in the future (current month onwards for forecast visualization)
      const isFuture = item.year > currentYear || (item.year === currentYear && item.month >= currentMonth);
      
      return {
        month: `${item.year}-${item.month.toString().padStart(2, '0')}`,
        balanceStart: balanceStart,
        balanceEnd: item.balance, // Current period's ending balance
        status: item.status,
        revenue: item.revenue, // Use actual inflated revenue from forecast data
        spending: spendingWithoutProjects, // Spending without projects, projects shown separately
        netCashFlow: item.revenue - item.spending, // item.spending already includes projects, no double-counting
        capitalInvestments: totalCapitalInvestments, // Auto-generated (scenario-specific) + custom
        urgentInvestments: autoGeneratedAmount, // Show auto-generated from current scenario
        suggestedInvestments: 0, // Not applicable in this view
        notUrgentInvestments: customInvestmentsAmount, // Show custom investments
        projects: backendProjectCosts, // Separate project line on chart from backend
        isFuture: isFuture, // Flag to indicate if this is a future period
      };
    });
  };

  // Calculate investment summary metrics: use chart data for consistency with displayed values
  const calculateInvestmentSummary = (): InvestmentSummary => {
    // Get chart data which already has the correct capital investment calculations
    const chartData = getChartData();
    
    if (!chartData || chartData.length === 0) {
      return {
        totalAmount: 0,
        urgentAmount: 0,
        suggestedAmount: 0,
        notUrgentAmount: 0,
        count: 0,
        urgentCount: 0,
        suggestedCount: 0,
        notUrgentCount: 0,
      };
    }

    // Sum capital investments by category from chart data
    // Ensure all values are properly coerced to numbers to avoid string concatenation
    const urgentAmount = chartData.reduce((sum, period) => sum + Number(period.urgentInvestments || 0), 0);
    const suggestedAmount = chartData.reduce((sum, period) => sum + Number(period.suggestedInvestments || 0), 0);
    const notUrgentAmount = chartData.reduce((sum, period) => sum + Number(period.notUrgentInvestments || 0), 0);
    
    // Total should always be the sum of the three categories to ensure consistency
    const totalAmount = Number(urgentAmount) + Number(suggestedAmount) + Number(notUrgentAmount);

    // For counts: combine custom investments + periods with auto-generated investments
    // This ensures counts align with the non-zero amounts shown
    const customInvestments = getFilteredInvestments().filter(inv => inv.type === 'custom');
    const autoGeneratedPeriods = chartData.filter(period => (period.urgentInvestments || 0) > 0).length;
    
    const count = customInvestments.length + autoGeneratedPeriods;
    const urgentCount = customInvestments.filter(inv => inv.urgency === 'urgent').length + autoGeneratedPeriods;
    const suggestedCount = customInvestments.filter(inv => inv.urgency === 'suggested').length;
    const notUrgentCount = customInvestments.filter(inv => inv.urgency === 'not_urgent').length;

    return {
      totalAmount,
      urgentAmount,
      suggestedAmount,
      notUrgentAmount,
      count,
      urgentCount,
      suggestedCount,
      notUrgentCount,
    };
  };

  // Robust current balance calculation with saved bank account data prioritized
  const getCurrentBalanceWithFallbacks = () => {
    // Helper function to safely format currency
    const formatCurrency = (value: number) => {
      if (!Number.isFinite(value)) return '$0.00';
      return `$${value.toFixed(2)}`;
    };

    // Helper function to format date for display
    const formatSavedDate = (dateString: string) => {
      try {
        if (!dateString) return 'Unknown date';
        // If already YYYY-MM-DD, return as-is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
        return new Date(dateString).toLocaleDateString('en-CA', { timeZone: 'UTC' });
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

  const budgetData = getBudgetCategories();
  
  // Memoize chartData to prevent infinite re-renders in downstream useMemo hooks
  const chartData = useMemo(() => getChartData(), [
    forecastData,
    filters.startMonth,
    filters.startYear,
    filters.viewType,
    filters.periodLength,
    localSettings.financialYearStart,
    localSettings.bankAccountStartAmount,
    projects,
    capitalInvestments
  ]);
  
  // Calculate metrics directly (not memoized to avoid hook ordering issues)
  const summaryMetrics = calculateSummaryMetrics();
  
  // Memoize investment summary to prevent infinite re-renders
  const investmentSummary = useMemo(() => {
    const investmentSummaryRaw = calculateInvestmentSummary();
    return {
      totalAmount: Number(investmentSummaryRaw.totalAmount) || 0,
      urgentAmount: Number(investmentSummaryRaw.urgentAmount) || 0,
      suggestedAmount: Number(investmentSummaryRaw.suggestedAmount) || 0,
      notUrgentAmount: Number(investmentSummaryRaw.notUrgentAmount) || 0,
      count: investmentSummaryRaw.count,
      urgentCount: investmentSummaryRaw.urgentCount,
      suggestedCount: investmentSummaryRaw.suggestedCount,
      notUrgentCount: investmentSummaryRaw.notUrgentCount,
    };
  }, [chartData, capitalInvestments, filters, capitalInvestmentMode]);

  // Calculate display text for financial years (account for incomplete years)
  const getYearlyDisplayText = () => {
    if (filters.viewType !== 'year' || !chartData.length) return `${chartData.length} years`;
    
    // Count complete vs incomplete years based on months in each financial year
    const financialYearStart = parseFinancialYearStart(localSettings.financialYearStart);
    let completeYears = 0;
    let totalYears = chartData.length;
    
    // Check if first or last years are incomplete (less than 12 months)
    // This is a simplified check - we could enhance this further with actual month counting
    return `${totalYears} years`;
  };

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
        <Header title={t('budgetManagement')} subtitle={t('budgetManagementSubtitle')} />
        <div className='flex-1 flex items-center justify-center'>
          <div className='text-center text-muted-foreground'>
            <DollarSign className='w-12 h-12 mx-auto mb-4' />
            <p>{t('selectBuilding')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title={t('budgetManagement')} subtitle={t('budgetManagementSubtitle')} />
      
      {/* Back Navigation */}
      {buildingId && (
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBackToBuilding}
            className="flex items-center gap-2"
            data-testid="button-back-to-building"
          >
            <ArrowLeft className="w-4 h-4" />
            {buildingName || t('budgetBackToBuilding')}
          </Button>
        </div>
      )}

      {/* Scroll Sentinel for Floating Button */}
      <div ref={sentinelRef} className="h-px w-full pointer-events-none" aria-hidden="true" />
      
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
              <h3 className="font-semibold text-lg">{t('budgetFilters')}</h3>
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
                    <SelectItem value="month">{t('budgetMonthlyView')}</SelectItem>
                    <SelectItem value="year">{t('budgetYearlyView')}</SelectItem>
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
                          <SelectValue placeholder={t('budgetMonth')} />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({length: 12}, (_, i) => i + 1)
                            .filter(month => {
                              // Hide months before the effective start anchor when
                              // the currently selected year equals the anchor year
                              const eY = (forecastData as any)?.effectiveStartYear;
                              const eM = (forecastData as any)?.effectiveStartMonth;
                              if (
                                Number.isFinite(eY) &&
                                Number.isFinite(eM) &&
                                filters.startYear === eY &&
                                month < eM
                              ) {
                                return false;
                              }
                              return true;
                            })
                            .map(month => (
                              <SelectItem key={month} value={month.toString()}>
                                {new Date(2024, month - 1, 1).toLocaleDateString('en-US', { month: 'short' })}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                    {(() => {
                      // Clamp the year picker so users cannot select a year
                      // before the chart's effective start anchor.
                      const currentYear = new Date().getFullYear();
                      const effectiveStartYear = (forecastData as any)?.effectiveStartYear;
                      // When the forecast anchor isn't loaded yet, fall back
                      // to the current calendar year to match the help text
                      // ("January 1 of the current year if none is set").
                      const minYear = Number.isFinite(effectiveStartYear)
                        ? effectiveStartYear
                        : currentYear;
                      const maxYear = Math.max(currentYear, minYear) + 25;
                      const years: number[] = [];
                      for (let y = minYear; y <= maxYear; y++) years.push(y);
                      const helpText = t('chartYearPickerHelp').replace('{year}', String(minYear));
                      return (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <Select
                                  value={filters.startYear?.toString() || ''}
                                  onValueChange={(value) => {
                                    setFilters(prev => ({
                                      ...prev,
                                      startYear: parseInt(value) || new Date().getFullYear(),
                                    }));
                                  }}
                                >
                                  <SelectTrigger data-testid="select-start-year" aria-describedby="budget-year-picker-help">
                                    <SelectValue placeholder={t('budgetYear')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {years.map(year => (
                                      <SelectItem key={year} value={year.toString()}>
                                        {year}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              id="budget-year-picker-help"
                              className="max-w-xs text-xs"
                              data-testid="tooltip-year-picker-help"
                            >
                              {helpText}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })()}
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
                      {filters.viewType === 'month' ? t('budgetMonths') : t('budgetYears')}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Data Visibility Toggles Section - Full Width with 2 Columns */}
            <Card className="p-4 w-full">
              <div className="space-y-4">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Data Visibility
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-revenue" className="text-sm cursor-pointer flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      {t('budgetRevenue')}
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
                      {t('budgetSpending')}
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
                    <Label htmlFor="toggle-balance-start" className="text-sm cursor-pointer flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-cyan-500" />
                      {t('budgetBalanceStartOfPeriod')}
                    </Label>
                    <Switch 
                      id="toggle-balance-start"
                      checked={filters.dataVisibility.balanceStart}
                      onCheckedChange={(checked) => {
                        setFilters(prev => ({
                          ...prev,
                          dataVisibility: { ...prev.dataVisibility, balanceStart: checked },
                        }));
                      }}
                      data-testid="switch-balance-start-visibility"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-balance-end" className="text-sm cursor-pointer flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-blue-500" />
                      {t('budgetBalanceEndOfPeriod')}
                    </Label>
                    <Switch 
                      id="toggle-balance-end"
                      checked={filters.dataVisibility.balanceEnd}
                      onCheckedChange={(checked) => {
                        setFilters(prev => ({
                          ...prev,
                          dataVisibility: { ...prev.dataVisibility, balanceEnd: checked },
                        }));
                      }}
                      data-testid="switch-balance-end-visibility"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-cashflow" className="text-sm cursor-pointer flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-purple-500" />
                      {t('budgetNetCashFlow')}
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
                      {t('budgetMinimumRequirementLine')}
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-project" className="text-sm flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-teal-500"></div>
                      Projects
                    </Label>
                    <Switch 
                      id="toggle-project"
                      checked={filters.dataVisibility.project}
                      onCheckedChange={(checked) => {
                        setFilters(prev => ({
                          ...prev,
                          dataVisibility: { ...prev.dataVisibility, project: checked },
                        }));
                      }}
                      data-testid="switch-project-visibility"
                    />
                  </div>
                </div>
              </div>
            </Card>
              </div>

              {/* Filter Status Summary */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                <span>
                  {t('budgetShowing')} <Badge variant="secondary">{filters.periodLength} {filters.viewType === 'month' ? t('budgetMonths') : t('budgetYears')}</Badge>
                </span>
                <Separator orientation="vertical" className="h-4" />
                <span>
                  Data: {Object.entries(filters.dataVisibility).filter(([_, visible]) => visible).length} of 7 categories visible
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
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
                <Card data-testid="card-monthly-income">
                  <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>{t('budgetMonthlyRevenue')}</CardTitle>
                    <TrendingUp className='h-4 w-4 text-muted-foreground' />
                  </CardHeader>
                  <CardContent className='card-content-safe'>
                    <div className='financial-value-large' title={`$${calculateTotalRevenue().toFixed(2)}`} data-testid='value-monthly-revenue'>
                      ${calculateTotalRevenue().toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card data-testid="card-monthly-spending">
                  <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>{t('budgetMonthlySpending')}</CardTitle>
                    <Calculator className='h-4 w-4 text-muted-foreground' />
                  </CardHeader>
                  <CardContent className='card-content-safe'>
                    <div className='financial-value-large' title={`$${summaryMetrics.monthlySpending.toFixed(2)}`} data-testid='value-monthly-spending'>
                      ${summaryMetrics.monthlySpending.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card data-testid="card-year-end-projection">
                  <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>{t('budgetYearEndProjection')}</CardTitle>
                    <TrendingDown className='h-4 w-4 text-muted-foreground' />
                  </CardHeader>
                  <CardContent className='card-content-safe'>
                    <div className='financial-value-large' title={`$${summaryMetrics.yearEndBalance.toFixed(2)}`} data-testid='value-year-end-projection'>
                      ${summaryMetrics.yearEndBalance.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card data-testid="card-total-investment">
                  <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                    <CardTitle className='text-sm font-medium'>{t('budgetTotalInvestment')}</CardTitle>
                    <TrendingUp className='h-4 w-4 text-muted-foreground' />
                  </CardHeader>
                  <CardContent className='card-content-safe'>
                    <div className='financial-value-large' title={`$${investmentSummary.totalAmount.toFixed(2)}`} data-testid='value-total-investment'>
                      ${investmentSummary.totalAmount.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
              </div>


              <BudgetChart
                chartData={chartData as ChartDataPoint[]}
                filters={filters}
                minimumFund={forecastData?.minimumFund}
                budgetChartRef={budgetChartRef as React.RefObject<HTMLDivElement>}
                onDownloadPDF={handleDownloadChartPDF}
                t={t as (key: string) => string}
              />

              {/* Project Card - First card under the graph */}
              <Card data-testid="card-project-management">
                <CardHeader 
                  className="cursor-pointer"
                  onClick={() => toggleCard('project')}
                >
                  <CardTitle className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <Building2 className='w-5 h-5' />
                      {t('budgetProjectManagement')}
                    </div>
                    <div className='flex items-center gap-2'>
                      <div
                        className='inline-flex rounded-md border bg-muted/30'
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          type='button'
                          size='sm'
                          variant={projectViewMode === 'list' ? 'default' : 'ghost'}
                          className='h-7 px-2'
                          onClick={() => setProjectViewMode('list')}
                          data-testid='button-projects-view-list'
                          title={t('listView')}
                        >
                          <List className='w-4 h-4' />
                        </Button>
                        <Button
                          type='button'
                          size='sm'
                          variant={projectViewMode === 'gantt' ? 'default' : 'ghost'}
                          className='h-7 px-2'
                          onClick={() => setProjectViewMode('gantt')}
                          data-testid='button-projects-view-gantt'
                          title={t('ganttView')}
                        >
                          <BarChart3 className='w-4 h-4' />
                        </Button>
                      </div>
                      {cardsCollapsed.project ? (
                        <ChevronDown className='w-5 h-5' />
                      ) : (
                        <ChevronUp className='w-5 h-5' />
                      )}
                    </div>
                  </CardTitle>
                  <div className='text-sm text-muted-foreground'>
                    {t('budgetManageProjectsForCurrentYear')}
                  </div>
                </CardHeader>
                {!cardsCollapsed.project && (
                  <CardContent className='space-y-4'>
                    {/* Add Quick Project Button */}
                    <div className='flex justify-between items-center'>
                      <div className='text-sm text-muted-foreground'>
                        {t('budgetProjectsAffectingBudget')}
                      </div>
                      <Button 
                        onClick={() => setAddQuickProjectDialogOpen(true)}
                        size="sm"
                        className="flex items-center gap-2"
                        data-testid="button-add-quick-project"
                      >
                        <Plus className="w-4 h-4" />
                        {t('budgetAddQuickProject')}
                      </Button>
                    </div>

                    {/* Project List */}
                    <div className='space-y-3'>
                      {projectsLoading ? (
                        <div className='text-center py-8 text-muted-foreground'>
                          <RefreshCw className='w-8 h-8 mx-auto mb-4 animate-spin text-gray-300' />
                          <p>{t('loadingProjects')}</p>
                        </div>
                      ) : projects.length > 0 && projectViewMode === 'gantt' ? (
                        <GanttChart
                          language={language}
                          dateRange={(() => {
                            const sm = (filters.startMonth ?? 1) - 1;
                            const sy = filters.startYear ?? new Date().getFullYear();
                            const months = filters.viewType === 'year'
                              ? filters.periodLength * 12
                              : filters.periodLength;
                            const start = new Date(sy, sm, 1);
                            const end = new Date(sy, sm + months, 1);
                            return { start, end };
                          })()}
                          projects={projects.map(p => ({
                            id: p.id,
                            title: p.title,
                            status: p.status,
                            plannedStartDate: p.plannedStartDate,
                            plannedEndDate: p.plannedEndDate,
                            actualStartDate: p.actualStartDate,
                            actualEndDate: p.actualEndDate,
                            includeInBudget: p.includeInBudget,
                          }))}
                          onToggleInclude={(id, value) => {
                            projectStatesRef.current.set(id, value);
                            setProjects(prev => prev.map(pp =>
                              pp.id === id ? { ...pp, includeInBudget: value } : pp
                            ));
                          }}
                        />
                      ) : projects.length > 0 ? (
                        projects.map((project) => {
                          const hasPendingYear = pendingProjectYears.has(project.id);
                          const isConfirming = confirmProjectYearMutation.isPending &&
                            confirmProjectYearMutation.variables?.id === project.id;
                          return (
                          <div
                            key={project.id}
                            className={`border rounded-lg p-4 space-y-3 ${hasPendingYear ? 'border-primary ring-1 ring-primary/40 bg-primary/5' : ''}`}
                            data-testid={`budget-project-card-${project.id}`}
                          >
                            <div className='flex items-center justify-between'>
                              <div className='flex-1'>
                                <div className='flex items-center gap-2'>
                                  <h4 className='font-medium text-sm'>{project.title}</h4>
                                  {project.isQuickProject && (
                                    <Badge variant="secondary" className="text-xs">{t('budgetQuickProjectBadge')}</Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs">{project.status}</Badge>
                                  {hasPendingYear && (
                                    <Badge variant="default" className="text-xs" data-testid={`badge-pending-year-${project.id}`}>
                                      {language === 'fr' ? 'Modification non enregistrée' : 'Unsaved change'}
                                    </Badge>
                                  )}
                                </div>
                                <div className='grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs text-muted-foreground'>
                                  <div>
                                    <span className='font-medium'>{t('budget')}:</span> ${project.totalBudget.toLocaleString()}
                                  </div>
                                  <div>
                                    <span className='font-medium'>{t('budgetActualCost')}:</span> ${project.actualCost.toLocaleString()}
                                  </div>
                                  <div className='flex items-center gap-1'>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className='h-6 w-6 p-0'
                                      disabled={project.financialYear <= minShiftableYear || isConfirming}
                                      onClick={() => shiftProjectYear(project, -1)}
                                      data-testid={`button-shift-prev-year-${project.id}`}
                                      title={language === 'fr' ? 'Période précédente' : 'Previous period'}
                                    >
                                      <ChevronLeft className='w-3 h-3' />
                                    </Button>
                                    <span>
                                      <span className='font-medium'>{language === 'fr' ? 'Année financière' : 'Financial Year'}:</span>{' '}
                                      {project.financialYear}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className='h-6 w-6 p-0'
                                      disabled={project.financialYear >= maxShiftableYear || isConfirming}
                                      onClick={() => shiftProjectYear(project, 1)}
                                      data-testid={`button-shift-next-year-${project.id}`}
                                      title={language === 'fr' ? 'Période suivante' : 'Next period'}
                                    >
                                      <ChevronRight className='w-3 h-3' />
                                    </Button>
                                  </div>
                                  <div>
                                    <span className='font-medium'>{t('cost')}:</span> ${(project.estimatedCost || project.totalBudget).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              <div className='flex items-center gap-2 flex-shrink-0'>
                                <Label htmlFor={`project-include-${project.id}`} className="text-xs hidden sm:inline">{t('budgetIncludeInBudget')}</Label>
                                <Switch 
                                  id={`project-include-${project.id}`}
                                  checked={project.includeInBudget}
                                  onCheckedChange={(checked) => {
                                    // Update ref to persist state across refetches
                                    projectStatesRef.current.set(project.id, checked);
                                    // Update local state
                                    setProjects(prev => prev.map(p => 
                                      p.id === project.id ? { ...p, includeInBudget: checked } : p
                                    ));
                                  }}
                                  data-testid={`switch-project-include-${project.id}`}
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={async () => {
                                    if (project.isQuickProject) {
                                      // For quick projects, open the simple edit dialog
                                      const plannedDate = project.plannedStartDate ? new Date(project.plannedStartDate) : null;
                                      setEditingProject({
                                        id: project.id,
                                        title: project.title,
                                        totalBudget: project.totalBudget.toString(),
                                        financialYear: project.financialYear.toString(),
                                        plannedMonth: plannedDate ? (plannedDate.getMonth() + 1).toString() : '1',
                                        plannedDay: plannedDate ? plannedDate.getDate().toString() : '1',
                                        description: '',
                                        isQuickProject: true,
                                      });
                                      setEditProjectDialogOpen(true);
                                    } else {
                                      // For real projects, fetch the full project data and open the workflow modal
                                      try {
                                        const response = await apiRequest('GET', `/api/maintenance/projects/${project.id}`);
                                        if (response.ok) {
                                          const result = await response.json();
                                          // API returns { success: true, data: {...project} }
                                          const fullProject = result.data || result;
                                          setSelectedProjectForWorkflow(fullProject);
                                          setShowProjectWorkflowModal(true);
                                        } else {
                                          toast({
                                            title: t('error'),
                                            description: language === 'fr' ? 'Impossible de charger le projet' : 'Failed to load project',
                                            variant: 'destructive',
                                          });
                                        }
                                      } catch (error) {
                                        logError('Failed to fetch project:', error);
                                        toast({
                                          title: t('error'),
                                          description: language === 'fr' ? 'Impossible de charger le projet' : 'Failed to load project',
                                          variant: 'destructive',
                                        });
                                      }
                                    }
                                  }}
                                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex-shrink-0"
                                  data-testid={`button-edit-project-${project.id}`}
                                  title={t('edit')}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                {project.isQuickProject && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      if (confirm(t('budgetDeleteQuickProjectConfirm').replace('{title}', project.title))) {
                                        deleteQuickProjectMutation.mutate(project.id);
                                      }
                                    }}
                                    disabled={deleteQuickProjectMutation.isPending}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    data-testid={`button-delete-quick-project-${project.id}`}
                                    title={t('delete')}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            {hasPendingYear && (
                              <div className='flex justify-end pt-2 border-t'>
                                <Button
                                  size="sm"
                                  onClick={() => confirmProjectYearMutation.mutate({
                                    id: project.id,
                                    financialYear: project.financialYear,
                                  })}
                                  disabled={isConfirming}
                                  data-testid={`button-confirm-year-${project.id}`}
                                >
                                  {isConfirming ? (
                                    <>
                                      <div className='animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full mr-2'></div>
                                      {t('saving')}
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-4 h-4 mr-1" />
                                      {language === 'fr' ? 'Confirmer' : 'Confirm'}
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                          );
                        })
                      ) : (
                        <div className='text-center py-8 text-muted-foreground'>
                          <Building2 className='w-12 h-12 mx-auto mb-4 text-gray-300' />
                          <p>{t('budgetNoProjectsFound')}</p>
                          <p className='text-sm'>{t('budgetUseQuickProjectHelp')}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Configuration Cards */}
              <div className='grid grid-cols-1 gap-6'>
                {/* Bank Account Configuration */}
                <Card data-testid="card-bank-account-config">
                  <CardHeader 
                    className="cursor-pointer"
                    onClick={() => toggleCard('bankAccount')}
                  >
                    <CardTitle className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <Building className='w-5 h-5' />
                        {t('budgetBankAccountConfig')}
                      </div>
                      {cardsCollapsed.bankAccount ? (
                        <ChevronDown className='w-5 h-5' />
                      ) : (
                        <ChevronUp className='w-5 h-5' />
                      )}
                    </CardTitle>
                  </CardHeader>
                  {!cardsCollapsed.bankAccount && (
                    <CardContent className='space-y-4'>
                    {/* Starting Balance with Date */}
                    <div className='grid grid-cols-2 gap-4'>
                      <div className='space-y-2'>
                        <Label htmlFor="starting-amount">{t('budgetStartingBalance')}</Label>
                        <div className='relative'>
                          <DollarSign className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                          <Input
                            id="starting-amount"
                            type="number"
                            value={localSettings.bankAccountStartAmount}
                            onChange={(e) => {
                              const normalizedValue = normalizeMoney(e.target.value);
                              setLocalSettings(prev => ({
                                ...prev,
                                bankAccountStartAmount: parseFloat(normalizedValue) || 0,
                              }))
                            }}
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
                                      {t('budgetCurrentBalance')}: <span className='font-medium text-foreground' data-testid="text-current-balance">{currentBalanceInfo.formatted}</span>
                                    </span>
                                    <span className='flex items-center gap-1 text-xs text-muted-foreground'>
                                      <span>
                                        {currentBalanceInfo.source === 'saved_balance' ? (language === 'fr' ? `(enregistré le ${currentBalanceInfo.savedDate})` : `(saved on ${currentBalanceInfo.savedDate})`) :
                                         currentBalanceInfo.source === 'forecast' ? (language === 'fr' ? '(depuis les prévisions)' : '(from forecast)') :
                                         currentBalanceInfo.source === 'forecast_starting' ? (language === 'fr' ? '(depuis le début des prévisions)' : '(from forecast start)') : 
                                         currentBalanceInfo.source === 'bank_account' ? (language === 'fr' ? '(depuis les données bancaires)' : '(from bank data)') : 
                                         currentBalanceInfo.source === 'local_settings' ? (language === 'fr' ? '(depuis les paramètres)' : '(from settings)') : (language === 'fr' ? '(aucune donnée)' : '(no data)')}
                                      </span>
                                    </span>
                                  </span>
                                ) : (
                                  <span className='flex items-center gap-2'>
                                    {(forecastLoading || bankAccountLoading) ? (
                                      <>
                                        <div className='w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin'></div>
                                        {language === 'fr' ? 'Chargement du solde actuel...' : 'Loading current balance...'}
                                      </>
                                    ) : (
                                      <span className='text-orange-600'>{language === 'fr' ? 'Aucune donnée de solde disponible' : 'No balance data available'}</span>
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
                                    title: t('budgetCurrentBalanceApplied'),
                                    description: t('budgetCurrentBalanceAppliedDesc').replace('{amount}', currentBalanceInfo.formatted),
                                  });
                                }}
                                className='h-6 px-2 text-xs'
                                data-testid="button-use-current-balance"
                                title={!isValidValue ? (language === 'fr' ? 'Aucune donnée de solde valide disponible' : 'No valid balance data available') : 
                                       !isValueChanged ? (language === 'fr' ? 'La valeur est déjà définie' : 'Value is already set') : (language === 'fr' ? 'Appliquer le solde actuel' : 'Apply current balance')}
                              >
                                {language === 'fr' ? 'Utiliser le solde actuel' : 'Use Current Balance'}
                              </Button>
                            </div>
                          );
                        })()}
                      </div>
                      <div className='space-y-2'>
                        <Label htmlFor="balance-date">{t('budgetBalanceDate')}</Label>
                        <Input
                          id="balance-date"
                          type="date"
                          value={formatDateForInput(localSettings.bankAccountStartDate)}
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

                    {/* Financial Year Start */}
                    <div className='space-y-2'>
                      <Label htmlFor="financial-year-start">{t('budgetFinancialYearStart')}</Label>
                      <Input
                        id="financial-year-start"
                        type="date"
                        value={formatDateForInput(localSettings.financialYearStart) || new Date().getFullYear() + '-01-01'}
                        onChange={(e) =>
                          setLocalSettings(prev => ({
                            ...prev,
                            financialYearStart: e.target.value,
                          }))
                        }
                        data-testid="input-financial-year-start"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t('budgetFinancialYearStartHelp')}
                      </p>
                    </div>

                    {/* Bank Account Summary */}
                    <div className='pt-2 border-t space-y-2'>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>{t('budgetStartingBalance')}:</span>
                        <span className='font-medium'>${localSettings.bankAccountStartAmount?.toLocaleString()}</span>
                      </div>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>{t('budgetBalanceDate')}:</span>
                        <span className='font-medium'>
                          {localSettings.bankAccountStartDate ? new Date(localSettings.bankAccountStartDate).toLocaleDateString() : t('notSet')}
                        </span>
                      </div>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>{t('budgetFinancialYearStart')}:</span>
                        <span className='font-medium'>
                          {localSettings.financialYearStart ? new Date(localSettings.financialYearStart).toLocaleDateString() : `${new Date().getFullYear()}-01-01`}
                        </span>
                      </div>
                      {(bankAccountData as BankAccountData)?.bankAccountUpdatedAt && (
                        <div className='flex justify-between text-sm'>
                          <span className='text-muted-foreground'>{t('lastUpdated')}:</span>
                          <span className='font-medium text-blue-600'>
                            {new Date((bankAccountData as BankAccountData).bankAccountUpdatedAt!).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Save Account Balance Button */}
                    <div className='pt-4 border-t'>
                      <Button
                        type="button"
                        onClick={() => saveBankAccountMutation.mutate()}
                        disabled={saveBankAccountMutation.isPending}
                        className='w-full flex items-center justify-center gap-2'
                        data-testid="button-save-account-balance"
                      >
                        {saveBankAccountMutation.isPending ? (
                          <>
                            <div className='w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin'></div>
                            {t('saving')}
                          </>
                        ) : (
                          <>
                            <PiggyBank className='w-4 h-4' />
                            {t('budgetSaveBankAccountSettings')}
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                  )}
                </Card>

                {/* Minimum requirement */}
                <Card data-testid="card-minimum-requirement-config">
                  <CardHeader 
                    className="cursor-pointer"
                    onClick={() => toggleCard('minimumRequirement')}
                  >
                    <CardTitle className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <Target className='w-5 h-5' />
                        {t('budgetMinimumRequirementCard')}
                      </div>
                      {cardsCollapsed.minimumRequirement ? (
                        <ChevronDown className='w-5 h-5' />
                      ) : (
                        <ChevronUp className='w-5 h-5' />
                      )}
                    </CardTitle>
                  </CardHeader>
                  {!cardsCollapsed.minimumRequirement && (
                    <CardContent className='space-y-4'>

                    {/* Dynamic Custom Bank Account Fields */}
                    <div className='space-y-3'>
                      <Label className='flex items-center gap-2'>
                        <Settings className='w-4 h-4' />
                        {t('budgetCustomBankAccountFields')}
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
                              placeholder={t('budgetFieldName')}
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
                            <Label htmlFor="bank-field-name">{t('budgetFieldName')}</Label>
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
                              <Label htmlFor="bank-field-value">{t('budgetFieldValue')}</Label>
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
                                {t('add')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Minimum Requirement Summary */}
                    <div className='pt-2 border-t space-y-2'>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>{t('budgetTotalMinimumRequirement')}</span>
                        <span className='font-medium'>
                          ${customBankFields.reduce((total, field) => total + field.fieldValue, 0).toLocaleString()}
                        </span>
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        {t('budgetMinimumRequirementSummary')}
                      </div>
                    </div>

                    {/* Save Minimum Requirement Button */}
                    <div className='pt-4 border-t'>
                      <Button
                        type="button"
                        onClick={() => saveBankAccountMutation.mutate()}
                        disabled={saveBankAccountMutation.isPending}
                        className='w-full flex items-center justify-center gap-2'
                        data-testid="button-save-minimum-requirement"
                      >
                        {saveBankAccountMutation.isPending ? (
                          <>
                            <div className='w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin'></div>
                            {t('saving')}
                          </>
                        ) : (
                          <>
                            <Target className='w-4 h-4' />
                            {t('budgetSaveMinimumRequirement')}
                          </>
                        )}
                      </Button>
                    </div>

                  </CardContent>
                  )}
                </Card>

                {/* Revenue Configuration */}
                <div className="w-full mb-6">
                  <Card data-testid="card-revenue-config">
                  <CardHeader 
                    className="cursor-pointer"
                    onClick={() => toggleCard('revenue')}
                  >
                    <CardTitle className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <TrendingUpIcon className='w-5 h-5' />
                        {t('budgetRevenueConfig')}
                      </div>
                      {cardsCollapsed.revenue ? (
                        <ChevronDown className='w-5 h-5' />
                      ) : (
                        <ChevronUp className='w-5 h-5' />
                      )}
                    </CardTitle>
                  </CardHeader>
                  {!cardsCollapsed.revenue && (
                    <CardContent className='space-y-4'>
                    {/* Revenue Growth Rate (keep existing) */}
                    <div className='space-y-2'>
                      <Label htmlFor="revenue-growth">{t('budgetRevenueGrowthRate')}</Label>
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
                      <p className="text-xs text-muted-foreground">
                        {t('budgetRevenueGrowthRateNote')}
                      </p>
                    </div>

                    {/* Punctual Revenue Growth */}
                    <div className='space-y-3'>
                      <Label>{t('budgetPunctualRevenueGrowth')}</Label>

                      {/* Existing Punctual Growth Entries */}
                      {punctualGrowthEntries.length > 0 ? (
                        <div className='space-y-2'>
                          {punctualGrowthEntries.map((entry) => {
                            const monthNames = [
                              t('january'), t('february'), t('march'), t('april'),
                              t('may'), t('june'), t('july'), t('august'),
                              t('september'), t('october'), t('november'), t('december')
                            ];
                            const monthName = monthNames[entry.month - 1] || entry.month;
                            
                            return (
                              <div key={entry.id} className='flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg'>
                                <div className='flex-1'>
                                  <p className='text-sm font-medium'>{monthName} {entry.year}</p>
                                  <p className='text-xs text-muted-foreground'>
                                    {entry.percentage}% {t('increase')}
                                  </p>
                                </div>
                                <div className='flex items-center gap-2'>
                                  <div className='flex items-center gap-1'>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className='flex items-center gap-1'>
                                            <Switch
                                              checked={entry.inflationIncluded}
                                              onCheckedChange={() => toggleInflationIncluded(entry.id)}
                                              data-testid={`switch-inflation-${entry.id}`}
                                            />
                                            <span className='text-xs text-muted-foreground'>
                                              {t('budgetInflationIncluded')}
                                            </span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent className='max-w-xs'>
                                          <p className='text-sm'>{t('budgetInflationIncludedTooltip')}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removePunctualGrowthEntry(entry.id)}
                                    className='text-red-500 hover:text-red-700'
                                    data-testid={`button-remove-growth-${entry.id}`}
                                    title={t('budgetDeletePunctualGrowth')}
                                  >
                                    <Trash2 className='w-4 h-4' />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className='text-sm text-muted-foreground text-center py-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg'>
                          {t('budgetNoPunctualGrowth')}
                        </div>
                      )}

                      {/* Add New Punctual Growth Entry */}
                      <div className='space-y-3 p-3 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-lg'>
                        <div className='grid grid-cols-1 md:grid-cols-4 gap-3'>
                          <div>
                            <Label htmlFor="growth-year">{t('budgetYear')}</Label>
                            <Input
                              id="growth-year"
                              type="number"
                              value={newPunctualGrowth.year}
                              onChange={(e) =>
                                setNewPunctualGrowth(prev => ({
                                  ...prev,
                                  year: e.target.value,
                                }))
                              }
                              placeholder={String(new Date().getFullYear() + 1)}
                              data-testid="input-growth-year"
                            />
                          </div>
                          <div>
                            <Label htmlFor="growth-month">{t('budgetMonth')}</Label>
                            <Select
                              value={newPunctualGrowth.month}
                              onValueChange={(value) =>
                                setNewPunctualGrowth(prev => ({
                                  ...prev,
                                  month: value,
                                }))
                              }
                            >
                              <SelectTrigger id="growth-month" data-testid="select-growth-month">
                                <SelectValue placeholder={t('selectMonth')} />
                              </SelectTrigger>
                              <SelectContent>
                                {(() => {
                                  const monthNames = [
                                    t('january'), t('february'), t('march'), t('april'),
                                    t('may'), t('june'), t('july'), t('august'),
                                    t('september'), t('october'), t('november'), t('december')
                                  ];
                                  
                                  // Get fiscal year start month (1-12)
                                  const fiscalYearDate = new Date(localSettings.financialYearStart || new Date().getFullYear() + '-01-01');
                                  const fiscalStartMonth = fiscalYearDate.getMonth() + 1;
                                  
                                  return monthNames.map((name, index) => {
                                    const monthValue = index + 1;
                                    const isFiscalStart = monthValue === fiscalStartMonth;
                                    
                                    return (
                                      <SelectItem 
                                        key={monthValue} 
                                        value={String(monthValue)}
                                        className={isFiscalStart ? 'bg-blue-50 dark:bg-blue-950/50 font-semibold' : ''}
                                      >
                                        {name} {isFiscalStart && '🏁'}
                                      </SelectItem>
                                    );
                                  });
                                })()}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="growth-percentage">{t('budgetPercentageIncrease')}</Label>
                            <div className='relative'>
                              <Percent className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                              <Input
                                id="growth-percentage"
                                type="number"
                                step="0.1"
                                value={newPunctualGrowth.percentage}
                                onChange={(e) =>
                                  setNewPunctualGrowth(prev => ({
                                    ...prev,
                                    percentage: e.target.value,
                                  }))
                                }
                                className="pl-9"
                                placeholder="5.0"
                                data-testid="input-growth-percentage"
                              />
                            </div>
                          </div>
                          <div className='flex flex-col justify-end gap-2'>
                            <div className='flex items-center gap-2'>
                              <Switch
                                checked={newPunctualGrowth.inflationIncluded}
                                onCheckedChange={(checked) =>
                                  setNewPunctualGrowth(prev => ({
                                    ...prev,
                                    inflationIncluded: checked,
                                  }))
                                }
                                data-testid="switch-new-inflation"
                              />
                              <Label className='text-xs'>{t('budgetInflationIncluded')}</Label>
                            </div>
                            <Button
                              onClick={addPunctualGrowthEntry}
                              disabled={!newPunctualGrowth.year.trim() || !newPunctualGrowth.month.trim() || !newPunctualGrowth.percentage.trim()}
                              className='w-full'
                              data-testid="button-add-punctual-growth"
                            >
                              <Plus className='w-4 h-4 mr-2' />
                              {t('budgetAddPunctualGrowth')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Residence Revenue Display */}
                    <div className='space-y-3'>
                      <Label className='flex items-center gap-2'>
                        <Building2 className='w-4 h-4' />
                        {t('budgetResidenceRevenue')}
                      </Label>
                      <div className='bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg' data-testid="residence-revenue-display">
                        {residencesLoading ? (
                          <div className='flex items-center justify-center py-4'>
                            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                              <div className='animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full'></div>
                              {t('loadingResidenceData')}
                            </div>
                          </div>
                        ) : residencesError ? (
                          <div className='flex items-center justify-center py-4'>
                            <div className='text-center'>
                              <p className='text-sm text-red-600 mb-1'>{t('budgetResidenceDataLoadFailed')}</p>
                              <p className='text-xs text-muted-foreground'>{t('budgetRevenueCalculationIncomplete')}</p>
                            </div>
                          </div>
                        ) : (
                          <div className='flex items-center justify-between'>
                            <div className='space-y-1'>
                              <p className='text-sm font-medium'>{t('budgetMonthlyResidenceFees')}</p>
                              <p className='text-xs text-muted-foreground'>
                                {residences?.filter(r => r?.isActive !== false).length || 0} {t('budgetActiveResidences')}
                              </p>
                            </div>
                            <div className='text-right'>
                              <p className='text-lg font-semibold text-blue-600'>
                                ${calculateResidenceRevenue().toLocaleString()}
                              </p>
                              <p className='text-xs text-muted-foreground'>{t('budgetPerMonth')}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Custom Revenue Lines */}
                    <div className='space-y-3'>
                      <Label className='flex items-center gap-2'>
                        <Plus className='w-4 h-4' />
                        {t('budgetCustomRevenueSources')}
                      </Label>
                      
                      {/* Existing Custom Revenue Lines */}
                      {customRevenueLines.map((line) => (
                        <div key={line.id} className='flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg'>
                          <div className='flex-1'>
                            <p className='text-sm font-medium'>{line.description}</p>
                            <p className='text-xs text-muted-foreground'>{t('budgetMonthlyRevenue')}</p>
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
                            <Label htmlFor="revenue-description">{t('description')}</Label>
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
                              <Label htmlFor="revenue-amount">{t('budgetMonthlyAmount')}</Label>
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
                                {t('add')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Revenue Summary */}
                    <div className='pt-2 border-t space-y-2'>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>{t('budgetResidenceRevenue')}:</span>
                        <span className='font-medium'>${calculateResidenceRevenue().toLocaleString()}</span>
                      </div>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>{t('budgetCustomRevenue')}:</span>
                        <span className='font-medium'>
                          ${customRevenueLines.reduce((total, line) => total + line.monthlyAmount, 0).toLocaleString()}
                        </span>
                      </div>
                      <div className='flex justify-between text-base font-semibold pt-2 border-t'>
                        <span>{t('budgetTotalMonthlyRevenue')}:</span>
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
                            {t('saving')}
                          </>
                        ) : (
                          <>
                            <TrendingUpIcon className='w-4 h-4 mr-2' />
                            {t('budgetSaveRevenueConfiguration')}
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                  )}
                  </Card>
                </div>

                {/* Bills Configuration */}
                <div className="w-full mb-6">
                  <Card data-testid="card-bills-config">
                  <CardHeader 
                    className="cursor-pointer"
                    onClick={() => toggleCard('bills')}
                  >
                    <CardTitle className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <Receipt className='w-5 h-5' />
                        {t('budgetBillsConfig')}
                      </div>
                      {cardsCollapsed.bills ? (
                        <ChevronDown className='w-5 h-5' />
                      ) : (
                        <ChevronUp className='w-5 h-5' />
                      )}
                    </CardTitle>
                  </CardHeader>
                  {!cardsCollapsed.bills && (
                    <CardContent className='space-y-4'>
                    <div className='grid grid-cols-2 gap-4'>
                      <div className='text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg'>
                        <div className='text-lg font-semibold text-blue-600'>
                          {forecastData?.recurrentBillsCount || 0}
                        </div>
                        <div className='text-sm text-blue-600'>{t('budgetRecurrentBills')}</div>
                      </div>
                      <div className='text-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg'>
                        <div className='text-lg font-semibold text-purple-600'>
                          {forecastData?.uniqueBillsCount || 0}
                        </div>
                        <div className='text-sm text-purple-600'>{t('budgetUniqueBills')}</div>
                      </div>
                    </div>

                    {/* Inflation Rate Controls */}
                    <div className='space-y-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg'>
                      <Label className='flex items-center gap-2 text-base font-semibold'>
                        <Percent className='w-4 h-4' />
                        {t('budgetInflationRateSettings')}
                      </Label>
                      
                      {/* Global vs Per-Category Toggle */}
                      <div className='flex items-center justify-between'>
                        <div className='space-y-0.5'>
                          <Label className='text-sm'>{t('budgetInflationRateMode')}</Label>
                          <p className='text-xs text-muted-foreground'>
                            {localSettings.useGlobalBillsInflation 
                              ? t('budgetApplySameRateToAllBills')
                              : t('budgetSetDifferentRatesPerCategory')
                            }
                          </p>
                        </div>
                        <div className='flex items-center space-x-2'>
                          <Label className='text-xs'>{t('budgetPerCategory')}</Label>
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
                          <Label className='text-xs'>{t('budgetGlobal')}</Label>
                        </div>
                      </div>

                      {/* Global Inflation Rate */}
                      {localSettings.useGlobalBillsInflation && (
                        <div className='space-y-2'>
                          <Label htmlFor="global-inflation" className='text-sm'>
                            {t('budgetGlobalBillsInflationRate')}
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
                            {t('budgetAppliedToAllBillCategories')}
                          </p>
                        </div>
                      )}

                      {/* Per-Category Inflation Rates */}
                      {!localSettings.useGlobalBillsInflation && (
                        <div className='space-y-3'>
                          <Label className='text-sm'>{t('budgetCategorySpecificInflationRates')}</Label>
                          <div className='grid grid-cols-1 gap-3'>
                            <div className='flex items-center gap-2'>
                              <div className='flex-1'>
                                <Label htmlFor="utilities-inflation" className='text-xs'>{t('budgetUtilities')}</Label>
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
                                <Label htmlFor="maintenance-inflation" className='text-xs'>{t('maintenance')}</Label>
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
                                <Label htmlFor="general-inflation" className='text-xs'>{t('budgetGeneral')}</Label>
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
                                <Label htmlFor="other-inflation" className='text-xs'>{t('other')}</Label>
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
                            {t('budgetSetDifferentInflationRates')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Unplanned Bills */}
                    <div className='space-y-3 p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg'>
                      <Label htmlFor="unplanned-bills" className='flex items-center gap-2 text-sm font-semibold text-orange-700 dark:text-orange-300'>
                        <CreditCard className='w-4 h-4' />
                        {t('budgetUnplannedBillsMonthly')}
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
                            onChange={(e) => {
                              const normalizedValue = normalizeMoney(e.target.value);
                              setLocalSettings(prev => ({
                                ...prev,
                                unplannedBillsAmount: parseFloat(normalizedValue) || 0,
                              }))
                            }}
                            className="pl-9"
                            placeholder="0.00"
                            data-testid="input-unplanned-bills"
                          />
                        </div>
                        <div className='space-y-1'>
                          <Label htmlFor="unplanned-bills-start-date" className='text-xs text-orange-700 dark:text-orange-300'>
                            {t('budgetUnplannedBillsStartDate')}
                          </Label>
                          <div className='flex gap-2'>
                            <div className='relative flex-1'>
                              <Calendar className='absolute left-3 top-2.5 h-4 w-4 text-muted-foreground' />
                              <Input
                                id="unplanned-bills-start-date"
                                type="date"
                                value={formatDateForInput(localSettings.unplannedBillsStartDate)}
                                onChange={(e) =>
                                  setLocalSettings(prev => ({
                                    ...prev,
                                    unplannedBillsStartDate: e.target.value,
                                  }))
                                }
                                className="pl-9"
                                data-testid="input-unplanned-bills-start-date"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const now = new Date();
                                const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                                const nextMonthStr = nextMonth.toISOString().split('T')[0];
                                setLocalSettings(prev => ({
                                  ...prev,
                                  unplannedBillsStartDate: nextMonthStr,
                                }));
                              }}
                              className='whitespace-nowrap'
                              data-testid="button-set-next-month"
                            >
                              {t('budgetNextMonth')}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className='space-y-1'>
                        <p className='text-xs text-orange-600 dark:text-orange-400'>
                          {t('budgetAdditionalBudgetUnexpected')}
                        </p>
                        
                        {/* Always show historical data */}
                        {localSettings.historicalUniqueBillsAmount !== undefined && localSettings.historicalUniqueBillsAmount > 0 ? (
                          <p className='text-sm font-medium text-blue-600 dark:text-blue-400'>
                            📊 {t('budgetHistoricalAverage')} ({localSettings.historicalUniqueBillsYearsAnalyzed} {t('years')}): ${localSettings.historicalUniqueBillsAmount.toFixed(2)}/{t('month')}
                          </p>
                        ) : (
                          <p className='text-sm font-medium text-muted-foreground'>
                            📊 {t('budgetHistoricalAverage')}: {t('budgetNoDataAvailable')}
                          </p>
                        )}
                        
                        {/* Show manual override status */}
                        {localSettings.unplannedBillsAmount > 0 && (
                          <p className='text-xs text-orange-700 dark:text-orange-300 font-medium'>
                            ✓ {t('budgetManualOverride')}: ${localSettings.unplannedBillsAmount.toFixed(2)}/{t('month')}
                          </p>
                        )}
                      </div>
                    </div>


                    {/* Summary */}
                    <div className='pt-2 border-t space-y-1'>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>{t('budgetMonthlyExpenses')}:</span>
                        <span className='font-medium'>${Number(summaryMetrics?.monthlySpending ?? 0).toLocaleString()}</span>
                      </div>
                      {localSettings.unplannedBillsAmount > 0 && (
                        <div className='flex justify-between text-sm'>
                          <span className='text-orange-600 dark:text-orange-400'>{t('budgetUnplannedBills')}:</span>
                          <span className='font-medium text-orange-600 dark:text-orange-400'>
                            ${localSettings.unplannedBillsAmount.toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className='flex justify-between text-sm font-semibold pt-1 border-t'>
                        <span>{t('budgetTotalMonthlyExpenses')}:</span>
                        <span>
                          ${Number(summaryMetrics?.monthlySpending ?? 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Save Bills Configuration Button */}
                    <div className='pt-4 border-t'>
                      <Button
                        onClick={() => saveBankAccountMutation.mutate()}
                        disabled={saveBankAccountMutation.isPending}
                        className='w-full'
                        data-testid="button-save-unplanned-bills"
                      >
                        {saveBankAccountMutation.isPending ? (
                          <>
                            <div className='animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2'></div>
                            {t('saving')}
                          </>
                        ) : (
                          <>
                            <CreditCard className='w-4 h-4 mr-2' />
                            {t('budgetSaveBillsConfiguration')}
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                  )}
                </Card>
                </div>


                {/* Capital Investment Scenarios */}
                <Card data-testid="card-capital-investment-scenarios">
                  <CardHeader 
                    className="cursor-pointer"
                    onClick={() => toggleCard('capitalInvestment')}
                  >
                    <CardTitle className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <Building2 className='w-5 h-5' />
                        {t('budgetCapitalInvestmentScenarios')}
                      </div>
                      {cardsCollapsed.capitalInvestment ? (
                        <ChevronDown className='w-5 h-5' />
                      ) : (
                        <ChevronUp className='w-5 h-5' />
                      )}
                    </CardTitle>
                  </CardHeader>
                  {!cardsCollapsed.capitalInvestment && (
                    <CardContent className='space-y-6'>
                    {/* Capital Investment Mode Selection */}
                    <div className='bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
                      <div className='flex flex-col space-y-3'>
                        <div className='flex items-center gap-2 mb-2'>
                          <Target className='w-4 h-4 text-blue-600 dark:text-blue-400' />
                          <span className='text-sm font-medium text-blue-700 dark:text-blue-300'>{t('budgetCapitalInvestmentStrategy')}</span>
                        </div>
                        <div className='grid grid-cols-1 lg:grid-cols-3 gap-3'>
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
                                onChange={(e) => setCapitalInvestmentMode(e.target.value as 'urgent' | 'suggested' | 'custom')}
                                className='text-blue-600 focus:ring-blue-500'
                                data-testid="radio-urgent-capital-mode"
                              />
                              <div className='flex-1'>
                                <div className='font-medium text-gray-900 dark:text-gray-100'>{t('budgetUrgentCapitalOnly')}</div>
                                <div className='text-sm text-gray-600 dark:text-gray-400'>{t('budgetUrgentCapitalOnlyDesc')}</div>
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
                                onChange={(e) => setCapitalInvestmentMode(e.target.value as 'urgent' | 'suggested' | 'custom')}
                                className='text-blue-600 focus:ring-blue-500'
                                data-testid="radio-suggested-capital-mode"
                              />
                              <div className='flex-1'>
                                <div className='font-medium text-gray-900 dark:text-gray-100'>{t('budgetSuggestedCapital')}</div>
                                <div className='text-sm text-gray-600 dark:text-gray-400'>{t('budgetSuggestedCapitalDesc')}</div>
                              </div>
                            </div>
                          </label>
                          
                          <label 
                            className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                              capitalInvestmentMode === 'custom' 
                                ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/30' 
                                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                            }`}
                            data-testid="label-custom-capital-mode"
                          >
                            <div className='flex items-center space-x-3'>
                              <input
                                type="radio"
                                name="capitalInvestmentMode"
                                value="custom"
                                checked={capitalInvestmentMode === 'custom'}
                                onChange={(e) => setCapitalInvestmentMode(e.target.value as 'urgent' | 'suggested' | 'custom')}
                                className='text-blue-600 focus:ring-blue-500'
                                data-testid="radio-custom-capital-mode"
                              />
                              <div className='flex-1'>
                                <div className='font-medium text-gray-900 dark:text-gray-100'>{t('budgetCustomMode')}</div>
                                <div className='text-sm text-gray-600 dark:text-gray-400'>{t('budgetCustomModeDesc')}</div>
                                <div className='text-sm font-medium text-blue-600 dark:text-blue-400 mt-1'>
                                  {t('budgetNoAutomaticCapitalInjections')}
                                </div>
                              </div>
                            </div>
                          </label>
                        </div>
                        <div className='text-xs text-blue-600 dark:text-blue-400 mt-2'>
                          💡 {t('budgetCapitalInvestmentStrategyHelp')}
                        </div>
                      </div>
                    </div>
                    {/* Investment Summary & Filters */}
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                      {/* Summary Cards */}
                      <div className='bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3'>
                        <div className='flex items-center gap-2 mb-2'>
                          <div className='w-3 h-3 bg-red-500 rounded-full'></div>
                          <span className='text-sm font-medium text-red-700 dark:text-red-300'>{t('budgetUrgent')}</span>
                        </div>
                        <div className='text-2xl font-bold text-red-900 dark:text-red-100' data-testid="text-urgent-amount">
                          ${investmentSummary.urgentAmount.toFixed(2)}
                        </div>
                        <div className='text-xs text-red-600 dark:text-red-400'>
                          {investmentSummary.urgentCount} {investmentSummary.urgentCount !== 1 ? t('investments') : t('investment')}
                        </div>
                      </div>
                      
                      <div className='bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3'>
                        <div className='flex items-center gap-2 mb-2'>
                          <div className='w-3 h-3 bg-yellow-500 rounded-full'></div>
                          <span className='text-sm font-medium text-yellow-700 dark:text-yellow-300'>{t('budgetSuggested')}</span>
                        </div>
                        <div className='text-2xl font-bold text-yellow-900 dark:text-yellow-100' data-testid="text-suggested-amount">
                          ${investmentSummary.suggestedAmount.toFixed(2)}
                        </div>
                        <div className='text-xs text-yellow-600 dark:text-yellow-400'>
                          {investmentSummary.suggestedCount} {investmentSummary.suggestedCount !== 1 ? t('investments') : t('investment')}
                        </div>
                      </div>
                      
                      <div className='bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3'>
                        <div className='flex items-center gap-2 mb-2'>
                          <div className='w-3 h-3 bg-green-500 rounded-full'></div>
                          <span className='text-sm font-medium text-green-700 dark:text-green-300'>{t('budgetNotUrgent')}</span>
                        </div>
                        <div className='text-2xl font-bold text-green-900 dark:text-green-100' data-testid="text-not-urgent-amount">
                          ${investmentSummary.notUrgentAmount.toFixed(2)}
                        </div>
                        <div className='text-xs text-green-600 dark:text-green-400'>
                          {investmentSummary.notUrgentCount} {investmentSummary.notUrgentCount !== 1 ? t('investments') : t('investment')}
                        </div>
                      </div>
                      
                      <div className='bg-gray-50 dark:bg-gray-950/20 border border-gray-200 dark:border-gray-800 rounded-lg p-3'>
                        <div className='flex items-center gap-2 mb-2'>
                          <Calculator className='w-4 h-4 text-gray-600 dark:text-gray-400' />
                          <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>{t('total')}</span>
                        </div>
                        <div className='text-2xl font-bold text-gray-900 dark:text-gray-100' data-testid="text-total-amount">
                          ${investmentSummary.totalAmount.toFixed(2)}
                        </div>
                        <div className='text-xs text-gray-600 dark:text-gray-400'>
                          {investmentSummary.count} {investmentSummary.count !== 1 ? t('investments') : t('investment')}
                        </div>
                      </div>
                    </div>

                    {/* Investment Controls */}
                    <div className='flex justify-end'>
                      {/* Add Investment Button */}
                      <Dialog open={addInvestmentDialogOpen} onOpenChange={setAddInvestmentDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" data-testid="button-add-investment">
                            <Plus className='w-4 h-4 mr-2' />
                            {t('budgetAddInvestment')}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t('budgetAddNewInvestment')}</DialogTitle>
                          </DialogHeader>
                          <div className='space-y-4'>
                            <div className='space-y-2'>
                              <Label htmlFor="investment-title">{t('budgetInvestmentTitle')} *</Label>
                              <Input
                                id="investment-title"
                                value={newInvestment.title}
                                onChange={(e) => setNewInvestment(prev => ({ ...prev, title: e.target.value }))}
                                placeholder={t('budgetInvestmentTitlePlaceholder')}
                                data-testid="input-investment-title"
                              />
                            </div>
                            
                            <div className='space-y-2'>
                              <Label htmlFor="investment-description">{t('description')}</Label>
                              <Input
                                id="investment-description"
                                value={newInvestment.description}
                                onChange={(e) => setNewInvestment(prev => ({ ...prev, description: e.target.value }))}
                                placeholder={t('budgetInvestmentDescriptionPlaceholder')}
                                data-testid="input-investment-description"
                              />
                            </div>
                            
                            <div className='grid grid-cols-2 gap-4'>
                              <div className='space-y-2'>
                                <Label htmlFor="investment-amount">{t('budgetInvestmentAmount')} *</Label>
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
                                <Label htmlFor="investment-date">{t('budgetTargetDate')} *</Label>
                                <Input
                                  id="investment-date"
                                  type="date"
                                  value={formatDateForInput(newInvestment.targetDate)}
                                  onChange={(e) => setNewInvestment(prev => ({ ...prev, targetDate: e.target.value }))}
                                  data-testid="input-investment-date"
                                />
                              </div>
                            </div>
                            
                            <div className='grid grid-cols-2 gap-4'>
                              <div className='space-y-2'>
                                <Label htmlFor="investment-urgency">{t('budgetUrgencyLevel')}</Label>
                                <Select 
                                  value={newInvestment.urgency} 
                                  onValueChange={(value) => setNewInvestment(prev => ({ ...prev, urgency: value as any }))}
                                >
                                  <SelectTrigger data-testid="select-investment-urgency">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="not_urgent">{t('budgetNotUrgent')}</SelectItem>
                                    <SelectItem value="suggested">{t('budgetSuggested')}</SelectItem>
                                    <SelectItem value="urgent">{t('budgetUrgent')}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            <div className='flex gap-2 pt-4'>
                              <Button onClick={addInvestment} className='flex-1' data-testid="button-save-investment">
                                {t('budgetAddInvestment')}
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={() => setAddInvestmentDialogOpen(false)}
                                data-testid="button-cancel-investment"
                              >
                                {t('cancel')}
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
                          return (
                            <div className='text-center py-8 text-muted-foreground' data-testid="text-no-investments">
                              <Building2 className='w-8 h-8 mx-auto mb-2 opacity-50' />
                              <p>{t('budgetNoInvestmentsMatch')}</p>
                              <p className='text-sm'>{t('budgetAddCustomInvestmentsHelp')}</p>
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
                                          {t('budgetAutoGenerated')}
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
                                      {targetDate.toLocaleDateString('en-CA', { timeZone: 'UTC' })}
                                    </span>
                                    <span className={`${config.text} opacity-75`}>
                                      <Building className='w-3 h-3 inline mr-1' />
                                      {investment.ownershipType === 'residences' ? 'For Residences' : 'For Owner'}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className='flex gap-1 ml-4'>
                                  {isAutoGenerated ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => confirmAutoGeneratedInvestment(investment.id)}
                                      className={`h-8 w-8 p-0 ${config.text} hover:bg-white/50 dark:hover:bg-black/50`}
                                      data-testid={`button-confirm-investment-${investment.id}`}
                                      title="Confirm and make permanent"
                                    >
                                      <FileText className='w-3 h-3' />
                                    </Button>
                                  ) : (
                                    <>
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
                                        <Trash2 className='w-3 h-3' />
                                      </Button>
                                    </>
                                  )}
                                </div>
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
                          <DialogTitle>{t('budgetEditInvestment')}</DialogTitle>
                        </DialogHeader>
                        {editingInvestment && (
                          <div className='space-y-4'>
                            <div className='space-y-2'>
                              <Label htmlFor="edit-investment-title">{t('budgetInvestmentTitle')} *</Label>
                              <Input
                                id="edit-investment-title"
                                value={editingInvestment.title}
                                onChange={(e) => setEditingInvestment(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                                data-testid="input-edit-investment-title"
                              />
                            </div>
                            
                            <div className='space-y-2'>
                              <Label htmlFor="edit-investment-description">{t('description')}</Label>
                              <Input
                                id="edit-investment-description"
                                value={editingInvestment.description || ''}
                                onChange={(e) => setEditingInvestment(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                                data-testid="input-edit-investment-description"
                              />
                            </div>
                            
                            <div className='grid grid-cols-2 gap-4'>
                              <div className='space-y-2'>
                                <Label htmlFor="edit-investment-amount">{t('budgetInvestmentAmount')} *</Label>
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
                                <Label htmlFor="edit-investment-date">{t('budgetTargetDate')} *</Label>
                                <Input
                                  id="edit-investment-date"
                                  type="date"
                                  value={formatDateForInput(editingInvestment.targetDate)}
                                  onChange={(e) => setEditingInvestment(prev => prev ? ({ ...prev, targetDate: e.target.value }) : null)}
                                  data-testid="input-edit-investment-date"
                                />
                              </div>
                            </div>
                            
                            <div className='grid grid-cols-2 gap-4'>
                              <div className='space-y-2'>
                                <Label htmlFor="edit-investment-urgency">{t('budgetUrgencyLevel')}</Label>
                                <Select 
                                  value={editingInvestment.urgency} 
                                  onValueChange={(value) => setEditingInvestment(prev => prev ? ({ ...prev, urgency: value as any }) : null)}
                                >
                                  <SelectTrigger data-testid="select-edit-investment-urgency">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="not_urgent">{t('budgetNotUrgent')}</SelectItem>
                                    <SelectItem value="suggested">{t('budgetSuggested')}</SelectItem>
                                    <SelectItem value="urgent">{t('budgetUrgent')}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            <div className='flex gap-2 pt-4'>
                              <Button onClick={saveEditInvestment} className='flex-1' data-testid="button-save-edit-investment">
                                {t('budgetSaveChanges')}
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={() => setEditInvestmentDialogOpen(false)}
                                data-testid="button-cancel-edit-investment"
                              >
                                {t('cancel')}
                              </Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                  )}
                </Card>
              </div>
            </>
          )}
        </div>
      </div>

      <BudgetProjectDialogs
        addQuickProjectDialogOpen={addQuickProjectDialogOpen}
        setAddQuickProjectDialogOpen={setAddQuickProjectDialogOpen}
        newQuickProject={newQuickProject}
        setNewQuickProject={setNewQuickProject}
        createQuickProjectMutation={createQuickProjectMutation}
        editProjectDialogOpen={editProjectDialogOpen}
        setEditProjectDialogOpen={setEditProjectDialogOpen}
        editingProject={editingProject}
        setEditingProject={setEditingProject}
        updateProjectMutation={updateProjectMutation}
        deleteQuickProjectMutation={deleteQuickProjectMutation}
        selectedProjectForWorkflow={selectedProjectForWorkflow}
        setSelectedProjectForWorkflow={setSelectedProjectForWorkflow}
        showProjectWorkflowModal={showProjectWorkflowModal}
        setShowProjectWorkflowModal={setShowProjectWorkflowModal}
        buildingId={buildingId}
        organizationId={organizationId}
        onProjectWorkflowClose={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'projects'] });
        }}
        onProjectUpdate={(updatedProject) => {
          queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings', buildingId, 'projects'] });
        }}
      />

    </div>
  );
}

// Wrap with hierarchical selection HOC using 2-level hierarchy (organization → building)
const Budget = withHierarchicalSelection(BudgetInner, {
  hierarchy: ['organization', 'building']
});

export default Budget;