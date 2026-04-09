/** Contract: contracts/app/rules.md */
/**
 * Inline SVG icons for the formatting toolbar.
 * Each function returns an SVG string for a specific toolbar action.
 * Icons are 16×16 viewBox, rendered at button size via CSS.
 */

function svg(content: string, extraAttrs = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" fill="currentColor" ${extraAttrs}>${content}</svg>`;
}

export const icons: Record<string, string> = {
  bold: svg('<text x="2" y="13" font-family="Georgia,serif" font-size="14" font-weight="700">B</text>'),
  italic: svg('<text x="3" y="13" font-family="Georgia,serif" font-size="14" font-style="italic">I</text>'),
  strikethrough: svg(
    '<text x="1" y="13" font-family="Georgia,serif" font-size="14" text-decoration="line-through">S</text>'
  ),
  inlineCode: svg(
    '<text x="1" y="12" font-family="monospace" font-size="11" fill="currentColor">&lt;/&gt;</text>'
  ),
  heading1: svg('<text x="1" y="13" font-family="inherit" font-size="11" font-weight="700">H1</text>'),
  heading2: svg('<text x="1" y="13" font-family="inherit" font-size="11" font-weight="700">H2</text>'),
  heading3: svg('<text x="1" y="13" font-family="inherit" font-size="11" font-weight="700">H3</text>'),
  bulletList: svg(
    '<circle cx="2.5" cy="4" r="1.5"/><rect x="6" y="3" width="9" height="2" rx="1"/>' +
    '<circle cx="2.5" cy="9" r="1.5"/><rect x="6" y="8" width="9" height="2" rx="1"/>' +
    '<circle cx="2.5" cy="14" r="1.5"/><rect x="6" y="13" width="9" height="2" rx="1"/>'
  ),
  orderedList: svg(
    '<text x="0" y="5.5" font-family="monospace" font-size="5">1.</text>' +
    '<rect x="6" y="3" width="9" height="2" rx="1"/>' +
    '<text x="0" y="10.5" font-family="monospace" font-size="5">2.</text>' +
    '<rect x="6" y="8" width="9" height="2" rx="1"/>' +
    '<text x="0" y="15.5" font-family="monospace" font-size="5">3.</text>' +
    '<rect x="6" y="13" width="9" height="2" rx="1"/>'
  ),
  blockquote: svg(
    '<rect x="1" y="2" width="3" height="12" rx="1.5"/>' +
    '<rect x="6" y="4" width="9" height="2" rx="1"/>' +
    '<rect x="6" y="8" width="7" height="2" rx="1"/>' +
    '<rect x="6" y="12" width="8" height="2" rx="1"/>'
  ),
  codeBlock: svg(
    '<polyline points="4,5 1,8 4,11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<polyline points="12,5 15,8 12,11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<line x1="9.5" y1="3" x2="6.5" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  ),
  horizontalRule: svg(
    '<rect x="1" y="7" width="14" height="2" rx="1"/>' +
    '<rect x="4" y="3" width="8" height="1.5" rx="0.75" opacity="0.4"/>' +
    '<rect x="4" y="11.5" width="8" height="1.5" rx="0.75" opacity="0.4"/>'
  ),
  table: svg(
    '<rect x="1" y="1" width="14" height="14" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="1" y1="5.5" x2="15" y2="5.5" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="1" y1="10" x2="15" y2="10" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="5.5" y1="1" x2="5.5" y2="15" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="10.5" y1="1" x2="10.5" y2="15" stroke="currentColor" stroke-width="1.2"/>'
  ),
  image: svg(
    '<rect x="1" y="2" width="14" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<circle cx="5" cy="6" r="1.5"/>' +
    '<polyline points="1,11 5,7 8,10 11,7 15,11" fill="none" stroke="currentColor" stroke-width="1.2"/>'
  ),
  emoji: svg('<text x="2" y="13" font-size="12">\uD83D\uDE00</text>'),
  search: svg(
    '<circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
    '<line x1="10" y1="10" x2="14.5" y2="14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  ),
  comment: svg(
    '<path d="M2 2h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V3a1 1 0 011-1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>'
  ),
  suggest: svg(
    '<path d="M8 1l1.8 3.6L14 5.3l-3 2.9.7 4.1L8 10.4l-3.7 1.9.7-4.1L2 5.3l4.2-.7z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>'
  ),
  pageBreak: svg(
    '<line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2,2"/>' +
    '<rect x="5" y="1" width="6" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<rect x="5" y="11" width="6" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>'
  ),
  toc: svg(
    '<rect x="1" y="2" width="5" height="1.5" rx="0.75"/>' +
    '<rect x="1" y="5.5" width="14" height="1.5" rx="0.75"/>' +
    '<rect x="1" y="9" width="11" height="1.5" rx="0.75"/>' +
    '<rect x="1" y="12.5" width="13" height="1.5" rx="0.75"/>'
  ),
  print: svg(
    '<rect x="3" y="1" width="10" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<rect x="2" y="6" width="12" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<rect x="4" y="9" width="8" height="1.2" rx="0.6"/>' +
    '<rect x="4" y="11" width="5" height="1.2" rx="0.6"/>'
  ),
  pdf: svg(
    '<rect x="2" y="1" width="10" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="2" y1="5" x2="12" y2="5" stroke="currentColor" stroke-width="1.2"/>' +
    '<text x="3.5" y="11.5" font-family="monospace" font-size="5" font-weight="700">PDF</text>' +
    '<polyline points="12,8 14,10 12,12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>'
  ),
  references: svg(
    '<rect x="2" y="1" width="8" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<rect x="6" y="5" width="8" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.6"/>' +
    '<line x1="4" y1="4" x2="8" y2="4" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="4" y1="6.5" x2="8" y2="6.5" stroke="currentColor" stroke-width="1.2"/>'
  ),
  versions: svg(
    '<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<polyline points="8,4 8,8 11,10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
  ),
  workflows: svg(
    '<circle cx="4" cy="4" r="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<circle cx="12" cy="4" r="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<circle cx="8" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="6.5" y1="4" x2="9.5" y2="4" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="5" y1="6" x2="7" y2="10" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="11" y1="6" x2="9" y2="10" stroke="currentColor" stroke-width="1.2"/>'
  ),
  saveToKb: svg(
    '<path d="M3 1h10l2 2v11a1 1 0 01-1 1H2a1 1 0 01-1-1V2a1 1 0 011-1z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<rect x="5" y="1" width="6" height="5" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<rect x="3" y="9" width="10" height="5" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.2"/>'
  ),
  shortcuts: svg(
    '<rect x="1" y="3" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<text x="5.5" y="11" font-family="monospace" font-size="8" font-weight="700">?</text>'
  ),
};

/** Return the SVG icon string for the given icon name, or empty string if not found. */
export function getIcon(name: string): string {
  return icons[name] ?? '';
}
