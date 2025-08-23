// Mock for wouter/memory to handle memory routing in tests
const React = require('react');

const MemoryRouter = ({ children }) => {
  return React.createElement('div', { 'data-testid': 'memory-router' }, children);
};

const useMemoryLocation = () => ['/', () => {}];

const memoryLocation = (options) => {
  const hookReturn = ['/', () => {}];
  hookReturn.history = [options?.path || '/'];
  hookReturn.reset = () => {};
  hookReturn._value = options?.path || '/';
  return hookReturn;
};

module.exports = {
  MemoryRouter,
  useMemoryLocation,
  memoryLocation,
};

// Also export as ES modules for better compatibility
if (typeof exports !== 'undefined') {
  exports.MemoryRouter = MemoryRouter;
  exports.useMemoryLocation = useMemoryLocation;
  exports.memoryLocation = memoryLocation;
}