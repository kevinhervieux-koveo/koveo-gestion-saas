/**
 * Task #1373 — `deriveFolderHintFromOriginalPath` extraction guard.
 *
 * The helper takes the persisted `originalPath` (which is either the
 * sanitized webkitRelativePath or the bare filename fallback) and
 * returns the parent-folder portion in a normalised " / "-separated
 * form, suitable for inlining into the analyzer prompts as a soft
 * AI hint. The companion analyzer-side test verifies the prompt
 * formatting; this file pins the path-extraction edge cases so a
 * future refactor cannot quietly change what the AI sees.
 */
import { describe, it, expect } from '@jest/globals';
import { deriveFolderHintFromOriginalPath } from '../../../server/api/bulk-import';

describe('deriveFolderHintFromOriginalPath (Task #1373)', () => {
  it('returns null when input is null, undefined, or empty', () => {
    expect(deriveFolderHintFromOriginalPath(null)).toBeNull();
    expect(deriveFolderHintFromOriginalPath(undefined)).toBeNull();
    expect(deriveFolderHintFromOriginalPath('')).toBeNull();
    expect(deriveFolderHintFromOriginalPath('   ')).toBeNull();
  });

  it('returns null for a bare filename with no parent folder', () => {
    expect(deriveFolderHintFromOriginalPath('lease.pdf')).toBeNull();
  });

  it('returns the single parent folder for a one-deep relative path', () => {
    expect(deriveFolderHintFromOriginalPath('2024 bills/january.pdf')).toBe(
      '2024 bills',
    );
  });

  it('joins multiple parent folders with " / " preserving order', () => {
    expect(
      deriveFolderHintFromOriginalPath('2024 bills/january/invoice.pdf'),
    ).toBe('2024 bills / january');
  });

  it('normalises Windows-style backslash separators to " / "', () => {
    expect(
      deriveFolderHintFromOriginalPath('2024 bills\\january\\invoice.pdf'),
    ).toBe('2024 bills / january');
  });

  it('collapses repeated and mixed separators', () => {
    expect(
      deriveFolderHintFromOriginalPath('a//b\\\\c///doc.pdf'),
    ).toBe('a / b / c');
  });
});
