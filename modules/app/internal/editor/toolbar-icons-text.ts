/** Contract: contracts/app/rules.md */
/**
 * SVG icons for text formatting, headings, undo/redo, alignment, lists, and block types.
 * Split from toolbar-icons.ts to satisfy the 200-line limit.
 */

export function svg(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" fill="currentColor">${content}</svg>`;
}

export const textIcons: Record<string, string> = {
  bold: svg('<path d="M4 2h4.5a3 3 0 012 5.2A3.2 3.2 0 019 14H4V2zm2 2v3h2.5a1 1 0 000-2H6zm0 5v3H9a1.2 1.2 0 000-2.4L6 9z"/>'),
  italic: svg(
    '<line x1="10" y1="2" x2="8" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="7" y1="2" x2="11" y2="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="5" y1="14" x2="9" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  ),
  strikethrough: svg(
    '<path d="M4 6.5C4 4.6 5.8 3 8 3s4 1.6 4 3.5c0 .9-.4 1.6-1 2.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M12 9.5c0 1.9-1.8 3.5-4 3.5S4 11.4 4 9.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  ),
  underline: svg(
    '<path d="M4 2v5.5a4 4 0 008 0V2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="3" y1="14" x2="13" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  ),
  inlineCode: svg(
    '<polyline points="5,5 2,8 5,11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<polyline points="11,5 14,8 11,11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  heading1: svg(
    '<line x1="2" y1="3" x2="2" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="2" y1="8" x2="8" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="11" y1="5" x2="11" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="10" y1="6.5" x2="11" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  ),
  heading2: svg(
    '<line x1="2" y1="3" x2="2" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="2" y1="8" x2="8" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M10.5 6a1.5 1.5 0 013 0c0 1-1.5 1.8-1.5 3h1.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  heading3: svg(
    '<line x1="2" y1="3" x2="2" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="2" y1="8" x2="8" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M10.5 6a1.5 1.5 0 013 0 1.5 1.5 0 01-1.5 1.5 1.5 1.5 0 011.5 1.5 1.5 1.5 0 01-3 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  undo: svg(
    '<path d="M3 8a5 5 0 105 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<polyline points="2,4 2,8 6,8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  redo: svg(
    '<path d="M13 8a5 5 0 10-5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<polyline points="14,4 14,8 10,8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  alignLeft: svg(
    '<line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="2" y1="8" x2="10" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="2" y1="12" x2="13" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  ),
  alignCenter: svg(
    '<line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="3" y1="12" x2="13" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  ),
  alignRight: svg(
    '<line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="6" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="3" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  ),
  alignJustify: svg(
    '<line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  ),
  bulletList: svg(
    '<circle cx="3" cy="4.5" r="1.2"/>' +
    '<line x1="6.5" y1="4.5" x2="14" y2="4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<circle cx="3" cy="8.5" r="1.2"/>' +
    '<line x1="6.5" y1="8.5" x2="14" y2="8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<circle cx="3" cy="12.5" r="1.2"/>' +
    '<line x1="6.5" y1="12.5" x2="14" y2="12.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  ),
  orderedList: svg(
    '<line x1="6.5" y1="4.5" x2="14" y2="4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="6.5" y1="8.5" x2="14" y2="8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="6.5" y1="12.5" x2="14" y2="12.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="3" y1="3" x2="3" y2="6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
    '<line x1="2.2" y1="4" x2="3" y2="3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
    '<path d="M2,9.5 a1,1 0 012,0 c0,.7-2,1.7-2,2.5h2" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  indent: svg(
    '<line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="6" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="6" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<polyline points="2,7 5,8.5 2,10" fill="currentColor" stroke="none"/>',
  ),
  outdent: svg(
    '<line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="6" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="6" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<polyline points="5,7 2,8.5 5,10" fill="currentColor" stroke="none"/>',
  ),
  blockquote: svg(
    '<rect x="2" y="2" width="3" height="12" rx="1.5"/>' +
    '<line x1="7" y1="4.5" x2="14" y2="4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="7" y1="8" x2="12" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="7" y1="11.5" x2="13" y2="11.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  ),
  codeBlock: svg(
    '<rect x="1" y="2" width="14" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<polyline points="5,6 3,8 5,10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<polyline points="11,6 13,8 11,10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<line x1="8.5" y1="5.5" x2="7.5" y2="10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  ),
  horizontalRule: svg(
    '<line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="5" y1="4.5" x2="11" y2="4.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.35"/>' +
    '<line x1="5" y1="11.5" x2="11" y2="11.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.35"/>',
  ),
};
