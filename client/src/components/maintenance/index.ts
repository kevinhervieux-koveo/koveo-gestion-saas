// DataTable exports
export { DataTable } from './DataTable';
export type { DataTableProps } from './DataTable';

// FormModal exports
export { FormModal, FormFieldWrapper } from './FormModal';
export type { FormModalProps } from './FormModal';

// UploadDropzone exports
export { UploadDropzone } from './UploadDropzone';
export type { UploadedFile, UploadDropzoneProps } from './UploadDropzone';

// StatusBadges exports
export { 
  StatusBadge, 
  ConditionBadge, 
  PriorityBadge, 
  EvaluationStatusBadge,
  projectStatusConfig,
  conditionConfig,
  priorityConfig,
  evaluationStatusConfig 
} from './StatusBadges';
export type { 
  ProjectStatus, 
  ElementCondition, 
  Priority, 
  EvaluationStatus,
  StatusBadgeProps,
  ConditionBadgeProps,
  PriorityBadgeProps,
  EvaluationStatusBadgeProps
} from './StatusBadges';

// Calendar exports
export { ScheduleCalendar, SimpleTimeline } from './Calendar';
export type { 
  CalendarEvent, 
  TimelineEvent, 
  ScheduleCalendarProps, 
  SimpleTimelineProps 
} from './Calendar';

// Building context exports
export { 
  BuildingContextProvider, 
  useBuildingContext, 
  useBuildingSelection, 
  useBuildingPermissions 
} from '../../hooks/use-building-context';
export type { 
  BuildingData, 
  UserPermissions, 
  BuildingContextType, 
  BuildingContextProviderProps 
} from '../../hooks/use-building-context';