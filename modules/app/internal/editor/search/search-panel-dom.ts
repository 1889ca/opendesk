/** Contract: contracts/app/rules.md */
import { t } from '../../i18n/index.ts';

export interface PanelElements {
  searchInput: HTMLInputElement;
  replaceInput: HTMLInputElement;
  caseToggle: HTMLButtonElement;
  regexToggle: HTMLButtonElement;
  prevBtn: HTMLButtonElement;
  nextBtn: HTMLButtonElement;
  replaceBtn: HTMLButtonElement;
  replaceAllBtn: HTMLButtonElement;
  closeBtn: HTMLButtonElement;
  counter: HTMLSpanElement;
  replaceRow: HTMLDivElement;
}

export function createPanelElement(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'search-panel';
  panel.setAttribute('role', 'search');
  panel.style.display = 'none';
  return panel;
}

export function mountPanel(panel: HTMLDivElement): void {
  const wrapper = document.querySelector('.editor-wrapper') as HTMLElement | null;
  if (wrapper) {
    wrapper.style.position = 'relative';
    wrapper.appendChild(panel);
  }
}

function createInput(placeholderKey: string): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'search-panel__input';
  input.placeholder = t(placeholderKey as Parameters<typeof t>[0]);
  return input;
}

function createToggle(label: string, titleKey: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'search-panel__toggle';
  btn.textContent = label;
  btn.title = t(titleKey as Parameters<typeof t>[0]);
  return btn;
}

function createActionBtn(label: string, titleKey: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'search-panel__btn';
  btn.textContent = label;
  btn.title = t(titleKey as Parameters<typeof t>[0]);
  return btn;
}

function createLabel(text: string): HTMLSpanElement {
  const label = document.createElement('span');
  label.className = 'search-panel__label';
  label.textContent = text;
  return label;
}

export function mountPanelInputs(panel: HTMLDivElement): PanelElements {
  const searchRow = document.createElement('div');
  searchRow.className = 'search-panel__row';

  const searchInput = createInput('search.find');
  const caseToggle = createToggle('Aa', 'search.caseSensitive');
  const regexToggle = createToggle('.*', 'search.useRegex');
  const counter = document.createElement('span');
  counter.className = 'search-panel__counter';
  counter.setAttribute('aria-live', 'polite');
  counter.setAttribute('aria-atomic', 'true');
  counter.textContent = '';

  const prevBtn = createActionBtn('\u2191', 'search.findPrev');
  const nextBtn = createActionBtn('\u2193', 'search.findNext');
  const closeBtn = createActionBtn('\u2715', 'search.close');
  closeBtn.className = 'search-panel__close';

  searchRow.append(
    createLabel(t('search.findLabel')),
    searchInput, caseToggle, regexToggle, counter, prevBtn, nextBtn, closeBtn,
  );

  const replaceRow = document.createElement('div');
  replaceRow.className = 'search-panel__row search-panel__replace-row';

  const replaceInput = createInput('search.replace');
  const replaceBtn = createActionBtn(
    t('search.replaceOne'), 'search.replaceOne',
  );
  replaceBtn.className = 'search-panel__btn search-panel__btn--label';
  const replaceAllBtn = createActionBtn(
    t('search.replaceAll'), 'search.replaceAll',
  );
  replaceAllBtn.className = 'search-panel__btn search-panel__btn--label';

  replaceRow.append(
    createLabel(t('search.replaceLabel')),
    replaceInput, replaceBtn, replaceAllBtn,
  );
  panel.append(searchRow, replaceRow);

  return {
    searchInput, replaceInput, caseToggle, regexToggle,
    prevBtn, nextBtn, replaceBtn, replaceAllBtn, closeBtn,
    counter, replaceRow,
  };
}
