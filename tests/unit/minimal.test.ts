/**
 * Minimal test to verify Jest infrastructure is working
 */

describe('Minimal Infrastructure Test', () => {
  it('should run a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should access global variables', () => {
    expect(global.setTimeout).toBeDefined();
    expect(process.env.TEST_TYPE).toBe('unit');
  });
});