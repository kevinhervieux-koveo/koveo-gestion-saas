// Mock for wouter/memory to handle memory routing in tests
module.exports = {
  MemoryRouter: ({ children }) => children,
  useMemoryLocation: () => ['/', () => {}],
};