import { describe, it, expect } from '@jest/globals';
import { buildDeleteErrorResponse, buildWriteErrorResponse } from '../../../server/mcp/server';

const SQL_LEAK_PATTERNS = [
  /select\s/i,
  /delete\s+from/i,
  /insert\s+into/i,
  /update\s+/i,
  /\$\d+/,
  /Key \(/i,
  /pg_/i,
];

function assertNoSqlLeak(text: string): void {
  for (const pattern of SQL_LEAK_PATTERNS) {
    expect(text).not.toMatch(pattern);
  }
}

describe('buildDeleteErrorResponse', () => {
  describe('PostgreSQL FK violation (code 23503)', () => {
    it('maps a "residences" FK violation to a structured fk_violation response with no SQL leakage', () => {
      const detail =
        'Key (id)=(00000000-0000-0000-0000-000000000001) is still referenced from table "residences".';
      const fkError = Object.assign(new Error('insert or update on table "buildings" violates foreign key constraint'), {
        code: '23503',
        detail,
        // Intentionally inject driver-style fields that MUST NOT leak.
        query: 'DELETE FROM buildings WHERE id = $1',
        parameters: ['00000000-0000-0000-0000-000000000001'],
      });

      const result = buildDeleteErrorResponse(fkError, 'building');

      expect(result.content).toHaveLength(1);
      const text = result.content[0].text;

      const parsed = JSON.parse(text);
      expect(parsed.status).toBe('fk_violation');
      expect(parsed.code).toBe('FK_VIOLATION');
      expect(parsed.blocking_entity).toBe('residence');
      expect(parsed.message).toContain('Cannot delete building');
      expect(parsed.message).toContain('residence');

      // The original PostgreSQL detail string MUST NOT appear in the response.
      expect(text).not.toContain(detail);
      expect(text).not.toContain('00000000-0000-0000-0000-000000000001');
      expect(text).not.toContain('buildings');
      assertNoSqlLeak(text);
    });

    it('maps a "scheduled_payments" FK violation to a human-readable "scheduled payment" message', () => {
      const detail =
        'Key (id)=(11111111-1111-1111-1111-111111111111) is still referenced from table "scheduled_payments".';
      const fkError = Object.assign(new Error('FK violation'), {
        code: '23503',
        detail,
        query: 'DELETE FROM bills WHERE id = $1',
        parameters: ['11111111-1111-1111-1111-111111111111'],
      });

      const result = buildDeleteErrorResponse(fkError, 'bill');
      const text = result.content[0].text;
      const parsed = JSON.parse(text);

      expect(parsed.status).toBe('fk_violation');
      expect(parsed.blocking_entity).toBe('scheduled_payment');
      // The human-readable message should use the spaced form, not the raw table name.
      expect(parsed.message).toContain('scheduled payment');
      expect(parsed.message).not.toContain('scheduled_payments');
      expect(parsed.message).not.toContain('scheduled_payment ');

      // No SQL/driver leakage.
      expect(text).not.toContain(detail);
      expect(text).not.toContain('11111111-1111-1111-1111-111111111111');
      assertNoSqlLeak(text);
    });

    it('falls back to "related_record" when the FK detail cannot be parsed', () => {
      const fkError = Object.assign(new Error('FK violation'), {
        code: '23503',
        detail: 'unparseable detail without a referenced-from-table phrase',
      });

      const result = buildDeleteErrorResponse(fkError, 'building');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe('fk_violation');
      expect(parsed.blocking_entity).toBe('related_record');
      expect(parsed.message).toContain('Cannot delete building');
      expect(parsed.message).toContain('other records');
    });
  });

  describe('non-FK errors', () => {
    it('returns the generic fallback string and never echoes the original error message', () => {
      const err = new Error('boom with secret SQL: DELETE FROM users WHERE password = $1');

      const result = buildDeleteErrorResponse(err, 'building');
      const text = result.content[0].text;

      expect(text).toBe('Failed to delete building — please retry');
      expect(text).not.toContain('boom');
      expect(text).not.toContain('secret');
      assertNoSqlLeak(text);
    });

    it('returns the generic fallback for null/undefined errors without throwing', () => {
      for (const candidate of [null, undefined, 'just a string', 42]) {
        const result = buildDeleteErrorResponse(candidate, 'bill');
        expect(result.content[0].text).toBe('Failed to delete bill — please retry');
      }
    });

    it('maps a 23505 unique-violation to a structured unique_violation response with no leakage', () => {
      const err = Object.assign(new Error('duplicate key value violates unique constraint "users_email_key"'), {
        code: '23505',
        detail: 'Key (email)=(secret@example.com) already exists.',
      });

      const result = buildDeleteErrorResponse(err, 'residence');
      const text = result.content[0].text;
      const parsed = JSON.parse(text);

      expect(parsed.status).toBe('unique_violation');
      expect(parsed.code).toBe('UNIQUE_VIOLATION');
      expect(parsed.message).toContain('Cannot delete residence');
      expect(text).not.toContain('secret@example.com');
      expect(text).not.toContain('users_email_key');
      assertNoSqlLeak(text);
    });
  });
});

/**
 * Task #244 — `buildWriteErrorResponse` accepts the 'delete' action and
 * produces the same FK / unique-violation responses as the legacy
 * `buildDeleteErrorResponse`. New MCP delete tools should call it directly.
 */
describe("buildWriteErrorResponse(action='delete')", () => {
  it('produces the same FK-violation JSON as the legacy delete helper', () => {
    const detail =
      'Key (id)=(00000000-0000-0000-0000-000000000001) is still referenced from table "residences".';
    const fkError = Object.assign(new Error('FK violation'), {
      code: '23503',
      detail,
      query: 'DELETE FROM buildings WHERE id = $1',
      parameters: ['00000000-0000-0000-0000-000000000001'],
    });

    const result = buildWriteErrorResponse(fkError, 'building', 'delete');
    const text = result.content[0].text;
    const parsed = JSON.parse(text);

    expect(parsed.status).toBe('fk_violation');
    expect(parsed.blocking_entity).toBe('residence');
    expect(parsed.message).toContain('Cannot delete building');
    expect(parsed.message).toContain('residence');
    expect(parsed).not.toHaveProperty('referenced_entity');
    expect(text).not.toContain(detail);
    expect(text).not.toContain('00000000-0000-0000-0000-000000000001');
    assertNoSqlLeak(text);
  });

  it('emits a delete-specific unique_violation message for code 23505', () => {
    const err = Object.assign(new Error('duplicate key value violates unique constraint "x_key"'), {
      code: '23505',
      detail: 'Key (col)=(secret-value) already exists.',
    });

    const result = buildWriteErrorResponse(err, 'meeting', 'delete');
    const text = result.content[0].text;
    const parsed = JSON.parse(text);

    expect(parsed.status).toBe('unique_violation');
    expect(parsed.code).toBe('UNIQUE_VIOLATION');
    expect(parsed.message).toContain('Cannot delete meeting');
    // Should NOT use the create/update phrasing.
    expect(parsed.message).not.toContain('same unique value already exists');
    expect(text).not.toContain('secret-value');
    expect(text).not.toContain('x_key');
    assertNoSqlLeak(text);
  });

  it('returns the delete-specific generic fallback for unknown errors', () => {
    const err = new Error('boom with secret SQL: DELETE FROM users WHERE password = $1');

    const result = buildWriteErrorResponse(err, 'demand', 'delete');
    const text = result.content[0].text;

    expect(text).toBe('Failed to delete demand — please retry');
    expect(text).not.toContain('boom');
    expect(text).not.toContain('secret');
    assertNoSqlLeak(text);
  });

  it("does NOT confuse a create-style FK detail with the delete pattern (no blocking_entity, generic message)", () => {
    // A delete-action code path should ignore "is not present in table" details
    // because that wording belongs to create/update FK failures.
    const fkError = Object.assign(new Error('FK violation'), {
      code: '23503',
      detail: 'Key (building_id)=(abc) is not present in table "buildings".',
    });

    const result = buildWriteErrorResponse(fkError, 'bill', 'delete');
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.status).toBe('fk_violation');
    expect(parsed.blocking_entity).toBe('related_record');
    expect(parsed.message).toContain('Cannot delete bill');
    expect(parsed.message).toContain('other records');
  });
});
