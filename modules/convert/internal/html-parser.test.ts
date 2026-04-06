/** Contract: contracts/convert/rules.md */

import { describe, it, expect } from 'vitest';
import { htmlToProseMirrorJson, stripTags, decodeEntities } from './html-parser.ts';

describe('htmlToProseMirrorJson', () => {
  it('parses a single paragraph', () => {
    const result = htmlToProseMirrorJson('<p>Hello world</p>');
    expect(result.type).toBe('doc');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('paragraph');
    expect(result.content[0].content?.[0].text).toBe('Hello world');
  });

  it('parses multiple paragraphs', () => {
    const html = '<p>First</p><p>Second</p><p>Third</p>';
    const result = htmlToProseMirrorJson(html);
    expect(result.content).toHaveLength(3);
    expect(result.content[0].content?.[0].text).toBe('First');
    expect(result.content[2].content?.[0].text).toBe('Third');
  });

  it('parses headings with correct level', () => {
    const html = '<h1>Title</h1><h2>Subtitle</h2>';
    const result = htmlToProseMirrorJson(html);
    expect(result.content).toHaveLength(2);
    expect(result.content[0].type).toBe('heading');
    expect(result.content[0].attrs?.level).toBe(1);
    expect(result.content[1].attrs?.level).toBe(2);
  });

  it('parses bold text', () => {
    const html = '<p><strong>bold</strong> normal</p>';
    const result = htmlToProseMirrorJson(html);
    const content = result.content[0].content!;
    expect(content[0].marks).toEqual([{ type: 'bold' }]);
    expect(content[0].text).toBe('bold');
    expect(content[1].text).toBe(' normal');
    expect(content[1].marks).toBeUndefined();
  });

  it('parses italic text', () => {
    const html = '<p><em>italic</em></p>';
    const result = htmlToProseMirrorJson(html);
    const content = result.content[0].content!;
    expect(content[0].marks).toEqual([{ type: 'italic' }]);
  });

  it('generates unique blockIds for each block', () => {
    const html = '<p>One</p><p>Two</p>';
    const result = htmlToProseMirrorJson(html);
    const id1 = result.content[0].attrs?.blockId;
    const id2 = result.content[1].attrs?.blockId;
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
  });

  it('returns a default paragraph for empty input', () => {
    const result = htmlToProseMirrorJson('');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('paragraph');
  });

  it('handles plain text without block tags', () => {
    const result = htmlToProseMirrorJson('Just some text');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('paragraph');
    expect(result.content[0].content?.[0].text).toBe('Just some text');
  });

  it('decodes HTML entities', () => {
    const html = '<p>A &amp; B &lt; C &gt; D</p>';
    const result = htmlToProseMirrorJson(html);
    expect(result.content[0].content?.[0].text).toBe('A & B < C > D');
  });
});

describe('stripTags', () => {
  it('removes HTML tags', () => {
    expect(stripTags('<p>hello <b>world</b></p>')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(stripTags('')).toBe('');
  });
});

describe('decodeEntities', () => {
  it('decodes common entities', () => {
    expect(decodeEntities('&amp;&lt;&gt;&quot;&#39;&nbsp;'))
      .toBe('&<>"\' ');
  });
});
