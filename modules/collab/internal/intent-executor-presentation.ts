/** Contract: contracts/collab/rules.md */
import * as Y from 'yjs';

export function applyPresentationIntent(ydoc: Y.Doc, action: Record<string, unknown>): number {
  const presentationMap = ydoc.getMap<Y.Array<Y.Map<unknown>>>('presentation');
  const type = action.type as string;

  let slides = presentationMap.get('slides') as Y.Array<Y.Map<unknown>> | undefined;
  if (!slides) {
    slides = new Y.Array();
    presentationMap.set('slides', slides);
  }

  if (type === 'insert_slide') {
    const newSlide = new Y.Map<unknown>();
    newSlide.set('layout', action.layout as string);
    newSlide.set('elements', new Y.Array());
    const after = action.afterSlide as number | null;
    const insertIdx = after === null ? 0 : after + 1;
    slides.insert(insertIdx, [newSlide]);
    return 1;
  }

  if (type === 'delete_slide') {
    slides.delete(action.slide as number, 1);
    return 1;
  }

  if (type === 'reorder_slides') {
    const order = action.order as number[];
    const snapshots = order.map((i) => slides!.get(i).toJSON());
    slides.delete(0, slides.length);
    const reordered = snapshots.map((snap) => {
      const m = new Y.Map<unknown>();
      for (const [k, v] of Object.entries(snap as Record<string, unknown>)) {
        m.set(k, v);
      }
      return m;
    });
    slides.insert(0, reordered);
    return order.length;
  }

  const slideIndex = action.slide as number | undefined;
  if (slideIndex === undefined) return 0;

  const slide = slides.get(slideIndex) as Y.Map<unknown> | undefined;
  if (!slide) throw new Error(`slide_not_found:${slideIndex}`);

  let elements = slide.get('elements') as Y.Array<Y.Map<unknown>> | undefined;
  if (!elements) {
    elements = new Y.Array();
    slide.set('elements', elements);
  }

  if (type === 'insert_element') {
    const elem = action.element as Record<string, unknown>;
    const newEl = new Y.Map<unknown>();
    for (const [k, v] of Object.entries(elem)) {
      newEl.set(k, v);
    }
    elements.push([newEl]);
    return 1;
  }

  if (type === 'update_element') {
    const elId = action.elementId as string;
    const updates = action.updates as Record<string, unknown>;
    const idx = (elements.toArray() as Y.Map<unknown>[]).findIndex((e) => e.get('id') === elId);
    if (idx === -1) throw new Error(`element_not_found:${elId}`);
    const el = elements.get(idx) as Y.Map<unknown>;
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) el.set(k, v);
    }
    return 1;
  }

  if (type === 'delete_element') {
    const elId = action.elementId as string;
    const idx = (elements.toArray() as Y.Map<unknown>[]).findIndex((e) => e.get('id') === elId);
    if (idx === -1) throw new Error(`element_not_found:${elId}`);
    elements.delete(idx, 1);
    return 1;
  }

  return 0;
}
