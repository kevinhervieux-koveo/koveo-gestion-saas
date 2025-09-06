import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [filters, setFilters] = useState<InvoiceFilters>({
    buildingId: '',
    paymentType: '',
    year: new Date().getFullYear().toString(),
    months: [],
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const queryClient = useQueryClient();

  // Fetch buildings for filter dropdown
  const {
    data: buildings = [],
    isLoading: buildingsLoading,
    error: buildingsError,
  } = useQuery<Building[]>({
    queryKey: ['/api/buildings'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/buildings');
      return await response.json();
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
      const response = await fetch(url, { credentials: 'include' });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch invoices: ${response.statusText}`);
      }

      return response.json();
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
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleMonthToggle = (monthValue: string) => {
    setFilters((prev) => ({
      ...prev,
      months: prev.months.includes(monthValue)
        ? prev.months.filter((m) => m !== monthValue)
        : [...prev.months, monthValue],
    }));
  };

  const handleAllMonthsToggle = () => {
    const allMonthValues = MONTHS.map((m) => m.value);
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

  // Show loading state while buildings are loading
  if (buildingsLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Invoice Management" subtitle="Modern AI-powered invoice processing and management" />
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
        <Header title="Invoice Management" subtitle="Modern AI-powered invoice processing and management" />
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
      <Header title="Invoice Management" subtitle="Modern AI-powered invoice processing and management" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filters Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="building-filter" className="flex items-center gap-2">
                    <BuildingIcon className="w-4 h-4" />
                    Building
                  </Label>
                  <Select
                    value={filters.buildingId}
                    onValueChange={(value) => handleFilterChange('buildingId', value)}
                  >
                    <SelectTrigger id="building-filter" data-testid="select-building-filter">
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-type-filter" className="flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Payment Type
                  </Label>
                  <Select
                    value={filters.paymentType}
                    onValueChange={(value) => handleFilterChange('paymentType', value)}
                  >
                    <SelectTrigger id="payment-type-filter" data-testid="select-payment-type-filter">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="one-time">One-time</SelectItem>
                      <SelectItem value="recurring">Recurring</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="year-filter" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Year
                  </Label>
                  <Select
                    value={filters.year}
                    onValueChange={(value) => handleFilterChange('year', value)}
                  >
                    <SelectTrigger id="year-filter" data-testid="select-year-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      {getYearOptions().map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                          {year === currentYear && (
                            <span className="ml-2 text-xs text-blue-500">(Current)</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Months
                  </Label>
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
                </div>

                <div className="space-y-2">
                  <Label className="invisible">Actions</Label>
                  <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                      <Button 
                        className="w-full" 
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
                          setShowCreateDialog(false);
                          queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
                        }}
                        onCancel={() => setShowCreateDialog(false)}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoices Display */}
          {!filters.buildingId ? (
            <BuildingSelectionGrid
              buildings={Array.isArray(buildings) ? buildings : []}
              onBuildingSelect={(buildingId) => handleFilterChange('buildingId', buildingId)}
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
                <p className="text-gray-500 mb-4">
                  No invoices found for the selected filters. Create your first invoice to get started.
                </p>
                <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first-invoice">
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
                        One-time Invoices
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
                          onUpdate={() => queryClient.invalidateQueries({ queryKey: ['/api/invoices'] })}
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
                          onUpdate={() => queryClient.invalidateQueries({ queryKey: ['/api/invoices'] })}
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