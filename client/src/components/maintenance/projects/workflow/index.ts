// Workflow Modal System
// Note: ProjectWorkflowModal is lazy-loaded via lazy-components.tsx to prevent Vite build warnings
// Note: WorkflowTabNavigation is lazy-loaded within ProjectWorkflowModal, so not exported statically

// Note: Individual Tab Components are lazy-loaded within ProjectWorkflowModal, so not exported statically
// This prevents Vite build warnings about components being both statically and dynamically imported

// Types and interfaces (these don't cause bundling conflicts)
export type { ProjectWorkflowModalProps } from './ProjectWorkflowModal';
export type { WorkflowTabNavigationProps } from './WorkflowTabNavigation';
export type { PlannedTabProps } from './PlannedTab';
export type { SubmissionTabProps } from './SubmissionTab';
export type { PreWorkTabProps } from './PreWorkTab';
export type { InProgressTabProps } from './InProgressTab';
export type { PostWorkTabProps } from './PostWorkTab';
export type { CompleteTabProps } from './CompleteTab';