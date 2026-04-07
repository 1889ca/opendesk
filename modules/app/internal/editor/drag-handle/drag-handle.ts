/** Contract: contracts/app/rules.md */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { t } from '../../i18n/index.ts';
import { buildDragHandle, positionHandle, hideDragHandle } from './drag-handle-dom.ts';
import { createDropIndicator, updateDropIndicator, hideDropIndicator } from './drop-indicator.ts';

export const DragHandlePluginKey = new PluginKey('dragHandle');

interface DragState {
  handleEl: HTMLElement;
  indicatorEl: HTMLElement;
  draggedPos: number | null;
}

function resolveTopLevelPos(view: EditorView, y: number): number | null {
  const pos = view.posAtCoords({ left: view.dom.getBoundingClientRect().left + 10, top: y });
  if (!pos) return null;
  const resolved = view.state.doc.resolve(pos.pos);
  // Walk up to depth 1 (top-level node)
  if (resolved.depth < 1) return null;
  return resolved.before(1);
}

function handleMouseMove(view: EditorView, state: DragState, event: MouseEvent): void {
  if (state.draggedPos !== null) return; // dragging, skip
  const target = event.target as HTMLElement;
  if (state.handleEl.contains(target)) return;

  const pos = resolveTopLevelPos(view, event.clientY);
  if (pos === null) {
    hideDragHandle(state.handleEl);
    return;
  }

  const node = view.state.doc.nodeAt(pos);
  if (!node) {
    hideDragHandle(state.handleEl);
    return;
  }

  const domNode = view.nodeDOM(pos);
  if (!domNode || !(domNode instanceof HTMLElement)) {
    hideDragHandle(state.handleEl);
    return;
  }

  positionHandle(state.handleEl, domNode, view.dom);
  state.handleEl.dataset.pos = String(pos);
}

function handleDragStart(view: EditorView, state: DragState, event: DragEvent): void {
  const posStr = state.handleEl.dataset.pos;
  if (posStr == null) return;

  const pos = Number(posStr);
  const node = view.state.doc.nodeAt(pos);
  if (!node) return;

  state.draggedPos = pos;
  const slice = view.state.doc.slice(pos, pos + node.nodeSize);
  event.dataTransfer?.setData('application/x-opendesk-drag', String(pos));
  view.dragging = { slice, move: true };

  // Add dragging class to source block
  const domNode = view.nodeDOM(pos);
  if (domNode instanceof HTMLElement) {
    domNode.classList.add('drag-handle-dragging');
  }
}

export const DragHandle = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: DragHandlePluginKey,
        view(editorView) {
          const handleEl = buildDragHandle(t('dragHandle.tooltip'));
          const indicatorEl = createDropIndicator();
          const state: DragState = { handleEl, indicatorEl, draggedPos: null };

          const editorParent = editorView.dom.parentElement;
          if (editorParent) {
            editorParent.style.position = 'relative';
            editorParent.appendChild(handleEl);
            editorParent.appendChild(indicatorEl);
          }

          const onMouseMove = (e: MouseEvent) => handleMouseMove(editorView, state, e);
          const onMouseLeave = () => { if (!state.draggedPos) hideDragHandle(state.handleEl); };
          const onDragStart = (e: DragEvent) => handleDragStart(editorView, state, e);

          const onDragOver = (e: DragEvent) => {
            if (state.draggedPos === null) return;
            e.preventDefault();
            updateDropIndicator(state.indicatorEl, editorView, e.clientY);
          };

          const onDrop = () => {
            hideDropIndicator(state.indicatorEl);
            // Dragging class cleanup
            if (state.draggedPos !== null) {
              const srcDom = editorView.nodeDOM(state.draggedPos);
              if (srcDom instanceof HTMLElement) srcDom.classList.remove('drag-handle-dragging');
            }
            state.draggedPos = null;
            // ProseMirror handles the actual drop via view.dragging
          };

          const onDragEnd = () => {
            hideDropIndicator(state.indicatorEl);
            if (state.draggedPos !== null) {
              const srcDom = editorView.nodeDOM(state.draggedPos);
              if (srcDom instanceof HTMLElement) srcDom.classList.remove('drag-handle-dragging');
            }
            state.draggedPos = null;
            hideDragHandle(state.handleEl);
          };

          editorView.dom.addEventListener('mousemove', onMouseMove);
          editorView.dom.addEventListener('mouseleave', onMouseLeave);
          handleEl.addEventListener('dragstart', onDragStart);
          editorView.dom.addEventListener('dragover', onDragOver);
          editorView.dom.addEventListener('drop', onDrop);
          editorView.dom.addEventListener('dragend', onDragEnd);

          return {
            update() {
              hideDragHandle(state.handleEl);
            },
            destroy() {
              editorView.dom.removeEventListener('mousemove', onMouseMove);
              editorView.dom.removeEventListener('mouseleave', onMouseLeave);
              handleEl.removeEventListener('dragstart', onDragStart);
              editorView.dom.removeEventListener('dragover', onDragOver);
              editorView.dom.removeEventListener('drop', onDrop);
              editorView.dom.removeEventListener('dragend', onDragEnd);
              handleEl.remove();
              indicatorEl.remove();
            },
          };
        },
      }),
    ];
  },
});
