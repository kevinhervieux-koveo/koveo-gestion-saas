#!/usr/bin/env tsx
/**
 * Onboarding freshness monitor (Task #1572).
 *
 * Produces the same canonical health report as GET /api/onboarding/health by
 * calling the shared analyzer in server/lib/onboarding-health-analyzer.ts.
 *
 * Sources:
 *  - Tour content: derived from `client/src/content/onboarding/*` (single source
 *    of truth) via `server/api/auto/onboarding-content.ts`.
 *  - Manifest:
 *      1. `onboarding_feature_manifest` table when DATABASE_URL is set.
 *      2. Otherwise fall back to parsing `feature_list.md`.
 *      3. Otherwise an empty manifest (script still reports tour-side issues).
 *
 * Exit codes: 0 healthy, 1 degraded, 2 fatal error.
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { InferSelectModel } from 'drizzle-orm';
import { onboardingFeatureManifest, onboardingVersions } from '../shared/schemas/onboarding';
import { SMOKE_TOUR_DEF } from '../server/api/auto/onboarding-content';
import {
  analyzeOnboardingHealth,
  type AnalyzerManifestFeature,
  type AnalyzerVersionRow,
  type OnboardingHealthReport,
} from '../server/lib/onboarding-health-analyzer';

type ManifestRow = InferSelectModel<typeof onboardingFeatureManifest>;
type VersionRow = InferSelectModel<typeof onboardingVersions>;

// ESM-safe root resolution. tsx executes this file as ESM so import.meta.url
// is always defined; we resolve the project root from the script's own URL.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_ONLY = process.argv.includes('--json');

// ---------------------------------------------------------------------------
// Manifest source resolution
// ---------------------------------------------------------------------------

function rowToAnalyzer(row: ManifestRow): AnalyzerManifestFeature {
  return {
    featureId: row.featureId,
    description: row.featureName,
    isRequired: row.isRequired,
    coveredByTour: row.coveredByTour,
    anchorSelector: row.anchorSelector,
  };
}

async function queryManifestFromDb(): Promise<AnalyzerManifestFeature[] | null> {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_KOVEO) {
    return null;
  }
  try {
    const { db } = await import('../server/db');
    const rows: ManifestRow[] = await db.select().from(onboardingFeatureManifest);
    return rows.map(rowToAnalyzer);
  } catch {
    return null;
  }
}

async function queryVersionsFromDb(): Promise<AnalyzerVersionRow[]> {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_KOVEO) {
    return [];
  }
  try {
    const { db } = await import('../server/db');
    const rows: VersionRow[] = await db.select().from(onboardingVersions);
    return rows.map((row) => ({
      tourId: row.tourId,
      version: row.version,
      contentHash: row.contentHash,
    }));
  } catch {
    return [];
  }
}

function parseFeatureListMd(): AnalyzerManifestFeature[] {
  const featureListPath = join(ROOT, 'feature_list.md');
  if (!existsSync(featureListPath)) return [];

  const content = readFileSync(featureListPath, 'utf-8');
  const entries: AnalyzerManifestFeature[] = [];
  let currentSection = '';

  for (const line of content.split('\n')) {
    if (line.startsWith('## ') || line.startsWith('### ')) {
      currentSection = line.replace(/^#+\s+/, '').trim();
    }
    const checkboxMatch = line.match(/^- \[(✅|x|X| )\] (.+)/);
    if (checkboxMatch) {
      const completed = checkboxMatch[1] === '✅' || checkboxMatch[1].toLowerCase() === 'x';
      entries.push({
        featureId: `${currentSection}/${checkboxMatch[2].trim()}`.toLowerCase().replace(/\s+/g, '-'),
        description: checkboxMatch[2].trim(),
        isRequired: completed,
        coveredByTour: null,
        anchorSelector: null,
      });
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

function generateMarkdown(report: OnboardingHealthReport): string {
  const lines: string[] = [
    '# Onboarding Health Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Source: ${report.source}`,
    `Status: **${report.status === 'healthy' ? 'healthy' : 'degraded'}**`,
    '',
    '## Summary',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Total features tracked | ${report.summary.totalFeatures} |`,
    `| Covered (manifest coveredByTour) | ${report.summary.coveredByManifest} |`,
    `| Uncovered required (manifest) | ${report.summary.uncoveredRequiredManifest} |`,
    `| Uncovered required (tour steps) | ${report.summary.uncoveredRequiredTour} |`,
    `| Stale anchors | ${report.summary.staleAnchors} |`,
    `| Tours in source | ${report.summary.tours} |`,
    `| Version skew entries | ${report.summary.versionSkew} |`,
    '',
  ];

  if (report.uncoveredRequiredTour.length > 0) {
    lines.push('## Uncovered Required Features (tour steps)', '');
    for (const f of report.uncoveredRequiredTour) {
      lines.push(`- \`${f.featureId}\`${f.description ? ` - ${f.description}` : ''}`);
    }
    lines.push('');
  } else {
    lines.push('## All Required Features Covered by Tour Steps', '');
  }

  if (report.staleAnchors.length > 0) {
    lines.push('## Stale Anchors', '');
    for (const a of report.staleAnchors) {
      const loc = a.tourId
        ? `Tour \`${a.tourId}\`, step \`${a.stepId}\``
        : `manifest feature \`${a.featureId}\``;
      lines.push(`- ${loc}: \`${a.anchor}\``);
    }
    lines.push('');
  }

  lines.push('## Version Skew', '');
  lines.push(`Registered tours in onboarding_versions: ${report.versionSkew.registered}`);
  lines.push('');
  if (report.versionSkew.entries.length === 0) {
    lines.push('All source tours are registered and content hashes match.', '');
  } else {
    if (report.versionSkew.unregisteredTours.length > 0) {
      lines.push('### Unregistered (in source, not in onboarding_versions)', '');
      for (const id of report.versionSkew.unregisteredTours) lines.push(`- \`${id}\``);
      lines.push('');
    }
    if (report.versionSkew.orphanedVersions.length > 0) {
      lines.push('### Orphaned (in onboarding_versions, removed from source)', '');
      for (const id of report.versionSkew.orphanedVersions) lines.push(`- \`${id}\``);
      lines.push('');
    }
    if (report.versionSkew.hashDrift.length > 0) {
      lines.push('### Content hash drift (registered hash differs from current)', '');
      for (const e of report.versionSkew.hashDrift) {
        lines.push(
          `- \`${e.tourId}\` v${e.registeredVersion}: registered=\`${e.registeredHash}\` current=\`${e.currentHash}\``,
        );
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  let manifest = await queryManifestFromDb();
  let source: string;

  if (manifest !== null) {
    source = 'database (onboarding_feature_manifest)';
  } else {
    manifest = parseFeatureListMd();
    source = manifest.length > 0 ? 'feature_list.md (fallback)' : 'none (no DB or feature_list.md)';
  }

  const versions = await queryVersionsFromDb();
  const report = analyzeOnboardingHealth(manifest, SMOKE_TOUR_DEF, source, versions);

  if (JSON_ONLY) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(generateMarkdown(report));
    console.log('\n---\n');
    console.log(JSON.stringify(report, null, 2));
  }

  // Exit policy (per task spec): non-zero ONLY when required features are
  // uncovered. Version skew is reported but does not fail the check unless
  // it caused the coverage gap. This keeps the health script useful in
  // environments where the version registry is intentionally empty (e.g.,
  // before any onboarding tour-version registration step has run).
  const uncoveredCount =
    report.summary.uncoveredRequiredManifest + report.summary.uncoveredRequiredTour;

  if (report.summary.versionSkew > 0) {
    console.warn(
      `\nWARNING: ${report.summary.versionSkew} version skew entry/entries detected (see report). Not a failure.`,
    );
  }

  if (uncoveredCount > 0) {
    console.error(
      `\nOnboarding health check FAILED - ${uncoveredCount} uncovered required feature(s).`,
    );
    process.exit(1);
  }

  console.log('\nOnboarding health check PASSED - all required features covered.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error in onboarding health check:', err);
  process.exit(2);
});
