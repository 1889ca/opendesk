/** Contract: contracts/app-slides/rules.md */

import {
  type AnimationEffect, type AnimationTrigger,
  ALL_EFFECTS, TRIGGER_TYPES, EFFECT_LABELS, TRIGGER_LABELS, categoryOf,
} from './animation-types.ts';

/**
 * Small DOM control builders for the animation panel. Stateless factories
 * for selects, number inputs, and icon buttons.
 */

export function makeEffectSelect(initial: AnimationEffect = 'fade-in'): HTMLSelectElement {
  const sel = document.createElement('select');
  sel.className = 'animation-panel__select';
  for (const effect of ALL_EFFECTS) {
    const opt = document.createElement('option');
    opt.value = effect;
    opt.textContent = `${categoryOf(effect)[0].toUpperCase()}: ${EFFECT_LABELS[effect]}`;
    sel.appendChild(opt);
  }
  sel.value = initial;
  return sel;
}

export function makeTriggerSelect(initial: AnimationTrigger): HTMLSelectElement {
  const sel = document.createElement('select');
  sel.className = 'animation-panel__select';
  for (const trig of TRIGGER_TYPES) {
    const opt = document.createElement('option');
    opt.value = trig;
    opt.textContent = TRIGGER_LABELS[trig];
    sel.appendChild(opt);
  }
  sel.value = initial;
  return sel;
}

export function makeNumberInput(value: number, min: number, max: number, label: string): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = String(min); input.max = String(max); input.step = '50';
  input.value = String(value);
  input.title = label;
  input.setAttribute('aria-label', label);
  input.className = 'animation-panel__num';
  return input;
}

export function reorderBtn(label: string, title: string, onClick: () => void, disabled: boolean): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'animation-panel__icon-btn';
  b.textContent = label;
  b.title = title;
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  return b;
}

export function deleteBtn(onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'animation-panel__icon-btn animation-panel__icon-btn--danger';
  b.textContent = '\u2715';
  b.title = 'Remove animation';
  b.addEventListener('click', onClick);
  return b;
}
