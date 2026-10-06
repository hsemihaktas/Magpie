// Polyfill for 'process' global in Chrome Extension Service Worker context.
// Some npm packages (supabase-js, etc.) reference process.env or process.version
// at module load time. This ensures they don't throw ReferenceError.
if (typeof globalThis.process === 'undefined') {
  globalThis.process = { env: {}, version: 'v20.0.0' };
}
