/**
 * Stale Test Doc Path Reference Guard (Task #1229)
 *
 * Walks every test file under `tests/` and `server/tests/` and extracts
 * substrings that look like repo-relative source paths under known
 * top-level directories (`client/src/`, `server/`, `shared/`, `tests/`,
 * `scripts/`, `public/`, `drizzle/`, `migrations/`). When any of those
 * paths point to a file that no longer exists on disk, the guard fails.
 *
 * Background: tasks #1224 and #1226 each had to manually sweep test
 * files for comment blocks and string literals naming source paths
 * that no longer existed — typically `client/src/pages/...` page files
 * that had been moved/renamed, plus a `tests/unit/...` companion-suite
 * pointer that had been deleted. These references slipped in over time
 * as pages were moved or renamed and were only found by ad-hoc manual
 * scans. This guard catches the next regression the moment it lands.
 *
 * The path-extraction logic, prefix list, and false-positive
 * lookbehinds are factored into `scripts/lib/repo-path-refs.ts` so the
 * companion production-code guard
 * (`tests/unit/test-prod-doc-path-references.test.ts`, Task #1236)
 * stays in lock-step.
 *
 * Allow-list: a small number of legitimate historical/planned
 * references are tolerated (paths that intentionally describe code
 * that has been removed or that has not yet been written). Every entry
 * MUST include a justification so future readers understand why the
 * exemption is real, and three companion tests prune the allow-list
 * automatically when it goes stale (entry resolves on disk again,
 * entry is no longer referenced anywhere, or its justification is
 * empty).
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import {
  findMissingRepoPathRefs,
  type FoundRef,
} from '../../scripts/lib/repo-path-refs';

const repoRoot = path.resolve(__dirname, '../..');
const SCAN_ROOTS = [
  path.join(repoRoot, 'tests'),
  path.join(repoRoot, 'server', 'tests'),
];

/**
 * Files to skip when walking the tests trees. The companion guards'
 * allow-lists contain paths that intentionally do not exist on disk
 * (and that are accounted for over there); those files live under
 * `tests/` only because Jest discovers them there, so they would
 * otherwise pollute this guard's findings with cross-guard noise.
 */
const EXCLUDE_FILES = new Set<string>([
  'tests/unit/test-prod-doc-path-references.test.ts',
  'tests/unit/test-markdown-doc-path-references.test.ts',
]);

interface AllowedRef {
  filePath: string;
  justification: string;
}

/**
 * Allow-list of legitimate non-existent path references.
 *
 * Each entry MUST be accompanied by a short justification explaining
 * why the referenced path legitimately does not exist (historical
 * migration marker, planned future test suite, etc.). Pruning tests
 * below ensure entries do not silently rot.
 */
const ALLOWED_MISSING_REFERENCES: AllowedRef[] = [
  {
    filePath: 'tests/security/database-permissions.test.ts',
    justification:
      'Historical pointer (Task #169 / #176): names the original skipped unit-tier suite this integration test replaced. Documented in the header of tests/integration/cross-organization-isolation.test.ts to preserve provenance for anyone tracing the migration.',
  },
  {
    filePath: 'tests/unit/api/budgets.test.ts',
    justification:
      'Historical pointer: names the legacy `describeIfDb = describe.skip` suite that was migrated into tests/integration/budgets-investments-upsert.test.ts. Documented in that file header so readers can find the migration trail.',
  },
  {
    filePath: 'tests/integration/mcp/budget-tools.test.ts',
    justification:
      'Forward reference (Task #527): names the planned real-Postgres companion suite for the budget MCP tools. The mocked tests in tests/unit/api/mcp-budget-tools.test.ts intentionally point at the future home so the pairing is discoverable.',
  },
];

const ALLOWED_PATHS = new Set(
  ALLOWED_MISSING_REFERENCES.map((entry) => entry.filePath),
);

function extractMissingRefs(): FoundRef[] {
  return findMissingRepoPathRefs({
    repoRoot,
    scanRoots: SCAN_ROOTS,
    walkOptions: { excludeFiles: EXCLUDE_FILES },
  });
}

describe('Test Doc Path Reference Guard', () => {
  it('every repo-relative source path mentioned in tests resolves on disk (or is on the allow-list)', () => {
    const missing = extractMissingRefs();
    const unaccounted = missing.filter((m) => !ALLOWED_PATHS.has(m.refPath));

    if (unaccounted.length > 0) {
      const grouped = new Map<string, FoundRef[]>();
      for (const m of unaccounted) {
        if (!grouped.has(m.refPath)) grouped.set(m.refPath, []);
        grouped.get(m.refPath)!.push(m);
      }
      const lines: string[] = [];
      for (const [ref, refs] of grouped) {
        lines.push(`  ${ref}`);
        for (const r of refs) {
          lines.push(`    referenced from ${r.sourceFile}:${r.line}`);
        }
      }
      throw new Error(
        `${unaccounted.length} stale repo-path reference(s) found in tests/ that point to files no longer on disk:\n` +
          lines.join('\n') +
          '\n\nFix the reference (the file was probably moved or renamed), or — if the path is intentionally non-existent (historical/planned) — ' +
          'add it to ALLOWED_MISSING_REFERENCES in tests/unit/test-doc-path-references.test.ts with a short justification.',
      );
    }
  });

  it('every allow-list entry is still actually missing on disk (prune dead exemptions)', () => {
    const stale = ALLOWED_MISSING_REFERENCES.filter((entry) =>
      fs.existsSync(path.join(repoRoot, entry.filePath)),
    ).map((entry) => entry.filePath);

    if (stale.length > 0) {
      throw new Error(
        `${stale.length} allow-list entry/entries in ALLOWED_MISSING_REFERENCES now exist on disk and should be removed:\n` +
          stale.map((p) => `  ${p}`).join('\n'),
      );
    }
  });

  it('every allow-list entry is actually referenced by at least one test file (prune orphans)', () => {
    const referenced = new Set(extractMissingRefs().map((m) => m.refPath));
    const orphaned = ALLOWED_MISSING_REFERENCES.filter(
      (entry) => !referenced.has(entry.filePath),
    ).map((entry) => entry.filePath);

    if (orphaned.length > 0) {
      throw new Error(
        `${orphaned.length} allow-list entry/entries in ALLOWED_MISSING_REFERENCES are not referenced by any test file:\n` +
          orphaned.map((p) => `  ${p}`).join('\n') +
          '\n\nRemove them from the allow-list.',
      );
    }
  });

  it('every allow-list entry has a non-empty justification', () => {
    const empty = ALLOWED_MISSING_REFERENCES.filter(
      (e) => !e.justification.trim(),
    ).map((e) => e.filePath);
    expect(empty).toEqual([]);
  });
});
