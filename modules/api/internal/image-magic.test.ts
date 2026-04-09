/** Contract: contracts/api/rules.md */
import { describe, it, expect } from 'vitest';
import { matchesImageMagic } from './image-magic.ts';

// Real magic-byte fixtures (no mocks). Each buffer is the real
// signature for its format, padded out to 12 bytes so the length
// guard in matchesImageMagic doesn't reject it.

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, // start of IHDR chunk
]);

const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

const GIF87a = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00,
]);

const GIF89a = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00,
]);

const WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46,
  0x24, 0x00, 0x00, 0x00, // file-size placeholder
  0x57, 0x45, 0x42, 0x50,
]);

// HTML labeled as PNG — the canonical attack we want to block.
const HTML_DISGUISED_AS_PNG = Buffer.from('<html>evil</html>     ', 'utf8');

describe('matchesImageMagic — happy paths', () => {
  it('accepts a real PNG signature', () => {
    expect(matchesImageMagic(PNG, 'image/png')).toBe(true);
  });

  it('accepts a real JPEG signature', () => {
    expect(matchesImageMagic(JPEG, 'image/jpeg')).toBe(true);
  });

  it('accepts a real GIF87a signature', () => {
    expect(matchesImageMagic(GIF87a, 'image/gif')).toBe(true);
  });

  it('accepts a real GIF89a signature', () => {
    expect(matchesImageMagic(GIF89a, 'image/gif')).toBe(true);
  });

  it('accepts a real WebP signature', () => {
    expect(matchesImageMagic(WEBP, 'image/webp')).toBe(true);
  });
});

describe('matchesImageMagic — rejects MIME spoofing', () => {
  it('rejects HTML labeled as image/png', () => {
    expect(matchesImageMagic(HTML_DISGUISED_AS_PNG, 'image/png')).toBe(false);
  });

  it('rejects PNG bytes labeled as image/jpeg', () => {
    expect(matchesImageMagic(PNG, 'image/jpeg')).toBe(false);
  });

  it('rejects JPEG bytes labeled as image/png', () => {
    expect(matchesImageMagic(JPEG, 'image/png')).toBe(false);
  });

  it('rejects GIF bytes labeled as image/webp', () => {
    expect(matchesImageMagic(GIF89a, 'image/webp')).toBe(false);
  });

  it('rejects WebP bytes labeled as image/gif', () => {
    expect(matchesImageMagic(WEBP, 'image/gif')).toBe(false);
  });
});

describe('matchesImageMagic — edge cases', () => {
  it('rejects buffers shorter than the minimum sniff length', () => {
    const tooShort = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    expect(matchesImageMagic(tooShort, 'image/png')).toBe(false);
  });

  it('rejects an unknown MIME type', () => {
    expect(matchesImageMagic(PNG, 'application/octet-stream')).toBe(false);
    expect(matchesImageMagic(PNG, 'text/html')).toBe(false);
    expect(matchesImageMagic(PNG, '')).toBe(false);
  });

  it('rejects all-zero buffers for every supported MIME', () => {
    const zeros = Buffer.alloc(32);
    for (const mime of ['image/png', 'image/jpeg', 'image/gif', 'image/webp']) {
      expect(matchesImageMagic(zeros, mime)).toBe(false);
    }
  });

  it('rejects GIF8X with X !== 7 or 9', () => {
    const gif8a = Buffer.from([
      0x47, 0x49, 0x46, 0x38, 0x38, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    expect(matchesImageMagic(gif8a, 'image/gif')).toBe(false);
  });

  it('rejects RIFF without WEBP fourcc (e.g., WAV file)', () => {
    const wav = Buffer.from([
      0x52, 0x49, 0x46, 0x46,
      0x24, 0x00, 0x00, 0x00,
      0x57, 0x41, 0x56, 0x45, // "WAVE" instead of "WEBP"
    ]);
    expect(matchesImageMagic(wav, 'image/webp')).toBe(false);
  });
});
