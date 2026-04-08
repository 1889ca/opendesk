/** Contract: contracts/convert/rules.md */

import { describe, it, expect } from 'vitest';
import { htmlToProseMirrorJson, stripTags, decodeEntities } from './html-parser.ts';

describe('htmlToProseMirrorJson — inline marks', () => {
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

  it('decodes HTML entities', () => {
    const html = '<p>A &amp; B &lt; C &gt; D</p>';
    const result = htmlToProseMirrorJson(html);
    expect(result.content[0].content?.[0].text).toBe('A & B < C > D');
  });

  // --- Collabora/LibreOffice HTML patterns ---

  it('parses span with font-weight style as bold', () => {
    const html = '<p><span style="font-weight: bold">Bold via CSS</span></p>';
    const result = htmlToProseMirrorJson(html);
    const text = result.content[0].content![0];
    expect(text.marks).toEqual([{ type: 'bold' }]);
    expect(text.text).toBe('Bold via CSS');
  });

  it('parses span with font-weight 700 as bold', () => {
    const html = '<p><span style="font-weight: 700">Bold 700</span></p>';
    const result = htmlToProseMirrorJson(html);
    expect(result.content[0].content![0].marks).toEqual([{ type: 'bold' }]);
  });

  it('parses span with font-style italic', () => {
    const html = '<p><span style="font-style: italic">Italic via CSS</span></p>';
    const result = htmlToProseMirrorJson(html);
    expect(result.content[0].content![0].marks).toEqual([{ type: 'italic' }]);
  });

  it('parses span with text-decoration underline', () => {
    const html = '<p><span style="text-decoration: underline">Underlined</span></p>';
    const result = htmlToProseMirrorJson(html);
    expect(result.content[0].content![0].marks).toEqual([{ type: 'underline' }]);
  });

  it('parses span with line-through as strike', () => {
    const html = '<p><span style="text-decoration: line-through">Struck</span></p>';
    const result = htmlToProseMirrorJson(html);
    expect(result.content[0].content![0].marks).toEqual([{ type: 'strike' }]);
  });

  it('handles span without style (plain text)', () => {
    const html = '<p><span class="foo">Plain</span></p>';
    const result = htmlToProseMirrorJson(html);
    expect(result.content[0].content![0].text).toBe('Plain');
    expect(result.content[0].content![0].marks).toBeUndefined();
  });

  it('skips unrecognized tags without leaking attributes', () => {
    const html = '<p><div class="wrapper">Text</div></p>';
    const result = htmlToProseMirrorJson(html);
    const text = result.content[0].content![0];
    expect(text.text).toBe('Text');
    expect(text.text).not.toContain('class');
  });

  it('handles full HTML document wrapper', () => {
    const html = '<html><body><p>Hello</p><ul><li>Item</li></ul></body></html>';
    const result = htmlToProseMirrorJson(html);
    expect(result.content).toHaveLength(2);
    expect(result.content[0].type).toBe('paragraph');
    expect(result.content[1].type).toBe('bulletList');
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
