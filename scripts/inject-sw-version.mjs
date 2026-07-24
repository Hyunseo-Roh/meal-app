// Post-export step: stamp the service worker with a per-deploy version so every
// deploy produces a byte-different dist/sw.js. The browser then detects a new
// worker, installs it (skipWaiting + claim), and purges the old cache — which
// refreshes the precached offline.html even when app code didn't change.
//
// The stamp is the Vercel commit SHA in CI (stable per deploy), or the build
// time locally. Runs from vercel.json's buildCommand after `expo export`.
import { readFileSync, writeFileSync } from 'node:fs';

const SW_PATH = 'dist/sw.js';
const stamp = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());

const src = readFileSync(SW_PATH, 'utf8');
if (!src.includes('__BUILD_STAMP__')) {
  console.warn(`[inject-sw-version] no __BUILD_STAMP__ placeholder in ${SW_PATH}; skipping`);
  process.exit(0);
}
writeFileSync(SW_PATH, src.replace(/__BUILD_STAMP__/g, stamp), 'utf8');
console.log(`[inject-sw-version] stamped ${SW_PATH} with ${stamp}`);
