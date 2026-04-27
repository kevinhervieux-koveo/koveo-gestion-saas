/**
 * Stale Markdown Doc Path Reference Guard (Task #1246)
 *
 * Walks every Markdown/MDX file under `docs/` plus the repo-root
 * `*.md` / `*.mdx` files (`replit.md`, `README.md`, `CHANGELOG.md`,
 * etc.) and extracts substrings that look like repo-relative source
 * paths under known top-level directories (`client/src/`, `server/`,
 * `shared/`, `tests/`, `scripts/`, `public/`, `drizzle/`,
 * `migrations/`). When any of those paths point to a file that no
 * longer exists on disk, the guard fails.
 *
 * Background: tasks #1229 and #1236 added the same kind of guard for
 * the tests trees and production code respectively. Documentation rots
 * in exactly the same way: README excerpts, ADR notes under `docs/`,
 * the architectural overview in `replit.md`, and on-boarding guides
 * all routinely name source files by repo-relative path. When those
 * files get moved or renamed, the references silently rot until a
 * future curious reader stumbles over them. Extending the guard to
 * Markdown closes the last common gap.
 *
 * The path-extraction logic, prefix list, and false-positive
 * lookbehinds are factored into `scripts/lib/repo-path-refs.ts` so
 * this guard and the two sibling guards
 * (`tests/unit/test-doc-path-references.test.ts`,
 *  `tests/unit/test-prod-doc-path-references.test.ts`) stay in
 * lock-step.
 *
 * Allow-list: a number of legitimate historical/planned references
 * are tolerated. Every entry MUST include a justification so future
 * readers understand why the exemption is real, and three companion
 * tests prune the allow-list automatically when it goes stale (entry
 * resolves on disk again, entry is no longer referenced anywhere, or
 * its justification is empty).
 *
 * NOTE: Many entries below tag references in long-lived narrative
 * documents (architectural overviews, deployment guides, the
 * AI-generated `docs/COMPONENT_DOCUMENTATION.md` catalog, on-boarding
 * tutorials with placeholder file names) where the underlying source
 * files have since been moved, renamed, or removed but the prose
 * documenting them has not been refreshed. They are documented
 * honestly as stale-but-tolerated so the guard can ship green now;
 * follow-up work can prune them by either fixing the underlying
 * documentation or deleting the dead reference, at which point the
 * orphan-pruning test below will require the allow-list entry to be
 * removed.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import {
  findMissingRepoPathRefs,
  SCAN_DOC_FILE_EXTENSIONS,
  type FoundRef,
} from '../../scripts/lib/repo-path-refs';

const repoRoot = path.resolve(__dirname, '../..');

/**
 * Recursively walked roots. `docs/` is the canonical home for
 * long-form documentation; everything inside it is fair game.
 */
const SCAN_ROOTS = [path.join(repoRoot, 'docs')];

/**
 * Repo-root `*.md` / `*.mdx` files are scanned explicitly (without
 * recursing into the rest of the repository, which would
 * double-report Markdown files that live next to source code and
 * pollute findings with vendored READMEs). `replit.md` is the
 * canonical architectural overview and is included by virtue of
 * matching the pattern.
 */
function collectRepoRootMarkdownFiles(): string[] {
  return fs
    .readdirSync(repoRoot, { withFileTypes: true })
    .filter((e) => e.isFile() && SCAN_DOC_FILE_EXTENSIONS.test(e.name))
    .map((e) => path.join(repoRoot, e.name));
}

interface AllowedRef {
  filePath: string;
  justification: string;
}

/**
 * Allow-list of legitimate non-existent path references in Markdown
 * documentation. SEPARATE from the tests-tree and production-code
 * allow-lists so the three guards can evolve independently.
 *
 * Each entry MUST be accompanied by a short justification explaining
 * why the referenced path legitimately does not exist (placeholder
 * tutorial example, AI-generated catalog now stale, historical
 * pointer, defensive existence-check probe, etc.). Pruning tests
 * below ensure entries do not silently rot.
 */
const ALLOWED_MISSING_REFERENCES: AllowedRef[] = [
  // -- docs/COMPONENT_DOCUMENTATION.md catalog (AI-generated, drifted) --
  {
    filePath: 'client/src/components/ErrorBoundary.tsx',
    justification:
      'Stale entry in docs/COMPONENT_DOCUMENTATION.md (auto-generated component catalog from an earlier layout). The actual error boundary lives elsewhere in the current tree; the catalog has not been regenerated. Tolerated so the guard can ship; follow-up work should regenerate the catalog or delete the stale section.',
  },
  {
    filePath: 'client/src/components/LanguageProvider.tsx',
    justification:
      'Stale entry in docs/COMPONENT_DOCUMENTATION.md: the language provider was moved out of components/ during the i18n refactor but the catalog still names the old path.',
  },
  {
    filePath: 'client/src/components/ProtectedRoute.tsx',
    justification:
      'Stale entry in docs/COMPONENT_DOCUMENTATION.md: ProtectedRoute now lives at client/src/components/common/ProtectedRoute.tsx (see replit.md "Access Control" note). The catalog still names the pre-move path.',
  },
  {
    filePath: 'client/src/components/admin/user-list.tsx',
    justification:
      'Stale entry in docs/COMPONENT_DOCUMENTATION.md: the admin user list component was renamed/restructured but the catalog still names the old path.',
  },
  {
    filePath: 'client/src/components/layout/AppLayout.tsx',
    justification:
      'Stale entry in docs/COMPONENT_DOCUMENTATION.md: the layout components were reorganised after the catalog was generated.',
  },
  {
    filePath: 'client/src/components/layout/Header.tsx',
    justification:
      'Stale entry in docs/COMPONENT_DOCUMENTATION.md: the header component was reorganised after the catalog was generated.',
  },
  {
    filePath: 'client/src/components/ssl/SslCertificateInfo.tsx',
    justification:
      'Stale entry in docs/COMPONENT_DOCUMENTATION.md: the SSL admin surface was removed/restructured but the catalog still references the deleted file.',
  },
  {
    filePath: 'client/src/pages/admin/dashboard.tsx',
    justification:
      'Stale entry in docs/COMPONENT_DOCUMENTATION.md: the admin dashboard page was restructured (current admin pages live alongside compliance/permissions/quality/etc.) but the catalog still names the old aggregate file.',
  },
  {
    filePath: 'client/src/pages/admin/roadmap.tsx',
    justification:
      'Stale entry in docs/COMPONENT_DOCUMENTATION.md: the admin roadmap page was removed/relocated but the catalog still references the deleted file.',
  },
  {
    filePath: 'client/src/pages/buildings/dashboard.tsx',
    justification:
      'Stale entry in docs/COMPONENT_DOCUMENTATION.md: the buildings dashboard page was renamed/restructured but the catalog still names the old path.',
  },
  {
    filePath: 'client/src/pages/residences/dashboard.tsx',
    justification:
      'Stale entry in docs/COMPONENT_DOCUMENTATION.md: the residences dashboard page was renamed/restructured but the catalog still names the old path.',
  },

  // -- on-boarding tutorial placeholders --
  {
    filePath: 'client/src/components/NewFeature.tsx',
    justification:
      'Tutorial placeholder in docs/references/DEVELOPMENT_WORKFLOW.md: walks readers through "create your first new feature" with a hypothetical NewFeature.tsx. Intentionally non-existent — it is the file the tutorial is teaching the reader to create.',
  },
  {
    filePath: 'client/src/pages/NewFeaturePage.tsx',
    justification:
      'Tutorial placeholder in docs/guides/GETTING_STARTED.md: walks readers through "scaffold a new page" with a hypothetical NewFeaturePage.tsx. Intentionally non-existent — it is the file the tutorial is teaching the reader to create.',
  },
  {
    filePath: 'server/api/new-features.ts',
    justification:
      'Tutorial placeholder in docs/guides/GETTING_STARTED.md and docs/references/DEVELOPMENT_WORKFLOW.md: companion to the NewFeature tutorial above, names the API route the reader is being taught to add. Intentionally non-existent.',
  },

  // -- docs/BUDGET_TESTING_PIPELINE.md --
  {
    filePath: 'client/src/pages/manager/budget.tsx',
    justification:
      'Stale entry in docs/BUDGET_TESTING_PIPELINE.md: the manager budget page was renamed/restructured but the testing-pipeline doc still names the old path.',
  },
  {
    filePath: 'tests/unit/api/budgets.test.ts',
    justification:
      'Historical pointer in docs/BUDGET_TESTING_PIPELINE.md: names the legacy `describeIfDb = describe.skip` suite that was migrated into tests/integration/budgets-investments-upsert.test.ts. The same pointer is allow-listed in tests/unit/test-doc-path-references.test.ts so the migration trail stays discoverable from both the test header and the pipeline doc.',
  },

  // -- docs/ai-agent-improvements-summary.md (decommissioned scripts) --
  {
    filePath: 'scripts/ai-agent-demo.ts',
    justification:
      'Stale reference in docs/ai-agent-improvements-summary.md: the named demo script was removed during the AI-agent-tooling cleanup but the summary document was never refreshed. Tolerated so the guard can ship; follow-up work should refresh the summary.',
  },
  {
    filePath: 'scripts/enhanced-ai-agent-cli.ts',
    justification:
      'Stale reference in docs/ai-agent-improvements-summary.md: the named CLI script was removed during the AI-agent-tooling cleanup but the summary document was never refreshed.',
  },

  // -- docs/demo-organizations-deployment-guide.md (decommissioned scripts/files) --
  {
    filePath: 'scripts/create-comprehensive-demo.ts',
    justification:
      'Stale reference in docs/demo-organizations-deployment-guide.md: the named seed script was removed/renamed during the demo-data refactor but the deployment guide still names the old path.',
  },
  {
    filePath: 'scripts/duplicate-demo-to-open-demo.ts',
    justification:
      'Stale reference in docs/demo-organizations-deployment-guide.md: the named duplication script was removed/renamed during the demo-data refactor but the deployment guide still names the old path.',
  },
  {
    filePath: 'scripts/production-demo-sync.ts',
    justification:
      'Stale reference in docs/demo-organizations-deployment-guide.md: the named sync script was removed/renamed during the demo-data refactor but the deployment guide still names the old path.',
  },
  {
    filePath: 'server/routes-minimal.ts',
    justification:
      'Stale reference in docs/demo-organizations-deployment-guide.md: the minimal-routes entry-point was consolidated into server/routes.ts but the deployment guide still names the old file.',
  },
  {
    filePath: 'server/services/comprehensive-demo-sync-service.ts',
    justification:
      'Stale reference in docs/demo-organizations-deployment-guide.md: the named service was removed/renamed during the demo-data refactor but the deployment guide still names the old path.',
  },

  // -- other one-off stale references --
  {
    filePath: 'scripts/run-quality-metric-tests.ts',
    justification:
      'Stale reference in docs/QUALITY_SYSTEM_OVERVIEW.md: the metric-tests runner script was removed/renamed but the overview document still names the old path.',
  },
  {
    filePath: 'scripts/validate-demo-security.ts',
    justification:
      'Stale reference in docs/DEMO_USER_TESTING_GUIDE.md: the named validator script was removed/renamed but the testing guide still names the old path.',
  },
  {
    filePath: 'scripts/validate-routes.ts',
    justification:
      'Stale reference in docs/ROUTING_CHECKLIST.md: the named route-validator script was removed/renamed but the checklist still names the old path.',
  },
  {
    filePath: 'server/db-storage.ts',
    justification:
      'Stale reference in docs/deployment/deployment-guide.md: the storage module was renamed/restructured but the deployment guide still names the old path.',
  },
  {
    filePath: 'server/middleware/auth.ts',
    justification:
      'Stale reference in docs/CODE_EXAMPLES_GUIDE.md: the example snippet imports from a conventional middleware/auth.ts location that this repo does not currently expose. Same path is allow-listed in tests/unit/test-prod-doc-path-references.test.ts as a defensive existence probe; documented here too because the example guide names it explicitly in narrative text.',
  },
  {
    filePath: 'server/tests/user-serializer-http.test.ts',
    justification:
      'Stale reference in docs/security/user-password-leak-audit.md: the named regression test was relocated/renamed during the password-leak audit follow-up but the audit document still names the old path.',
  },

  // -- docs/RBAC_SYSTEM.md (RBAC test suite reorganisation) --
  {
    filePath: 'tests/integration/api/rbac-endpoints.test.ts',
    justification:
      'Stale reference in docs/RBAC_SYSTEM.md: the RBAC integration tests were reorganised but the system doc still names the old test suite path.',
  },
  {
    filePath: 'tests/integration/invitation/rbac-system.test.ts',
    justification:
      'Stale reference in docs/RBAC_SYSTEM.md: the invitation RBAC tests were reorganised/renamed but the system doc still names the old test suite path.',
  },
  {
    filePath: 'tests/unit/auth/rbac.test.ts',
    justification:
      'Stale reference in docs/RBAC_SYSTEM.md: the unit-tier RBAC tests were reorganised/renamed but the system doc still names the old test suite path.',
  },

  // -- docs/DEMO_USER_SECURITY.md / docs/DEMO_USER_TESTING_GUIDE.md --
  {
    filePath: 'tests/integration/demo-user-ui-restrictions.test.tsx',
    justification:
      'Stale reference in docs/DEMO_USER_SECURITY.md: the named UI-restrictions integration test was renamed/relocated during the demo-user testing reorganisation but the security doc still names the old path.',
  },
  {
    filePath: 'tests/security/automated-demo-restrictions.test.ts',
    justification:
      'Stale reference in docs/DEMO_USER_TESTING_GUIDE.md: the named automated restrictions test was renamed/relocated but the testing guide still names the old path.',
  },
  {
    filePath: 'tests/security/comprehensive-demo-user-security.test.ts',
    justification:
      'Stale reference in docs/DEMO_USER_SECURITY.md: the named suite was removed (also tracked in tests/unit/test-prod-doc-path-references.test.ts as a stale Jest invocation in scripts/test-auth-security.ts) but the security doc still names it as the canonical comprehensive suite.',
  },
  {
    filePath: 'tests/security/demo-security-test-runner.ts',
    justification:
      'Stale reference in docs/DEMO_USER_SECURITY.md: the named runner script was removed/renamed during the demo-user testing reorganisation but the security doc still names the old path.',
  },
  {
    filePath: 'tests/security/demo-user-comprehensive-validation.test.ts',
    justification:
      'Stale reference in docs/DEMO_USER_TESTING_GUIDE.md: the named comprehensive validation suite was removed/renamed during the demo-user testing reorganisation but the testing guide still names the old path.',
  },
  {
    filePath: 'tests/security/demo-users-validation.test.ts',
    justification:
      'Stale reference in docs/DEMO_USER_SECURITY.md: the named validation suite was removed/renamed during the demo-user testing reorganisation but the security doc still names the old path.',
  },
];

const ALLOWED_PATHS = new Set(
  ALLOWED_MISSING_REFERENCES.map((entry) => entry.filePath),
);

function extractMissingRefs(): FoundRef[] {
  return findMissingRepoPathRefs({
    repoRoot,
    scanRoots: SCAN_ROOTS,
    extraScanFiles: collectRepoRootMarkdownFiles(),
    walkOptions: { scanFilePattern: SCAN_DOC_FILE_EXTENSIONS },
  });
}

describe('Markdown Doc Path Reference Guard', () => {
  it('every repo-relative source path mentioned in Markdown docs resolves on disk (or is on the allow-list)', () => {
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
        `${unaccounted.length} stale repo-path reference(s) found in Markdown docs that point to files no longer on disk:\n` +
          lines.join('\n') +
          '\n\nFix the reference (the file was probably moved or renamed), or — if the path is intentionally non-existent (tutorial placeholder, historical pointer, removed-but-documented) — ' +
          'add it to ALLOWED_MISSING_REFERENCES in tests/unit/test-markdown-doc-path-references.test.ts with a short justification.',
      );
    }
  });

  it('every allow-list entry is still actually missing on disk (prune dead exemptions)', () => {
    const stale = ALLOWED_MISSING_REFERENCES.filter((entry) =>
      fs.existsSync(path.join(repoRoot, entry.filePath)),
    ).map((entry) => entry.filePath);

    if (stale.length > 0) {
      throw new Error(
        `${stale.length} allow-list entry/entries in ALLOWED_MISSING_REFERENCES (Markdown guard) now exist on disk and should be removed:\n` +
          stale.map((p) => `  ${p}`).join('\n'),
      );
    }
  });

  it('every allow-list entry is actually referenced by at least one Markdown file (prune orphans)', () => {
    const referenced = new Set(extractMissingRefs().map((m) => m.refPath));
    const orphaned = ALLOWED_MISSING_REFERENCES.filter(
      (entry) => !referenced.has(entry.filePath),
    ).map((entry) => entry.filePath);

    if (orphaned.length > 0) {
      throw new Error(
        `${orphaned.length} allow-list entry/entries in ALLOWED_MISSING_REFERENCES (Markdown guard) are not referenced by any Markdown file:\n` +
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
