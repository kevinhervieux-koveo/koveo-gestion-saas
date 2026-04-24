/**
 * Diagnostic-header gating for the optimized download endpoint (Task #398).
 *
 * The four `X-*` diagnostic headers (`X-Performance-Optimized`, `X-Cache-Hit`,
 * `X-Response-Time`, `X-Storage-Metrics`) used to be emitted on every response
 * from `GET /api/documents/:id/optimized-file`, leaking internal cache state
 * and storage metrics to every client. They are now gated behind an explicit
 * admin-only `?debug=1` flag via `shouldEmitDiagnostics`.
 *
 * These tests cover:
 *   - the helper itself (matrix of role / flag combinations), and
 *   - a mini-Express handler that mirrors the production emission logic to
 *     confirm headers are absent on normal responses and present on the
 *     debug-flag-on path.
 */

import { describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { shouldEmitDiagnostics } from '../api/optimized-documents';
import {
  safeHeaderValue,
  safeJsonHeaderValue,
} from '../utils/safe-header';

describe('shouldEmitDiagnostics', () => {
  it('returns false when there is no authenticated user', () => {
    expect(shouldEmitDiagnostics({ query: { debug: '1' } })).toBe(false);
    expect(shouldEmitDiagnostics({ user: null, query: { debug: '1' } })).toBe(false);
  });

  it('returns false for non-admin roles even with the debug flag set', () => {
    for (const role of ['manager', 'demo_manager', 'resident', 'tenant', 'unknown']) {
      expect(
        shouldEmitDiagnostics({ user: { role }, query: { debug: '1' } })
      ).toBe(false);
    }
  });

  it('returns false for admins without the debug flag', () => {
    expect(shouldEmitDiagnostics({ user: { role: 'admin' }, query: {} })).toBe(false);
    expect(
      shouldEmitDiagnostics({ user: { role: 'admin' }, query: { debug: '0' } })
    ).toBe(false);
    expect(
      shouldEmitDiagnostics({ user: { role: 'admin' }, query: { debug: 'false' } })
    ).toBe(false);
    expect(
      shouldEmitDiagnostics({ user: { role: 'admin' }, query: { debug: 'yes' } })
    ).toBe(false);
  });

  it('returns true for admins with debug=1 or debug=true', () => {
    expect(
      shouldEmitDiagnostics({ user: { role: 'admin' }, query: { debug: '1' } })
    ).toBe(true);
    expect(
      shouldEmitDiagnostics({ user: { role: 'admin' }, query: { debug: 'true' } })
    ).toBe(true);
  });
});

describe('Optimized download diagnostic headers (Task #398)', () => {
  /**
   * Mirrors the post-Task-#398 emission block in
   * `server/api/optimized-documents.ts` so a regression that re-leaks the
   * headers (or breaks the debug-flag opt-in) surfaces here.
   */
  function makeApp() {
    const app = express();
    app.get('/download', (req: any, res) => {
      // Pretend we resolved a user from auth.
      const role = (req.query.role as string) || 'resident';
      req.user = { id: 'u1', role };

      res.setHeader('Content-Type', 'application/pdf');

      const responseTime = 1.23;
      const fromCache = true;
      const performanceMetrics = { reads: 1, bytes: 42 };

      if (shouldEmitDiagnostics(req)) {
        res.setHeader('X-Performance-Optimized', 'true');
        res.setHeader('X-Cache-Hit', fromCache ? 'true' : 'false');
        res.setHeader(
          'X-Response-Time',
          safeHeaderValue(`${responseTime.toFixed(2)}ms`, '0ms')
        );
        res.setHeader(
          'X-Storage-Metrics',
          safeJsonHeaderValue(performanceMetrics)
        );
      }

      res.send('payload');
    });
    return app;
  }

  const DIAGNOSTIC_HEADERS = [
    'x-performance-optimized',
    'x-cache-hit',
    'x-response-time',
    'x-storage-metrics',
  ];

  it('omits all diagnostic headers on a normal (non-admin) response', async () => {
    const r = await request(makeApp()).get('/download').query({ role: 'resident' });
    expect(r.status).toBe(200);
    for (const h of DIAGNOSTIC_HEADERS) {
      expect(r.headers[h]).toBeUndefined();
    }
  });

  it('omits diagnostic headers for managers even with debug=1', async () => {
    const r = await request(makeApp())
      .get('/download')
      .query({ role: 'manager', debug: '1' });
    expect(r.status).toBe(200);
    for (const h of DIAGNOSTIC_HEADERS) {
      expect(r.headers[h]).toBeUndefined();
    }
  });

  it('omits diagnostic headers for admins without the debug flag', async () => {
    const r = await request(makeApp()).get('/download').query({ role: 'admin' });
    expect(r.status).toBe(200);
    for (const h of DIAGNOSTIC_HEADERS) {
      expect(r.headers[h]).toBeUndefined();
    }
  });

  it('emits all diagnostic headers for admins with ?debug=1', async () => {
    const r = await request(makeApp())
      .get('/download')
      .query({ role: 'admin', debug: '1' });
    expect(r.status).toBe(200);
    expect(r.headers['x-performance-optimized']).toBe('true');
    expect(r.headers['x-cache-hit']).toBe('true');
    expect(r.headers['x-response-time']).toBe('1.23ms');
    expect(r.headers['x-storage-metrics']).toBe('{"reads":1,"bytes":42}');
  });

  it('also accepts ?debug=true as the opt-in value', async () => {
    const r = await request(makeApp())
      .get('/download')
      .query({ role: 'admin', debug: 'true' });
    expect(r.status).toBe(200);
    expect(r.headers['x-performance-optimized']).toBe('true');
  });
});
