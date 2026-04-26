/**
 * Lazy-loaded inventory components for better code splitting
 * Reduces main bundle size by loading inventory components on demand
 */

import { lazy, memo, Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Lazy load inventory components to reduce bundle size. Each lazy() call is
// module-scoped so the underlying chunk is fetched at most once across the
// whole app — re-rendering one of the wrapper components below never re-runs
// the dynamic import.
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

// Stable Suspense fallback elements. Hoisting these out of the wrapper
// bodies means each render reuses the same React element identity instead of
// allocating a fresh `<div>` tree on every parent re-render — which matters
// because these wrappers (ElementTable, ElementForm, …) sit on a hot render
// path inside the manager-area pages and used to contribute to the
// "[Violation] handler took N ms" warnings.
const ElementTableFallback = (
  <div className="space-y-4">
    <LoadingSpinner />
    <p className="text-center text-muted-foreground">Loading elements table...</p>
  </div>
);
const ElementFormFallback = (
  <div className="h-96 bg-muted rounded-lg animate-pulse flex items-center justify-center">
    <LoadingSpinner />
  </div>
);
const ElementCardFallback = <div className="h-32 bg-muted rounded-lg animate-pulse" />;
const UniformatBrowserFallback = (
  <div className="h-64 bg-muted rounded-lg animate-pulse flex items-center justify-center">
    <LoadingSpinner />
  </div>
);
const DocumentManagerFallback = (
  <div className="h-96 bg-muted rounded-lg animate-pulse flex items-center justify-center">
    <LoadingSpinner />
  </div>
);

// Wrapper components with Suspense for easy use. Each wrapper is wrapped in
// React.memo so a parent re-render with stable props doesn't force the
// underlying lazy component to reconcile its (potentially heavy) subtree.
export const ElementTable = memo(function ElementTable(props: any) {
  return (
    <Suspense fallback={ElementTableFallback}>
      <LazyElementTable {...props} />
    </Suspense>
  );
});

export const ElementForm = memo(function ElementForm(props: any) {
  return (
    <Suspense fallback={ElementFormFallback}>
      <LazyElementForm {...props} />
    </Suspense>
  );
});

export const ElementCard = memo(function ElementCard(props: any) {
  return (
    <Suspense fallback={ElementCardFallback}>
      <LazyElementCard {...props} />
    </Suspense>
  );
});

export const UniformatBrowser = memo(function UniformatBrowser(props: any) {
  return (
    <Suspense fallback={UniformatBrowserFallback}>
      <LazyUniformatBrowser {...props} />
    </Suspense>
  );
});

export const DocumentManager = memo(function DocumentManager(props: any) {
  return (
    <Suspense fallback={DocumentManagerFallback}>
      <LazyDocumentManager {...props} />
    </Suspense>
  );
});