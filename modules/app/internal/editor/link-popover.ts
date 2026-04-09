/** Contract: contracts/app/rules.md */
/**
 * Inline link input popover — replaces the browser prompt() for link entry.
 * Shows a small input+button bar anchored below the bubble menu.
 */
import type { Editor } from '@tiptap/core';

export function showLinkPopover(editor: Editor, anchor: HTMLElement): void {
  // Remove any existing popover first
  removeLinkPopover();

  const rect = anchor.getBoundingClientRect();

  const popover = document.createElement('div');
  popover.className = 'link-popover';
  popover.style.top = `${rect.bottom + 8}px`;
  popover.style.left = `${rect.left}px`;

  const input = document.createElement('input');
  input.type = 'url';
  input.className = 'link-popover-input';
  input.placeholder = 'https://...';

  // Pre-fill if a link is already active
  const existingHref = editor.getAttributes('link').href as string | undefined;
  if (existingHref) {
    input.value = existingHref;
  }

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'link-popover-submit';
  submitBtn.textContent = 'Apply';

  popover.appendChild(input);
  popover.appendChild(submitBtn);

  // "Remove link" button only when a link is active
  if (existingHref) {
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'link-popover-remove';
    removeBtn.textContent = 'Remove link';
    removeBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      editor.chain().focus().unsetLink().run();
      removeLinkPopover();
    });
    popover.appendChild(removeBtn);
  }

  function applyLink(): void {
    const url = input.value.trim();
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
    removeLinkPopover();
  }

  submitBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    applyLink();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyLink();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      removeLinkPopover();
    }
  });

  // Click-outside handler
  function onDocClick(e: MouseEvent): void {
    if (!popover.contains(e.target as Node)) {
      removeLinkPopover();
    }
  }

  // Store cleanup on the element so removeLinkPopover can tear it down
  (popover as PopoverElement)._cleanup = () => {
    document.removeEventListener('mousedown', onDocClick);
  };

  document.body.appendChild(popover);

  // Delay listener so this mousedown event doesn't immediately close it
  requestAnimationFrame(() => {
    document.addEventListener('mousedown', onDocClick);
  });

  input.focus();
  input.select();
}

interface PopoverElement extends HTMLDivElement {
  _cleanup?: () => void;
}

function removeLinkPopover(): void {
  const existing = document.querySelector('.link-popover') as PopoverElement | null;
  if (existing) {
    existing._cleanup?.();
    existing.remove();
  }
}
