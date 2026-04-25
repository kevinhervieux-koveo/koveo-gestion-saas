import { describe, it, expect } from '@jest/globals';
import { insertGeneralCommunicationSchema } from '@shared/schemas/operations';

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: ORG_ID,
    createdBy: USER_ID,
    title: 'A valid title',
    content: 'Some valid content body.',
    ...overrides,
  };
}

describe('insertGeneralCommunicationSchema length limits (Task #616)', () => {
  describe('title', () => {
    it('accepts a 200-character title', () => {
      const result = insertGeneralCommunicationSchema.safeParse(
        basePayload({ title: 'a'.repeat(200) })
      );
      expect(result.success).toBe(true);
    });

    it('rejects a 201-character title with a clear error', () => {
      const result = insertGeneralCommunicationSchema.safeParse(
        basePayload({ title: 'a'.repeat(201) })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const titleIssue = result.error.issues.find((i) => i.path[0] === 'title');
        expect(titleIssue).toBeDefined();
        expect(titleIssue?.message).toMatch(/200/);
      }
    });
  });

  describe('content', () => {
    it('accepts a 5000-character content', () => {
      const result = insertGeneralCommunicationSchema.safeParse(
        basePayload({ content: 'b'.repeat(5000) })
      );
      expect(result.success).toBe(true);
    });

    it('rejects a 5001-character content with a clear error', () => {
      const result = insertGeneralCommunicationSchema.safeParse(
        basePayload({ content: 'b'.repeat(5001) })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const contentIssue = result.error.issues.find((i) => i.path[0] === 'content');
        expect(contentIssue).toBeDefined();
        expect(contentIssue?.message).toMatch(/5000/);
      }
    });
  });
});
