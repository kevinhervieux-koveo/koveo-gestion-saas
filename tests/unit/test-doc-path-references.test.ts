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
 * False-positive avoidance:
 *   - Lookbehind rejects `@`, `/`, `.`, `\w`, `-` immediately preceding
 *     the prefix, so node-module specifiers such as
 *     `@modelcontextprotocol/sdk/server/mcp.js` are NOT extracted as
 *     repo paths (the leading `@` disqualifies them).
 *   - The pattern requires the path to begin at one of the known
 *     top-level repo directories, so regex-alternation literals such as
 *     `route-manifest\.(json|js)` cannot synthesize a fake
 *     `route-manifest.js` reference (no prefix → no match), and the
 *     legitimate `server/route-manifest.json` literal resolves on disk
 *     just like any other real path.
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

const repoRoot = path.resolve(__dirname, '../..');
const SCAN_ROOTS = [
  path.join(repoRoot, 'tests'),
  path.join(repoRoot, 'server', 'tests'),
];

const SOURCE_FILE_EXTENSIONS = [
  'ts',
  'tsx',
  'js',
  'jsx',
  'cjs',
  'mjs',
  'json',
  'css',
  'html',
  'md',
];

const SCAN_FILE_EXTENSIONS = /\.(ts|tsx|js|jsx|cjs|mjs)$/;

const PREFIX_GROUP =
  '(?:client/src|server|shared|tests|scripts|public|drizzle|migrations)';
const EXT_GROUP = `(?:${SOURCE_FILE_EXTENSIONS.join('|')})`;

/**
 * Match path-like substrings that:
 *   - are NOT preceded by `@`, `/`, `.`, `-`, or any word character
 *     (filters out `@modelcontextprotocol/sdk/server/mcp.js`,
 *      `node_modules/server/...`, partial-identifier suffixes, etc.)
 *   - start with one of the known top-level repo directories
 *   - end with a recognised source/asset extension followed by a
 *     non-word boundary (so `foo.ts` is a match but `foo.tsfoo` is not)
 */
const PATH_PATTERN = new RegExp(
  String.raw`(?<![@\w./-])(${PREFIX_GROUP}/[A-Za-z0-9_./-]+\.${EXT_GROUP})(?!\w)`,
  'g',
);

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

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(p));
    } else if (SCAN_FILE_EXTENSIONS.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

interface FoundRef {
  refPath: string;
  testFile: string;
  line: number;
}

function extractMissingRefs(): FoundRef[] {
  const findings: FoundRef[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of walk(root)) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      const seenInFile = new Set<string>();
      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        PATH_PATTERN.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = PATH_PATTERN.exec(lineText)) !== null) {
          const refPath = match[1];
          if (seenInFile.has(refPath)) continue;
          seenInFile.add(refPath);
          const absPath = path.join(repoRoot, refPath);
          if (!fs.existsSync(absPath)) {
            findings.push({
              refPath,
              testFile: path.relative(repoRoot, file),
              line: i + 1,
            });
          }
        }
      }
    }
  }
  return findings;
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
          lines.push(`    referenced from ${r.testFile}:${r.line}`);
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
