/** Contract: contracts/app/rules.md */
// @vitest-environment happy-dom

/**
 * Tests for role-enforcement module.
 *
 * Uses jsdom (provided by vitest) to simulate the DOM environment.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getSharedRole, applyRoleEnforcement, type SharedRole } from './role-enforcement.ts';

// --- Helpers ---

function setSearch(search: string): void {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
    configurable: true,
  });
}

function makeEditor(editable = true): { setEditable: ReturnType<typeof vi.fn> } {
  return { setEditable: vi.fn() };
}

function buildDom(): void {
  document.body.innerHTML = `
    <div class="toolbar-right"></div>
    <div id="formatting-toolbar">
      <button>Bold</button>
      <button>Italic</button>
      <select><option>Normal</option></select>
    </div>
    <div class="menu-bar-hamburger"><button>Menu</button></div>
  `;
}

// --- Tests ---

describe('getSharedRole', () => {
  afterEach(() => {
    // Reset location.search
    setSearch('');
  });

  it('returns null when no role param is present', () => {
    setSearch('?doc=some-uuid');
    expect(getSharedRole()).toBeNull();
  });

  it('returns "viewer" for ?role=viewer', () => {
    setSearch('?doc=some-uuid&role=viewer');
    expect(getSharedRole()).toBe('viewer');
  });

  it('returns "commenter" for ?role=commenter', () => {
    setSearch('?role=commenter');
    expect(getSharedRole()).toBe('commenter');
  });

  it('returns "editor" for ?role=editor', () => {
    setSearch('?role=editor');
    expect(getSharedRole()).toBe('editor');
  });

  it('returns null for an unrecognised role value', () => {
    setSearch('?role=owner');
    expect(getSharedRole()).toBeNull();
  });
});

describe('applyRoleEnforcement — viewer', () => {
  beforeEach(buildDom);

  it('sets editor non-editable', () => {
    const editor = makeEditor();
    applyRoleEnforcement(editor as never, 'viewer');
    expect(editor.setEditable).toHaveBeenCalledWith(false);
  });

  it('hides the formatting toolbar', () => {
    const editor = makeEditor();
    applyRoleEnforcement(editor as never, 'viewer');
    const toolbar = document.getElementById('formatting-toolbar')!;
    expect(toolbar.hidden).toBe(true);
    expect(toolbar.getAttribute('aria-hidden')).toBe('true');
  });

  it('hides the menu bar', () => {
    const editor = makeEditor();
    applyRoleEnforcement(editor as never, 'viewer');
    const menuBar = document.querySelector<HTMLElement>('.menu-bar-hamburger')!;
    expect(menuBar.hidden).toBe(true);
  });

  it('mounts a read-only banner', () => {
    const editor = makeEditor();
    applyRoleEnforcement(editor as never, 'viewer');
    const banner = document.getElementById('role-enforcement-banner');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toBe('View only');
  });

  it('does not mount duplicate banners on second call', () => {
    const editor = makeEditor();
    applyRoleEnforcement(editor as never, 'viewer');
    applyRoleEnforcement(editor as never, 'viewer');
    const banners = document.querySelectorAll('#role-enforcement-banner');
    expect(banners).toHaveLength(1);
  });
});

describe('applyRoleEnforcement — commenter', () => {
  beforeEach(buildDom);

  it('sets editor non-editable', () => {
    const editor = makeEditor();
    applyRoleEnforcement(editor as never, 'commenter');
    expect(editor.setEditable).toHaveBeenCalledWith(false);
  });

  it('does not hide the formatting toolbar (visible but disabled)', () => {
    const editor = makeEditor();
    applyRoleEnforcement(editor as never, 'commenter');
    const toolbar = document.getElementById('formatting-toolbar')!;
    expect(toolbar.hidden).toBe(false);
  });

  it('sets data-role attribute on the toolbar', () => {
    const editor = makeEditor();
    applyRoleEnforcement(editor as never, 'commenter');
    const toolbar = document.getElementById('formatting-toolbar')!;
    expect(toolbar.getAttribute('data-role')).toBe('commenter');
  });

  it('disables all toolbar buttons', () => {
    const editor = makeEditor();
    applyRoleEnforcement(editor as never, 'commenter');
    const toolbar = document.getElementById('formatting-toolbar')!;
    const buttons = toolbar.querySelectorAll<HTMLButtonElement>('button');
    for (const btn of buttons) {
      expect(btn.disabled).toBe(true);
    }
  });

  it('mounts a comment-only banner', () => {
    const editor = makeEditor();
    applyRoleEnforcement(editor as never, 'commenter');
    const banner = document.getElementById('role-enforcement-banner');
    expect(banner?.textContent).toBe('Comment only');
  });
});

describe('applyRoleEnforcement — editor', () => {
  beforeEach(buildDom);

  it('is a no-op for the editor role', () => {
    const editor = makeEditor();
    applyRoleEnforcement(editor as never, 'editor');
    expect(editor.setEditable).not.toHaveBeenCalled();
    const toolbar = document.getElementById('formatting-toolbar')!;
    expect(toolbar.hidden).toBe(false);
    expect(document.getElementById('role-enforcement-banner')).toBeNull();
  });
});
