/**
 * esbuild build script for the Social Content Saver Chrome Extension.
 *
 * Entry points and output mapping:
 *   background/service-worker.ts     → dist/background/service-worker.js   (ESM — MV3 supports module service workers)
 *   content-scripts/instagram.ts     → dist/content-scripts/instagram.js    (IIFE — content scripts require self-contained bundles)
 *   content-scripts/x.ts             → dist/content-scripts/x.js            (IIFE)
 *   popup/popup.ts                   → dist/popup/popup.js                  (IIFE)
 *
 * Usage:
 *   node build.mjs           # one-shot production build
 *   node build.mjs --watch   # incremental rebuild on file change (development)
 */

import esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

/** Shared options applied to every entry point. */
const sharedOptions = {
  bundle: true,
  platform: 'browser',
  target: ['chrome120'],
  sourcemap: isWatch ? 'inline' : false,
};

/**
 * Entry point definitions.
 * - background service worker uses ESM format so it can use `import` at the
 *   module level (declared with `"type": "module"` in manifest.json).
 * - content scripts and popup use IIFE because Chrome does not support ES
 *   modules in content script contexts.
 */
const entries = [
  {
    in: 'background/service-worker.ts',
    out: 'dist/background/service-worker.js',
    format: /** @type {import('esbuild').Format} */ ('esm'),
  },
  {
    in: 'content-scripts/instagram.ts',
    out: 'dist/content-scripts/instagram.js',
    format: /** @type {import('esbuild').Format} */ ('iife'),
  },
  {
    in: 'content-scripts/x.ts',
    out: 'dist/content-scripts/x.js',
    format: /** @type {import('esbuild').Format} */ ('iife'),
  },
  {
    in: 'popup/popup.ts',
    out: 'dist/popup/popup.js',
    format: /** @type {import('esbuild').Format} */ ('iife'),
  },
];

if (isWatch) {
  // Development: create a long-lived context per entry and start watching.
  const contexts = await Promise.all(
    entries.map(({ in: entryIn, out, format }) =>
      esbuild.context({
        ...sharedOptions,
        entryPoints: [entryIn],
        outfile: out,
        format,
      })
    )
  );

  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log('[esbuild] Watching for changes — press Ctrl+C to stop.');
} else {
  // Production: build all entry points in parallel.
  await Promise.all(
    entries.map(({ in: entryIn, out, format }) =>
      esbuild.build({
        ...sharedOptions,
        entryPoints: [entryIn],
        outfile: out,
        format,
      })
    )
  );
  console.log('[esbuild] Build complete.');
}
