/** Contract: contracts/convert/rules.md */

/**
 * Shared utilities for HTML parsing: entity decoding, tag stripping,
 * balanced tag matching, and table/list structure extraction.
 */

import type { ProseMirrorNode } from '../../document/contract/index.ts';

/** Inline mark types we extract from HTML */
export const INLINE_TAG_MARKS: Record<string, string> = {
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
export const BLOCK_TAG_MAP: Record<string, string> = {
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
export const LIST_TAG_MAP: Record<string, string> = {
  UL: 'bulletList',
  OL: 'orderedList',
};

/** Tags that can nest and need balanced matching */
export const NESTED_TAGS = new Set(['ul', 'ol', 'table']);

export function headingLevel(tag: string): number | null {
  const match = /^H([1-6])$/.exec(tag);
  return match ? parseInt(match[1], 10) : null;
}

/** Create a text node with optional marks */
export function textNode(
  text: string,
  marks?: Array<{ type: string }>
): ProseMirrorNode {
  const node: ProseMirrorNode = { type: 'text', text };
  if (marks && marks.length > 0) {
    node.marks = marks;
  }
  return node;
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

/** Find the content between a tag open and its balanced close */
export function findBalancedClose(
  html: string,
  start: number,
  tag: string
): string | null {
  let depth = 1;
  const openRe = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
  const closeRe = new RegExp(`</${tag}>`, 'gi');
  openRe.lastIndex = start;
  closeRe.lastIndex = start;

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

/** Parse inline content (bold, italic, etc.) within a block */
export function parseInlineContent(html: string): ProseMirrorNode[] {
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
