// Polyfills for Jest environment
require('whatwg-fetch');

// Text Encoder/Decoder polyfills for Node.js environment
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;