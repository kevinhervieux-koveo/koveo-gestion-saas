/**
 * Mock for util module to prevent hanging promisified operations
 * Provides safe, fast-returning mocks for promisify and other utilities
 */

// Mock promisify function that returns safe mocks
const mockPromisify = (fn) => {
  return async (...args) => {
    return {
      stdout: 'Mock promisified output',
      stderr: ''
    };
  };
};

// Mock other util functions
const mockInspect = (obj) => {
  return typeof obj === 'object' ? JSON.stringify(obj, null, 2) : String(obj);
};

const mockFormat = (f, ...args) => {
  return f.replace(/%[sdj%]/g, (x) => {
    if (args.length === 0) return x;
    switch (x) {
      case '%s': return String(args.shift());
      case '%d': return Number(args.shift());
      case '%j':
        try {
          return JSON.stringify(args.shift());
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
};

// Mock TextEncoder/TextDecoder for compatibility
class MockTextEncoder {
  encode(input = '') {
    return new Uint8Array(Buffer.from(input, 'utf8'));
  }
}

class MockTextDecoder {
  decode(input) {
    return Buffer.from(input).toString('utf8');
  }
}

// Mock inherits function for legacy compatibility
const mockInherits = (constructor, superConstructor) => {
  if (superConstructor) {
    constructor.super_ = superConstructor;
    constructor.prototype = Object.create(superConstructor.prototype, {
      constructor: {
        value: constructor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  }
};

// Mock util.types object with isNativeError for jest-message-util compatibility
const mockTypes = {
  isNativeError: (obj) => {
    return obj instanceof Error;
  },
  isDate: (obj) => obj instanceof Date,
  isRegExp: (obj) => obj instanceof RegExp,
  isPromise: (obj) => obj && typeof obj.then === 'function',
  isArrayBuffer: (obj) => obj instanceof ArrayBuffer,
  isTypedArray: (obj) => obj && obj.buffer instanceof ArrayBuffer && typeof obj.byteLength === 'number',
  isUint8Array: (obj) => obj instanceof Uint8Array,
  isFloat32Array: (obj) => obj instanceof Float32Array,
  isFloat64Array: (obj) => obj instanceof Float64Array,
  isInt8Array: (obj) => obj instanceof Int8Array,
  isInt16Array: (obj) => obj instanceof Int16Array,
  isInt32Array: (obj) => obj instanceof Int32Array,
  isUint16Array: (obj) => obj instanceof Uint16Array,
  isUint32Array: (obj) => obj instanceof Uint32Array,
  isBigInt64Array: (obj) => typeof BigInt64Array !== 'undefined' && obj instanceof BigInt64Array,
  isBigUint64Array: (obj) => typeof BigUint64Array !== 'undefined' && obj instanceof BigUint64Array
};

module.exports = {
  promisify: mockPromisify,
  inspect: mockInspect,
  format: mockFormat,
  TextEncoder: MockTextEncoder,
  TextDecoder: MockTextDecoder,
  deprecate: (fn) => fn,
  debuglog: () => () => {},
  isDeepStrictEqual: () => true,
  inherits: mockInherits,
  types: mockTypes, // Add the types object with isNativeError
  callbackify: (fn) => {
    return (...args) => {
      const callback = args.pop();
      Promise.resolve(fn(...args))
        .then(result => callback(null, result))
        .catch(error => callback(error));
    };
  }
};