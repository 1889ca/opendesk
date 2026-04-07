/** Contract: contracts/convert/rules.md */

/**
 * Parses HTML into ProseMirror JSON for document import.
 *
 * Server-side parser that converts Collabora's HTML output
 * into a valid ProseMirror document structure with blockIds.
 */

import { randomUUID } from 'node:crypto';
import type { ProseMirrorNode } from '../../document/contract/index.ts';
import {
  BLOCK_TAG_MAP,
  LIST_TAG_MAP,
  NESTED_TAGS,
  headingLevel,
  textNode,
  stripTags,
  findBalancedClose,
  parseInlineContent,
} from './html-parser-utils.ts';

// Re-export utilities used by other modules
export { stripTags, decodeEntities } from './html-parser-utils.ts';

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
  const openPattern =
    /<(ul|ol|table|p|h[1-6]|blockquote|pre)\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = openPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const afterOpen = match.index + match[0].length;
    let inner: string | null;

    if (NESTED_TAGS.has(tag)) {
      inner = findBalancedClose(html, afterOpen, tag);
      if (inner === null) continue;
      openPattern.lastIndex = afterOpen + inner.length + `</${tag}>`.length;
    } else {
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
  const openLi = /<li\b[^>]*>/gi;
  let openMatch: RegExpExecArray | null;

  while ((openMatch = openLi.exec(html)) !== null) {
    const startAfterTag = openMatch.index + openMatch[0].length;
    const inner = findBalancedClose(html, startAfterTag, 'li');
    if (inner === null) continue;

    openLi.lastIndex = startAfterTag + inner.length + '</li>'.length;

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
