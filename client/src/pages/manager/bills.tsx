import { useState, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  FileText,
  Plus,
  Upload,
  Filter,
  Calendar,
  Tag,
  ChevronDown,
} from 'lucide-react';
import ModularBillForm from '@/components/bill-management/ModularBillForm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { withHierarchicalSelection } from '@/components/hoc/withHierarchicalSelection';
import type { Bill } from '@shared/schema';

const BILL_CATEGORIES = [
  'insurance',
  'maintenance',
  'salary',
  'utilities',
  'cleaning',
  'security',
  'landscaping',
  'professional_services',
  'administration',
  'repairs',
  'supplies',
  'taxes',
  'other',
] as const;

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

// Category labels using translation keys
const getCategoryLabel = (category: string, t: (key: string) => string) => {
  const categoryTranslationKeys: Record<string, string> = {
    insurance: 'insurance',
    maintenance: 'maintenance', 
    salary: 'salary',
    utilities: 'utilities',
    cleaning: 'cleaning',
    security: 'security',
    landscaping: 'landscaping',
    professional_services: 'professionalServices',
    administration: 'administration',
    repairs: 'repairs',
    supplies: 'supplies',
    taxes: 'taxes',
    other: 'other'
  };
  return t(categoryTranslationKeys[category] || category);
};

/**
 * Filters for bills (excluding buildingId which comes from hierarchical selection)
 */
interface BillFilters {
  category: string;
  year: string;
  months: string[];
}

/**
 * Props received from withHierarchicalSelection HOC
 */
interface BillsProps {
  organizationId?: string;
  buildingId?: string;
}

/**
 * Bills management component
 */
function BillsPage({ buildingId }: BillsProps) {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<BillFilters>({
    category: '',
    year: new Date().getFullYear().toString(),
    months: [],
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAllYears, setShowAllYears] = useState(false);
  const queryClient = useQueryClient();

  // Fetch bills based on filters
  const { data: bills = [], isLoading } = useQuery<Bill[]>({
    queryKey: ['/api/bills', buildingId, filters],
    queryFn: async () => {
      const params = new URLSearchParams(); /**
       * If function.
       * @param filters.buildingId - Filters.buildingId parameter.
       */ /**
       * If function.
       * @param filters.buildingId - Filters.buildingId parameter.
       */

      if (buildingId) {
        params.set('buildingId', buildingId);
      } /**
       * If function.
       * @param filters.category && filters.category !== 'all' - filters.category && filters.category !== 'all' parameter.
       */ /**
       * If function.
       * @param filters.category && filters.category !== 'all' - filters.category && filters.category !== 'all' parameter.
       */

      if (filters.category && filters.category !== 'all') {
        params.set('category', filters.category);
      } /**
       * If function.
       * @param filters.year - Filters.year parameter.
       */ /**
       * If function.
       * @param filters.year - Filters.year parameter.
       */

      if (filters.year) {
        params.set('year', filters.year);
      } /**
       * If function.
       * @param filters.months.length > 0 - filters.months.length > 0 parameter.
       */ /**
       * If function.
       * @param filters.months.length > 0 - filters.months.length > 0 parameter.
       */

      if (filters.months.length > 0) {
        params.set('months', filters.months.join(','));
      }

      const url = `/api/bills${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, { credentials: 'include' }); /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */
      /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */
      /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */
      /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */ /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */

      /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */
      /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */
      /**
       * If function.
       * @param !response.ok - !response.ok parameter.
       */

      if (!response.ok) {
        throw new Error(`Failed to fetch bills: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!buildingId, // Only fetch when buildingId is available
  });

  // Group bills by category
  const billsByCategory = bills.reduce((acc: Record<string, Bill[]>, bill: Bill) => {
    const category = bill.category || 'other'; /**
     * If function.
     * @param !acc[category] - !acc[category] parameter.
     */ /**
     * If function.
     * @param !acc[category] - !acc[category] parameter.
     */

    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(bill);
    return acc;
  }, {});

  const handleFilterChange = (key: keyof BillFilters, value: string | string[]) => {
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
    /**
     * If function.
     * @param filters.months.length === 0 - filters.months.length === 0 parameter.
     */ /**
     * If function.
     * @param filters.months.length === 0 - filters.months.length === 0 parameter.
     */

    if (filters.months.length === 0) {
      return 'All months';
    } /**
     * If function.
     * @param filters.months.length === MONTHS.length - filters.months.length === MONTHS.length parameter.
     */ /**
     * If function.
     * @param filters.months.length === MONTHS.length - filters.months.length === MONTHS.length parameter.
     */

    if (filters.months.length === MONTHS.length) {
      return 'All months';
    } /**
     * If function.
     * @param filters.months.length === 1 - filters.months.length === 1 parameter.
     */ /**
     * If function.
     * @param filters.months.length === 1 - filters.months.length === 1 parameter.
     */

    if (filters.months.length === 1) {
      const month = MONTHS.find((m) => m.value === filters.months[0]);
      return month?.label || 'All months';
    }
    return `${filters.months.length} months`;
  };

  // Get current year for year calculation
  const currentYear = new Date().getFullYear();

  // Generate year options based on show all years state
  const getYearOptions = () => {
    /**
     * If function.
     * @param showAllYears - ShowAllYears parameter.
     */ /**
     * If function.
     * @param showAllYears - ShowAllYears parameter.
     */

    if (showAllYears) {
      // Show years from 2000 to 25 years forward
      const startYear = 2000;
      const endYear = currentYear + 25;
      const totalYears = endYear - startYear + 1;
      return Array.from({ length: totalYears }, (_, i) => startYear + i);
    } else {
      // Show current year ±3 years
      const startYear = currentYear - 3;
      const endYear = currentYear + 3;
      const totalYears = endYear - startYear + 1;
      return Array.from({ length: totalYears }, (_, i) => startYear + i);
    }
  };


  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title={t('billsManagement')} subtitle={t('billsSubtitle')} />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Filters Section */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Filter className='w-5 h-5' />
                {t('filters')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>

                <div className='space-y-2'>
                  <Label htmlFor='category-filter' className='flex items-center gap-2'>
                    <Tag className='w-4 h-4' />
                    {t('category')}
                  </Label>
                  <Select
                    value={filters.category}
                    onValueChange={(value) => handleFilterChange('category', value)}
                  >
                    <SelectTrigger id='category-filter'>
                      <SelectValue placeholder={t('allCategories')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>{t('allCategories')}</SelectItem>
                      {BILL_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {getCategoryLabel(category, t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='year-filter' className='flex items-center gap-2'>
                    <Calendar className='w-4 h-4' />
                    {t('year')}
                  </Label>
                  <div className='space-y-2'>
                    <Select
                      value={filters.year}
                      onValueChange={(value) => handleFilterChange('year', value)}
                    >
                      <SelectTrigger id='year-filter'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className='max-h-[300px] overflow-y-auto'>
                        {getYearOptions().map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                            {year === currentYear && (
                              <span className='ml-2 text-xs text-blue-500'>(Current)</span>
                            )}
                          </SelectItem>
                        ))}
                        {!showAllYears && (
                          <div className='border-t border-gray-200 mt-2 pt-2'>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='w-full text-left justify-start text-xs'
                              onClick={() => setShowAllYears(true)}
                            >
                              Show more years (2000 - {currentYear + 25})
                            </Button>
                          </div>
                        )}
                        {showAllYears && (
                          <div className='border-t border-gray-200 mt-2 pt-2'>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='w-full text-left justify-start text-xs'
                              onClick={() => setShowAllYears(false)}
                            >
                              Show fewer years ({currentYear - 3} - {currentYear + 3})
                            </Button>
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label className='flex items-center gap-2'>
                    <Calendar className='w-4 h-4' />
                    {t('months')}
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant='outline'
                        className={cn(
                          'w-full justify-between',
                          filters.months.length === 0 && 'text-muted-foreground'
                        )}
                      >
                        {getMonthsDisplayText()}
                        <ChevronDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className='w-64 p-0' align='start'>
                      <div className='border-b p-3'>
                        <div className='flex items-center space-x-2'>
                          <Checkbox
                            id='all-months'
                            checked={filters.months.length === MONTHS.length}
                            onCheckedChange={handleAllMonthsToggle}
                          />
                          <Label
                            htmlFor='all-months'
                            className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                          >
                            All Months
                          </Label>
                        </div>
                      </div>
                      <div className='grid grid-cols-2 gap-2 p-3'>
                        {MONTHS.map((month) => (
                          <div key={month.value} className='flex items-center space-x-2'>
                            <Checkbox
                              id={`month-${month.value}`}
                              checked={filters.months.includes(month.value)}
                              onCheckedChange={() => handleMonthToggle(month.value)}
                            />
                            <Label
                              htmlFor={`month-${month.value}`}
                              className='text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                            >
                              {month.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className='space-y-2'>
                  <Label className='invisible'>Actions</Label>
                  <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                      <Button className='w-full' disabled={!buildingId}>
                        {t('createBill')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
                      <DialogHeader>
                        <DialogTitle>{t('createNewBill')}</DialogTitle>
                      </DialogHeader>
                      <ModularBillForm
                        mode="create"
                        buildingId={filters.buildingId}
                        onCancel={() => setShowCreateDialog(false)}
                        onSuccess={() => {
                          setShowCreateDialog(false);
                          queryClient.invalidateQueries({ queryKey: ['/api/bills'] });
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bills Display */}
          {!filters.buildingId ? (
            <BuildingSelectionGrid
              buildings={Array.isArray(buildings) ? buildings : []}
              onBuildingSelect={(buildingId) => handleFilterChange('buildingId', buildingId)}
            />
          ) : isLoading ? (
            <Card>
              <CardContent className='p-8 text-center'>
                <div className='animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4'></div>
                <p className='text-gray-500'>{t('loadingBills')}</p>
              </CardContent>
            </Card>
          ) : Object.keys(billsByCategory).length === 0 ? (
            <Card>
              <CardContent className='p-8 text-center'>
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>{t('noBillsFound')}</h3>
                <p className='text-gray-500 mb-4'>
                  No bills found for the selected filters. Create your first bill to get started.
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  Create First Bill
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className='space-y-6'>
              {BILL_CATEGORIES.filter(
                (category) =>
                  (!filters.category || filters.category === category) &&
                  billsByCategory[category]?.length > 0
              ).map((category) => (
                <BillCategorySection
                  key={category}
                  category={category}
                  bills={billsByCategory[category] || []}
                  onBillUpdate={() => queryClient.invalidateQueries({ queryKey: ['/api/bills'] })}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Component for displaying bills in a category
/**
 *
 * @param root0
 * @param root0.category
 * @param root0.bills
 * @param root0.onBillUpdate
 */
/**
 * BillCategorySection function.
 * @param root0
 * @param root0.category
 * @param root0.bills
 * @param root0.onBillUpdate
 * @returns Function result.
 */
function BillCategorySection({
  category,
  bills,
  onBillUpdate,
  t,
}: {
  category: string;
  bills: Bill[];
  onBillUpdate: () => void;
  t: (key: string) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Tag className='w-5 h-5' />
            {getCategoryLabel(category, t)}
            <Badge variant='secondary'>{bills.length}</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {bills.map((bill) => (
            <BillCard key={bill.id} bill={bill} onUpdate={onBillUpdate} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Component for individual bill cards
/**
 *
 * @param root0
 * @param root0.bill
 * @param root0.onUpdate
 */
/**
 * BillCard function.
 * @param root0
 * @param root0.bill
 * @param root0.onUpdate
 * @returns Function result.
 */
function BillCard({ bill, onUpdate }: { bill: Bill; onUpdate: () => void }) {
  const { t } = useLanguage();
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    sent: 'bg-blue-100 text-blue-800',
    overdue: 'bg-red-100 text-red-800',
    paid: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };

  return (
    <>
      <Card
        className='hover:shadow-md transition-shadow cursor-pointer'
        onClick={() => setShowDetailDialog(true)}
      >
        <CardContent className='p-4'>
          <div className='space-y-3'>
            <div className='flex items-start justify-between'>
              <div>
                <h4 className='font-semibold text-sm'>{bill.title}</h4>
                <p className='text-xs text-gray-500'>#{bill.billNumber}</p>
              </div>
              <Badge className={statusColors[bill.status as keyof typeof statusColors]}>
                {bill.status}
              </Badge>
            </div>

            {bill.description && (
              <p className='text-sm text-gray-600 line-clamp-2'>{bill.description}</p>
            )}

            <div className='flex items-center justify-between text-sm'>
              <span className='font-medium'>${Number(bill.totalAmount).toLocaleString()}</span>
              <span className='text-gray-500'>{bill.paymentType}</span>
            </div>

            {bill.vendor && <p className='text-xs text-gray-500'>Vendor: {bill.vendor}</p>}

            <div className='flex items-center gap-2 pt-2'>
              {bill.filePath && (
                <Badge variant='outline' className='text-xs'>
                  <FileText className='w-3 h-3 mr-1' />
                  Document
                </Badge>
              )}
              {bill.isAiAnalyzed && (
                <Badge variant='outline' className='text-xs'>
                  AI Analyzed
                </Badge>
              )}
              {bill.notes?.includes('Auto-generated from:') && (
                <Badge variant='outline' className='text-xs'>
                  Auto-Generated
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bill Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className='max-w-2xl max-h-[95vh] overflow-y-auto' aria-describedby="bill-details-description">
          <DialogHeader>
            <DialogTitle>Bill Details</DialogTitle>
          </DialogHeader>
          <BillDetail
            bill={bill}
            onSuccess={() => {
              setShowDetailDialog(false);
              onUpdate();
            }}
            onCancel={() => setShowDetailDialog(false)}
            onEditBill={() => {
              setShowDetailDialog(false);
              setShowEditDialog(true);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Bill Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className='max-w-4xl max-h-[95vh] overflow-y-auto' aria-describedby="edit-bill-description">
          <ModularBillForm
            mode="edit"
            bill={bill}
            onSuccess={() => {
              setShowEditDialog(false);
              onUpdate();
            }}
            onCancel={() => setShowEditDialog(false)}
            buildingId={bill.buildingId}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// Bill detail component
function BillDetail({
  bill,
  onSuccess,
  onCancel,
  onEditBill,
}: {
  bill: Bill;
  onSuccess: () => void;
  onCancel: () => void;
  onEditBill: () => void;
}) {
  const queryClient = useQueryClient();

  // Fetch fresh bill data to ensure we have updated document information
  const { data: freshBill, error: freshBillError, isLoading: freshBillLoading } = useQuery({
    queryKey: ['/api/bills', bill.id],
    queryFn: async () => {
      const response = await fetch(`/api/bills/${bill.id}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch bill details');
      }
      return response.json();
    },
  });

  // Fetch documents attached to this bill
  const { data: billDocuments = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['/api/documents', 'bill', bill.id],
    queryFn: async () => {
      const response = await fetch(`/api/documents?attachedToType=bill&attachedToId=${bill.id}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        console.error('[BILL DOCS] Failed to fetch documents:', response.status, response.statusText);
        throw new Error('Failed to fetch bill documents');
      }
      const data = await response.json();
      return data.documents || [];
    },
  });

  // Use fresh bill data if available, fallback to props bill data
  const currentBill = freshBill || bill;
  
  // Keep basic logging for bills
  if (billDocuments.length > 0) {
    console.log('[BILL DOCS] Found documents:', billDocuments.length, 'for bill:', currentBill.billNumber);
  }
  
  const [endDate, setEndDate] = useState(currentBill.endDate || '');

  const updateBillMutation = useMutation({
    mutationFn: async (updates: Partial<Bill>) => {
      const response = await fetch(`/api/bills/${bill.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update bill');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bills'] });
      onSuccess();
    },
  });

  const handleSetEndDate = () => {
    if (endDate) {
      updateBillMutation.mutate({ endDate });
    }
  };


  return (
    <div className='space-y-6'>
      {/* Bill Information */}
      <div className='grid grid-cols-2 gap-4'>
        <div>
          <Label className='text-sm font-medium'>Bill Number</Label>
          <p className='text-sm text-gray-600'>{currentBill.billNumber}</p>
        </div>
        <div>
          <Label className='text-sm font-medium'>Status</Label>
          <p className='text-sm text-gray-600 capitalize'>{currentBill.status}</p>
        </div>
        <div>
          <Label className='text-sm font-medium'>Category</Label>
          <p className='text-sm text-gray-600 capitalize'>{currentBill.category}</p>
        </div>
        <div>
          <Label className='text-sm font-medium'>Payment Type</Label>
          <p className='text-sm text-gray-600 capitalize'>{currentBill.paymentType}</p>
        </div>
        <div>
          <Label className='text-sm font-medium'>Total Amount</Label>
          <p className='text-sm text-gray-600'>${Number(currentBill.totalAmount).toLocaleString()}</p>
        </div>
        <div>
          <Label className='text-sm font-medium'>Start Date</Label>
          <p className='text-sm text-gray-600'>{currentBill.startDate}</p>
        </div>
      </div>

      {/* Title and Description */}
      <div>
        <Label className='text-sm font-medium'>Title</Label>
        <p className='text-sm text-gray-600'>{currentBill.title}</p>
      </div>

      {currentBill.description && (
        <div>
          <Label className='text-sm font-medium'>Description</Label>
          <p className='text-sm text-gray-600'>{currentBill.description}</p>
        </div>
      )}

      {currentBill.vendor && (
        <div>
          <Label className='text-sm font-medium'>Vendor</Label>
          <p className='text-sm text-gray-600'>{currentBill.vendor}</p>
        </div>
      )}

      {currentBill.notes && (
        <div>
          <Label className='text-sm font-medium'>Notes</Label>
          <p className='text-sm text-gray-600'>{currentBill.notes}</p>
        </div>
      )}

      {/* End Date Management for Recurrent Bills */}
      {currentBill.paymentType === 'recurrent' && (
        <div className='border-t pt-4'>
          <Label className='text-sm font-medium'>Recurrence End Date</Label>
          <div className='flex items-center gap-2 mt-2'>
            <Input
              type='date'
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className='w-48'
            />
            <Button onClick={handleSetEndDate} disabled={updateBillMutation.isPending} size='sm'>
              {updateBillMutation.isPending ? 'Setting...' : 'Set End Date'}
            </Button>
          </div>
          <p className='text-xs text-gray-500 mt-1'>
            Setting an end date will stop auto-generation of future bills after this date.
          </p>
        </div>
      )}

      {/* Costs Breakdown */}
      {currentBill.costs && currentBill.costs.length > 1 && (
        <div>
          <Label className='text-sm font-medium'>Payment Breakdown</Label>
          <div className='space-y-1 mt-1'>
            {currentBill.costs.map((cost, index) => (
              <div key={index} className='flex justify-between text-sm'>
                <span>Payment {index + 1}:</span>
                <span>${Number(cost).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded Documents Section */}
      {(currentBill.filePath || billDocuments.length > 0) && (
        <div className='border-t pt-4'>
          <Label className='text-sm font-medium'>Uploaded Documents</Label>
          <div className='mt-2 space-y-2'>
            {/* Direct bill upload */}
            {currentBill.filePath && (
              <div className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
                <div className='flex items-center gap-2'>
                  <FileText className='w-4 h-4 text-blue-600' />
                  <span className='text-sm'>{currentBill.fileName}</span>
                  {currentBill.isAiAnalyzed && (
                    <Badge variant='outline' className='text-xs'>
                      AI Analyzed
                    </Badge>
                  )}
                </div>
                <div className='flex items-center gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      // View the document (open in new tab)
                      window.open(`/api/bills/${currentBill.id}/download-document`, '_blank');
                    }}
                    className='flex items-center gap-1'
                    data-testid={`button-view-document-${currentBill.id}`}
                  >
                    <FileText className='w-3 h-3' />
                    View
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      // Download the document
                      const link = document.createElement('a');
                      link.href = `/api/bills/${currentBill.id}/download-document`;
                      link.download = currentBill.fileName || 'bill-document';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className='flex items-center gap-1'
                    data-testid={`button-download-document-${currentBill.id}`}
                  >
                    <FileText className='w-3 h-3' />
                    Download
                  </Button>
                </div>
              </div>
            )}
            
            {/* Attached documents from documents table */}
            {billDocuments.map((doc: any) => (
              <div key={doc.id} className='flex items-center justify-between p-3 bg-blue-50 rounded-lg'>
                <div className='flex items-center gap-2'>
                  <FileText className='w-4 h-4 text-blue-600' />
                  <span className='text-sm'>{doc.name}</span>
                  <Badge variant='outline' className='text-xs'>
                    {doc.documentType || 'Document'}
                  </Badge>
                </div>
                <div className='flex items-center gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={async () => {
                      try {
                        // Use fetch with credentials to ensure authentication
                        const response = await fetch(`/api/documents/${doc.id}/file`, {
                          method: 'GET',
                          credentials: 'include', // Include authentication cookies
                        });

                        if (!response.ok) {
                          throw new Error(`View failed: ${response.status} ${response.statusText}`);
                        }

                        // Convert response to blob and open in new tab
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        
                        // Open in new tab
                        window.open(url, '_blank');
                        
                        // Clean up the URL after a delay to allow the tab to load
                        setTimeout(() => {
                          window.URL.revokeObjectURL(url);
                        }, 1000);
                        
                      } catch (error) {
                        console.error('View failed:', error);
                      }
                    }}
                    className='flex items-center gap-1'
                    data-testid={`button-view-document-${doc.id}`}
                  >
                    <FileText className='w-3 h-3' />
                    View
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={async () => {
                      try {
                        // Use fetch with credentials to ensure authentication
                        const response = await fetch(`/api/documents/${doc.id}/file?download=true`, {
                          method: 'GET',
                          credentials: 'include', // Include authentication cookies
                        });

                        if (!response.ok) {
                          throw new Error(`Download failed: ${response.status} ${response.statusText}`);
                        }

                        // Convert response to blob and create download
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = doc.fileName || doc.name || 'document';
                        document.body.appendChild(link);
                        link.click();
                        
                        // Clean up
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                        
                      } catch (error) {
                        console.error('Download failed:', error);
                      }
                    }}
                    className='flex items-center gap-1'
                    data-testid={`button-download-document-${doc.id}`}
                  >
                    <FileText className='w-3 h-3' />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className='flex justify-between items-center pt-4 border-t'>
        <Button
          onClick={onEditBill}
          className='flex items-center gap-1'
          data-testid={`button-edit-bill-${bill.id}`}
        >
          Edit Bill
        </Button>
        <Button variant='outline' onClick={onCancel} data-testid={`button-close-bill-modal-${bill.id}`}>
          Close
        </Button>
      </div>
    </div>
  );
}

// Export with hierarchical selection HOC - Manager buildings page uses 2-level hierarchy
export default withHierarchicalSelection(BillsPage, {
  hierarchy: ['organization', 'building']
});
