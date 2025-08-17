// Polyfills for Jest environment
const util = require('util');
require('whatwg-fetch');

// Node.js polyfills for web APIs - Use constructor versions
global.TextEncoder = util.TextEncoder;
global.TextDecoder = util.TextDecoder;

// Stream polyfills with fallback for older Node versions
try {
  const { ReadableStream, TransformStream, WritableStream } = require('stream/web');
  global.ReadableStream = ReadableStream;
  global.TransformStream = TransformStream;
  global.WritableStream = WritableStream;
} catch (error) {
  // Fallback for older Node versions
  console.warn('Web streams not available, some MSW features may not work');
}

// BroadcastChannel polyfill for MSW
global.BroadcastChannel = class BroadcastChannel {
  /**
   *
   * @param name
   */
  constructor(name) {
    this.name = name;
  }
  /**
   *
   */
  postMessage() {}
  /**
   *
   */
  addEventListener() {}
  /**
   *
   */
  removeEventListener() {}
  /**
   *
   */
  close() {}
};

// Text Encoder/Decoder polyfills for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock URL.createObjectURL for file handling tests
global.URL = global.URL || {};
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;