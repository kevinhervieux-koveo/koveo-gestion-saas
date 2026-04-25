import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
// import { useBuildingContext } from '@/hooks/use-building-context';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import {
  Plus,
  Search,
  Filter,
  ChevronLeft,
  Building,
  Package,
  AlertTriangle,
  Clock,
  CheckCircle,
} from 'lucide-react';

interface InventoryHeaderProps {
  className?: string;
  buildingName?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  onAddElement?: () => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  conditionFilter?: string;
  onConditionFilterChange?: (condition: string) => void;
  uniformatFilter?: string;
  onUniformatFilterChange?: (uniformat: string) => void;
  showOverdueOnly?: boolean;
  onShowOverdueChange?: (overdue: boolean) => void;
}

/**
 * InventoryHeader component for the maintenance inventory page
 * Provides page title, breadcrumbs, actions, and filtering controls
 */
export function InventoryHeader({
  className,
  buildingName,
  showBackButton,
  onBack,
  onAddElement,
  searchTerm = '',
  onSearchChange,
  conditionFilter = '',
  onConditionFilterChange,
  uniformatFilter = '',
  onUniformatFilterChange,
  showOverdueOnly = false,
  onShowOverdueChange,
}: InventoryHeaderProps) {
  const { t } = useLanguage();
  // Simplified placeholder - no context for now
  const building = null;
  const availableBuildings = [];
  const setBuildingId = () => {};
  const hasPermission = () => true;
  const [filtersOpen, setFiltersOpen] = useState(false);

  const canEdit = true;
  const canCreate = true;

  return (
    <div className={cn('space-y-4 p-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60', className)}>
      {/* Building Navigation Bar */}
      {showBackButton && (
        <div className="flex items-center gap-3 pb-2 border-b">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="back-to-building">
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t('ihdrBackToBuildingButton')}
          </Button>
          {buildingName && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>/</span>
              <Building className="h-4 w-4" />
              <span className="font-medium">{buildingName}</span>
            </div>
          )}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">
            {t('ihdrPageTitle')}
          </h1>
          {/* eslint-disable-next-line i18n/no-untranslated-jsx-strings -- pre-existing untranslated string (task #708): translate in a follow-up */}
          <p className="text-muted-foreground">
            {t('manageBuildingElementsTrackConditionsAnd')}
          </p>
        </div>

        {/* Primary Actions */}
        <div className="flex items-center gap-2">
          {onAddElement && (
            <Button onClick={onAddElement} data-testid="add-element-button">
              <Plus className="h-4 w-4 mr-2" />
              {t('ihdrAddElement')}
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Global Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={t('ihdrSearchPlaceholder')}
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-10"
            data-testid="global-search-input"
          />
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2">
          <Button
            variant={filtersOpen ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltersOpen(!filtersOpen)}
            data-testid="filters-toggle"
          >
            <Filter className="h-4 w-4 mr-2" />
            {t('ihdrFilters')}
            {(conditionFilter || uniformatFilter || showOverdueOnly) && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {[conditionFilter, uniformatFilter, showOverdueOnly && t('ihdrOverdueLabel')].filter(Boolean).length}
              </Badge>
            )}
          </Button>

          <Button
            variant={showOverdueOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => onShowOverdueChange?.(!showOverdueOnly)}
            data-testid="overdue-filter-button"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            {t('ihdrOverdueEvaluations')}
          </Button>
        </div>
      </div>

      {/* Expanded Filters */}
      {filtersOpen && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg border" data-testid="expanded-filters">
          {/* Condition Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ihdrConditionLabel')}</label>
            <Select value={conditionFilter} onValueChange={onConditionFilterChange}>
              <SelectTrigger data-testid="condition-filter">
                <SelectValue placeholder={t('ihdrAllConditionsPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ihdrAllConditionsItem')}</SelectItem>
                <SelectItem value="excellent">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    {t('ihdrConditionExcellent')}
                  </div>
                </SelectItem>
                <SelectItem value="good">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    {t('ihdrConditionGood')}
                  </div>
                </SelectItem>
                <SelectItem value="fair">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    {t('ihdrConditionFair')}
                  </div>
                </SelectItem>
                <SelectItem value="poor">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    {t('ihdrConditionPoor')}
                  </div>
                </SelectItem>
                <SelectItem value="critical">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    {t('ihdrConditionCritical')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* UNIFORMAT Category Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ihdrUniformatCategoryLabel')}</label>
            <Select value={uniformatFilter} onValueChange={onUniformatFilterChange}>
              <SelectTrigger data-testid="uniformat-filter">
                <SelectValue placeholder={t('ihdrAllCategoriesPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ihdrAllCategoriesItem')}</SelectItem>
                <SelectItem value="A">{t('ihdrUniformatA')}</SelectItem>
                <SelectItem value="B">{t('ihdrUniformatB')}</SelectItem>
                <SelectItem value="C">{t('ihdrUniformatC')}</SelectItem>
                <SelectItem value="D">{t('ihdrUniformatD')}</SelectItem>
                <SelectItem value="E">{t('ihdrUniformatE')}</SelectItem>
                <SelectItem value="F">{t('ihdrUniformatF')}</SelectItem>
                <SelectItem value="G">{t('ihdrUniformatG')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Evaluation Status Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ihdrEvaluationStatusLabel')}</label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={showOverdueOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => onShowOverdueChange?.(!showOverdueOnly)}
                data-testid="overdue-evaluations-filter"
              >
                <Clock className="h-3 w-3 mr-1" />
                {t('ihdrFilterOverdue')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Add due soon filter logic
                }}
                data-testid="due-soon-filter"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                {t('ihdrFilterDueSoon')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Add up to date filter logic
                }}
                data-testid="up-to-date-filter"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                {t('ihdrFilterUpToDate')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { InventoryHeaderProps };
