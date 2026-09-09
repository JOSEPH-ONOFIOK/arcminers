// Renders a contact sheet of miners to PNG so the art can be looked at.

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { assayTraits } from "../src/lib/shaft/traits";
import { palette, paint, SIZE } from "../src/lib/shaft/render";
import { RIGS, TIERS, type Tier } from "../src/lib/shaft/rules";

const SCALE = 5;
const PAD = 6;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(width: number, height: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0; // no per-scanline filter
    rgb.subarray(y * width * 3, (y + 1) * width * 3).forEach((v, i) => {
      raw[y * (width * 3 + 1) + 1 + i] = v;
    });
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Six seeds per rig across the four tiers: enough to see whether the trait
// pools actually produce different silhouettes, and whether glow reads.
const COLS = 6;
const ROWS = RIGS.length * TIERS.length;
const CELL = SIZE * SCALE + PAD;
const W = COLS * CELL + PAD;
const H = ROWS * CELL + PAD;
const buffer = new Uint8Array(W * H * 3);

// Fill with the page's rock ground so the sheet reads like the real site.
for (let i = 0; i < W * H; i++) {
  buffer[i * 3] = 0x12;
  buffer[i * 3 + 1] = 0x10;
  buffer[i * 3 + 2] = 0x0d;
}

let row = 0;
for (const rig of RIGS) {
  for (const tier of TIERS as readonly Tier[]) {
    const colors = palette(tier);
    for (let col = 0; col < COLS; col++) {
      const seed = (col * 2654435761 + rig.length * 97 + col) >>> 0;
      const grid = paint(assayTraits(seed, rig));
      const ox = PAD + col * CELL;
      const oy = PAD + row * CELL;
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const index = grid[y * SIZE + x];
          if (index === 0) continue;
          const [r, g, b] = rgbOf(colors[index]);
          for (let sy = 0; sy < SCALE; sy++) {
            for (let sx = 0; sx < SCALE; sx++) {
              const p = ((oy + y * SCALE + sy) * W + ox + x * SCALE + sx) * 3;
              buffer[p] = r;
              buffer[p + 1] = g;
              buffer[p + 2] = b;
            }
          }
        }
      }
    }
    row++;
  }
}

writeFileSync(process.argv[2] ?? "miners.png", png(W, H, buffer));
console.log(`${W}x${H}, ${ROWS} rows (rig x tier), ${COLS} seeds each`);
