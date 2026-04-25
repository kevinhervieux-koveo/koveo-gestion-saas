import { useState, useEffect } from 'react';
import { logDebug } from '@/lib/logger';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CollapsibleFilters } from '@/components/ui/collapsible-filters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  FileText,
  Plus,
  Filter,
  Calendar,
  Building as BuildingIcon,
  ChevronDown,
  Receipt,
} from 'lucide-react';
import { BuildingSelectionGrid } from '@/components/BuildingSelectionGrid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import type { Building } from '@shared/schema';
import type { Invoice } from '@shared/schemas/invoices';

// Import new modern components
import { InvoiceForm, InvoiceCard } from '@/components/invoice-management';

interface InvoiceFilters {
  buildingId: string;
  paymentType: string;
  year: string;
  months: string[];
}

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export default function Invoices() {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<InvoiceFilters>({
    buildingId: '',
    paymentType: '',
    year: new Date().getFullYear().toString(),
    months: [],
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    logDebug('🔍 [INVOICES] Component mounted', {
      initialFilters: filters,
      timestamp: new Date().toISOString()
    });
  }, []);

  // Fetch buildings for filter dropdown
  const {
    data: buildings = [],
    isLoading: buildingsLoading,
    error: buildingsError,
  } = useQuery<Building[]>({
    queryKey: ['/api/buildings'],
    queryFn: async () => {
      logDebug('🔍 [INVOICES] Fetching buildings...');
      const response = await apiRequest('GET', '/api/buildings');
      const data = await response.json();
      logDebug('🔍 [INVOICES] Buildings received:', { count: data?.length || 0 });
      return data;
    },
  });

  // Fetch invoices based on filters
  const { data: invoicesResponse = { success: true, data: [], count: 0 }, isLoading } = useQuery<{
    success: boolean;
    data: Invoice[];
    count: number;
  }>({
    queryKey: ['/api/invoices', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.buildingId) {
        params.set('buildingId', filters.buildingId);
      }
      if (filters.paymentType && filters.paymentType !== 'all') {
        params.set('paymentType', filters.paymentType);
      }
      if (filters.year) {
        params.set('year', filters.year);
      }
      if (filters.months.length > 0) {
        params.set('months', filters.months.join(','));
      }

      const url = `/api/invoices${params.toString() ? '?' + params.toString() : ''}`;
      logDebug('🔍 [INVOICES] Fetching invoices with params:', {
        buildingId: filters.buildingId,
        paymentType: filters.paymentType,
        year: filters.year,
        months: filters.months,
        url
      });
      const response = await fetch(url, { credentials: 'include' });
      
      if (!response.ok) {
        logDebug('🔍 [INVOICES] Failed to fetch invoices:', response.statusText);
        throw new Error(`Failed to fetch invoices: ${response.statusText}`);
      }

      const data = await response.json();
      logDebug('🔍 [INVOICES] Invoices received:', {
        count: data?.data?.length || 0,
        success: data?.success
      });
      return data;
    },
  });

  const invoices = invoicesResponse.data || [];

  // Group invoices by payment type
  const invoicesByType = invoices.reduce((acc: Record<string, Invoice[]>, invoice: Invoice) => {
    const type = invoice.paymentType || 'one-time';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(invoice);
    return acc;
  }, {});

  const handleFilterChange = (key: keyof InvoiceFilters, value: string | string[]) => {
    logDebug('🔍 [INVOICES] Filter changed:', { key, value });
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleMonthToggle = (monthValue: string) => {
    const isAdding = !filters.months.includes(monthValue);
    logDebug('🔍 [INVOICES] User action: Month toggle', {
      action: isAdding ? 'add' : 'remove',
      month: monthValue
    });
    setFilters((prev) => ({
      ...prev,
      months: prev.months.includes(monthValue)
        ? prev.months.filter((m) => m !== monthValue)
        : [...prev.months, monthValue],
    }));
  };

  const clearAllFilters = () => {
    logDebug('🔍 [INVOICES] User action: Clear all filters');
    setFilters({
      buildingId: '',
      paymentType: '',
      year: new Date().getFullYear().toString(),
      months: [],
    });
  };

  const handleAllMonthsToggle = () => {
    const allMonthValues = MONTHS.map((m) => m.value);
    const isSelectingAll = filters.months.length !== allMonthValues.length;
    logDebug('🔍 [INVOICES] User action: All months toggle', {
      action: isSelectingAll ? 'select all' : 'deselect all'
    });
    setFilters((prev) => ({
      ...prev,
      months: prev.months.length === allMonthValues.length ? [] : allMonthValues,
    }));
  };

  const getMonthsDisplayText = () => {
    if (filters.months.length === 0) {
      return 'All months';
    }
    if (filters.months.length === MONTHS.length) {
      return 'All months';
    }
    if (filters.months.length === 1) {
      const month = MONTHS.find((m) => m.value === filters.months[0]);
      return month?.label || 'All months';
    }
    return `${filters.months.length} months`;
  };

  const currentYear = new Date().getFullYear();
  const getYearOptions = () => {
    const startYear = currentYear - 3;
    const endYear = currentYear + 3;
    const totalYears = endYear - startYear + 1;
    return Array.from({ length: totalYears }, (_, i) => startYear + i);
  };

  useEffect(() => {
    logDebug('🔍 [INVOICES] Filters updated:', filters);
  }, [filters]);

  useEffect(() => {
    logDebug('🔍 [INVOICES] Create dialog state changed:', { isOpen: showCreateDialog });
  }, [showCreateDialog]);

  useEffect(() => {
    if (buildingsError) {
      logDebug('🔍 [INVOICES] Buildings loading error:', buildingsError);
    }
  }, [buildingsError]);

  // Show loading state while buildings are loading
  if (buildingsLoading) {
    logDebug('🔍 [INVOICES] Loading buildings...');
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={t('invoiceManagement')} subtitle={t('invoiceManagementSubtitle')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading buildings...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if buildings failed to load
  if (buildingsError) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={t('invoiceManagement')} subtitle={t('invoiceManagementSubtitle')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-4">Failed to load buildings</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title={t('invoiceManagement')} subtitle={t('invoiceManagementSubtitle')} />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Collapsible Filters Section */}
          <CollapsibleFilters
            title="Filters"
            defaultExpanded={false}
            filters={[
              {
                id: 'buildingId',
                label: 'Building',
                type: 'custom',
                customComponent: (
                  <Select
                    value={filters.buildingId}
                    onValueChange={(value) => handleFilterChange('buildingId', value)}
                  >
                    <SelectTrigger data-testid="select-building-filter">
                      <SelectValue placeholder="Select building" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(buildings) &&
                        buildings.map((building: Building) => (
                          <SelectItem key={building.id} value={building.id}>
                            {building.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ),
                value: filters.buildingId,
                onChange: (value) => handleFilterChange('buildingId', value as string),
              },
              {
                id: 'paymentType',
                label: 'Payment Type',
                type: 'custom',
                customComponent: (
                  <Select
                    value={filters.paymentType}
                    onValueChange={(value) => handleFilterChange('paymentType', value)}
                  >
                    <SelectTrigger data-testid="select-payment-type-filter">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="one-time">One-Time Bill</SelectItem>
                      <SelectItem value="recurring">Recurring</SelectItem>
                    </SelectContent>
                  </Select>
                ),
                value: filters.paymentType,
                onChange: (value) => handleFilterChange('paymentType', value as string),
              },
              {
                id: 'year',
                label: 'Year',
                type: 'custom',
                customComponent: (
                  <Select
                    value={filters.year}
                    onValueChange={(value) => handleFilterChange('year', value)}
                  >
                    <SelectTrigger data-testid="select-year-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      {getYearOptions().map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                          {year === currentYear && (
                            <span className="ml-2 text-xs text-blue-500">({t('current')})</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ),
                value: filters.year,
                onChange: (value) => handleFilterChange('year', value as string),
              },
              {
                id: 'months',
                label: 'Months',
                type: 'custom',
                customComponent: (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-between',
                          filters.months.length === 0 && 'text-muted-foreground'
                        )}
                        data-testid="select-months-filter"
                      >
                        {getMonthsDisplayText()}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0" align="start">
                      <div className="border-b p-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="all-months"
                            checked={filters.months.length === MONTHS.length}
                            onCheckedChange={handleAllMonthsToggle}
                          />
                          <Label
                            htmlFor="all-months"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            All Months
                          </Label>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 p-3">
                        {MONTHS.map((month) => (
                          <div key={month.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`month-${month.value}`}
                              checked={filters.months.includes(month.value)}
                              onCheckedChange={() => handleMonthToggle(month.value)}
                            />
                            <Label
                              htmlFor={`month-${month.value}`}
                              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {month.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ),
                value: filters.months,
                onChange: (value) => handleFilterChange('months', value as string[]),
              },
            ]}
            activeFilters={[
              ...(filters.buildingId ? [{
                id: 'buildingId',
                label: 'Building',
                displayValue: buildings.find((b: Building) => b.id === filters.buildingId)?.name || filters.buildingId
              }] : []),
              ...(filters.paymentType && filters.paymentType !== 'all' ? [{
                id: 'paymentType',
                label: 'Payment Type',
                displayValue: filters.paymentType
              }] : []),
              ...(filters.year !== new Date().getFullYear().toString() ? [{
                id: 'year',
                label: 'Year',
                displayValue: filters.year
              }] : []),
              ...(filters.months.length > 0 ? [{
                id: 'months',
                label: 'Months',
                displayValue: `${filters.months.length} selected`
              }] : []),
            ]}
            onReset={clearAllFilters}
            resetLabel="Clear Filters"
          />

          {/* Create Invoice Section */}
          <div className="flex justify-end">
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button 
                  disabled={!filters.buildingId}
                  data-testid="button-create-invoice"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Invoice</DialogTitle>
                </DialogHeader>
                <InvoiceForm
                  mode="create"
                  buildingId={filters.buildingId}
                  onSuccess={() => {
                    logDebug('🔍 [INVOICES] Invoice created successfully');
                    setShowCreateDialog(false);
                    queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
                  }}
                  onCancel={() => {
                    logDebug('🔍 [INVOICES] User action: Create invoice cancelled');
                    setShowCreateDialog(false);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>

          {/* Invoices Display */}
          {!filters.buildingId ? (
            <BuildingSelectionGrid
              buildings={Array.isArray(buildings) ? buildings : []}
              onBuildingSelect={(buildingId) => {
                logDebug('🔍 [INVOICES] User action: Building selected from grid', { buildingId });
                handleFilterChange('buildingId', buildingId);
              }}
            />
          ) : isLoading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-500">Loading invoices...</p>
              </CardContent>
            </Card>
          ) : invoices.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Receipt className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No Invoices Found</h3>
                {/* eslint-disable-next-line i18n/no-untranslated-jsx-strings -- pre-existing untranslated string (task #708): translate in a follow-up */}
                <p className="text-gray-500 mb-4">
                  {t('noInvoicesFoundForTheSelected')}
                </p>
                <Button onClick={() => {
                  logDebug('🔍 [INVOICES] User action: Create first invoice clicked');
                  setShowCreateDialog(true);
                }} data-testid="button-create-first-invoice">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Invoice
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* One-time Invoices */}
              {invoicesByType['one-time'] && invoicesByType['one-time'].length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        One-Time Bills
                        <Badge variant="secondary">{invoicesByType['one-time'].length}</Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {invoicesByType['one-time'].map((invoice) => (
                        <InvoiceCard 
                          key={invoice.id} 
                          invoice={invoice} 
                          onUpdate={() => {
                            logDebug('🔍 [INVOICES] Invoice updated:', { invoiceId: invoice.id });
                            queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
                          }}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recurring Invoices */}
              {invoicesByType['recurring'] && invoicesByType['recurring'].length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-5 h-5" />
                        Recurring Invoices
                        <Badge variant="default">{invoicesByType['recurring'].length}</Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {invoicesByType['recurring'].map((invoice) => (
                        <InvoiceCard 
                          key={invoice.id} 
                          invoice={invoice} 
                          onUpdate={() => {
                            logDebug('🔍 [INVOICES] Invoice updated:', { invoiceId: invoice.id });
                            queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
                          }}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}