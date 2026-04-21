/**
 * Very simple test to verify basic functionality without complex imports
 */
import { describe, it, expect } from '@jest/globals';

describe('Basic Mock Test', () => {
  it('should run without any imports', () => {
    expect(1 + 1).toBe(2);
    console.log('✅ Basic math test passed');
  });

  it('should have access to jest functions', () => {
    const mockFn = jest.fn();
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
    console.log('✅ Jest mock functions working');
  });
});