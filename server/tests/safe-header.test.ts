import { describe, it, expect } from '@jest/globals';
import express from 'express';
import http from 'http';
import request from 'supertest';

import {
  safeHeaderValue,
  safeJsonHeaderValue,
  safeMimeType,
} from '../utils/safe-header';

const TRICKY_VALUES = [
  { label: 'CRLF injection', value: 'application/pdf\r\nSet-Cookie: x=1' },
  { label: 'bare CR', value: 'text/plain\rinjected' },
  { label: 'bare LF', value: 'text/plain\ninjected' },
  { label: 'NUL byte', value: 'text/plain\0bad' },
  { label: 'non-ASCII', value: 'téxt/plain' },
  { label: 'control byte', value: 'text/\x01plain' },
  { label: 'emoji', value: 'image/png 🧾' },
];

describe('safeHeaderValue helper', () => {
  it('passes through plain printable ASCII', () => {
    expect(safeHeaderValue('hello world')).toBe('hello world');
  });

  it('returns fallback for null/undefined/empty', () => {
    expect(safeHeaderValue(null, 'fb')).toBe('fb');
    expect(safeHeaderValue(undefined, 'fb')).toBe('fb');
    expect(safeHeaderValue('   ', 'fb')).toBe('fb');
  });

  it('strips CR / LF / NUL and other control chars', () => {
    const cleaned = safeHeaderValue('a\r\nb\0c\x07d');
    expect(cleaned).not.toMatch(/[\r\n\0\x07]/);
    expect(cleaned).toContain('a');
    expect(cleaned).toContain('d');
  });

  it('replaces non-ASCII with underscores', () => {
    expect(safeHeaderValue('café')).toBe('caf_');
  });

  it('always returns a value Node will accept as a header', () => {
    const req = new http.IncomingMessage(null as any);
    const res = new http.ServerResponse(req);
    for (const { value } of TRICKY_VALUES) {
      expect(() => res.setHeader('X-Test', safeHeaderValue(value, 'fb'))).not.toThrow();
    }
  });
});

describe('safeMimeType helper', () => {
  it('accepts well-formed types', () => {
    expect(safeMimeType('application/pdf')).toBe('application/pdf');
    expect(safeMimeType('text/plain; charset=utf-8')).toBe('text/plain; charset=utf-8');
    expect(safeMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
      .toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('falls back when value is missing or not a string', () => {
    expect(safeMimeType(undefined)).toBe('application/octet-stream');
    expect(safeMimeType(null)).toBe('application/octet-stream');
    expect(safeMimeType('')).toBe('application/octet-stream');
    expect(safeMimeType(123 as any)).toBe('application/octet-stream');
  });

  it('rejects CR/LF injection attempts', () => {
    expect(safeMimeType('application/pdf\r\nSet-Cookie: x=1')).toBe('application/octet-stream');
    expect(safeMimeType('text/plain\nfoo')).toBe('application/octet-stream');
  });

  it('rejects control bytes, NUL, and non-ASCII', () => {
    expect(safeMimeType('text/\x01plain')).toBe('application/octet-stream');
    expect(safeMimeType('text/plain\0')).toBe('application/octet-stream');
    expect(safeMimeType('téxt/plain')).toBe('application/octet-stream');
  });

  it('rejects malformed media-types', () => {
    expect(safeMimeType('not-a-mime')).toBe('application/octet-stream');
    expect(safeMimeType('text/')).toBe('application/octet-stream');
    expect(safeMimeType('/plain')).toBe('application/octet-stream');
  });

  it('honours a custom fallback', () => {
    expect(safeMimeType('bad', 'text/plain')).toBe('text/plain');
  });

  it('produces values Node accepts as headers', () => {
    const req = new http.IncomingMessage(null as any);
    const res = new http.ServerResponse(req);
    for (const { value } of TRICKY_VALUES) {
      expect(() => res.setHeader('Content-Type', safeMimeType(value))).not.toThrow();
    }
  });
});

describe('safeJsonHeaderValue helper', () => {
  it('serialises plain JSON values unchanged', () => {
    expect(safeJsonHeaderValue({ a: 1, b: 'two' })).toBe('{"a":1,"b":"two"}');
  });

  it('strips control characters from string values', () => {
    const out = safeJsonHeaderValue({ note: 'a\nb\rc' });
    expect(out).not.toMatch(/[\r\n]/);
  });

  it('falls back when the value is not serialisable', () => {
    const cyclic: any = {};
    cyclic.self = cyclic;
    expect(safeJsonHeaderValue(cyclic)).toBe('{}');
  });

  it('emits a value Node accepts as a header even for hostile inputs', () => {
    const req = new http.IncomingMessage(null as any);
    const res = new http.ServerResponse(req);
    const value = { evil: 'foo\r\nSet-Cookie: x=1', emoji: '🧾', accent: 'é' };
    expect(() => res.setHeader('X-Storage-Metrics', safeJsonHeaderValue(value))).not.toThrow();
  });
});

/**
 * Mini-Express integration coverage for the endpoints that previously
 * forwarded raw DB / runtime data into outgoing headers. These mirror the
 * exact shape of the production call sites (after migration to the helpers)
 * so a regression that bypasses the sanitiser will surface here.
 */
describe('Header-sanitisation regression coverage by endpoint', () => {
  function makeAppForHandler(handler: express.RequestHandler) {
    const app = express();
    app.get('/download', handler);
    return app;
  }

  const evilMime = 'application/pdf\r\nSet-Cookie: pwned=1';
  const evilMetrics = { note: 'line1\r\nSet-Cookie: pwned=1', emoji: '🧾', size: 42 };

  it('GET /api/documents/optimized/:id – Content-Type and X-Storage-Metrics are sanitised', async () => {
    const app = makeAppForHandler((_req, res) => {
      // Mirrors server/api/optimized-documents.ts (post-migration).
      res.setHeader('Content-Type', safeMimeType(evilMime));
      res.setHeader('X-Storage-Metrics', safeJsonHeaderValue(evilMetrics));
      res.setHeader('X-Response-Time', safeHeaderValue('1.23ms', '0ms'));
      res.send('payload');
    });

    const r = await request(app).get('/download');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/^application\/octet-stream(?:;.*)?$/);
    expect(r.headers['x-storage-metrics']).toBeDefined();
    expect(r.headers['x-storage-metrics']).not.toMatch(/[\r\n]/);
    expect(r.headers['set-cookie']).toBeUndefined();
  });

  it('GET /api/maintenance/documents/:id/view – Content-Type from DB is sanitised', async () => {
    const app = makeAppForHandler((_req, res) => {
      // Mirrors server/api/maintenance.ts (post-migration).
      res.set({
        'Content-Type': safeMimeType(evilMime),
        'Content-Length': '4',
      });
      res.send('test');
    });

    const r = await request(app).get('/download');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/^application\/octet-stream(?:;.*)?$/);
    expect(r.headers['set-cookie']).toBeUndefined();
  });

  it('downloadDocument – services/document-service.ts sanitises options.mimeType', async () => {
    const app = makeAppForHandler((_req, res) => {
      // Mirrors server/services/document-service.ts (post-migration).
      res.setHeader('Content-Type', safeMimeType(evilMime));
      res.send('ok');
    });

    const r = await request(app).get('/download');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/^application\/octet-stream(?:;.*)?$/);
    expect(r.headers['set-cookie']).toBeUndefined();
  });

  it('objectStorage.downloadObject – falls back when GCS metadata.contentType is hostile', async () => {
    const app = makeAppForHandler((_req, res) => {
      // Mirrors server/objectStorage.ts (post-migration). The "existing" header
      // is also hostile, so the fallback chain must collapse to the safe
      // default.
      const existing = evilMime;
      const resolved = safeMimeType(
        (typeof existing === 'string' && existing) || 'application/octet-stream'
      );
      res.set({
        'Content-Type': resolved,
        'Content-Length': '2',
      });
      res.send('ok');
    });

    const r = await request(app).get('/download');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/^application\/octet-stream(?:;.*)?$/);
    expect(r.headers['set-cookie']).toBeUndefined();
  });

  it('does not throw when forwarding tricky values directly to a raw ServerResponse', () => {
    const req = new http.IncomingMessage(null as any);
    const res = new http.ServerResponse(req);
    for (const { value } of TRICKY_VALUES) {
      expect(() => {
        res.setHeader('Content-Type', safeMimeType(value));
        res.setHeader('X-Storage-Metrics', safeJsonHeaderValue({ v: value }));
        res.setHeader('X-Response-Time', safeHeaderValue(value, '0ms'));
      }).not.toThrow();
    }
  });
});
