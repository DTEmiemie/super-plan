// Vitest setup file for jsdom environment
// Must run before any imports to properly polyfill global objects

import { TextEncoder, TextDecoder } from 'util';
import { webcrypto } from 'crypto';

// Polyfill TextEncoder/TextDecoder (critical for jsdom)
Object.assign(global, {
  TextEncoder,
  TextDecoder,
});

// Polyfill crypto APIs
if (typeof global.crypto === 'undefined') {
  Object.defineProperty(global, 'crypto', {
    value: webcrypto,
    writable: false,
    configurable: true,
  });
}

// Polyfill structuredClone if not available
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj: any) => {
    return JSON.parse(JSON.stringify(obj));
  };
}