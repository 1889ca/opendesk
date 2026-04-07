# Search Contract

## Purpose

Find-and-replace functionality within the TipTap editor, implemented as a ProseMirror plugin with inline decorations and a floating search panel.

## Inputs / Outputs

**Inputs:**
- Search term (string, typed by user)
- Replace term (string)
- Options: `caseSensitive` (boolean), `useRegex` (boolean)

**Outputs:**
- Inline `Decoration` highlights on all matches (class `search-match`)
- Current match highlighted distinctly (class `search-match--current`)
- Match counter (`"N of M"` display with `aria-live` region)
- Document mutations via `replaceMatch` and `replaceAll` commands

## Invariants

- MUST: highlight all matches using ProseMirror `Decoration.inline`
- MUST: scroll current match into view on navigation (smooth, centered)
- MUST: support case-sensitive toggle (default: case-insensitive)
- MUST: support regex mode with ReDoS protection (reject nested quantifiers like `(a+)+`)
- MUST: return `null` regex (no matches) for invalid regex patterns instead of throwing
- MUST: replace matches in reverse order during `replaceAll` to preserve positions
- MUST: clamp match index with modular arithmetic (wraps around)
- MUST: clear all state via `clearSearch` command (resets to initial state)
- MUST NOT: crash on zero-length regex matches (advances `lastIndex` instead)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Mod-f` | Open search panel (find only) |
| `Mod-h` | Open search panel (find + replace) |
| `Enter` | Find next (in search input) |
| `Shift+Enter` | Find previous (in search input) |
| `Escape` | Close search panel |

## TipTap Commands

`find(term)`, `findNext()`, `findPrev()`, `replaceMatch(replacement)`, `replaceAll(replacement)`, `clearSearch()`, `setSearchOption(key, value)`

## Architecture

- `search-state.ts` — `SearchState` interface, `findMatches()` walker, regex builder with ReDoS guard
- `search-extension.ts` — TipTap Extension with ProseMirror plugin, decorations, scroll-to-match
- `search-commands.ts` — TipTap command builders for find/replace operations
- `search-panel-dom.ts` — DOM construction for the floating panel (role="search")
- `search-panel.ts` — Event binding, panel open/close, locale-reactive labels

## Dependencies

- `@tiptap/core`, `@tiptap/pm/state`, `@tiptap/pm/view` — ProseMirror plugin and decorations
- `i18n` — translated labels and placeholders

## Verification

- Unit test: `findMatches` returns correct positions for plain text and regex
- Unit test: `hasNestedQuantifiers` rejects `(a+)+` but allows `a+`
- Unit test: `replaceAll` applied in reverse order preserves document integrity
- Unit test: case-sensitive toggle changes match results
- Unit test: `clampIndex` wraps correctly at boundaries

## MVP Scope

Implemented:
- [x] Find with inline decorations and current-match highlight
- [x] Find next/prev with wrap-around
- [x] Replace current match and replace all
- [x] Case-sensitive toggle
- [x] Regex mode with ReDoS protection (nested quantifier detection)
- [x] Floating search panel with i18n support
- [x] Keyboard shortcuts (Mod-f, Mod-h, Enter, Escape)
- [x] Aria-live match counter for screen readers
- [x] Scroll-to-match on navigation
