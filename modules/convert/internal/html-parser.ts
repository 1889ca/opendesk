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
};

/** List wrapper tag to ProseMirror node type */
const LIST_TAG_MAP: Record<string, string> = {
  UL: 'bulletList',
  OL: 'orderedList',
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

/** Tags that can nest and need balanced matching */
const NESTED_TAGS = new Set(['ul', 'ol', 'table']);

/** Extract block-level elements from HTML */
function extractBlocks(html: string): ProseMirrorNode[] {
  const blocks: ProseMirrorNode[] = [];
  // Match opening tags for all block-level elements
  const openPattern =
    /<(ul|ol|table|p|h[1-6]|blockquote|pre)\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = openPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const afterOpen = match.index + match[0].length;
    let inner: string | null;

    if (NESTED_TAGS.has(tag)) {
      // Use balanced close for nestable tags
      inner = findBalancedClose(html, afterOpen, tag);
      if (inner === null) continue;
      openPattern.lastIndex = afterOpen + inner.length + `</${tag}>`.length;
    } else {
      // Simple non-nesting blocks: use regex for close tag
      const closeRe = new RegExp(`</${tag}>`, 'gi');
      closeRe.lastIndex = afterOpen;
      const closeMatch = closeRe.exec(html);
      if (!closeMatch) continue;
      inner = html.slice(afterOpen, closeMatch.index);
      openPattern.lastIndex = closeMatch.index + closeMatch[0].length;
    }

    if (tag === 'ul' || tag === 'ol') {
      const listType = LIST_TAG_MAP[tag.toUpperCase()];
      const listItems = extractListItems(inner);
      blocks.push(blockNode(listType, listItems));
    } else if (tag === 'table') {
      blocks.push(parseTable(inner));
    } else {
      const tagUpper = tag.toUpperCase();
      const nodeType = BLOCK_TAG_MAP[tagUpper] || 'paragraph';
      const inlineContent = parseInlineContent(inner);
      const attrs: Record<string, unknown> = {};
      const level = headingLevel(tagUpper);
      if (level !== null) attrs.level = level;
      blocks.push(blockNode(nodeType, inlineContent, attrs));
    }
  }

  if (blocks.length === 0) {
    const stripped = stripTags(html).trim();
    if (stripped) {
      blocks.push(blockNode('paragraph', [textNode(stripped)]));
    }
  }

  return blocks;
}

/** Extract <li> elements from list inner HTML, handling nesting */
function extractListItems(html: string): ProseMirrorNode[] {
  const items: ProseMirrorNode[] = [];

  // Find each <li> and its balanced closing </li>
  const openLi = /<li\b[^>]*>/gi;
  let openMatch: RegExpExecArray | null;

  while ((openMatch = openLi.exec(html)) !== null) {
    const startAfterTag = openMatch.index + openMatch[0].length;
    const inner = findBalancedClose(html, startAfterTag, 'li');
    if (inner === null) continue;

    // Advance the outer regex past this entire <li>...</li>
    openLi.lastIndex = startAfterTag + inner.length + '</li>'.length;

    // Check for nested lists inside this <li>
    const nestedListPattern = /<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    const textBefore = inner.replace(nestedListPattern, '').trim();
    const content: ProseMirrorNode[] = [];

    if (textBefore) {
      const inlineContent = parseInlineContent(textBefore);
      if (inlineContent.length > 0) {
        content.push({ type: 'paragraph', content: inlineContent });
      }
    }

    let nestedMatch: RegExpExecArray | null;
    nestedListPattern.lastIndex = 0;
    while ((nestedMatch = nestedListPattern.exec(inner)) !== null) {
      const nestedType = LIST_TAG_MAP[nestedMatch[1].toUpperCase()];
      const nestedItems = extractListItems(nestedMatch[2]);
      content.push({ type: nestedType, content: nestedItems });
    }

    items.push({ type: 'listItem', content });
  }

  return items;
}

/** Find the content between a tag open and its balanced close */
function findBalancedClose(
  html: string,
  start: number,
  tag: string
): string | null {
  let depth = 1;
  const openRe = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
  const closeRe = new RegExp(`</${tag}>`, 'gi');
  openRe.lastIndex = start;
  closeRe.lastIndex = start;

  // Scan forward, tracking depth
  const events: Array<{ pos: number; type: 'open' | 'close' }> = [];
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(html)) !== null) {
    events.push({ pos: m.index, type: 'open' });
  }
  while ((m = closeRe.exec(html)) !== null) {
    events.push({ pos: m.index, type: 'close' });
  }
  events.sort((a, b) => a.pos - b.pos);

  for (const ev of events) {
    if (ev.type === 'open') depth++;
    else depth--;
    if (depth === 0) {
      return html.slice(start, ev.pos);
    }
  }
  return null;
}

/** Parse a <table> inner HTML into a ProseMirror table node */
function parseTable(html: string): ProseMirrorNode {
  const rows: ProseMirrorNode[] = [];
  const trPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trPattern.exec(html)) !== null) {
    const cells: ProseMirrorNode[] = [];
    const cellPattern = /<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellPattern.exec(trMatch[1])) !== null) {
      const isHeader = cellMatch[1].toUpperCase() === 'TH';
      const attrStr = cellMatch[2];
      const cellInner = cellMatch[3];
      const cellAttrs: Record<string, unknown> = {};

      // Extract colspan/rowspan
      const colspanMatch = /colspan\s*=\s*["']?(\d+)/i.exec(attrStr);
      if (colspanMatch) cellAttrs.colspan = parseInt(colspanMatch[1], 10);
      const rowspanMatch = /rowspan\s*=\s*["']?(\d+)/i.exec(attrStr);
      if (rowspanMatch) cellAttrs.rowspan = parseInt(rowspanMatch[1], 10);

      const cellContent = parseInlineContent(cellInner);
      const paragraph: ProseMirrorNode = {
        type: 'paragraph',
        content: cellContent.length > 0 ? cellContent : [textNode('')],
      };

      cells.push({
        type: isHeader ? 'tableHeader' : 'tableCell',
        attrs: Object.keys(cellAttrs).length > 0 ? cellAttrs : undefined,
        content: [paragraph],
      });
    }

    if (cells.length > 0) {
      rows.push({ type: 'tableRow', content: cells });
    }
  }

  return blockNode('table', rows);
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
