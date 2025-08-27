// Production server launcher - ES module import
import('../dist/index.js').catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});