// Main inventory components
export { ElementTable } from './ElementTable';
export type { ElementTableProps } from './ElementTable';

export { ElementCard } from './ElementCard';
export type { ElementCardProps } from './ElementCard';

export { ElementForm } from './ElementForm';
export type { ElementFormProps } from './ElementForm';

export { UniformatBrowser } from './UniformatBrowser';
export type { UniformatBrowserProps, UniformatCode } from './UniformatBrowser';

export { DocumentManager } from './DocumentManager';
export type { DocumentManagerProps, DocumentFile } from './DocumentManager';

export { HistoryTable } from './HistoryTable';
export type { HistoryTableProps, ElementHistoryEntry } from './HistoryTable';

export { ElementHistoryForm } from './ElementHistoryForm';
export type { ElementHistoryFormProps } from './ElementHistoryForm';

// Convenience re-exports for common patterns
export {
  // Re-export foundation components used throughout inventory
  FormModal,
  FormFieldWrapper,
} from '../FormModal';

export {
  UploadDropzone,
} from '../UploadDropzone';

export type { UploadedFile } from '../UploadDropzone';

export {
  DataTable,
} from '../DataTable';

export {
  ConditionBadge,
  StatusBadge,
  PriorityBadge,
  EvaluationStatusBadge,
} from '../StatusBadges';

export type {
  ElementCondition,
  ProjectStatus,
  Priority,
  EvaluationStatus,
} from '../StatusBadges';