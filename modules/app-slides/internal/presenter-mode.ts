/** Contract: contracts/app-slides/rules.md */

import type { SlideElement } from './types.ts';
import { renderElement } from './element-renderer.ts';
import { getSlideNotes } from './speaker-notes.ts';
import { getSlideTransition, animateTransition } from './transitions.ts';
import { listAnimations, buildAnimationSteps } from './animation-yjs.ts';
import { createAnimationController, type AnimationController } from './animation-engine.ts';
import type * as Y from 'yjs';

interface PresenterContext {
  yslides: Y.Array<Y.Map<unknown>>;
  getSlideElements: (index: number) => SlideElement[];
  totalSlides: () => number;
}

/** Launch presenter mode in a new window. */
export function launchPresenterMode(ctx: PresenterContext, startIndex = 0): void {
  const win = window.open('', '_blank', 'width=1280,height=720');
  if (!win) { alert('Popup blocked — please allow popups for presenter mode.'); return; }

  let current = startIndex;
  const doc = win.document;
  doc.title = 'Presenter Mode — OpenDesk';

  doc.head.innerHTML = `<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>${PRESENTER_CSS}</style>`;

  doc.body.innerHTML = `
    <div class="pm-layout">
      <div class="pm-main"><div class="pm-slide" id="pm-current"></div></div>
      <div class="pm-sidebar">
        <div class="pm-next-label">Next Slide</div>
        <div class="pm-next"><div class="pm-slide pm-slide--mini" id="pm-next"></div></div>
        <div class="pm-notes" id="pm-notes"></div>
        <div class="pm-controls">
          <span id="pm-counter"></span>
          <span id="pm-timer">0:00</span>
        </div>
      </div>
    </div>`;

  const currentEl = doc.getElementById('pm-current')!;
  const nextEl = doc.getElementById('pm-next')!;
  const notesEl = doc.getElementById('pm-notes')!;
  const counterEl = doc.getElementById('pm-counter')!;
  const timerEl = doc.getElementById('pm-timer')!;

  // Timer
  const startTime = Date.now();
  const timerInterval = win.setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = String(elapsed % 60).padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;
  }, 1000);

  function renderSlideInto(container: HTMLElement, index: number) {
    container.innerHTML = '';
    if (index < 0 || index >= ctx.totalSlides()) return;
    const elements = ctx.getSlideElements(index);
    for (const el of elements) {
      const result = renderElement(el, () => {}, () => {}, () => {});
      result.dom.style.pointerEvents = 'none';
      container.appendChild(result.dom);
    }
  }

  let transitioning = false;
  let animCtrl: AnimationController | null = null;

  function buildAnimationsForCurrent(): AnimationController | null {
    const slide = ctx.yslides.get(current);
    const animations = listAnimations(slide);
    if (animations.length === 0) return null;
    const steps = buildAnimationSteps(animations);
    return createAnimationController(steps, animations, (elementId) =>
      currentEl.querySelector(`[data-element-id="${elementId}"]`),
    );
  }

  function update() {
    renderSlideInto(currentEl, current);
    renderSlideInto(nextEl, current + 1);
    notesEl.textContent = getSlideNotes(ctx.yslides, current);
    counterEl.textContent = `${current + 1} / ${ctx.totalSlides()}`;
    animCtrl = buildAnimationsForCurrent();
  }

  async function navigateTo(index: number, direction: 'forward' | 'backward') {
    if (transitioning) return;
    transitioning = true;
    current = index;
    const transition = getSlideTransition(ctx.yslides, current);
    update();
    await animateTransition(currentEl, transition, direction);
    transitioning = false;
  }

  /** Advance one step within the current slide, or move to the next slide. */
  async function advance() {
    if (transitioning) return;
    if (animCtrl && animCtrl.currentStep < animCtrl.totalSteps) {
      const result = await animCtrl.next();
      if (!result.done) return;
    }
    if (current < ctx.totalSlides() - 1) navigateTo(current + 1, 'forward');
  }

  update();

  // Keyboard navigation
  function handleKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault(); advance();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      if (current > 0) navigateTo(current - 1, 'backward');
    } else if (e.key === 'Escape') {
      win?.close();
    } else if (e.key === 'Home') {
      navigateTo(0, 'backward');
    } else if (e.key === 'End') {
      navigateTo(ctx.totalSlides() - 1, 'forward');
    }
  }

  doc.addEventListener('keydown', handleKey);
  win.addEventListener('beforeunload', () => { win.clearInterval(timerInterval); });
}

const PRESENTER_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #1a1a2e; color: #e0e0e0; font-family: system-ui, sans-serif; height: 100vh; overflow: hidden; }
  .pm-layout { display: flex; height: 100vh; }
  .pm-main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
  .pm-slide { background: #fff; aspect-ratio: 16/9; position: relative; overflow: hidden; border-radius: 4px; }
  .pm-main .pm-slide { width: 100%; max-height: 100%; }
  .pm-sidebar { width: 22rem; background: #16213e; display: flex; flex-direction: column; padding: 1rem; gap: 0.75rem; }
  .pm-next-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #8899aa; }
  .pm-next { flex-shrink: 0; }
  .pm-slide--mini { width: 100%; }
  .pm-notes { flex: 1; overflow-y: auto; font-size: 0.9rem; line-height: 1.5; color: #ccc; white-space: pre-wrap; padding: 0.5rem; background: rgba(255,255,255,0.05); border-radius: 4px; }
  .pm-controls { display: flex; justify-content: space-between; font-size: 0.875rem; color: #8899aa; padding: 0.5rem 0; border-top: 1px solid #2a2a4a; }
  .slide-element { position: absolute; padding: 0.5rem; }
`;
