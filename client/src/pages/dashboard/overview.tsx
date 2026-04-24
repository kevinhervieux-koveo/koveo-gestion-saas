// BUILD_TIMESTAMP: 2025-12-24T03:08:00Z - Force Vite rebuild v2
import { useState, useMemo, useEffect, useRef } from 'react';
import { logDebug, logError } from '@/lib/logger';
import { loadPdfLibs } from '@/lib/pdf-export';
import { isOverduePayment } from '@/utils/bill-helpers';
import { Header } from '@/components/layout/header';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useQueries, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useCurrentFinancialYear } from '@/hooks/use-current-financial-year';
import { getFinancialYearRange } from '@/utils/financial-year';
import {
  Building2,
  LineChart,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Eye,
  EyeOff,
  Receipt,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  AlertCircle,
  List,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { GanttChart } from '@/components/GanttChart';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import {
  LineChart as RechartsLineChart,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  CartesianGrid as RechartsCartesianGrid,
  ReferenceLine as RechartsReferenceLine,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { renderDualLine } from '@/components/common/DualLineChart';
import { budgetColors, buildChartConfig, currencyFormatter } from '@/lib/chart-colors';
import { buildForecastRequestBody, deriveStartMonthFromFiscalYearStart } from '@/lib/forecast-request';
import { OverviewProjectCard } from './components/OverviewProjectCard';

function getProjectFiscalYear(
  project: { financialYear?: number | null; plannedStartDate?: string | null },
  financialYearStart?: string | null
): string {
  if (project.financialYear) return String(project.financialYear);
  if (!project.plannedStartDate) return 'N/A';
  const d = new Date(project.plannedStartDate);
  if (isNaN(d.getTime())) return 'N/A';
  const calendarYear = d.getUTCFullYear();
  const calendarMonth = d.getUTCMonth() + 1;
  let fyStartMonth = 1;
  if (financialYearStart) {
    const m = financialYearStart.match(/^\d{4}-(\d{2})-\d{2}/);
    if (m) {
      fyStartMonth = parseInt(m[1], 10);
    } else {
      const parsed = new Date(financialYearStart);
      if (!isNaN(parsed.getTime())) fyStartMonth = parsed.getUTCMonth() + 1;
    }
  }
  return String(calendarMonth < fyStartMonth ? calendarYear - 1 : calendarYear);
}

interface Building {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  financialYearStart?: string | null;
}

interface ForecastData {
  year: number;
  month: number;
  period?: string;
  revenue: number;
  spending: number;
  netCashFlow: number;
  balance: number;
  capitalInvestment: number;
  status: 'red' | 'yellow' | 'green';
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
  periodLength: number;
  startMonth?: number;
  startYear?: number;
  dataVisibility: {
    revenue: boolean;
    spending: boolean;
    balanceStart: boolean;
    balanceEnd: boolean;
    netCashFlow: boolean;
    capitalInvestments: boolean;
    minimumRequirement: boolean;
  };
}

interface Project {
  id: string;
  title: string;
  totalBudget: number;
  actualCost: number;
  financialYear: number;
  status: string;
  type: string;
  origin: string;
  isQuickProject: boolean;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  estimatedCost?: number;
  buildingId?: string;
  buildingName?: string;
  includeInBudget?: boolean;
  description?: string;
}

interface PunctualRevenueGrowth {
  id: string;
  year: number;
  month: number;
  percentage: number;
  inflationIncluded: boolean;
}

interface CustomRevenueLine {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  endDate?: string;
  inflationRate?: number;
}

interface BankAccountConfig {
  bankAccountStartAmount: number;
  bankAccountMinimums: number;
  generalInflationRate: number;
  revenueInflationRate: number;
  financialYearStart: string;
  earliestBillDate: string | null;
  earliestFinancialYear: number | null;
  // Extended configuration fields (to match budget page)
  emergencyFundMinimum?: number;
  operatingCashMinimum?: number;
  revenueGrowthRate?: number;
  costInflationRate?: number;
  utilityInflationRate?: number;
  maintenanceInflationRate?: number;
  specialInvestmentBudget?: number;
  investmentHorizonYears?: number;
  capitalProjectReserve?: number;
  // Bills configuration
  useGlobalBillsInflation?: boolean;
  globalBillsInflationRate?: number;
  unplannedBillsAmount?: number;
  unplannedBillsStartDate?: string;
  categoryInflationRates?: {
    utilities?: number;
    maintenance?: number;
    general?: number;
    other?: number;
  };
  // Custom bank fields
  customBankFields?: { [fieldName: string]: number };
  // Custom revenue lines
  customRevenueLines?: CustomRevenueLine[];
  // Punctual revenue growth entries
  punctualRevenueGrowth?: PunctualRevenueGrowth[];
}

interface BillPaymentSummary {
  id: string;
  title: string;
  category: string;
  vendor: string | null;
  totalAmount: string;
  status: string;
  paymentId: string;
  paymentAmount: string;
  paymentStatus: string;
  scheduledDate: string;
  paidDate: string | null;
  billNumber?: string;
  vendorInvoiceNumber?: string | null;
  issueDate?: string | null;
  description?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  originalFileName?: string | null;
  isAutoGenerated?: boolean;
  autoGeneratedLabel?: string | null;
}

interface MonthlyBillsSummary {
  lastMonth: {
    bills: BillPaymentSummary[];
    total: number;
    paidTotal: number;
    count: number;
  };
  nextMonth: {
    bills: BillPaymentSummary[];
    total: number;
    paidTotal: number;
    count: number;
  };
}

export default function FinancialOverview() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const overviewChartRef = useRef<HTMLDivElement>(null);

  const handleDownloadChartPDF = async () => {
    if (!overviewChartRef.current) return;
    try {
      const { jsPDF, html2canvas } = await loadPdfLibs();
      const canvas = await html2canvas(overviewChartRef.current, {
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

  // State management
  const [filters, setFilters] = useState<BudgetFilters>({
    viewType: 'month',
    periodLength: 12, // 12 months default
    startMonth: 1,
    startYear: new Date().getFullYear(),
    dataVisibility: {
      revenue: true,
      spending: true,
      balanceStart: false,
      balanceEnd: true,
      netCashFlow: true,
      capitalInvestments: true,
      minimumRequirement: true,
    },
  });
  const [projectCollapsed, setProjectCollapsed] = useState(false);
  const [projectViewMode, setProjectViewMode] = useState<'list' | 'gantt'>(() => {
    if (typeof window === 'undefined') return 'list';
    const saved = window.sessionStorage.getItem('overview.projectViewMode');
    return saved === 'gantt' ? 'gantt' : 'list';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('overview.projectViewMode', projectViewMode);
    }
  }, [projectViewMode]);
  const [projectStates, setProjectStates] = useState<Map<string, boolean>>(new Map());
  // Per-project fiscal-year offsets for previewing project period shifts on
  // the overview page. Until the user clicks Confirm the change is local
  // only; Confirm persists the new financialYear via the maintenance API.
  const [projectYearOffsets, setProjectYearOffsets] = useState<Map<string, number>>(new Map());

  // Mutation that persists a project's shifted financial year so the change
  // survives a page refresh (mirrors `confirmProjectYearMutation` on the
  // manager budget page).
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
      setProjectYearOffsets(prev => {
        if (!prev.has(id)) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['/api/maintenance/buildings'] });
      // The overview chart's `/api/budgets/forecast` query is keyed off the
      // project list (via `projectQueries.map(q => q.dataUpdatedAt)`), but
      // changing a project's `financialYear` also reshapes the server-side
      // forecast even when the project list is otherwise identical. Force
      // the chart to refetch immediately so the user sees the new period
      // without having to touch the filters.
      queryClient.invalidateQueries({ queryKey: ['/api/budgets/forecast'] });
      toast({
        title: language === 'fr' ? 'Période mise à jour' : 'Period updated',
      });
    },
    onError: (error: any) => {
      toast({
        title: language === 'fr' ? 'Échec de la mise à jour de la période' : 'Failed to update period',
        description: error?.message,
        variant: 'destructive',
      });
    },
  });
  const [selectedBill, setSelectedBill] = useState<BillPaymentSummary | null>(null);
  
  // Bills month/year filter state (defaults to current month)
  const [billsFilterMonth, setBillsFilterMonth] = useState<number>(new Date().getMonth() + 1);
  const [billsFilterYear, setBillsFilterYear] = useState<number>(new Date().getFullYear());
  const [billsYearInitialized, setBillsYearInitialized] = useState<boolean>(false);

  // Fiscal year filter state
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [startingFiscalYear, setStartingFiscalYear] = useState<number>(new Date().getFullYear());
  const [futureProjection, setFutureProjection] = useState<string>('12months');
  
  // Track whether filters have been initialized from bankAccountConfig
  // This prevents the forecast query from running with stale default values
  const [filtersInitialized, setFiltersInitialized] = useState<boolean>(false);
  const filtersInitializedForBuildingRef = useRef<string | null>(null);
  

  // Fetch user's buildings
  const { data: buildings, isLoading: buildingsLoading } = useQuery<Building[]>({
    queryKey: ['/api/users/me/buildings'],
    enabled: !!user,
  });

  // Set default building when buildings load
  useEffect(() => {
    if (buildings && buildings.length > 0 && !selectedBuildingId) {
      setSelectedBuildingId(buildings[0].id);
    }
  }, [buildings, selectedBuildingId]);

  // Reset filtersInitialized when building changes to prevent stale queries
  useEffect(() => {
    if (selectedBuildingId && filtersInitializedForBuildingRef.current !== selectedBuildingId) {
      setFiltersInitialized(false);
    }
  }, [selectedBuildingId]);


  // Fetch bank account configuration for selected building
  const { data: bankAccountConfig, isLoading: bankAccountLoading, error: bankAccountError, isError: bankAccountIsError } = useQuery<BankAccountConfig>({
    queryKey: ['/api/budgets', selectedBuildingId, 'bank-account'],
    queryFn: async () => {
      try {
        const response = await apiRequest(
          'GET',
          `/api/budgets/${selectedBuildingId}/bank-account`
        );
        const data = await response.json();
        logDebug('[FinancialOverview] Bank account config loaded', {
          buildingId: selectedBuildingId,
          hasConfig: !!data,
        });
        return data as BankAccountConfig;
      } catch (error: any) {
        logError('[FinancialOverview] Bank account config error:', {
          message: error?.message,
          selectedBuildingId,
        });
        throw error;
      }
    },
    enabled: !!selectedBuildingId && !!user,
    retry: (failureCount, error: any) => {
      // Retry on auth errors up to 3 times (session might be initializing)
      if (error?.message?.includes('401') && failureCount < 3) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // Calculate month ranges for bills summary based on filter selection
  const monthRanges = useMemo(() => {
    // Create date from selected filter (use the selected month as "current")
    const selectedDate = new Date(billsFilterYear, billsFilterMonth - 1, 1);
    const previousMonth = subMonths(selectedDate, 1);
    
    return {
      // API params: "lastMonth" = month before selected, "nextMonth" = the selected month itself
      lastMonthStart: format(startOfMonth(previousMonth), 'yyyy-MM-dd'),
      lastMonthEnd: format(endOfMonth(previousMonth), 'yyyy-MM-dd'),
      nextMonthStart: format(startOfMonth(selectedDate), 'yyyy-MM-dd'),
      nextMonthEnd: format(endOfMonth(selectedDate), 'yyyy-MM-dd'),
      // UI labels
      previousMonthLabel: format(previousMonth, 'MMMM yyyy'),
      selectedMonthLabel: format(selectedDate, 'MMMM yyyy'),
    };
  }, [billsFilterMonth, billsFilterYear]);

  // Fetch available years for bills filter
  const { data: availableYears } = useQuery<{ years: number[] }>({
    queryKey: ['/api/buildings', selectedBuildingId, 'bills/available-years'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/buildings/${selectedBuildingId}/bills/available-years`
      );
      return response.json();
    },
    enabled: !!selectedBuildingId && !!user,
  });

  // Reset billsYearInitialized when building changes
  useEffect(() => {
    setBillsYearInitialized(false);
  }, [selectedBuildingId]);

  // Initialize billsFilterYear to current year if it's in the available years, otherwise use the latest year
  useEffect(() => {
    if (availableYears?.years && availableYears.years.length > 0 && !billsYearInitialized) {
      const currentYear = new Date().getFullYear();
      if (availableYears.years.includes(currentYear)) {
        setBillsFilterYear(currentYear);
      } else {
        // Use the latest year available
        setBillsFilterYear(Math.max(...availableYears.years));
      }
      setBillsYearInitialized(true);
    }
  }, [availableYears, billsYearInitialized]);

  // Fetch monthly bills summary for selected building
  const { data: billsSummary, isLoading: billsSummaryLoading } = useQuery<MonthlyBillsSummary>({
    queryKey: ['/api/buildings', selectedBuildingId, 'bills/monthly-summary', monthRanges],
    queryFn: async () => {
      const params = new URLSearchParams({
        lastMonthStart: monthRanges.lastMonthStart,
        lastMonthEnd: monthRanges.lastMonthEnd,
        nextMonthStart: monthRanges.nextMonthStart,
        nextMonthEnd: monthRanges.nextMonthEnd,
      });
      const response = await apiRequest(
        'GET',
        `/api/buildings/${selectedBuildingId}/bills/monthly-summary?${params.toString()}`
      );
      return response.json();
    },
    enabled: !!selectedBuildingId && !!user,
  });

  // Get current fiscal year
  const currentFiscalYear = new Date().getFullYear();

  // Calculate available fiscal years dynamically.
  // The chart cannot show any period before the bank account effective start
  // anchor: bankAccountStartDate's year, or the current calendar year when no
  // bank account start date is set.
  const availableFiscalYears = useMemo(() => {
    const years = [];
    const anchorYear = bankAccountConfig?.bankAccountStartDate
      ? new Date(bankAccountConfig.bankAccountStartDate).getFullYear()
      : currentFiscalYear;
    const earliest = bankAccountConfig?.earliestFinancialYear ?? (currentFiscalYear - 5);
    // Clamp earliest by the anchor (never go before anchor); the anchor itself
    // may be in the future for newly-onboarded buildings, in which case it
    // becomes the only selectable starting year up to the forecast horizon.
    const minYear = Math.max(anchorYear, earliest);
    const maxYear = currentFiscalYear + 25; // 25-year forecast horizon

    for (let year = minYear; year <= maxYear; year++) {
      years.push(year);
    }
    return years;
  }, [currentFiscalYear, bankAccountConfig?.earliestFinancialYear, bankAccountConfig?.bankAccountStartDate]);

  // Fetch projects for all buildings using useQueries (must be before forecast query which depends on it)
  const projectQueries = useQueries({
    queries: (buildings || []).map(building => ({
      queryKey: ['/api/maintenance/buildings', building.id, 'projects'],
      queryFn: async () => {
        const response = await apiRequest(
          'GET',
          `/api/maintenance/buildings/${building.id}/projects`
        );
        // Parse the JSON response
        const data = await response.json();
        return data;
      },
      enabled: !!buildings && buildings.length > 0,
    })),
  });

  // Fetch forecast for selected building only (will be refetched when projectStates or bankAccountConfig changes)
  // Using custom mode scenario to match /manager/budget custom mode
  const { data: forecastData, isLoading: forecastLoading, error: forecastError, refetch: refetchForecast } = useQuery({
    queryKey: ['/api/budgets/forecast', selectedBuildingId, filters.viewType, filters.periodLength, filters.startYear, filters.startMonth, bankAccountConfig?.financialYearStart, Array.from(projectStates.entries()), bankAccountConfig, 'custom', projectQueries.map(q => q.dataUpdatedAt)],
    queryFn: async () => {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      // Use the user-selected startYear from filters; derive startMonth
      // from bankAccountConfig.financialYearStart. The Overview page
      // intentionally anchors its forecast to the fiscal year (unlike
      // the Budget page, which lets the user pick a start month
      // manually), so we resolve startMonth here BEFORE handing the
      // request off to the shared builder.
      const derivedFiscalMonth = deriveStartMonthFromFiscalYearStart(
        bankAccountConfig?.financialYearStart
      );
      const effectiveStartMonth = derivedFiscalMonth ?? filters.startMonth;
      const effectiveStartYear = filters.startYear;

      // Get included projects for ONLY the selected building (not all buildings)
      // Find the selected building's index in the buildings array
      const buildingIndex = buildings?.findIndex(b => b.id === selectedBuildingId) ?? -1;
      const buildingProjectData = buildingIndex >= 0 
        ? projectQueries[buildingIndex]?.data as unknown as { success: boolean; data: any[] } | undefined
        : undefined;
      
      // Extract project IDs that belong to this building and are included in projectStates
      const selectedBuildingProjectIds = (buildingProjectData?.data || [])
        .filter(project => projectStates.get(project.id) ?? true)
        .map(project => project.id);

      const forecastParams = buildForecastRequestBody({
        bankAccountConfig: bankAccountConfig ?? {},
        capitalInvestmentMode: 'custom',
        filters: {
          viewType: filters.viewType,
          periodLength: filters.periodLength,
          startMonth: effectiveStartMonth || currentMonth,
          startYear: effectiveStartYear || currentYear,
        },
        projectIds: selectedBuildingProjectIds,
        customRevenueLines: bankAccountConfig?.customRevenueLines || [],
        punctualRevenueGrowth: bankAccountConfig?.punctualRevenueGrowth || [],
      });

      const response = await apiRequest(
        'POST',
        `/api/budgets/${selectedBuildingId}/forecast`,
        forecastParams
      );

      // Parse the JSON response
      const data = await response.json();

      logDebug('[FinancialOverview] Forecast loaded', {
        buildingId: selectedBuildingId,
        hasForecast: !!(data as any)?.forecast,
        forecastLength: (data as any)?.forecast?.length,
      });

      return data as BudgetForecastResponse;
    },
    enabled: !!selectedBuildingId && !!bankAccountConfig && filtersInitialized,
  });

  // Initialize project states when projects are first loaded
  useEffect(() => {
    if (!buildings) return;
    
    // Check if all project queries have loaded
    const allLoaded = projectQueries.length > 0 && projectQueries.every(q => !q.isLoading && q.data);
    if (!allLoaded) return;
    
    const newStates = new Map(projectStates);
    let hasChanges = false;
    
    buildings.forEach((building, index) => {
      const projectData = projectQueries[index]?.data as unknown as { success: boolean; data: any[] } | undefined;
      if (projectData?.data) {
        projectData.data.forEach(project => {
          // Only initialize if not already in the map
          if (!newStates.has(project.id)) {
            newStates.set(project.id, true);
            hasChanges = true;
          }
        });
      }
    });
    
    if (hasChanges) {
      setProjectStates(newStates);
    }
  }, [buildings, projectQueries]);

  // Get selected building info and combine with forecast data
  const selectedBuilding = useMemo(() => {
    return buildings?.find(b => b.id === selectedBuildingId);
  }, [buildings, selectedBuildingId]);

  // Use the current financial year hook for automatic tracking
  const { currentFinancialYear } = useCurrentFinancialYear(
    selectedBuilding?.financialYearStart || null,
    !!selectedBuildingId
  );

  // Track the last building ID for which we initialized the fiscal year
  // This allows resetting when building changes but preserves user selection otherwise
  const lastInitializedBuildingIdRef = useRef<string | null>(null);

  // Consolidated fiscal year and filter initialization
  // This single useEffect handles both startingFiscalYear and filters to avoid race conditions
  useEffect(() => {
    // Skip if we don't have bankAccountConfig yet
    if (!bankAccountConfig?.financialYearStart || bankAccountLoading) {
      return;
    }
    
    // Parse the fiscal year start date to get the month
    const dateMatch = bankAccountConfig.financialYearStart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
      return;
    }
    
    const fiscalMonth = parseInt(dateMatch[2], 10);
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    // Calculate which fiscal year we're currently in
    // If we're before the fiscal month, the fiscal year started last calendar year
    let calculatedStartYear = currentYear;
    if (currentMonth < fiscalMonth) {
      calculatedStartYear = currentYear - 1;
    }

    // Clamp to bank account effective start anchor: never start the chart
    // before the bank account start date (or current calendar year by default).
    const anchorYear = bankAccountConfig?.bankAccountStartDate
      ? new Date(bankAccountConfig.bankAccountStartDate).getFullYear()
      : currentYear;
    if (calculatedStartYear < anchorYear) {
      calculatedStartYear = anchorYear;
    }

    // Check if this is a new building or first load - update startingFiscalYear state
    const isNewBuilding = lastInitializedBuildingIdRef.current !== selectedBuildingId;
    if (isNewBuilding && selectedBuildingId) {
      setStartingFiscalYear(calculatedStartYear);
      lastInitializedBuildingIdRef.current = selectedBuildingId;
      logDebug('[FinancialOverview] Starting fiscal year initialized', {
        buildingId: selectedBuildingId,
        startYear: calculatedStartYear,
        fiscalMonth,
      });
    }
    
    // Use the calculated value (for new buildings) or existing state (for user changes)
    const effectiveStartYear = isNewBuilding ? calculatedStartYear : startingFiscalYear;
    
    // Determine view settings based on futureProjection
    let viewType: 'month' | 'year' = 'year';
    let periodLength = 5;
    
    switch (futureProjection) {
      case '12months':
        viewType = 'month';
        periodLength = 12;
        break;
      case '24months':
        viewType = 'month';
        periodLength = 24;
        break;
      case '3years':
        viewType = 'year';
        periodLength = 3;
        break;
      case '5years':
        viewType = 'year';
        periodLength = 5;
        break;
      case '10years':
        viewType = 'year';
        periodLength = 10;
        break;
      case '15years':
        viewType = 'year';
        periodLength = 15;
        break;
      case '20years':
        viewType = 'year';
        periodLength = 20;
        break;
      case '25years':
        viewType = 'year';
        periodLength = 25;
        break;
      default:
        viewType = 'year';
        periodLength = 5;
    }

    setFilters(prev => ({
      ...prev,
      viewType,
      startYear: effectiveStartYear,
      startMonth: fiscalMonth,
      periodLength,
    }));
    
    // Mark filters as initialized for this building - this allows the query to run
    // We use both state (to trigger re-render) and ref (to track which building)
    if (filtersInitializedForBuildingRef.current !== selectedBuildingId) {
      filtersInitializedForBuildingRef.current = selectedBuildingId;
      setFiltersInitialized(true);
    }
  }, [selectedBuildingId, bankAccountConfig?.financialYearStart, bankAccountLoading, futureProjection, startingFiscalYear]);

  const buildingForecast = useMemo(() => {
    if (!selectedBuilding) return null;
    return {
      buildingId: selectedBuilding.id,
      buildingName: selectedBuilding.name,
      data: forecastData,
      isLoading: forecastLoading,
    };
  }, [selectedBuilding, forecastData, forecastLoading]);

  // Aggregate all projects from all buildings
  const allProjects = useMemo(() => {
    if (!buildings) {
      return [];
    }

    const projects: Project[] = [];
    buildings.forEach((building, index) => {
      const projectData = projectQueries[index]?.data as unknown as { success: boolean; data: any[] } | undefined;
      if (projectData?.data) {
        const buildingProjectsWithMeta = projectData.data.map(project => ({
          ...project,
          buildingId: building.id,
          buildingName: building.name,
          includeInBudget: projectStates.get(project.id) ?? true,
        }));
        projects.push(...buildingProjectsWithMeta);
      }
    });

    logDebug('[FinancialOverview] Aggregated projects across buildings', {
      buildingsCount: buildings.length,
      totalProjects: projects.length,
    });
    return projects;
  }, [buildings, projectQueries, projectStates]);

  // Filter projects for the selected building only
  const selectedBuildingProjects = useMemo(() => {
    if (!selectedBuildingId) return allProjects;
    return allProjects.filter(project => project.buildingId === selectedBuildingId);
  }, [allProjects, selectedBuildingId]);

  // Check if any projects are loading
  const projectsLoading = projectQueries.some(query => query.isLoading);

  // Check if user can see financial cards.
  // Tenants and residents (and their demo equivalents) must not see any
  // building-level financial information including bill summaries.
  const canSeeFinancialCards = useMemo(() => {
    if (!user) return false;
    const hiddenRoles = ['tenant', 'demo_tenant', 'resident', 'demo_resident'];
    return !hiddenRoles.includes(user.role as string);
  }, [user]);

  // Toggle data series visibility
  const toggleDataVisibility = (key: keyof typeof filters.dataVisibility) => {
    setFilters(prev => ({
      ...prev,
      dataVisibility: {
        ...prev.dataVisibility,
        [key]: !prev.dataVisibility[key],
      },
    }));
  };

  // Prepare chart data for a specific building forecast
  // Uses same format as budget page for consistency
  const prepareChartData = (forecastData?: any) => {
    if (!forecastData || !forecastData.forecast) return [];

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    return forecastData.forecast.map((item: any, index: number) => {
      // Use YYYY-MM format to match budget page
      const isFuture = item.year > currentYear || (item.year === currentYear && item.month >= currentMonth);
      
      const previousItem = index > 0 ? forecastData.forecast[index - 1] : null;
      // Prefer the per-period startingBalance returned by the backend so the
      // tooltip shows the actual carried-forward balance the backend used for
      // this period (including the very first visible row). Fall back to the
      // previous row's end balance and finally to the top-level configuration.
      const balanceStart =
        item.startingBalance !== undefined && item.startingBalance !== null
          ? item.startingBalance
          : previousItem
            ? previousItem.balance
            : forecastData.startingBalance;
      
      return {
        period: `${item.year}-${item.month.toString().padStart(2, '0')}`,
        month: item.month,
        year: item.year,
        revenue: item.revenue,
        spending: item.spending,
        balanceStart: balanceStart,
        balanceEnd: item.balance,
        balance: item.balance,
        netCashFlow: item.netCashFlow,
        capitalInvestments: item.capitalInvestment,
        isFuture,
      };
    });
  };

  // Custom tooltip to show full date
  const overviewChartConfig = buildChartConfig({
    balanceStart: { label: t('budgetBalanceStartOfPeriod'), color: budgetColors.balanceStart },
    balanceEnd: { label: t('budgetBalanceEndOfPeriod'), color: budgetColors.balanceEnd },
    revenue: { label: t('budgetRevenue'), color: budgetColors.revenue },
    spending: { label: t('budgetSpending'), color: budgetColors.spending },
    netCashFlow: { label: t('budgetNetCashFlow'), color: budgetColors.netCashFlow },
    capitalInvestments: { label: t('investments'), color: budgetColors.capitalInvestments },
  });

  const investmentsLabel = t('investments');
  const overviewTooltipFormatter = (value: any, name: any, item: any, _index: number) => {
    // Investments are already baked into Spending on the backend, so present
    // them as a sub-row of Spending (indented, with an "of which" prefix) to
    // make it clear they are not an additional deduction. Detect both past
    // and future series — `renderDualLine` appends " - Future" to the future
    // series name, and we also fall back to the dataKey for robustness.
    const dataKey = item?.dataKey ?? '';
    const baseName = typeof name === 'string' ? name.replace(/ - Future$/, '') : name;
    const isInvestments = baseName === investmentsLabel || dataKey === 'capitalInvestments';
    const displayName = baseName;
    return (
      <div
        className={`flex flex-1 justify-between items-center leading-none ${isInvestments ? 'pl-4' : ''}`}
      >
        <span className="text-muted-foreground">
          {isInvestments ? `↳ ${t('ofWhich')} ${displayName}` : displayName}
        </span>
        <span className="font-mono font-medium tabular-nums text-foreground ml-2">{currencyFormatter(Number(value))}</span>
      </div>
    );
  };

  // Get fiscal year start month from selected building
  const fiscalStartMonth = useMemo(() => {
    if (!selectedBuilding || !selectedBuilding.financialYearStart) {
      return 1; // Default to January
    }
    const fiscalDate = new Date(selectedBuilding.financialYearStart);
    return fiscalDate.getMonth() + 1; // Convert 0-11 to 1-12
  }, [selectedBuilding]);


  if (buildingsLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={t('financialOverview')} subtitle={t('loading')} />
        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={`skel-card-${i}`}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!buildings || buildings.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={t('financialOverview')} subtitle={t('noBuildingsAssigned')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-muted-foreground">{t('noBuildingsFound')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title={t('financialOverview')}
        subtitle={t('buildingFinancialOverview')}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Fiscal Year Filters - Hidden for tenant role */}
          {canSeeFinancialCards && (
          <Card data-testid="card-fiscal-filters">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="w-5 h-5" />
                {t('fiscalYearFilters')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Building Filter */}
                <div className="space-y-2">
                  <Label htmlFor="building-select">{t('building')}</Label>
                  <Select
                    value={selectedBuildingId}
                    onValueChange={setSelectedBuildingId}
                    data-testid="select-building"
                  >
                    <SelectTrigger id="building-select">
                      <SelectValue placeholder={t('selectBuilding')} />
                    </SelectTrigger>
                    <SelectContent>
                      {buildings?.map(building => (
                        <SelectItem key={building.id} value={building.id} data-testid={`option-building-${building.id}`}>
                          {building.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Starting Fiscal Year */}
                <div className="space-y-2">
                  <Label htmlFor="starting-year">{t('startingFiscalYear')}</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Select
                            value={startingFiscalYear.toString()}
                            onValueChange={(value) => setStartingFiscalYear(parseInt(value))}
                            data-testid="select-starting-year"
                          >
                            <SelectTrigger id="starting-year" aria-describedby="starting-year-help">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableFiscalYears.map(year => (
                                <SelectItem key={year} value={year.toString()} data-testid={`option-starting-year-${year}`}>
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        id="starting-year-help"
                        className="max-w-xs text-xs"
                        data-testid="tooltip-starting-year-help"
                      >
                        {t('chartYearPickerHelp').replace(
                          '{year}',
                          String(availableFiscalYears[0] ?? new Date().getFullYear()),
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Future Projections */}
                <div className="space-y-2">
                  <Label htmlFor="future-projection">{t('futureProjections')}</Label>
                  <Select
                    value={futureProjection}
                    onValueChange={setFutureProjection}
                    data-testid="select-future-projection"
                  >
                    <SelectTrigger id="future-projection">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12months" data-testid="option-future-12months">12 {t('months')}</SelectItem>
                      <SelectItem value="24months" data-testid="option-future-24months">24 {t('months')}</SelectItem>
                      <SelectItem value="3years" data-testid="option-future-3years">3 {t('years')}</SelectItem>
                      <SelectItem value="5years" data-testid="option-future-5years">5 {t('years')}</SelectItem>
                      <SelectItem value="10years" data-testid="option-future-10years">10 {t('years')}</SelectItem>
                      <SelectItem value="15years" data-testid="option-future-15years">15 {t('years')}</SelectItem>
                      <SelectItem value="20years" data-testid="option-future-20years">20 {t('years')}</SelectItem>
                      <SelectItem value="25years" data-testid="option-future-25years">25 {t('years')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Monthly Bills Summary Card - Hidden for tenant role */}
          {canSeeFinancialCards && selectedBuildingId && (
            <Card data-testid="card-monthly-bills-summary">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="w-5 h-5" />
                      {t('monthlyBillsSummary') || 'Monthly Bills Summary'}
                    </CardTitle>
                    <div className="text-sm text-muted-foreground mt-1">
                      {t('billsForSelectedBuilding') || 'Bills with payments scheduled for the selected building'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={billsFilterMonth.toString()}
                      onValueChange={(value) => setBillsFilterMonth(parseInt(value))}
                      data-testid="select-bills-month"
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">{t('january') || 'January'}</SelectItem>
                        <SelectItem value="2">{t('february') || 'February'}</SelectItem>
                        <SelectItem value="3">{t('march') || 'March'}</SelectItem>
                        <SelectItem value="4">{t('april') || 'April'}</SelectItem>
                        <SelectItem value="5">{t('may') || 'May'}</SelectItem>
                        <SelectItem value="6">{t('june') || 'June'}</SelectItem>
                        <SelectItem value="7">{t('july') || 'July'}</SelectItem>
                        <SelectItem value="8">{t('august') || 'August'}</SelectItem>
                        <SelectItem value="9">{t('september') || 'September'}</SelectItem>
                        <SelectItem value="10">{t('october') || 'October'}</SelectItem>
                        <SelectItem value="11">{t('november') || 'November'}</SelectItem>
                        <SelectItem value="12">{t('december') || 'December'}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={billsFilterYear.toString()}
                      onValueChange={(value) => setBillsFilterYear(parseInt(value))}
                      data-testid="select-bills-year"
                    >
                      <SelectTrigger className="w-[90px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(availableYears?.years || [new Date().getFullYear()]).map(year => (
                          <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {billsSummaryLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-gray-300" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Previous Month Section */}
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <h4 className="font-medium text-sm">{t('previousMonth') || 'Previous Month'}</h4>
                        <Badge variant="outline" className="ml-auto">
                          {monthRanges.previousMonthLabel}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t('totalBills') || 'Total Bills'}:</span>
                          <span className="font-medium">{billsSummary?.lastMonth?.count || 0}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t('totalAmount') || 'Total Amount'}:</span>
                          <span className="font-medium">${(billsSummary?.lastMonth?.total || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                            {t('paid') || 'Paid'}:
                          </span>
                          <span className="font-medium text-green-600">${(billsSummary?.lastMonth?.paidTotal || 0).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Last Month Bills List */}
                      {billsSummary?.lastMonth?.bills && billsSummary.lastMonth.bills.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-auto">
                          {billsSummary.lastMonth.bills.slice(0, 5).map((bill, index) => (
                            <div 
                              key={`${bill.paymentId}-${index}`} 
                              className="flex items-center justify-between py-2 px-3 bg-white rounded border text-sm cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => setSelectedBill(bill)}
                              data-testid={`bill-last-month-${bill.id}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium truncate">{bill.title}</p>
                                  {bill.isAutoGenerated && (
                                    <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 text-blue-600 border-blue-300">
                                      <Calendar className="w-3 h-3 mr-1" />
                                      Auto
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {t(bill.category) || bill.category}
                                  {bill.issueDate && (
                                    <> · {t('bills.issueDate') || 'Issue Date'}: {format(new Date(bill.issueDate), 'MMM d, yyyy')}</>
                                  )}
                                  {bill.vendorInvoiceNumber && (
                                    <> · #{bill.vendorInvoiceNumber}</>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                <span className="font-medium">${parseFloat(bill.paymentAmount).toLocaleString()}</span>
                                {bill.paymentStatus === 'paid' ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : isOverduePayment({ status: bill.paymentStatus, scheduledDate: bill.scheduledDate }) ? (
                                  <AlertCircle className="w-4 h-4 text-red-500" />
                                ) : (
                                  <Clock className="w-4 h-4 text-yellow-500" />
                                )}
                              </div>
                            </div>
                          ))}
                          {billsSummary.lastMonth.bills.length > 5 && (
                            <p className="text-xs text-muted-foreground text-center py-1">
                              +{billsSummary.lastMonth.bills.length - 5} {t('more') || 'more'}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {t('noBillsForPeriod') || 'No bills for this period'}
                        </p>
                      )}
                    </div>

                    {/* Selected Month Section */}
                    <div className="border rounded-lg p-4 bg-blue-50">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        <h4 className="font-medium text-sm">{t('selectedMonth') || 'Selected Month'}</h4>
                        <Badge variant="outline" className="ml-auto bg-blue-100">
                          {monthRanges.selectedMonthLabel}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t('upcomingBills') || 'Upcoming Bills'}:</span>
                          <span className="font-medium">{billsSummary?.nextMonth?.count || 0}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t('totalDue') || 'Total Due'}:</span>
                          <span className="font-medium text-blue-600">${(billsSummary?.nextMonth?.total || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                            {t('alreadyPaid') || 'Already Paid'}:
                          </span>
                          <span className="font-medium text-green-600">${(billsSummary?.nextMonth?.paidTotal || 0).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Next Month Bills List */}
                      {billsSummary?.nextMonth?.bills && billsSummary.nextMonth.bills.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-auto">
                          {billsSummary.nextMonth.bills.slice(0, 5).map((bill, index) => (
                            <div 
                              key={`${bill.paymentId}-${index}`} 
                              className="flex items-center justify-between py-2 px-3 bg-white rounded border text-sm cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => setSelectedBill(bill)}
                              data-testid={`bill-next-month-${bill.id}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium truncate">{bill.title}</p>
                                  {bill.isAutoGenerated && (
                                    <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 text-blue-600 border-blue-300">
                                      <Calendar className="w-3 h-3 mr-1" />
                                      Auto
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {bill.scheduledDate ? format(new Date(bill.scheduledDate), 'MMM d') : ''} - {t(bill.category) || bill.category}
                                  {bill.issueDate && (
                                    <> · {t('bills.issueDate') || 'Issue Date'}: {format(new Date(bill.issueDate), 'MMM d, yyyy')}</>
                                  )}
                                  {bill.vendorInvoiceNumber && (
                                    <> · #{bill.vendorInvoiceNumber}</>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                <span className="font-medium">${parseFloat(bill.paymentAmount).toLocaleString()}</span>
                                {bill.paymentStatus === 'paid' ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : isOverduePayment({ status: bill.paymentStatus, scheduledDate: bill.scheduledDate }) ? (
                                  <AlertCircle className="w-4 h-4 text-red-500" />
                                ) : (
                                  <Clock className="w-4 h-4 text-blue-500" />
                                )}
                              </div>
                            </div>
                          ))}
                          {billsSummary.nextMonth.bills.length > 5 && (
                            <p className="text-xs text-muted-foreground text-center py-1">
                              +{billsSummary.nextMonth.bills.length - 5} {t('more') || 'more'}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {t('noBillsForPeriod') || 'No bills for this period'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Bill Details Dialog */}
          <Dialog open={!!selectedBill} onOpenChange={(open) => !open && setSelectedBill(null)}>
            <DialogContent className="max-w-md" data-testid="dialog-bill-details">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {t('billDetails')}
                </DialogTitle>
              </DialogHeader>
              
              {selectedBill && (
                <div className="space-y-6">
                  {/* Bill Title */}
                  <div>
                    <h3 className="font-semibold text-lg">{selectedBill.title}</h3>
                    {selectedBill.billNumber && (
                      <p className="text-sm text-muted-foreground">
                        #{selectedBill.billNumber}
                        {selectedBill.vendorInvoiceNumber && (
                          <span className="ml-2">
                            · {t('bills.vendorInvoiceNumber') || 'Bill / Invoice Number'}: {selectedBill.vendorInvoiceNumber}
                          </span>
                        )}
                      </p>
                    )}
                    {selectedBill.issueDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('bills.issueDate') || 'Issue Date'}: {format(new Date(selectedBill.issueDate), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>

                  {/* Bill Information Section */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                      {t('billInformation')}
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t('category')}:</span>
                        <p className="font-medium">{t(selectedBill.category) || selectedBill.category}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('vendor')}:</span>
                        <p className="font-medium">{selectedBill.vendor || '-'}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">{t('description')}:</span>
                        <p className="font-medium">{selectedBill.description || '-'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('totalAmount')}:</span>
                        <p className="font-medium">${parseFloat(selectedBill.totalAmount).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Information Section */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                      {t('paymentSchedule')}
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t('scheduledDate')}:</span>
                        <p className="font-medium">
                          {selectedBill.scheduledDate ? format(new Date(selectedBill.scheduledDate), 'MMM d, yyyy') : '-'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('paymentAmount')}:</span>
                        <p className="font-medium">${parseFloat(selectedBill.paymentAmount).toLocaleString()}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">{t('paymentStatus')}:</span>
                        <div className="mt-1">
                          {(() => {
                            const isOverdue = isOverduePayment({ status: selectedBill.paymentStatus, scheduledDate: selectedBill.scheduledDate });
                            const displayStatus = isOverdue ? 'overdue' : selectedBill.paymentStatus;
                            return (
                              <Badge 
                                variant={selectedBill.paymentStatus === 'paid' ? 'default' : isOverdue ? 'destructive' : 'secondary'}
                                className={selectedBill.paymentStatus === 'paid' ? 'bg-green-500' : ''}
                              >
                                {t(displayStatus) || displayStatus}
                              </Badge>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Attachment Section */}
                  <div className="space-y-3 pt-2 border-t">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                      {t('attachment') || 'Attachment'}
                    </h4>
                    {selectedBill.filePath && selectedBill.fileName ? (
                      <div className="space-y-2">
                        <p className="text-sm flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          {selectedBill.originalFileName || selectedBill.fileName}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => window.open(`/api/bills/${selectedBill.id}/download-document?inline=true`, '_blank')}
                            data-testid="btn-view-attachment"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            {t('view') || 'View'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = `/api/bills/${selectedBill.id}/download-document`;
                              link.download = selectedBill.originalFileName || selectedBill.fileName || 'attachment';
                              link.click();
                            }}
                            data-testid="btn-download-attachment"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            {t('download') || 'Download'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {t('noAttachment')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Budget Trend Analysis Graph - Show selected building - Hidden for tenant role */}
          {canSeeFinancialCards && buildingForecast && (
            <Card ref={overviewChartRef} data-testid={`card-budget-graph-${buildingForecast.buildingId}`}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="w-5 h-5" />
                    {t('budgetTrendAnalysis')} - {buildingForecast.buildingName}
                  </CardTitle>
                  <div className="text-sm text-muted-foreground">
                    {filters.viewType === 'month' ? t('monthlyView') : t('yearlyView')}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadChartPDF}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Chart Legend with Visibility Toggles */}
                <div className="flex flex-wrap gap-3 p-3 bg-gray-50 rounded-lg" data-testid={`chart-legend-${buildingForecast.buildingId}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleDataVisibility('balanceStart')}
                    className="flex items-center gap-2"
                    data-testid={`toggle-balance-start-${buildingForecast.buildingId}`}
                  >
                    {filters.dataVisibility.balanceStart ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#06b6d4' }} />
                    <span className="text-sm">{t('budgetBalanceStartOfPeriod')}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleDataVisibility('balanceEnd')}
                    className="flex items-center gap-2"
                    data-testid={`toggle-balance-${buildingForecast.buildingId}`}
                  >
                    {filters.dataVisibility.balanceEnd ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-sm">{t('budgetBalanceEndOfPeriod')}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleDataVisibility('revenue')}
                    className="flex items-center gap-2"
                    data-testid={`toggle-revenue-${buildingForecast.buildingId}`}
                  >
                    {filters.dataVisibility.revenue ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm">{t('budgetRevenue')}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleDataVisibility('spending')}
                    className="flex items-center gap-2"
                    data-testid={`toggle-spending-${buildingForecast.buildingId}`}
                  >
                    {filters.dataVisibility.spending ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm">{t('budgetSpending')}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleDataVisibility('netCashFlow')}
                    className="flex items-center gap-2"
                    data-testid={`toggle-netcashflow-${buildingForecast.buildingId}`}
                  >
                    {filters.dataVisibility.netCashFlow ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8b5cf6' }} />
                    <span className="text-sm">{t('budgetNetCashFlow')}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleDataVisibility('capitalInvestments')}
                    className="flex items-center gap-2"
                    data-testid={`toggle-investments-${buildingForecast.buildingId}`}
                  >
                    {filters.dataVisibility.capitalInvestments ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <div className="w-3 h-3 rounded-full bg-indigo-500" />
                    <span className="text-sm">{t('investments')}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleDataVisibility('minimumRequirement')}
                    className="flex items-center gap-2"
                    data-testid={`toggle-minimum-${buildingForecast.buildingId}`}
                  >
                      {filters.dataVisibility.minimumRequirement ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      <div className="w-3 h-3 border-2 border-dashed border-orange-500" style={{ width: '12px', height: '12px' }} />
                      <span className="text-sm">{t('minimumRequirement')}</span>
                    </Button>
                  </div>

                  {/* Chart */}
                  <div className="h-96">
                    {buildingForecast.isLoading ? (
                      <div className="h-full flex items-center justify-center">
                        <RefreshCw className="w-8 h-8 animate-spin text-gray-300" />
                      </div>
                    ) : prepareChartData(buildingForecast.data).length > 0 ? (
                      (() => {
                        const chartData = prepareChartData(buildingForecast.data);
                        return (
                          <ChartContainer config={overviewChartConfig} className="h-full w-full">
                            <RechartsLineChart data={chartData}>
                              <RechartsCartesianGrid strokeDasharray="3 3" />
                              <RechartsXAxis 
                                dataKey="period" 
                                type="category"
                                allowDuplicatedCategory={false}
                              />
                              <RechartsYAxis />
                              <ChartTooltip content={<ChartTooltipContent formatter={overviewTooltipFormatter} />} />

                              {filters.dataVisibility.balanceStart && renderDualLine({
                                dataKey: 'balanceStart', color: budgetColors.balanceStart, chartData,
                                name: t('budgetBalanceStartOfPeriod'),
                              })}
                              {filters.dataVisibility.balanceEnd && renderDualLine({
                                dataKey: 'balanceEnd', color: budgetColors.balanceEnd, chartData,
                                name: t('budgetBalanceEndOfPeriod'),
                              })}
                              {filters.dataVisibility.revenue && renderDualLine({
                                dataKey: 'revenue', color: budgetColors.revenue, chartData,
                                name: t('budgetRevenue'),
                              })}
                              {filters.dataVisibility.spending && renderDualLine({
                                dataKey: 'spending', color: budgetColors.spending, chartData,
                                name: t('budgetSpending'),
                              })}
                              {filters.dataVisibility.netCashFlow && renderDualLine({
                                dataKey: 'netCashFlow', color: budgetColors.netCashFlow, chartData,
                                includeTransition: false, name: t('budgetNetCashFlow'),
                              })}
                              {filters.dataVisibility.capitalInvestments && renderDualLine({
                                dataKey: 'capitalInvestments', color: budgetColors.capitalInvestments, chartData,
                                includeTransition: false, name: t('investments'),
                              })}

                              {filters.dataVisibility.minimumRequirement && buildingForecast.data?.minimumFund && (
                                <RechartsReferenceLine
                                  y={buildingForecast.data.minimumFund}
                                  stroke={budgetColors.minimumRequirement}
                                  strokeDasharray="8,4"
                                  strokeWidth={2}
                                  label={{
                                    value: `Min: $${buildingForecast.data.minimumFund.toLocaleString()}`,
                                    position: 'right',
                                    style: { fill: budgetColors.minimumRequirement, fontSize: '12px', fontWeight: 'bold' },
                                  }}
                                />
                              )}
                            </RechartsLineChart>
                          </ChartContainer>
                        );
                      })()
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-500">
                        <div className="text-center">
                          <LineChart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <p>{t('noDataAvailable')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Project Management Card for Selected Building - Hidden for tenant role */}
          {canSeeFinancialCards && (
          <Card data-testid="card-project-management">
            <CardHeader
              className="cursor-pointer"
              onClick={() => setProjectCollapsed(!projectCollapsed)}
            >
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  {t('projectManagement')}
                  <Badge variant="secondary" className="ml-2">
                    {selectedBuildingProjects.length} {t('projects')}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="inline-flex rounded-md border bg-muted/30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant={projectViewMode === 'list' ? 'default' : 'ghost'}
                      className="h-7 px-2"
                      onClick={() => setProjectViewMode('list')}
                      data-testid="button-projects-view-list"
                      title={t('listView')}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={projectViewMode === 'gantt' ? 'default' : 'ghost'}
                      className="h-7 px-2"
                      onClick={() => setProjectViewMode('gantt')}
                      data-testid="button-projects-view-gantt"
                      title={t('ganttView')}
                    >
                      <BarChart3 className="w-4 h-4" />
                    </Button>
                  </div>
                  {projectCollapsed ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronUp className="w-5 h-5" />
                  )}
                </div>
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                {t('manageProjectsForCurrentYear')}
              </div>
            </CardHeader>
            {!projectCollapsed && (
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  {t('projectsAffectingBudget')}
                </div>

                {/* Project List or Gantt */}
                <div className="space-y-3">
                  {projectsLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin text-gray-300" />
                      <p>{t('loadingProjects')}</p>
                    </div>
                  ) : selectedBuildingProjects.length > 0 && projectViewMode === 'gantt' ? (
                    <GanttChart
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
                      projects={selectedBuildingProjects.map(p => ({
                        id: p.id,
                        title: p.title,
                        status: p.status,
                        plannedStartDate: p.plannedStartDate,
                        plannedEndDate: p.plannedEndDate,
                        actualStartDate: p.actualStartDate,
                        actualEndDate: p.actualEndDate,
                        includeInBudget: p.includeInBudget,
                      }))}
                      language={language}
                      onToggleInclude={(id, value) => {
                        setProjectStates(prev => {
                          const next = new Map(prev);
                          next.set(id, value);
                          return next;
                        });
                      }}
                    />
                  ) : selectedBuildingProjects.length > 0 ? (
                    selectedBuildingProjects.map(project => {
                      const baseYearStr = getProjectFiscalYear(
                        project,
                        selectedBuilding?.financialYearStart ?? bankAccountConfig?.financialYearStart ?? null,
                      );
                      const baseYear = baseYearStr === 'N/A' ? null : parseInt(baseYearStr, 10);
                      const isConfirming = confirmProjectYearMutation.isPending &&
                        confirmProjectYearMutation.variables?.id === project.id;
                      return (
                        <OverviewProjectCard
                          key={project.id}
                          project={project}
                          baseYearLabel={baseYearStr}
                          baseYear={baseYear}
                          offset={projectYearOffsets.get(project.id) ?? 0}
                          minYear={currentFiscalYear}
                          maxYear={currentFiscalYear + 25}
                          t={t}
                          language={language}
                          isConfirming={isConfirming}
                          onShift={(id, delta) => {
                            setProjectYearOffsets(prev => {
                              const next = new Map(prev);
                              const cur = (next.get(id) ?? 0) + delta;
                              if (cur === 0) next.delete(id);
                              else next.set(id, cur);
                              return next;
                            });
                          }}
                          onConfirmYear={(id, financialYear) => {
                            confirmProjectYearMutation.mutate({ id, financialYear });
                          }}
                          onToggleInclude={(id, value) => {
                            setProjectStates(prev => {
                              const next = new Map(prev);
                              next.set(id, value);
                              return next;
                            });
                          }}
                        />
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>{t('noProjectsFound')}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
          )}
        </div>
      </div>
    </div>
  );
}
