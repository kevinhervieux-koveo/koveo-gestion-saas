/**
 * @jest-environment node
 *
 * Unit tests for the RFC 6266 / RFC 5987 `Content-Disposition` builder
 * shared by `/api/documents/:id/file` and
 * `/api/documents/:id/optimized-file`.
 *
 * Task #376 — Make downloaded filenames safe for tricky characters
 * like quotes, semicolons, emoji, and CJK.
 */

import { describe, it, expect } from '@jest/globals';
import http from 'http';
import { AddressInfo } from 'net';

import { buildContentDisposition } from '../../../server/utils/content-disposition';

/**
 * Round-trip the value through Node's HTTP layer to prove it does not
 * throw `TypeError: Invalid character in header content` and that the
 * client receives the exact bytes we set.
 */
async function roundTripHeader(headerValue: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((_req, res) => {
      res.setHeader('Content-Disposition', headerValue);
      res.end('ok');
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      http
        .get({ host: '127.0.0.1', port }, (response) => {
          const received = response.headers['content-disposition'];
          response.resume();
          response.on('end', () => {
            server.close();
            if (typeof received !== 'string') {
              reject(new Error('No Content-Disposition header on response'));
              return;
            }
            resolve(received);
          });
        })
        .on('error', (err) => {
          server.close();
          reject(err);
        });
    });
  });
}

describe('buildContentDisposition', () => {
  it('passes through a plain ASCII filename unchanged', () => {
    const header = buildContentDisposition('invoice.pdf', { type: 'attachment' });
    expect(header).toBe('attachment; filename="invoice.pdf"');
  });

  it('escapes literal double quotes by replacing them with underscores', () => {
    const header = buildContentDisposition('weird "quoted" name.pdf', {
      type: 'attachment',
    });
    // Quotes are unsafe inside the quoted-string fallback. They get
    // replaced in the ASCII fallback and the original survives via the
    // RFC 5987 extended form.
    expect(header).toMatch(/^attachment; filename="[^"]*"; filename\*=UTF-8''/);
    expect(header).not.toContain('""');
    expect(header).toContain("filename*=UTF-8''weird%20%22quoted%22%20name.pdf");
  });

  it('escapes semicolons via the extended form', () => {
    // Although semicolons are technically legal inside a quoted-string,
    // some intermediaries and download managers treat them as parameter
    // separators and truncate the filename. We force the RFC 5987 form
    // so the original name still round-trips intact.
    const header = buildContentDisposition('a;b;c.txt', { type: 'attachment' });
    expect(header).toMatch(/^attachment; filename="[^";]*"; filename\*=UTF-8''/);
    expect(header).toContain("filename*=UTF-8''a%3Bb%3Bc.txt");
    // Ensure no raw semicolon survives inside the ASCII fallback.
    const fallback = header.match(/filename="([^"]*)"/)![1];
    expect(fallback).not.toContain(';');
  });

  it('escapes backslashes', () => {
    const header = buildContentDisposition('a\\b.txt', { type: 'attachment' });
    expect(header).toContain("filename*=UTF-8''a%5Cb.txt");
    expect(header).not.toMatch(/filename="[^"]*\\[^"]*"/);
  });

  it('encodes emoji via filename* and keeps a safe ASCII fallback', () => {
    const header = buildContentDisposition('party-🎉.pdf', { type: 'attachment' });
    expect(header).toContain("filename*=UTF-8''party-%F0%9F%8E%89.pdf");
    expect(header).toMatch(/^attachment; filename="party-_\.pdf"; /);
  });

  it('encodes CJK characters via filename*', () => {
    const header = buildContentDisposition('報告書.pdf', { type: 'inline' });
    expect(header.startsWith('inline; ')).toBe(true);
    expect(header).toContain("filename*=UTF-8''%E5%A0%B1%E5%91%8A%E6%9B%B8.pdf");
  });

  it('encodes Cyrillic characters via filename*', () => {
    const header = buildContentDisposition('отчёт.pdf', { type: 'attachment' });
    expect(header).toContain("filename*=UTF-8''%D0%BE%D1%82%D1%87%D1%91%D1%82.pdf");
  });

  it('falls back to "download" when the filename is empty', () => {
    const header = buildContentDisposition('', { type: 'attachment' });
    expect(header).toBe('attachment; filename="download"');
  });

  it('rejects unsafe disposition tokens and defaults to attachment', () => {
    const header = buildContentDisposition('file.txt', {
      type: 'inva lid' as unknown as 'attachment',
    });
    expect(header).toBe('attachment; filename="file.txt"');
  });

  it('preserves Latin-1 accented filenames via filename* (no Latin-1 in the raw header)', () => {
    const header = buildContentDisposition('héllo.pdf', { type: 'attachment' });
    // The ASCII fallback strips the accent; the original survives via
    // the encoded form. Critically, the header value is now pure ASCII
    // so Node will not throw at send-time.
    expect(/^[\x00-\x7f]*$/.test(header)).toBe(true);
    expect(header).toContain("filename*=UTF-8''h%C3%A9llo.pdf");
  });

  describe('HTTP round-trip (does not crash Node)', () => {
    const tricky = [
      'plain.pdf',
      'weird "quoted" name.pdf',
      'a;b;c.txt',
      'a\\b.txt',
      'party-🎉.pdf',
      '報告書.pdf',
      'отчёт.pdf',
      'héllo.pdf',
    ];

    for (const name of tricky) {
      it(`survives a real Node HTTP round trip for ${JSON.stringify(name)}`, async () => {
        const header = buildContentDisposition(name, { type: 'attachment' });
        await expect(roundTripHeader(header)).resolves.toBe(header);
      });
    }
  });
});
