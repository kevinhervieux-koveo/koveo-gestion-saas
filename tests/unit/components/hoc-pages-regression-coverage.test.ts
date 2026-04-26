import * as fs from 'fs';
import * as path from 'path';

/**
 * Meta-test: every page wrapped with `withHierarchicalSelection` must have
 * a corresponding `*-hoc-regression.test.tsx` file under
 * `tests/unit/components/` that imports the page.
 *
 * This guards against regressions like the duplicate-React / route lazy-loading
 * crash (Tasks #1148, #1159) silently slipping back in through any newly added
 * HOC-driven page that ships without a mount-time regression test.
 *
 * The check is intentionally simple: scan `client/src/pages/**` for files that
 * import `withHierarchicalSelection`, then assert that at least one regression
 * test references the same page file (either directly or via its directory's
 * `index.tsx` re-export).
 */

const REPO_ROOT = path.resolve(__dirname, '../../..');
const PAGES_DIR = path.join(REPO_ROOT, 'client/src/pages');
const REGRESSION_TESTS_DIR = path.join(REPO_ROOT, 'tests/unit/components');
const HOC_IMPORT_PATTERN = /withHierarchicalSelection/;
const REGRESSION_TEST_SUFFIX = '-hoc-regression.test.tsx';

function walk(dir: string, predicate: (file: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, predicate));
    } else if (entry.isFile() && predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

function findHocPages(): string[] {
  const tsxFiles = walk(PAGES_DIR, (f) => f.endsWith('.tsx'));
  return tsxFiles.filter((file) => {
    const content = fs.readFileSync(file, 'utf8');
    // Match an `import` statement (not just any string occurrence) so a
    // page that merely mentions the HOC name in a comment is not falsely
    // flagged. The HOC is always pulled in via a top-level import.
    return /import[\s\S]*?withHierarchicalSelection[\s\S]*?from\s+['"][^'"]+['"]/m.test(
      content,
    ) || /from\s+['"][^'"]+withHierarchicalSelection['"]/m.test(content);
  });
}

function getCoverageCandidates(pageFile: string): string[] {
  const repoRel = toPosix(path.relative(REPO_ROOT, pageFile));
  const withoutExt = repoRel.replace(/\.tsx$/, '');
  const candidates = new Set<string>();
  candidates.add(withoutExt);

  const dir = path.dirname(pageFile);
  const dirRel = toPosix(path.relative(REPO_ROOT, dir));
  const basename = path.basename(pageFile, '.tsx');

  // If the page IS the directory's index.tsx, the import is just the dir.
  if (basename === 'index') {
    candidates.add(dirRel);
  }

  // If a sibling index.tsx re-exports this page, callers may import the
  // directory instead of the file (e.g. ProjectsPage re-exported via
  // its folder's index.tsx).
  const siblingIndex = path.join(dir, 'index.tsx');
  if (basename !== 'index' && fs.existsSync(siblingIndex)) {
    const siblingContent = fs.readFileSync(siblingIndex, 'utf8');
    if (siblingContent.includes(`./${basename}`)) {
      candidates.add(dirRel);
    }
  }

  return Array.from(candidates);
}

function findRegressionTests(): { file: string; content: string }[] {
  if (!fs.existsSync(REGRESSION_TESTS_DIR)) return [];
  return fs
    .readdirSync(REGRESSION_TESTS_DIR)
    .filter((name) => name.endsWith(REGRESSION_TEST_SUFFIX))
    .map((name) => {
      const file = path.join(REGRESSION_TESTS_DIR, name);
      return { file, content: fs.readFileSync(file, 'utf8') };
    });
}

describe('HOC-driven pages regression coverage (meta-test)', () => {
  const hocPages = findHocPages();
  const regressionTests = findRegressionTests();

  it('discovers at least one HOC-driven page (sanity check)', () => {
    expect(hocPages.length).toBeGreaterThan(0);
  });

  it('discovers at least one *-hoc-regression.test.tsx file (sanity check)', () => {
    expect(regressionTests.length).toBeGreaterThan(0);
  });

  it.each(hocPages.map((p) => [toPosix(path.relative(REPO_ROOT, p)), p]))(
    'page %s has a *-hoc-regression.test.tsx covering it',
    (_label, pageFile) => {
      const candidates = getCoverageCandidates(pageFile as string);
      const matchingTest = regressionTests.find(({ content }) =>
        candidates.some((candidate) => content.includes(candidate)),
      );

      if (!matchingTest) {
        const repoRel = toPosix(path.relative(REPO_ROOT, pageFile as string));
        const suggestedName = repoRel
          .replace(/^client\/src\/pages\//, '')
          .replace(/\.tsx$/, '')
          .replace(/\/index$/, '')
          .replace(/\//g, '-')
          .toLowerCase();
        throw new Error(
          [
            `Page "${repoRel}" is wrapped with withHierarchicalSelection but has no`,
            `corresponding *-hoc-regression.test.tsx under tests/unit/components/.`,
            ``,
            `Add a regression test (e.g. tests/unit/components/${suggestedName}-hoc-regression.test.tsx)`,
            `that mounts the page through wouter, similar to`,
            `tests/unit/components/inventory-page-hoc-regression.test.tsx, and imports`,
            `the page via one of: ${candidates.join(', ')}`,
          ].join('\n'),
        );
      }

      expect(matchingTest).toBeDefined();
    },
  );
});
