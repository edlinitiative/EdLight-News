/**
 * Shared image-dimension probing utilities.
 *
 * Reads width/height directly from the file headers of common image formats
 * without spawning a subprocess or pulling in a native dependency. Used by:
 *
 *   - generateImages.ts  (when re-processing items missing images)
 *   - mirrorPublisherImage.ts (at ingest time, so freshly mirrored
 *     publisher images carry width/height into Firestore)
 *
 * Why this matters: downstream IG quality gates (`isItemImageUsableForIG`)
 * reject any item whose `imageMeta` lacks width/height. Without that data
 * the carousel pipeline falls back to keyword/LLM image search and can
 * pick a topical-but-wrong image.
 */

export interface ImageDimensions {
  width?: number;
  height?: number;
}

export function detectImageDimensions(
  buffer: Buffer,
  _contentType?: string,
  url?: string,
): ImageDimensions {
  return (
    readPngSize(buffer) ??
    readJpegSize(buffer) ??
    readWebpSize(buffer) ??
    readGifSize(buffer) ??
    inferSizeFromUrl(url) ??
    {}
  );
}

export function readPngSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  if (buffer.readUInt32BE(0) !== 0x89504e47) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

export function readGifSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 10) return null;
  const signature = buffer.toString("ascii", 0, 6);
  if (signature !== "GIF87a" && signature !== "GIF89a") return null;
  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
  };
}

export function readWebpSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 30) return null;
  if (
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }

  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  if (chunk === "VP8 ") {
    // Lossy WebP: width/height live at offsets 26/28 (14-bit little-endian).
    if (buffer.length < 30) return null;
    const w = buffer.readUInt16LE(26) & 0x3fff;
    const h = buffer.readUInt16LE(28) & 0x3fff;
    if (w > 0 && h > 0) return { width: w, height: h };
    return null;
  }
  if (chunk === "VP8L") {
    // Lossless WebP: 14-bit dimensions packed at offset 21.
    if (buffer.length < 25) return null;
    if (buffer[21] !== 0x2f) return null;
    const b0 = buffer[22]!;
    const b1 = buffer[23]!;
    const b2 = buffer[24]!;
    const b3 = buffer[25] ?? 0;
    const w = 1 + (((b1 & 0x3f) << 8) | b0);
    const h = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width: w, height: h };
  }

  return null;
}

export function readJpegSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = buffer[offset + 1];
    if (!marker) return null;

    if (marker === 0xd9 || marker === 0xda) break;
    const blockLength = buffer.readUInt16BE(offset + 2);
    if (blockLength < 2) return null;

    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSof && offset + 8 < buffer.length) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + blockLength;
  }

  return null;
}

export function inferSizeFromUrl(url?: string): ImageDimensions | null {
  if (!url) return null;
  const match = url.match(/(?:^|[^\d])(\d{3,4})[xX](\d{3,4})(?:[^\d]|$)/);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}
