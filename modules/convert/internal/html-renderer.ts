/** Contract: contracts/convert/rules.md */

/**
 * Renders a DocumentSnapshot (ProseMirror JSON) to HTML.
 * Used for export: snapshot -> HTML -> Collabora -> target format.
 */

import type { ProseMirrorNode, DocumentSnapshot } from '../../document/contract.ts';

/** Render a full DocumentSnapshot to an HTML document string */
export function snapshotToHtml(snapshot: DocumentSnapshot): string {
  const bodyHtml = renderNodes(snapshot.content.content);
  return wrapHtmlDocument(bodyHtml);
}

/** Render a ProseMirror JSON content string to HTML (for client-sent HTML) */
export function contentToHtml(content: string): string {
  if (content.trim().startsWith('<')) {
    return wrapHtmlDocument(content);
  }
  const paragraphs = content
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('\n');
  return wrapHtmlDocument(paragraphs);
}

/** Render an array of ProseMirror nodes to HTML */
function renderNodes(nodes: ProseMirrorNode[] | undefined): string {
  if (!nodes || nodes.length === 0) return '';
  return nodes.map(renderNode).join('\n');
}

/** Render a single ProseMirror node to HTML */
export function renderNode(node: ProseMirrorNode): string {
  switch (node.type) {
    case 'doc':
      return renderNodes(node.content);
    case 'paragraph':
      return `<p>${renderInline(node.content)}</p>`;
    case 'heading': {
      const level = (node.attrs?.level as number) || 1;
      const tag = `h${Math.min(Math.max(level, 1), 6)}`;
      return `<${tag}>${renderInline(node.content)}</${tag}>`;
    }
    case 'blockquote':
      return `<blockquote>${renderNodes(node.content)}</blockquote>`;
    case 'codeBlock':
      return `<pre><code>${renderInline(node.content)}</code></pre>`;
    case 'bulletList':
      return `<ul>${renderNodes(node.content)}</ul>`;
    case 'orderedList':
      return `<ol>${renderNodes(node.content)}</ol>`;
    case 'listItem':
      return `<li>${renderNodes(node.content)}</li>`;
    case 'table':
      return `<table>${renderNodes(node.content)}</table>`;
    case 'tableRow':
      return `<tr>${renderNodes(node.content)}</tr>`;
    case 'tableCell': {
      const cs = node.attrs?.colspan && (node.attrs.colspan as number) > 1
        ? ` colspan="${node.attrs.colspan}"` : '';
      const rs = node.attrs?.rowspan && (node.attrs.rowspan as number) > 1
        ? ` rowspan="${node.attrs.rowspan}"` : '';
      return `<td${cs}${rs}>${renderNodes(node.content)}</td>`;
    }
    case 'tableHeader': {
      const cs = node.attrs?.colspan && (node.attrs.colspan as number) > 1
        ? ` colspan="${node.attrs.colspan}"` : '';
      const rs = node.attrs?.rowspan && (node.attrs.rowspan as number) > 1
        ? ` rowspan="${node.attrs.rowspan}"` : '';
      return `<th${cs}${rs}>${renderNodes(node.content)}</th>`;
    }
    case 'horizontalRule':
      return '<hr>';
    case 'text':
      return renderTextNode(node);
    default:
      return renderNodes(node.content);
  }
}

/** Render inline content within a block */
function renderInline(nodes: ProseMirrorNode[] | undefined): string {
  if (!nodes || nodes.length === 0) return '';
  return nodes.map(renderNode).join('');
}

/** Render a text node with its marks */
function renderTextNode(node: ProseMirrorNode): string {
  let html = escapeHtml(node.text || '');

  if (node.marks) {
    for (const mark of node.marks) {
      html = wrapMark(html, mark.type);
    }
  }

  return html;
}

/** Wrap text in the appropriate HTML tag for a mark */
function wrapMark(html: string, markType: string): string {
  switch (markType) {
    case 'bold': return `<strong>${html}</strong>`;
    case 'italic': return `<em>${html}</em>`;
    case 'underline': return `<u>${html}</u>`;
    case 'strike': return `<s>${html}</s>`;
    case 'code': return `<code>${html}</code>`;
    default: return html;
  }
}

/** Escape HTML special characters */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Wrap body HTML in a full document */
export function wrapHtmlDocument(body: string): string {
  return [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8"></head>',
    `<body>${body}</body>`,
    '</html>',
  ].join('\n');
}
