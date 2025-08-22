import { cn } from '../../client/src/lib/utils';

describe('Utils', () => {
  describe('cn function', () => {
    it('should merge class names correctly', () => {
      const result = cn('base-class', 'additional-class');
      expect(_result).toContain('base-class');
      expect(_result).toContain('additional-class');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const isHidden = false;
      const result = cn('base-class', isActive && 'conditional-class', isHidden && 'hidden-class');
      expect(_result).toContain('base-class');
      expect(_result).toContain('conditional-class');
      expect(_result).not.toContain('hidden-class');
    });

    it('should handle empty inputs', () => {
      const result = cn();
      expect(typeof _result).toBe('string');
    });
  });
});
