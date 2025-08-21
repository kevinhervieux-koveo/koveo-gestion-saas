import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileText, Plus, Upload, Filter, Calendar, Building as BuildingIcon, Tag, ChevronDown } from 'lucide-react';
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
  'other'
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
  other: 'Other'
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
  { value: '12', label: 'December' }
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
export default function Bills() {
  const [filters, setFilters] = useState<BillFilters>({
    buildingId: '',
    category: '',
    year: new Date().getFullYear().toString(),
    months: []
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAllYears, setShowAllYears] = useState(false);
  const queryClient = useQueryClient();

  // Fetch buildings for filter dropdown
  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings'],
  });

  // Fetch bills based on filters
  const { data: bills = [], isLoading } = useQuery<Bill[]>({
    queryKey: ['/api/bills', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.buildingId) {params.set('buildingId', filters.buildingId);}
      if (filters.category && filters.category !== 'all') {params.set('category', filters.category);}
      if (filters.year) {params.set('year', filters.year);}
      if (filters.months.length > 0) {params.set('months', filters.months.join(','));}
      
      const url = `/api/bills${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch bills: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: !!filters.buildingId
  });

  // Group bills by category
  const billsByCategory = bills.reduce((acc: Record<string, Bill[]>, bill: Bill) => {
    const category = bill.category || 'other';
    if (!acc[category]) {acc[category] = [];}
    acc[category].push(bill);
    return acc;
  }, {});

  const handleFilterChange = (key: keyof BillFilters, value: string | string[]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleMonthToggle = (monthValue: string) => {
    setFilters(prev => ({
      ...prev,
      months: prev.months.includes(monthValue)
        ? prev.months.filter(m => m !== monthValue)
        : [...prev.months, monthValue]
    }));
  };

  const handleAllMonthsToggle = () => {
    const allMonthValues = MONTHS.map(m => m.value);
    setFilters(prev => ({
      ...prev,
      months: prev.months.length === allMonthValues.length ? [] : allMonthValues
    }));
  };

  const getMonthsDisplayText = () => {
    if (filters.months.length === 0) return 'All months';
    if (filters.months.length === MONTHS.length) return 'All months';
    if (filters.months.length === 1) {
      const month = MONTHS.find(m => m.value === filters.months[0]);
      return month?.label || 'All months';
    }
    return `${filters.months.length} months`;
  };

  // Get building creation year for minimum year calculation
  const selectedBuilding = buildings.find(b => b.id === filters.buildingId);
  const buildingCreationYear = selectedBuilding?.createdAt ? new Date(selectedBuilding.createdAt).getFullYear() : new Date().getFullYear();
  const currentYear = new Date().getFullYear();

  // Generate year options based on show all years state
  const getYearOptions = () => {
    if (showAllYears) {
      // Show all years from building creation to 25 years forward
      const endYear = currentYear + 25;
      const totalYears = endYear - buildingCreationYear + 1;
      return Array.from({ length: totalYears }, (_, i) => buildingCreationYear + i);
    } else {
      // Show current year ±3 years, but respect building creation year as minimum
      const startYear = Math.max(currentYear - 3, buildingCreationYear);
      const endYear = currentYear + 3;
      const totalYears = endYear - startYear + 1;
      return Array.from({ length: totalYears }, (_, i) => startYear + i);
    }
  };

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
                  <Select value={filters.buildingId} onValueChange={(value) => handleFilterChange('buildingId', value)}>
                    <SelectTrigger id='building-filter'>
                      <SelectValue placeholder='Select building' />
                    </SelectTrigger>
                    <SelectContent>
                      {buildings.map((building: Building) => (
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
                  <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
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
                    <Select value={filters.year} onValueChange={(value) => handleFilterChange('year', value)}>
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
                              Show more years ({buildingCreationYear} - {currentYear + 25})
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
                        <Plus className='w-4 h-4 mr-2' />
                        Create Bill
                      </Button>
                    </DialogTrigger>
                    <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
                      <DialogHeader>
                        <DialogTitle>Create New Bill</DialogTitle>
                      </DialogHeader>
                      <BillCreateForm 
                        buildingId={filters.buildingId}
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
            <Card>
              <CardContent className='p-8 text-center'>
                <BuildingIcon className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>Select a Building</h3>
                <p className='text-gray-500'>Choose a building from the filter above to view and manage its bills</p>
              </CardContent>
            </Card>
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
                <FileText className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>No Bills Found</h3>
                <p className='text-gray-500 mb-4'>No bills found for the selected filters. Create your first bill to get started.</p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className='w-4 h-4 mr-2' />
                  Create First Bill
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className='space-y-6'>
              {BILL_CATEGORIES.filter(category => 
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
function BillCategorySection({ 
  category, 
  bills, 
  onBillUpdate 
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
function BillCard({ bill, onUpdate }: { bill: Bill; onUpdate: () => void }) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    sent: 'bg-blue-100 text-blue-800',
    overdue: 'bg-red-100 text-red-800',
    paid: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800'
  };

  return (
    <Card className='hover:shadow-md transition-shadow'>
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
          
          {bill.vendor && (
            <p className='text-xs text-gray-500'>Vendor: {bill.vendor}</p>
          )}
          
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Bill creation form component (placeholder for now)
/**
 *
 * @param root0
 * @param root0.buildingId
 * @param root0.onSuccess
 */
function BillCreateForm({ 
  buildingId, 
  onSuccess 
}: { 
  buildingId: string; 
  onSuccess: () => void; 
}) {
  return (
    <div className='space-y-4'>
      <Tabs defaultValue='manual' className='w-full'>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='manual'>Create Manually</TabsTrigger>
          <TabsTrigger value='upload'>Upload & Analyze</TabsTrigger>
        </TabsList>
        
        <TabsContent value='manual' className='space-y-4'>
          <div className='p-6 text-center border-2 border-dashed border-gray-200 rounded-lg'>
            <FileText className='w-12 h-12 mx-auto text-gray-400 mb-4' />
            <p className='text-gray-600'>Manual bill creation form</p>
            <p className='text-sm text-gray-500'>Coming next...</p>
          </div>
        </TabsContent>
        
        <TabsContent value='upload' className='space-y-4'>
          <div className='p-6 text-center border-2 border-dashed border-gray-200 rounded-lg'>
            <Upload className='w-12 h-12 mx-auto text-gray-400 mb-4' />
            <p className='text-gray-600'>Upload bill document for AI analysis</p>
            <p className='text-sm text-gray-500'>Coming next...</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
