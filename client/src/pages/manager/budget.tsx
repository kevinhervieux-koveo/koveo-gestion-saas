import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { DollarSign, Banknote, Settings, TrendingUp, Calculator, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { MonthlyBudget } from '@shared/schema';

interface BudgetData {
  year: number;
  month: number;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  incomeByCategory: { [category: string]: number };
  expensesByCategory: { [category: string]: number };
  date: string;
}

interface BankAccountInfo {
  bankAccountNumber: string | null;
  bankAccountNotes: string | null;
  bankAccountUpdatedAt: string | null;
}

export default function Budget() {
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [viewType, setViewType] = useState<'yearly' | 'monthly'>('monthly');
  const [showCategories, setShowCategories] = useState(false);
  const [bankAccountDialog, setBankAccountDialog] = useState(false);
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [reconciliationNote, setReconciliationNote] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  // Year range controls
  const currentYear = new Date().getFullYear();
  const [startYear, setStartYear] = useState(currentYear - 3);
  const [endYear, setEndYear] = useState(currentYear + 25);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get buildings for selection
  const { data: buildings = [] } = useQuery({
    queryKey: ['/api/buildings'],
  });

  // Get budget data
  const { data: budgetData, isLoading: budgetLoading } = useQuery({
    queryKey: ['/api/budgets', selectedBuilding, startYear, endYear, viewType],
    queryFn: () => fetch(`/api/budgets/${selectedBuilding}?startYear=${startYear}&endYear=${endYear}&groupBy=${viewType}`).then(res => res.json()),
    enabled: !!selectedBuilding,
  });

  // Get budget summary
  const { data: budgetSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['/api/budgets', selectedBuilding, 'summary', startYear, endYear],
    queryFn: () => fetch(`/api/budgets/${selectedBuilding}/summary?startYear=${startYear}&endYear=${endYear}`).then(res => res.json()),
    enabled: !!selectedBuilding,
  });

  // Get bank account info
  const { data: bankAccountInfo } = useQuery<BankAccountInfo>({
    queryKey: ['/api/budgets', selectedBuilding, 'bank-account'],
    queryFn: () => fetch(`/api/budgets/${selectedBuilding}/bank-account`).then(res => res.json()),
    enabled: !!selectedBuilding,
  });

  // Update bank account mutation
  const updateBankAccount = useMutation({
    mutationFn: async (data: { bankAccountNumber: string; reconciliationNote: string }) => {
      const response = await fetch(`/api/budgets/${selectedBuilding}/bank-account`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to update bank account');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Bank account updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/budgets', selectedBuilding, 'bank-account'] });
      setBankAccountDialog(false);
      setBankAccountNumber('');
      setReconciliationNote('');
    },
    onError: () => {
      toast({ title: 'Failed to update bank account', variant: 'destructive' });
    },
  });

  // Process chart data
  const chartData = useMemo(() => {
    if (!budgetSummary || !Array.isArray((budgetSummary as any)?.summary)) return [];
    
    return ((budgetSummary as any).summary as any[]).map((item: any) => {
      const totalIncome = item.incomes?.reduce((sum: number, income: string) => 
        sum + parseFloat(income || '0'), 0) || 0;
      const totalExpenses = item.spendings?.reduce((sum: number, expense: string) => 
        sum + parseFloat(expense || '0'), 0) || 0;
      
      // Build income and expense categories
      const incomeByCategory: { [key: string]: number } = {};
      const expensesByCategory: { [key: string]: number } = {};
      
      if (item.incomeTypes && item.incomes) {
        item.incomeTypes.forEach((type: string, index: number) => {
          incomeByCategory[type] = parseFloat(item.incomes[index] || '0');
        });
      }
      
      if (item.spendingTypes && item.spendings) {
        item.spendingTypes.forEach((type: string, index: number) => {
          expensesByCategory[type] = parseFloat(item.spendings[index] || '0');
        });
      }
      
      return {
        year: item.year,
        month: item.month,
        totalIncome,
        totalExpenses,
        netCashFlow: totalIncome - totalExpenses,
        incomeByCategory,
        expensesByCategory,
        date: `${item.year}-${String(item.month).padStart(2, '0')}`,
      };
    }).sort((a: BudgetData, b: BudgetData) => a.date.localeCompare(b.date));
  }, [budgetSummary]);

  // Category translation mapping
  const categoryTranslations: Record<string, { en: string; fr: string }> = {
    // Income categories
    'monthly_fees': { en: 'Monthly Fees', fr: 'Frais mensuels' },
    'parking_fees': { en: 'Parking Fees', fr: 'Frais de stationnement' },
    'other_income': { en: 'Other Income', fr: 'Autres revenus' },
    'special_assessment': { en: 'Special Assessment', fr: 'Cotisation spéciale' },
    'interest_income': { en: 'Interest Income', fr: "Revenus d'intérêts" },
    'rental_income': { en: 'Rental Income', fr: 'Revenus de location' },
    
    // Expense categories
    'maintenance_expense': { en: 'Maintenance', fr: 'Entretien' },
    'utilities': { en: 'Utilities', fr: 'Services publics' },
    'insurance': { en: 'Insurance', fr: 'Assurance' },
    'administrative_expense': { en: 'Administration', fr: 'Administration' },
    'cleaning': { en: 'Cleaning', fr: 'Nettoyage' },
    'professional_services': { en: 'Professional Services', fr: 'Services professionnels' },
    'bill_payment': { en: 'Bill Payment', fr: 'Paiement de factures' },
    'repairs': { en: 'Repairs', fr: 'Réparations' },
    'landscaping': { en: 'Landscaping', fr: 'Aménagement paysager' },
    'snow_removal': { en: 'Snow Removal', fr: 'Déneigement' },
    'security': { en: 'Security', fr: 'Sécurité' },
    'legal_fees': { en: 'Legal Fees', fr: 'Frais juridiques' },
  };
  
  const translateCategory = (category: string) => {
    const translation = categoryTranslations[category];
    if (translation) {
      return language === 'fr' ? translation.fr : translation.en;
    }
    // Fallback: capitalize and replace underscores
    return category.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };
  
  // Get all available categories with translations
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    chartData.forEach((item) => {
      Object.keys(item.incomeByCategory).forEach(cat => {
        const translated = translateCategory(cat);
        categories.add(`${language === 'fr' ? 'Revenus' : 'Income'}: ${translated}`);
      });
      Object.keys(item.expensesByCategory).forEach(cat => {
        const translated = translateCategory(cat);
        categories.add(`${language === 'fr' ? 'Dépenses' : 'Expense'}: ${translated}`);
      });
    });
    return Array.from(categories).sort();
  }, [chartData, language]);

  // Filter data by selected categories
  const filteredChartData = useMemo(() => {
    if (selectedCategories.length === 0) return chartData;
    
    return chartData.map(item => {
      let filteredIncome = 0;
      let filteredExpenses = 0;
      
      selectedCategories.forEach(category => {
        const incomePrefix = language === 'fr' ? 'Revenus: ' : 'Income: ';
        const expensePrefix = language === 'fr' ? 'Dépenses: ' : 'Expense: ';
        
        if (category.startsWith(incomePrefix)) {
          const translatedCatName = category.replace(incomePrefix, '');
          // Find original category name from translation
          const originalCatName = Object.keys(item.incomeByCategory).find(key => {
            return translateCategory(key) === translatedCatName;
          });
          if (originalCatName) {
            filteredIncome += item.incomeByCategory[originalCatName] || 0;
          }
        } else if (category.startsWith(expensePrefix)) {
          const translatedCatName = category.replace(expensePrefix, '');
          // Find original category name from translation
          const originalCatName = Object.keys(item.expensesByCategory).find(key => {
            return translateCategory(key) === translatedCatName;
          });
          if (originalCatName) {
            filteredExpenses += item.expensesByCategory[originalCatName] || 0;
          }
        }
      });
      
      return {
        ...item,
        totalIncome: selectedCategories.length ? filteredIncome : item.totalIncome,
        totalExpenses: selectedCategories.length ? filteredExpenses : item.totalExpenses,
        netCashFlow: (selectedCategories.length ? filteredIncome : item.totalIncome) - 
                     (selectedCategories.length ? filteredExpenses : item.totalExpenses),
      };
    });
  }, [chartData, selectedCategories]);

  const chartConfig = {
    totalIncome: {
      label: 'Income',
      color: 'hsl(120, 70%, 50%)',
    },
    totalExpenses: {
      label: 'Expenses', 
      color: 'hsl(0, 70%, 50%)',
    },
    netCashFlow: {
      label: 'Net Cash Flow',
      color: 'hsl(210, 70%, 50%)',
    },
  };

  const handleUpdateBankAccount = () => {
    if (!bankAccountNumber.trim()) {
      toast({ title: 'Please enter a bank account number', variant: 'destructive' });
      return;
    }
    updateBankAccount.mutate({ 
      bankAccountNumber: bankAccountNumber.trim(), 
      reconciliationNote: reconciliationNote.trim() 
    });
  };

  return (
    <div className='flex-1 flex flex-col overflow-hidden'>
      <Header title='Budget Dashboard' subtitle='Monitor financial performance and cash flow' />

      <div className='flex-1 overflow-auto p-6'>
        <div className='max-w-7xl mx-auto space-y-6'>
          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Settings className='w-5 h-5' />
                Dashboard Controls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 md:grid-cols-6 gap-4'>
                <div className='space-y-2'>
                  <Label>Building</Label>
                  <Select value={selectedBuilding} onValueChange={setSelectedBuilding}>
                    <SelectTrigger>
                      <SelectValue placeholder='Select a building' />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(buildings) && buildings.map((building: any) => (
                        <SelectItem key={building.id} value={building.id}>
                          {building.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className='space-y-2'>
                  <Label>View Type</Label>
                  <Select value={viewType} onValueChange={(value: 'yearly' | 'monthly') => setViewType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='monthly'>Monthly View</SelectItem>
                      <SelectItem value='yearly'>Yearly View</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className='space-y-2'>
                  <Label>Start Year</Label>
                  <Select value={startYear.toString()} onValueChange={(value) => setStartYear(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => currentYear - 5 + i).map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className='space-y-2'>
                  <Label>End Year</Label>
                  <Select value={endYear.toString()} onValueChange={(value) => setEndYear(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 30 }, (_, i) => currentYear + i).map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className='flex flex-col justify-end space-y-2'>
                  <Button 
                    variant='outline' 
                    onClick={() => setShowCategories(!showCategories)}
                    className='flex items-center gap-2'
                  >
                    <Filter className='w-4 h-4' />
                    {showCategories ? 'Hide' : 'Show'} Categories
                  </Button>
                </div>
                
                <div className='flex flex-col justify-end space-y-2'>
                  <Button 
                    variant='outline' 
                    onClick={() => {
                      setStartYear(currentYear - 3);
                      setEndYear(currentYear + 25);
                    }}
                    className='flex items-center gap-2'
                  >
                    Reset Range
                  </Button>
                </div>
              </div>
              
              {showCategories && (
                <div className='mt-4 space-y-2'>
                  <Label>Filter by Categories</Label>
                  <div className='grid grid-cols-2 md:grid-cols-4 gap-2 max-h-32 overflow-y-auto'>
                    {availableCategories.map((category) => (
                      <label key={category} className='flex items-center space-x-2 text-sm'>
                        <input
                          type='checkbox'
                          checked={selectedCategories.includes(category)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategories([...selectedCategories, category]);
                            } else {
                              setSelectedCategories(selectedCategories.filter(c => c !== category));
                            }
                          }}
                          className='rounded'
                        />
                        <span>{category}</span>
                      </label>
                    ))}
                  </div>
                  {selectedCategories.length > 0 && (
                    <Button 
                      variant='outline' 
                      size='sm' 
                      onClick={() => setSelectedCategories([])}
                    >
                      Clear All Filters
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {!selectedBuilding ? (
            <Card>
              <CardContent className='p-8 text-center'>
                <DollarSign className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>Select a Building</h3>
                <p className='text-gray-500'>Choose a building above to view its budget dashboard</p>
              </CardContent>
            </Card>
          ) : budgetLoading || summaryLoading ? (
            <Card>
              <CardContent className='p-8 text-center'>
                <div className='animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4'></div>
                <p className='text-gray-500'>Loading budget data...</p>
              </CardContent>
            </Card>
          ) : chartData.length === 0 ? (
            <Card>
              <CardContent className='p-8 text-center'>
                <TrendingUp className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>No Budget Data</h3>
                <p className='text-gray-500'>No budget data available for the selected time period</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Cards */
              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-medium'>Total Income</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold text-green-600'>
                      ${filteredChartData.reduce((sum, item) => sum + item.totalIncome, 0).toLocaleString()}
                    </div>
                    <p className='text-xs text-muted-foreground mt-1'>
                      Across {filteredChartData.length} months
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-medium'>Total Expenses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold text-red-600'>
                      ${filteredChartData.reduce((sum, item) => sum + item.totalExpenses, 0).toLocaleString()}
                    </div>
                    <p className='text-xs text-muted-foreground mt-1'>
                      Across {filteredChartData.length} months
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-medium'>Net Cash Flow</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${
                      filteredChartData.reduce((sum, item) => sum + item.netCashFlow, 0) >= 0 
                        ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${filteredChartData.reduce((sum, item) => sum + item.netCashFlow, 0).toLocaleString()}
                    </div>
                    <p className='text-xs text-muted-foreground mt-1'>
                      Net position
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Area Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <TrendingUp className='w-5 h-5' />
                    Financial Trends ({startYear} - {endYear})
                  </CardTitle>
                  {selectedCategories.length > 0 && (
                    <div className='text-sm text-muted-foreground'>
                      Filtered by: {selectedCategories.join(', ')}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className='h-[400px]'>
                    <AreaChart data={filteredChartData}>
                      <defs>
                        <linearGradient id='colorIncome' x1='0' y1='0' x2='0' y2='1'>
                          <stop offset='5%' stopColor='hsl(120, 70%, 50%)' stopOpacity={0.8}/>
                          <stop offset='95%' stopColor='hsl(120, 70%, 50%)' stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id='colorExpenses' x1='0' y1='0' x2='0' y2='1'>
                          <stop offset='5%' stopColor='hsl(0, 70%, 50%)' stopOpacity={0.8}/>
                          <stop offset='95%' stopColor='hsl(0, 70%, 50%)' stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray='3 3' />
                      <XAxis 
                        dataKey='date' 
                        tickFormatter={(value) => {
                          const [year, month] = value.split('-');
                          return `${year}-${month}`;
                        }}
                      />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <ChartTooltip 
                        content={<ChartTooltipContent />}
                        labelFormatter={(value) => {
                          const [year, month] = value.split('-');
                          return `${year}-${month}`;
                        }}
                        formatter={(value: number, name: string) => [
                          `$${value.toLocaleString()}`,
                          chartConfig[name as keyof typeof chartConfig]?.label || name
                        ]}
                      />
                      <Area
                        type='monotone'
                        dataKey='totalIncome'
                        stroke='hsl(120, 70%, 50%)'
                        fill='url(#colorIncome)'
                        strokeWidth={2}
                      />
                      <Area
                        type='monotone'
                        dataKey='totalExpenses'
                        stroke='hsl(0, 70%, 50%)'
                        fill='url(#colorExpenses)'
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </>
          )}
          
          {/* Bank Account Card - positioned after dashboard */}
          {selectedBuilding && (
            <Card className='mt-6'>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Banknote className='w-5 h-5' />
                  Bank Account Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  {bankAccountInfo?.bankAccountNumber ? (
                    <div className='p-4 bg-muted rounded-lg'>
                      <div className='flex items-center justify-between mb-2'>
                        <span className='font-medium'>Current Account:</span>
                        <span className='font-mono'>{bankAccountInfo.bankAccountNumber}</span>
                      </div>
                      {bankAccountInfo.bankAccountNotes && (
                        <div className='text-sm text-muted-foreground'>
                          <strong>Last Note:</strong> {bankAccountInfo.bankAccountNotes}
                        </div>
                      )}
                      {bankAccountInfo.bankAccountUpdatedAt && (
                        <div className='text-xs text-muted-foreground mt-1'>
                          Updated: {new Date(bankAccountInfo.bankAccountUpdatedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className='p-4 border-2 border-dashed rounded-lg text-center text-muted-foreground'>
                      No bank account set for this building
                    </div>
                  )}
                  
                  <Dialog open={bankAccountDialog} onOpenChange={setBankAccountDialog}>
                    <DialogTrigger asChild>
                      <Button className='w-full' variant='outline'>
                        <Banknote className='w-4 h-4 mr-2' />
                        {bankAccountInfo?.bankAccountNumber ? 'Update Account' : 'Set Bank Account'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Update Bank Account</DialogTitle>
                        <DialogDescription>
                          Update the bank account number for this building. This will override the previous number and add a reconciliation note.
                        </DialogDescription>
                      </DialogHeader>
                      <div className='space-y-4'>
                        <div className='space-y-2'>
                          <Label htmlFor='bankAccount'>Bank Account Number</Label>
                          <Input
                            id='bankAccount'
                            value={bankAccountNumber}
                            onChange={(e) => setBankAccountNumber(e.target.value)}
                            placeholder='Enter bank account number'
                          />
                        </div>
                        <div className='space-y-2'>
                          <Label htmlFor='reconciliationNote'>Reconciliation Note</Label>
                          <Textarea
                            id='reconciliationNote'
                            value={reconciliationNote}
                            onChange={(e) => setReconciliationNote(e.target.value)}
                            placeholder='Enter reconciliation note for this change...'
                            rows={3}
                          />
                        </div>
                        {bankAccountInfo?.bankAccountNumber && (
                          <div className='p-3 bg-muted rounded-lg'>
                            <p className='text-sm'><strong>Current:</strong> {bankAccountInfo.bankAccountNumber}</p>
                            {bankAccountInfo.bankAccountNotes && (
                              <p className='text-sm text-muted-foreground mt-1'>
                                <strong>Last Note:</strong> {bankAccountInfo.bankAccountNotes}
                              </p>
                            )}
                          </div>
                        )}
                        <div className='flex justify-end space-x-2'>
                          <Button variant='outline' onClick={() => setBankAccountDialog(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleUpdateBankAccount} disabled={updateBankAccount.isPending}>
                            {updateBankAccount.isPending ? 'Updating...' : 'Update Account'}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
