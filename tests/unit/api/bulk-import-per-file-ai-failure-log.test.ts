/**
 * Task #807 — processItemForStep must emit a structured warning that
 * includes both the bulk-import item ID and the bulk-import session ID
 * whenever an analyzer call returns fallbackReason `api_error`,
 * `unreadable_response`, or `model_misconfigured`. The session ID is the
 * operational hook ops use to find the failing row in the admin panel.
 *
 * The test exercises the exported `logPerFileAiFailure` helper directly
 * (rather than spinning up the whole route) for two reasons:
 *  1. The helper is the entire surface area added in Task #807 — wiring
 *     it up at all five analyzer call sites is verified by reading the
 *     diff; what we need to lock down here is the helper's contract.
 *  2. We assert against the *formatted* console.warn output, which is
 *     what the shared logger writes after running its sanitizer. That
 *     proves the chosen field name (`bulkImportSession`) survives the
 *     SENSITIVE_FIELDS scrub instead of being printed as `[REDACTED]`.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// We don't pull in the rest of the bulk-import route, so heavy imports
// (multer, db, auth) don't run. Importing only the helper keeps this a
// pure unit test that runs without a database.
import { logPerFileAiFailure } from '../../../server/api/bulk-import';

describe('logPerFileAiFailure (Task #807)', () => {
  const item = {
    id: 'item-uuid-1234',
    sessionId: 'session-uuid-abcd',
    originalName: 'invoice-2026-04.pdf',
  };

  let warnSpy: jest.SpiedFunction<typeof console.warn>;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('logs item ID and bulk-import session ID for fallbackReason "api_error"', () => {
    logPerFileAiFailure('screening', item, 'api_error');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const formatted = warnSpy.mock.calls[0][0] as string;
    expect(formatted).toContain('[bulk-import] per-file AI failure');
    expect(formatted).toContain('"step":"screening"');
    expect(formatted).toContain('"itemId":"item-uuid-1234"');
    // Critical: the session UUID must appear unredacted under a key the
    // logger's SENSITIVE_FIELDS check does not match.
    expect(formatted).toContain('"bulkImportSession":"session-uuid-abcd"');
    expect(formatted).toContain('"originalName":"invoice-2026-04.pdf"');
    expect(formatted).toContain('"fallbackReason":"api_error"');
    expect(formatted).not.toContain('[REDACTED]');
  });

  it('logs item ID and bulk-import session ID for fallbackReason "unreadable_response"', () => {
    logPerFileAiFailure('linking', item, 'unreadable_response');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const formatted = warnSpy.mock.calls[0][0] as string;
    expect(formatted).toContain('"step":"linking"');
    expect(formatted).toContain('"itemId":"item-uuid-1234"');
    expect(formatted).toContain('"bulkImportSession":"session-uuid-abcd"');
    expect(formatted).toContain('"fallbackReason":"unreadable_response"');
    expect(formatted).not.toContain('[REDACTED]');
  });

  it('logs item ID and session ID for fallbackReason "model_misconfigured"', () => {
    logPerFileAiFailure('sorting', item, 'model_misconfigured');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const formatted = warnSpy.mock.calls[0][0] as string;
    expect(formatted).toContain('[bulk-import] per-file AI failure');
    expect(formatted).toContain('"step":"sorting"');
    expect(formatted).toContain('"itemId":"item-uuid-1234"');
    expect(formatted).toContain('"bulkImportSession":"session-uuid-abcd"');
    expect(formatted).toContain('"fallbackReason":"model_misconfigured"');
    expect(formatted).not.toContain('[REDACTED]');
  });

  it.each([
    ['oversize'],
    ['unsupported_mime'],
    ['extraction_failed'],
    ['missing_file'],
    ['no_api_key'],
  ] as const)(
    'stays silent for deterministic fallbackReason "%s"',
    (reason) => {
      logPerFileAiFailure('screening', item, reason);
      expect(warnSpy).not.toHaveBeenCalled();
    },
  );

  it('stays silent when fallbackReason is null (analyzer succeeded)', () => {
    logPerFileAiFailure('identification', item, null);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('stays silent when fallbackReason is undefined', () => {
    logPerFileAiFailure('sorting', item, undefined);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
