import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

// Filter options for different user roles
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

const MANAGER_STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
] as const;

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'information', label: 'Information' },
  { value: 'other', label: 'Other' },
] as const;

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
  searchPlaceholder = 'Search demands...',
  className = ''
}: DemandFiltersProps) {
  const statusOptions = userRole === 'manager' ? MANAGER_STATUS_OPTIONS : STATUS_OPTIONS;
  const showBuildingFilter = userRole === 'manager' && handlers.onBuildingChange;

  return (
    <div className={`flex items-center gap-4 flex-wrap ${className}`}>
      {/* Search Input */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={filters.searchTerm}
          onChange={(e) => handlers.onSearchChange(e.target.value)}
          className="pl-10"
          data-testid="search-demands"
        />
      </div>

      {/* Status Filter */}
      <Select value={filters.statusFilter} onValueChange={handlers.onStatusChange}>
        <SelectTrigger className="w-40" data-testid="filter-status">
          <SelectValue placeholder="Status" />
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
        <SelectTrigger className="w-40" data-testid="filter-type">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          {TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Building Filter (Manager only) */}
      {showBuildingFilter && (
        <Select 
          value={filters.buildingFilter || 'all'} 
          onValueChange={handlers.onBuildingChange}
        >
          <SelectTrigger className="w-40" data-testid="filter-building">
            <SelectValue placeholder="Building" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buildings</SelectItem>
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
export function filterDemands<T extends { 
  description: string; 
  type: string; 
  status: string; 
  buildingId?: string;
  submitter?: { firstName: string; lastName: string; email: string };
}>(
  demands: T[], 
  filters: FilterState
): T[] {
  return demands.filter((demand) => {
    // Search filter
    const searchLower = filters.searchTerm.toLowerCase();
    const matchesSearch = !filters.searchTerm || (
      demand.description.toLowerCase().includes(searchLower) ||
      demand.type.toLowerCase().includes(searchLower) ||
      (demand.submitter && (
        demand.submitter.firstName.toLowerCase().includes(searchLower) ||
        demand.submitter.lastName.toLowerCase().includes(searchLower) ||
        demand.submitter.email.toLowerCase().includes(searchLower)
      ))
    );

    // Status filter
    const matchesStatus = filters.statusFilter === 'all' || demand.status === filters.statusFilter;

    // Type filter
    const matchesType = filters.typeFilter === 'all' || demand.type === filters.typeFilter;

    // Building filter (optional)
    const matchesBuilding = !filters.buildingFilter || 
      filters.buildingFilter === 'all' || 
      demand.buildingId === filters.buildingFilter;

    return matchesSearch && matchesStatus && matchesType && matchesBuilding;
  });
}

export default DemandFilters;