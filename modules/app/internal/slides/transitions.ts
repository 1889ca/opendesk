/** Contract: contracts/app/slides-interaction.md */

import type * as Y from 'yjs';

/** Supported transition types. */
export type TransitionType = 'none' | 'fade' | 'slide-left' | 'slide-right' | 'zoom';

export const TRANSITION_TYPES: TransitionType[] = ['none', 'fade', 'slide-left', 'slide-right', 'zoom'];

export const TRANSITION_LABELS: Record<TransitionType, string> = {
  'none': 'None',
  'fade': 'Fade',
  'slide-left': 'Slide Left',
  'slide-right': 'Slide Right',
  'zoom': 'Zoom',
};

/** Duration in ms for transitions. */
export const TRANSITION_DURATION = 400;

/** Get the transition type for a slide. */
export function getSlideTransition(yslides: Y.Array<Y.Map<unknown>>, index: number): TransitionType {
  const slide = yslides.get(index);
  const t = slide?.get('transition');
  return (t && TRANSITION_TYPES.includes(t as TransitionType)) ? t as TransitionType : 'none';
}

/** Set the transition type for a slide. */
export function setSlideTransition(
  ydoc: Y.Doc,
  yslides: Y.Array<Y.Map<unknown>>,
  index: number,
  transition: TransitionType,
): void {
  const slide = yslides.get(index);
  if (!slide) return;
  ydoc.transact(() => { slide.set('transition', transition); });
}

/** Apply a CSS transition animation to a container element. Returns a promise that resolves when done. */
export function animateTransition(
  container: HTMLElement,
  transition: TransitionType,
  direction: 'forward' | 'backward' = 'forward',
): Promise<void> {
  if (transition === 'none') return Promise.resolve();

  const dur = TRANSITION_DURATION;
  const animations: Record<string, Keyframe[]> = {
    'fade': [{ opacity: 0 }, { opacity: 1 }],
    'slide-left': [
      { transform: direction === 'forward' ? 'translateX(100%)' : 'translateX(-100%)' },
      { transform: 'translateX(0)' },
    ],
    'slide-right': [
      { transform: direction === 'forward' ? 'translateX(-100%)' : 'translateX(100%)' },
      { transform: 'translateX(0)' },
    ],
    'zoom': [
      { transform: 'scale(0.8)', opacity: 0 },
      { transform: 'scale(1)', opacity: 1 },
    ],
  };

  const keyframes = animations[transition];
  if (!keyframes) return Promise.resolve();

  return new Promise((resolve) => {
    const anim = container.animate(keyframes, { duration: dur, easing: 'ease-out', fill: 'forwards' });
    anim.onfinish = () => resolve();
  });
}

/** Create transition picker dropdown UI. */
export function createTransitionPicker(
  currentType: TransitionType,
  onChange: (t: TransitionType) => void,
): { element: HTMLElement; setActive: (t: TransitionType) => void; destroy: () => void } {
  const wrapper = document.createElement('div');
  wrapper.className = 'slide-transition-picker';

  const btn = document.createElement('button');
  btn.className = 'btn btn-secondary btn-sm';
  btn.textContent = 'Transition';

  const menu = document.createElement('div');
  menu.className = 'slide-transition-picker__menu';
  menu.hidden = true;

  let active = currentType;

  function renderMenu() {
    menu.innerHTML = '';
    for (const t of TRANSITION_TYPES) {
      const item = document.createElement('button');
      item.className = 'slide-transition-picker__item' + (t === active ? ' active' : '');
      item.textContent = TRANSITION_LABELS[t];
      item.addEventListener('click', () => { active = t; onChange(t); renderMenu(); close(); });
      menu.appendChild(item);
    }
  }
  renderMenu();

  function close() { menu.hidden = true; }
  btn.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
  document.addEventListener('click', (e) => { if (!wrapper.contains(e.target as Node)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  wrapper.append(btn, menu);
  return {
    element: wrapper,
    setActive(t: TransitionType) { active = t; renderMenu(); },
    destroy() { wrapper.remove(); },
  };
}
