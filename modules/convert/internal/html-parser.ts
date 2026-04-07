/** Contract: contracts/convert/rules.md */

/**
 * Parses HTML into ProseMirror JSON for document import.
 *
 * Server-side parser that converts Collabora's HTML output
 * into a valid ProseMirror document structure with blockIds.
 */

import { randomUUID } from 'node:crypto';
import type { ProseMirrorNode } from '../../document/contract.ts';

/** Inline mark types we extract from HTML */
const INLINE_TAG_MARKS: Record<string, string> = {
  STRONG: 'bold',
  B: 'bold',
  EM: 'italic',
  I: 'italic',
  U: 'underline',
  S: 'strike',
  STRIKE: 'strike',
  CODE: 'code',
};

/** Block-level tag to ProseMirror node type */
const BLOCK_TAG_MAP: Record<string, string> = {
  P: 'paragraph',
  H1: 'heading',
  H2: 'heading',
  H3: 'heading',
  H4: 'heading',
  H5: 'heading',
  H6: 'heading',
  BLOCKQUOTE: 'blockquote',
  PRE: 'codeBlock',
  LI: 'listItem',
};

function headingLevel(tag: string): number | null {
  const match = /^H([1-6])$/.exec(tag);
  return match ? parseInt(match[1], 10) : null;
}

/** Create a text node with optional marks */
function textNode(
  text: string,
  marks?: Array<{ type: string }>
): ProseMirrorNode {
  const node: ProseMirrorNode = { type: 'text', text };
  if (marks && marks.length > 0) {
    node.marks = marks;
  }
  return node;
}

/** Create a block node with a blockId */
function blockNode(
  type: string,
  content: ProseMirrorNode[],
  attrs?: Record<string, unknown>
): ProseMirrorNode {
  return {
    type,
    attrs: { blockId: randomUUID(), ...attrs },
    content: content.length > 0 ? content : undefined,
  };
}

/**
 * Parse raw HTML string into a ProseMirror JSON document.
 * Uses regex-based parsing for server-side use (no DOM).
 */
export function htmlToProseMirrorJson(html: string): {
  type: 'doc';
  content: ProseMirrorNode[];
} {
  const blocks = extractBlocks(html);

  if (blocks.length === 0) {
    return {
      type: 'doc',
      content: [blockNode('paragraph', [textNode('')])],
    };
  }

  return { type: 'doc', content: blocks };
}

/** Extract block-level elements from HTML */
function extractBlocks(html: string): ProseMirrorNode[] {
  const blocks: ProseMirrorNode[] = [];
  const blockPattern =
    /<(p|h[1-6]|blockquote|pre|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(html)) !== null) {
    const tag = match[1].toUpperCase();
    const inner = match[2];
    const nodeType = BLOCK_TAG_MAP[tag] || 'paragraph';
    const inlineContent = parseInlineContent(inner);

    const attrs: Record<string, unknown> = {};
    const level = headingLevel(tag);
    if (level !== null) {
      attrs.level = level;
    }

    blocks.push(blockNode(nodeType, inlineContent, attrs));
  }

  if (blocks.length === 0) {
    const stripped = stripTags(html).trim();
    if (stripped) {
      blocks.push(blockNode('paragraph', [textNode(stripped)]));
    }
  }

  return blocks;
}

/** Parse inline content (bold, italic, etc.) within a block */
function parseInlineContent(html: string): ProseMirrorNode[] {
  const nodes: ProseMirrorNode[] = [];
  const inlinePattern =
    /<(strong|b|em|i|u|s|strike|code)\b[^>]*>([\s\S]*?)<\/\1>|([^<]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = inlinePattern.exec(html)) !== null) {
    if (match[3]) {
      const text = decodeEntities(match[3]);
      if (text) nodes.push(textNode(text));
    } else if (match[1] && match[2]) {
      const tag = match[1].toUpperCase();
      const markType = INLINE_TAG_MARKS[tag];
      const text = decodeEntities(stripTags(match[2]));
      if (text && markType) {
        nodes.push(textNode(text, [{ type: markType }]));
      }
    }
  }

  if (nodes.length === 0) {
    const plain = decodeEntities(stripTags(html)).trim();
    if (plain) nodes.push(textNode(plain));
  }

  return nodes;
}

/** Strip HTML tags */
export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/** Decode basic HTML entities */
export function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
