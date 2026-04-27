/**
 * Unit tests for the bulk-import KPI outcome classifiers (Task #1411).
 *
 * `classifyAiAcceptOutcome` is shared by every metric that compares
 * one AI suggestion to one admin-final string (filename, residence
 * id, branch destination, effective date). `classifyTagSuggestionOutcome`
 * is the set-equality variant used by the tag-suggestion metric.
 *
 * These tests pin down the exact 5-outcome vocabulary so the
 * dashboard's per-(language, branch) breakdown never silently drops
 * a row when we add a new metric.
 */

// Stub out the `db` import inside server/services/kpi.ts so loading
// the module doesn't try to open a real Postgres connection. Only
// classifier exports are exercised here; aggregator queries are
// covered separately by integration tests.
jest.mock('../../../server/db', () => ({
  db: {
    insert: jest.fn(),
    select: jest.fn(),
  },
}));
jest.mock('../../../server/utils/logger', () => ({
  logWarn: jest.fn(),
}));

import {
  classifyAiAcceptOutcome,
  classifyFilenameSuggestionOutcome,
  classifyTagSuggestionOutcome,
} from '../../../server/services/kpi';

describe('classifyAiAcceptOutcome', () => {
  it('returns "verbatim" when AI suggested X and admin saved exactly X', () => {
    expect(classifyAiAcceptOutcome('Invoice 2024.pdf', 'Invoice 2024.pdf'))
      .toBe('verbatim');
    // UUID-shape inputs (residence pick / tag id) work the same way.
    expect(
      classifyAiAcceptOutcome(
        '8a3c0c7e-1a2b-4c8d-9f1f-1234567890ab',
        '8a3c0c7e-1a2b-4c8d-9f1f-1234567890ab',
      ),
    ).toBe('verbatim');
  });

  it('treats trailing/leading whitespace as identity (no spurious "edited")', () => {
    expect(classifyAiAcceptOutcome('Roof inspection', '  Roof inspection  '))
      .toBe('verbatim');
  });

  it('returns "edited" when AI suggested X and admin saved a different non-empty value', () => {
    expect(classifyAiAcceptOutcome('Invoice 2024.pdf', 'Invoice 2024 (final).pdf'))
      .toBe('edited');
    // residence override
    expect(
      classifyAiAcceptOutcome(
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      ),
    ).toBe('edited');
  });

  it('returns "cleared" when AI suggested something and admin cleared the field', () => {
    expect(classifyAiAcceptOutcome('2024-04-01', null)).toBe('cleared');
    expect(classifyAiAcceptOutcome('2024-04-01', '')).toBe('cleared');
    expect(classifyAiAcceptOutcome('2024-04-01', '   ')).toBe('cleared');
  });

  it('returns "manual_no_suggestion" when AI offered nothing but admin filled it in', () => {
    expect(classifyAiAcceptOutcome(null, 'building_documents'))
      .toBe('manual_no_suggestion');
    expect(classifyAiAcceptOutcome(undefined, 'residence_documents'))
      .toBe('manual_no_suggestion');
    expect(classifyAiAcceptOutcome('', '2024-01-01'))
      .toBe('manual_no_suggestion');
    expect(classifyAiAcceptOutcome('   ', '2024-01-01'))
      .toBe('manual_no_suggestion');
  });

  it('returns "empty_no_suggestion" when neither AI nor admin produced a value', () => {
    expect(classifyAiAcceptOutcome(null, null)).toBe('empty_no_suggestion');
    expect(classifyAiAcceptOutcome(undefined, undefined))
      .toBe('empty_no_suggestion');
    expect(classifyAiAcceptOutcome('', '')).toBe('empty_no_suggestion');
    expect(classifyAiAcceptOutcome('  ', '')).toBe('empty_no_suggestion');
  });

  it('exposes a backwards-compatible `classifyFilenameSuggestionOutcome` alias', () => {
    // The original Task #1406 export name still works so existing
    // call sites and mocks (e.g. set-sorting-decision route) don't
    // have to change.
    expect(classifyFilenameSuggestionOutcome).toBe(classifyAiAcceptOutcome);
  });
});

describe('classifyTagSuggestionOutcome', () => {
  const A = '11111111-1111-1111-1111-111111111111';
  const B = '22222222-2222-2222-2222-222222222222';
  const C = '33333333-3333-3333-3333-333333333333';

  it('returns "verbatim" when AI and admin saved the same set (order ignored)', () => {
    expect(classifyTagSuggestionOutcome([A, B], [B, A])).toBe('verbatim');
    expect(classifyTagSuggestionOutcome([A], [A])).toBe('verbatim');
  });

  it('returns "edited" when both sets are non-empty but differ in any element', () => {
    expect(classifyTagSuggestionOutcome([A, B], [A, C])).toBe('edited');
    // size-only difference
    expect(classifyTagSuggestionOutcome([A, B], [A])).toBe('edited');
    expect(classifyTagSuggestionOutcome([A], [A, B])).toBe('edited');
  });

  it('returns "cleared" when AI suggested ≥1 tag but admin saved none', () => {
    expect(classifyTagSuggestionOutcome([A, B], [])).toBe('cleared');
    expect(classifyTagSuggestionOutcome([A], null)).toBe('cleared');
    expect(classifyTagSuggestionOutcome([A], undefined)).toBe('cleared');
  });

  it('returns "manual_no_suggestion" when AI suggested no tags but admin saved some', () => {
    expect(classifyTagSuggestionOutcome([], [A])).toBe('manual_no_suggestion');
    expect(classifyTagSuggestionOutcome(null, [A, B]))
      .toBe('manual_no_suggestion');
    expect(classifyTagSuggestionOutcome(undefined, [A]))
      .toBe('manual_no_suggestion');
  });

  it('returns "empty_no_suggestion" when both sides are empty', () => {
    expect(classifyTagSuggestionOutcome([], [])).toBe('empty_no_suggestion');
    expect(classifyTagSuggestionOutcome(null, null))
      .toBe('empty_no_suggestion');
    expect(classifyTagSuggestionOutcome(undefined, undefined))
      .toBe('empty_no_suggestion');
  });

  it('ignores empty-string and non-string entries when comparing sets', () => {
    // Defensive: stale storage rows occasionally contain empty strings
    // alongside real UUIDs. Those should never push a "verbatim" into
    // "edited" territory.
    expect(classifyTagSuggestionOutcome([A, ''], [A])).toBe('verbatim');
    expect(classifyTagSuggestionOutcome([A], [A, ''])).toBe('verbatim');
    expect(
      classifyTagSuggestionOutcome(
        [A, null as unknown as string],
        [A],
      ),
    ).toBe('verbatim');
  });
});
