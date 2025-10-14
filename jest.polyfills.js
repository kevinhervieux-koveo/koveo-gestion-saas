/**
 * Polyfills for Node.js globals required for Jest when testing
 * code that uses fetch (e.g., @neondatabase/serverless)
 * 
 * undici requires TextEncoder/TextDecoder to be set up first
 */

const { TextDecoder, TextEncoder } = require('node:util');
const { ReadableStream, TransformStream } = require('node:stream/web');
const { clearImmediate } = require('node:timers');
const { PerformanceObserver, performance } = require('node:perf_hooks');
const { MessageChannel, MessagePort } = require('node:worker_threads');

Object.defineProperties(globalThis, {
  TextDecoder: { value: TextDecoder },
  TextEncoder: { value: TextEncoder },
  ReadableStream: { value: ReadableStream },
  TransformStream: { value: TransformStream },
  clearImmediate: { value: clearImmediate },
  performance: { value: performance },
  PerformanceObserver: { value: PerformanceObserver },
  MessageChannel: { value: MessageChannel },
  MessagePort: { value: MessagePort },
});

// Use cross-fetch for better JSDOM compatibility
const fetch = require('cross-fetch');

if (!globalThis.fetch) {
  globalThis.fetch = fetch;
  globalThis.Headers = fetch.Headers;
  globalThis.Request = fetch.Request;
  globalThis.Response = fetch.Response;
}
