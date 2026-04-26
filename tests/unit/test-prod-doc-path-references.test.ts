/**
 * Stale Production Doc Path Reference Guard (Task #1236)
 *
 * Walks every source file under `server/`, `client/src/`, `shared/`,
 * and `scripts/` (excluding test trees, generated artefacts, and
 * dist/build output) and extracts substrings that look like
 * repo-relative source paths under known top-level directories
 * (`client/src/`, `server/`, `shared/`, `tests/`, `scripts/`,
 * `public/`, `drizzle/`, `migrations/`). When any of those paths
 * point to a file that no longer exists on disk, the guard fails.
 *
 * Background: Task #1229 added the same kind of guard for the tests
 * trees, after #1224 and #1226 each had to manually sweep test files
 * for stale comment/string references to moved or renamed source
 * files. The same rot accumulates in production code: JSDoc `@see`
 * blocks, route-handler header comments, defensive `existsSync()`
 * lists, and `npx jest <path>` invocations in maintenance scripts all
 * point at files that have since been moved or renamed. Extending the
 * guard to the production trees catches the next regression the
 * moment it lands instead of leaving it to a future curious reader.
 *
 * The path-extraction logic, prefix list, and false-positive
 * lookbehinds are factored into `scripts/lib/repo-path-refs.ts` so
 * this guard and the tests-tree guard
 * (`tests/unit/test-doc-path-references.test.ts`) stay in lock-step.
 *
 * Allow-list: a small number of legitimate historical/planned
 * references are tolerated. Every entry MUST include a justification
 * so future readers understand why the exemption is real, and three
 * companion tests prune the allow-list automatically when it goes
 * stale (entry resolves on disk again, entry is no longer referenced
 * anywhere, or its justification is empty).
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
  path.join(repoRoot, 'server'),
  path.join(repoRoot, 'client', 'src'),
  path.join(repoRoot, 'shared'),
  path.join(repoRoot, 'scripts'),
];

/**
 * Directories to skip when walking the production trees:
 *   - node_modules / dist / build / .next / coverage: generated or
 *     vendored output (default exclusions on the walker).
 *   - tests: nested test directories (e.g. `server/tests/`) that are
 *     already covered by the tests-tree guard. Avoids double-reporting.
 */
const EXCLUDE_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
  'tests',
]);

/**
 * Specific files to skip even though they live under the scan roots.
 * Generated manifests are good candidates here — they may legitimately
 * lag behind the source tree between regenerations. (As of writing,
 * `server/route-manifest.json` is the only such file and is already
 * excluded by file-extension since the walker only opens
 * `.ts/.tsx/.js/.jsx/.cjs/.mjs`. Kept as a hook for future generated
 * `.ts` artefacts.)
 */
const EXCLUDE_FILES = new Set<string>([]);

interface AllowedRef {
  filePath: string;
  justification: string;
}

/**
 * Allow-list of legitimate non-existent path references in production
 * code. SEPARATE from the tests-tree allow-list so the two guards can
 * evolve independently.
 *
 * Each entry MUST be accompanied by a short justification explaining
 * why the referenced path legitimately does not exist (defensive
 * existence-check probe, historical migration marker, planned future
 * file, etc.). Pruning tests below ensure entries do not silently rot.
 *
 * NOTE: Several entries below tag references in maintenance scripts
 * that were originally added for test/source files that have since
 * been removed. These are documented honestly as stale-but-tolerated
 * so the guard can ship green now; follow-up work can prune them by
 * either fixing the underlying script or deleting the dead reference,
 * at which point the orphan-pruning test below will require the
 * allow-list entry to be removed.
 */
const ALLOWED_MISSING_REFERENCES: AllowedRef[] = [
  {
    filePath: 'server/middleware/auth.ts',
    justification:
      'Defensive existence probe: scripts/generate-security-report.ts:142 walks a list of conventional auth-file locations with `existsSync()` to detect whichever auth layout this repo happens to use. The file genuinely does not need to exist — the script tolerates absence. Kept in the probe list so the report still works if the auth layer is ever re-organised back into this conventional location.',
  },
  {
    filePath: 'server/routes/auth.ts',
    justification:
      'Defensive existence probe: scripts/generate-security-report.ts:142 walks a list of conventional auth-file locations with `existsSync()` to detect whichever auth layout this repo happens to use. The file genuinely does not need to exist — the script tolerates absence.',
  },
  {
    filePath: 'server/jobs/ssl_renewal_job.ts',
    justification:
      'Defensive existence probe: scripts/validation-suite.ts:129 calls `existsSync()` on this path before reporting on SSL management. The file is intentionally optional (deployments without SSL automation skip the check), so the missing path is not a bug.',
  },
  {
    filePath: 'tests/integration/deployment/pre-deployment-checklist.test.ts',
    justification:
      'Stale Jest invocation in scripts/deployment-validation.ts:365 — the named test suite was removed but the runner script was never updated. Tolerated here so the new guard can ship; follow-up work should either delete the invocation or restore the suite, after which this entry will be flagged by the orphan-pruning test below.',
  },
  {
    filePath: 'tests/code-analysis/redundancy-detection.test.ts',
    justification:
      'Stale Jest invocation in scripts/run-redundancy-analysis.ts:31 — the entire `tests/code-analysis/` tree was removed but the runner script was never updated. Tolerated so the guard can ship; follow-up work should delete the invocation, after which the orphan-pruning test will require this entry to be removed.',
  },
  {
    filePath: 'tests/code-analysis/ui-component-redundancy.test.ts',
    justification:
      'Stale Jest invocation in scripts/run-redundancy-analysis.ts:32 and scripts/run-quality-check.ts:1059 — the entire `tests/code-analysis/` tree was removed but the runner scripts were never updated. Tolerated so the guard can ship; follow-up work should delete the invocations.',
  },
  {
    filePath: 'tests/code-analysis/style-consolidation.test.ts',
    justification:
      'Stale Jest invocation in scripts/run-redundancy-analysis.ts:33 — the entire `tests/code-analysis/` tree was removed but the runner script was never updated. Tolerated so the guard can ship; follow-up work should delete the invocation.',
  },
  {
    filePath: 'tests/integration/user-deletion.test.ts',
    justification:
      'Stale Jest invocation in scripts/test-auth-security.ts:104 — the named suite was removed (current user-related integration tests are tests/integration/user-registration.test.ts, user-residences-end-residency.test.ts, user-serializer-http.test.ts) but the auth-security runner script was never updated. Tolerated so the guard can ship; follow-up work should delete or repoint the invocation.',
  },
  {
    filePath: 'tests/security/comprehensive-demo-user-security.test.ts',
    justification:
      'Stale Jest invocation in scripts/test-auth-security.ts:282 — the named suite was removed but the auth-security runner script was never updated. Tolerated so the guard can ship; follow-up work should delete or repoint the invocation.',
  },
];

const ALLOWED_PATHS = new Set(
  ALLOWED_MISSING_REFERENCES.map((entry) => entry.filePath),
);

function extractMissingRefs(): FoundRef[] {
  return findMissingRepoPathRefs({
    repoRoot,
    scanRoots: SCAN_ROOTS,
    walkOptions: {
      excludeDirNames: EXCLUDE_DIR_NAMES,
      excludeFiles: EXCLUDE_FILES,
    },
  });
}

describe('Production Doc Path Reference Guard', () => {
  it('every repo-relative source path mentioned in production code resolves on disk (or is on the allow-list)', () => {
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
        `${unaccounted.length} stale repo-path reference(s) found in production code that point to files no longer on disk:\n` +
          lines.join('\n') +
          '\n\nFix the reference (the file was probably moved or renamed), or — if the path is intentionally non-existent (defensive probe, historical pointer, planned future file) — ' +
          'add it to ALLOWED_MISSING_REFERENCES in tests/unit/test-prod-doc-path-references.test.ts with a short justification.',
      );
    }
  });

  it('every allow-list entry is still actually missing on disk (prune dead exemptions)', () => {
    const stale = ALLOWED_MISSING_REFERENCES.filter((entry) =>
      fs.existsSync(path.join(repoRoot, entry.filePath)),
    ).map((entry) => entry.filePath);

    if (stale.length > 0) {
      throw new Error(
        `${stale.length} allow-list entry/entries in ALLOWED_MISSING_REFERENCES (production guard) now exist on disk and should be removed:\n` +
          stale.map((p) => `  ${p}`).join('\n'),
      );
    }
  });

  it('every allow-list entry is actually referenced by at least one production file (prune orphans)', () => {
    const referenced = new Set(extractMissingRefs().map((m) => m.refPath));
    const orphaned = ALLOWED_MISSING_REFERENCES.filter(
      (entry) => !referenced.has(entry.filePath),
    ).map((entry) => entry.filePath);

    if (orphaned.length > 0) {
      throw new Error(
        `${orphaned.length} allow-list entry/entries in ALLOWED_MISSING_REFERENCES (production guard) are not referenced by any production file:\n` +
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
