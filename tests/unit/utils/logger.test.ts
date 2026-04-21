/**
 * @file Unit tests for the structured logger's email masking behavior.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

import {
  logInfo,
  logWarn,
  logError,
  logDebug,
  logSecurity,
  logAudit,
  maskEmail,
} from '../../../server/utils/logger';

describe('logger email masking in sanitizeLogData', () => {
  let logSpy: jest.SpiedFunction<typeof console.log>;
  let warnSpy: jest.SpiedFunction<typeof console.warn>;
  let errorSpy: jest.SpiedFunction<typeof console.error>;
  let debugSpy: jest.SpiedFunction<typeof console.debug>;

  beforeEach(() => {
    process.env.LOG_LEVEL = 'DEBUG';
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.LOG_LEVEL;
  });

  function lastCall(spy: jest.SpiedFunction<any>): string {
    return spy.mock.calls[spy.mock.calls.length - 1][0] as string;
  }

  it('masks values stored under email-shaped keys at INFO', () => {
    logInfo('user signup', {
      metadata: {
        email: 'jane.doe@example.com',
        userEmail: 'JANE.DOE@example.com',
        recipientEmail: 'other@foo.org',
        to: 'inbox@bar.io',
      },
    });

    const out = lastCall(logSpy);
    expect(out).not.toContain('jane.doe@example.com');
    expect(out).not.toContain('other@foo.org');
    expect(out).not.toContain('inbox@bar.io');
    expect(out).toContain(maskEmail('jane.doe@example.com'));
    expect(out).toContain(maskEmail('other@foo.org'));
    expect(out).toContain(maskEmail('inbox@bar.io'));
  });

  it('masks email-shaped strings even when the key is not email-y at WARN', () => {
    logWarn('processed message', {
      metadata: { note: 'sent to user@example.com successfully' },
    });

    const out = lastCall(warnSpy);
    expect(out).not.toContain('user@example.com');
    expect(out).toContain(maskEmail('user@example.com'));
  });

  it('masks emails inside arrays under email-shaped keys', () => {
    logInfo('bulk', {
      metadata: { bcc: ['a@x.com', 'b@y.com'] },
    });

    const out = lastCall(logSpy);
    expect(out).not.toContain('a@x.com');
    expect(out).not.toContain('b@y.com');
    expect(out).toContain(maskEmail('a@x.com'));
    expect(out).toContain(maskEmail('b@y.com'));
  });

  it('masks emails in ERROR context too', () => {
    logError('boom', new Error('nope'), {
      metadata: { email: 'err@example.com' },
    });
    const out = lastCall(errorSpy);
    expect(out).not.toContain('err@example.com');
    expect(out).toContain(maskEmail('err@example.com'));
  });

  it('masks emails in SECURITY and AUDIT helpers', () => {
    logSecurity('login_attempt', { metadata: { email: 'sec@example.com' } });
    expect(lastCall(warnSpy)).toContain(maskEmail('sec@example.com'));
    expect(lastCall(warnSpy)).not.toContain('sec@example.com');

    logAudit('account_update', { metadata: { email: 'aud@example.com' } });
    expect(lastCall(logSpy)).toContain(maskEmail('aud@example.com'));
    expect(lastCall(logSpy)).not.toContain('aud@example.com');
  });

  it('keeps full email details in logDebug', () => {
    logDebug('debugging', { metadata: { email: 'debug@example.com' } });
    const out = lastCall(debugSpy);
    expect(out).toContain('debug@example.com');
  });

  it('does not mangle non-email strings that contain "@"', () => {
    logInfo('twitter handle', { metadata: { note: 'mention @someone here' } });
    const out = lastCall(logSpy);
    expect(out).toContain('mention @someone here');
  });

  it('does not double-mask values that already came from maskEmail', () => {
    const pre = maskEmail('already@example.com');
    logInfo('preexisting', { metadata: { email: pre } });
    const out = lastCall(logSpy);
    // The exact pre-masked token should appear unchanged (no second hash suffix).
    expect(out).toContain(pre);
    expect(out).not.toMatch(/#[a-f0-9]{8}#[a-f0-9]{8}/);
  });

  it('still redacts known sensitive fields', () => {
    logInfo('login', { metadata: { password: 'super-secret', email: 'p@x.com' } });
    const out = lastCall(logSpy);
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('super-secret');
    expect(out).not.toContain('p@x.com');
  });
});
