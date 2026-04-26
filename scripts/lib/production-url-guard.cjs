/* eslint-env node */
/**
 * Task #1211: single source of truth for the production-database safety
 * helpers used by both `jest.global-setup.cjs` (gates `drizzle-kit push
 * --force`) and `scripts/clean-orphan-fk-rows.ts` (gates the orphan-row
 * DELETEs).
 *
 * Both call sites previously carried their own private copies of
 * `looksLikeProductionUrl` and `maskDbUrl`. Their behaviour is locked
 * in by Task #1204 / Task #1210 individually, but two implementations
 * could silently drift apart — e.g. someone tightens the regex in one
 * file to also catch `staging` or `-rc` and forgets the sibling. This
 * module is intentionally tiny and dependency-free so both consumers
 * can `require` it without dragging in the rest of the codebase.
 *
 * Authored as `.cjs` (CommonJS) so `jest.global-setup.cjs` (which Jest
 * loads via plain `require`) can pull it in directly. The TypeScript
 * consumer reaches the same exports through Node's ESM<->CJS interop.
 */

/**
 * Mask credentials in a Postgres URL so it can safely be logged or
 * surfaced in operator-facing error messages. Keeps the protocol,
 * host and pathname (so the operator can see WHICH database was
 * targeted) but strips username/password to a `***@` marker.
 *
 * Returns `<invalid url>` instead of throwing if the URL fails to
 * parse, so callers can use this in error paths without nesting more
 * try/catch.
 *
 * @param {string} url
 * @returns {string}
 */
function maskDbUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username ? '***@' : ''}${u.host}${u.pathname}`;
  } catch {
    return '<invalid url>';
  }
}

/**
 * Returns true when the given URL's hostname or pathname contains a
 * `prod` / `production` / `live` token bounded by start/end of string
 * or by `.`, `_`, `-` (so `db.production.example`, `app-prod-1`,
 * `/live_db` all match, but `livestream` or `productivity` do not).
 *
 * Used by both safety guards to refuse destructive operations against
 * a URL that looks like production unless the operator has explicitly
 * set `ALLOW_DB_PUSH_IN_TESTS=1`.
 *
 * @param {string} rawUrl
 * @returns {boolean}
 */
function looksLikeProductionUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const haystack = `${u.hostname} ${u.pathname}`.toLowerCase();
    return /(^|[._-])(prod|production|live)([._-]|$)/.test(haystack);
  } catch {
    return false;
  }
}

module.exports = {
  maskDbUrl,
  looksLikeProductionUrl,
};
