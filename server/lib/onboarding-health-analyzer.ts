/**
 * Shared onboarding health analyzer (Task #1572).
 *
 * Consumed by both:
 *  - GET /api/onboarding/health  (server/api/auto/onboarding.ts)
 *  - scripts/onboarding-health.ts (CI / manual freshness check)
 *
 * Centralizing the logic here guarantees the API and the script produce
 * identical reports for the same inputs.
 *
 * Report sections:
 *  - Coverage: which required features are not covered by the manifest.
 *  - Coverage (tour): which required features are not addressed by any
 *    tour step's `covers[]` array.
 *  - Stale anchors: anchors that don't match the [data-onboarding="..."]
 *    convention from CONTRIBUTING.md.
 *  - Version skew: tours present in source but not registered, registered
 *    tours no longer in source, and content-hash drift between the live
 *    tour content and what is recorded in onboarding_versions.
 */

import { createHash } from 'crypto';

export interface AnalyzerManifestFeature {
  featureId: string;
  description?: string | null;
  isRequired: boolean;
  coveredByTour: string | null;
  anchorSelector: string | null;
}

export interface AnalyzerTourStep {
  id: string;
  anchor?: string | null;
  covers?: string[] | null;
}

export interface AnalyzerTour {
  tourId: string;
  steps: AnalyzerTourStep[];
}

export interface AnalyzerVersionRow {
  tourId: string;
  version: number;
  contentHash?: string | null;
}

export interface StaleAnchorEntry {
  source: 'manifest' | 'tour';
  anchor: string;
  tourId?: string;
  stepId?: string;
  featureId?: string;
}

export interface VersionSkewEntry {
  tourId: string;
  reason: 'unregistered' | 'orphaned' | 'hash_drift';
  registeredVersion?: number;
  registeredHash?: string | null;
  currentHash?: string;
}

export interface VersionSkewReport {
  registered: number;
  unregisteredTours: string[];
  orphanedVersions: string[];
  hashDrift: VersionSkewEntry[];
  entries: VersionSkewEntry[];
}

export interface OnboardingHealthReport {
  generatedAt: string;
  status: 'healthy' | 'degraded';
  source: string;
  summary: {
    totalFeatures: number;
    coveredByManifest: number;
    uncoveredRequiredManifest: number;
    uncoveredRequiredTour: number;
    staleAnchors: number;
    tours: number;
    versionSkew: number;
  };
  uncoveredRequiredManifest: AnalyzerManifestFeature[];
  uncoveredRequiredTour: AnalyzerManifestFeature[];
  staleAnchors: StaleAnchorEntry[];
  versionSkew: VersionSkewReport;
}

const ANCHOR_PREFIX = '[data-onboarding="';

/**
 * Compute a stable content hash for a tour. Mirrors any future
 * registration logic so we can detect drift. Hash is over the ordered
 * step ids + anchors + covers — copy text changes alone do not bump the
 * hash because the hash is meant to detect structural drift.
 */
export function computeTourContentHash(tour: AnalyzerTour): string {
  const canonical = JSON.stringify({
    tourId: tour.tourId,
    steps: tour.steps.map((s) => ({
      id: s.id,
      anchor: s.anchor ?? null,
      covers: [...(s.covers ?? [])].sort(),
    })),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function analyzeVersionSkew(
  tours: AnalyzerTour[],
  versions: AnalyzerVersionRow[],
): VersionSkewReport {
  const versionByTourId = new Map(versions.map((v) => [v.tourId, v]));
  const sourceTourIds = new Set(tours.map((t) => t.tourId));

  const entries: VersionSkewEntry[] = [];

  for (const tour of tours) {
    const registered = versionByTourId.get(tour.tourId);
    const currentHash = computeTourContentHash(tour);

    if (!registered) {
      entries.push({
        tourId: tour.tourId,
        reason: 'unregistered',
        currentHash,
      });
      continue;
    }

    if (registered.contentHash && registered.contentHash !== currentHash) {
      entries.push({
        tourId: tour.tourId,
        reason: 'hash_drift',
        registeredVersion: registered.version,
        registeredHash: registered.contentHash,
        currentHash,
      });
    }
  }

  for (const v of versions) {
    if (!sourceTourIds.has(v.tourId)) {
      entries.push({
        tourId: v.tourId,
        reason: 'orphaned',
        registeredVersion: v.version,
        registeredHash: v.contentHash,
      });
    }
  }

  return {
    registered: versions.length,
    unregisteredTours: entries.filter((e) => e.reason === 'unregistered').map((e) => e.tourId),
    orphanedVersions: entries.filter((e) => e.reason === 'orphaned').map((e) => e.tourId),
    hashDrift: entries.filter((e) => e.reason === 'hash_drift'),
    entries,
  };
}

/**
 * Build the canonical onboarding health report.
 *
 * @param manifest   Feature manifest rows (from DB or fallback parser).
 * @param tours      Tour definitions (from the unified content source).
 * @param source     Human-readable label for the manifest source.
 * @param versions   Optional registered-version rows (from onboarding_versions).
 *                   When omitted, version skew is computed against an empty set
 *                   (so every source tour shows up as `unregistered`, which is
 *                   the correct behavior for an environment with no registry).
 */
export function analyzeOnboardingHealth(
  manifest: AnalyzerManifestFeature[],
  tours: AnalyzerTour[],
  source: string,
  versions: AnalyzerVersionRow[] = [],
): OnboardingHealthReport {
  // --- Manifest analysis ---
  const coveredFeatureIds = new Set(
    manifest.filter((row) => row.coveredByTour !== null).map((row) => row.featureId),
  );

  const uncoveredRequiredManifest = manifest.filter(
    (row) => row.isRequired && !coveredFeatureIds.has(row.featureId),
  );

  const staleAnchorsManifest: StaleAnchorEntry[] = manifest
    .filter((row) => row.anchorSelector && !row.anchorSelector.startsWith(ANCHOR_PREFIX))
    .map((row) => ({
      source: 'manifest' as const,
      anchor: row.anchorSelector!,
      featureId: row.featureId,
    }));

  // --- Tour content analysis ---
  const tourStaleAnchors: StaleAnchorEntry[] = [];
  const tourCoveredFeatures = new Set<string>();

  for (const tour of tours) {
    for (const step of tour.steps) {
      if (step.anchor && !step.anchor.startsWith(ANCHOR_PREFIX)) {
        tourStaleAnchors.push({
          source: 'tour',
          tourId: tour.tourId,
          stepId: step.id,
          anchor: step.anchor,
        });
      }
      for (const feature of step.covers ?? []) {
        tourCoveredFeatures.add(feature.toLowerCase());
      }
    }
  }

  const uncoveredRequiredTour = manifest.filter((row) => {
    if (!row.isRequired) return false;
    const nameLower = row.featureId.toLowerCase();
    return !Array.from(tourCoveredFeatures).some(
      (covered) => covered.includes(nameLower) || nameLower.includes(covered),
    );
  });

  const allStaleAnchors = [...staleAnchorsManifest, ...tourStaleAnchors];

  // --- Version skew analysis ---
  const versionSkew = analyzeVersionSkew(tours, versions);

  const isHealthy =
    uncoveredRequiredManifest.length === 0 &&
    uncoveredRequiredTour.length === 0 &&
    versionSkew.entries.length === 0;

  return {
    generatedAt: new Date().toISOString(),
    status: isHealthy ? 'healthy' : 'degraded',
    source,
    summary: {
      totalFeatures: manifest.length,
      coveredByManifest: coveredFeatureIds.size,
      uncoveredRequiredManifest: uncoveredRequiredManifest.length,
      uncoveredRequiredTour: uncoveredRequiredTour.length,
      staleAnchors: allStaleAnchors.length,
      tours: tours.length,
      versionSkew: versionSkew.entries.length,
    },
    uncoveredRequiredManifest,
    uncoveredRequiredTour,
    staleAnchors: allStaleAnchors,
    versionSkew,
  };
}
