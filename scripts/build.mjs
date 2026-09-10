/**
 * scripts/build.mjs — bundles the two declarative content scripts
 * (src/content.js, src/injected.js) into dependency-free IIFE files under
 * dist/, since Chrome MV3 content scripts declared in manifest.json cannot
 * use ES module imports (unlike the background service worker and the
 * popup/options extension pages, which already support <script type="module">
 * and are copied through unbundled).
 *
 * Usage:
 *   node scripts/build.mjs          — build once
 *   node scripts/build.mjs --watch  — rebuild on change
 */

import { build, context } from 'esbuild';
import { mkdir, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(rootDir, 'dist');

const ENTRY_POINTS = [
  path.join(rootDir, 'src', 'content.js'),
  path.join(rootDir, 'src', 'injected.js'),
];

const STATIC_DIRS = ['popup', 'options', 'icons'];
const STATIC_FILES = ['manifest.json'];

const esbuildOptions = {
  entryPoints: ENTRY_POINTS,
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  outdir: distDir,
  sourcemap: 'inline',
  logLevel: 'info',
};

async function copyStaticAssets() {
  for (const dir of STATIC_DIRS) {
    const src = path.join(rootDir, dir);
    if (existsSync(src)) await cp(src, path.join(distDir, dir), { recursive: true });
  }
  for (const file of STATIC_FILES) {
    const src = path.join(rootDir, file);
    if (existsSync(src)) await cp(src, path.join(distDir, file));
  }
  // src/background.js is a native ES module (manifest declares "type": "module"
  // for the service worker), so it's copied as-is rather than bundled — but its
  // own relative imports must come along too.
  await cp(path.join(rootDir, 'src'), path.join(distDir, 'src'), { recursive: true });
}

export async function runBuild() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await build(esbuildOptions);
  await copyStaticAssets();
}

async function runWatch() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await copyStaticAssets();
  const ctx = await context(esbuildOptions);
  await ctx.watch();
  console.log('[build] watching for changes...');
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const watch = process.argv.includes('--watch');
  if (watch) {
    await runWatch();
  } else {
    await runBuild();
  }
}
