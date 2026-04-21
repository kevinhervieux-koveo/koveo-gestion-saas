/**
 * Lazy-loaded inventory components for better code splitting
 * Reduces main bundle size by loading inventory components on demand
 */

import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Lazy load inventory components to reduce bundle size
export const LazyElementTable = lazy(() => 
  import('./ElementTable').then(module => ({ default: module.ElementTable }))
);

export const LazyElementForm = lazy(() => 
  import('./ElementForm').then(module => ({ default: module.ElementForm }))
);

export const LazyElementCard = lazy(() => 
  import('./ElementCard').then(module => ({ default: module.ElementCard }))
);

export const LazyUniformatBrowser = lazy(() => 
  import('./UniformatBrowser').then(module => ({ default: module.UniformatBrowser }))
);

export const LazyDocumentManager = lazy(() => 
  import('./DocumentManager').then(module => ({ default: module.DocumentManager }))
);

// Wrapper components with Suspense for easy use
export function ElementTable(props: any) {
  return (
    <Suspense fallback={<div className="space-y-4"><LoadingSpinner /><p className="text-center text-muted-foreground">Loading elements table...</p></div>}>
      <LazyElementTable {...props} />
    </Suspense>
  );
}

export function ElementForm(props: any) {
  return (
    <Suspense fallback={<div className="h-96 bg-muted rounded-lg animate-pulse flex items-center justify-center"><LoadingSpinner /></div>}>
      <LazyElementForm {...props} />
    </Suspense>
  );
}

export function ElementCard(props: any) {
  return (
    <Suspense fallback={<div className="h-32 bg-muted rounded-lg animate-pulse" />}>
      <LazyElementCard {...props} />
    </Suspense>
  );
}

export function UniformatBrowser(props: any) {
  return (
    <Suspense fallback={<div className="h-64 bg-muted rounded-lg animate-pulse flex items-center justify-center"><LoadingSpinner /></div>}>
      <LazyUniformatBrowser {...props} />
    </Suspense>
  );
}

export function DocumentManager(props: any) {
  return (
    <Suspense fallback={<div className="h-96 bg-muted rounded-lg animate-pulse flex items-center justify-center"><LoadingSpinner /></div>}>
      <LazyDocumentManager {...props} />
    </Suspense>
  );
}