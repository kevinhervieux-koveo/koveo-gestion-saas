/**
 * @jest-environment node
 *
 * Task #488 — Catch new heavy modules even before they're added to the
 * lazy-mount list.
 *
 * Task #471 wired seven hand-picked heavy `server/api/*` modules through
 * `lazyMount` so their AI clients / large vendor SDKs / cache stores never
 * load at boot. The contract has one weak link: a future contributor can
 * add a brand-new heavy module (or grow an existing eager one) without
 * remembering to lazy-mount it. Cold-start memory then quietly bloats
 * because nothing fails.
 *
 * This guard inverts the default. For every file under `server/api/**`,
 * we measure on-disk size as a proxy for "weight" (transitive deps in
 * Express handlers correlate with line count, and line count correlates
 * tightly with file size for this codebase). Files above the threshold
 * MUST be either:
 *
 *   1. Lazy-mounted via `HEAVY_LAZY_MOUNTS` in `server/routes.ts`, OR
 *   2. Lazy-mounted via the `lazy:` block in `AUTO_ROUTE_MODULES`
 *      (`server/api/auto/index.ts`), OR
 *   3. Listed in `CHEAP_HEAVY_ALLOWLIST` below WITH a one-line rationale.
 *
 * Anything else fails this test with a message that names the offending
 * file and points the author at the three legal options. The default
 * "do nothing" path no longer silently passes.
 *
 * Discovery is intentionally pure-FS (no module imports). It avoids the
 * jest moduleNameMapper that rewrites `server/routes` to a mock, and
 * keeps the check fast and side-effect-free.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const API_DIR = path.resolve(REPO_ROOT, 'server/api');
const ROUTES_FILE = path.resolve(REPO_ROOT, 'server/routes.ts');
const AUTO_INDEX_FILE = path.resolve(API_DIR, 'auto/index.ts');

/**
 * Bytes. A `server/api/*.ts` file above this size is treated as "heavy"
 * for guard purposes. The number is calibrated so every existing eager
 * mount either falls below it OR is captured by the explicit allowlist
 * below — i.e. the guard locks the CURRENT footprint and only fires on
 * NEW heavy additions or growth that crosses the line.
 *
 * Raise this only with a code-review-grade justification: a higher
 * threshold weakens the guard.
 */
const HEAVY_BYTES_THRESHOLD = 30_000;

/**
 * Files under `server/api/` that are infrastructure (not Express route
 * modules) and therefore exempt from the lazy / allowlist check. Keep
 * this list as small as possible.
 */
const INFRASTRUCTURE_FILES: ReadonlySet<string> = new Set([
  path.resolve(API_DIR, 'auto/index.ts'),
  path.resolve(API_DIR, 'auto/_register.ts'),
]);

/**
 * Cheap-allowlist: files that exceed the byte threshold but have been
 * deliberately reviewed and approved as eager-mounted. Each entry MUST
 * carry a one-line rationale so the next reviewer understands the
 * trade-off, AND a future contributor adding a NEW heavy module is
 * forced to either lazy-mount it or add a new entry here (which surfaces
 * the decision in code review).
 *
 * Keys are paths relative to `server/api/` using forward slashes.
 */
const CHEAP_HEAVY_ALLOWLIST: Readonly<Record<string, string>> = {
  // Empty as of task #489 — every previously allowlisted module has been
  // migrated to HEAVY_LAZY_MOUNTS in `server/routes.ts`. Add a new entry
  // here ONLY with a code-review-grade rationale that explains why the
  // module truly cannot be lazy-mounted.
};

/** Recursively list every `*.ts` file under `dir`. */
function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Parse `server/routes.ts` and `server/api/auto/index.ts` to discover
 * which `server/api/**` files are wired through a lazy-mount path.
 *
 * In `routes.ts` the loaders look like:
 *   loader: async () => (await import('./api/documents')).registerDocumentRoutes,
 *
 * In `auto/index.ts` lazy entries look like:
 *   foo: { load: () => import('./foo'), lazy: { matcher: '/api/foo' } }
 *
 * We capture both shapes and resolve them to absolute file paths under
 * `server/api/`.
 */
function discoverLazyMountedFiles(): Set<string> {
  const out = new Set<string>();

  // --- routes.ts: any `import('./api/<name>')` is treated as lazy.
  // The HEAVY_LAZY_MOUNTS array is the only place this string appears
  // in routes.ts (eager registrars use top-of-file `import` statements,
  // not dynamic `import(...)` calls).
  const routesSrc = fs.readFileSync(ROUTES_FILE, 'utf8');
  const routesPattern = /import\(\s*['"]\.\/api\/([^'"]+)['"]\s*\)/g;
  for (const match of routesSrc.matchAll(routesPattern)) {
    const rel = match[1].endsWith('.ts') ? match[1] : `${match[1]}.ts`;
    out.add(path.resolve(API_DIR, rel));
  }

  // --- auto/index.ts: lazy entries only. Scan each entry block for a
  // `lazy:` key; if present, capture the `import('./<name>')` call from
  // its `load` thunk. The block boundaries are simple `{ ... }` pairs
  // because entries are one-liner-ish records — we use a balanced-brace
  // scanner so multi-line entries also work.
  const autoSrc = fs.readFileSync(AUTO_INDEX_FILE, 'utf8');
  // Find AUTO_ROUTE_MODULES = { ... };
  const moduleStart = autoSrc.indexOf('AUTO_ROUTE_MODULES');
  if (moduleStart >= 0) {
    const openBrace = autoSrc.indexOf('{', moduleStart);
    if (openBrace >= 0) {
      // Walk braces to find matching close, then scan inner text.
      let depth = 0;
      let i = openBrace;
      for (; i < autoSrc.length; i++) {
        const ch = autoSrc[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) break;
        }
      }
      const body = autoSrc.slice(openBrace + 1, i);
      // Split into top-level entries by tracking braces and commas.
      // Each entry has the shape `key: { ... }`. We scan for balanced
      // `{ ... }` blocks at depth 1 within `body`.
      let blockDepth = 0;
      let blockStart = -1;
      const blocks: string[] = [];
      for (let j = 0; j < body.length; j++) {
        const ch = body[j];
        if (ch === '{') {
          if (blockDepth === 0) blockStart = j;
          blockDepth++;
        } else if (ch === '}') {
          blockDepth--;
          if (blockDepth === 0 && blockStart >= 0) {
            blocks.push(body.slice(blockStart, j + 1));
            blockStart = -1;
          }
        }
      }
      for (const block of blocks) {
        // Skip commented-out example blocks (the README/example entries
        // in auto/index.ts live inside `//` lines, not real entries, so
        // this is just a belt-and-braces guard).
        if (!/\blazy\s*:/.test(block)) continue;
        const m = block.match(/import\(\s*['"]\.\/([^'"]+)['"]\s*\)/);
        if (!m) continue;
        const rel = m[1].endsWith('.ts') ? m[1] : `${m[1]}.ts`;
        out.add(path.resolve(API_DIR, 'auto', rel));
      }
    }
  }

  return out;
}

function relApi(absPath: string): string {
  return path.relative(API_DIR, absPath).split(path.sep).join('/');
}

describe('heavy server/api module guard (Task #488)', () => {
  it('every file above the heavy threshold is lazy-mounted or explicitly allowlisted', () => {
    const lazyMounted = discoverLazyMountedFiles();
    const failures: string[] = [];

    for (const file of listTsFiles(API_DIR)) {
      if (INFRASTRUCTURE_FILES.has(file)) continue;
      const size = fs.statSync(file).size;
      if (size <= HEAVY_BYTES_THRESHOLD) continue;

      const rel = relApi(file);
      const isLazy = lazyMounted.has(file);
      const isAllowlisted = rel in CHEAP_HEAVY_ALLOWLIST;

      if (!isLazy && !isAllowlisted) {
        failures.push(
          `  - ${rel} (${size.toLocaleString()} bytes, threshold ${HEAVY_BYTES_THRESHOLD.toLocaleString()})`,
        );
      }
    }

    if (failures.length > 0) {
      throw new Error(
        [
          'New heavy server/api module(s) detected without an explicit decision:',
          ...failures,
          '',
          'Pick ONE of the following:',
          "  1. Lazy-mount the module by adding it to HEAVY_LAZY_MOUNTS in",
          '     server/routes.ts (preferred for anything that ships AI',
          '     clients, big vendor SDKs, or other deferrable weight).',
          "  2. Lazy-mount via AUTO_ROUTE_MODULES in server/api/auto/index.ts",
          '     using the `lazy: { matcher }` block.',
          "  3. If the module is genuinely cheap despite its size and MUST",
          '     stay eager, add a one-line rationale entry to',
          '     CHEAP_HEAVY_ALLOWLIST in this test file.',
          '',
          'Doing nothing is no longer a valid option — that is the whole',
          'point of this guard. See task #488.',
        ].join('\n'),
      );
    }
  });

  it('the cheap allowlist contains no stale entries', () => {
    const stale: string[] = [];
    for (const rel of Object.keys(CHEAP_HEAVY_ALLOWLIST)) {
      const abs = path.resolve(API_DIR, rel);
      if (!fs.existsSync(abs)) {
        stale.push(rel);
      }
    }
    expect(stale).toEqual([]);
  });

  it('every cheap-allowlist entry carries a non-trivial rationale', () => {
    const tooShort: string[] = [];
    for (const [rel, rationale] of Object.entries(CHEAP_HEAVY_ALLOWLIST)) {
      // 40 chars is the bar for "you wrote a sentence, not a TODO".
      if (rationale.trim().length < 40) {
        tooShort.push(rel);
      }
    }
    expect(tooShort).toEqual([]);
  });

  it('no file is both lazy-mounted AND on the cheap allowlist (would be redundant)', () => {
    const lazyMounted = discoverLazyMountedFiles();
    const both: string[] = [];
    for (const rel of Object.keys(CHEAP_HEAVY_ALLOWLIST)) {
      const abs = path.resolve(API_DIR, rel);
      if (lazyMounted.has(abs)) {
        both.push(rel);
      }
    }
    expect(both).toEqual([]);
  });

  it('cheap allowlist entries actually exceed the heavy threshold today', () => {
    // If a file shrinks below the threshold its allowlist entry becomes
    // dead weight; surface that so the entry can be removed.
    const belowThreshold: string[] = [];
    for (const rel of Object.keys(CHEAP_HEAVY_ALLOWLIST)) {
      const abs = path.resolve(API_DIR, rel);
      if (!fs.existsSync(abs)) continue; // covered by the stale check
      const size = fs.statSync(abs).size;
      if (size <= HEAVY_BYTES_THRESHOLD) {
        belowThreshold.push(`${rel} (${size} bytes)`);
      }
    }
    expect(belowThreshold).toEqual([]);
  });

  it('discovers the thirteen HEAVY_LAZY_MOUNTS loaders from server/routes.ts', () => {
    // Sanity: the parser must keep working even if routes.ts is
    // reformatted. If this fails, the main guard above silently
    // degrades into "everything looks eager", so we assert the
    // discovery surface explicitly.
    const lazyMounted = discoverLazyMountedFiles();
    const expected = [
      // Original seven (task #471).
      'documents.ts',
      'bills.ts',
      'communication.ts',
      'maintenance.ts',
      'demo-management.ts',
      'ai-document-analysis.ts',
      'bulk-import.ts',
      // Migrated by task #489 from the cheap-heavy allowlist.
      'users.ts',
      'organizations.ts',
      'buildings.ts',
      'demands.ts',
      'common-spaces.ts',
      'budgets.ts',
    ];
    const missing = expected.filter(
      (name) => !lazyMounted.has(path.resolve(API_DIR, name)),
    );
    expect(missing).toEqual([]);
  });
});
