/** Contract: contracts/app-slides/rules.md */

import * as Y from 'yjs';
import { createTransitionPicker, getSlideTransition, setSlideTransition } from './transitions.ts';
import { createSlideSorter } from './slide-sorter.ts';

interface ToolbarExtrasContext {
  ydoc: Y.Doc;
  yslides: Y.Array<Y.Map<unknown>>;
  toolbarRight: Element | null;
  slideListEl: HTMLElement;
  getActiveIndex: () => number;
  setActiveIndex: (i: number) => void;
  onChanged: () => void;
}

/** Initialize transition picker and slide sorter. */
export function initToolbarExtras(ctx: ToolbarExtrasContext): { updateTransitionPicker: () => void; destroy: () => void } {
  const { ydoc, yslides, toolbarRight, slideListEl, getActiveIndex, setActiveIndex, onChanged } = ctx;

  // Transition picker
  const currentTransition = getSlideTransition(yslides, getActiveIndex());
  const transitionPicker = createTransitionPicker(currentTransition, (t) => {
    setSlideTransition(ydoc, yslides, getActiveIndex(), t);
  });
  if (toolbarRight) toolbarRight.appendChild(transitionPicker.element);

  function updateTransitionPicker() {
    const t = getSlideTransition(yslides, getActiveIndex());
    transitionPicker.setActive(t);
  }

  // Slide sorter (drag-to-reorder + context menu)
  const sorter = createSlideSorter({
    ydoc,
    yslides,
    slideListEl,
    getActiveIndex,
    setActiveIndex,
    onChanged,
  });

  return {
    updateTransitionPicker,
    destroy() {
      transitionPicker.destroy();
      sorter.destroy();
    },
  };
}
