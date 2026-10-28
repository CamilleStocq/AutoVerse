// Génère les icônes PNG de la PWA (Android, iOS) à partir du logo vectoriel, sans dépendance.
// Usage : node scripts/make-icons.mjs  → écrit dans public/icons/
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x15, 0x15, 0x1e];
const RED = [0xe1, 0x06, 0x00];
const WHITE = [0xff, 0xff, 0xff];

// Logo dans un repère 64×64 (identique à public/favicon.svg).
const A_SHAPE = [[12, 52], [29, 14], [37, 14], [54, 52], [45, 52], [33, 25], [21, 52]];
const BAR = { x: 23, y: 40, w: 20, h: 5 };

function inPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Filet de coin haut-droit (signature visuelle) : deux segments reliés par un quart de cercle. */
function onCorner(x, y) {
  const t = 1.6;
  if (y >= 4 - t && y <= 4 + t && x >= 30 && x <= 50) return true;
  if (x >= 60 - t && x <= 60 + t && y >= 14 && y <= 30) return true;
  if (x > 50 && y < 14) {
    const d = Math.hypot(x - 50, y - 14);
    return d >= 10 - t && d <= 10 + t;
  }
  return false;
}

function colorAt(u, v) {
  if (u < 0 || v < 0 || u > 64 || v > 64) return BG;
  if (u >= BAR.x && u <= BAR.x + BAR.w && v >= BAR.y && v <= BAR.y + BAR.h) return WHITE;
  if (inPolygon(u, v, A_SHAPE)) return RED;
  if (onCorner(u, v)) return RED;
  return BG;
}

function render(size, padRatio) {
  const SS = 4; // suréchantillonnage pour lisser les bords
  const pad = size * padRatio;
  const scale = (size - 2 * pad) / 64;
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = colorAt((x + (sx + 0.5) / SS - pad) / scale, (y + (sy + 0.5) / SS - pad) / scale);
          acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
        }
      }
      const i = (y * size + x) * 4;
      px[i] = acc[0] / (SS * SS); px[i + 1] = acc[1] / (SS * SS); px[i + 2] = acc[2] / (SS * SS); px[i + 3] = 255;
    }
  }
  return encodePng(size, size, px);
}

// ---- Encodeur PNG minimal (RGBA 8 bits) ----
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
const icons = [
  ['icon-192.png', 192, 0.1],
  ['icon-512.png', 512, 0.1],
  ['icon-maskable-512.png', 512, 0.2], // zone de sécurité pour les icônes adaptatives Android
  ['apple-touch-icon.png', 180, 0.12],
];
for (const [name, size, pad] of icons) {
  writeFileSync(new URL(name, out), render(size, pad));
  console.log(`✓ ${name}`);
}
