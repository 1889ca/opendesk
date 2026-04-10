/** Contract: contracts/app/rules.md */
/**
 * Inline link input popover — replaces the browser prompt() for link entry.
 * Shows a small popover anchored below the trigger element.
 *
 * Modes:
 *  - Insert mode: text is selected (or no existing link). Shows URL input + Apply.
 *  - View mode:   cursor is ON a link with no selection. Shows URL + Edit/Copy/Remove.
 */
import type { Editor } from '@tiptap/core';
import { buildInsertView, buildViewMode } from './link-popover-dom.ts';

interface PopoverElement extends HTMLDivElement {
  _cleanup?: () => void;
}

export function showLinkPopover(editor: Editor, anchor: HTMLElement): void {
  removeLinkPopover();

  const existingHref = editor.getAttributes('link').href as string | undefined;
  const hasSelection = !editor.state.selection.empty;

  // View mode: cursor is sitting on a link with no text selection
  const isViewMode = !!(existingHref && !hasSelection);

  const popover = document.createElement('div') as PopoverElement;
  popover.className = 'link-popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', isViewMode ? 'Link options' : 'Insert link');

  positionPopover(popover, anchor);

  if (isViewMode) {
    renderViewMode(popover, editor, existingHref!);
  } else {
    renderInsertMode(popover, editor, existingHref ?? '');
  }

  const onDocClick = (e: MouseEvent) => {
    if (!popover.contains(e.target as Node)) removeLinkPopover();
  };
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); removeLinkPopover(); }
  };

  popover._cleanup = () => {
    document.removeEventListener('mousedown', onDocClick);
    document.removeEventListener('keydown', onKeydown);
  };

  document.body.appendChild(popover);

  // Delay so this triggering mousedown/keydown doesn't immediately close the popover
  requestAnimationFrame(() => {
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeydown);
  });
}

function renderInsertMode(popover: HTMLElement, editor: Editor, initialValue: string): void {
  const { container, input } = buildInsertView(initialValue, {
    onApply(url) {
      if (url) editor.chain().focus().setLink({ href: url }).run();
      removeLinkPopover();
    },
    onCancel() { removeLinkPopover(); },
  });
  popover.appendChild(container);
  requestAnimationFrame(() => { input.focus(); input.select(); });
}

function renderViewMode(popover: HTMLElement, editor: Editor, href: string): void {
  popover.appendChild(buildViewMode(href, {
    onEdit() {
      popover.innerHTML = '';
      popover.setAttribute('aria-label', 'Edit link');
      renderInsertMode(popover, editor, href);
    },
    onCopy(url) { navigator.clipboard.writeText(url).catch(() => {/* best-effort */}); },
    onRemove() { editor.chain().focus().unsetLink().run(); removeLinkPopover(); },
  }));
  requestAnimationFrame(() => {
    popover.querySelector<HTMLElement>('.link-popover-action')?.focus();
  });
}

function positionPopover(popover: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  popover.style.position = 'fixed';
  popover.style.top = `${rect.bottom + 8}px`;
  popover.style.left = `${rect.left}px`;
  // Clamp to viewport after paint
  requestAnimationFrame(() => {
    const pr = popover.getBoundingClientRect();
    if (pr.right > window.innerWidth) popover.style.left = `${window.innerWidth - pr.width - 8}px`;
    if (pr.bottom > window.innerHeight) popover.style.top = `${rect.top - pr.height - 8}px`;
  });
}

export function removeLinkPopover(): void {
  const existing = document.querySelector('.link-popover') as PopoverElement | null;
  if (existing) { existing._cleanup?.(); existing.remove(); }
}
