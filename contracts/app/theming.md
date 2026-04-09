# Contract: app/theming

## Purpose

Provide a unified theming system for OpenDesk using CSS custom properties, supporting light/dark/system modes and customizable accent colors.

## Components

- `shared/theme-toggle.ts` — Settings dropdown with mode switcher and accent picker
- `shared/accent-color.ts` — Accent color application and persistence
- `public/theme.css` — CSS custom property definitions for light and dark themes
- `public/settings-dropdown.css` — Settings dropdown panel styles

## Invariants

1. Theme preference persisted in `localStorage` as `opendesk-theme` (light|dark|system).
2. Accent color persisted as `opendesk-accent` (hex string).
3. `prefers-color-scheme` media query respected when mode is `system`.
4. Theme applied to ALL views via `data-theme` attribute on `<html>`.
5. Accent color applied via CSS custom properties on `:root` style.
6. All color values flow through CSS custom properties; no hardcoded colors in component CSS.

## Boundary Rules

### MUST
- Apply theme immediately on page load (inline script in HTML prevents flash)
- Support six preset accent colors plus a custom color picker
- Update all derived properties (hover, shadow, selection) when accent changes

### MUST NOT
- Store theme preferences on the server (client-only for now)
