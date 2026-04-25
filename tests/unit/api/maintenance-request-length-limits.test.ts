import { describe, it, expect } from '@jest/globals';
import {
  insertMaintenanceRequestSchema,
  MAINTENANCE_TITLE_MAX,
  MAINTENANCE_DESCRIPTION_MAX,
} from '@shared/schemas/operations';

const RESIDENCE_ID = '11111111-1111-1111-1111-111111111111';

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    residenceId: RESIDENCE_ID,
    title: 'Valid title',
    description: 'A valid description for this maintenance request.',
    category: 'general' as const,
    priority: 'medium',
    ...overrides,
  };
}

describe('insertMaintenanceRequestSchema length limits (Task #976)', () => {
  describe('title', () => {
    it('accepts a 200-character title', () => {
      const result = insertMaintenanceRequestSchema.safeParse(
        basePayload({ title: 'a'.repeat(200) })
      );
      expect(result.success).toBe(true);
    });

    it('rejects a 201-character title with a clear error', () => {
      const result = insertMaintenanceRequestSchema.safeParse(
        basePayload({ title: 'a'.repeat(201) })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'title');
        expect(issue).toBeDefined();
        expect(issue?.code).toBe('too_big');
        expect(issue?.message).toMatch(/200/);
      }
    });

    it('strips leading/trailing whitespace before the length check (padded 200-char title is accepted)', () => {
      const result = insertMaintenanceRequestSchema.safeParse(
        basePayload({ title: '   ' + 'a'.repeat(200) + '   ' })
      );
      expect(result.success).toBe(true);
    });

    it('rejects a 201-char title even when padded with surrounding spaces', () => {
      const result = insertMaintenanceRequestSchema.safeParse(
        basePayload({ title: ' ' + 'a'.repeat(201) + ' ' })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'title');
        expect(issue).toBeDefined();
        expect(issue?.code).toBe('too_big');
      }
    });

    it('MAINTENANCE_TITLE_MAX constant equals 200', () => {
      expect(MAINTENANCE_TITLE_MAX).toBe(200);
    });
  });

  describe('description', () => {
    it('accepts a 5000-character description', () => {
      const result = insertMaintenanceRequestSchema.safeParse(
        basePayload({ description: 'b'.repeat(5000) })
      );
      expect(result.success).toBe(true);
    });

    it('rejects a 5001-character description with a clear error', () => {
      const result = insertMaintenanceRequestSchema.safeParse(
        basePayload({ description: 'b'.repeat(5001) })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'description');
        expect(issue).toBeDefined();
        expect(issue?.code).toBe('too_big');
        expect(issue?.message).toMatch(/5000/);
      }
    });

    it('strips leading/trailing whitespace before the length check (padded 5000-char description is accepted)', () => {
      const result = insertMaintenanceRequestSchema.safeParse(
        basePayload({ description: '   ' + 'b'.repeat(5000) + '   ' })
      );
      expect(result.success).toBe(true);
    });

    it('rejects a 5001-char description even when padded with surrounding spaces', () => {
      const result = insertMaintenanceRequestSchema.safeParse(
        basePayload({ description: ' ' + 'b'.repeat(5001) + ' ' })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'description');
        expect(issue).toBeDefined();
        expect(issue?.code).toBe('too_big');
      }
    });

    it('MAINTENANCE_DESCRIPTION_MAX constant equals 5000', () => {
      expect(MAINTENANCE_DESCRIPTION_MAX).toBe(5000);
    });
  });
});
