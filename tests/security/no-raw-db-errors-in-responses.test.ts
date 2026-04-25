/**
 * Static grep acceptance test: No raw DB errors in REST 500 responses
 *
 * Verifies that the REST API handler files in server/api/ do not expose
 * raw error.message values in HTTP 500 response bodies.
 *
 * Raw error messages from the database (e.g. Drizzle "Failed query: select ...")
 * are an information-disclosure risk. The patterns below represent the exact
 * anti-patterns that were present before the fix; this test guards against
 * regression.
 */

import fs from 'fs';
import path from 'path';
import { describe, it, expect } from '@jest/globals';

const API_DIR = path.resolve(__dirname, '../../server/api');

function read(filename: string): string {
  return fs.readFileSync(path.join(API_DIR, filename), 'utf-8');
}

describe('No raw DB errors in REST API 500 responses', () => {
  it('bills.ts must not expose error.message via ternary in HTTP responses', () => {
    const src = read('bills.ts');
    expect(src).not.toMatch(/_error instanceof Error \? _error\.message/);
    expect(src).not.toMatch(/error instanceof Error \? error\.message : ['"]Unknown error['"]/);
  });

  it('invoices.ts must not expose error.message in 500 response bodies', () => {
    const src = read('invoices.ts');
    const lines = src.split('\n');
    const violations: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/error\.message/.test(line)) continue;
      if (/logWarn|logError|logSecurity|console\.|\/\/|error\.message\.includes|error\.message ===/.test(line)) continue;
      const isIn500Block = lines.slice(Math.max(0, i - 5), i).some(
        (l) => /res\.status\(5\d\d\)/.test(l) || /res\.status(500)/.test(l)
      );
      if (isIn500Block) {
        violations.push(`  Line ${i + 1}: ${line.trim()}`);
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('residences.ts must not expose error.message in HTTP responses', () => {
    const src = read('residences.ts');
    expect(src).not.toMatch(/error:\s+error\.message\s*[,}]/);
    expect(src).not.toMatch(/message:\s+error\.message\s*[,}]/);
  });

  it('trial-request.ts must not expose error.message in HTTP responses', () => {
    const src = read('trial-request.ts');
    const lines = src.split('\n');
    const violations: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/error\.message/.test(line)) continue;
      if (/logWarn|logError|logSecurity|console\.|\/\/|\.includes|===/.test(line)) continue;
      if (/res\.status\(/.test(line) || lines.slice(Math.max(0, i - 3), i).some((l) => /res\.status\(5/.test(l))) {
        violations.push(`  Line ${i + 1}: ${line.trim()}`);
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('documents.ts must not expose error.message in 500 HTTP response bodies', () => {
    const src = read('documents.ts');
    const lines = src.split('\n');
    const violations: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/error\.message|documentsError\.message|_error\.message/.test(line)) continue;
      if (/logWarn|logError|logSecurity|logDocumentOperation|logSecurityEvent|console\.|\/\/|\.includes|===|errorEntry|const \w/.test(line)) continue;
      const windowStart = Math.max(0, i - 6);
      const window = lines.slice(windowStart, i);
      const isIn500Block = window.some((l) => /res\.status\(5/.test(l));
      const isInLogCall = window.some((l) => /logWarn\s*\(|logError\s*\(|logSecurity\s*\(|logDocumentOperation\s*\(|logSecurityEvent\s*\(/.test(l));
      if (isIn500Block && !isInLogCall) {
        violations.push(`  Line ${i + 1}: ${line.trim()}`);
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('migration-endpoints.ts must not expose error.message in 500 HTTP responses', () => {
    const src = read('migration-endpoints.ts');
    const lines = src.split('\n');
    const violations: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/error\.message/.test(line)) continue;
      if (/logWarn|logError|logSecurity|console\.|\/\/|\.includes|===/.test(line)) continue;
      const isIn500Block = lines.slice(Math.max(0, i - 6), i).some((l) => /res\.status\(5/.test(l));
      if (isIn500Block) {
        violations.push(`  Line ${i + 1}: ${line.trim()}`);
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('feature-management.ts must not expose error.message in 500 HTTP responses', () => {
    const src = read('feature-management.ts');
    const lines = src.split('\n');
    const violations: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/error\.message/.test(line)) continue;
      if (/logWarn|logError|logSecurity|console\.|\/\/|\.includes|===/.test(line)) continue;
      const isIn500Block = lines.slice(Math.max(0, i - 6), i).some((l) => /res\.status\(5/.test(l));
      if (isIn500Block) {
        violations.push(`  Line ${i + 1}: ${line.trim()}`);
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('delayed-updates.ts must not expose _error.message in 500 HTTP responses', () => {
    const src = read('delayed-updates.ts');
    const lines = src.split('\n');
    const violations: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/_error\.message|error\.message/.test(line)) continue;
      if (/logWarn|logError|logSecurity|console\.|\/\/|\.includes|===/.test(line)) continue;
      const isIn500Block = lines.slice(Math.max(0, i - 6), i).some((l) => /res\.status\(5/.test(l));
      if (isIn500Block) {
        violations.push(`  Line ${i + 1}: ${line.trim()}`);
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('communication.ts must not expose error.message in 500 HTTP response bodies', () => {
    const src = read('communication.ts');
    const lines = src.split('\n');
    const violations: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/error\.message/.test(line)) continue;
      if (/logWarn|logError|logSecurity|console\.|\/\/|\.includes|===/.test(line)) continue;
      const isIn500Block = lines.slice(Math.max(0, i - 6), i).some((l) => /res\.status\(5/.test(l));
      if (isIn500Block) {
        violations.push(`  Line ${i + 1}: ${line.trim()}`);
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('communication.ts must not expose error.message via details: in any HTTP response', () => {
    const src = read('communication.ts');
    expect(src).not.toMatch(/details:\s*error\.message/);
  });

  it('demo-management.ts must not expose error.message in 500 HTTP response bodies', () => {
    const src = read('demo-management.ts');
    const lines = src.split('\n');
    const violations: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/error\.message/.test(line)) continue;
      if (/logWarn|logError|logSecurity|console\.|\/\/|\.includes|===/.test(line)) continue;
      const isIn500Block = lines.slice(Math.max(0, i - 6), i).some((l) => /res\.status\(5/.test(l));
      if (isIn500Block) {
        violations.push(`  Line ${i + 1}: ${line.trim()}`);
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('common-spaces.ts must not expose error.message in 500 HTTP response bodies', () => {
    const src = read('common-spaces.ts');
    const lines = src.split('\n');
    const violations: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/error\.message/.test(line)) continue;
      if (/logWarn|logError|logSecurity|console\.|\/\/|\.includes|===/.test(line)) continue;
      const isIn500Block = lines.slice(Math.max(0, i - 6), i).some((l) => /res\.status\(5/.test(l));
      if (isIn500Block) {
        violations.push(`  Line ${i + 1}: ${line.trim()}`);
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('optimized-documents.ts must not expose error.message in 500 HTTP response bodies', () => {
    const src = read('optimized-documents.ts');
    const lines = src.split('\n');
    const violations: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/error\.message/.test(line)) continue;
      if (/logWarn|logError|logSecurity|console\.|\/\/|\.includes|===/.test(line)) continue;
      const isIn500Block = lines.slice(Math.max(0, i - 6), i).some((l) => /res\.status\(5/.test(l));
      if (isIn500Block) {
        violations.push(`  Line ${i + 1}: ${line.trim()}`);
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('company-history.ts must not expose _error.message or error.message in 500 HTTP responses', () => {
    const src = read('company-history.ts');
    const lines = src.split('\n');
    const violations: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/_error\.message|error\.message/.test(line)) continue;
      if (/logWarn|logError|logSecurity|console\.|\/\/|\.includes|===/.test(line)) continue;
      const isIn500Block = lines.slice(Math.max(0, i - 6), i).some((l) => /res\.status\(5/.test(l));
      if (isIn500Block) {
        violations.push(`  Line ${i + 1}: ${line.trim()}`);
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('dynamic-budgets.ts must not expose error.message via the per-building _error field', () => {
    const src = read('dynamic-budgets.ts');
    // The per-building error result inside the .map() catch block is returned
    // straight through to the client in the `failed` array, so the raw DB
    // text must never be assigned to its _error field.
    expect(src).not.toMatch(/_error:\s*error\s+instanceof\s+Error\s*\?\s*error\.message/);
    expect(src).not.toMatch(/_error:\s*_error\s+instanceof\s+Error\s*\?\s*_error\.message/);
  });

  it('dynamic-budgets.ts must not expose error.message in 5xx HTTP response bodies', () => {
    const src = read('dynamic-budgets.ts');
    const lines = src.split('\n');
    const violations: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/_error\.message|error\.message/.test(line)) continue;
      if (/logWarn|logError|logSecurity|console\.|\/\/|\.includes|===/.test(line)) continue;
      const isIn500Block = lines.slice(Math.max(0, i - 6), i).some((l) => /res\.status\(5/.test(l));
      if (isIn500Block) {
        violations.push(`  Line ${i + 1}: ${line.trim()}`);
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('secureErrorHandler must contain the SQL-leak scrub backstop', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../server/middleware/error-security.ts'),
      'utf-8'
    );
    expect(src).toContain('scrubSqlFromPayload');
    expect(src).toContain('Failed query');
    expect(src).toContain('select "');
  });
});
