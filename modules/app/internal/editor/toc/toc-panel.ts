/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { t, onLocaleChange } from '../../i18n/index.ts';
import { extractHeadings, debounce, type HeadingEntry } from './toc-extractor.ts';

const INDENT_PX = 16;
const DEBOUNCE_MS = 300;

/**
 * Build the TOC sidebar panel.
 * Renders headings with indentation, click-to-scroll, and active highlighting.
 */
export function buildTocPanel(editor: Editor): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'toc-panel';
  panel.setAttribute('role', 'navigation');
  panel.setAttribute('aria-label', t('toc.title'));

  const header = createHeader(panel);
  panel.appendChild(header);

  const list = document.createElement('nav');
  list.className = 'toc-list';
  panel.appendChild(list);

  let headings: HeadingEntry[] = [];

  const render = () => {
    headings = extractHeadings(editor);
    renderList(list, headings, editor);
    updateActiveHeading(list, headings, editor);
  };

  render();

  const debouncedRender = debounce(render, DEBOUNCE_MS);
  editor.on('update', debouncedRender);

  attachScrollListener(list, editor, () => headings);
  onLocaleChange(() => {
    panel.setAttribute('aria-label', t('toc.title'));
    header.querySelector('.toc-panel-title')!.textContent = t('toc.title');
    render();
  });

  return panel;
}

function createHeader(panel: HTMLElement): HTMLElement {
  const header = document.createElement('div');
  header.className = 'toc-panel-header';

  const title = document.createElement('h2');
  title.className = 'toc-panel-title';
  title.textContent = t('toc.title');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toc-panel-close';
  closeBtn.textContent = '\u00d7';
  closeBtn.title = t('toc.title');
  closeBtn.addEventListener('click', () => toggleTocPanel(panel, false));

  header.appendChild(title);
  header.appendChild(closeBtn);
  return header;
}

function renderList(
  list: HTMLElement,
  headings: HeadingEntry[],
  editor: Editor,
): void {
  list.innerHTML = '';

  if (headings.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'toc-empty';
    empty.textContent = t('toc.noHeadings');
    list.appendChild(empty);
    return;
  }

  for (const heading of headings) {
    const item = document.createElement('button');
    item.className = 'toc-item';
    item.setAttribute('data-pos', String(heading.pos));
    item.style.paddingLeft = `${(heading.level - 1) * INDENT_PX + 12}px`;
    item.textContent = heading.text;
    item.addEventListener('click', () => scrollToHeading(editor, heading.pos));
    list.appendChild(item);
  }
}

function scrollToHeading(editor: Editor, pos: number): void {
  const docSize = editor.state.doc.content.size;
  if (pos > docSize) return;

  editor.chain().focus().setTextSelection(pos + 1).run();

  const coords = editor.view.coordsAtPos(pos);
  const wrapper = editor.view.dom.closest('.editor-wrapper');
  if (wrapper) {
    const wrapperRect = wrapper.getBoundingClientRect();
    wrapper.scrollTo({
      top: wrapper.scrollTop + (coords.top - wrapperRect.top) - 80,
      behavior: 'smooth',
    });
  }
}

function attachScrollListener(
  list: HTMLElement,
  editor: Editor,
  getHeadings: () => HeadingEntry[],
): void {
  const wrapper = () =>
    editor.view.dom.closest('.editor-wrapper') as HTMLElement | null;

  const onScroll = debounce(() => {
    updateActiveHeading(list, getHeadings(), editor);
  }, 100);

  const tryAttach = () => {
    const el = wrapper();
    if (el) {
      el.addEventListener('scroll', onScroll, { passive: true });
    } else {
      requestAnimationFrame(tryAttach);
    }
  };
  requestAnimationFrame(tryAttach);
}

function updateActiveHeading(
  list: HTMLElement,
  headings: HeadingEntry[],
  editor: Editor,
): void {
  if (headings.length === 0) return;

  const wrapper = editor.view.dom.closest('.editor-wrapper');
  if (!wrapper) return;

  const wrapperTop = wrapper.getBoundingClientRect().top + 100;
  let activePos = headings[0].pos;

  for (const h of headings) {
    try {
      const coords = editor.view.coordsAtPos(h.pos);
      if (coords.top <= wrapperTop) {
        activePos = h.pos;
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  const items = Array.from(list.querySelectorAll('.toc-item'));
  for (const item of items) {
    const pos = Number((item as HTMLElement).dataset.pos);
    item.classList.toggle('toc-item-active', pos === activePos);
  }
}

/** Toggle the TOC panel visibility. */
export function toggleTocPanel(panel: HTMLElement, show?: boolean): void {
  const visible = show ?? !panel.classList.contains('toc-panel-open');
  panel.classList.toggle('toc-panel-open', visible);
}
