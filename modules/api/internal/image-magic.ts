/** Contract: contracts/api/rules.md */

/**
 * Magic-byte sniffer for image uploads (issue #132).
 *
 * The multipart `Content-Type` header is fully attacker-controlled,
 * so the upload route must verify the file's actual content matches
 * the claimed MIME before accepting it. Without this check, an
 * attacker can upload an HTML file labeled as a PNG and have it
 * served as user content.
 *
 * Only the four MIMEs accepted by the upload route are sniffed:
 * image/png, image/jpeg, image/gif, image/webp. The signatures are
 * the canonical magic bytes from the file format specs.
 */

/** A claimed MIME type the upload route accepts. */
export type SupportedImageMime =
  | 'image/png'
  | 'image/jpeg'
  | 'image/gif'
  | 'image/webp';

/**
 * Check whether a buffer's leading bytes match the magic signature
 * of the claimed MIME type. Returns true on match, false on mismatch
 * or unsupported MIME.
 */
export function matchesImageMagic(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 12) return false;

  switch (mime) {
    case 'image/png':
      // PNG signature: 89 50 4E 47 0D 0A 1A 0A
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );

    case 'image/jpeg':
      // JPEG starts with FF D8 FF and ends with FF D9. We only check
      // the start signature; full validation isn't necessary because
      // S3 stores the bytes verbatim and the browser will reject a
      // malformed JPEG on decode.
      return (
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );

    case 'image/gif':
      // GIF87a or GIF89a — both start with "GIF8" and the 5th byte
      // is '7' or '9' followed by 'a'.
      return (
        buffer[0] === 0x47 && // 'G'
        buffer[1] === 0x49 && // 'I'
        buffer[2] === 0x46 && // 'F'
        buffer[3] === 0x38 && // '8'
        (buffer[4] === 0x37 || buffer[4] === 0x39) && // '7' or '9'
        buffer[5] === 0x61 // 'a'
      );

    case 'image/webp':
      // WebP: "RIFF" + 4 bytes file-size + "WEBP"
      return (
        buffer[0] === 0x52 && // 'R'
        buffer[1] === 0x49 && // 'I'
        buffer[2] === 0x46 && // 'F'
        buffer[3] === 0x46 && // 'F'
        buffer[8] === 0x57 && // 'W'
        buffer[9] === 0x45 && // 'E'
        buffer[10] === 0x42 && // 'B'
        buffer[11] === 0x50 // 'P'
      );

    default:
      return false;
  }
}
