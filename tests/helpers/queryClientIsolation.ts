/**
 * Shared helpers that keep bulk-document-import-style component tests
 * isolated from each other when they reuse the global React Query
 * client (`@/lib/queryClient`).
 *
 * Background — Task #1076 / Task #1081
 * -----------------------------------------------------------------
 * The bulk-document-import page builds React Query keys around the
 * active session id, e.g.
 *
 *   ['/api/admin/bulk-import/sessions', sessionId, 'lite']
 *
 * Component tests render the page under the global `queryClient` and
 * call `queryClient.clear()` in `beforeEach` to start fresh. That
 * leaves a narrow race window: a previous test's in-flight `fetch`
 * can resolve AFTER `clear()` runs and write its result into the
 * freshly empty cache under the same queryKey. The new test then
 * either reads stale data or — in the original Task #1076 flake —
 * stays stuck on its loading spinner because the cache momentarily
 * held the wrong shape.
 *
 * The fix has two ingredients:
 *
 *   1. `await queryClient.cancelQueries()` BEFORE clearing the cache,
 *      so any pending fetch is aborted and cannot race the clear.
 *   2. Give every test a unique session id, so even if a stale fetch
 *      somehow lands late it writes to a key the new test never reads.
 *
 * Both are wrapped here so a test file can opt in with a single
 * import + two calls in `beforeEach` instead of re-deriving the
 * boilerplate per file.
 */

import { queryClient } from '@/lib/queryClient';

let sessionCounter = 0;

/**
 * Returns a fresh, unique session id per call. Pair with the test
 * file's existing `let SESSION_ID = ...` module-level binding so
 * fetch responders that interpolate `${SESSION_ID}` see the new
 * value on the next request.
 *
 * The prefix lets each suite keep a recognisable id in test logs
 * (e.g. `session-task-1038-7`).
 */
export function nextSessionId(prefix: string): string {
  sessionCounter += 1;
  return `${prefix}-${sessionCounter}`;
}

/**
 * Cancel any queries the previous test left in flight, then clear
 * the shared queryClient. Awaiting `cancelQueries()` is what stops
 * the resolve-after-clear race that produced the loading-spinner
 * flake in Task #1076.
 *
 * Call from an async `beforeEach` BEFORE seeding the test's own
 * fixtures and session id.
 */
export async function resetSharedQueryClient(): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.clear();
  queryClient.removeQueries();
}
