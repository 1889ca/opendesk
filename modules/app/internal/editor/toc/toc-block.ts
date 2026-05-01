/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';
import { t, onLocaleChange } from '../../i18n/index.ts';
import { extractHeadings, type HeadingEntry } from './toc-extractor.ts';
import { createScope, debounce, retryUntil } from '../lifecycle.ts';
import type { PanelBlock } from '../panel-system.ts';

const INDENT_PX = 16;
const DEBOUNCE_MS = 300;

export function buildTocBlock(editor: Editor): PanelBlock {
  const scope = createScope();
  const content = document.createElement('nav');
  content.className = 'toc-block-list';
  content.setAttribute('role', 'navigation');
  content.setAttribute('aria-label', t('toc.title'));

  let headings: HeadingEntry[] = [];

  const render = () => {
    headings = extractHeadings(editor);
    renderList(content, headings, editor);
    updateActiveHeading(content, headings, editor);
  };

  render();

  const debouncedRender = debounce(render, DEBOUNCE_MS);
  scope.add(debouncedRender.cancel);
  scope.onEditor(editor, 'update', debouncedRender.call);
  attachScrollListener(scope, content, editor, () => headings);

  scope.add(onLocaleChange(() => {
    content.setAttribute('aria-label', t('toc.title'));
    render();
  }));

  return {
    id: 'toc',
    title: t('toc.title'),
    icon: '\u2630',
    content,
    cleanup: scope.dispose,
  };
}

function renderList(list: HTMLElement, headings: HeadingEntry[], editor: Editor): void {
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
    item.style.paddingLeft = `${(heading.level - 1) * INDENT_PX + 8}px`;
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
  scope: ReturnType<typeof createScope>,
  list: HTMLElement,
  editor: Editor,
  getHeadings: () => HeadingEntry[],
): void {
  const onScroll = debounce(() => {
    updateActiveHeading(list, getHeadings(), editor);
  }, 100);
  scope.add(onScroll.cancel);

  const { cancel } = retryUntil(
    () => editor.view.dom.closest('.editor-wrapper') as HTMLElement | null,
    (el) => scope.onElement(el, 'scroll', onScroll.call as EventListener, { passive: true }),
  );
  scope.add(cancel);
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
