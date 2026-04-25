import { describe, it, expect } from '@jest/globals';
import { insertDemandSchema, DEMAND_DESCRIPTION_MAX } from '@shared/schemas/operations';

const BUILDING_ID = '11111111-1111-1111-1111-111111111111';

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'complaint' as const,
    buildingId: BUILDING_ID,
    description: 'This is a valid description with enough chars.',
    ...overrides,
  };
}

describe('insertDemandSchema length limits (Task #976)', () => {
  describe('description', () => {
    it('accepts a 5000-character description', () => {
      const result = insertDemandSchema.safeParse(
        basePayload({ description: 'a'.repeat(5000) })
      );
      expect(result.success).toBe(true);
    });

    it('rejects a 5001-character description with a clear error', () => {
      const result = insertDemandSchema.safeParse(
        basePayload({ description: 'a'.repeat(5001) })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'description');
        expect(issue).toBeDefined();
        expect(issue?.code).toBe('too_big');
        expect(issue?.message).toMatch(/5000/);
      }
    });

    it('strips leading/trailing whitespace before the length check (padded 5000-char body is accepted)', () => {
      const result = insertDemandSchema.safeParse(
        basePayload({ description: '   ' + 'a'.repeat(5000) + '   ' })
      );
      expect(result.success).toBe(true);
    });

    it('rejects a 5001-char body even when padded with surrounding spaces', () => {
      const result = insertDemandSchema.safeParse(
        basePayload({ description: ' ' + 'a'.repeat(5001) + ' ' })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'description');
        expect(issue).toBeDefined();
        expect(issue?.code).toBe('too_big');
      }
    });

    it('DEMAND_DESCRIPTION_MAX constant equals 5000', () => {
      expect(DEMAND_DESCRIPTION_MAX).toBe(5000);
    });
  });
});
