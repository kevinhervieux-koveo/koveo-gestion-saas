/**
 * Lazy-loaded project components for better code splitting
 * Reduces main bundle size by loading project components on demand
 */

import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Lazy load project components to reduce bundle size.
// Note: ProjectTable itself is intentionally NOT lazy here because
// ProjectTableView imports it statically (it is the default view).
export const LazyProjectForm = lazy(() => 
  import('./ProjectForm').then(module => ({ default: module.ProjectForm }))
);

export const LazyProjectElements = lazy(() => 
  import('./ProjectElements').then(module => ({ default: module.ProjectElements }))
);

export const LazyProjectBudget = lazy(() => 
  import('./ProjectBudget').then(module => ({ default: module.ProjectBudget }))
);

export const LazyProjectNotes = lazy(() =>
  import('./ProjectNotes').then(module => ({ default: module.ProjectNotes }))
);

export const LazyProjectTimeline = lazy(() =>
  import('./ProjectTimeline').then(module => ({ default: module.ProjectTimeline }))
);

export const LazyStatusStepper = lazy(() =>
  import('./StatusStepper').then(module => ({ default: module.StatusStepper }))
);

export const LazyVendorForm = lazy(() => 
  import('../vendors/VendorForm').then(module => ({ default: module.VendorForm }))
);

// Wrapper components with Suspense for easy use
export function ProjectForm(props: any) {
  return (
    <Suspense fallback={<div className="h-96 bg-muted rounded-lg animate-pulse" />}>
      <LazyProjectForm {...props} />
    </Suspense>
  );
}

export function ProjectElements(props: any) {
  return (
    <Suspense fallback={<div className="h-64 bg-muted rounded-lg animate-pulse flex items-center justify-center"><LoadingSpinner /></div>}>
      <LazyProjectElements {...props} />
    </Suspense>
  );
}

export function ProjectBudget(props: any) {
  return (
    <Suspense fallback={<div className="h-64 bg-muted rounded-lg animate-pulse flex items-center justify-center"><LoadingSpinner /></div>}>
      <LazyProjectBudget {...props} />
    </Suspense>
  );
}

export function ProjectNotes(props: any) {
  return (
    <Suspense fallback={<div className="h-64 bg-muted rounded-lg animate-pulse flex items-center justify-center"><LoadingSpinner /></div>}>
      <LazyProjectNotes {...props} />
    </Suspense>
  );
}

export function ProjectTimeline(props: any) {
  return (
    <Suspense fallback={<div className="h-64 bg-muted rounded-lg animate-pulse flex items-center justify-center"><LoadingSpinner /></div>}>
      <LazyProjectTimeline {...props} />
    </Suspense>
  );
}

export function StatusStepper(props: any) {
  return (
    <Suspense fallback={<div className="h-48 bg-muted rounded-lg animate-pulse flex items-center justify-center"><LoadingSpinner /></div>}>
      <LazyStatusStepper {...props} />
    </Suspense>
  );
}

export function VendorForm(props: any) {
  return (
    <Suspense fallback={<div className="h-96 bg-muted rounded-lg animate-pulse flex items-center justify-center"><LoadingSpinner /></div>}>
      <LazyVendorForm {...props} />
    </Suspense>
  );
}