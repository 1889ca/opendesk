/** Contract: contracts/app-slides/rules.md */

import * as Y from 'yjs';
import { createAnimationPanel, type AnimationPanel } from './animation-panel.ts';
import type { InteractionController } from './element-interaction.ts';

/**
 * Wires the animation panel into the editor: mounts the panel beside the
 * canvas, adds a toolbar toggle, and connects selection callbacks to the
 * interaction controller.
 *
 * Pulled out of presentation-editor.ts to keep both files within the
 * 200-line contract budget.
 */

interface AnimationInitContext {
  ydoc: Y.Doc;
  yslides: Y.Array<Y.Map<unknown>>;
  canvasEl: HTMLElement | null;
  toolbarRight: Element | null;
  getActiveSlideIndex: () => number;
  getInteractionController: () => InteractionController | null;
}

export interface AnimationInitResult {
  panel: AnimationPanel;
  toggleButton: HTMLButtonElement;
  destroy: () => void;
}

export function initAnimations(ctx: AnimationInitContext): AnimationInitResult {
  const panel = createAnimationPanel({
    ydoc: ctx.ydoc,
    yslides: ctx.yslides,
    getActiveSlideIndex: ctx.getActiveSlideIndex,
    getSelectedElementId: () => {
      const ic = ctx.getInteractionController();
      const sel = ic?.getSelection();
      if (!sel || sel.selectedIds.size !== 1) return null;
      return [...sel.selectedIds][0];
    },
    onSelectionRequested: (elementId) => ctx.getInteractionController()?.setSelection(elementId),
  });
  ctx.canvasEl?.appendChild(panel.element);

  const toggleButton = document.createElement('button');
  toggleButton.className = 'btn btn-secondary btn-sm slide-animation-toggle';
  toggleButton.textContent = 'Animations';

  let visible = false;
  toggleButton.addEventListener('click', () => {
    visible = !visible;
    panel.setVisible(visible);
    toggleButton.classList.toggle('active', visible);
  });
  ctx.toolbarRight?.appendChild(toggleButton);

  return {
    panel,
    toggleButton,
    destroy() {
      panel.destroy();
      toggleButton.remove();
    },
  };
}
