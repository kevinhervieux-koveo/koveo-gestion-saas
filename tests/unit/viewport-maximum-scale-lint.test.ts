/**
 * @jest-environment node
 *
 * Build-time HTML lint: assert that the built dist/index.html does NOT contain
 * `maximum-scale=1` in the viewport meta tag.
 *
 * This is a regression guard for WCAG 2.1 SC 1.4.4 (W65). If the built asset
 * ever reintroduces the restriction, this test will fail before it reaches
 * production.
 *
 * In CI (CI=true), dist/index.html MUST be present — the pipeline must run
 * `npm run build` before this lint step so the final artifact is always
 * inspected. In local dev, missing dist is a non-fatal warning so developers
 * are not forced to build before running unit tests.
 *
 * Usage:
 *   npm run build && npx jest tests/unit/viewport-maximum-scale-lint.test.ts
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

const DIST_HTML = path.resolve(process.cwd(), 'dist', 'index.html');
const SOURCE_HTML = path.resolve(process.cwd(), 'client', 'index.html');

const MAXIMUM_SCALE_PATTERN = /maximum-scale\s*=\s*1\b/i;

const isCI = process.env.CI === 'true' || process.env.CI === '1';

describe('Build-time HTML lint — viewport maximum-scale regression guard (W65)', () => {
  it('dist/index.html must NOT contain maximum-scale=1 in the viewport meta', () => {
    if (!fs.existsSync(DIST_HTML)) {
      if (isCI) {
        throw new Error(
          `[CI] Built asset not found: ${DIST_HTML}\n` +
            'In CI, `npm run build` MUST run before this lint step so the ' +
            'maximum-scale regression guard can inspect the final output. ' +
            'Add a build step before this test in your pipeline.'
        );
      }
      console.warn(
        `[SKIP] ${DIST_HTML} does not exist. Run \`npm run build\` ` +
          'to generate the distributable assets, then re-run this lint check. ' +
          'In CI this would be a hard failure.'
      );
      return;
    }

    const html = fs.readFileSync(DIST_HTML, 'utf-8');
    const matches = html.match(MAXIMUM_SCALE_PATTERN);

    expect(
      matches,
      `dist/index.html contains "${matches?.[0]}" — this violates WCAG 1.4.4 (W65). ` +
        'Remove maximum-scale=1 from the viewport meta tag in client/index.html.'
    ).toBeNull();
  });

  it('client/index.html (source) must NOT contain maximum-scale=1 in the viewport meta', () => {
    expect(fs.existsSync(SOURCE_HTML)).toBe(true);

    const html = fs.readFileSync(SOURCE_HTML, 'utf-8');
    const matches = html.match(MAXIMUM_SCALE_PATTERN);

    expect(
      matches,
      `client/index.html contains "${matches?.[0]}" — this violates WCAG 1.4.4 (W65). ` +
        'Remove maximum-scale=1 from the viewport meta tag.'
    ).toBeNull();
  });

  it('client/index.html (source) viewport meta contains viewport-fit=cover for notch support', () => {
    const html = fs.readFileSync(SOURCE_HTML, 'utf-8');

    const viewportMatch = html.match(/<meta\s+name="viewport"[^>]*content="([^"]*)"[^>]*>/i);
    expect(viewportMatch).not.toBeNull();

    const content = viewportMatch![1];
    expect(content).toContain('viewport-fit=cover');
  });
});
