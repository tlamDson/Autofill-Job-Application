// @vitest-environment node
//
// esbuild's Node API relies on a TextEncoder/Uint8Array invariant that jsdom's
// polyfills break, so this file must run in the plain Node environment rather
// than the jsdom environment the rest of the suite uses (vite.config.js).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBuild } from '../scripts/build.mjs';

// MV3 content scripts declared in manifest.json (unlike the background service
// worker and the popup/options extension pages) cannot use ES module syntax.
// These tests build the real dist/ output and assert it is actually loadable —
// this is the thing that was never true before, and that jsdom-only tests
// cannot catch since they import from src/ directly, bypassing the manifest
// entirely.

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(rootDir, 'dist');

beforeAll(async () => {
  await runBuild();
}, 30000);

async function exists(relPath) {
  try {
    await readFile(path.join(distDir, relPath));
    return true;
  } catch {
    return false;
  }
}

describe('build output', () => {
  it('bundles content.js and injected.js with no ES module syntax', async () => {
    for (const file of ['content.js', 'injected.js']) {
      const src = await readFile(path.join(distDir, file), 'utf8');
      expect(src).not.toMatch(/(^|[^a-zA-Z0-9_.$])import\s+[^(]/m);
      expect(src).not.toMatch(/(^|[^a-zA-Z0-9_.$])export\s/m);
      expect(src).not.toMatch(/await\s+import\s*\(/);
    }
  });

  it('does not leave the dynamic import of the generic adapter in injected.js', async () => {
    const src = await readFile(path.join(distDir, 'injected.js'), 'utf8');
    expect(src).not.toMatch(/import\(['"]\.\/adapters\/generic\.js['"]\)/);
  });

  it('every path referenced from dist/manifest.json resolves to a real file', async () => {
    const manifest = JSON.parse(await readFile(path.join(distDir, 'manifest.json'), 'utf8'));

    for (const script of manifest.content_scripts) {
      for (const js of script.js) {
        expect(await exists(js), `content script ${js} missing from dist/`).toBe(true);
      }
    }
    expect(await exists(manifest.background.service_worker)).toBe(true);
    expect(await exists(manifest.action.default_popup)).toBe(true);
    expect(await exists(manifest.options_ui.page)).toBe(true);
    for (const size of Object.keys(manifest.icons)) {
      expect(await exists(manifest.icons[size])).toBe(true);
    }
  });

  it('copies src/ alongside popup/options so their relative imports resolve', async () => {
    const popupSrc = await readFile(path.join(distDir, 'popup', 'popup.js'), 'utf8');
    const relImport = popupSrc.match(/import\(\s*['"](\.\.\/src\/[^'"]+)['"]/);
    expect(relImport, 'expected popup.js to dynamically import ../src/...').toBeTruthy();
    const resolved = path.join(distDir, 'popup', relImport[1]);
    await expect(readFile(resolved, 'utf8')).resolves.toBeTruthy();
  });

  it('background.js is left as a native ES module (service worker supports it)', async () => {
    const src = await readFile(path.join(distDir, 'src', 'background.js'), 'utf8');
    expect(src).toMatch(/^export /m);
  });
});
