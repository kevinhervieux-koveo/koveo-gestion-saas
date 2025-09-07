import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/hooks/use-language';
import type { Building } from './DemandCard';

// Filter state interface
/**
 *
 */
export interface FilterState {
  searchTerm: string;
  statusFilter: string;
  typeFilter: string;
  buildingFilter?: string;
}

// Filter change handlers
/**
 *
 */
export interface FilterHandlers {
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onBuildingChange?: (value: string) => void;
}

// Filter options for different user roles - now using translation keys
const getStatusOptions = (t: (key: string) => string) => [
  { value: 'all', label: t('allStatusFilter') },
  { value: 'draft', label: t('draftFilter') },
  { value: 'submitted', label: t('submittedFilter') },
  { value: 'under_review', label: t('underReviewFilter') },
  { value: 'approved', label: t('approvedFilter') },
  { value: 'in_progress', label: t('inProgressFilter') },
  { value: 'completed', label: t('completedFilter') },
  { value: 'rejected', label: t('rejectedFilter') },
  { value: 'cancelled', label: t('cancelledFilter') },
];

const getManagerStatusOptions = (t: (key: string) => string) => [
  { value: 'all', label: t('allStatusFilter') },
  { value: 'submitted', label: t('submittedFilter') },
  { value: 'under_review', label: t('underReviewFilter') },
  { value: 'approved', label: t('approvedFilter') },
  { value: 'in_progress', label: t('inProgressFilter') },
  { value: 'completed', label: t('completedFilter') },
  { value: 'rejected', label: t('rejectedFilter') },
];

const getTypeOptions = (t: (key: string) => string) => [
  { value: 'all', label: t('allTypesFilter') },
  { value: 'maintenance', label: t('maintenanceFilter') },
  { value: 'complaint', label: t('complaintFilter') },
  { value: 'information', label: t('informationFilter') },
  { value: 'other', label: t('otherFilter') },
];

/**
 *
 */
interface DemandFiltersProps {
  filters: FilterState;
  handlers: FilterHandlers;
  userRole?: 'manager' | 'resident';
  buildings?: Building[];
  searchPlaceholder?: string;
  className?: string;
}

/**
 * Common demand filtering component
 * Supports search, status, type, and optional building filters.
 * @param root0
 * @param root0.filters
 * @param root0.handlers
 * @param root0.userRole
 * @param root0.buildings
 * @param root0.searchPlaceholder
 * @param root0.className
 */
export function DemandFilters({
  filters,
  handlers,
  userRole = 'resident',
  buildings = [],
  searchPlaceholder,
  className = '',
}: DemandFiltersProps) {
  const { t } = useLanguage();
  const statusOptions = userRole === 'manager' ? getManagerStatusOptions(t) : getStatusOptions(t);
  const typeOptions = getTypeOptions(t);
  const showBuildingFilter = userRole === 'manager' && handlers.onBuildingChange;
  const placeholder = searchPlaceholder || t('searchDemands');

  return (
    <div className={`flex items-center gap-4 flex-wrap ${className}`}>
      {/* Search Input */}
      <div className='relative flex-1 max-w-sm'>
        <Search className='absolute left-3 top-3 h-4 w-4 text-muted-foreground' />
        <Input
          placeholder={placeholder}
          value={filters.searchTerm}
          onChange={(e) => handlers.onSearchChange(e.target.value)}
          className='pl-10'
          data-testid='search-demands'
        />
      </div>

      {/* Status Filter */}
      <Select value={filters.statusFilter} onValueChange={handlers.onStatusChange}>
        <SelectTrigger className='w-40' data-testid='filter-status'>
          <SelectValue placeholder={t('formStatus')} />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Type Filter */}
      <Select value={filters.typeFilter} onValueChange={handlers.onTypeChange}>
        <SelectTrigger className='w-40' data-testid='filter-type'>
          <SelectValue placeholder={t('formType')} />
        </SelectTrigger>
        <SelectContent>
          {typeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Building Filter (Manager only) */}
      {showBuildingFilter && (
        <Select value={filters.buildingFilter || 'all'} onValueChange={handlers.onBuildingChange}>
          <SelectTrigger className='w-40' data-testid='filter-building'>
            <SelectValue placeholder={t('building')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('allBuildings')}</SelectItem>
            {buildings.map((building) => (
              <SelectItem key={building.id} value={building.id}>
                {building.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// Utility function to filter demands based on filter state
/**
 *
 * @param demands
 * @param filters
 */
export function filterDemands<
  T extends {
    description: string;
    type: string;
    status: string;
    buildingId?: string;
    submitter?: { firstName: string; lastName: string; email: string };
  },
>(demands: T[], filters: FilterState): T[] {
  return demands.filter((demand) => {
    // Search filter
    const searchLower = filters.searchTerm.toLowerCase();
    const matchesSearch =
      !filters.searchTerm ||
      demand.description.toLowerCase().includes(searchLower) ||
      demand.type.toLowerCase().includes(searchLower) ||
      (demand.submitter &&
        (demand.submitter.firstName.toLowerCase().includes(searchLower) ||
          demand.submitter.lastName.toLowerCase().includes(searchLower) ||
          demand.submitter.email.toLowerCase().includes(searchLower)));

    // Status filter
    const matchesStatus = filters.statusFilter === 'all' || demand.status === filters.statusFilter;

    // Type filter
    const matchesType = filters.typeFilter === 'all' || demand.type === filters.typeFilter;

    // Building filter (optional)
    const matchesBuilding =
      !filters.buildingFilter ||
      filters.buildingFilter === 'all' ||
      demand.buildingId === filters.buildingFilter;

    return matchesSearch && matchesStatus && matchesType && matchesBuilding;
  });
}

export default DemandFilters;
