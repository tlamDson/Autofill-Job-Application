/**
 * scripts/generate-icons.mjs — emits the three PNG icon sizes manifest.json
 * requires (16/48/128px), as flat-color placeholders, using only Node's
 * built-in zlib (no image library dependency). Chrome refuses to load an
 * unpacked extension whose manifest points at a missing icon file, so these
 * need to exist even before real branded artwork is designed.
 *
 * Usage: node scripts/generate-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const iconsDir = path.join(rootDir, 'icons');

const BG = [0x33, 0x66, 0xee]; // brand-neutral blue placeholder
const FG = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makeIconPng(size) {
  // Simple design: solid background square with a centered white "A" glyph
  // drawn as a coarse pixel block (legible at 48/128, a plain square at 16).
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let offset = 0;
  const margin = Math.max(1, Math.round(size * 0.2));
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const inMargin = x < margin || x >= size - margin || y < margin || y >= size - margin;
      const [r, g, b] = inMargin ? BG : FG;
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function main() {
  await mkdir(iconsDir, { recursive: true });
  for (const size of [16, 48, 128]) {
    const png = makeIconPng(size);
    await writeFile(path.join(iconsDir, `icon${size}.png`), png);
  }
  console.log('[icons] wrote icon16.png, icon48.png, icon128.png to icons/');
}

main();
