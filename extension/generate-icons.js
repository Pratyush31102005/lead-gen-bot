import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));

function crc32(buf) {
  let c = 0xffffffff;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let x = n;
    for (let k = 0; k < 8; k++) x = x & 1 ? 0xedb88320 ^ (x >>> 1) : x >>> 1;
    table[n] = x;
  }
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function createIcon(size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; ihdrData[9] = 6; // 8-bit RGBA
  const ihdr = createChunk('IHDR', ihdrData);

  const raw = [];
  const cy = size / 2, cx = size / 2;

  for (let y = 0; y < size; y++) {
    raw.push(0);
    for (let x = 0; x < size; x++) {
      const rx = (x - cx) / size;
      const ry = (y - cy) / size;
      const dist = Math.sqrt(rx * rx + ry * ry);

      if (dist < 0.45) {
        const inBolt =
          (Math.abs(rx) < 0.07 && ry > -0.28 && ry < 0.32) ||
          (Math.abs(rx - 0.04) < 0.07 && ry > -0.12 && ry < 0.12) ||
          (Math.abs(rx + 0.04) < 0.07 && ry > -0.12 && ry < 0.12);
        if (inBolt) {
          raw.push(34, 197, 94, 255); // green
        } else {
          raw.push(17, 17, 17, 255); // dark bg
        }
      } else {
        raw.push(0, 0, 0, 0); // transparent
      }
    }
  }

  const compressed = deflateSync(Buffer.from(raw));
  return Buffer.concat([signature, ihdr, createChunk('IDAT', compressed), createChunk('IEND', Buffer.alloc(0))]);
}

const iconsDir = join(__dirname, 'icons');
writeFileSync(join(iconsDir, 'icon16.png'), createIcon(16));
writeFileSync(join(iconsDir, 'icon48.png'), createIcon(48));
writeFileSync(join(iconsDir, 'icon128.png'), createIcon(128));
console.log('Extension icons generated.');
