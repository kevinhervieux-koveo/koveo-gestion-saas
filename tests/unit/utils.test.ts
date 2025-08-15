import { cn } from '../../client/src/lib/utils';

describe('Utils', () => {
  describe('cn function', () => {
    it('should merge class names correctly', () => {
      const result = cn('base-class', 'additional-class');
      expect(result).toContain('base-class');
      expect(result).toContain('additional-class');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const isHidden = false;
      const result = cn('base-class', isActive && 'conditional-class', isHidden && 'hidden-class');
      expect(result).toContain('base-class');
      expect(result).toContain('conditional-class');
      expect(result).not.toContain('hidden-class');
    });

    it('should handle empty inputs', () => {
      const result = cn();
      expect(typeof result).toBe('string');
    });
  });
});