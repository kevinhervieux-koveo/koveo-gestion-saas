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
import { FileText, Plus, Upload, Filter, Calendar, Building as BuildingIcon, Tag } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
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

/**
 *
 */
interface BillFilters {
  buildingId: string;
  category: string;
  year: string;
}

/**
 *
 */
export default function Bills() {
  const [filters, setFilters] = useState<BillFilters>({
    buildingId: '',
    category: '',
    year: new Date().getFullYear().toString()
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
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

  const handleFilterChange = (key: keyof BillFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
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
              <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
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
                  <Select value={filters.year} onValueChange={(value) => handleFilterChange('year', value)}>
                    <SelectTrigger id='year-filter'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = new Date().getFullYear() - i;
                        return (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
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
