/**
 * Lazy-loaded workflow components for better code splitting
 * Reduces main bundle size by loading workflow components on demand
 */

import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Lazy load workflow components to reduce bundle size
export const LazyProjectWorkflowModal = lazy(() => 
  import('./ProjectWorkflowModal').then(module => ({ default: module.ProjectWorkflowModal }))
);

export const LazyWorkflowTabNavigation = lazy(() => 
  import('./WorkflowTabNavigation').then(module => ({ default: module.WorkflowTabNavigation }))
);


export const LazyPlannedTab = lazy(() => 
  import('./PlannedTab').then(module => ({ default: module.PlannedTab }))
);

export const LazySubmissionTab = lazy(() => 
  import('./SubmissionTab').then(module => ({ default: module.SubmissionTab }))
);

export const LazyPreWorkTab = lazy(() => 
  import('./PreWorkTab').then(module => ({ default: module.PreWorkTab }))
);

export const LazyInProgressTab = lazy(() => 
  import('./InProgressTab').then(module => ({ default: module.InProgressTab }))
);

export const LazyPostWorkTab = lazy(() => 
  import('./PostWorkTab').then(module => ({ default: module.PostWorkTab }))
);

export const LazyCompleteTab = lazy(() => 
  import('./CompleteTab').then(module => ({ default: module.CompleteTab }))
);

// Wrapper components with Suspense for easy use
export function ProjectWorkflowModal(props: any) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LazyProjectWorkflowModal {...props} />
    </Suspense>
  );
}

export function WorkflowTabNavigation(props: any) {
  return (
    <Suspense fallback={<div className="h-16 flex items-center justify-center"><LoadingSpinner /></div>}>
      <LazyWorkflowTabNavigation {...props} />
    </Suspense>
  );
}


export function PlannedTab(props: any) {
  return (
    <Suspense fallback={<div className="p-4 flex justify-center"><LoadingSpinner /></div>}>
      <LazyPlannedTab {...props} />
    </Suspense>
  );
}

export function SubmissionTab(props: any) {
  return (
    <Suspense fallback={<div className="p-4 flex justify-center"><LoadingSpinner /></div>}>
      <LazySubmissionTab {...props} />
    </Suspense>
  );
}

export function PreWorkTab(props: any) {
  return (
    <Suspense fallback={<div className="p-4 flex justify-center"><LoadingSpinner /></div>}>
      <LazyPreWorkTab {...props} />
    </Suspense>
  );
}

export function InProgressTab(props: any) {
  return (
    <Suspense fallback={<div className="p-4 flex justify-center"><LoadingSpinner /></div>}>
      <LazyInProgressTab {...props} />
    </Suspense>
  );
}

export function PostWorkTab(props: any) {
  return (
    <Suspense fallback={<div className="p-4 flex justify-center"><LoadingSpinner /></div>}>
      <LazyPostWorkTab {...props} />
    </Suspense>
  );
}

export function CompleteTab(props: any) {
  return (
    <Suspense fallback={<div className="p-4 flex justify-center"><LoadingSpinner /></div>}>
      <LazyCompleteTab {...props} />
    </Suspense>
  );
}