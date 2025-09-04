// Production server launcher - ES module import
// During tests, skip the exit to prevent test failures
import('../dist/index.js').catch((err) => {
  console.error('Failed to start server:', err);
  // Don't exit during tests
  if (process.env.NODE_ENV !== 'test' && process.env.TEST_ENV !== 'integration') {
    process.exit(1);
  }
});
