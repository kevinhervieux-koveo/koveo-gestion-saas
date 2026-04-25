/**
 * Polyfills for Node.js globals required for Jest when testing
 * code that uses fetch (e.g., @neondatabase/serverless)
 * 
 * undici requires TextEncoder/TextDecoder to be set up first
 */

const { TextDecoder, TextEncoder } = require('node:util');
const { ReadableStream, TransformStream } = require('node:stream/web');
const { setImmediate, clearImmediate } = require('node:timers');
const { PerformanceObserver, performance } = require('node:perf_hooks');

// Mock MessagePort and MessageChannel to avoid open handles
class MockMessagePort {
  start() {}
  close() {}
  postMessage() {}
  addEventListener() {}
  removeEventListener() {}
}

class MockMessageChannel {
  constructor() {
    this.port1 = new MockMessagePort();
    this.port2 = new MockMessagePort();
  }
}

// Use writable/configurable property descriptors so libraries that legitimately
// reassign these globals (e.g. jszip, used transitively by mammoth, sets
// `clearImmediate`/`setImmediate` on `window` during initialization) do not
// hit "Cannot assign to read only property" errors in jsdom.
const polyfillDescriptor = (value) => ({
  value,
  writable: true,
  configurable: true,
});

Object.defineProperties(globalThis, {
  TextDecoder: polyfillDescriptor(TextDecoder),
  TextEncoder: polyfillDescriptor(TextEncoder),
  ReadableStream: polyfillDescriptor(ReadableStream),
  TransformStream: polyfillDescriptor(TransformStream),
  setImmediate: polyfillDescriptor(setImmediate),
  clearImmediate: polyfillDescriptor(clearImmediate),
  performance: polyfillDescriptor(performance),
  PerformanceObserver: polyfillDescriptor(PerformanceObserver),
  MessageChannel: polyfillDescriptor(MockMessageChannel),
  MessagePort: polyfillDescriptor(MockMessagePort),
});

// Capture the real DATABASE_URL before jest.setup.simple.ts overwrites it with
// the placeholder test URL. Behavioural integration tests that need a real
// database connection (see tests/integration/user-residences-end-residency.test.ts)
// restore process.env.DATABASE_URL from this captured value before importing
// the db module. Other tests are unaffected.
if (process.env.DATABASE_URL && !process.env._INTEGRATION_DB_URL) {
  process.env._INTEGRATION_DB_URL = process.env.DATABASE_URL;
}

// Use cross-fetch for better JSDOM compatibility
const fetch = require('cross-fetch');

if (!globalThis.fetch) {
  globalThis.fetch = fetch;
  globalThis.Headers = fetch.Headers;
  globalThis.Request = fetch.Request;
  globalThis.Response = fetch.Response;
}
