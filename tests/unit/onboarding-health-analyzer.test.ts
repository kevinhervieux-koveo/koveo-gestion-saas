/**
 * @jest-environment node
 *
 * Unit tests for the onboarding health analyzer (Task #1572).
 *
 * These tests guard the analyzer that powers both:
 *  - GET /api/onboarding/health
 *  - scripts/onboarding-health.ts
 *
 * They also include a smoke check that the script module imports cleanly
 * (catches ESM/CJS regressions like the __dirname-not-defined bug).
 */

import { describe, it, expect } from '@jest/globals';
import {
  analyzeOnboardingHealth,
  computeTourContentHash,
  type AnalyzerManifestFeature,
  type AnalyzerTour,
  type AnalyzerVersionRow,
} from '../../server/lib/onboarding-health-analyzer';

const SMOKE_TOUR: AnalyzerTour = {
  tourId: 'onboarding.smoke',
  steps: [
    {
      id: 'dashboard.header',
      anchor: '[data-onboarding="dashboard.header"]',
      covers: ['dashboard.overview'],
    },
    {
      id: 'settings.onboarding',
      anchor: '[data-onboarding="settings.onboarding.link"]',
      covers: ['settings.help'],
    },
  ],
};

const COVERED_MANIFEST: AnalyzerManifestFeature[] = [
  {
    featureId: 'dashboard.overview',
    description: 'Dashboard overview',
    isRequired: true,
    coveredByTour: 'onboarding.smoke',
    anchorSelector: '[data-onboarding="dashboard.header"]',
  },
  {
    featureId: 'settings.help',
    description: 'Settings help',
    isRequired: true,
    coveredByTour: 'onboarding.smoke',
    anchorSelector: '[data-onboarding="settings.onboarding.link"]',
  },
];

describe('analyzeOnboardingHealth', () => {
  it('reports healthy when manifest, tour, and registered version all align', () => {
    const versions: AnalyzerVersionRow[] = [
      {
        tourId: 'onboarding.smoke',
        version: 1,
        contentHash: computeTourContentHash(SMOKE_TOUR),
      },
    ];

    const report = analyzeOnboardingHealth(COVERED_MANIFEST, [SMOKE_TOUR], 'test', versions);

    expect(report.status).toBe('healthy');
    expect(report.summary.uncoveredRequiredManifest).toBe(0);
    expect(report.summary.uncoveredRequiredTour).toBe(0);
    expect(report.summary.staleAnchors).toBe(0);
    expect(report.summary.versionSkew).toBe(0);
    expect(report.versionSkew.entries).toEqual([]);
  });

  it('flags required features the manifest does not cover', () => {
    const manifest: AnalyzerManifestFeature[] = [
      ...COVERED_MANIFEST,
      {
        featureId: 'billing.invoices',
        description: 'Invoices',
        isRequired: true,
        coveredByTour: null,
        anchorSelector: null,
      },
    ];

    const report = analyzeOnboardingHealth(manifest, [SMOKE_TOUR], 'test');

    expect(report.status).toBe('degraded');
    expect(report.summary.uncoveredRequiredManifest).toBe(1);
    expect(report.uncoveredRequiredManifest[0].featureId).toBe('billing.invoices');
  });

  it('flags anchors that do not follow the data-onboarding convention', () => {
    const tour: AnalyzerTour = {
      tourId: 'onboarding.smoke',
      steps: [
        {
          id: 'bad.anchor',
          anchor: '#brittle-css-selector',
          covers: ['dashboard.overview'],
        },
        {
          id: 'good.anchor',
          anchor: '[data-onboarding="settings.onboarding.link"]',
          covers: ['settings.help'],
        },
      ],
    };

    const report = analyzeOnboardingHealth(COVERED_MANIFEST, [tour], 'test');

    expect(report.summary.staleAnchors).toBeGreaterThanOrEqual(1);
    const tourStale = report.staleAnchors.find((a) => a.source === 'tour');
    expect(tourStale?.anchor).toBe('#brittle-css-selector');
    expect(tourStale?.tourId).toBe('onboarding.smoke');
    expect(tourStale?.stepId).toBe('bad.anchor');
  });

  it('reports a tour as unregistered when no version row exists for it', () => {
    const report = analyzeOnboardingHealth(COVERED_MANIFEST, [SMOKE_TOUR], 'test', []);

    expect(report.status).toBe('degraded');
    expect(report.versionSkew.unregisteredTours).toEqual(['onboarding.smoke']);
    expect(report.summary.versionSkew).toBe(1);
  });

  it('reports a version row as orphaned when the source no longer defines it', () => {
    const versions: AnalyzerVersionRow[] = [
      { tourId: 'onboarding.smoke', version: 1, contentHash: computeTourContentHash(SMOKE_TOUR) },
      { tourId: 'onboarding.removed', version: 2, contentHash: 'abc' },
    ];

    const report = analyzeOnboardingHealth(COVERED_MANIFEST, [SMOKE_TOUR], 'test', versions);

    expect(report.versionSkew.orphanedVersions).toEqual(['onboarding.removed']);
    expect(report.status).toBe('degraded');
  });

  it('reports content-hash drift when registered hash differs from current source', () => {
    const versions: AnalyzerVersionRow[] = [
      { tourId: 'onboarding.smoke', version: 1, contentHash: 'stale-hash-from-yesterday' },
    ];

    const report = analyzeOnboardingHealth(COVERED_MANIFEST, [SMOKE_TOUR], 'test', versions);

    expect(report.versionSkew.hashDrift).toHaveLength(1);
    expect(report.versionSkew.hashDrift[0].tourId).toBe('onboarding.smoke');
    expect(report.versionSkew.hashDrift[0].registeredHash).toBe('stale-hash-from-yesterday');
    expect(report.versionSkew.hashDrift[0].currentHash).toBe(computeTourContentHash(SMOKE_TOUR));
    expect(report.status).toBe('degraded');
  });

  it('produces a stable content hash that is independent of step covers ordering', () => {
    const tourA: AnalyzerTour = {
      tourId: 'x',
      steps: [{ id: 's', anchor: '[data-onboarding="x"]', covers: ['a', 'b'] }],
    };
    const tourB: AnalyzerTour = {
      tourId: 'x',
      steps: [{ id: 's', anchor: '[data-onboarding="x"]', covers: ['b', 'a'] }],
    };

    expect(computeTourContentHash(tourA)).toBe(computeTourContentHash(tourB));
  });
});
