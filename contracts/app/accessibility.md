# Accessibility Contract

## Purpose

Screen reader support, keyboard navigation patterns, and assistive technology integration for the OpenDesk editor UI.

## Inputs / Outputs

**Inputs:**
- Keyboard events (arrow keys, Home, End, Escape, Mod+/)
- Programmatic calls to `announce()` for screen reader notifications

**Outputs:**
- ARIA live region announcements (role="status", aria-live="polite")
- Roving tabindex on toolbar buttons
- Modal shortcut dialog (role="dialog", aria-modal="true")

## Components

### ARIA Announcer (`a11y-announcer.ts`)
- Creates a single `<div role="status" aria-live="polite" aria-atomic="true">` with class `sr-only`
- `announce(message)` clears then sets `textContent` (with `offsetHeight` reflow trick to force re-announcement of identical messages)
- Lazily created, appended to `document.body`

### Toolbar Navigation (`toolbar-nav.ts`)
- WAI-ARIA toolbar pattern with roving tabindex
- First button gets `tabindex="0"`, all others get `tabindex="-1"`
- Arrow keys (Left/Right/Up/Down) cycle through enabled buttons
- Home/End jump to first/last button
- Escape returns focus to the editor (via `returnFocusTo` callback)
- Only targets `button:not([disabled])` elements

### Shortcut Dialog (`shortcut-dialog.ts`)
- Modal dialog listing all keyboard shortcuts grouped by category
- Groups: Formatting, Comments, Search, Document
- Platform-aware modifier key display (Cmd on Mac, Ctrl otherwise)
- Opens via `Mod+/`, closes via Escape or backdrop click
- Focus trapped: close button receives focus on open
- Re-renders on locale change (i18n reactive)
- Uses `<dl>` (definition list) with `<kbd>` elements for shortcut keys

## Invariants

- MUST: use `aria-live="polite"` (not assertive) for announcements
- MUST: use `aria-atomic="true"` so the full message is read each time
- MUST: implement roving tabindex (not `tabindex="0"` on all buttons)
- MUST: support Home/End for first/last toolbar button
- MUST: return focus to editor on Escape from toolbar
- MUST: set `role="dialog"` and `aria-modal="true"` on shortcut dialog
- MUST: focus the close button when shortcut dialog opens
- MUST: close shortcut dialog on Escape key or backdrop click
- MUST NOT: use `aria-live="assertive"` for routine announcements

## Dependencies

- `i18n` — translated labels for shortcut dialog groups and entries

## Verification

- Unit test: `announce()` sets textContent on the live region element
- Unit test: toolbar navigation cycles through buttons with arrow keys
- Unit test: Home/End focus first/last toolbar button
- Unit test: Escape from toolbar calls `returnFocusTo` callback
- Unit test: shortcut dialog opens on Mod+/, closes on Escape
- Unit test: shortcut dialog re-renders on locale change

## MVP Scope

Implemented:
- [x] ARIA live region announcer (polite, atomic)
- [x] Roving tabindex toolbar navigation (WAI-ARIA toolbar pattern)
- [x] Keyboard shortcut dialog (Mod+/ toggle, grouped shortcuts)
- [x] Platform-aware modifier key display (Mac vs other)
- [x] Focus management (close button on dialog open, editor on Escape)
- [x] i18n-reactive shortcut labels
