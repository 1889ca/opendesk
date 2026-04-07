/** Contract: contracts/convert/rules.md */

import { describe, it, expect } from 'vitest';
import { buildSnapshot, ImportError } from './importer.ts';

describe('buildSnapshot', () => {
  it('produces a valid DocumentSnapshot from simple HTML', () => {
    const html = '<p>Hello world</p>';
    const snapshot = buildSnapshot(html);

    expect(snapshot.documentType).toBe('text');
    expect(snapshot.schemaVersion).toBe('1.0.0');
    expect(snapshot.content.type).toBe('doc');
    expect(snapshot.content.content.length).toBeGreaterThan(0);
  });

  it('produces a snapshot with correct paragraph content', () => {
    const html = '<p>Test content</p>';
    const snapshot = buildSnapshot(html);
    const firstBlock = snapshot.content.content[0];

    expect(firstBlock.type).toBe('paragraph');
    expect(firstBlock.attrs?.blockId).toBeDefined();
    expect(firstBlock.content?.[0].text).toBe('Test content');
  });

  it('handles multiple paragraphs', () => {
    const html = '<p>First</p><p>Second</p>';
    const snapshot = buildSnapshot(html);

    expect(snapshot.content.content).toHaveLength(2);
  });

  it('handles headings', () => {
    const html = '<h1>Title</h1><p>Body text</p>';
    const snapshot = buildSnapshot(html);

    expect(snapshot.content.content[0].type).toBe('heading');
    expect(snapshot.content.content[0].attrs?.level).toBe(1);
    expect(snapshot.content.content[1].type).toBe('paragraph');
  });

  it('produces a default paragraph for empty HTML', () => {
    const snapshot = buildSnapshot('');
    expect(snapshot.content.content).toHaveLength(1);
    expect(snapshot.content.content[0].type).toBe('paragraph');
  });

  it('handles inline formatting (bold)', () => {
    const html = '<p><strong>bold text</strong></p>';
    const snapshot = buildSnapshot(html);
    const textNode = snapshot.content.content[0].content?.[0];

    expect(textNode?.text).toBe('bold text');
    expect(textNode?.marks).toEqual([{ type: 'bold' }]);
  });

  it('each block has a unique UUIDv4 blockId', () => {
    const html = '<p>A</p><p>B</p><p>C</p>';
    const snapshot = buildSnapshot(html);
    const ids = snapshot.content.content.map((n) => n.attrs?.blockId);

    ids.forEach((id) => expect(id).toBeDefined());

    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    ids.forEach((id) => expect(String(id)).toMatch(uuidRegex));
  });

  it('snapshot passes DocumentSnapshotSchema validation', () => {
    const html = '<h2>Heading</h2><p>Paragraph with <em>italic</em></p>';
    expect(() => buildSnapshot(html)).not.toThrow();
  });
});

describe('ImportError', () => {
  it('has correct name and code', () => {
    const err = new ImportError('test', 'TEST_CODE');
    expect(err.name).toBe('ImportError');
    expect(err.code).toBe('TEST_CODE');
    expect(err.message).toBe('test');
  });
});
