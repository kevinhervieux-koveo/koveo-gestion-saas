/**
 * Task #1660 — Snapshot/structural test verifying that the org-section
 * header element inside `bulk-document-import.tsx` does NOT carry the
 * Tailwind `uppercase` utility class.
 *
 * Background
 * ----------
 * QA Pass #27 found that the org-group headers in the building picker
 * were rendered ALL-CAPS due to `text-transform: uppercase` applied via
 * the `uppercase` Tailwind class. Task #1660 removed it. This test
 * locks that change in place so a future accidental reintroduction of
 * `uppercase` is caught immediately in the fast unit-test run without
 * needing a full browser launch.
 *
 * Approach
 * ---------
 * Rendering the full bulk-document-import page component in a JSDOM
 * environment is impractical (12 000+ line file, dozens of API
 * dependencies). Instead we assert directly on the source text of the
 * page file — the group-org-header element's className is a static
 * string literal, so a regex over the source is a reliable and fast
 * proxy for a rendered-DOM class assertion.
 *
 * The test:
 *  1. Reads the source of `client/src/pages/admin/bulk-document-import.tsx`.
 *  2. Locates the line that contains the `group-org-header-` testid attribute.
 *  3. Searches the lines immediately before that testid (within the same
 *     opening element) for the `className` attribute.
 *  4. Asserts the captured className string does NOT contain `uppercase`.
 *  5. Asserts the captured className DOES contain `font-semibold` (so
 *     we know heading hierarchy is preserved via weight, not transform).
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

const PAGE_FILE = path.resolve(
  __dirname,
  '../../../client/src/pages/admin/bulk-document-import.tsx',
);

describe('bulk-document-import — org-section header className (Task #1660)', () => {
  it('does not contain the `uppercase` Tailwind utility on the group-org-header element', () => {
    const source = fs.readFileSync(PAGE_FILE, 'utf-8');
    const lines = source.split('\n');

    // Find the line containing the group-org-header testid.
    // The element looks like:
    //   <div
    //     className="text-xs font-semibold tracking-wide text-muted-foreground"
    //     data-testid={`group-org-header-${group.id}`}
    //   >
    const testidLineIndex = lines.findIndex((l) =>
      l.includes('group-org-header-'),
    );
    expect(testidLineIndex).toBeGreaterThan(-1);

    // The className attribute is on one of the lines immediately before
    // the testid (within the same opening element). Search backwards
    // from the testid line until we find a className, stopping at the
    // nearest preceding `<div` opener to avoid escaping the element.
    let className: string | null = null;
    for (let i = testidLineIndex - 1; i >= Math.max(0, testidLineIndex - 10); i--) {
      const match = lines[i].match(/className="([^"]+)"/);
      if (match) {
        className = match[1];
        break;
      }
      // Stop if we've gone back past the opening tag for this element.
      if (lines[i].trimStart().startsWith('<div')) {
        break;
      }
    }

    expect(className).not.toBeNull();

    // Core assertion: `uppercase` must NOT appear.
    expect(className!).not.toMatch(/\buppercase\b/);

    // Heading hierarchy should still be preserved via font-weight.
    expect(className!).toMatch(/\bfont-semibold\b/);
  });
});
