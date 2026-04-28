/**
 * @jest-environment node
 *
 * Task #1643 — Client-side dedupeLinkFamilies helper.
 *
 * Verifies the dedup pass for the main Link Families settings page:
 *   - Same normalized name → only one canonical row remains.
 *   - System family wins over org-scoped family with the same normalized name.
 *   - Among same-tier collisions, the oldest createdAt wins.
 *   - Lexicographic id breaks remaining ties.
 *   - Family name normalization is trim + casefold.
 *   - Unique normalized names pass through unchanged and order is preserved.
 */

import { describe, it, expect } from '@jest/globals';
import { dedupeLinkFamilies } from '../../../client/src/lib/dedupe-link-families';

describe('dedupeLinkFamilies', () => {
  it('keeps a single family per normalized name (trim + casefold)', () => {
    const families = [
      { id: 'a', name: 'Financial', isSystem: false, organizationId: 'org-1', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'b', name: '  financial ', isSystem: false, organizationId: 'org-1', createdAt: '2024-02-01T00:00:00Z' },
      { id: 'c', name: 'FINANCIAL', isSystem: false, organizationId: 'org-1', createdAt: '2024-03-01T00:00:00Z' },
    ];
    const result = dedupeLinkFamilies(families);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('prefers system family over org-scoped family with the same normalized name', () => {
    const families = [
      { id: 'org-old', name: 'AGA', isSystem: false, organizationId: 'org-1', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'sys-new', name: 'aga', isSystem: true, organizationId: null, createdAt: '2024-06-01T00:00:00Z' },
    ];
    const result = dedupeLinkFamilies(families);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('sys-new');
  });

  it('treats organizationId=null as system even when isSystem flag is false', () => {
    const families = [
      { id: 'org', name: 'Legal', isSystem: false, organizationId: 'org-1', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'global', name: 'Legal', isSystem: false, organizationId: null, createdAt: '2024-06-01T00:00:00Z' },
    ];
    const result = dedupeLinkFamilies(families);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('global');
  });

  it('among same-tier collisions, the oldest createdAt wins', () => {
    const families = [
      { id: 'newer', name: 'Maintenance', isSystem: false, organizationId: 'org-1', createdAt: new Date('2024-05-01') },
      { id: 'older', name: 'Maintenance', isSystem: false, organizationId: 'org-1', createdAt: new Date('2024-01-01') },
    ];
    const result = dedupeLinkFamilies(families);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('older');
  });

  it('breaks ties on identical createdAt with lexicographic id', () => {
    const ts = '2024-01-01T00:00:00Z';
    const families = [
      { id: 'b-id', name: 'Insurance', isSystem: false, organizationId: 'org-1', createdAt: ts },
      { id: 'a-id', name: 'Insurance', isSystem: false, organizationId: 'org-1', createdAt: ts },
    ];
    const result = dedupeLinkFamilies(families);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a-id');
  });

  it('treats missing createdAt as oldest-loses (so a row with createdAt wins)', () => {
    const families = [
      { id: 'no-ts', name: 'Safety', isSystem: false, organizationId: 'org-1', createdAt: null },
      { id: 'with-ts', name: 'Safety', isSystem: false, organizationId: 'org-1', createdAt: '2024-01-01T00:00:00Z' },
    ];
    const result = dedupeLinkFamilies(families);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('with-ts');
  });

  it('preserves input order for unique normalized names', () => {
    const families = [
      { id: 'a', name: 'Alpha', isSystem: false, organizationId: 'org-1', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'b', name: 'Bravo', isSystem: false, organizationId: 'org-1', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'c', name: 'Charlie', isSystem: false, organizationId: 'org-1', createdAt: '2024-01-01T00:00:00Z' },
    ];
    const result = dedupeLinkFamilies(families);
    expect(result.map((f) => f.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array for an empty input', () => {
    expect(dedupeLinkFamilies([])).toEqual([]);
  });
});
