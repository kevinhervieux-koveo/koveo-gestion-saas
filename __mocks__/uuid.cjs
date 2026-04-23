/**
 * CommonJS shim for the `uuid` package.
 *
 * `uuid` v14 ships ESM-only `dist-node` which Jest's CJS transform
 * cannot parse. The package's transitive consumers (e.g.
 * `@google-cloud/storage` -> `google-auth-library` -> `gaxios`) load
 * it eagerly during module init, so even tests that never touch UUID
 * generation directly will fail to import server code without this
 * shim.
 *
 * Behaviour mirrors the public surface used in the codebase
 * (`v1`/`v3`/`v4`/`v5`/`v6`/`v7`, `parse`/`stringify`/`validate`/
 * `version`, `NIL`, `MAX`). Random IDs are produced with Node's
 * built-in `crypto.randomUUID`, which is RFC 4122 v4 and good enough
 * for any test that just needs a unique identifier.
 *
 * IMPORTANT: this is a *behavioural compatibility* shim, NOT an
 * algorithmically faithful UUID implementation. Every `vN()` returns
 * a v4 string regardless of the requested version, `parse`/`stringify`
 * are pass-through, and `validate` only checks the v4 grouping/hex
 * shape. If a test ever needs true v1/v3/v5/v6/v7 semantics or the
 * exact byte layout of `parse`, it should import the real `uuid`
 * package via `jest.unmock('uuid')` and arrange for that test to run
 * outside the moduleNameMapper redirect.
 */
const { randomUUID } = require('crypto');

const v = () => randomUUID();

module.exports = {
  v1: v,
  v3: v,
  v4: v,
  v5: v,
  v6: v,
  v7: v,
  NIL: '00000000-0000-0000-0000-000000000000',
  MAX: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  parse: (s) => s,
  stringify: (b) => String(b),
  validate: (s) =>
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s),
  version: () => 4,
};
