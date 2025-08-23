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

// ES module exports for wouter/memory
const __esModule = true;
const defaultExport = { MemoryRouter, useMemoryLocation, memoryLocation };

module.exports = {
  __esModule,
  default: defaultExport,
  MemoryRouter,
  useMemoryLocation,
  memoryLocation,
};