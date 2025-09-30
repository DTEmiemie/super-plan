// Vitest setup file for jsdom environment

// Fix for jsdom TextEncoder/TextDecoder issues
import { TextEncoder, TextDecoder } from 'util';

// Polyfill global objects that jsdom might not provide
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as any;
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder as any;
}

// Polyfill structuredClone if not available (jsdom compatibility)
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}