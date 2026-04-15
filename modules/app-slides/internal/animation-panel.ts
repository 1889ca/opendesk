/** Contract: contracts/app-slides/rules.md */

import * as Y from 'yjs';
import {
  type AnimationEffect, type ElementAnimation,
  categoryOf, MIN_DURATION_MS, MAX_DURATION_MS,
} from './animation-types.ts';
import {
  listAnimations, appendAnimation, updateAnimationField, removeAnimation, moveAnimation,
} from './animation-yjs.ts';
import {
  makeEffectSelect, makeTriggerSelect, makeNumberInput, reorderBtn, deleteBtn,
} from './animation-panel-controls.ts';

/**
 * Sidebar panel for managing element animations on the active slide.
 *
 * Top section: pick an effect and add it to the currently selected element.
 * List: all animations on the slide, ordered by playback. Each row exposes
 * effect, trigger, duration, delay, and reorder/delete controls.
 */

interface AnimationPanelContext {
  ydoc: Y.Doc;
  yslides: Y.Array<Y.Map<unknown>>;
  getActiveSlideIndex: () => number;
  getSelectedElementId: () => string | null;
  onSelectionRequested?: (elementId: string) => void;
}

export interface AnimationPanel {
  element: HTMLElement;
  refresh: () => void;
  setVisible: (visible: boolean) => void;
  destroy: () => void;
}

export function createAnimationPanel(ctx: AnimationPanelContext): AnimationPanel {
  const { ydoc, yslides, getActiveSlideIndex, getSelectedElementId, onSelectionRequested } = ctx;

  const panel = document.createElement('aside');
  panel.className = 'animation-panel';
  panel.hidden = true;

  const header = buildHeader(() => setVisible(false));
  const { section: addSection, effectSelect, hint: addHint } = buildAddSection(handleAdd);
  const listEl = document.createElement('ol');
  listEl.className = 'animation-panel__list';

  panel.append(header, addSection, listEl);

  function handleAdd() {
    const elementId = getSelectedElementId();
    if (!elementId) {
      addHint.textContent = 'Select an element on the slide first.';
      addHint.style.color = 'var(--accent)';
      return;
    }
    const slide = yslides.get(getActiveSlideIndex());
    if (!slide) return;
    appendAnimation(ydoc, slide, { elementId, effect: effectSelect.value as AnimationEffect });
    addHint.textContent = 'Added.';
    addHint.style.color = '';
    refresh();
  }

  function refresh() {
    const slide = yslides.get(getActiveSlideIndex());
    const animations = listAnimations(slide);
    listEl.innerHTML = '';
    if (animations.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'animation-panel__empty';
      empty.textContent = 'No animations yet on this slide.';
      listEl.appendChild(empty);
      return;
    }
    animations.forEach((anim, i) => listEl.appendChild(buildRow(anim, i, animations.length)));
  }

  function buildRow(anim: ElementAnimation, idx: number, total: number): HTMLElement {
    const li = document.createElement('li');
    li.className = `animation-panel__item animation-panel__item--${categoryOf(anim.effect)}`;
    li.dataset.animationId = anim.id;

    const order = document.createElement('span');
    order.className = 'animation-panel__order';
    order.textContent = String(idx + 1);

    const main = document.createElement('div');
    main.className = 'animation-panel__main';

    const elBtn = document.createElement('button');
    elBtn.className = 'animation-panel__elref';
    elBtn.textContent = `Element \u2026${anim.elementId.slice(-6)}`;
    elBtn.title = 'Select this element on the slide';
    elBtn.addEventListener('click', () => onSelectionRequested?.(anim.elementId));

    const effectRow = document.createElement('div');
    effectRow.className = 'animation-panel__row';
    const effSel = makeEffectSelect(anim.effect);
    effSel.addEventListener('change', () => updateField(anim.id, 'effect', effSel.value));
    const trigSel = makeTriggerSelect(anim.trigger);
    trigSel.addEventListener('change', () => updateField(anim.id, 'trigger', trigSel.value));
    effectRow.append(effSel, trigSel);

    const tuneRow = document.createElement('div');
    tuneRow.className = 'animation-panel__row';
    const durInput = makeNumberInput(anim.durationMs, MIN_DURATION_MS, MAX_DURATION_MS, 'Duration (ms)');
    durInput.addEventListener('change', () => updateField(anim.id, 'durationMs', Number(durInput.value)));
    const delInput = makeNumberInput(anim.delayMs, 0, MAX_DURATION_MS, 'Delay (ms)');
    delInput.addEventListener('change', () => updateField(anim.id, 'delayMs', Number(delInput.value)));
    tuneRow.append(durInput, delInput);

    main.append(elBtn, effectRow, tuneRow);

    const actions = document.createElement('div');
    actions.className = 'animation-panel__actions';
    actions.append(
      reorderBtn('\u2191', 'Move up', () => moveAndRefresh(idx, idx - 1), idx === 0),
      reorderBtn('\u2193', 'Move down', () => moveAndRefresh(idx, idx + 1), idx === total - 1),
      deleteBtn(() => {
        const slide = yslides.get(getActiveSlideIndex());
        if (slide) removeAnimation(ydoc, slide, anim.id);
        refresh();
      }),
    );

    li.append(order, main, actions);
    return li;
  }

  function updateField(id: string, field: 'effect' | 'trigger' | 'durationMs' | 'delayMs', value: unknown) {
    const slide = yslides.get(getActiveSlideIndex());
    if (!slide) return;
    updateAnimationField(ydoc, slide, id, field, value);
    refresh();
  }

  function moveAndRefresh(from: number, to: number) {
    const slide = yslides.get(getActiveSlideIndex());
    if (!slide) return;
    moveAnimation(ydoc, slide, from, to);
    refresh();
  }

  function setVisible(v: boolean) {
    panel.hidden = !v;
    if (v) refresh();
  }

  function onYjsChange() { if (!panel.hidden) refresh(); }
  yslides.observeDeep(onYjsChange);

  return {
    element: panel,
    refresh,
    setVisible,
    destroy() { yslides.unobserveDeep(onYjsChange); panel.remove(); },
  };
}

function buildHeader(onClose: () => void): HTMLElement {
  const header = document.createElement('div');
  header.className = 'animation-panel__header';
  const title = document.createElement('span');
  title.textContent = 'Animations';
  title.className = 'animation-panel__title';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'animation-panel__close';
  closeBtn.setAttribute('aria-label', 'Close animations panel');
  closeBtn.textContent = '\u00D7';
  closeBtn.addEventListener('click', onClose);
  header.append(title, closeBtn);
  return header;
}

function buildAddSection(onAdd: () => void): { section: HTMLElement; effectSelect: HTMLSelectElement; hint: HTMLElement } {
  const section = document.createElement('div');
  section.className = 'animation-panel__add';
  const label = document.createElement('label');
  label.className = 'animation-panel__label';
  label.textContent = 'Add to selected element';
  const row = document.createElement('div');
  row.className = 'animation-panel__row';
  const effectSelect = makeEffectSelect();
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary btn-sm';
  addBtn.textContent = 'Add';
  addBtn.addEventListener('click', onAdd);
  row.append(effectSelect, addBtn);
  const hint = document.createElement('p');
  hint.className = 'animation-panel__hint';
  hint.textContent = 'Select an element on the slide first.';
  section.append(label, row, hint);
  return { section, effectSelect, hint };
}
