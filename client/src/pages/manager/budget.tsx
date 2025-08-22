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
import { DollarSign, Banknote, Settings, TrendingUp, Calculator, Filter, ChevronDown, ChevronUp, X, Plus, Trash2, Calendar, AlertTriangle, ChevronLeft, ChevronRight, Users, Percent, Maximize2, Minimize2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFullscreen } from '@/hooks/use-fullscreen';
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
  const translation = categoryTranslations[category];  /**
   * If function.
   * @param translation - translation parameter.
   */

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

/**
 *
 */
interface BudgetData {
  year: number;
  month: number;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  incomeByCategory: { [category: string]: number };
  expensesByCategory: { [category: string]: number };
  date: string;
  bankBalance: number;
}

/**
 *
 */
interface BankAccountInfo {
  bankAccountNumber: string | null;
  bankAccountNotes: string | null;
  bankAccountUpdatedAt: string | null;
  bankAccountStartDate: string | null;
  bankAccountStartAmount: number | null;
  bankAccountMinimums: string | null; // JSON string of minimum settings
  inflationSettings: string | null; // JSON string of inflation settings
}

/**
 *
 */
interface MinimumBalanceSetting {
  id: string;
  amount: number;
  description: string;
}

/**
 *
 */
interface InflationSetting {
  id: string;
  category: string;
  type: 'income' | 'expense';
  rate: number; // percentage
  applicationMode: 'yearly' | 'one-time';
  targetYear?: number; // For one-time applications
  description: string;
}

/**
 *
 */
interface InflationConfig {
  incomeSettings: InflationSetting[];
  expenseSettings: InflationSetting[];
  generalIncome: number; // General income inflation rate
  generalExpense: number; // General expense inflation rate
}

/**
 *
 */
export default function  /**
   * Budget function.
   */
 Budget() {
  const { language } = useLanguage();
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [viewType, setViewType] = useState<'yearly' | 'monthly'>('yearly');
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
  
  // Year and Month range controls
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const [startYear, setStartYear] = useState(currentYear);
  const [endYear, setEndYear] = useState(currentYear + 3);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [endMonth, setEndMonth] = useState(12);
  
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
      const params = new URLSearchParams();  /**
   * If function.
   * @param selectedBuilding - selectedBuilding parameter.
   */

      if (selectedBuilding) {
        params.append('buildingId', selectedBuilding);
      }
      const response = await fetch(`/api/residences?${params}`);  /**
   * If function.
   * @param !response.ok - !response.ok parameter.
   */

      if (!response.ok) {throw new Error('Failed to fetch residences');}
      return response.json();
    },
    enabled: !!selectedBuilding,
  });

  // Get budget data
  const { data: budgetData, isLoading: budgetLoading } = useQuery({
    queryKey: ['/api/budgets', selectedBuilding, startYear, endYear, viewType, startMonth, endMonth],
    queryFn: () => {
      const params = new URLSearchParams({
        startYear: startYear.toString(),
        endYear: endYear.toString(),
        groupBy: viewType
      });  /**
   * If function.
   * @param viewType === 'monthly' - viewType === 'monthly' parameter.
   */
  /**
   * If function.
   * @param viewType === 'monthly' - viewType === 'monthly' parameter.
   */

      
      if (viewType === 'monthly') {
        params.append('startMonth', startMonth.toString());
        params.append('endMonth', endMonth.toString());
      }
      
      return fetch(`/api/budgets/${selectedBuilding}?${params.toString()}`).then(res => res.json());
    },
    enabled: !!selectedBuilding,
  });

  // Get budget summary
  const { data: budgetSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['/api/budgets', selectedBuilding, 'summary', startYear, endYear, startMonth, endMonth, viewType],
    queryFn: () => {
      const params = new URLSearchParams({
        startYear: startYear.toString(),
        endYear: endYear.toString()
      });
      
      if (viewType === 'monthly') {
        params.append('startMonth', startMonth.toString());
        params.append('endMonth', endMonth.toString());
      }
      
      return fetch(`/api/budgets/${selectedBuilding}/summary?${params.toString()}`).then(res => res.json());
    },
    enabled: !!selectedBuilding,
  });

  // Get bank account info
  const { data: bankAccountInfo } = useQuery<BankAccountInfo>({
    queryKey: ['/api/budgets', selectedBuilding, 'bank-account'],
    queryFn: () => fetch(`/api/budgets/${selectedBuilding}/bank-account`).then(res => res.json()),
    enabled: !!selectedBuilding,
  });

  // Parse minimum balance settings
  const minimumBalanceSettings = useMemo(() => {  /**
   * If function.
   * @param !bankAccountInfo?.bankAccountMinimums - !bankAccountInfo?.bankAccountMinimums parameter.
   */

    if (!bankAccountInfo?.bankAccountMinimums) {return [];}
    try {
      return JSON.parse(bankAccountInfo.bankAccountMinimums) as MinimumBalanceSetting[];
    } catch {
      return [];
    }
  }, [bankAccountInfo?.bankAccountMinimums]);

  // Transform raw data into chart-friendly format
  const chartData: BudgetData[] = useMemo(() => {  /**
   * If function.
   * @param !budgetSummary?.summary - !budgetSummary?.summary parameter.
   */

    if (!budgetSummary?.summary) {return [];}
    
    return budgetSummary.summary.map((item: any) => {
      const totalIncome = item.incomes ? 
        item.incomes.reduce((sum: number, income: string) => sum + parseFloat(income || '0'), 0) : 0;
      const totalExpenses = item.spendings ? 
        item.spendings.reduce((sum: number, expense: string) => sum + parseFloat(expense || '0'), 0) : 0;
      
      // Build income and expense categories
      const incomeByCategory: { [key: string]: number } = {};
      const expensesByCategory: { [key: string]: number } = {};  /**
   * If function.
   * @param item.incomeTypes && item.incomes - item.incomeTypes && item.incomes parameter.
   */

      
      if (item.incomeTypes && item.incomes) {
        item.incomeTypes.forEach((type: string, index: number) => {
          incomeByCategory[type] = parseFloat(item.incomes[index] || '0');
        });
      }  /**
   * If function.
   * @param item.spendingTypes && item.spendings - item.spendingTypes && item.spendings parameter.
   */

      
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

  // Find total minimum balance for chart visualization - optimized
  const minimumBalanceForChart = useMemo(() => {  /**
   * If function.
   * @param !minimumBalanceSettings?.length - !minimumBalanceSettings?.length parameter.
   */

    if (!minimumBalanceSettings?.length) {return null;}
    return minimumBalanceSettings.reduce((sum, m) => sum + m.amount, 0);
  }, [minimumBalanceSettings?.length, minimumBalanceSettings]);

  // Calculate running bank account balance over time
  const chartDataWithBalance = useMemo(() => {  /**
   * If function.
   * @param !chartData?.length - !chartData?.length parameter.
   */
  /**
   * If function.
   * @param !chartData?.length - !chartData?.length parameter.
   */

    if (!chartData?.length) {return [];}
    
    // Use starting balance if available, otherwise start with 0 and build from cash flow
    const startingBalance = bankAccountInfo?.bankAccountStartAmount ?? 0;
    let runningBalance = startingBalance;
    
    return chartData.map((item, index) => {  /**
   * If function.
   * @param index === 0 - index === 0 parameter.
   */
  /**
   * If function.
   * @param index === 0 - index === 0 parameter.
   */

      if (index === 0) {
        // For the first month, add net cash flow to starting balance
        runningBalance = startingBalance + item.netCashFlow;
      } else {
        // For subsequent months, add net cash flow to running balance
        runningBalance += item.netCashFlow;
      }
      
      return {
        ...item,
        bankBalance: runningBalance
      };
    });
  }, [chartData, bankAccountInfo?.bankAccountStartAmount]);

  // Special contribution and property calculations are now defined after filteredChartData

  // Category translation function now uses the moved constant
  
  // Get all available categories with translations - optimized to avoid recalculation
  const availableCategories = useMemo(() => {
    if (!chartData?.length) {return [];}
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
  const filteredChartData = useMemo(() => {  /**
   * If function.
   * @param !chartDataWithBalance?.length || selectedCategories.length === 0 - !chartDataWithBalance?.length || selectedCategories.length === 0 parameter.
   */

    if (!chartDataWithBalance?.length || selectedCategories.length === 0) {return chartDataWithBalance || [];}
    
    const startingBalance = bankAccountInfo?.bankAccountStartAmount ?? 0;
    let runningBalance = startingBalance;
    
    return chartDataWithBalance.map((item, index) => {
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
          });  /**
   * If function.
   * @param originalCatName - originalCatName parameter.
   */
  /**
   * If function.
   * @param originalCatName - originalCatName parameter.
   */

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
      
      const newTotalIncome = selectedCategories.length ? filteredIncome : item.totalIncome;
      const newTotalExpenses = selectedCategories.length ? filteredExpenses : item.totalExpenses;
      const newNetCashFlow = newTotalIncome - newTotalExpenses;
      
      // Recalculate bank balance with the filtered net cash flow
      if (index === 0) {
        runningBalance = startingBalance + newNetCashFlow;
      } else {
        runningBalance += newNetCashFlow;
      }
      
      return {
        ...item,
        totalIncome: newTotalIncome,
        totalExpenses: newTotalExpenses,
        netCashFlow: newNetCashFlow,
        bankBalance: runningBalance,
      };
    });
  }, [chartDataWithBalance, selectedCategories.join(','), language, bankAccountInfo?.bankAccountStartAmount]);

  // Calculate special contribution and property breakdown - optimized
  const specialContribution = useMemo(() => {  /**
   * If function.
   * @param !filteredChartData?.length - !filteredChartData?.length parameter.
   */

    if (!filteredChartData?.length) {return 0;}
    const netCashFlow = filteredChartData.reduce((sum, item) => sum + item.netCashFlow, 0);
    return Math.abs(Math.min(0, netCashFlow));
  }, [filteredChartData]);

  // Get residences for selected building and calculate contributions - optimized
  const propertyContributions = useMemo(() => {  /**
   * If function.
   * @param !selectedBuilding || !residences?.length || specialContribution === 0 - !selectedBuilding || !residences?.length || specialContribution === 0 parameter.
   */

    if (!selectedBuilding || !residences?.length || specialContribution === 0) {return [];}
    
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
      const response = await  /**
   * Fetch .
   * @param `/api/budgets/${data.buildingId}/bank-account` - `/api/budgets/${data.buildingId}/bank-account` parameter.
   * @param {
        method - {
        method parameter.
   * @param headers - HTTP headers object.
   * @param } - } parameter.
   * @param body - Request body data.
   * @param bankAccountNotes - bankAccountNotes parameter.
   * @param bankAccountStartDate - bankAccountStartDate parameter.
   * @param bankAccountStartAmount - bankAccountStartAmount parameter.
   * @returns String result.
   */
 fetch(`/api/budgets/${data.buildingId}/bank-account`, {
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
      if (!response.ok) {throw new Error('Failed to update bank account');}
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

  const updateInflationSetting = useCallback((id: string, field: keyof InflationSetting, value: unknown) => {
    setInflationSettings(prev => prev.map(setting => 
      setting.id === id ? { ...setting, [field]: value } : setting
    ));
  }, []);

  const removeInflationSetting = useCallback((id: string) => {
    setInflationSettings(prev => prev.filter(setting => setting.id !== id));
  }, []);

  // Initialize dialog with existing data
  const initializeDialog = () => {  /**
   * If function.
   * @param bankAccountInfo - bankAccountInfo parameter.
   */

    if (bankAccountInfo) {
      setBankAccountNumber(bankAccountInfo.bankAccountNumber || '');
      setReconciliationNote('');
      setBankAccountStartDate(bankAccountInfo.bankAccountStartDate || '');
      setBankAccountStartAmount(bankAccountInfo.bankAccountStartAmount?.toString() || '');
      
      // Parse existing minimum balances  /**
   * If function.
   * @param bankAccountInfo.bankAccountMinimums - bankAccountInfo.bankAccountMinimums parameter.
   */

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
  const handleUpdateBankAccount = useCallback(() => {  /**
   * If function.
   * @param !selectedBuilding - !selectedBuilding parameter.
   */

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
  }, [selectedBuilding, reconciliationNote, bankAccountStartDate, bankAccountStartAmount, minimumBalances, updateBankAccount, toast, language]);  /**
   * Return function.
   * @param <div className='min-h-screen bg-gray-50'>
      <Header 
        title={language === 'fr' ? 'Tableau de bord budgétaire' - <div className='min-h-screen bg-gray-50'>
      <Header 
        title={language === 'fr' ? 'Tableau de bord budgétaire' parameter.
   * @returns (
              <>
                <Maximize2 className='w-4 h-4' />
                <span className='hidden sm:inline'> result.
   */


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
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className='flex items-center gap-2 flex-shrink-0'
            data-testid="button-fullscreen-toggle"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className='w-4 h-4' />
                <span className='hidden sm:inline'>
                  {language === 'fr' ? 'Quitter plein écran' : 'Exit Fullscreen'}
                </span>
              </>
            ) : (
              <>
                <Maximize2 className='w-4 h-4' />
                <span className='hidden sm:inline'>
                  {language === 'fr' ? 'Plein écran' : 'Fullscreen'}
                </span>
              </>
            )}
          </Button>
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
                        setStartYear(currentYear);
                        setEndYear(currentYear + 3);
                        setStartMonth(currentMonth);
                        setEndMonth(12);
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
                {(selectedCategories.length > 0 || startYear !== currentYear || endYear !== (currentYear + 3) || (viewType === 'monthly' && (startMonth !== currentMonth || endMonth !== 12))) && (
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
                      {(startYear !== currentYear || endYear !== (currentYear + 3) || (viewType === 'monthly' && (startMonth !== currentMonth || endMonth !== 12))) && (
                        <span className='px-2 py-1 bg-green-100 text-green-700 rounded text-xs'>
                          {viewType === 'monthly' 
                            ? `${startMonth}/${startYear} - ${endMonth}/${endYear}`
                            : `${startYear} - ${endYear}`
                          }
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
                    
                    {viewType === 'monthly' ? (
                      <>
                        <div className='space-y-2'>
                          <Label className='text-sm font-medium'>{language === 'fr' ? 'De (Mois/Année)' : 'From (Month/Year)'}</Label>
                          <div className='grid grid-cols-2 gap-2'>
                            <Select value={startMonth.toString()} onValueChange={(value) => setStartMonth(parseInt(value))}>
                              <SelectTrigger className='h-9'>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                  <SelectItem key={month} value={month.toString()}>
                                    {language === 'fr' ? 
                                      ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'][month - 1] :
                                      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]
                                    }
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                        </div>
                        
                        <div className='space-y-2'>
                          <Label className='text-sm font-medium'>{language === 'fr' ? 'À (Mois/Année)' : 'To (Month/Year)'}</Label>
                          <div className='grid grid-cols-2 gap-2'>
                            <Select value={endMonth.toString()} onValueChange={(value) => setEndMonth(parseInt(value))}>
                              <SelectTrigger className='h-9'>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                  <SelectItem key={month} value={month.toString()}>
                                    {language === 'fr' ? 
                                      ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'][month - 1] :
                                      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]
                                    }
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
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
                            onChange={(e) => {  /**
   * If function.
   * @param e.target.checked - e.target.checked parameter.
   */

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
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4'>
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
                  <ChartContainer config={chartConfig} className='h-[300px] sm:h-[400px]'>
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
                        <linearGradient id='colorBankBalance' x1='0' y1='0' x2='0' y2='1'>
                          <stop offset='5%' stopColor='hsl(200, 80%, 60%)' stopOpacity={0.6}/>
                          <stop offset='95%' stopColor='hsl(200, 80%, 60%)' stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray='3 3' />
                      <XAxis 
                        dataKey='date' 
                        tickFormatter={(value) => {
                          const [year, month] = value.split('-');  /**
   * If function.
   * @param viewType === 'yearly' - viewType === 'yearly' parameter.
   */

                          if (viewType === 'yearly') {
                            // For yearly view, only show year (and only for January dates)
                            return month === '01' ? year : '';
                          } else {
                            // For monthly view, show year-month
                            return `${year}-${month}`;
                          }
                        }}
                      />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <ChartTooltip 
                        content={({ active, payload, label }) => {  /**
   * If function.
   * @param active && payload && payload.length - active && payload && payload.length parameter.
   */

                          if (active && payload && payload.length) {
                            const [year, month] = String(label).split('-');
                            return (
                              <div className="bg-white p-3 border rounded shadow-lg">
                                <p className="font-medium mb-2">{`${year}-${month}`}</p>
                                {payload.map((entry, index) => {
                                  let name = '';
                                  let color = entry.color;  /**
   * If function.
   * @param entry.dataKey === 'totalIncome' - entry.dataKey === 'totalIncome' parameter.
   */

                                  
                                  if (entry.dataKey === 'totalIncome') {
                                    name = language === 'fr' ? 'Revenus totaux' : 'Total Income';
                                    color = 'hsl(120, 70%, 50%)';
                                  } else  /**
   * If function.
   * @param entry.dataKey === 'totalExpenses' - entry.dataKey === 'totalExpenses' parameter.
   */
 if (entry.dataKey === 'totalExpenses') {
                                    name = language === 'fr' ? 'Dépenses totales' : 'Total Expenses';
                                    color = 'hsl(0, 70%, 50%)';
                                  } else  /**
   * If function.
   * @param entry.dataKey === 'bankBalance' - entry.dataKey === 'bankBalance' parameter.
   */
 if (entry.dataKey === 'bankBalance') {
                                    name = language === 'fr' ? 'Solde bancaire' : 'Bank Balance';
                                    color = 'hsl(200, 80%, 60%)';
                                  } else  /**
   * If function.
   * @param typeof entry.value === 'number' && entry.value === minimumBalanceForChart - typeof entry.value === 'number' && entry.value === minimumBalanceForChart parameter.
   */
 if (typeof entry.value === 'number' && entry.value === minimumBalanceForChart) {
                                    name = language === 'fr' ? 'Solde minimum requis' : 'Required Minimum Balance';
                                    color = 'hsl(0, 80%, 60%)';
                                  }  /**
   * If function.
   * @param name - name parameter.
   */

                                  
                                  if (name) {  /**
   * Return function.
   * @param <div key={index} className="flex items-center gap-2">
                                        <div 
                                          className="w-3 h-3 flex-shrink-0"
                                          style={{ backgroundColor - <div key={index} className="flex items-center gap-2">
                                        <div 
                                          className="w-3 h-3 flex-shrink-0"
                                          style={{ backgroundColor parameter.
   * @returns '0'} $ result.
   */

                                    return (
                                      <div key={index} className="flex items-center gap-2">
                                        <div 
                                          className="w-3 h-3 flex-shrink-0"
                                          style={{ backgroundColor: color }}
                                        />
                                        <span className="text-sm">
                                          {`$${typeof entry.value === 'number' ? entry.value.toLocaleString() : '0'} ${name}`}
                                        </span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            );
                          }
                          return null;
                        }}
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
                      {/* Bank Balance Line */}
                      <Area
                        type='monotone'
                        dataKey='bankBalance'
                        stroke='hsl(200, 80%, 60%)'
                        fill='url(#colorBankBalance)'
                        strokeWidth={3}
                        strokeDasharray="8,4"
                        dot={false}
                        activeDot={{ r: 4 }}
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
                      {!bankAccountInfo.bankAccountStartAmount && (
                        <div className='p-3 bg-orange-50 border border-orange-200 rounded-lg'>
                          <div className='flex items-center gap-2 text-orange-800'>
                            <AlertTriangle className='w-4 h-4' />
                            <span className='text-sm font-medium'>
                              {language === 'fr' ? 
                                'Attention: Le solde initial du compte bancaire n\'est pas défini. Cliquez sur "Mettre à jour le compte" pour le configurer.' :
                                'Warning: Bank account starting balance is not set. Click "Update Account" to configure it.'
                              }
                            </span>
                          </div>
                        </div>
                      )}
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
                          
                          <div className='text-sm'>
                            <strong className='text-muted-foreground'>{bankAccountTranslations.startAmount}</strong>
                            <div className={`font-semibold mt-1 ${bankAccountInfo.bankAccountStartAmount ? 'text-green-600' : 'text-orange-600'}`}>
                              {bankAccountInfo.bankAccountStartAmount 
                                ? `$${Number(bankAccountInfo.bankAccountStartAmount).toLocaleString()}`
                                : (language === 'fr' ? 'Non défini - requis pour le calcul du solde' : 'Not set - required for balance calculation')
                              }
                            </div>
                          </div>
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
                      onOpenChange={(open) => {  /**
   * If function.
   * @param open - open parameter.
   */

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
                            <Label htmlFor='bankAccountNumber'>{bankAccountTranslations.accountNumber}</Label>
                            <Input
                              id='bankAccountNumber'
                              type='text'
                              value={bankAccountNumber}
                              onChange={(e) => setBankAccountNumber(e.target.value)}
                              placeholder={bankAccountTranslations.accountNumberPlaceholder}
                            />
                          </div>
                          
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
                    onOpenChange={(open) => {  /**
   * If function.
   * @param open - open parameter.
   */

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
                                  const response = await apiRequest(
                                    'PUT',
                                    `/api/budgets/${selectedBuilding}/bank-account`,
                                    {
                                      bankAccountNumber: bankAccountInfo?.bankAccountNumber || '',
                                      bankAccountNotes: bankAccountInfo?.bankAccountNotes || '',
                                      bankAccountStartDate: bankAccountInfo?.bankAccountStartDate || null,
                                      bankAccountStartAmount: bankAccountInfo?.bankAccountStartAmount || null,
                                      bankAccountMinimums: JSON.stringify(minimumBalances),
                                    }
                                  );
                                  
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
                                }  /**
   * Catch function.
   * @param _error - _error parameter.
   */
 catch (_error) {
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
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{inflationTranslations.dialogTitle}</DialogTitle>
                            <DialogDescription>{inflationTranslations.dialogDescription}</DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-6">
                            {/* General Settings */}
                            <div className="space-y-4">
                              <h4 className="text-lg font-medium">{inflationTranslations.generalSettings}</h4>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="generalIncomeInflation">
                                    {inflationTranslations.generalIncome}
                                    <span className="text-xs text-muted-foreground ml-2">
                                      ({language === 'fr' ? 'Ex: 2.5 (inflation) ou -1.0 (déflation)' : 'e.g., 2.5 (inflation) or -1.0 (deflation)'})
                                    </span>
                                  </Label>
                                  <Input
                                    id="generalIncomeInflation"
                                    type="number"
                                    step="any"
                                    value={generalIncomeInflation}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      // Allow empty string or valid decimal numbers (including negative)  /**
   * If function.
   * @param value === '' - value === '' parameter.
   */
  /**
   * If function.
   * @param value === '' - value === '' parameter.
   */

                                      if (value === '') {
                                        setGeneralIncomeInflation(0);
                                      } else {
                                        const numValue = parseFloat(value);
                                        if (!isNaN(numValue)) {
                                          setGeneralIncomeInflation(numValue);
                                        }
                                      }
                                    }}
                                    placeholder={language === 'fr' ? '2,5 ou -1,0' : '2.5 or -1.0'}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="generalExpenseInflation">
                                    {inflationTranslations.generalExpense}
                                    <span className="text-xs text-muted-foreground ml-2">
                                      ({language === 'fr' ? 'Ex: 3.0 (inflation) ou -2.0 (déflation)' : 'e.g., 3.0 (inflation) or -2.0 (deflation)'})
                                    </span>
                                  </Label>
                                  <Input
                                    id="generalExpenseInflation"
                                    type="number"
                                    step="any"
                                    value={generalExpenseInflation}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      // Allow empty string or valid decimal numbers (including negative)
                                      if (value === '') {
                                        setGeneralExpenseInflation(0);
                                      } else {
                                        const numValue = parseFloat(value);
                                        if (!isNaN(numValue)) {
                                          setGeneralExpenseInflation(numValue);
                                        }
                                      }
                                    }}
                                    placeholder={language === 'fr' ? '3,0 ou -2,0' : '3.0 or -2.0'}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Category Specific Settings */}
                            <div className="space-y-4">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="splitIncomeByCategory"
                                  checked={splitIncomeByCategory}
                                  onChange={(e) => setSplitIncomeByCategory(e.target.checked)}
                                  className="rounded"
                                />
                                <Label htmlFor="splitIncomeByCategory" className="text-sm font-medium">
                                  {inflationTranslations.splitByCategory} - {inflationTranslations.incomeByCategory}
                                </Label>
                              </div>
                              
                              {splitIncomeByCategory && (
                                <div className="ml-6 p-4 border rounded-lg space-y-3">
                                  <p className="text-sm text-muted-foreground">{inflationTranslations.incomeByCategory}</p>
                                  {/* Income category specific controls would go here */}
                                  <p className="text-xs text-muted-foreground">
                                    {language === 'fr' ? 'Configuration spécifique par catégorie à venir.' : 'Category-specific configuration coming soon.'}
                                  </p>
                                </div>
                              )}
                              
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="splitExpenseByCategory"
                                  checked={splitExpenseByCategory}
                                  onChange={(e) => setSplitExpenseByCategory(e.target.checked)}
                                  className="rounded"
                                />
                                <Label htmlFor="splitExpenseByCategory" className="text-sm font-medium">
                                  {inflationTranslations.splitByCategory} - {inflationTranslations.expenseByCategory}
                                </Label>
                              </div>
                              
                              {splitExpenseByCategory && (
                                <div className="ml-6 p-4 border rounded-lg space-y-3">
                                  <p className="text-sm text-muted-foreground">{inflationTranslations.expenseByCategory}</p>
                                  {/* Expense category specific controls would go here */}
                                  <p className="text-xs text-muted-foreground">
                                    {language === 'fr' ? 'Configuration spécifique par catégorie à venir.' : 'Category-specific configuration coming soon.'}
                                  </p>
                                </div>
                              )}
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex justify-end gap-2 pt-4">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setInflationDialog(false)}
                              >
                                {language === 'fr' ? 'Annuler' : 'Cancel'}
                              </Button>
                              <Button
                                onClick={() => {
                                  // Here you would save the inflation settings
                                  // For now, just close the dialog
                                  setInflationDialog(false);
                                  toast({
                                    title: language === 'fr' ? 'Paramètres sauvegardés' : 'Settings Saved',
                                    description: language === 'fr' ? 'Les paramètres d\'inflation ont été mis à jour.' : 'Inflation settings have been updated.',
                                  });
                                }}
                              >
                                {language === 'fr' ? 'Sauvegarder' : 'Save'}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
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
                            <div className='grid grid-cols-3 md:grid-cols-4 gap-4 font-medium text-sm'>
                              <div>{contributionTranslations.unit}</div>
                              <div className='hidden md:block'>{contributionTranslations.floor}</div>
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
    <div className='grid grid-cols-3 md:grid-cols-4 gap-4 text-sm'>
      <div className='font-medium'>{property.unitNumber}</div>
      <div className='hidden md:block text-muted-foreground'>{property.floor}</div>
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
  <div className='flex flex-col sm:grid sm:grid-cols-12 gap-2 items-center'>
    <div className='w-full sm:col-span-4'>
      <Input
        placeholder={bankAccountTranslations.amount}
        type='number'
        step='0.01'
        value={minimum.amount || ''}
        onChange={(e) => onUpdate(minimum.id, 'amount', parseFloat(e.target.value) || 0)}
        className='text-xs'
      />
    </div>
    <div className='w-full sm:col-span-7'>
      <Input
        placeholder={bankAccountTranslations.descriptionPlaceholder}
        value={minimum.description}
        onChange={(e) => onUpdate(minimum.id, 'description', e.target.value)}
        className='text-xs'
      />
    </div>
    <div className='w-full sm:col-span-1'>
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