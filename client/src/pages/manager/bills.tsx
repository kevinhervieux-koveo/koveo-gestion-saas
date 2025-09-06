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
  Building as BuildingIcon,
  Tag,
  ChevronDown,
} from 'lucide-react';
import { BillEditForm } from '@/components/BillEditForm';
import { BuildingSelectionGrid } from '@/components/BuildingSelectionGrid';
import { BillCreateForm } from '@/components/BillCreateForm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import type { Building, Bill } from '@shared/schema';

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

const CATEGORY_LABELS: Record<string, string> = {
  insurance: 'Insurance',
  maintenance: 'Maintenance',
  salary: 'Salary',
  utilities: 'Utilities',
  cleaning: 'Cleaning',
  security: 'Security',
  landscaping: 'Landscaping',
  professional_services: 'Professional Services',
  administration: 'Administration',
  repairs: 'Repairs',
  supplies: 'Supplies',
  taxes: 'Taxes',
  other: 'Other',
};

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

/**
 *
 */
interface BillFilters {
  buildingId: string;
  category: string;
  year: string;
  months: string[];
}

/**
 *
 */
export default function /**
 * Bills function.
 */ /**
 * Bills function.
 */

Bills() {
  const [filters, setFilters] = useState<BillFilters>({
    buildingId: '',
    category: '',
    year: new Date().getFullYear().toString(),
    months: [],
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAllYears, setShowAllYears] = useState(false);
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

  // Fetch bills based on filters
  const { data: bills = [], isLoading } = useQuery<Bill[]>({
    queryKey: ['/api/bills', filters],
    queryFn: async () => {
      const params = new URLSearchParams(); /**
       * If function.
       * @param filters.buildingId - Filters.buildingId parameter.
       */ /**
       * If function.
       * @param filters.buildingId - Filters.buildingId parameter.
       */

      if (filters.buildingId) {
        params.set('buildingId', filters.buildingId);
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

  // Get building construction year for minimum year calculation
  const selectedBuilding = Array.isArray(buildings)
    ? buildings.find((b) => b.id === filters.buildingId)
    : undefined;
  const buildingConstructionYear = selectedBuilding?.yearBuilt || new Date().getFullYear();
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
      // Show all years from building construction year to 25 years forward
      const startYear = buildingConstructionYear;
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

  // Show loading state while buildings are loading
  if (buildingsLoading) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='Bills Management' subtitle='Manage building expenses and revenue tracking' />
        <div className='flex-1 flex items-center justify-center'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4'></div>
            <p className='text-gray-500'>Loading buildings...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if buildings failed to load
  if (buildingsError) {
    return (
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header title='Bills Management' subtitle='Manage building expenses and revenue tracking' />
        <div className='flex-1 flex items-center justify-center'>
          <div className='text-center'>
            <p className='text-red-500 mb-4'>Failed to load buildings</p>
            <button
              onClick={() => window.location.reload()}
              className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='Bills Management' subtitle='Manage building expenses and revenue tracking' />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Filters Section */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Filter className='w-5 h-5' />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='building-filter' className='flex items-center gap-2'>
                    <BuildingIcon className='w-4 h-4' />
                    Building
                  </Label>
                  <Select
                    value={filters.buildingId}
                    onValueChange={(value) => handleFilterChange('buildingId', value)}
                  >
                    <SelectTrigger id='building-filter'>
                      <SelectValue placeholder='Select building' />
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

                <div className='space-y-2'>
                  <Label htmlFor='category-filter' className='flex items-center gap-2'>
                    <Tag className='w-4 h-4' />
                    Category
                  </Label>
                  <Select
                    value={filters.category}
                    onValueChange={(value) => handleFilterChange('category', value)}
                  >
                    <SelectTrigger id='category-filter'>
                      <SelectValue placeholder='All categories' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>All categories</SelectItem>
                      {BILL_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {CATEGORY_LABELS[category]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='year-filter' className='flex items-center gap-2'>
                    <Calendar className='w-4 h-4' />
                    Year
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
                              Show more years ({buildingConstructionYear} - {currentYear + 25})
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
                    Months
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
                      <Button className='w-full' disabled={!filters.buildingId}>
                        Create Bill
                      </Button>
                    </DialogTrigger>
                    <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
                      <DialogHeader>
                        <DialogTitle>Create New Bill</DialogTitle>
                      </DialogHeader>
                      <BillCreateForm
                        buildingId={filters.buildingId}
                        onClose={() => setShowCreateDialog(false)}
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
                <p className='text-gray-500'>Loading bills...</p>
              </CardContent>
            </Card>
          ) : Object.keys(billsByCategory).length === 0 ? (
            <Card>
              <CardContent className='p-8 text-center'>
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>No Bills Found</h3>
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
}: {
  category: string;
  bills: Bill[];
  onBillUpdate: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Tag className='w-5 h-5' />
            {CATEGORY_LABELS[category]}
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
              {bill.documentPath && (
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
        <DialogContent className='max-w-2xl max-h-[95vh] overflow-y-auto'>
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
        <DialogContent className='max-w-4xl max-h-[95vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Edit Bill</DialogTitle>
          </DialogHeader>
          <BillEditForm
            bill={bill}
            onSuccess={() => {
              setShowEditDialog(false);
              onUpdate();
            }}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// Bill detail and edit form
/**
 *
 * @param root0
 * @param root0.bill
 * @param root0.onSuccess
 * @param root0.onCancel
 */
/**
 * BillDetail function.
 * @param root0
 * @param root0.bill
 * @param root0.onSuccess
 * @param root0.onCancel
 * @returns Function result.
 */
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
  const [isEditing, setIsEditing] = useState(false);
  const [endDate, setEndDate] = useState(bill.endDate || '');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const queryClient = useQueryClient();

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
    /**
     * If function.
     * @param endDate - EndDate parameter.
     */ /**
     * If function.
     * @param endDate - EndDate parameter.
     */

    if (endDate) {
      updateBillMutation.mutate({ endDate });
    }
  };

  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('document', file);

      const response = await fetch(`/api/bills/${bill.id}/upload-document`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload document');
      }

      return response.json();
    },
    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bills'] });
      setUploadedFile(null);
      onSuccess();
    },
  });

  const applyAiAnalysisMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/bills/${bill.id}/apply-ai-analysis`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to apply AI analysis');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bills'] });
      onSuccess();
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; /**
     * If function.
     * @param file - File parameter.
     */ /**
     * If function.
     * @param file - File parameter.
     */

    if (file) {
      setUploadedFile(file);
      setIsAnalyzing(true);
      uploadDocumentMutation.mutate(file);
    }
  };

  const handleApplyAiAnalysis = () => {
    applyAiAnalysisMutation.mutate();
  };

  return (
    <div className='space-y-6'>
      {/* Bill Information */}
      <div className='grid grid-cols-2 gap-4'>
        <div>
          <Label className='text-sm font-medium'>Bill Number</Label>
          <p className='text-sm text-gray-600'>{bill.billNumber}</p>
        </div>
        <div>
          <Label className='text-sm font-medium'>Status</Label>
          <p className='text-sm text-gray-600 capitalize'>{bill.status}</p>
        </div>
        <div>
          <Label className='text-sm font-medium'>Category</Label>
          <p className='text-sm text-gray-600 capitalize'>{bill.category}</p>
        </div>
        <div>
          <Label className='text-sm font-medium'>Payment Type</Label>
          <p className='text-sm text-gray-600 capitalize'>{bill.paymentType}</p>
        </div>
        <div>
          <Label className='text-sm font-medium'>Total Amount</Label>
          <p className='text-sm text-gray-600'>${Number(bill.totalAmount).toLocaleString()}</p>
        </div>
        <div>
          <Label className='text-sm font-medium'>Start Date</Label>
          <p className='text-sm text-gray-600'>{bill.startDate}</p>
        </div>
      </div>

      {/* Title and Description */}
      <div>
        <Label className='text-sm font-medium'>Title</Label>
        <p className='text-sm text-gray-600'>{bill.title}</p>
      </div>

      {bill.description && (
        <div>
          <Label className='text-sm font-medium'>Description</Label>
          <p className='text-sm text-gray-600'>{bill.description}</p>
        </div>
      )}

      {bill.vendor && (
        <div>
          <Label className='text-sm font-medium'>Vendor</Label>
          <p className='text-sm text-gray-600'>{bill.vendor}</p>
        </div>
      )}

      {bill.notes && (
        <div>
          <Label className='text-sm font-medium'>Notes</Label>
          <p className='text-sm text-gray-600'>{bill.notes}</p>
        </div>
      )}

      {/* End Date Management for Recurrent Bills */}
      {bill.paymentType === 'recurrent' && (
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
      {bill.costs && bill.costs.length > 1 && (
        <div>
          <Label className='text-sm font-medium'>Payment Breakdown</Label>
          <div className='space-y-1 mt-1'>
            {bill.costs.map((cost, index) => (
              <div key={index} className='flex justify-between text-sm'>
                <span>Payment {index + 1}:</span>
                <span>${Number(cost).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document Section */}
      <div className='border-t pt-4'>
        <Label className='text-sm font-medium'>
          {bill.documentPath ? 'Uploaded Document' : 'Document Upload & AI Analysis'}
        </Label>
        <div className='mt-2 space-y-3'>
          {/* Current document info */}
          {bill.documentPath ? (
            <div className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
              <div className='flex items-center gap-2'>
                <FileText className='w-4 h-4 text-blue-600' />
                <span className='text-sm'>{bill.documentName}</span>
                {bill.isAiAnalyzed && (
                  <Badge variant='outline' className='text-xs'>
                    AI Analyzed
                  </Badge>
                )}
              </div>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  // Download the document
                  const link = document.createElement('a');
                  link.href = `/api/bills/${bill.id}/download-document`;
                  link.download = bill.documentName || 'bill-document';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className='flex items-center gap-1'
                data-testid={`button-download-document-${bill.id}`}
              >
                <FileText className='w-3 h-3' />
                Download
              </Button>
            </div>
          ) : (
            /* File upload only when no document exists */
            <div className='flex items-center gap-2'>
              <Input
                type='file'
                accept='image/*,.pdf'
                onChange={handleFileUpload}
                disabled={uploadDocumentMutation.isPending}
                className='flex-1'
              />
              {uploadDocumentMutation.isPending && (
                <div className='text-sm text-gray-500'>Uploading & analyzing...</div>
              )}
            </div>
          )}

          {/* AI Analysis Actions */}
          {bill.isAiAnalyzed && bill.aiAnalysisData && (
            <div className='space-y-2'>
              <div className='p-3 bg-blue-50 rounded-lg'>
                <div className='text-sm font-medium text-blue-800'>AI Analysis Available</div>
                <div className='text-xs text-blue-600 mt-1'>
                  Confidence: {((bill.aiAnalysisData as any).confidence * 100).toFixed(1)}%
                </div>
              </div>
              <Button
                onClick={handleApplyAiAnalysis}
                disabled={applyAiAnalysisMutation.isPending}
                variant='outline'
                size='sm'
                className='w-full'
              >
                {applyAiAnalysisMutation.isPending ? 'Applying...' : 'Apply AI Analysis to Form'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Mode Toggle */}
      <div className='border-t pt-4'>
        <div className='flex items-center justify-between'>
          <Label className='text-sm font-medium'>Edit Bill Information</Label>
          <Button onClick={onEditBill} variant='outline' size='sm'>
            Edit Bill
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className='flex justify-end gap-2 pt-4 border-t'>
        <Button variant='outline' onClick={onCancel}>
          Close
        </Button>
      </div>
    </div>
  );
}
