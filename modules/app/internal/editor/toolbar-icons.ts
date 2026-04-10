/** Contract: contracts/app/rules.md */
/**
 * Formatting toolbar icons — inline SVGs using geometric paths, no <text> elements.
 * Icons split across toolbar-icons-text.ts (formatting/structure) and this file
 * (insert, tools, document actions).
 */
import { svg, textIcons } from './toolbar-icons-text.ts';

const insertIcons: Record<string, string> = {
  table: svg(
    '<rect x="1" y="1" width="14" height="14" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="1" y1="5.5" x2="15" y2="5.5" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="1" y1="10" x2="15" y2="10" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="5.5" y1="1" x2="5.5" y2="15" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="10.5" y1="1" x2="10.5" y2="15" stroke="currentColor" stroke-width="1.2"/>',
  ),
  image: svg(
    '<rect x="1" y="2" width="14" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<circle cx="5" cy="6" r="1.5"/>' +
    '<polyline points="1,11 5,7.5 8,10 11,7 15,11" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  emoji: svg(
    '<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<circle cx="5.5" cy="6.5" r="1"/>' +
    '<circle cx="10.5" cy="6.5" r="1"/>' +
    '<path d="M5.5 10.5 Q8 13 10.5 10.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
  ),
  link: svg(
    '<path d="M7 9a4 4 0 006 0l1.5-1.5a4 4 0 00-5.7-5.7L7.5 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M9 7a4 4 0 00-6 0L1.5 8.5a4 4 0 005.7 5.7L8.5 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  ),
  search: svg(
    '<circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
    '<line x1="10" y1="10" x2="14.5" y2="14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  ),
  comment: svg(
    '<path d="M2 2h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V3a1 1 0 011-1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  ),
  suggest: svg(
    '<path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5l3.5-.5z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>',
  ),
  pageBreak: svg(
    '<line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2.5,2" stroke-linecap="round"/>' +
    '<rect x="5" y="1.5" width="6" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<rect x="5" y="10.5" width="6" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  ),
  toc: svg(
    '<line x1="2" y1="2.5" x2="5.5" y2="2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '<line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
    '<line x1="2" y1="9.5" x2="11" y2="9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
    '<line x1="2" y1="13" x2="13" y2="13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  ),
  print: svg(
    '<rect x="3" y="1" width="10" height="5.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<rect x="2" y="5.5" width="12" height="7.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="4.5" y1="9" x2="11.5" y2="9" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>' +
    '<line x1="4.5" y1="11" x2="9" y2="11" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>',
  ),
  pdf: svg(
    '<rect x="2" y="1" width="9" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="2" y1="5" x2="11" y2="5" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="4.5" y1="8" x2="8.5" y2="8" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>' +
    '<line x1="4.5" y1="10" x2="7.5" y2="10" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>' +
    '<polyline points="11,8 14,10 11,12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  references: svg(
    '<rect x="2" y="1" width="8" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<rect x="6" y="5" width="8" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.6"/>' +
    '<line x1="4" y1="4" x2="8" y2="4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>' +
    '<line x1="4" y1="6.5" x2="8" y2="6.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>',
  ),
  versions: svg(
    '<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<polyline points="8,4 8,8 11,10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  workflows: svg(
    '<circle cx="4" cy="4" r="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<circle cx="12" cy="4" r="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<circle cx="8" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="6.5" y1="4" x2="9.5" y2="4" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="5" y1="6" x2="7" y2="10" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="11" y1="6" x2="9" y2="10" stroke="currentColor" stroke-width="1.2"/>',
  ),
  saveToKb: svg(
    '<path d="M3 1h10l2 2v11a1 1 0 01-1 1H2a1 1 0 01-1-1V2a1 1 0 011-1z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<rect x="5" y="1" width="6" height="4.5" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<rect x="3" y="9" width="10" height="5" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  ),
  shortcuts: svg(
    '<rect x="1" y="3" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="8" y1="6" x2="8" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<line x1="6" y1="8" x2="10" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  ),
  drawing: svg(
    '<rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<path d="M3 12 Q5 8 7 10 Q9 12 11 7 Q13 4 14 5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="3.5" cy="12" r="1" fill="currentColor"/>',
  ),
  spellcheck: svg(
    '<path d="M8 2l5.5 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    '<path d="M8 2L2.5 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    '<line x1="4.5" y1="9.5" x2="11.5" y2="9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
    '<path d="M3 15 Q5 13.5 7 15 Q9 16.5 11 15 Q13 13.5 14 15" fill="none" stroke="#e53e3e" stroke-width="1.3" stroke-linecap="round"/>',
  ),
  footnote: svg(
    '<line x1="2" y1="10" x2="10" y2="10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    '<line x1="2" y1="13" x2="14" y2="13" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>' +
    '<line x1="2" y1="7" x2="8" y2="7" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>' +
    '<circle cx="12" cy="5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/>' +
    '<line x1="12" y1="3.8" x2="12" y2="6.2" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>' +
    '<line x1="10.8" y1="5" x2="13.2" y2="5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>',
  ),
  specialChars: svg(
    // Omega-like arc (top of circle) representing special/math characters
    '<path d="M4 10 Q2 5 8 3 Q14 5 12 10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    // Two legs (like omega bottom)
    '<line x1="3.5" y1="10" x2="2" y2="12.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    '<line x1="12.5" y1="10" x2="14" y2="12.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    // Arrow (rightwards) below
    '<line x1="2" y1="14.5" x2="10" y2="14.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' +
    '<polyline points="8,12.8 10,14.5 8,16.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
};

export const icons: Record<string, string> = { ...textIcons, ...insertIcons };

/** Return the SVG icon string for the given icon name, or empty string if not found. */
export function getIcon(name: string): string {
  return icons[name] ?? '';
}
