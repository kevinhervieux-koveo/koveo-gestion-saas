// Global test environment setup

// Mock setImmediate for Node.js environment
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = setTimeout;
}

// Set test environment variable
process.env.TEST_TYPE = 'unit';

module.exports = {};