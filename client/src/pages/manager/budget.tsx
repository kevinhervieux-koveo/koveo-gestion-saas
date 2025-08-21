import { useState, useMemo, useCallback, memo } from 'react';
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
import { DollarSign, Banknote, Settings, TrendingUp, Calculator, Filter, ChevronDown, ChevronUp, X, Plus, Trash2, Calendar, AlertTriangle, ChevronLeft, ChevronRight, Users, Percent } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { MonthlyBudget } from '@shared/schema';

// Category translation mapping - moved outside component for performance
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

// Translation function moved outside component
const translateCategory = (category: string, language: 'en' | 'fr') => {
  const translation = categoryTranslations[category];
  if (translation) {
    return language === 'fr' ? translation.fr : translation.en;
  }
  // Fallback: capitalize and replace underscores
  return category.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

// Bank account translations moved outside component for performance
const getBankAccountTranslations = (language: 'en' | 'fr') => ({
  title: language === 'fr' ? 'Gestion du compte bancaire' : 'Bank Account Management',
  currentAccount: language === 'fr' ? 'Compte actuel:' : 'Current Account:',
  lastNote: language === 'fr' ? 'Dernière note:' : 'Last Note:',
  updated: language === 'fr' ? 'Mis à jour:' : 'Updated:',
  startDate: language === 'fr' ? 'Date de début:' : 'Start Date:',
  startAmount: language === 'fr' ? 'Solde initial:' : 'Starting Balance:',
  minimumBalances: language === 'fr' ? 'Soldes minimums:' : 'Minimum Balances:',
  noAccount: language === 'fr' ? 'Aucun compte bancaire défini pour ce bâtiment' : 'No bank account set for this building',
  updateAccount: language === 'fr' ? 'Mettre à jour le compte' : 'Update Account',
  setAccount: language === 'fr' ? 'Définir le compte bancaire' : 'Set Bank Account',
  manageMinimums: language === 'fr' ? 'Gérer les soldes minimums' : 'Manage Minimum Balances',
  dialogTitle: language === 'fr' ? 'Mettre à jour le compte bancaire' : 'Update Bank Account',
  minimumDialogTitle: language === 'fr' ? 'Gérer les soldes minimums' : 'Manage Minimum Balances',
  dialogDescription: language === 'fr' ? 
    'Mettre à jour les informations du compte bancaire pour ce bâtiment.' :
    'Update the bank account information for this building.',
  minimumDialogDescription: language === 'fr' ? 
    'Gérer les soldes minimums requis pour ce compte bancaire.' :
    'Manage required minimum balances for this bank account.',
  accountNumber: language === 'fr' ? 'Numéro de compte bancaire' : 'Bank Account Number',
  accountNumberPlaceholder: language === 'fr' ? 'Saisir le numéro de compte' : 'Enter account number',
  reconciliationNote: language === 'fr' ? 'Note de rapprochement' : 'Reconciliation Note',
  reconciliationNotePlaceholder: language === 'fr' ? 'Note pour ce changement...' : 'Note for this change...',
  startDateLabel: language === 'fr' ? 'Date de début du suivi' : 'Tracking Start Date',
  startAmountLabel: language === 'fr' ? 'Solde initial ($)' : 'Starting Balance ($)',
  startAmountPlaceholder: language === 'fr' ? 'Montant initial' : 'Initial amount',
  minimumBalancesLabel: language === 'fr' ? 'Soldes minimums requis' : 'Required Minimum Balances',
  addMinimum: language === 'fr' ? 'Ajouter un minimum' : 'Add Minimum',
  amount: language === 'fr' ? 'Montant' : 'Amount',
  description: language === 'fr' ? 'Description' : 'Description',
  descriptionPlaceholder: language === 'fr' ? 'Ex: Fonds d\'urgence' : 'e.g., Emergency fund',
  cancel: language === 'fr' ? 'Annuler' : 'Cancel',
  updating: language === 'fr' ? 'Mise à jour...' : 'Updating...',
  updateButton: language === 'fr' ? 'Mettre à jour le compte' : 'Update Account',
});

// Contribution translations moved outside component for performance
const getContributionTranslations = (language: 'en' | 'fr') => ({
  title: language === 'fr' ? 'Répartition des contributions spéciales' : 'Special Contribution Breakdown',
  subtitle: language === 'fr' ? 'Montant requis par propriété selon le pourcentage de copropriété' : 'Required amount per property based on ownership percentage',
  noContribution: language === 'fr' ? 'Aucune contribution spéciale requise - flux de trésorerie positif' : 'No special contribution required - positive cash flow',
  totalRequired: language === 'fr' ? 'Total requis:' : 'Total required:',
  unit: language === 'fr' ? 'Unité' : 'Unit',
  ownership: language === 'fr' ? 'Propriété (%)' : 'Ownership (%)',
  contribution: language === 'fr' ? 'Contribution ($)' : 'Contribution ($)',
  floor: language === 'fr' ? 'Étage' : 'Floor',
  page: language === 'fr' ? 'Page' : 'Page',
  of: language === 'fr' ? 'de' : 'of',
  previous: language === 'fr' ? 'Précédent' : 'Previous',
  next: language === 'fr' ? 'Suivant' : 'Next',
});

// Inflation translations moved outside component for performance
const getInflationTranslations = (language: 'en' | 'fr') => ({
  title: language === 'fr' ? 'Gestion de l\'inflation' : 'Inflation Management',
  manageInflation: language === 'fr' ? 'Gérer l\'inflation' : 'Manage Inflation',
  dialogTitle: language === 'fr' ? 'Paramètres d\'inflation' : 'Inflation Settings',
  dialogDescription: language === 'fr' ? 'Configurer les taux d\'inflation pour les revenus et dépenses.' : 'Configure inflation rates for income and expenses.',
  generalSettings: language === 'fr' ? 'Paramètres généraux' : 'General Settings',
  generalIncome: language === 'fr' ? 'Inflation générale des revenus (%)' : 'General Income Inflation (%)',
  generalExpense: language === 'fr' ? 'Inflation générale des dépenses (%)' : 'General Expense Inflation (%)',
  splitByCategory: language === 'fr' ? 'Diviser par catégorie' : 'Split by Category',
  incomeByCategory: language === 'fr' ? 'Revenus par catégorie' : 'Income by Category',
  expenseByCategory: language === 'fr' ? 'Dépenses par catégorie' : 'Expense by Category',
  addIncome: language === 'fr' ? 'Ajouter revenu' : 'Add Income',
  addExpense: language === 'fr' ? 'Ajouter dépense' : 'Add Expense',
  category: language === 'fr' ? 'Catégorie' : 'Category',
  rate: language === 'fr' ? 'Taux (%)' : 'Rate (%)',
  mode: language === 'fr' ? 'Mode' : 'Mode',
  yearly: language === 'fr' ? 'Annuel' : 'Yearly',
  oneTime: language === 'fr' ? 'Unique' : 'One-time',
  targetYear: language === 'fr' ? 'Année cible' : 'Target Year',
  description: language === 'fr' ? 'Description' : 'Description',
  descriptionPlaceholder: language === 'fr' ? 'Ex: Ajustement salarial' : 'e.g., Salary adjustment',
  cancel: language === 'fr' ? 'Annuler' : 'Cancel',
  save: language === 'fr' ? 'Sauvegarder' : 'Save Changes',
  saving: language === 'fr' ? 'Sauvegarde...' : 'Saving...',
});

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
  bankAccountStartDate: string | null;
  bankAccountStartAmount: number | null;
  bankAccountMinimums: string | null; // JSON string of minimum settings
  inflationSettings: string | null; // JSON string of inflation settings
}

interface MinimumBalanceSetting {
  id: string;
  amount: number;
  description: string;
}

interface InflationSetting {
  id: string;
  category: string;
  type: 'income' | 'expense';
  rate: number; // percentage
  applicationMode: 'yearly' | 'one-time';
  targetYear?: number; // For one-time applications
  description: string;
}

interface InflationConfig {
  incomeSettings: InflationSetting[];
  expenseSettings: InflationSetting[];
  generalIncome: number; // General income inflation rate
  generalExpense: number; // General expense inflation rate
}

export default function Budget() {
  const { language } = useLanguage();
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [viewType, setViewType] = useState<'yearly' | 'monthly'>('monthly');
  const [showCategories, setShowCategories] = useState(false);
  const [bankAccountDialog, setBankAccountDialog] = useState(false);
  const [minimumBalancesDialog, setMinimumBalancesDialog] = useState(false);
  const [inflationDialog, setInflationDialog] = useState(false);
  const [inflationSettings, setInflationSettings] = useState<InflationSetting[]>([]);
  const [generalIncomeInflation, setGeneralIncomeInflation] = useState<number>(0);
  const [generalExpenseInflation, setGeneralExpenseInflation] = useState<number>(0);
  const [splitIncomeByCategory, setSplitIncomeByCategory] = useState(false);
  const [splitExpenseByCategory, setSplitExpenseByCategory] = useState(false);
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [reconciliationNote, setReconciliationNote] = useState('');
  const [bankAccountStartDate, setBankAccountStartDate] = useState('');
  const [bankAccountStartAmount, setBankAccountStartAmount] = useState('');
  const [minimumBalances, setMinimumBalances] = useState<MinimumBalanceSetting[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  
  // Year range controls
  const currentYear = new Date().getFullYear();
  const [startYear, setStartYear] = useState(currentYear - 3);
  const [endYear, setEndYear] = useState(currentYear + 25);
  
  // Property contribution pagination
  const [contributionPage, setContributionPage] = useState(1);
  const contributionsPerPage = 10;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get buildings for selection
  const { data: buildings = [] } = useQuery({
    queryKey: ['/api/buildings'],
  });

  // Get residences for selected building
  const { data: residences = [] } = useQuery({
    queryKey: ['/api/residences', selectedBuilding],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBuilding) {
        params.append('buildingId', selectedBuilding);
      }
      const response = await fetch(`/api/residences?${params}`);
      if (!response.ok) throw new Error('Failed to fetch residences');
      return response.json();
    },
    enabled: !!selectedBuilding,
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

  // Parse minimum balance settings
  const minimumBalanceSettings = useMemo(() => {
    if (!bankAccountInfo?.bankAccountMinimums) return [];
    try {
      return JSON.parse(bankAccountInfo.bankAccountMinimums) as MinimumBalanceSetting[];
    } catch {
      return [];
    }
  }, [bankAccountInfo?.bankAccountMinimums]);

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

  // Find minimum balance for chart visualization - optimized
  const minimumBalanceForChart = useMemo(() => {
    if (!minimumBalanceSettings?.length) return null;
    return Math.min(...minimumBalanceSettings.map(m => m.amount));
  }, [minimumBalanceSettings?.length, minimumBalanceSettings]);

  // Special contribution and property calculations are now defined after filteredChartData

  // Category translation function now uses the moved constant
  
  // Get all available categories with translations - optimized to avoid recalculation
  const availableCategories = useMemo(() => {
    if (!chartData?.length) return [];
    const categories = new Set<string>();
    chartData.forEach((item) => {
      Object.keys(item.incomeByCategory || {}).forEach(cat => {
        const translated = translateCategory(cat, language);
        categories.add(`${language === 'fr' ? 'Revenus' : 'Income'}: ${translated}`);
      });
      Object.keys(item.expensesByCategory || {}).forEach(cat => {
        const translated = translateCategory(cat, language);
        categories.add(`${language === 'fr' ? 'Dépenses' : 'Expense'}: ${translated}`);
      });
    });
    return Array.from(categories).sort();
  }, [chartData?.length, language]);

  // Filter data by selected categories - optimized with better dependency tracking
  const filteredChartData = useMemo(() => {
    if (!chartData?.length || selectedCategories.length === 0) return chartData || [];
    
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
            return translateCategory(key, language) === translatedCatName;
          });
          if (originalCatName) {
            filteredIncome += item.incomeByCategory[originalCatName] || 0;
          }
        } else if (category.startsWith(expensePrefix)) {
          const translatedCatName = category.replace(expensePrefix, '');
          // Find original category name from translation
          const originalCatName = Object.keys(item.expensesByCategory).find(key => {
            return translateCategory(key, language) === translatedCatName;
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
  }, [chartData, selectedCategories.join(','), language]);

  // Calculate special contribution and property breakdown - optimized
  const specialContribution = useMemo(() => {
    if (!filteredChartData?.length) return 0;
    const netCashFlow = filteredChartData.reduce((sum, item) => sum + item.netCashFlow, 0);
    return Math.abs(Math.min(0, netCashFlow));
  }, [filteredChartData]);

  // Get residences for selected building and calculate contributions - optimized
  const propertyContributions = useMemo(() => {
    if (!selectedBuilding || !residences?.length || specialContribution === 0) return [];
    
    // Filter and map in single pass for better performance
    return residences
      .filter((residence: any) => residence.building_id === selectedBuilding)
      .map((residence: any) => ({
        id: residence.id,
        unitNumber: residence.unit_number,
        ownershipPercentage: residence.ownership_percentage || 0,
        contribution: (specialContribution * (residence.ownership_percentage || 0)) / 100,
        floor: residence.floor,
      }))
      .sort((a: any, b: any) => a.unitNumber.localeCompare(b.unitNumber));
  }, [selectedBuilding, residences?.length, specialContribution]);

  // Pagination for property contributions
  const totalContributionPages = Math.ceil(propertyContributions.length / contributionsPerPage);
  const paginatedContributions = propertyContributions.slice(
    (contributionPage - 1) * contributionsPerPage,
    contributionPage * contributionsPerPage
  );

  // Chart config memoized to prevent recreation
  const chartConfig = useMemo(() => ({
    totalIncome: {
      label: language === 'fr' ? 'Revenus Totaux' : 'Total Income',
      color: 'hsl(120, 70%, 50%)',
    },
    totalExpenses: {
      label: language === 'fr' ? 'Dépenses Totales' : 'Total Expenses', 
      color: 'hsl(0, 70%, 50%)',
    },
    minimumBalance: {
      label: language === 'fr' ? 'Solde Minimum' : 'Minimum Balance',
      color: 'hsl(0, 80%, 60%)',
    },
  }), [language]);

  // Use optimized translation functions
  const bankAccountTranslations = getBankAccountTranslations(language);

  // Use optimized translation functions
  const contributionTranslations = getContributionTranslations(language);

  // Use optimized translation functions
  const inflationTranslations = getInflationTranslations(language);

  // Update bank account mutation
  const updateBankAccount = useMutation({
    mutationFn: async (data: { 
      buildingId: string; 
      bankAccountNumber: string; 
      notes: string; 
      startDate: string;
      startAmount: string;
      minimumBalances: MinimumBalanceSetting[];
    }) => {
      const response = await fetch(`/api/budgets/${data.buildingId}/bank-account`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bankAccountNumber: data.bankAccountNumber,
          bankAccountNotes: data.notes,
          bankAccountStartDate: data.startDate || null,
          bankAccountStartAmount: data.startAmount ? parseFloat(data.startAmount) : null,
          bankAccountMinimums: JSON.stringify(data.minimumBalances),
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
      setBankAccountStartDate('');
      setBankAccountStartAmount('');
      setMinimumBalances([]);
      toast({
        title: language === 'fr' ? 'Compte bancaire mis à jour' : 'Bank account updated',
        description: language === 'fr' ? 
          'Les informations du compte bancaire ont été mises à jour avec succès.' : 
          'Bank account information has been updated successfully.',
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

  // Helper functions for minimum balance management - optimized with useCallback
  const addMinimumBalance = useCallback(() => {
    const newMinimum: MinimumBalanceSetting = {
      id: `min_${Date.now()}`,
      amount: 0,
      description: '',
    };
    setMinimumBalances(prev => [...prev, newMinimum]);
  }, []);

  const updateMinimumBalance = useCallback((id: string, field: 'amount' | 'description', value: string | number) => {
    setMinimumBalances(prev => prev.map(min => 
      min.id === id ? { ...min, [field]: value } : min
    ));
  }, []);

  const removeMinimumBalance = useCallback((id: string) => {
    setMinimumBalances(prev => prev.filter(min => min.id !== id));
  }, []);

  // Inflation helper functions - optimized with useCallback
  const addInflationSetting = useCallback((type: 'income' | 'expense') => {
    const availableCategories = type === 'income' 
      ? Array.from(new Set(chartData?.flatMap(item => Object.keys(item.incomeByCategory || {})) || []))
      : Array.from(new Set(chartData?.flatMap(item => Object.keys(item.expensesByCategory || {})) || []));
    
    const newSetting: InflationSetting = {
      id: Date.now().toString(),
      category: availableCategories[0] || 'General',
      type,
      rate: 0,
      applicationMode: 'yearly',
      description: ''
    };
    setInflationSettings(prev => [...prev, newSetting]);
  }, [chartData]);

  const updateInflationSetting = useCallback((id: string, field: keyof InflationSetting, value: any) => {
    setInflationSettings(prev => prev.map(setting => 
      setting.id === id ? { ...setting, [field]: value } : setting
    ));
  }, []);

  const removeInflationSetting = useCallback((id: string) => {
    setInflationSettings(prev => prev.filter(setting => setting.id !== id));
  }, []);

  // Initialize dialog with existing data
  const initializeDialog = () => {
    if (bankAccountInfo) {
      setBankAccountNumber(bankAccountInfo.bankAccountNumber || '');
      setReconciliationNote('');
      setBankAccountStartDate(bankAccountInfo.bankAccountStartDate || '');
      setBankAccountStartAmount(bankAccountInfo.bankAccountStartAmount?.toString() || '');
      
      // Parse existing minimum balances
      if (bankAccountInfo.bankAccountMinimums) {
        try {
          const existingMinimums = JSON.parse(bankAccountInfo.bankAccountMinimums) as MinimumBalanceSetting[];
          setMinimumBalances(existingMinimums);
        } catch {
          setMinimumBalances([]);
        }
      } else {
        setMinimumBalances([]);
      }
    } else {
      setBankAccountNumber('');
      setReconciliationNote('');
      setBankAccountStartDate('');
      setBankAccountStartAmount('');
      setMinimumBalances([]);
    }
  };

  // Optimized with useCallback to prevent recreation
  const handleUpdateBankAccount = useCallback(() => {
    if (!selectedBuilding) {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr' ? 
          'Bâtiment non sélectionné.' : 
          'No building selected.',
        variant: 'destructive',
      });
      return;
    }

    updateBankAccount.mutate({
      buildingId: selectedBuilding,
      bankAccountNumber: '',
      notes: reconciliationNote.trim(),
      startDate: bankAccountStartDate,
      startAmount: bankAccountStartAmount,
      minimumBalances,
    });
  }, [selectedBuilding, reconciliationNote, bankAccountStartDate, bankAccountStartAmount, minimumBalances, updateBankAccount, toast, language]);

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
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4'>
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
                
                {/* Special Contribution Card */}
                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      {language === 'fr' ? 'Contribution spéciale' : 'Special Contribution'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${
                      specialContribution > 0 
                        ? 'text-red-600' : 'text-green-600'
                    }`}>
                      ${specialContribution.toLocaleString()}
                    </div>
                    <p className='text-xs text-muted-foreground mt-1'>
                      {language === 'fr' ? 'Contribution requise' : 'Required contribution'}
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
                      {/* Minimum Balance Line */}
                      {minimumBalanceForChart && (
                        <>
                          <defs>
                            <linearGradient id="colorMinimum" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(0, 80%, 60%)" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="hsl(0, 80%, 60%)" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <Area
                            type="monotone"
                            dataKey={() => minimumBalanceForChart}
                            stroke="hsl(0, 80%, 60%)"
                            strokeWidth={2}
                            strokeDasharray="5,5"
                            fill="url(#colorMinimum)"
                            dot={false}
                            activeDot={false}
                          />
                        </>
                      )}
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
                  {bankAccountTranslations.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  {bankAccountInfo?.bankAccountNumber ? (
                    <div className='space-y-4'>
                      <div className='p-4 bg-muted rounded-lg'>
                        <div className='flex items-center justify-between mb-2'>
                          <span className='font-medium'>{bankAccountTranslations.currentAccount}</span>
                          <span className='font-mono'>{bankAccountInfo.bankAccountNumber}</span>
                        </div>
                        
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-3 mt-3'>
                          {bankAccountInfo.bankAccountStartDate && (
                            <div className='text-sm'>
                              <strong className='text-muted-foreground'>{bankAccountTranslations.startDate}</strong>
                              <div className='flex items-center gap-1 mt-1'>
                                <Calendar className='w-3 h-3' />
                                {new Date(bankAccountInfo.bankAccountStartDate).toLocaleDateString()}
                              </div>
                            </div>
                          )}
                          
                          {bankAccountInfo.bankAccountStartAmount && (
                            <div className='text-sm'>
                              <strong className='text-muted-foreground'>{bankAccountTranslations.startAmount}</strong>
                              <div className='font-semibold text-green-600 mt-1'>
                                ${Number(bankAccountInfo.bankAccountStartAmount).toLocaleString()}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {bankAccountInfo.bankAccountNotes && (
                          <div className='text-sm text-muted-foreground mt-3'>
                            <strong>{bankAccountTranslations.lastNote}</strong> {bankAccountInfo.bankAccountNotes}
                          </div>
                        )}
                        
                        {bankAccountInfo.bankAccountUpdatedAt && (
                          <div className='text-xs text-muted-foreground mt-2'>
                            {bankAccountTranslations.updated}
                            {new Date(bankAccountInfo.bankAccountUpdatedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      
                      {/* Minimum Balance Settings Display */}
                      {minimumBalanceSettings.length > 0 && (
                        <div className='p-4 border rounded-lg'>
                          <div className='flex items-center gap-2 mb-3'>
                            <AlertTriangle className='w-4 h-4 text-yellow-600' />
                            <span className='font-medium text-sm'>{bankAccountTranslations.minimumBalances}</span>
                          </div>
                          <div className='space-y-2'>
                            {minimumBalanceSettings.map((minimum) => (
                              <div key={minimum.id} className='flex items-center justify-between text-sm p-2 bg-yellow-50 rounded'>
                                <span className='text-muted-foreground'>{minimum.description}</span>
                                <span className='font-semibold text-yellow-700'>
                                  ${minimum.amount.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className='p-4 border-2 border-dashed rounded-lg text-center text-muted-foreground'>
                      {bankAccountTranslations.noAccount}
                    </div>
                  )}
                  
                  {/* Bank Account Dialog */}
                  <div className='space-y-2'>
                    <Dialog 
                      open={bankAccountDialog} 
                      onOpenChange={(open) => {
                        if (open) {
                          initializeDialog();
                        }
                        setBankAccountDialog(open);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button className='w-full' variant='outline'>
                          <Banknote className='w-4 h-4 mr-2' />
                          {bankAccountInfo?.bankAccountNumber ? 
                            bankAccountTranslations.updateAccount : 
                            bankAccountTranslations.setAccount
                          }
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{bankAccountTranslations.dialogTitle}</DialogTitle>
                        <DialogDescription>{bankAccountTranslations.dialogDescription}</DialogDescription>
                      </DialogHeader>
                      <div className='space-y-4 max-h-96 overflow-y-auto'>
                        <div className='space-y-4'>
                          <div className='space-y-2'>
                            <Label htmlFor='startDate'>{bankAccountTranslations.startDateLabel}</Label>
                            <Input
                              id='startDate'
                              type='date'
                              value={bankAccountStartDate}
                              onChange={(e) => setBankAccountStartDate(e.target.value)}
                            />
                          </div>
                        </div>
                        
                        <div className='space-y-2'>
                          <Label htmlFor='startAmount'>{bankAccountTranslations.startAmountLabel}</Label>
                          <Input
                            id='startAmount'
                            type='number'
                            step='0.01'
                            value={bankAccountStartAmount}
                            onChange={(e) => setBankAccountStartAmount(e.target.value)}
                            placeholder={bankAccountTranslations.startAmountPlaceholder}
                          />
                        </div>
                        
                        <div className='space-y-2'>
                          <Label htmlFor='reconciliationNote'>{bankAccountTranslations.reconciliationNote}</Label>
                          <Textarea
                            id='reconciliationNote'
                            value={reconciliationNote}
                            onChange={(e) => setReconciliationNote(e.target.value)}
                            placeholder={bankAccountTranslations.reconciliationNotePlaceholder}
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
                        <div className='flex justify-end space-x-2 pt-4 border-t'>
                          <Button variant='outline' onClick={() => setBankAccountDialog(false)}>
                            {bankAccountTranslations.cancel}
                          </Button>
                          <Button onClick={handleUpdateBankAccount} disabled={updateBankAccount.isPending}>
                            {updateBankAccount.isPending ? 
                              bankAccountTranslations.updating : 
                              bankAccountTranslations.updateButton
                            }
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  {/* Minimum Balances Management Button - Always available */}
                  <Dialog 
                    open={minimumBalancesDialog} 
                    onOpenChange={(open) => {
                      if (open) {
                        setMinimumBalances(minimumBalanceSettings.map(m => ({ ...m })));
                      }
                      setMinimumBalancesDialog(open);
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button className='w-full' variant='outline'>
                        <Settings className='w-4 h-4 mr-2' />
                        {bankAccountTranslations.manageMinimums}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{bankAccountTranslations.minimumDialogTitle}</DialogTitle>
                          <DialogDescription>{bankAccountTranslations.minimumDialogDescription}</DialogDescription>
                        </DialogHeader>
                        <div className='space-y-4 max-h-96 overflow-y-auto'>
                          <div className='space-y-3'>
                            <div className='flex items-center justify-between'>
                              <Label>{bankAccountTranslations.minimumBalancesLabel}</Label>
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={addMinimumBalance}
                                className='flex items-center gap-1'
                              >
                                <Plus className='w-3 h-3' />
                                {bankAccountTranslations.addMinimum}
                              </Button>
                            </div>
                            
                            {minimumBalances.length > 0 ? (
                              <div className='space-y-2 max-h-32 overflow-y-auto border rounded p-2'>
                                {minimumBalances.map((minimum, index) => (
                                  <MinimumBalanceRow 
                                    key={minimum.id} 
                                    minimum={minimum} 
                                    bankAccountTranslations={bankAccountTranslations}
                                    onUpdate={updateMinimumBalance}
                                    onRemove={removeMinimumBalance}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className='text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded'>
                                {language === 'fr' ? 'Aucun solde minimum défini' : 'No minimum balances set'}
                              </div>
                            )}
                          </div>
                          
                          <div className='flex justify-end space-x-2 pt-4 border-t'>
                            <Button variant='outline' onClick={() => setMinimumBalancesDialog(false)}>
                              {bankAccountTranslations.cancel}
                            </Button>
                            <Button 
                              onClick={async () => {
                                try {
                                  console.log('Saving minimum balances:', minimumBalances);
                                  console.log('Bank account info:', bankAccountInfo);
                                  
                                  const response = await apiRequest(`/api/budgets/${selectedBuilding}/bank-account`, 'PUT', {
                                    bankAccountNumber: bankAccountInfo?.bankAccountNumber || '',
                                    bankAccountNotes: bankAccountInfo?.bankAccountNotes || '',
                                    bankAccountStartDate: bankAccountInfo?.bankAccountStartDate || null,
                                    bankAccountStartAmount: bankAccountInfo?.bankAccountStartAmount || null,
                                    bankAccountMinimums: JSON.stringify(minimumBalances),
                                  });
                                  
                                  console.log('Response:', response);
                                  
                                  queryClient.invalidateQueries({
                                    queryKey: ['/api/budgets', selectedBuilding, 'bank-account']
                                  });
                                  
                                  toast({
                                    title: language === 'fr' ? 'Soldes minimums mis à jour' : 'Minimum balances updated',
                                    description: language === 'fr' ? 
                                      'Les paramètres de soldes minimums ont été sauvegardés.' : 
                                      'Minimum balance settings have been saved.'
                                  });
                                  
                                  setMinimumBalancesDialog(false);
                                } catch (error) {
                                  console.error('Minimum balance update error:', error);
                                  toast({
                                    title: language === 'fr' ? 'Erreur' : 'Error',
                                    description: language === 'fr' ? 
                                      'Erreur lors de la mise à jour des soldes minimums' : 
                                      'Error updating minimum balances',
                                    variant: 'destructive'
                                  });
                                }
                              }}
                              disabled={updateBankAccount.isPending}
                            >
                              {updateBankAccount.isPending ? 
                                bankAccountTranslations.updating : 
                                (language === 'fr' ? 'Sauvegarder' : 'Save Changes')
                              }
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Inflation Management Section */}
                  <div className='mt-6 pt-6 border-t'>
                    <div className='flex items-center gap-2 mb-4'>
                      <Percent className='w-5 h-5' />
                      <h3 className='text-lg font-semibold'>{inflationTranslations.title}</h3>
                    </div>
                    <div className='space-y-3'>
                      <div className='flex items-center justify-between p-3 bg-muted rounded-lg'>
                        <span className='text-sm font-medium'>{inflationTranslations.generalIncome}</span>
                        <span className={`font-semibold ${generalIncomeInflation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {generalIncomeInflation > 0 ? '+' : ''}{generalIncomeInflation}%
                        </span>
                      </div>
                      <div className='flex items-center justify-between p-3 bg-muted rounded-lg'>
                        <span className='text-sm font-medium'>{inflationTranslations.generalExpense}</span>
                        <span className={`font-semibold ${generalExpenseInflation >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {generalExpenseInflation > 0 ? '+' : ''}{generalExpenseInflation}%
                        </span>
                      </div>
                      <Dialog 
                        open={inflationDialog} 
                        onOpenChange={setInflationDialog}
                      >
                        <DialogTrigger asChild>
                          <Button className='w-full' variant='outline'>
                            <Percent className='w-4 h-4 mr-2' />
                            {inflationTranslations.manageInflation}
                          </Button>
                        </DialogTrigger>
                      </Dialog>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Property Contribution Breakdown Card */}
          {selectedBuilding && (
            <Card className='mt-6'>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Users className='w-5 h-5' />
                  {contributionTranslations.title}
                </CardTitle>
                <p className='text-sm text-muted-foreground'>
                  {contributionTranslations.subtitle}
                </p>
              </CardHeader>
              <CardContent>
                {specialContribution === 0 ? (
                  <div className='p-6 bg-green-50 border border-green-200 rounded-lg text-center'>
                    <div className='text-green-700 font-medium mb-2'>
                      ✅ {contributionTranslations.noContribution}
                    </div>
                  </div>
                ) : (
                  <div className='space-y-4'>
                    <div className='p-4 bg-red-50 border border-red-200 rounded-lg'>
                      <div className='text-red-800 font-medium mb-1'>
                        {contributionTranslations.totalRequired} ${specialContribution.toLocaleString()}
                      </div>
                      <p className='text-sm text-red-600'>
                        {propertyContributions.length} {language === 'fr' ? 'propriétés concernées' : 'properties affected'}
                      </p>
                    </div>
                    
                    {propertyContributions.length > 0 && (
                      <>
                        <div className='border rounded-lg overflow-hidden'>
                          <div className='bg-muted px-4 py-2 border-b'>
                            <div className='grid grid-cols-4 gap-4 font-medium text-sm'>
                              <div>{contributionTranslations.unit}</div>
                              <div>{contributionTranslations.floor}</div>
                              <div className='text-right'>{contributionTranslations.ownership}</div>
                              <div className='text-right'>{contributionTranslations.contribution}</div>
                            </div>
                          </div>
                          
                          <div className='divide-y'>
                            {paginatedContributions.map((property: any) => (
                              <PropertyContributionRow key={`${property.id}-${property.unitNumber}`} property={property} />
                            ))}
                          </div>
                        </div>
                        
                        {/* Pagination */}
                        {totalContributionPages > 1 && (
                          <div className='flex items-center justify-between'>
                            <p className='text-sm text-muted-foreground'>
                              {contributionTranslations.page} {contributionPage} {contributionTranslations.of} {totalContributionPages}
                            </p>
                            
                            <div className='flex items-center gap-2'>
                              <Button
                                variant='outline'
                                size='sm'
                                onClick={() => setContributionPage(Math.max(1, contributionPage - 1))}
                                disabled={contributionPage === 1}
                                className='flex items-center gap-1'
                              >
                                <ChevronLeft className='w-3 h-3' />
                                {contributionTranslations.previous}
                              </Button>
                              
                              <Button
                                variant='outline'
                                size='sm'
                                onClick={() => setContributionPage(Math.min(totalContributionPages, contributionPage + 1))}
                                disabled={contributionPage === totalContributionPages}
                                className='flex items-center gap-1'
                              >
                                {contributionTranslations.next}
                                <ChevronRight className='w-3 h-3' />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// Optimized components for better performance and maintainability
const PropertyContributionRow = memo(({ property }: { property: any }) => (
  <div className='px-4 py-3 hover:bg-muted/50'>
    <div className='grid grid-cols-4 gap-4 text-sm'>
      <div className='font-medium'>{property.unitNumber}</div>
      <div className='text-muted-foreground'>{property.floor}</div>
      <div className='text-right'>{property.ownershipPercentage.toFixed(2)}%</div>
      <div className='text-right font-medium text-red-600'>
        ${property.contribution.toFixed(2)}
      </div>
    </div>
  </div>
));

const MinimumBalanceRow = memo(({ 
  minimum, 
  bankAccountTranslations, 
  onUpdate, 
  onRemove 
}: {
  minimum: MinimumBalanceSetting;
  bankAccountTranslations: any;
  onUpdate: (id: string, field: 'amount' | 'description', value: string | number) => void;
  onRemove: (id: string) => void;
}) => (
  <div className='grid grid-cols-12 gap-2 items-center'>
    <div className='col-span-4'>
      <Input
        placeholder={bankAccountTranslations.amount}
        type='number'
        step='0.01'
        value={minimum.amount || ''}
        onChange={(e) => onUpdate(minimum.id, 'amount', parseFloat(e.target.value) || 0)}
        className='text-xs'
      />
    </div>
    <div className='col-span-7'>
      <Input
        placeholder={bankAccountTranslations.descriptionPlaceholder}
        value={minimum.description}
        onChange={(e) => onUpdate(minimum.id, 'description', e.target.value)}
        className='text-xs'
      />
    </div>
    <div className='col-span-1'>
      <Button
        type='button'
        variant='ghost'
        size='sm'
        onClick={() => onRemove(minimum.id)}
        className='h-8 w-8 p-0 text-destructive hover:text-destructive'
      >
        <Trash2 className='w-3 h-3' />
      </Button>
    </div>
  </div>
));