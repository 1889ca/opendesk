# Contract: app/shell

## Purpose

Provide a single-page application shell that replaces separate HTML pages with unified client-side routing. The shell loads editors dynamically, maintains shared chrome (sidebar, top bar, user identity), and preserves WebSocket connections during navigation.

## Inputs

- Browser URL: route path determines which view to render
- User navigation: clicks on links, browser back/forward buttons
- `api` module responses: document list data, document metadata

## Outputs

- Rendered shared chrome (nav sidebar, top bar) persisted across navigations
- Dynamically loaded editor modules mounted into the content area
- Updated browser history entries via `history.pushState`
- Loading states during editor transitions

## Routes

| Path | View | Module |
|------|------|--------|
| `/` | Dashboard / document list | `doc-list.ts` |
| `/doc/:id` | Text document editor | `editor.ts` |
| `/sheet/:id` | Spreadsheet editor | (future) |
| `/slides/:id` | Presentation editor | (future) |

## Invariants

1. **Single HTML entry point.** All routes serve the same `index.html`. The server uses a catch-all that falls through to `index.html` for any non-API, non-static path.

2. **Shared chrome persistence.** The nav sidebar, top bar, and user identity display are rendered once and persist across route changes. They are never torn down and re-created.

3. **Clean mount/unmount.** Each view module exports `mount(container, params)` and `unmount()` functions. When navigating away, the current view's `unmount()` is called before the next view's `mount()`. No DOM from the previous view leaks into the next.

4. **WebSocket preservation.** If navigating from `/doc/A` to `/doc/B`, the shell tears down the old connection and creates a new one. If navigating from `/doc/A` to `/` and back to `/doc/A`, the connection is re-established (not cached stale).

5. **Browser history works.** Back/forward navigation triggers route changes. `popstate` events are handled. Direct URL entry works (server catch-all).

6. **Loading states.** A loading indicator is shown between view unmount and mount completion. No blank screen flashes.

7. **No framework.** The router and shell use vanilla TypeScript with `history.pushState` and `popstate`. No React, Vue, or other framework.

## Dependencies

- `modules/app/internal/doc-list.ts` (runtime) -- mounted as dashboard view
- `modules/app/internal/editor.ts` (runtime) -- mounted as document editor view
- `modules/app/internal/api-client.ts` (runtime) -- HTTP client for API calls
- `modules/app/internal/i18n/` (runtime) -- locale resolution and translations
- `modules/app/internal/theme-toggle.ts` (runtime) -- theme persistence

## File Structure

```
modules/app/internal/shell/
  router.ts       -- Client-side pushState router (route matching, param extraction, navigation)
  shell.ts        -- App shell: shared chrome, content mount point, route handling
  lazy-loader.ts  -- Dynamic import wrapper with loading states
  nav-sidebar.ts  -- Navigation sidebar (doc list link, recent docs, create new)
  shell.css       -- Layout styles for shell chrome
```

## Boundary Rules

### MUST
- Use `history.pushState` for navigation (no hash routing)
- Call `unmount()` on the current view before mounting the next
- Show a loading indicator during async module loads
- Handle `popstate` for back/forward navigation
- Intercept internal `<a>` clicks to use client-side routing instead of full page loads
- Serve `index.html` for all non-API, non-static routes (server catch-all)

### MUST NOT
- Use any frontend framework (React, Vue, Svelte, etc.)
- Cache stale WebSocket connections across navigations
- Allow DOM from a previous view to leak into the next view
- Break direct URL entry (all routes must work on page load)
- Import server-side modules
