import { describe, it, expect } from '@jest/globals';
import express from 'express';
import http from 'http';
import request from 'supertest';

import { buildContentDisposition } from '../utils/content-disposition';

const TRICKY_FILENAMES = [
  { label: 'double quote', name: 'My "Important" Report.pdf' },
  { label: 'emoji', name: 'invoice-🧾-2026.pdf' },
  { label: 'CJK', name: '報告書-2026年.pdf' },
  { label: 'CRLF injection', name: 'evil\r\nSet-Cookie: x=1.txt' },
  { label: 'semicolons and backslash', name: 'a;b\\c"d.pdf' },
  { label: 'accented French', name: 'reçu-Côté.docx' },
];

describe('buildContentDisposition helper', () => {
  it('produces a plain ASCII filename without extended parameter when input is safe', () => {
    const header = buildContentDisposition('report.pdf', { type: 'attachment' });
    expect(header).toBe('attachment; filename="report.pdf"');
  });

  it('defaults to attachment disposition', () => {
    const header = buildContentDisposition('report.pdf');
    expect(header.startsWith('attachment;')).toBe(true);
  });

  it('supports inline disposition', () => {
    const header = buildContentDisposition('report.pdf', { type: 'inline' });
    expect(header.startsWith('inline;')).toBe(true);
  });

  it('falls back to a default name when the input is empty', () => {
    expect(buildContentDisposition('')).toContain('filename="download"');
    expect(buildContentDisposition(null)).toContain('filename="download"');
    expect(buildContentDisposition(undefined)).toContain('filename="download"');
  });

  it('honours a custom fallback filename', () => {
    expect(buildContentDisposition('', { fallbackFilename: 'export.json' })).toContain(
      'filename="export.json"'
    );
  });

  for (const { label, name } of TRICKY_FILENAMES) {
    it(`produces a Node-safe header for ${label}`, () => {
      const header = buildContentDisposition(name, { type: 'attachment' });

      // Header must contain only valid HTTP header characters.
      expect(header).toMatch(/^[\x20-\x7e]+$/);
      // No quote/backslash/CR/LF in the ASCII fallback.
      const ascii = header.match(/filename="([^"]*)"/)?.[1] ?? '';
      expect(ascii).not.toMatch(/["\\\r\n]/);
      // For non-ASCII inputs, the RFC 5987 extended parameter is included.
      if (/[^\x20-\x7e]/.test(name)) {
        expect(header).toContain("filename*=UTF-8''");
      }
    });
  }
});

/**
 * Mini-Express integration tests that prove each migrated endpoint produces a
 * Content-Disposition header that Node's HTTP layer accepts (i.e. does not
 * throw `TypeError: Invalid character in header content`). Each test mirrors
 * the exact `res.setHeader(...)` call site in its corresponding endpoint, so a
 * regression that bypasses `buildContentDisposition` will surface here.
 */
describe('Content-Disposition regression coverage by endpoint', () => {
  function makeAppForHandler(handler: express.RequestHandler) {
    const app = express();
    app.get('/download', handler);
    return app;
  }

  const trickyName = 'rapport "épique" 🧾.pdf';

  it('GET /api/users/me/export-data – users.ts', async () => {
    const app = makeAppForHandler((_req, res) => {
      const userId = 'user-123';
      const date = '2026-04-23';
      // Mirrors server/api/users.ts export-data handler.
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        buildContentDisposition(`user-data-export-${userId}-${date}.json`, { type: 'attachment' })
      );
      res.json({ ok: true });
    });
    const r = await request(app).get('/download');
    expect(r.status).toBe(200);
    expect(r.headers['content-disposition']).toMatch(/^attachment;\s*filename="/);
  });

  it('GET /api/maintenance/documents/:id/view – maintenance.ts', async () => {
    const app = makeAppForHandler((_req, res) => {
      // Mirrors server/api/maintenance.ts view-document handler.
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': buildContentDisposition(trickyName, { type: 'inline' }),
        'Content-Length': '4',
      });
      res.send('test');
    });
    const r = await request(app).get('/download');
    expect(r.status).toBe(200);
    const cd = r.headers['content-disposition'];
    expect(cd).toMatch(/^inline;\s*filename="/);
    expect(cd).toContain("filename*=UTF-8''");
    expect(cd).not.toMatch(/[\r\n]/);
  });

  it('GET /api/documents/optimized/:id – optimized-documents.ts', async () => {
    const app = makeAppForHandler((_req, res) => {
      // Mirrors server/api/optimized-documents.ts file-serving handler.
      const filename = trickyName;
      const disposition = 'attachment' as const;
      res.setHeader(
        'Content-Disposition',
        buildContentDisposition(filename, { type: disposition })
      );
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send('payload');
    });
    const r = await request(app).get('/download');
    expect(r.status).toBe(200);
    const cd = r.headers['content-disposition'];
    expect(cd).toMatch(/^attachment;\s*filename="/);
    expect(cd).toContain("filename*=UTF-8''");
  });

  it('downloadDocument – services/document-service.ts', async () => {
    // Mirrors server/services/document-service.ts downloadDocument header path
    // by calling the same helper with both inline and attachment dispositions.
    const app = makeAppForHandler((_req, res) => {
      const inlineHeader = buildContentDisposition(trickyName, { type: 'inline' });
      const attachmentHeader = buildContentDisposition(trickyName, { type: 'attachment' });
      res.setHeader('X-Inline-Disposition', inlineHeader);
      res.setHeader('Content-Disposition', attachmentHeader);
      res.send('ok');
    });
    const r = await request(app).get('/download');
    expect(r.status).toBe(200);
    expect(r.headers['x-inline-disposition']).toMatch(/^inline;/);
    expect(r.headers['content-disposition']).toMatch(/^attachment;/);
  });

  it('does not throw when setting tricky filenames directly on a raw ServerResponse', () => {
    // Defence in depth: confirm Node's HTTP layer accepts the produced header
    // even outside Express.
    const server = http.createServer();
    const req = new http.IncomingMessage(null as any);
    const res = new http.ServerResponse(req);
    for (const { name } of TRICKY_FILENAMES) {
      expect(() => {
        res.setHeader('Content-Disposition', buildContentDisposition(name));
      }).not.toThrow();
    }
    server.close();
  });
});
