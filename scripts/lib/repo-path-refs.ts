/**
 * Shared helpers for the stale repo-path reference guards
 * (Tasks #1229, #1236, #1246).
 *
 * Three guards share this helper:
 *   - `tests/unit/test-doc-path-references.test.ts` (tests trees)
 *   - `tests/unit/test-prod-doc-path-references.test.ts` (production code)
 *   - `tests/unit/test-markdown-doc-path-references.test.ts` (Markdown
 *     documentation under `docs/`, `replit.md`, and other repo-root
 *     `*.md`/`*.mdx` files)
 *
 * Each guard walks a configured set of source/doc trees, scans every
 * line of every file, and pulls out substrings that look like
 * repo-relative source paths under known top-level directories. When
 * any extracted path no longer resolves on disk, the calling guard
 * fails (modulo a per-guard allow-list).
 *
 * The regex/prefix list/lookbehind logic lives here so all three guards
 * stay in lock-step: a fix to the false-positive lookbehind in one tree
 * automatically benefits the others.
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
 * File extensions the walker actually opens and scans by default. We
 * only look inside text source files — not assets, not lockfiles.
 *
 * Callers that want to scan a different set of files (e.g. Markdown
 * documentation) can pass `scanFilePattern` in {@link WalkOptions} to
 * override this on a per-walk basis. See {@link SCAN_DOC_FILE_EXTENSIONS}.
 */
export const SCAN_FILE_EXTENSIONS = /\.(ts|tsx|js|jsx|cjs|mjs)$/;

/**
 * Docs-specific equivalent of {@link SCAN_FILE_EXTENSIONS}: matches
 * Markdown sources (`.md`) and MDX (`.mdx`). Used by the Markdown
 * stale-path guard (Task #1246) so it can walk `docs/` and the
 * repo-root `*.md` / `*.mdx` files (`replit.md`, `README.md`,
 * `CHANGELOG.md`, etc.) without picking up source code.
 */
export const SCAN_DOC_FILE_EXTENSIONS = /\.(md|mdx)$/;

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
  /**
   * Filename pattern the walker uses to decide which files to open
   * and scan. Defaults to {@link SCAN_FILE_EXTENSIONS} (source code).
   * Pass {@link SCAN_DOC_FILE_EXTENSIONS} to walk Markdown/MDX docs
   * instead.
   */
  scanFilePattern?: RegExp;
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
 *
 * The set of files considered "scannable" is controlled by
 * `opts.scanFilePattern` (defaults to {@link SCAN_FILE_EXTENSIONS}).
 */
export function walkScanFiles(dir: string, opts: WalkOptions = {}): string[] {
  if (!fs.existsSync(dir)) return [];
  const excludeDirNames = opts.excludeDirNames ?? DEFAULT_EXCLUDE_DIR_NAMES;
  const scanFilePattern = opts.scanFilePattern ?? SCAN_FILE_EXTENSIONS;
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (excludeDirNames.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkScanFiles(p, opts));
    } else if (scanFilePattern.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

export interface FindMissingRefsArgs {
  repoRoot: string;
  scanRoots: readonly string[];
  /**
   * Optional explicit list of absolute file paths to scan in addition
   * to whatever the recursive walk over `scanRoots` finds. Useful for
   * pulling in individual top-level files (e.g. repo-root `*.md`
   * sources for the Markdown guard) without recursing into the entire
   * repository.
   */
  extraScanFiles?: readonly string[];
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
  const {
    repoRoot,
    scanRoots,
    extraScanFiles = [],
    walkOptions = {},
  } = args;
  const excludeFiles = walkOptions.excludeFiles ?? new Set<string>();
  const findings: FoundRef[] = [];

  const seenAbsFiles = new Set<string>();
  const orderedFiles: string[] = [];
  for (const root of scanRoots) {
    for (const file of walkScanFiles(root, walkOptions)) {
      if (seenAbsFiles.has(file)) continue;
      seenAbsFiles.add(file);
      orderedFiles.push(file);
    }
  }
  for (const file of extraScanFiles) {
    if (seenAbsFiles.has(file)) continue;
    seenAbsFiles.add(file);
    orderedFiles.push(file);
  }

  for (const file of orderedFiles) {
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
  return findings;
}
