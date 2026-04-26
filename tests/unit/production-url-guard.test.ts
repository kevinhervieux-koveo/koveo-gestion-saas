/**
 * @jest-environment node
 *
 * Task #1211 — Unit coverage for the shared production-URL safety
 * helpers (`scripts/lib/production-url-guard.cjs`).
 *
 * The two existing integration tests
 * (`tests/integration/jest-global-setup-production-guard.test.ts` and
 * `tests/integration/orphan-fk-cleanup-production-guard.test.ts`) lock
 * in the *behaviour* of each call site. This file adds a tiny direct
 * unit test for the shared module so a regex tweak that is wrong in
 * isolation (e.g. accidentally over-matching `livestream` /
 * `productivity`, or losing the `prod` token entirely) fails fast at
 * the unit tier without needing the slower integration suite to fire.
 *
 * Token boundaries the regex (intentionally) treats as production:
 *   `prod`, `production`, `live`
 * Boundary characters: start/end of string OR `.`, `_`, `-`.
 * (Note: the path separator `/` is NOT a boundary — pathname matches
 * fire when the token is wrapped by `.`, `_` or `-` inside the path,
 * not when it sits directly after the leading slash. Pinning that
 * exact behaviour is what stops a future regex tweak from quietly
 * widening or narrowing the gate.)
 *
 * Counter-examples (must NOT match) cover the two real-world false
 * positives the boundary anchors are designed to prevent:
 *   `livestream` (substring of `live`),
 *   `productivity` (substring of `prod` / `production`).
 */

import { describe, it, expect } from '@jest/globals';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { looksLikeProductionUrl, maskDbUrl } = require('../../scripts/lib/production-url-guard.cjs');

describe('production-url-guard shared helpers (Task #1211)', () => {
  describe('looksLikeProductionUrl()', () => {
    it.each([
      ['postgres://u:p@db.production.example/app', 'hostname token: production'],
      ['postgres://u:p@app-prod-1.example.com/app', 'hostname token: prod'],
      ['postgres://u:p@db.live.example/app', 'hostname token: live'],
      ['postgres://u:p@prod.example/app', 'hostname token: prod (start of hostname)'],
      ['postgres://u:p@host.example/db_prod', 'pathname token: prod bounded by _'],
      ['postgres://u:p@host.example/db.live.dump', 'pathname token: live bounded by .'],
    ])('flags %p as production (%s)', (url) => {
      expect(looksLikeProductionUrl(url)).toBe(true);
    });

    it.each([
      ['postgres://u:p@localhost:5432/app_test', 'plain localhost'],
      ['postgres://u:p@db.staging.example/app', 'staging is not flagged'],
      // The boundary anchors exist precisely to prevent these
      // false-positives — a regression that dropped them would let
      // `livestream` / `productivity` (and every project whose name
      // happens to contain the substring) be treated as production.
      ['postgres://u:p@livestream.example/app', 'livestream substring is NOT live'],
      ['postgres://u:p@productivity.example/app', 'productivity substring is NOT prod'],
      ['not a url at all', 'invalid URL returns false'],
    ])('does not flag %p (%s)', (url) => {
      expect(looksLikeProductionUrl(url)).toBe(false);
    });
  });

  describe('maskDbUrl()', () => {
    it('strips username and password but keeps protocol, host, and pathname', () => {
      // The masked form is what gets surfaced to operators in the
      // refusal error message — it MUST name the offending host (so
      // the operator can see what was targeted) but MUST NOT leak the
      // credentials they configured.
      expect(maskDbUrl('postgres://u:secret@db.production.example/app')).toBe(
        'postgres://***@db.production.example/app',
      );
    });

    it('omits the credentials marker when the URL has no username', () => {
      // A URL without credentials should not gain a spurious `***@`
      // marker — the marker is what tells operators credentials WERE
      // present and have been redacted.
      expect(maskDbUrl('postgres://db.example/app')).toBe('postgres://db.example/app');
    });

    it('returns <invalid url> instead of throwing on a malformed input', () => {
      // Callers use this in error paths; throwing here would mask the
      // original guard rejection with a less useful URL parse error.
      expect(maskDbUrl('not a url at all')).toBe('<invalid url>');
    });

    it('never includes the password substring of a credentialed URL', () => {
      // Belt-and-braces: the explicit string check above pins the
      // exact masked form, but this asserts the credential never
      // appears anywhere in the output even if the format changes.
      const masked = maskDbUrl('postgres://admin:hunter2@db.production.example/app');
      expect(masked).not.toContain('hunter2');
      expect(masked).not.toContain('admin');
    });
  });
});
