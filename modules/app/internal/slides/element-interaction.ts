/** Contract: contracts/app/slides-interaction.md */

import * as Y from 'yjs';
import type { SlideElement, Point, InteractionMode, HandlePosition, DragState, ResizeState, RotateState } from './types.ts';
import { NUDGE_SMALL, NUDGE_LARGE } from './types.ts';
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

export type InteractionController = {
  destroy: () => void;
  getSelection: () => SelectionState;
  applyZOrder: (reorderedElements: SlideElement[]) => void;
};

type InteractionContext = {
  ydoc: Y.Doc;
  viewport: HTMLElement;
  getActiveSlideElements: () => { yElements: Y.Array<Y.Map<unknown>>; elements: SlideElement[] };
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

  function onSelectionChange() {
    const { elements } = ctx.getActiveSlideElements();
    const selected = elements.filter((el) => selection.selectedIds.has(el.id));
    renderHandles(ctx.viewport, selected);
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    const percent = mouseToPercent(e, ctx.viewport);
    const target = e.target as HTMLElement;

    // Resize handle click
    const handleAttr = target.dataset.resizeHandle as HandlePosition | undefined;
    if (handleAttr && selection.selectedIds.size === 1) {
      const { elements } = ctx.getActiveSlideElements();
      const selId = [...selection.selectedIds][0];
      const el = elements.find((el) => el.id === selId);
      if (el) {
        mode = 'resizing';
        resizeState = {
          ...startResize({ x: el.x, y: el.y, width: el.width, height: el.height }, handleAttr, percent, e.shiftKey),
          elementId: selId,
        };
        e.preventDefault();
        return;
      }
    }

    // Rotation handle click
    if (target.dataset.rotateHandle && selection.selectedIds.size === 1) {
      const { elements } = ctx.getActiveSlideElements();
      const selId = [...selection.selectedIds][0];
      const el = elements.find((el) => el.id === selId);
      if (el) {
        mode = 'rotating';
        const center = getElementCenter(el.x, el.y, el.width, el.height);
        rotateState = { ...startRotate(center, percent, el.rotation || 0), elementId: selId };
        e.preventDefault();
        return;
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
    dragState = null;
    resizeState = null;
    rotateState = null;
    marqueeStart = null;
    clearOverlays(ctx.viewport, 'snap-guides');
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (selection.selectedIds.size === 0) return;
    const dirs: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    };
    const dir = dirs[e.key];
    if (dir) {
      e.preventDefault();
      const amount = e.shiftKey ? NUDGE_LARGE : NUDGE_SMALL;
      const { elements } = ctx.getActiveSlideElements();
      const updates = nudgeElements(elements, [...selection.selectedIds], dir, amount);
      applyPositionUpdates(ctx.ydoc, ctx.getActiveSlideElements(), updates);
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteElements(ctx.ydoc, ctx.getActiveSlideElements(), selection.selectedIds);
      selection = selectNone();
      onSelectionChange();
    }
  }

  ctx.viewport.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  ctx.viewport.addEventListener('keydown', handleKeyDown);
  ctx.viewport.setAttribute('tabindex', '0');

  return {
    destroy() {
      ctx.viewport.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      ctx.viewport.removeEventListener('keydown', handleKeyDown);
      clearOverlays(ctx.viewport, 'all');
    },
    getSelection: () => selection,
    applyZOrder(reorderedElements: SlideElement[]) {
      applyZOrderToYjs(ctx.ydoc, ctx.getActiveSlideElements(), reorderedElements);
    },
  };
}
