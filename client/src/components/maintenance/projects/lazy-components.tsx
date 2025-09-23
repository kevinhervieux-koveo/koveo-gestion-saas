/**
 * Lazy-loaded project components for better code splitting
 * Reduces main bundle size by loading project components on demand
 */

import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Lazy load project components to reduce bundle size
export const LazyProjectTable = lazy(() => 
  import('./ProjectTable').then(module => ({ default: module.ProjectTable }))
);

export const LazyProjectForm = lazy(() => 
  import('./ProjectForm').then(module => ({ default: module.ProjectForm }))
);

export const LazyProjectElements = lazy(() => 
  import('./ProjectElements').then(module => ({ default: module.ProjectElements }))
);

export const LazyProjectBudget = lazy(() => 
  import('./ProjectBudget').then(module => ({ default: module.ProjectBudget }))
);

export const LazyVendorForm = lazy(() => 
  import('../vendors/VendorForm').then(module => ({ default: module.VendorForm }))
);

// Wrapper components with Suspense for easy use
export function ProjectTable(props: any) {
  return (
    <Suspense fallback={<div className="space-y-4"><LoadingSpinner /><p className="text-center text-muted-foreground">Loading projects table...</p></div>}>
      <LazyProjectTable {...props} />
    </Suspense>
  );
}

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

export function VendorForm(props: any) {
  return (
    <Suspense fallback={<div className="h-96 bg-muted rounded-lg animate-pulse flex items-center justify-center"><LoadingSpinner /></div>}>
      <LazyVendorForm {...props} />
    </Suspense>
  );
}