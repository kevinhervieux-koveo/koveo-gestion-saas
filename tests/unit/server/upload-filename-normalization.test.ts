/**
 * @jest-environment node
 *
 * Task #380: pin the shared upload-side filename normalization contract.
 */

import { describe, it, expect } from '@jest/globals';
import http from 'http';
import { AddressInfo } from 'net';

import { normalizeFilename } from '../../../server/utils/filenameNormalization';
import { buildContentDisposition } from '../../../server/utils/content-disposition';

const SAFE_NAME = /^[a-z0-9._-]+$/;

const trickyUploadNames: Array<{ label: string; input: string }> = [
  { label: 'double quotes', input: 'weird "quoted" name.pdf' },
  { label: 'single quotes', input: "it's a report.pdf" },
  { label: 'semicolons', input: 'a;b;c.pdf' },
  { label: 'backslashes', input: 'a\\b.pdf' },
  { label: 'forward slashes', input: 'reports/2026/q1.pdf' },
  { label: 'emoji', input: 'party-🎉.pdf' },
  { label: 'CJK characters', input: '報告書.pdf' },
  { label: 'Cyrillic characters', input: 'отчёт.pdf' },
  { label: 'French accents', input: 'reçu purlift 2025.pdf' },
  { label: 'control characters', input: 'bad\u0000name\u0007.pdf' },
  { label: 'leading/trailing whitespace', input: '   spaced   .pdf' },
  { label: 'angle brackets', input: '<script>.pdf' },
];

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

describe('upload-side filename normalization (Task #380)', () => {
  describe('normalizeFilename produces a safe DB/storage name', () => {
    for (const { label, input } of trickyUploadNames) {
      it(`normalizes ${label}: ${JSON.stringify(input)}`, () => {
        const normalized = normalizeFilename(input);
        expect(typeof normalized).toBe('string');
        expect(normalized.length).toBeGreaterThan(0);
        expect(normalized).toMatch(SAFE_NAME);
        for (const forbidden of ['"', "'", ';', '\\', '/', '<', '>', ' ', '\u0000']) {
          expect(normalized).not.toContain(forbidden);
        }
        expect(normalized.endsWith('.pdf')).toBe(true);
      });
    }
  });

  describe('normalized names survive a real Node HTTP round trip', () => {
    for (const { label, input } of trickyUploadNames) {
      it(`download header round-trips for ${label}`, async () => {
        const normalized = normalizeFilename(input);
        const header = buildContentDisposition(normalized, { type: 'attachment' });
        expect(/^[\x00-\x7f]*$/.test(header)).toBe(true);
        await expect(roundTripHeader(header)).resolves.toBe(header);
      });
    }
  });

  it('keeps already-safe filenames stable (idempotent)', () => {
    const safe = 'invoice-2026-04.pdf';
    expect(normalizeFilename(safe)).toBe(safe);
    expect(normalizeFilename(normalizeFilename(safe))).toBe(safe);
  });
});
