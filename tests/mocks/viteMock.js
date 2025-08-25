// Mock for server/vite.ts to avoid import.meta issues in Jest
const log = jest.fn();

const setupVite = jest.fn();
const serveStatic = jest.fn();

module.exports = {
  log,
  setupVite,
  serveStatic,
};
