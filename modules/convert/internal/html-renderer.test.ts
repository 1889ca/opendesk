/** Contract: contracts/convert/rules.md */

import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  renderNode,
  wrapHtmlDocument,
  snapshotToHtml,
  contentToHtml,
} from './html-renderer.ts';
import type { ProseMirrorNode } from '../../document/contract/index.ts';

describe('escapeHtml', () => {
  it('escapes special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });
});

describe('renderNode', () => {
  it('renders a paragraph', () => {
    const node: ProseMirrorNode = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hello' }],
    };
    expect(renderNode(node)).toBe('<p>Hello</p>');
  });

  it('renders a heading with level', () => {
    const node: ProseMirrorNode = {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Title' }],
    };
    expect(renderNode(node)).toBe('<h2>Title</h2>');
  });

  it('renders bold text', () => {
    const node: ProseMirrorNode = {
      type: 'text',
      text: 'bold',
      marks: [{ type: 'bold' }],
    };
    expect(renderNode(node)).toBe('<strong>bold</strong>');
  });

  it('renders italic text', () => {
    const node: ProseMirrorNode = {
      type: 'text',
      text: 'italic',
      marks: [{ type: 'italic' }],
    };
    expect(renderNode(node)).toBe('<em>italic</em>');
  });

  it('renders nested marks', () => {
    const node: ProseMirrorNode = {
      type: 'text',
      text: 'both',
      marks: [{ type: 'bold' }, { type: 'italic' }],
    };
    expect(renderNode(node)).toBe('<em><strong>both</strong></em>');
  });

  it('renders a bullet list', () => {
    const node: ProseMirrorNode = {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }] },
      ],
    };
    expect(renderNode(node)).toBe('<ul><li><p>A</p></li>\n<li><p>B</p></li></ul>');
  });

  it('renders a table with headers', () => {
    const node: ProseMirrorNode = {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Name' }] }] },
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Age' }] }] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Alice' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '30' }] }] },
          ],
        },
      ],
    };
    const html = renderNode(node);
    expect(html).toContain('<table>');
    expect(html).toContain('<th><p>Name</p></th>');
    expect(html).toContain('<td><p>Alice</p></td>');
  });

  it('renders colspan and rowspan attributes', () => {
    const node: ProseMirrorNode = {
      type: 'tableCell',
      attrs: { colspan: 2, rowspan: 3 },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Wide' }] }],
    };
    expect(renderNode(node)).toBe('<td colspan="2" rowspan="3"><p>Wide</p></td>');
  });

  it('omits colspan/rowspan when 1', () => {
    const node: ProseMirrorNode = {
      type: 'tableCell',
      attrs: { colspan: 1, rowspan: 1 },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Normal' }] }],
    };
    expect(renderNode(node)).toBe('<td><p>Normal</p></td>');
  });
});

describe('wrapHtmlDocument', () => {
  it('wraps body in a full HTML document', () => {
    const result = wrapHtmlDocument('<p>Hello</p>');
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<body><p>Hello</p></body>');
    expect(result).toContain('<meta charset="utf-8">');
  });
});

describe('contentToHtml', () => {
  it('wraps HTML content in a document', () => {
    const result = contentToHtml('<p>Test</p>');
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<p>Test</p>');
  });

  it('converts plain text to paragraphs', () => {
    const result = contentToHtml('Line one\nLine two');
    expect(result).toContain('<p>Line one</p>');
    expect(result).toContain('<p>Line two</p>');
  });
});

describe('snapshotToHtml', () => {
  it('renders a full document snapshot', () => {
    const snapshot = {
      documentType: 'text' as const,
      schemaVersion: '1.0.0' as const,
      content: {
        type: 'doc' as const,
        content: [
          {
            type: 'paragraph',
            attrs: { blockId: '00000000-0000-4000-8000-000000000001' },
            content: [{ type: 'text', text: 'Hello world' }],
          },
        ],
      },
    };
    const html = snapshotToHtml(snapshot);
    expect(html).toContain('<p>Hello world</p>');
    expect(html).toContain('<!DOCTYPE html>');
  });
});
