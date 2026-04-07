# Print Contract

## Purpose

Print and PDF export support via the browser's native print dialog, with a dedicated print stylesheet and a PageBreak editor node.

## Inputs / Outputs

**Inputs:**
- User clicks print or PDF button (calls `window.print()`)
- User inserts a PageBreak node via `insertPageBreak` command

**Outputs:**
- Browser print dialog with paper-optimized document rendering
- PDF output via browser's "Save as PDF" print destination

## Invariants

### Print Stylesheet (`print.css`)

- MUST: hide all UI chrome in print mode (toolbar, sidebar, search panel, collaboration cursors, export controls, language switcher, status bar, user list)
- MUST: set `@page` margin to 2cm
- MUST: use 12pt base font size for body and editor content
- MUST: remove editor border, box-shadow, and border-radius
- MUST: apply `break-before: page` on h1 elements (except first child)
- MUST: apply `break-inside: avoid` on headings, pre, tables, table rows, images
- MUST: set `orphans: 3; widows: 3` on paragraphs and lists
- MUST: append URL text after links (`a[href]::after { content: ' (' attr(href) ')' }`)
- MUST: force black text on white background
- MUST: remove comment highlights and search match highlights
- MUST: render `.page-break` as `break-before: page` with zero height and no visual content

### PageBreak Node

- MUST: render as `<div data-page-break>` with class `page-break`
- MUST: be an atomic, selectable, non-draggable block node
- MUST: set `contenteditable="false"` on the rendered element
- MUST: display "--- Page Break ---" label on screen (via CSS `::before`)
- MUST: become an invisible page break in print (CSS `break-before: page`)

### Print Functions

- `printDocument()` and `exportPdf()` both call `window.print()` — PDF generation relies on the browser's built-in "Save as PDF" printer

## Dependencies

- `@tiptap/core` — Node extension for PageBreak
- `print.css` — loaded via `<link>` in `editor.html`

## Verification

- Visual test: print preview shows no toolbar, sidebar, or collaboration UI
- Visual test: page breaks produce new pages in print preview
- Unit test: PageBreak node parses from `<div data-page-break>` and serializes back
- Unit test: `insertPageBreak` command inserts a `pageBreak` node

## MVP Scope

Implemented:
- [x] Print stylesheet hiding all UI chrome
- [x] Paper-optimized typography (12pt, black on white, 2cm margins)
- [x] PageBreak TipTap node with screen and print styling
- [x] `printDocument()` and `exportPdf()` utility functions
- [x] Break avoidance on headings, code blocks, tables, images
- [x] Link URL display in print output
- [x] Orphan/widow control on paragraphs and lists
