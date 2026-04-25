// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import { ReactNode } from 'react';
import { Row } from '@tanstack/react-table';
import { 
  EvaluationSuggestion, 
  BuildingElement,
  MaintenanceProject,
  Priority,
  EvaluationStatus,
  SuggestionType
} from '@shared/schemas/maintenance';

// Extended suggestion type with related data
export interface SuggestionWithElement extends EvaluationSuggestion {
  element?: BuildingElement;
  project?: MaintenanceProject;
  costEstimate?: number;
  urgencyScore?: number;
  lifespan?: {
    current: number;
    original: number;
    remaining: number;
    percentage: number;
  };
  seasonalFactor?: 'optimal' | 'acceptable' | 'difficult';
}

// Suggestion card component props
export interface SuggestionCardProps {
  suggestion: SuggestionWithElement;
  onAccept?: (suggestion: SuggestionWithElement) => void;
  onDefer?: (suggestion: SuggestionWithElement, newDate: Date) => void;
  onDismiss?: (suggestion: SuggestionWithElement, reason?: string) => void;
  onCreateProject?: (suggestion: SuggestionWithElement) => void;
  onSchedule?: (suggestion: SuggestionWithElement, date: Date) => void;
  onViewDetails?: (suggestion: SuggestionWithElement) => void;
  showActions?: boolean;
  compact?: boolean;
  className?: string;
}

// Suggestion table component props
export interface SuggestionTableProps {
  buildingId: string;
  suggestions?: SuggestionWithElement[];
  isLoading?: boolean;
  onSuggestionAction?: (suggestion: SuggestionWithElement, action: SuggestionAction) => void;
  onBulkAction?: (suggestions: SuggestionWithElement[], action: BulkSuggestionAction) => void;
  filters?: SuggestionFilters;
  onFiltersChange?: (filters: SuggestionFilters) => void;
  className?: string;
}

// Suggestion form component props
export interface SuggestionFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion?: SuggestionWithElement;
  elementId?: string;
  buildingId: string;
  onSubmit?: (suggestion: SuggestionWithElement) => void;
  mode?: 'create' | 'edit';
}

// Schedule calendar component props
export interface ScheduleCalendarProps {
  buildingId: string;
  events?: CalendarEvent[];
  suggestions?: SuggestionWithElement[];
  projects?: MaintenanceProject[];
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onDragDrop?: (eventId: string, newDate: Date) => void;
  onScheduleSuggestion?: (suggestion: SuggestionWithElement, date: Date) => void;
  showConflicts?: boolean;
  className?: string;
}

// Suggestion workflow component props
export interface SuggestionWorkflowProps {
  suggestion: SuggestionWithElement;
  onStatusChange?: (suggestion: SuggestionWithElement, newStatus: EvaluationStatus) => void;
  onCreateProject?: (suggestion: SuggestionWithElement) => void;
  onAssignVendor?: (suggestion: SuggestionWithElement, vendorId: string) => void;
  showApprovalGates?: boolean;
  className?: string;
}

// Suggestion filters component props
export interface SuggestionFiltersProps {
  filters: SuggestionFilters;
  onFiltersChange: (filters: SuggestionFilters) => void;
  onSavePreset?: (name: string, filters: SuggestionFilters) => void;
  onLoadPreset?: (preset: FilterPreset) => void;
  presets?: FilterPreset[];
  buildingId: string;
  className?: string;
}

// Suggestion dashboard component props
export interface SuggestionDashboardProps {
  buildingId: string;
  organizationId?: string;
  timeRange?: 'week' | 'month' | 'quarter' | 'year';
  onTimeRangeChange?: (timeRange: string) => void;
  onExport?: (format: 'pdf' | 'excel' | 'csv') => void;
  className?: string;
}

// Suggestion analytics component props
export interface SuggestionAnalyticsProps {
  buildingId: string;
  organizationId?: string;
  timeRange?: 'year' | '2years' | '5years';
  onInsightAction?: (insight: AnalyticsInsight, action: string) => void;
  className?: string;
}

// Supporting types

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'evaluation' | 'project' | 'maintenance' | 'deadline' | 'suggestion';
  status?: EvaluationStatus;
  priority?: Priority;
  description?: string;
  suggestionId?: string;
  projectId?: string;
  elementId?: string;
  vendorId?: string;
  duration?: number; // in hours
  conflictsWith?: string[]; // other event IDs
}

export interface SuggestionFilters {
  search?: string;
  types?: SuggestionType[];
  priorities?: Priority[];
  statuses?: EvaluationStatus[];
  elementTypes?: string[]; // UNIFORMAT codes
  dateRange?: {
    start: Date;
    end: Date;
  };
  costRange?: {
    min: number;
    max: number;
  };
  urgencyLevel?: 'low' | 'medium' | 'high' | 'critical';
  seasonalFactor?: 'optimal' | 'acceptable' | 'difficult';
  buildingSection?: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: SuggestionFilters;
  isDefault?: boolean;
  createdAt: Date;
  createdBy: string;
}

export type SuggestionAction = 
  | 'accept'
  | 'defer'
  | 'dismiss'
  | 'schedule'
  | 'create_project'
  | 'view_details'
  | 'edit'
  | 'duplicate';

export type BulkSuggestionAction = 
  | 'accept_multiple'
  | 'bulk_schedule'
  | 'update_priority'
  | 'export'
  | 'dismiss_multiple'
  | 'assign_vendor';

export interface DashboardMetrics {
  totalSuggestions: number;
  pendingSuggestions: number;
  overdueSuggestions: number;
  criticalSuggestions: number;
  totalEstimatedCost: number;
  avgCompletionTime: number; // in days
  acceptanceRate: number; // percentage
  monthlyTrend: {
    month: string;
    suggestions: number;
    completed: number;
    cost: number;
  }[];
  priorityDistribution: {
    priority: Priority;
    count: number;
    percentage: number;
  }[];
  typeDistribution: {
    type: SuggestionType;
    count: number;
    percentage: number;
  }[];
}

export interface AnalyticsInsight {
  id: string;
  type: 'cost_savings' | 'lifespan_optimization' | 'seasonal_planning' | 'risk_mitigation';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  confidence: number; // 0-100
  estimatedSavings?: number;
  recommendedActions: string[];
  dataPoints: {
    metric: string;
    value: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }[];
  affectedElements?: string[]; // element IDs
}

export interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  requiredRole?: 'admin' | 'manager' | 'maintenance';
  estimatedDuration?: number; // in hours
  dependencies?: string[]; // other step IDs
  approvalRequired?: boolean;
  assignedTo?: string; // user ID
  completedAt?: Date;
  notes?: string;
}

export interface ApprovalGate {
  id: string;
  name: string;
  condition: 'cost_threshold' | 'critical_priority' | 'multiple_elements' | 'vendor_required';
  threshold?: number;
  requiredRole: 'admin' | 'manager';
  description: string;
  autoApprove?: boolean;
}

// Utility types for component states
export interface LoadingState {
  isLoading: boolean;
  error?: string | null;
  lastUpdated?: Date;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface SortState {
  field: keyof SuggestionWithElement;
  direction: 'asc' | 'desc';
}

// Export all types
export type {
  EvaluationSuggestion,
  BuildingElement, 
  MaintenanceProject,
  Priority,
  EvaluationStatus,
  SuggestionType
} from '@shared/schemas/maintenance';