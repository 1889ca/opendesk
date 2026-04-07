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
