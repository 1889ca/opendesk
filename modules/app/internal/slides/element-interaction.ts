/** Contract: contracts/app/slides-interaction.md */

import * as Y from 'yjs';
import { type SlideElement, type Point, type InteractionMode, type HandlePosition, type DragState, type ResizeState, type RotateState, NUDGE_SMALL, NUDGE_LARGE } from './types.ts';
import { startDrag, updateDrag, nudgeElements } from './drag-handler.ts';
import { startResize, updateResize } from './resize-handler.ts';
import { startRotate, updateRotate, snapRotation, getElementCenter } from './rotate-handler.ts';
import {
  createSelectionState, selectSingle, selectToggle, selectNone,
  selectByMarquee, elementAtPoint, type SelectionState,
} from './selection-manager.ts';
import { renderHandles, renderSnapGuides, clearOverlays } from './interaction-overlay.ts';
import {
  applyPositionUpdates, applyBoundsUpdate, applyRotationUpdate,
  deleteElements, applyZOrderToYjs,
} from './yjs-mutations.ts';
import { createTextEditController, type TextEditController } from './text-edit-controller.ts';

export type InteractionController = {
  destroy: () => void;
  getSelection: () => SelectionState;
  applyZOrder: (reorderedElements: SlideElement[]) => void;
  getTextEditController: () => import('./text-edit-controller.ts').TextEditController | null;
};

type InteractionContext = {
  ydoc: Y.Doc;
  viewport: HTMLElement;
  getActiveSlideElements: () => { yElements: Y.Array<Y.Map<unknown>>; elements: SlideElement[] };
  onStyleUpdate?: (elementId: string, field: string, value: unknown) => void;
};

/** Convert a mouse event's pixel position to percentage coordinates within the viewport */
export function mouseToPercent(e: MouseEvent, viewport: HTMLElement): Point {
  const rect = viewport.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * 100,
    y: ((e.clientY - rect.top) / rect.height) * 100,
  };
}

export function createInteractionController(ctx: InteractionContext): InteractionController {
  let mode: InteractionMode = 'idle';
  let selection = createSelectionState();
  let dragState: DragState | null = null;
  let resizeState: ResizeState | null = null;
  let rotateState: RotateState | null = null;
  let marqueeStart: Point | null = null;

  const textEditCtrl: TextEditController | null = ctx.onStyleUpdate
    ? createTextEditController(ctx.viewport, ctx.onStyleUpdate)
    : null;

  function onSelectionChange() {
    const { elements } = ctx.getActiveSlideElements();
    const selected = elements.filter((el) => selection.selectedIds.has(el.id));
    renderHandles(ctx.viewport, selected);
  }

  function handleDblClick(e: MouseEvent) {
    if (!textEditCtrl) return;
    const { elements } = ctx.getActiveSlideElements();
    const hit = elementAtPoint(elements, mouseToPercent(e, ctx.viewport));
    if (!hit || (hit.type !== 'text' && hit.type !== 'shape')) return;
    const dom = ctx.viewport.querySelector(`[data-element-id="${hit.id}"]`);
    if (dom instanceof HTMLElement) {
      textEditCtrl.enterEditMode(hit.id, dom);
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    if (textEditCtrl?.isEditing()) {
      const target = e.target as HTMLElement;
      const editingId = textEditCtrl.getEditingId();
      const el = editingId ? ctx.viewport.querySelector(`[data-element-id="${editingId}"]`) : null;
      if (el && !el.contains(target)) textEditCtrl.exitEditMode();
      else if (el?.contains(target)) return; // let TipTap handle
    }
    const percent = mouseToPercent(e, ctx.viewport);
    const target = e.target as HTMLElement;

    const handleAttr = target.dataset.resizeHandle as HandlePosition | undefined;
    const singleSel = selection.selectedIds.size === 1 ? [...selection.selectedIds][0] : null;
    if (singleSel && (handleAttr || target.dataset.rotateHandle)) {
      const el = ctx.getActiveSlideElements().elements.find((el) => el.id === singleSel);
      if (el && handleAttr) {
        mode = 'resizing';
        resizeState = { ...startResize({ x: el.x, y: el.y, width: el.width, height: el.height }, handleAttr, percent, e.shiftKey), elementId: singleSel };
        e.preventDefault(); return;
      }
      if (el && target.dataset.rotateHandle) {
        mode = 'rotating';
        rotateState = { ...startRotate(getElementCenter(el.x, el.y, el.width, el.height), percent, el.rotation || 0), elementId: singleSel };
        e.preventDefault(); return;
      }
    }

    // Element click or canvas click
    const { elements } = ctx.getActiveSlideElements();
    const hit = elementAtPoint(elements, percent);
    if (hit) {
      selection = e.shiftKey ? selectToggle(selection, hit.id) : (
        selection.selectedIds.has(hit.id) ? selection : selectSingle(selection, hit.id)
      );
      onSelectionChange();
      mode = 'dragging';
      dragState = startDrag(elements, [...selection.selectedIds], percent);
      e.preventDefault();
    } else {
      selection = selectNone();
      onSelectionChange();
      mode = 'marquee';
      marqueeStart = percent;
      e.preventDefault();
    }
  }

  function handleMouseMove(e: MouseEvent) {
    const percent = mouseToPercent(e, ctx.viewport);
    if (mode === 'dragging' && dragState) {
      const { elements } = ctx.getActiveSlideElements();
      const result = updateDrag(dragState, percent, elements);
      renderSnapGuides(ctx.viewport, result.guides);
      applyPositionUpdates(ctx.ydoc, ctx.getActiveSlideElements(), result.updates);
    } else if (mode === 'resizing' && resizeState) {
      const result = updateResize(resizeState, percent, e.shiftKey);
      applyBoundsUpdate(ctx.ydoc, ctx.getActiveSlideElements(), resizeState.elementId, result.bounds);
    } else if (mode === 'rotating' && rotateState) {
      let angle = updateRotate(rotateState, percent);
      if (e.shiftKey) angle = snapRotation(angle);
      applyRotationUpdate(ctx.ydoc, ctx.getActiveSlideElements(), rotateState.elementId, angle);
    } else if (mode === 'marquee' && marqueeStart) {
      const { elements } = ctx.getActiveSlideElements();
      selection = selectByMarquee(elements, marqueeStart, percent);
      onSelectionChange();
    }
  }

  function handleMouseUp() {
    mode = 'idle';
    dragState = resizeState = rotateState = null;
    marqueeStart = null;
    clearOverlays(ctx.viewport, 'snap-guides');
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (textEditCtrl?.isEditing()) {
      if (e.key === 'Escape') { e.preventDefault(); textEditCtrl.exitEditMode(); }
      return;
    }
    if (selection.selectedIds.size === 0) return;
    const dirs: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    };
    const dir = dirs[e.key];
    if (dir) {
      e.preventDefault();
      const amount = e.shiftKey ? NUDGE_LARGE : NUDGE_SMALL;
      const updates = nudgeElements(ctx.getActiveSlideElements().elements, [...selection.selectedIds], dir, amount);
      applyPositionUpdates(ctx.ydoc, ctx.getActiveSlideElements(), updates);
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteElements(ctx.ydoc, ctx.getActiveSlideElements(), selection.selectedIds);
      selection = selectNone();
      onSelectionChange();
    }
  }

  const vp = ctx.viewport;
  vp.addEventListener('mousedown', handleMouseDown);
  vp.addEventListener('dblclick', handleDblClick);
  vp.addEventListener('keydown', handleKeyDown);
  vp.setAttribute('tabindex', '0');
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  return {
    destroy() {
      vp.removeEventListener('mousedown', handleMouseDown);
      vp.removeEventListener('dblclick', handleDblClick);
      vp.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      textEditCtrl?.destroy();
      clearOverlays(vp, 'all');
    },
    getSelection: () => selection,
    applyZOrder: (els: SlideElement[]) => applyZOrderToYjs(ctx.ydoc, ctx.getActiveSlideElements(), els),
    getTextEditController: () => textEditCtrl,
  };
}
