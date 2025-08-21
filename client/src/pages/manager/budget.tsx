import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/hooks/use-language';
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
import { DollarSign, Banknote, Settings, TrendingUp, Calculator, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
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
  const { language } = useLanguage();
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [viewType, setViewType] = useState<'yearly' | 'monthly'>('monthly');
  const [showCategories, setShowCategories] = useState(false);
  const [bankAccountDialog, setBankAccountDialog] = useState(false);
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [reconciliationNote, setReconciliationNote] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  
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

  // Transform raw data into chart-friendly format
  const chartData: BudgetData[] = useMemo(() => {
    if (!budgetSummary?.summary) return [];
    
    return budgetSummary.summary.map((item: any) => {
      const totalIncome = item.incomes ? 
        item.incomes.reduce((sum: number, income: string) => sum + parseFloat(income || '0'), 0) : 0;
      const totalExpenses = item.spendings ? 
        item.spendings.reduce((sum: number, expense: string) => sum + parseFloat(expense || '0'), 0) : 0;
      
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
      label: language === 'fr' ? 'Revenus Totaux' : 'Total Income',
      color: 'hsl(120, 70%, 50%)',
    },
    totalExpenses: {
      label: language === 'fr' ? 'Dépenses Totales' : 'Total Expenses', 
      color: 'hsl(0, 70%, 50%)',
    },
  };

  // Update bank account mutation
  const updateBankAccount = useMutation({
    mutationFn: async (data: { buildingId: string; bankAccountNumber: string; notes: string }) => {
      const response = await fetch(`/api/budgets/${data.buildingId}/bank-account`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bankAccountNumber: data.bankAccountNumber,
          bankAccountNotes: data.notes,
        }),
      });
      if (!response.ok) throw new Error('Failed to update bank account');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/budgets', selectedBuilding, 'bank-account'] });
      setBankAccountDialog(false);
      setBankAccountNumber('');
      setReconciliationNote('');
      toast({
        title: language === 'fr' ? 'Compte bancaire mis à jour' : 'Bank account updated',
        description: language === 'fr' ? 
          'Le numéro de compte bancaire a été mis à jour avec succès.' : 
          'Bank account number has been updated successfully.',
      });
    },
    onError: () => {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr' ? 
          'Impossible de mettre à jour le compte bancaire.' : 
          'Failed to update bank account.',
        variant: 'destructive',
      });
    }
  });

  const handleUpdateBankAccount = () => {
    if (!selectedBuilding || !bankAccountNumber.trim()) {
      toast({
        title: language === 'fr' ? 'Champs requis' : 'Required fields',
        description: language === 'fr' ? 
          'Veuillez saisir un numéro de compte bancaire.' : 
          'Please enter a bank account number.',
        variant: 'destructive',
      });
      return;
    }

    updateBankAccount.mutate({
      buildingId: selectedBuilding,
      bankAccountNumber: bankAccountNumber.trim(),
      notes: reconciliationNote.trim(),
    });
  };

  return (
    <div className='min-h-screen bg-gray-50'>
      <Header 
        title={language === 'fr' ? 'Tableau de bord budgétaire' : 'Budget Dashboard'}
        subtitle={language === 'fr' ? 
          'Surveillez les performances financières et les flux de trésorerie' :
          'Monitor financial performance and cash flow'
        }
      />
      <div className='max-w-7xl mx-auto p-6 space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-gray-900'>
              {language === 'fr' ? 'Tableau de bord budgétaire' : 'Budget Dashboard'}
            </h1>
            <p className='text-gray-600'>
              {language === 'fr' ? 
                'Surveillez les performances financières et les flux de trésorerie' :
                'Monitor financial performance and cash flow'
              }
            </p>
          </div>
        </div>

        <div className='space-y-6'>
          <Card>
            <CardHeader className='pb-4'>
              <CardTitle className='flex items-center gap-2'>
                <Settings className='w-5 h-5' />
                {language === 'fr' ? 'Contrôles du tableau de bord' : 'Dashboard Controls'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Collapsible Filter Toggle */}
              <div className='flex items-center justify-between mb-4'>
                <div className='flex items-center gap-4'>
                  <Button 
                    variant='outline' 
                    onClick={() => setFiltersExpanded(!filtersExpanded)}
                    className='flex items-center gap-2'
                  >
                    <Filter className='w-4 h-4' />
                    {language === 'fr' ? 'Filtres' : 'Filters'}
                    {filtersExpanded ? <ChevronUp className='w-4 h-4' /> : <ChevronDown className='w-4 h-4' />}
                  </Button>
                  
                  {/* Filter Actions */}
                  <div className='flex items-center gap-2'>
                    <Button 
                      variant='outline' 
                      size='sm'
                      onClick={() => {
                        setStartYear(currentYear - 3);
                        setEndYear(currentYear + 25);
                      }}
                      className='flex items-center gap-1'
                    >
                      <Settings className='w-3 h-3' />
                      {language === 'fr' ? 'Réinitialiser' : 'Reset'}
                    </Button>
                    
                    <Button 
                      variant='outline' 
                      size='sm'
                      onClick={() => setShowCategories(!showCategories)}
                      className={`flex items-center gap-1 ${showCategories ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}
                    >
                      <Filter className='w-3 h-3' />
                      {language === 'fr' ? 'Catégories' : 'Categories'}
                    </Button>
                  </div>
                </div>
                
                {/* Active Filters Count */}
                {(selectedCategories.length > 0 || startYear !== (currentYear - 3) || endYear !== (currentYear + 25)) && (
                  <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <span>
                      {language === 'fr' ? 'Filtres actifs:' : 'Active filters:'}
                    </span>
                    <div className='flex gap-1'>
                      {selectedCategories.length > 0 && (
                        <span className='px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs'>
                          {selectedCategories.length} {language === 'fr' ? 'catégories' : 'categories'}
                        </span>
                      )}
                      {(startYear !== (currentYear - 3) || endYear !== (currentYear + 25)) && (
                        <span className='px-2 py-1 bg-green-100 text-green-700 rounded text-xs'>
                          {startYear} - {endYear}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Expandable Filter Controls */}
              {filtersExpanded && (
                <div className='space-y-4 border-t pt-4'>
                  <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>{language === 'fr' ? 'Bâtiment' : 'Building'}</Label>
                      <Select value={selectedBuilding} onValueChange={setSelectedBuilding}>
                        <SelectTrigger className='h-9'>
                          <SelectValue placeholder={language === 'fr' ? 'Sélectionner...' : 'Select...'} />
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
                      <Label className='text-sm font-medium'>{language === 'fr' ? 'Type de vue' : 'View Type'}</Label>
                      <Select value={viewType} onValueChange={(value: 'yearly' | 'monthly') => setViewType(value)}>
                        <SelectTrigger className='h-9'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='monthly'>{language === 'fr' ? 'Mensuelle' : 'Monthly'}</SelectItem>
                          <SelectItem value='yearly'>{language === 'fr' ? 'Annuelle' : 'Yearly'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>{language === 'fr' ? 'De' : 'From'}</Label>
                      <Select value={startYear.toString()} onValueChange={(value) => setStartYear(parseInt(value))}>
                        <SelectTrigger className='h-9'>
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
                      <Label className='text-sm font-medium'>{language === 'fr' ? 'À' : 'To'}</Label>
                      <Select value={endYear.toString()} onValueChange={(value) => setEndYear(parseInt(value))}>
                        <SelectTrigger className='h-9'>
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
                  </div>
                </div>
              )}
              
              {/* Category Filters */}
              {showCategories && (
                <div className='mt-4 space-y-3 border-t pt-4'>
                  <div className='flex items-center justify-between'>
                    <Label className='text-sm font-medium'>
                      {language === 'fr' ? 'Filtrer par catégories' : 'Filter by Categories'}
                    </Label>
                    <div className='flex items-center gap-2'>
                      {selectedCategories.length > 0 && (
                        <span className='text-xs text-muted-foreground'>
                          {selectedCategories.length} {language === 'fr' ? 'sélectionnées' : 'selected'}
                        </span>
                      )}
                      <Button 
                        variant='ghost' 
                        size='sm' 
                        onClick={() => setSelectedCategories([])}  
                        disabled={selectedCategories.length === 0}
                        className='h-6 px-2 text-xs'
                      >
                        <X className='w-3 h-3 mr-1' />
                        {language === 'fr' ? 'Effacer' : 'Clear'}
                      </Button>
                    </div>
                  </div>
                  
                  <div className='max-h-40 overflow-y-auto border rounded-md p-3'>
                    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2'>
                      {availableCategories.map((category) => (
                        <label key={category} className='flex items-center space-x-2 text-sm hover:bg-muted/50 p-1 rounded cursor-pointer'>
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
                            className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2'
                          />
                          <span className='truncate'>{category}</span>
                        </label>
                      ))}
                    </div>
                    
                    {availableCategories.length === 0 && (
                      <div className='text-center py-4 text-sm text-muted-foreground'>
                        {language === 'fr' ? 'Aucune catégorie disponible' : 'No categories available'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {!selectedBuilding ? (
            <Card>
              <CardContent className='p-8 text-center'>
                <DollarSign className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>
                  {language === 'fr' ? 'Sélectionnez un bâtiment' : 'Select a Building'}
                </h3>
                <p className='text-gray-500'>
                  {language === 'fr' ? 
                    'Choisissez un bâtiment ci-dessus pour voir son tableau de bord budgétaire' :
                    'Choose a building above to view its budget dashboard'
                  }
                </p>
              </CardContent>
            </Card>
          ) : budgetLoading || summaryLoading ? (
            <Card>
              <CardContent className='p-8 text-center'>
                <div className='animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4'></div>
                <p className='text-gray-500'>
                  {language === 'fr' ? 'Chargement des données budgétaires...' : 'Loading budget data...'}
                </p>
              </CardContent>
            </Card>
          ) : chartData.length === 0 ? (
            <Card>
              <CardContent className='p-8 text-center'>
                <TrendingUp className='w-16 h-16 mx-auto text-gray-400 mb-4' />
                <h3 className='text-lg font-semibold text-gray-600 mb-2'>
                  {language === 'fr' ? 'Aucune donnée budgétaire' : 'No Budget Data'}
                </h3>
                <p className='text-gray-500'>
                  {language === 'fr' ? 
                    'Aucune donnée budgétaire disponible pour la période sélectionnée' :
                    'No budget data available for the selected time period'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      {language === 'fr' ? 'Revenus totaux' : 'Total Income'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold text-green-600'>
                      ${filteredChartData.reduce((sum, item) => sum + item.totalIncome, 0).toLocaleString()}
                    </div>
                    <p className='text-xs text-muted-foreground mt-1'>
                      {language === 'fr' ? `Sur ${filteredChartData.length} mois` : `Across ${filteredChartData.length} months`}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      {language === 'fr' ? 'Dépenses totales' : 'Total Expenses'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold text-red-600'>
                      ${filteredChartData.reduce((sum, item) => sum + item.totalExpenses, 0).toLocaleString()}
                    </div>
                    <p className='text-xs text-muted-foreground mt-1'>
                      {language === 'fr' ? `Sur ${filteredChartData.length} mois` : `Across ${filteredChartData.length} months`}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      {language === 'fr' ? 'Flux de trésorerie net' : 'Net Cash Flow'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${
                      filteredChartData.reduce((sum, item) => sum + item.netCashFlow, 0) >= 0 
                        ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${filteredChartData.reduce((sum, item) => sum + item.netCashFlow, 0).toLocaleString()}
                    </div>
                    <p className='text-xs text-muted-foreground mt-1'>
                      {language === 'fr' ? 'Position nette' : 'Net position'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Area Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <TrendingUp className='w-5 h-5' />
                    {language === 'fr' ? 
                      `Tendances financières (${startYear} - ${endYear})` : 
                      `Financial Trends (${startYear} - ${endYear})`
                    }
                  </CardTitle>
                  {selectedCategories.length > 0 && (
                    <div className='text-sm text-muted-foreground'>
                      {language === 'fr' ? 'Filtré par: ' : 'Filtered by: '}
                      {selectedCategories.join(', ')}
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
                  {language === 'fr' ? 'Gestion du compte bancaire' : 'Bank Account Management'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  {bankAccountInfo?.bankAccountNumber ? (
                    <div className='p-4 bg-muted rounded-lg'>
                      <div className='flex items-center justify-between mb-2'>
                        <span className='font-medium'>
                          {language === 'fr' ? 'Compte actuel:' : 'Current Account:'}
                        </span>
                        <span className='font-mono'>{bankAccountInfo.bankAccountNumber}</span>
                      </div>
                      {bankAccountInfo.bankAccountNotes && (
                        <div className='text-sm text-muted-foreground'>
                          <strong>{language === 'fr' ? 'Dernière note:' : 'Last Note:'}</strong> {bankAccountInfo.bankAccountNotes}
                        </div>
                      )}
                      {bankAccountInfo.bankAccountUpdatedAt && (
                        <div className='text-xs text-muted-foreground mt-1'>
                          {language === 'fr' ? 'Mis à jour: ' : 'Updated: '}
                          {new Date(bankAccountInfo.bankAccountUpdatedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className='p-4 border-2 border-dashed rounded-lg text-center text-muted-foreground'>
                      {language === 'fr' ? 
                        'Aucun compte bancaire défini pour ce bâtiment' :
                        'No bank account set for this building'
                      }
                    </div>
                  )}
                  
                  <Dialog open={bankAccountDialog} onOpenChange={setBankAccountDialog}>
                    <DialogTrigger asChild>
                      <Button className='w-full' variant='outline'>
                        <Banknote className='w-4 h-4 mr-2' />
                        {bankAccountInfo?.bankAccountNumber ? 
                          (language === 'fr' ? 'Mettre à jour le compte' : 'Update Account') : 
                          (language === 'fr' ? 'Définir le compte bancaire' : 'Set Bank Account')
                        }
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {language === 'fr' ? 'Mettre à jour le compte bancaire' : 'Update Bank Account'}
                        </DialogTitle>
                        <DialogDescription>
                          {language === 'fr' ? 
                            'Mettre à jour le numéro de compte bancaire pour ce bâtiment. Ceci remplacera le numéro précédent et ajoutera une note de rapprochement.' :
                            'Update the bank account number for this building. This will override the previous number and add a reconciliation note.'
                          }
                        </DialogDescription>
                      </DialogHeader>
                      <div className='space-y-4'>
                        <div className='space-y-2'>
                          <Label htmlFor='bankAccount'>
                            {language === 'fr' ? 'Numéro de compte bancaire' : 'Bank Account Number'}
                          </Label>
                          <Input
                            id='bankAccount'
                            value={bankAccountNumber}
                            onChange={(e) => setBankAccountNumber(e.target.value)}
                            placeholder={language === 'fr' ? 
                              'Saisir le numéro de compte bancaire' : 
                              'Enter bank account number'
                            }
                          />
                        </div>
                        <div className='space-y-2'>
                          <Label htmlFor='reconciliationNote'>
                            {language === 'fr' ? 'Note de rapprochement' : 'Reconciliation Note'}
                          </Label>
                          <Textarea
                            id='reconciliationNote'
                            value={reconciliationNote}
                            onChange={(e) => setReconciliationNote(e.target.value)}
                            placeholder={language === 'fr' ? 
                              'Saisir la note de rapprochement pour ce changement...' : 
                              'Enter reconciliation note for this change...'
                            }
                            rows={3}
                          />
                        </div>
                        {bankAccountInfo?.bankAccountNumber && (
                          <div className='p-3 bg-muted rounded-lg'>
                            <p className='text-sm'>
                              <strong>{language === 'fr' ? 'Actuel:' : 'Current:'}</strong> {bankAccountInfo.bankAccountNumber}
                            </p>
                            {bankAccountInfo.bankAccountNotes && (
                              <p className='text-sm text-muted-foreground mt-1'>
                                <strong>{language === 'fr' ? 'Dernière note:' : 'Last Note:'}</strong> {bankAccountInfo.bankAccountNotes}
                              </p>
                            )}
                          </div>
                        )}
                        <div className='flex justify-end space-x-2'>
                          <Button variant='outline' onClick={() => setBankAccountDialog(false)}>
                            {language === 'fr' ? 'Annuler' : 'Cancel'}
                          </Button>
                          <Button onClick={handleUpdateBankAccount} disabled={updateBankAccount.isPending}>
                            {updateBankAccount.isPending ? 
                              (language === 'fr' ? 'Mise à jour...' : 'Updating...') : 
                              (language === 'fr' ? 'Mettre à jour le compte' : 'Update Account')
                            }
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