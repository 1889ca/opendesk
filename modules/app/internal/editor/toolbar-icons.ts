/** Contract: contracts/app/rules.md */
/**
 * Inline SVG icons for the formatting toolbar.
 * Each icon uses geometric paths/shapes — no SVG <text> elements — so they
 * render at every size without font-loading dependencies.
 * Icons are 16×16 viewBox, rendered at button size via CSS.
 */

function svg(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" fill="currentColor">${content}</svg>`;
}

export const icons: Record<string, string> = {
  // ── Text formatting ─────────────────────────────────────────────────
  bold: svg(
    // Geometric bold "B" letterform
    '<path d="M4 2h4.5a3 3 0 012 5.2A3.2 3.2 0 019 14H4V2zm2 2v3h2.5a1 1 0 000-2H6zm0 5v3H9a1.2 1.2 0 000-2.4L6 9z"/>'
  ),
  italic: svg(
    // Slanted bar with serifs
    '<line x1="10" y1="2" x2="8" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="7" y1="2" x2="11" y2="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="5" y1="14" x2="9" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  ),
  strikethrough: svg(
    '<path d="M4 6.5C4 4.6 5.8 3 8 3s4 1.6 4 3.5c0 .9-.4 1.6-1 2.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M12 9.5c0 1.9-1.8 3.5-4 3.5S4 11.4 4 9.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  ),
  underline: svg(
    '<path d="M4 2v5.5a4 4 0 008 0V2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="3" y1="14" x2="13" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  ),
  inlineCode: svg(
    '<polyline points="5,5 2,8 5,11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<polyline points="11,5 14,8 11,11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
  ),

  // ── Headings ─────────────────────────────────────────────────────────
  heading1: svg(
    // H + subscript 1 using clean geometric lines
    '<line x1="2" y1="3" x2="2" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="2" y1="8" x2="8" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="11" y1="5" x2="11" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="10" y1="6.5" x2="11" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  ),
  heading2: svg(
    '<line x1="2" y1="3" x2="2" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="2" y1="8" x2="8" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M10.5 6a1.5 1.5 0 013 0c0 1-1.5 1.8-1.5 3h1.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'
  ),
  heading3: svg(
    '<line x1="2" y1="3" x2="2" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="2" y1="8" x2="8" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M10.5 6a1.5 1.5 0 013 0 1.5 1.5 0 01-1.5 1.5 1.5 1.5 0 011.5 1.5 1.5 1.5 0 01-3 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'
  ),

  // ── Undo / Redo ───────────────────────────────────────────────────────
  undo: svg(
    '<path d="M3 8a5 5 0 105 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<polyline points="2,4 2,8 6,8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
  ),
  redo: svg(
    '<path d="M13 8a5 5 0 105-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<polyline points="14,4 14,8 10,8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
  ),

  // ── Text alignment ────────────────────────────────────────────────────
  alignLeft: svg(
    '<line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="2" y1="8" x2="10" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="2" y1="12" x2="13" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  ),
  alignCenter: svg(
    '<line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="3" y1="12" x2="13" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  ),
  alignRight: svg(
    '<line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="6" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="3" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  ),
  alignJustify: svg(
    '<line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  ),

  // ── Lists ─────────────────────────────────────────────────────────────
  bulletList: svg(
    '<circle cx="3" cy="4.5" r="1.2"/>' +
    '<line x1="6.5" y1="4.5" x2="14" y2="4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<circle cx="3" cy="8.5" r="1.2"/>' +
    '<line x1="6.5" y1="8.5" x2="14" y2="8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<circle cx="3" cy="12.5" r="1.2"/>' +
    '<line x1="6.5" y1="12.5" x2="14" y2="12.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  ),
  orderedList: svg(
    '<line x1="6.5" y1="4.5" x2="14" y2="4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="6.5" y1="8.5" x2="14" y2="8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="6.5" y1="12.5" x2="14" y2="12.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    // Number glyphs as paths
    '<line x1="3" y1="3" x2="3" y2="6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
    '<line x1="2.2" y1="4" x2="3" y2="3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
    '<path d="M2,9.5 a1,1 0 012,0 c0,.7-2,1.7-2,2.5h2" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>'
  ),

  // ── Indent / Outdent ──────────────────────────────────────────────────
  indent: svg(
    '<line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="6" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="6" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<polyline points="2,7 5,8.5 2,10" fill="currentColor" stroke="none"/>'
  ),
  outdent: svg(
    '<line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="6" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="6" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<polyline points="5,7 2,8.5 5,10" fill="currentColor" stroke="none"/>'
  ),

  // ── Block types ───────────────────────────────────────────────────────
  blockquote: svg(
    '<rect x="2" y="2" width="3" height="12" rx="1.5"/>' +
    '<line x1="7" y1="4.5" x2="14" y2="4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="7" y1="8" x2="12" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="7" y1="11.5" x2="13" y2="11.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  ),
  codeBlock: svg(
    '<rect x="1" y="2" width="14" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<polyline points="5,6 3,8 5,10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<polyline points="11,6 13,8 11,10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<line x1="8.5" y1="5.5" x2="7.5" y2="10.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'
  ),
  horizontalRule: svg(
    '<line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="5" y1="4.5" x2="11" y2="4.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.35"/>' +
    '<line x1="5" y1="11.5" x2="11" y2="11.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.35"/>'
  ),

  // ── Insert ────────────────────────────────────────────────────────────
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
    '<polyline points="1,11 5,7.5 8,10 11,7 15,11" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>'
  ),
  emoji: svg(
    '<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<circle cx="5.5" cy="6.5" r="1"/>' +
    '<circle cx="10.5" cy="6.5" r="1"/>' +
    '<path d="M5.5 10.5 Q8 13 10.5 10.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>'
  ),
  link: svg(
    '<path d="M7 9a4 4 0 006 0l1.5-1.5a4 4 0 00-5.7-5.7L7.5 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M9 7a4 4 0 00-6 0L1.5 8.5a4 4 0 005.7 5.7L8.5 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'
  ),

  // ── Editor tools ──────────────────────────────────────────────────────
  search: svg(
    '<circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
    '<line x1="10" y1="10" x2="14.5" y2="14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  ),
  comment: svg(
    '<path d="M2 2h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V3a1 1 0 011-1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>'
  ),
  suggest: svg(
    '<path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5l3.5-.5z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>'
  ),
  pageBreak: svg(
    '<line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2.5,2" stroke-linecap="round"/>' +
    '<rect x="5" y="1.5" width="6" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<rect x="5" y="10.5" width="6" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>'
  ),
  toc: svg(
    '<line x1="2" y1="2.5" x2="5.5" y2="2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '<line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
    '<line x1="2" y1="9.5" x2="11" y2="9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
    '<line x1="2" y1="13" x2="13" y2="13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'
  ),

  // ── Document actions ──────────────────────────────────────────────────
  print: svg(
    '<rect x="3" y="1" width="10" height="5.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<rect x="2" y="5.5" width="12" height="7.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="4.5" y1="9" x2="11.5" y2="9" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>' +
    '<line x1="4.5" y1="11" x2="9" y2="11" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>'
  ),
  pdf: svg(
    '<rect x="2" y="1" width="9" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="2" y1="5" x2="11" y2="5" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="4.5" y1="8" x2="8.5" y2="8" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>' +
    '<line x1="4.5" y1="10" x2="7.5" y2="10" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>' +
    '<polyline points="11,8 14,10 11,12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>'
  ),
  references: svg(
    '<rect x="2" y="1" width="8" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<rect x="6" y="5" width="8" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.6"/>' +
    '<line x1="4" y1="4" x2="8" y2="4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>' +
    '<line x1="4" y1="6.5" x2="8" y2="6.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>'
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
    '<rect x="5" y="1" width="6" height="4.5" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<rect x="3" y="9" width="10" height="5" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.2"/>'
  ),
  shortcuts: svg(
    '<rect x="1" y="3" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="8" y1="6" x2="8" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="6" y1="8" x2="10" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
  ),
};

/** Return the SVG icon string for the given icon name, or empty string if not found. */
export function getIcon(name: string): string {
  return icons[name] ?? '';
}
