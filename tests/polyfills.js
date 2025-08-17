// Polyfills for Jest environment
const { TextEncoder, TextDecoder, ReadableStream } = require('stream/web');
require('whatwg-fetch');

// Node.js polyfills for web APIs
global.ReadableStream = ReadableStream;
global.TransformStream = require('stream/web').TransformStream;
global.WritableStream = require('stream/web').WritableStream;

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