/**
 * Lazy-loaded auto-projects components for better code splitting
 * Reduces main bundle size by loading auto-project components on demand
 */

import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Lazy load auto-projects components to reduce bundle size
export const LazyAutoProjectsSection = lazy(() => 
  import('./AutoProjectsSection').then(module => ({ default: module.AutoProjectsSection }))
);

export const LazyAutoProjectCard = lazy(() => 
  import('./AutoProjectCard').then(module => ({ default: module.AutoProjectCard }))
);

export const LazyAutoProjectDialog = lazy(() => 
  import('./AutoProjectDialog').then(module => ({ default: module.AutoProjectDialog }))
);

// Wrapper components with Suspense for easy use
export function AutoProjectsSection(props: any) {
  return (
    <Suspense fallback={<div className="space-y-4"><LoadingSpinner /><p className="text-center text-muted-foreground">Loading auto-generated projects...</p></div>}>
      <LazyAutoProjectsSection {...props} />
    </Suspense>
  );
}

export function AutoProjectCard(props: any) {
  return (
    <Suspense fallback={<div className="h-32 bg-muted rounded-lg animate-pulse" />}>
      <LazyAutoProjectCard {...props} />
    </Suspense>
  );
}

export function AutoProjectDialog(props: any) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LazyAutoProjectDialog {...props} />
    </Suspense>
  );
}