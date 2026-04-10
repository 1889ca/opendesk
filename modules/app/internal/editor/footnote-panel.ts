/** Contract: contracts/app/rules.md */
import type { Editor } from '@tiptap/core';

export function buildFootnotePanel(editor: Editor): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'footnote-panel';
  panel.setAttribute('aria-label', 'Footnotes');

  const title = document.createElement('h3');
  title.className = 'footnote-panel-title';
  title.textContent = 'Footnotes';
  panel.appendChild(title);

  const list = document.createElement('ol');
  list.className = 'footnote-list';
  panel.appendChild(list);

  function render(): void {
    list.innerHTML = '';
    const footnotes: { content: string }[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'footnote') {
        footnotes.push({ content: node.attrs['content'] as string });
      }
      return true;
    });

    if (footnotes.length === 0) {
      panel.style.display = 'none';
      return;
    }

    panel.style.display = '';
    for (const fn of footnotes) {
      const li = document.createElement('li');
      li.className = 'footnote-item';
      li.textContent = fn.content;
      list.appendChild(li);
    }
  }

  render();
  document.addEventListener('opendesk:footnotes-changed', render);
  editor.on('update', render);

  return panel;
}
