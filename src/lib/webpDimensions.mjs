import { readFile } from 'node:fs/promises';
import path from 'node:path';

const uint24LE = (buffer, offset) => (
  buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)
);

function orientation(width, height) {
  const ratio = width / height;
  if (ratio > 1.12) return 'landscape';
  if (ratio < 0.88) return 'portrait';
  return 'square';
}

function parseWebp(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('Not a WebP image');
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;

    if (type === 'VP8X' && data + 10 <= buffer.length) {
      return { width: uint24LE(buffer, data + 4) + 1, height: uint24LE(buffer, data + 7) + 1 };
    }

    if (type === 'VP8L' && data + 5 <= buffer.length && buffer[data] === 0x2f) {
      const b1 = buffer[data + 1];
      const b2 = buffer[data + 2];
      const b3 = buffer[data + 3];
      const b4 = buffer[data + 4];
      return {
        width: 1 + (((b2 & 0x3f) << 8) | b1),
        height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
      };
    }

    if (type === 'VP8 ' && data + 10 <= buffer.length) {
      for (let cursor = data; cursor + 9 < Math.min(data + size, buffer.length); cursor += 1) {
        if (buffer[cursor + 3] === 0x9d && buffer[cursor + 4] === 0x01 && buffer[cursor + 5] === 0x2a) {
          return {
            width: buffer.readUInt16LE(cursor + 6) & 0x3fff,
            height: buffer.readUInt16LE(cursor + 8) & 0x3fff,
          };
        }
      }
    }

    offset = data + size + (size % 2);
  }

  throw new Error('WebP dimensions were not found');
}

export async function getPublicWebpDimensions(src) {
  if (!src.startsWith('/media/')) throw new Error(`Unexpected public media path: ${src}`);
  const file = path.join(process.cwd(), 'public', `${src.slice(1)}-lg.webp`);
  const { width, height } = parseWebp(await readFile(file));
  return { width, height, orientation: orientation(width, height) };
}
