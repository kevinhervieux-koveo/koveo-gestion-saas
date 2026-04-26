/**
 * Shared helpers for the stale repo-path reference guards (Tasks #1229, #1236).
 *
 * Both the tests-tree guard (`tests/unit/test-doc-path-references.test.ts`)
 * and the production-code guard
 * (`tests/unit/test-prod-doc-path-references.test.ts`) walk a configured
 * set of source trees, scan every line of every file, and pull out
 * substrings that look like repo-relative source paths under known
 * top-level directories. When any extracted path no longer resolves on
 * disk, the calling guard fails (modulo a per-guard allow-list).
 *
 * The regex/prefix list/lookbehind logic lives here so both guards stay
 * in lock-step: a fix to the false-positive lookbehind in one tree
 * automatically benefits the other.
 *
 * False-positive avoidance:
 *   - The leading lookbehind rejects `@`, `/`, `.`, `\w`, `-`
 *     immediately preceding the prefix, so node-module specifiers such
 *     as `@modelcontextprotocol/sdk/server/mcp.js` are NOT extracted as
 *     repo paths (the leading `@` disqualifies them).
 *   - The pattern requires the path to begin at one of the known
 *     top-level repo directories, so regex-alternation literals such as
 *     `route-manifest\.(json|js)` cannot synthesize a fake
 *     `route-manifest.js` reference (no prefix → no match).
 *   - The trailing `(?!\w)` boundary means `foo.ts` matches but
 *     `foo.tsfoo` does not.
 */

import fs from 'fs';
import path from 'path';

/**
 * Top-level repo directories that mark the start of a repo-relative
 * source path. Anything that doesn't begin with one of these is
 * ignored (so node-module paths, URL paths, etc. don't trigger).
 */
export const REPO_PATH_PREFIXES = [
  'client/src',
  'server',
  'shared',
  'tests',
  'scripts',
  'public',
  'drizzle',
  'migrations',
] as const;

/**
 * Source/asset file extensions a repo path can end with. Anything else
 * (e.g. `.png`, `.svg`, `.lock`) is treated as not-a-source-reference
 * and ignored.
 */
export const SOURCE_FILE_EXTENSIONS = [
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
] as const;

/**
 * File extensions the walker actually opens and scans. We only look
 * inside text source files — not assets, not lockfiles.
 */
export const SCAN_FILE_EXTENSIONS = /\.(ts|tsx|js|jsx|cjs|mjs)$/;

const PREFIX_GROUP = `(?:${REPO_PATH_PREFIXES.join('|')})`;
const EXT_GROUP = `(?:${SOURCE_FILE_EXTENSIONS.join('|')})`;

/**
 * The compiled extractor regex. Use {@link extractRepoPathRefsFromLine}
 * rather than touching this directly — the regex carries internal
 * `lastIndex` state and must be reset between lines.
 */
export const REPO_PATH_PATTERN = new RegExp(
  String.raw`(?<![@\w./-])(${PREFIX_GROUP}/[A-Za-z0-9_./-]+\.${EXT_GROUP})(?!\w)`,
  'g',
);

export interface FoundRef {
  refPath: string;
  sourceFile: string;
  line: number;
}

/**
 * Pull every repo-relative path-like substring out of a single line of
 * text. Caller is responsible for de-duplication across a file.
 */
export function extractRepoPathRefsFromLine(lineText: string): string[] {
  const out: string[] = [];
  REPO_PATH_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = REPO_PATH_PATTERN.exec(lineText)) !== null) {
    out.push(match[1]);
  }
  return out;
}

export interface WalkOptions {
  /**
   * Files (relative to repoRoot) to skip entirely. Useful for
   * generated artefacts that legitimately reference paths that may
   * drift from disk (e.g. `server/route-manifest.json`, but that file
   * is also a `.json` and so excluded by SCAN_FILE_EXTENSIONS anyway —
   * kept for forward-compatibility with new generated files).
   */
  excludeFiles?: ReadonlySet<string>;
  /**
   * Directory names (NOT paths) to skip when walking. Defaults skip
   * `node_modules`, `dist`, `build`, `.next`, `coverage`, and any
   * dotfile directory.
   */
  excludeDirNames?: ReadonlySet<string>;
}

const DEFAULT_EXCLUDE_DIR_NAMES: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
]);

/**
 * Recursively collect every scannable source file under `dir`,
 * applying the exclusion rules in `opts`. Returns absolute paths.
 */
export function walkScanFiles(dir: string, opts: WalkOptions = {}): string[] {
  if (!fs.existsSync(dir)) return [];
  const excludeDirNames = opts.excludeDirNames ?? DEFAULT_EXCLUDE_DIR_NAMES;
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (excludeDirNames.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkScanFiles(p, opts));
    } else if (SCAN_FILE_EXTENSIONS.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

export interface FindMissingRefsArgs {
  repoRoot: string;
  scanRoots: readonly string[];
  walkOptions?: WalkOptions;
}

/**
 * Walk every configured scan root, extract every repo-relative path
 * reference, and return the ones whose target does NOT exist on disk.
 *
 * De-duplicates per file (so a path mentioned ten times in one file
 * shows up once for that file), but a path mentioned in two different
 * files is reported twice — once per source — so the failure message
 * can point readers at every site that needs editing.
 */
export function findMissingRepoPathRefs(args: FindMissingRefsArgs): FoundRef[] {
  const { repoRoot, scanRoots, walkOptions = {} } = args;
  const excludeFiles = walkOptions.excludeFiles ?? new Set<string>();
  const findings: FoundRef[] = [];

  for (const root of scanRoots) {
    for (const file of walkScanFiles(root, walkOptions)) {
      const rel = path.relative(repoRoot, file);
      if (excludeFiles.has(rel)) continue;
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      const seenInFile = new Set<string>();
      for (let i = 0; i < lines.length; i++) {
        for (const refPath of extractRepoPathRefsFromLine(lines[i])) {
          if (seenInFile.has(refPath)) continue;
          seenInFile.add(refPath);
          const absPath = path.join(repoRoot, refPath);
          if (!fs.existsSync(absPath)) {
            findings.push({
              refPath,
              sourceFile: rel,
              line: i + 1,
            });
          }
        }
      }
    }
  }
  return findings;
}
