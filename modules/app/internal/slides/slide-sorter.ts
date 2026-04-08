/** Contract: contracts/app/slides-interaction.md */

import * as Y from 'yjs';

interface SlideSorterContext {
  ydoc: Y.Doc;
  yslides: Y.Array<Y.Map<unknown>>;
  slideListEl: HTMLElement;
  getActiveIndex: () => number;
  setActiveIndex: (i: number) => void;
  onChanged: () => void;
}

/** Add drag-to-reorder and right-click context menu to slide thumbnails. */
export function createSlideSorter(ctx: SlideSorterContext): { destroy: () => void } {
  const { ydoc, yslides, slideListEl, getActiveIndex, setActiveIndex, onChanged } = ctx;
  let dragIndex = -1;

  // --- Drag-to-reorder ---
  function handleDragStart(e: DragEvent) {
    const thumb = (e.target as HTMLElement).closest<HTMLElement>('.slide-thumb');
    if (!thumb) return;
    dragIndex = indexOfThumb(thumb);
    if (dragIndex < 0) return;
    e.dataTransfer?.setData('text/plain', String(dragIndex));
    thumb.classList.add('slide-thumb--dragging');
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    const thumb = (e.target as HTMLElement).closest<HTMLElement>('.slide-thumb');
    slideListEl.querySelectorAll('.slide-thumb--drop-target').forEach((el) => el.classList.remove('slide-thumb--drop-target'));
    if (thumb) thumb.classList.add('slide-thumb--drop-target');
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    slideListEl.querySelectorAll('.slide-thumb--dragging, .slide-thumb--drop-target').forEach((el) => {
      el.classList.remove('slide-thumb--dragging', 'slide-thumb--drop-target');
    });
    const thumb = (e.target as HTMLElement).closest<HTMLElement>('.slide-thumb');
    if (!thumb) return;
    const dropIndex = indexOfThumb(thumb);
    if (dropIndex < 0 || dragIndex < 0 || dragIndex === dropIndex) return;
    moveSlide(dragIndex, dropIndex);
    dragIndex = -1;
  }

  function handleDragEnd() {
    slideListEl.querySelectorAll('.slide-thumb--dragging, .slide-thumb--drop-target').forEach((el) => {
      el.classList.remove('slide-thumb--dragging', 'slide-thumb--drop-target');
    });
    dragIndex = -1;
  }

  function indexOfThumb(thumb: HTMLElement): number {
    return Array.from(slideListEl.children).indexOf(thumb);
  }

  function moveSlide(from: number, to: number) {
    ydoc.transact(() => {
      const items = yslides.toArray();
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      // Rebuild array — Yjs Y.Array has no move(), so delete all and re-insert
      yslides.delete(0, yslides.length);
      yslides.insert(0, items);
    });
    setActiveIndex(to);
    onChanged();
  }

  // --- Context menu (right-click on thumbnails) ---
  let menuEl: HTMLElement | null = null;

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    const thumb = (e.target as HTMLElement).closest<HTMLElement>('.slide-thumb');
    if (!thumb) return;
    const idx = indexOfThumb(thumb);
    if (idx < 0) return;
    closeMenu();

    menuEl = document.createElement('div');
    menuEl.className = 'slide-sorter-menu';
    menuEl.style.top = `${e.clientY}px`;
    menuEl.style.left = `${e.clientX}px`;

    const items = [
      { label: 'Duplicate', action: () => duplicateSlide(idx) },
      { label: 'Delete', action: () => deleteSlide(idx), danger: true },
    ];

    for (const item of items) {
      const btn = document.createElement('button');
      btn.className = 'slide-sorter-menu__item' + (item.danger ? ' danger' : '');
      btn.textContent = item.label;
      btn.addEventListener('click', () => { item.action(); closeMenu(); });
      menuEl.appendChild(btn);
    }
    document.body.appendChild(menuEl);
  }

  function closeMenu() {
    menuEl?.remove();
    menuEl = null;
  }

  function duplicateSlide(idx: number) {
    const source = yslides.get(idx);
    if (!source) return;
    ydoc.transact(() => {
      const clone = new Y.Map<unknown>();
      for (const [k, v] of source.entries()) {
        if (k === 'elements') {
          const srcEls = v as Y.Array<Y.Map<unknown>>;
          const newEls = new Y.Array<Y.Map<unknown>>();
          for (let i = 0; i < srcEls.length; i++) {
            const el = srcEls.get(i);
            const copy = new Y.Map<unknown>();
            for (const [ek, ev] of el.entries()) copy.set(ek, ek === 'id' ? crypto.randomUUID() : ev);
            newEls.push([copy]);
          }
          clone.set('elements', newEls);
        } else { clone.set(k, v); }
      }
      yslides.insert(idx + 1, [clone]);
    });
    setActiveIndex(idx + 1);
    onChanged();
  }

  function deleteSlide(idx: number) {
    if (yslides.length <= 1) return;
    ydoc.transact(() => { yslides.delete(idx, 1); });
    setActiveIndex(Math.min(idx, yslides.length - 1));
    onChanged();
  }

  // Enable draggable on all thumbs
  function enableDrag() {
    slideListEl.querySelectorAll('.slide-thumb').forEach((t) => {
      (t as HTMLElement).draggable = true;
    });
  }

  // Use MutationObserver to re-enable drag on new thumbs
  const observer = new MutationObserver(enableDrag);
  observer.observe(slideListEl, { childList: true });
  enableDrag();

  slideListEl.addEventListener('dragstart', handleDragStart);
  slideListEl.addEventListener('dragover', handleDragOver);
  slideListEl.addEventListener('drop', handleDrop);
  slideListEl.addEventListener('dragend', handleDragEnd);
  slideListEl.addEventListener('contextmenu', handleContextMenu);
  document.addEventListener('click', closeMenu);

  return {
    destroy() {
      observer.disconnect();
      slideListEl.removeEventListener('dragstart', handleDragStart);
      slideListEl.removeEventListener('dragover', handleDragOver);
      slideListEl.removeEventListener('drop', handleDrop);
      slideListEl.removeEventListener('dragend', handleDragEnd);
      slideListEl.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', closeMenu);
      closeMenu();
    },
  };
}
