/** Contract: contracts/kb/rules.md */

/**
 * Minimal ZIP file builder for KB export.
 * Implements ZIP local-file-header + central-directory format (store, no compression).
 * Handles files up to 4 GB (ZIP32 is sufficient for KB exports).
 */


interface ZipEntry {
  name: string;
  data: Buffer;
  crc32: number;
  offset: number;
}

/** CRC-32 lookup table */
const CRC_TABLE = buildCrcTable();

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16LE(buf: Buffer, val: number, offset: number): void {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
}

function writeUInt32LE(buf: Buffer, val: number, offset: number): void {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
  buf[offset + 2] = (val >>> 16) & 0xff;
  buf[offset + 3] = (val >>> 24) & 0xff;
}

/** Build a ZIP buffer from name→content pairs. */
export function buildZip(files: { name: string; content: string }[]): Buffer {
  const entries: ZipEntry[] = [];
  const parts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const data = Buffer.from(file.content, 'utf8');
    const nameBytes = Buffer.from(file.name, 'utf8');
    const crc = crc32(data);

    // Local file header (30 bytes) + name + data
    const header = Buffer.alloc(30);
    writeUInt32LE(header, 0x04034b50, 0); // signature
    writeUInt16LE(header, 20, 4);         // version needed
    writeUInt16LE(header, 0, 6);          // flags
    writeUInt16LE(header, 0, 8);          // compression method (store)
    writeUInt16LE(header, 0, 10);         // mod time
    writeUInt16LE(header, 0, 12);         // mod date
    writeUInt32LE(header, crc, 14);       // crc32
    writeUInt32LE(header, data.length, 18); // compressed size
    writeUInt32LE(header, data.length, 22); // uncompressed size
    writeUInt16LE(header, nameBytes.length, 26); // name length
    writeUInt16LE(header, 0, 28);         // extra field length

    entries.push({ name: file.name, data, crc32: crc, offset });
    parts.push(header, nameBytes, data);
    offset += 30 + nameBytes.length + data.length;
  }

  // Central directory
  const cdParts: Buffer[] = [];
  const cdStart = offset;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    const cd = Buffer.alloc(46);
    writeUInt32LE(cd, 0x02014b50, 0);     // signature
    writeUInt16LE(cd, 20, 4);             // version made by
    writeUInt16LE(cd, 20, 6);             // version needed
    writeUInt16LE(cd, 0, 8);              // flags
    writeUInt16LE(cd, 0, 10);             // compression
    writeUInt16LE(cd, 0, 12);             // mod time
    writeUInt16LE(cd, 0, 14);             // mod date
    writeUInt32LE(cd, entry.crc32, 16);   // crc32
    writeUInt32LE(cd, entry.data.length, 20); // compressed size
    writeUInt32LE(cd, entry.data.length, 24); // uncompressed size
    writeUInt16LE(cd, nameBytes.length, 28);  // name length
    writeUInt16LE(cd, 0, 30);             // extra length
    writeUInt16LE(cd, 0, 32);             // comment length
    writeUInt16LE(cd, 0, 34);             // disk start
    writeUInt16LE(cd, 0, 36);             // internal attr
    writeUInt32LE(cd, 0, 38);             // external attr
    writeUInt32LE(cd, entry.offset, 42);  // local header offset
    cdParts.push(cd, nameBytes);
  }

  const cdSize = cdParts.reduce((s, b) => s + b.length, 0);

  // End of central directory
  const eocd = Buffer.alloc(22);
  writeUInt32LE(eocd, 0x06054b50, 0);    // signature
  writeUInt16LE(eocd, 0, 4);             // disk number
  writeUInt16LE(eocd, 0, 6);             // cd start disk
  writeUInt16LE(eocd, entries.length, 8); // entries on disk
  writeUInt16LE(eocd, entries.length, 10); // total entries
  writeUInt32LE(eocd, cdSize, 12);        // cd size
  writeUInt32LE(eocd, cdStart, 16);       // cd offset
  writeUInt16LE(eocd, 0, 20);             // comment length

  return Buffer.concat([...parts, ...cdParts, eocd]);
}

/**
 * Parse a ZIP buffer and return name→content pairs for .md files.
 * Used for import. Ignores non-markdown files and directories.
 */
export function parseZip(buf: Buffer): { name: string; content: string }[] {
  const files: { name: string; content: string }[] = [];
  let pos = 0;

  while (pos < buf.length - 4) {
    const sig = buf.readUInt32LE(pos);
    if (sig !== 0x04034b50) break; // not a local file header

    const compression = buf.readUInt16LE(pos + 8);
    const compressedSize = buf.readUInt32LE(pos + 18);
    const nameLen = buf.readUInt16LE(pos + 26);
    const extraLen = buf.readUInt16LE(pos + 28);

    const name = buf.slice(pos + 30, pos + 30 + nameLen).toString('utf8');
    const dataStart = pos + 30 + nameLen + extraLen;
    const dataEnd = dataStart + compressedSize;

    if (compression === 0 && name.endsWith('.md') && !name.endsWith('/')) {
      const content = buf.slice(dataStart, dataEnd).toString('utf8');
      files.push({ name, content });
    }

    pos = dataEnd;
    // Skip data descriptor if present (flag bit 3)
    const flags = buf.readUInt16LE(pos - compressedSize - nameLen - extraLen - 22 + 6);
    if (flags & 0x08) pos += 16;
  }

  return files;
}

/** Sanitize a string for use as a filename. */
export function sanitizeFilename(s: string): string {
  return s
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 100)
    .replace(/^\.+/, '') || 'entry';
}

